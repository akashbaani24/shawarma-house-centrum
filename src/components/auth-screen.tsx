'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Wallet, LogIn, UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AuthScreen() {
  const router = useRouter()

  // login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // register state
  const [regName, setRegName] = useState('')
  const [regBusiness, setRegBusiness] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword) {
      toast.error('Please enter email and password')
      return
    }
    setLoginLoading(true)
    try {
      const res = await signIn('credentials', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
        redirect: false,
      })
      if (!res || res.error) {
        toast.error('Invalid email or password')
        return
      }
      toast.success('Logged in!')
      router.refresh()
    } catch {
      toast.error('Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regEmail.trim() || !regPassword) {
      toast.error('Please fill all required fields')
      return
    }
    if (regPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setRegLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          name: regName.trim(),
          businessName: regBusiness.trim() || 'Daily Report',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Registration failed')
        return
      }
      // Auto-login after register
      const signRes = await signIn('credentials', {
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        redirect: false,
      })
      if (!signRes || signRes.error) {
        toast.success('Account created. Please sign in.')
        return
      }
      toast.success('Account created & logged in!')
      router.refresh()
    } catch {
      toast.error('Registration failed')
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-600 text-white grid place-items-center shadow-lg shadow-emerald-600/20">
              <Wallet className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Daily Cash Report</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Track your daily receipts, payments, sales & deposits
              </p>
            </div>
          </div>

          <Card className="shadow-xl border-neutral-200 dark:border-neutral-800">
            <CardHeader className="pb-2">
              <Tabs defaultValue="login">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="login" className="gap-1.5">
                    <LogIn className="h-4 w-4" /> Sign In
                  </TabsTrigger>
                  <TabsTrigger value="register" className="gap-1.5">
                    <UserPlus className="h-4 w-4" /> Register
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-4">
                  <CardTitle className="text-base mb-4">Welcome back</CardTitle>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="login-email" className="mb-1.5 block">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="login-password" className="mb-1.5 block">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loginLoading}>
                      {loginLoading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</>
                      ) : (
                        <><LogIn className="h-4 w-4 mr-2" /> Sign In</>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="mt-4">
                  <CardTitle className="text-base mb-4">Create your account</CardTitle>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <Label htmlFor="reg-business" className="mb-1.5 block">Business Name</Label>
                      <Input
                        id="reg-business"
                        type="text"
                        placeholder="e.g. SH_Centrum"
                        value={regBusiness}
                        onChange={(e) => setRegBusiness(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reg-name" className="mb-1.5 block">Your Name (optional)</Label>
                      <Input
                        id="reg-name"
                        type="text"
                        placeholder="Your name"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reg-email" className="mb-1.5 block">Email</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="reg-password" className="mb-1.5 block">Password (min 6 chars)</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={regLoading}>
                      {regLoading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account...</>
                      ) : (
                        <><UserPlus className="h-4 w-4 mr-2" /> Create Account</>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardHeader>
            <CardContent />
          </Card>

          <p className="text-center text-xs text-neutral-400">
            Your data is private and saved per account.
          </p>
        </div>
      </main>
    </div>
  )
}
