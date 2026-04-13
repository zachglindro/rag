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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react"

interface RecordRow {
  id: number
  data: Record<string, unknown>
  natural_language_description: string | null
  created_at: string | null
  updated_at: string | null
  distance?: number | null
}

interface RecordListResponse {
  records: RecordRow[]
  skip: number
  limit: number
}

interface ColumnMetadataRow {
  column_name: string
  display_name: string
  data_type: string
  is_required: boolean
  default_value: string | null
  order: number | null
  description: string | null
}

interface RecordSearchResponse {
  query: string
  top_k: number
  records: RecordRow[]
}

const BACKEND_URL = "http://localhost:8000"
const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "yes"])
const BOOLEAN_FALSE_VALUES = new Set(["false", "0", "no"])

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? value : "-"
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]"
    }

    return value.map((item) => stringifyValue(item)).join(", ")
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return "[object]"
    }
  }

  return String(value)
}

interface VisibleColumn {
  key: string
  label: string
}

interface DataTableRowProps {
  row: RecordRow
  visibleColumns: VisibleColumn[]
  isEditMode: boolean
  isMutating: boolean
  rowDraft: Record<string, string> | undefined
  toEditableCellValue: (value: unknown) => string
  onUpdateDraftCell: (rowId: number, columnKey: string, value: string) => void
  onContextEditRow: (row: RecordRow) => void
  onOpenDeleteDialog: (row: RecordRow) => void
}

const DataTableRow = memo(function DataTableRow({
  row,
  visibleColumns,
  isEditMode,
  isMutating,
  rowDraft,
  toEditableCellValue,
  onUpdateDraftCell,
  onContextEditRow,
  onOpenDeleteDialog,
}: DataTableRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow>
          <TableCell className="font-medium">{row.id}</TableCell>
          {visibleColumns.map((column) => {
            const originalValue = toEditableCellValue(row.data?.[column.key])
            const draftValue = rowDraft?.[column.key]
            const cellValue = draftValue ?? originalValue
            const changed =
              draftValue !== undefined && draftValue !== originalValue

            if (isEditMode) {
              return (
                <TableCell key={`${row.id}-${column.key}`}>
                  <Input
                    value={cellValue}
                    onChange={(event) =>
                      onUpdateDraftCell(row.id, column.key, event.target.value)
                    }
                    className={changed ? "border-amber-500" : ""}
                    disabled={isMutating}
                  />
                </TableCell>
              )
            }

            return (
              <TableCell key={`${row.id}-${column.key}`}>
                {stringifyValue(row.data?.[column.key])}
              </TableCell>
            )
          })}
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Row {row.id}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => onContextEditRow(row)}
          disabled={isMutating}
        >
          Edit
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onSelect={() => onOpenDeleteDialog(row)}
          disabled={isMutating}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

export default function DataPage() {
  const [rows, setRows] = useState<RecordRow[]>([])
  const [metadata, setMetadata] = useState<ColumnMetadataRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [skip, setSkip] = useState(0)
  const [searchInput, setSearchInput] = useState("")
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("")
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
      if (isSearchMode) {
        const [searchResponse, metadataResponse] = await Promise.all([
          fetch(
            `${BACKEND_URL}/semantic-search/records?query=${encodeURIComponent(appliedSearchQuery)}&top_k=50&sort_by=${encodeURIComponent(sortColumn)}&sort_order=${sortDirection}`
          ),
          fetch(`${BACKEND_URL}/column-metadata`),
        ])

        if (!searchResponse.ok || !metadataResponse.ok) {
          throw new Error("Failed to run semantic search")
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
  ])

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
        label: column.display_name || column.column_name,
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

  const applySearch = () => {
    const nextQuery = searchInput.trim()
    setSkip(0)
    setAppliedSearchQuery(nextQuery)
  }

  const clearSearch = () => {
    if (isEditMode) {
      toast.error("Exit edit mode before changing the search query")
      return
    }

    setSearchInput("")
    setAppliedSearchQuery("")
    setSkip(0)
    setSortColumn("id")
    setSortDirection("asc")
  }

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
          body: JSON.stringify({ data: update.data }),
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

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const response = await fetch(
        `${BACKEND_URL}/export-data?format=${exportFormat}`
      )
      if (!response.ok) {
        throw new Error("Export failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `export_data.${exportFormat}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success(`Exported data as ${exportFormat.toUpperCase()}`)
      setIsExportDialogOpen(false)
    } catch {
      toast.error("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

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

          <div className="rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    applySearch()
                  }
                }}
                placeholder="Search"
                aria-label="Semantic search query"
                disabled={isEditMode || isMutating}
              />
              <div className="flex gap-2">
                <Button
                  onClick={applySearch}
                  disabled={
                    searchInput.trim().length === 0 || isEditMode || isMutating
                  }
                >
                  Search
                </Button>
                <Button
                  variant="outline"
                  onClick={clearSearch}
                  disabled={
                    (!isSearchMode && searchInput.trim().length === 0) ||
                    isMutating
                  }
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

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

          {!isLoading && !error && totalCount === 0 && (
            <div className="rounded-lg border p-6">
              <p className="text-sm text-muted-foreground">
                There is currently no data in the database.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/add">Add Data</Link>
              </Button>
            </div>
          )}

          {!isLoading && !error && totalCount > 0 && (
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                {!isEditMode && (
                  <>
                    <Button onClick={enterEditMode} disabled={isMutating}>
                      Edit
                    </Button>
                    <Button
                      onClick={() => setIsExportDialogOpen(true)}
                      disabled={isMutating}
                    >
                      Export
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

          {!isLoading && !error && totalCount > 0 && (
            <div className="flex w-full min-w-0 flex-col gap-4">
              {isRefreshing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refreshing records...
                </div>
              )}

              {isSearchMode ? (
                <div className="text-sm text-muted-foreground">
                  Semantic search for &quot;{appliedSearchQuery}&quot; returned{" "}
                  {rows.length} results.
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
                      <TableHead
                        className="w-20 cursor-pointer"
                        onClick={() => handleSort("id")}
                      >
                        ID
                        {sortColumn === "id" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="ml-1 inline h-4 w-4" />
                          ) : (
                            <ChevronDown className="ml-1 inline h-4 w-4" />
                          ))}
                      </TableHead>
                      {visibleColumns.map((column) => (
                        <TableHead
                          key={column.key}
                          className="cursor-pointer"
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
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <DataTableRow
                        key={row.id}
                        row={row}
                        visibleColumns={visibleColumns}
                        isEditMode={isEditMode}
                        isMutating={isMutating}
                        rowDraft={draftCells[row.id]}
                        toEditableCellValue={toEditableCellValue}
                        onUpdateDraftCell={updateDraftCell}
                        onContextEditRow={handleContextEditRow}
                        onOpenDeleteDialog={openDeleteDialog}
                      />
                    ))}
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

          <Dialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Record</DialogTitle>
                <DialogDescription>
                  This will permanently delete record #{recordPendingDelete?.id}{" "}
                  from SQLite and Chroma.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isMutating}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isMutating}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isExportDialogOpen}
            onOpenChange={setIsExportDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Data</DialogTitle>
                <DialogDescription>
                  Select the export format and download the data.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={exportFormat}
                  onValueChange={(value: "csv" | "xlsx") =>
                    setExportFormat(value)
                  }
                  disabled={isExporting}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select export format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xlsx">XLSX</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleExportData} disabled={isExporting}>
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </SidebarInset>
    </>
  )
}
