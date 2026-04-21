"use client"

import { AIMappingStep } from "@/components/add/ai-mapping-step"
import { IngestStep } from "@/components/add/ingest-step"
import { SelectIDStep } from "@/components/add/select-id-step"
import { Stepper } from "@/components/add/stepper"
import { TemplatePreviewStep } from "@/components/add/template-preview-step"
import { UploadStep } from "@/components/add/upload-step"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { useEffect, useState, useCallback, useMemo } from "react"

interface ColumnMapping {
  origColumn: string
  mappedColumn: string
}

export default function AddPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([])
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [idColumn, setIdColumn] = useState<string | null>(null)
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

  const steps = useMemo(() => {
    const baseSteps = [{ id: 1, title: "Upload" }]

    if (hasData) {
      return [
        ...baseSteps,
        { id: 2, title: "AI Mapping" },
        { id: 3, title: "Select ID" },
        { id: 4, title: "Preview" },
        { id: 5, title: "Ingest" },
      ]
    } else {
      return [
        ...baseSteps,
        { id: 2, title: "Select ID" },
        { id: 3, title: "Preview" },
        { id: 4, title: "Ingest" },
      ]
    }
  }, [hasData])

  const mappedColumnNames = useMemo(() => {
    return mappings
      .filter((m) => m.mappedColumn !== "")
      .map((m) => m.mappedColumn)
  }, [mappings])

  const renderStep = () => {
    if (isIngestionComplete) {
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
        if (hasData) {
          return (
            <AIMappingStep
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
              mappings={mappings}
              onMappingsChange={setMappings}
            />
          )
        } else {
          return (
            <SelectIDStep
              columns={mappedColumnNames}
              selectedId={idColumn}
              onSelect={setIdColumn}
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
            />
          )
        }
      case 3:
        if (hasData) {
          return (
            <SelectIDStep
              columns={mappedColumnNames}
              selectedId={idColumn}
              onSelect={setIdColumn}
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
            />
          )
        } else {
          return (
            <TemplatePreviewStep
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
              mappings={mappings}
              rawData={parsedData}
              idColumn={idColumn}
            />
          )
        }
      case 4:
        if (hasData) {
          return (
            <TemplatePreviewStep
              onBack={() => goToStep(3)}
              onNext={() => goToStep(5)}
              mappings={mappings}
              rawData={parsedData}
              idColumn={idColumn}
            />
          )
        } else {
          return (
            <IngestStep
              onComplete={handleIngestionComplete}
              rows={parsedData}
              mappings={mappings}
              idColumn={idColumn}
            />
          )
        }
      case 5:
        if (hasData) {
          return (
            <IngestStep
              onComplete={handleIngestionComplete}
              rows={parsedData}
              mappings={mappings}
              idColumn={idColumn}
            />
          )
        }
        return null
      default:
        return null
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
