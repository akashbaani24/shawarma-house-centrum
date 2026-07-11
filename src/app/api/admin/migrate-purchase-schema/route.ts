import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// POST /api/admin/migrate-purchase-schema
// Admin-only. One-time migration: creates the Purchase + PurchaseItem
// tables in Turso if they don't already exist. Idempotent — uses
// "CREATE TABLE IF NOT EXISTS" so it's safe to call multiple times.
//
// This endpoint exists because the local dev environment doesn't have
// the TURSO_AUTH_TOKEN in .env, so we can't run `prisma db push` from
// here directly. The Vercel deployment has the token, so the app can
// run this migration itself via an authenticated admin request.

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS "Purchase" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "supplierId" TEXT NOT NULL,
      "purchaseDate" TEXT NOT NULL,
      "invoiceNumber" TEXT,
      "note" TEXT,
      "createdById" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "PurchaseItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "purchaseId" TEXT NOT NULL,
      "itemName" TEXT NOT NULL,
      "qty" REAL NOT NULL,
      "uom" TEXT NOT NULL,
      "unitPrice" REAL NOT NULL,
      "total" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "Purchase_supplierId_idx" ON "Purchase"("supplierId")`,
    `CREATE INDEX IF NOT EXISTS "Purchase_purchaseDate_idx" ON "Purchase"("purchaseDate")`,
    `CREATE INDEX IF NOT EXISTS "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId")`,
  ]

  const results: { statement: string; ok: boolean; error?: string }[] = []

  for (const sql of statements) {
    try {
      await libsql.execute({ sql, args: [] })
      results.push({ statement: sql.slice(0, 80) + '...', ok: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      // "table already exists" is fine — IF NOT EXISTS handles it, but
      // some Turso versions still throw. Treat as success.
      if (msg.includes('already exists')) {
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
      ? 'Purchase + PurchaseItem tables created (or already existed).'
      : 'Some statements failed — see results.',
    results,
  })
}
