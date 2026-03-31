"use client"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check, Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface IngestStepProps {
  onComplete: () => void
  rows?: Record<string, unknown>[]
  mappings?: { origColumn: string; mappedColumn: string }[]
}

export function IngestStep({ onComplete, rows, mappings }: IngestStepProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If no data provided, skip ingestion and complete immediately
    if (!rows || !mappings) {
      setIsLoading(false)
      onComplete()
      return
    }

    const ingestData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        setProgress(10)

        const response = await fetch("http://localhost:8000/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows, mappings }),
        })

        setProgress(50)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || `HTTP ${response.status}`)
        }

        await response.json()
        setProgress(100)

        // Success
        setIsLoading(false)
        onComplete()
      } catch (err) {
        setIsLoading(false)
        setError(err instanceof Error ? err.message : "Unknown error occurred")
      }
    }

    ingestData()
  }, [onComplete, rows, mappings])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        {/* Error icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
          <X className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        {/* Error message */}
        <div className="text-center">
          <h3 className="text-lg font-medium">Ingestion Failed</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>

        {/* Retry button */}
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    )
  }

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
