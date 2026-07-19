'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Trash2,
  Loader2,
  Tags,
  TrendingUp,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CURRENCY = '৳'

interface TypeItem {
  id: string
  name: string
  kind: string
}

interface ExpenseCategoryItem {
  id: string
  name: string
  itemType: string // "TYPE" | "SUPPLIER"
}

interface SupplierItem {
  id: string
  name: string
}

interface EntryItem {
  id: string
  kind: string
  category: string
  amount: number
  note: string | null
  date: string
  paymentMethod?: string
  bankAccountId?: string | null
  bankAccount?: { bankName: string; accountName: string; accountNumber: string } | null
}

interface BankAccountItem {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
  isActive: boolean
}

// Payment methods — 'CREDIT' is only for INCOME (credit sales to customers).
// For EXPENSE, supplier due is tracked via Bill Amount vs Paid Amount on
// the SupplierBill record — no need for a separate CREDIT payment method.
const PAYMENT_METHODS_EXPENSE = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK', label: 'Bank' },
  { value: 'MOBILE_BANK', label: 'Mobile Bank (bKash/Nagad)' },
  { value: 'DUE', label: 'Due (Unpaid)' },
]

const PAYMENT_METHODS_INCOME = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK', label: 'Bank' },
  { value: 'MOBILE_BANK', label: 'Mobile Bank (bKash/Nagad)' },
  { value: 'CREDIT', label: 'Credit (Due)' },
]

