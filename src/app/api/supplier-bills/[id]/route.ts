import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// PUT /api/supplier-bills/:id
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body?.supplierId) data.supplierId = body.supplierId
    if (body?.billDate) data.billDate = body.billDate
    if (body?.billNumber !== undefined) data.billNumber = body.billNumber?.trim() || null
    if (body?.billAmount !== undefined) {
      const a = typeof body.billAmount === 'number' ? body.billAmount : parseFloat(body.billAmount)
      if (!isNaN(a)) data.billAmount = Math.round(a * 100) / 100
    }
    if (body?.paidAmount !== undefined) {
      const a = typeof body.paidAmount === 'number' ? body.paidAmount : parseFloat(body.paidAmount)
      if (!isNaN(a)) data.paidAmount = Math.round(a * 100) / 100
    }
    if (body?.note !== undefined) data.note = body.note?.trim() || null

    const bill = await db.supplierBill.update({
      where: { id },
      data,
      include: { supplier: { select: { name: true } } },
    })
    return NextResponse.json({ bill })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/supplier-bills/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    await db.supplierBill.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
