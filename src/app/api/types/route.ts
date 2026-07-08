import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/types?kind=INCOME  -> list user's types (optionally filtered)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const kind = searchParams.get('kind')

  const where: { userId: string; kind?: string } = { userId: session.user.id }
  if (kind && (kind === 'INCOME' || kind === 'EXPENSE')) where.kind = kind

  const types = await db.entryType.findMany({
    where,
    orderBy: [{ kind: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ types })
}

// POST /api/types  { name, kind }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    const kind = String(body?.kind ?? '').toUpperCase()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (kind !== 'INCOME' && kind !== 'EXPENSE') {
      return NextResponse.json({ error: 'Kind must be INCOME or EXPENSE' }, { status: 400 })
    }

    const type = await db.entryType.create({
      data: { userId: session.user.id, name, kind },
    })
    return NextResponse.json({ type }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
