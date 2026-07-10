import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/deposit-report?from=&to=
// Returns all deposit entries (transfers from cash to bank/card/mobile)
// in the date range, broken down three ways:
//   - branchWise   : deposits where source = 'BRANCH'
//   - officeWise   : deposits where source = 'OFFICE'
//   - dateWise     : deposits grouped by date
//   - typeWise     : deposits grouped by category (Bank Deposit, Card Sales, etc.)
// A "deposit" is any EXPENSE entry whose category matches the deposit
// patterns: deposit, bank account, card sales, digital wallet, bKash.
function isDeposit(cat: string): boolean {
  const n = (cat || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return n.includes('deposit') || n.includes('bankaccount') || n.includes('cardsale') || n.includes('digitalwallet') || n.includes('bkashno') || n.includes('bkashmobile')
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
    const [res, logoRes] = await Promise.all([
      libsql.execute({
        sql: `SELECT e.id, e.category, e.amount, e.date, e.source, e.note,
                     e."paymentMethod",
                     b."bankName", b."accountNumber",
                     u.name AS "creatorName"
              FROM "Entry" e
              LEFT JOIN "BankAccount" b ON e."bankAccountId" = b.id
              LEFT JOIN "User" u ON e."createdById" = u.id
              WHERE e.kind = ? AND e.date >= ? AND e.date <= ?
              ORDER BY e.date DESC, e."createdAt" DESC`,
        args: ['EXPENSE', from, to],
      }),
      libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
    ])

    const allExpenses = res.rows as {
      id: string; category: string; amount: number; date: string; source: string
      note: string | null; paymentMethod: string
      bankName: string | null; accountNumber: string | null
      creatorName: string | null
    }[]
    const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

    // Keep only deposit entries
    const deposits = allExpenses.filter((r) => isDeposit(r.category))

    // Branch-wise breakdown
    const branchDeposits = deposits.filter((d) => d.source === 'BRANCH')
    const branchTotal = branchDeposits.reduce((s, d) => s + d.amount, 0)

    // Office-wise breakdown
    const officeDeposits = deposits.filter((d) => d.source === 'OFFICE')
    const officeTotal = officeDeposits.reduce((s, d) => s + d.amount, 0)

    // Date-wise breakdown
    const dateMap = new Map<string, { date: string; branch: number; office: number; total: number; count: number }>()
    for (const d of deposits) {
      const key = d.date
      if (!dateMap.has(key)) dateMap.set(key, { date: key, branch: 0, office: 0, total: 0, count: 0 })
      const e = dateMap.get(key)!
      if (d.source === 'BRANCH') e.branch += d.amount
      else if (d.source === 'OFFICE') e.office += d.amount
      e.total += d.amount
      e.count += 1
    }
    const dateWise = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date))

    // Type-wise breakdown (by category)
    const typeMap = new Map<string, number>()
    for (const d of deposits) {
      typeMap.set(d.category, (typeMap.get(d.category) ?? 0) + d.amount)
    }
    const typeWise = Array.from(typeMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    const totalDeposits = deposits.reduce((s, d) => s + d.amount, 0)

    return NextResponse.json({
      from, to,
      businessName: session.user.businessName,
      logoUrl,
      deposits,                  // full list (for the detail table)
      branchDeposits,
      officeDeposits,
      branchTotal,
      officeTotal,
      dateWise,
      typeWise,
      totalDeposits,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
