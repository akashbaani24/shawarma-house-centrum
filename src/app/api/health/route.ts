import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

// GET /api/health  -> diagnostics: env vars + DB reachability
export async function GET() {
  const dbUrl = process.env.DATABASE_URL
  const envStatus = {
    DATABASE_URL: dbUrl ? `set (${dbUrl.slice(0, 30)}...)` : 'MISSING',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'set' : 'MISSING',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'set' : 'MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'set' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV ?? 'undefined',
  }

  // Test 1: direct libsql client (bypasses Prisma entirely)
  let directStatus: { ok: boolean; error?: string; userCount?: number } = { ok: false }
  try {
    if (dbUrl && dbUrl.startsWith('libsql://')) {
      const client = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN })
      const r = await client.execute('SELECT COUNT(*) as n FROM "User"')
      directStatus = { ok: true, userCount: Number(r.rows[0].n) }
    } else {
      directStatus = { ok: false, error: `DATABASE_URL is "${dbUrl}" (not libsql://)` }
    }
  } catch (e) {
    directStatus = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // Test 2: Prisma client with libsql adapter
  let prismaStatus: { ok: boolean; error?: string; userCount?: number } = { ok: false }
  try {
    const { db } = await import('@/lib/db')
    const count = await db.user.count()
    prismaStatus = { ok: true, userCount: count }
  } catch (e) {
    prismaStatus = { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e) }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: envStatus,
    directLibsql: directStatus,
    prisma: prismaStatus,
  })
}
