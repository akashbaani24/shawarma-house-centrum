'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Wallet,
  CalendarDays,
} from 'lucide-react'
import DailyReport from '@/components/daily-report'

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function Dashboard({
  user,
}: {
  user: { id: string; email: string; name?: string | null; businessName: string }
}) {
  const [selectedDate, setSelectedDate] = useState<string>(todayStr())
  const isToday = selectedDate === todayStr()

  const handlePrev = () => setSelectedDate((d) => shiftDate(d, -1))
  const handleNext = () => setSelectedDate((d) => shiftDate(d, 1))
  const handleToday = () => setSelectedDate(todayStr())

  const displayName = user.businessName || user.name || 'Daily Report'

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <header className="border-b bg-white dark:bg-neutral-900 sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white grid place-items-center shadow-sm shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight truncate">{displayName}</h1>
              <p className="text-xs text-neutral-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-neutral-500 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4 mr-1.5" /> Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Date navigation */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 sm:p-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-neutral-400" />
              <div>
                <div className="text-sm font-medium">{formatLongDate(selectedDate)}</div>
                <div className="text-xs text-neutral-500">Select the day you want to view / edit</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Previous day">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="w-[150px]"
              />
              <Button
                variant={isToday ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleToday}
                disabled={isToday}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                aria-label="Next day"
                disabled={isToday}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* The daily report */}
        <DailyReport date={selectedDate} businessName={displayName} />
      </main>

      <footer className="border-t bg-white dark:bg-neutral-900 mt-auto print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-neutral-500 flex items-center justify-between">
          <span>Daily Cash Report</span>
          <span>{user.email}</span>
        </div>
      </footer>
    </div>
  )
}
