"use client"

import { ChevronDown, Loader2 } from "lucide-react"
import { useState } from "react"
import { useBackupSettings } from "../hooks/use-backup-settings"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export function BackupSettingsPanel() {
  const [isOpen, setIsOpen] = useState(true)
  const {
    backupSettings,
    setBackupSettings,
    isSavingBackup,
    isBackingUpNow,
    hasBackupChanges,
    handleSaveBackupSettings,
    handleManualBackup,
  } = useBackupSettings()

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="group flex w-full items-center justify-between py-2 text-left">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Database Backups
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure automatic database backups stored in your Documents.
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 animate-in fade-in-0 slide-in-from-top-2">
        <div className="pl-1">
          {backupSettings ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="backup-enabled"
                  checked={backupSettings.enabled}
                  onCheckedChange={(checked) =>
                    setBackupSettings({
                      ...backupSettings,
                      enabled: checked,
                    })
                  }
                />
                <Label htmlFor="backup-enabled" className="cursor-pointer">
                  Enable Database Backups
                </Label>
              </div>

              {backupSettings.enabled && (
                <div className="max-w-md animate-in space-y-4 duration-300 fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="base-path">
                      Base Directory (Read-only)
                    </Label>
                    <Input
                      id="base-path"
                      value={backupSettings.base_path}
                      readOnly
                      className="bg-muted text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subfolder">Backup Subfolder Name</Label>
                    <Input
                      id="subfolder"
                      value={backupSettings.subfolder}
                      onChange={(e) =>
                        setBackupSettings({
                          ...backupSettings,
                          subfolder: e.target.value,
                        })
                      }
                      placeholder="e.g. my_backups"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="frequency">Frequency</Label>
                      <Select
                        value={backupSettings.frequency}
                        onValueChange={(value) =>
                          setBackupSettings({
                            ...backupSettings,
                            frequency: value,
                          })
                        }
                      >
                        <SelectTrigger id="frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="format">Format</Label>
                      <Select
                        value={backupSettings.format}
                        onValueChange={(value) =>
                          setBackupSettings({
                            ...backupSettings,
                            format: value,
                          })
                        }
                      >
                        <SelectTrigger id="format">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="xlsx">XLSX</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retention">Backups to Keep</Label>
                      <Input
                        id="retention"
                        type="number"
                        min={1}
                        max={100}
                        value={backupSettings.retention}
                        onChange={(e) =>
                          setBackupSettings({
                            ...backupSettings,
                            retention: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <Label>Last Backup</Label>
                      <p className="text-xs text-muted-foreground">
                        {backupSettings.last_backup_time
                          ? new Date(
                              backupSettings.last_backup_time * 1000
                            ).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualBackup}
                      disabled={isBackingUpNow}
                    >
                      {isBackingUpNow ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Backing up...
                        </>
                      ) : (
                        "Backup Now"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {hasBackupChanges && (
                <Button
                  onClick={handleSaveBackupSettings}
                  disabled={isSavingBackup}
                  className="w-full max-w-md animate-in duration-200 zoom-in-95 fade-in"
                >
                  {isSavingBackup ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Backup Settings"
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="h-40 animate-pulse rounded-md bg-muted" />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
