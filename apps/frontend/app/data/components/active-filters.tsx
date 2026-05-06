// frontend/app/data/components/active-filters.tsx
import { Button } from "@/components/ui/button"
import { FilterCondition } from "../types"

interface ActiveFiltersProps {
  filters: FilterCondition[]
  onRemove: (id: string) => void
  onClearAll: () => void
  onAddAnother: () => void
}

export function ActiveFilters({ filters, onRemove, onClearAll, onAddAnother }: ActiveFiltersProps) {
  if (filters.length === 0) return null
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Active Filters ({filters.length})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-blue-800 dark:bg-slate-900"
            >
              <span className="font-medium text-blue-700 dark:text-blue-300">
                {filter.columnKey}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {filter.operator}
              </span>
              <span className="font-mono text-gray-600 dark:text-gray-300">
                {filter.value}
              </span>
              <button
                onClick={() => onRemove(filter.id)}
                className="ml-1 font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                aria-label="Remove filter"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onAddAnother}
          >
            Add Another
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClearAll}
          >
            Clear All
          </Button>
        </div>
      </div>
    </div>
  )
}