import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// ============ Classification helpers (shared with P&L) ============

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const isDeposit = (cat: string) => {
  const n = norm(cat)
  return n.includes('deposit') || n.includes('bankaccount') || n.includes('cardsale') || n.includes('digitalwallet') || n.includes('bkashno') || n.includes('bkashmobile')
}
const isShortage = (cat: string) => {
  const n = norm(cat)
  return n.includes('shortage')
}
const isExcess = (cat: string) => {
  const n = norm(cat)
  return n.includes('excess') || n.includes('cashexcess') || n.includes('excesscash') || n.includes('excessfound')
}
const isCogsCategory = (cat: string) => {
  const n = norm(cat)
  return n === 'supplierbill' || n === 'outpurchase' || n === 'purchase' || n.includes('rawmaterial') || n.includes('inventory') || n.includes('ingredient') || n.includes('packaging')
}

// GET /api/monthly-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns a single-month financial snapshot for the dashboard-style summary.
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

  try {
    const [entriesRes, logoRes] = await Promise.all([
      libsql.execute({
        sql: `SELECT e.kind, e.category, e.amount, e.source, e.date,
                     s.name AS supplierName
              FROM "Entry" e
              LEFT JOIN "Supplier" s ON e."supplierId" = s.id
              WHERE e.date >= ? AND e.date <= ? AND e.kind IN (?, ?)
              ORDER BY e.date ASC`,
        args: [from, to, 'INCOME', 'EXPENSE'],
      }),
      libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
    ])

    const rows = entriesRes.rows as {
      kind: string; category: string; amount: number; source: string; date: string
      supplierName: string | null
    }[]
    const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

    // ===== REVENUE =====
    const revenueMap = new Map<string, number>()
    let totalExcess = 0
    for (const e of rows) {
      if (e.kind !== 'INCOME') continue
      if (isExcess(e.category)) { totalExcess += e.amount; continue }
      revenueMap.set(e.category, (revenueMap.get(e.category) ?? 0) + e.amount)
    }
    const revenue = Array.from(revenueMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0) + totalExcess

    // ===== COGS =====
    const cogsMap = new Map<string, number>()
    for (const e of rows) {
      if (e.kind !== 'EXPENSE') continue
      if (isDeposit(e.category) || isShortage(e.category)) continue
      const isCogs = (e.supplierName && e.supplierName.trim().length > 0) || isCogsCategory(e.category)
      if (!isCogs) continue
      const label = e.supplierName && e.supplierName.trim().length > 0 ? e.supplierName : e.category
      cogsMap.set(label, (cogsMap.get(label) ?? 0) + e.amount)
    }
    const cogs = Array.from(cogsMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const totalCogs = cogs.reduce((s, c) => s + c.amount, 0)
    const grossProfit = totalRevenue - totalCogs

    // ===== OPERATING =====
    const opMap = new Map<string, number>()
    for (const e of rows) {
      if (e.kind !== 'EXPENSE') continue
      if (isDeposit(e.category) || isShortage(e.category)) continue
      const isCogs = (e.supplierName && e.supplierName.trim().length > 0) || isCogsCategory(e.category)
      if (isCogs) continue
      opMap.set(e.category, (opMap.get(e.category) ?? 0) + e.amount)
    }
    const operating = Array.from(opMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const totalOperating = operating.reduce((s, c) => s + c.amount, 0)
    const operatingProfit = grossProfit - totalOperating

    // ===== OTHER LOSSES =====
    let totalShortage = 0
    for (const e of rows) {
      if (e.kind === 'EXPENSE' && isShortage(e.category)) totalShortage += e.amount
    }
    const netProfit = operatingProfit - totalShortage

    // ===== DEPOSITS (transfers, not expense) =====
    let totalDeposits = 0
    for (const e of rows) {
      if (e.kind === 'EXPENSE' && isDeposit(e.category)) totalDeposits += e.amount
    }

    return NextResponse.json({
      from, to,
      businessName: session.user.businessName,
      logoUrl,
      revenue,
      totalExcess,
      totalRevenue,
      cogs,
      totalCogs,
      grossProfit,
      operating,
      totalOperating,
      operatingProfit,
      totalShortage,
      totalDeposits,
      netProfit,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
