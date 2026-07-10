import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/expense-comparison?month=YYYY-MM
// Returns per-expense-head comparison: Last Month vs This Month.
// `month` is the "this month" — last month is automatically derived.
//
// Response shape:
//   thisMonth: { from, to }
//   lastMonth: { from, to }
//   heads: [{ head, lastMonth, thisMonth, difference, changePct }]
//   totals: { lastMonth, thisMonth, difference, changePct }
//
// "Head" = Entry.category for EXPENSE entries (excludes deposits +
// excludes supplier bills' supplier-name entries — we want to compare
// the actual expense HEADS like Salary, Rent, etc.)
function isDeposit(cat: string): boolean {
  const n = (cat || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return n.includes('deposit') || n.includes('bankaccount') || n.includes('cardsale') || n.includes('digitalwallet') || n.includes('bkashno') || n.includes('bkashmobile')
}
function isShortage(cat: string): boolean {
  const n = (cat || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return n.includes('shortage')
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  // 'month' is YYYY-MM. Default = current month.
  const now = new Date()
  const monthParam = searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const m = /^(\d{4})-(\d{2})$/.exec(monthParam)
  if (!m) {
    return NextResponse.json({ error: 'Invalid month format (use YYYY-MM)' }, { status: 400 })
  }
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10) // 1-12

  // Compute "this month" range
  const thisFrom = `${y}-${String(mo).padStart(2, '0')}-01`
  const thisTo = `${y}-${String(mo).padStart(2, '0')}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`

  // Compute "last month" range
  const lastDate = new Date(y, mo - 1, 1) // first day of this month
  lastDate.setMonth(lastDate.getMonth() - 1) // first day of last month
  const ly = lastDate.getFullYear()
  const lm = lastDate.getMonth() + 1
  const lastFrom = `${ly}-${String(lm).padStart(2, '0')}-01`
  const lastTo = `${ly}-${String(lm).padStart(2, '0')}-${String(new Date(ly, lm, 0).getDate()).padStart(2, '0')}`

  try {
    // Pull both months' expense entries in a single query (filter at app layer
    // by date range to keep things simple)
    const res = await libsql.execute({
      sql: `SELECT e.category, e.amount, e.date
            FROM "Entry" e
            WHERE e.kind = ?
              AND e.date >= ? AND e.date <= ?`,
      args: ['EXPENSE', lastFrom, thisTo],
    })
    const rows = res.rows as { category: string; amount: number; date: string }[]

    // Filter out deposits + shortage — they are not "expense heads"
    const filtered = rows.filter((r) => !isDeposit(r.category) && !isShortage(r.category))

    // Build head → { lastMonth, thisMonth }
    const headMap = new Map<string, { lastMonth: number; thisMonth: number }>()
    for (const r of filtered) {
      if (!headMap.has(r.category)) headMap.set(r.category, { lastMonth: 0, thisMonth: 0 })
      const e = headMap.get(r.category)!
      if (r.date >= lastFrom && r.date <= lastTo) e.lastMonth += r.amount
      if (r.date >= thisFrom && r.date <= thisTo) e.thisMonth += r.amount
    }

    const heads = Array.from(headMap.entries())
      .map(([head, v]) => ({
        head,
        lastMonth: v.lastMonth,
        thisMonth: v.thisMonth,
        difference: v.thisMonth - v.lastMonth,
        changePct: v.lastMonth > 0 ? ((v.thisMonth - v.lastMonth) / v.lastMonth) * 100 : null,
      }))
      .sort((a, b) => b.thisMonth - a.thisMonth)

    const totalsLast = heads.reduce((s, h) => s + h.lastMonth, 0)
    const totalsThis = heads.reduce((s, h) => s + h.thisMonth, 0)
    const totalsDiff = totalsThis - totalsLast
    const totalsPct = totalsLast > 0 ? ((totalsThis - totalsLast) / totalsLast) * 100 : null

    const [logoRes] = await Promise.all([
      libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
    ])
    const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

    return NextResponse.json({
      month: monthParam,
      thisMonth: { from: thisFrom, to: thisTo },
      lastMonth: { from: lastFrom, to: lastTo },
      businessName: session.user.businessName,
      logoUrl,
      heads,
      totals: {
        lastMonth: totalsLast,
        thisMonth: totalsThis,
        difference: totalsDiff,
        changePct: totalsPct,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
