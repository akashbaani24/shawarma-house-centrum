import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

const VALID_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

function isDepositCategory(category: string): boolean {
  const c = category.toLowerCase().trim()
  return c.includes('deposit') || c.includes('bank account') || c.includes('card sales') || c.includes('digital wallet') || c.includes('bkash no') || c.includes('bkash mobile')
}

// GET /api/report?date=YYYY-MM-DD — direct libsql for speed
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

  try {
    // Fetch entries, denominations, business profile — all in parallel
    const [entriesRes, denomRes, logoRes] = await Promise.all([
      libsql.execute({
        sql: 'SELECT id, kind, category, amount, note, paymentMethod, source, "createdById" FROM "Entry" WHERE date = ? AND source = ? AND kind IN (?, ?)',
        args: [date, 'BRANCH', 'INCOME', 'EXPENSE'],
      }),
      libsql.execute({ sql: 'SELECT denomination, count FROM "Denomination" WHERE date = ?', args: [date] }),
      libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
    ])

    const entries = entriesRes.rows as { id: string; kind: string; category: string; amount: number; note: string | null; paymentMethod: string; source: string; createdById: string | null }[]
    const denomRows = denomRes.rows as { denomination: number; count: number }[]
    const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

    const incomeEntries = entries.filter((e) => e.kind === 'INCOME')
    const expenseEntries = entries.filter((e) => e.kind === 'EXPENSE')
    const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0)
    const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0)

    // Opening balance: find most recent explicit OB before `date`, then walk forward
    const obRes = await libsql.execute({
      sql: 'SELECT date, amount FROM "OpeningBalance" WHERE date < ? ORDER BY date DESC LIMIT 1',
      args: [date],
    })
    let openingBalance = 0
    let openingSource: 'explicit' | 'carryover' | 'none' = 'none'
    let openingSourceDate: string | null = null

    if (obRes.rows.length > 0) {
      const ob = obRes.rows[0] as { date: string; amount: number }
      openingBalance = ob.amount
      openingSource = 'explicit'
      openingSourceDate = ob.date
      // Add all BRANCH INCOME/EXPENSE entries from OB date to target date
      const walkRes = await libsql.execute({
        sql: 'SELECT kind, amount FROM "Entry" WHERE date >= ? AND date < ? AND source = ? AND kind IN (?, ?)',
        args: [ob.date, date, 'BRANCH', 'INCOME', 'EXPENSE'],
      })
      for (const row of walkRes.rows as { kind: string; amount: number }[]) {
        openingBalance += row.kind === 'INCOME' ? row.amount : -row.amount
      }
      openingSource = 'carryover'
    } else {
      // No explicit OB — check if there are any prior entries
      const priorRes = await libsql.execute({
        sql: 'SELECT kind, amount FROM "Entry" WHERE date < ? AND source = ? AND kind IN (?, ?) ORDER BY date ASC',
        args: [date, 'BRANCH', 'INCOME', 'EXPENSE'],
      })
      const priorRows = priorRes.rows as { kind: string; amount: number }[]
      if (priorRows.length > 0) {
        openingSource = 'carryover'
        for (const row of priorRows) {
          openingBalance += row.kind === 'INCOME' ? row.amount : -row.amount
        }
      }
    }

    // Categorize expense entries
    const classify = (cat: string): 'EXPENSES' | 'PAYMENTS' | 'DEPOSITS' => {
      const c = cat.toLowerCase().trim()
      if (c.includes('deposit') || c.includes('bank account') || c.includes('card sales') || c.includes('digital wallet') || c.includes('bkash no') || c.includes('bkash mobile')) return 'DEPOSITS'
      if (c.startsWith('payment to') || c.startsWith('paid to') || c.includes('advance')) return 'PAYMENTS'
      return 'EXPENSES'
    }

    const expensesEntries = expenseEntries.filter((e) => classify(e.category) === 'EXPENSES')
    const paymentsEntries = expenseEntries.filter((e) => classify(e.category) === 'PAYMENTS')
    const depositsEntries = expenseEntries.filter((e) => classify(e.category) === 'DEPOSITS')
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

    return NextResponse.json({
      date,
      businessName: session.user.businessName,
      logoUrl,
      preparedBy: [session.user.name || session.user.email],
      currentUser: session.user.name || session.user.email,
      openingBalance,
      openingSource,
      openingSourceDate,
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
