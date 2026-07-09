import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/supplier-bills?from=&to=&supplierId=
// GET /api/supplier-bills (all)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const supplierId = searchParams.get('supplierId')

  const where: { billDate?: { gte: string; lte: string }; supplierId?: string } = {}
  if (from && to) {
    where.billDate = { gte: from, lte: to }
  }
  if (supplierId && supplierId !== 'all') {
    where.supplierId = supplierId
  }

  const bills = await db.supplierBill.findMany({
    where,
    orderBy: [{ billDate: 'asc' }, { createdAt: 'asc' }],
    include: {
      supplier: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ bills })
}

// POST /api/supplier-bills  { supplierId, billDate, billNumber?, billAmount, paidAmount?, note? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { supplierId, billDate, billNumber, billAmount, paidAmount, note } = body ?? {}

    if (!supplierId) return NextResponse.json({ error: 'Supplier is required' }, { status: 400 })
    if (!billDate || !/^\d{4}-\d{2}-\d{2}$/.test(billDate)) {
      return NextResponse.json({ error: 'Valid bill date is required' }, { status: 400 })
    }
    const bAmt = typeof billAmount === 'number' ? billAmount : parseFloat(billAmount)
    if (isNaN(bAmt) || bAmt <= 0) {
      return NextResponse.json({ error: 'Valid bill amount is required' }, { status: 400 })
    }
    const pAmt = typeof paidAmount === 'number' ? paidAmount : parseFloat(paidAmount || '0')
    const finalPaid = isNaN(pAmt) ? 0 : pAmt

    // Validate supplier exists
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 400 })

    const bill = await db.supplierBill.create({
      data: {
        supplierId,
        billDate,
        billNumber: billNumber?.trim() || null,
        billAmount: Math.round(bAmt * 100) / 100,
        paidAmount: Math.round(finalPaid * 100) / 100,
        note: note?.trim() || null,
        createdById: session.user.id,
      },
      include: { supplier: { select: { name: true } } },
    })

    return NextResponse.json({ bill }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
