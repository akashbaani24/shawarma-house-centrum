'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, Loader2, Trash2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

export default function ResetDataView() {
  const [confirmText, setConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleReset = async () => {
    if (confirmText !== 'RESET') {
      toast.error('Please type RESET exactly to confirm')
      return
    }
    setResetting(true)
    try {
      const res = await fetch('/api/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Failed')
      toast.success(
        `Data reset complete — ${d.deleted.entries} entries, ${d.deleted.openingBalances} opening balances, ${d.deleted.denominations} denominations deleted`,
      )
      setConfirmText('')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-6 w-6" /> Reset Data
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Admin only — permanently delete all transaction data
        </p>
      </div>

      {/* Warning banner */}
      <div className="rounded-lg border-2 border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30 p-4">
        <div className="flex gap-3">
          <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-rose-900 dark:text-rose-200">
            <p className="font-semibold">⚠ সতর্কতা — এই কাজটি ফেরানো যাবে না!</p>
            <p className="text-rose-800 dark:text-rose-300">
              এই অপশনটি ব্যবহার করলে নিচের সব ডেটা স্থায়ীভাবে মুছে যাবে:
            </p>
            <ul className="list-disc list-inside text-rose-800 dark:text-rose-300 text-xs space-y-0.5 ml-2">
              <li>সব Income ও Expense entries</li>
              <li>সব Opening Balance entries</li>
              <li>সব Denomination of Closing Cash entries</li>
            </ul>
            <p className="text-rose-800 dark:text-rose-300 text-xs">
              <strong>মুছবে না:</strong> User accounts, Entry Types, এবং অন্যান্য সেটিংস।
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirm Reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="confirm-text" className="mb-1.5 block">
              নিশ্চিত করতে টাইপ করুন: <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-rose-600 font-mono">RESET</code>
            </Label>
            <Input
              id="confirm-text"
              placeholder="RESET"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="font-mono"
            />
          </div>

          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                disabled={confirmText !== 'RESET'}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Reset All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-5 w-5" /> Final confirmation
                </AlertDialogTitle>
                <AlertDialogDescription>
                  আপনি কি সত্যিই সব transaction data মুছে ফেলতে চান? এই কাজটি <strong>ফেরানো যাবে না</strong>।
                  সব income, expense, opening balance এবং denomination entries স্থায়ীভাবে মুছে যাবে।
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetting}>বাতিল করুন</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    handleReset()
                  }}
                  disabled={resetting}
                  className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
                >
                  {resetting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> মুছছি...</>
                  ) : (
                    'হ্যাঁ, সব মুছে ফেলুন'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <p className="text-xs text-neutral-400 text-center">
            এই অপশনটি শুধু ADMIN দেখতে ও ব্যবহার করতে পারবে।
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
