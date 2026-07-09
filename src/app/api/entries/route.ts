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
  const kind = searchParams.get('kind')
  const source = searchParams.get('source')

  try {
    let sql = 'SELECT id, kind, category, amount, note, date, "paymentMethod", source FROM "Entry" WHERE 1=1'
    const args: (string)[] = []
    if (date) { sql += ' AND date = ?'; args.push(date) }
    if (kind && ['INCOME', 'EXPENSE', 'INVEST'].includes(kind)) { sql += ' AND kind = ?'; args.push(kind) }
    if (source && ['BRANCH', 'OFFICE'].includes(source)) { sql += ' AND source = ?'; args.push(source) }
    sql += ' ORDER BY date DESC, "createdAt" DESC LIMIT 100'

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
    const { kind, typeId, category, amount, note, date, paymentMethod, bankAccountId, source, expenseCategoryId, supplierId } = body ?? {}

    if (kind !== 'INCOME' && kind !== 'EXPENSE' && kind !== 'INVEST') {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
    }
    const amt = typeof amount === 'number' ? amount : parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    const cat = String(category ?? '').trim()
    if (!cat) return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    const validMethods = ['CASH', 'CARD', 'BANK', 'MOBILE_BANK']
    const method = validMethods.includes(paymentMethod) ? paymentMethod : 'CASH'
    const src = source === 'OFFICE' ? 'OFFICE' : 'BRANCH'

    let finalTypeId: string | null = null
    if (typeId) {
      const type = await db.entryType.findUnique({ where: { id: typeId } })
      if (type && type.kind === kind) finalTypeId = typeId
    }
    let finalBankAccountId: string | null = null
    if (bankAccountId && (method === 'BANK' || method === 'MOBILE_BANK')) {
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

    const entry = await db.entry.create({
      data: {
        createdById: session.user.id,
        typeId: finalTypeId,
        kind, category: cat,
        amount: Math.round(amt * 100) / 100,
        note: note?.trim() || null,
        date, paymentMethod: method, source: src,
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
