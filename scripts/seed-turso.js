// Seed script: creates the first admin user + default entry types on Turso.
// Run with: set -a && source .env && set +a && node scripts/seed-turso.js
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
const client = createClient({ url, authToken })

const ADMIN_EMAIL = 'admin@eventrum.com'
const ADMIN_PASSWORD = 'admin123'
const ADMIN_NAME = 'Hasan Admin'
const BUSINESS_NAME = 'Shawarma House : Centrum Branch'

const DEFAULT_TYPES = [
  { name: 'Salary', kind: 'INCOME' },
  { name: 'Business', kind: 'INCOME' },
  { name: 'Freelance', kind: 'INCOME' },
  { name: 'Sales - Cash', kind: 'INCOME' },
  { name: 'Sales - Bkash', kind: 'INCOME' },
  { name: 'Sales - Card', kind: 'INCOME' },
  { name: 'Received from Partner', kind: 'INCOME' },
  { name: 'Miscellaneous Income', kind: 'INCOME' },
  { name: 'Vendor Bill', kind: 'EXPENSE' },
  { name: 'Out Purchase', kind: 'EXPENSE' },
  { name: 'Conveyance', kind: 'EXPENSE' },
  { name: 'Delivery Charge', kind: 'EXPENSE' },
  { name: 'Food', kind: 'EXPENSE' },
  { name: 'Rent', kind: 'EXPENSE' },
  { name: 'Utilities', kind: 'EXPENSE' },
  { name: 'Mobile Recharge', kind: 'EXPENSE' },
  { name: 'Office Expense', kind: 'EXPENSE' },
  { name: 'Entertainment', kind: 'EXPENSE' },
  { name: 'Payment to Partner', kind: 'EXPENSE' },
  { name: 'Bank Deposit', kind: 'EXPENSE' },
  { name: 'Other Expense', kind: 'EXPENSE' },
]

const ALL_RIGHTS = [
  'dashboard', 'income', 'expense', 'types', 'bank-accounts', 'opening', 'report',
]

async function main() {
  // Check if admin already exists
  const existing = await client.execute({
    sql: 'SELECT id FROM "User" WHERE email = ?',
    args: [ADMIN_EMAIL],
  })
  if (existing.rows.length > 0) {
    console.log('Admin user already exists, skipping seed.')
    return
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const userId = randomUUID()
  const now = new Date().toISOString()

  // Create admin user
  await client.execute({
    sql: `INSERT INTO "User" ("id", "email", "name", "businessName", "password", "role", "rights", "createdAt", "updatedAt")
          VALUES (?, ?, ?, ?, ?, 'ADMIN', ?, ?, ?)`,
    args: [userId, ADMIN_EMAIL, ADMIN_NAME, BUSINESS_NAME, hashed, JSON.stringify(ALL_RIGHTS), now, now],
  })
  console.log('✓ Created admin user:', ADMIN_EMAIL)

  // Create default types
  for (const t of DEFAULT_TYPES) {
    await client.execute({
      sql: `INSERT INTO "EntryType" ("id", "createdById", "name", "kind", "createdAt")
            VALUES (?, ?, ?, ?, ?)`,
      args: [randomUUID(), userId, t.name, t.kind, now],
    })
  }
  console.log(`✓ Created ${DEFAULT_TYPES.length} default entry types`)
  console.log('\n✅ Seed complete.')
  console.log('Login:', ADMIN_EMAIL, '/', ADMIN_PASSWORD)
}

main().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
