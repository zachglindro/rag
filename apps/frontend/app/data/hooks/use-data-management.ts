// frontend/app/data/hooks/use-data-management.ts
import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  RecordRow,
  ColumnMetadataRow,
  RecordSearchResponse,
  RecordListResponse,
  BACKEND_URL,
  FilterCondition,
} from "../types"
import { applyRowFilters, toEditableCellValue, parseEditedCellValue } from "../utils"

export function useDataManagement() {
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

  const filteredRows = useMemo(
    () => applyRowFilters(rows, filters),
    [rows, filters]
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

  const handleConfirmBulkDelete = useCallback(async () => {
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
  }, [selectedRowIds])

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
  }, [rows, visibleColumns])

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

  const enterEditMode = useCallback(() => {
    setIsEditMode(true)
  }, [])

  const exitEditMode = useCallback(() => {
    setIsEditMode(false)
    setDraftCells({})
    setDirtyCellCount(0)
  }, [])

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

  const handleSaveSpreadsheetChanges = useCallback(async () => {
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
  }, [draftCells, rows, visibleColumns, exitEditMode, refreshAfterMutation])

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
    (column: { key: string; label: string } | null) => {
      setColumnPendingAdd(column)
      setIsColumnAddDialogOpen(true)
    },
    []
  )

  const handleConfirmDelete = useCallback(async () => {
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
  }, [recordPendingDelete, refreshAfterMutation])

  const handleConfirmColumnDelete = useCallback(async () => {
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
  }, [columnPendingDelete, fetchData])

  const handleConfirmColumnRename = useCallback(async (newName: string) => {
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
  }, [columnPendingRename, fetchData])

  const handleConfirmColumnAdd = useCallback(async (data: {
    name: string
    type: string
    defaultValue: string
    position?: string
  }) => {
    if (!columnPendingAdd && !data.position) return
    const trimmedName = data.name.trim()
    if (!trimmedName) {
      toast.error("Column name cannot be empty")
      return
    }

    setIsMutating(true)
    try {
      // Determine the order for the new column
      let newOrder: number
      if (columnPendingAdd) {
        // Existing logic for context menu
        const targetIndex = metadata.findIndex(
          (m) => m.column_name === columnPendingAdd.key
        )
        const targetMeta = metadata[targetIndex]
        newOrder = targetMeta
          ? (targetMeta.order ?? 0) + 1
          : metadata.length
      } else {
        // New logic for position selection
        const position = data.position!
        if (position === "beginning") {
          newOrder = 0
        } else if (position === "end") {
          newOrder = Math.max(...metadata.map(m => m.order ?? 0), -1) + 1
        } else if (position.startsWith("after-")) {
          const afterKey = position.slice(6)
          const afterMeta = metadata.find(m => m.column_name === afterKey)
          newOrder = (afterMeta?.order ?? 0) + 1
        } else {
          newOrder = metadata.length
        }
      }

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
  }, [columnPendingAdd, metadata, fetchData])

  const handleExportData = useCallback(async () => {
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
  }, [exportFormat, exportScope, selectedRowIds])

  const handleAddFilter = useCallback((filter: {
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
  }, [])

  const handleRemoveFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId))
    toast.success("Filter removed")
  }, [])

  const handleClearAllFilters = useCallback(() => {
    setFilters([])
    toast.success("All filters cleared")
  }, [])

  const openExportDialog = useCallback((scope: "all" | "selected") => {
    setExportScope(scope)
    setIsExportDialogOpen(true)
  }, [])

  return {
    state: {
      rows,
      metadata,
      totalCount,
      skip,
      appliedSearchQuery,
      searchType,
      isLoading,
      isRefreshing,
      error,
      isEditMode,
      draftCells,
      recordPendingDelete,
      isDeleteDialogOpen,
      isMutating,
      dirtyCellCount,
      exportFormat,
      isExporting,
      isExportDialogOpen,
      sortColumn,
      sortDirection,
      pageSize,
      isSelectionMode,
      selectedRowIds,
      isBulkDeleteDialogOpen,
      exportScope,
      filters,
      isFilterDialogOpen,
      columnPendingDelete,
      isColumnDeleteDialogOpen,
      columnPendingRename,
      isColumnRenameDialogOpen,
      columnPendingAdd,
      isColumnAddDialogOpen,
      isSearchMode,
      filteredRows,
      isAllFilteredSelected,
      visibleColumns,
      allColumns,
      hasPreviousPage,
      hasNextPage,
      currentPage,
      totalPages,
      hasPendingChanges,
      originalEditableValuesByRow,
      highlightId,
    },
    actions: {
      setSkip,
      setSearchType,
      setIsEditMode,
      setIsDeleteDialogOpen,
      setRecordPendingDelete,
      setIsExportDialogOpen,
      setExportFormat,
      setPageSize,
      setIsSelectionMode,
      setSelectedRowIds,
      setIsBulkDeleteDialogOpen,
      setFilters,
      setIsFilterDialogOpen,
      setIsColumnDeleteDialogOpen,
      setColumnPendingDelete,
      setIsColumnRenameDialogOpen,
      setColumnPendingRename,
      setIsColumnAddDialogOpen,
      setColumnPendingAdd,
      fetchData,
      handleSort,
      toggleRowSelection,
      toggleSelectAll,
      handleConfirmBulkDelete,
      handleApplySearch,
      handleClearSearch,
      refreshAfterMutation,
      enterEditMode,
      exitEditMode,
      updateDraftCell,
      handleSaveSpreadsheetChanges,
      handleContextEditRow,
      openDeleteDialog,
      openColumnDeleteDialog,
      openColumnRenameDialog,
      openColumnAddDialog,
      handleConfirmDelete,
      handleConfirmColumnDelete,
      handleConfirmColumnRename,
      handleConfirmColumnAdd,
      handleExportData,
      handleAddFilter,
      handleRemoveFilter,
      handleClearAllFilters,
      openExportDialog,
      openBulkDeleteDialog,
    },
  }
}