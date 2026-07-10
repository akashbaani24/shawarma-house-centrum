import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/migrate/rename-vendor-to-supplier
// One-time admin-only migration: renames "Vendor Bill" → "Supplier Bill"
// across EntryType, Entry.category, and ExpenseCategory.name.
// Idempotent — safe to call multiple times.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const results: Record<string, number> = {}

  try {
    const r1 = await db.$executeRawUnsafe(
      "UPDATE EntryType SET name = 'Supplier Bill' WHERE LOWER(name) = 'vendor bill'",
    )
    results.EntryType = r1
  } catch (e) {
    results.EntryTypeError = String(e)
  }

  try {
    const r2 = await db.$executeRawUnsafe(
      "UPDATE Entry SET category = 'Supplier Bill' WHERE LOWER(category) = 'vendor bill'",
    )
    results.Entry = r2
  } catch (e) {
    results.EntryError = String(e)
  }

  try {
    const r3 = await db.$executeRawUnsafe(
      "UPDATE ExpenseCategory SET name = 'Supplier Bill' WHERE LOWER(name) = 'vendor bill'",
    )
    results.ExpenseCategory = r3
  } catch (e) {
    results.ExpenseCategoryError = String(e)
  }

  return NextResponse.json({
    ok: true,
    message: 'Rename complete. All "Vendor Bill" rows are now "Supplier Bill".',
    rowsUpdated: results,
  })
}
