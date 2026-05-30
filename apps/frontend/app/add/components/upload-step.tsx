"use client"

import { useRef, useState, DragEvent, ChangeEvent } from "react"
import { Database, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { BACKEND_URL } from "@/app/data/types"

interface UploadStepProps {
  onFileSelect: (file: File) => void
  onNext: () => void
  selectedFile: File | null
  onColumnsSet: (columns: string[], rows: Record<string, unknown>[]) => void
  sheetNames: string[]
  selectedSheet: string
  hasLoadedFile: boolean
  onSheetNamesChange: (sheetNames: string[]) => void
  onSelectedSheetChange: (sheetName: string) => void
  onHasLoadedFileChange: (hasLoadedFile: boolean) => void
}

interface UploadResponse {
  columns: string[]
  rows: Record<string, unknown>[]
  sheet_names?: string[]
  selected_sheet?: string | null
}

export function UploadStep({
  onFileSelect,
  onNext,
  selectedFile,
  onColumnsSet,
  sheetNames,
  selectedSheet,
  hasLoadedFile,
  onSheetNamesChange,
  onSelectedSheetChange,
  onHasLoadedFileChange,
}: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      validateAndSelectFile(files[0])
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      validateAndSelectFile(files[0])
    }
  }

  const validateAndSelectFile = (file: File) => {
    const validExtensions = [".csv", ".xlsx"]

    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )

    if (hasValidExtension) {
      onFileSelect(file)
      onHasLoadedFileChange(false)
      onSheetNamesChange([])
      onSelectedSheetChange("")
      void loadFile(file)
    } else {
      toast.error("Please upload a .csv or .xlsx file")
    }
  }

  const uploadFile = async (file: File, sheetName?: string) => {
    const formData = new FormData()
    formData.append("file", file)
    const url = sheetName
      ? `${BACKEND_URL}/upload?sheet_name=${encodeURIComponent(sheetName)}`
      : `${BACKEND_URL}/upload`

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.detail || `Upload failed: ${response.statusText}`
      )
    }
    return (await response.json()) as UploadResponse
  }

  const loadFile = async (file: File, sheetName?: string) => {
    const requestId = ++requestIdRef.current
    setIsUploading(true)

    try {
      const data = await uploadFile(file, sheetName)
      if (requestId !== requestIdRef.current) {
        return
      }

      onColumnsSet(data.columns, data.rows)
      onSheetNamesChange(data.sheet_names ?? [])
      onSelectedSheetChange(data.selected_sheet ?? "")
      onHasLoadedFileChange(true)
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return
      }
      toast.error("Upload failed: " + (error as Error).message)
    } finally {
      if (requestId === requestIdRef.current) {
        setIsUploading(false)
      }
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleContinue = async () => {
    if (!selectedFile || isUploading) return
    if (sheetNames.length > 1 && !selectedSheet) {
      toast.error("Please select a sheet before continuing")
      return
    }
    if (!hasLoadedFile) {
      await loadFile(selectedFile, selectedSheet || undefined)
      return
    }
    onNext()
  }

  const handleSheetChange = async (value: string) => {
    onSelectedSheetChange(value)
    if (selectedFile) {
      await loadFile(selectedFile, value)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex w-full max-w-md flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "border-muted-foreground/25"
        )}
      >
        {/* Icon */}
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Database className="h-8 w-8 text-primary" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-medium">Drop your datasheet here</h3>

        {/* Subtitle */}
        <p className="mt-1 text-sm text-muted-foreground">
          Supports .csv and .xlsx
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Browse button */}
        <Button variant="outline" className="mt-6" onClick={handleBrowseClick}>
          <Upload className="mr-2 h-4 w-4" />
          Browse Files
        </Button>
      </div>

      {/* Selected file display */}
      {selectedFile && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[200px] truncate">{selectedFile.name}</span>
        </div>
      )}

      {selectedFile && selectedFile.name.toLowerCase().endsWith(".xlsx") && (
        <div className="w-full max-w-md space-y-2">
          <Label htmlFor="sheet-selector">Sheet</Label>
          <Select
            value={selectedSheet}
            onValueChange={handleSheetChange}
            disabled={isUploading || sheetNames.length <= 1}
          >
            <SelectTrigger id="sheet-selector" className="w-full">
              <SelectValue
                placeholder={
                  sheetNames.length > 1
                    ? "Select a sheet"
                    : isUploading
                      ? "Loading sheet..."
                      : "Using the only sheet"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {sheetNames.map((sheetName) => (
                <SelectItem key={sheetName} value={sheetName}>
                  {sheetName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sheetNames.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Choose which worksheet to ingest from this workbook.
            </p>
          )}
        </div>
      )}

      {/* Continue button */}
      <Button onClick={handleContinue} disabled={!selectedFile || isUploading}>
        {isUploading ? (
          <>
            Uploading...
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </div>
  )
}
