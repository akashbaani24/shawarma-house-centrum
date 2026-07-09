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
        sql: `SELECT e.id, e.kind, e.category, e.amount, e.note, e."paymentMethod", e.source, e."createdById",
              b."bankName", b."accountName", b."accountNumber"
              FROM "Entry" e
              LEFT JOIN "BankAccount" b ON e."bankAccountId" = b.id
              WHERE e.date = ? AND e.source = ? AND e.kind IN (?, ?)
              ORDER BY e."createdAt" ASC`,
        args: [date, 'BRANCH', 'INCOME', 'EXPENSE'],
      }),
      libsql.execute({ sql: 'SELECT denomination, count FROM "Denomination" WHERE date = ?', args: [date] }),
      libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
    ])

    const entries = entriesRes.rows as { id: string; kind: string; category: string; amount: number; note: string | null; paymentMethod: string; source: string; createdById: string | null; bankName: string | null; accountName: string | null; accountNumber: string | null }[]
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
    const classify = (cat: string): 'EXPENSES' | 'PAYMENTS' | 'DEPOSITS' | 'SHORTAGE' => {
      const c = cat.toLowerCase().trim()
      if (c.includes('cash shortage') || c === 'shortage') return 'SHORTAGE'
      if (c.includes('deposit') || c.includes('bank account') || c.includes('card sales') || c.includes('digital wallet') || c.includes('bkash no') || c.includes('bkash mobile')) return 'DEPOSITS'
      if (c.startsWith('payment to') || c.startsWith('paid to') || c.includes('advance')) return 'PAYMENTS'
      return 'EXPENSES'
    }

    // Categorize income entries — "Cash Excess Found" is a separate Excess section
    const classifyIncome = (cat: string): 'INCOME' | 'EXCESS' => {
      const c = cat.toLowerCase().trim()
      if (c.includes('cash excess') || c.includes('excess found') || c === 'excess') return 'EXCESS'
      return 'INCOME'
    }

    const expensesEntries = expenseEntries.filter((e) => classify(e.category) === 'EXPENSES')
    const paymentsEntries = expenseEntries.filter((e) => classify(e.category) === 'PAYMENTS')
    const depositsEntries = expenseEntries.filter((e) => classify(e.category) === 'DEPOSITS')
    const shortageEntries = expenseEntries.filter((e) => classify(e.category) === 'SHORTAGE')
    const pureIncomeEntries = incomeEntries.filter((e) => classifyIncome(e.category) === 'INCOME')
    const excessEntries = incomeEntries.filter((e) => classifyIncome(e.category) === 'EXCESS')

    // Map bank account fields to nested object for the view
    const mapEntry = (e: typeof entries[0]) => ({
      id: e.id, kind: e.kind, category: e.category, amount: e.amount,
      note: e.note, paymentMethod: e.paymentMethod, source: e.source,
      bankAccount: e.bankName ? { bankName: e.bankName, accountName: e.accountName, accountNumber: e.accountNumber } : null,
    })

    const totalExpenses = expensesEntries.reduce((s, e) => s + e.amount, 0)
    const totalPayments = paymentsEntries.reduce((s, e) => s + e.amount, 0)
    const totalDeposits = depositsEntries.reduce((s, e) => s + e.amount, 0)
    const totalShortage = shortageEntries.reduce((s, e) => s + e.amount, 0)
    const totalExcess = excessEntries.reduce((s, e) => s + e.amount, 0)
    // totalIncome stays as-is (includes excess) for opening balance calc
    // But for the report display, pure income excludes excess
    const totalPureIncome = pureIncomeEntries.reduce((s, e) => s + e.amount, 0)

    const denomMap: Record<number, number> = {}
    for (const d of VALID_DENOMS) denomMap[d] = 0
    for (const r of denomRows) {
      if (VALID_DENOMS.includes(r.denomination)) denomMap[r.denomination] = r.count
    }
    const denomTotal = VALID_DENOMS.reduce((s, d) => s + d * denomMap[d], 0)
    // Only consider denomination "counted" if at least one non-zero count exists
    const denomCounted = denomRows.length > 0 && denomTotal > 0

    // Calculated closing = Opening + Income - Expense (what SHOULD be in the cash box)
    const calculatedClosing = openingBalance + totalIncome - totalExpense

    // Cash in Hand: if denomination has been entered manually, use that.
    // If NOT entered, use the calculated closing (the money that should be there).
    // This prevents false "Cash Shortage" when denomination hasn't been counted yet.
    const cashInHand = denomCounted ? denomTotal : calculatedClosing
    const denomNotEntered = !denomCounted

    // Left side = Opening + Pure Income + Excess
    // Right side = Expenses + Payments + Deposits + Shortage + Cash in Hand
    const leftTotal = openingBalance + totalPureIncome + totalExcess
    const rightTotal = totalExpenses + totalPayments + totalDeposits + totalShortage + cashInHand
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
      incomeEntries: pureIncomeEntries.map(mapEntry),
      expenseEntries: expenseEntries.map(mapEntry),
      expensesEntries: expensesEntries.map(mapEntry),
      paymentsEntries: paymentsEntries.map(mapEntry),
      depositsEntries: depositsEntries.map(mapEntry),
      shortageEntries: shortageEntries.map(mapEntry),
      excessEntries: excessEntries.map(mapEntry),
      totalIncome: totalPureIncome,
      totalExpense,
      totalExpenses,
      totalPayments,
      totalDeposits,
      totalShortage,
      totalExcess,
      cashShortage,
      excessCash,
      denomNotEntered,
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
