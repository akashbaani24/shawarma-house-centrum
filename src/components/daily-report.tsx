'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Save, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'

// ---------- Sections config (matches reference report) ----------

type SectionKey =
  | 'RECEIPTS'
  | 'SALES'
  | 'DENOMINATION'
  | 'EXPENSES'
  | 'ADVANCES'
  | 'PAYMENTS'
  | 'DEPOSITS'

interface SectionDef {
  key: SectionKey
  label: string
  column: 'left' | 'right'
  particulars: string[]
  allowCustom?: boolean
}

const SECTIONS: SectionDef[] = [
  {
    key: 'RECEIPTS',
    label: 'Receipts / Incomes',
    column: 'left',
    particulars: [
      'Opening Cash Balance',
      'Received from Hasan Sir',
      'Received from Faisal Sir',
      'Miscellaneous Income',
    ],
  },
  {
    key: 'SALES',
    label: 'Sales',
    column: 'left',
    particulars: ['Cash', 'Bkash', 'Card - EBL', 'Card - City', 'Master Card'],
  },
  {
    key: 'DENOMINATION',
    label: 'Denomination of Closing Cash',
    column: 'left',
    particulars: ['1000', '500', '200', '100', '50', '20', '10', '5', '2', '1'],
  },
  {
    key: 'EXPENSES',
    label: 'Payments / Expenses',
    column: 'right',
    particulars: [
      'Supplier Bill',
      'Out Purchase',
      'Conveyance',
      'Delivery Charge',
      'Entertainment (Staff)',
      'Mobile Recharge',
      'Over Time',
      'Office Expense (Cash Handeling Charge)',
      'B. Gate Bill',
    ],
  },
  {
    key: 'ADVANCES',
    label: 'Advances',
    column: 'right',
    particulars: [],
    allowCustom: true,
  },
  {
    key: 'PAYMENTS',
    label: 'Payments',
    column: 'right',
    particulars: ['Payment to Hasan Sir', 'Payment to Faisal Sir'],
  },
  {
    key: 'DEPOSITS',
    label: 'Deposits',
    column: 'right',
    particulars: [
      'Total Card Sales',
      'Total Digital Wallet Sales',
      'Bank Account No. - EBL',
      'Bank Account No. - city',
      'Bkash No. - 01755617097',
    ],
  },
]

// ---------- Types ----------

interface EntryRow {
  id?: string
  section: SectionKey
  particulars: string
  amount: number
  count?: number | null
}

interface LoadedEntry {
  id: string
  section: string
  particulars: string
  amount: number
  count: number | null
  date: string
}

// ---------- Helpers ----------

