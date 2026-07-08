import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  // Turso/libsql connection URL (e.g. libsql://host.turso.io)
  const tursoUrl = process.env.TURSO_DATABASE_URL
  // Prisma sqlite datasource URL (must be a file: URL — used by the library
  // engine for validation even when the PrismaLibSql adapter handles the real
  // connection).
  const prismaUrl = process.env.DATABASE_URL ?? 'file:./prisma-local.db'

  if (tursoUrl && (tursoUrl.startsWith('libsql://') || tursoUrl.startsWith('file:libsql:'))) {
    const authToken = process.env.TURSO_AUTH_TOKEN
    // v6 adapter API: pass a config object { url, authToken }, NOT a pre-built client.
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken })
    return new PrismaClient({ adapter })
  }

  // Fallback: local SQLite file (no Turso configured)
  return new PrismaClient({
    datasources: { db: { url: prismaUrl } },
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
