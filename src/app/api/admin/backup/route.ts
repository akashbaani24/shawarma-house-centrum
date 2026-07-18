import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/admin/backup
// Admin-only. Returns a complete JSON dump of every table in the database.
// Used for creating backups. The response is a single JSON object with
// each table name as a key and an array of rows as the value.
//
// Tables exported:
//   - User (passwords EXCLUDED for security — only email, name, role, rights, businessName)
//   - BankAccount
//   - EntryType
//   - Entry (with all relations resolved to IDs)
//   - OpeningBalance
//   - Denomination
//   - BusinessProfile
//   - Supplier
//   - SupplierBill
//   - ExpenseCategory
//   - Purchase
//   - PurchaseItem
//
// Also includes:
//   - _meta: { exportedAt, tableCount, rowCount, prismaSchema }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    // Run all SELECT queries in parallel for speed
    const [
      usersRes, bankAccountsRes, entryTypesRes, entriesRes,
      openingBalancesRes, denominationsRes, businessProfileRes,
      suppliersRes, supplierBillsRes, expenseCategoriesRes,
      purchasesRes, purchaseItemsRes,
    ] = await Promise.all([
      libsql.execute({
        sql: `SELECT id, email, name, "businessName", role, rights, "createdAt", "updatedAt" FROM "User"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "createdById", "bankName", "accountName", "accountNumber", branch, "isActive", "createdAt", "updatedAt" FROM "BankAccount"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "createdById", name, kind, "createdAt" FROM "EntryType"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "createdById", "typeId", kind, category, amount, note, date,
                     "paymentMethod", source, "bankAccountId", "expenseCategoryId",
                     "supplierId", "createdAt"
              FROM "Entry"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "createdById", date, amount, note, "createdAt", "updatedAt" FROM "OpeningBalance"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "createdById", date, denomination, count, "createdAt" FROM "Denomination"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "logoUrl", "updatedAt" FROM "BusinessProfile"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, name, phone, address, note, "createdAt", "updatedAt" FROM "Supplier"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "supplierId", "billDate", "billNumber", "billAmount", "paidAmount",
                     note, "createdById", "createdAt"
              FROM "SupplierBill"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, name, "itemType", "createdAt" FROM "ExpenseCategory"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "supplierId", "purchaseDate", "invoiceNumber", note,
                     "createdById", "createdAt", "updatedAt"
              FROM "Purchase"`,
        args: [],
      }),
      libsql.execute({
        sql: `SELECT id, "purchaseId", "itemName", qty, uom, "unitPrice", total, "createdAt"
              FROM "PurchaseItem"`,
        args: [],
      }),
    ])

    const dump = {
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.email,
        tableCount: 12,
        schemaVersion: 'prisma-6.19',
        note: 'Complete database backup. Passwords are excluded for security. To restore, use the SQL INSERT statements or re-create via the API.',
      },
      tables: {
        User: usersRes.rows,
        BankAccount: bankAccountsRes.rows,
        EntryType: entryTypesRes.rows,
        Entry: entriesRes.rows,
        OpeningBalance: openingBalancesRes.rows,
        Denomination: denominationsRes.rows,
        BusinessProfile: businessProfileRes.rows,
        Supplier: suppliersRes.rows,
        SupplierBill: supplierBillsRes.rows,
        ExpenseCategory: expenseCategoriesRes.rows,
        Purchase: purchasesRes.rows,
        PurchaseItem: purchaseItemsRes.rows,
      },
    }

    // Compute row counts
    const counts: Record<string, number> = {}
    for (const [name, rows] of Object.entries(dump.tables)) {
      counts[name] = (rows as unknown[]).length
    }
    dump._meta.rowCounts = counts
    dump._meta.totalRows = Object.values(counts).reduce((s, n) => s + n, 0)

    return NextResponse.json(dump, {
      headers: {
        'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
