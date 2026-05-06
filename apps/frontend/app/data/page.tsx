"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { SidebarInset } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react"
import { toast } from "sonner"
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import {
  RecordRow,
  ColumnMetadataRow,
  RecordSearchResponse,
  RecordListResponse,
  BACKEND_URL,
  FilterCondition,
  stringifyValue,
  BOOLEAN_TRUE_VALUES,
  BOOLEAN_FALSE_VALUES,
} from "./types"
import { DataTableRow } from "@/components/data/table/data-table-row"
import { DeleteConfirmDialog } from "./components/dialogs/delete-confirm-dialog"
import { RenameColumnDialog } from "./components/dialogs/rename-column-dialog"
import { AddColumnDialog } from "./components/dialogs/add-column-dialog"
import { FilterDialog } from "./components/dialogs/filter-dialog"
import { ExportDialog } from "./components/dialogs/export-dialog"

interface SearchSectionProps {
  initialValue: string
  onSearch: (value: string) => void
  onClear: () => void
  isEditMode: boolean
  isMutating: boolean
  isSearchMode: boolean
}

const SearchSection = memo(function SearchSection({
  initialValue,
  onSearch,
  onClear,
  isEditMode,
  isMutating,
  isSearchMode,
}: SearchSectionProps) {
  const [inputValue, setInputValue] = useState(initialValue)

  useEffect(() => {
    setInputValue(initialValue)
  }, [initialValue])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault()
      onSearch(inputValue)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search"
          aria-label="Semantic search query"
          disabled={isEditMode || isMutating}
        />
        <div className="flex gap-2">
          <Button
            onClick={() => onSearch(inputValue)}
            disabled={
              inputValue.trim().length === 0 || isEditMode || isMutating
            }
          >
            Search
          </Button>
          <Button
            variant="outline"
            onClick={onClear}
            disabled={
              (!isSearchMode && inputValue.trim().length === 0) || isMutating
            }
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
})

