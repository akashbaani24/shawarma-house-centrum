import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/supplier-report?from=&to=&supplierId=all
// Returns supplier bills in a date range, optionally filtered by supplier.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const supplierId = searchParams.get('supplierId')

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Valid from and to dates are required' }, { status: 400 })
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be before or equal to to' }, { status: 400 })
  }

  const where: { billDate: { gte: string; lte: string }; supplierId?: string } = {
    billDate: { gte: from, lte: to },
  }
  if (supplierId && supplierId !== 'all') {
    where.supplierId = supplierId
  }

  const [bills, businessProfile, suppliers] = await Promise.all([
    db.supplierBill.findMany({
      where,
      orderBy: [{ supplier: { name: 'asc' } }, { billDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        supplier: { select: { id: true, name: true } },
      },
    }),
    db.businessProfile.findFirst(),
    db.supplier.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const totalBillAmount = bills.reduce((s, b) => s + b.billAmount, 0)
  const totalPaidAmount = bills.reduce((s, b) => s + b.paidAmount, 0)
  const totalDueAmount = totalBillAmount - totalPaidAmount

  return NextResponse.json({
    from,
    to,
    businessName: session.user.businessName,
    logoUrl: businessProfile?.logoUrl ?? null,
    bills,
    suppliers,
    totalBillAmount,
    totalPaidAmount,
    totalDueAmount,
  })
}
