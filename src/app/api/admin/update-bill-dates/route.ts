import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// POST /api/admin/update-bill-dates { billIds: string[], newDate: string }
// Admin-only. Bulk-updates the billDate on the specified SupplierBill
// records. Used when bills were entered with the wrong date and the
// user wants to correct them in one shot.
//
// Does NOT touch any other field — billAmount, paidAmount, supplierId,
// billNumber, note are all preserved. Only billDate changes.
//
// Also updates the linked Entry.date on entries that match the SAME
// supplier + old date, so the expense entry moves with the bill. This
// keeps the Branch Daily Report consistent (the payment will now appear
// under the new date instead of the old one).

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const billIds: string[] = Array.isArray(body?.billIds) ? body.billIds.map(String) : []
    const newDate = String(body?.newDate ?? '').trim()

    if (billIds.length === 0) {
      return NextResponse.json({ error: 'billIds array is required (at least one id)' }, { status: 400 })
    }
    if (!isValidDate(newDate)) {
      return NextResponse.json({ error: 'newDate must be a valid YYYY-MM-DD date' }, { status: 400 })
    }

    // Fetch the current bills so we know the old date + supplierId for each
    // (needed to update the linked Entry rows too).
    const placeholders = billIds.map(() => '?').join(',')
    const fetchRes = await libsql.execute({
      sql: `SELECT id, "supplierId", "billDate" FROM "SupplierBill" WHERE id IN (${placeholders})`,
      args: billIds,
    })
    const existing = fetchRes.rows as { id: string; supplierId: string; billDate: string }[]

    if (existing.length === 0) {
      return NextResponse.json({ error: 'No bills found with the given ids' }, { status: 404 })
    }

    const results: { id: string; oldDate: string; newDate: string; supplierId: string; entryUpdated?: number; ok: boolean }[] = []

    for (const bill of existing) {
      // Update the SupplierBill.billDate
      await libsql.execute({
        sql: `UPDATE "SupplierBill" SET "billDate" = ? WHERE id = ?`,
        args: [newDate, bill.id],
      })

      // Also update linked Entry rows: any EXPENSE entry with the same
      // supplierId and date = old billDate should move to newDate.
      // This keeps Branch Daily Report / Payment History consistent.
      let entryUpdated = 0
      try {
        const entryRes = await libsql.execute({
          sql: `UPDATE "Entry" SET date = ? WHERE "supplierId" = ? AND date = ? AND kind = 'EXPENSE'`,
          args: [newDate, bill.supplierId, bill.billDate],
        })
        entryUpdated = (entryRes as unknown as { rowsAffected?: number }).rowsAffected ?? 0
      } catch {
        // Non-critical — the bill itself was updated successfully
      }

      results.push({
        id: bill.id,
        oldDate: bill.billDate,
        newDate,
        supplierId: bill.supplierId,
        entryUpdated,
        ok: true,
      })
    }

    return NextResponse.json({
      ok: true,
      message: `Updated ${results.length} bill(s) to ${newDate}.`,
      newDate,
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
