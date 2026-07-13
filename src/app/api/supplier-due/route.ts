import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/supplier-due?from=&to=
// Returns supplier-wise due summary:
//   per supplier: totalBill, totalPaid, due, billCount
// "Due" is computed from SupplierBill table:
//   due = SUM(billAmount) - SUM(paidAmount)
// Optionally limited to a date range (by billDate).
// Suppliers with NO bills in range are still listed (with zeros) so the
// user sees a complete picture.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Valid from and to dates are required' }, { status: 400 })
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be before or equal to to' }, { status: 400 })
  }

  // Use direct libsql for speed — single GROUP BY query instead of
  // Prisma's nested `bills` include which fires a separate query per
  // supplier (N+1 problem). This does it all in one round-trip.
  const [suppliersRes, billsRes, logoRes] = await Promise.all([
    libsql.execute({
      sql: `SELECT id, name, phone, address FROM "Supplier" ORDER BY name ASC`,
      args: [],
    }),
    libsql.execute({
      sql: `SELECT "supplierId",
                  COUNT(*) AS "billCount",
                  COALESCE(SUM("billAmount"), 0) AS "totalBill",
                  COALESCE(SUM("paidAmount"), 0) AS "totalPaid",
                  MAX("billDate") AS "lastBillDate"
            FROM "SupplierBill"
            WHERE "billDate" >= ? AND "billDate" <= ?
            GROUP BY "supplierId"`,
      args: [from, to],
    }),
    libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
  ])

  // Build a quick lookup: supplierId → aggregated bill stats
  const billStats = new Map<string, { billCount: number; totalBill: number; totalPaid: number; lastBillDate: string | null }>()
  for (const row of billsRes.rows as {
    supplierId: string; billCount: number; totalBill: number; totalPaid: number; lastBillDate: string | null
  }[]) {
    billStats.set(row.supplierId, {
      billCount: Number(row.billCount) || 0,
      totalBill: Number(row.totalBill) || 0,
      totalPaid: Number(row.totalPaid) || 0,
      lastBillDate: row.lastBillDate,
    })
  }

  // Combine supplier info with bill stats
  const rows = (suppliersRes.rows as {
    id: string; name: string; phone: string | null; address: string | null
  }[]).map((s) => {
    const stats = billStats.get(s.id) ?? { billCount: 0, totalBill: 0, totalPaid: 0, lastBillDate: null }
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      address: s.address,
      billCount: stats.billCount,
      totalBill: stats.totalBill,
      totalPaid: stats.totalPaid,
      due: stats.totalBill - stats.totalPaid,
      lastBillDate: stats.lastBillDate,
    }
  })

  const grandTotalBill = rows.reduce((s, r) => s + r.totalBill, 0)
  const grandTotalPaid = rows.reduce((s, r) => s + r.totalPaid, 0)
  const grandDue = grandTotalBill - grandTotalPaid
  const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

  return NextResponse.json({
    from, to,
    businessName: session.user.businessName,
    logoUrl,
    suppliers: rows,
    grandTotalBill,
    grandTotalPaid,
    grandDue,
  })
}
