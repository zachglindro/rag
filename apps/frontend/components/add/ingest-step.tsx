"use client"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check, Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const startedIngestionKeys = new Set<string>()

interface IngestStepProps {
  onComplete: () => void
  rows?: Record<string, unknown>[]
  mappings?: { origColumn: string; mappedColumn: string }[]
  idColumn?: string | null
}

export function IngestStep({
  onComplete,
  rows,
  mappings,
  idColumn,
}: IngestStepProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState("Initializing...")
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null)
  const [startTime] = useState<number>(Date.now())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If no data provided, skip ingestion and complete immediately
    if (!rows || !mappings) {
      setIsLoading(false)
      onComplete()
      return
    }

    const ingestionKey = JSON.stringify({ rows, mappings })
    if (startedIngestionKeys.has(ingestionKey)) {
      return
    }

    startedIngestionKeys.add(ingestionKey)

    const formatDuration = (ms: number) => {
      if (ms <= 0) return null
      const seconds = Math.ceil(ms / 1000)
      if (seconds < 5) return "Estimating..."
      if (seconds < 60) return `${seconds}s remaining`
      const minutes = Math.floor(seconds / 60)
      const remSeconds = seconds % 60
      return `${minutes}m ${remSeconds}s remaining`
    }

    const ingestData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        setProgress(5)

        const mappedIdColumn = idColumn

        const response = await fetch("http://localhost:8000/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows,
            mappings,
            id_column: mappedIdColumn || null,
            user_name: localStorage.getItem("userName") || "Unknown",
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || `HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("Failed to read response stream")
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)
              if (event.type === "progress") {
                setProgress(event.progress)
                if (event.message) setMessage(event.message)

                // Update estimated time
                const elapsed = Date.now() - startTime
                if (event.progress > 0) {
                  const totalEstimated = elapsed / (event.progress / 100)
                  const remaining = totalEstimated - elapsed
                  setEstimatedTime(formatDuration(remaining))
                }
              } else if (event.type === "done") {
                // Success
                setIsLoading(false)
                onComplete()
              } else if (event.type === "error") {
                throw new Error(event.detail)
              }
            } catch (e) {
              console.error("Error parsing stream line:", e)
            }
          }
        }
      } catch (err) {
        startedIngestionKeys.delete(ingestionKey)
        setIsLoading(false)
        setError(err instanceof Error ? err.message : "Unknown error occurred")
      }
    }

    ingestData()
  }, [onComplete, rows, mappings, idColumn, startTime])

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
        <div className="w-full max-w-sm space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between gap-4 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            <span className="flex-1 truncate">{message}</span>
            <span className="flex-shrink-0 whitespace-nowrap">
              {estimatedTime}
            </span>
          </div>
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
