'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ChevronLeft, ChevronRight, Printer, Loader2, FileSpreadsheet, FileText,
  TrendingUp, TrendingDown, DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  todayStr, firstOfMonth, formatLongDate, fmt, CURRENCY,
  shiftMonth, lastOfMonth,
} from './_report-helpers'

interface CategoryItem { category: string; amount: number }

interface ReportData {
  from: string; to: string
  businessName: string; logoUrl: string | null
  revenue: CategoryItem[]
  totalExcess: number
  totalRevenue: number
  cogs: CategoryItem[]
  totalCogs: number
  grossProfit: number
  operating: CategoryItem[]
  totalOperating: number
  operatingProfit: number
  totalShortage: number
  totalDeposits: number
  netProfit: number
}

const Row = ({ label, amount, kind = 'item' }: {
  label: string
  amount?: number
  kind?: 'item' | 'total' | 'grandtotal' | 'header'
}) => {
  const amtStr = amount === undefined ? '' : (amount < 0 ? `(${fmt(Math.abs(amount))})` : fmt(amount))
  if (kind === 'header') {
    return (
      <div className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 px-2 py-1 border-y border-neutral-400 dark:border-neutral-600 print:border-black text-center">
        <span className="text-[12px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-200 print:text-black">{label}</span>
      </div>
    )
  }
  const isTotal = kind === 'total' || kind === 'grandtotal'
  const isGrand = kind === 'grandtotal'
  return (
    <div className={`flex items-center justify-between px-2 ${isTotal ? 'py-1.5' : 'py-1'} ${
      isGrand ? 'border-t-2 border-neutral-700 dark:border-neutral-300 print:border-black bg-neutral-50 dark:bg-neutral-900 print:bg-gray-100' :
      isTotal ? 'border-t border-neutral-300 dark:border-neutral-700 print:border-black bg-neutral-50/50 dark:bg-neutral-900/50 print:bg-gray-50' :
      'border-b border-dotted border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-dotted'
    }`}>
      <span className={`text-[12px] ${isGrand ? 'font-bold' : isTotal ? 'font-bold' : 'font-normal'} text-neutral-800 dark:text-neutral-200 print:text-black`}>
        {label}
      </span>
      <span className={`text-[12px] tabular-nums ${isGrand ? 'font-bold' : isTotal ? 'font-bold' : 'font-normal'} text-neutral-800 dark:text-neutral-200 print:text-black`}>
        {CURRENCY}{amtStr}
      </span>
    </div>
  )
}

