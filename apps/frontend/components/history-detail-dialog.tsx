import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HistoryEntry,
  formatTimestamp,
  getActionLabel,
} from "@/lib/history-utils"
import { HistoryDetail } from "./history-detail"

interface HistoryDetailDialogProps {
  entry: HistoryEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HistoryDetailDialog({
  entry,
  open,
  onOpenChange,
}: HistoryDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>History Entry Details</DialogTitle>
          <DialogDescription>
            {entry && (
              <>
                <span className="text-foreground">
                  {getActionLabel(entry.action_type)}
                </span>
                {" at "}
                <span className="text-foreground">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">User</p>
              <p className="text-sm text-muted-foreground">
                {entry.user_name || "System"}
              </p>
            </div>

            {entry.affected_records && (
              <div>
                <p className="text-sm font-medium">Affected Records</p>
                <p className="text-sm text-muted-foreground">
                  {entry.affected_records}
                </p>
              </div>
            )}

            {entry.affected_column && (
              <div>
                <p className="text-sm font-medium">Affected Column</p>
                <p className="text-sm text-muted-foreground">
                  {entry.affected_column}
                </p>
              </div>
            )}

            <div className="pt-2">
              <p className="mb-3 text-sm font-medium">Details</p>
              <HistoryDetail entry={entry} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
