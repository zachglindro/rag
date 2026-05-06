import { memo, useState, useCallback } from "react"
import { TableCell } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export const EditableCell = memo(function EditableCell({
  rowId,
  columnKey,
  initialValue,
  onUpdateDraftCell,
  isMutating,
  changed,
  isFirstColumn = false,
}: {
  rowId: number
  columnKey: string
  initialValue: string
  onUpdateDraftCell: (rowId: number, columnKey: string, value: string) => void
  isMutating: boolean
  changed: boolean
  isFirstColumn?: boolean
}) {
  const [value, setValue] = useState(initialValue)

  const handleCommit = useCallback(() => {
    onUpdateDraftCell(rowId, columnKey, value)
  }, [rowId, columnKey, value, onUpdateDraftCell])

  return (
    <TableCell className={cn(isFirstColumn && "sticky left-0 z-10 bg-background border-r shadow-[inset_-2px_0_0_0_rgba(255,255,255,0.8)] dark:shadow-[inset_-2px_0_0_0_rgba(108,117,125,0.5)]")}>
      <div className="w-[300px]">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={handleCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              handleCommit()
            }
          }}
          className={cn(
            "min-h-[40px] resize-none",
            changed ? "border-amber-500" : ""
          )}
          disabled={isMutating}
        />
      </div>
    </TableCell>
  )
})
