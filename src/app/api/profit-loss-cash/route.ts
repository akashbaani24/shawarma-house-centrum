import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'
import { getBusinessLogoUrl } from '@/lib/db'

// ============ Cash Basis P&L API ============
//
// GET /api/profit-loss-cash?from=&to=
//
// Cash Basis: recognize income when cash is received, expenses when
// cash is paid. This means:
//   - Income: filter by paymentDate (or date if paymentDate is null)
//   - Expense: filter by paymentDate (or date if paymentDate is null)
//   - Includes payments for PREVIOUS months' bills if paid in this period
//   - Excludes unpaid expenses (dueAmount > 0 with no payment)
//
// The 'date' field = transaction date (when the sale/bill occurred)
// The 'paymentDate' field = when cash actually moved (null = not paid yet)
//
// For cash basis, we use paymentDate if available, falling back to date
// for entries where paymentDate was not set (legacy data).

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
const isExcludedFromReports = (cat: string) => {
  const n = norm(cat)
  return n === 'paymenttopartner' || n === 'partnerpayment' || n === 'paymenttoowner' || n === 'ownerwithdrawal' || n === 'partnerwithdrawal' || n === 'profitdistribution'
}

const isExcess = (cat: string) => {
  const n = norm(cat)
  return n.includes('excess') || n.includes('cashexcess') || n.includes('excesscash') || n.includes('excessfound')
}

const isCogsCategory = (cat: string) => {
  const n = norm(cat)
  return n === 'supplierbill' || n === 'outpurchase' || n === 'purchase' || n.includes('rawmaterial') || n.includes('inventory') || n.includes('ingredient') || n.includes('packaging')
}

// Classify expense into a cash-basis payment category
type CashCategory = 'supplier' | 'salary' | 'overtime' | 'rent' | 'utility' | 'service_charge' | 'other'

function classifyCashExpense(cat: string, supplierName: string | null): CashCategory {
  const n = norm(cat)
  // Supplier payments (linked supplier OR supplier bill category)
  if ((supplierName && supplierName.trim().length > 0) || n.includes('supplierbill') || n === 'outpurchase' || n === 'purchase') return 'supplier'
  if (n.includes('salary')) return 'salary'
  if (n.includes('overtime')) return 'overtime'
  if (n.includes('rent')) return 'rent'
  if (n.includes('utility') || n.includes('utitlity') || n.includes('utilities') || n.includes('electric') || n.includes('gasbill') || n.includes('waterbill')) return 'utility'
  if (n.includes('servicecharge')) return 'service_charge'
  return 'other'
}

