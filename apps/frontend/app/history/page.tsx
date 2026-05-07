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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Loader2, Clock } from "lucide-react"
import { useEffect, useState, Suspense, ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const BACKEND_URL = "http://localhost:8000"
const HISTORY_URL = `${BACKEND_URL}/history`
const PAGE_SIZE = 50

interface HistoryEntry {
  id: number
  timestamp: string
  action_type: string
  user_name: string | null
  details: Record<string, unknown>
  affected_records: number | null
  affected_column: string | null
}

interface HistoryResponse {
  entries: HistoryEntry[]
  total_count: number
}

function getActionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    RECORDS_INGESTED: "Records Ingested",
    RECORD_UPDATED: "Record Updated",
    RECORD_DELETED: "Record Deleted",
    COLUMN_ADDED: "Column Added",
    COLUMN_DELETED: "Column Deleted",
    COLUMN_RENAMED: "Column Renamed",
    DATABASE_RESET: "Database Reset",
  }
  return labels[actionType] || actionType
}

function getActionColor(actionType: string): string {
  switch (actionType) {
    case "RECORDS_INGESTED":
      return "text-foreground"
    case "RECORD_UPDATED":
      return "text-foreground"
    case "RECORD_DELETED":
      return "text-foreground"
    case "COLUMN_ADDED":
      return "text-foreground"
    case "COLUMN_DELETED":
      return "text-foreground"
    case "COLUMN_RENAMED":
      return "text-foreground"
    case "DATABASE_RESET":
      return "text-foreground font-semibold"
    default:
      return "text-foreground"
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

function formatDetails(
  details: Record<string, unknown>,
  actionType: string
): string {
  switch (actionType) {
    case "RECORDS_INGESTED": {
      const inserted = details.inserted_count || 0
      const updated = details.updated_count || 0
      const total = Number(inserted) + Number(updated)
      if (updated && Number(updated) > 0) {
        return `Ingested ${inserted} new records and updated ${updated} existing records`
      }
      return `Ingested ${total} new records`
    }

    case "RECORD_UPDATED": {
      const recordId = details.record_id || "unknown"
      return `Updated record #${recordId}`
    }

    case "RECORD_DELETED": {
      const recordId = details.record_id || "unknown"
      return `Deleted record #${recordId}`
    }

    case "COLUMN_ADDED": {
      const columnName = details.column_name || "unknown"
      const dataType = details.data_type || "unknown"
      return `Added column "${columnName}" (${dataType})`
    }

    case "COLUMN_DELETED": {
      const columnName = details.column_name || "unknown"
      return `Deleted column "${columnName}"`
    }

    case "COLUMN_RENAMED": {
      const oldName = details.old_column_name || "unknown"
      const newName = details.new_column_name || "unknown"
      return `Renamed column "${oldName}" to "${newName}"`
    }

    case "DATABASE_RESET":
      return "Database reset - all records and columns deleted"

    default:
      return "View details for more information"
  }
}

function renderDetailContent(entry: HistoryEntry): ReactNode {
  const details = entry.details
  const parts: ReactNode[] = []

  switch (entry.action_type) {
    case "RECORDS_INGESTED":
      parts.push(
        <div key="inserted" className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-sm font-medium">Records Inserted</p>
            <p className="text-sm text-muted-foreground">
              {String(details.inserted_count)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Records Updated</p>
            <p className="text-sm text-muted-foreground">
              {String(details.updated_count)}
            </p>
          </div>
        </div>
      )
      if (details.mapping && typeof details.mapping === "object") {
        const mappingObj = details.mapping as Record<string, string>
        const mappingEntries = Object.entries(mappingObj)
        if (mappingEntries.length > 0) {
          parts.push(
            <div key="mapping">
              <p className="text-sm font-medium">Column Mappings</p>
              <div className="mt-1 space-y-1">
                {mappingEntries.map(([from, to]) => (
                  <p key={from} className="text-sm text-muted-foreground">
                    {from} → {to}
                  </p>
                ))}
              </div>
            </div>
          )
        }
      }
      break

    case "RECORD_UPDATED":
      parts.push(
        <div key="record-id">
          <p className="text-sm font-medium">Record ID</p>
          <p className="text-sm text-muted-foreground">
            {String(details.record_id)}
          </p>
        </div>
      )
      if (
        details.old_data &&
        details.new_data &&
        typeof details.old_data === "object" &&
        typeof details.new_data === "object"
      ) {
        const oldDataObj = details.old_data as Record<string, unknown>
        const newDataObj = details.new_data as Record<string, unknown>

        // Find changed fields
        const changedFields: Array<{
          field: string
          oldValue: unknown
          newValue: unknown
        }> = []
        const allKeys = new Set([
          ...Object.keys(oldDataObj),
          ...Object.keys(newDataObj),
        ])

        for (const key of allKeys) {
          if (
            JSON.stringify(oldDataObj[key]) !== JSON.stringify(newDataObj[key])
          ) {
            changedFields.push({
              field: key,
              oldValue: oldDataObj[key],
              newValue: newDataObj[key],
            })
          }
        }

        if (changedFields.length > 0) {
          parts.push(
            <div key="changes">
              <p className="text-sm font-medium">Changes</p>
              <div className="mt-2 space-y-3">
                {changedFields.map((change) => (
                  <div
                    key={change.field}
                    className="rounded border border-border bg-muted p-3"
                  >
                    <p className="text-sm font-medium">{change.field}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Before:</span>{" "}
                        {JSON.stringify(change.oldValue)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">After:</span>{" "}
                        {JSON.stringify(change.newValue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }
      }
      break

    case "RECORD_DELETED":
      parts.push(
        <div key="record-id">
          <p className="text-sm font-medium">Record ID</p>
          <p className="text-sm text-muted-foreground">
            {String(details.record_id)}
          </p>
        </div>
      )
      if (details.deleted_data && typeof details.deleted_data === "object") {
        parts.push(
          <div key="deleted-data">
            <p className="text-sm font-medium">Deleted Data</p>
            <pre className="mt-1 max-h-[200px] overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(details.deleted_data, null, 2)}
            </pre>
          </div>
        )
      }
      break

    case "COLUMN_ADDED":
      parts.push(
        <div key="column-info" className="space-y-3">
          <div>
            <p className="text-sm font-medium">Column Name</p>
            <p className="text-sm text-muted-foreground">
              {String(details.column_name)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Display Name</p>
            <p className="text-sm text-muted-foreground">
              {String(details.display_name)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Data Type</p>
            <p className="text-sm text-muted-foreground">
              {String(details.data_type)}
            </p>
          </div>
          {details.is_required === true && (
            <div>
              <p className="text-sm font-medium">Required</p>
              <p className="text-sm text-muted-foreground">Yes</p>
            </div>
          )}
        </div>
      )
      break

    case "COLUMN_DELETED":
      parts.push(
        <div key="column-name">
          <p className="text-sm font-medium">Column Name</p>
          <p className="text-sm text-muted-foreground">
            {String(details.column_name)}
          </p>
        </div>
      )
      break

    case "COLUMN_RENAMED":
      parts.push(
        <div key="rename-info" className="space-y-3">
          <div>
            <p className="text-sm font-medium">Old Name</p>
            <p className="text-sm text-muted-foreground">
              {String(details.old_column_name)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">New Name</p>
            <p className="text-sm text-muted-foreground">
              {String(details.new_column_name)}
            </p>
          </div>
        </div>
      )
      break

    case "DATABASE_RESET":
      parts.push(
        <div
          key="reset-warning"
          className="rounded-md border border-border bg-destructive/10 p-3"
        >
          <p className="text-sm font-medium text-destructive">Database Reset</p>
          <p className="mt-1 text-sm text-muted-foreground">
            All records and column metadata were deleted.
          </p>
        </div>
      )
      break

    default:
      parts.push(
        <pre
          key="default"
          className="max-h-[300px] overflow-auto rounded bg-muted p-2 text-xs"
        >
          {JSON.stringify(details, null, 2)}
        </pre>
      )
  }

  return <div className="space-y-3">{parts}</div>
}

function HistoryPageContent() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true)
        const skip = (currentPage - 1) * PAGE_SIZE
        const response = await fetch(
          `${HISTORY_URL}?skip=${skip}&limit=${PAGE_SIZE}`
        )
        if (!response.ok) {
          throw new Error("Failed to fetch history")
        }
        const data: HistoryResponse = await response.json()
        setEntries(data.entries)
        setTotalCount(data.total_count)
      } catch (error) {
        console.error("Error fetching history:", error)
        toast.error("Failed to load history")
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [currentPage])

  const handleViewDetails = (entry: HistoryEntry) => {
    setSelectedEntry(entry)
    setShowDetailsDialog(true)
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <div className="flex min-h-svh w-full min-w-0 flex-col gap-6 overflow-x-hidden p-6">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <h1 className="text-xl font-semibold">History</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              View all database activities and changes.
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-4 rounded-lg border p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No history entries found
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-[100px] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">
                            {formatTimestamp(entry.timestamp)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-medium ${getActionColor(entry.action_type)}`}
                            >
                              {getActionLabel(entry.action_type)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.user_name || "System"}
                          </TableCell>
                          <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                            {formatDetails(entry.details, entry.action_type)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(entry)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>

                        {Array.from(
                          { length: Math.min(totalPages, 5) },
                          (_, i) => {
                            const pageNum = i + 1
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={currentPage === pageNum}
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          }
                        )}

                        {totalPages > 5 && (
                          <>
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationLink
                                onClick={() => setCurrentPage(totalPages)}
                                className="cursor-pointer"
                              >
                                {totalPages}
                              </PaginationLink>
                            </PaginationItem>
                          </>
                        )}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            className={
                              currentPage === totalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SidebarInset>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>History Entry Details</DialogTitle>
            <DialogDescription>
              {selectedEntry && (
                <>
                  <span className="text-foreground">
                    {getActionLabel(selectedEntry.action_type)}
                  </span>
                  {" at "}
                  <span className="text-foreground">
                    {formatTimestamp(selectedEntry.timestamp)}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">User</p>
                <p className="text-sm text-muted-foreground">
                  {selectedEntry.user_name || "System"}
                </p>
              </div>

              {selectedEntry.affected_records && (
                <div>
                  <p className="text-sm font-medium">Affected Records</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEntry.affected_records}
                  </p>
                </div>
              )}

              {selectedEntry.affected_column && (
                <div>
                  <p className="text-sm font-medium">Affected Column</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEntry.affected_column}
                  </p>
                </div>
              )}

              <div className="pt-2">
                <p className="mb-3 text-sm font-medium">Details</p>
                {renderDetailContent(selectedEntry)}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDetailsDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HistoryPageContent />
    </Suspense>
  )
}
