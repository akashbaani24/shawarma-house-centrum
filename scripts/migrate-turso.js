// Migration script: creates all tables on Turso (libsql) based on the Prisma schema.
// Run with: node /home/z/my-project/scripts/migrate-turso.js
import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !url.startsWith('libsql://')) {
  console.error('DATABASE_URL must be a libsql:// URL')
  process.exit(1)
}

const client = createClient({ url, authToken })

const DDL = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "businessName" TEXT NOT NULL DEFAULT 'Daily Report',
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "rights" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_email_key" UNIQUE ("email")
  )`,
  `CREATE TABLE IF NOT EXISTS "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "branch" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "BankAccount_createdById_idx" ON "BankAccount"("createdById")`,
  `CREATE TABLE IF NOT EXISTS "EntryType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL,
    CONSTRAINT "EntryType_name_kind_key" UNIQUE ("name", "kind")
  )`,
  `CREATE INDEX IF NOT EXISTS "EntryType_createdById_kind_idx" ON "EntryType"("createdById", "kind")`,
  `CREATE TABLE IF NOT EXISTS "Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT,
    "typeId" TEXT,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "date" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "bankAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL,
    CONSTRAINT "Entry_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "Entry_date_idx" ON "Entry"("date")`,
  `CREATE INDEX IF NOT EXISTS "Entry_kind_date_idx" ON "Entry"("kind", "date")`,
  `CREATE INDEX IF NOT EXISTS "Entry_createdById_idx" ON "Entry"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "Entry_paymentMethod_idx" ON "Entry"("paymentMethod")`,
  `CREATE TABLE IF NOT EXISTS "OpeningBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT,
    "date" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpeningBalance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL,
    CONSTRAINT "OpeningBalance_date_key" UNIQUE ("date")
  )`,
  `CREATE TABLE IF NOT EXISTS "Denomination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT,
    "date" TEXT NOT NULL,
    "denomination" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Denomination_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL,
    CONSTRAINT "Denomination_date_denomination_key" UNIQUE ("date", "denomination")
  )`,
  `CREATE INDEX IF NOT EXISTS "Denomination_date_idx" ON "Denomination"("date")`,
]

async function main() {
  console.log('Connecting to Turso:', url)
  for (const stmt of DDL) {
    try {
      await client.execute(stmt)
      const preview = stmt.slice(0, 60).replace(/\s+/g, ' ')
      console.log('✓', preview, '...')
    } catch (e) {
      console.error('✗ Error:', e.message)
      console.error('  SQL:', stmt.slice(0, 120))
      throw e
    }
  }
  console.log('\n✅ Migration complete — all tables created on Turso.')
}

main().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
