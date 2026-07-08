import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const VALID_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Compute the opening balance for a given date (shared data, no userId)
async function computeOpeningBalance(
  date: string,
): Promise<{ amount: number; source: 'explicit' | 'carryover' | 'none'; sourceDate?: string }> {
  // 1. Explicit
  const explicit = await db.openingBalance.findUnique({ where: { date } })
  if (explicit) {
    return { amount: explicit.amount, source: 'explicit', sourceDate: date }
  }

  // 2. Walk backwards
  let cursor = shiftDate(date, -1)
  for (let i = 0; i < 366; i++) {
    const [entries, denomRows] = await Promise.all([
      db.entry.findMany({ where: { date: cursor } }),
      db.denomination.findMany({ where: { date: cursor } }),
    ])

    if (entries.length > 0 || denomRows.length > 0) {
      const income = entries.filter((e) => e.kind === 'INCOME').reduce((s, e) => s + e.amount, 0)
      const expense = entries.filter((e) => e.kind === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
      const prevOpening = await computeOpeningBalance(cursor)
      const closing = prevOpening.amount + income - expense
      return { amount: closing, source: 'carryover', sourceDate: cursor }
    }

    const ob = await db.openingBalance.findUnique({ where: { date: cursor } })
    if (ob) {
      const entries2 = await db.entry.findMany({ where: { date: cursor } })
      const income = entries2.filter((e) => e.kind === 'INCOME').reduce((s, e) => s + e.amount, 0)
      const expense = entries2.filter((e) => e.kind === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
      const closing = ob.amount + income - expense
      return { amount: closing, source: 'carryover', sourceDate: cursor }
    }

    cursor = shiftDate(cursor, -1)
  }

  return { amount: 0, source: 'none' }
}

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

  const [entries, denomRows, openingInfo] = await Promise.all([
    db.entry.findMany({
      where: { date },
      include: { creator: { select: { name: true, email: true } } },
    }),
    db.denomination.findMany({ where: { date } }),
    computeOpeningBalance(date),
  ])

  const incomeEntries = entries.filter((e) => e.kind === 'INCOME')
  const expenseEntries = entries.filter((e) => e.kind === 'EXPENSE')
  const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0)
  const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0)
  const openingBalance = openingInfo.amount

  const denomMap: Record<number, number> = {}
  for (const d of VALID_DENOMS) denomMap[d] = 0
  for (const r of denomRows) {
    if (VALID_DENOMS.includes(r.denomination)) denomMap[r.denomination] = r.count
  }
  const cashInHand = VALID_DENOMS.reduce((s, d) => s + d * denomMap[d], 0)

  const calculatedClosing = openingBalance + totalIncome - totalExpense

  const leftTotal = openingBalance + totalIncome
  const rightTotal = totalExpense + cashInHand
  const difference = leftTotal - rightTotal
  const isBalanced = Math.abs(difference) < 0.005

  // Collect distinct creators for "Prepared by"
  const creators = new Map<string, { name: string | null; email: string }>()
  for (const e of entries) {
    if (e.creator) {
      creators.set(e.creator.email, { name: e.creator.name, email: e.creator.email })
    }
  }
  const preparedBy = Array.from(creators.values()).map((c) => c.name || c.email)

  return NextResponse.json({
    date,
    businessName: session.user.businessName,
    preparedBy,
    currentUser: session.user.name || session.user.email,
    openingBalance,
    openingSource: openingInfo.source,
    openingSourceDate: openingInfo.sourceDate ?? null,
    incomeEntries,
    expenseEntries,
    totalIncome,
    totalExpense,
    denominations: denomMap,
    validDenoms: VALID_DENOMS,
    cashInHand,
    calculatedClosing,
    leftTotal,
    rightTotal,
    difference,
    isBalanced,
  })
}
