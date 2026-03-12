"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import React from "react"

export interface Step {
  id: number
  title: string
}

interface StepperProps {
  currentStep: number
  steps?: Step[]
}

const defaultSteps: Step[] = [
  { id: 1, title: "Upload" },
  { id: 2, title: "AI Mapping" },
  { id: 3, title: "Template Preview" },
  { id: 4, title: "Ingest" },
]

export function Stepper({ currentStep, steps = defaultSteps }: StepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-start justify-center gap-4">
        {steps.map((step) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const stepNumber = step.id

          return (
            <React.Fragment key={step.id}>
              {/* Step row */}
              <div className="flex items-center">
                {/* Step indicator circle */}
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-primary text-primary-foreground",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
                </div>

                {/* Step label */}
                <span
                  className={cn(
                    "ml-2 text-sm font-medium",
                    isCurrent && "text-primary",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
