'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Landmark, Plus, Trash2, Loader2, Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface BankAccountItem {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
  branch: string | null
  isActive: boolean
}

export default function BankAccountsView() {
  const [accounts, setAccounts] = useState<BankAccountItem[]>([])
  const [loading, setLoading] = useState(true)

  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [branch, setBranch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // edit form
  const [editingAccount, setEditingAccount] = useState<BankAccountItem | null>(null)
  const [editBankName, setEditBankName] = useState('')
  const [editAccountName, setEditAccountName] = useState('')
  const [editAccountNumber, setEditAccountNumber] = useState('')
  const [editBranch, setEditBranch] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bank-accounts', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setAccounts(d.bankAccounts)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      toast.error('Bank name, account name and number are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          branch: branch.trim(),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success(`Bank account "${bankName.trim()}" added`)
      setBankName('')
      setAccountName('')
      setAccountNumber('')
      setBranch('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (acct: BankAccountItem) => {
    if (!confirm(`Delete bank account "${acct.bankName} - ${acct.accountName}"?`)) return
    try {
      const res = await fetch(`/api/bank-accounts/${acct.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d?.error || 'Failed')
      }
      toast.success('Bank account deleted')
      setAccounts((cur) => cur.filter((a) => a.id !== acct.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const toggleActive = async (acct: BankAccountItem) => {
    try {
      const res = await fetch(`/api/bank-accounts/${acct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !acct.isActive }),
      })
      if (!res.ok) throw new Error('Failed')
      setAccounts((cur) =>
        cur.map((a) => (a.id === acct.id ? { ...a, isActive: !a.isActive } : a)),
      )
    } catch {
      toast.error('Failed to update')
    }
  }

  const openEditDialog = (acct: BankAccountItem) => {
    setEditingAccount(acct)
    setEditBankName(acct.bankName)
    setEditAccountName(acct.accountName)
    setEditAccountNumber(acct.accountNumber)
    setEditBranch(acct.branch || '')
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAccount) return
    if (!editBankName.trim() || !editAccountName.trim() || !editAccountNumber.trim()) {
      toast.error('Bank name, account name and number are required')
      return
    }
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/bank-accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: editBankName.trim(),
          accountName: editAccountName.trim(),
          accountNumber: editAccountNumber.trim(),
          branch: editBranch.trim(),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('Bank account updated')
      setEditingAccount(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Landmark className="h-6 w-6" /> Bank Accounts
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Add bank/mobile accounts for bank-related income &amp; expense entries
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Bank Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="bank-name" className="mb-1.5 block">Bank Name</Label>
                <Input
                  id="bank-name"
                  placeholder="e.g. EBL, City Bank, bKash"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="acct-name" className="mb-1.5 block">Account Name</Label>
                <Input
                  id="acct-name"
                  placeholder="e.g. Eventrum Main"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="acct-number" className="mb-1.5 block">Account Number</Label>
                <Input
                  id="acct-number"
                  placeholder="e.g. 1234567890 / 017XXXXXXX"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="branch" className="mb-1.5 block">Branch (optional)</Label>
                <Input
                  id="branch"
                  placeholder="e.g. Dhanmondi"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Add Account</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Accounts ({accounts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                No bank accounts yet. Add one using the form.
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs">Bank</TableHead>
                      <TableHead className="h-8 text-xs">Account Name</TableHead>
                      <TableHead className="h-8 text-xs">Number</TableHead>
                      <TableHead className="h-8 text-xs">Status</TableHead>
                      <TableHead className="h-8 w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((acct) => (
                      <TableRow key={acct.id} className="group">
                        <TableCell className="py-2 text-xs font-medium">{acct.bankName}</TableCell>
                        <TableCell className="py-2 text-xs">{acct.accountName}</TableCell>
                        <TableCell className="py-2 text-xs font-mono text-neutral-500">
                          {acct.accountNumber}
                        </TableCell>
                        <TableCell className="py-2">
                          <button onClick={() => toggleActive(acct)}>
                            <Badge
                              variant="secondary"
                              className={`cursor-pointer ${
                                acct.isActive
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                  : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
                              }`}
                            >
                              {acct.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-neutral-400 hover:text-sky-600 opacity-0 group-hover:opacity-100"
                              onClick={() => openEditDialog(acct)}
                              aria-label="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"
                              onClick={() => handleDelete(acct)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Bank Account Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bank Account — {editingAccount?.bankName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Bank Name</Label>
              <Input value={editBankName} onChange={(e) => setEditBankName(e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5 block">Account Name</Label>
              <Input value={editAccountName} onChange={(e) => setEditAccountName(e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5 block">Account Number</Label>
              <Input value={editAccountNumber} onChange={(e) => setEditAccountNumber(e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5 block">Branch (optional)</Label>
              <Input value={editBranch} onChange={(e) => setEditBranch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingAccount(null)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={editSubmitting}>
                {editSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
