"use client"

import { Button } from "@/components/ui/button"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEffect, useState, useMemo } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ColumnMapping {
  origColumn: string
  mappedColumn: string
}

interface TemplatePreviewStepProps {
  onBack: () => void
  onNext: () => void
  mappings: ColumnMapping[]
  rawData: Record<string, unknown>[]
  idColumn: string | null
}

export function TemplatePreviewStep({
  onBack,
  onNext,
  mappings,
  rawData,
  idColumn,
}: TemplatePreviewStepProps) {
  const [visibleRowsNew, setVisibleRowsNew] = useState(10)
  const [visibleRowsUpdate, setVisibleRowsUpdate] = useState(10)
  const [existingRecords, setExistingRecords] = useState<
    Record<string, Record<string, unknown>>
  >({})
  const [isCheckingIds, setIsCheckingIds] = useState(false)

  // Transform data using mappings, filtering unmapped columns
  const fullTransformedData = useMemo(() => {
    return rawData.map((row) => {
      const mapped: Record<string, unknown> = {}
      mappings.forEach(({ origColumn, mappedColumn }) => {
        if (mappedColumn && row.hasOwnProperty(origColumn)) {
          mapped[mappedColumn] = row[origColumn]
        }
      })
      return mapped
    })
  }, [rawData, mappings])

  const mappedIdColumn = idColumn

  useEffect(() => {
    const checkExistence = async () => {
      if (!mappedIdColumn) {
        setExistingRecords({})
        return
      }

      setIsCheckingIds(true)
      try {
        const idsToCheck = fullTransformedData
          .map((row) => row[mappedIdColumn])
          .filter((id) => id != null && id !== "")

        if (idsToCheck.length === 0) {
          setExistingRecords({})
          return
        }

        const response = await fetch(
          "http://localhost:8000/records/check-existence",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              column_name: mappedIdColumn,
              ids: idsToCheck,
            }),
          }
        )

        if (response.ok) {
          const data = await response.json()
          setExistingRecords(data.existing_records)
        }
      } catch (error) {
        console.error("Failed to check record existence:", error)
      } finally {
        setIsCheckingIds(false)
      }
    }

    checkExistence()
  }, [mappedIdColumn, fullTransformedData])

  const { newRecords, updatedRecords } = useMemo(() => {
    const news: Record<string, unknown>[] = []
    const updates: Record<string, unknown>[] = []

    fullTransformedData.forEach((row) => {
      const idVal = mappedIdColumn ? String(row[mappedIdColumn] ?? "") : ""
      if (mappedIdColumn && existingRecords[idVal]) {
        updates.push(row)
      } else {
        news.push(row)
      }
    })

    return { newRecords: news, updatedRecords: updates }
  }, [fullTransformedData, mappedIdColumn, existingRecords])

  const mappedColumns = mappings
    .filter((m) => m.mappedColumn !== "")
    .map((m) => m.mappedColumn)

  const renderTable = (
    data: Record<string, unknown>[],
    limit: number,
    isUpdateSection: boolean
  ) => {
    const displayData = data.slice(0, limit)

    return (
      <div className="w-full min-w-0 overflow-x-auto rounded-lg border bg-card">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                {mappedColumns.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, idx) => {
                const idVal = mappedIdColumn
                  ? String(row[mappedIdColumn] ?? "")
                  : ""
                const existingData = isUpdateSection
                  ? existingRecords[idVal]
                  : null

                return (
                  <TableRow key={idx}>
                    {mappedColumns.map((col) => {
                      const newVal = row[col]
                      const oldVal = existingData?.[col]
                      const hasChanged =
                        isUpdateSection &&
                        oldVal !== undefined &&
                        String(newVal) !== String(oldVal)

                      return (
                        <TableCell
                          key={col}
                          className={cn(
                            hasChanged &&
                              "bg-amber-50 font-medium text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
                          )}
                        >
                          {hasChanged ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dotted border-amber-400">
                                  {newVal != null ? String(newVal) : "—"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  Changed from:{" "}
                                  <span className="font-mono text-muted-foreground line-through">
                                    {oldVal != null ? String(oldVal) : "—"}
                                  </span>
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span>{newVal != null ? String(newVal) : "—"}</span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header & Summary */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="text-xl font-semibold">Ingestion Preview</h3>
        <p className="text-sm text-muted-foreground">
          Review your data changes before finalizing.
        </p>

        <div className="mt-4 flex gap-4">
          {isCheckingIds ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking existing records...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-1 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{newRecords.length}</span>
                <span className="text-muted-foreground">New</span>
              </div>
              {updatedRecords.length > 0 && (
                <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-1 text-sm">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">{updatedRecords.length}</span>
                  <span className="text-muted-foreground">Updates</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Updates Section */}
      {updatedRecords.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              Records to Update
            </h4>
            <span className="text-xs text-muted-foreground">
              (Highlighted cells show changed values)
            </span>
          </div>
          {renderTable(updatedRecords, visibleRowsUpdate, true)}
          {visibleRowsUpdate < updatedRecords.length && (
            <Button
              variant="ghost"
              size="sm"
              className="self-center text-muted-foreground"
              onClick={() => setVisibleRowsUpdate((v) => v + 20)}
            >
              Show more updates ({updatedRecords.length - visibleRowsUpdate}{" "}
              remaining)
            </Button>
          )}
        </div>
      )}

      {/* New Records Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            New Records
          </h4>
        </div>
        {renderTable(newRecords, visibleRowsNew, false)}
        {visibleRowsNew < newRecords.length && (
          <Button
            variant="ghost"
            size="sm"
            className="self-center text-muted-foreground"
            onClick={() => setVisibleRowsNew((v) => v + 20)}
          >
            Show more new records ({newRecords.length - visibleRowsNew}{" "}
            remaining)
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between border-t pt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-3">
          <Button onClick={onNext} className="px-8">
            Start Ingestion
          </Button>
        </div>
      </div>
    </div>
  )
}
