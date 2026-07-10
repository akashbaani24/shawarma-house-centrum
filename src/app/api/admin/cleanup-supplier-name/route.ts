import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql, db } from '@/lib/db'

// POST /api/admin/cleanup-supplier-name { oldName, targetSupplierId }
//
// Admin-only. Fixes entries that STILL carry an old supplier name in
// Entry.category even after a Supplier Merge — happens when entries
// were created as Regular Expense (supplierId = NULL) with the supplier
// name typed as the category.
//
// Implementation note: uses raw libsql (not Prisma) because Prisma's
// `mode: 'insensitive'` does not work on SQLite — that was the bug
// in the previous version. SQLite's LIKE is case-insensitive by default
// for ASCII, but we use LOWER() to be safe across all characters.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const oldName = String(body?.oldName ?? '').trim()
    const targetSupplierId = String(body?.targetSupplierId ?? '').trim()

    if (!oldName) {
      return NextResponse.json({ error: 'oldName is required' }, { status: 400 })
    }
    if (!targetSupplierId) {
      return NextResponse.json({ error: 'targetSupplierId is required' }, { status: 400 })
    }

    // Validate target supplier (use Prisma for this single lookup — it's fine)
    const target = await db.supplier.findUnique({ where: { id: targetSupplierId } })
    if (!target) {
      return NextResponse.json({ error: 'Target supplier not found' }, { status: 404 })
    }

    // STEP 1: Find all matching entries via raw libsql (case-insensitive
    // via LOWER()). This is the diagnostic step — show the admin what
    // would change BEFORE actually updating.
    const findRes = await libsql.execute({
      sql: `SELECT id, category, "supplierId", amount, date, source, note
            FROM "Entry"
            WHERE LOWER(category) = LOWER(?)`,
      args: [oldName],
    })

    const matched = findRes.rows as {
      id: string; category: string; supplierId: string | null
      amount: number; date: string; source: string; note: string | null
    }[]

    if (matched.length === 0) {
      // Also check what entries DO exist with a similar name (debug info)
      const debugRes = await libsql.execute({
        sql: `SELECT DISTINCT category, COUNT(*) as cnt
              FROM "Entry"
              WHERE LOWER(category) LIKE LOWER(?)
              GROUP BY category
              ORDER BY cnt DESC`,
        args: [`%${oldName}%`],
      })
      return NextResponse.json({
        ok: true,
        message: `No entries found with category EXACTLY = "${oldName}". Nothing to fix.`,
        updatedCount: 0,
        targetSupplier: target.name,
        debug: {
          hint: 'Entries with SIMILAR (contains) category names:',
          similarCategories: debugRes.rows,
        },
      })
    }

    // STEP 2: Update all matching entries via raw libsql.
    // Set category = target.name and supplierId = targetSupplierId.
    const updateRes = await libsql.execute({
      sql: `UPDATE "Entry"
            SET category = ?, "supplierId" = ?
            WHERE LOWER(category) = LOWER(?)`,
      args: [target.name, targetSupplierId, oldName],
    })

    // updateRes.rowsAffected contains the count for libsql
    const updatedCount = (updateRes as unknown as { rowsAffected?: number }).rowsAffected ?? matched.length

    return NextResponse.json({
      ok: true,
      message: `Updated ${updatedCount} entries: category "${oldName}" → "${target.name}", supplierId → ${targetSupplierId}.`,
      updatedCount,
      targetSupplier: target.name,
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
