'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Settings, Loader2, Save, Image as ImageIcon, Plus, Tags } from 'lucide-react'
import { toast } from 'sonner'

interface ExpenseCategoryItem {
  id: string
  name: string
  itemType: string
}

export default function SettingsView() {
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Expense categories
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatItemType, setNewCatItemType] = useState<'TYPE' | 'SUPPLIER'>('TYPE')
  const [catSubmitting, setCatSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [logoRes, catRes] = await Promise.all([
        fetch('/api/business-profile', { cache: 'no-store' }),
        fetch('/api/expense-categories', { cache: 'no-store' }),
      ])
      const logoD = await logoRes.json()
      if (logoRes.ok) setLogoUrl(logoD.logoUrl || '')
      const catD = await catRes.json()
      if (catRes.ok) setCategories(catD.categories || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: logoUrl.trim() || null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success('Logo updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) {
      toast.error('Category name is required')
      return
    }
    setCatSubmitting(true)
    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), itemType: newCatItemType }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success(`Expense category "${newCatName.trim()}" added`)
      setNewCatName('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add category')
    } finally {
      setCatSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Settings
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Configure business profile and report logo
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Company Logo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="logo-url" className="mb-1.5 block">Logo Image URL</Label>
              <Input
                id="logo-url"
                type="url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
              <p className="text-xs text-neutral-500 mt-1.5">
                Paste a direct image URL (PNG, JPG, WebP). The logo will appear in the
                header of all reports (Branch Daily Report, Expense Details, Investment Report).
              </p>
            </div>

            {/* Preview */}
            {logoUrl && (
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                <Label className="mb-2 block">Preview</Label>
                <div className="flex items-center gap-3">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-16 w-16 object-contain rounded border border-neutral-200 dark:border-neutral-800"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <span className="text-sm text-neutral-500">
                    This is how the logo will look in report headers.
                  </span>
                </div>
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Save Logo</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Expense Categories management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tags className="h-4 w-4" /> Expense Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-neutral-500">
            These are the main categories shown in the Type dropdown of Expense Entry
            (both Branch &amp; Office). New categories appear automatically.
          </p>

          {/* List existing categories */}
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <Badge variant="secondary" className={
                    c.itemType === 'SUPPLIER'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400'
                  }>
                    {c.itemType === 'SUPPLIER' ? 'Supplier list' : 'Expense heads'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Add new category */}
          <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <Input
              placeholder="New category name (e.g. Asset Purchase)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1"
            />
            <Select value={newCatItemType} onValueChange={(v) => setNewCatItemType(v as 'TYPE' | 'SUPPLIER')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TYPE">Uses Expense Heads</SelectItem>
                <SelectItem value="SUPPLIER">Uses Suppliers</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={catSubmitting}>
              {catSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
