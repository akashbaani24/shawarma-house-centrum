import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/public-logo  -> { logoUrl, businessName }
// Public endpoint (no auth) — used by the login page to show the company logo
// before the user is authenticated. Returns minimal info only.
export async function GET() {
  try {
    const profile = await db.businessProfile.findFirst()
    // Get business name from any user (they all share the same businessName)
    const user = await db.user.findFirst({
      select: { businessName: true },
    })
    return NextResponse.json({
      logoUrl: profile?.logoUrl ?? null,
      businessName: user?.businessName ?? 'Daily Report',
    })
  } catch {
    return NextResponse.json({ logoUrl: null, businessName: 'Daily Report' })
  }
}
