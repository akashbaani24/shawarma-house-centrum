import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql, db } from '@/lib/db'

// ============ Helper ============
// Normalize a string for fuzzy matching:
//   - lowercase
//   - collapse all whitespace to single space
//   - remove all non-alphanumeric chars
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '')
}

// POST /api/admin/cleanup-supplier-name { oldName, targetSupplierId, fuzzy? }
//
// Admin-only. Fixes entries that STILL carry an old supplier name in
// Entry.category even after a Supplier Merge.
//
// Two modes (controlled by `fuzzy` flag):
//   fuzzy = false (default): EXACT match (case-insensitive) on category
//   fuzzy = true:            normalized match (lowercase + strip whitespace
//                            + strip punctuation). Use this when the
//                            stored category has typos like
//                            "Bashundhara Main KItchen" (capital I)
//                            or "Bashundhara  Main Kitchen" (double space).
//
// The fuzzy mode does app-level filtering after pulling entries, because
// SQLite's LIKE doesn't do normalization. We pull all EXPENSE entries
// whose category contains a token from oldName, then filter in JS.
//
// Returns counts + preview + (if no match) a list of all unique category
// names that look similar — so the admin can see the exact spelling.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const oldName = String(body?.oldName ?? '').trim()
    const targetSupplierId = String(body?.targetSupplierId ?? '').trim()
    const fuzzy = body?.fuzzy === true

    if (!oldName) {
      return NextResponse.json({ error: 'oldName is required' }, { status: 400 })
    }
    if (!targetSupplierId) {
      return NextResponse.json({ error: 'targetSupplierId is required' }, { status: 400 })
    }

    // Validate target supplier
    const target = await db.supplier.findUnique({ where: { id: targetSupplierId } })
    if (!target) {
      return NextResponse.json({ error: 'Target supplier not found' }, { status: 404 })
    }

    // === STEP 1: Find all candidate entries ===
    // Pull every EXPENSE entry whose category contains ANY of the words from
    // oldName (use the longest word to keep result set manageable). Then
    // filter in JS based on fuzzy/exact mode.
    const tokens = oldName.toLowerCase().split(/\s+/).filter((t) => t.length >= 4)
    const searchToken = tokens.length > 0 ? tokens[0] : oldName.toLowerCase()

    const findRes = await libsql.execute({
      sql: `SELECT id, category, "supplierId", amount, date, source, note, kind
            FROM "Entry"
            WHERE kind = 'EXPENSE' AND LOWER(category) LIKE ?
            ORDER BY date DESC, "createdAt" DESC
            LIMIT 500`,
      args: [`%${searchToken}%`],
    })

    const allCandidates = findRes.rows as {
      id: string; category: string; supplierId: string | null
      amount: number; date: string; source: string; note: string | null; kind: string
    }[]

    // Filter to actual matches
    const oldNameNorm = norm(oldName)
    const matched = fuzzy
      ? allCandidates.filter((e) => norm(e.category) === oldNameNorm)
      : allCandidates.filter((e) => e.category.toLowerCase() === oldName.toLowerCase())

    if (matched.length === 0) {
      // Show debug info: all unique category names containing the search token
      const uniqueCats = new Map<string, number>()
      for (const c of allCandidates) {
        uniqueCats.set(c.category, (uniqueCats.get(c.category) ?? 0) + 1)
      }
      return NextResponse.json({
        ok: true,
        message: `No entries found matching "${oldName}" (fuzzy=${fuzzy}). Nothing to fix.`,
        updatedCount: 0,
        targetSupplier: target.name,
        fuzzy,
        debug: {
          searchToken,
          candidateCount: allCandidates.length,
          uniqueCategoryNames: Array.from(uniqueCats.entries())
            .map(([name, count]) => ({ category: name, count, normalized: norm(name) }))
            .sort((a, b) => b.count - a.count),
          wantedNormalized: oldNameNorm,
        },
      })
    }

    // === STEP 2: Update each matched entry one by one ===
    // (libsql batch UPDATE with OR conditions gets messy with IDs — easier
    // to loop. With ~50 entries this is fast enough.)
    let updatedCount = 0
    for (const e of matched) {
      await libsql.execute({
        sql: `UPDATE "Entry" SET category = ?, "supplierId" = ? WHERE id = ?`,
        args: [target.name, targetSupplierId, e.id],
      })
      updatedCount++
    }

    return NextResponse.json({
      ok: true,
      message: `Updated ${updatedCount} entries: category matched "${oldName}" → "${target.name}", supplierId → ${targetSupplierId}.`,
      updatedCount,
      targetSupplier: target.name,
      fuzzy,
      preview: matched.slice(0, 10).map((e) => ({
        id: e.id,
        before: { category: e.category, supplierId: e.supplierId },
        after: { category: target.name, supplierId: targetSupplierId },
        amount: e.amount,
        date: e.date,
        source: e.source,
        note: e.note,
      })),
      totalMatched: matched.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
