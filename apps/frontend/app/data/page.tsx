"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { SidebarInset } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCallback, useEffect, useMemo, useState } from "react"

interface RecordRow {
  id: number
  data: Record<string, unknown>
  natural_language_description: string | null
  created_at: string | null
  updated_at: string | null
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

const BACKEND_URL = "http://localhost:8000"
const PAGE_SIZE = 25

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

export default function DataPage() {
  const [rows, setRows] = useState<RecordRow[]>([])
  const [metadata, setMetadata] = useState<ColumnMetadataRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [skip, setSkip] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [recordsResponse, metadataResponse, countResponse] =
        await Promise.all([
          fetch(`${BACKEND_URL}/records?skip=${skip}&limit=${PAGE_SIZE}`),
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
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Unknown error"
      )
      setRows([])
      setMetadata([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [skip])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const hasPreviousPage = skip > 0
  const hasNextPage = skip + rows.length < totalCount
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 1

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col gap-6 p-6">
          <div>
            <h1 className="text-xl font-semibold">Data</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse ingested records and schema metadata.
            </p>
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
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
              No records yet. Add data from the Add flow to populate this table.
            </div>
          )}

          {!isLoading && !error && totalCount > 0 && (
            <div className="flex flex-col gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {skip + 1}-{Math.min(skip + rows.length, totalCount)} of{" "}
                {totalCount}
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">ID</TableHead>
                      {visibleColumns.map((column) => (
                        <TableHead key={column.key}>{column.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.id}</TableCell>
                        {visibleColumns.map((column) => (
                          <TableCell key={`${row.id}-${column.key}`}>
                            {stringifyValue(row.data?.[column.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={!hasPreviousPage}
                    onClick={() =>
                      setSkip((previous) => Math.max(previous - PAGE_SIZE, 0))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!hasNextPage}
                    onClick={() => setSkip((previous) => previous + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && totalCount > 0 && metadata.length === 0 && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900">
              Column metadata is empty. Columns are inferred from record keys.
            </div>
          )}
        </div>
      </SidebarInset>
    </>
  )
}
