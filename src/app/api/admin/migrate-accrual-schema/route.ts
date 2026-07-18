import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// POST /api/admin/migrate-accrual-schema
// Admin-only. One-time migration: adds the accrual-basis columns to the
// Entry table + creates the Customer table. Idempotent.
//
// Changes:
//   1. Entry: add dueAmount (FLOAT DEFAULT 0)
//   2. Entry: add paymentDate (TEXT NULL)
//   3. Entry: add customerId (TEXT NULL, FK → Customer)
//   4. Entry: add indexes on customerId + dueAmount
//   5. Create Customer table
//   6. Update paymentMethod to allow 'CREDIT' value (no schema change
//      needed — it's just a string column, but documented here)
//
// After migration, the system supports accrual-basis accounting:
//   - Supplier bills: full billAmount counts as expense (not just paidAmount)
//   - Credit sales: recorded as income immediately, dueAmount tracks
//     what's still owed to us
//   - Accounts Receivable report: customers with dueAmount > 0
//   - Accounts Payable report: suppliers with unpaid bills

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const statements = [
    // 1. Add columns to Entry (IF NOT EXISTS via try/catch)
    `ALTER TABLE "Entry" ADD COLUMN "dueAmount" REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE "Entry" ADD COLUMN "paymentDate" TEXT`,
    `ALTER TABLE "Entry" ADD COLUMN "customerId" TEXT`,

    // 2. Create Customer table
    `CREATE TABLE IF NOT EXISTS "Customer" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "createdById" TEXT,
      "name" TEXT NOT NULL,
      "phone" TEXT,
      "address" TEXT,
      "note" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Customer_name_key" UNIQUE ("name")
    )`,

    // 3. Add FK from Entry.customerId → Customer.id
    // (SQLite doesn't support ADD CONSTRAINT, so we skip this — the
    // application layer enforces the relationship)

    // 4. Add indexes
    `CREATE INDEX IF NOT EXISTS "Entry_customerId_idx" ON "Entry"("customerId")`,
    `CREATE INDEX IF NOT EXISTS "Entry_dueAmount_idx" ON "Entry"("dueAmount")`,
    `CREATE INDEX IF NOT EXISTS "Customer_createdById_idx" ON "Customer"("createdById")`,
  ]

  const results: { statement: string; ok: boolean; error?: string }[] = []

  for (const sql of statements) {
    try {
      await libsql.execute({ sql, args: [] })
      results.push({ statement: sql.slice(0, 80) + '...', ok: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      // "duplicate column name" = column already exists → OK
      // "table Customer already exists" = table exists → OK
      if (msg.includes('duplicate column name') || msg.includes('already exists')) {
        results.push({ statement: sql.slice(0, 80) + '...', ok: true })
      } else {
        results.push({ statement: sql.slice(0, 80) + '...', ok: false, error: msg })
      }
    }
  }

  const allOk = results.every((r) => r.ok)
  return NextResponse.json({
    ok: allOk,
    message: allOk
      ? 'Accrual schema migration complete. Entry table now has dueAmount, paymentDate, customerId. Customer table created.'
      : 'Some statements failed — see results.',
    results,
  })
}
