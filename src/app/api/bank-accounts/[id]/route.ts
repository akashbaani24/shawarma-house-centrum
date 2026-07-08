import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/bank-accounts/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    await db.bankAccount.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PUT /api/bank-accounts/:id  -> toggle active or update fields
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (typeof body?.bankName === 'string') data.bankName = body.bankName.trim()
    if (typeof body?.accountName === 'string') data.accountName = body.accountName.trim()
    if (typeof body?.accountNumber === 'string') data.accountNumber = body.accountNumber.trim()
    if (typeof body?.branch === 'string') data.branch = body.branch.trim() || null
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive

    const account = await db.bankAccount.update({ where: { id }, data })
    return NextResponse.json({ bankAccount: account })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
