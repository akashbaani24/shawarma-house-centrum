import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/entries?date=YYYY-MM-DD  -> returns entries for a single day
// GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD -> returns entries in range
// GET /api/entries  -> returns all entries (most recent first)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    let entries
    if (date) {
      entries = await db.entry.findMany({
        where: { date },
        orderBy: [{ createdAt: 'asc' }],
      })
    } else if (from && to) {
      entries = await db.entry.findMany({
        where: { date: { gte: from, lte: to } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      })
    } else {
      entries = await db.entry.findMany({
        orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
      })
    }

    return NextResponse.json({ entries })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/entries  { type, amount, category, note, date }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, amount, category, note, date } = body ?? {}

    if (!type || !['INCOME', 'EXPENSE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json({ error: 'Category required' }, { status: 400 })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const entry = await db.entry.create({
      data: {
        type,
        amount: Math.round(amount * 100) / 100,
        category: category.trim(),
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
