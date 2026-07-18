'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Scale, ChevronLeft, ChevronRight, Printer, Loader2, FileSpreadsheet, FileText, DollarSign, TrendingUp, TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  todayStr, firstOfMonth, formatLongDate, fmt, CURRENCY,
  shiftMonth, lastOfMonth,
} from './_report-helpers'

// ============ Shared types ============

interface CategoryItem { category: string; amount: number }
interface AccrualReport {
  from: string; to: string; businessName: string; logoUrl: string | null
  revenue: CategoryItem[]; totalExcess: number; totalRevenue: number
  cogs: CategoryItem[]; totalCogs: number; grossProfit: number
  operatingGroups: { key: string; label: string; items: CategoryItem[]; total: number }[]
  totalOperating: number; operatingProfit: number
  otherLosses: CategoryItem[]; totalOtherLosses: number
  totalDeposits: number; netProfit: number
}

interface CashReport {
  from: string; to: string; businessName: string; logoUrl: string | null
  cashIncome: CategoryItem[]; totalExcess: number; totalCashReceived: number
  cashPayments: { key: string; label: string; amount: number; items: CategoryItem[] }[]
  totalCashPayments: number; netCashProfit: number; isProfit: boolean
}

// ============ Row helper ============

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
      <span className={`text-[12px] ${isGrand ? 'font-bold' : isTotal ? 'font-bold' : 'font-normal'} text-neutral-800 dark:text-neutral-200 print:text-black`}>{label}</span>
      <span className={`text-[12px] tabular-nums ${isGrand ? 'font-bold' : isTotal ? 'font-bold' : 'font-normal'} text-neutral-800 dark:text-neutral-200 print:text-black`}>
        {CURRENCY}{amtStr}
      </span>
    </div>
  )
}

// ============ Main component ============

