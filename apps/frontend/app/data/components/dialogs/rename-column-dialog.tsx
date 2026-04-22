import { memo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

interface RenameColumnDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  columnPendingRename: { key: string; label: string } | null
  isMutating: boolean
  onConfirm: (newName: string) => void
}

export const RenameColumnDialog = memo(function RenameColumnDialog({
  isOpen,
  onOpenChange,
  columnPendingRename,
  isMutating,
  onConfirm,
}: RenameColumnDialogProps) {
  const [name, setName] = useState(columnPendingRename?.label ?? "")

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Column</DialogTitle>
          <DialogDescription>
            Rename the &quot;{columnPendingRename?.label}&quot; column.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="new-name" className="text-right">
              New Name
            </label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Enter new column name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMutating}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(name)}
            disabled={isMutating || !name.trim()}
          >
            {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isMutating ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
