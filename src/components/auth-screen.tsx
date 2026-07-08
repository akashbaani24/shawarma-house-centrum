'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Wallet, LogIn, UserPlus, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export default function AuthScreen() {
  const router = useRouter()

  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null)

  // login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // register state (only shown if no admin exists yet — i.e. first setup)
  const [regName, setRegName] = useState('')
  const [regBusiness, setRegBusiness] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  useEffect(() => {
    fetch('/api/setup-status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setHasAdmin(Boolean(d.hasAdmin)))
      .catch(() => setHasAdmin(true)) // fail closed: hide registration
  }, [])

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
      const signRes = await signIn('credentials', {
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        redirect: false,
      })
      if (!signRes || signRes.error) {
        toast.success('Admin account created. Please sign in.')
        return
      }
      toast.success('Admin account created & logged in!')
      router.refresh()
    } catch {
      toast.error('Registration failed')
    } finally {
      setRegLoading(false)
    }
  }

  if (hasAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
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
                Track your daily receipts, payments, sales &amp; deposits
              </p>
            </div>
          </div>

          <Card className="shadow-xl border-neutral-200 dark:border-neutral-800">
            <CardHeader className="pb-2">
              {hasAdmin ? (
                // Login only — registration is handled by admin via Manage Users
                <div className="space-y-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LogIn className="h-4 w-4" /> Sign In
                  </CardTitle>
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
                </div>
              ) : (
                // First-time setup: register the first admin
                <Tabs defaultValue="setup">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="setup" className="gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> Setup Admin
                    </TabsTrigger>
                    <TabsTrigger value="login" className="gap-1.5">
                      <LogIn className="h-4 w-4" /> Sign In
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="setup" className="mt-4">
                    <CardTitle className="text-base mb-2">Create the admin account</CardTitle>
                    <p className="text-xs text-neutral-500 mb-4">
                      This will be the first account and will have full admin rights.
                    </p>
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <Label htmlFor="reg-business" className="mb-1.5 block">Business Name</Label>
                        <Input
                          id="reg-business"
                          type="text"
                          placeholder="e.g. Eventrum"
                          value={regBusiness}
                          onChange={(e) => setRegBusiness(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="reg-name" className="mb-1.5 block">Your Name</Label>
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
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating admin...</>
                        ) : (
                          <><ShieldCheck className="h-4 w-4 mr-2" /> Create Admin Account</>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="login" className="mt-4">
                    <CardTitle className="text-base mb-4">Sign in</CardTitle>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="login-email2" className="mb-1.5 block">Email</Label>
                        <Input
                          id="login-email2"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="login-password2" className="mb-1.5 block">Password</Label>
                        <Input
                          id="login-password2"
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
                </Tabs>
              )}
            </CardHeader>
            <CardContent />
          </Card>

          <p className="text-center text-xs text-neutral-400">
            {hasAdmin
              ? 'New users must be created by an administrator.'
              : 'This is the initial setup — create your admin account.'}
          </p>
        </div>
      </main>
    </div>
  )
}
