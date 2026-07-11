'use client'

import { Suspense, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  ChevronDown,
  Receipt,
  TrendingUp,
  Settings,
  ShoppingCart,
  Truck,
  Scale,
  DollarSign,
} from 'lucide-react'
import DashboardView from '@/components/views/dashboard-view'
import EntryView from '@/components/views/entry-view'
import ManageTypesView from '@/components/views/manage-types-view'
import OpeningBalanceView from '@/components/views/opening-balance-view'
import DailyReportView from '@/components/views/daily-report-view'
import ExpenseDetailsView from '@/components/views/expense-details-view'
import IncomeReportView from '@/components/views/income-report-view'
import InvestmentReportView from '@/components/views/investment-report-view'
import MonthlySummaryView from '@/components/views/monthly-summary-view'
import SupplierDueView from '@/components/views/supplier-due-view'
import PaymentHistoryView from '@/components/views/payment-history-view'
import DepositReportView from '@/components/views/deposit-report-view'
import ExpenseComparisonView from '@/components/views/expense-comparison-view'
import SettingsView from '@/components/views/settings-view'
import SupplierEntryView from '@/components/views/supplier-entry-view'
import PurchaseEntryView from '@/components/views/purchase-entry-view'
import SupplierReportView from '@/components/views/supplier-report-view'
import ProfitLossView from '@/components/views/profit-loss-view'
import ManageUsersView from '@/components/views/manage-users-view'
import ResetDataView from '@/components/views/reset-data-view'
import BankAccountsView from '@/components/views/bank-accounts-view'

export type ViewKey =
  | 'dashboard'
  | 'income'
  | 'expense-branch'
  | 'expense-office'
  | 'invest'
  | 'suppliers'
  | 'purchases'
  | 'types'
  | 'opening'
  | 'branch-report'
  | 'expense-details'
  | 'income-report'
  | 'investment-report'
  | 'supplier-report'
  | 'profit-loss'
  | 'monthly-summary'
  | 'supplier-due'
  | 'payment-history'
  | 'deposit-report'
  | 'expense-comparison'
  | 'users'
  | 'reset'
  | 'settings'
  | 'bank-accounts'

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

// Standalone nav items (top level)
const TOP_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'income', label: 'Income Entry', icon: ArrowUpCircle },
  { key: 'expense-branch', label: 'Expense By Branch', icon: ArrowDownCircle },
  { key: 'expense-office', label: 'Expense By Office', icon: ArrowDownCircle },
  { key: 'invest', label: 'Invest Entry', icon: TrendingUp },
]

