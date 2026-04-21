"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, Check, ChevronDown, Info, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCallback, useEffect, useRef, useState } from "react"

interface SelectIDStepProps {
  columns: string[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onNext: () => void
  onBack: () => void
  data: Record<string, unknown>[]
  mappings: { origColumn: string; mappedColumn: string }[]
}

export function SelectIDStep({
  columns,
  selectedId,
  onSelect,
  onNext,
  onBack,
  data,
  mappings,
}: SelectIDStepProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showScrollHint, setShowScrollHint] = useState(false)
  const [duplicates, setDuplicates] = useState<{
    value: unknown
    rows: number[]
  }[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedId) {
      setDuplicates([])
      return
    }

    const mapping = mappings.find((m) => m.mappedColumn === selectedId)
    if (!mapping) {
      setDuplicates([])
      return
    }

    const origCol = mapping.origColumn
    const valueMap = new Map<unknown, number[]>()

    data.forEach((row, index) => {
      const val = row[origCol]
      if (val !== undefined && val !== null && val !== "") {
        const existing = valueMap.get(val) || []
        valueMap.set(val, [...existing, index + 1])
      }
    })

    const foundDuplicates: { value: unknown; rows: number[] }[] = []
    valueMap.forEach((rows, value) => {
      if (rows.length > 1) {
        foundDuplicates.push({ value, rows })
      }
    })

    setDuplicates(foundDuplicates)
  }, [selectedId, data, mappings])

  const filteredColumns = columns.filter((col) =>
    col.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      setShowScrollHint(
        scrollHeight > clientHeight &&
          scrollTop + clientHeight < scrollHeight - 10
      )
    }
  }, [])

  useEffect(() => {
    const handle = requestAnimationFrame(checkScroll)
    return () => cancelAnimationFrame(handle)
  }, [filteredColumns, checkScroll])

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
      <div className="group/scroll relative">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="custom-scrollbar flex max-h-[400px] flex-col gap-2 overflow-y-auto rounded-lg border bg-muted/10 p-2"
        >
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

        {/* Scroll Indicators */}
        {showScrollHint && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-lg bg-gradient-to-t from-background/80 to-transparent" />
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground transition-all">
              <ChevronDown className="h-4 w-4" />
            </div>
          </>
        )}
      </div>

      {/* Duplicates Warning */}
      {duplicates.length > 0 && (
        <div className="flex gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive dark:bg-destructive/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Duplicate values found</p>
            <p>
              The selected ID column must contain unique values. The following
              duplicates were found:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              {duplicates.slice(0, 5).map((dup, i) => (
                <li key={i}>
                  Value <span className="font-mono underline">"{String(dup.value)}"</span> at rows: {dup.rows.join(", ")}
                </li>
              ))}
              {duplicates.length > 5 && (
                <li>...and {duplicates.length - 5} more</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between border-t pt-6">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={duplicates.length > 0}>
          Continue
        </Button>
      </div>
    </div>
  )
}