export default function MonthlySummaryView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/monthly-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setReport(data)
      else toast.error(data?.error || 'Failed to load')
    } catch {
      toast.error('Failed to load monthly summary')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const handlePrevMonth = () => {
    const d = new Date(from + 'T00:00:00')
    const s = shiftMonth(d.getFullYear(), d.getMonth() + 1, -1)
    setFrom(`${s.year}-${String(s.month).padStart(2, '0')}-01`)
    setTo(lastOfMonth(s.year, s.month))
  }
  const handleNextMonth = () => {
    const d = new Date(from + 'T00:00:00')
    const s = shiftMonth(d.getFullYear(), d.getMonth() + 1, +1)
    setFrom(`${s.year}-${String(s.month).padStart(2, '0')}-01`)
    setTo(lastOfMonth(s.year, s.month))
  }
  const handleThisMonth = () => {
    setFrom(firstOfMonth())
    setTo(todayStr())
  }

  const fromDateDisplay = from.split('-').reverse().join('/')
  const toDateDisplay = to.split('-').reverse().join('/')
  const isProfit = (report?.netProfit ?? 0) >= 0

  const buildExportRows = () => {
    if (!report) return []
    const rows: (string|number)[][] = []
    const push = (a: string, b: string = '') => rows.push([a, b])
    const itemRow = (cat: string, amt: number) => rows.push([cat, `${CURRENCY}${fmt(amt)}`])

    push('REVENUE', '')
    report.revenue.forEach((c) => itemRow(c.category, c.amount))
    if (report.totalExcess > 0) itemRow('Excess / Extra Cash', report.totalExcess)
    push('TOTAL REVENUE', `${CURRENCY}${fmt(report.totalRevenue)}`)
    rows.push(['', ''])
    push('COST OF GOODS SOLD', '')
    report.cogs.forEach((c) => itemRow(c.category, c.amount))
    push('TOTAL COGS', `${CURRENCY}${fmt(report.totalCogs)}`)
    push('GROSS PROFIT', `${CURRENCY}${fmt(report.grossProfit)}`)
    rows.push(['', ''])
    push('OPERATING EXPENSES', '')
    report.operating.forEach((c) => itemRow(c.category, c.amount))
    push('TOTAL OPERATING EXPENSES', `${CURRENCY}${fmt(report.totalOperating)}`)
    push('OPERATING PROFIT / (LOSS)', `${CURRENCY}${fmt(report.operatingProfit)}`)
    rows.push(['', ''])
    push('OTHER LOSSES', `${CURRENCY}${fmt(report.totalShortage)}`)
    push('NET PROFIT / (LOSS)', `${CURRENCY}${fmt(report.netProfit)}`)
    rows.push(['', ''])
    push('DEPOSITS (not in P&L)', `${CURRENCY}${fmt(report.totalDeposits)}`)
    return rows
  }

  return (
    <div className="space-y-3">
      {/* Date panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 sm:p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <DollarSign className="h-4 w-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Monthly Financial Summary</div>
              <div className="text-[11px] text-neutral-500 tabular-nums truncate">{formatLongDate(from)} — {formatLongDate(to)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={handleThisMonth}>This Month</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-[10px] text-neutral-500 block mb-0.5">From</Label>
              <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-[130px] h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-neutral-500 block mb-0.5">To</Label>
              <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-[130px] h-8 text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Button variant="outline" size="sm" className="h-8" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
            {report && (
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToExcel }) => exportToExcel({
                    businessName: report.businessName, reportTitle: 'Monthly Financial Summary',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`,
                    columns: [{ header: 'Particulars', key: 'p' }, { header: 'Amount', key: 'a' }],
                    rows: buildExportRows(),
                  }))
                }}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel</Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName, reportTitle: 'Monthly Financial Summary',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`,
                    columns: [{ header: 'Particulars', key: 'p' }, { header: 'Amount', key: 'a' }],
                    rows: buildExportRows(),
                  }))
                }}><FileText className="h-3.5 w-3.5 mr-1" /> PDF</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {loading || !report ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 print:hidden">
            <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-md px-3 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Total Revenue</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{CURRENCY}{fmt(report.totalRevenue)}</div>
            </div>
            <div className="border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 rounded-md px-3 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Total Expenses</span>
                <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
              </div>
              <div className="text-base font-bold text-rose-700 dark:text-rose-400 tabular-nums">{CURRENCY}{fmt(report.totalCogs + report.totalOperating + report.totalShortage)}</div>
            </div>
            <div className="border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30 rounded-md px-3 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Gross Profit</span>
                <DollarSign className="h-3.5 w-3.5 text-sky-600" />
              </div>
              <div className="text-base font-bold text-sky-700 dark:text-sky-400 tabular-nums">{CURRENCY}{fmt(report.grossProfit)}</div>
            </div>
            <div className={`border rounded-md px-3 py-2 ${isProfit ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-100/60 dark:bg-emerald-950/40' : 'border-rose-300 dark:border-rose-800 bg-rose-100/60 dark:bg-rose-950/40'}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[11px] font-medium ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{isProfit ? 'Net Profit' : 'Net Loss'}</span>
                <TrendingUp className={`h-3.5 w-3.5 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
              <div className={`text-base font-bold tabular-nums ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{CURRENCY}{fmt(Math.abs(report.netProfit))}</div>
            </div>
          </div>

          {/* Statement sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
            <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
              <div className="flex items-center justify-center gap-3 mb-1">
                {report.logoUrl && <img src={report.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />}
                <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{report.businessName}</div>
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">Monthly Financial Summary</div>
              <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">{fromDateDisplay} to {toDateDisplay}</div>
            </div>

            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
              <Row label="Revenue" kind="header" />
              {report.revenue.length === 0 && report.totalExcess === 0 ? (
                <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No revenue in this period</div>
              ) : (
                <>
                  {report.revenue.map((c) => <Row key={c.category} label={c.category} amount={c.amount} />)}
                  {report.totalExcess > 0 && <Row label="Excess / Extra Cash" amount={report.totalExcess} />}
                  <Row label="TOTAL REVENUE" amount={report.totalRevenue} kind="total" />
                </>
              )}
            </div>

            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
              <Row label="Cost of Goods Sold (COGS)" kind="header" />
              {report.cogs.length === 0 ? (
                <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No COGS in this period</div>
              ) : (
                <>
                  {report.cogs.map((c) => <Row key={c.category} label={c.category} amount={c.amount} />)}
                  <Row label="TOTAL COGS" amount={report.totalCogs} kind="total" />
                </>
              )}
              <Row label="GROSS PROFIT" amount={report.grossProfit} kind="grandtotal" />
            </div>

            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
              <Row label="Operating Expenses" kind="header" />
              {report.operating.length === 0 ? (
                <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No operating expenses in this period</div>
              ) : (
                <>
                  {report.operating.map((c) => <Row key={c.category} label={c.category} amount={c.amount} />)}
                  <Row label="TOTAL OPERATING" amount={report.totalOperating} kind="total" />
                </>
              )}
              <Row label="OPERATING PROFIT" amount={report.operatingProfit} kind="grandtotal" />
            </div>

            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
              <Row label="Other Losses (Cash Shortage)" kind="header" />
              <Row label="Cash Shortage" amount={report.totalShortage} />
            </div>

            <div className={`border-2 rounded-sm overflow-hidden mb-3 ${isProfit ? 'border-emerald-500 dark:border-emerald-700 print:border-black' : 'border-rose-500 dark:border-rose-700 print:border-black'}`}>
              <Row label="Net Profit / (Loss)" kind="header" />
              <div className={`px-2 py-3 flex items-center justify-between ${isProfit ? 'bg-emerald-50 dark:bg-emerald-950/30 print:bg-gray-100' : 'bg-rose-50 dark:bg-rose-950/30 print:bg-gray-100'}`}>
                <span className="text-[14px] font-bold uppercase tracking-wide text-neutral-800 dark:text-neutral-100 print:text-black">{isProfit ? 'NET PROFIT' : 'NET LOSS'}</span>
                <span className={`text-[16px] font-bold tabular-nums ${isProfit ? 'text-emerald-700 dark:text-emerald-400 print:text-black' : 'text-rose-700 dark:text-rose-400 print:text-black'}`}>{CURRENCY}{fmt(Math.abs(report.netProfit))}</span>
              </div>
            </div>

            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/30 print:bg-gray-50">
              <Row label="Not Included — Bank/bKash Deposits" kind="header" />
              <Row label="Total Deposits (Transfers)" amount={report.totalDeposits} />
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div className="text-neutral-500">Generated on {new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
