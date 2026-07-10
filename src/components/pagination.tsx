'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  totalItems: number
  onPageChange: (start: number, end: number) => void
}

const PAGE_SIZES = [20, 50, 100, 999999] // 999999 = All

export function usePagination(totalItems: number) {
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const reset = () => setCurrentPage(1)

  return {
    pageSize,
    setPageSize: (size: number) => { setPageSize(size); setCurrentPage(1) },
    currentPage: safePage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    reset,
  }
}

export function PaginationControls({
  totalItems,
  pagination,
}: {
  totalItems: number
  pagination: ReturnType<typeof usePagination>
}) {
  if (totalItems === 0) return null

  const { currentPage, totalPages, pageSize, setPageSize, setCurrentPage, startIndex, endIndex } = pagination

  const pageSizeLabel = pageSize >= 999999 ? 'All' : String(pageSize)

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-1 flex-wrap">
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span>
          Showing {startIndex + 1}–{endIndex} of {totalItems}
        </span>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="h-7 w-[80px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
            <SelectItem value="999999">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-neutral-500 px-1">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
