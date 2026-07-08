import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/bank-accounts  -> list all bank accounts
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await db.bankAccount.findMany({
    orderBy: [{ bankName: 'asc' }, { accountName: 'asc' }],
  })
  return NextResponse.json({ bankAccounts: accounts })
}

// POST /api/bank-accounts  { bankName, accountName, accountNumber, branch? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { bankName, accountName, accountNumber, branch } = body ?? {}

    const bn = String(bankName ?? '').trim()
    const an = String(accountName ?? '').trim()
    const num = String(accountNumber ?? '').trim()

    if (!bn) return NextResponse.json({ error: 'Bank name is required' }, { status: 400 })
    if (!an) return NextResponse.json({ error: 'Account name is required' }, { status: 400 })
    if (!num) return NextResponse.json({ error: 'Account number is required' }, { status: 400 })

    const account = await db.bankAccount.create({
      data: {
        bankName: bn,
        accountName: an,
        accountNumber: num,
        branch: String(branch ?? '').trim() || null,
        createdById: session.user.id,
      },
    })
    return NextResponse.json({ bankAccount: account }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