export default function EntryView({
  kind,
  source: sourceProp = 'BRANCH',
  title,
  accentColor,
}: {
  kind: 'INCOME' | 'EXPENSE' | 'INVEST'
  source?: 'BRANCH' | 'OFFICE'
  title?: string
  accentColor?: 'emerald' | 'rose' | 'amber'
}) {
  const isIncome = kind === 'INCOME'
  const accent = accentColor ?? (isIncome ? 'emerald' : 'rose')

  // For INCOME entries, allow the user to toggle between Branch and Office
  // via a radio button at the top of the form. For EXPENSE/INVEST, the
  // source is fixed by the prop (set by the sidebar nav item).
  const [incomeSource, setIncomeSource] = useState<'BRANCH' | 'OFFICE'>(sourceProp)
  const source = isIncome ? incomeSource : sourceProp

  const [types, setTypes] = useState<TypeItem[]>([])
  const [entries, setEntries] = useState<EntryItem[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([])
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryItem[]>([])
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)

  const [typeId, setTypeId] = useState<string>('')
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>('')
  const [supplierId, setSupplierId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayStr())
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Accrual: Credit sales fields (shown when paymentMethod = CREDIT)
  const [dueAmount, setDueAmount] = useState('')
  const [customerId, setCustomerId] = useState<string>('')
  const [customers, setCustomers] = useState<{id: string, name: string}[]>([])

  // Supplier previous due — fetched when a supplier is selected for a bill.
  // Shows the supplier's outstanding balance so the user knows the total
  // they owe. The new bill's Due = Bill Amount - Paid Amount gets added to
  // this on save.
  const [supplierPreviousDue, setSupplierPreviousDue] = useState<number>(0)
  const [loadingSupplierDue, setLoadingSupplierDue] = useState(false)

  // Supplier bill fields (shown when Bill Type = Supplier Bill is selected)
  const [billNumber, setBillNumber] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  // Bill Type — new field that appears under Regular Expense.
  // 'GENERAL'  → simple expense (just amount, no supplier)
  // 'SUPPLIER' → supplier bill (supplier + bill number/amount/paid)
  const [billType, setBillType] = useState<'GENERAL' | 'SUPPLIER'>('GENERAL')

  const loadTypes = useCallback(async () => {
    setLoadingTypes(true)
    try {
      const res = await fetch(`/api/types?kind=${kind}`, { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) {
        setTypes(d.types)
        if (d.types.length > 0) setTypeId(d.types[0].id)
      }
    } catch {
      // ignore
    } finally {
      setLoadingTypes(false)
    }
  }, [kind])

  // Entry list: date range filter + search
  const [filterFromDate, setFilterFromDate] = useState<string>('') // empty = no from
  const [filterToDate, setFilterToDate] = useState<string>('') // empty = no to
  const [searchText, setSearchText] = useState<string>('')

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true)
    try {
      let url = `/api/entries?kind=${kind}&source=${source}`
      if (filterFromDate) url += `&from=${filterFromDate}`
      if (filterToDate) url += `&to=${filterToDate}`
      const res = await fetch(url, { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setEntries(d.entries)
    } catch {
      // ignore
    } finally {
      setLoadingEntries(false)
    }
  }, [kind, source, filterFromDate, filterToDate])

  const loadBankAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/bank-accounts', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setBankAccounts(d.bankAccounts)
    } catch {
      // ignore
    }
  }, [])

  const loadExpenseCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/expense-categories', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) {
        setExpenseCategories(d.categories)
        // Default-select the first category ONLY if nothing is selected yet
        // (don't reset on every reload — that would override user selection)
        setExpenseCategoryId((prev) => prev || (d.categories.length > 0 ? d.categories[0].id : ''))
      }
    } catch {
      // ignore
    }
  }, [])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setSuppliers(d.suppliers)
    } catch {
      // ignore
    }
  }, [])

  // Accrual: load customers (for credit sales)
  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setCustomers(d.customers || [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadTypes()
    loadEntries()
    loadBankAccounts()
    loadCustomers()
    if (kind === 'EXPENSE') {
      loadExpenseCategories()
      loadSuppliers()
    }
  }, [loadTypes, loadEntries, loadBankAccounts, loadExpenseCategories, loadSuppliers, loadCustomers, kind])

  // When expenseCategory changes, reset the sub-selection
  const selectedExpenseCategory = expenseCategories.find((c) => c.id === expenseCategoryId)
  // Show ALL expense categories in the top dropdown — including 'Supplier Bill'
  const visibleExpenseCategories = expenseCategories
  const isDepositCategory = selectedExpenseCategory?.name?.toLowerCase() === 'deposit'
  const isSupplierCategory = selectedExpenseCategory?.itemType === 'SUPPLIER' ||
    selectedExpenseCategory?.name?.toLowerCase() === 'supplier bill'
  // A supplier bill is now determined by the top-level Type = 'Supplier Bill'
  const isSupplierBill = kind === 'EXPENSE' && isSupplierCategory

  // For Deposit category, load DEPOSIT-kind types instead of EXPENSE-kind types
  const [depositTypes, setDepositTypes] = useState<TypeItem[]>([])
  useEffect(() => {
    if (kind === 'EXPENSE' && isDepositCategory) {
      fetch('/api/types?kind=DEPOSIT', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          setDepositTypes(d.types || [])
          if (d.types?.length > 0) setTypeId(d.types[0].id)
        })
        .catch(() => {})
    }
  }, [isDepositCategory, kind])

  useEffect(() => {
    setTypeId('')
    setSupplierId('')
    setBillNumber('')
    setBillAmount('')
    setPaidAmount('')
    setSupplierPreviousDue(0)
  }, [expenseCategoryId])

  // Fetch supplier's previous due when a supplier is selected for a bill.
  // Uses the supplier-due API which aggregates all bills for the supplier.
  useEffect(() => {
    if (kind === 'EXPENSE' && isSupplierBill && supplierId) {
      setLoadingSupplierDue(true)
      fetch(`/api/supplier-due?from=2000-01-01&to=2099-12-31`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          const supplier = (d.suppliers || []).find((s: { id: string }) => s.id === supplierId)
          setSupplierPreviousDue(supplier ? supplier.due : 0)
        })
        .catch(() => setSupplierPreviousDue(0))
        .finally(() => setLoadingSupplierDue(false))
    } else {
      setSupplierPreviousDue(0)
    }
  }, [kind, isSupplierBill, supplierId])

  // Reset bank account when method changes away from BANK/MOBILE_BANK
  useEffect(() => {
    if (paymentMethod !== 'BANK' && paymentMethod !== 'MOBILE_BANK' && paymentMethod !== 'CARD') {
      setBankAccountId('')
    }
  }, [paymentMethod])

  // Bank account selector shows for BANK, CARD, and MOBILE_BANK
  const needsBankAccount = paymentMethod === 'BANK' || paymentMethod === 'MOBILE_BANK' || paymentMethod === 'CARD'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // For supplier bills, use billAmount as the entry amount (the regular
    // "Amount" field is hidden). For everything else, use the amount field.
    const amtStr = isSupplierBill ? billAmount : amount
    const amt = parseFloat(amtStr)
    if (!amtStr || isNaN(amt) || amt <= 0) {
      toast.error(isSupplierBill ? 'Please enter a valid bill amount' : 'Please enter a valid amount')
      return
    }

    // Determine category, typeId, supplierId based on kind
    let finalCategory = ''
    let finalTypeId: string | null = null
    let finalSupplierId: string | null = null
    let finalExpenseCategoryId: string | null = null

    if (kind === 'EXPENSE') {
      if (!expenseCategoryId) {
        toast.error('Please select a type')
        return
      }
      finalExpenseCategoryId = expenseCategoryId
      if (isDepositCategory) {
        // Deposit — use deposit types
        const selectedType = depositTypes.find((t) => t.id === typeId)
        if (!selectedType) {
          toast.error('Please select a deposit type')
          return
        }
        finalTypeId = selectedType.id
        finalCategory = selectedType.name
      } else if (isSupplierBill) {
        // Supplier Bill type selected — pick supplier, use supplier name as category
        const selectedSupplier = suppliers.find((s) => s.id === supplierId)
        if (!selectedSupplier) {
          toast.error('Please select a supplier')
          return
        }
        finalSupplierId = selectedSupplier.id
        finalCategory = selectedSupplier.name
      } else {
        // Regular Expense + Bill Type = General Bill
        const selectedType = types.find((t) => t.id === typeId)
        if (!selectedType) {
          toast.error('Please select an expense head')
          return
        }
        finalTypeId = selectedType.id
        finalCategory = selectedType.name
      }
    } else {
      // Income / Invest — single type dropdown
      const selectedType = types.find((t) => t.id === typeId)
      if (!selectedType) {
        toast.error('Please select a type. Create one in Manage Types if none exist.')
        return
      }
      finalTypeId = selectedType.id
      finalCategory = selectedType.name
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          typeId: finalTypeId,
          category: finalCategory,
          amount: amt,
          note,
          date,
          paymentMethod,
          source,
          bankAccountId: needsBankAccount ? bankAccountId : undefined,
          expenseCategoryId: finalExpenseCategoryId || undefined,
          supplierId: finalSupplierId || undefined,
          // Accrual: send dueAmount + customerId for credit sales
          dueAmount: paymentMethod === 'CREDIT' ? (parseFloat(dueAmount) || amt) : 0,
          paymentDate: paymentMethod === 'CREDIT' ? null : date,
          customerId: paymentMethod === 'CREDIT' ? (customerId || undefined) : undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed to save')

      // If this is a supplier bill, also create a SupplierBill record
      if (kind === 'EXPENSE' && isSupplierBill && finalSupplierId) {
        try {
          const bAmt = billAmount ? parseFloat(billAmount) : amt
          const pAmt = paidAmount ? parseFloat(paidAmount) : 0
          await fetch('/api/supplier-bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: finalSupplierId,
              billDate: date,
              billNumber: billNumber.trim() || undefined,
              billAmount: bAmt,
              paidAmount: pAmt,
              note: note.trim() || undefined,
            }),
          })
        } catch {
          // Bill creation failed — the expense entry itself succeeded,
          // so just show a warning (non-critical)
        }
      }

      toast.success(`${kind === 'INVEST' ? 'Investment' : isIncome ? 'Income' : 'Expense'} of ${CURRENCY}${fmt(amt)} added`)
      setAmount('')
      setNote('')
      setBillNumber('')
      setBillAmount('')
      setPaidAmount('')
      loadEntries()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const prev = entries
    setEntries((cur) => cur.filter((e) => e.id !== id))
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Deleted')
    } catch {
      setEntries(prev)
      toast.error('Failed to delete')
    }
  }

  // ===== Edit entry state (admin only) =====
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [editingEntry, setEditingEntry] = useState<EntryItem | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('CASH')
  const [editBankAccountId, setEditBankAccountId] = useState<string>('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  const openEditDialog = (e: EntryItem) => {
    setEditingEntry(e)
    setEditAmount(String(e.amount))
    setEditNote(e.note || '')
    setEditDate(e.date)
    setEditPaymentMethod(e.paymentMethod || 'CASH')
    setEditBankAccountId(e.bankAccountId || '')
  }

  const editNeedsBankAccount = editPaymentMethod === 'BANK' || editPaymentMethod === 'CARD' || editPaymentMethod === 'MOBILE_BANK'

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEntry) return
    const amt = parseFloat(editAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!editDate || !/^\d{4}-\d{2}-\d{2}$/.test(editDate)) {
      toast.error('Please enter a valid date')
      return
    }
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/entries/${editingEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          note: editNote,
          date: editDate,
          paymentMethod: editPaymentMethod,
          bankAccountId: editNeedsBankAccount ? editBankAccountId : null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('Entry updated')
      setEditingEntry(null)
      loadEntries()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setEditSubmitting(false)
    }
  }

  // Filter entries by search text (client-side, on the loaded entries)
  const filteredEntries = useMemo(() => {
    if (!searchText.trim()) return entries
    const q = searchText.toLowerCase().trim()
    return entries.filter(
      (e) =>
        e.category.toLowerCase().includes(q) ||
        (e.note?.toLowerCase().includes(q) ?? false) ||
        String(e.amount).includes(q) ||
        e.date.includes(q),
    )
  }, [entries, searchText])

  const total = filteredEntries.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          {kind === 'INVEST' ? (
            <TrendingUp className="h-6 w-6 text-amber-600" />
          ) : isIncome ? (
            <ArrowUpCircle className="h-6 w-6 text-emerald-600" />
          ) : (
            <ArrowDownCircle className="h-6 w-6 text-rose-600" />
          )}
          {title ?? `${isIncome ? 'Income' : 'Expense'} Entry`}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Record a new {kind === 'INVEST' ? 'investment' : isIncome ? 'income' : 'expense'} transaction
        </p>
      </div>

      <div className="space-y-4">
        {/* === Expense Entry Form — grid layout matching the reference image === */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-neutral-800 dark:border-neutral-200 rounded-sm overflow-hidden">
          {/* Section header */}
          <div className="bg-neutral-800 dark:bg-neutral-200 px-4 py-2 text-center">
            <span className="text-sm font-bold uppercase tracking-wide text-white dark:text-black">
              {kind === 'EXPENSE' ? `Expense Entry by ${source === 'OFFICE' ? 'Office' : 'Branch'}` : title ?? `${isIncome ? 'Income' : 'Expense'} Entry`}
            </span>
          </div>

          {/* Form body */}
          <div className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Source toggle — only for INCOME entries */}
              {isIncome && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                  <Label className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Entry Source
                  </Label>
                  <RadioGroup
                    value={incomeSource}
                    onValueChange={(v) => setIncomeSource(v as 'BRANCH' | 'OFFICE')}
                    className="flex flex-wrap gap-4"
                  >
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <RadioGroupItem value="BRANCH" />
                      <span>Branch</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <RadioGroupItem value="OFFICE" />
                      <span>Office</span>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {/* === 3-column grid layout === */}
              {kind === 'EXPENSE' ? (
                <>
                  {/* Row 1: Type | Expense Head | Supplier (if Supplier Bill) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Column 1: Type */}
                    <div className="space-y-3">
                      <div>
                        <Label className="mb-1 block text-xs font-semibold">Type</Label>
                        <Select value={expenseCategoryId} onValueChange={setExpenseCategoryId}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            {visibleExpenseCategories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Payment Date */}
                      <div>
                        <Label htmlFor="date" className="mb-1 block text-xs font-semibold">Payment Date</Label>
                        <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" required />
                      </div>

                      {/* Amount — hidden for supplier bill (billAmount is used instead) */}
                      {!(isSupplierBill && supplierId) && (
                        <div>
                          <Label htmlFor="amount" className="mb-1 block text-xs font-semibold">Amount ({CURRENCY})</Label>
                          <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" required />
                        </div>
                      )}

                      {/* Supplier bill fields — inline when supplier selected */}
                      {isSupplierBill && supplierId && (
                        <div className="space-y-2 p-2 rounded-md bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900">
                          {/* Previous due from this supplier */}
                          {supplierPreviousDue > 0 && (
                            <div className="text-[10px] p-1.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                              <span className="text-amber-700 dark:text-amber-400 font-medium">Previous Due:</span>{' '}
                              <span className="font-bold text-amber-700 dark:text-amber-400">{CURRENCY}{fmt(supplierPreviousDue)}</span>
                            </div>
                          )}
                          <div>
                            <Label className="mb-1 block text-[10px] font-semibold">Bill Number</Label>
                            <Input placeholder="INV-001" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="mb-1 block text-[10px] font-semibold">Bill Amount ({CURRENCY})</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0.00" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} className="h-8 text-xs" required />
                          </div>
                          <div>
                            <Label className="mb-1 block text-[10px] font-semibold">Paid Amount ({CURRENCY})</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0.00" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="h-8 text-xs" />
                          </div>
                          {billAmount && (
                            <div className="text-[10px] space-y-0.5">
                              <div className="text-neutral-500">
                                This Bill Due: <span className="font-semibold text-rose-600">{CURRENCY}{fmt((parseFloat(billAmount) || 0) - (parseFloat(paidAmount) || 0))}</span>
                              </div>
                              {supplierPreviousDue > 0 && (
                                <div className="text-neutral-500">
                                  Total Due (after this bill):{' '}
                                  <span className="font-bold text-rose-600">
                                    {CURRENCY}{fmt(supplierPreviousDue + (parseFloat(billAmount) || 0) - (parseFloat(paidAmount) || 0))}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Note */}
                      <div>
                        <Label htmlFor="note" className="mb-1 block text-xs font-semibold">Note</Label>
                        <Textarea id="note" placeholder="e.g. Lunch at office" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="text-xs" />
                      </div>
                    </div>

                    {/* Column 2: Expense Head / Deposit Type / Payment Method */}
                    <div className="space-y-3">
                      {/* Expense Head — Regular Expense */}
                      {expenseCategoryId && !isDepositCategory && !isSupplierBill && (
                        <div>
                          <Label className="mb-1 block text-xs font-semibold">Expense Head</Label>
                          {types.length === 0 ? (
                            <p className="text-xs text-neutral-500 p-2 border border-dashed rounded">No expense heads. Add in Manage Types.</p>
                          ) : (
                            <Select value={typeId} onValueChange={setTypeId}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select expense head" /></SelectTrigger>
                              <SelectContent>
                                {types.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {/* Deposit Type */}
                      {isDepositCategory && (
                        <div>
                          <Label className="mb-1 block text-xs font-semibold">Deposit Type</Label>
                          {depositTypes.length === 0 ? (
                            <p className="text-xs text-neutral-500 p-2 border border-dashed rounded">No deposit types. Add in Manage Types.</p>
                          ) : (
                            <Select value={typeId} onValueChange={setTypeId}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select deposit type" /></SelectTrigger>
                              <SelectContent>
                                {depositTypes.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {/* Payment Method */}
                      <div>
                        <Label className="mb-1 block text-xs font-semibold">Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS_EXPENSE.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Bank Account — for BANK/CARD/MOBILE_BANK */}
                      {needsBankAccount && (
                        <div>
                          <Label className="mb-1 block text-xs font-semibold">
                            {paymentMethod === 'MOBILE_BANK' ? 'Mobile Account' : paymentMethod === 'CARD' ? 'Card Bank Account' : 'Bank Account'}
                          </Label>
                          {bankAccounts.filter((a) => a.isActive).length === 0 ? (
                            <p className="text-xs text-amber-600 p-2 border border-dashed rounded">No active bank accounts.</p>
                          ) : (
                            <Select value={bankAccountId} onValueChange={setBankAccountId}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                              <SelectContent>
                                {bankAccounts.filter((a) => a.isActive).map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.bankName} — {a.accountName} ({a.accountNumber})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {/* Credit sale fields */}
                      {paymentMethod === 'CREDIT' && (
                        <div className="space-y-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                          <div>
                            <Label className="mb-1 block text-[10px] font-semibold">Customer</Label>
                            {customers.length === 0 ? (
                              <p className="text-[10px] text-neutral-500">No customers yet.</p>
                            ) : (
                              <Select value={customerId} onValueChange={setCustomerId}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select customer" /></SelectTrigger>
                                <SelectContent>
                                  {customers.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <div>
                            <Label className="mb-1 block text-[10px] font-semibold">Due Amount ({CURRENCY})</Label>
                            <Input type="number" step="0.01" min="0" placeholder={amount || '0.00'} value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} className="h-8 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Column 3: Supplier list (if Supplier Bill) */}
                    <div className="space-y-3">
                      {isSupplierBill && (
                        <div>
                          <Label className="mb-1 block text-xs font-semibold">Supplier List</Label>
                          {suppliers.length === 0 ? (
                            <p className="text-xs text-amber-600 p-2 border border-dashed rounded">No suppliers. Add in Supplier Entry.</p>
                          ) : (
                            <Select value={supplierId} onValueChange={setSupplierId}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                              <SelectContent>
                                {suppliers.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* === Income/Invest layout — single column === */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1 block text-xs font-semibold">Type / Category</Label>
                      {loadingTypes ? (
                        <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
                      ) : types.length === 0 ? (
                        <p className="text-xs text-neutral-500 p-2 border border-dashed rounded">No types yet. Add in Manage Types.</p>
                      ) : (
                        <Select value={typeId} onValueChange={setTypeId}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            {types.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="amount" className="mb-1 block text-xs font-semibold">Amount ({CURRENCY})</Label>
                      <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" required />
                    </div>
                    <div>
                      <Label htmlFor="date" className="mb-1 block text-xs font-semibold">Date</Label>
                      <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" required />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1 block text-xs font-semibold">{isIncome ? 'Receive Method' : 'Payment Method'}</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(isIncome ? PAYMENT_METHODS_INCOME : PAYMENT_METHODS_EXPENSE).map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {needsBankAccount && (
                      <div>
                        <Label className="mb-1 block text-xs font-semibold">
                          {paymentMethod === 'MOBILE_BANK' ? 'Mobile Account' : paymentMethod === 'CARD' ? 'Card Bank Account' : 'Bank Account'}
                        </Label>
                        {bankAccounts.filter((a) => a.isActive).length === 0 ? (
                          <p className="text-xs text-amber-600 p-2 border border-dashed rounded">No active bank accounts.</p>
                        ) : (
                          <Select value={bankAccountId} onValueChange={setBankAccountId}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>
                              {bankAccounts.filter((a) => a.isActive).map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.bankName} — {a.accountName} ({a.accountNumber})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                    {paymentMethod === 'CREDIT' && (
                      <div className="space-y-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                        <div>
                          <Label className="mb-1 block text-[10px] font-semibold">Customer</Label>
                          {customers.length === 0 ? (
                            <p className="text-[10px] text-neutral-500">No customers yet.</p>
                          ) : (
                            <Select value={customerId} onValueChange={setCustomerId}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select customer" /></SelectTrigger>
                              <SelectContent>
                                {customers.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div>
                          <Label className="mb-1 block text-[10px] font-semibold">Due Amount ({CURRENCY})</Label>
                          <Input type="number" step="0.01" min="0" placeholder={amount || '0.00'} value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                    )}
                    <div>
                      <Label htmlFor="note" className="mb-1 block text-xs font-semibold">Note</Label>
                      <Textarea id="note" placeholder="e.g. Optional note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="text-xs" />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit button — pink/salmon colored like the reference image */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submitting || (kind === 'EXPENSE' ? expenseCategories.length === 0 : types.length === 0)}
                  variant={kind === 'INVEST' ? 'default' : isIncome ? 'default' : 'destructive'}
                  style={kind === 'INVEST'
                    ? { backgroundColor: '#d97706' }
                    : isIncome
                    ? { backgroundColor: '#059669' }
                    : { backgroundColor: '#e11d48' }
                  }
                  className="px-6"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" /> Add {kind === 'INVEST' ? 'Investment' : isIncome ? 'Income' : 'Expense'}</>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* === Expense List — bordered table like the reference image === */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-neutral-800 dark:border-neutral-200 rounded-sm overflow-hidden">
          {/* Section header */}
          <div className="bg-neutral-800 dark:bg-neutral-200 px-4 py-2 text-center">
            <span className="text-sm font-bold uppercase tracking-wide text-white dark:text-black">
              {isIncome ? 'Income' : 'Expense'} List
            </span>
          </div>

          {/* Filters + search */}
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-[10px] text-neutral-500 block mb-0.5">From</Label>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => {
                  const newFrom = e.target.value
                  setFilterFromDate(newFrom)
                  if (newFrom && (!filterToDate || filterToDate < newFrom)) {
                    setFilterToDate(newFrom)
                  }
                }}
                className="w-[130px] h-9 text-xs px-2 border border-neutral-200 dark:border-neutral-800 rounded-md bg-transparent"
              />
            </div>
            <div>
              <Label className="text-[10px] text-neutral-500 block mb-0.5">To</Label>
              <input
                type="date"
                value={filterToDate}
                min={filterFromDate || undefined}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="w-[130px] h-9 text-xs px-2 border border-neutral-200 dark:border-neutral-800 rounded-md bg-transparent"
              />
            </div>
            {(filterFromDate || filterToDate) && (
              <Button variant="ghost" size="sm" className="text-xs text-neutral-400 px-2 h-9" onClick={() => { setFilterFromDate(''); setFilterToDate('') }}>
                Clear
              </Button>
            )}
            <div className="flex-1 min-w-[120px]">
              <Label className="text-[10px] text-neutral-500 block mb-0.5">Search</Label>
              <Input type="text" placeholder="Search..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="text-xs h-9" />
            </div>
            <div className="text-sm font-semibold ml-auto">
              <span className={isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                {CURRENCY}{fmt(total)}
              </span>
            </div>
          </div>

          {/* Entry list */}
          {loadingEntries ? (
            <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" /></div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500">
              {entries.length === 0 ? `No ${isIncome ? 'income' : 'expense'} entries yet.` : 'No entries match your search.'}
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 group hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold tabular-nums ${isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                        {isIncome ? '+' : '−'} {CURRENCY}{fmt(e.amount)}
                      </span>
                      {e.paymentMethod === 'CREDIT' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-medium">CREDIT</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      <span className="font-medium">{e.category}</span>
                      <span className="text-neutral-400"> · {e.date}</span>
                      {e.paymentMethod === 'DUE' && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 font-medium">
                          Due
                        </span>
                      )}
                      {e.paymentMethod && e.paymentMethod !== 'CASH' && e.paymentMethod !== 'CREDIT' && e.paymentMethod !== 'DUE' && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400 font-medium">
                          {e.paymentMethod === 'MOBILE_BANK' ? 'Mobile' : e.paymentMethod === 'CARD' ? 'Card' : 'Bank'}
                          {e.bankAccount ? `: ${e.bankAccount.bankName}` : ''}
                        </span>
                      )}
                    </div>
                    {e.note && <div className="text-xs text-neutral-400 mt-0.5 truncate">{e.note}</div>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-sky-600 opacity-60 hover:opacity-100" onClick={() => openEditDialog(e)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-60 hover:opacity-100" onClick={() => handleDelete(e.id)} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Edit Entry Dialog (admin only) ===== */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Entry — {editingEntry?.category}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Amount ({CURRENCY})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Date</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">{isIncome ? 'Receive Method' : 'Payment Method'}</Label>
              <Select value={editPaymentMethod} onValueChange={(v) => { setEditPaymentMethod(v); if (v !== 'BANK' && v !== 'CARD' && v !== 'MOBILE_BANK') setEditBankAccountId('') }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(isIncome ? PAYMENT_METHODS_INCOME : PAYMENT_METHODS_EXPENSE).map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editNeedsBankAccount && (
              <div>
                <Label className="mb-1.5 block">
                  {editPaymentMethod === 'MOBILE_BANK' ? 'Mobile Account' : editPaymentMethod === 'CARD' ? 'Card Bank Account' : 'Bank Account'}
                </Label>
                {bankAccounts.filter((a) => a.isActive).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-center">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      No active bank accounts. Please add one in Bank Accounts first.
                    </p>
                  </div>
                ) : (
                  <Select value={editBankAccountId} onValueChange={setEditBankAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${editPaymentMethod === 'MOBILE_BANK' ? 'mobile account' : 'bank account'}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.filter((a) => a.isActive).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.bankName} — {a.accountName} ({a.accountNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">Note (optional)</Label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingEntry(null)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={editSubmitting}>
                {editSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
            <p className="text-[11px] text-neutral-400 text-center">
              Only amount, date, payment method, bank account, and note can be edited.
              To change the type/category/supplier, delete and re-add the entry.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
