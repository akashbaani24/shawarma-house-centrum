import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { ALL_RIGHTS } from '@/app/api/users/route'

type Params = { params: Promise<{ id: string }> }

// PUT /api/users/:id  { name?, password?, role?, rights? }  -> update user (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { name, email, password, role, rights } = body ?? {}

    const target = await db.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent demoting the last admin
    if (target.role === 'ADMIN' && role === 'USER') {
      const adminCount = await db.user.count({ where: { role: 'ADMIN' } })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last admin. Promote another user first.' },
          { status: 400 },
        )
      }
    }

    const data: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) data.name = name.trim()
    if (typeof email === 'string' && email.trim()) {
      // Check if email is already taken by another user
      const emailNorm = email.trim().toLowerCase()
      if (emailNorm !== target.email) {
        const existing = await db.user.findUnique({ where: { email: emailNorm } })
        if (existing) {
          return NextResponse.json({ error: 'This username/email is already taken' }, { status: 409 })
        }
        data.email = emailNorm
      }
    }
    if (typeof password === 'string' && password.length >= 6) {
      data.password = await bcrypt.hash(password, 10)
    }
    if (role === 'ADMIN' || role === 'USER') data.role = role
    if (Array.isArray(rights)) {
      const validRights = rights.filter(
        (r: unknown) => typeof r === 'string' && (ALL_RIGHTS as readonly string[]).includes(r as string),
      )
      data.rights = JSON.stringify(validRights)
    }

    const updated = await db.user.update({ where: { id }, data })
    return NextResponse.json({ user: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/users/:id  (admin only; cannot delete self)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { id } = await params
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const target = await db.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deleting the last admin
    if (target.role === 'ADMIN') {
      const adminCount = await db.user.count({ where: { role: 'ADMIN' } })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin account' },
          { status: 400 },
        )
      }
    }

    await db.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
