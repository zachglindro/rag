"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { BACKEND_URL } from "@/app/data/types"
import type { BackupSettings } from "../types"

export function useBackupSettings() {
  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(
    null
  )
  const [originalBackupSettings, setOriginalBackupSettings] =
    useState<BackupSettings | null>(null)
  const [isSavingBackup, setIsSavingBackup] = useState(false)
  const [isBackingUpNow, setIsBackingUpNow] = useState(false)

  const fetchBackupSettings = useCallback(async (): Promise<BackupSettings> => {
    const response = await fetch(`${BACKEND_URL}/settings/backup`)
    if (!response.ok) throw new Error("Failed to fetch backup settings")
    return response.json()
  }, [])

  const refreshBackupSettings = useCallback(async () => {
    const latestBackupSettings = await fetchBackupSettings()
    setBackupSettings(latestBackupSettings)
    setOriginalBackupSettings(latestBackupSettings)
  }, [fetchBackupSettings])

  useEffect(() => {
    let cancelled = false

    const loadBackupSettings = async () => {
      try {
        const latestBackupSettings = await fetchBackupSettings()
        if (cancelled) return
        setBackupSettings(latestBackupSettings)
        setOriginalBackupSettings(latestBackupSettings)
      } catch {
        if (!cancelled) {
          toast.error("Failed to load backup settings")
        }
      }
    }

    void loadBackupSettings()

    return () => {
      cancelled = true
    }
  }, [fetchBackupSettings])

  const handleSaveBackupSettings = useCallback(async () => {
    if (!backupSettings) return
    setIsSavingBackup(true)
    try {
      const response = await fetch(`${BACKEND_URL}/settings/backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupSettings),
      })
      if (!response.ok) throw new Error("Failed to save backup settings")
      toast.success("Backup settings saved")
      setOriginalBackupSettings(backupSettings)
    } catch {
      toast.error("Failed to save backup settings")
    } finally {
      setIsSavingBackup(false)
    }
  }, [backupSettings])

  const hasBackupChanges =
    backupSettings &&
    originalBackupSettings &&
    JSON.stringify(backupSettings) !== JSON.stringify(originalBackupSettings)

  const handleManualBackup = useCallback(async () => {
    setIsBackingUpNow(true)
    try {
      const response = await fetch(`${BACKEND_URL}/settings/backup/now`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Backup failed")
      toast.success("Backup created successfully")
      await refreshBackupSettings()
    } catch {
      toast.error("Failed to create backup")
    } finally {
      setIsBackingUpNow(false)
    }
  }, [refreshBackupSettings])

  return {
    backupSettings,
    setBackupSettings,
    isSavingBackup,
    isBackingUpNow,
    hasBackupChanges,
    handleSaveBackupSettings,
    handleManualBackup,
  }
}
