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
}: {
  rowId: number
  columnKey: string
  initialValue: string
  onUpdateDraftCell: (rowId: number, columnKey: string, value: string) => void
  isMutating: boolean
  changed: boolean
}) {
  const [value, setValue] = useState(initialValue)

  const handleCommit = useCallback(() => {
    onUpdateDraftCell(rowId, columnKey, value)
  }, [rowId, columnKey, value, onUpdateDraftCell])

  return (
    <TableCell>
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
