"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
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

// List of all available columns in the system
const allSystemColumns = [
  { value: "local_name", label: "Local Name" },
  { value: "plant_height", label: "Plant Height (cm)" },
  { value: "tassel_color", label: "Tassel Color" },
  { value: "ear_height", label: "Ear Height (cm)" },
  { value: "days_to_silking", label: "Days to Silking" },
  { value: "days_to_anthesis", label: "Days to Anthesis" },
  { value: "grain_yield", label: "Grain Yield (kg/ha)" },
  { value: "moisture_content", label: "Moisture Content (%)" },
  { value: "stalk_rot_resistance", label: "Stalk Rot Resistance" },
  { value: "drought_tolerance", label: "Drought Tolerance" },
  { value: "waterlogging_tolerance", label: "Waterlogging Tolerance" },
  { value: "silk_color", label: "Silk Color" },
  { value: "grain_type", label: "Grain Type" },
  { value: "maturity_group", label: "Maturity Group" },
  { value: "region_adaptation", label: "Region Adaptation" },
]

interface ColumnMapping {
  origColumn: string
  mappedColumn: string
}

interface AIMappingStepProps {
  onBack: () => void
  onNext: () => void
  mappings: ColumnMapping[]
  onMappingsChange: (mappings: ColumnMapping[]) => void
}

// Display names for original columns
const origColumnDisplayNames: Record<string, string> = {
  Var_Name_Loc: "Var_Name_Loc",
  hgt_cm: "hgt_cm",
  p_tassel_color: "p_tassel_color",
}

export function AIMappingStep({
  onBack,
  onNext,
  mappings,
  onMappingsChange,
}: AIMappingStepProps) {
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})

  const handleMappingChange = (origColumn: string, newValue: string) => {
    const newMappings = mappings.map((mapping) =>
      mapping.origColumn === origColumn
        ? { ...mapping, mappedColumn: newValue }
        : mapping
    )
    onMappingsChange(newMappings)
  }

  const getSystemColumnLabel = (value: string) => {
    const column = allSystemColumns.find((col) => col.value === value)
    return column?.label || value
  }

  const toggleOpen = (origColumn: string) => {
    setOpenStates((prev) => ({
      ...prev,
      [origColumn]: !prev[origColumn],
    }))
  }

  const sortedMappings = [...mappings].sort((a, b) => {
    const aHasSuggestion = a.mappedColumn !== ""
    const bHasSuggestion = b.mappedColumn !== ""
    if (aHasSuggestion && !bHasSuggestion) return -1
    if (!aHasSuggestion && bHasSuggestion) return 1
    return 0
  })

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
      <div className="flex flex-col gap-4">
        {sortedMappings.map((mapping) => (
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
                  <CommandInput
                    placeholder="Search columns..."
                    className="h-9"
                  />
                  <CommandList>
                    <CommandEmpty>No column found.</CommandEmpty>
                    <CommandGroup>
                      {allSystemColumns.map((column) => (
                        <CommandItem
                          key={column.value}
                          value={column.value}
                          onSelect={() => {
                            handleMappingChange(
                              mapping.origColumn,
                              column.value
                            )
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
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        ))}
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
