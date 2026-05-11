export interface RecordRow {
  id: number
  data: Record<string, unknown>
  natural_language_description: string | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
  distance?: number | null
}

export interface RecordListResponse {
  records: RecordRow[]
  skip: number
  limit: number
}

export interface ColumnMetadataRow {
  column_name: string
  display_name: string
  data_type: string
  is_required: boolean
  default_value: string | null
  order: number | null
  description: string | null
}

export interface RecordSearchResponse {
  query: string
  top_k: number
  records: RecordRow[]
}

export interface FilterCondition {
  id: string
  columnKey: string
  operator: string
  value: string
}

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
export const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "yes"])
export const BOOLEAN_FALSE_VALUES = new Set(["false", "0", "no"])

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? value : ""
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]"
    }

    return value.map((item) => stringifyValue(item)).join(", ")
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return "[object]"
    }
  }

  return String(value)
}

export interface VisibleColumn {
  key: string
  label: string
}
