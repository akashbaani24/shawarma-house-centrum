import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  // DATABASE_URL holds the Turso libsql:// URL for the actual connection.
  // (The Prisma schema uses a literal file: URL for engine validation, so
  // DATABASE_URL is free to be a libsql:// URL for the adapter.)
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  // Turso / libsql connection — use the PrismaLibSql adapter
  if (url.startsWith('libsql://') || url.startsWith('file:libsql:')) {
    const authToken = process.env.TURSO_AUTH_TOKEN
    // v6 adapter API: pass a config object { url, authToken }
    const adapter = new PrismaLibSQL({ url, authToken })
    return new PrismaClient({ adapter })
  }

  // Fallback: local SQLite file (for local dev without Turso)
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  })
}

// Lazy initialization via Proxy — prevents build-time failures when env vars
// aren't available during `next build`'s page-data collection phase.
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
