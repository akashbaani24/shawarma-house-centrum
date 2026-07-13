import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient, type Client } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  libsql: Client | undefined
}

// Get or create the raw libsql client (for fast direct queries that bypass Prisma)
// Using in-memory cache for repeated queries within the same request lifecycle.
function getLibsql(): Client {
  if (!globalForPrisma.libsql) {
    const url =
      process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('libsql://')
        ? process.env.DATABASE_URL
        : 'libsql://sh-akash9090.aws-ap-south-1.turso.io'
    const authToken = process.env.TURSO_AUTH_TOKEN
    globalForPrisma.libsql = createClient({
      url,
      authToken,
    })
  }
  return globalForPrisma.libsql
}

// Export the raw libsql client for direct fast queries
export const libsql = getLibsql()

function createPrismaClient(): PrismaClient {
  const url =
    process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('libsql://')
      ? process.env.DATABASE_URL
      : 'libsql://sh-akash9090.aws-ap-south-1.turso.io'
  const authToken = process.env.TURSO_AUTH_TOKEN
  const adapter = new PrismaLibSQL({ url, authToken })
  return new PrismaClient({ adapter })
}

// Lazy initialization via Proxy — prevents build-time failures
function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb()
    const value = Reflect.get(client, prop as keyof PrismaClient)
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value
  },
}) as PrismaClient

// ============ Tiny in-process cache for rarely-changing data ============
// Used for BusinessProfile.logoUrl (max 1 row, changes only when admin
// updates Settings) and similar slow-changing lookups. Cache TTL = 5 min.
// This avoids hitting the DB on every single report API call.

interface CacheEntry<T> { value: T; expiresAt: number }
const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

export async function cached<T>(
  key: string,
  ttlMs: number = CACHE_TTL_MS,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value
  }
  const value = await loader()
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}

// Convenience: get the business logo URL with caching.
// Use this instead of `db.businessProfile.findFirst()` in hot paths.
export async function getBusinessLogoUrl(): Promise<string | null> {
  return cached('businessProfile:logoUrl', CACHE_TTL_MS, async () => {
    try {
      const res = await libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1')
      return (res.rows[0] as { logoUrl: string | null })?.logoUrl ?? null
    } catch {
      return null
    }
  })
}

// Call this to invalidate the cache when an admin updates the logo
// (e.g. from POST /api/business-profile).
export function invalidateBusinessProfileCache(): void {
  cache.delete('businessProfile:logoUrl')
}
