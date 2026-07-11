'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Receipt, ChevronLeft, ChevronRight, Printer, Loader2, FileSpreadsheet, FileText, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  todayStr, firstOfMonth, formatLongDate, fmt, CURRENCY, METHOD_LABELS,
  shiftMonth, lastOfMonth,
} from './_report-helpers'
import { usePagination, PaginationControls } from '@/components/pagination'

interface PaymentItem {
  id: string
  category: string
  amount: number
  date: string
  source: string
  note: string | null
  paymentMethod: string
  bankName: string | null
  accountNumber: string | null
  supplierName: string | null
  supplierBillNumber: string | null
  creatorName: string | null
  creatorEmail: string
}

interface ReportData {
  from: string; to: string
  businessName: string; logoUrl: string | null
  payments: PaymentItem[]
  total: number
  branchTotal: number
  officeTotal: number
  cashTotal: number
  bankTotal: number
}

export default function PaymentHistoryView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payment-history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&source=${sourceFilter}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setReport(data)
      else toast.error(data?.error || 'Failed to load')
    } catch {
      toast.error('Failed to load payment history')
    } finally {
      setLoading(false)
    }
  }, [from, to, sourceFilter])

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

  // Client-side search filter
  const filteredPayments = useMemo(() => {
    if (!report) return []
    if (!searchText.trim()) return report.payments
    const q = searchText.toLowerCase().trim()
    return report.payments.filter((p) =>
      p.category.toLowerCase().includes(q) ||
      (p.supplierName?.toLowerCase().includes(q) ?? false) ||
      (p.note?.toLowerCase().includes(q) ?? false) ||
      String(p.amount).includes(q) ||
      p.date.includes(q)
    )
  }, [report, searchText])

  const pagination = usePagination(filteredPayments.length)
  const paginatedPayments = filteredPayments.slice(pagination.startIndex, pagination.endIndex)
  const filteredTotal = filteredPayments.reduce((s, p) => s + p.amount, 0)

  const exportColumns = [
    { header: 'Date', key: 'd' },
    { header: 'Paid To', key: 't' },
    { header: 'Branch', key: 'b' },
    { header: 'Purpose', key: 'p' },
    { header: 'Method', key: 'm' },
    { header: 'Bill No', key: 'n' },
    { header: 'Amount', key: 'a' },
  ]
  const buildExportRows = () => {
    if (!report) return []
    const rows: (string|number)[][] = []
    filteredPayments.forEach((p) => {
      rows.push([
        p.date,
        p.supplierName || p.category,
        p.source === 'OFFICE' ? 'Office' : 'Branch',
        p.note || p.category,
        METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod,
        p.supplierBillNumber || '',
        `${CURRENCY}${fmt(p.amount)}`,
      ])
    })
    rows.push(['', '', '', '', '', 'TOTAL', `${CURRENCY}${fmt(filteredTotal)}`])
    return rows
  }

  return (
    <div className="space-y-3">
      {/* Date panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 sm:p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="h-4 w-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Payment History Report</div>
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
            <div>
              <Label className="text-[10px] text-neutral-500 block mb-0.5">Branch</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="BRANCH">Branch</SelectItem>
                  <SelectItem value="OFFICE">Office</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Button variant="outline" size="sm" className="h-8" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
            {report && (
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(({ exportToExcel }) => exportToExcel({
                    businessName: report.businessName, reportTitle: 'Payment History Report',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`, columns: exportColumns, rows: buildExportRows(),
                  }))
                }}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel</Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(async ({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName, reportTitle: 'Payment History Report',
                    logoUrl: report.logoUrl,
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`, columns: exportColumns, rows: buildExportRows(),
                  }))
                }}><FileText className="h-3.5 w-3.5 mr-1" /> PDF</Button>
              </>
            )}
          </div>
        </div>
        {report && report.payments.length > 0 && (
          <div className="mt-3">
            <Input
              type="text"
              placeholder="Search by paid-to, purpose, amount, date..."
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
            <div className="border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Total Payments</div>
              <div className="text-base font-bold text-rose-700 dark:text-rose-400 tabular-nums">{CURRENCY}{fmt(report.total)}</div>
              <div className="text-[10px] text-neutral-500">{report.payments.length} txns</div>
            </div>
            <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Branch Payments</div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{CURRENCY}{fmt(report.branchTotal)}</div>
            </div>
            <div className="border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Office Payments</div>
              <div className="text-base font-bold text-amber-700 dark:text-amber-400 tabular-nums">{CURRENCY}{fmt(report.officeTotal)}</div>
            </div>
            <div className="border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Cash / Bank Split</div>
              <div className="text-base font-bold text-sky-700 dark:text-sky-400 tabular-nums">{CURRENCY}{fmt(report.cashTotal)} / {CURRENCY}{fmt(report.bankTotal)}</div>
            </div>
          </div>

          {/* Report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
            <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
              <div className="flex items-center justify-center gap-3 mb-1">
                {report.logoUrl && <img src={report.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />}
                <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{report.businessName}</div>
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">Payment History Report</div>
              <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">{fromDateDisplay} to {toDateDisplay}</div>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8 text-neutral-300" />
                <p>{report.payments.length === 0 ? 'No payments in this period.' : 'No payments match your search.'}</p>
              </div>
            ) : (
              <>
                {/* On-screen table */}
                <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:hidden">
                  <Table className="text-[12px]">
                    <TableHeader>
                      <TableRow className="bg-neutral-50 dark:bg-neutral-900">
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Date</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Paid To</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-center w-16">Branch</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Purpose</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold">Method</TableHead>
                        <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-28">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="py-1.5 px-2 whitespace-nowrap">{p.date.split('-').reverse().join('/')}</TableCell>
                          <TableCell className="py-1.5 px-2 font-medium">{p.supplierName || p.category}</TableCell>
                          <TableCell className="py-1.5 px-2 text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.source === 'OFFICE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'}`}>
                              {p.source === 'OFFICE' ? 'Office' : 'Branch'}
                            </span>
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-neutral-500 max-w-[200px] truncate">
                            {p.note || p.category}
                            {p.supplierBillNumber && <span className="ml-1 text-[10px] text-sky-600">[{p.supplierBillNumber}]</span>}
                          </TableCell>
                          <TableCell className="py-1.5 px-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.paymentMethod === 'CASH' ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400'}`}>
                              {METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                              {p.bankName ? `: ${p.bankName}` : ''}
                            </span>
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums font-semibold text-rose-700 dark:text-rose-400">{fmt(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-neutral-100 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                        <TableCell className="py-2 px-2 text-[12px] font-bold" colSpan={5}>GRAND TOTAL -</TableCell>
                        <TableCell className="py-2 px-2 text-right tabular-nums font-bold">{fmt(filteredTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="print:hidden mt-2">
                  <PaginationControls totalItems={filteredPayments.length} pagination={pagination} />
                </div>

                {/* Print table */}
                <div className="hidden print:block border border-black rounded-sm overflow-hidden">
                  <table className="text-[12px] w-full" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="bg-gray-200 border-b border-black">
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '12%' }}>Date</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '22%' }}>Paid To</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-center" style={{ width: '8%' }}>Branch</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '28%' }}>Purpose</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '15%' }}>Method</th>
                        <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '15%' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="border-b border-black print:break-inside-avoid">
                          <td className="py-1 px-2 whitespace-nowrap text-black">{p.date.split('-').reverse().join('/')}</td>
                          <td className="py-1 px-2 font-medium text-black">{p.supplierName || p.category}</td>
                          <td className="py-1 px-2 text-center text-black">{p.source === 'OFFICE' ? 'Office' : 'Branch'}</td>
                          <td className="py-1 px-2 text-black">{p.note || p.category}{p.supplierBillNumber ? ` [${p.supplierBillNumber}]` : ''}</td>
                          <td className="py-1 px-2 text-black">{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}{p.bankName ? `: ${p.bankName}` : ''}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-black">{fmt(p.amount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-200 border-t-2 border-black">
                        <td className="py-1.5 px-2 text-[12px] font-bold text-black" colSpan={5}>GRAND TOTAL -</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(filteredTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div className="text-neutral-500">Generated on {new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
