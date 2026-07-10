'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, Printer, Loader2, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, DollarSign, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
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
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const CURRENCY = '৳'

interface CategoryItem { category: string; amount: number }
interface OpGroup { key: string; label: string; items: CategoryItem[]; total: number }

interface ReportData {
  from: string
  to: string
  businessName: string
  logoUrl: string | null
  revenue: CategoryItem[]
  totalExcess: number
  totalRevenue: number
  cogs: CategoryItem[]
  totalCogs: number
  grossProfit: number
  operatingGroups: OpGroup[]
  totalOperating: number
  operatingProfit: number
  otherLosses: CategoryItem[]
  totalOtherLosses: number
  totalDeposits: number
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

  const fromDateDisplay = formatLongDate(from)
  const toDateDisplay = formatLongDate(to)
  const isProfit = (report?.netProfit ?? 0) >= 0
  const isOpProfit = (report?.operatingProfit ?? 0) >= 0

  // Helper to render a row: label on left, amount on right
  // kind: 'item' | 'total' | 'grandtotal' | 'header' | 'subheader'
  // Parentheses "(...)" automatically wrap the amount when it is negative.
  const Row = ({ label, amount, kind = 'item', showCurrency = true }: {
    label: string
    amount?: number
    kind?: 'item' | 'total' | 'grandtotal' | 'header' | 'subheader'
    showCurrency?: boolean
  }) => {
    const isNeg = typeof amount === 'number' && amount < 0
    const amountStr = amount === undefined
      ? ''
      : isNeg
        ? `(${fmt(Math.abs(amount))})`
        : fmt(amount || 0)
    if (kind === 'header') {
      return (
        <div className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 px-2 py-1 border-y border-neutral-400 dark:border-neutral-600 print:border-black text-center">
          <span className="text-[12px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-200 print:text-black">{label}</span>
        </div>
      )
    }
    if (kind === 'subheader') {
      return (
        <div className="px-2 pt-2 pb-1 border-b border-dotted border-neutral-300 dark:border-neutral-700 print:border-black">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300 print:text-black">{label}</span>
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
          {showCurrency ? `${CURRENCY}${amountStr}` : amountStr}
        </span>
      </div>
    )
  }

  // ===== Excel/PDF export — builds a flat representation matching the report =====
  // Helper: format an amount with currency prefix, wrapping negatives in (parentheses)
  const fmtAmt = (amt: number): string =>
    `${CURRENCY}${amt < 0 ? `(${fmt(Math.abs(amt))})` : fmt(amt)}`

  const buildExportRows = (): (string|number)[][] => {
    if (!report) return []
    const rows: (string|number)[][] = []
    const push = (a: string, b: string = '') => rows.push([a, b])
    const itemRow = (cat: string, amt: number) => rows.push([cat, fmtAmt(amt)])

    push('REVENUE', '')
    report.revenue.forEach((c) => itemRow(c.category, c.amount))
    if (report.totalExcess > 0) itemRow('Excess / Extra Cash', report.totalExcess)
    push('TOTAL REVENUE', fmtAmt(report.totalRevenue))
    rows.push(['', ''])

    push('COST OF GOODS SOLD (COGS)', '')
    report.cogs.forEach((c) => itemRow(c.category, c.amount))
    push('TOTAL COGS', fmtAmt(report.totalCogs))
    push('GROSS PROFIT', fmtAmt(report.grossProfit))
    rows.push(['', ''])

    push('OPERATING EXPENSES', '')
    report.operatingGroups.forEach((g) => {
      push(g.label, '')
      g.items.forEach((c) => itemRow(c.category, c.amount))
      push(`Total ${g.label}`, fmtAmt(g.total))
      rows.push(['', ''])
    })
    push('TOTAL OPERATING EXPENSES', fmtAmt(report.totalOperating))
    push('OPERATING PROFIT / (LOSS)', fmtAmt(report.operatingProfit))
    rows.push(['', ''])

    push('OTHER LOSSES / ADJUSTMENTS', '')
    report.otherLosses.forEach((c) => itemRow(c.category, c.amount))
    push('TOTAL OTHER LOSSES', fmtAmt(report.totalOtherLosses))
    rows.push(['', ''])

    push('NET PROFIT / (LOSS)', '')
    push(isProfit ? 'NET PROFIT' : 'NET LOSS', fmtAmt(report.netProfit))
    rows.push(['', ''])

    push('NOT INCLUDED IN PROFIT & LOSS', '')
    push('Bank / bKash Deposits (Transfers)', fmtAmt(report.totalDeposits))
    push('(Internal Fund Transfer - Not an Expense)', '')
    return rows
  }

  return (
    <div className="space-y-3">
      {/* Date panel — compact, mobile-first */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 sm:p-3 print:hidden">
        {/* Row 1: title + quick nav */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <DollarSign className="h-4 w-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Profit &amp; Loss Report</div>
              <div className="text-[11px] text-neutral-500 tabular-nums truncate">{formatLongDate(from)} — {formatLongDate(to)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={handleThisMonth}>This Month</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Row 2: dates + actions */}
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
            <Button variant="outline" size="sm" className="h-8" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToExcel }) => exportToExcel({
                    businessName: report.businessName,
                    reportTitle: 'Profit & Loss Statement',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`,
                    columns: [{ header: 'Particulars', key: 'particulars' }, { header: 'Amount', key: 'amount' }],
                    rows: buildExportRows(),
                  }))
                }}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName,
                    reportTitle: 'Profit & Loss Statement',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`,
                    columns: [{ header: 'Particulars', key: 'particulars' }, { header: 'Amount', key: 'amount' }],
                    rows: buildExportRows(),
                  }))
                }}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> PDF
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
          {/* Summary cards — compact (screen only) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 print:hidden">
            <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-md px-3 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Total Revenue</span>
                <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              </div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{CURRENCY}{fmt(report.totalRevenue)}</div>
              <p className="text-[10px] text-neutral-500">{report.incomeCount} txns</p>
            </div>
            <div className="border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 rounded-md px-3 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Total Expenses</span>
                <ArrowDownCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
              </div>
              <div className="text-base font-bold text-rose-700 dark:text-rose-400 tabular-nums">{CURRENCY}{fmt(report.totalCogs + report.totalOperating + report.totalOtherLosses)}</div>
              <p className="text-[10px] text-neutral-500">{report.expenseCount} txns</p>
            </div>
            <div className={`border rounded-md px-3 py-2 ${
              isOpProfit
                ? 'border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30'
                : 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30'
            }`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[11px] font-medium ${isOpProfit ? 'text-sky-700 dark:text-sky-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  Operating {isOpProfit ? 'Profit' : 'Loss'}
                </span>
                <DollarSign className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              </div>
              <div className={`text-base font-bold tabular-nums ${isOpProfit ? 'text-sky-700 dark:text-sky-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {CURRENCY}{fmt(Math.abs(report.operatingProfit))}
              </div>
              <p className="text-[10px] text-neutral-500">After operating exp</p>
            </div>
            <div className={`border rounded-md px-3 py-2 ${
              isProfit
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-100/60 dark:bg-emerald-950/40'
                : 'border-rose-300 dark:border-rose-800 bg-rose-100/60 dark:bg-rose-950/40'
            }`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[11px] font-medium ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {isProfit ? 'Net Profit' : 'Net Loss'}
                </span>
                <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
              <div className={`text-base font-bold tabular-nums ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {CURRENCY}{fmt(Math.abs(report.netProfit))}
              </div>
              <p className="text-[10px] text-neutral-500">After all losses</p>
            </div>
          </div>

          {/* ===== Statement sheet — wider ===== */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
            {/* Header — centered */}
            <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
              <div className="flex items-center justify-center gap-3 mb-1">
                {report.logoUrl && (
                  <img src={report.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />
                )}
                <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{report.businessName}</div>
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">Profit &amp; Loss Statement</div>
              <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">{fromDateDisplay} to {toDateDisplay}</div>
            </div>

            {/* ===== REVENUE ===== */}
            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-4">
              <Row label="Revenue" kind="header" />
              {report.revenue.length === 0 && report.totalExcess === 0 ? (
                <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No revenue in this period</div>
              ) : (
                <>
                  {report.revenue.map((c) => (
                    <Row key={c.category} label={c.category} amount={c.amount} />
                  ))}
                  {report.totalExcess > 0 && (
                    <Row label="Excess / Extra Cash" amount={report.totalExcess} />
                  )}
                  <Row label="TOTAL REVENUE" amount={report.totalRevenue} kind="total" />
                </>
              )}
            </div>

            {/* ===== COGS ===== */}
            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-4">
              <Row label="Cost of Goods Sold (COGS)" kind="header" />
              {report.cogs.length === 0 ? (
                <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No COGS in this period</div>
              ) : (
                <>
                  {report.cogs.map((c) => (
                    <Row key={c.category} label={c.category} amount={c.amount} />
                  ))}
                  <Row label="TOTAL COGS" amount={report.totalCogs} kind="total" />
                </>
              )}
              <Row label="GROSS PROFIT" amount={report.grossProfit} kind="grandtotal" />
            </div>

            {/* ===== OPERATING EXPENSES ===== */}
            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-4">
              <Row label="Operating Expenses" kind="header" />
              {report.operatingGroups.length === 0 ? (
                <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No operating expenses in this period</div>
              ) : (
                <>
                  {report.operatingGroups.map((g) => (
                    <div key={g.key}>
                      <Row label={g.label} kind="subheader" />
                      {g.items.map((c) => (
                        <Row key={c.category} label={c.category} amount={c.amount} />
                      ))}
                      <Row label={`Total ${g.label}`} amount={g.total} kind="total" />
                    </div>
                  ))}
                  <Row label="TOTAL OPERATING EXPENSES" amount={report.totalOperating} kind="total" />
                </>
              )}
              <Row
                label={isOpProfit ? 'OPERATING PROFIT' : 'OPERATING LOSS'}
                amount={report.operatingProfit}
                kind="grandtotal"
              />
            </div>

            {/* ===== OTHER LOSSES ===== */}
            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-4">
              <Row label="Other Losses / Adjustments" kind="header" />
              {report.otherLosses.length === 0 ? (
                <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No other losses in this period</div>
              ) : (
                <>
                  {report.otherLosses.map((c) => (
                    <Row key={c.category} label={c.category} amount={c.amount} />
                  ))}
                  <Row label="TOTAL OTHER LOSSES" amount={report.totalOtherLosses} kind="total" />
                </>
              )}
            </div>

            {/* ===== NET PROFIT / (LOSS) ===== */}
            <div className={`border-2 rounded-sm overflow-hidden mb-4 ${
              isProfit
                ? 'border-emerald-500 dark:border-emerald-700 print:border-black'
                : 'border-rose-500 dark:border-rose-700 print:border-black'
            }`}>
              <Row label="Net Profit / (Loss)" kind="header" />
              <div className={`px-2 py-3 flex items-center justify-between ${
                isProfit
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 print:bg-gray-100'
                  : 'bg-rose-50 dark:bg-rose-950/30 print:bg-gray-100'
              }`}>
                <span className="text-[14px] font-bold uppercase tracking-wide text-neutral-800 dark:text-neutral-100 print:text-black">
                  {isProfit ? 'NET PROFIT' : 'NET LOSS'}
                </span>
                <span className={`text-[16px] font-bold tabular-nums ${
                  isProfit ? 'text-emerald-700 dark:text-emerald-400 print:text-black' : 'text-rose-700 dark:text-rose-400 print:text-black'
                }`}>
                  {CURRENCY}{fmt(Math.abs(report.netProfit))}
                </span>
              </div>
            </div>

            {/* ===== NOT INCLUDED ===== */}
            <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/30 print:bg-gray-50">
              <Row label="Not Included in Profit & Loss" kind="header" />
              <Row label="Bank / bKash Deposits (Transfers)" amount={report.totalDeposits} />
              <div className="px-2 py-1 text-[11px] italic text-neutral-500 print:text-black">
                (Internal Fund Transfer — Not an Expense)
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div className="text-neutral-500">
                Operating: {report.operatingGroups.length} group(s) · {report.expenseCount} expense txns · {report.incomeCount} income txns
              </div>
              <div className="text-neutral-400">Generated on {new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
