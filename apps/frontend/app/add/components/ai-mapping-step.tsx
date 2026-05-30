"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { BACKEND_URL } from "@/app/data/types"

// Define the type for mapping suggestions from the API
interface MappingSuggestion {
  orig_column: string
  suggested_column: string
  confidence: number
}

interface ColumnMetadata {
  column_name: string
  display_name: string
}

interface ColumnMapping {
  origColumn: string
  mappedColumn: string
}

const toSearchableText = (value: unknown) => String(value ?? "").toLowerCase()

interface AIMappingStepProps {
  onBack: () => void
  onNext: () => void
  mappings: ColumnMapping[]
  onMappingsChange: (mappings: ColumnMapping[]) => void
}

export function AIMappingStep({
  onBack,
  onNext,
  mappings,
  onMappingsChange,
}: AIMappingStepProps) {
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})
  const [sectionStates, setSectionStates] = useState({
    mapped: false,
    unmapped: false,
  })
  const [mappedSearch, setMappedSearch] = useState("")
  const [unmappedSearch, setUnmappedSearch] = useState("")
  const [suggestionsApplied, setSuggestionsApplied] = useState(false)
  const [availableColumns, setAvailableColumns] = useState<
    { value: string; label: string }[]
  >([])
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false)
  const [showMappedScrollHint, setShowMappedScrollHint] = useState(false)
  const [showUnmappedScrollHint, setShowUnmappedScrollHint] = useState(false)

  const mappedScrollRef = useRef<HTMLDivElement>(null)
  const unmappedScrollRef = useRef<HTMLDivElement>(null)

  const checkMappedScroll = useCallback(() => {
    if (mappedScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = mappedScrollRef.current
      setShowMappedScrollHint(
        scrollHeight > clientHeight &&
          scrollTop + clientHeight < scrollHeight - 10
      )
    }
  }, [])

  const checkUnmappedScroll = useCallback(() => {
    if (unmappedScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        unmappedScrollRef.current
      setShowUnmappedScrollHint(
        scrollHeight > clientHeight &&
          scrollTop + clientHeight < scrollHeight - 10
      )
    }
  }, [])

  const mappedMappings = mappings.filter(
    (mapping) => mapping.mappedColumn !== ""
  )
  const unmappedMappings = mappings.filter(
    (mapping) => mapping.mappedColumn === ""
  )

  const filteredMappedMappings = mappedMappings.filter((mapping) =>
    toSearchableText(mapping.origColumn).includes(mappedSearch.toLowerCase())
  )
  const filteredUnmappedMappings = unmappedMappings.filter((mapping) =>
    toSearchableText(mapping.origColumn).includes(unmappedSearch.toLowerCase())
  )

  useEffect(() => {
    if (sectionStates.mapped) {
      const handle = requestAnimationFrame(checkMappedScroll)
      return () => cancelAnimationFrame(handle)
    }
  }, [sectionStates.mapped, filteredMappedMappings, checkMappedScroll])

  useEffect(() => {
    if (sectionStates.unmapped) {
      const handle = requestAnimationFrame(checkUnmappedScroll)
      return () => cancelAnimationFrame(handle)
    }
  }, [sectionStates.unmapped, filteredUnmappedMappings, checkUnmappedScroll])

  useEffect(() => {
    if (mappings.length > 0 && !suggestionsApplied) {
      const fetchSuggestions = async () => {
        setIsSuggestionsLoading(true)
        try {
          const response = await fetch(
            `${BACKEND_URL}/suggest-mappings`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                columns: mappings.map((m) => m.origColumn),
              }),
            }
          )
          const suggestions: MappingSuggestion[] = await response.json()
          const newMappings = mappings.map((mapping) => {
            const suggestion = suggestions.find(
              (s: MappingSuggestion) => s.orig_column === mapping.origColumn
            )
            if (suggestion && suggestion.confidence > 0.5) {
              return { ...mapping, mappedColumn: suggestion.suggested_column }
            }
            return mapping
          })
          onMappingsChange(newMappings)
          setSuggestionsApplied(true)

          // Auto-expand sections if they have items
          const hasMapped = newMappings.some((m) => m.mappedColumn !== "")
          const hasUnmapped = newMappings.some((m) => m.mappedColumn === "")
          setSectionStates({
            mapped: hasMapped,
            unmapped: hasUnmapped,
          })
        } catch (error) {
          console.error("Failed to fetch suggestions:", error)
        } finally {
          setIsSuggestionsLoading(false)
        }
      }
      fetchSuggestions()
    }
  }, [mappings, suggestionsApplied, onMappingsChange])

  useEffect(() => {
    const fetchColumns = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/column-metadata`)
        const data = await response.json()
        const columns = data.map((col: ColumnMetadata) => ({
          value: col.column_name,
          label: col.column_name,
        }))
        setAvailableColumns(columns)
      } catch (error) {
        console.error("Failed to fetch column metadata:", error)
      }
    }
    fetchColumns()
  }, [])

  const handleMappingChange = (origColumn: string, newValue: string) => {
    const newMappings = mappings.map((mapping) =>
      mapping.origColumn === origColumn
        ? { ...mapping, mappedColumn: newValue }
        : mapping
    )
    onMappingsChange(newMappings)
  }

  const getSystemColumnLabel = (value: string) => {
    if (!value) return "Select mapping"
    const column = availableColumns.find((col) => col.value === value)
    return column?.label || value
  }

  const toggleOpen = (origColumn: string) => {
    setOpenStates((prev) => ({
      ...prev,
      [origColumn]: !prev[origColumn],
    }))
  }

  const renderMappingRow = (mapping: ColumnMapping) => {
    const usedMappedColumns = mappings
      .filter((m) => m.origColumn !== mapping.origColumn)
      .map((m) => m.mappedColumn)
      .filter((c) => c !== "")

    return (
      <div
        key={mapping.origColumn}
        className="flex items-center gap-4 rounded-lg border p-4"
      >
        {/* Original column name */}
        <div className="w-40 shrink-0">
          <span className="text-sm font-medium">{mapping.origColumn}</span>
        </div>

        {/* Arrow */}
        <div className="text-muted-foreground">
          <ChevronsUpDown className="h-4 w-4 rotate-90" />
        </div>

        {/* Dropdown for mapped column */}
        <Popover
          open={openStates[mapping.origColumn]}
          onOpenChange={() => toggleOpen(mapping.origColumn)}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openStates[mapping.origColumn]}
              className="flex-1 justify-between"
            >
              <span className="truncate">
                {getSystemColumnLabel(mapping.mappedColumn)}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search columns..." className="h-9" />
              <CommandList>
                <CommandEmpty>No column found.</CommandEmpty>
                <CommandGroup>
                  {availableColumns.map((column) => {
                    const isUsed = usedMappedColumns.includes(column.value)
                    if (isUsed) return null

                    return (
                      <CommandItem
                        key={column.value}
                        value={column.value}
                        onSelect={() => {
                          handleMappingChange(mapping.origColumn, column.value)
                          toggleOpen(mapping.origColumn)
                        }}
                      >
                        {column.label}
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            mapping.mappedColumn === column.value
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium">Mapped Columns</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Review AI suggestions
        </p>
      </div>

      {/* Column mappings */}
      <div className="flex flex-col gap-6">
        {isSuggestionsLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Finding AI mappings...
            </p>
          </div>
        ) : (
          <>
            {/* Mapped section */}
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  setSectionStates((prev) => ({
                    ...prev,
                    mapped: !prev.mapped,
                  }))
                }
                className="h-auto w-full justify-start px-2 py-4"
                aria-expanded={sectionStates.mapped}
              >
                {sectionStates.mapped ? (
                  <ChevronDown className="mr-2 h-4 w-4" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                Mapped ({mappedMappings.length})
              </Button>
              {sectionStates.mapped && (
                <div className="ml-6 flex flex-col gap-4">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search mapped columns..."
                      value={mappedSearch}
                      onChange={(e) => setMappedSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="group/scroll relative">
                    <div
                      ref={mappedScrollRef}
                      onScroll={checkMappedScroll}
                      className="flex max-h-[400px] flex-col gap-4 overflow-y-auto rounded-lg border bg-muted/10 p-4 pr-2"
                    >
                      {filteredMappedMappings.map(renderMappingRow)}
                    </div>
                    {showMappedScrollHint && (
                      <>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-lg bg-gradient-to-t from-background/80 to-transparent" />
                        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground transition-all">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Unmapped section */}
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  setSectionStates((prev) => ({
                    ...prev,
                    unmapped: !prev.unmapped,
                  }))
                }
                className="h-auto w-full justify-start px-2 py-4"
                aria-expanded={sectionStates.unmapped}
              >
                {sectionStates.unmapped ? (
                  <ChevronDown className="mr-2 h-4 w-4" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                Unmapped ({unmappedMappings.length})
              </Button>
              {sectionStates.unmapped && (
                <div className="ml-6 flex flex-col gap-4">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search unmapped columns..."
                      value={unmappedSearch}
                      onChange={(e) => setUnmappedSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="group/scroll relative">
                    <div
                      ref={unmappedScrollRef}
                      onScroll={checkUnmappedScroll}
                      className="flex max-h-[400px] flex-col gap-4 overflow-y-auto rounded-lg border bg-muted/10 p-4 pr-2"
                    >
                      {filteredUnmappedMappings.map(renderMappingRow)}
                    </div>
                    {showUnmappedScrollHint && (
                      <>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-lg bg-gradient-to-t from-background/80 to-transparent" />
                        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground transition-all">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Confirm Mapping</Button>
      </div>
    </div>
  )
}
