import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

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

  const [suppliers, businessProfile] = await Promise.all([
    db.supplier.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        bills: {
          where: { billDate: { gte: from, lte: to } },
          select: { billAmount: true, paidAmount: true, billDate: true, billNumber: true },
        },
      },
    }),
    db.businessProfile.findFirst(),
  ])

  const rows = suppliers.map((s) => {
    const totalBill = s.bills.reduce((sum, b) => sum + b.billAmount, 0)
    const totalPaid = s.bills.reduce((sum, b) => sum + b.paidAmount, 0)
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      address: s.address,
      billCount: s.bills.length,
      totalBill,
      totalPaid,
      due: totalBill - totalPaid,
      // Keep the billDate list for sort + reference (oldest unpaid bill helps prioritization)
      lastBillDate: s.bills.length > 0 ? s.bills[s.bills.length - 1].billDate : null,
    }
  })

  const grandTotalBill = rows.reduce((s, r) => s + r.totalBill, 0)
  const grandTotalPaid = rows.reduce((s, r) => s + r.totalPaid, 0)
  const grandDue = grandTotalBill - grandTotalPaid

  return NextResponse.json({
    from, to,
    businessName: session.user.businessName,
    logoUrl: businessProfile?.logoUrl ?? null,
    suppliers: rows,
    grandTotalBill,
    grandTotalPaid,
    grandDue,
  })
}
