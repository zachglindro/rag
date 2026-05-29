"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export function SearchSettings() {
  const [isOpen, setIsOpen] = useState(true)
  const [searchType, setSearchType] = useState<"semantic" | "keyword">(() => {
    if (typeof window === "undefined") return "semantic"
    const stored = localStorage.getItem("searchType")
    return stored === "keyword" ? "keyword" : "semantic"
  })

  const handleSearchTypeChange = (value: "semantic" | "keyword") => {
    setSearchType(value)
    localStorage.setItem("searchType", value)
    toast.success(
      `Switched to ${value === "semantic" ? "Semantic" : "Keyword"} Search`
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="group flex w-full items-center justify-between py-2 text-left">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Search Settings
            </h2>
            <p className="text-sm text-muted-foreground">
              Choose the search method for chat and data pages.
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 animate-in fade-in-0 slide-in-from-top-2">
        <div className="pl-1">
          <RadioGroup
            value={searchType}
            onValueChange={(value) =>
              handleSearchTypeChange(value as "semantic" | "keyword")
            }
            className="flex flex-col gap-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="semantic" id="semantic" />
              <Label htmlFor="semantic" className="cursor-pointer">
                Semantic Search
                <p className="text-xs font-normal text-muted-foreground">
                  Uses AI to find records based on meaning. Best for natural
                  language questions.
                </p>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="keyword" id="keyword" />
              <Label htmlFor="keyword" className="cursor-pointer">
                Keyword Search
                <p className="text-xs font-normal text-muted-foreground">
                  Matches exact words and phrases. Best for finding specific
                  identifiers or terms.
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
