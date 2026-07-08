import { NextResponse } from 'next/server'

// GET /api/health  -> diagnostics: which env vars are set + DB reachable?
// This endpoint never throws — useful for debugging Vercel config.
export async function GET() {
  const envStatus = {
    DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'MISSING',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'set' : 'MISSING',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'set' : 'MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'set' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV ?? 'undefined',
  }

  // Try a DB ping
  let dbStatus: { ok: boolean; error?: string; userCount?: number } = { ok: false }
  try {
    const { db } = await import('@/lib/db')
    const count = await db.user.count()
    dbStatus = { ok: true, userCount: count }
  } catch (e) {
    dbStatus = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: envStatus,
    db: dbStatus,
  })
}
