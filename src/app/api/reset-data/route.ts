import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/reset-data  { confirm: "RESET" }  -> delete all entries, opening balances, denominations
// Keeps users, entry types, and the admin account intact.
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
    if (body?.confirm !== 'RESET') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { confirm: "RESET" } to proceed.' },
        { status: 400 },
      )
    }

    const [entries, openingBalances, denominations] = await db.$transaction([
      db.entry.deleteMany(),
      db.openingBalance.deleteMany(),
      db.denomination.deleteMany(),
    ])

    return NextResponse.json({
      ok: true,
      deleted: {
        entries: entries.count,
        openingBalances: openingBalances.count,
        denominations: denominations.count,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
