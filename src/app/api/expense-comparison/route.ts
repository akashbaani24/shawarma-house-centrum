import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/expense-comparison?lastFrom=&lastTo=&thisFrom=&thisTo=
//
// Compares expenses across TWO custom date ranges:
//   - "Last Period"  = lastFrom .. lastTo
//   - "This Period"  = thisFrom .. thisTo
//
// Returns per-expense-head:
//   { head, lastPeriod, thisPeriod, difference, changePct }
//
// The user can pick ANY two date ranges — they don't have to be the same
// length, and they don't have to be consecutive months. This is more
// flexible than the old `?month=` parameter.
//
// Excludes deposits + cash shortage from the comparison (same as before).
function isDeposit(cat: string): boolean {
  const n = (cat || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return n.includes('deposit') || n.includes('bankaccount') || n.includes('cardsale') || n.includes('digitalwallet') || n.includes('bkashno') || n.includes('bkashmobile')
}
function isShortage(cat: string): boolean {
  const n = (cat || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return n.includes('shortage')
}

function isValidDate(s: string | null): s is string {
  if (!s) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const lastFrom = searchParams.get('lastFrom')
  const lastTo = searchParams.get('lastTo')
  const thisFrom = searchParams.get('thisFrom')
  const thisTo = searchParams.get('thisTo')

  if (!isValidDate(lastFrom) || !isValidDate(lastTo) || !isValidDate(thisFrom) || !isValidDate(thisTo)) {
    return NextResponse.json({ error: 'All four dates are required (YYYY-MM-DD): lastFrom, lastTo, thisFrom, thisTo' }, { status: 400 })
  }
  if (lastFrom > lastTo) {
    return NextResponse.json({ error: 'lastFrom must be before or equal to lastTo' }, { status: 400 })
  }
  if (thisFrom > thisTo) {
    return NextResponse.json({ error: 'thisFrom must be before or equal to thisTo' }, { status: 400 })
  }

  try {
    // Pull expenses across the union of both periods in a single query
    const unionFrom = lastFrom < thisFrom ? lastFrom : thisFrom
    const unionTo = lastTo > thisTo ? lastTo : thisTo

    const res = await libsql.execute({
      sql: `SELECT e.category, e.amount, e.date
            FROM "Entry" e
            WHERE e.kind = ?
              AND e.date >= ? AND e.date <= ?`,
      args: ['EXPENSE', unionFrom, unionTo],
    })
    const rows = res.rows as { category: string; amount: number; date: string }[]

    // Filter out deposits + shortage — they are not "expense heads"
    const filtered = rows.filter((r) => !isDeposit(r.category) && !isShortage(r.category))

    // Build head → { lastPeriod, thisPeriod }
    const headMap = new Map<string, { lastPeriod: number; thisPeriod: number }>()
    for (const r of filtered) {
      if (!headMap.has(r.category)) headMap.set(r.category, { lastPeriod: 0, thisPeriod: 0 })
      const e = headMap.get(r.category)!
      if (r.date >= lastFrom && r.date <= lastTo) e.lastPeriod += r.amount
      if (r.date >= thisFrom && r.date <= thisTo) e.thisPeriod += r.amount
    }

    const heads = Array.from(headMap.entries())
      .map(([head, v]) => ({
        head,
        lastPeriod: v.lastPeriod,
        thisPeriod: v.thisPeriod,
        difference: v.thisPeriod - v.lastPeriod,
        changePct: v.lastPeriod > 0 ? ((v.thisPeriod - v.lastPeriod) / v.lastPeriod) * 100 : null,
      }))
      .sort((a, b) => b.thisPeriod - a.thisPeriod)

    const totalsLast = heads.reduce((s, h) => s + h.lastPeriod, 0)
    const totalsThis = heads.reduce((s, h) => s + h.thisPeriod, 0)
    const totalsDiff = totalsThis - totalsLast
    const totalsPct = totalsLast > 0 ? ((totalsThis - totalsLast) / totalsLast) * 100 : null

    const [logoRes] = await Promise.all([
      libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
    ])
    const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

    return NextResponse.json({
      lastPeriod: { from: lastFrom, to: lastTo },
      thisPeriod: { from: thisFrom, to: thisTo },
      businessName: session.user.businessName,
      logoUrl,
      heads,
      totals: {
        lastPeriod: totalsLast,
        thisPeriod: totalsThis,
        difference: totalsDiff,
        changePct: totalsPct,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
