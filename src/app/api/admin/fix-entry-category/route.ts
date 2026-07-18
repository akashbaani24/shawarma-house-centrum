import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// POST /api/admin/fix-entry-category { entryId, newCategory, newTypeId? }
// Admin-only. Updates an Entry's category (and optionally typeId) — used
// when an entry was saved with the wrong category (e.g. "Sales - Bkash"
// instead of "Sales - Card"). Does NOT touch amount, date, paymentMethod,
// source, or any other field.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const entryId = String(body?.entryId ?? '').trim()
    const newCategory = String(body?.newCategory ?? '').trim()
    const newTypeId = body?.newTypeId ? String(body.newTypeId).trim() : null

    if (!entryId || !newCategory) {
      return NextResponse.json({ error: 'entryId and newCategory are required' }, { status: 400 })
    }

    // Fetch the current entry to show before/after
    const before = await libsql.execute({
      sql: `SELECT id, category, "typeId", amount, date, "paymentMethod", source, kind
            FROM "Entry" WHERE id = ?`,
      args: [entryId],
    })
    if (before.rows.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Update the entry
    if (newTypeId) {
      await libsql.execute({
        sql: `UPDATE "Entry" SET category = ?, "typeId" = ? WHERE id = ?`,
        args: [newCategory, newTypeId, entryId],
      })
    } else {
      await libsql.execute({
        sql: `UPDATE "Entry" SET category = ? WHERE id = ?`,
        args: [newCategory, entryId],
      })
    }

    // Fetch after
    const after = await libsql.execute({
      sql: `SELECT id, category, "typeId", amount, date, "paymentMethod", source, kind
            FROM "Entry" WHERE id = ?`,
      args: [entryId],
    })

    return NextResponse.json({
      ok: true,
      message: `Entry category updated from "${(before.rows[0] as { category: string }).category}" to "${newCategory}".`,
      before: before.rows[0],
      after: after.rows[0],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
