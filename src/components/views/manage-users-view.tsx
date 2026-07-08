'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users as UsersIcon,
  Plus,
  Trash2,
  Loader2,
  Shield,
  User as UserIcon,
  Mail,
} from 'lucide-react'
import { toast } from 'sonner'

const ALL_RIGHTS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'income', label: 'Income Entry' },
  { key: 'expense', label: 'Expense Entry' },
  { key: 'types', label: 'Manage Types' },
  { key: 'opening', label: 'Opening Balance' },
  { key: 'report', label: 'Daily Report' },
]

interface UserItem {
  id: string
  email: string
  name: string | null
  businessName: string
  role: string
  rights: string[]
  createdAt: string
}

export default function ManageUsersView({
  currentUser,
}: {
  currentUser: { id: string; email: string; role: string }
}) {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)

  // create form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER')
  const [rights, setRights] = useState<string[]>(['dashboard', 'report'])
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setUsers(d.users)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleRight = (key: string) => {
    setRights((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key],
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('Email and password are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          rights: role === 'ADMIN' ? ALL_RIGHTS.map((r) => r.key) : rights,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success(`User "${name || email}" created`)
      setName('')
      setEmail('')
      setPassword('')
      setRole('USER')
      setRights(['dashboard', 'report'])
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (u: UserItem) => {
    if (u.id === currentUser.id) {
      toast.error('You cannot delete your own account')
      return
    }
    if (!confirm(`Delete user "${u.name || u.email}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('User deleted')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UsersIcon className="h-6 w-6" /> Manage Users
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Create staff accounts and assign access rights
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New User</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="u-name" className="mb-1.5 block">Name</Label>
                  <Input
                    id="u-name"
                    placeholder="Staff name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="u-email" className="mb-1.5 block">Email</Label>
                  <Input
                    id="u-email"
                    type="email"
                    placeholder="staff@shop.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="u-password" className="mb-1.5 block">Password</Label>
                  <Input
                    id="u-password"
                    type="password"
                    placeholder="min 6 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as 'USER' | 'ADMIN')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">User (staff)</SelectItem>
                      <SelectItem value="ADMIN">Admin (full access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {role === 'USER' && (
                <div>
                  <Label className="mb-2 block">Access Rights</Label>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                    {ALL_RIGHTS.map((r) => (
                      <label
                        key={r.key}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={rights.includes(r.key)}
                          onCheckedChange={() => toggleRight(r.key)}
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1.5">
                    Admin role automatically gets all rights.
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Create User</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" />
              </div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs">User</TableHead>
                      <TableHead className="h-8 text-xs">Role</TableHead>
                      <TableHead className="h-8 text-xs">Rights</TableHead>
                      <TableHead className="h-8 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const isSelf = u.id === currentUser.id
                      const isAdmin = u.role === 'ADMIN'
                      return (
                        <TableRow key={u.id} className="group">
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              {isAdmin ? (
                                <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
                              ) : (
                                <UserIcon className="h-4 w-4 text-neutral-400 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate flex items-center gap-1">
                                  {u.name || u.email}
                                  {isSelf && (
                                    <span className="text-[10px] text-neutral-400">(you)</span>
                                  )}
                                </div>
                                <div className="text-xs text-neutral-500 flex items-center gap-1 truncate">
                                  <Mail className="h-3 w-3" />
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge
                              variant="secondary"
                              className={
                                isAdmin
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                              }
                            >
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {isAdmin ? (
                              <span className="text-xs text-neutral-500">All access</span>
                            ) : (
                              <span className="text-xs text-neutral-500">
                                {u.rights.length} / {ALL_RIGHTS.length} sections
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"
                                onClick={() => handleDelete(u)}
                                aria-label="Delete user"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
