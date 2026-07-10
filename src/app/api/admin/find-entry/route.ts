import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// POST /api/admin/find-entry  { category?, amount?, date?, note? }
// Admin-only helper that searches Entry rows by any combination of
// category / amount / date / note (case-insensitive contains for text).
// Returns the matched rows with bank account info + creator info so an
// admin can quickly figure out where an entry came from.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const category = typeof body?.category === 'string' ? body.category.trim() : ''
    const amount = typeof body?.amount === 'number'
      ? body.amount
      : typeof body?.amount === 'string' && body.amount.trim()
        ? parseFloat(body.amount)
        : null
    const date = typeof body?.date === 'string' ? body.date.trim() : ''
    const note = typeof body?.note === 'string' ? body.note.trim() : ''

    let sql = `SELECT e.id, e.kind, e.category, e.amount, e.date, e.source,
                      e."paymentMethod", e.note, e."createdAt",
                      b."bankName", b."accountName", b."accountNumber",
                      u.name AS "creatorName", u.email AS "creatorEmail"
               FROM "Entry" e
               LEFT JOIN "BankAccount" b ON e."bankAccountId" = b.id
               LEFT JOIN "User" u ON e."createdById" = u.id
               WHERE 1=1`
    const args: (string | number)[] = []

    if (category) {
      sql += ' AND LOWER(e.category) LIKE LOWER(?)'
      args.push(`%${category}%`)
    }
    if (amount !== null && !isNaN(amount)) {
      sql += ' AND ABS(e.amount - ?) < 0.01'
      args.push(amount)
    }
    if (date) {
      sql += ' AND e.date = ?'
      args.push(date)
    }
    if (note) {
      sql += ' AND LOWER(e.note) LIKE LOWER(?)'
      args.push(`%${note}%`)
    }

    sql += ' ORDER BY e."createdAt" DESC LIMIT 50'

    const res = await libsql.execute({ sql, args })
    return NextResponse.json({
      count: res.rows.length,
      entries: res.rows.map((r) => ({
        ...r,
        // Make source/kind explicit so the user can see at a glance
        sourceLabel: r.source === 'OFFICE' ? 'Expense by Office' : 'Expense by Branch',
        kindLabel: r.kind === 'INCOME' ? 'Income' : r.kind === 'EXPENSE' ? 'Expense' : r.kind === 'INVEST' ? 'Invest' : r.kind,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
