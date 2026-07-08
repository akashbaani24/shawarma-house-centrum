'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Truck, Printer, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
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

interface SupplierOption {
  id: string
  name: string
}

interface BillItem {
  id: string
  billDate: string
  billNumber: string | null
  billAmount: number
  paidAmount: number
  note: string | null
  supplier: { id: string; name: string }
}

interface ReportData {
  from: string
  to: string
  businessName: string
  logoUrl: string | null
  bills: BillItem[]
  suppliers: SupplierOption[]
  totalBillAmount: number
  totalPaidAmount: number
  totalDueAmount: number
}

export default function SupplierReportView() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [supplierId, setSupplierId] = useState<string>('all')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, supplierId })
      const res = await fetch(`/api/supplier-report?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setReport(data)
      } else {
        toast.error(data?.error || 'Failed to load')
      }
    } catch {
      toast.error('Failed to load supplier report')
    } finally {
      setLoading(false)
    }
  }, [from, to, supplierId])

  useEffect(() => {
    load()
  }, [load])

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

  return (
    <div className="space-y-4">
      {/* Date panel + supplier filter */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4 print:hidden">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-neutral-400" />
            <div>
              <div className="text-sm sm:text-base font-semibold">Supplier Report</div>
              <div className="text-xs text-neutral-500">{formatLongDate(from)} — {formatLongDate(to)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs text-neutral-500">From Date</Label>
              <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-[140px]" />
            </div>
            <div>
              <Label className="text-xs text-neutral-500">To Date</Label>
              <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-[140px]" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs text-neutral-500">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {report?.suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleThisMonth}>
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
            <Card className="border-sky-200 bg-sky-50/60 dark:bg-sky-950/30 dark:border-sky-900">
              <CardHeader className="pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-sky-700 dark:text-sky-400">Total Bill Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-sky-700 dark:text-sky-400">{CURRENCY}{fmt(report.totalBillAmount)}</div>
                <p className="text-xs text-neutral-500 mt-1">{report.bills.length} bills</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900">
              <CardHeader className="pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Total Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{CURRENCY}{fmt(report.totalPaidAmount)}</div>
              </CardContent>
            </Card>
            <Card className="border-rose-200 bg-rose-50/60 dark:bg-rose-950/30 dark:border-rose-900">
              <CardHeader className="pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-rose-700 dark:text-rose-400">Total Due</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-rose-700 dark:text-rose-400">{CURRENCY}{fmt(report.totalDueAmount)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Report sheet */}
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-3 sm:p-6 print:border-black print:p-2 shadow-sm">
            {/* Header */}
            <div className="flex items-start sm:items-end justify-between gap-2 border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black pb-2 mb-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {report.logoUrl && (
                  <img src={report.logoUrl} alt="Logo" className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded shrink-0" />
                )}
                <div className="text-base sm:text-2xl font-bold tracking-tight leading-tight">{report.businessName}</div>
              </div>
              <div className="text-xs sm:text-sm shrink-0">
                <div className="text-neutral-500">Supplier Report</div>
                <div className="font-semibold tabular-nums">{fromDateDisplay} — {toDateDisplay}</div>
              </div>
            </div>

            {/* Bills table */}
            <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-x-auto print:border-black">
              <Table className="text-[11px] sm:text-sm">
                <TableHeader>
                  <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                    <TableHead className="h-8 px-2 text-xs font-semibold whitespace-nowrap">Bill Date</TableHead>
                    <TableHead className="h-8 px-2 text-xs font-semibold">Supplier Name</TableHead>
                    <TableHead className="h-8 px-2 text-xs font-semibold">Bill Number</TableHead>
                    <TableHead className="h-8 px-2 text-xs font-semibold text-right">Bill Amount</TableHead>
                    <TableHead className="h-8 px-2 text-xs font-semibold text-right">Paid Amount</TableHead>
                    <TableHead className="h-8 px-2 text-xs font-semibold text-right">Due Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.bills.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 px-2 text-center text-neutral-400">
                        No supplier bills in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.bills.map((b) => {
                      const due = b.billAmount - b.paidAmount
                      return (
                        <TableRow key={b.id} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                          <TableCell className="py-1.5 px-2 whitespace-nowrap">{b.billDate.split('-').reverse().join('/')}</TableCell>
                          <TableCell className="py-1.5 px-2 font-medium">{b.supplier.name}</TableCell>
                          <TableCell className="py-1.5 px-2 text-neutral-500">{b.billNumber || '—'}</TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums">{fmt(b.billAmount)}</TableCell>
                          <TableCell className="py-1.5 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(b.paidAmount)}</TableCell>
                          <TableCell className={`py-1.5 px-2 text-right tabular-nums font-semibold ${due > 0 ? 'text-rose-700 dark:text-rose-400' : ''}`}>
                            {fmt(due)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                  {/* Total row */}
                  <TableRow className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 border-t-2 border-neutral-800 dark:border-neutral-200 print:border-black">
                    <TableCell colSpan={3} className="py-2 px-2 text-sm font-bold text-right">Total —</TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums font-bold">{fmt(report.totalBillAmount)}</TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">{fmt(report.totalPaidAmount)}</TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums font-bold text-rose-700 dark:text-rose-400">{fmt(report.totalDueAmount)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-neutral-300 dark:border-neutral-700 print:border-black flex items-center justify-between text-[11px]">
              <div className="text-neutral-500">
                {supplierId === 'all' ? 'All Suppliers' : report.suppliers.find((s) => s.id === supplierId)?.name || '—'}
              </div>
              <div className="text-neutral-400 text-[10px]">
                Generated on {new Date().toLocaleString('en-GB')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
