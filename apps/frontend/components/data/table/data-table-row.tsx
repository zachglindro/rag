import { memo, useRef, useEffect, useMemo } from "react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  RecordRow,
  VisibleColumn,
  stringifyValue,
} from "../../../app/data/types"
import { EditableCell } from "./editable-cell"

interface DataTableRowProps {
  row: RecordRow
  visibleColumns: VisibleColumn[]
  isEditMode: boolean
  isMutating: boolean
  isSelectionMode: boolean
  isSelected: boolean
  onToggleSelection: (rowId: number) => void
  rowDraft: Record<string, string> | undefined
  toEditableCellValue: (value: unknown) => string
  onUpdateDraftCell: (rowId: number, columnKey: string, value: string) => void
  onContextEditRow: (row: RecordRow) => void
  onOpenDeleteDialog: (row: RecordRow) => void
  onOpenBulkDeleteDialog: () => void
  onOpenExportDialog: (scope: "all" | "selected") => void
  isHighlighted?: boolean
}

export const DataTableRow = memo(function DataTableRow({
  row,
  visibleColumns,
  isEditMode,
  isMutating,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  rowDraft,
  toEditableCellValue,
  onUpdateDraftCell,
  onContextEditRow,
  onOpenDeleteDialog,
  onOpenBulkDeleteDialog,
  onOpenExportDialog,
  isHighlighted,
}: DataTableRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [isHighlighted])

  const showBulkMenu = isSelectionMode && isSelected

  const timestampInfo = useMemo(() => {
    if (!row.created_at) return null
    const createdDate = new Date(row.created_at)
    const updatedDate = row.updated_at ? new Date(row.updated_at) : createdDate

    const isUpdated = updatedDate.getTime() > createdDate.getTime()
    const targetDate = isUpdated ? updatedDate : createdDate
    const prefix = isUpdated ? "Updated" : "Created"
    const user = isUpdated ? row.updated_by : row.created_by

    return {
      label: `${prefix}: ${targetDate.toLocaleDateString()}${user ? ` by ${user}` : ""}`,
      full: `${prefix}: ${targetDate.toLocaleString()}${user ? ` by ${user}` : ""}`,
    }
  }, [row.created_at, row.updated_at, row.created_by, row.updated_by])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          ref={rowRef}
          className={cn(
            isHighlighted
              ? "bg-primary/10 transition-colors duration-1000"
              : "",
            isSelected ? "bg-muted" : ""
          )}
          data-state={isSelected ? "selected" : undefined}
        >
          {isSelectionMode && (
            <TableCell className="w-[40px]">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelection(row.id)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                disabled={isMutating}
              />
            </TableCell>
          )}

          {visibleColumns.map((column, index) => {
            const originalValue = toEditableCellValue(row.data?.[column.key])
            const draftValue = rowDraft?.[column.key]
            const cellValue = draftValue ?? originalValue
            const changed =
              draftValue !== undefined && draftValue !== originalValue

            if (isEditMode) {
              return (
                <EditableCell
                  key={`${row.id}-${column.key}`}
                  rowId={row.id}
                  columnKey={column.key}
                  initialValue={cellValue}
                  onUpdateDraftCell={onUpdateDraftCell}
                  isMutating={isMutating}
                  changed={changed}
                  isFirstColumn={index === 0}
                />
              )
            }

            return (
              <TableCell key={`${row.id}-${column.key}`} className={cn(index === 0 && "sticky left-0 z-10 bg-background border-r shadow-[inset_-2px_0_0_0_rgba(255,255,255,0.8)] dark:shadow-[inset_-2px_0_0_0_rgba(108,117,125,0.5)]")}>
                <div className="max-w-[400px] break-words whitespace-normal">
                  {stringifyValue(row.data?.[column.key])}
                </div>
              </TableCell>
            )
          })}
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {showBulkMenu ? (
          <>
            <ContextMenuLabel>Bulk Actions</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onOpenExportDialog("selected")}
              disabled={isMutating}
            >
              Export Selected
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onSelect={onOpenBulkDeleteDialog}
              disabled={isMutating}
            >
              Delete Selected
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuLabel>Row {row.id}</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onContextEditRow(row)}
              disabled={isMutating}
            >
              Edit
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onSelect={() => onOpenDeleteDialog(row)}
              disabled={isMutating}
            >
              Delete
            </ContextMenuItem>
            {timestampInfo && (
              <>
                <ContextMenuSeparator />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ContextMenuLabel className="cursor-default text-xs font-normal text-muted-foreground">
                        {timestampInfo.label}
                      </ContextMenuLabel>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{timestampInfo.full}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
})
