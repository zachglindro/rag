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
import { useEffect, useState, Suspense } from "react"
import { toast } from "sonner"
import {
  HistoryEntry,
  HistoryResponse,
  HISTORY_URL,
  PAGE_SIZE,
  getActionLabel,
  getActionColor,
  formatTimestamp,
  formatDetails,
} from "@/lib/history-utils"
import { HistoryDetailDialog } from "@/components/history-detail-dialog"

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

      <HistoryDetailDialog
        entry={selectedEntry}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />
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