// Setup sub-menu items (under "Setup" group) — admin items too
const SETUP_NAV: NavItem[] = [
  { key: 'suppliers', label: 'Supplier Entry', icon: Truck },
  { key: 'purchases', label: 'Purchase Entry', icon: ShoppingCart },
  { key: 'types', label: 'Manage Types', icon: Tags },
  { key: 'bank-accounts', label: 'Bank Accounts', icon: Landmark },
  { key: 'opening', label: 'Opening Balance', icon: Wallet },
  { key: 'users', label: 'Manage Users', icon: Users, adminOnly: true },
  { key: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
]

// Report sub-menu items (under "Reports" group)
const REPORT_NAV: NavItem[] = [
  { key: 'branch-report', label: 'Branch Daily Report', icon: FileText },
  { key: 'income-report', label: 'Income Report', icon: TrendingUp },
  { key: 'expense-details', label: 'Branch Expense Report', icon: Receipt },
  { key: 'investment-report', label: 'Investment Report', icon: TrendingUp },
  { key: 'supplier-report', label: 'Supplier Report', icon: Truck },
  { key: 'supplier-due', label: 'Supplier Due Report', icon: Truck },
  { key: 'profit-loss', label: 'Profit & Loss', icon: Scale },
  { key: 'monthly-summary', label: 'Monthly Financial Summary', icon: DollarSign },
  { key: 'payment-history', label: 'Payment History', icon: Receipt },
  { key: 'deposit-report', label: 'Deposit Report', icon: Landmark },
  { key: 'expense-comparison', label: 'Expense Comparison', icon: Scale },
]

const ADMIN_NAV: NavItem[] = [
  { key: 'reset', label: 'Reset Data', icon: AlertTriangle, adminOnly: true },
]

function AppShellInner({
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = user.role === 'ADMIN'

  // Backward compat: old 'report' → 'branch-report', old 'expense' → 'expense-branch'
  const rightsNormalized = [
    ...user.rights,
    ...(user.rights.includes('report') && !user.rights.includes('branch-report') ? ['branch-report'] : []),
    ...(user.rights.includes('expense') && !user.rights.includes('expense-branch') ? ['expense-branch'] : []),
  ]

  const canSee = (item: NavItem) => {
    if (item.adminOnly) return isAdmin
    return isAdmin || rightsNormalized.includes(item.key)
  }

  const visibleTop = TOP_NAV.filter(canSee)
  const visibleSetup = SETUP_NAV.filter(canSee)
  const visibleReports = REPORT_NAV.filter(canSee)
  const visibleAdmin = ADMIN_NAV.filter(canSee)

  const allVisible = [...visibleTop, ...visibleSetup, ...visibleReports, ...visibleAdmin]

  // Read the current view from the URL query param
  const paramView = searchParams.get('view') as ViewKey | null
  // Backward compat: old keys → new keys
  const normalizedParam =
    paramView === 'report' ? 'branch-report'
    : paramView === 'expense' ? 'expense-branch'
    : paramView
  const view: ViewKey =
    normalizedParam && allVisible.some((n) => n.key === normalizedParam)
      ? normalizedParam
      : allVisible[0]?.key ?? 'dashboard'

  const [mobileOpen, setMobileOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(
    visibleReports.some((n) => n.key === view),
  )
  const [setupOpen, setSetupOpen] = useState(
    visibleSetup.some((n) => n.key === view),
  )

  const displayName = user.businessName || user.name || 'Daily Report'

  const handleNav = useCallback(
    (key: ViewKey) => {
      router.push(`/?view=${key}`)
      setMobileOpen(false)
    },
    [router],
  )

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const active = view === item.key
    const isDanger = item.key === 'reset'
    const href = `/?view=${item.key}`
    return (
      <a
        key={item.key}
        href={href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          e.preventDefault()
          handleNav(item.key)
        }}
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
      </a>
    )
  }

  const isReportActive = visibleReports.some((n) => n.key === view)
  const isSetupActive = visibleSetup.some((n) => n.key === view)

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-3 py-3 flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white grid place-items-center shrink-0">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="font-semibold text-xs sm:text-sm truncate">{displayName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu" className="shrink-0">
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
              {visibleTop.map(renderNavItem)}

              {/* Setup group (collapsible) */}
              {visibleSetup.length > 0 && (
                <div>
                  <button
                    onClick={() => setSetupOpen((o) => !o)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isSetupActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">Setup</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${setupOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {setupOpen && (
                    <div className="mt-1 ml-3 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-1">
                      {visibleSetup.map((item) => {
                        const Icon = item.icon
                        const active = view === item.key
                        const href = `/?view=${item.key}`
                        return (
                          <a
                            key={item.key}
                            href={href}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
                              e.preventDefault()
                              handleNav(item.key)
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                              active
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{item.label}</span>
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Reports group (collapsible) */}
              {visibleReports.length > 0 && (
                <div>
                  <button
                    onClick={() => setReportsOpen((o) => !o)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isReportActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">Reports</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${reportsOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {reportsOpen && (
                    <div className="mt-1 ml-3 pl-3 border-l border-neutral-200 dark:border-neutral-800 space-y-1">
                      {visibleReports.map((item) => {
                        const Icon = item.icon
                        const active = view === item.key
                        const href = `/?view=${item.key}`
                        return (
                          <a
                            key={item.key}
                            href={href}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
                              e.preventDefault()
                              handleNav(item.key)
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                              active
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{item.label}</span>
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {visibleAdmin.map(renderNavItem)}
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {view === 'dashboard' && <DashboardView onNavigate={handleNav} />}
            {view === 'income' && <EntryView kind="INCOME" />}
            {view === 'expense-branch' && <EntryView kind="EXPENSE" source="BRANCH" title="Expense By Branch" />}
            {view === 'expense-office' && <EntryView kind="EXPENSE" source="OFFICE" title="Expense By Office" />}
            {view === 'invest' && <EntryView kind="INVEST" source="BRANCH" title="Invest Entry" accentColor="amber" />}
            {view === 'suppliers' && <SupplierEntryView />}
            {view === 'purchases' && <PurchaseEntryView />}
            {view === 'types' && <ManageTypesView />}
            {view === 'opening' && <OpeningBalanceView />}
            {view === 'bank-accounts' && <BankAccountsView />}
            {view === 'branch-report' && <DailyReportView />}
            {view === 'expense-details' && <ExpenseDetailsView />}
            {view === 'income-report' && <IncomeReportView />}
            {view === 'investment-report' && <InvestmentReportView />}
            {view === 'supplier-report' && <SupplierReportView />}
            {view === 'profit-loss' && <ProfitLossView />}
            {view === 'monthly-summary' && <MonthlySummaryView />}
            {view === 'supplier-due' && <SupplierDueView />}
            {view === 'payment-history' && <PaymentHistoryView />}
            {view === 'deposit-report' && <DepositReportView />}
            {view === 'expense-comparison' && <ExpenseComparisonView />}
            {view === 'users' && isAdmin && <ManageUsersView currentUser={user} />}
            {view === 'settings' && isAdmin && <SettingsView />}
            {view === 'reset' && isAdmin && <ResetDataView />}
          </div>
        </main>
      </div>
    </div>
  )
}

// Wrapper with Suspense (useSearchParams requires it in Next.js 16)
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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-950">
          <div className="h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AppShellInner user={user} />
    </Suspense>
  )
}
