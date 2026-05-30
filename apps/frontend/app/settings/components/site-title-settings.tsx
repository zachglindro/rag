"use client"

import { useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DEFAULT_SITE_TITLE } from "@/lib/site-title"
import { useSiteTitle } from "@/contexts/site-title-context"

export function SiteTitleSettings() {
  const [isOpen, setIsOpen] = useState(true)
  const { siteTitle, isLoading, isSaving, saveSiteTitle } = useSiteTitle()

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="group flex w-full items-center justify-between py-2 text-left">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Site Title</h2>
            <p className="text-sm text-muted-foreground">
              Change the title shown in the browser tab and on the chat landing
              page.
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 animate-in fade-in-0 slide-in-from-top-2">
        <div className="pl-1">
          {isLoading ? (
            <div className="h-28 max-w-md animate-pulse rounded-md bg-muted" />
          ) : (
            <SiteTitleEditor
              key={siteTitle}
              initialTitle={siteTitle}
              isSaving={isSaving}
              saveSiteTitle={saveSiteTitle}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function SiteTitleEditor({
  initialTitle,
  isSaving,
  saveSiteTitle,
}: {
  initialTitle: string
  isSaving: boolean
  saveSiteTitle: (nextTitle: string) => Promise<void>
}) {
  const [draftTitle, setDraftTitle] = useState(initialTitle)
  const hasChanges = draftTitle.trim() !== initialTitle

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="site-title">Site Title</Label>
        <Input
          id="site-title"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          placeholder={DEFAULT_SITE_TITLE}
        />
        <p className="text-xs text-muted-foreground">
          Leave it blank to restore the default title.
        </p>
      </div>

      {hasChanges && (
        <Button
          onClick={() => void saveSiteTitle(draftTitle)}
          disabled={isSaving}
          className="w-full animate-in duration-200 zoom-in-95 fade-in"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Site Title"
          )}
        </Button>
      )}
    </div>
  )
}