export default function ProfitLossView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [activeTab, setActiveTab] = useState<'accrual' | 'cash'>('accrual')
  const [accrual, setAccrual] = useState<AccrualReport | null>(null)
  const [cash, setCash] = useState<CashReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [accRes, cashRes] = await Promise.all([
        fetch(`/api/profit-loss?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' }),
        fetch(`/api/profit-loss-cash?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' }),
      ])
      const accData = await accRes.json()
      const cashData = await cashRes.json()
      if (accRes.ok) setAccrual(accData)
      else toast.error(accData?.error || 'Failed to load accrual P&L')
      if (cashRes.ok) setCash(cashData)
      else toast.error(cashData?.error || 'Failed to load cash P&L')
    } catch {
      toast.error('Failed to load P&L reports')
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

  const fromDateDisplay = formatLongDate(from)
  const toDateDisplay = formatLongDate(to)
  const isAccrualProfit = (accrual?.netProfit ?? 0) >= 0
  const isCashProfit = (cash?.netCashProfit ?? 0) >= 0

  return (
    <div className="space-y-3">
      {/* Date panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 sm:p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Scale className="h-4 w-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Profit &amp; Loss Report</div>
              <div className="text-[11px] text-neutral-500 tabular-nums truncate">{fromDateDisplay} — {toDateDisplay}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={handleThisMonth}>This Month</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-[10px] text-neutral-500 block mb-0.5">From</Label>
            <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-[130px] h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-neutral-500 block mb-0.5">To</Label>
            <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-[130px] h-8 text-xs" />
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Button variant="outline" size="sm" className="h-8" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          </div>
        </div>
      </div>

      {loading || !accrual || !cash ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'accrual' | 'cash')}>
          <TabsList className="grid grid-cols-2 w-full mb-3 print:hidden">
            <TabsTrigger value="accrual">Accrual Basis (Official)</TabsTrigger>
            <TabsTrigger value="cash">Cash Basis (Management)</TabsTrigger>
          </TabsList>

          {/* ========== TAB 1: ACCRUAL BASIS ========== */}
          <TabsContent value="accrual">
            <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
              <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
                <div className="flex items-center justify-center gap-3 mb-1">
                  {accrual.logoUrl && <img src={accrual.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />}
                  <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{accrual.businessName}</div>
                </div>
                <div className="text-sm font-semibold uppercase tracking-wide">Accrual Basis Profit &amp; Loss</div>
                <div className="text-xs text-neutral-500 mt-0.5">(Official Financial Report)</div>
                <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">{fromDateDisplay} — {toDateDisplay}</div>
              </div>

              {/* Revenue */}
              <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
                <Row label="Revenue" kind="header" />
                {accrual.revenue.length === 0 && accrual.totalExcess === 0 ? (
                  <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No revenue in this period</div>
                ) : (
                  <>
                    {accrual.revenue.map((c) => <Row key={c.category} label={c.category} amount={c.amount} />)}
                    {accrual.totalExcess > 0 && <Row label="Excess / Extra Cash" amount={accrual.totalExcess} />}
                    <Row label="TOTAL REVENUE" amount={accrual.totalRevenue} kind="total" />
                  </>
                )}
              </div>

              {/* COGS */}
              <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
                <Row label="Cost of Goods Sold (COGS)" kind="header" />
                {accrual.cogs.length === 0 ? (
                  <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No COGS in this period</div>
                ) : (
                  <>
                    {accrual.cogs.map((c) => <Row key={c.category} label={c.category} amount={c.amount} />)}
                    <Row label="TOTAL COGS" amount={accrual.totalCogs} kind="total" />
                  </>
                )}
                <Row label="GROSS PROFIT" amount={accrual.grossProfit} kind="grandtotal" />
              </div>

              {/* Operating Expenses */}
              <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
                <Row label="Operating Expenses" kind="header" />
                {accrual.operatingGroups.length === 0 ? (
                  <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No operating expenses in this period</div>
                ) : (
                  <>
                    {accrual.operatingGroups.map((g) => (
                      <div key={g.key}>
                        <Row label={g.label} kind="header" />
                        {g.items.map((it) => <Row key={it.category} label={it.category} amount={it.amount} />)}
                        <Row label={`Total ${g.label}`} amount={g.total} kind="total" />
                      </div>
                    ))}
                    <Row label="TOTAL OPERATING EXPENSES" amount={accrual.totalOperating} kind="total" />
                  </>
                )}
                <Row label={accrual.operatingProfit >= 0 ? 'OPERATING PROFIT' : 'OPERATING LOSS'} amount={accrual.operatingProfit} kind="grandtotal" />
              </div>

              {/* Other Losses */}
              <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
                <Row label="Other Losses / Adjustments" kind="header" />
                {accrual.otherLosses.length === 0 ? (
                  <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No other losses in this period</div>
                ) : (
                  <>
                    {accrual.otherLosses.map((c) => <Row key={c.category} label={c.category} amount={c.amount} />)}
                    <Row label="TOTAL OTHER LOSSES" amount={accrual.totalOtherLosses} kind="total" />
                  </>
                )}
              </div>

              {/* Net Profit */}
              <div className={`border-2 rounded-sm overflow-hidden mb-3 ${isAccrualProfit ? 'border-emerald-500 dark:border-emerald-700 print:border-black' : 'border-rose-500 dark:border-rose-700 print:border-black'}`}>
                <Row label="Net Profit / (Loss)" kind="header" />
                <div className={`px-2 py-3 flex items-center justify-between ${isAccrualProfit ? 'bg-emerald-50 dark:bg-emerald-950/30 print:bg-gray-100' : 'bg-rose-50 dark:bg-rose-950/30 print:bg-gray-100'}`}>
                  <span className="text-[14px] font-bold uppercase tracking-wide text-neutral-800 dark:text-neutral-100 print:text-black">{isAccrualProfit ? 'NET PROFIT' : 'NET LOSS'}</span>
                  <span className={`text-[16px] font-bold tabular-nums ${isAccrualProfit ? 'text-emerald-700 dark:text-emerald-400 print:text-black' : 'text-rose-700 dark:text-rose-400 print:text-black'}`}>{CURRENCY}{fmt(Math.abs(accrual.netProfit))}</span>
                </div>
              </div>

              {/* Not included */}
              <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/30 print:bg-gray-50">
                <Row label="Not Included in Profit & Loss" kind="header" />
                <Row label="Bank / bKash Deposits (Transfers)" amount={accrual.totalDeposits} />
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black text-[11px] text-neutral-400">
                Accrual Basis: income and expenses are matched to the accounting period regardless of cash movement. Generated on {new Date().toLocaleString('en-GB')}
              </div>
            </div>
          </TabsContent>

          {/* ========== TAB 2: CASH BASIS ========== */}
          <TabsContent value="cash">
            <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
              <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
                <div className="flex items-center justify-center gap-3 mb-1">
                  {cash.logoUrl && <img src={cash.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />}
                  <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{cash.businessName}</div>
                </div>
                <div className="text-sm font-semibold uppercase tracking-wide">Cash Basis Profit &amp; Loss</div>
                <div className="text-xs text-neutral-500 mt-0.5">(Management Report — Internal Use Only)</div>
                <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">{fromDateDisplay} — {toDateDisplay}</div>
              </div>

              {/* Cash Received */}
              <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
                <Row label="Cash Received" kind="header" />
                {cash.cashIncome.length === 0 && cash.totalExcess === 0 ? (
                  <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No cash income in this period</div>
                ) : (
                  <>
                    {cash.cashIncome.map((c) => <Row key={c.category} label={c.category} amount={c.amount} />)}
                    {cash.totalExcess > 0 && <Row label="Excess / Extra Cash" amount={cash.totalExcess} />}
                    <Row label="TOTAL CASH RECEIVED" amount={cash.totalCashReceived} kind="total" />
                  </>
                )}
              </div>

              {/* Cash Payments */}
              <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-3">
                <Row label="Cash Payments" kind="header" />
                {cash.cashPayments.length === 0 ? (
                  <div className="py-3 px-2 text-center text-neutral-400 text-[12px]">No cash payments in this period</div>
                ) : (
                  <>
                    {cash.cashPayments.map((c) => (
                      <div key={c.key}>
                        <Row label={c.label} amount={c.amount} kind="total" />
                        {c.items.map((it) => (
                          <Row key={it.category} label={`  ${it.category}`} amount={it.amount} />
                        ))}
                      </div>
                    ))}
                    <Row label="TOTAL CASH PAYMENTS" amount={cash.totalCashPayments} kind="grandtotal" />
                  </>
                )}
              </div>

              {/* Net Cash Profit */}
              <div className={`border-2 rounded-sm overflow-hidden mb-3 ${isCashProfit ? 'border-emerald-500 dark:border-emerald-700 print:border-black' : 'border-rose-500 dark:border-rose-700 print:border-black'}`}>
                <Row label="Net Cash Profit / (Loss)" kind="header" />
                <div className={`px-2 py-3 flex items-center justify-between ${isCashProfit ? 'bg-emerald-50 dark:bg-emerald-950/30 print:bg-gray-100' : 'bg-rose-50 dark:bg-rose-950/30 print:bg-gray-100'}`}>
                  <span className="text-[14px] font-bold uppercase tracking-wide text-neutral-800 dark:text-neutral-100 print:text-black">{isCashProfit ? 'NET CASH PROFIT' : 'NET CASH LOSS'}</span>
                  <span className={`text-[16px] font-bold tabular-nums ${isCashProfit ? 'text-emerald-700 dark:text-emerald-400 print:text-black' : 'text-rose-700 dark:text-rose-400 print:text-black'}`}>{CURRENCY}{fmt(Math.abs(cash.netCashProfit))}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black text-[11px] text-neutral-400">
                Cash Basis: recognizes income when cash is received and expenses when cash is paid. Includes payments for previous months' bills if paid in this period. Generated on {new Date().toLocaleString('en-GB')}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
