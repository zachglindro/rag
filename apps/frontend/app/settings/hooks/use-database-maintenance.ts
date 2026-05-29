"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { BACKEND_URL } from "@/app/data/types"

type ExportFormat = "csv" | "xlsx"

export function useDatabaseMaintenance() {
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isResetHistoryDialogOpen, setIsResetHistoryDialogOpen] =
    useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isResettingDatabase, setIsResettingDatabase] = useState(false)
  const [resetProgress, setResetProgress] = useState(0)
  const [resetMessage, setResetMessage] = useState("")
  const [isResettingHistory, setIsResettingHistory] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv")

  const handleReset = useCallback(async () => {
    setIsResettingDatabase(true)
    setResetProgress(0)
    setResetMessage("Starting database reset...")
    try {
      const response = await fetch(`${BACKEND_URL}/reset-database`, {
        method: "POST",
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || "Reset failed")
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to read reset progress stream")
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
              setResetProgress(event.progress)
              if (event.message) setResetMessage(event.message)
            } else if (event.type === "done") {
              setResetProgress(100)
              if (event.message) setResetMessage(event.message)
              toast.success(event.message)
              setIsResetDialogOpen(false)
            } else if (event.type === "error") {
              throw new Error(event.detail)
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.message !== "Unexpected end of JSON input"
            ) {
              throw error
            }
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reset database"
      toast.error(message)
    } finally {
      setIsResettingDatabase(false)
      setResetProgress(0)
      setResetMessage("")
    }
  }, [])

  const handleResetHistory = useCallback(async () => {
    setIsResettingHistory(true)
    try {
      const response = await fetch(`${BACKEND_URL}/history/reset`, {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error("Reset history failed")
      }
      toast.success("History log reset successfully")
      setIsResetHistoryDialogOpen(false)
    } catch {
      toast.error("Failed to reset history log")
    } finally {
      setIsResettingHistory(false)
    }
  }, [])

  const handleExportData = useCallback(async () => {
    setIsExporting(true)
    try {
      const response = await fetch(
        `${BACKEND_URL}/export-data?format=${exportFormat}`
      )
      if (!response.ok) {
        throw new Error("Export failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `export_data.${exportFormat}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success(`Exported data as ${exportFormat.toUpperCase()}`)
      setIsExportDialogOpen(false)
    } catch {
      toast.error("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }, [exportFormat])

  return {
    isResetDialogOpen,
    setIsResetDialogOpen,
    isResetHistoryDialogOpen,
    setIsResetHistoryDialogOpen,
    isExportDialogOpen,
    setIsExportDialogOpen,
    isResettingDatabase,
    resetProgress,
    resetMessage,
    isResettingHistory,
    isExporting,
    exportFormat,
    setExportFormat,
    handleReset,
    handleResetHistory,
    handleExportData,
  }
}
