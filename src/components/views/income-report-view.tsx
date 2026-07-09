'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePagination, PaginationControls } from '@/components/pagination'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import {
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Printer,
  Loader2,
  Calendar,
  FileSpreadsheet,
  FileText,
  Banknote,
} from 'lucide-react'
import { toast } from 'sonner'

function todayStr(): string {
  const d = new Date()
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

interface Bucket {
  key: string
  label: string
  amount: number
  count: number
}

interface ReportData {
  from: string
  to: string
  businessName: string
  logoUrl: string | null
  entries: EntryItem[]
  total: number
  buckets: Bucket[]
  byCategory: { category: string; amount: number }[]
  byDate: { date: string; amount: number }[]
}

export default function IncomeReportView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<'summary' | 'entries'>('summary')

  const filteredEntries = (report?.entries ?? []).filter((e) => {
    if (!searchText.trim()) return true
    const q = searchText.toLowerCase().trim()
    return e.category.toLowerCase().includes(q) ||
      (e.note?.toLowerCase().includes(q) ?? false) ||
      String(e.amount).includes(q) ||
      e.date.includes(q)
  })
  const filteredCount = filteredEntries.length
  const pagination = usePagination(filteredCount)
  const paginatedEntries = filteredEntries.slice(pagination.startIndex, pagination.endIndex)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/income-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setReport(data)
      } else {
        toast.error(data?.error || 'Failed to load')
      }
    } catch {
      toast.error('Failed to load income report')
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
    setTo(`${y}-${m}-${String(new Date(y, Number(m), 0).getDate()).padStart(2, '0')}`)
  }
  const handleNextMonth = () => {
    const d = new Date(from + 'T00:00:00')
    d.setMonth(d.getMonth() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    setFrom(`${y}-${m}-01`)
    setTo(`${y}-${m}-${String(new Date(y, Number(m), 0).getDate()).padStart(2, '0')}`)
  }
  const handleThisMonth = () => {
    setFrom(firstOfMonth())
    setTo(todayStr())
  }

  const fromDateDisplay = from.split('-').reverse().join('/')
  const toDateDisplay = to.split('-').reverse().join('/')

  const excelRows = report
    ? report.entries.map((e) => {
        const cash = e.paymentMethod === 'CASH' ? e.amount : 0
        const card = e.paymentMethod === 'CARD' ? e.amount : 0
        // Bkash column covers MOBILE_BANK and BANK (digital/bank transfers)
        const bkash = (e.paymentMethod === 'MOBILE_BANK' || e.paymentMethod === 'BANK') ? e.amount : 0
        return [
          e.date,
          cash ? fmt(cash) : '',
          card ? fmt(card) : '',
          bkash ? fmt(bkash) : '',
          e.note || '',
          fmt(e.amount),
        ]
      })
    : []
  const exportColumns = [
    { header: 'Date', key: 'date' },
    { header: 'Cash', key: 'cash' },
    { header: 'Card', key: 'card' },
    { header: 'Bkash', key: 'bkash' },
    { header: 'Note', key: 'note' },
    { header: 'Amount', key: 'amount' },
  ]

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <div>
              <div className="text-base font-semibold">Income Report</div>
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
                    reportTitle: 'Income Report',
                    dateRange: `${fromDateDisplay} — ${toDateDisplay}`,
                    columns: exportColumns,
                    rows: excelRows,
                    totalsRow: ['Total', '', '', '', '', fmt(report.total)],
                  }))
                }}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName,
                    reportTitle: 'Income Report',
                    dateRange: `${fromDateDisplay} — ${toDateDisplay}`,
                    columns: exportColumns,
                    rows: excelRows,
                    totalsRow: ['Total', '', '', '', '', fmt(report.total)],
                  }))
                }}>
                  <FileText className="h-4 w-4 mr-1" /> PDF
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Search box */}
        {report && report.entries.length > 0 && (
          <div className="mt-3">
            <Input
              type="text"
              placeholder="Search by category, note, amount, date..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); pagination.reset(); }}
              className="text-sm"
            />
          </div>
        )}
      </div>

      {loading || !report ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          {/* Summary cards — compact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
            <Card className="border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900 py-2">
              <CardContent className="py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Total Income</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{CURRENCY}{fmt(report.total)}</div>
                <p className="text-[11px] text-neutral-500">{report.entries.length} transactions</p>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">Income Types</span>
                  <Banknote className="h-4 w-4 text-neutral-400" />
                </div>
                <div className="text-lg font-bold mt-0.5">{report.byCategory.length}</div>
                <p className="text-[11px] text-neutral-500">distinct income types</p>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">Days</span>
                  <Calendar className="h-4 w-4 text-neutral-400" />
                </div>
                <div className="text-lg font-bold mt-0.5">{report.byDate.length}</div>
                <p className="text-[11px] text-neutral-500">days with income</p>
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
                <div className="text-neutral-500">Income Report</div>
                <div className="font-semibold tabular-nums">{fromDateDisplay} — {toDateDisplay}</div>
              </div>
            </div>

            {/* Tabs: Summary by Category | All Income Entries */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'summary' | 'entries')}>
              <TabsList className="grid grid-cols-2 w-full mb-3 print:hidden">
                <TabsTrigger value="summary">Summary by Category</TabsTrigger>
                <TabsTrigger value="entries">All Income Entries</TabsTrigger>
              </TabsList>

              {/* Tab 1: Summary by Category — the 6 fixed buckets */}
              <TabsContent value="summary">
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:border-black print:break-inside-avoid">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold">Income Type</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold text-center w-20">Entries</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold text-right w-32">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.buckets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-3 px-2 text-center text-neutral-400 text-[12px]">
                            No income entries in this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.buckets.map((b) => (
                          <TableRow key={b.key} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                            <TableCell className="py-1 px-2">{b.label}</TableCell>
                            <TableCell className="py-1 px-2 text-center tabular-nums">{b.count}</TableCell>
                            <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(b.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-emerald-50 dark:bg-emerald-950/40 print:bg-gray-200 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                        <TableCell className="py-1.5 px-2 text-[12px] font-bold text-right" colSpan={2}>Total Income -</TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">{fmt(report.total)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Tab 2: All Income Entries */}
              <TabsContent value="entries">
                {/* On-screen paginated table */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:hidden">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold">Date</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold text-right w-24">Cash</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold text-right w-24">Card</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold text-right w-24">Bkash</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold">Note</TableHead>
                        <TableHead className="h-6 py-1 px-2 text-[11px] font-semibold text-right w-28">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.entries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-6 px-2 text-center text-neutral-400 text-[12px]">
                            No income entries in this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedEntries.map((e) => {
                          const cash = e.paymentMethod === 'CASH' ? e.amount : 0
                          const card = e.paymentMethod === 'CARD' ? e.amount : 0
                          const bkash = (e.paymentMethod === 'MOBILE_BANK' || e.paymentMethod === 'BANK') ? e.amount : 0
                          return (
                            <TableRow key={e.id} className="border-neutral-100 dark:border-neutral-800/50">
                              <TableCell className="py-1 px-2 whitespace-nowrap">{e.date.split('-').reverse().join('/')}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{cash ? fmt(cash) : '—'}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{card ? fmt(card) : '—'}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{bkash ? fmt(bkash) : '—'}</TableCell>
                              <TableCell className="py-1 px-2 text-neutral-500 max-w-[260px] truncate">{e.note || '—'}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                                {fmt(e.amount)}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                      {/* Subtotal row: sum of each payment-method column */}
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-300 dark:border-neutral-700">
                        <TableCell className="py-1.5 px-2 text-[12px] font-bold text-right">Subtotal -</TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">
                          {fmt(filteredEntries.filter((e) => e.paymentMethod === 'CASH').reduce((s, e) => s + e.amount, 0))}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">
                          {fmt(filteredEntries.filter((e) => e.paymentMethod === 'CARD').reduce((s, e) => s + e.amount, 0))}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">
                          {fmt(filteredEntries.filter((e) => e.paymentMethod === 'MOBILE_BANK' || e.paymentMethod === 'BANK').reduce((s, e) => s + e.amount, 0))}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">{fmt(report.total)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-emerald-50 dark:bg-emerald-950/40 border-t-2 border-neutral-800 dark:border-neutral-200">
                        <TableCell colSpan={5} className="py-1.5 px-2 text-[12px] font-bold text-right">Grand Total -</TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">{fmt(report.total)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="print:hidden mt-2">
                  <PaginationControls totalItems={filteredCount} pagination={pagination} />
                </div>

                {/* Print-only: full unpaginated table with all filtered entries */}
                <div className="hidden print:block border border-black rounded-sm overflow-hidden">
                  <table className="text-[12px] w-full" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="bg-gray-200 border-b border-black">
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '13%' }}>Date</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '13%' }}>Cash</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '13%' }}>Card</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '13%' }}>Bkash</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '35%' }}>Note</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '13%' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-3 px-2 text-center text-black text-[12px]">No income entries in this period</td>
                        </tr>
                      ) : (
                        filteredEntries.map((e) => {
                          const cash = e.paymentMethod === 'CASH' ? e.amount : 0
                          const card = e.paymentMethod === 'CARD' ? e.amount : 0
                          const bkash = (e.paymentMethod === 'MOBILE_BANK' || e.paymentMethod === 'BANK') ? e.amount : 0
                          return (
                            <tr key={e.id} className="border-b border-black print:break-inside-avoid">
                              <td className="py-1 px-2 whitespace-nowrap text-black">{e.date.split('-').reverse().join('/')}</td>
                              <td className="py-1 px-2 text-right tabular-nums text-black">{cash ? fmt(cash) : ''}</td>
                              <td className="py-1 px-2 text-right tabular-nums text-black">{card ? fmt(card) : ''}</td>
                              <td className="py-1 px-2 text-right tabular-nums text-black">{bkash ? fmt(bkash) : ''}</td>
                              <td className="py-1 px-2 text-black">{e.note || '—'}</td>
                              <td className="py-1 px-2 text-right tabular-nums text-black">{fmt(e.amount)}</td>
                            </tr>
                          )
                        })
                      )}
                      {/* Subtotal row */}
                      <tr className="bg-gray-100 border-t border-black">
                        <td className="py-1.5 px-2 text-[12px] font-bold text-right text-black">Subtotal -</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(filteredEntries.filter((e) => e.paymentMethod === 'CASH').reduce((s, e) => s + e.amount, 0))}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(filteredEntries.filter((e) => e.paymentMethod === 'CARD').reduce((s, e) => s + e.amount, 0))}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(filteredEntries.filter((e) => e.paymentMethod === 'MOBILE_BANK' || e.paymentMethod === 'BANK').reduce((s, e) => s + e.amount, 0))}</td>
                        <td></td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(filteredEntries.reduce((s, e) => s + e.amount, 0))}</td>
                      </tr>
                      <tr className="bg-gray-200 border-t-2 border-black">
                        <td colSpan={5} className="py-1.5 px-2 text-[12px] font-bold text-right text-black">Grand Total -</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(filteredEntries.reduce((s, e) => s + e.amount, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[12px]">
              <div>
                <span className="text-neutral-500">Prepared by: </span>
                <span className="font-semibold">{report.entries.length > 0 && report.entries[0].creator ? (report.entries[0].creator.name || report.entries[0].creator.email) : '—'}</span>
              </div>
              <div className="text-neutral-400 text-[11px]">
                Generated on {new Date().toLocaleString('en-GB')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
