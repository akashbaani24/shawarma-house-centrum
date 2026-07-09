import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/types?kind=INCOME  -> list all types (direct libsql for speed)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const kind = searchParams.get('kind')

  try {
    let rows
    if (kind && ['INCOME', 'EXPENSE', 'INVEST', 'DEPOSIT'].includes(kind)) {
      const res = await libsql.execute({ sql: 'SELECT id, name, kind FROM "EntryType" WHERE kind = ? ORDER BY name ASC', args: [kind] })
      rows = res.rows
    } else {
      const res = await libsql.execute('SELECT id, name, kind FROM "EntryType" ORDER BY kind ASC, name ASC')
      rows = res.rows
    }
    return NextResponse.json({ types: rows })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load types' }, { status: 500 })
  }
}

// POST /api/types  { name, kind }  (uses Prisma for writes)
import { db } from '@/lib/db'
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
    if (!['INCOME', 'EXPENSE', 'INVEST', 'DEPOSIT'].includes(kind)) {
      return NextResponse.json({ error: 'Kind must be INCOME, EXPENSE, INVEST, or DEPOSIT' }, { status: 400 })
    }

    const type = await db.entryType.create({
      data: { name, kind, createdById: session.user.id },
    })
    return NextResponse.json({ type }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