function DataPageContent() {
  const searchParams = useSearchParams()
  const highlightIdString = searchParams.get("highlight")
  const highlightId = highlightIdString ? parseInt(highlightIdString, 10) : null

  const initialQuery = searchParams.get("query") || ""
  const initialType =
    (searchParams.get("type") as "semantic" | "keyword") || null

  const [rows, setRows] = useState<RecordRow[]>([])
  const [metadata, setMetadata] = useState<ColumnMetadataRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [skip, setSkip] = useState(0)
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(initialQuery)
  const [searchType, setSearchType] = useState<"semantic" | "keyword">(
    initialType || "semantic"
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [draftCells, setDraftCells] = useState<
    Record<number, Record<string, string>>
  >({})
  const [recordPendingDelete, setRecordPendingDelete] =
    useState<RecordRow | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [dirtyCellCount, setDirtyCellCount] = useState(0)
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv")
  const [isExporting, setIsExporting] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [sortColumn, setSortColumn] = useState<string>("id")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const hasLoadedInitiallyRef = useRef(false)

  const [pageSize, setPageSize] = useState(25)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set())
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [exportScope, setExportScope] = useState<"all" | "selected">("all")

  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)

  const applyRowFilters = useCallback(
    (recordRows: RecordRow[]): RecordRow[] => {
      if (filters.length === 0) {
        return recordRows
      }

      return recordRows.filter((row) => {
        // All filters must match (AND logic)
        for (const filter of filters) {
          const cellValue = row.data?.[filter.columnKey]
          const operator = filter.operator
          const filterValue = filter.value

          if (!filterValue.trim()) continue

          let matches = false

          try {
            if (operator === "contains") {
              // Case-insensitive substring match
              const cellStringValue = stringifyValue(cellValue).toLowerCase()
              const filterLower = filterValue.toLowerCase()
              matches = cellStringValue.includes(filterLower)
            } else if (operator === "=") {
              // Exact match
              const cellString = stringifyValue(cellValue).toLowerCase()
              const filterLower = filterValue.toLowerCase()
              matches = cellString === filterLower
            } else if (
              operator === ">" ||
              operator === "<" ||
              operator === ">=" ||
              operator === "<="
            ) {
              // Numeric comparisons
              const numericValue =
                cellValue !== null && cellValue !== undefined
                  ? Number(cellValue)
                  : NaN
              const filterNumber = Number(filterValue)

              if (!isNaN(numericValue) && !isNaN(filterNumber)) {
                if (operator === ">") {
                  matches = numericValue > filterNumber
                } else if (operator === "<") {
                  matches = numericValue < filterNumber
                } else if (operator === ">=") {
                  matches = numericValue >= filterNumber
                } else if (operator === "<=") {
                  matches = numericValue <= filterNumber
                }
              }
            }
          } catch {
            matches = false
          }

          if (!matches) {
            return false
          }
        }

        return true
      })
    },
    [filters]
  )

  const filteredRows = useMemo(
    () => applyRowFilters(rows),
    [rows, applyRowFilters]
  )

  const toggleRowSelection = useCallback((rowId: number) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }, [])

  const isAllFilteredSelected = useMemo(() => {
    return (
      filteredRows.length > 0 &&
      filteredRows.every((row) => selectedRowIds.has(row.id))
    )
  }, [filteredRows, selectedRowIds])

  const toggleSelectAll = useCallback(() => {
    if (isAllFilteredSelected) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        filteredRows.forEach((row) => next.delete(row.id))
        return next
      })
    } else {
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        filteredRows.forEach((row) => next.add(row.id))
        return next
      })
    }
  }, [filteredRows, isAllFilteredSelected])

  const handleConfirmBulkDelete = async () => {
    if (selectedRowIds.size === 0) return

    setIsMutating(true)
    try {
      const response = await fetch(`${BACKEND_URL}/records/bulk-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: Array.from(selectedRowIds) }),
      })

      if (!response.ok) {
        throw new Error("Bulk delete failed")
      }

      const result = await response.json()
      toast.success(`Deleted ${result.deleted_count} records`)
      setSelectedRowIds(new Set())
      setIsBulkDeleteDialogOpen(false)
      await refreshAfterMutation(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete records")
    } finally {
      setIsMutating(false)
    }
  }

  useEffect(() => {
    if (!initialType) {
      const stored = localStorage.getItem("searchType") as
        | "semantic"
        | "keyword"
      if (stored) {
        setSearchType(stored)
      }
    }
  }, [initialType])

  const [columnPendingDelete, setColumnPendingDelete] = useState<{
    key: string
    label: string
  } | null>(null)
  const [isColumnDeleteDialogOpen, setIsColumnDeleteDialogOpen] =
    useState(false)

  const [columnPendingRename, setColumnPendingRename] = useState<{
    key: string
    label: string
  } | null>(null)
  const [isColumnRenameDialogOpen, setIsColumnRenameDialogOpen] =
    useState(false)

  const [columnPendingAdd, setColumnPendingAdd] = useState<{
    key: string
    label: string
  } | null>(null)
  const [isColumnAddDialogOpen, setIsColumnAddDialogOpen] = useState(false)

  const isSearchMode = appliedSearchQuery.trim().length > 0

  const fetchData = useCallback(async () => {
    const isInitialLoad = !hasLoadedInitiallyRef.current

    if (isInitialLoad) {
      setIsLoading(true)
      setError(null)
    } else {
      setIsRefreshing(true)
    }

    try {
      if (highlightId !== null && isInitialLoad) {
        // If we have a highlight ID, fetch that specific record first
        const [recordResponse, metadataResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/records/${highlightId}`),
          fetch(`${BACKEND_URL}/column-metadata`),
        ])

        if (!recordResponse.ok || !metadataResponse.ok) {
          throw new Error("Failed to load highlighted record")
        }

        const recordData: RecordRow = await recordResponse.json()
        const metadataData: ColumnMetadataRow[] = await metadataResponse.json()

        setRows([recordData])
        setMetadata(metadataData)
        setTotalCount(1)
        // We set search query to empty but show only this record to simulate a search-like focus
        setAppliedSearchQuery(`id:${highlightId}`)
      } else if (isSearchMode) {
        const endpoint =
          searchType === "keyword"
            ? `${BACKEND_URL}/keyword-search/records`
            : `${BACKEND_URL}/semantic-search/records`

        // Handle special id: prefix for manual ID search
        if (appliedSearchQuery.startsWith("id:")) {
          const id = parseInt(appliedSearchQuery.slice(3), 10)
          if (!isNaN(id)) {
            const [recordResponse, metadataResponse] = await Promise.all([
              fetch(`${BACKEND_URL}/records/${id}`),
              fetch(`${BACKEND_URL}/column-metadata`),
            ])

            if (recordResponse.ok && metadataResponse.ok) {
              const recordData: RecordRow = await recordResponse.json()
              const metadataData: ColumnMetadataRow[] =
                await metadataResponse.json()
              setRows([recordData])
              setMetadata(metadataData)
              setTotalCount(1)
              return
            }
          }
        }

        const [searchResponse, metadataResponse] = await Promise.all([
          fetch(
            `${endpoint}?query=${encodeURIComponent(appliedSearchQuery)}&top_k=50`
          ),
          fetch(`${BACKEND_URL}/column-metadata`),
        ])

        if (!searchResponse.ok || !metadataResponse.ok) {
          throw new Error(
            `Failed to run ${searchType === "keyword" ? "keyword" : "semantic"} search`
          )
        }

        const searchData: RecordSearchResponse = await searchResponse.json()
        const metadataData: ColumnMetadataRow[] = await metadataResponse.json()

        setRows(searchData.records)
        setMetadata(metadataData)
        setTotalCount(searchData.records.length)
      } else {
        const [recordsResponse, metadataResponse, countResponse] =
          await Promise.all([
            fetch(
              `${BACKEND_URL}/records?skip=${skip}&limit=${pageSize}&sort_by=${encodeURIComponent(sortColumn)}&sort_order=${sortDirection}`
            ),
            fetch(`${BACKEND_URL}/column-metadata`),
            fetch(`${BACKEND_URL}/records/count`),
          ])

        if (!recordsResponse.ok || !metadataResponse.ok || !countResponse.ok) {
          throw new Error("Failed to load data from backend")
        }

        const recordsData: RecordListResponse = await recordsResponse.json()
        const metadataData: ColumnMetadataRow[] = await metadataResponse.json()
        const countData: { count: number } = await countResponse.json()

        setRows(recordsData.records)
        setMetadata(metadataData)
        setTotalCount(countData.count)
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unknown error"

      if (isInitialLoad) {
        setError(message)
        setRows([])
        setMetadata([])
        setTotalCount(0)
      } else {
        toast.error(`Failed to refresh data: ${message}`)
      }
    } finally {
      if (isInitialLoad) {
        setIsLoading(false)
        hasLoadedInitiallyRef.current = true
      } else {
        setIsRefreshing(false)
      }
    }
  }, [
    appliedSearchQuery,
    isSearchMode,
    skip,
    sortColumn,
    sortDirection,
    pageSize,
    searchType,
    highlightId,
  ])

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "searchType") {
        setSearchType((e.newValue as "semantic" | "keyword") || "semantic")
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const stored = localStorage.getItem("pageSize")
    if (stored) {
      setPageSize(parseInt(stored, 10))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("pageSize", pageSize.toString())
  }, [pageSize])

  const visibleColumns = useMemo(() => {
    if (metadata.length > 0) {
      return metadata.map((column) => ({
        key: column.column_name,
        label: column.column_name,
      }))
    }

    if (rows.length === 0) {
      return []
    }

    const discoveredKeys = new Set<string>()
    rows.forEach((row) => {
      Object.keys(row.data ?? {}).forEach((key) => discoveredKeys.add(key))
    })

    return Array.from(discoveredKeys).map((key) => ({ key, label: key }))
  }, [metadata, rows])

  const allColumns = useMemo(() => {
    return visibleColumns
  }, [visibleColumns])

  const handleSort = useCallback(
    (columnKey: string) => {
      if (isEditMode) return
      if (sortColumn === columnKey) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortColumn(columnKey)
        setSortDirection("asc")
      }
      setSkip(0)
    },
    [isEditMode, sortColumn]
  )

  const hasPreviousPage = skip > 0
  const hasNextPage = skip + rows.length < totalCount
  const currentPage = Math.floor(skip / pageSize) + 1
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1

  const toEditableCellValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) {
      return ""
    }

    if (typeof value === "string") {
      return value
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value)
    }

    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }, [])

  const parseEditedCellValue = useCallback(
    (rawValue: string, originalValue: unknown): unknown => {
      const trimmed = rawValue.trim()

      if (
        Array.isArray(originalValue) ||
        (typeof originalValue === "object" && originalValue !== null)
      ) {
        if (!trimmed) {
          return null
        }

        try {
          return JSON.parse(rawValue)
        } catch {
          throw new Error("must be valid JSON")
        }
      }

      if (typeof originalValue === "number") {
        if (!trimmed) {
          throw new Error("cannot be empty for number fields")
        }

        const parsed = Number(trimmed)
        if (!Number.isFinite(parsed)) {
          throw new Error("must be a valid number")
        }

        return parsed
      }

      if (typeof originalValue === "boolean") {
        const normalized = trimmed.toLowerCase()
        if (BOOLEAN_TRUE_VALUES.has(normalized)) {
          return true
        }
        if (BOOLEAN_FALSE_VALUES.has(normalized)) {
          return false
        }

        throw new Error("must be true/false, yes/no, or 1/0")
      }

      if (originalValue === null || originalValue === undefined) {
        if (!trimmed) {
          return ""
        }

        if (trimmed === "null") {
          return null
        }

        if (BOOLEAN_TRUE_VALUES.has(trimmed.toLowerCase())) {
          return true
        }

        if (BOOLEAN_FALSE_VALUES.has(trimmed.toLowerCase())) {
          return false
        }

        const asNumber = Number(trimmed)
        if (!Number.isNaN(asNumber) && trimmed !== "") {
          return asNumber
        }

        if (
          trimmed.startsWith("{") ||
          trimmed.startsWith("[") ||
          trimmed.startsWith('"')
        ) {
          try {
            return JSON.parse(trimmed)
          } catch {
            return rawValue
          }
        }

        return rawValue
      }

      return rawValue
    },
    []
  )

  const hasPendingChanges = dirtyCellCount > 0

  const originalEditableValuesByRow = useMemo(() => {
    const byRow = new Map<number, Record<string, string>>()

    for (const row of rows) {
      const valueByColumn: Record<string, string> = {}
      for (const column of visibleColumns) {
        valueByColumn[column.key] = toEditableCellValue(row.data?.[column.key])
      }
      byRow.set(row.id, valueByColumn)
    }

    return byRow
  }, [rows, visibleColumns, toEditableCellValue])

  const openBulkDeleteDialog = useCallback(() => {
    setIsBulkDeleteDialogOpen(true)
  }, [])

  const handleApplySearch = useCallback((value: string) => {
    const nextQuery = value.trim()
    setSkip(0)
    setAppliedSearchQuery(nextQuery)
  }, [])

  const handleClearSearch = useCallback(() => {
    if (isEditMode) {
      toast.error("Exit edit mode before changing the search query")
      return
    }

    setAppliedSearchQuery("")
    setSkip(0)
    setSortColumn("id")
    setSortDirection("asc")
  }, [isEditMode])

  const refreshAfterMutation = async (isDeleteAction: boolean) => {
    if (isDeleteAction && !isSearchMode && rows.length === 1 && skip > 0) {
      setSkip((previous) => Math.max(previous - pageSize, 0))
      return
    }

    await fetchData()
  }

  const enterEditMode = () => {
    setIsEditMode(true)
  }

  const exitEditMode = () => {
    setIsEditMode(false)
    setDraftCells({})
    setDirtyCellCount(0)
  }

  const updateDraftCell = useCallback(
    (rowId: number, columnKey: string, value: string) => {
      const originalValue =
        originalEditableValuesByRow.get(rowId)?.[columnKey] ?? ""

      setDraftCells((previous) => {
        const existingRowDraft = previous[rowId]
        const previousCellValue = existingRowDraft?.[columnKey]
        const nextCellIsDirty = value !== originalValue

        if (!nextCellIsDirty && previousCellValue === undefined) {
          return previous
        }

        if (nextCellIsDirty && previousCellValue === value) {
          return previous
        }

        let nextDirtyDelta = 0

        if (previousCellValue === undefined && nextCellIsDirty) {
          nextDirtyDelta = 1
        } else if (previousCellValue !== undefined && !nextCellIsDirty) {
          nextDirtyDelta = -1
        }

        if (nextDirtyDelta !== 0) {
          setDirtyCellCount((current) => Math.max(current + nextDirtyDelta, 0))
        }

        if (!nextCellIsDirty) {
          if (!existingRowDraft) {
            return previous
          }

          const remainingColumns = { ...existingRowDraft }
          delete remainingColumns[columnKey]

          if (Object.keys(remainingColumns).length === 0) {
            const remainingRows = { ...previous }
            delete remainingRows[rowId]
            return remainingRows
          }

          return {
            ...previous,
            [rowId]: remainingColumns,
          }
        }

        return {
          ...previous,
          [rowId]: {
            ...(existingRowDraft ?? {}),
            [columnKey]: value,
          },
        }
      })
    },
    [originalEditableValuesByRow]
  )

  const handleSaveSpreadsheetChanges = async () => {
    const changedRowIds = new Set(
      Object.keys(draftCells).map((id) => Number(id))
    )
    const changedRows = rows.filter((row) => changedRowIds.has(row.id))

    if (changedRows.length === 0) {
      toast.message("No changes to save")
      return
    }

    const updates: Array<{ id: number; data: Record<string, unknown> }> = []

    try {
      for (const row of changedRows) {
        const nextData: Record<string, unknown> = { ...(row.data ?? {}) }

        for (const column of visibleColumns) {
          const cellInput =
            draftCells[row.id]?.[column.key] ??
            toEditableCellValue(row.data?.[column.key])
          nextData[column.key] = parseEditedCellValue(
            cellInput,
            row.data?.[column.key]
          )
        }

        updates.push({ id: row.id, data: nextData })
      }
    } catch (parseError) {
      toast.error(
        parseError instanceof Error
          ? parseError.message
          : "Invalid edited value"
      )
      return
    }

    setIsMutating(true)
    try {
      const failedIds: number[] = []
      let successCount = 0

      for (const update of updates) {
        const response = await fetch(`${BACKEND_URL}/records/${update.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: update.data,
            user_name: localStorage.getItem("userName") || "Unknown",
          }),
        })

        if (!response.ok) {
          failedIds.push(update.id)
          continue
        }

        successCount += 1
      }

      if (failedIds.length === 0) {
        toast.success(
          `Saved ${successCount} record${successCount === 1 ? "" : "s"}`
        )
        exitEditMode()
      } else {
        toast.error(
          `Saved ${successCount}, failed ${failedIds.length} (IDs: ${failedIds.join(", ")})`
        )
      }

      await refreshAfterMutation(false)
    } catch {
      toast.error("Failed to save changes")
    } finally {
      setIsMutating(false)
    }
  }

  const handleContextEditRow = useCallback(
    (row: RecordRow) => {
      if (!isEditMode) {
        setIsEditMode(true)
        toast.message(`Edit mode enabled for row ${row.id}`)
      }
    },
    [isEditMode]
  )

  const openDeleteDialog = useCallback((row: RecordRow) => {
    setRecordPendingDelete(row)
    setIsDeleteDialogOpen(true)
  }, [])

  const openColumnDeleteDialog = useCallback(
    (column: { key: string; label: string }) => {
      if (column.key === "id") {
        toast.error("Cannot delete the ID column")
        return
      }
      setColumnPendingDelete(column)
      setIsColumnDeleteDialogOpen(true)
    },
    []
  )

  const openColumnRenameDialog = useCallback(
    (column: { key: string; label: string }) => {
      if (column.key === "id") {
        toast.error("Cannot rename the ID column")
        return
      }
      setColumnPendingRename(column)
      setIsColumnRenameDialogOpen(true)
    },
    []
  )

  const openColumnAddDialog = useCallback(
    (column: { key: string; label: string }) => {
      setColumnPendingAdd(column)
      setIsColumnAddDialogOpen(true)
    },
    []
  )

  const handleConfirmDelete = async () => {
    if (!recordPendingDelete) {
      return
    }

    setIsMutating(true)
    try {
      const response = await fetch(
        `${BACKEND_URL}/records/${recordPendingDelete.id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || "Failed to delete record")
      }

      toast.success("Record deleted")
      setIsDeleteDialogOpen(false)
      setRecordPendingDelete(null)
      await refreshAfterMutation(true)
    } catch {
      toast.error("Failed to delete record")
    } finally {
      setIsMutating(false)
    }
  }

  const handleConfirmColumnDelete = async () => {
    if (!columnPendingDelete) {
      return
    }

    setIsMutating(true)
    try {
      const response = await fetch(`${BACKEND_URL}/columns`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ column_name: columnPendingDelete.key }),
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || "Failed to delete column")
      }

      toast.success(`Column '${columnPendingDelete.label}' deleted`)
      setIsColumnDeleteDialogOpen(false)
      setColumnPendingDelete(null)
      await fetchData() // Refresh data and metadata
    } catch (error) {
      toast.error(
        `Failed to delete column: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    } finally {
      setIsMutating(false)
    }
  }

  const handleConfirmColumnRename = async (newName: string) => {
    if (!columnPendingRename) {
      return
    }

    const trimmedName = newName.trim()
    if (!trimmedName) {
      toast.error("Name cannot be empty")
      return
    }

    setIsMutating(true)
    try {
      // Fetch current metadata to preserve other fields
      const metadataResponse = await fetch(`${BACKEND_URL}/column-metadata`)
      if (!metadataResponse.ok) {
        throw new Error("Failed to fetch column metadata")
      }
      const metadata: ColumnMetadataRow[] = await metadataResponse.json()
      const currentMeta = metadata.find(
        (m) => m.column_name === columnPendingRename.key
      )
      if (!currentMeta) {
        throw new Error("Column metadata not found")
      }

      const renameRequest = {
        old_column_name: columnPendingRename.key,
        new_column: {
          column_name: trimmedName,
          display_name: trimmedName,
          data_type: currentMeta.data_type,
          is_required: currentMeta.is_required,
          default_value: currentMeta.default_value || "null",
          order: currentMeta.order || 0,
          description: currentMeta.description || "",
        },
      }

      const response = await fetch(`${BACKEND_URL}/columns`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(renameRequest),
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || "Failed to rename column")
      }

      toast.success(`Column renamed to '${trimmedName}'`)
      setIsColumnRenameDialogOpen(false)
      setColumnPendingRename(null)
      await fetchData() // Refresh data and metadata
    } catch (error) {
      toast.error(
        `Failed to rename column: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    } finally {
      setIsMutating(false)
    }
  }

  const handleConfirmColumnAdd = async (data: {
    name: string
    type: string
    defaultValue: string
  }) => {
    if (!columnPendingAdd) return
    const trimmedName = data.name.trim()
    if (!trimmedName) {
      toast.error("Column name cannot be empty")
      return
    }

    setIsMutating(true)
    try {
      // Determine the order for the new column (to the right of the current one)
      const targetIndex = metadata.findIndex(
        (m) => m.column_name === columnPendingAdd.key
      )
      const targetMeta = metadata[targetIndex]
      const newOrder = targetMeta
        ? (targetMeta.order ?? 0) + 1
        : metadata.length

      // Format default value for backend (must be valid JSON)
      let formattedDefault = data.defaultValue.trim()
      if (!formattedDefault || formattedDefault.toLowerCase() === "null") {
        formattedDefault = "null"
      } else if (data.type === "string" || data.type === "text") {
        formattedDefault = JSON.stringify(formattedDefault)
      } else if (data.type === "number") {
        if (isNaN(Number(formattedDefault))) {
          formattedDefault = "0"
        }
      }

      const response = await fetch(`${BACKEND_URL}/columns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          column_name: trimmedName,
          display_name: trimmedName,
          data_type: data.type,
          is_required: false,
          default_value: formattedDefault,
          order: newOrder,
          description: "",
        }),
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || "Failed to add column")
      }

      toast.success(`Column '${trimmedName}' added successfully`)
      setIsColumnAddDialogOpen(false)
      setColumnPendingAdd(null)
      await fetchData()
    } catch (error) {
      toast.error(
        `Failed to add column: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    } finally {
      setIsMutating(false)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      let url = `${BACKEND_URL}/export-data?format=${exportFormat}`
      if (exportScope === "selected" && selectedRowIds.size > 0) {
        const ids = Array.from(selectedRowIds).join(",")
        url += `&ids=${ids}`
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Export failed")
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `export_data_${exportScope}.${exportFormat}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)

      toast.success(
        `Exported ${exportScope === "selected" ? selectedRowIds.size : "all"} records as ${exportFormat.toUpperCase()}`
      )
      setIsExportDialogOpen(false)
    } catch {
      toast.error("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  const handleAddFilter = (filter: {
    columnKey: string
    operator: string
    value: string
  }) => {
    if (!filter.columnKey.trim()) {
      toast.error("Please select a column")
      return
    }

    if (!filter.value.trim()) {
      toast.error("Please enter a filter value")
      return
    }

    const newFilter: FilterCondition = {
      id: `${Date.now()}-${Math.random()}`,
      columnKey: filter.columnKey,
      operator: filter.operator,
      value: filter.value,
    }

    setFilters((prev) => [...prev, newFilter])

    setIsFilterDialogOpen(false)
    toast.success(
      `Filter added: ${filter.columnKey} ${filter.operator} "${filter.value}"`
    )
  }

  const handleRemoveFilter = (filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId))
    toast.success("Filter removed")
  }

  const handleClearAllFilters = () => {
    setFilters([])
    toast.success("All filters cleared")
  }

  const openExportDialog = useCallback((scope: "all" | "selected") => {
    setExportScope(scope)
    setIsExportDialogOpen(true)
  }, [])

  return (
    <>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <div className="flex min-h-svh w-full min-w-0 flex-col gap-6 overflow-x-hidden p-6">
          <div>
            <h1 className="text-xl font-semibold">Data</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse ingested records and schema metadata.
            </p>
          </div>

          <SearchSection
            initialValue={appliedSearchQuery}
            onSearch={handleApplySearch}
            onClear={handleClearSearch}
            isEditMode={isEditMode}
            isMutating={isMutating}
            isSearchMode={isSearchMode}
          />

          {filters.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Active Filters ({filters.length})
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => {
                    const column = visibleColumns.find(
                      (c) => c.key === filter.columnKey
                    )
                    const columnLabel = column?.label || filter.columnKey

                    return (
                      <div
                        key={filter.id}
                        className="flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-blue-800 dark:bg-slate-900"
                      >
                        <span className="font-medium text-blue-700 dark:text-blue-300">
                          {columnLabel}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {filter.operator}
                        </span>
                        <span className="font-mono text-gray-600 dark:text-gray-300">
                          {filter.value}
                        </span>
                        <button
                          onClick={() => handleRemoveFilter(filter.id)}
                          className="ml-1 font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
                          aria-label="Remove filter"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsFilterDialogOpen(true)}
                  >
                    Add Another
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearAllFilters}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </div>
          )}

          {filters.length === 0 && !isEditMode && totalCount > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterDialogOpen(true)}
              >
                + Add Filter
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
              Loading records...
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
              <p className="text-sm text-destructive">{error}</p>
              <Button className="mt-4" onClick={fetchData} variant="outline">
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && totalCount === 0 && !isSearchMode && (
            <div className="rounded-lg border p-6">
              <p className="text-sm text-muted-foreground">
                There is currently no data in the database.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/add">Add Data</Link>
              </Button>
            </div>
          )}

          {!isLoading && !error && (totalCount > 0 || isSearchMode) && (
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                {!isEditMode && (
                  <>
                    <Button
                      variant={isSelectionMode ? "secondary" : "outline"}
                      onClick={() => {
                        setIsSelectionMode(!isSelectionMode)
                        if (isSelectionMode) {
                          setSelectedRowIds(new Set())
                        }
                      }}
                      disabled={isMutating}
                    >
                      {isSelectionMode ? "Cancel Selection" : "Select"}
                    </Button>
                    <Button onClick={enterEditMode} disabled={isMutating}>
                      Edit
                    </Button>
                  </>
                )}
                {isEditMode && (
                  <>
                    <Button
                      onClick={handleSaveSpreadsheetChanges}
                      disabled={!hasPendingChanges || isMutating}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={exitEditMode}
                      disabled={isMutating}
                    >
                      Cancel
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Edit mode is active. Right-click a row for row actions.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {!isLoading && !error && (totalCount > 0 || isSearchMode) && (
            <div className="flex w-full min-w-0 flex-col gap-4">
              {isRefreshing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refreshing records...
                </div>
              )}

              {isSearchMode ? (
                <div className="text-sm text-muted-foreground">
                  {searchType === "keyword" ? "Keyword " : "Semantic "} search
                  for &quot;{appliedSearchQuery}&quot; returned {rows.length}{" "}
                  results.
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Showing {skip + 1}-{Math.min(skip + rows.length, totalCount)}{" "}
                  of {totalCount}
                </div>
              )}

              {!isSearchMode && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(parseInt(value, 10))
                        setSkip(0)
                      }}
                      disabled={isMutating || isEditMode}
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
                      disabled={!hasPreviousPage || isEditMode || isMutating}
                      onClick={() =>
                        setSkip((previous) => Math.max(previous - pageSize, 0))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!hasNextPage || isEditMode || isMutating}
                      onClick={() => setSkip((previous) => previous + pageSize)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              <div className="w-full min-w-0 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isSelectionMode && (
                        <TableHead className="w-[40px]">
                          <input
                            type="checkbox"
                            checked={
                              filteredRows.length > 0 &&
                              selectedRowIds.size === filteredRows.length
                            }
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </TableHead>
                      )}
                      {allColumns.map((column) => (
                        <ContextMenu key={column.key}>
                          <ContextMenuTrigger asChild>
                            <TableHead
                              className={
                                column.key === "id"
                                  ? "w-20 cursor-pointer"
                                  : "cursor-pointer"
                              }
                              onClick={() => handleSort(column.key)}
                            >
                              {column.label}
                              {sortColumn === column.key &&
                                (sortDirection === "asc" ? (
                                  <ChevronUp className="ml-1 inline h-4 w-4" />
                                ) : (
                                  <ChevronDown className="ml-1 inline h-4 w-4" />
                                ))}
                            </TableHead>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuLabel>{column.label}</ContextMenuLabel>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => openColumnAddDialog(column)}
                              disabled={isEditMode || isMutating}
                            >
                              Add Column
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => openColumnRenameDialog(column)}
                              disabled={isEditMode || isMutating}
                            >
                              Rename
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              onSelect={() => openColumnDeleteDialog(column)}
                              disabled={isEditMode || isMutating}
                            >
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <DataTableRow
                        key={row.id}
                        row={row}
                        visibleColumns={visibleColumns}
                        isEditMode={isEditMode}
                        isMutating={isMutating}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedRowIds.has(row.id)}
                        onToggleSelection={toggleRowSelection}
                        rowDraft={draftCells[row.id]}
                        toEditableCellValue={toEditableCellValue}
                        onUpdateDraftCell={updateDraftCell}
                        onContextEditRow={handleContextEditRow}
                        onOpenDeleteDialog={openDeleteDialog}
                        onOpenBulkDeleteDialog={openBulkDeleteDialog}
                        onOpenExportDialog={openExportDialog}
                        isHighlighted={row.id === highlightId}
                      />
                    ))}
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={
                            allColumns.length + (isSelectionMode ? 1 : 0)
                          }
                          className="h-24 text-center text-muted-foreground"
                        >
                          {isSearchMode && rows.length === 0
                            ? "No results found for your search."
                            : filters.length > 0
                              ? "No records match the current filters."
                              : "No records to display."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {!isSearchMode && (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={!hasPreviousPage || isEditMode || isMutating}
                      onClick={() =>
                        setSkip((previous) => Math.max(previous - pageSize, 0))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!hasNextPage || isEditMode || isMutating}
                      onClick={() => setSkip((previous) => previous + pageSize)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isLoading && !error && totalCount > 0 && metadata.length === 0 && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900">
              Column metadata is empty. Columns are inferred from record keys.
            </div>
          )}

          <DeleteConfirmDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            title="Delete Record"
            description={`This will permanently delete record #${recordPendingDelete?.id} from SQLite and Chroma.`}
            onConfirm={handleConfirmDelete}
            isMutating={isMutating}
          />

          <DeleteConfirmDialog
            isOpen={isColumnDeleteDialogOpen}
            onOpenChange={setIsColumnDeleteDialogOpen}
            title="Delete Column"
            description={`This will permanently delete the "${columnPendingDelete?.label}" column from all records and metadata. This action cannot be undone.`}
            onConfirm={handleConfirmColumnDelete}
            isMutating={isMutating}
          />

          <RenameColumnDialog
            isOpen={isColumnRenameDialogOpen}
            onOpenChange={setIsColumnRenameDialogOpen}
            columnPendingRename={columnPendingRename}
            isMutating={isMutating}
            onConfirm={handleConfirmColumnRename}
          />

          <AddColumnDialog
            isOpen={isColumnAddDialogOpen}
            onOpenChange={setIsColumnAddDialogOpen}
            columnPendingAdd={columnPendingAdd}
            isMutating={isMutating}
            onConfirm={handleConfirmColumnAdd}
          />

          <ExportDialog
            isOpen={isExportDialogOpen}
            onOpenChange={setIsExportDialogOpen}
            format={exportFormat}
            onFormatChange={setExportFormat}
            onExport={handleExportData}
            isExporting={isExporting}
          />

          <DeleteConfirmDialog
            isOpen={isBulkDeleteDialogOpen}
            onOpenChange={setIsBulkDeleteDialogOpen}
            title="Bulk Delete Records"
            description={`Are you sure you want to delete ${selectedRowIds.size} selected records? This action cannot be undone.`}
            onConfirm={handleConfirmBulkDelete}
            isMutating={isMutating}
          />

          <FilterDialog
            isOpen={isFilterDialogOpen}
            onOpenChange={setIsFilterDialogOpen}
            visibleColumns={visibleColumns}
            onConfirm={handleAddFilter}
          />
        </div>
      </SidebarInset>
    </>
  )
}

export default function DataPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <DataPageContent />
    </Suspense>
  )
}
