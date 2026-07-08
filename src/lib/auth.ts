import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

function parseRights(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password ?? ''
        if (!email || !password) return null

        const user = await db.user.findUnique({ where: { email } })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.password)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.businessName,
          businessName: user.businessName,
          role: (user.role as 'ADMIN' | 'USER') ?? 'USER',
          rights: parseRights(user.rights),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id
        token.businessName = (user as { businessName?: string }).businessName ?? 'Daily Report'
        token.role = (user as { role?: 'ADMIN' | 'USER' }).role ?? 'USER'
        token.rights = (user as { rights?: string[] }).rights ?? []
      }
      return token
    },
    async session({ session, token }) {
      // Verify the user still exists in the DB (handles stale sessions after DB reset).
      // Wrapped in try-catch: if the DB is unreachable (e.g. missing env vars on
      // Vercel), we degrade gracefully instead of crashing the whole page.
      if (token.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id },
            select: { id: true, role: true, rights: true, businessName: true, name: true, email: true },
          })
          if (!dbUser) {
            // User no longer exists — return an empty session to force re-login
            return { ...session, user: undefined as unknown as typeof session.user }
          }
          // Refresh role/rights/businessName from DB in case they changed
          if (session.user) {
            ;(session.user as { id?: string }).id = dbUser.id
            ;(session.user as { businessName?: string }).businessName = dbUser.businessName
            ;(session.user as { role?: 'ADMIN' | 'USER' }).role =
              (dbUser.role as 'ADMIN' | 'USER') ?? 'USER'
            ;(session.user as { rights?: string[] }).rights = parseRights(dbUser.rights)
            ;(session.user as { email?: string }).email = dbUser.email
            ;(session.user as { name?: string | null }).name = dbUser.name
          }
        } catch {
          // DB unreachable — return the session as-is (token data still valid)
          // This prevents a 500 crash; the user may see stale data until DB is fixed.
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
