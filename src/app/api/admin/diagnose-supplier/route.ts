import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// POST /api/admin/diagnose-supplier { searchTerm }
// Admin-only diagnostic that searches for any trace of a supplier name:
//   - Supplier table (by name, case-insensitive contains)
//   - Entry.category (case-insensitive contains) — supplier-bill entries
//     store the supplier NAME in Entry.category, so even after a supplier
//     is deleted, old entries can still hold the name
//   - SupplierBill via the linked Supplier (or by note containing the term)
//
// This is read-only and meant to help admins figure out whether a "merge"
// or "rename" operation actually completed cleanly, or whether some
// entries/bills still carry the old name.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const term = String(body?.searchTerm ?? '').trim()
    if (!term) {
      return NextResponse.json({ error: 'searchTerm is required' }, { status: 400 })
    }

    // 1. Supplier records matching the term
    const supplierRes = await libsql.execute({
      sql: `SELECT id, name, phone, address, note, "createdAt"
            FROM "Supplier"
            WHERE LOWER(name) LIKE LOWER(?) OR LOWER(note) LIKE LOWER(?) OR LOWER(address) LIKE LOWER(?)
            ORDER BY name ASC`,
      args: [`%${term}%`, `%${term}%`, `%${term}%`],
    })

    // 2. Entries whose category contains the term (these are the rows that
    //    would show up in reports — Branch Daily, Expense Details, P&L COGS,
    //    Payment History — under the searched name)
    const entryRes = await libsql.execute({
      sql: `SELECT e.id, e.kind, e.category, e.amount, e.date, e.source,
                   e."paymentMethod", e.note,
                   s.name AS "supplierName",
                   b."bankName"
            FROM "Entry" e
            LEFT JOIN "Supplier" s ON e."supplierId" = s.id
            LEFT JOIN "BankAccount" b ON e."bankAccountId" = b.id
            WHERE LOWER(e.category) LIKE LOWER(?) OR LOWER(e.note) LIKE LOWER(?)
            ORDER BY e.date DESC, e."createdAt" DESC
            LIMIT 50`,
      args: [`%${term}%`, `%${term}%`],
    })

    // 3. SupplierBills whose supplier name OR note contains the term
    const billRes = await libsql.execute({
      sql: `SELECT sb.id, sb."billDate", sb."billNumber", sb."billAmount",
                   sb."paidAmount", sb.note,
                   s.name AS "supplierName"
            FROM "SupplierBill" sb
            LEFT JOIN "Supplier" s ON sb."supplierId" = s.id
            WHERE LOWER(s.name) LIKE LOWER(?) OR LOWER(sb.note) LIKE LOWER(?)
            ORDER BY sb."billDate" DESC
            LIMIT 50`,
      args: [`%${term}%`, `%${term}%`],
    })

    return NextResponse.json({
      searchTerm: term,
      suppliers: supplierRes.rows,
      supplierCount: supplierRes.rows.length,
      entries: entryRes.rows,
      entryCount: entryRes.rows.length,
      bills: billRes.rows,
      billCount: billRes.rows.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
