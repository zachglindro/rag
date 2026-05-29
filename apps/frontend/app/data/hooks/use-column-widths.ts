import { useState, useCallback, useMemo, useEffect, useRef } from "react"

const COLUMN_WIDTHS_STORAGE_KEY = "data-table-column-widths"
const DEFAULT_COLUMN_WIDTH = 150

export interface ColumnWidths {
  [columnKey: string]: number
}

export function useColumnWidths(allColumns: { key: string; label: string }[]) {
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      return { ...prev, [columnKey]: clampedWidth }
    })
  }, [])

  const resetColumnWidth = useCallback((columnKey: string) => {
    setColumnWidths((prev) => {
      return { ...prev, [columnKey]: DEFAULT_COLUMN_WIDTH }
    })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (persistTimeoutRef.current !== null) {
      clearTimeout(persistTimeoutRef.current)
    }

    persistTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(
        COLUMN_WIDTHS_STORAGE_KEY,
        JSON.stringify(columnWidths)
      )
    }, 150)

    return () => {
      if (persistTimeoutRef.current !== null) {
        clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [columnWidths])

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
