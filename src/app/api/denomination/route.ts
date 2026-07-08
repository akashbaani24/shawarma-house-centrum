import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const VALID_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

// GET /api/denomination?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
  }

  const rows = await db.denomination.findMany({
    where: { userId: session.user.id, date },
  })
  // return as a map { denomination: count } including all valid denoms (0 if missing)
  const map: Record<number, number> = {}
  for (const d of VALID_DENOMS) map[d] = 0
  for (const r of rows) {
    if (VALID_DENOMS.includes(r.denomination)) map[r.denomination] = r.count
  }
  return NextResponse.json({ denominations: map, validDenoms: VALID_DENOMS })
}

// POST /api/denomination  { date, counts: { 1000: 3, 500: 7, ... } }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { date, counts } = body ?? {}
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    if (!counts || typeof counts !== 'object') {
      return NextResponse.json({ error: 'counts object is required' }, { status: 400 })
    }

    // Normalize counts
    const normalized: { denomination: number; count: number }[] = []
    for (const d of VALID_DENOMS) {
      const c = counts[String(d)] ?? counts[d] ?? 0
      const n = typeof c === 'number' ? Math.max(0, Math.floor(c)) : Math.max(0, Math.floor(parseFloat(c) || 0))
      normalized.push({ denomination: d, count: n })
    }

    // Delete existing + recreate (transaction)
    await db.$transaction(async (tx) => {
      await tx.denomination.deleteMany({
        where: { userId: session.user.id, date },
      })
      if (normalized.some((n) => n.count > 0)) {
        await tx.denomination.createMany({
          data: normalized
            .filter((n) => n.count > 0)
            .map((n) => ({
              userId: session.user.id,
              date,
              denomination: n.denomination,
              count: n.count,
            })),
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
