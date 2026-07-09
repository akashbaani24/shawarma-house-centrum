'use client'

import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportColumn {
  header: string
  key: string
}

interface ExportData {
  businessName: string
  reportTitle: string
  dateRange?: string
  columns: ExportColumn[]
  rows: (string | number)[][]
  totalsRow?: (string | number)[]
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Currency prefix for Excel/CSV — the Bangladeshi Taka symbol ৳ renders fine
// in spreadsheet apps (which use the OS font).
const XLSX_CURRENCY = '৳'

// Currency prefix for PDF — jsPDF's built-in Helvetica font does NOT support
// the ৳ glyph, so it shows as a garbage character (ó or similar). Use the
// ASCII abbreviation "Tk " instead. This is also the conventional way to
// write Bangladeshi Taka in plain-text contexts.
const PDF_CURRENCY = 'Tk '

// Replace any leading ৳ currency symbol in a cell value with the PDF-safe
// "Tk " prefix. Also handles wrapped values like "৳(123.00)" → "Tk (123.00)".
function sanitizeForPdf(value: string): string {
  return value.replace(/৳\s*/g, PDF_CURRENCY)
}

export function exportToExcel(data: ExportData) {
  const wb = XLSX.utils.book_new()

  // Title row
  const titleRows = [
    [data.businessName],
    [data.reportTitle],
    data.dateRange ? [data.dateRange] : [],
    [],
  ]

  // Header + data
  const headers = data.columns.map((c) => c.header)
  const allRows = [...titleRows, headers, ...data.rows]
  if (data.totalsRow) allRows.push(data.totalsRow)

  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!cols'] = data.columns.map(() => ({ wch: 18 }))

  // Merge title cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  const filename = `${data.reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}

export function exportToPDF(data: ExportData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(data.businessName, pageWidth / 2, 15, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(data.reportTitle, pageWidth / 2, 22, { align: 'center' })

  if (data.dateRange) {
    doc.setFontSize(10)
    doc.text(data.dateRange, pageWidth / 2, 28, { align: 'center' })
  }

  // Sanitize all cells: replace ৳ with "Tk " so jsPDF renders correctly
  const sanitizeRow = (row: (string | number)[]) =>
    row.map((cell) => sanitizeForPdf(String(cell)))

  // Table
  autoTable(doc, {
    head: [data.columns.map((c) => c.header)],
    body: data.rows.map((row) => sanitizeRow(row)),
    foot: data.totalsRow ? [sanitizeRow(data.totalsRow)] : undefined,
    startY: 34,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
    margin: { left: 10, right: 10 },
  })

  // Footer
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 34
  doc.setFontSize(8)
  doc.text(`Generated on ${new Date().toLocaleString('en-GB')}`, 10, finalY + 10)

  const filename = `${data.reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// Re-export the currency constants so views can build cells consistently
export { XLSX_CURRENCY, PDF_CURRENCY, sanitizeForPdf }
void fmt
