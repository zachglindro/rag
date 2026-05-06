// frontend/app/data/components/data-pagination.tsx
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"

interface DataPaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  setPageSize: (size: number) => void
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onPageChange: (page: number) => void
  disabled: boolean
  totalCount: number
}

export function DataPagination({
  currentPage,
  totalPages,
  pageSize,
  setPageSize,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onPageChange,
  disabled,
  totalCount,
}: DataPaginationProps) {
  const [pageInput, setPageInput] = useState(currentPage.toString())

  useEffect(() => {
    setPageInput(currentPage.toString())
  }, [currentPage])

  const handlePageInputChange = (value: string) => {
    setPageInput(value)
  }

  const handlePageInputSubmit = () => {
    const page = parseInt(pageInput, 10)
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page)
    } else {
      setPageInput(currentPage.toString())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit()
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          Page
          <Input
            type="number"
            value={pageInput}
            onChange={(e) => handlePageInputChange(e.target.value)}
            onBlur={handlePageInputSubmit}
            onKeyDown={handleKeyDown}
            className="w-16 h-8 text-center"
            min={1}
            max={totalPages}
            disabled={disabled}
          />
          of {totalPages}
        </div>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => setPageSize(parseInt(value, 10))}
          disabled={disabled}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100]
              .filter((size) => size <= totalCount)
              .map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={!hasPrevious || disabled}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!hasNext || disabled}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  )
}