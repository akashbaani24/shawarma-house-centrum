import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/setup-status  -> { hasAdmin: boolean }
// Used by the auth screen to decide whether to show Register tab.
// Wrapped in try-catch: if DB is unreachable, assume admin exists (login mode).
export async function GET() {
  try {
    const adminCount = await db.user.count({ where: { role: 'ADMIN' } })
    return NextResponse.json({ hasAdmin: adminCount > 0 })
  } catch {
    // DB unreachable — default to login mode (hasAdmin: true) so the auth
    // screen shows the login form instead of the setup form.
    return NextResponse.json({ hasAdmin: true, dbError: true })
  }
}
