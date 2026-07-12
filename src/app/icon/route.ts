import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /icon
// Serves the business logo as a browser favicon.
//
// Next.js App Router convention: any file/route named `icon` (or `icon.ts`)
// in the `app/` directory is automatically used as the favicon. We use a
// dynamic route so the favicon always reflects the current logo stored in
// the BusinessProfile table — when an admin updates the logo via Settings,
// the favicon updates too (after browser cache expires).
//
// Implementation: we fetch the BusinessProfile.logoUrl from the database,
// then proxy the image bytes through this route. This avoids CORS issues
// and ensures the favicon works even if the logo is hosted on a domain
// that doesn't allow cross-origin requests.
//
// Caching: 1 hour (3600 seconds) — browsers will refetch after that.

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  try {
    const profile = await db.businessProfile.findFirst()
    const logoUrl = profile?.logoUrl

    if (!logoUrl) {
      // No logo set — return 204 No Content. The browser will fall back
      // to its default favicon (or no favicon). Better than a 404.
      return new NextResponse(null, { status: 204 })
    }

    // Fetch the image bytes from the remote URL
    const imgRes = await fetch(logoUrl, { cache: 'no-store' })
    if (!imgRes.ok) {
      return new NextResponse(null, { status: 204 })
    }

    const contentType = imgRes.headers.get('content-type') || 'image/png'
    const arrayBuffer = await imgRes.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch {
    // On any error, return 204 so the browser doesn't show a broken icon
    return new NextResponse(null, { status: 204 })
  }
}
