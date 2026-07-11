'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Landmark, ChevronLeft, ChevronRight, Printer, Loader2, FileSpreadsheet, FileText, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  todayStr, firstOfMonth, formatLongDate, fmt, CURRENCY, METHOD_LABELS,
  shiftMonth, lastOfMonth,
} from './_report-helpers'
import { usePagination, PaginationControls } from '@/components/pagination'

interface DepositItem {
  id: string
  category: string
  amount: number
  date: string
  source: string
  note: string | null
  paymentMethod: string
  bankName: string | null
  accountNumber: string | null
  creatorName: string | null
}

interface DateGroup {
  date: string
  branch: number
  office: number
  total: number
  count: number
}

interface TypeItem { category: string; amount: number }

interface ReportData {
  from: string; to: string
  businessName: string; logoUrl: string | null
  deposits: DepositItem[]
  branchDeposits: DepositItem[]
  officeDeposits: DepositItem[]
  branchTotal: number
  officeTotal: number
  dateWise: DateGroup[]
  typeWise: TypeItem[]
  totalDeposits: number
}

export default function DepositReportView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'summary' | 'detail'>('summary')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deposit-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setReport(data)
      else toast.error(data?.error || 'Failed to load')
    } catch {
      toast.error('Failed to load deposit report')
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

  const filteredDeposits = useMemo(() => report?.deposits ?? [], [report])
  const pagination = usePagination(filteredDeposits.length)
  const paginatedDeposits = filteredDeposits.slice(pagination.startIndex, pagination.endIndex)

  const exportColumns = [
    { header: 'Date', key: 'd' },
    { header: 'Type', key: 't' },
    { header: 'Branch', key: 'b' },
    { header: 'Bank', key: 'k' },
    { header: 'Note', key: 'n' },
    { header: 'Amount', key: 'a' },
  ]
  const buildExportRows = () => {
    if (!report) return []
    const rows: (string|number)[][] = []
    filteredDeposits.forEach((d) => {
      rows.push([
        d.date,
        d.category,
        d.source === 'OFFICE' ? 'Office' : 'Branch',
        d.bankName || '',
        d.note || '',
        `${CURRENCY}${fmt(d.amount)}`,
      ])
    })
    rows.push(['', '', '', '', 'TOTAL', `${CURRENCY}${fmt(report.totalDeposits)}`])
    return rows
  }

  return (
    <div className="space-y-3">
      {/* Date panel */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 sm:p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Landmark className="h-4 w-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Deposit Report</div>
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
                    businessName: report.businessName, reportTitle: 'Deposit Report',
                    dateRange: `${fromDateDisplay} to ${toDateDisplay}`, columns: exportColumns, rows: buildExportRows(),
                  }))
                }}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel</Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  import('@/lib/export-utils').then(async ({ exportToPDF }) => exportToPDF({
                    businessName: report.businessName, reportTitle: 'Deposit Report',
                    logoUrl: report.logoUrl,
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
            <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Branch Deposits</div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{CURRENCY}{fmt(report.branchTotal)}</div>
              <div className="text-[10px] text-neutral-500">{report.branchDeposits.length} txns</div>
            </div>
            <div className="border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Office Deposits</div>
              <div className="text-base font-bold text-amber-700 dark:text-amber-400 tabular-nums">{CURRENCY}{fmt(report.officeTotal)}</div>
              <div className="text-[10px] text-neutral-500">{report.officeDeposits.length} txns</div>
            </div>
            <div className="border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30 rounded-md px-3 py-2">
              <div className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Total Deposits</div>
              <div className="text-base font-bold text-sky-700 dark:text-sky-400 tabular-nums">{CURRENCY}{fmt(report.totalDeposits)}</div>
              <div className="text-[10px] text-neutral-500">{report.deposits.length} txns</div>
            </div>
          </div>

          {/* Report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-5 print:border-black print:p-4 shadow-sm w-full">
            <div className="text-center pb-3 mb-4 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black">
              <div className="flex items-center justify-center gap-3 mb-1">
                {report.logoUrl && <img src={report.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded shrink-0" />}
                <div className="text-lg sm:text-xl font-bold tracking-tight uppercase">{report.businessName}</div>
              </div>
              <div className="text-sm font-semibold uppercase tracking-wide">Deposit Report</div>
              <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">{fromDateDisplay} to {toDateDisplay}</div>
            </div>

            {report.deposits.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8 text-neutral-300" />
                <p>No deposits in this period.</p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'summary' | 'detail')}>
                <TabsList className="grid grid-cols-2 w-full mb-3 print:hidden">
                  <TabsTrigger value="summary">Summary (Branch / Office / Date / Type)</TabsTrigger>
                  <TabsTrigger value="detail">All Deposit Entries</TabsTrigger>
                </TabsList>

                {/* Summary tab — shows branch, office, date-wise, type-wise breakdowns */}
                <TabsContent value="summary">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Date-wise */}
                    <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden">
                      <div className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:border-black">
                        <span className="text-[12px] font-bold uppercase tracking-wide">Date-wise Deposit</span>
                      </div>
                      <Table className="text-[12px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-7 px-2 text-[11px] font-semibold">Date</TableHead>
                            <TableHead className="h-7 px-2 text-[11px] font-semibold text-right">Branch</TableHead>
                            <TableHead className="h-7 px-2 text-[11px] font-semibold text-right">Office</TableHead>
                            <TableHead className="h-7 px-2 text-[11px] font-semibold text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.dateWise.map((d) => (
                            <TableRow key={d.date}>
                              <TableCell className="py-1 px-2 whitespace-nowrap">{d.date.split('-').reverse().join('/')}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums">{d.branch ? fmt(d.branch) : '—'}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums">{d.office ? fmt(d.office) : '—'}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums font-semibold">{fmt(d.total)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-neutral-50 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                            <TableCell className="py-1.5 px-2 text-[12px] font-bold">TOTAL -</TableCell>
                            <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">{fmt(report.branchTotal)}</TableCell>
                            <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">{fmt(report.officeTotal)}</TableCell>
                            <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">{fmt(report.totalDeposits)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Type-wise */}
                    <div className="border border-neutral-300 dark:border-neutral-700 print:border-black rounded-sm overflow-hidden">
                      <div className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:border-black">
                        <span className="text-[12px] font-bold uppercase tracking-wide">Type-wise Deposit</span>
                      </div>
                      <Table className="text-[12px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-7 px-2 text-[11px] font-semibold">Deposit Type</TableHead>
                            <TableHead className="h-7 px-2 text-[11px] font-semibold text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.typeWise.map((t) => (
                            <TableRow key={t.category}>
                              <TableCell className="py-1 px-2">{t.category}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums font-semibold">{fmt(t.amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-neutral-50 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                            <TableCell className="py-1.5 px-2 text-[12px] font-bold">TOTAL -</TableCell>
                            <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">{fmt(report.totalDeposits)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                {/* Detail tab */}
                <TabsContent value="detail">
                  <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden print:hidden">
                    <Table className="text-[12px]">
                      <TableHeader>
                        <TableRow className="bg-neutral-50 dark:bg-neutral-900">
                          <TableHead className="h-7 px-2 text-[11px] font-semibold">Date</TableHead>
                          <TableHead className="h-7 px-2 text-[11px] font-semibold">Type</TableHead>
                          <TableHead className="h-7 px-2 text-[11px] font-semibold text-center w-16">Branch</TableHead>
                          <TableHead className="h-7 px-2 text-[11px] font-semibold">Bank</TableHead>
                          <TableHead className="h-7 px-2 text-[11px] font-semibold">Note</TableHead>
                          <TableHead className="h-7 px-2 text-[11px] font-semibold text-right w-28">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedDeposits.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="py-1.5 px-2 whitespace-nowrap">{d.date.split('-').reverse().join('/')}</TableCell>
                            <TableCell className="py-1.5 px-2 font-medium">{d.category}</TableCell>
                            <TableCell className="py-1.5 px-2 text-center">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${d.source === 'OFFICE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'}`}>
                                {d.source === 'OFFICE' ? 'Office' : 'Branch'}
                              </span>
                            </TableCell>
                            <TableCell className="py-1.5 px-2 text-neutral-500">{d.bankName || '—'}</TableCell>
                            <TableCell className="py-1.5 px-2 text-neutral-500 max-w-[180px] truncate">{d.note || '—'}</TableCell>
                            <TableCell className="py-1.5 px-2 text-right tabular-nums font-semibold text-sky-700 dark:text-sky-400">{fmt(d.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-neutral-100 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                          <TableCell className="py-2 px-2 text-[12px] font-bold" colSpan={5}>GRAND TOTAL -</TableCell>
                          <TableCell className="py-2 px-2 text-right tabular-nums font-bold">{fmt(report.totalDeposits)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div className="print:hidden mt-2">
                    <PaginationControls totalItems={filteredDeposits.length} pagination={pagination} />
                  </div>

                  {/* Print table */}
                  <div className="hidden print:block border border-black rounded-sm overflow-hidden">
                    <table className="text-[12px] w-full" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr className="bg-gray-200 border-b border-black">
                          <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '12%' }}>Date</th>
                          <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '22%' }}>Type</th>
                          <th className="py-1 px-2 text-[11px] font-semibold text-center" style={{ width: '10%' }}>Branch</th>
                          <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '20%' }}>Bank</th>
                          <th className="py-1 px-2 text-[11px] font-semibold text-left" style={{ width: '23%' }}>Note</th>
                          <th className="py-1 px-2 text-[11px] font-semibold text-right" style={{ width: '13%' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDeposits.map((d) => (
                          <tr key={d.id} className="border-b border-black print:break-inside-avoid">
                            <td className="py-1 px-2 whitespace-nowrap text-black">{d.date.split('-').reverse().join('/')}</td>
                            <td className="py-1 px-2 font-medium text-black">{d.category}</td>
                            <td className="py-1 px-2 text-center text-black">{d.source === 'OFFICE' ? 'Office' : 'Branch'}</td>
                            <td className="py-1 px-2 text-black">{d.bankName || '—'}</td>
                            <td className="py-1 px-2 text-black">{d.note || '—'}</td>
                            <td className="py-1 px-2 text-right tabular-nums text-black">{fmt(d.amount)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-200 border-t-2 border-black">
                          <td className="py-1.5 px-2 text-[12px] font-bold text-black" colSpan={5}>GRAND TOTAL -</td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-bold text-black">{fmt(report.totalDeposits)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
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
