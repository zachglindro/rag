import { memo, useState } from "react" // Removed useEffect
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
  visibleColumns: { key: string; label: string }[]
  isMutating: boolean
  onConfirm: (data: {
    name: string
    type: string
    defaultValue: string
    position?: string
  }) => void
}

export const AddColumnDialog = memo(function AddColumnDialog({
  isOpen,
  onOpenChange,
  columnPendingAdd,
  visibleColumns,
  isMutating,
  onConfirm,
}: AddColumnDialogProps) {
  // 1. Initialize state directly
  const [name, setName] = useState("")
  const [type, setType] = useState("string")
  const [defaultValue, setDefaultValue] = useState("")
  const [position, setPosition] = useState("end")

  // 2. Create a reset function
  const resetForm = () => {
    setName("")
    setType("string")
    setDefaultValue("")
    setPosition("end")
  }

  // 3. Handle closing logic to reset state
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    onOpenChange(open)
  }

  const handleConfirm = () => {
    onConfirm({ 
      name, 
      type, 
      defaultValue, 
      position: columnPendingAdd ? undefined : position 
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* 
        4. Use a key based on isOpen. 
        When the dialog is closed and reopened, the key change forces 
        React to reset all local state automatically.
      */}
      <DialogContent key={isOpen ? "open" : "closed"}>
        <DialogHeader>
          <DialogTitle>Add New Column</DialogTitle>
          <DialogDescription>
            {columnPendingAdd
              ? `Add a new column to the right of "${columnPendingAdd.label}".`
              : "Add a new column at the selected position."}
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
          {!columnPendingAdd && (
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="col-position" className="text-right text-sm">
                Position
              </label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="col-span-3" id="col-position">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginning">At the beginning</SelectItem>
                  {visibleColumns.map((column) => (
                    <SelectItem key={`after-${column.key}`} value={`after-${column.key}`}>
                      After {column.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="end">At the end</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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
            onClick={() => handleOpenChange(false)}
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