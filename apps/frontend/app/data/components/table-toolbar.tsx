// frontend/app/data/components/table-toolbar.tsx
import { Button } from "@/components/ui/button"

interface TableToolbarProps {
  isEditMode: boolean
  isSelectionMode: boolean
  isMutating: boolean
  hasPendingChanges: boolean
  selectedRowIds: Set<number>
  onToggleSelectionMode: () => void
  onEnterEditMode: () => void
  onExitEditMode: () => void
  onSaveChanges: () => void
  onOpenColumnAddDialog: () => void
  onOpenBulkDeleteDialog: () => void
}

export function TableToolbar({
  isEditMode,
  isSelectionMode,
  isMutating,
  hasPendingChanges,
  selectedRowIds,
  onToggleSelectionMode,
  onEnterEditMode,
  onExitEditMode,
  onSaveChanges,
  onOpenColumnAddDialog,
  onOpenBulkDeleteDialog,
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
              <Button
                variant="destructive"
                onClick={onOpenBulkDeleteDialog}
                disabled={isMutating}
              >
                Delete Selected ({selectedRowIds.size})
              </Button>
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