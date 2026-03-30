"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

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
  // Transform data using mappings, filtering unmapped columns
  const transformedData = rawData.slice(0, 10).map((row) => {
    const mapped: Record<string, unknown> = {}
    mappings.forEach(({ origColumn, mappedColumn }) => {
      if (mappedColumn && row.hasOwnProperty(origColumn)) {
        mapped[mappedColumn] = row[origColumn]
      }
    })
    return mapped
  })

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
      <div className="rounded-lg border">
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

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Start Ingestion</Button>
      </div>
    </div>
  )
}
