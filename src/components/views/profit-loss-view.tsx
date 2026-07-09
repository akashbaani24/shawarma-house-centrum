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
import { TrendingUp, Printer, Loader2, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, ArrowUpCircle, ArrowDownCircle, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

interface CategoryItem {
  category: string
  amount: number
}

interface ReportData {
  from: string
  to: string
  businessName: string
  logoUrl: string | null
  incomeByCategory: CategoryItem[]
  expenseByCategory: CategoryItem[]
  totalIncome: number
  totalExcess: number
  totalExpenses: number
  totalDeposits: number
  totalShortage: number
  netProfit: number
  incomeCount: number
  expenseCount: number
}

export default function ProfitLossView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/profit-loss?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setReport(data)
      else toast.error(data?.error || 'Failed to load')
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const handlePrevMonth = () => {
    const d = new Date(from + 'T00:00:00')
    d.setMonth(d.getMonth() - 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    setFrom(`${y}-${m}-01`)
    setTo(`${y}-${m}-${String(new Date(y, parseInt(m), 0).getDate()).padStart(2, '0')}`)
  }
  const handleNextMonth = () => {
    const d = new Date(from + 'T00:00:00')
    d.setMonth(d.getMonth() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    setFrom(`${y}-${m}-01`)
    setTo(`${y}-${m}-${String(new Date(y, parseInt(m), 0).getDate()).padStart(2, '0')}`)
  }
  const handleThisMonth = () => {
    setFrom(firstOfMonth())
    setTo(todayStr())
  }

  const fromDateDisplay = from.split('-').reverse().join('/')
  const toDateDisplay = to.split('-').reverse().join('/')
  const isProfit = (report?.netProfit ?? 0) >= 0

  return (
    <div className="space-y-4">
      {/* Date panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-neutral-400" />
            <div>
              <div className="text-sm sm:text-base font-semibold">Profit &amp; Loss Report</div>
              <div className="text-xs text-neutral-500">{formatLongDate(from)} — {formatLongDate(to)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <div>
              <Label className="text-xs text-neutral-500">From</Label>
              <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-[130px]" />
            </div>
            <div>
              <Label className="text-xs text-neutral-500">To</Label>
              <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-[130px]" />
            </div>
            <Button variant="outline" size="sm" onClick={handleThisMonth}>This Month</Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
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
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            <Card className="border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Total Income</CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{CURRENCY}{fmt(report.totalIncome)}</div>
                <p className="text-xs text-neutral-500 mt-1">{report.incomeCount} transactions</p>
              </CardContent>
            </Card>
            <Card className="border-rose-200 bg-rose-50/60 dark:bg-rose-950/30 dark:border-rose-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-rose-700 dark:text-rose-400">Total Expenses</CardTitle>
                <ArrowDownCircle className="h-4 w-4 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-rose-700 dark:text-rose-400">{CURRENCY}{fmt(report.totalExpenses)}</div>
                <p className="text-xs text-neutral-500 mt-1">{report.expenseCount} transactions</p>
              </CardContent>
            </Card>
            <Card className={isProfit
              ? 'border-sky-200 bg-sky-50/60 dark:bg-sky-950/30 dark:border-sky-900'
              : 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className={`text-xs font-medium ${isProfit ? 'text-sky-700 dark:text-sky-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {isProfit ? 'Net Profit' : 'Net Loss'}
                </CardTitle>
                <TrendingUp className={`h-4 w-4 ${isProfit ? 'text-sky-600' : 'text-amber-600'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${isProfit ? 'text-sky-700 dark:text-sky-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {CURRENCY}{fmt(Math.abs(report.netProfit))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-neutral-500">Margin</CardTitle>
                <DollarSign className="h-4 w-4 text-neutral-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {report.totalIncome > 0
                    ? `${((report.netProfit / report.totalIncome) * 100).toFixed(1)}%`
                    : '—'}
                </div>
                <p className="text-xs text-neutral-500 mt-1">Profit / Income ratio</p>
              </CardContent>
            </Card>
          </div>

          {/* Report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-6 print:border-black print:p-2 shadow-sm">
            {/* Header */}
            <div className="flex items-start sm:items-end justify-between gap-2 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black pb-2 mb-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {report.logoUrl && (
                  <img src={report.logoUrl} alt="Logo" className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded shrink-0" />
                )}
                <div className="text-base sm:text-2xl font-bold tracking-tight leading-tight">{report.businessName}</div>
              </div>
              <div className="text-xs sm:text-sm shrink-0">
                <div className="text-neutral-500">Profit &amp; Loss Statement</div>
                <div className="font-semibold tabular-nums">{fromDateDisplay} — {toDateDisplay}</div>
              </div>
            </div>

            {/* Two-column: Income breakdown | Expense breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4">
              {/* Income side */}
              <div>
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:border-black">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                      Income Breakdown
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableBody>
                      {report.incomeByCategory.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="py-3 px-2 text-center text-neutral-400">No income in this period</TableCell></TableRow>
                      ) : (
                        report.incomeByCategory.map((c) => (
                          <TableRow key={c.category} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                            <TableCell className="py-1 px-2">{c.category}</TableCell>
                            <TableCell className="py-1 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(c.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {report.totalExcess > 0 && (
                        <TableRow className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                          <TableCell className="py-1 px-2">Excess / Extra Cash</TableCell>
                          <TableCell className="py-1 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(report.totalExcess)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                        <TableCell className="py-1 px-2 text-[11px] font-bold">Total Income -</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                          {fmt(report.totalIncome + report.totalExcess)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Expense side */}
              <div>
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:border-black">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
                      Expense Breakdown
                    </span>
                  </div>
                  <Table className="text-[11px]">
                    <TableBody>
                      {report.expenseByCategory.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="py-3 px-2 text-center text-neutral-400">No expenses in this period</TableCell></TableRow>
                      ) : (
                        report.expenseByCategory.map((c) => (
                          <TableRow key={c.category} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                            <TableCell className="py-1 px-2">{c.category}</TableCell>
                            <TableCell className="py-1 px-2 text-right tabular-nums text-rose-700 dark:text-rose-400">{fmt(c.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {report.totalShortage > 0 && (
                        <TableRow className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                          <TableCell className="py-1 px-2">Cash Shortage</TableCell>
                          <TableCell className="py-1 px-2 text-right tabular-nums text-rose-700 dark:text-rose-400">{fmt(report.totalShortage)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                        <TableCell className="py-1 px-2 text-[11px] font-bold">Total Expenses -</TableCell>
                        <TableCell className="py-1 px-2 text-right tabular-nums font-bold text-rose-700 dark:text-rose-400">
                          {fmt(report.totalExpenses + report.totalShortage)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Net profit/loss summary */}
            <div className={`mt-4 rounded-sm border-2 p-4 ${isProfit ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/20 print:border-black' : 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 print:border-black'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                    {isProfit ? 'Net Profit' : 'Net Loss'}
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Total Income ({CURRENCY}{fmt(report.totalIncome + report.totalExcess)}) − Total Expenses ({CURRENCY}{fmt(report.totalExpenses + report.totalShortage)})
                  </div>
                </div>
                <div className={`text-2xl font-bold ${isProfit ? 'text-sky-700 dark:text-sky-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {isProfit ? '' : '-'}{CURRENCY}{fmt(Math.abs(report.netProfit))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div className="text-neutral-500">Deposits (transfers): {CURRENCY}{fmt(report.totalDeposits)} — not counted as expense</div>
              <div className="text-neutral-400 text-[10px]">Generated on {new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => {
              const allRows = [
                ...report.incomeByCategory.map((c) => ['Income', c.category, fmt(c.amount)] as (string|number)[]),
                ...(report.totalExcess > 0 ? [['Income', 'Excess / Extra Cash', fmt(report.totalExcess)] as (string|number)[]] : []),
                ...report.expenseByCategory.map((c) => ['Expense', c.category, fmt(c.amount)] as (string|number)[]),
                ...(report.totalShortage > 0 ? [['Expense', 'Cash Shortage', fmt(report.totalShortage)] as (string|number)[]] : []),
              ]
              import('@/lib/export-utils').then(({ exportToExcel }) => exportToExcel({
                businessName: report.businessName,
                reportTitle: 'Profit & Loss Report',
                dateRange: `${fromDateDisplay} — ${toDateDisplay}`,
                columns: [{ header: 'Type', key: 'type' }, { header: 'Category', key: 'category' }, { header: 'Amount', key: 'amount' }],
                rows: allRows,
                totalsRow: [isProfit ? 'Net Profit' : 'Net Loss', '', fmt(Math.abs(report.netProfit))],
              }))
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const allRows = [
                ...report.incomeByCategory.map((c) => ['Income', c.category, fmt(c.amount)] as (string|number)[]),
                ...(report.totalExcess > 0 ? [['Income', 'Excess / Extra Cash', fmt(report.totalExcess)] as (string|number)[]] : []),
                ...report.expenseByCategory.map((c) => ['Expense', c.category, fmt(c.amount)] as (string|number)[]),
                ...(report.totalShortage > 0 ? [['Expense', 'Cash Shortage', fmt(report.totalShortage)] as (string|number)[]] : []),
              ]
              import('@/lib/export-utils').then(({ exportToPDF }) => exportToPDF({
                businessName: report.businessName,
                reportTitle: 'Profit & Loss Report',
                dateRange: `${fromDateDisplay} — ${toDateDisplay}`,
                columns: [{ header: 'Type', key: 'type' }, { header: 'Category', key: 'category' }, { header: 'Amount', key: 'amount' }],
                rows: allRows,
                totalsRow: [isProfit ? 'Net Profit' : 'Net Loss', '', fmt(Math.abs(report.netProfit))],
              }))
            }}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
