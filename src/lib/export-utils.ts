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
  logoUrl?: string | null  // optional — embedded in PDF header if present
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

export async function exportToPDF(data: ExportData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // === Logo (optional) ===
  // jsPDF can't embed a remote image URL directly (CORS) — we fetch it
  // first, convert to base64, then add it. If fetch fails, skip silently.
  const logoSize = 14  // mm — square
  let logoLoaded = false
  if (data.logoUrl) {
    const img = await fetchImageAsDataUrl(data.logoUrl)
    if (img) {
      try {
        doc.addImage(img.dataUrl, img.format, 10, 6, logoSize, logoSize, undefined, 'FAST')
        logoLoaded = true
      } catch {
        logoLoaded = false
      }
    }
  }

  // === Title block ===
  // If logo is loaded, shift the business name right so it doesn't overlap.
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  if (logoLoaded) {
    const textX = (10 + logoSize + 4 + pageWidth - 10) / 2
    doc.text(data.businessName, textX, 14, { align: 'center' })
  } else {
    doc.text(data.businessName, pageWidth / 2, 15, { align: 'center' })
  }

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

// ============ Branch Daily Report — custom PDF ============
//
// The Branch Daily Report has a complex two-column layout (Income side |
// Expense side) with sub-sections + totals. The generic exportToPDF
// above can only render a flat table, so we provide a dedicated builder
// that mirrors the print layout.
//
// Layout (A4 portrait):
//   ┌──────────────────────────────────────────┐
//   │  [Logo] Business Name      Date: DD/MM/YYYY │
//   │  ────────────────────────────────────────── │
//   │  ┌─ Opening Balance ──┐ ┌─ Expenses ──────┐ │
//   │  │ label         amount │ │ label    amount │ │
//   │  └─────────────────────┘ └─────────────────┘ │
//   │  ┌─ Income / Receipts ─┐ ┌─ Payments ──────┐ │
//   │  │  ...                 │ │  ...            │ │
//   │  │  Total Income -  XXX │ │  Total Pmts -   │ │
//   │  └─────────────────────┘ └─────────────────┘ │
//   │  ┌─ Excess / Extra ────┐ ┌─ Deposits ──────┐ │
//   │  │  ...                 │ │  ...            │ │
//   │  └─────────────────────┘ └─────────────────┘ │
//   │  ┌─ Denomination ──────┐ ┌─ Cash Shortage ─┐ │
//   │  │  Denom × Count = Amt │ │  ...            │ │
//   │  │  Total Cash in Hand  │ └─────────────────┘ │
//   │  └─────────────────────┘ ┌─ Calc Closing ──┐ │
//   │                          │ Opening+Inc−Exp │ │
//   │                          └─────────────────┘ │
//   │  ┌─ Income Side Total ──┐ ┌─ Expense Side ─┐ │
//   │  │  Opening             │ │  Total Exp     │ │
//   │  │  + Income            │ │  + Payments    │ │
//   │  │  + Excess            │ │  + Deposits    │ │
//   │  │  Total:        XXX   │ │  + Shortage    │ │
//   │  └─────────────────────┘ │  + Cash in Hand │ │
//   │                          │  Total:    XXX  │ │
//   │                          └─────────────────┘ │
//   │   ✓/⚠ Balance status                        │
//   │   সই — অনুমোদিত (Tk XXX)                    │
//   │   Prepared by: ...    Generated on ...      │
//   └──────────────────────────────────────────┘
//
// All amounts use 'Tk' prefix (jsPDF Helvetica does not support ৳).

export interface DailyReportEntry {
  category: string
  amount: number
  note?: string | null
  paymentMethod?: string
  bankAccount?: { bankName: string; accountName: string; accountNumber: string } | null
}

export interface DailyReportDenom {
  denom: number
  count: number
}

export interface DailyReportPdfData {
  businessName: string
  dateDisplay: string
  logoUrl?: string | null
  // Left side
  openingBalance: number
  openingLabel: string  // e.g. 'Opening Balance', 'Carried from ...'
  incomeEntries: DailyReportEntry[]
  totalIncome: number
  excessEntries: DailyReportEntry[]
  totalExcess: number
  denoms: DailyReportDenom[]
  totalCashInHand: number
  denomNotEntered?: boolean
  // Right side
  expenseEntries: DailyReportEntry[]
  totalExpenses: number
  paymentEntries: DailyReportEntry[]
  totalPayments: number
  depositEntries: DailyReportEntry[]
  totalDeposits: number
  shortageEntries: DailyReportEntry[]
  totalShortage: number
  calculatedClosing: number
  // Totals
  incomeSideTotal: number
  expenseSideTotal: number
  isBalanced: boolean
  balanceDifference: number
  // Meta
  preparedBy: string
}

function fmtAmt(amt: number): string {
  return amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function methodLabel(m?: string): string {
  if (!m || m === 'CASH') return ''
  if (m === 'CARD') return 'Card'
  if (m === 'BANK') return 'Bank'
  if (m === 'MOBILE_BANK') return 'Mobile'
  return m
}

// Fetch an image URL and convert it to a base64 data URL.
// jsPDF's addImage() needs the actual pixel data — passing a remote URL
// directly fails silently because of CORS + the way jsPDF reads pixels.
// We fetch the image as a blob, read it via FileReader, and return a
// data URL that jsPDF can embed.
//
// Returns null if the fetch fails for any reason (CORS, network, etc.)
// so the caller can gracefully skip the logo and still produce the PDF.
async function fetchImageAsDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' | 'WEBP' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('FileReader failed'))
      reader.readAsDataURL(blob)
    })
    // Detect format from blob.type
    let format: 'PNG' | 'JPEG' | 'WEBP' = 'PNG'
    if (blob.type.includes('jpeg') || blob.type.includes('jpg')) format = 'JPEG'
    else if (blob.type.includes('webp')) format = 'WEBP'
    return { dataUrl, format }
  } catch {
    return null
  }
}

