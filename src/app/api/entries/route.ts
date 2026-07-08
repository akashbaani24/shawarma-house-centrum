import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/entries?date=YYYY-MM-DD          -> entries for one day
// GET /api/entries?kind=INCOME              -> all entries of a kind (recent 100)
// GET /api/entries?kind=EXPENSE&source=BRANCH -> expenses filtered by source
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const kind = searchParams.get('kind')
  const source = searchParams.get('source')

  const where: { date?: string; kind?: string; source?: string } = {}
  if (date) where.date = date
  if (kind && (kind === 'INCOME' || kind === 'EXPENSE' || kind === 'INVEST')) where.kind = kind
  if (source && (source === 'BRANCH' || source === 'OFFICE')) where.source = source

  const entries = await db.entry.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      kind: true,
      category: true,
      amount: true,
      note: true,
      date: true,
      paymentMethod: true,
      source: true,
      bankAccount: { select: { bankName: true, accountName: true, accountNumber: true } },
    },
  })
  return NextResponse.json({ entries })
}

// POST /api/entries  { kind, typeId, category, amount, note, date, paymentMethod, bankAccountId, source }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { kind, typeId, category, amount, note, date, paymentMethod, bankAccountId, source, expenseCategoryId, supplierId } = body ?? {}

    if (kind !== 'INCOME' && kind !== 'EXPENSE' && kind !== 'INVEST') {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
    }
    const amt = typeof amount === 'number' ? amount : parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    const cat = String(category ?? '').trim()
    if (!cat) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const validMethods = ['CASH', 'CARD', 'BANK', 'MOBILE_BANK']
    const method = validMethods.includes(paymentMethod) ? paymentMethod : 'CASH'

    // source: BRANCH (default) or OFFICE
    const src = source === 'OFFICE' ? 'OFFICE' : 'BRANCH'

    let finalTypeId: string | null = null
    if (typeId) {
      const type = await db.entryType.findUnique({ where: { id: typeId } })
      if (type && type.kind === kind) {
        finalTypeId = typeId
      }
    }

    let finalBankAccountId: string | null = null
    if (bankAccountId && (method === 'BANK' || method === 'MOBILE_BANK')) {
      const acct = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
      if (acct) finalBankAccountId = bankAccountId
    }

    // Expense two-level dropdown: validate expenseCategoryId + supplierId
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

    const entry = await db.entry.create({
      data: {
        createdById: session.user.id,
        typeId: finalTypeId,
        kind,
        category: cat,
        amount: Math.round(amt * 100) / 100,
        note: note?.trim() || null,
        date,
        paymentMethod: method,
        source: src,
        bankAccountId: finalBankAccountId,
        expenseCategoryId: finalExpenseCategoryId,
        supplierId: finalSupplierId,
      },
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
