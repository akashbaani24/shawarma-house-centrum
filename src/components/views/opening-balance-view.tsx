'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Wallet, Save, Loader2, Trash2, Info } from 'lucide-react'
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

export default function OpeningBalanceView() {
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [existing, setExisting] = useState<{ id: string; date: string; amount: number; note: string | null } | null>(null)
  const [allBalances, setAllBalances] = useState<{ id: string; date: string; amount: number; note: string | null }[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const loadForDate = useCallback(async (d: string) => {
    try {
      const res = await fetch(`/api/opening-balance?date=${encodeURIComponent(d)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.openingBalance) {
        setExisting(data.openingBalance)
        setAmount(String(data.openingBalance.amount))
        setNote(data.openingBalance.note || '')
      } else {
        setExisting(null)
        setAmount('')
        setNote('')
      }
    } catch {
      // ignore
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/opening-balance', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setAllBalances(d.openingBalances || [])
    } catch {
      // ignore
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadForDate(date)
  }, [date, loadForDate])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt < 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/opening-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, amount: amt, note }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('Opening balance saved')
      setExisting(d.openingBalance)
      loadAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (d: string) => {
    if (!confirm('Delete opening balance for this date?')) return
    try {
      const res = await fetch(`/api/opening-balance?date=${encodeURIComponent(d)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Deleted')
      if (d === date) {
        setExisting(null)
        setAmount('')
        setNote('')
      }
      loadAll()
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-6 w-6" /> Opening Balance
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Set the opening cash balance for a specific date (e.g. your business start date)
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30 p-4 flex gap-3">
        <Info className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-sm text-sky-800 dark:text-sky-300 space-y-1">
          <p className="font-medium">How opening balance works</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-sky-700 dark:text-sky-400">
            <li>Set an explicit opening balance for your business start date (or any date you want to override).</li>
            <li>If no explicit opening balance is set for a date, the system automatically uses the previous day&apos;s closing balance.</li>
            <li>Today&apos;s closing balance = Opening + Income − Expense. It becomes tomorrow&apos;s opening automatically.</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {existing ? 'Edit' : 'Set'} Opening Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="ob-date" className="mb-1.5 block">Date</Label>
                <Input
                  id="ob-date"
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ob-amount" className="mb-1.5 block">Amount ({CURRENCY})</Label>
                <Input
                  id="ob-amount"
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
                <Label htmlFor="ob-note" className="mb-1.5 block">Note (optional)</Label>
                <Textarea
                  id="ob-note"
                  placeholder="e.g. Business start capital"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Save Opening Balance</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List of all opening balances */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Opening Balances</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingList ? (
              <div className="py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" />
              </div>
            ) : allBalances.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                No explicit opening balances set yet.
                <br />
                <span className="text-xs">The system will auto-carry from previous days.</span>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs">Date</TableHead>
                      <TableHead className="h-8 text-xs text-right">Amount</TableHead>
                      <TableHead className="h-8 text-xs">Note</TableHead>
                      <TableHead className="h-8 w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allBalances.map((ob) => (
                      <TableRow key={ob.id} className="group">
                        <TableCell className="py-2 text-xs font-medium">{ob.date}</TableCell>
                        <TableCell className="py-2 text-xs text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {CURRENCY}{fmt(ob.amount)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-neutral-500 max-w-[120px] truncate">
                          {ob.note || '—'}
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-neutral-300 hover:text-rose-600 opacity-60 hover:opacity-100"
                            onClick={() => handleDelete(ob.date)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
    </div>
  )
}
