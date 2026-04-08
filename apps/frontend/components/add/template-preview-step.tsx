"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ColumnMapping {
  origColumn: string
  mappedColumn: string
}

interface TemplatePreviewStepProps {
  onBack: () => void
  onNext: () => void
  mappings: ColumnMapping[]
  rawData: Record<string, unknown>[]
}

export function TemplatePreviewStep({
  onBack,
  onNext,
  mappings,
  rawData,
}: TemplatePreviewStepProps) {
  const [visibleRows, setVisibleRows] = useState(10)
  const [showAllDialogOpen, setShowAllDialogOpen] = useState(false)

  // Transform data using mappings, filtering unmapped columns
  const fullTransformedData = rawData.map((row) => {
    const mapped: Record<string, unknown> = {}
    mappings.forEach(({ origColumn, mappedColumn }) => {
      if (mappedColumn && row.hasOwnProperty(origColumn)) {
        mapped[mappedColumn] = row[origColumn]
      }
    })
    return mapped
  })

  const transformedData = fullTransformedData.slice(0, visibleRows)

  const mappedColumns = mappings
    .filter((m) => m.mappedColumn !== "")
    .map((m) => m.mappedColumn)

  const unmappedCount = mappings.filter((m) => m.mappedColumn === "").length

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium">Template Preview</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview how your data will look
        </p>
        {unmappedCount > 0 && (
          <p className="mt-2 text-sm text-amber-600">
            ⚠️ {unmappedCount} column(s) unmapped — will be discarded
          </p>
        )}
      </div>

      {/* Data table */}
      <div className="w-full min-w-0 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {mappedColumns.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transformedData.map((row, idx) => (
              <TableRow key={idx}>
                {mappedColumns.map((col) => (
                  <TableCell key={col}>
                    {row[col] != null ? String(row[col]) : "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Row expansion buttons */}
      {visibleRows < fullTransformedData.length && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() =>
              setVisibleRows((prev) =>
                Math.min(prev + 10, fullTransformedData.length)
              )
            }
          >
            Show More
          </Button>
          <Button variant="outline" onClick={() => setShowAllDialogOpen(true)}>
            Show All
          </Button>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Start Ingestion</Button>
      </div>

      <Dialog open={showAllDialogOpen} onOpenChange={setShowAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Show All Rows</DialogTitle>
            <DialogDescription>
              This will display all {fullTransformedData.length} rows. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAllDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setVisibleRows(fullTransformedData.length)
                setShowAllDialogOpen(false)
              }}
            >
              Show All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
