"use client"

import { AIMappingStep } from "@/components/add/ai-mapping-step"
import { IngestStep } from "@/components/add/ingest-step"
import { Stepper } from "@/components/add/stepper"
import { TemplatePreviewStep } from "@/components/add/template-preview-step"
import { UploadStep } from "@/components/add/upload-step"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { useEffect, useState, useCallback } from "react"

interface ColumnMapping {
  origColumn: string
  mappedColumn: string
}

export default function AddPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([])
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [isIngestionComplete, setIsIngestionComplete] = useState(false)
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const response = await fetch("http://localhost:8000/records/count")
        const data = await response.json()
        setHasData(data.count > 0)
      } catch (error) {
        console.error("Failed to check database:", error)
        setHasData(false)
      }
    }
    checkDatabase()
  }, [])

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
  }

  const handleColumnsSet = useCallback(
    (cols: unknown[], rows: Record<string, unknown>[]) => {
      const normalizedColumns = cols.map((col) => String(col ?? ""))
      setParsedData(rows)
      setMappings(
        normalizedColumns.map((col) => ({
          origColumn: col,
          mappedColumn: hasData ? "" : col,
        }))
      )
    },
    [hasData]
  )

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

  const handleIngestionComplete = () => {
    setIsIngestionComplete(true)
  }

  const steps = hasData
    ? [
        { id: 1, title: "Upload" },
        { id: 2, title: "AI Mapping" },
        { id: 3, title: "Preview" },
        { id: 4, title: "Ingest" },
      ]
    : [
        { id: 1, title: "Upload" },
        { id: 2, title: "Preview" },
        { id: 3, title: "Ingest" },
      ]

  const renderStep = () => {
    if (isIngestionComplete) {
      // Show success state even when on final step.
      return <IngestStep onComplete={() => {}} />
    }

    if (hasData) {
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
              onMappingsChange={setMappings}
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
          return (
            <IngestStep
              onComplete={handleIngestionComplete}
              rows={parsedData}
              mappings={mappings}
            />
          )
        default:
          return null
      }
    } else {
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
            <TemplatePreviewStep
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
              mappings={mappings}
              rawData={parsedData}
            />
          )
        case 3:
          return (
            <IngestStep
              onComplete={handleIngestionComplete}
              rows={parsedData}
              mappings={mappings}
            />
          )
        default:
          return null
      }
    }
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <div className="flex min-h-svh w-full min-w-0 flex-col overflow-x-hidden">
          <div className="flex flex-1 flex-col gap-6 p-6">
            <Stepper currentStep={currentStep} steps={steps} />
            <div
              className={
                steps.find((s) => s.id === currentStep)?.title === "Preview"
                  ? "w-full"
                  : "mx-auto w-full max-w-2xl"
              }
            >
              {renderStep()}
            </div>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
