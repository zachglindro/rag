"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

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
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const stepNumber = step.id

          return (
            <div key={step.id} className="flex flex-1 flex-col items-center">
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

              {/* Connector line (not for last step) */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute top-5 left-[calc(50%+2.5rem)] h-0.5 w-[calc(100%-5rem)]",
                    step.id < currentStep ? "bg-primary" : "bg-muted",
                    index < steps.length - 1 && "hidden md:block"
                  )}
                  style={{
                    position: "absolute",
                    left: `${(index + 1) * (100 / steps.length)}%`,
                    transform: "translateX(-50%)",
                    width: `${100 / steps.length}%`,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
