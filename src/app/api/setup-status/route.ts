import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/setup-status  -> { hasAdmin: boolean }
// Used by the auth screen to decide whether to show Register tab.
export async function GET() {
  const adminCount = await db.user.count({ where: { role: 'ADMIN' } })
  return NextResponse.json({ hasAdmin: adminCount > 0 })
}
