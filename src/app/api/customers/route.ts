import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/customers — list all customers
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const customers = await db.customer.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true, address: true, note: true },
  })
  return NextResponse.json({ customers })
}

// POST /api/customers { name, phone?, address?, note? } — create customer
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
    }
    const customer = await db.customer.create({
      data: {
        name,
        phone: body?.phone ? String(body.phone).trim() : null,
        address: body?.address ? String(body.address).trim() : null,
        note: body?.note ? String(body.note).trim() : null,
        createdById: session.user.id,
      },
    })
    return NextResponse.json({ customer }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
