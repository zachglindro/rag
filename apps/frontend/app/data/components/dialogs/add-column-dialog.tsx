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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface AddColumnDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  columnPendingAdd: { key: string; label: string } | null
  isMutating: boolean
  onConfirm: (data: {
    name: string
    type: string
    defaultValue: string
  }) => void
}

export const AddColumnDialog = memo(function AddColumnDialog({
  isOpen,
  onOpenChange,
  columnPendingAdd,
  isMutating,
  onConfirm,
}: AddColumnDialogProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState("string")
  const [defaultValue, setDefaultValue] = useState("")

  const handleConfirm = () => {
    onConfirm({ name, type, defaultValue })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Column</DialogTitle>
          <DialogDescription>
            Add a new column to the right of &quot;
            {columnPendingAdd?.label}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="col-name" className="text-right text-sm">
              Name
            </label>
            <Input
              id="col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Column name"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="col-type" className="text-right text-sm">
              Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="col-span-3" id="col-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="text-right">
              <label htmlFor="col-default" className="text-sm font-medium">
                Default
              </label>
              <p className="text-[10px] text-muted-foreground">
                For existing rows
              </p>
            </div>
            <Input
              id="col-default"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              className="col-span-3"
              placeholder={type === "number" ? "123" : "Default value"}
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
          <Button onClick={handleConfirm} disabled={isMutating || !name.trim()}>
            {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isMutating ? "Adding..." : "Add Column"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
