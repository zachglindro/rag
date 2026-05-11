// frontend/app/data/components/table-toolbar.tsx
import { Button } from "@/components/ui/button"

interface TableToolbarProps {
  isEditMode: boolean
  isSelectionMode: boolean
  isMutating: boolean
  hasPendingChanges: boolean
  selectedRowIds: Set<number>
  pinnedColumnsCount: number
  onToggleSelectionMode: () => void
  onEnterEditMode: () => void
  onExitEditMode: () => void
  onSaveChanges: () => void
  onOpenColumnAddDialog: () => void
  onOpenBulkDeleteDialog: () => void
  onExportSelected: () => void
  onPinnedColumnsChange: (count: number) => void
}

export function TableToolbar({
  isEditMode,
  isSelectionMode,
  isMutating,
  hasPendingChanges,
  selectedRowIds,
  pinnedColumnsCount,
  onToggleSelectionMode,
  onEnterEditMode,
  onExitEditMode,
  onSaveChanges,
  onOpenColumnAddDialog,
  onOpenBulkDeleteDialog,
  onExportSelected,
  onPinnedColumnsChange,
}: TableToolbarProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!isEditMode && (
          <>
            <Button
              variant={isSelectionMode ? "secondary" : "outline"}
              onClick={onToggleSelectionMode}
              disabled={isMutating}
            >
              {isSelectionMode ? "Cancel Selection" : "Select"}
            </Button>
            {isSelectionMode && selectedRowIds.size > 0 && (
              <>
                <Button
                  onClick={onExportSelected}
                  disabled={isMutating}
                >
                  Export Selected ({selectedRowIds.size})
                </Button>
                <Button
                  variant="destructive"
                  onClick={onOpenBulkDeleteDialog}
                  disabled={isMutating}
                >
                  Delete Selected ({selectedRowIds.size})
                </Button>
              </>
            )}
            <Button onClick={onEnterEditMode} disabled={isMutating}>
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={onOpenColumnAddDialog}
              disabled={isMutating}
            >
              Add Column
            </Button>
            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
              <label htmlFor="pinned-columns" className="text-sm text-muted-foreground">
                Pin columns:
              </label>
              <input
                id="pinned-columns"
                type="number"
                min="0"
                max="20"
                value={pinnedColumnsCount}
                onChange={(e) => onPinnedColumnsChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                disabled={isMutating}
                className="w-12 h-8 px-2 py-1 border rounded text-sm"
              />
            </div>
          </>
        )}
        {isEditMode && (
          <>
            <Button
              onClick={onSaveChanges}
              disabled={!hasPendingChanges || isMutating}
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={onExitEditMode}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <p className="text-sm text-muted-foreground">
              Edit mode is active. Right-click a row for row actions.
            </p>
          </>
        )}
      </div>
    </div>
  )
}