import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// ============ Classification helpers ============

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Deposits / internal transfers — NOT counted as expense
const isDeposit = (cat: string) => {
  const n = norm(cat)
  return (
    n.includes('deposit') ||
    n.includes('bankaccount') ||
    n.includes('cardsale') ||
    n.includes('digitalwallet') ||
    n.includes('bkashno') ||
    n.includes('bkashmobile')
  )
}

// Cash shortage → "Other Losses"
const isShortage = (cat: string) => {
  const n = norm(cat)
  return n.includes('shortage')
}

// Excess / Extra Cash → counted as Revenue (shown separately)
const isExcess = (cat: string) => {
  const n = norm(cat)
  return n.includes('excess') || n.includes('cashexcess') || n.includes('excesscash') || n.includes('excessfound')
}

// COGS — purchase-related categories (catches "Out Purchase" and any others)
const isCogsCategory = (cat: string) => {
  const n = norm(cat)
  return (
    n === 'supplierbill' ||
    n === 'outpurchase' ||
    n === 'purchase' ||
    n.includes('rawmaterial') ||
    n.includes('inventory') ||
    n.includes('ingredient') ||
    n.includes('packaging')
  )
}

// Classify operating expense into a subgroup
type OpGroup = 'employee' | 'occupancy' | 'utilities' | 'transportation' | 'other'

function classifyOperating(cat: string): OpGroup {
  const n = norm(cat)

  // Employee Expenses
  if (
    n.includes('salary') ||
    n.includes('overtime') ||
    n.includes('stafffood') ||
    n.includes('staffwelfare') ||
    n.includes('staffmeal') ||
    n.includes('bonus') ||
    n.includes('incentive') ||
    n.includes('eidbonus') ||
    n.includes('gratuity') ||
    n.includes('medicalallowance') ||
    n.includes('employee') ||
    n.includes('wage')
  ) {
    return 'employee'
  }

  // Occupancy Expenses
  if (
    n.includes('rent') ||
    n.includes('servicecharge') ||
    n.includes('lease') ||
    n.includes('society') ||
    n.includes('hoa')
  ) {
    return 'occupancy'
  }

  // Transportation & Delivery
  if (
    n.includes('conveyance') ||
    n.includes('transport') ||
    n.includes('delivery') ||
    n.includes('fuel') ||
    n.includes('vehicle') ||
    n.includes('driver') ||
    n.includes('courier') ||
    n.includes('parking')
  ) {
    return 'transportation'
  }

  // Utilities & Administration
  if (
    n.includes('utilities') ||
    n.includes('utility') ||
    n.includes('electric') ||
    n.includes('gasbill') ||
    n.includes('waterbill') ||
    n.includes('internet') ||
    n.includes('broadband') ||
    n.includes('officeexpense') ||
    n.includes('office') ||
    n.includes('stationery') ||
    n.includes('printing') ||
    n.includes('telephone') ||
    n.includes('mobilebill') ||
    n.includes('software') ||
    n.includes('technology') ||
    n.includes('audit') ||
    n.includes('legal') ||
    n.includes('accounting') ||
    n.includes('bankcharge') ||
    n.includes('insurance') ||
    n.includes('repair') ||
    n.includes('maintenance') ||
    n.includes('marketing') ||
    n.includes('advertisement') ||
    n.includes('advertising')
  ) {
    return 'utilities'
  }

  return 'other'
}

const OP_GROUP_LABELS: Record<OpGroup, string> = {
  employee: 'Employee Expenses',
  occupancy: 'Occupancy Expenses',
  utilities: 'Utilities & Administration',
  transportation: 'Transportation & Delivery',
  other: 'Other Expenses',
}

// ============ API ============

