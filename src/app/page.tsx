import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AuthScreen from '@/components/auth-screen'
import Dashboard from '@/components/dashboard'

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return <AuthScreen />
  }

  return (
    <Dashboard
      user={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
        businessName: session.user.businessName ?? 'Daily Report',
      }}
    />
  )
}
