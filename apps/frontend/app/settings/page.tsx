"use client"

import { useTheme } from "next-themes"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Loader2, Check, Grip, ChevronDown } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useSidebarSettings } from "@/contexts/sidebar-context"
import { Reorder } from "framer-motion"
import { Input } from "@/components/ui/input"
import { BACKEND_URL } from "@/app/data/types"

interface ModelInfo {
  id: string
  label: string
  path: string
  source: "local" | "online"
  loaded: boolean
}

interface ModelSettingsResponse {
  active_model: string
  available_models: ModelInfo[]
}

interface BackupSettings {
  enabled: boolean
  subfolder: string
  frequency: string
  retention: number
  format: string
  base_path: string
  last_backup_time: number | null
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { sidebarOrder: sidebarItems, setSidebarOrder: setSidebarItems } =
    useSidebarSettings()
  const [mounted, setMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [selectedModelToSwitch, setSelectedModelToSwitch] = useState<string>("")
  const [activeModel, setActiveModel] = useState<string>("")
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchSuccess, setSwitchSuccess] = useState(false)
  const [enableDebugging, setEnableDebugging] = useState(false)
  const [searchType, setSearchType] = useState<"semantic" | "keyword">(
    "semantic"
  )

  const [isThemeOpen, setIsThemeOpen] = useState(true)
  const [isBackupsOpen, setIsBackupsOpen] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(true)

  useEffect(() => {
    setMounted(true)
    const storedDebugging = localStorage.getItem("enableDebugging") === "true"
    const storedSearchType = localStorage.getItem("searchType") as
      | "semantic"
      | "keyword"

    if (storedDebugging) setEnableDebugging(true)
    if (storedSearchType) setSearchType(storedSearchType)
  }, [])

