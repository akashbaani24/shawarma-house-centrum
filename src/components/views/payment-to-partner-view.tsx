'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Users, ChevronLeft, ChevronRight, Printer, Loader2, FileSpreadsheet, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  todayStr, firstOfMonth, formatLongDate, fmt, CURRENCY,
  shiftMonth, lastOfMonth,
} from './_report-helpers'
import { usePagination, PaginationControls } from '@/components/pagination'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', BANK: 'Bank', MOBILE_BANK: 'Mobile Bank',
}

interface EntryItem {
  id: string; category: string; amount: number; note: string | null
  date: string; paymentMethod: string; source: string
  bankName: string | null; accountNumber: string | null
  creatorName: string | null; creatorEmail: string
}

interface ReportData {
  from: string; to: string; businessName: string; logoUrl: string | null
  entries: EntryItem[]; total: number; count: number
  byCategory: { category: string; amount: number; count: number }[]
  byMonth: { month: string; amount: number }[]
}

export default function PaymentToPartnerView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payment-to-partner?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setReport(data)
      else toast.error(data?.error || 'Failed to load')
    } catch { toast.error('Failed to load report') }
    finally { setLoading(false) }
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
  const handleThisMonth = () => { setFrom(firstOfMonth()); setTo(todayStr()) }

  const fromDateDisplay = formatLongDate(from)
  const toDateDisplay = formatLongDate(to)

  const filteredEntries = useMemo(() => {
    if (!report) return []
    if (!searchText.trim()) return report.entries
    const q = searchText.toLowerCase().trim()
    return report.entries.filter((e) =>
      e.category.toLowerCase().includes(q) ||
      (e.note?.toLowerCase().includes(q) ?? false) ||
      String(e.amount).includes(q) ||
      e.date.includes(q)
    )
  }, [report, searchText])

  const pagination = usePagination(filteredEntries.length)
  const paginatedEntries = filteredEntries.slice(pagination.startIndex, pagination.endIndex)

  const exportColumns = [
    { header: 'Date', key: 'd' },
    { header: 'Category', key: 'c' },
    { header: 'Method', key: 'm' },
    { header: 'Note', key: 'n' },
    { header: 'Amount', key: 'a' },
  ]
  const buildExportRows = () => {
    if (!report) return []
    const rows: (string|number)[][] = []
    filteredEntries.forEach((e) => {
      rows.push([e.date, e.category, METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod, e.note || '', `${CURRENCY}${fmt(e.amount)}`])
    })
    rows.push(['', '', '', 'TOTAL', `${CURRENCY}${fmt(filteredEntries.reduce((s, e) => s + e.amount, 0))}`])
    return rows
  }

  return (
    <div className="space-y-3">
      {/* Date panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 sm:p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Payment to Partner Report</div>
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
            {report && (
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToExcel }) => exportToExcel({
                    businessName: report.businessName, reportTitle: 'Payment to Partner Report',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`, columns: exportColumns, rows: buildExportRows(),
                  }))
                }}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel</Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName, reportTitle: 'Payment to Partner Report',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`, columns: exportColumns, rows: buildExportRows(),
                  }))
                }}><FileText className="h-3.5 w-3.5 mr-1" /> PDF</Button>
              </>
            )}
          </div>
        </div>
        {report && report.entries.length > 0 && (
          <div className="mt-3">
            <Input type="text" placeholder="Search by category, note, amount, date..." value={searchText} onChange={(e) => { setSearchText(e.target.value); pagination.reset(); }} className="text-xs h-8" />
          </div>
        )}
      </div>

      {loading || !report ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 print:hidden">
            <div className="border border-violet-200 dark:border-violet-900 bg-violet-50/60 dark:bg-violet-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-violet-700 dark:text-violet-400">Total Payments</div>
              <div className="text-base font-bold text-violet-700 dark:text-violet-400 tabular-nums">{CURRENCY}{fmt(report.total)}</div>
              <div className="text-[10px] text-neutral-500">{report.count} transaction(s)</div>
            </div>
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-neutral-500">Categories</div>
              <div className="text-base font-bold tabular-nums">{report.byCategory.length}</div>
            </div>
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-neutral-500">Avg per Transaction</div>
              <div className="text-base font-bold tabular-nums">{report.count > 0 ? `${CURRENCY}${fmt(report.total / report.count)}` : '—'}</div>
            </div>
          </div>

          {/* Report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
            <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
              <div className="flex items-center justify-center gap-3 mb-1">
                {report.logoUrl && <img src={report.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />}
                <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{report.businessName}</div>
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">Payment to Partner Report</div>
              <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">{fromDateDisplay} — {toDateDisplay}</div>
            </div>

            {/* Summary by category */}
            {report.byCategory.length > 0 && (
              <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden mb-4">
                <div className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:border-black">
                  <span className="text-[12px] font-bold uppercase tracking-wide">Summary by Category</span>
                </div>
                <Table className="text-[12px]">
                  <TableHeader>
                    <TableRow className="bg-neutral-50 dark:bg-neutral-900">
                      <TableHead className="h-7 px-2 text-[11px] font-semibold">Category</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-semibold text-center w-20">Count</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-32">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byCategory.map((c) => (
                      <TableRow key={c.category}>
                        <TableCell className="py-1.5 px-2 font-medium">{c.category}</TableCell>
                        <TableCell className="py-1.5 px-2 text-center tabular-nums">{c.count}</TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-semibold text-violet-700 dark:text-violet-400">{fmt(c.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-neutral-100 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                      <TableCell className="py-2 px-2 text-[12px] font-bold" colSpan={2}>TOTAL -</TableCell>
                      <TableCell className="py-2 px-2 text-right tabular-nums font-bold">{fmt(report.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* All entries */}
            {filteredEntries.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-sm">No payment to partner entries in this period.</div>
            ) : (
              <>
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:hidden">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900">
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Date</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Category</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Method</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Note</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-28">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="py-1.5 px-2 whitespace-nowrap">{e.date.split('-').reverse().join('/')}</TableCell>
                          <TableCell className="py-1.5 px-2 font-medium">{e.category}</TableCell>
                          <TableCell className="py-1.5 px-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${e.paymentMethod === 'CASH' ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400'}`}>
                              {METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod}{e.bankName ? `: ${e.bankName}` : ''}
                            </span>
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-neutral-500 max-w-[200px] truncate">{e.note || '—'}</TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums font-semibold text-violet-700 dark:text-violet-400">{fmt(e.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-neutral-100 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                        <TableCell className="py-2 px-2 text-[12px] font-bold" colSpan={4}>GRAND TOTAL -</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums font-bold">{fmt(filteredEntries.reduce((s, e) => s + e.amount, 0))}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="print:hidden mt-2">
                  <PaginationControls totalItems={filteredEntries.length} pagination={pagination} />
                </div>

                {/* Print table */}
                <div className="hidden print:block border border-black rounded-sm overflow-hidden">
                  <table className="text-[12px] w-full" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="bg-gray-200 border-b border-black">
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '14%' }}>Date</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '25%' }}>Category</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '18%' }}>Method</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '28%' }}>Note</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '15%' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((e) => (
                        <tr key={e.id} className="border-b border-black print:break-inside-avoid">
                          <td className="py-1 px-2 whitespace-nowrap text-black">{e.date.split('-').reverse().join('/')}</td>
                          <td className="py-1 px-2 font-medium text-black">{e.category}</td>
                          <td className="py-1 px-2 text-black">{METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod}{e.bankName ? `: ${e.bankName}` : ''}</td>
                          <td className="py-1 px-2 text-black">{e.note || '—'}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{fmt(e.amount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-200 border-t-2 border-black">
                        <td className="py-1.5 px-2 text-[12px] font-bold text-black" colSpan={4}>GRAND TOTAL -</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(filteredEntries.reduce((s, e) => s + e.amount, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black text-[11px] text-neutral-400">
              Payment to Partner = profit distribution / owner withdrawal. Not included in P&L or other expense reports. Generated on {new Date().toLocaleString('en-GB')}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
