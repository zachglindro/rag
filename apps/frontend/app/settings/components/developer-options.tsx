"use client"

import { useState } from "react"
import { Check, ChevronDown, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { useModelSettings } from "../hooks/use-model-settings"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"

export function DeveloperOptions() {
  const [isOpen, setIsOpen] = useState(false)
  const [enableDebugging, setEnableDebugging] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("enableDebugging") === "true"
  })

  const {
    activeModel,
    availableModels,
    isSwitching,
    switchSuccess,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    handleModelSelection,
    handleConfirmSwitch,
    isDownloadingQwen,
    qwenDownloaded,
    isCancellingQwen,
    downloadProgress,
    downloadMessage,
    handleDownloadQwen,
    handleCancelDownloadQwen,
  } = useModelSettings()

  const handleToggleDebugging = (checked: boolean) => {
    setEnableDebugging(checked)
    localStorage.setItem("enableDebugging", checked ? "true" : "false")
    toast.success(checked ? "Debugging enabled" : "Debugging disabled")
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
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
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
              <Label htmlFor="enable-debugging" className="text-sm font-medium">
                Enable Debugging
              </Label>
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

            <div className="mt-6 space-y-3 border-t pt-4">
              <div>
                <h4 className="mb-2 text-sm font-medium">Download Models</h4>
                <p className="mb-3 text-sm text-muted-foreground">
                  Download the Qwen 3 (0.6B) model for local processing.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleDownloadQwen}
                      disabled={isDownloadingQwen || qwenDownloaded}
                      variant={qwenDownloaded ? "outline" : "default"}
                    >
                      {isDownloadingQwen ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Downloading...
                        </>
                      ) : qwenDownloaded ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Downloaded
                        </>
                      ) : (
                        "Download Qwen 3"
                      )}
                    </Button>

                    {isDownloadingQwen && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCancelDownloadQwen}
                        disabled={isCancellingQwen}
                        title="Cancel download"
                      >
                        {isCancellingQwen ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  {isDownloadingQwen && (
                    <div className="w-full max-w-sm space-y-2">
                      <Progress value={downloadProgress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{downloadMessage}</span>
                        <span>{downloadProgress}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
