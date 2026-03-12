"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface IngestStepProps {
  onComplete: () => void
}

export function IngestStep({ onComplete }: IngestStepProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Simulate ingestion progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 10
      })
    }, 300)

    // Simulate total ingestion delay (3 seconds)
    const timeout = setTimeout(() => {
      setIsLoading(false)
      onComplete()
    }, 3000)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(timeout)
    }
  }, [onComplete])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        {/* Loading spinner */}
        <Loader2 className="h-12 w-12 animate-spin text-primary" />

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Loading message */}
        <p className="text-sm text-muted-foreground">
          Please don&apos;t close this tab
        </p>
      </div>
    )
  }

  // Success state
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      {/* Checkmark icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
        <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>

      {/* Success message */}
      <div className="text-center">
        <h3 className="text-lg font-medium">Data Ingested</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your data has been successfully added to the inventory
        </p>
      </div>

      {/* Back to home button */}
      <Button onClick={() => router.push("/")}>Back to Home</Button>
    </div>
  )
}
