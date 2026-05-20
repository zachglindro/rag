"use client"

import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RetrievedRecord, stringifyValue } from "@/lib/chat-utils"

interface RetrievalTableProps {
  records: RetrievedRecord[]
  columns: string[]
  messageId: string
}

export function RetrievalTable({
  records,
  columns,
  messageId,
}: RetrievalTableProps) {
  const router = useRouter()

  return (
    <div className="max-h-72 overflow-y-auto rounded-md border shadow-inner">
      <div className="overflow-x-auto">
        <Table className="min-w-[560px]">
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead className="h-8 px-2 py-1 text-[11px] font-semibold">
                ID
              </TableHead>
              {columns.map((column) => (
                <TableHead
                  key={`${messageId}-col-${column}`}
                  className="h-8 px-2 py-1 text-[11px] font-semibold"
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow
                key={`${messageId}-row-${record.id}`}
                className="cursor-pointer text-[11px]"
                onClick={() => router.push(`/data?highlight=${record.id}`)}
              >
                <TableCell className="px-2 py-1.5 font-medium">
                  {record.id}
                </TableCell>
                {columns.map((column) => (
                  <TableCell
                    key={`${messageId}-row-${record.id}-${column}`}
                    className="px-2 py-1.5"
                  >
                    {stringifyValue(record.data?.[column])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
