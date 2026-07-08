import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// Categories that are NOT real expenses — they are account transfers
// (money moving from one account to another). These show in the Branch
// Daily Report (under Deposits) but must NOT appear in Expense Details.
function isDepositCategory(category: string): boolean {
  const c = category.toLowerCase().trim()
  return (
    c.includes('deposit') ||
    c.includes('bank account') ||
    c.includes('card sales') ||
    c.includes('digital wallet') ||
    c.includes('bkash no') ||
    c.includes('bkash mobile')
  )
}

// GET /api/expense-details?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns ONLY actual expense entries (excludes deposits/transfers) in a date range.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Valid from and to dates are required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (from > to) {
    return NextResponse.json({ error: 'from date must be before or equal to to date' }, { status: 400 })
  }

  // Expense Details: only ACTUAL expenses — excludes deposits/transfers
  // (Bank Deposit, bKash Mobile Deposit, etc. are account transfers, not expenses)
  const [allEntries, businessProfile] = await Promise.all([
    db.entry.findMany({
      where: { kind: 'EXPENSE', date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        category: true,
        amount: true,
        note: true,
        date: true,
        paymentMethod: true,
        source: true,
        bankAccount: { select: { bankName: true, accountName: true, accountNumber: true } },
        creator: { select: { name: true, email: true } },
        createdAt: true,
      },
    }),
    db.businessProfile.findFirst(),
  ])

  // Filter out deposit/transfer entries — they are NOT actual expenses
  const entries = allEntries.filter((e) => !isDepositCategory(e.category))

  // Group by category for the summary
  const byCategory = new Map<string, number>()
  for (const e of entries) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
  }

  // Group by payment method
  const byMethod = new Map<string, number>()
  for (const e of entries) {
    const m = e.paymentMethod || 'CASH'
    byMethod.set(m, (byMethod.get(m) ?? 0) + e.amount)
  }

  // Group by date
  const byDate = new Map<string, number>()
  for (const e of entries) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount)
  }

  // Group by source (BRANCH / OFFICE)
  const bySource = new Map<string, number>()
  for (const e of entries) {
    const s = e.source || 'BRANCH'
    bySource.set(s, (bySource.get(s) ?? 0) + e.amount)
  }

  const total = entries.reduce((s, e) => s + e.amount, 0)

  return NextResponse.json({
    from,
    to,
    businessName: session.user.businessName,
    logoUrl: businessProfile?.logoUrl ?? null,
    entries,
    total,
    byCategory: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    byMethod: Array.from(byMethod.entries())
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
    bySource: Array.from(bySource.entries())
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount),
    byDate: Array.from(byDate.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  })
}
