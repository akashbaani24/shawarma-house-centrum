import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const VALID_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

// Expense sub-section classification based on category name.
function classifyExpenseCategory(category: string): 'EXPENSES' | 'PAYMENTS' | 'DEPOSITS' {
  const c = category.toLowerCase().trim()
  if (
    c.includes('deposit') ||
    c.includes('bank account') ||
    c.includes('card sales') ||
    c.includes('digital wallet') ||
    c.includes('bkash no')
  ) {
    return 'DEPOSITS'
  }
  if (
    c.startsWith('payment to') ||
    c.startsWith('paid to') ||
    c.includes('advance')
  ) {
    return 'PAYMENTS'
  }
  return 'EXPENSES'
}

// Compute the opening balance for a given date using a SINGLE batched query.
// Fetches the most recent explicit OpeningBalance + all entries between that
// date and the target date, then walks forward in memory. This replaces the
// old recursive approach which did up to 1000+ round-trips to Turso.
async function computeOpeningBalance(
  date: string,
): Promise<{ amount: number; source: 'explicit' | 'carryover' | 'none'; sourceDate?: string }> {
  // 1. Check for an explicit opening balance ON the target date (highest priority)
  const explicitToday = await db.openingBalance.findUnique({ where: { date } })
  if (explicitToday) {
    return { amount: explicitToday.amount, source: 'explicit', sourceDate: date }
  }

  // 2. Find the most recent explicit opening balance BEFORE the target date,
  //    and all entries from that date up to (but not including) the target date.
  //    Two queries, run in parallel — only 2 round-trips total.
  const [openingBalances, entries] = await Promise.all([
    db.openingBalance.findMany({
      where: { date: { lt: date } },
      orderBy: { date: 'desc' },
      take: 1,
    }),
    db.entry.findMany({
      where: { date: { lt: date }, source: 'BRANCH' },
      select: { date: true, kind: true, amount: true },
    }),
  ])

  // 3. If there's no explicit opening balance AND no prior entries, opening = 0
  if (openingBalances.length === 0 && entries.length === 0) {
    return { amount: 0, source: 'none' }
  }

  // 4. Determine the starting point
  let runningBalance: number
  let sourceDate: string | undefined
  let source: 'explicit' | 'carryover'

  if (openingBalances.length > 0) {
    const anchor = openingBalances[0]
    runningBalance = anchor.amount
    sourceDate = anchor.date
    source = 'explicit'
    // Only consider entries AFTER the anchor date (anchor's own day entries
    // are part of its closing, but since we use the anchor's opening amount
    // as the start, we include ALL entries from anchor.date onward up to target)
    // Sort entries by date ascending and apply those on/after anchor.date
    const sortedEntries = entries
      .filter((e) => e.date >= anchor.date)
      .sort((a, b) => a.date.localeCompare(b.date))
    for (const e of sortedEntries) {
      runningBalance += e.kind === 'INCOME' ? e.amount : -e.amount
    }
  } else {
    // No explicit opening balance — start from 0 and apply all prior entries
    runningBalance = 0
    source = 'carryover'
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    for (const e of sortedEntries) {
      runningBalance += e.kind === 'INCOME' ? e.amount : -e.amount
    }
    // Source date = the earliest entry date (the first day with activity)
    if (sortedEntries.length > 0) {
      sourceDate = sortedEntries[0].date
    }
  }

  return { amount: runningBalance, source, sourceDate }
}

// GET /api/report?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const t0 = Date.now()
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
    // Branch Daily Report: exclude OFFICE entries (they only show in Expense Details)
    db.entry.findMany({
      where: { date, source: 'BRANCH' },
      include: {
        creator: { select: { name: true, email: true } },
        bankAccount: { select: { bankName: true, accountName: true, accountNumber: true } },
      },
    }),
    db.denomination.findMany({ where: { date } }),
    computeOpeningBalance(date),
  ])

  const incomeEntries = entries.filter((e) => e.kind === 'INCOME')
  const expenseEntries = entries.filter((e) => e.kind === 'EXPENSE')
  const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0)
  const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0)
  const openingBalance = openingInfo.amount

  const expensesEntries = expenseEntries.filter((e) => classifyExpenseCategory(e.category) === 'EXPENSES')
  const paymentsEntries = expenseEntries.filter((e) => classifyExpenseCategory(e.category) === 'PAYMENTS')
  const depositsEntries = expenseEntries.filter((e) => classifyExpenseCategory(e.category) === 'DEPOSITS')
  const totalExpenses = expensesEntries.reduce((s, e) => s + e.amount, 0)
  const totalPayments = paymentsEntries.reduce((s, e) => s + e.amount, 0)
  const totalDeposits = depositsEntries.reduce((s, e) => s + e.amount, 0)

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
  const cashShortage = difference > 0 ? difference : 0
  const excessCash = difference < 0 ? -difference : 0
  const isBalanced = Math.abs(difference) < 0.005

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
    expensesEntries,
    paymentsEntries,
    depositsEntries,
    totalIncome,
    totalExpense,
    totalExpenses,
    totalPayments,
    totalDeposits,
    cashShortage,
    excessCash,
    denominations: denomMap,
    validDenoms: VALID_DENOMS,
    cashInHand,
    calculatedClosing,
    leftTotal,
    rightTotal,
    difference,
    isBalanced,
    _ms: Date.now() - t0,
  })
}
