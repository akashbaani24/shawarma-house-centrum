import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/profit-loss?from=&to=
// Returns income vs expense breakdown for profit/loss calculation.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Valid from and to dates are required' }, { status: 400 })
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be before or equal to to' }, { status: 400 })
  }

  try {
    const [entriesRes, logoRes] = await Promise.all([
      libsql.execute({
        sql: 'SELECT kind, category, amount, source, date FROM "Entry" WHERE date >= ? AND date <= ? AND kind IN (?, ?) ORDER BY date ASC',
        args: [from, to, 'INCOME', 'EXPENSE'],
      }),
      libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
    ])

    const rows = entriesRes.rows as { kind: string; category: string; amount: number; source: string; date: string }[]
    const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

    // Classify deposits (not real expenses)
    const isDeposit = (cat: string) => {
      const c = cat.toLowerCase().trim()
      return c.includes('deposit') || c.includes('bank account') || c.includes('card sales') || c.includes('digital wallet') || c.includes('bkash no') || c.includes('bkash mobile')
    }
    const isShortage = (cat: string) => {
      const c = cat.toLowerCase().trim()
      return c.includes('cash shortage') || c === 'shortage'
    }
    const isExcess = (cat: string) => {
      const c = cat.toLowerCase().trim()
      return c.includes('cash excess') || c.includes('excess found') || c === 'excess'
    }

    const incomeEntries = rows.filter((e) => e.kind === 'INCOME' && !isExcess(e.category))
    const excessEntries = rows.filter((e) => e.kind === 'INCOME' && isExcess(e.category))
    const realExpenseEntries = rows.filter((e) => e.kind === 'EXPENSE' && !isDeposit(e.category) && !isShortage(e.category))
    const depositEntries = rows.filter((e) => e.kind === 'EXPENSE' && isDeposit(e.category))
    const shortageEntries = rows.filter((e) => e.kind === 'EXPENSE' && isShortage(e.category))

    // Group income by category
    const incomeByCategory = new Map<string, number>()
    for (const e of incomeEntries) {
      incomeByCategory.set(e.category, (incomeByCategory.get(e.category) ?? 0) + e.amount)
    }

    // Group expenses by category
    const expenseByCategory = new Map<string, number>()
    for (const e of realExpenseEntries) {
      expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + e.amount)
    }

    const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0)
    const totalExcess = excessEntries.reduce((s, e) => s + e.amount, 0)
    const totalExpenses = realExpenseEntries.reduce((s, e) => s + e.amount, 0)
    const totalDeposits = depositEntries.reduce((s, e) => s + e.amount, 0)
    const totalShortage = shortageEntries.reduce((s, e) => s + e.amount, 0)

    // Net profit = Income - Real Expenses - Shortage
    // (Deposits are transfers, not expenses. Excess is extra found.)
    const netProfit = totalIncome + totalExcess - totalExpenses - totalShortage

    return NextResponse.json({
      from,
      to,
      businessName: session.user.businessName,
      logoUrl,
      incomeByCategory: Array.from(incomeByCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      expenseByCategory: Array.from(expenseByCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      totalIncome,
      totalExcess,
      totalExpenses,
      totalDeposits,
      totalShortage,
      netProfit,
      incomeCount: incomeEntries.length,
      expenseCount: realExpenseEntries.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
