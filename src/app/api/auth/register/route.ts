import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

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

    const hashed = await bcrypt.hash(pw, 10)
    const user = await db.user.create({
      data: {
        email: emailNorm,
        password: hashed,
        name: nm || null,
        businessName: biz,
      },
      select: { id: true, email: true, name: true, businessName: true },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
