import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// All view keys that can be granted as rights
export const ALL_RIGHTS = [
  'dashboard',
  'income',
  'expense-branch',
  'expense-office',
  'invest',
  'types',
  'opening',
  'branch-report',
  'expense-details',
  'investment-report',
  'bank-accounts',
] as const

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, businessName } = body ?? {}

    const emailNorm = String(email ?? '').trim().toLowerCase()
    const pw = String(password ?? '')
    const nm = String(name ?? '').trim()
    const biz = String(businessName ?? '').trim() || 'Daily Report'

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (pw.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email: emailNorm } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // First user becomes ADMIN with all rights; subsequent public registrations are blocked
    // (sub-users must be created by admin via /api/users)
    const userCount = await db.user.count()
    const isFirstUser = userCount === 0

    const role = isFirstUser ? 'ADMIN' : 'USER'
    const rights = isFirstUser ? JSON.stringify([...ALL_RIGHTS]) : JSON.stringify([])

    const hashed = await bcrypt.hash(pw, 10)
    const user = await db.user.create({
      data: {
        email: emailNorm,
        password: hashed,
        name: nm || null,
        businessName: biz,
        role,
        rights,
        // seed default entry types (shared, no userId now)
        createdEntryTypes: {
          create: [
            { name: 'Salary', kind: 'INCOME' },
            { name: 'Business', kind: 'INCOME' },
            { name: 'Freelance', kind: 'INCOME' },
            { name: 'Sales - Cash', kind: 'INCOME' },
            { name: 'Sales - Bkash', kind: 'INCOME' },
            { name: 'Sales - Card', kind: 'INCOME' },
            { name: 'Received from Partner', kind: 'INCOME' },
            { name: 'Miscellaneous Income', kind: 'INCOME' },
            { name: 'Vendor Bill', kind: 'EXPENSE' },
            { name: 'Out Purchase', kind: 'EXPENSE' },
            { name: 'Conveyance', kind: 'EXPENSE' },
            { name: 'Delivery Charge', kind: 'EXPENSE' },
            { name: 'Food', kind: 'EXPENSE' },
            { name: 'Rent', kind: 'EXPENSE' },
            { name: 'Utilities', kind: 'EXPENSE' },
            { name: 'Mobile Recharge', kind: 'EXPENSE' },
            { name: 'Office Expense', kind: 'EXPENSE' },
            { name: 'Entertainment', kind: 'EXPENSE' },
            { name: 'Payment to Partner', kind: 'EXPENSE' },
            { name: 'Bank Deposit', kind: 'EXPENSE' },
            { name: 'Other Expense', kind: 'EXPENSE' },
          ],
        },
      },
      select: { id: true, email: true, name: true, businessName: true, role: true, rights: true },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
