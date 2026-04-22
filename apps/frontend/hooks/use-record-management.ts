import { useState, useCallback, useRef } from "react"
import {
  RecordRow,
  ColumnMetadataRow,
  FilterCondition,
} from "../app/data/types"
import { toast } from "sonner"

export function useRecordManagement() {
  const [rows] = useState<RecordRow[]>([])
  const [metadata] = useState<ColumnMetadataRow[]>([])
  const [totalCount] = useState(0)
  const [skip, setSkip] = useState(0)
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [draftCells, setDraftCells] = useState<
    Record<number, Record<string, string>>
  >({})
  const [dirtyCellCount, setDirtyCellCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMutating] = useState(false)
  const hasLoadedInitiallyRef = useRef(false)

  const fetchData = useCallback(async () => {
    const isInitialLoad = !hasLoadedInitiallyRef.current
    if (isInitialLoad) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      hasLoadedInitiallyRef.current = true
    } catch {
      toast.error(
        isInitialLoad ? "Failed to load data" : "Failed to refresh data"
      )
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const updateDraftCell = useCallback(
    (
      rowId: number,
      columnKey: string,
      value: string,
      originalValue: string
    ) => {
      setDraftCells((prev) => {
        const next = { ...prev }
        if (!next[rowId]) next[rowId] = {}
        next[rowId][columnKey] = value

        const isDirty = value !== originalValue
        setDirtyCellCount((prevCount) =>
          isDirty ? prevCount + 1 : Math.max(0, prevCount - 1)
        )

        return next
      })
    },
    []
  )

  const applyFilters = useCallback(
    (recordRows: RecordRow[]): RecordRow[] => {
      return recordRows.filter(() => {
        return filters.every(() => {
          return true
        })
      })
    },
    [filters]
  )

  return {
    rows,
    metadata,
    totalCount,
    skip,
    setSkip,
    filters,
    setFilters,
    draftCells,
    setDraftCells,
    dirtyCellCount,
    isLoading,
    isRefreshing,
    isMutating,
    fetchData,
    updateDraftCell,
    applyFilters,
  }
}
