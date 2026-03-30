"use client"

import { useState, useRef, DragEvent, ChangeEvent } from "react"
import { Database, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface UploadStepProps {
  onFileSelect: (file: File) => void
  onNext: () => void
  selectedFile: File | null
  onColumnsSet: (columns: string[], rows: Record<string, unknown>[]) => void
}

export function UploadStep({
  onFileSelect,
  onNext,
  selectedFile,
  onColumnsSet,
}: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    } else {
      alert("Please upload a .csv or .xlsx file")
    }
  }

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch("http://localhost:8000/upload", {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }
    const data = await response.json()
    return { columns: data.columns, rows: data.rows }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleContinue = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    try {
      const { columns, rows } = await uploadFile(selectedFile)
      onColumnsSet(columns, rows)
      onNext()
    } catch (error) {
      alert("Upload failed: " + (error as Error).message)
    } finally {
      setIsUploading(false)
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

      {/* Continue button */}
      <Button onClick={handleContinue} disabled={!selectedFile || isUploading}>
        {isUploading ? "Uploading..." : "Continue"}
      </Button>
    </div>
  )
}