// GET /api/profit-loss?from=&to=
// Returns a structured P&L statement following the standard format:
// REVENUE → COGS → GROSS PROFIT → OPERATING EXPENSES → OPERATING PROFIT → OTHER LOSSES → NET PROFIT
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
    // JOIN Entry with Supplier so we know which expense entries are supplier bills
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
      kind: string
      category: string
      amount: number
      source: string
      date: string
      supplierName: string | null
    }[]
    const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

    // ===== REVENUE =====
    // Income entries, EXCEPT excess/excess-cash (those go into a separate Revenue line)
    const revenueMap = new Map<string, number>()
    let totalExcess = 0
    for (const e of rows) {
      if (e.kind !== 'INCOME') continue
      if (isExcess(e.category)) {
        totalExcess += e.amount
        continue
      }
      revenueMap.set(e.category, (revenueMap.get(e.category) ?? 0) + e.amount)
    }
    const revenue = Array.from(revenueMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0) + totalExcess

    // ===== COST OF GOODS SOLD (COGS) =====
    // An expense is COGS if:
    //   (a) it has a supplier linked (supplierName not null) — use supplier name as label, OR
    //   (b) category matches purchase keywords (Out Purchase, etc.)
    const cogsMap = new Map<string, number>()
    for (const e of rows) {
      if (e.kind !== 'EXPENSE') continue
      if (isDeposit(e.category)) continue
      if (isShortage(e.category)) continue
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

    // ===== OPERATING EXPENSES =====
    // Remaining expenses (not COGS, not deposits, not shortage), grouped into subgroups.
    const opGroupsMap = new Map<OpGroup, Map<string, number>>()
    for (const e of rows) {
      if (e.kind !== 'EXPENSE') continue
      if (isDeposit(e.category)) continue
      if (isShortage(e.category)) continue
      const isCogs = (e.supplierName && e.supplierName.trim().length > 0) || isCogsCategory(e.category)
      if (isCogs) continue
      const group = classifyOperating(e.category)
      if (!opGroupsMap.has(group)) opGroupsMap.set(group, new Map())
      const m = opGroupsMap.get(group)!
      m.set(e.category, (m.get(e.category) ?? 0) + e.amount)
    }
    // Build ordered groups: employee, occupancy, utilities, transportation, other
    const opGroupOrder: OpGroup[] = ['employee', 'occupancy', 'utilities', 'transportation', 'other']
    const operatingGroups = opGroupOrder
      .filter((g) => opGroupsMap.has(g))
      .map((g) => {
        const m = opGroupsMap.get(g)!
        const items = Array.from(m.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
        const total = items.reduce((s, i) => s + i.amount, 0)
        return { key: g, label: OP_GROUP_LABELS[g], items, total }
      })
    const totalOperating = operatingGroups.reduce((s, g) => s + g.total, 0)
    const operatingProfit = grossProfit - totalOperating

    // ===== OTHER LOSSES / ADJUSTMENTS =====
    const otherLossesMap = new Map<string, number>()
    for (const e of rows) {
      if (e.kind !== 'EXPENSE') continue
      if (!isShortage(e.category)) continue
      otherLossesMap.set(e.category, (otherLossesMap.get(e.category) ?? 0) + e.amount)
    }
    const otherLosses = Array.from(otherLossesMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const totalOtherLosses = otherLosses.reduce((s, l) => s + l.amount, 0)

    // ===== DEPOSITS (not included in P&L) =====
    let totalDeposits = 0
    for (const e of rows) {
      if (e.kind !== 'EXPENSE') continue
      if (isDeposit(e.category)) totalDeposits += e.amount
    }

    // ===== NET PROFIT =====
    const netProfit = operatingProfit - totalOtherLosses

    return NextResponse.json({
      from,
      to,
      businessName: session.user.businessName,
      logoUrl,
      // Revenue
      revenue,
      totalExcess,
      totalRevenue,
      // COGS
      cogs,
      totalCogs,
      grossProfit,
      // Operating
      operatingGroups,
      totalOperating,
      operatingProfit,
      // Other losses
      otherLosses,
      totalOtherLosses,
      // Deposits (informational)
      totalDeposits,
      // Net
      netProfit,
      // counts (for summary cards)
      incomeCount: rows.filter((e) => e.kind === 'INCOME').length,
      expenseCount: rows.filter((e) => e.kind === 'EXPENSE' && !isDeposit(e.category)).length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
