import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql, db } from '@/lib/db'

// Normalize a category name for fuzzy matching:
// lowercase + remove all non-alphanumeric chars
function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// The 6 fixed income buckets the report shows separately.
// Each bucket matches if the normalized category contains ANY of the patterns.
// Order matters — first match wins (so e.g. "Sales Card" matches Sales Card, not Misc).
const INCOME_BUCKETS: { key: string; label: string; patterns: string[] }[] = [
  { key: 'sales_card',  label: 'Sales - Card',          patterns: ['salescard'] },
  { key: 'sales_cash',  label: 'Sales - Cash',          patterns: ['salescash'] },
  { key: 'sales_bkash', label: 'Sales - Bkash',         patterns: ['salesbkash', 'salesbkashno', 'salesbkashmobile'] },
  { key: 'misc',        label: 'Misc. Income',          patterns: ['misc', 'miscellaneous', 'miscincome'] },
  { key: 'wastage_oil', label: 'Wastage Oil Sale',      patterns: ['wastageoil', 'oilwastage', 'wastageoilsale', 'oilwastagesale', 'wastage'] },
  { key: 'cash_excess', label: 'Cash Excess Found',     patterns: ['cashexcess', 'excesscash', 'cashexcessfound', 'excessfound'] },
]

function pickBucket(category: string): { key: string; label: string } | null {
  const n = norm(category)
  for (const b of INCOME_BUCKETS) {
    if (b.patterns.some((p) => n.includes(p))) {
      return { key: b.key, label: b.label }
    }
  }
  return null
}

// GET /api/income-report?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns income entries grouped into the 6 fixed buckets + "Other Income".
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

  // Use direct libsql for the heavy query — much faster than Prisma for
  // large datasets because it skips the ORM overhead and uses the
  // (kind, date) and (kind, source, date) indexes directly.
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
            ORDER BY e.date ASC, e."createdAt" ASC`,
      args: ['INCOME', from, to],
    }),
    libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
  ])

  const entries = (entriesRes.rows as {
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

  // Bucket each entry
  type BucketAcc = { key: string; label: string; amount: number; entries: typeof entries }
  const bucketMap = new Map<string, BucketAcc>()
  for (const b of INCOME_BUCKETS) {
    bucketMap.set(b.key, { key: b.key, label: b.label, amount: 0, entries: [] })
  }
  const otherBucket: BucketAcc = { key: 'other', label: 'Other Income', amount: 0, entries: [] }

  for (const e of entries) {
    const matched = pickBucket(e.category)
    if (matched) {
      const b = bucketMap.get(matched.key)!
      b.amount += e.amount
      b.entries.push(e)
    } else {
      otherBucket.amount += e.amount
      otherBucket.entries.push(e)
    }
  }

  // Final ordered list — always include the 6 fixed buckets even if 0; include
  // "Other Income" only if it has entries.
  const buckets = [
    ...INCOME_BUCKETS.map((b) => bucketMap.get(b.key)!),
    ...(otherBucket.amount > 0 || otherBucket.entries.length > 0 ? [otherBucket] : []),
  ]

  const total = entries.reduce((s, e) => s + e.amount, 0)

  // Group by exact category
  const byCategory = new Map<string, number>()
  for (const e of entries) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
  }

  // Group by date
  const byDate = new Map<string, number>()
  for (const e of entries) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount)
  }

  return NextResponse.json({
    from,
    to,
    businessName: session.user.businessName,
    logoUrl,
    entries,
    total,
    buckets: buckets.map((b) => ({
      key: b.key,
      label: b.label,
      amount: b.amount,
      count: b.entries.length,
    })),
    byCategory: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    byDate: Array.from(byDate.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  })
}
