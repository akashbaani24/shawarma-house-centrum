import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/entries?date=YYYY-MM-DD  -> entries for one day
// GET /api/entries?kind=INCOME      -> all entries of a kind (most recent first)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const kind = searchParams.get('kind')

  const where: { date?: string; kind?: string } = {}
  if (date) where.date = date
  if (kind && (kind === 'INCOME' || kind === 'EXPENSE')) where.kind = kind

  const entries = await db.entry.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { creator: { select: { name: true, email: true } } },
  })
  return NextResponse.json({ entries })
}

// POST /api/entries  { kind, typeId, category, amount, note, date }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { kind, typeId, category, amount, note, date } = body ?? {}

    if (kind !== 'INCOME' && kind !== 'EXPENSE') {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
    }
    const amt = typeof amount === 'number' ? amount : parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    const cat = String(category ?? '').trim()
    if (!cat) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    // Validate type if typeId provided
    let finalTypeId: string | null = null
    if (typeId) {
      const type = await db.entryType.findUnique({ where: { id: typeId } })
      if (type && type.kind === kind) {
        finalTypeId = typeId
      }
    }

    const entry = await db.entry.create({
      data: {
        createdById: session.user.id,
        typeId: finalTypeId,
        kind,
        category: cat,
        amount: Math.round(amt * 100) / 100,
        note: note?.trim() || null,
        date,
      },
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
