"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Info, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface SelectIDStepProps {
  columns: string[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onNext: () => void
  onBack: () => void
}

export function SelectIDStep({
  columns,
  selectedId,
  onSelect,
  onNext,
  onBack,
}: SelectIDStepProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredColumns = columns.filter((col) =>
    col.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium">Select Unique ID Column</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional: Select a column to identify existing records.
        </p>
      </div>

      {/* Info card */}
      <div className="flex gap-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          If you select an ID column, records with matching IDs in the database
          will be updated. If no ID is specified, all records will be added as
          new entries.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search columns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Columns list - Scrollable container */}
      <div className="custom-scrollbar flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-2">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "flex items-center justify-between rounded-lg border p-4 text-left transition-all hover:bg-muted",
            selectedId === null
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-card"
          )}
        >
          <span className="font-medium">None / Skip</span>
          {selectedId === null && <Check className="h-4 w-4 text-primary" />}
        </button>

        {filteredColumns.map((col) => (
          <button
            key={col}
            onClick={() => onSelect(col)}
            className={cn(
              "flex items-center justify-between rounded-lg border p-4 text-left transition-all hover:bg-muted",
              selectedId === col
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card"
            )}
          >
            <span className="truncate font-medium">{col}</span>
            {selectedId === col && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}

        {filteredColumns.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No columns match your search
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between border-t pt-6">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  )
}
