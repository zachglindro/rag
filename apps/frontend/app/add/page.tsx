"use client"

import { IngestStep } from "@/components/add/ingest-step"
import { Stepper } from "@/components/add/stepper"
import { TemplatePreviewStep } from "@/components/add/template-preview-step"
import { UploadStep } from "@/components/add/upload-step"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { useState } from "react"

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

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
  }

  const handleColumnsSet = (
    cols: string[],
    rows: Record<string, unknown>[]
  ) => {
    setParsedData(rows)
    setMappings(cols.map((col) => ({ origColumn: col, mappedColumn: col })))
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

  const handleIngestionComplete = () => {
    setIsIngestionComplete(true)
  }

  const renderStep = () => {
    if (isIngestionComplete) {
      // Show success state even when on final step.
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

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          <div className="flex flex-1 flex-col gap-6 p-6">
            <Stepper currentStep={currentStep} />
            <div
              className={
                currentStep === 2 ? "w-full" : "mx-auto w-full max-w-2xl"
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
