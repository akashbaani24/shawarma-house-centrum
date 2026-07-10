import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/admin/cleanup-supplier-name { oldName, targetSupplierId }
//
// Admin-only. Fixes entries that STILL carry an old supplier name in
// Entry.category even after a Supplier Merge — this happens when the
// entries were originally created as Regular Expense (supplierId = NULL)
// but the user typed the supplier NAME as the category by mistake, OR
// when the merge API's category-rewrite was skipped because supplierId
// did not match.
//
// What this does:
//   1. Validates that targetSupplierId exists in the Supplier table
//   2. Finds every Entry whose category EXACTLY matches oldName
//      (case-insensitive) — regardless of supplierId
//   3. Updates each such Entry:
//       - category → target supplier's name
//       - supplierId → targetSupplierId
//       (so the entry now shows up under the correct supplier everywhere:
//        P&L COGS, Payment History, Supplier Due, Branch Daily, etc.)
//   4. Does NOT touch SupplierBill (those were already re-pointed during
//      the original merge, OR they don't exist for these entries)
//   5. Does NOT delete any Supplier record (this is just a data fix)
//
// Returns the count of entries updated so the admin can verify.

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

    // Validate target supplier
    const target = await db.supplier.findUnique({ where: { id: targetSupplierId } })
    if (!target) {
      return NextResponse.json({ error: 'Target supplier not found' }, { status: 404 })
    }

    // Find all entries whose category matches oldName (case-insensitive)
    // Use Prisma findMany first so we can show the user what will change
    const matching = await db.entry.findMany({
      where: { category: { equals: oldName, mode: 'insensitive' } },
      select: { id: true, category: true, supplierId: true, amount: true, date: true, source: true, note: true },
    })

    if (matching.length === 0) {
      return NextResponse.json({
        ok: true,
        message: `No entries found with category = "${oldName}". Nothing to fix.`,
        updatedCount: 0,
        targetSupplier: target.name,
      })
    }

    // Update all matching entries: set category to target name + supplierId to target id
    const updated = await db.entry.updateMany({
      where: { category: { equals: oldName, mode: 'insensitive' } },
      data: {
        category: target.name,
        supplierId: targetSupplierId,
      },
    })

    return NextResponse.json({
      ok: true,
      message: `Updated ${updated.count} entries: category "${oldName}" → "${target.name}", supplierId → ${targetSupplierId}.`,
      updatedCount: updated.count,
      targetSupplier: target.name,
      // Show a preview of what was changed (first 10 entries)
      preview: matching.slice(0, 10).map((e) => ({
        id: e.id,
        before: { category: e.category, supplierId: e.supplierId },
        after: { category: target.name, supplierId: targetSupplierId },
        amount: e.amount,
        date: e.date,
        source: e.source,
        note: e.note,
      })),
      totalMatched: matching.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
