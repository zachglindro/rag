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
import { VisibleColumn } from "../../types"

interface FilterDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  visibleColumns: VisibleColumn[]
  onConfirm: (filter: {
    columnKey: string
    operator: string
    value: string
  }) => void
}

export const FilterDialog = memo(function FilterDialog({
  isOpen,
  onOpenChange,
  visibleColumns,
  onConfirm,
}: FilterDialogProps) {
  const [columnKey, setColumnKey] = useState("")
  const [operator, setOperator] = useState("contains")
  const [value, setValue] = useState("")

  const handleConfirm = () => {
    onConfirm({ columnKey, operator, value })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Filter</DialogTitle>
          <DialogDescription>
            Add a filter to the current view.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="filter-column" className="text-right text-sm">
              Column
            </label>
            <Select value={columnKey} onValueChange={setColumnKey}>
              <SelectTrigger className="col-span-3" id="filter-column">
                <SelectValue placeholder="Select a column" />
              </SelectTrigger>
              <SelectContent>
                {visibleColumns.map((column) => (
                  <SelectItem key={column.key} value={column.key}>
                    {column.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="filter-operator" className="text-right text-sm">
              Operator
            </label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="col-span-3" id="filter-operator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains (text)</SelectItem>
                <SelectItem value="=">Equals</SelectItem>
                <SelectItem value=">">Greater than (number)</SelectItem>
                <SelectItem value="<">Less than (number)</SelectItem>
                <SelectItem value=">=">&gt;= Greater or equal</SelectItem>
                <SelectItem value="<=">&lt;= Less or equal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="filter-value" className="text-right text-sm">
              Value
            </label>
            <Input
              id="filter-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="col-span-3"
              placeholder={
                operator.match(/[><=]/)
                  ? "Enter a number"
                  : "Enter filter value"
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleConfirm()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!columnKey.trim() || !value.trim()}
          >
            Add Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
