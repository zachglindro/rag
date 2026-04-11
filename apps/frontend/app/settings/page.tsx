"use client"

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
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Loader2, Check } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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

export default function Settings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [selectedModelToSwitch, setSelectedModelToSwitch] = useState<string>("")
  const [activeModel, setActiveModel] = useState<string>("")
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchSuccess, setSwitchSuccess] = useState(false)
  const [enableDebugging, setEnableDebugging] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("enableDebugging") === "true"
    }
    return false
  })
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv")
  const [isExporting, setIsExporting] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  const fetchModelSettings = async () => {
    try {
      const response = await fetch("http://localhost:8000/settings/model")
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
      const response = await fetch("http://localhost:8000/settings/model", {
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

  const handleReset = async () => {
    try {
      const response = await fetch("http://localhost:8000/reset-database", {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error("Reset failed")
      }
      toast.success("Database and embeddings reset successfully")
      setIsDialogOpen(false)
    } catch {
      toast.error("Failed to reset database")
    }
  }

  const handleToggleDebugging = (checked: boolean) => {
    setEnableDebugging(checked)
    localStorage.setItem("enableDebugging", checked ? "true" : "false")
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const response = await fetch(
        `http://localhost:8000/export-data?format=${exportFormat}`
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
          <div className="space-y-6">
            <div>
              <h1>Settings</h1>
            </div>

            <div>
              <h2>Model Settings</h2>
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
                {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
                {switchSuccess && <Check className="h-4 w-4 text-green-500" />}
              </div>

              <Dialog
                open={isConfirmDialogOpen}
                onOpenChange={setIsConfirmDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Switch to Online Model</DialogTitle>
                    <DialogDescription>
                      This will send your data to an online model. Are you sure
                      you want to proceed?
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

            <div>
              <h2>Database</h2>
              <div className="mt-4">
                <Button onClick={() => setIsExportDialogOpen(true)}>
                  Export Database
                </Button>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">Reset Database</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset Database</DialogTitle>
                    <DialogDescription>
                      This will permanently delete all data in the database and
                      associated vector embeddings. This action cannot be
                      undone.
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
                    <Button onClick={handleExportData} disabled={isExporting}>
                      {isExporting ? "Exporting..." : "Export"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between text-left">
                  <span className="text-sm text-muted-foreground">
                    {isAdvancedOpen ? "Hide" : "Show"} developer options
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="enable-debugging"
                    checked={enableDebugging}
                    onCheckedChange={handleToggleDebugging}
                  />
                  <label htmlFor="enable-debugging" className="text-sm">
                    Enable Debugging
                  </label>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
