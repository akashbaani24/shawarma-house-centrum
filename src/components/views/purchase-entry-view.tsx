'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ShoppingCart, Plus, Trash2, Loader2, Eye,
} from 'lucide-react'
import { toast } from 'sonner'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CURRENCY = '৳'

// Common units of measure — the user can still type a custom one
const COMMON_UOM = ['kg', 'gm', 'pcs', 'pack', 'box', 'ltr', 'ml', 'dozen', 'bundle', 'roll']

interface SupplierItem {
  id: string
  name: string
}

interface PurchaseItem {
  id: string
  itemName: string
  qty: number
  uom: string
  unitPrice: number
  total: number
}

interface PurchaseRow {
  id: string
  purchaseDate: string
  invoiceNumber: string | null
  note: string | null
  supplier: { id: string; name: string }
  items: PurchaseItem[]
  creator: { name: string | null; email: string } | null
  createdAt: string
}

// Form-state line item (no id yet — gets one when saved)
interface FormItem {
  key: string  // local React key
  itemName: string
  qty: string
  uom: string
  unitPrice: string
}

let itemKeyCounter = 0
function newFormItem(): FormItem {
  itemKeyCounter += 1
  return { key: `item-${itemKeyCounter}`, itemName: '', qty: '', uom: 'kg', unitPrice: '' }
}

