import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ============ Supplier Merge ============
//
// POST /api/admin/merge-supplier { sourceId, targetId }
//
//   sourceId — supplier to merge FROM (will be deleted at the end)
//   targetId — supplier to merge INTO  (kept, all data moves here)
//
// What this does:
//   1. Validates both supplier IDs and ensures they are different
//   2. Re-points every Entry.supplierId from sourceId → targetId
//      (amount, note, date, paymentMethod, bankAccountId, etc. UNCHANGED)
//   3. Re-points every SupplierBill.supplierId from sourceId → targetId
//      (billDate, billNumber, billAmount, paidAmount, note UNCHANGED)
//   4. Deletes the source supplier
//      (only succeeds because nothing references it anymore)
//
// After merge:
//   - All entries and bills are now under the target supplier's name
//   - The source supplier no longer exists
//   - P&L, Branch reports, Supplier Report — all show unified data
//
// This is an idempotent-safe operation in the sense that if the sourceId
// is already gone (e.g. double-clicked), step 1's lookup will 404 cleanly.
//
// NOTE on Entry.category:
//   Legacy supplier-bill entries store the supplier's NAME in Entry.category
//   (because there is no separate "supplier name" column). After the merge,
//   the target supplier keeps its own name, but entries that were created
//   under the source supplier still have the OLD name in Entry.category.
//   To keep things consistent (so P&L COGS shows only ONE name) we ALSO
//   rewrite Entry.category from the source name to the target name on
//   entries whose supplierId matches the target. We do this BEFORE the
//   re-point so we can find them by supplierId === sourceId.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const sourceId = String(body?.sourceId ?? '').trim()
    const targetId = String(body?.targetId ?? '').trim()

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'sourceId and targetId are required' }, { status: 400 })
    }
    if (sourceId === targetId) {
      return NextResponse.json({ error: 'sourceId and targetId must be different' }, { status: 400 })
    }

    // 1. Validate both suppliers exist
    const [source, target] = await Promise.all([
      db.supplier.findUnique({ where: { id: sourceId } }),
      db.supplier.findUnique({ where: { id: targetId } }),
    ])
    if (!source) {
      return NextResponse.json({ error: 'Source supplier not found' }, { status: 404 })
    }
    if (!target) {
      return NextResponse.json({ error: 'Target supplier not found' }, { status: 404 })
    }

    // 2. Update Entry.category on source supplier's entries — rewrite the
    //    category from source.name to target.name so reports that read
    //    Entry.category directly (P&L COGS, Branch Daily) show one name.
    //    This must happen BEFORE the re-point so we can match by supplierId.
    const entriesCategoryUpdated = await db.entry.updateMany({
      where: { supplierId: sourceId, category: source.name },
      data: { category: target.name },
    })

    // 3. Re-point Entry.supplierId from sourceId → targetId
    const entriesRepointed = await db.entry.updateMany({
      where: { supplierId: sourceId },
      data: { supplierId: targetId },
    })

    // 4. Re-point SupplierBill.supplierId from sourceId → targetId
    const billsRepointed = await db.supplierBill.updateMany({
      where: { supplierId: sourceId },
      data: { supplierId: targetId },
    })

    // 5. Delete the source supplier (nothing references it now)
    await db.supplier.delete({ where: { id: sourceId } })

    return NextResponse.json({
      ok: true,
      message: `Merged "${source.name}" → "${target.name}" successfully.`,
      result: {
        sourceName: source.name,
        targetName: target.name,
        entriesCategoryRewritten: entriesCategoryUpdated.count,
        entriesRepointed: entriesRepointed.count,
        billsRepointed: billsRepointed.count,
        sourceDeleted: true,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
