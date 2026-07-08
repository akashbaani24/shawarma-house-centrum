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

// Compute the opening balance for a given date:
// 1. If explicit OpeningBalance entry exists for `date`, use it.
// 2. Otherwise, walk backwards day-by-day (up to 366 days) to find the most recent
//    date that has data. Use that date's *calculated closing* = opening + income - expense.
//    (Denomination is not used for the flow — only for excess/shortage verification.)
async function computeOpeningBalance(
  userId: string,
  date: string,
): Promise<{ amount: number; source: 'explicit' | 'carryover' | 'none'; sourceDate?: string }> {
  // 1. Explicit
  const explicit = await db.openingBalance.findUnique({
    where: { userId_date: { userId, date } },
  })
  if (explicit) {
    return { amount: explicit.amount, source: 'explicit', sourceDate: date }
  }

  // 2. Walk backwards
  let cursor = shiftDate(date, -1)
  for (let i = 0; i < 366; i++) {
    const [entries, denomRows] = await Promise.all([
      db.entry.findMany({ where: { userId, date: cursor } }),
      db.denomination.findMany({ where: { userId, date: cursor } }),
    ])

    if (entries.length > 0 || denomRows.length > 0) {
      // Found the most recent day with activity. Compute its calculated closing.
      const income = entries
        .filter((e) => e.kind === 'INCOME')
        .reduce((s, e) => s + e.amount, 0)
      const expense = entries
        .filter((e) => e.kind === 'EXPENSE')
        .reduce((s, e) => s + e.amount, 0)
      // Recursively get that day's opening
      const prevOpening = await computeOpeningBalance(userId, cursor)
      const closing = prevOpening.amount + income - expense
      return { amount: closing, source: 'carryover', sourceDate: cursor }
    }

    // Also check if there's an explicit opening balance on this cursor date (business start)
    const ob = await db.openingBalance.findUnique({
      where: { userId_date: { userId, date: cursor } },
    })
    if (ob) {
      const entries2 = await db.entry.findMany({ where: { userId, date: cursor } })
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
    db.entry.findMany({ where: { userId: session.user.id, date } }),
    db.denomination.findMany({ where: { userId: session.user.id, date } }),
    computeOpeningBalance(session.user.id, date),
  ])

  const incomeEntries = entries.filter((e) => e.kind === 'INCOME')
  const expenseEntries = entries.filter((e) => e.kind === 'EXPENSE')
  const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0)
  const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0)
  const openingBalance = openingInfo.amount

  // Denomination map
  const denomMap: Record<number, number> = {}
  for (const d of VALID_DENOMS) denomMap[d] = 0
  for (const r of denomRows) {
    if (VALID_DENOMS.includes(r.denomination)) denomMap[r.denomination] = r.count
  }
  const cashInHand = VALID_DENOMS.reduce((s, d) => s + d * denomMap[d], 0)

  // Calculated closing = opening + income - expense
  const calculatedClosing = openingBalance + totalIncome - totalExpense

  // Balance check (req 5):
  // Left (income side)  = Opening + Total Income
  // Right (expense side) = Total Expense + Cash in Hand (denomination)
  const leftTotal = openingBalance + totalIncome
  const rightTotal = totalExpense + cashInHand
  const difference = leftTotal - rightTotal
  // difference > 0  => shortage (less cash than expected)
  // difference < 0  => excess (more cash than expected)
  // difference == 0 => balanced
  const isBalanced = Math.abs(difference) < 0.005

  return NextResponse.json({
    date,
    businessName: session.user.businessName,
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
    // For the next-day preview:
    nextDayClosing: calculatedClosing,
  })
}
