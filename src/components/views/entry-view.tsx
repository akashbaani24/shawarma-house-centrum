'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Trash2,
  Loader2,
  Tags,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CURRENCY = '৳'

interface TypeItem {
  id: string
  name: string
  kind: string
}

interface EntryItem {
  id: string
  kind: string
  category: string
  amount: number
  note: string | null
  date: string
  paymentMethod?: string
  bankAccount?: { bankName: string; accountName: string; accountNumber: string } | null
}

interface BankAccountItem {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
  isActive: boolean
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK', label: 'Bank' },
  { value: 'MOBILE_BANK', label: 'Mobile Bank (bKash/Nagad)' },
]

export default function EntryView({
  kind,
  source = 'BRANCH',
  title,
  accentColor,
}: {
  kind: 'INCOME' | 'EXPENSE' | 'INVEST'
  source?: 'BRANCH' | 'OFFICE'
  title?: string
  accentColor?: 'emerald' | 'rose' | 'amber'
}) {
  const isIncome = kind === 'INCOME'
  const accent = accentColor ?? (isIncome ? 'emerald' : 'rose')

  const [types, setTypes] = useState<TypeItem[]>([])
  const [entries, setEntries] = useState<EntryItem[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)

  const [typeId, setTypeId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayStr())
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const loadTypes = useCallback(async () => {
    setLoadingTypes(true)
    try {
      const res = await fetch(`/api/types?kind=${kind}`, { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) {
        setTypes(d.types)
        if (d.types.length > 0 && !typeId) setTypeId(d.types[0].id)
      }
    } catch {
      // ignore
    } finally {
      setLoadingTypes(false)
    }
  }, [kind, typeId])

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true)
    try {
      const res = await fetch(`/api/entries?kind=${kind}&source=${source}`, { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setEntries(d.entries)
    } catch {
      // ignore
    } finally {
      setLoadingEntries(false)
    }
  }, [kind, source])

  const loadBankAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/bank-accounts', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setBankAccounts(d.bankAccounts)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadTypes()
    loadEntries()
    loadBankAccounts()
  }, [loadTypes, loadEntries, loadBankAccounts])

  // Reset bank account when method changes away from BANK/MOBILE_BANK
  useEffect(() => {
    if (paymentMethod !== 'BANK' && paymentMethod !== 'MOBILE_BANK') {
      setBankAccountId('')
    }
  }, [paymentMethod])

  const needsBankAccount = paymentMethod === 'BANK' || paymentMethod === 'MOBILE_BANK'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const selectedType = types.find((t) => t.id === typeId)
    if (!selectedType) {
      toast.error('Please select a type. Create one in Manage Types if none exist.')
      return
    }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          typeId: selectedType.id,
          category: selectedType.name,
          amount: amt,
          note,
          date,
          paymentMethod,
          source,
          bankAccountId: needsBankAccount ? bankAccountId : undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed to save')
      toast.success(`${kind === 'INVEST' ? 'Investment' : isIncome ? 'Income' : 'Expense'} of ${CURRENCY}${fmt(amt)} added`)
      setAmount('')
      setNote('')
      loadEntries()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const prev = entries
    setEntries((cur) => cur.filter((e) => e.id !== id))
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Deleted')
    } catch {
      setEntries(prev)
      toast.error('Failed to delete')
    }
  }

  const total = entries.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          {kind === 'INVEST' ? (
            <TrendingUp className="h-6 w-6 text-amber-600" />
          ) : isIncome ? (
            <ArrowUpCircle className="h-6 w-6 text-emerald-600" />
          ) : (
            <ArrowDownCircle className="h-6 w-6 text-rose-600" />
          )}
          {title ?? `${isIncome ? 'Income' : 'Expense'} Entry`}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Record a new {kind === 'INVEST' ? 'investment' : isIncome ? 'income' : 'expense'} transaction
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add {isIncome ? 'Income' : 'Expense'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Type / Category</Label>
                {loadingTypes ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading types...
                  </div>
                ) : types.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-center">
                    <Tags className="h-6 w-6 mx-auto text-neutral-400 mb-2" />
                    <p className="text-sm text-neutral-500 mb-2">No {isIncome ? 'income' : 'expense'} types yet.</p>
                    <p className="text-xs text-neutral-400">Go to Manage Types to create one.</p>
                  </div>
                ) : (
                  <Select value={typeId} onValueChange={setTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="amount" className="mb-1.5 block">Amount ({CURRENCY})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="date" className="mb-1.5 block">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label className="mb-1.5 block">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsBankAccount && (
                <div>
                  <Label className="mb-1.5 block">
                    {paymentMethod === 'MOBILE_BANK' ? 'Mobile Account' : 'Bank Account'}
                  </Label>
                  {bankAccounts.filter((a) => a.isActive).length === 0 ? (
                    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-center">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        No active bank accounts. Please add one in Bank Accounts first.
                      </p>
                    </div>
                  ) : (
                    <Select value={bankAccountId} onValueChange={setBankAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${paymentMethod === 'MOBILE_BANK' ? 'mobile account' : 'bank account'}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.filter((a) => a.isActive).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.bankName} — {a.accountName} ({a.accountNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="note" className="mb-1.5 block">Note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="e.g. Lunch at office"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || types.length === 0}
                variant={kind === 'INVEST' ? 'default' : isIncome ? 'default' : 'destructive'}
                style={kind === 'INVEST' ? { backgroundColor: '#d97706' } : undefined}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Add {kind === 'INVEST' ? 'Investment' : isIncome ? 'Income' : 'Expense'}</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent {isIncome ? 'Incomes' : 'Expenses'}</CardTitle>
              <span className={`text-sm font-semibold ${isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {CURRENCY}{fmt(total)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingEntries ? (
              <div className="py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" />
              </div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                No {isIncome ? 'income' : 'expense'} entries yet.
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                          {isIncome ? '+' : '−'} {CURRENCY}{fmt(e.amount)}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        <span className="font-medium">{e.category}</span>
                        <span className="text-neutral-400"> · {e.date}</span>
                        {e.paymentMethod && e.paymentMethod !== 'CASH' && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400 font-medium">
                            {e.paymentMethod === 'MOBILE_BANK' ? 'Mobile' : e.paymentMethod === 'CARD' ? 'Card' : 'Bank'}
                            {e.bankAccount ? `: ${e.bankAccount.bankName}` : ''}
                          </span>
                        )}
                      </div>
                      {e.note && <div className="text-xs text-neutral-400 mt-0.5 truncate">{e.note}</div>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDelete(e.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
