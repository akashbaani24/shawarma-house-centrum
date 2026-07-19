import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'
import { getBusinessLogoUrl } from '@/lib/db'

// GET /api/payment-to-partner?from=&to=
// Returns all "Payment to Partner" entries in a date range.
// These are profit distributions / owner withdrawals — tracked for
// cash flow purposes but excluded from P&L and other expense reports.
//
// Matches categories:
//   Payment to Partner, Partner Payment, Payment to Owner,
//   Owner Withdrawal, Partner Withdrawal, Profit Distribution

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isPartnerPayment(cat: string): boolean {
  const n = norm(cat)
  return (
    n === 'paymenttopartner' ||
    n === 'partnerpayment' ||
    n === 'paymenttoowner' ||
    n === 'ownerwithdrawal' ||
    n === 'partnerwithdrawal' ||
    n === 'profitdistribution'
  )
}

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
    const [entriesRes, logoUrl] = await Promise.all([
      libsql.execute({
        sql: `SELECT e.id, e.category, e.amount, e.note, e.date,
                     e."paymentMethod", e.source,
                     b."bankName", b."accountNumber",
                     u.name AS "creatorName", u.email AS "creatorEmail"
              FROM "Entry" e
              LEFT JOIN "BankAccount" b ON e."bankAccountId" = b.id
              LEFT JOIN "User" u ON e."createdById" = u.id
              WHERE e.kind = 'EXPENSE' AND e.date >= ? AND e.date <= ?
              ORDER BY e.date DESC, e."createdAt" DESC`,
        args: [from, to],
      }),
      getBusinessLogoUrl(),
    ])

    const allRows = entriesRes.rows as {
      id: string; category: string; amount: number; note: string | null
      date: string; paymentMethod: string; source: string
      bankName: string | null; accountNumber: string | null
      creatorName: string | null; creatorEmail: string
    }[]

    // Filter to only partner payment entries
    const entries = allRows.filter((r) => isPartnerPayment(r.category))

    const total = entries.reduce((s, e) => s + e.amount, 0)

    // Group by category
    const byCategory = new Map<string, { amount: number; count: number }>()
    for (const e of entries) {
      const existing = byCategory.get(e.category) ?? { amount: 0, count: 0 }
      existing.amount += e.amount
      existing.count += 1
      byCategory.set(e.category, existing)
    }

    // Group by month
    const byMonth = new Map<string, number>()
    for (const e of entries) {
      const month = e.date.slice(0, 7) // YYYY-MM
      byMonth.set(month, (byMonth.get(month) ?? 0) + e.amount)
    }

    return NextResponse.json({
      from,
      to,
      businessName: session.user.businessName,
      logoUrl,
      entries,
      total,
      count: entries.length,
      byCategory: Array.from(byCategory.entries())
        .map(([category, data]) => ({ category, amount: data.amount, count: data.count }))
        .sort((a, b) => b.amount - a.amount),
      byMonth: Array.from(byMonth.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => b.month.localeCompare(a.month)),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
