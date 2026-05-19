import { useState, useCallback, useMemo } from "react"

const COLUMN_WIDTHS_STORAGE_KEY = "data-table-column-widths"
const DEFAULT_COLUMN_WIDTH = 150

export interface ColumnWidths {
  [columnKey: string]: number
}

export function useColumnWidths(allColumns: { key: string; label: string }[]) {
  // Initialize state from localStorage using lazy initializer
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    // Only access localStorage on the client side
    if (typeof window === "undefined") {
      return {}
    }

    const stored = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY)
    try {
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  // Merge stored widths with default widths for any new columns
  const mergedWidths = useMemo(() => {
    const result = { ...columnWidths }
    allColumns.forEach((column) => {
      if (!(column.key in result)) {
        result[column.key] = DEFAULT_COLUMN_WIDTH
      }
    })
    return result
  }, [columnWidths, allColumns])

  const updateColumnWidth = useCallback((columnKey: string, width: number) => {
    const minWidth = 50
    const clampedWidth = Math.max(width, minWidth)

    setColumnWidths((prev) => {
      const updated = { ...prev, [columnKey]: clampedWidth }
      if (typeof window !== "undefined") {
        localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(updated))
      }
      return updated
    })
  }, [])

  const resetColumnWidth = useCallback((columnKey: string) => {
    setColumnWidths((prev) => {
      const updated = { ...prev, [columnKey]: DEFAULT_COLUMN_WIDTH }
      if (typeof window !== "undefined") {
        localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(updated))
      }
      return updated
    })
  }, [])

  const getColumnWidth = useCallback(
    (columnKey: string) => {
      return mergedWidths[columnKey] || DEFAULT_COLUMN_WIDTH
    },
    [mergedWidths]
  )

  return {
    columnWidths: mergedWidths,
    updateColumnWidth,
    resetColumnWidth,
    getColumnWidth,
  }
}
