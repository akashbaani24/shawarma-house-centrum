import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// PUT /api/entries/[id]  — edit an existing entry's mutable fields.
// Admin only. The category / supplier / type is NOT changed here — only the
// fields that are commonly entered wrong: date, amount, note, paymentMethod,
// and bankAccountId.
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required to edit' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { amount, note, date, paymentMethod, bankAccountId } = body ?? {}

    // Validate amount
    const amt = typeof amount === 'number' ? amount : parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Validate date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    // Validate payment method
    const validMethods = ['CASH', 'CARD', 'BANK', 'MOBILE_BANK']
    const method = validMethods.includes(paymentMethod) ? paymentMethod : 'CASH'

    // Validate bank account — must be set if method is BANK/CARD/MOBILE_BANK,
    // and must be cleared (null) otherwise.
    let finalBankAccountId: string | null = null
    if (method === 'BANK' || method === 'CARD' || method === 'MOBILE_BANK') {
      if (bankAccountId) {
        const acct = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
        if (acct) finalBankAccountId = bankAccountId
      }
      // If the method requires a bank account but none is provided, we leave
      // it null — the entry will still save, but the report will show the
      // method without a bank name (which matches legacy behavior).
    }

    // Make sure the entry exists before updating
    const existing = await db.entry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const updated = await db.entry.update({
      where: { id },
      data: {
        amount: Math.round(amt * 100) / 100,
        note: typeof note === 'string' ? (note.trim() || null) : existing.note,
        date,
        paymentMethod: method,
        bankAccountId: finalBankAccountId,
      },
    })

    return NextResponse.json({ entry: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required to delete' }, { status: 403 })
  }
  try {
    const { id } = await params
    await db.entry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
