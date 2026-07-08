import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/opening-balance?date=YYYY-MM-DD  -> explicit opening balance for date (if any)
// GET /api/opening-balance                   -> all explicit opening balances (most recent first)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  if (date) {
    const ob = await db.openingBalance.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
    })
    return NextResponse.json({ openingBalance: ob })
  }

  const list = await db.openingBalance.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json({ openingBalances: list })
}

// POST /api/opening-balance  { date, amount, note? }  -> upsert
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { date, amount, note } = body ?? {}
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    const amt = typeof amount === 'number' ? amount : parseFloat(amount)
    if (isNaN(amt) || amt < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const ob = await db.openingBalance.upsert({
      where: { userId_date: { userId: session.user.id, date } },
      update: { amount: Math.round(amt * 100) / 100, note: note?.trim() || null },
      create: {
        userId: session.user.id,
        date,
        amount: Math.round(amt * 100) / 100,
        note: note?.trim() || null,
      },
    })
    return NextResponse.json({ openingBalance: ob })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/opening-balance?date=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }
    await db.openingBalance.deleteMany({
      where: { userId: session.user.id, date },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