const CASH_CATEGORY_LABELS: Record<CashCategory, string> = {
  supplier: 'Supplier Payment',
  salary: 'Salary Payment',
  overtime: 'Overtime Payment',
  rent: 'Rent Payment',
  utility: 'Utility Payment',
  service_charge: 'Service Charge Payment',
  other: 'Other Cash Expenses',
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

  try {
    // For Cash Basis: use paymentDate if available, fall back to date.
    // An entry is "paid in this period" if:
    //   COALESCE(paymentDate, date) >= from AND COALESCE(paymentDate, date) <= to
    // AND the entry is actually paid (paymentMethod != 'CREDIT' OR dueAmount = 0)
    //
    // For income: all income entries count as "cash received" unless they're
    // credit sales with dueAmount > 0 (those are NOT cash received yet).
    //
    // For expenses: all expenses count as "cash paid" unless they're
    // unpaid supplier bills (dueAmount > 0 with no payment).

    const [entriesRes, logoUrl] = await Promise.all([
      libsql.execute({
        sql: `SELECT e.kind, e.category, e.amount, e."dueAmount", e.date,
                     e."paymentDate", e."paymentMethod", e.source,
                     s.name AS supplierName
              FROM "Entry" e
              LEFT JOIN "Supplier" s ON e."supplierId" = s.id
              WHERE COALESCE(e."paymentDate", e.date) >= ? AND COALESCE(e."paymentDate", e.date) <= ?
                AND e.kind IN (?, ?)
              ORDER BY e.date ASC`,
        args: [from, to, 'INCOME', 'EXPENSE'],
      }),
      getBusinessLogoUrl(),
    ])

    const rows = entriesRes.rows as {
      kind: string
      category: string
      amount: number
      dueAmount: number
      date: string
      paymentDate: string | null
      paymentMethod: string
      source: string
      supplierName: string | null
    }[]

    // ===== CASH RECEIVED (Income) =====
    // Only count income that was actually received (not credit sales with due)
    const cashIncomeMap = new Map<string, number>()
    let totalExcess = 0
    for (const e of rows) {
      if (e.kind !== 'INCOME') continue
      // Skip credit sales that are not yet paid (dueAmount > 0)
      if (e.paymentMethod === 'CREDIT' && e.dueAmount > 0) continue
      if (isExcess(e.category)) {
        totalExcess += e.amount
        continue
      }
      if (isDeposit(e.category)) continue // deposits are transfers, not income
      cashIncomeMap.set(e.category, (cashIncomeMap.get(e.category) ?? 0) + e.amount)
    }
    const cashIncome = Array.from(cashIncomeMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const totalCashReceived = cashIncome.reduce((s, r) => s + r.amount, 0) + totalExcess

    // ===== CASH PAYMENTS (Expenses) =====
    // Only count expenses that were actually paid (not unpaid bills)
    // Skip deposits (transfers, not real expenses)
    const cashExpenseMap = new Map<CashCategory, { amount: number; items: { category: string; amount: number }[] }>()
    for (const cat of Object.keys(CASH_CATEGORY_LABELS) as CashCategory[]) {
      cashExpenseMap.set(cat, { amount: 0, items: [] })
    }

    for (const e of rows) {
      if (e.kind !== 'EXPENSE') continue
      if (isDeposit(e.category)) continue
      if (isExcludedFromReports(e.category)) continue
      if (isShortage(e.category)) {
        // Shortage counts as 'other'
        cashExpenseMap.get('other')!.amount += e.amount
        cashExpenseMap.get('other')!.items.push({ category: e.category, amount: e.amount })
        continue
      }
      // Skip unpaid supplier bills (dueAmount > 0 means not fully paid)
      // But include partial payments — the paid portion counts as cash paid.
      // For simplicity: if dueAmount > 0, the entry was not fully paid.
      // The actual cash paid = amount - dueAmount.
      // But for supplier bills, the SupplierBill table tracks billAmount vs paidAmount
      // separately. The Entry.amount is the bill amount (full).
      // So for cash basis: if dueAmount > 0, we only count (amount - dueAmount) as cash paid.
      const cashPaid = e.dueAmount > 0 ? (e.amount - e.dueAmount) : e.amount
      if (cashPaid <= 0) continue // nothing paid yet

      const cat = classifyCashExpense(e.category, e.supplierName)
      cashExpenseMap.get(cat)!.amount += cashPaid
      cashExpenseMap.get(cat)!.items.push({ category: e.category, amount: cashPaid })
    }

    const cashPayments = Object.keys(CASH_CATEGORY_LABELS)
      .map((key) => {
        const cat = key as CashCategory
        const data = cashExpenseMap.get(cat)!
        return {
          key: cat,
          label: CASH_CATEGORY_LABELS[cat],
          amount: data.amount,
          items: data.items.sort((a, b) => b.amount - a.amount),
        }
      })
      .filter((c) => c.amount > 0)

    const totalCashPayments = cashPayments.reduce((s, c) => s + c.amount, 0)
    const netCashProfit = totalCashReceived - totalCashPayments

    return NextResponse.json({
      from,
      to,
      businessName: session.user.businessName,
      logoUrl,
      // Cash received
      cashIncome,
      totalExcess,
      totalCashReceived,
      // Cash payments
      cashPayments,
      totalCashPayments,
      // Net
      netCashProfit,
      isProfit: netCashProfit >= 0,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
