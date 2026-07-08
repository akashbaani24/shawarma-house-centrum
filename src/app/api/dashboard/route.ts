import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// GET /api/dashboard  -> today's summary + recent entries
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayStr()

  const [todayEntries, recentEntries, openingOB] = await Promise.all([
    db.entry.findMany({ where: { userId: session.user.id, date: today } }),
    db.entry.findMany({
      where: { userId: session.user.id },
      orderBy: [{ createdAt: 'desc' }],
      take: 8,
    }),
    db.openingBalance.findUnique({
      where: { userId_date: { userId: session.user.id, date: today } },
    }),
  ])

  const income = todayEntries.filter((e) => e.kind === 'INCOME').reduce((s, e) => s + e.amount, 0)
  const expense = todayEntries.filter((e) => e.kind === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
  const opening = openingOB?.amount ?? 0
  const closing = opening + income - expense

  // Count of types
  const typeCount = await db.entryType.count({ where: { userId: session.user.id } })

  return NextResponse.json({
    today,
    opening,
    income,
    expense,
    closing,
    entryCount: todayEntries.length,
    typeCount,
    recentEntries,
  })
}
