"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { toast } from "sonner"
import { BACKEND_URL } from "@/app/data/types"
import type { SiteTitleSettings } from "@/app/settings/types"
import { DEFAULT_SITE_TITLE } from "@/lib/site-title"

interface SiteTitleContextValue {
  siteTitle: string
  isLoading: boolean
  isSaving: boolean
  saveSiteTitle: (nextTitle: string) => Promise<void>
  refreshSiteTitle: () => Promise<void>
}

const SiteTitleContext = createContext<SiteTitleContextValue | null>(null)

export function SiteTitleProvider({ children }: { children: React.ReactNode }) {
  const [siteTitle, setSiteTitle] = useState(DEFAULT_SITE_TITLE)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchSiteTitle = useCallback(async (): Promise<SiteTitleSettings> => {
    const response = await fetch(`${BACKEND_URL}/settings/site-title`)
    if (!response.ok) throw new Error("Failed to fetch site title")
    return response.json()
  }, [])

  const refreshSiteTitle = useCallback(async () => {
    try {
      const titleData = await fetchSiteTitle()
      setSiteTitle(titleData.site_title || DEFAULT_SITE_TITLE)
    } catch {
      toast.error("Failed to load site title")
    } finally {
      setIsLoading(false)
    }
  }, [fetchSiteTitle])

  useEffect(() => {
    let cancelled = false

    const loadSiteTitle = async () => {
      try {
        const titleData = await fetchSiteTitle()
        if (cancelled) return
        setSiteTitle(titleData.site_title || DEFAULT_SITE_TITLE)
      } catch {
        if (!cancelled) {
          toast.error("Failed to load site title")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSiteTitle()

    return () => {
      cancelled = true
    }
  }, [fetchSiteTitle])

  useEffect(() => {
    document.title = siteTitle || DEFAULT_SITE_TITLE
  }, [siteTitle])

  const saveSiteTitle = useCallback(async (nextTitle: string) => {
    setIsSaving(true)
    try {
      const cleanedTitle = nextTitle.trim() || DEFAULT_SITE_TITLE
      const response = await fetch(`${BACKEND_URL}/settings/site-title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_title: cleanedTitle }),
      })
      if (!response.ok) throw new Error("Failed to save site title")

      setSiteTitle(cleanedTitle)
      toast.success("Site title saved")
    } catch {
      toast.error("Failed to save site title")
    } finally {
      setIsSaving(false)
    }
  }, [])

  return (
    <SiteTitleContext.Provider
      value={{
        siteTitle,
        isLoading,
        isSaving,
        saveSiteTitle,
        refreshSiteTitle,
      }}
    >
      {children}
    </SiteTitleContext.Provider>
  )
}

export function useSiteTitle() {
  const context = useContext(SiteTitleContext)
  if (!context) {
    throw new Error("useSiteTitle must be used within a SiteTitleProvider")
  }

  return context
}
