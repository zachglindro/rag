"use client"

import { AIMappingStep } from "@/components/add/ai-mapping-step"
import { IngestStep } from "@/components/add/ingest-step"
import { Stepper } from "@/components/add/stepper"
import { TemplatePreviewStep } from "@/components/add/template-preview-step"
import { UploadStep } from "@/components/add/upload-step"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { useCallback, useEffect, useRef, useState } from "react"

interface ColumnMapping {
  origColumn: string
  mappedColumn: string
}

interface MappingSuggestion {
  orig_column: string
  suggested_column: string
  confidence: number
}

export default function AddPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([])
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [isIngestionComplete, setIsIngestionComplete] = useState(false)

  const mappingsRef = useRef(mappings)

  useEffect(() => {
    mappingsRef.current = mappings
  }, [mappings])

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
  }

  const handleColumnsSet = (
    cols: string[],
    rows: Record<string, unknown>[]
  ) => {
    setColumns(cols)
    setParsedData(rows)
    setMappings(cols.map((col) => ({ origColumn: col, mappedColumn: "" })))
  }

  const handleMappingsChange = (newMappings: ColumnMapping[]) => {
    setMappings(newMappings)
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

  const suggestMappings = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/suggest-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      })
      if (!response.ok) throw new Error("Failed to get suggestions")
      const suggestions = await response.json()
      const newMappings = mappingsRef.current.map((mapping) => {
        const suggestion = suggestions.find(
          (s: MappingSuggestion) => s.orig_column === mapping.origColumn
        )
        return suggestion
          ? { ...mapping, mappedColumn: suggestion.suggested_column }
          : mapping
      })
      setMappings(newMappings)
    } catch (error) {
      console.error("Error suggesting mappings:", error)
    }
  }, [columns])

  useEffect(() => {
    if (currentStep === 2 && columns.length > 0) {
      suggestMappings()
    }
  }, [currentStep, columns, suggestMappings])

  const handleIngestionComplete = () => {
    setIsIngestionComplete(true)
  }

  const renderStep = () => {
    if (isIngestionComplete) {
      // Show success state even when on step 4
      return <IngestStep onComplete={() => {}} />
    }

    switch (currentStep) {
      case 1:
        return (
          <UploadStep
            onFileSelect={handleFileSelect}
            onNext={() => goToStep(2)}
            selectedFile={selectedFile}
            onColumnsSet={handleColumnsSet}
          />
        )
      case 2:
        return (
          <AIMappingStep
            onBack={() => goToStep(1)}
            onNext={() => goToStep(3)}
            mappings={mappings}
            onMappingsChange={handleMappingsChange}
          />
        )
      case 3:
        return (
          <TemplatePreviewStep
            onBack={() => goToStep(2)}
            onNext={() => goToStep(4)}
            mappings={mappings}
            rawData={parsedData}
          />
        )
      case 4:
        return <IngestStep onComplete={handleIngestionComplete} />
      default:
        return null
    }
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          {/* Main content */}
          <div className="flex flex-1 flex-col gap-6 p-6">
            {/* Stepper */}
            <Stepper currentStep={currentStep} />

            {/* Step content */}
            <div className="mx-auto w-full max-w-2xl">{renderStep()}</div>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
