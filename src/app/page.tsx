import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AuthScreen from '@/components/auth-screen'
import AppShell from '@/components/app-shell'

export default async function Home() {
  const session = await getServerSession(authOptions)

  // If no session or stale session (user no longer in DB), show auth screen
  if (!session?.user?.id) {
    return <AuthScreen />
  }

  return (
    <AppShell
      user={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
        businessName: session.user.businessName ?? 'Daily Report',
        role: session.user.role ?? 'USER',
        rights: session.user.rights ?? [],
      }}
    />
  )
}
