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
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const stepNumber = step.id

          return (
            <React.Fragment key={step.id}>
              {/* Step column */}
              <div className="flex flex-col items-center">
                {/* Step indicator circle */}
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-primary text-primary-foreground",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
                </div>

                {/* Step label */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isCurrent && "text-primary",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Connector line between neighboring steps */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mt-5 h-0.5 flex-1 transition-colors",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
