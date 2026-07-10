'use client'

// Shared helpers used by all the new report views (monthly-summary,
// supplier-due, payment-history, deposit-report, expense-comparison).
// Kept here so the views stay focused on layout, not boilerplate.

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function lastOfMonth(year: number, month1Based: number): string {
  return `${year}-${String(month1Based).padStart(2, '0')}-${String(new Date(year, month1Based, 0).getDate()).padStart(2, '0')}`
}

export function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtSigned(n: number): string {
  // For difference columns — wrap negative in (parentheses), show + sign on positive
  if (n < 0) return `(${fmt(Math.abs(n))})`
  if (n > 0) return `+${fmt(n)}`
  return fmt(n)
}

export function fmtPct(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export const CURRENCY = '৳'

export const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK: 'Bank',
  MOBILE_BANK: 'Mobile Bank',
}

// ============ Date navigation helpers ============

export function shiftMonth(year: number, month1Based: number, deltaMonths: number): { year: number; month: number } {
  const d = new Date(year, month1Based - 1, 1)
  d.setMonth(d.getMonth() + deltaMonths)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function parseMonth(monthStr: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr)
  if (!m) {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) }
}

export function formatMonthLabel(monthStr: string): string {
  const { year, month } = parseMonth(monthStr)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function prevMonthStr(monthStr: string): string {
  const { year, month } = parseMonth(monthStr)
  const s = shiftMonth(year, month, -1)
  return `${s.year}-${String(s.month).padStart(2, '0')}`
}

export function nextMonthStr(monthStr: string): string {
  const { year, month } = parseMonth(monthStr)
  const s = shiftMonth(year, month, +1)
  return `${s.year}-${String(s.month).padStart(2, '0')}`
}
