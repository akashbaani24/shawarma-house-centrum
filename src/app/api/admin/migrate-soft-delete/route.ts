import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// POST /api/admin/migrate-soft-delete
// Admin-only. Adds the deletedAt column to the Entry table for soft-delete.
// Idempotent.

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    await libsql.execute({
      sql: `ALTER TABLE "Entry" ADD COLUMN "deletedAt" DATETIME`,
      args: [],
    })
    return NextResponse.json({ ok: true, message: 'deletedAt column added to Entry table.' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    if (msg.includes('duplicate column name')) {
      return NextResponse.json({ ok: true, message: 'deletedAt column already exists.' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
