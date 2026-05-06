// frontend/app/data/utils.ts
import { RecordRow, FilterCondition } from "./types"
import { BOOLEAN_TRUE_VALUES, BOOLEAN_FALSE_VALUES } from "./types"

export function toEditableCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function parseEditedCellValue(
  rawValue: string,
  originalValue: unknown
): unknown {
  const trimmed = rawValue.trim()

  if (
    Array.isArray(originalValue) ||
    (typeof originalValue === "object" && originalValue !== null)
  ) {
    if (!trimmed) {
      return null
    }

    try {
      return JSON.parse(rawValue)
    } catch {
      throw new Error("must be valid JSON")
    }
  }

  if (typeof originalValue === "number") {
    if (!trimmed) {
      throw new Error("cannot be empty for number fields")
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      throw new Error("must be a valid number")
    }

    return parsed
  }

  if (typeof originalValue === "boolean") {
    const normalized = trimmed.toLowerCase()
    if (BOOLEAN_TRUE_VALUES.has(normalized)) {
      return true
    }
    if (BOOLEAN_FALSE_VALUES.has(normalized)) {
      return false
    }

    throw new Error("must be true/false, yes/no, or 1/0")
  }

  if (originalValue === null || originalValue === undefined) {
    if (!trimmed) {
      return ""
    }

    if (trimmed === "null") {
      return null
    }

    if (BOOLEAN_TRUE_VALUES.has(trimmed.toLowerCase())) {
      return true
    }

    if (BOOLEAN_FALSE_VALUES.has(trimmed.toLowerCase())) {
      return false
    }

    const asNumber = Number(trimmed)
    if (!Number.isNaN(asNumber) && trimmed !== "") {
      return asNumber
    }

    if (
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed.startsWith('"')
    ) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return rawValue
      }
    }

    return rawValue
  }

  return rawValue
}

export function applyRowFilters(
  recordRows: RecordRow[],
  filters: FilterCondition[]
): RecordRow[] {
  if (filters.length === 0) {
    return recordRows
  }

  return recordRows.filter((row) => {
    // All filters must match (AND logic)
    for (const filter of filters) {
      const cellValue = row.data?.[filter.columnKey]
      const operator = filter.operator
      const filterValue = filter.value

      if (!filterValue.trim()) continue

      let matches = false

      try {
        if (operator === "contains") {
          // Case-insensitive substring match
          const cellStringValue = stringifyValue(cellValue).toLowerCase()
          const filterLower = filterValue.toLowerCase()
          matches = cellStringValue.includes(filterLower)
        } else if (operator === "=") {
          // Exact match
          const cellString = stringifyValue(cellValue).toLowerCase()
          const filterLower = filterValue.toLowerCase()
          matches = cellString === filterLower
        } else if (
          operator === ">" ||
          operator === "<" ||
          operator === ">=" ||
          operator === "<="
        ) {
          // Numeric comparisons
          const numericValue =
            cellValue !== null && cellValue !== undefined
              ? Number(cellValue)
              : NaN
          const filterNumber = Number(filterValue)

          if (!isNaN(numericValue) && !isNaN(filterNumber)) {
            if (operator === ">") {
              matches = numericValue > filterNumber
            } else if (operator === "<") {
              matches = numericValue < filterNumber
            } else if (operator === ">=") {
              matches = numericValue >= filterNumber
            } else if (operator === "<=") {
              matches = numericValue <= filterNumber
            }
          }
        }
      } catch {
        matches = false
      }

      if (!matches) {
        return false
      }
    }

    return true
  })
}

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}