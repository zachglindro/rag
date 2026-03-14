"use client"

import { useState, useMemo } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import maizeDataJson from "@/lib/maize_data.json"
import { Search, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

type MaizeRow = Record<string, string>
const maizeData = maizeDataJson as MaizeRow[]

type SortKey = string
type SortDirection = "asc" | "desc"

export default function DataPage() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterColumn, setFilterColumn] = useState<string>("")
  const [filterValue, setFilterValue] = useState<string>("")
  const [focusedApn, setFocusedApn] = useState<string>("")
  const columns = useMemo(() => {
    const columnSet = new Set<string>()

    for (const row of maizeData) {
      for (const key of Object.keys(row)) {
        columnSet.add(key)
      }
    }

    const allColumns = Array.from(columnSet)
    const apnIndex = allColumns.indexOf("APN")

    if (apnIndex > 0) {
      allColumns.splice(apnIndex, 1)
      allColumns.unshift("APN")
    }

    return allColumns
  }, [])

  const [sortKey, setSortKey] = useState<SortKey>("APN")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  useEffect(() => {
    const apnParam = (searchParams.get("apn") ?? "").trim()
    if (!apnParam) return

    setFilterColumn("APN")
    setFilterValue(apnParam)
    setFocusedApn(apnParam)

    // Wait until filter state is applied and row is rendered before scrolling.
    const timer = window.setTimeout(() => {
      const row = document.getElementById(`data-row-${apnParam}`)
      row?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchParams])

  const optionsByColumn = useMemo(() => {
    const map: Record<string, string[]> = {}

    for (const column of columns) {
      const options = new Set<string>()

      for (const row of maizeData) {
        const rawValue = (row[column] ?? "").toString().trim()
        if (rawValue) {
          options.add(rawValue)
        }
      }

      map[column] = Array.from(options).sort((a, b) => a.localeCompare(b))
    }

    return map
  }, [columns])

  const filterValueOptions = useMemo(() => {
    if (!filterColumn) return []
    return optionsByColumn[filterColumn] ?? []
  }, [filterColumn, optionsByColumn])

  const demoPresets = useMemo(
    () => [
      { label: "Province Iloilo", column: "Province", value: "Iloilo" },
      { label: "Kernel Color White", column: "Kernel_Color", value: "white" },
      { label: "Kernel Type Flint", column: "Kernel_Type", value: "flint" },
    ],
    []
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  const filteredAndSortedData = useMemo(() => {
    let result = [...maizeData]

    // Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((row) =>
        Object.values(row).some((value) => {
          const text = (value ?? "").toString().toLowerCase()
          return text.includes(query)
        })
      )
    }

    // Column/value filter
    if (filterColumn && filterValue) {
      const normalizedFilter = filterValue.toLowerCase()
      result = result.filter((row) => {
        const value = (row[filterColumn] ?? "").toString().toLowerCase()
        return value === normalizedFilter
      })
    }

    // Sort
    result.sort((a, b) => {
      const aVal = (a[sortKey] ?? "").toString()
      const bVal = (b[sortKey] ?? "").toString()

      // Try numeric comparison first
      const aNum = parseFloat(aVal)
      const bNum = parseFloat(bVal)

      let comparison: number
      if (!isNaN(aNum) && !isNaN(bNum)) {
        comparison = aNum - bNum
      } else {
        comparison = aVal.localeCompare(bVal)
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return result
  }, [searchQuery, filterColumn, filterValue, sortKey, sortDirection])

  const clearFilters = () => {
    setSearchQuery("")
    setFilterColumn("")
    setFilterValue("")
  }

  const applyQuickFilter = (column: string, targetValue: string) => {
    const columnOptions = optionsByColumn[column] ?? []
    const resolvedValue =
      columnOptions.find(
        (option) => option.toLowerCase() === targetValue.toLowerCase()
      ) ?? targetValue

    setFilterColumn(column)
    setFilterValue(resolvedValue)
  }

  const formatColumnLabel = (column: string) =>
    column
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4" />
    )
  }

  const SortableHeader = ({
    columnKey,
    children,
    className,
  }: {
    columnKey: SortKey
    children: React.ReactNode
    className?: string
  }) => (
    <TableHead className={className}>
      <Button
        variant="ghost"
        className="h-8 font-medium"
        onClick={() => handleSort(columnKey)}
      >
        {children}
        <SortIcon columnKey={columnKey} />
      </Button>
    </TableHead>
  )

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col p-6">
          <div className="mb-6 flex max-w-md min-w-0 flex-col gap-2 text-sm leading-loose">
            <h1 className="text-lg font-medium">Maize Germplasm Data</h1>
            <p className="text-muted-foreground">
              Browse {maizeData.length} accessions from the Cereals Inventory
            </p>
          </div>

          {/* Search + filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search across all columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="w-[220px]">
              <p className="mb-1 text-xs text-muted-foreground">Filter column</p>
              <Select
                value={filterColumn || undefined}
                onValueChange={(value) => {
                  setFilterColumn(value)
                  setFilterValue("")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column} value={column}>
                      {formatColumnLabel(column)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[240px]">
              <p className="mb-1 text-xs text-muted-foreground">Filter value</p>
              <Select
                value={filterValue || undefined}
                onValueChange={setFilterValue}
                disabled={!filterColumn || filterValueOptions.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      filterColumn ? "Choose value" : "Select a column first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filterValueOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!searchQuery && !filterColumn && !filterValue}
            >
              Clear filters
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">Example filters:</p>
            {demoPresets.map((preset) => {
              const isAvailable = (optionsByColumn[preset.column] ?? []).some(
                (value) => value.toLowerCase() === preset.value.toLowerCase()
              )
              const isActive =
                filterColumn === preset.column &&
                filterValue.toLowerCase() === preset.value.toLowerCase()

              return (
                <Button
                  key={preset.label}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  disabled={!isAvailable}
                  onClick={() => applyQuickFilter(preset.column, preset.value)}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>

          {/* Results count */}
          <div className="mb-2 text-sm text-muted-foreground">
            Showing {filteredAndSortedData.length} of {maizeData.length} entries
            {searchQuery && ` matching "${searchQuery}"`}
            {filterColumn && filterValue &&
              ` where ${formatColumnLabel(filterColumn)} is "${filterValue}"`}
          </div>

          {/* Table */}
          <div className="w-full max-w-screen overflow-x-auto rounded-md border">
            <Table className="min-w-max">
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  {columns.map((column, index) => (
                    <SortableHeader
                      key={column}
                      columnKey={column}
                      className={index === 0 ? "sticky left-0 bg-background z-10" : ""}
                    >
                      {formatColumnLabel(column)}
                    </SortableHeader>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.map((row, index) => (
                  <TableRow
                    id={`data-row-${row.APN || index}`}
                    key={row.APN || `row-${index}`}
                    className={focusedApn && row.APN?.toString() === focusedApn ? "bg-primary/10" : ""}
                  >
                    {columns.map((column, colIndex) => (
                      <TableCell
                        key={`${row.APN || index}-${column}`}
                        className={
                          colIndex === 0
                            ? `sticky left-0 z-10 font-medium ${
                                focusedApn && row.APN?.toString() === focusedApn
                                  ? "bg-primary/10"
                                  : "bg-background"
                              }`
                            : ""
                        }
                      >
                        {(row[column] ?? "").toString()}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