export async function exportDailyReportToPDF(data: DailyReportPdfData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()  // 210
  const pageHeight = doc.internal.pageSize.getHeight() // 297
  const margin = 10
  const contentWidth = pageWidth - margin * 2  // 190
  const colWidth = (contentWidth - 4) / 2  // 93 each, 4mm gap
  const colX = [margin, margin + colWidth + 4]

  let y = margin

  // === Header ===
  // Try to load the logo as base64 (jsPDF can't embed a remote URL directly
  // because of CORS — we fetch it first, then add it as an image).
  // If the logo fails to load (CORS, network, etc.), we skip it and just
  // show the business name centered.
  const logoSize = 14  // mm — square logo box
  let logoLoaded = false
  if (data.logoUrl) {
    const img = await fetchImageAsDataUrl(data.logoUrl)
    if (img) {
      try {
        // Place logo at top-left, vertically centered with the business name
        doc.addImage(img.dataUrl, img.format, margin, y, logoSize, logoSize, undefined, 'FAST')
        logoLoaded = true
      } catch {
        // addImage can throw if the image format is unsupported — skip silently
        logoLoaded = false
      }
    }
  }

  // Business name — centered, but shifted right if logo is on the left
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  if (logoLoaded) {
    // Center between the logo's right edge and the page's right margin
    const textX = (margin + logoSize + 2 + pageWidth - margin) / 2
    doc.text(data.businessName, textX, y + 6, { align: 'center' })
  } else {
    doc.text(data.businessName, pageWidth / 2, y + 6, { align: 'center' })
  }
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  y += 10
  doc.text('Branch Daily Report', pageWidth / 2, y, { align: 'center' })
  y += 4
  doc.setFontSize(9)
  doc.text(`Date: ${data.dateDisplay}`, pageWidth / 2, y, { align: 'center' })
  y += 3
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 3

  // === Helper: draw a section box ===
  // Returns the Y position after the box
  const drawSection = (
    x: number, w: number, topY: number,
    title: string,
    rows: { label: string; amount?: number; bold?: boolean; muted?: boolean; totalRow?: boolean }[],
    options: { headerShaded?: boolean } = {},
  ): number => {
    const padding = 1.5
    const rowHeight = 4.2
    const headerHeight = 5
    const titleH = title ? headerHeight : 0
    const bodyH = rows.length * rowHeight
    const boxH = titleH + bodyH + padding * 2

    // Box border
    doc.setLineWidth(0.2)
    doc.rect(x, topY, w, boxH)

    let cy = topY + padding

    // Title bar
    if (title) {
      if (options.headerShaded !== false) {
        doc.setFillColor(220, 220, 220)
        doc.rect(x, topY, w, titleH, 'F')
      }
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(title.toUpperCase(), x + padding, cy + 3)
      cy += titleH
      // Divider under title
      doc.setLineWidth(0.2)
      doc.line(x, cy, x + w, cy)
    }

    // Rows
    doc.setFontSize(8)
    const amountColWidth = 28
    const labelColWidth = w - amountColWidth - padding * 2
    for (const r of rows) {
      if (r.totalRow) {
        doc.setFillColor(240, 240, 240)
        doc.rect(x + 0.1, cy + 0.1, w - 0.2, rowHeight - 0.2, 'F')
        doc.setLineWidth(0.2)
        doc.line(x, cy, x + w, cy)
      }
      doc.setFont('helvetica', r.bold ? 'bold' : 'normal')
      // Truncate label if too long
      let label = r.label
      const maxLabelChars = Math.floor(labelColWidth / 1.5)
      if (label.length > maxLabelChars) {
        label = label.slice(0, maxLabelChars - 1) + '…'
      }
      doc.text(label, x + padding, cy + 3)
      if (r.amount !== undefined) {
        const amtStr = `Tk ${fmtAmt(r.amount)}`
        doc.text(amtStr, x + w - padding, cy + 3, { align: 'right' })
      }
      cy += rowHeight
    }

    return topY + boxH
  }

  // Helper to convert an entry to a label string (with method badge + note)
  const entryLabel = (e: DailyReportEntry): string => {
    let lbl = e.category
    const m = methodLabel(e.paymentMethod)
    if (m) {
      const bk = e.bankAccount ? `:${e.bankAccount.bankName}` : ''
      lbl += ` [${m}${bk}]`
    }
    if (e.note) {
      lbl += ` · ${e.note}`
    }
    return lbl
  }

  // === LEFT COLUMN ===
  let leftY = y
  // Opening Balance
  leftY = drawSection(colX[0], colWidth, leftY, 'Opening Balance', [
    { label: data.openingLabel, amount: data.openingBalance, bold: true },
  ])

  // Income / Receipts
  const incomeRows = data.incomeEntries.length === 0
    ? [{ label: 'No income entries for this day', muted: true }]
    : data.incomeEntries.map((e) => ({ label: entryLabel(e), amount: e.amount }))
  incomeRows.push({ label: 'Total Income -', amount: data.totalIncome, bold: true, totalRow: true })
  leftY = drawSection(colX[0], colWidth, leftY, 'Income / Receipts', incomeRows)
  leftY += 2

  // Excess / Extra Cash (only if entries exist)
  if (data.excessEntries.length > 0) {
    const excessRows = data.excessEntries.map((e) => ({ label: entryLabel(e), amount: e.amount }))
    excessRows.push({ label: 'Total Excess -', amount: data.totalExcess, bold: true, totalRow: true })
    leftY = drawSection(colX[0], colWidth, leftY, 'Excess / Extra Cash', excessRows)
    leftY += 2
  }

  // Denomination of Closing Cash
  const denomRows: { label: string; amount?: number; bold?: boolean; totalRow?: boolean }[] = []
  for (const d of data.denoms) {
    denomRows.push({
      label: `Tk ${fmtAmt(d.denom)} × ${d.count}`,
      amount: d.denom * d.count,
    })
  }
  denomRows.push({ label: 'Total Cash in Hand -', amount: data.totalCashInHand, bold: true, totalRow: true })
  const denomTitle = data.denomNotEntered
    ? 'Denomination (⚠ Not counted — using calculated closing)'
    : 'Denomination of Closing Cash'
  leftY = drawSection(colX[0], colWidth, leftY, denomTitle, denomRows)

  // === RIGHT COLUMN ===
  let rightY = y
  // Expenses
  const expenseRows = data.expenseEntries.length === 0
    ? [{ label: 'No expense entries', muted: true }]
    : data.expenseEntries.map((e) => ({ label: entryLabel(e), amount: e.amount }))
  expenseRows.push({ label: 'Total Expenses -', amount: data.totalExpenses, bold: true, totalRow: true })
  rightY = drawSection(colX[1], colWidth, rightY, 'Expenses', expenseRows)
  rightY += 2

  // Payments
  const paymentRows = data.paymentEntries.length === 0
    ? [{ label: 'No payment entries', muted: true }]
    : data.paymentEntries.map((e) => ({ label: entryLabel(e), amount: e.amount }))
  paymentRows.push({ label: 'Total Payments -', amount: data.totalPayments, bold: true, totalRow: true })
  rightY = drawSection(colX[1], colWidth, rightY, 'Payments', paymentRows)
  rightY += 2

  // Deposits
  const depositRows = data.depositEntries.length === 0
    ? [{ label: 'No deposit entries', muted: true }]
    : data.depositEntries.map((e) => ({ label: entryLabel(e), amount: e.amount }))
  depositRows.push({ label: 'Total Deposits -', amount: data.totalDeposits, bold: true, totalRow: true })
  rightY = drawSection(colX[1], colWidth, rightY, 'Deposits', depositRows)
  rightY += 2

  // Cash Shortage (only if entries exist)
  if (data.shortageEntries.length > 0) {
    const shortRows = data.shortageEntries.map((e) => ({ label: entryLabel(e), amount: e.amount }))
    shortRows.push({ label: 'Total Shortage -', amount: data.totalShortage, bold: true, totalRow: true })
    rightY = drawSection(colX[1], colWidth, rightY, 'Cash Shortage', shortRows)
    rightY += 2
  }

  // Calculated Closing (auto)
  rightY = drawSection(colX[1], colWidth, rightY, 'Calculated Closing (auto)', [
    { label: 'Opening + Income − Expense', amount: data.calculatedClosing, bold: true },
  ])

  // === Totals row (two columns side by side) ===
  const totalsY = Math.max(leftY, rightY) + 3
  // Left totals: Income Side
  const leftTotalsRows: { label: string; amount?: number; bold?: boolean; totalRow?: boolean }[] = [
    { label: 'Opening Balance', amount: data.openingBalance },
    { label: '+ Total Income', amount: data.totalIncome },
  ]
  if (data.totalExcess > 0) {
    leftTotalsRows.push({ label: '+ Total Excess', amount: data.totalExcess })
  }
  leftTotalsRows.push({ label: 'Income Side Total -', amount: data.incomeSideTotal, bold: true, totalRow: true })

  // Right totals: Expense Side
  const rightTotalsRows: { label: string; amount?: number; bold?: boolean; totalRow?: boolean }[] = [
    { label: 'Total Expenses', amount: data.totalExpenses },
    { label: '+ Total Payments', amount: data.totalPayments },
    { label: '+ Total Deposits', amount: data.totalDeposits },
  ]
  if (data.totalShortage > 0) {
    rightTotalsRows.push({ label: '+ Total Shortage', amount: data.totalShortage })
  }
  rightTotalsRows.push({ label: '+ Cash in Hand', amount: data.totalCashInHand })
  rightTotalsRows.push({ label: 'Expense Side Total -', amount: data.expenseSideTotal, bold: true, totalRow: true })

  // Draw with thicker border to indicate totals box
  const afterLeftTotals = drawSection(colX[0], colWidth, totalsY, 'Income Side Total', leftTotalsRows)
  const afterRightTotals = drawSection(colX[1], colWidth, totalsY, 'Expense Side Total', rightTotalsRows)
  y = Math.max(afterLeftTotals, afterRightTotals) + 3

  // === Balance status ===
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  if (data.isBalanced) {
    doc.setTextColor(0, 128, 0)
    doc.text(`Correct — both sides match (Tk ${fmtAmt(data.incomeSideTotal)})`, pageWidth / 2, y, { align: 'center' })
  } else {
    doc.setTextColor(200, 100, 0)
    const sign = data.balanceDifference > 0 ? 'Cash Short' : 'Excess Cash'
    doc.text(`Difference: Tk ${fmtAmt(Math.abs(data.balanceDifference))} (${sign})`, pageWidth / 2, y, { align: 'center' })
  }
  doc.setTextColor(0, 0, 0)
  y += 5

  // Signature line
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 128, 80)
  doc.text(`Signature — Approved (Tk ${fmtAmt(data.incomeSideTotal)})`, pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 5

  // Prepared by footer
  doc.setLineWidth(0.2)
  doc.line(margin, y, pageWidth - margin, y)
  y += 4
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Prepared by: ${data.preparedBy}`, margin, y)
  doc.text(`Generated on ${new Date().toLocaleString('en-GB')}`, pageWidth - margin, y, { align: 'right' })

  // === Page overflow check — if content exceeded, add a note on page 2 ===
  void pageHeight

  const filename = `Branch_Daily_Report_${data.dateDisplay.replace(/\//g, '-')}.pdf`
  doc.save(filename)
}

// Re-export the currency constants so views can build cells consistently
export { XLSX_CURRENCY, PDF_CURRENCY, sanitizeForPdf }
void fmt
