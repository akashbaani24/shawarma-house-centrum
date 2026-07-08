'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Tags,
  Wallet,
  FileText,
  LogOut,
  Menu,
  X,
  Users,
  AlertTriangle,
  Landmark,
} from 'lucide-react'
import DashboardView from '@/components/views/dashboard-view'
import EntryView from '@/components/views/entry-view'
import ManageTypesView from '@/components/views/manage-types-view'
import OpeningBalanceView from '@/components/views/opening-balance-view'
import DailyReportView from '@/components/views/daily-report-view'
import ManageUsersView from '@/components/views/manage-users-view'
import ResetDataView from '@/components/views/reset-data-view'
import BankAccountsView from '@/components/views/bank-accounts-view'

export type ViewKey =
  | 'dashboard'
  | 'income'
  | 'expense'
  | 'types'
  | 'opening'
  | 'report'
  | 'users'
  | 'reset'
  | 'bank-accounts'

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'income', label: 'Income Entry', icon: ArrowUpCircle },
  { key: 'expense', label: 'Expense Entry', icon: ArrowDownCircle },
  { key: 'types', label: 'Manage Types', icon: Tags },
  { key: 'bank-accounts', label: 'Bank Accounts', icon: Landmark },
  { key: 'opening', label: 'Opening Balance', icon: Wallet },
  { key: 'report', label: 'Daily Report', icon: FileText },
  { key: 'users', label: 'Manage Users', icon: Users, adminOnly: true },
  { key: 'reset', label: 'Reset Data', icon: AlertTriangle, adminOnly: true },
]

export default function AppShell({
  user,
}: {
  user: {
    id: string
    email: string
    name?: string | null
    businessName: string
    role: 'ADMIN' | 'USER'
    rights: string[]
  }
}) {
  const isAdmin = user.role === 'ADMIN'
  // admin sees everything; regular users only see what's in their rights
  const canSee = (item: NavItem) => {
    if (item.adminOnly) return isAdmin
    return isAdmin || user.rights.includes(item.key)
  }
  const visibleNav = NAV.filter(canSee)

  const [view, setView] = useState<ViewKey>(visibleNav[0]?.key ?? 'dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)

  const displayName = user.businessName || user.name || 'Daily Report'

  const handleNav = (key: ViewKey) => {
    setView(key)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white grid place-items-center">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm truncate max-w-[140px]">{displayName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside
          className={`${
            mobileOpen ? 'block' : 'hidden'
          } md:block w-full md:w-64 md:fixed md:top-0 md:bottom-0 md:left-0 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 z-20 print:hidden`}
        >
          <div className="flex flex-col h-full">
            {/* Brand */}
            <div className="hidden md:flex items-center gap-3 px-5 py-5 border-b border-neutral-200 dark:border-neutral-800">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-sm">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{displayName}</div>
                <div className="text-xs text-neutral-500 truncate">
                  {user.name || user.email}
                  {isAdmin ? ' · Admin' : ''}
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon
                const active = view === item.key
                const isDanger = item.key === 'reset'
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? isDanger
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-emerald-600 text-white shadow-sm'
                        : isDanger
                        ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Logout */}
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full justify-start text-neutral-500 hover:text-rose-600"
              >
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 md:ml-64 min-w-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {view === 'dashboard' && <DashboardView onNavigate={handleNav} />}
            {view === 'income' && <EntryView kind="INCOME" />}
            {view === 'expense' && <EntryView kind="EXPENSE" />}
            {view === 'types' && <ManageTypesView />}
            {view === 'opening' && <OpeningBalanceView />}
            {view === 'bank-accounts' && <BankAccountsView />}
            {view === 'report' && <DailyReportView />}
            {view === 'users' && isAdmin && <ManageUsersView currentUser={user} />}
            {view === 'reset' && isAdmin && <ResetDataView />}
          </div>
        </main>
      </div>
    </div>
  )
}
