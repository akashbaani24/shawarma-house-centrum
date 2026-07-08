import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

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
        } as {
          id: string
          email: string
          name?: string | null
          businessName: string
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id
        token.businessName = (user as { businessName?: string }).businessName ?? 'Daily Report'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.id as string
        ;(session.user as { businessName?: string }).businessName =
          (token.businessName as string) ?? 'Daily Report'
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
