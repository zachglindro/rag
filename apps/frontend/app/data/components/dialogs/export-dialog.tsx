import { memo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ExportDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  format: "csv" | "xlsx"
  onFormatChange: (format: "csv" | "xlsx") => void
  onExport: () => void
  isExporting: boolean
}

export const ExportDialog = memo(function ExportDialog({
  isOpen,
  onOpenChange,
  format,
  onFormatChange,
  onExport,
  isExporting,
}: ExportDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Select the export format and download the data.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={format}
            onValueChange={onFormatChange}
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
          <Button onClick={onExport} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
