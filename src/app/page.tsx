'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Printer,
  Trash2,
  Wallet,
  Plus,
  Scale,
} from 'lucide-react'
import { toast } from 'sonner'

type EntryType = 'INCOME' | 'EXPENSE'

interface Entry {
  id: string
  type: EntryType
  amount: number
  category: string
  note: string | null
  date: string
  createdAt: string
}

const INCOME_CATEGORIES = [
  'Salary',
  'Business',
  'Freelance',
  'Bonus',
  'Investment',
  'Gift',
  'Other Income',
]
const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Rent',
  'Utilities',
  'Shopping',
  'Health',
  'Education',
  'Entertainment',
  'Other Expense',
]

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const CURRENCY = '৳'

export default function Home() {
  const [selectedDate, setSelectedDate] = useState<string>(todayStr())
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  // form state
  const [formType, setFormType] = useState<EntryType>('EXPENSE')
  const [formAmount, setFormAmount] = useState<string>('')
  const [formCategory, setFormCategory] = useState<string>('Food')
  const [formNote, setFormNote] = useState<string>('')
  const [formDate, setFormDate] = useState<string>(todayStr())
  const [submitting, setSubmitting] = useState<boolean>(false)

  const categories = useMemo(
    () => (formType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    [formType],
  )

  // when switching type, reset category to first valid
  useEffect(() => {
    setFormCategory(categories[0])
  }, [categories])

  const loadEntries = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/entries?date=${encodeURIComponent(date)}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load')
      setEntries(data.entries as Entry[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEntries(selectedDate)
  }, [selectedDate, loadEntries])

  // keep form date in sync with selected report date for convenience
  useEffect(() => {
    setFormDate(selectedDate)
  }, [selectedDate])

  const incomeEntries = useMemo(
    () => entries.filter((e) => e.type === 'INCOME'),
    [entries],
  )
  const expenseEntries = useMemo(
    () => entries.filter((e) => e.type === 'EXPENSE'),
    [entries],
  )
  const totalIncome = useMemo(
    () => incomeEntries.reduce((s, e) => s + e.amount, 0),
    [incomeEntries],
  )
  const totalExpense = useMemo(
    () => expenseEntries.reduce((s, e) => s + e.amount, 0),
    [expenseEntries],
  )
  const balance = totalIncome - totalExpense

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(formAmount)
    if (!formAmount || isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          amount: amt,
          category: formCategory,
          note: formNote,
          date: formDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save')
      toast.success(
        `${formType === 'INCOME' ? 'Income' : 'Expense'} of ${CURRENCY}${formatMoney(amt)} added`,
      )
      setFormAmount('')
      setFormNote('')
      // refresh report for whichever date is relevant
      if (formDate === selectedDate) {
        loadEntries(selectedDate)
      } else {
        setSelectedDate(formDate)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const prev = entries
    setEntries((cur) => cur.filter((e) => e.id !== id))
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to delete')
      toast.success('Entry deleted')
    } catch (e) {
      setEntries(prev)
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const handlePrev = () => setSelectedDate((d) => shiftDate(d, -1))
  const handleNext = () => setSelectedDate((d) => shiftDate(d, 1))
  const handleToday = () => setSelectedDate(todayStr())

  const isToday = selectedDate === todayStr()

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <header className="border-b bg-white dark:bg-neutral-900 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Daily Expense & Income</h1>
              <p className="text-xs text-neutral-500">Track and report your money, day by day</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:inline-flex">
            <Printer className="h-4 w-4 mr-1" /> Print Report
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Total Income
              </CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {CURRENCY}{formatMoney(totalIncome)}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {incomeEntries.length} income {incomeEntries.length === 1 ? 'entry' : 'entries'} today
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/60 dark:bg-rose-950/30 dark:border-rose-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">
                Total Expense
              </CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                {CURRENCY}{formatMoney(totalExpense)}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {expenseEntries.length} expense {expenseEntries.length === 1 ? 'entry' : 'entries'} today
              </p>
            </CardContent>
          </Card>

          <Card className={balance >= 0
            ? 'border-sky-200 bg-sky-50/60 dark:bg-sky-950/30 dark:border-sky-900'
            : 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900'}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className={balance >= 0
                ? 'text-sm font-medium text-sky-700 dark:text-sky-400'
                : 'text-sm font-medium text-amber-700 dark:text-amber-400'}>
                Net Balance
              </CardTitle>
              <Scale className={balance >= 0 ? 'h-4 w-4 text-sky-600' : 'h-4 w-4 text-amber-600'} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${balance >= 0
                ? 'text-sky-700 dark:text-sky-400'
                : 'text-amber-700 dark:text-amber-400'}`}>
                {balance < 0 ? '-' : ''}{CURRENCY}{formatMoney(Math.abs(balance))}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {balance >= 0 ? 'Surplus' : 'Deficit'} for the day
              </p>
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Add entry form */}
          <section className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" /> Add Entry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Type</Label>
                    <Tabs value={formType} onValueChange={(v) => setFormType(v as EntryType)}>
                      <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="EXPENSE" className="data-[state=active]:text-rose-600">
                          <ArrowDownCircle className="h-4 w-4 mr-1" /> Expense
                        </TabsTrigger>
                        <TabsTrigger value="INCOME" className="data-[state=active]:text-emerald-600">
                          <ArrowUpCircle className="h-4 w-4 mr-1" /> Income
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div>
                    <Label htmlFor="amount" className="mb-1.5 block">Amount ({CURRENCY})</Label>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="category" className="mb-1.5 block">Category</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="date" className="mb-1.5 block">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="note" className="mb-1.5 block">Note (optional)</Label>
                    <Textarea
                      id="note"
                      placeholder="e.g. Lunch at office"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}
                    variant={formType === 'INCOME' ? 'default' : 'destructive'}
                  >
                    {submitting ? 'Saving...' : `Add ${formType === 'INCOME' ? 'Income' : 'Expense'}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* Daily Report */}
          <section className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-4 w-4" /> Daily Report
                    </CardTitle>
                    <p className="text-sm text-neutral-500 mt-0.5">
                      {formatLongDate(selectedDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Previous day">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={isToday ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={handleToday}
                      disabled={isToday}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleNext}
                      aria-label="Next day"
                      disabled={isToday}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className="max-w-[180px]"
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {loading ? (
                  <div className="py-12 text-center text-sm text-neutral-500">Loading...</div>
                ) : entries.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="mx-auto h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 grid place-items-center mb-3">
                      <Wallet className="h-6 w-6 text-neutral-400" />
                    </div>
                    <p className="text-sm text-neutral-500">No entries for this day.</p>
                    <p className="text-xs text-neutral-400 mt-1">Add your first income or expense using the form.</p>
                  </div>
                ) : (
                  <>
                    {/* Income section */}
                    {incomeEntries.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <ArrowUpCircle className="h-4 w-4" /> Income
                          </h3>
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {CURRENCY}{formatMoney(totalIncome)}
                          </span>
                        </div>
                        <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/50 overflow-hidden">
                          {incomeEntries.map((e, i) => (
                            <ReportRow key={e.id} entry={e} isLast={i === incomeEntries.length - 1} onDelete={handleDelete} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expense section */}
                    {expenseEntries.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                            <ArrowDownCircle className="h-4 w-4" /> Expense
                          </h3>
                          <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
                            {CURRENCY}{formatMoney(totalExpense)}
                          </span>
                        </div>
                        <div className="rounded-lg border border-rose-100 dark:border-rose-900/50 overflow-hidden">
                          {expenseEntries.map((e, i) => (
                            <ReportRow key={e.id} entry={e} isLast={i === expenseEntries.length - 1} onDelete={handleDelete} />
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Totals */}
                    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Total Income</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {CURRENCY}{formatMoney(totalIncome)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Total Expense</span>
                        <span className="font-semibold text-rose-700 dark:text-rose-400">
                          {CURRENCY}{formatMoney(totalExpense)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-base">
                        <span className="font-medium">Net Balance</span>
                        <span className={`font-bold ${balance >= 0
                          ? 'text-sky-700 dark:text-sky-400'
                          : 'text-amber-700 dark:text-amber-400'}`}>
                          {balance < 0 ? '-' : ''}{CURRENCY}{formatMoney(Math.abs(balance))}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-center text-neutral-400 pt-1">
                      Report generated for {formatLongDate(selectedDate)}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <footer className="border-t bg-white dark:bg-neutral-900 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-xs text-neutral-500 flex items-center justify-between">
          <span>Daily Expense & Income Tracker</span>
          <span>Data saved locally on this device</span>
        </div>
      </footer>
    </div>
  )
}

function ReportRow({
  entry,
  isLast,
  onDelete,
}: {
  entry: Entry
  isLast: boolean
  onDelete: (id: string) => void
}) {
  const isIncome = entry.type === 'INCOME'
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 ${isLast ? '' : 'border-b border-neutral-100 dark:border-neutral-800'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={isIncome
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'}
          >
            {entry.category}
          </Badge>
        </div>
        {entry.note ? (
          <p className="text-xs text-neutral-500 mt-1 truncate">{entry.note}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-semibold tabular-nums ${isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
          {isIncome ? '+' : '−'}{CURRENCY}{formatMoney(entry.amount)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-neutral-400 hover:text-rose-600"
          onClick={() => onDelete(entry.id)}
          aria-label="Delete entry"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
