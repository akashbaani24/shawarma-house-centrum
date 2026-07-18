import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/entries?date=&kind=&source=  (direct libsql for speed)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const kind = searchParams.get('kind')
  const source = searchParams.get('source')

  try {
    // LEFT JOIN BankAccount so the entry list can show the bank name + account number.
    // Sort by createdAt DESC first so the most recent entry appears at the top.
    let sql = `SELECT e.id, e.kind, e.category, e.amount, e.note, e.date,
                      e."paymentMethod", e.source,
                      e."bankAccountId",
                      b."bankName", b."accountName", b."accountNumber"
               FROM "Entry" e
               LEFT JOIN "BankAccount" b ON e."bankAccountId" = b.id
               WHERE 1=1`
    const args: (string)[] = []
    if (date) { sql += ' AND e.date = ?'; args.push(date) }
    if (from) { sql += ' AND e.date >= ?'; args.push(from) }
    if (to) { sql += ' AND e.date <= ?'; args.push(to) }
    if (kind && ['INCOME', 'EXPENSE', 'INVEST'].includes(kind)) { sql += ' AND e.kind = ?'; args.push(kind) }
    if (source && ['BRANCH', 'OFFICE'].includes(source)) { sql += ' AND e.source = ?'; args.push(source) }
    sql += ' ORDER BY e."createdAt" DESC, e.date DESC, e.category ASC LIMIT 200'

    const res = await libsql.execute({ sql, args })
    return NextResponse.json({ entries: res.rows })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load entries' }, { status: 500 })
  }
}

// POST /api/entries  (uses Prisma for writes)
import { db } from '@/lib/db'
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { kind, typeId, category, amount, note, date, paymentMethod, bankAccountId, source, expenseCategoryId, supplierId, dueAmount, paymentDate, customerId } = body ?? {}

    if (kind !== 'INCOME' && kind !== 'EXPENSE' && kind !== 'INVEST') {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
    }
    const amt = typeof amount === 'number' ? amount : parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    const cat = String(category ?? '').trim()
    if (!cat) return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    // Accrual: paymentMethod now supports 'CREDIT' for credit sales/purchases
    const validMethods = ['CASH', 'CARD', 'BANK', 'MOBILE_BANK', 'CREDIT']
    const method = validMethods.includes(paymentMethod) ? paymentMethod : 'CASH'
    const src = source === 'OFFICE' ? 'OFFICE' : 'BRANCH'

    // Accrual: dueAmount (0 = fully paid, > 0 = partially paid or unpaid)
    const due = typeof dueAmount === 'number' ? dueAmount : parseFloat(dueAmount ?? '0')
    const finalDueAmount = isNaN(due) || due < 0 ? 0 : Math.min(due, amt) // can't exceed amount
    // paymentDate: null if not yet paid, otherwise validate format
    const finalPaymentDate = paymentDate && /^\d{4}-\d{2}-\d{2}$/.test(String(paymentDate)) ? String(paymentDate) : null

    let finalTypeId: string | null = null
    if (typeId) {
      const type = await db.entryType.findUnique({ where: { id: typeId } })
      if (type && type.kind === kind) finalTypeId = typeId
    }
    let finalBankAccountId: string | null = null
    if (bankAccountId && (method === 'BANK' || method === 'MOBILE_BANK' || method === 'CARD')) {
      const acct = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
      if (acct) finalBankAccountId = bankAccountId
    }
    let finalExpenseCategoryId: string | null = null
    if (expenseCategoryId) {
      const ec = await db.expenseCategory.findUnique({ where: { id: expenseCategoryId } })
      if (ec) finalExpenseCategoryId = ec.id
    }
    let finalSupplierId: string | null = null
    if (supplierId) {
      const sup = await db.supplier.findUnique({ where: { id: supplierId } })
      if (sup) finalSupplierId = sup.id
    }
    // Accrual: validate customer (for credit sales)
    let finalCustomerId: string | null = null
    if (customerId) {
      const cust = await db.customer.findUnique({ where: { id: customerId } })
      if (cust) finalCustomerId = cust.id
    }

    const entry = await db.entry.create({
      data: {
        createdById: session.user.id,
        typeId: finalTypeId,
        kind, category: cat,
        amount: Math.round(amt * 100) / 100,
        dueAmount: Math.round(finalDueAmount * 100) / 100,
        note: note?.trim() || null,
        date,
        paymentDate: finalPaymentDate,
        paymentMethod: method, source: src,
        bankAccountId: finalBankAccountId,
        expenseCategoryId: finalExpenseCategoryId,
        supplierId: finalSupplierId,
        customerId: finalCustomerId,
      },
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
