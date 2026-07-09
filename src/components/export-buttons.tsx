'use client'

import { Button } from '@/components/ui/button'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { exportToExcel, exportToPDF, type ExportData } from '@/lib/export-utils'

export function ExportButtons({ data }: { data: ExportData }) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToExcel(data)}
        title="Export to Excel"
      >
        <FileSpreadsheet className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Excel</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToPDF(data)}
        title="Export to PDF"
      >
        <FileText className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">PDF</span>
      </Button>
    </div>
  )
}
