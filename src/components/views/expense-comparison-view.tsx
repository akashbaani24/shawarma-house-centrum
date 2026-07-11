'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart3, ChevronLeft, ChevronRight, Printer, Loader2, FileSpreadsheet, FileText, AlertCircle, ArrowUp, ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  todayStr, firstOfMonth, formatLongDate, fmt, fmtSigned, fmtPct, CURRENCY,
  shiftMonth, lastOfMonth,
} from './_report-helpers'
import { usePagination, PaginationControls } from '@/components/pagination'

interface HeadRow {
  head: string
  lastPeriod: number
  thisPeriod: number
  difference: number
  changePct: number | null
}

interface ReportData {
  lastPeriod: { from: string; to: string }
  thisPeriod: { from: string; to: string }
  businessName: string
  logoUrl: string | null
  heads: HeadRow[]
  totals: { lastPeriod: number; thisPeriod: number; difference: number; changePct: number | null }
}

export default function ExpenseComparisonView() {
  // Two date ranges — Last Period vs This Period
  // Defaults: This Period = this month (1st → today), Last Period = last full month
  const initialThis = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: todayStr() }
  }
  const initialLast = () => {
    const d = new Date()
    const s = shiftMonth(d.getFullYear(), d.getMonth() + 1, -1)
    return { from: `${s.year}-${String(s.month).padStart(2, '0')}-01`, to: lastOfMonth(s.year, s.month) }
  }

  const [lastFrom, setLastFrom] = useState(initialLast().from)
  const [lastTo, setLastTo] = useState(initialLast().to)
  const [thisFrom, setThisFrom] = useState(initialThis().from)
  const [thisTo, setThisTo] = useState(initialThis().to)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ lastFrom, lastTo, thisFrom, thisTo })
      const res = await fetch(`/api/expense-comparison?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setReport(data)
      else toast.error(data?.error || 'Failed to load')
    } catch {
      toast.error('Failed to load expense comparison')
    } finally {
      setLoading(false)
    }
  }, [lastFrom, lastTo, thisFrom, thisTo])

  useEffect(() => { load() }, [load])

  // Prev / This / Next month buttons shift BOTH periods by 1 month together
  // — this is a convenience for the common case of "compare month X vs month X-1".
  // The user can still override any individual date manually.
  const shiftBoth = (deltaMonths: number) => {
    // Parse "thisFrom" to get the anchor month
    const [ty, tm] = thisFrom.split('-').map(Number)
    const thisS = shiftMonth(ty, tm, deltaMonths)
    const thisFromNew = `${thisS.year}-${String(thisS.month).padStart(2, '0')}-01`
    const thisToNew = lastOfMonth(thisS.year, thisS.month)
    // Last period = month immediately before the new "this" month
    const lastS = shiftMonth(thisS.year, thisS.month, -1)
    const lastFromNew = `${lastS.year}-${String(lastS.month).padStart(2, '0')}-01`
    const lastToNew = lastOfMonth(lastS.year, lastS.month)
    setLastFrom(lastFromNew)
    setLastTo(lastToNew)
    setThisFrom(thisFromNew)
    setThisTo(thisToNew)
  }

  const handlePrev = () => shiftBoth(-1)
  const handleNext = () => shiftBoth(+1)
  const handleThis = () => {
    const t = initialThis()
    const l = initialLast()
    setLastFrom(l.from)
    setLastTo(l.to)
    setThisFrom(t.from)
    setThisTo(t.to)
  }

  // Filtered heads (by search)
  const filteredHeads = useMemo(() => {
    if (!report) return []
    if (!searchText.trim()) return report.heads
    const q = searchText.toLowerCase().trim()
    return report.heads.filter((h) => h.head.toLowerCase().includes(q))
  }, [report, searchText])

  const pagination = usePagination(filteredHeads.length)
  const paginatedHeads = filteredHeads.slice(pagination.startIndex, pagination.endIndex)

  const exportColumns = [
    { header: 'Head', key: 'h' },
    { header: 'Last Period', key: 'l' },
    { header: 'This Period', key: 't' },
    { header: 'Difference', key: 'd' },
    { header: 'Change %', key: 'p' },
  ]
  const buildExportRows = () => {
    if (!report) return []
    const rows: (string|number)[][] = []
    filteredHeads.forEach((h) => {
      rows.push([
        h.head,
        `${CURRENCY}${fmt(h.lastPeriod)}`,
        `${CURRENCY}${fmt(h.thisPeriod)}`,
        `${CURRENCY}${fmt(h.difference)}`,
        h.changePct === null ? '—' : `${h.changePct > 0 ? '+' : ''}${h.changePct.toFixed(1)}%`,
      ])
    })
    rows.push([
      'TOTAL',
      `${CURRENCY}${fmt(report.totals.lastPeriod)}`,
      `${CURRENCY}${fmt(report.totals.thisPeriod)}`,
      `${CURRENCY}${fmt(report.totals.difference)}`,
      report.totals.changePct === null ? '—' : `${report.totals.changePct > 0 ? '+' : ''}${report.totals.changePct.toFixed(1)}%`,
    ])
    return rows
  }

  const lastPeriodLabel = report ? `${formatLongDate(lastFrom)} — ${formatLongDate(lastTo)}` : ''
  const thisPeriodLabel = report ? `${formatLongDate(thisFrom)} — ${formatLongDate(thisTo)}` : ''
  const dateRangeLabel = `${thisPeriodLabel} vs ${lastPeriodLabel}`

  return (
    <div className="space-y-3">
      {/* Date panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 sm:p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="h-4 w-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Expense Comparison Report</div>
              <div className="text-[11px] text-neutral-500 truncate">Last Period vs This Period</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrev} aria-label="Shift both periods back by 1 month"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={handleThis}>This Month</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNext} aria-label="Shift both periods forward by 1 month"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* Last Period */}
          <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20 p-2">
            <div className="text-[10px] font-medium text-sky-700 dark:text-sky-400 mb-1">Last Period</div>
            <div className="flex items-end gap-1.5">
              <div>
                <Label className="text-[10px] text-neutral-500 block mb-0.5">From</Label>
                <Input type="date" value={lastFrom} onChange={(e) => e.target.value && setLastFrom(e.target.value)} className="w-[130px] h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] text-neutral-500 block mb-0.5">To</Label>
                <Input type="date" value={lastTo} onChange={(e) => e.target.value && setLastTo(e.target.value)} className="w-[130px] h-8 text-xs" />
              </div>
            </div>
          </div>
          {/* This Period */}
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 p-2">
            <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">This Period</div>
            <div className="flex items-end gap-1.5">
              <div>
                <Label className="text-[10px] text-neutral-500 block mb-0.5">From</Label>
                <Input type="date" value={thisFrom} onChange={(e) => e.target.value && setThisFrom(e.target.value)} className="w-[130px] h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] text-neutral-500 block mb-0.5">To</Label>
                <Input type="date" value={thisTo} onChange={(e) => e.target.value && setThisTo(e.target.value)} className="w-[130px] h-8 text-xs" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Button variant="outline" size="sm" className="h-8" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
            {report && (
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToExcel }) => exportToExcel({
                    businessName: report.businessName, reportTitle: 'Expense Comparison Report',
                    dateRange: dateRangeLabel, columns: exportColumns, rows: buildExportRows(),
                  }))
                }}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel</Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName, reportTitle: 'Expense Comparison Report',
                    dateRange: dateRangeLabel, columns: exportColumns, rows: buildExportRows(),
                  }))
                }}><FileText className="h-3.5 w-3.5 mr-1" /> PDF</Button>
              </>
            )}
          </div>
        </div>
        {report && report.heads.length > 0 && (
          <div className="mt-3">
            <Input
              type="text"
              placeholder="Search by expense head..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); pagination.reset(); }}
              className="text-xs"
            />
          </div>
        )}
      </div>

      {loading || !report ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 print:hidden">
            <div className="border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Last Period</div>
              <div className="text-[10px] text-neutral-500 tabular-nums">{lastPeriodLabel}</div>
              <div className="text-base font-bold text-sky-700 dark:text-sky-400 tabular-nums mt-0.5">{CURRENCY}{fmt(report.totals.lastPeriod)}</div>
            </div>
            <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">This Period</div>
              <div className="text-[10px] text-neutral-500 tabular-nums">{thisPeriodLabel}</div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">{CURRENCY}{fmt(report.totals.thisPeriod)}</div>
            </div>
            <div className={`border rounded-md px-3 py-2 ${report.totals.difference > 0 ? 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30' : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30'}`}>
              <div className={`text-[11px] font-medium ${report.totals.difference > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                Difference {report.totals.difference > 0 ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />}
              </div>
              <div className="text-[10px] text-neutral-500">This − Last</div>
              <div className={`text-base font-bold tabular-nums mt-0.5 ${report.totals.difference > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {fmtSigned(report.totals.difference)}
              </div>
            </div>
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-neutral-500">Change %</div>
              <div className="text-[10px] text-neutral-500">vs Last Period</div>
              <div className={`text-base font-bold tabular-nums mt-0.5 ${report.totals.changePct === null ? 'text-neutral-500' : report.totals.changePct > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {fmtPct(report.totals.changePct)}
              </div>
            </div>
          </div>

          {/* Report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
            <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
              <div className="flex items-center justify-center gap-3 mb-1">
                {report.logoUrl && <img src={report.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />}
                <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{report.businessName}</div>
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">Expense Comparison Report</div>
              <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">This: {thisPeriodLabel} · vs · Last: {lastPeriodLabel}</div>
            </div>

            {filteredHeads.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8 text-neutral-300" />
                <p>{report.heads.length === 0 ? 'No expense entries in either period.' : 'No heads match your search.'}</p>
              </div>
            ) : (
              <>
                {/* On-screen table */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:hidden">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900">
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Head</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-32">Last Period</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-32">This Period</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-32">Difference</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-20">Change %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHeads.map((h) => (
                        <TableRow key={h.head}>
                          <TableCell className="py-1.5 px-2 font-medium">{h.head}</TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{h.lastPeriod ? fmt(h.lastPeriod) : '—'}</TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums font-semibold">{h.thisPeriod ? fmt(h.thisPeriod) : '—'}</TableCell>
                          <TableCell className={`py-1.5 px-2 text-right tabular-nums font-semibold ${h.difference > 0 ? 'text-rose-700 dark:text-rose-400' : h.difference < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-500'}`}>
                            {h.difference === 0 ? '—' : fmtSigned(h.difference)}
                          </TableCell>
                          <TableCell className={`py-1.5 px-2 text-right tabular-nums ${h.changePct === null ? 'text-neutral-400' : h.changePct > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {fmtPct(h.changePct)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-neutral-100 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                        <TableCell className="py-2 px-2 text-[12px] font-bold">TOTAL -</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums font-bold">{fmt(report.totals.lastPeriod)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums font-bold">{fmt(report.totals.thisPeriod)}</TableCell>
                        <TableCell className={`py-2 px-2 text-right tabular-nums font-bold ${report.totals.difference > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {fmtSigned(report.totals.difference)}
                        </TableCell>
                        <TableCell className={`py-2 px-2 text-right tabular-nums font-bold ${report.totals.changePct === null ? 'text-neutral-500' : report.totals.changePct > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {fmtPct(report.totals.changePct)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="print:hidden mt-2">
                  <PaginationControls totalItems={filteredHeads.length} pagination={pagination} />
                </div>

                {/* Print table */}
                <div className="hidden print:block border border-black rounded-sm overflow-hidden">
                  <table className="text-[12px] w-full" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="bg-gray-200 border-b border-black">
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '36%' }}>Head</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '16%' }}>Last Period</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '16%' }}>This Period</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '16%' }}>Difference</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '16%' }}>Change %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHeads.map((h) => (
                        <tr key={h.head} className="border-b border-black print:break-inside-avoid">
                          <td className="py-1 px-2 font-medium text-black">{h.head}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{h.lastPeriod ? fmt(h.lastPeriod) : '—'}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{h.thisPeriod ? fmt(h.thisPeriod) : '—'}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{h.difference === 0 ? '—' : fmtSigned(h.difference)}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{fmtPct(h.changePct)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-200 border-t-2 border-black">
                        <td className="py-1.5 px-2 text-[12px] font-bold text-black">TOTAL -</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(report.totals.lastPeriod)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(report.totals.thisPeriod)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmtSigned(report.totals.difference)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmtPct(report.totals.changePct)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div className="text-neutral-500">
                <span className="text-rose-600">↑ Red = increase</span>
                <span className="mx-2 text-neutral-300">·</span>
                <span className="text-emerald-600">↓ Green = decrease</span>
              </div>
              <div className="text-neutral-400">Generated on {new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
