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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { Loader2, Check, Grip } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useSidebarSettings } from "@/contexts/sidebar-context"
import { Reorder } from "framer-motion"

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
  const [enableDebugging, setEnableDebugging] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("enableDebugging") === "true"
    }
    return false
  })
  const [searchType, setSearchType] = useState<"semantic" | "keyword">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("searchType") as "semantic" | "keyword") ||
        "semantic"
      )
    }
    return "semantic"
  })

  useEffect(() => {
    setMounted(true)
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

  const handleSearchTypeChange = (value: "semantic" | "keyword") => {
    setSearchType(value)
    localStorage.setItem("searchType", value)
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
              <h2>Search Settings</h2>
              <p className="text-sm text-muted-foreground">
                Choose the search method for chat and data pages.
              </p>
              <div className="mt-4">
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
            </div>

            <div>
              <h2>Sidebar Navigation</h2>
              <p className="text-sm text-muted-foreground">
                Reorder or hide items in the sidebar.
              </p>
              <div className="mt-4 space-y-2">
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
                          onCheckedChange={() => toggleSidebarItem(item.title)}
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
            </div>

            <div>
              <h2>Database</h2>
              <div className="mt-4">
                <Button onClick={() => setIsExportDialogOpen(true)}>
                  Export Database
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  Export your database data in CSV or XLSX format for backup or
                  analysis.
                </p>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="mt-4">
                    Reset Database
                  </Button>
                </DialogTrigger>
                <p className="mt-2 text-sm text-muted-foreground">
                  Permanently delete all data in the database.
                </p>
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
