import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ============ Purchase API ============
//
// GET /api/purchases?from=&to=&supplierId=all
//   Returns purchases in a date range, optionally filtered by supplier.
//   Each purchase includes its line items.
//
// POST /api/purchases
//   Creates a new purchase with one or more line items.
//   Body: { supplierId, purchaseDate, invoiceNumber?, note?, items: [{ itemName, qty, uom, unitPrice }] }
//   The 'total' on each item is computed server-side as qty × unitPrice.

function isValidDate(s: string | null): s is string {
  if (!s) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const supplierId = searchParams.get('supplierId')

  // If dates are provided, validate them
  if (from && !isValidDate(from)) {
    return NextResponse.json({ error: 'Invalid from date' }, { status: 400 })
  }
  if (to && !isValidDate(to)) {
    return NextResponse.json({ error: 'Invalid to date' }, { status: 400 })
  }

  // Build the where clause
  const where: { purchaseDate?: { gte: string; lte: string }; supplierId?: string } = {}
  if (from || to) {
    where.purchaseDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    }
  }
  if (supplierId && supplierId !== 'all') {
    where.supplierId = supplierId
  }

  const [purchases, suppliers] = await Promise.all([
    db.purchase.findMany({
      where,
      orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplier: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' } },
        creator: { select: { name: true, email: true } },
      },
    }),
    db.supplier.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  // Compute grand total across all returned purchases
  const grandTotal = purchases.reduce(
    (sum, p) => sum + p.items.reduce((s, it) => s + it.total, 0),
    0,
  )

  return NextResponse.json({
    purchases,
    suppliers,
    grandTotal,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const supplierId = String(body?.supplierId ?? '').trim()
    const purchaseDate = String(body?.purchaseDate ?? '').trim()
    const invoiceNumber = body?.invoiceNumber ? String(body.invoiceNumber).trim() : null
    const note = body?.note ? String(body.note).trim() : null
    const items = Array.isArray(body?.items) ? body.items : []

    // Validate
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier is required' }, { status: 400 })
    }
    if (!isValidDate(purchaseDate)) {
      return NextResponse.json({ error: 'Valid purchase date is required (YYYY-MM-DD)' }, { status: 400 })
    }
    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
    }

    // Validate supplier exists
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Validate + normalize items
    const normalizedItems: { itemName: string; qty: number; uom: string; unitPrice: number; total: number }[] = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const itemName = String(it?.itemName ?? '').trim()
      const qty = typeof it?.qty === 'number' ? it.qty : parseFloat(String(it?.qty ?? ''))
      const uom = String(it?.uom ?? '').trim()
      const unitPrice = typeof it?.unitPrice === 'number' ? it.unitPrice : parseFloat(String(it?.unitPrice ?? ''))

      if (!itemName) {
        return NextResponse.json({ error: `Item ${i + 1}: item name is required` }, { status: 400 })
      }
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: `Item ${i + 1}: valid quantity is required` }, { status: 400 })
      }
      if (!uom) {
        return NextResponse.json({ error: `Item ${i + 1}: unit of measure is required` }, { status: 400 })
      }
      if (isNaN(unitPrice) || unitPrice < 0) {
        return NextResponse.json({ error: `Item ${i + 1}: valid unit price is required` }, { status: 400 })
      }

      normalizedItems.push({
        itemName,
        qty: Math.round(qty * 1000) / 1000,
        uom,
        unitPrice: Math.round(unitPrice * 100) / 100,
        total: Math.round(qty * unitPrice * 100) / 100,
      })
    }

    // Create the purchase with all items in a single transaction
    const purchase = await db.purchase.create({
      data: {
        supplierId,
        purchaseDate,
        invoiceNumber,
        note,
        createdById: session.user.id,
        items: {
          create: normalizedItems,
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    })

    return NextResponse.json({ purchase }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
