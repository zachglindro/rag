"use client"

import Image from "next/image"
import Link from "next/link"
import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatComposer } from "./chat-composer"

interface ChatEmptyStateProps {
  hasRecords: boolean | null
  onSend: (content?: string) => void
  onStop?: () => void
  isLoading: boolean
  llmAvailable: boolean | null
  inputValue: string
  onInputChange: (value: string) => void
  error: string | null
}

export function ChatEmptyState({
  hasRecords,
  onSend,
  onStop,
  isLoading,
  llmAvailable,
  inputValue,
  onInputChange,
  error,
}: ChatEmptyStateProps) {
  if (hasRecords === null) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-3xl rounded-lg border bg-background p-6 text-center text-sm text-muted-foreground">
          Checking database status...
        </div>
      </div>
    )
  }

  if (!hasRecords) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 rounded-2xl border bg-background p-10 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              There is currently no data in the database
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Add data first to unlock inventory search.
            </p>
          </div>
          <Button asChild>
            <Link href="/add">Add Data</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center px-4 sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8">
        <div className="flex items-center gap-6">
          <Image
            src="/ics-logo.png"
            alt="ICS Logo"
            width={180}
            height={180}
            priority
            className="h-auto w-auto"
          />
          <Image
            src="/cropped-IPB-logo.webp"
            alt="IPB Logo"
            width={180}
            height={180}
            priority
            className="h-auto w-auto"
          />
        </div>
        <h1 className="text-center text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          Cereal Crops Search
        </h1>
        <ChatComposer
          value={inputValue}
          onChange={onInputChange}
          onSend={() => onSend()}
          onStop={onStop}
          isLoading={isLoading}
          llmAvailable={llmAvailable}
          isCentered
        />
        {error && (
          <div className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
