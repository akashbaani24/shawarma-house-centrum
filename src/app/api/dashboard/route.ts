import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// GET /api/dashboard — ultra-fast: direct libsql queries (bypasses Prisma)
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayStr()

  try {
    // Run all queries in parallel — single round-trip batch
    const [todayRes, recentRes, obRes, typeCountRes, userCountRes] = await Promise.all([
      libsql.execute({ sql: 'SELECT kind, amount FROM "Entry" WHERE date = ?', args: [today] }),
      libsql.execute('SELECT id, kind, category, amount, note, date FROM "Entry" ORDER BY "createdAt" DESC LIMIT 8'),
      libsql.execute({ sql: 'SELECT amount FROM "OpeningBalance" WHERE date = ?', args: [today] }),
      libsql.execute('SELECT COUNT(*) as n FROM "EntryType"'),
      libsql.execute('SELECT COUNT(*) as n FROM "User"'),
    ])

    const todayRows = todayRes.rows as { kind: string; amount: number }[]
    const recentRows = recentRes.rows as { id: string; kind: string; category: string; amount: number; note: string | null; date: string }[]
    const obRows = obRes.rows as { amount: number }[]
    const typeRows = typeCountRes.rows as { n: number }[]
    const userRows = userCountRes.rows as { n: number }[]

    const income = todayRows.filter((e) => e.kind === 'INCOME').reduce((s, e) => s + e.amount, 0)
    const expense = todayRows.filter((e) => e.kind === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
    const opening = obRows[0]?.amount ?? 0

    return NextResponse.json({
      today,
      opening,
      income,
      expense,
      closing: opening + income - expense,
      entryCount: todayRows.length,
      typeCount: Number(typeRows[0]?.n ?? 0),
      userCount: Number(userRows[0]?.n ?? 0),
      role: session.user.role,
      recentEntries: recentRows,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
