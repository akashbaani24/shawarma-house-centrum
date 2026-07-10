'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Truck, ChevronLeft, ChevronRight, Printer, Loader2, FileSpreadsheet, FileText, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  todayStr, firstOfMonth, formatLongDate, fmt, CURRENCY,
  shiftMonth, lastOfMonth,
} from './_report-helpers'
import { usePagination, PaginationControls } from '@/components/pagination'

interface SupplierRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  billCount: number
  totalBill: number
  totalPaid: number
  due: number
  lastBillDate: string | null
}

interface ReportData {
  from: string; to: string
  businessName: string; logoUrl: string | null
  suppliers: SupplierRow[]
  grandTotalBill: number
  grandTotalPaid: number
  grandDue: number
}

export default function SupplierDueView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/supplier-due?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setReport(data)
      else toast.error(data?.error || 'Failed to load')
    } catch {
      toast.error('Failed to load supplier due report')
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

  // Sort suppliers by due DESC (most due first) and filter to those with bills
  const sortedSuppliers = (report?.suppliers ?? [])
    .filter((s) => s.billCount > 0 || s.due > 0)
    .sort((a, b) => b.due - a.due)
  const pagination = usePagination(sortedSuppliers.length)
  const paginatedSuppliers = sortedSuppliers.slice(pagination.startIndex, pagination.endIndex)

  const exportColumns = [
    { header: 'Supplier', key: 's' },
    { header: 'Bills', key: 'n' },
    { header: 'Total Bill', key: 'b' },
    { header: 'Total Paid', key: 'p' },
    { header: 'Due', key: 'd' },
  ]
  const buildExportRows = () => {
    if (!report) return []
    const rows: (string|number)[][] = []
    sortedSuppliers.forEach((s) => {
      rows.push([s.name, String(s.billCount), `${CURRENCY}${fmt(s.totalBill)}`, `${CURRENCY}${fmt(s.totalPaid)}`, `${CURRENCY}${fmt(s.due)}`])
    })
    rows.push(['TOTAL', '', `${CURRENCY}${fmt(report.grandTotalBill)}`, `${CURRENCY}${fmt(report.grandTotalPaid)}`, `${CURRENCY}${fmt(report.grandDue)}`])
    return rows
  }

  return (
    <div className="space-y-3">
      {/* Date panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 sm:p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Truck className="h-4 w-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Supplier Due Report</div>
              <div className="text-[11px] text-neutral-500 tabular-nums truncate">{formatLongDate(from)} — {formatLongDate(to)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={handleThisMonth}>This Month</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
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
                    businessName: report.businessName, reportTitle: 'Supplier Due Report',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`, columns: exportColumns, rows: buildExportRows(),
                  }))
                }}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel</Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName, reportTitle: 'Supplier Due Report',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`, columns: exportColumns, rows: buildExportRows(),
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
          <div className="grid grid-cols-3 gap-2 print:hidden">
            <div className="border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Total Bill</div>
              <div className="text-base font-bold text-sky-700 dark:text-sky-400 tabular-nums">{CURRENCY}{fmt(report.grandTotalBill)}</div>
            </div>
            <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Total Paid</div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{CURRENCY}{fmt(report.grandTotalPaid)}</div>
            </div>
            <div className="border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Total Due</div>
              <div className="text-base font-bold text-rose-700 dark:text-rose-400 tabular-nums">{CURRENCY}{fmt(report.grandDue)}</div>
            </div>
          </div>

          {/* Report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
            <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
              <div className="flex items-center justify-center gap-3 mb-1">
                {report.logoUrl && <img src={report.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />}
                <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{report.businessName}</div>
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">Supplier Due Report</div>
              <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">{fromDateDisplay} to {toDateDisplay}</div>
            </div>

            {sortedSuppliers.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8 text-neutral-300" />
                <p>No supplier bills in this period.</p>
              </div>
            ) : (
              <>
                {/* On-screen table */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:hidden">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900">
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Supplier</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-center w-16">Bills</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-28">Total Bill</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-28">Total Paid</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-28">Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSuppliers.map((s) => (
                        <TableRow key={s.id} className={s.due > 0 ? '' : 'opacity-60'}>
                          <TableCell className="py-1.5 px-2 font-medium">{s.name}</TableCell>
                          <TableCell className="py-1.5 px-2 text-center tabular-nums">{s.billCount}</TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums">{fmt(s.totalBill)}</TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(s.totalPaid)}</TableCell>
                          <TableCell className={`py-1.5 px-2 text-right tabular-nums font-semibold ${s.due > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-neutral-500'}`}>{fmt(s.due)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-neutral-100 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                        <TableCell className="py-2 px-2 text-[12px] font-bold" colSpan={2}>GRAND TOTAL -</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums font-bold">{fmt(report.grandTotalBill)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">{fmt(report.grandTotalPaid)}</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums font-bold text-rose-700 dark:text-rose-400">{fmt(report.grandDue)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="print:hidden mt-2">
                  <PaginationControls totalItems={sortedSuppliers.length} pagination={pagination} />
                </div>

                {/* Print table */}
                <div className="hidden print:block border border-black rounded-sm overflow-hidden">
                  <table className="text-[12px] w-full" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="bg-gray-200 border-b border-black">
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '40%' }}>Supplier</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-center" style={{ width: '10%' }}>Bills</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '17%' }}>Total Bill</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '17%' }}>Total Paid</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '16%' }}>Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSuppliers.map((s) => (
                        <tr key={s.id} className="border-b border-black print:break-inside-avoid">
                          <td className="py-1 px-2 font-medium text-black">{s.name}</td>
                          <td className="py-1 px-2 text-center tabular-nums text-black">{s.billCount}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{fmt(s.totalBill)}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{fmt(s.totalPaid)}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{fmt(s.due)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-200 border-t-2 border-black">
                        <td className="py-1.5 px-2 text-[12px] font-bold text-black" colSpan={2}>GRAND TOTAL -</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(report.grandTotalBill)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(report.grandTotalPaid)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(report.grandDue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div className="text-neutral-500">Sorted by Due (highest first). Generated on {new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
