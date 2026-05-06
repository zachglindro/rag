// frontend/app/data/components/data-pagination.tsx
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DataPaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  setPageSize: (size: number) => void
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
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
  disabled,
  totalCount,
}: DataPaginationProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
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