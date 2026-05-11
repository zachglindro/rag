import { BACKEND_URL } from "@/app/data/types"

export interface HistoryEntry {
  id: number
  timestamp: string
  action_type: string
  user_name: string | null
  details: Record<string, unknown>
  affected_records: number | null
  affected_column: string | null
}

export interface HistoryResponse {
  entries: HistoryEntry[]
  total_count: number
}

export const HISTORY_URL = `${BACKEND_URL}/history`
export const PAGE_SIZE = 50

export function getActionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    RECORDS_INGESTED: "Records Ingested",
    RECORD_UPDATED: "Record Updated",
    RECORD_DELETED: "Record Deleted",
    COLUMN_ADDED: "Column Added",
    COLUMN_DELETED: "Column Deleted",
    COLUMN_RENAMED: "Column Renamed",
    DATABASE_RESET: "Database Reset",
  }
  return labels[actionType] || actionType
}

export function getActionColor(actionType: string): string {
  switch (actionType) {
    case "RECORDS_INGESTED":
      return "text-foreground"
    case "RECORD_UPDATED":
      return "text-foreground"
    case "RECORD_DELETED":
      return "text-foreground"
    case "COLUMN_ADDED":
      return "text-foreground"
    case "COLUMN_DELETED":
      return "text-foreground"
    case "COLUMN_RENAMED":
      return "text-foreground"
    case "DATABASE_RESET":
      return "text-foreground font-semibold"
    default:
      return "text-foreground"
  }
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

export function formatDetails(
  details: Record<string, unknown>,
  actionType: string
): string {
  switch (actionType) {
    case "RECORDS_INGESTED": {
      const inserted = details.inserted_count || 0
      const updated = details.updated_count || 0
      const total = Number(inserted) + Number(updated)
      if (updated && Number(updated) > 0) {
        return `Ingested ${inserted} new records and updated ${updated} existing records`
      }
      return `Ingested ${total} new records`
    }

    case "RECORD_UPDATED": {
      const recordId = details.record_id || "unknown"
      return `Updated record #${recordId}`
    }

    case "RECORD_DELETED": {
      const recordId = details.record_id || "unknown"
      return `Deleted record #${recordId}`
    }

    case "COLUMN_ADDED": {
      const columnName = details.column_name || "unknown"
      const dataType = details.data_type || "unknown"
      return `Added column "${columnName}" (${dataType})`
    }

    case "COLUMN_DELETED": {
      const columnName = details.column_name || "unknown"
      return `Deleted column "${columnName}"`
    }

    case "COLUMN_RENAMED": {
      const oldName = details.old_column_name || "unknown"
      const newName = details.new_column_name || "unknown"
      return `Renamed column "${oldName}" to "${newName}"`
    }

    case "DATABASE_RESET":
      return "Database reset - all records and columns deleted"

    default:
      return "View details for more information"
  }
}
