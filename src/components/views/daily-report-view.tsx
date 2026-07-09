'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Printer,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

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
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function fmt(n: number): string {
  if (n === 0) return ''
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CURRENCY = '৳'

interface ReportData {
  date: string
  businessName: string
  logoUrl: string | null
  preparedBy: string[]
  currentUser: string
  openingBalance: number
  openingSource: string
  openingSourceDate: string | null
  incomeEntries: { id: string; category: string; amount: number; note: string | null; paymentMethod?: string; bankAccount?: { bankName: string; accountName: string; accountNumber: string } | null }[]
  expenseEntries: { id: string; category: string; amount: number; note: string | null; paymentMethod?: string; bankAccount?: { bankName: string; accountName: string; accountNumber: string } | null }[]
  expensesEntries: { id: string; category: string; amount: number; note: string | null; paymentMethod?: string; bankAccount?: { bankName: string; accountName: string; accountNumber: string } | null }[]
  paymentsEntries: { id: string; category: string; amount: number; note: string | null; paymentMethod?: string; bankAccount?: { bankName: string; accountName: string; accountNumber: string } | null }[]
  depositsEntries: { id: string; category: string; amount: number; note: string | null; paymentMethod?: string; bankAccount?: { bankName: string; accountName: string; accountNumber: string } | null }[]
  totalIncome: number
  totalExpense: number
  totalExpenses: number
  totalPayments: number
  totalDeposits: number
  cashShortage: number
  excessCash: number
  denominations: Record<number, number>
  validDenoms: number[]
  cashInHand: number
  calculatedClosing: number
  leftTotal: number
  rightTotal: number
  difference: number
  isBalanced: boolean
}

export default function DailyReportView() {
  const [date, setDate] = useState(todayStr())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  // denomination local state (editable)
  const [denomCounts, setDenomCounts] = useState<Record<number, string>>({})
  const [denomDirty, setDenomDirty] = useState(false)
  const [savingDenom, setSavingDenom] = useState(false)

  const isToday = date === todayStr()

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/report?date=${encodeURIComponent(d)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setReport(data)
        // init denom input fields
        const counts: Record<number, string> = {}
        for (const denom of data.validDenoms) {
          const c = data.denominations[denom] ?? 0
          counts[denom] = c > 0 ? String(c) : ''
        }
        setDenomCounts(counts)
        setDenomDirty(false)
      } else {
        toast.error(data?.error || 'Failed to load report')
      }
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  const updateDenom = (denom: number, value: string) => {
    setDenomCounts((prev) => ({ ...prev, [denom]: value }))
    setDenomDirty(true)
  }

  const handleSaveDenom = async () => {
    if (!report) return
    setSavingDenom(true)
    try {
      const counts: Record<string, number> = {}
      for (const d of report.validDenoms) {
        const raw = denomCounts[d] ?? ''
        const n = parseInt(raw, 10)
        counts[String(d)] = isNaN(n) || n < 0 ? 0 : n
      }
      const res = await fetch('/api/denomination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, counts }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('Denomination saved')
      setDenomDirty(false)
      load(date) // refresh report to recompute totals
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingDenom(false)
    }
  }

  const handlePrev = () => setDate((d) => shiftDate(d, -1))
  const handleNext = () => setDate((d) => shiftDate(d, 1))
  const handleToday = () => setDate(todayStr())

  // Compute live denomination total (before save)
  const liveDenomTotal = useMemo(() => {
    if (!report) return 0
    return report.validDenoms.reduce((s, d) => {
      const raw = denomCounts[d] ?? ''
      const n = parseInt(raw, 10)
      return s + (isNaN(n) || n < 0 ? 0 : n * d)
    }, 0)
  }, [report, denomCounts])

  // Live balance check (using unsaved denomination)
  const liveLeftTotal = report ? report.openingBalance + report.totalIncome : 0
  const liveRightTotal = report ? report.totalExpense + liveDenomTotal : 0
  const liveDifference = liveLeftTotal - liveRightTotal
  const liveIsBalanced = Math.abs(liveDifference) < 0.005

  const dateDisplay = date.split('-').reverse().join('/')

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="h-4 w-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold truncate">Branch Daily Report</div>
              <div className="text-xs text-neutral-500 truncate">{formatLongDate(date)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-[130px] sm:w-[150px]"
            />
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
      </div>

      {loading || !report ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between gap-2 print:hidden flex-wrap">
            <div className="text-xs text-neutral-500">
              {denomDirty ? (
                <span className="text-amber-600 font-medium">● Unsaved</span>
              ) : (
                <span className="text-emerald-600">✓ Saved</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Print</span>
              </Button>
              <Button size="sm" onClick={handleSaveDenom} disabled={savingDenom || !denomDirty}>
                {savingDenom ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Save Denom.</span><span className="sm:hidden">Save</span></>
                )}
              </Button>
            </div>
          </div>

          {/* Balance check message (req 5) — screen only, hidden in print */}
          <div className={`rounded-lg border p-3 flex items-start gap-3 print:hidden ${
            liveIsBalanced
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
          }`}>
            {liveIsBalanced ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              {liveIsBalanced ? (
                <p className="font-medium text-emerald-800 dark:text-emerald-300">
                  ✓ উভয় পাশ মিলছে! Income side এবং Expense side এর Total Taka সমান।
                </p>
              ) : (
                <div className="space-y-0.5">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    ⚠ পাশ দুটি মিলছে না!
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Income side: {CURRENCY}{fmt(liveLeftTotal)} · Expense side: {CURRENCY}{fmt(liveRightTotal)}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    পার্থক্য: {CURRENCY}{fmt(Math.abs(liveDifference))} ({liveDifference > 0 ? 'ক্যাশ সংকট — ক্যাশ কম আছে' : 'অতিরিক্ত ক্যাশ — ক্যাশ বেশি আছে'})
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* The report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-6 print:border-black print:p-2 shadow-sm">
            {/* Header */}
            <div className="flex items-start sm:items-end justify-between gap-2 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black pb-2 mb-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {report.logoUrl && (
                  <img src={report.logoUrl} alt="Logo" className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded shrink-0" />
                )}
                <div className="text-base sm:text-2xl font-bold tracking-tight leading-tight">{report.businessName}</div>
              </div>
              <div className="text-xs sm:text-sm shrink-0">
                <span className="text-neutral-500">Date: </span>
                <span className="font-semibold tabular-nums">{dateDisplay}</span>
              </div>
            </div>

            {/* Two-column body */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3">
              {/* LEFT: Income side */}
              <div className="space-y-3">
                {/* Opening Balance */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden bg-white dark:bg-neutral-950 print:border-black">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                      Opening Balance
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableBody>
                      <TableRow className="border-neutral-100 dark:border-neutral-800/50 print:border-black">
                        <TableCell className="py-1.5 px-2 font-medium">
                          {report.openingSource === 'explicit'
                            ? 'Opening Balance (set explicitly)'
                            : report.openingSource === 'carryover'
                            ? `Carried from ${report.openingSourceDate}`
                            : 'Opening Balance'}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-semibold w-28">
                          {fmt(report.openingBalance)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Income entries */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden bg-white dark:bg-neutral-950 print:border-black">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                      Income / Receipts
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableHeader>
                      <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                        <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Particulars</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-28">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.incomeEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-3 px-2 text-center text-neutral-400 text-[11px]">
                            No income entries for this day
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.incomeEntries.map((e) => (
                          <TableRow key={e.id} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                            <TableCell className="py-1 px-2">
                              {e.category}
                              {e.paymentMethod && e.paymentMethod !== 'CASH' && (
                                <span className="text-[9px] ml-1 px-1 py-0.5 rounded bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200 print:bg-neutral-200 print:text-black font-medium">
                                  {e.paymentMethod === 'MOBILE_BANK' ? 'Mobile' : e.paymentMethod === 'CARD' ? 'Card' : 'Bank'}{e.bankAccount ? `: ${e.bankAccount.bankName} (${e.bankAccount.accountNumber})` : ''}
                                </span>
                              )}
                              {e.note ? <span className="text-neutral-600 dark:text-neutral-400 print:text-neutral-700"> · {e.note}</span> : null}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(e.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                        <TableCell className="py-1 px-2 text-[11px] font-bold text-right">Total Income -</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-bold">{fmt(report.totalIncome)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Denomination of Closing Cash */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden bg-white dark:bg-neutral-950 print:border-black">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                      Denomination of Closing Cash
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableHeader>
                      <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                        <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Denomination</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-center w-8">X</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-16">Count</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-24">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.validDenoms.map((denom) => {
                        const raw = denomCounts[denom] ?? ''
                        const n = parseInt(raw, 10)
                        const count = isNaN(n) || n < 0 ? 0 : n
                        return (
                          <TableRow key={denom} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                            <TableCell className="py-1 px-2 font-medium">{denom}</TableCell>
                            <TableCell className="py-1 px-2 text-center text-neutral-400">X</TableCell>
                            <TableCell className="py-1 px-2">
                              <Input
                                type="number"
                                min="0"
                                value={raw}
                                onChange={(e) => updateDenom(denom, e.target.value)}
                                placeholder="0"
                                className="h-6 text-right text-[11px] px-1 border-0 bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-900 tabular-nums print:hidden"
                              />
                              <span className="hidden print:block text-right tabular-nums">{count || ''}</span>
                            </TableCell>
                            <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(count * denom)}</TableCell>
                          </TableRow>
                        )
                      })}
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                        <TableCell colSpan={3} className="py-1 px-2 text-[11px] font-bold text-right">
                          Total Cash in Hand -
                        </TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-bold">{fmt(liveDenomTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* RIGHT: Expense side — 4 sub-sections */}
              <div className="space-y-3">
                {/* Sub-section: Expenses */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden bg-white dark:bg-neutral-950 print:border-black">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                      Expenses
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableBody>
                      {report.expensesEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-2 px-2 text-center text-neutral-400 text-[11px]">
                            No expense entries
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.expensesEntries.map((e) => (
                          <TableRow key={e.id} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                            <TableCell className="py-1 px-2">
                              {e.category}
                              {e.paymentMethod && e.paymentMethod !== 'CASH' && (
                                <span className="text-[9px] ml-1 px-1 py-0.5 rounded bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200 print:bg-neutral-200 print:text-black font-medium">
                                  {e.paymentMethod === 'MOBILE_BANK' ? 'Mobile' : e.paymentMethod === 'CARD' ? 'Card' : 'Bank'}{e.bankAccount ? `: ${e.bankAccount.bankName} (${e.bankAccount.accountNumber})` : ''}
                                </span>
                              )}
                              {e.note ? <span className="text-neutral-600 dark:text-neutral-400 print:text-neutral-700"> · {e.note}</span> : null}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(e.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t border-neutral-200 dark:border-neutral-700 print:border-black">
                        <TableCell className="py-1 px-2 text-[11px] font-semibold text-right">Total Expenses -</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-semibold">{fmt(report.totalExpenses)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Sub-section: Payments */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden bg-white dark:bg-neutral-950 print:border-black">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                      Payments
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableBody>
                      {report.paymentsEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-2 px-2 text-center text-neutral-400 text-[11px]">
                            No payment entries
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.paymentsEntries.map((e) => (
                          <TableRow key={e.id} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                            <TableCell className="py-1 px-2">
                              {e.category}
                              {e.paymentMethod && e.paymentMethod !== 'CASH' && (
                                <span className="text-[9px] ml-1 px-1 py-0.5 rounded bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200 print:bg-neutral-200 print:text-black font-medium">
                                  {e.paymentMethod === 'MOBILE_BANK' ? 'Mobile' : e.paymentMethod === 'CARD' ? 'Card' : 'Bank'}{e.bankAccount ? `: ${e.bankAccount.bankName} (${e.bankAccount.accountNumber})` : ''}
                                </span>
                              )}
                              {e.note ? <span className="text-neutral-600 dark:text-neutral-400 print:text-neutral-700"> · {e.note}</span> : null}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(e.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t border-neutral-200 dark:border-neutral-700 print:border-black">
                        <TableCell className="py-1 px-2 text-[11px] font-semibold text-right">Total Payments -</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-semibold">{fmt(report.totalPayments)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Sub-section: Deposits */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden bg-white dark:bg-neutral-950 print:border-black">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                      Deposits
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableBody>
                      {report.depositsEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-2 px-2 text-center text-neutral-400 text-[11px]">
                            No deposit entries
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.depositsEntries.map((e) => (
                          <TableRow key={e.id} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                            <TableCell className="py-1 px-2">
                              {e.category}
                              {e.paymentMethod && e.paymentMethod !== 'CASH' && (
                                <span className="text-[9px] ml-1 px-1 py-0.5 rounded bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200 print:bg-neutral-200 print:text-black font-medium">
                                  {e.paymentMethod === 'MOBILE_BANK' ? 'Mobile' : e.paymentMethod === 'CARD' ? 'Card' : 'Bank'}{e.bankAccount ? `: ${e.bankAccount.bankName} (${e.bankAccount.accountNumber})` : ''}
                                </span>
                              )}
                              {e.note ? <span className="text-neutral-600 dark:text-neutral-400 print:text-neutral-700"> · {e.note}</span> : null}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(e.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t border-neutral-200 dark:border-neutral-700 print:border-black">
                        <TableCell className="py-1 px-2 text-[11px] font-semibold text-right">Total Deposits -</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-semibold">{fmt(report.totalDeposits)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Calculated closing (info) — visible in print */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden bg-neutral-50 dark:bg-neutral-900/30 print:border-black">
                  <div className="px-2 py-1 border-b border-neutral-200 dark:border-neutral-800 print:border-black">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 flex items-center gap-1 print:text-black">
                      <Info className="h-3 w-3" /> Calculated Closing (auto)
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableBody>
                      <TableRow className="border-neutral-100 dark:border-neutral-800/50">
                        <TableCell className="py-1.5 px-2 font-medium">
                          Opening + Income − Expense
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-semibold w-28">
                          {fmt(report.calculatedClosing)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Totals row */}
            {/* Detailed totals row */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3 mt-3">
              {/* Left totals: Income side */}
              <div className="border-2 border-neutral-800 dark:border-neutral-200 print:border-black rounded-sm overflow-hidden">
                <Table className="text-[11px]">
                  <TableBody>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1 px-2 font-medium">Opening Balance</TableCell>
                      <TableCell className="py-1 px-2 text-right tabular-nums w-28">{fmt(report.openingBalance)}</TableCell>
                    </TableRow>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1 px-2 font-medium">+ Total Income</TableCell>
                      <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(report.totalIncome)}</TableCell>
                    </TableRow>
                    {report.excessCash > 0 && (
                      <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                        <TableCell className="py-1 px-2 font-medium">+ Excess Cash</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(report.excessCash)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 border-t-2 border-neutral-800 dark:border-neutral-200 print:border-black">
                      <TableCell className="py-1.5 px-2 font-bold">Income Side Total -</TableCell>
                      <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">
                        {fmt(liveLeftTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Right totals: Expense side breakdown */}
              <div className="border-2 border-neutral-800 dark:border-neutral-200 print:border-black rounded-sm overflow-hidden">
                <Table className="text-[11px]">
                  <TableBody>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1 px-2 font-medium">Total Expenses</TableCell>
                      <TableCell className="py-1 px-2 text-right tabular-nums w-28">{fmt(report.totalExpenses)}</TableCell>
                    </TableRow>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1 px-2 font-medium">+ Total Payments</TableCell>
                      <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(report.totalPayments)}</TableCell>
                    </TableRow>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1 px-2 font-medium">+ Total Deposits</TableCell>
                      <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(report.totalDeposits)}</TableCell>
                    </TableRow>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1 px-2 font-medium">+ Cash in Hand</TableCell>
                      <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(liveDenomTotal)}</TableCell>
                    </TableRow>
                    {report.cashShortage > 0 && (
                      <TableRow className="border-amber-300 dark:border-amber-800 print:border-black bg-amber-50 dark:bg-amber-950/20">
                        <TableCell className="py-1 px-2 font-medium text-amber-700 dark:text-amber-400">+ Cash Shortage</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{fmt(report.cashShortage)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 border-t-2 border-neutral-800 dark:border-neutral-200 print:border-black">
                      <TableCell className="py-1.5 px-2 font-bold">Expense Side Total -</TableCell>
                      <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">
                        {fmt(liveRightTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Balance status inside report (printable) */}
            <div className="mt-3 text-center text-[11px]">
              {liveIsBalanced ? (
                <span className="text-emerald-600 font-medium">
                  ✓ সঠিক — উভয় পাশ মিলছে ({CURRENCY}{fmt(liveLeftTotal)})
                </span>
              ) : (
                <span className="text-amber-600 font-medium">
                  ⚠ পার্থক্য: {CURRENCY}{fmt(Math.abs(liveDifference))} ({liveDifference > 0 ? 'ক্যাশ সংকট' : 'অতিরিক্ত ক্যাশ'})
                </span>
              )}
            </div>

            {/* Next day opening info */}
            <div className="mt-3 text-center text-[10px] text-neutral-400 print:hidden">
              আগামী দিনের Opening Balance হবে: {CURRENCY}{fmt(report.calculatedClosing)} (আজকের Calculated Closing)
            </div>

            {/* Approval / signature line — visible in print */}
            <div className="mt-4 text-center text-[12px] font-medium text-emerald-700 dark:text-emerald-400 print:text-emerald-700">
              সই --- অনুমোদিত ({CURRENCY}{fmt(liveLeftTotal)})
            </div>

            {/* Prepared by footer (always visible, printable) */}
            <div className="mt-3 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div>
                <span className="text-neutral-500">Prepared by: </span>
                <span className="font-semibold">
                  {report.preparedBy.length > 0
                    ? report.preparedBy.join(', ')
                    : report.currentUser}
                </span>
              </div>
              <div className="text-neutral-400 text-[10px]">
                Generated on {new Date().toLocaleString('en-GB')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

