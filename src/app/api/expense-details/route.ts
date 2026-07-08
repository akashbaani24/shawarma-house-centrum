import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/expense-details?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns expense entries in a date range, broken down by category, payment method, and date.
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

  // Expense Details: includes BOTH branch + office expenses (with source label)
  const entries = await db.entry.findMany({
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
  })

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
