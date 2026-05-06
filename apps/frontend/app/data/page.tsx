"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { SidebarInset } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { Suspense } from "react"
import { Loader2, ChevronUp, ChevronDown } from "lucide-react"
import { useDataManagement } from "./hooks/use-data-management"
import { DataTableRow } from "@/components/data/table/data-table-row"
import { DeleteConfirmDialog } from "./components/dialogs/delete-confirm-dialog"
import { RenameColumnDialog } from "./components/dialogs/rename-column-dialog"
import { AddColumnDialog } from "./components/dialogs/add-column-dialog"
import { FilterDialog } from "./components/dialogs/filter-dialog"
import { ExportDialog } from "./components/dialogs/export-dialog"
import { SearchSection } from "./components/search-section"
import { ActiveFilters } from "./components/active-filters"
import { DataPagination } from "./components/data-pagination"
import { TableToolbar } from "./components/table-toolbar"
import { toEditableCellValue } from "./utils"

function DataPageContent() {
  const { state, actions } = useDataManagement()

  return (
    <>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <div className="flex min-h-svh w-full min-w-0 flex-col gap-6 overflow-x-hidden p-6">
          <div>
            <h1 className="text-xl font-semibold">Data</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse ingested records and schema metadata.
            </p>
          </div>

          <SearchSection
            initialValue={state.appliedSearchQuery}
            onSearch={actions.handleApplySearch}
            onClear={actions.handleClearSearch}
            isEditMode={state.isEditMode}
            isMutating={state.isMutating}
            isSearchMode={state.isSearchMode}
          />

          <ActiveFilters
            filters={state.filters}
            onRemove={actions.handleRemoveFilter}
            onClearAll={actions.handleClearAllFilters}
            onAddAnother={() => actions.setIsFilterDialogOpen(true)}
          />

          {state.filters.length === 0 && !state.isEditMode && state.totalCount > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.setIsFilterDialogOpen(true)}
              >
                + Add Filter
              </Button>
            </div>
          )}

          {state.isLoading && (
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">
              Loading records...
            </div>
          )}

          {!state.isLoading && state.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
              <p className="text-sm text-destructive">{state.error}</p>
              <Button className="mt-4" onClick={actions.fetchData} variant="outline">
                Retry
              </Button>
            </div>
          )}

          {!state.isLoading && !state.error && state.totalCount === 0 && !state.isSearchMode && (
            <div className="rounded-lg border p-6">
              <p className="text-sm text-muted-foreground">
                There is currently no data in the database.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/add">Add Data</Link>
              </Button>
            </div>
          )}

          {!state.isLoading && !state.error && (state.totalCount > 0 || state.isSearchMode) && (
            <TableToolbar
              isEditMode={state.isEditMode}
              isSelectionMode={state.isSelectionMode}
              isMutating={state.isMutating}
              hasPendingChanges={state.hasPendingChanges}
              selectedRowIds={state.selectedRowIds}
              onToggleSelectionMode={() => {
                actions.setIsSelectionMode(!state.isSelectionMode)
                if (state.isSelectionMode) {
                  actions.setSelectedRowIds(new Set())
                }
              }}
              onEnterEditMode={actions.enterEditMode}
              onExitEditMode={actions.exitEditMode}
              onSaveChanges={actions.handleSaveSpreadsheetChanges}
              onOpenColumnAddDialog={() => actions.openColumnAddDialog(null)}
              onOpenBulkDeleteDialog={actions.openBulkDeleteDialog}
            />
          )}

          {!state.isLoading && !state.error && (state.totalCount > 0 || state.isSearchMode) && (
            <div className="flex w-full min-w-0 flex-col gap-4">
              {state.isRefreshing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refreshing records...
                </div>
              )}

              {state.isSearchMode ? (
                <div className="text-sm text-muted-foreground">
                  {state.searchType === "keyword" ? "Keyword " : "Semantic "} search
                  for &quot;{state.appliedSearchQuery}&quot; returned {state.rows.length}{" "}
                  results.
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Showing {state.skip + 1}-{Math.min(state.skip + state.rows.length, state.totalCount)}{" "}
                  of {state.totalCount}
                </div>
              )}

              {!state.isSearchMode && (
                <DataPagination
                  currentPage={state.currentPage}
                  totalPages={state.totalPages}
                  pageSize={state.pageSize}
                  setPageSize={actions.setPageSize}
                  hasPrevious={state.hasPreviousPage}
                  hasNext={state.hasNextPage}
                  onPrevious={() => actions.setSkip(Math.max(state.skip - state.pageSize, 0))}
                  onNext={() => actions.setSkip(state.skip + state.pageSize)}
                  disabled={state.isMutating || state.isEditMode}
                  totalCount={state.totalCount}
                />
              )}

              <div className="w-full min-w-0 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {state.isSelectionMode && (
                        <TableHead className="w-[40px]">
                          <input
                            type="checkbox"
                            checked={state.isAllFilteredSelected}
                            onChange={actions.toggleSelectAll}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </TableHead>
                      )}
                      {state.allColumns.map((column) => (
                        <ContextMenu key={column.key}>
                          <ContextMenuTrigger asChild>
                            <TableHead
                              className={
                                column.key === "id"
                                  ? "w-20 cursor-pointer"
                                  : "cursor-pointer"
                              }
                              onClick={() => actions.handleSort(column.key)}
                            >
                              {column.label}
                              {state.sortColumn === column.key &&
                                (state.sortDirection === "asc" ? (
                                  <ChevronUp className="ml-1 inline h-4 w-4" />
                                ) : (
                                  <ChevronDown className="ml-1 inline h-4 w-4" />
                                ))}
                            </TableHead>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuLabel>{column.label}</ContextMenuLabel>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => actions.openColumnAddDialog(column)}
                              disabled={state.isEditMode || state.isMutating}
                            >
                              Add Column
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => actions.openColumnRenameDialog(column)}
                              disabled={state.isEditMode || state.isMutating}
                            >
                              Rename
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              onSelect={() => actions.openColumnDeleteDialog(column)}
                              disabled={state.isEditMode || state.isMutating}
                            >
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.filteredRows.map((row) => (
                      <DataTableRow
                        key={row.id}
                        row={row}
                        visibleColumns={state.visibleColumns}
                        isEditMode={state.isEditMode}
                        isMutating={state.isMutating}
                        isSelectionMode={state.isSelectionMode}
                        isSelected={state.selectedRowIds.has(row.id)}
                        onToggleSelection={actions.toggleRowSelection}
                        rowDraft={state.draftCells[row.id]}
                        toEditableCellValue={toEditableCellValue}
                        onUpdateDraftCell={actions.updateDraftCell}
                        onContextEditRow={actions.handleContextEditRow}
                        onOpenDeleteDialog={actions.openDeleteDialog}
                        onOpenBulkDeleteDialog={actions.openBulkDeleteDialog}
                        onOpenExportDialog={actions.openExportDialog}
                        isHighlighted={row.id === state.highlightId}
                      />
                    ))}
                    {state.filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={
                            state.allColumns.length + (state.isSelectionMode ? 1 : 0)
                          }
                          className="h-24 text-center text-muted-foreground"
                        >
                          {state.isSearchMode && state.rows.length === 0
                            ? "No results found for your search."
                            : state.filters.length > 0
                              ? "No records match the current filters."
                              : "No records to display."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {!state.isSearchMode && (
                <DataPagination
                  currentPage={state.currentPage}
                  totalPages={state.totalPages}
                  pageSize={state.pageSize}
                  setPageSize={actions.setPageSize}
                  hasPrevious={state.hasPreviousPage}
                  hasNext={state.hasNextPage}
                  onPrevious={() => actions.setSkip(Math.max(state.skip - state.pageSize, 0))}
                  onNext={() => actions.setSkip(state.skip + state.pageSize)}
                  disabled={state.isMutating || state.isEditMode}
                  totalCount={state.totalCount}
                />
              )}
            </div>
          )}

          {!state.isLoading && !state.error && state.totalCount > 0 && state.metadata.length === 0 && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900">
              Column metadata is empty. Columns are inferred from record keys.
            </div>
          )}

          <DeleteConfirmDialog
            isOpen={state.isDeleteDialogOpen}
            onOpenChange={actions.setIsDeleteDialogOpen}
            title="Delete Record"
            description={`This will permanently delete record #${state.recordPendingDelete?.id} from SQLite and Chroma.`}
            onConfirm={actions.handleConfirmDelete}
            isMutating={state.isMutating}
          />

          <DeleteConfirmDialog
            isOpen={state.isColumnDeleteDialogOpen}
            onOpenChange={actions.setIsColumnDeleteDialogOpen}
            title="Delete Column"
            description={`This will permanently delete the "${state.columnPendingDelete?.label}" column from all records and metadata. This action cannot be undone.`}
            onConfirm={actions.handleConfirmColumnDelete}
            isMutating={state.isMutating}
          />

          <RenameColumnDialog
            isOpen={state.isColumnRenameDialogOpen}
            onOpenChange={actions.setIsColumnRenameDialogOpen}
            columnPendingRename={state.columnPendingRename}
            isMutating={state.isMutating}
            onConfirm={actions.handleConfirmColumnRename}
          />

          <AddColumnDialog
            isOpen={state.isColumnAddDialogOpen}
            onOpenChange={actions.setIsColumnAddDialogOpen}
            columnPendingAdd={state.columnPendingAdd}
            visibleColumns={state.visibleColumns}
            isMutating={state.isMutating}
            onConfirm={actions.handleConfirmColumnAdd}
          />

          <ExportDialog
            isOpen={state.isExportDialogOpen}
            onOpenChange={actions.setIsExportDialogOpen}
            format={state.exportFormat}
            onFormatChange={actions.setExportFormat}
            onExport={actions.handleExportData}
            isExporting={state.isExporting}
          />

          <DeleteConfirmDialog
            isOpen={state.isBulkDeleteDialogOpen}
            onOpenChange={actions.setIsBulkDeleteDialogOpen}
            title="Bulk Delete Records"
            description={`Are you sure you want to delete ${state.selectedRowIds.size} selected records? This action cannot be undone.`}
            onConfirm={actions.handleConfirmBulkDelete}
            isMutating={state.isMutating}
          />

          <FilterDialog
            isOpen={state.isFilterDialogOpen}
            onOpenChange={actions.setIsFilterDialogOpen}
            visibleColumns={state.visibleColumns}
            onConfirm={actions.handleAddFilter}
          />
        </div>
      </SidebarInset>
    </>
  )
}

export default function DataPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <DataPageContent />
    </Suspense>
  )
}
