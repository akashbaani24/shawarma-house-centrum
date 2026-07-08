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
      // Use token data directly (set at login) — avoids a DB query on every
      // request, which was the #1 performance bottleneck. The token already
      // contains id, role, rights, businessName, name, email.
      if (session.user) {
        ;(session.user as { id?: string }).id = token.id as string
        ;(session.user as { businessName?: string }).businessName =
          (token.businessName as string) ?? 'Daily Report'
        ;(session.user as { role?: 'ADMIN' | 'USER' }).role =
          (token.role as 'ADMIN' | 'USER') ?? 'USER'
        ;(session.user as { rights?: string[] }).rights =
          (token.rights as string[]) ?? []
        ;(session.user as { email?: string }).email = token.email as string
        ;(session.user as { name?: string | null }).name = (token.name as string | null) ?? null
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
