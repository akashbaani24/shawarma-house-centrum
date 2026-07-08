import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// PUT /api/entries/:id
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const { type, amount, category, note, date } = body ?? {}

    if (type && !['INCOME', 'EXPENSE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    if (amount !== undefined && (typeof amount !== 'number' || isNaN(amount) || amount <= 0)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (type) data.type = type
    if (amount !== undefined) data.amount = Math.round(amount * 100) / 100
    if (category !== undefined) data.category = String(category).trim()
    if (note !== undefined) data.note = note?.trim() || null
    if (date) data.date = date

    const entry = await db.entry.update({ where: { id }, data })
    return NextResponse.json({ entry })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/entries/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await db.entry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
