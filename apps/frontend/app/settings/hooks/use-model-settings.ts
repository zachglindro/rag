"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { BACKEND_URL } from "@/app/data/types"
import type { ModelInfo, ModelSettingsResponse } from "../types"

export function useModelSettings() {
  const [selectedModelToSwitch, setSelectedModelToSwitch] = useState<string>("")
  const [activeModel, setActiveModel] = useState<string>("")
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchSuccess, setSwitchSuccess] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isDownloadingQwen, setIsDownloadingQwen] = useState(false)
  const [qwenDownloaded, setQwenDownloaded] = useState(false)
  const [isCancellingQwen, setIsCancellingQwen] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadMessage, setDownloadMessage] = useState("")

  const fetchModelSettings =
    useCallback(async (): Promise<ModelSettingsResponse> => {
      const response = await fetch(`${BACKEND_URL}/settings/model`)
      if (!response.ok) throw new Error("Failed to fetch model settings")
      return response.json()
    }, [])

  const refreshModelSettings = useCallback(async () => {
    const modelData = await fetchModelSettings()
    setActiveModel(modelData.active_model)
    setAvailableModels(modelData.available_models)

    const qwenModel = modelData.available_models.find(
      (model) => model.id === "qwen3-0.6b"
    )
    setQwenDownloaded(qwenModel?.downloaded ?? false)
  }, [fetchModelSettings])

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      try {
        const modelData = await fetchModelSettings()

        if (cancelled) return

        setActiveModel(modelData.active_model)
        setAvailableModels(modelData.available_models)

        const qwenModel = modelData.available_models.find(
          (model) => model.id === "qwen3-0.6b"
        )
        setQwenDownloaded(qwenModel?.downloaded ?? false)
      } catch {
        if (!cancelled) {
          toast.error("Failed to load model settings")
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [fetchModelSettings])

  const handleSwitchModel = useCallback(
    async (modelId: string) => {
      setIsSwitching(true)
      setSwitchSuccess(false)
      try {
        const response = await fetch(`${BACKEND_URL}/settings/model`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_id: modelId }),
        })
        if (!response.ok) throw new Error("Failed to switch model")
        setActiveModel(modelId)
        setSwitchSuccess(true)
        const model = availableModels.find((item) => item.id === modelId)
        toast.success(`Switched to ${model?.label || modelId}`)
        window.setTimeout(() => setSwitchSuccess(false), 3000)
      } catch {
        toast.error("Failed to switch model")
      } finally {
        setIsSwitching(false)
      }
    },
    [availableModels]
  )

  const handleModelSelection = useCallback(
    (modelId: string) => {
      const model = availableModels.find((item) => item.id === modelId)
      if (model?.source === "online") {
        setSelectedModelToSwitch(modelId)
        setIsConfirmDialogOpen(true)
        return
      }

      void handleSwitchModel(modelId)
    },
    [availableModels, handleSwitchModel]
  )

  const handleConfirmSwitch = useCallback(() => {
    void handleSwitchModel(selectedModelToSwitch)
    setIsConfirmDialogOpen(false)
    setSelectedModelToSwitch("")
  }, [handleSwitchModel, selectedModelToSwitch])

  const handleDownloadQwen = useCallback(async () => {
    setIsDownloadingQwen(true)
    setDownloadProgress(0)
    setDownloadMessage("Starting download...")
    try {
      const response = await fetch(
        `${BACKEND_URL}/settings/model/download-qwen`,
        {
          method: "POST",
        }
      )
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || "Failed to download Qwen model")
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
              setDownloadProgress(event.progress)
              if (event.message) setDownloadMessage(event.message)
            } else if (event.type === "done") {
              setQwenDownloaded(event.downloaded)
              toast.success(event.message)
              await refreshModelSettings()
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
        error instanceof Error ? error.message : "Failed to download Qwen model"
      if (message === "Download cancelled") {
        return
      }
      toast.error(message)
    } finally {
      setIsDownloadingQwen(false)
      setDownloadProgress(0)
      setDownloadMessage("")
    }
  }, [refreshModelSettings])

  const handleCancelDownloadQwen = useCallback(async () => {
    setIsCancellingQwen(true)
    try {
      const response = await fetch(
        `${BACKEND_URL}/settings/model/cancel-download-qwen`,
        { method: "POST" }
      )
      if (!response.ok) {
        throw new Error("Failed to cancel download")
      }
      toast.success("Download cancelled")
      setIsDownloadingQwen(false)
      setDownloadProgress(0)
      setDownloadMessage("")
    } catch {
      toast.error("Failed to cancel download")
    } finally {
      setIsCancellingQwen(false)
    }
  }, [])

  return {
    activeModel,
    availableModels,
    isSwitching,
    switchSuccess,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    handleModelSelection,
    handleConfirmSwitch,
    isDownloadingQwen,
    qwenDownloaded,
    isCancellingQwen,
    downloadProgress,
    downloadMessage,
    handleDownloadQwen,
    handleCancelDownloadQwen,
  }
}
