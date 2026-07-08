import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const ALL_RIGHTS = [
  'dashboard',
  'income',
  'expense',
  'types',
  'opening',
  'branch-report',
  'expense-details',
  'bank-accounts',
] as const

// GET /api/users  -> list all users (admin only)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const users = await db.user.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      businessName: true,
      role: true,
      rights: true,
      createdAt: true,
    },
  })

  // parse rights
  const parsed = users.map((u) => ({
    ...u,
    rights: (() => {
      try {
        const arr = JSON.parse(u.rights)
        return Array.isArray(arr) ? arr : []
      } catch {
        return []
      }
    })(),
  }))

  return NextResponse.json({ users: parsed })
}

// POST /api/users  { name, email, password, role, rights }  -> create user (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, email, password, role, rights } = body ?? {}

    const emailNorm = String(email ?? '').trim().toLowerCase()
    const pw = String(password ?? '')
    const nm = String(name ?? '').trim()
    const rl = String(role ?? 'USER').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER'

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (pw.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // rights validation
    const validRights = Array.isArray(rights)
      ? rights.filter((r: unknown) => typeof r === 'string' && (ALL_RIGHTS as readonly string[]).includes(r as string))
      : []

    const existing = await db.user.findUnique({ where: { email: emailNorm } })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(pw, 10)
    // inherit businessName from the creating admin
    const admin = await db.user.findUnique({ where: { id: session.user.id } })
    const businessName = admin?.businessName ?? 'Daily Report'

    const user = await db.user.create({
      data: {
        email: emailNorm,
        password: hashed,
        name: nm || null,
        businessName,
        role: rl,
        rights: JSON.stringify(validRights),
      },
      select: { id: true, email: true, name: true, role: true, rights: true },
    })

    return NextResponse.json({ user: { ...user, rights: validRights } }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