  const toggleSidebarItem = (title: string) => {
    setSidebarItems(
      sidebarItems.map((item) =>
        item.title === title ? { ...item, enabled: !item.enabled } : item
      )
    )
  }

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv")
  const [isExporting, setIsExporting] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  const fetchModelSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/settings/model`)
      if (!response.ok) throw new Error("Failed to fetch model settings")
      const data: ModelSettingsResponse = await response.json()
      setActiveModel(data.active_model)
      setAvailableModels(data.available_models)
    } catch {
      toast.error("Failed to load model settings")
    }
  }

  useEffect(() => {
    fetchModelSettings()
    fetchBackupSettings()
  }, [])

  const handleModelSelection = (modelId: string) => {
    const model = availableModels.find((m) => m.id === modelId)
    if (model?.source === "online") {
      setSelectedModelToSwitch(modelId)
      setIsConfirmDialogOpen(true)
    } else {
      handleSwitchModel(modelId)
    }
  }

  const handleConfirmSwitch = () => {
    handleSwitchModel(selectedModelToSwitch)
    setIsConfirmDialogOpen(false)
    setSelectedModelToSwitch("")
  }

  const handleSwitchModel = async (modelId: string) => {
    setIsSwitching(true)
    setSwitchSuccess(false) // Reset success state
    try {
      const response = await fetch(`${BACKEND_URL}/settings/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: modelId }),
      })
      if (!response.ok) throw new Error("Failed to switch model")
      setActiveModel(modelId)
      setSwitchSuccess(true)
      const model = availableModels.find((m) => m.id === modelId)
      toast.success(`Switched to ${model?.label || modelId}`)
      // Clear success indicator after 3 seconds
      setTimeout(() => setSwitchSuccess(false), 3000)
    } catch {
      toast.error("Failed to switch model")
    } finally {
      setIsSwitching(false)
    }
  }

  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(
    null
  )
  const [originalBackupSettings, setOriginalBackupSettings] =
    useState<BackupSettings | null>(null)
  const [isSavingBackup, setIsSavingBackup] = useState(false)
  const [isBackingUpNow, setIsBackingUpNow] = useState(false)

  const fetchBackupSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/settings/backup`)
      if (!response.ok) throw new Error("Failed to fetch backup settings")
      const data: BackupSettings = await response.json()
      setBackupSettings(data)
      setOriginalBackupSettings(data)
    } catch {
      toast.error("Failed to load backup settings")
    }
  }

  const handleSaveBackupSettings = async () => {
    if (!backupSettings) return
    setIsSavingBackup(true)
    try {
      const response = await fetch(`${BACKEND_URL}/settings/backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupSettings),
      })
      if (!response.ok) throw new Error("Failed to save backup settings")
      toast.success("Backup settings saved")
      setOriginalBackupSettings(backupSettings)
    } catch {
      toast.error("Failed to save backup settings")
    } finally {
      setIsSavingBackup(false)
    }
  }

  const hasBackupChanges =
    backupSettings &&
    originalBackupSettings &&
    JSON.stringify(backupSettings) !== JSON.stringify(originalBackupSettings)

  const handleManualBackup = async () => {
    setIsBackingUpNow(true)
    try {
      const response = await fetch(
        `${BACKEND_URL}/settings/backup/now`,
        {
          method: "POST",
        }
      )
      if (!response.ok) throw new Error("Backup failed")
      toast.success("Backup created successfully")
      fetchBackupSettings() // Refresh last backup time
    } catch {
      toast.error("Failed to create backup")
    } finally {
      setIsBackingUpNow(false)
    }
  }

  const handleReset = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/reset-database`, {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error("Reset failed")
      }
      toast.success("Database reset successfully")
      setIsDialogOpen(false)
    } catch {
      toast.error("Failed to reset database")
    }
  }

  const handleToggleDebugging = (checked: boolean) => {
    setEnableDebugging(checked)
    localStorage.setItem("enableDebugging", checked ? "true" : "false")
  }

  const handleSearchTypeChange = (value: "semantic" | "keyword") => {
    setSearchType(value)
    localStorage.setItem("searchType", value)
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const response = await fetch(
        `${BACKEND_URL}/export-data?format=${exportFormat}`
      )
      if (!response.ok) {
        throw new Error("Export failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `export_data.${exportFormat}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success(`Exported data as ${exportFormat.toUpperCase()}`)
      setIsExportDialogOpen(false)
    } catch {
      toast.error("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh p-6">
          <div className="w-full max-w-3xl space-y-6">
            <div>
              <h1>Settings</h1>
            </div>

            <Collapsible open={isThemeOpen} onOpenChange={setIsThemeOpen}>
              <CollapsibleTrigger asChild>
                <button className="group flex w-full items-center justify-between py-2 text-left">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Theme
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Choose the appearance of the application.
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isThemeOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 animate-in fade-in-0 slide-in-from-top-2">
                <div className="pl-1">
                  {mounted ? (
                    <Select
                      value={theme}
                      onValueChange={(value) => setTheme(value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 w-[180px] animate-pulse rounded bg-muted" />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="h-px bg-border" />

            <Collapsible open={isBackupsOpen} onOpenChange={setIsBackupsOpen}>
              <CollapsibleTrigger asChild>
                <button className="group flex w-full items-center justify-between py-2 text-left">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Database Backups
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Configure automatic database backups stored in your
                      Documents.
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isBackupsOpen ? "rotate-180" : ""}`}
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
                        <Label
                          htmlFor="backup-enabled"
                          className="cursor-pointer"
                        >
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
                            <Label htmlFor="subfolder">
                              Backup Subfolder Name
                            </Label>
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
                                  <SelectItem value="monthly">
                                    Monthly
                                  </SelectItem>
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

            <div className="h-px bg-border" />

            <Collapsible open={isSearchOpen} onOpenChange={setIsSearchOpen}>
              <CollapsibleTrigger asChild>
                <button className="group flex w-full items-center justify-between py-2 text-left">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Search Settings
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Choose the search method for chat and data pages.
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isSearchOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 animate-in fade-in-0 slide-in-from-top-2">
                <div className="pl-1">
                  <RadioGroup
                    value={searchType}
                    onValueChange={(value) =>
                      handleSearchTypeChange(value as "semantic" | "keyword")
                    }
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="semantic" id="semantic" />
                      <Label htmlFor="semantic" className="cursor-pointer">
                        Semantic Search
                        <p className="text-xs font-normal text-muted-foreground">
                          Uses AI to find records based on meaning. Best for
                          natural language questions.
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="keyword" id="keyword" />
                      <Label htmlFor="keyword" className="cursor-pointer">
                        Keyword Search
                        <p className="text-xs font-normal text-muted-foreground">
                          Matches exact words and phrases. Best for finding
                          specific identifiers or terms.
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="h-px bg-border" />

            <Collapsible open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <CollapsibleTrigger asChild>
                <button className="group flex w-full items-center justify-between py-2 text-left">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Sidebar Navigation
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Reorder or hide items in the sidebar.
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isSidebarOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 animate-in fade-in-0 slide-in-from-top-2">
                <div className="space-y-2 pl-1">
                  {mounted ? (
                    <Reorder.Group
                      axis="y"
                      values={sidebarItems}
                      onReorder={setSidebarItems}
                      className="w-full max-w-sm space-y-2"
                    >
                      {sidebarItems.map((item) => (
                        <Reorder.Item
                          key={item.title}
                          value={item}
                          className="flex cursor-grab items-center gap-2 rounded-md border bg-background p-2 active:cursor-grabbing"
                        >
                          <Switch
                            checked={item.enabled}
                            onCheckedChange={() =>
                              toggleSidebarItem(item.title)
                            }
                          />
                          <span
                            className={`text-sm ${!item.enabled ? "text-muted-foreground" : ""}`}
                          >
                            {item.title}
                          </span>
                          <Grip className="ml-auto h-4 w-4 text-muted-foreground" />
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  ) : (
                    <div className="h-20 animate-pulse rounded bg-muted"></div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="h-px bg-border" />

            <Collapsible open={isDatabaseOpen} onOpenChange={setIsDatabaseOpen}>
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
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isDatabaseOpen ? "rotate-180" : ""}`}
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
                      Export your database data in CSV or XLSX format for backup
                      or analysis.
                    </p>
                  </div>

                  <div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive">Reset Database</Button>
                      </DialogTrigger>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Permanently delete all data in the database.
                      </p>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reset Database</DialogTitle>
                          <DialogDescription>
                            This will permanently delete all data in the
                            database. This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button variant="destructive" onClick={handleReset}>
                            Reset
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
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="xlsx">XLSX</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleExportData}
                          disabled={isExporting}
                        >
                          {isExporting ? "Exporting..." : "Export"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="h-px bg-border" />

            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <button className="group flex w-full items-center justify-between py-2 text-left">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Developer Options
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Advanced settings for model selection and debugging.
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isAdvancedOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 animate-in space-y-6 fade-in-0 slide-in-from-top-2">
                <div className="space-y-6 pl-1">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="enable-debugging"
                        checked={enableDebugging}
                        onCheckedChange={handleToggleDebugging}
                      />
                      <label
                        htmlFor="enable-debugging"
                        className="text-sm font-medium"
                      >
                        Enable Debugging
                      </label>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium">Model Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose the active language model for chat generation.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <Select
                        value={activeModel}
                        onValueChange={handleModelSelection}
                        disabled={isSwitching}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex w-full items-center justify-between gap-2">
                                <span>{model.label}</span>
                                {model.source === "online" && (
                                  <span className="text-xs font-medium text-amber-600">
                                    Online
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isSwitching && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {switchSuccess && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>

                    <Dialog
                      open={isConfirmDialogOpen}
                      onOpenChange={setIsConfirmDialogOpen}
                    >
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Switch to Online Model</DialogTitle>
                          <DialogDescription>
                            This will send your data to an online model. Are you
                            sure you want to proceed?
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsConfirmDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleConfirmSwitch}>Confirm</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
