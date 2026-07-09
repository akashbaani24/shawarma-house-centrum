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
import { Receipt, ChevronLeft, ChevronRight, Printer, Loader2, TrendingDown, Calendar, FileSpreadsheet, FileText } from 'lucide-react'
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

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CURRENCY = '৳'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK: 'Bank',
  MOBILE_BANK: 'Mobile Bank',
}

interface EntryItem {
  id: string
  category: string
  amount: number
  note: string | null
  date: string
  paymentMethod: string
  source: string
  bankAccount: { bankName: string; accountName: string; accountNumber: string } | null
  creator: { name: string | null; email: string } | null
  createdAt: string
}

interface ReportData {
  from: string
  to: string
  businessName: string
  logoUrl: string | null
  entries: EntryItem[]
  total: number
  byCategory: { category: string; amount: number }[]
  byMethod: { method: string; amount: number }[]
  bySource: { source: string; amount: number }[]
  byDate: { date: string; amount: number }[]
}

export default function ExpenseDetailsView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/expense-details?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setReport(data)
      } else {
        toast.error(data?.error || 'Failed to load')
      }
    } catch {
      toast.error('Failed to load expense details')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const handlePrevMonth = () => {
    const d = new Date(from + 'T00:00:00')
    d.setMonth(d.getMonth() - 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    setFrom(`${y}-${m}-01`)
    setTo(`${y}-${m}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`)
  }
  const handleNextMonth = () => {
    const d = new Date(from + 'T00:00:00')
    d.setMonth(d.getMonth() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    setFrom(`${y}-${m}-01`)
    setTo(`${y}-${m}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`)
  }
  const handleThisMonth = () => {
    setFrom(firstOfMonth())
    setTo(todayStr())
  }

  const fromDateDisplay = from.split('-').reverse().join('/')
  const toDateDisplay = to.split('-').reverse().join('/')

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-neutral-400" />
            <div>
              <div className="text-base font-semibold">Expense Details</div>
              <div className="text-xs text-neutral-500">
                {formatLongDate(from)} — {formatLongDate(to)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev Month
            </Button>
            <Button variant="outline" size="sm" onClick={handleThisMonth}>
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              Next Month <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div>
            <Label htmlFor="from-date" className="text-xs text-neutral-500">From</Label>
            <Input id="from-date" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-[150px]" />
          </div>
          <div>
            <Label htmlFor="to-date" className="text-xs text-neutral-500">To</Label>
            <Input id="to-date" type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-[150px]" />
          </div>
          <div className="flex gap-2 mt-5">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToExcel }) => exportToExcel({
                    businessName: report.businessName,
                    reportTitle: 'Expense Details',
                    dateRange: `${fromDateDisplay} — ${toDateDisplay}`,
                    columns: [{ header: 'Date', key: 'date' }, { header: 'Category', key: 'category' }, { header: 'Source', key: 'source' }, { header: 'Method', key: 'method' }, { header: 'Note', key: 'note' }, { header: 'Amount', key: 'amount' }],
                    rows: report.entries.map((e) => [e.date, e.category, e.source === 'OFFICE' ? 'Office' : 'Branch', e.paymentMethod, e.note || '', fmt(e.amount)]),
                    totalsRow: ['Total', '', '', '', '', fmt(report.total)],
                  }))
                }}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName,
                    reportTitle: 'Expense Details',
                    dateRange: `${fromDateDisplay} — ${toDateDisplay}`,
                    columns: [{ header: 'Date', key: 'date' }, { header: 'Category', key: 'category' }, { header: 'Source', key: 'source' }, { header: 'Method', key: 'method' }, { header: 'Note', key: 'note' }, { header: 'Amount', key: 'amount' }],
                    rows: report.entries.map((e) => [e.date, e.category, e.source === 'OFFICE' ? 'Office' : 'Branch', e.paymentMethod, e.note || '', fmt(e.amount)]),
                    totalsRow: ['Total', '', '', '', '', fmt(report.total)],
                  }))
                }}>
                  <FileText className="h-4 w-4 mr-1" /> PDF
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {loading || !report ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
            <Card className="border-rose-200 bg-rose-50/60 dark:bg-rose-950/30 dark:border-rose-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-rose-700 dark:text-rose-400">Total Expense</CardTitle>
                <TrendingDown className="h-4 w-4 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-rose-700 dark:text-rose-400">{CURRENCY}{fmt(report.total)}</div>
                <p className="text-xs text-neutral-500 mt-1">{report.entries.length} transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-neutral-500">Categories</CardTitle>
                <Receipt className="h-4 w-4 text-neutral-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{report.byCategory.length}</div>
                <p className="text-xs text-neutral-500 mt-1">distinct expense types</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-neutral-500">Days</CardTitle>
                <Calendar className="h-4 w-4 text-neutral-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{report.byDate.length}</div>
                <p className="text-xs text-neutral-500 mt-1">days with expenses</p>
              </CardContent>
            </Card>
          </div>

          {/* The report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-4 sm:p-6 print:border-black print:p-3 shadow-sm">
            {/* Header */}
            <div className="flex items-end justify-between border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black pb-2 mb-3">
              <div className="flex items-center gap-3">
                {report.logoUrl && (
                  <img src={report.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded" />
                )}
                <div className="text-xl sm:text-2xl font-bold tracking-tight">{report.businessName}</div>
              </div>
              <div className="text-xs sm:text-sm">
                <div className="text-neutral-500">Expense Details</div>
                <div className="font-semibold tabular-nums">{fromDateDisplay} — {toDateDisplay}</div>
              </div>
            </div>

            {/* Two-column: category summary + payment method summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3 mb-4">
              {/* Category summary */}
              <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:border-black">
                <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                    Summary by Category
                  </span>
                </div>
                <Table className="text-[11px]">
                  <TableHeader>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Category</TableHead>
                      <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-28">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byCategory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="py-3 px-2 text-center text-neutral-400 text-[11px]">
                          No expense entries in this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.byCategory.map((c) => (
                        <TableRow key={c.category} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                          <TableCell className="py-1 px-2">{c.category}</TableCell>
                          <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(c.amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                      <TableCell className="py-1 px-2 text-[11px] font-bold text-right">Total -</TableCell>
                      <TableCell className="py-1 px-2 text-right tabular-nums font-bold">{fmt(report.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Payment method summary */}
              <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:border-black">
                <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                    Summary by Payment Method
                  </span>
                </div>
                <Table className="text-[11px]">
                  <TableHeader>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Method</TableHead>
                      <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-28">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byMethod.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="py-3 px-2 text-center text-neutral-400 text-[11px]">
                          No data
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.byMethod.map((m) => (
                        <TableRow key={m.method} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                          <TableCell className="py-1 px-2">{METHOD_LABELS[m.method] ?? m.method}</TableCell>
                          <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(m.amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                      <TableCell className="py-1 px-2 text-[11px] font-bold text-right">Total -</TableCell>
                      <TableCell className="py-1 px-2 text-right tabular-nums font-bold">{fmt(report.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Detailed entries table */}
            <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:border-black">
              <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                  All Expense Entries
                </span>
              </div>
              <Table className="text-[11px]">
                <TableHeader>
                  <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                    <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Date</TableHead>
                    <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Category</TableHead>
                    <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Source</TableHead>
                    <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Method</TableHead>
                    <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Note</TableHead>
                    <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-28">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 px-2 text-center text-neutral-400 text-[11px]">
                        No expense entries in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.entries.map((e) => (
                      <TableRow key={e.id} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                        <TableCell className="py-1 px-2 whitespace-nowrap">{e.date.split('-').reverse().join('/')}</TableCell>
                        <TableCell className="py-1 px-2 font-medium">{e.category}</TableCell>
                        <TableCell className="py-1 px-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                            e.source === 'OFFICE'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                          }`}>
                            {e.source === 'OFFICE' ? 'Office' : 'Branch'}
                          </span>
                        </TableCell>
                        <TableCell className="py-1 px-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                            e.paymentMethod === 'CASH'
                              ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400'
                          }`}>
                            {METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod}
                            {e.bankAccount ? `: ${e.bankAccount.bankName}` : ''}
                          </span>
                        </TableCell>
                        <TableCell className="py-1 px-2 text-neutral-500 max-w-[200px] truncate">{e.note || '—'}</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                          {fmt(e.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 border-t-2 border-neutral-800 dark:border-neutral-200 print:border-black">
                    <TableCell colSpan={5} className="py-1.5 px-2 text-[11px] font-bold text-right">Grand Total -</TableCell>
                    <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">{fmt(report.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div>
                <span className="text-neutral-500">Prepared by: </span>
                <span className="font-semibold">{report.entries.length > 0 && report.entries[0].creator ? (report.entries[0].creator.name || report.entries[0].creator.email) : '—'}</span>
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
