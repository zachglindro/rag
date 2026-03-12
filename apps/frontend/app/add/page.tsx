"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Stepper } from "@/components/add/stepper"
import { UploadStep } from "@/components/add/upload-step"
import { AIMappingStep } from "@/components/add/ai-mapping-step"
import { TemplatePreviewStep } from "@/components/add/template-preview-step"
import { IngestStep } from "@/components/add/ingest-step"

interface ColumnMapping {
  origColumn: string
  mappedColumn: string
}

export default function AddPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([
    { origColumn: "Var_Name_Loc", mappedColumn: "local_name" },
    { origColumn: "hgt_cm", mappedColumn: "plant_height" },
    { origColumn: "p_tassel_color", mappedColumn: "tassel_color" },
  ])
  const [isIngestionComplete, setIsIngestionComplete] = useState(false)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
  }

  const handleMappingsChange = (newMappings: ColumnMapping[]) => {
    setMappings(newMappings)
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

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
