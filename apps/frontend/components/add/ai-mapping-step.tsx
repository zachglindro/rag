"use client"

import { useEffect, useState } from "react"
import {
  Check,
  ChevronsUpDown,
  ChevronRight,
  ChevronDown,
  Loader2,
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

  useEffect(() => {
    if (mappings.length > 0 && !suggestionsApplied) {
      const fetchSuggestions = async () => {
        setIsSuggestionsLoading(true)
        try {
          const response = await fetch(
            "http://localhost:8000/suggest-mappings",
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
        const response = await fetch("http://localhost:8000/column-metadata")
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
                  <Input
                    placeholder="Search mapped columns..."
                    value={mappedSearch}
                    onChange={(e) => setMappedSearch(e.target.value)}
                    className="mb-2"
                  />
                  {filteredMappedMappings.map(renderMappingRow)}
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
                  <Input
                    placeholder="Search unmapped columns..."
                    value={unmappedSearch}
                    onChange={(e) => setUnmappedSearch(e.target.value)}
                    className="mb-2"
                  />
                  {filteredUnmappedMappings.map(renderMappingRow)}
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
