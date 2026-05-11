import { ReactNode } from "react"
import { HistoryEntry } from "@/lib/history-utils"

export function HistoryDetail({ entry }: { entry: HistoryEntry }) {
  const details = entry.details
  const parts: ReactNode[] = []

  switch (entry.action_type) {
    case "RECORDS_INGESTED":
      parts.push(
        <div key="inserted" className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-sm font-medium">Records Inserted</p>
            <p className="text-sm text-muted-foreground">
              {String(details.inserted_count)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Records Updated</p>
            <p className="text-sm text-muted-foreground">
              {String(details.updated_count)}
            </p>
          </div>
        </div>
      )
      if (details.mapping && typeof details.mapping === "object") {
        const mappingObj = details.mapping as Record<string, string>
        const mappingEntries = Object.entries(mappingObj)
        if (mappingEntries.length > 0) {
          parts.push(
            <div key="mapping">
              <p className="text-sm font-medium">Column Mappings</p>
              <div className="mt-1 space-y-1">
                {mappingEntries.map(([from, to]) => (
                  <p key={from} className="text-sm text-muted-foreground">
                    {from} → {to}
                  </p>
                ))}
              </div>
            </div>
          )
        }
      }
      break

    case "RECORD_UPDATED":
      parts.push(
        <div key="record-id">
          <p className="text-sm font-medium">Record ID</p>
          <p className="text-sm text-muted-foreground">
            {String(details.record_id)}
          </p>
        </div>
      )
      if (
        details.old_data &&
        details.new_data &&
        typeof details.old_data === "object" &&
        typeof details.new_data === "object"
      ) {
        const oldDataObj = details.old_data as Record<string, unknown>
        const newDataObj = details.new_data as Record<string, unknown>

        // Find changed fields
        const changedFields: Array<{
          field: string
          oldValue: unknown
          newValue: unknown
        }> = []
        const allKeys = new Set([
          ...Object.keys(oldDataObj),
          ...Object.keys(newDataObj),
        ])

        for (const key of allKeys) {
          if (
            JSON.stringify(oldDataObj[key]) !== JSON.stringify(newDataObj[key])
          ) {
            changedFields.push({
              field: key,
              oldValue: oldDataObj[key],
              newValue: newDataObj[key],
            })
          }
        }

        if (changedFields.length > 0) {
          parts.push(
            <div key="changes">
              <p className="text-sm font-medium">Changes</p>
              <div className="mt-2 space-y-3">
                {changedFields.map((change) => (
                  <div
                    key={change.field}
                    className="rounded border border-border bg-muted p-3"
                  >
                    <p className="text-sm font-medium">{change.field}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Before:</span>{" "}
                        {JSON.stringify(change.oldValue)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">After:</span>{" "}
                        {JSON.stringify(change.newValue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }
      }
      break

    case "RECORD_DELETED":
      parts.push(
        <div key="record-id">
          <p className="text-sm font-medium">Record ID</p>
          <p className="text-sm text-muted-foreground">
            {String(details.record_id)}
          </p>
        </div>
      )
      if (details.deleted_data && typeof details.deleted_data === "object") {
        parts.push(
          <div key="deleted-data">
            <p className="text-sm font-medium">Deleted Data</p>
            <pre className="mt-1 max-h-[200px] overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(details.deleted_data, null, 2)}
            </pre>
          </div>
        )
      }
      break

    case "COLUMN_ADDED":
      parts.push(
        <div key="column-info" className="space-y-3">
          <div>
            <p className="text-sm font-medium">Column Name</p>
            <p className="text-sm text-muted-foreground">
              {String(details.column_name)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Display Name</p>
            <p className="text-sm text-muted-foreground">
              {String(details.display_name)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Data Type</p>
            <p className="text-sm text-muted-foreground">
              {String(details.data_type)}
            </p>
          </div>
          {details.is_required === true && (
            <div>
              <p className="text-sm font-medium">Required</p>
              <p className="text-sm text-muted-foreground">Yes</p>
            </div>
          )}
        </div>
      )
      break

    case "COLUMN_DELETED":
      parts.push(
        <div key="column-name">
          <p className="text-sm font-medium">Column Name</p>
          <p className="text-sm text-muted-foreground">
            {String(details.column_name)}
          </p>
        </div>
      )
      break

    case "COLUMN_RENAMED":
      parts.push(
        <div key="rename-info" className="space-y-3">
          <div>
            <p className="text-sm font-medium">Old Name</p>
            <p className="text-sm text-muted-foreground">
              {String(details.old_column_name)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">New Name</p>
            <p className="text-sm text-muted-foreground">
              {String(details.new_column_name)}
            </p>
          </div>
        </div>
      )
      break

    case "DATABASE_RESET":
      parts.push(
        <div
          key="reset-warning"
          className="rounded-md border border-border bg-destructive/10 p-3"
        >
          <p className="text-sm font-medium text-destructive">Database Reset</p>
          <p className="mt-1 text-sm text-muted-foreground">
            All records and column metadata were deleted.
          </p>
        </div>
      )
      break

    default:
      parts.push(
        <pre
          key="default"
          className="max-h-[300px] overflow-auto rounded bg-muted p-2 text-xs"
        >
          {JSON.stringify(details, null, 2)}
        </pre>
      )
  }

  return <div className="space-y-3">{parts}</div>
}
