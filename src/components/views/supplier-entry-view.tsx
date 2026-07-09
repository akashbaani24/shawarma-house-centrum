'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Truck, Plus, Trash2, Loader2, Pencil, Phone, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface SupplierItem {
  id: string
  name: string
  phone: string | null
  address: string | null
  note: string | null
}

export default function SupplierEntryView() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [loading, setLoading] = useState(true)

  // create form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // edit form
  const [editing, setEditing] = useState<SupplierItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/suppliers', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setSuppliers(d.suppliers)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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

  const handleDelete = async (s: SupplierItem) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add form */}
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

        {/* List */}
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
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-60 hover:opacity-100" onClick={() => handleDelete(s)} aria-label="Delete">
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

      {/* Edit Dialog */}
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
    </div>
  )
}