function fmt(n: number): string {
  if (n === 0) return ''
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseNum(s: string): number {
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// ---------- DailyReport component ----------

export default function DailyReport({
  date,
  businessName,
}: {
  date: string
  businessName: string
}) {
  // rows keyed by `${section}::${particulars}` for quick lookup
  const [rows, setRows] = useState<Record<string, EntryRow>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const initialLoadKey = useRef<string>('')

  // build initial rows skeleton for a fresh date
  const buildSkeleton = useCallback((): Record<string, EntryRow> => {
    const out: Record<string, EntryRow> = {}
    for (const sec of SECTIONS) {
      for (const p of sec.particulars) {
        const k = `${sec.key}::${p}`
        out[k] = {
          section: sec.key,
          particulars: p,
          amount: 0,
          count: sec.key === 'DENOMINATION' ? 0 : null,
        }
      }
    }
    return out
  }, [])

  const load = useCallback(
    async (d: string) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/report?date=${encodeURIComponent(d)}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to load')

        const skeleton = buildSkeleton()
        for (const e of data.entries as LoadedEntry[]) {
          const k = `${e.section}::${e.particulars}`
          skeleton[k] = {
            id: e.id,
            section: e.section as SectionKey,
            particulars: e.particulars,
            amount: e.amount,
            count: e.count,
          }
        }
        // also include any custom ADVANCES rows that came from DB
        for (const e of data.entries as LoadedEntry[]) {
          if (e.section === 'ADVANCES') {
            const k = `ADVANCES::${e.particulars}`
            if (!skeleton[k]) {
              skeleton[k] = {
                id: e.id,
                section: 'ADVANCES',
                particulars: e.particulars,
                amount: e.amount,
                count: null,
              }
            }
          }
        }
        setRows(skeleton)
        setDirty(false)
        initialLoadKey.current = d
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load report')
      } finally {
        setLoading(false)
      }
    },
    [buildSkeleton],
  )

  useEffect(() => {
    load(date)
  }, [date, load])

  // ---- update helpers ----
  const updateAmount = (key: string, value: string) => {
    setRows((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      return { ...prev, [key]: { ...existing, amount: parseNum(value) } }
    })
    setDirty(true)
  }

  const updateCount = (key: string, value: string) => {
    setRows((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      const n = parseInt(value, 10)
      const count = isNaN(n) || n < 0 ? 0 : n
      const denom = parseInt(existing.particulars, 10)
      return {
        ...prev,
        [key]: { ...existing, count, amount: isNaN(denom) ? existing.amount : count * denom },
      }
    })
    setDirty(true)
  }

  const addAdvanceRow = () => {
    // generate a unique placeholder name; user can rename later via DB only — for simplicity, name = "Advance N"
    setRows((prev) => {
      const existing = Object.values(prev).filter((r) => r.section === 'ADVANCES')
      const idx = existing.length + 1
      const particulars = `Advance ${idx}`
      const k = `ADVANCES::${particulars}::${Date.now()}`
      return {
        ...prev,
        [k]: { section: 'ADVANCES', particulars, amount: 0, count: null },
      }
    })
    setDirty(true)
  }

  const removeAdvanceRow = (key: string) => {
    setRows((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setDirty(true)
  }

  const renameAdvanceRow = (key: string, newName: string) => {
    setRows((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      return { ...prev, [key]: { ...existing, particulars: newName } }
    })
    setDirty(true)
  }

  // ---- totals ----
  const totals = useMemo(() => {
    const sum = (sec: SectionKey) =>
      Object.values(rows)
        .filter((r) => r.section === sec)
        .reduce((s, r) => s + (r.amount || 0), 0)

    const receipts = sum('RECEIPTS')
    const sales = sum('SALES')
    const cashInHand = sum('DENOMINATION')
    const expenses = sum('EXPENSES')
    const advances = sum('ADVANCES')
    const payments = sum('PAYMENTS')
    const deposits = sum('DEPOSITS')

    // expected closing = receipts + sales - expenses - advances - payments - deposits
    const expected = receipts + sales - expenses - advances - payments - deposits
    const excess = cashInHand > expected ? cashInHand - expected : 0
    const shortage = expected > cashInHand ? expected - cashInHand : 0

    const leftTotal = receipts + sales + excess
    const rightTotal = expenses + advances + payments + deposits + cashInHand

    return {
      receipts,
      sales,
      cashInHand,
      expenses,
      advances,
      payments,
      deposits,
      excess,
      shortage,
      leftTotal,
      rightTotal,
    }
  }, [rows])

  // ---- save ----
  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = Object.values(rows)
        .filter((r) => r.amount !== 0 || (r.section === 'DENOMINATION' && (r.count ?? 0) !== 0))
        .map((r) => ({
          section: r.section,
          particulars: r.particulars,
          amount: r.amount,
          count: r.section === 'DENOMINATION' ? r.count ?? 0 : null,
        }))

      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save')
      toast.success('Report saved')
      setDirty(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ---- render helpers ----
  const renderSection = (sec: SectionDef) => {
    const sectionRows = Object.entries(rows).filter(([, r]) => r.section === sec.key)
    const isDenom = sec.key === 'DENOMINATION'
    const isAdvances = sec.allowCustom
    const sectionTotalKey: Record<SectionKey, keyof typeof totals> = {
      RECEIPTS: 'receipts',
      SALES: 'sales',
      DENOMINATION: 'cashInHand',
      EXPENSES: 'expenses',
      ADVANCES: 'advances',
      PAYMENTS: 'payments',
      DEPOSITS: 'deposits',
    }
    const total = totals[sectionTotalKey[sec.key]] ?? 0

    return (
      <div className="border border-neutral-300 dark:border-neutral-700 rounded-sm overflow-hidden bg-white dark:bg-neutral-950 print:border-black">
        <div className="bg-neutral-100 dark:bg-neutral-900 px-2 py-1 border-b border-neutral-300 dark:border-neutral-700 print:bg-gray-200">
          <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 print:text-black">
            {sec.label}
          </span>
        </div>

        {isDenom ? (
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Denomination</TableHead>
                <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-center w-8">X</TableHead>
                <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-16">Count</TableHead>
                <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-24">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionRows.map(([key, r]) => (
                <TableRow key={key} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b">
                  <TableCell className="py-1 px-2 font-medium">{r.particulars}</TableCell>
                  <TableCell className="py-1 px-2 text-center text-neutral-400">X</TableCell>
                  <TableCell className="py-1 px-2">
                    <Input
                      type="number"
                      min="0"
                      value={r.count ?? ''}
                      onChange={(e) => updateCount(key, e.target.value)}
                      className="h-6 text-right text-[11px] px-1 border-0 bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-900 print:hidden"
                    />
                    <span className="hidden print:block text-right">{r.count ?? ''}</span>
                  </TableCell>
                  <TableCell className="py-1 px-2 text-right tabular-nums">{fmt(r.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                <TableCell colSpan={3} className="py-1 px-2 text-[11px] font-bold text-right">
                  Total Cash in Hand -
                </TableCell>
                <TableCell className="py-1 px-2 text-right tabular-nums font-bold">{fmt(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold">Particulars</TableHead>
                <TableHead className="h-6 py-1 px-2 text-[10px] font-semibold text-right w-28">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionRows.map(([key, r]) => (
                <TableRow key={key} className="border-neutral-100 dark:border-neutral-800/50 print:border-black print:border-b group">
                  <TableCell className="py-1 px-2">
                    {isAdvances ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          value={r.particulars}
                          onChange={(e) => renameAdvanceRow(key, e.target.value)}
                          className="h-6 text-[11px] px-1 border-0 bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-900 print:hidden"
                        />
                        <span className="hidden print:block">{r.particulars}</span>
                        <button
                          type="button"
                          onClick={() => removeAdvanceRow(key)}
                          className="text-neutral-300 hover:text-rose-500 print:hidden"
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span>{r.particulars}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={r.amount === 0 ? '' : r.amount}
                      onChange={(e) => updateAmount(key, e.target.value)}
                      placeholder="—"
                      className="h-6 text-right text-[11px] px-1 border-0 bg-transparent focus:bg-neutral-50 dark:focus:bg-neutral-900 tabular-nums print:hidden"
                    />
                    <span className="hidden print:block text-right tabular-nums">{fmt(r.amount)}</span>
                  </TableCell>
                </TableRow>
              ))}
              {isAdvances && (
                <TableRow className="print:hidden">
                  <TableCell colSpan={2} className="py-1 px-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addAdvanceRow}
                      className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 px-1"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add row
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-neutral-50 dark:bg-neutral-900/50 print:bg-gray-100 border-t-2 border-neutral-300 dark:border-neutral-700 print:border-black">
                <TableCell className="py-1 px-2 text-[11px] font-bold text-right">
                  Total {sec.label.split(' / ')[0].split(' ')[0]} -
                </TableCell>
                <TableCell className="py-1 px-2 text-right tabular-nums font-bold">{fmt(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    )
  }

  const leftSections = SECTIONS.filter((s) => s.column === 'left')
  const rightSections = SECTIONS.filter((s) => s.column === 'right')

  // format date as DD/MM/YYYY for the report header
  const dateParts = date.split('-') // YYYY-MM-DD
  const dateDisplay = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="text-xs text-neutral-500">
          {dirty ? (
            <span className="text-amber-600 font-medium">● Unsaved changes</span>
          ) : (
            <span className="text-emerald-600">✓ All changes saved</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-1.5" /> Save Report</>
            )}
          </Button>
        </div>
      </div>

      {/* The report sheet */}
      <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-sm p-4 sm:p-6 print:border-black print:p-2 print:shadow-none shadow-sm">
        {/* Header */}
        <div className="flex items-end justify-between border-b-2 border-neutral-800 dark:border-neutral-200 print:border-black pb-2 mb-3">
          <div className="text-xl sm:text-2xl font-bold tracking-tight">{businessName}</div>
          <div className="text-xs sm:text-sm">
            <span className="text-neutral-500">Date: </span>
            <span className="font-semibold tabular-nums">{dateDisplay}</span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
            Loading report...
          </div>
        ) : (
          <>
            {/* Two-column body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-3">{leftSections.map(renderSection)}</div>
              <div className="space-y-3">{rightSections.map(renderSection)}</div>
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {/* Left totals */}
              <div className="border-2 border-neutral-800 dark:border-neutral-200 print:border-black rounded-sm overflow-hidden">
                <Table className="text-[11px]">
                  <TableBody>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1.5 px-2 font-medium">Excess Cash</TableCell>
                      <TableCell className="py-1.5 px-2 text-right tabular-nums w-28">
                        {fmt(totals.excess)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 border-t-2 border-neutral-800 dark:border-neutral-200 print:border-black">
                      <TableCell className="py-1.5 px-2 font-bold">Total Taka -</TableCell>
                      <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">
                        {fmt(totals.leftTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {/* Right totals */}
              <div className="border-2 border-neutral-800 dark:border-neutral-200 print:border-black rounded-sm overflow-hidden">
                <Table className="text-[11px]">
                  <TableBody>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1.5 px-2 font-medium">Cash Shortage</TableCell>
                      <TableCell className="py-1.5 px-2 text-right tabular-nums w-28">
                        {fmt(totals.shortage)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-neutral-200 dark:border-neutral-800 print:border-black">
                      <TableCell className="py-1.5 px-2 font-medium">Closing Cash Balance</TableCell>
                      <TableCell className="py-1.5 px-2 text-right tabular-nums">
                        {fmt(totals.cashInHand)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-neutral-100 dark:bg-neutral-900 print:bg-gray-200 border-t-2 border-neutral-800 dark:border-neutral-200 print:border-black">
                      <TableCell className="py-1.5 px-2 font-bold">Total Taka -</TableCell>
                      <TableCell className="py-1.5 px-2 text-right tabular-nums font-bold">
                        {fmt(totals.rightTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Balance indicator */}
            <div className="mt-3 text-center text-[11px]">
              {Math.abs(totals.leftTotal - totals.rightTotal) < 0.005 ? (
                <span className="text-emerald-600 font-medium">
                  ✓ Report is balanced (Both sides equal {fmt(totals.leftTotal)})
                </span>
              ) : (
                <span className="text-rose-600 font-medium">
                  ⚠ Report is not balanced — difference: {fmt(Math.abs(totals.leftTotal - totals.rightTotal))}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
