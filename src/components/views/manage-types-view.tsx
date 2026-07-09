'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Loader2, Tags, ArrowUpCircle, ArrowDownCircle, TrendingUp, Landmark } from 'lucide-react'
import { toast } from 'sonner'

interface TypeItem {
  id: string
  name: string
  kind: string
}

export default function ManageTypesView() {
  const [types, setTypes] = useState<TypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'INCOME' | 'EXPENSE' | 'INVEST' | 'DEPOSIT'>('INCOME')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/types', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setTypes(d.types)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      toast.error('Type name is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, kind: newKind }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success(`Type "${name}" created`)
      setNewName('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete type "${name}"? Existing entries will keep their category name.`)) return
    try {
      const res = await fetch(`/api/types/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d?.error || 'Failed')
      }
      toast.success('Type deleted')
      setTypes((cur) => cur.filter((t) => t.id !== id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const incomeTypes = types.filter((t) => t.kind === 'INCOME')
  const expenseTypes = types.filter((t) => t.kind === 'EXPENSE')
  const investTypes = types.filter((t) => t.kind === 'INVEST')
  const depositTypes = types.filter((t) => t.kind === 'DEPOSIT')

  const renderList = (list: TypeItem[], kind: 'INCOME' | 'EXPENSE' | 'INVEST' | 'DEPOSIT') => {
    const isIncome = kind === 'INCOME'
    const label = kind === 'INCOME' ? 'income' : kind === 'EXPENSE' ? 'expense' : kind === 'INVEST' ? 'investment' : 'deposit'
    if (list.length === 0) {
      return (
        <div className="py-10 text-center text-sm text-neutral-500">
          No {label} types yet.
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {list.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 group">
            <div className="flex items-center gap-2">
              {kind === 'INCOME' ? (
                <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
              ) : kind === 'INVEST' ? (
                <TrendingUp className="h-4 w-4 text-amber-600" />
              ) : kind === 'DEPOSIT' ? (
                <Landmark className="h-4 w-4 text-sky-600" />
              ) : (
                <ArrowDownCircle className="h-4 w-4 text-rose-600" />
              )}
              <span className="text-sm font-medium">{t.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-neutral-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"
              onClick={() => handleDelete(t.id, t.name)}
              aria-label="Delete type"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Tags className="h-6 w-6" /> Manage Types
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Create and manage income &amp; expense categories
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Type</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label className="mb-2 block">Kind</Label>
                <Tabs value={newKind} onValueChange={(v) => setNewKind(v as 'INCOME' | 'EXPENSE' | 'INVEST' | 'DEPOSIT')}>
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="INCOME" className="data-[state=active]:text-emerald-600">
                      <ArrowUpCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Income
                    </TabsTrigger>
                    <TabsTrigger value="EXPENSE" className="data-[state=active]:text-rose-600">
                      <ArrowDownCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Expense
                    </TabsTrigger>
                    <TabsTrigger value="INVEST" className="data-[state=active]:text-amber-600">
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Invest
                    </TabsTrigger>
                    <TabsTrigger value="DEPOSIT" className="data-[state=active]:text-sky-600">
                      <Landmark className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Deposit
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div>
                <Label htmlFor="type-name" className="mb-1.5 block">Type Name</Label>
                <Input
                  id="type-name"
                  placeholder="e.g. Vendor Bill"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Create Type</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Existing Types ({types.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="h-5 w-5 animate-spin inline-block text-neutral-400" />
              </div>
            ) : (
              <Tabs defaultValue="INCOME">
                <TabsList className="grid grid-cols-4 w-full mb-4">
                  <TabsTrigger value="INCOME">
                    Income ({incomeTypes.length})
                  </TabsTrigger>
                  <TabsTrigger value="EXPENSE">
                    Expense ({expenseTypes.length})
                  </TabsTrigger>
                  <TabsTrigger value="INVEST">
                    Invest ({investTypes.length})
                  </TabsTrigger>
                  <TabsTrigger value="DEPOSIT">
                    Deposit ({depositTypes.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="INCOME">{renderList(incomeTypes, 'INCOME')}</TabsContent>
                <TabsContent value="EXPENSE">{renderList(expenseTypes, 'EXPENSE')}</TabsContent>
                <TabsContent value="INVEST">{renderList(investTypes, 'INVEST')}</TabsContent>
                <TabsContent value="DEPOSIT">{renderList(depositTypes, 'DEPOSIT')}</TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
