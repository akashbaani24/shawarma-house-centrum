import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { libsql } from '@/lib/db'

// GET /api/payment-history?from=&to=&source=all
// Returns a flat list of all expense payments in the period.
// Columns shown in the report:
//   paidTo   — who was paid (supplier name if supplierId set, else category)
//   amount   — how much
//   date     — when
//   source   — which branch (BRANCH / OFFICE)
//   purpose  — what for (Entry.note, fallback to category)
//   method   — payment method (CASH/CARD/BANK/MOBILE_BANK)
//   bankName — bank account used (if any)
//   billNumber — supplier bill number (if linked)
//
// Excludes deposits (those are transfers, not real payments).
// Excludes supplier bills' separate rows — only the Entry payments are
// included (the SupplierBill.billAmount is the bill total, NOT a payment).
// `paidAmount` on SupplierBill is a separate concept; we keep this report
// purely about Entry rows to avoid double-counting.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const source = searchParams.get('source') // 'BRANCH' | 'OFFICE' | 'all'

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Valid from and to dates are required' }, { status: 400 })
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be before or equal to to' }, { status: 400 })
  }

  // Helper to identify deposits (transfers — exclude from payment history)
  function isDeposit(cat: string): boolean {
    const n = (cat || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return n.includes('deposit') || n.includes('bankaccount') || n.includes('cardsale') || n.includes('digitalwallet') || n.includes('bkashno') || n.includes('bkashmobile')
  }

  let sql = `SELECT e.id, e.category, e.amount, e.date, e.source, e.note,
                    e."paymentMethod",
                    b."bankName", b."accountNumber",
                    s.name AS "supplierName",
                    sb."billNumber" AS "supplierBillNumber",
                    u.name AS "creatorName", u.email AS "creatorEmail"
             FROM "Entry" e
             LEFT JOIN "BankAccount" b ON e."bankAccountId" = b.id
             LEFT JOIN "Supplier" s ON e."supplierId" = s.id
             LEFT JOIN "SupplierBill" sb ON sb."supplierId" = e."supplierId" AND sb."billDate" = e.date
             LEFT JOIN "User" u ON e."createdById" = u.id
             WHERE e.kind = ? AND e.date >= ? AND e.date <= ?`
  const args: (string)[] = ['EXPENSE', from, to]

  if (source && (source === 'BRANCH' || source === 'OFFICE')) {
    sql += ' AND e.source = ?'
    args.push(source)
  }
  sql += ' ORDER BY e.date DESC, e."createdAt" DESC LIMIT 500'

  try {
    const res = await libsql.execute({ sql, args })
    const rows = (res.rows as {
      id: string; category: string; amount: number; date: string; source: string
      note: string | null; paymentMethod: string
      bankName: string | null; accountNumber: string | null
      supplierName: string | null; supplierBillNumber: string | null
      creatorName: string | null; creatorEmail: string
    }[]).filter((r) => !isDeposit(r.category))

    const total = rows.reduce((s, r) => s + r.amount, 0)

    // Group by source for the summary cards
    const branchTotal = rows.filter((r) => r.source === 'BRANCH').reduce((s, r) => s + r.amount, 0)
    const officeTotal = rows.filter((r) => r.source === 'OFFICE').reduce((s, r) => s + r.amount, 0)
    const cashTotal = rows.filter((r) => r.paymentMethod === 'CASH').reduce((s, r) => s + r.amount, 0)
    const bankTotal = rows.filter((r) => r.paymentMethod === 'BANK' || r.paymentMethod === 'MOBILE_BANK' || r.paymentMethod === 'CARD').reduce((s, r) => s + r.amount, 0)

    const [logoRes] = await Promise.all([
      libsql.execute('SELECT "logoUrl" FROM "BusinessProfile" LIMIT 1'),
    ])
    const logoUrl = (logoRes.rows[0] as { logoUrl: string | null })?.logoUrl ?? null

    return NextResponse.json({
      from, to,
      businessName: session.user.businessName,
      logoUrl,
      payments: rows,
      total,
      branchTotal,
      officeTotal,
      cashTotal,
      bankTotal,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
