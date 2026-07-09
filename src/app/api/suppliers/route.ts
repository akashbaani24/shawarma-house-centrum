import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/suppliers  -> list all suppliers
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const suppliers = await db.supplier.findMany({
    orderBy: [{ name: 'asc' }],
  })
  return NextResponse.json({ suppliers })
}

// POST /api/suppliers  { name, phone?, address?, note? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    const phone = body?.phone ? String(body.phone).trim() : null
    const address = body?.address ? String(body.address).trim() : null
    const note = body?.note ? String(body.note).trim() : null

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    const supplier = await db.supplier.create({
      data: { name, phone, address, note },
    })
    return NextResponse.json({ supplier }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
