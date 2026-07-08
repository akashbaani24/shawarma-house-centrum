'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Loader2, Save, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsView() {
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/business-profile', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok) setLogoUrl(d.logoUrl || '')
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
    </div>
  )
}
