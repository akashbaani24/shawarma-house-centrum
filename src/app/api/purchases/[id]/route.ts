import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// GET /api/purchases/[id]  — fetch a single purchase with its items
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: 'asc' } },
      creator: { select: { name: true, email: true } },
    },
  })
  if (!purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  }
  return NextResponse.json({ purchase })
}

// DELETE /api/purchases/[id]  — admin only. Cascade-deletes all items.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required to delete' }, { status: 403 })
  }
  try {
    const { id } = await params
    await db.purchase.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
