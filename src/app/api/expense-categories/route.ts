import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/expense-categories  -> list all expense categories (for the Type dropdown)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const categories = await db.expenseCategory.findMany({
    orderBy: [{ createdAt: 'asc' }],
  })
  return NextResponse.json({ categories })
}

// POST /api/expense-categories  { name, itemType }  (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    const itemType = body?.itemType === 'SUPPLIER' ? 'SUPPLIER' : 'TYPE'

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const category = await db.expenseCategory.create({
      data: { name, itemType },
    })
    return NextResponse.json({ category }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
