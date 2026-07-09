import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient, type Client } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  libsql: Client | undefined
}

// Get or create the raw libsql client (for fast direct queries that bypass Prisma)
function getLibsql(): Client {
  if (!globalForPrisma.libsql) {
    const url =
      process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('libsql://')
        ? process.env.DATABASE_URL
        : 'libsql://sh-akash9090.aws-ap-south-1.turso.io'
    const authToken = process.env.TURSO_AUTH_TOKEN
    globalForPrisma.libsql = createClient({ url, authToken })
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
