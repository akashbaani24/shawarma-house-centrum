import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/business-profile  -> { logoUrl }
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await db.businessProfile.findFirst()
  return NextResponse.json({ logoUrl: profile?.logoUrl ?? null })
}

// POST /api/business-profile  { logoUrl }  -> upsert (admin only)
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
    const logoUrl = body?.logoUrl ? String(body.logoUrl).trim() : null

    // Get the single profile row (create if not exists)
    let profile = await db.businessProfile.findFirst()
    if (profile) {
      profile = await db.businessProfile.update({
        where: { id: profile.id },
        data: { logoUrl },
      })
    } else {
      profile = await db.businessProfile.create({
        data: { logoUrl },
      })
    }
    return NextResponse.json({ logoUrl: profile.logoUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
