"use client"

import { useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { useDatabaseMaintenance } from "../hooks/use-database-maintenance"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function DatabaseMaintenance() {
  const [isOpen, setIsOpen] = useState(true)
  const {
    isResetDialogOpen,
    setIsResetDialogOpen,
    isResetHistoryDialogOpen,
    setIsResetHistoryDialogOpen,
    isExportDialogOpen,
    setIsExportDialogOpen,
    isResettingDatabase,
    resetProgress,
    resetMessage,
    isResettingHistory,
    isExporting,
    exportFormat,
    setExportFormat,
    handleReset,
    handleResetHistory,
    handleExportData,
  } = useDatabaseMaintenance()

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="group flex w-full items-center justify-between py-2 text-left">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Database Settings
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage database maintenance, export and reset.
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 animate-in fade-in-0 slide-in-from-top-2">
        <div className="space-y-6 pl-1">
          <div>
            <Button onClick={() => setIsExportDialogOpen(true)}>
              Export Database
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">
              Export your database data in CSV or XLSX format for backup or
              analysis.
            </p>
          </div>

          <div>
            <Button
              variant="destructive"
              onClick={() => setIsResetDialogOpen(true)}
            >
              Reset Database
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">
              Permanently delete all data in the database.
            </p>

            <Dialog
              open={isResetDialogOpen}
              onOpenChange={(open) => {
                if (isResettingDatabase && !open) return
                setIsResetDialogOpen(open)
              }}
            >
              <DialogContent
                onInteractOutside={(e) => {
                  if (isResettingDatabase) e.preventDefault()
                }}
                onEscapeKeyDown={(e) => {
                  if (isResettingDatabase) e.preventDefault()
                }}
              >
                <DialogHeader>
                  <DialogTitle>Reset Database</DialogTitle>
                  <DialogDescription>
                    This will permanently delete all data in the database. This
                    action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsResetDialogOpen(false)}
                    disabled={isResettingDatabase}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReset}
                    disabled={isResettingDatabase}
                  >
                    {isResettingDatabase ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset"
                    )}
                  </Button>
                </DialogFooter>
                {isResettingDatabase && (
                  <div className="space-y-2 pt-2">
                    <Progress value={resetProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{resetMessage}</span>
                      <span>{resetProgress}%</span>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <div>
            <Button
              variant="outline"
              onClick={() => setIsResetHistoryDialogOpen(true)}
            >
              Reset History Log
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">
              Clear all entries from the history log.
            </p>

            <Dialog
              open={isResetHistoryDialogOpen}
              onOpenChange={setIsResetHistoryDialogOpen}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset History Log</DialogTitle>
                  <DialogDescription>
                    This will permanently delete all history entries. This
                    action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsResetHistoryDialogOpen(false)}
                    disabled={isResettingHistory}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetHistory}
                    disabled={isResettingHistory}
                  >
                    {isResettingHistory ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Dialog
            open={isExportDialogOpen}
            onOpenChange={setIsExportDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Database</DialogTitle>
                <DialogDescription>
                  Select the export format and download the data.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={exportFormat}
                  onValueChange={(value: "csv" | "xlsx") =>
                    setExportFormat(value)
                  }
                  disabled={isExporting}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select export format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">XLSX</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleExportData} disabled={isExporting}>
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