export default function PurchaseEntryView() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(todayStr())
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<FormItem[]>([newFormItem()])

  // Filter state
  const [filterSupplierId, setFilterSupplierId] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // View detail dialog
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)
      if (filterSupplierId && filterSupplierId !== 'all') params.set('supplierId', filterSupplierId)
      const res = await fetch(`/api/purchases?${params.toString()}`, { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) {
        setPurchases(d.purchases || [])
        // Pre-select first supplier in the form if not set
        if (d.suppliers?.length > 0 && !supplierId) {
          setSupplierId(d.suppliers[0].id)
        }
        setSuppliers(d.suppliers || [])
      } else {
        toast.error(d?.error || 'Failed to load')
      }
    } catch {
      toast.error('Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, filterSupplierId, supplierId])

  useEffect(() => { load() }, [load])

  // === Form item management ===
  const updateItem = (key: string, field: keyof FormItem, value: string) => {
    setItems((cur) => cur.map((it) => (it.key === key ? { ...it, [field]: value } : it)))
  }
  const addItem = () => setItems((cur) => [...cur, newFormItem()])
  const removeItem = (key: string) => setItems((cur) => cur.length > 1 ? cur.filter((it) => it.key !== key) : cur)

  // Compute live totals for the form
  const formTotals = items.reduce(
    (acc, it) => {
      const qty = parseFloat(it.qty) || 0
      const price = parseFloat(it.unitPrice) || 0
      acc.total += qty * price
      if (it.itemName.trim() && qty > 0 && price >= 0) acc.validItems += 1
      return acc
    },
    { total: 0, validItems: 0 },
  )

  // === Submit ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }
    if (!purchaseDate) {
      toast.error('Please select a purchase date')
      return
    }
    if (formTotals.validItems === 0) {
      toast.error('Add at least one valid line item (name, qty, unit price)')
      return
    }

    // Build the payload — only include items with a name + qty > 0
    const payloadItems = items
      .filter((it) => it.itemName.trim() && (parseFloat(it.qty) || 0) > 0)
      .map((it) => ({
        itemName: it.itemName.trim(),
        qty: parseFloat(it.qty),
        uom: it.uom.trim() || 'pcs',
        unitPrice: parseFloat(it.unitPrice) || 0,
      }))

    setSubmitting(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          purchaseDate,
          invoiceNumber: invoiceNumber.trim() || undefined,
          note: note.trim() || undefined,
          items: payloadItems,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success(`Purchase of ${CURRENCY}${fmt(payloadItems.reduce((s, it) => s + it.qty * it.unitPrice, 0))} added`)
      // Reset form
      setInvoiceNumber('')
      setNote('')
      setItems([newFormItem()])
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save purchase')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (p: PurchaseRow) => {
    if (!confirm(`Delete this purchase from "${p.supplier.name}" on ${p.purchaseDate}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/purchases/${p.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d?.error || 'Failed')
      }
      toast.success('Purchase deleted')
      setPurchases((cur) => cur.filter((x) => x.id !== p.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  // === Render ===
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-sky-600" /> Purchase Entry
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Record purchases from suppliers with itemized line items (qty, UoM, unit price)
        </p>
      </div>

      {suppliers.length === 0 && !loading && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No suppliers yet. Please add suppliers in the <strong>Supplier Entry</strong> menu first.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* === Form === */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Purchase</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Supplier + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Supplier</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Purchase Date</Label>
                  <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
                </div>
              </div>

              {/* Invoice number + note */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Invoice / Challan No. (optional)</Label>
                  <Input placeholder="e.g. INV-001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Note (optional)</Label>
                  <Input placeholder="e.g. bulk purchase" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="space-y-2 rounded-lg border border-neutral-200 dark:border-neutral-800 p-2">
                  {/* Header (hidden on mobile) */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-medium text-neutral-500 uppercase tracking-wide px-1">
                    <div className="col-span-4">Item</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-2">UoM</div>
                    <div className="col-span-2">Unit Price</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                  {items.map((it) => {
                    const qty = parseFloat(it.qty) || 0
                    const price = parseFloat(it.unitPrice) || 0
                    const total = qty * price
                    return (
                      <div key={it.key} className="grid grid-cols-12 gap-2 items-center">
                        <Input
                          className="col-span-12 sm:col-span-4 text-xs h-8"
                          placeholder="Item name"
                          value={it.itemName}
                          onChange={(e) => updateItem(it.key, 'itemName', e.target.value)}
                        />
                        <Input
                          className="col-span-4 sm:col-span-2 text-xs h-8 tabular-nums"
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0"
                          value={it.qty}
                          onChange={(e) => updateItem(it.key, 'qty', e.target.value)}
                        />
                        <Select value={it.uom} onValueChange={(v) => updateItem(it.key, 'uom', v)}>
                          <SelectTrigger className="col-span-4 sm:col-span-2 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_UOM.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="col-span-4 sm:col-span-2 text-xs h-8 tabular-nums"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(it.key, 'unitPrice', e.target.value)}
                        />
                        <div className="col-span-3 sm:col-span-1 text-right text-xs tabular-nums font-medium">
                          {total > 0 ? fmt(total) : '—'}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-neutral-300 hover:text-rose-600"
                            onClick={() => removeItem(it.key)}
                            disabled={items.length === 1}
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Form total */}
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-neutral-500">{formTotals.validItems} item(s) · Grand Total:</span>
                  <span className="font-bold tabular-nums">{CURRENCY}{fmt(formTotals.total)}</span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || suppliers.length === 0}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Save Purchase</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* === List === */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Purchases ({purchases.length})</span>
              {purchases.length > 0 && (
                <span className="text-sm font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                  {CURRENCY}{fmt(purchases.reduce((s, p) => s + p.items.reduce((ss, it) => ss + it.total, 0), 0))}
                </span>
              )}
            </CardTitle>
            {/* Filters */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Select value={filterSupplierId} onValueChange={setFilterSupplierId}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="All suppliers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-[130px] h-8 text-xs" aria-label="From date" />
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-[130px] h-8 text-xs" aria-label="To date" />
              {(filterFrom || filterTo || filterSupplierId !== 'all') && (
                <Button variant="ghost" size="sm" className="text-xs text-neutral-400 px-2" onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterSupplierId('all') }}>
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" /></div>
            ) : purchases.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                No purchases yet. Add one using the form.
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                {purchases.map((p) => {
                  const total = p.items.reduce((s, it) => s + it.total, 0)
                  return (
                    <div key={p.id} className="px-4 py-3 group">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold tabular-nums text-sky-700 dark:text-sky-400">
                              {CURRENCY}{fmt(total)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 font-medium">
                              {p.items.length} item{p.items.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            <span className="font-medium">{p.supplier.name}</span>
                            <span className="text-neutral-400"> · {p.purchaseDate.split('-').reverse().join('/')}</span>
                            {p.invoiceNumber && <span className="text-neutral-400"> · {p.invoiceNumber}</span>}
                          </div>
                          {/* Item preview */}
                          <div className="text-[11px] text-neutral-500 mt-1 truncate">
                            {p.items.map((it) => `${it.itemName} (${it.qty} ${it.uom})`).join(', ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-neutral-400 hover:text-sky-600 opacity-60 hover:opacity-100"
                            onClick={() => setViewingPurchase(p)}
                            aria-label="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-60 hover:opacity-100"
                            onClick={() => handleDelete(p)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === View Purchase Detail Dialog === */}
      <Dialog open={!!viewingPurchase} onOpenChange={(open) => !open && setViewingPurchase(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Details</DialogTitle>
          </DialogHeader>
          {viewingPurchase && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-neutral-500">Supplier</div>
                  <div className="font-medium">{viewingPurchase.supplier.name}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Date</div>
                  <div className="font-medium tabular-nums">{viewingPurchase.purchaseDate.split('-').reverse().join('/')}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Invoice / Challan</div>
                  <div className="font-medium">{viewingPurchase.invoiceNumber || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Created by</div>
                  <div className="font-medium">{viewingPurchase.creator?.name || viewingPurchase.creator?.email || '—'}</div>
                </div>
                {viewingPurchase.note && (
                  <div className="col-span-2">
                    <div className="text-[11px] text-neutral-500">Note</div>
                    <div className="text-sm">{viewingPurchase.note}</div>
                  </div>
                )}
              </div>

              {/* Items table */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-sm overflow-hidden">
                <Table className="text-[12px]">
                  <TableHeader>
                    <TableRow className="bg-neutral-50 dark:bg-neutral-900">
                      <TableHead className="h-7 px-2 text-[11px] font-semibold">Item</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-semibold text-right">Qty</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-semibold">UoM</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-semibold text-right">Unit Price</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-semibold text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPurchase.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="py-1.5 px-2 font-medium">{it.itemName}</TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums">{it.qty}</TableCell>
                        <TableCell className="py-1.5 px-2">{it.uom}</TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums">{fmt(it.unitPrice)}</TableCell>
                        <TableCell className="py-1.5 px-2 text-right tabular-nums font-semibold">{fmt(it.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-neutral-100 dark:bg-neutral-900 border-t-2 border-neutral-800 dark:border-neutral-200">
                      <TableCell className="py-2 px-2 text-[12px] font-bold" colSpan={4}>GRAND TOTAL -</TableCell>
                      <TableCell className="py-2 px-2 text-right tabular-nums font-bold">
                        {CURRENCY}{fmt(viewingPurchase.items.reduce((s, it) => s + it.total, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingPurchase(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
