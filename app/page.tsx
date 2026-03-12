"use client"

import { useState } from "react"
import { Sprout, Send } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const suggestions = [
  "Accessions from Visayas with good bacterial stalk rot resistance",
  "Show me flint-type maize lines with purple silk and a plant height below 160 cm",
  "Lines with purple silk and early anthesis",
  "Varieties tolerant to waterlogging and perform well under drought conditions",
]

export default function Page() {
  const [showExamples, setShowExamples] = useState(false)

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          {/* Main content - centered */}
          <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
            {/* Header with icon and title */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sprout className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-xl font-medium">Cereals Inventory Search</h1>
            </div>

            {/* Examples button and suggestion cards */}
            <div className="flex w-full max-w-2xl flex-col items-center gap-3">
              {!showExamples && (
                <Button
                  variant="outline"
                  onClick={() => setShowExamples(true)}
                  className="text-sm"
                >
                  Examples
                </Button>
              )}
              {showExamples && (
                <div className="grid w-full grid-cols-2 gap-3">
                  {suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="h-auto min-h-[80px] w-full justify-start px-4 py-3 text-left text-sm leading-relaxed break-words whitespace-pre-wrap normal-case hover:bg-accent"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Floating search bar */}
          <div className="sticky bottom-6 mx-auto w-full max-w-2xl px-6 pb-6">
            <div className="relative flex items-center gap-2 rounded-xl border bg-background p-2 shadow-lg">
              <Input
                className="flex-1 border-0 bg-transparent px-4 text-base focus-visible:ring-0"
                placeholder="Describe what you are looking for..."
              />
              <Button size="icon" className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
