'use client'

import { useEffect, useState, useCallback } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Truck, Plus, Trash2, Loader2, Pencil, Phone, MapPin, Receipt, GitMerge } from 'lucide-react'
import { toast } from 'sonner'

const CURRENCY = '৳'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface SupplierItem {
  id: string
  name: string
  phone: string | null
  address: string | null
  note: string | null
}

interface BillItem {
  id: string
  supplierId: string
  billDate: string
  billNumber: string | null
  billAmount: number
  paidAmount: number
  note: string | null
  supplier: { id: string; name: string }
}

export default function SupplierEntryView() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [loading, setLoading] = useState(true)

  // supplier create form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // supplier edit form
  const [editing, setEditing] = useState<SupplierItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // bill create form
  const [bills, setBills] = useState<BillItem[]>([])
  const [billSupplierId, setBillSupplierId] = useState('')
  const [billDate, setBillDate] = useState(todayStr())
  const [billNumber, setBillNumber] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [billNote, setBillNote] = useState('')
  const [billSubmitting, setBillSubmitting] = useState(false)
  const [loadingBills, setLoadingBills] = useState(true)

  // bill edit form
  const [editingBill, setEditingBill] = useState<BillItem | null>(null)
  const [editBillSupplier, setEditBillSupplier] = useState('')
  const [editBillDate, setEditBillDate] = useState('')
  const [editBillNumber, setEditBillNumber] = useState('')
  const [editBillAmount, setEditBillAmount] = useState('')
  const [editPaidAmount, setEditPaidAmount] = useState('')
  const [editBillNote, setEditBillNote] = useState('')
  const [editBillSubmitting, setEditBillSubmitting] = useState(false)

  // === Supplier merge state (admin only) ===
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [mergeSource, setMergeSource] = useState<SupplierItem | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState<string>('')
  const [mergeSubmitting, setMergeSubmitting] = useState(false)

  const openMergeDialog = (s: SupplierItem) => {
    setMergeSource(s)
    // Pre-select the first OTHER supplier as default target
    const firstOther = suppliers.find((x) => x.id !== s.id)
    setMergeTargetId(firstOther?.id || '')
  }

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mergeSource || !mergeTargetId) return
    if (mergeSource.id === mergeTargetId) {
      toast.error('Source and target supplier must be different')
      return
    }
    const target = suppliers.find((x) => x.id === mergeTargetId)
    if (!target) {
      toast.error('Target supplier not found')
      return
    }
    if (!confirm(
      `Merge "${mergeSource.name}" INTO "${target.name}"?\n\n` +
      `This will:\n` +
      `  • Move ALL entries (expense + bills) from "${mergeSource.name}" to "${target.name}"\n` +
      `  • Rewrite Entry.category from "${mergeSource.name}" to "${target.name}"\n` +
      `  • DELETE "${mergeSource.name}" supplier record\n` +
      `  • Amounts, dates, notes, payment methods — ALL PRESERVED\n\n` +
      `This action CANNOT be undone. Continue?`
    )) return
    setMergeSubmitting(true)
    try {
      const res = await fetch('/api/admin/merge-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: mergeSource.id,
          targetId: mergeTargetId,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed to merge')
      toast.success(
        `Merged successfully. ` +
        `${d.result.entriesRepointed} entries + ${d.result.billsRepointed} bills moved to "${target.name}".`
      )
      setMergeSource(null)
      setMergeTargetId('')
      load()
      loadBills()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to merge')
    } finally {
      setMergeSubmitting(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/suppliers', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) {
        setSuppliers(d.suppliers)
        if (d.suppliers.length > 0 && !billSupplierId) setBillSupplierId(d.suppliers[0].id)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [billSupplierId])

  const loadBills = useCallback(async () => {
    setLoadingBills(true)
    try {
      const res = await fetch('/api/supplier-bills', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setBills(d.bills)
    } catch {
      // ignore
    } finally {
      setLoadingBills(false)
    }
  }, [])

  useEffect(() => {
    load()
    loadBills()
  }, [load, loadBills])

  // === Supplier handlers ===
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          note: note.trim() || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success(`Supplier "${name.trim()}" added`)
      setName('')
      setPhone('')
      setAddress('')
      setNote('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add supplier')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSupplier = async (s: SupplierItem) => {
    if (!confirm(`Delete supplier "${s.name}"? Existing entries will keep the supplier name.`)) return
    try {
      const res = await fetch(`/api/suppliers/${s.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d?.error || 'Failed')
      }
      toast.success('Supplier deleted')
      setSuppliers((cur) => cur.filter((x) => x.id !== s.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const openEditDialog = (s: SupplierItem) => {
    setEditing(s)
    setEditName(s.name)
    setEditPhone(s.phone || '')
    setEditAddress(s.address || '')
    setEditNote(s.note || '')
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editName.trim()) {
      toast.error('Supplier name is required')
      return
    }
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/suppliers/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim(),
          note: editNote.trim(),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('Supplier updated')
      setEditing(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setEditSubmitting(false)
    }
  }

  // === Bill handlers ===
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!billSupplierId) {
      toast.error('Please select a supplier')
      return
    }
    const bAmt = parseFloat(billAmount)
    if (!billAmount || isNaN(bAmt) || bAmt <= 0) {
      toast.error('Valid bill amount is required')
      return
    }
    setBillSubmitting(true)
    try {
      const res = await fetch('/api/supplier-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: billSupplierId,
          billDate,
          billNumber: billNumber.trim() || undefined,
          billAmount: bAmt,
          paidAmount: paidAmount ? parseFloat(paidAmount) : 0,
          note: billNote.trim() || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('Supplier bill added')
      setBillNumber('')
      setBillAmount('')
      setPaidAmount('')
      setBillNote('')
      loadBills()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add bill')
    } finally {
      setBillSubmitting(false)
    }
  }

  const handleDeleteBill = async (b: BillItem) => {
    if (!confirm(`Delete this bill from "${b.supplier.name}"?`)) return
    try {
      const res = await fetch(`/api/supplier-bills/${b.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Bill deleted')
      setBills((cur) => cur.filter((x) => x.id !== b.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const openEditBillDialog = (b: BillItem) => {
    setEditingBill(b)
    setEditBillSupplier(b.supplierId)
    setEditBillDate(b.billDate)
    setEditBillNumber(b.billNumber || '')
    setEditBillAmount(String(b.billAmount))
    setEditPaidAmount(String(b.paidAmount))
    setEditBillNote(b.note || '')
  }

  const handleEditBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBill) return
    setEditBillSubmitting(true)
    try {
      const res = await fetch(`/api/supplier-bills/${editingBill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: editBillSupplier,
          billDate: editBillDate,
          billNumber: editBillNumber.trim(),
          billAmount: parseFloat(editBillAmount) || 0,
          paidAmount: parseFloat(editPaidAmount) || 0,
          note: editBillNote.trim(),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('Bill updated')
      setEditingBill(null)
      loadBills()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setEditBillSubmitting(false)
    }
  }

  const totalBillAmount = bills.reduce((s, b) => s + b.billAmount, 0)
  const totalPaidAmount = bills.reduce((s, b) => s + b.paidAmount, 0)
  const totalDueAmount = totalBillAmount - totalPaidAmount

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="h-6 w-6" /> Supplier Entry
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Add and manage suppliers — bills &amp; payments are recorded in Expense Entry (Supplier Bill)
        </p>
      </div>

      {/* === Supplier Management === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="sup-name" className="mb-1.5 block">Supplier Name</Label>
                <Input id="sup-name" placeholder="e.g. Shulran Foods" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="sup-phone" className="mb-1.5 block">Phone (optional)</Label>
                <Input id="sup-phone" placeholder="e.g. 017XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sup-address" className="mb-1.5 block">Address (optional)</Label>
                <Input id="sup-address" placeholder="e.g. Dhanmondi, Dhaka" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sup-note" className="mb-1.5 block">Note (optional)</Label>
                <Textarea id="sup-note" placeholder="Any additional info" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Add Supplier</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Suppliers ({suppliers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" />
              </div>
            ) : suppliers.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">
                No suppliers yet. Add one using the form.
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs">Name</TableHead>
                      <TableHead className="h-8 text-xs">Phone</TableHead>
                      <TableHead className="h-8 text-xs">Address</TableHead>
                      <TableHead className="h-8 w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((s) => (
                      <TableRow key={s.id} className="group">
                        <TableCell className="py-2 text-xs font-medium">{s.name}</TableCell>
                        <TableCell className="py-2 text-xs text-neutral-500">
                          {s.phone ? (<span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>) : '—'}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-neutral-500">
                          {s.address ? (<span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.address}</span>) : '—'}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-sky-600 opacity-60 hover:opacity-100" onClick={() => openEditDialog(s)} aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-neutral-400 hover:text-violet-600 opacity-60 hover:opacity-100"
                                onClick={() => openMergeDialog(s)}
                                aria-label="Merge into another supplier"
                                title="Merge into another supplier"
                                disabled={suppliers.length < 2}
                              >
                                <GitMerge className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-60 hover:opacity-100" onClick={() => handleDeleteSupplier(s)} aria-label="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === Supplier Bills Section === */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-2">
          <Receipt className="h-5 w-5 text-sky-600" />
          <h2 className="text-lg font-semibold">Supplier Bills</h2>
        </div>

        {/* Summary cards */}
        {bills.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-sky-200 bg-sky-50/60 dark:bg-sky-950/30 dark:border-sky-900">
              <CardContent className="py-3">
                <div className="text-xs text-sky-700 dark:text-sky-400 font-medium">Total Bill</div>
                <div className="text-base font-bold text-sky-700 dark:text-sky-400">{CURRENCY}{fmt(totalBillAmount)}</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900">
              <CardContent className="py-3">
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Total Paid</div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">{CURRENCY}{fmt(totalPaidAmount)}</div>
              </CardContent>
            </Card>
            <Card className="border-rose-200 bg-rose-50/60 dark:bg-rose-950/30 dark:border-rose-900">
              <CardContent className="py-3">
                <div className="text-xs text-rose-700 dark:text-rose-400 font-medium">Total Due</div>
                <div className="text-base font-bold text-rose-700 dark:text-rose-400">{CURRENCY}{fmt(totalDueAmount)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bill Add Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Bill</CardTitle>
            </CardHeader>
            <CardContent>
              {suppliers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-center">
                  <p className="text-sm text-neutral-500 mb-1">No suppliers yet.</p>
                  <p className="text-xs text-neutral-400">Add a supplier first, then record bills.</p>
                </div>
              ) : (
                <form onSubmit={handleCreateBill} className="space-y-4">
                  <div>
                    <Label className="mb-1.5 block">Supplier</Label>
                    <Select value={billSupplierId} onValueChange={setBillSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 block">Bill Date</Label>
                      <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} required />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Bill Number</Label>
                      <Input placeholder="e.g. INV-001" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 block">Bill Amount ({CURRENCY})</Label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} required />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Paid Amount ({CURRENCY})</Label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Note (optional)</Label>
                    <Textarea placeholder="e.g. 30 days credit" value={billNote} onChange={(e) => setBillNote(e.target.value)} rows={2} />
                  </div>
                  <Button type="submit" className="w-full" disabled={billSubmitting}>
                    {billSubmitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
                    ) : (
                      <><Plus className="h-4 w-4 mr-2" /> Add Bill</>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Bills List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Bills ({bills.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingBills ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" />
                </div>
              ) : bills.length === 0 ? (
                <div className="py-12 text-center text-sm text-neutral-500">
                  No bills yet. Add one using the form.
                </div>
              ) : (
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 text-xs whitespace-nowrap">Date</TableHead>
                        <TableHead className="h-8 text-xs">Supplier</TableHead>
                        <TableHead className="h-8 text-xs text-right">Bill</TableHead>
                        <TableHead className="h-8 text-xs text-right">Paid</TableHead>
                        <TableHead className="h-8 text-xs text-right">Due</TableHead>
                        <TableHead className="h-8 w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.slice().reverse().map((b) => {
                        const due = b.billAmount - b.paidAmount
                        return (
                          <TableRow key={b.id} className="group">
                            <TableCell className="py-2 text-xs whitespace-nowrap">{b.billDate.split('-').reverse().join('/')}</TableCell>
                            <TableCell className="py-2 text-xs font-medium">{b.supplier.name}{b.billNumber ? <span className="text-neutral-400 ml-1">#{b.billNumber}</span> : ''}</TableCell>
                            <TableCell className="py-2 text-xs text-right tabular-nums">{fmt(b.billAmount)}</TableCell>
                            <TableCell className="py-2 text-xs text-right tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(b.paidAmount)}</TableCell>
                            <TableCell className={`py-2 text-xs text-right tabular-nums font-semibold ${due > 0 ? 'text-rose-700 dark:text-rose-400' : ''}`}>{fmt(due)}</TableCell>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-sky-600 opacity-0 group-hover:opacity-100" onClick={() => openEditBillDialog(b)} aria-label="Edit bill">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteBill(b)} aria-label="Delete bill">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* === Edit Supplier Dialog === */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Supplier — {editing?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div><Label className="mb-1.5 block">Supplier Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></div>
            <div><Label className="mb-1.5 block">Phone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
            <div><Label className="mb-1.5 block">Address</Label><Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} /></div>
            <div><Label className="mb-1.5 block">Note</Label><Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} /></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editSubmitting}>
                {editSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>) : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* === Edit Bill Dialog === */}
      <Dialog open={!!editingBill} onOpenChange={(open) => !open && setEditingBill(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bill — {editingBill?.supplier.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditBillSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Supplier</Label>
              <Select value={editBillSupplier} onValueChange={setEditBillSupplier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5 block">Bill Date</Label><Input type="date" value={editBillDate} onChange={(e) => setEditBillDate(e.target.value)} /></div>
              <div><Label className="mb-1.5 block">Bill Number</Label><Input value={editBillNumber} onChange={(e) => setEditBillNumber(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5 block">Bill Amount ({CURRENCY})</Label><Input type="number" step="0.01" value={editBillAmount} onChange={(e) => setEditBillAmount(e.target.value)} /></div>
              <div><Label className="mb-1.5 block">Paid Amount ({CURRENCY})</Label><Input type="number" step="0.01" value={editPaidAmount} onChange={(e) => setEditPaidAmount(e.target.value)} /></div>
            </div>
            <div><Label className="mb-1.5 block">Note</Label><Textarea value={editBillNote} onChange={(e) => setEditBillNote(e.target.value)} rows={2} /></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingBill(null)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editBillSubmitting}>
                {editBillSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>) : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* === Merge Supplier Dialog (admin only) === */}
      <Dialog open={!!mergeSource} onOpenChange={(open) => !open && setMergeSource(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-violet-600" />
              Merge Supplier
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMergeSubmit} className="space-y-4">
            <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/60 dark:bg-violet-950/20 p-3 space-y-2">
              <div className="text-xs text-neutral-500">Source (will be deleted):</div>
              <div className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                {mergeSource?.name}
              </div>
            </div>
            <div className="text-center text-neutral-400 text-xs">↓ all entries &amp; bills move to ↓</div>
            <div>
              <Label className="mb-1.5 block">Target supplier (kept):</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.filter((s) => s.id !== mergeSource?.id).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 text-[11px] text-neutral-500 space-y-1">
              <p className="font-medium text-neutral-700 dark:text-neutral-300">What happens:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>All entries &amp; bills from "{mergeSource?.name}" move to the target supplier</li>
                <li>Entry.category renamed from "{mergeSource?.name}" to target name</li>
                <li>Amounts, dates, notes, payment methods — all preserved</li>
                <li>"{mergeSource?.name}" supplier record will be deleted</li>
              </ul>
              <p className="text-rose-600 font-medium mt-1.5">⚠ This action cannot be undone.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setMergeSource(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" className="flex-1" disabled={mergeSubmitting || !mergeTargetId}>
                {mergeSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Merging...</>
                ) : (
                  <><GitMerge className="h-4 w-4 mr-2" /> Merge &amp; Delete Source</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
