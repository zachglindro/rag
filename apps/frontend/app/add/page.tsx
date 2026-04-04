"use client"

import { IngestStep } from "@/components/add/ingest-step"
import { Stepper } from "@/components/add/stepper"
import { TemplatePreviewStep } from "@/components/add/template-preview-step"
import { UploadStep } from "@/components/add/upload-step"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { SidebarInset } from "@/components/ui/sidebar"
import { Database } from "lucide-react"
import { useEffect, useState } from "react"

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
  const [hasRecords, setHasRecords] = useState<boolean | null>(null)
  const [hasStartedFlow, setHasStartedFlow] = useState(false)

  useEffect(() => {
    const fetchRecordCount = async () => {
      try {
        const response = await fetch("http://localhost:8000/records/count")
        if (!response.ok) {
          throw new Error("Failed to fetch record count")
        }

        const data: { count: number } = await response.json()
        setHasRecords(data.count > 0)
      } catch {
        // If the API is unavailable, keep the add flow usable.
        setHasRecords(true)
      }
    }

    void fetchRecordCount()
  }, [])

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
            {hasRecords === null ? (
              <div className="mx-auto w-full max-w-2xl rounded-lg border p-6 text-sm text-muted-foreground">
                Checking database status...
              </div>
            ) : !hasRecords && !hasStartedFlow ? (
              <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 rounded-xl border p-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Database className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    There is currently no data in the database
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start by adding your first dataset to continue.
                  </p>
                </div>
                <Button onClick={() => setHasStartedFlow(true)}>
                  Add Data
                </Button>
              </div>
            ) : (
              <>
                <Stepper currentStep={currentStep} />
                <div
                  className={
                    currentStep === 2 ? "w-full" : "mx-auto w-full max-w-2xl"
                  }
                >
                  {renderStep()}
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
