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

interface TemplatePreviewStepProps {
  onBack: () => void
  onNext: () => void
}

// Hardcoded sample data for preview
const sampleData = [
  {
    local_name: "Maize Line A",
    plant_height: "185.3",
    tassel_color: "Purple",
  },
  {
    local_name: "Maize Line B",
    plant_height: "172.8",
    tassel_color: "Green",
  },
  {
    local_name: "Maize Line C",
    plant_height: "195.1",
    tassel_color: "Purple",
  },
  {
    local_name: "Maize Line D",
    plant_height: "168.5",
    tassel_color: "Yellow",
  },
  {
    local_name: "Maize Line E",
    plant_height: "178.9",
    tassel_color: "Green",
  },
]

export function TemplatePreviewStep({
  onBack,
  onNext,
}: TemplatePreviewStepProps) {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium">Template Preview</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview how your data will look
        </p>
      </div>

      {/* Data table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Local Name</TableHead>
              <TableHead className="w-[150px]">Plant Height (cm)</TableHead>
              <TableHead>Tassel Color</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleData.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.local_name}</TableCell>
                <TableCell>{row.plant_height}</TableCell>
                <TableCell>{row.tassel_color}</TableCell>
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
