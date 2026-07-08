import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const VALID_SECTIONS = new Set([
  'RECEIPTS',
  'SALES',
  'DENOMINATION',
  'EXPENSES',
  'ADVANCES',
  'PAYMENTS',
  'DEPOSITS',
])

// GET /api/report?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const entries = await db.entry.findMany({
    where: { userId: session.user.id, date },
    orderBy: [{ section: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ entries, businessName: session.user.businessName })
}

// POST /api/report  { date, entries: [{ section, particulars, amount, count? }] }
// Upserts all entries for that date (replaces them).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { date, entries } = body ?? {}

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })
    }

    // Validate entries
    const cleaned = entries
      .filter((e: unknown): e is { section: string; particulars: string; amount: number; count?: number | null } => {
        if (!e || typeof e !== 'object') return false
        const o = e as Record<string, unknown>
        return (
          typeof o.section === 'string' &&
          VALID_SECTIONS.has(o.section) &&
          typeof o.particulars === 'string' &&
          o.particulars.trim().length > 0
        )
      })
      .map((e) => ({
        section: e.section,
        particulars: e.particulars.trim(),
        amount: typeof e.amount === 'number' && !isNaN(e.amount) ? Math.round(e.amount * 100) / 100 : 0,
        count: e.section === 'DENOMINATION' && typeof e.count === 'number' ? Math.floor(e.count) : null,
      }))

    // Run inside a transaction: delete existing entries for that date, then create new ones
    await db.$transaction(async (tx) => {
      await tx.entry.deleteMany({
        where: { userId: session.user.id, date },
      })
      if (cleaned.length > 0) {
        await tx.entry.createMany({
          data: cleaned.map((e) => ({
            userId: session.user.id,
            date,
            section: e.section,
            particulars: e.particulars,
            amount: e.amount,
            count: e.count,
          })),
        })
      }
    })

    return NextResponse.json({ ok: true, count: cleaned.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
