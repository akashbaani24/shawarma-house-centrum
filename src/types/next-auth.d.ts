import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      businessName: string
      role: 'ADMIN' | 'USER'
      rights: string[]
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    businessName: string
    role: 'ADMIN' | 'USER'
    rights: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    businessName: string
    role: 'ADMIN' | 'USER'
    rights: string[]
  }
}
