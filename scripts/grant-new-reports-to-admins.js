// Grant the 5 new report rights to all ADMIN users so they can see them
// immediately after deployment.

const { createClient } = require('@libsql/client')

const TURSO_URL =
  process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('libsql://')
    ? process.env.DATABASE_URL
    : 'libsql://sh-akash9090.aws-ap-south-1.turso.io'
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN || undefined,
})

const NEW_RIGHTS = [
  'monthly-summary',
  'supplier-due',
  'payment-history',
  'deposit-report',
  'expense-comparison',
]

async function run() {
  console.log('Connecting to:', TURSO_URL)

  const admins = await client.execute({
    sql: "SELECT id, email, name, rights FROM User WHERE role = 'ADMIN'",
    args: [],
  })
  console.log(`Found ${admins.rows.length} admin user(s)`)

  let updated = 0
  for (const row of admins.rows) {
    const id = String(row.id)
    const email = String(row.email)
    const name = row.name ? String(row.name) : '(no name)'
    let rights
    try {
      rights = JSON.parse(String(row.rights || '[]'))
    } catch {
      rights = []
    }
    let added = 0
    for (const r of NEW_RIGHTS) {
      if (!rights.includes(r)) {
        rights.push(r)
        added++
      }
    }
    if (added > 0) {
      const rightsJson = JSON.stringify(rights)
      await client.execute({
        sql: "UPDATE User SET rights = ? WHERE id = ?",
        args: [rightsJson, id],
      })
      console.log(`  ✓ Added ${added} new right(s) to: ${name} <${email}>`)
      updated++
    } else {
      console.log(`  - Already has all new rights: ${name} <${email}>`)
    }
  }
  console.log(`\nDone. Updated ${updated} admin user(s).`)
}

run().catch((e) => { console.error(e); process.exit(1) })
