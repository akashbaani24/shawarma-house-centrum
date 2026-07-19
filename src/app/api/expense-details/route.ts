import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql, db } from '@/lib/db'

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

// Categories that show in Branch Daily Report but should be EXCLUDED
// from Branch Expense Report. These are not real operating expenses —
// they are profit distributions / owner withdrawals / partner payments
// that are tracked for cash flow purposes but don't belong in the
// expense breakdown.
//
// Currently excluded:
//   - "Payment to Partner" — profit distribution to partners/owners
//
// These still appear in:
//   - Branch Daily Report (as a cash outflow)
//   - P&L Report (as an operating expense)
//   - Monthly Summary
//   - Payment History
function isExcludedFromExpenseReport(category: string): boolean {
  const c = category.toLowerCase().trim()
  // Normalize: remove extra spaces, hyphens, etc.
  const n = c.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  return (
    n === 'payment to partner' ||
    n === 'partner payment' ||
    n === 'payment to owner' ||
    n === 'owner withdrawal' ||
    n === 'partner withdrawal' ||
    n === 'profit distribution'
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
  // Use direct libsql for speed — the (kind, date) index makes this fast.
  const [entriesRes, logoRes] = await Promise.all([
    libsql.execute({
      sql: `SELECT e.id, e.category, e.amount, e.note, e.date,
                   e."paymentMethod", e.source, e."createdAt",
                   b."bankName", b."accountName", b."accountNumber",
                   u.name AS "creatorName", u.email AS "creatorEmail"
            FROM "Entry" e
            LEFT JOIN "BankAccount" b ON e."bankAccountId" = b.id
            LEFT JOIN "User" u ON e."createdById" = u.id
            WHERE e.kind = ? AND e.date >= ? AND e.date <= ?
            ORDER BY e.category ASC, e.date ASC, e."createdAt" ASC`,
      args: ['EXPENSE', from, to],
    }),
    libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
  ])

  const allEntries = (entriesRes.rows as {
    id: string; category: string; amount: number; note: string | null
    date: string; paymentMethod: string; source: string; createdAt: string
    bankName: string | null; accountName: string | null; accountNumber: string | null
    creatorName: string | null; creatorEmail: string
  }[]).map((r) => ({
    id: r.id,
    category: r.category,
    amount: r.amount,
    note: r.note,
    date: r.date,
    paymentMethod: r.paymentMethod,
    source: r.source,
    createdAt: r.createdAt,
    bankAccount: r.bankName ? { bankName: r.bankName, accountName: r.accountName ?? '', accountNumber: r.accountNumber ?? '' } : null,
    creator: { name: r.creatorName, email: r.creatorEmail },
  }))
  const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

  // Filter out deposit/transfer entries AND excluded categories
  // (Payment to Partner, etc.) — these are NOT actual expenses for
  // the Branch Expense Report. They still show in Branch Daily Report.
  const entries = allEntries.filter(
    (e) => !isDepositCategory(e.category) && !isExcludedFromExpenseReport(e.category)
  )

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
    logoUrl,
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
