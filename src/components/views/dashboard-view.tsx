'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Scale,
  FileText,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import type { ViewKey } from '@/components/app-shell'

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CURRENCY = '৳'

interface DashboardData {
  today: string
  opening: number
  income: number
  expense: number
  closing: number
  entryCount: number
  typeCount: number
  userCount: number
  role: string
  recentEntries: {
    id: string
    kind: string
    category: string
    amount: number
    note: string | null
    date: string
    creator?: { name: string | null; email: string } | null
  }[]
}

export default function DashboardView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setData(d)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Today&apos;s summary — {new Date(data.today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-sky-200 bg-sky-50/60 dark:bg-sky-950/30 dark:border-sky-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-sky-700 dark:text-sky-400">Opening Balance</CardTitle>
            <Wallet className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-sky-700 dark:text-sky-400">{CURRENCY}{fmt(data.opening)}</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Today&apos;s Income</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{CURRENCY}{fmt(data.income)}</div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/60 dark:bg-rose-950/30 dark:border-rose-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-rose-700 dark:text-rose-400">Today&apos;s Expense</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-rose-700 dark:text-rose-400">{CURRENCY}{fmt(data.expense)}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-amber-700 dark:text-amber-400">Closing Balance</CardTitle>
            <Scale className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{CURRENCY}{fmt(data.closing)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Button variant="outline" className="h-auto py-4 justify-start" onClick={() => onNavigate('income')}>
            <ArrowUpCircle className="h-5 w-5 mr-2 text-emerald-600" />
            <div className="text-left">
              <div className="text-sm font-semibold">Add Income</div>
              <div className="text-xs text-neutral-500">Record income</div>
            </div>
          </Button>
          <Button variant="outline" className="h-auto py-4 justify-start" onClick={() => onNavigate('expense')}>
            <ArrowDownCircle className="h-5 w-5 mr-2 text-rose-600" />
            <div className="text-left">
              <div className="text-sm font-semibold">Add Expense</div>
              <div className="text-xs text-neutral-500">Record expense</div>
            </div>
          </Button>
          <Button variant="outline" className="h-auto py-4 justify-start" onClick={() => onNavigate('report')}>
            <FileText className="h-5 w-5 mr-2 text-sky-600" />
            <div className="text-left">
              <div className="text-sm font-semibold">Daily Report</div>
              <div className="text-xs text-neutral-500">View & balance</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Recent entries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-500">Recent Entries</h2>
          <span className="text-xs text-neutral-400">{data.entryCount} entries today</span>
        </div>
        <Card>
          <CardContent className="p-0">
            {data.recentEntries.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                No entries yet. Start by adding an income or expense.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {data.recentEntries.map((e) => {
                  const isIncome = e.kind === 'INCOME'
                  return (
                    <div key={e.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {isIncome ? '+' : '−'} {CURRENCY}{fmt(e.amount)}
                          </span>
                          <span className="text-xs text-neutral-400">{e.date}</span>
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5 truncate">
                          {e.category}{e.note ? ` · ${e.note}` : ''}
                          {e.creator && (
                            <span className="text-neutral-400"> · by {e.creator.name || e.creator.email}</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isIncome ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                      }`}>
                        {isIncome ? 'INCOME' : 'EXPENSE'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
