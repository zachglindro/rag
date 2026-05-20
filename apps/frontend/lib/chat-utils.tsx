import React from "react"

// ============================================================================
// TYPES
// ============================================================================

export type MessageRole = "user" | "assistant"

export type ChatMessage = {
  id: string
  role: MessageRole
  content: string
  thinking?: string
  thinkingComplete?: boolean
  retrievedRecords?: RetrievedRecord[]
  retrievalComplete?: boolean
  retrievalQuery?: string
  retrievalSearchType?: "semantic" | "keyword"
}

export type RetrievedRecord = {
  id: number
  data: Record<string, unknown>
  natural_language_description: string | null
  distance?: number | null
  rerank_score?: number | null
}

export type RecordSearchResponse = {
  query: string
  top_k: number
  records: RetrievedRecord[]
}

export type RagRetrievalResult = {
  context: string | null
  records: RetrievedRecord[]
  completed: boolean
}

// ============================================================================
// PURE UTILITY FUNCTIONS
// ============================================================================

export function createMessage(role: MessageRole, content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    content,
  }
}

export function parseThinking(content: string): {
  thinking: string | null
  answer: string
  thinkingComplete: boolean
} {
  const thinkStart = content.indexOf("<think>")
  const thinkEnd = content.indexOf("</think>")

  if (thinkStart !== -1 && thinkEnd !== -1 && thinkEnd > thinkStart) {
    const thinking = content.substring(thinkStart + 7, thinkEnd).trim()
    const answer =
      `${content.substring(0, thinkStart)}${content.substring(thinkEnd + 8)}`.trim()
    return { thinking, answer, thinkingComplete: true }
  }

  if (thinkStart !== -1) {
    const thinking = content.substring(thinkStart + 7).trim()
    const answer = content.substring(0, thinkStart).trim()
    return { thinking, answer, thinkingComplete: false }
  }

  return { thinking: null, answer: content, thinkingComplete: false }
}

export function formatRagRecord(
  record: RetrievedRecord,
  index: number
): string {
  const description = record.natural_language_description?.trim()
  const serializedData = JSON.stringify(record.data)
  const preferredText =
    description && description.length > 0 ? description : serializedData

  return [
    `Record ${index + 1} (id=${record.id})`,
    `Description: ${preferredText}`,
  ].join("\n")
}

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

export function getRecordTableColumns(records: RetrievedRecord[]): string[] {
  const keySet = new Set<string>()
  records.forEach((record) => {
    Object.keys(record.data ?? {}).forEach((key) => keySet.add(key))
  })
  return Array.from(keySet)
}

export function extractFirstJsonObject(text: string): string | null {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1]?.trim() ?? text.trim()
  const firstBrace = candidate.indexOf("{")
  const lastBrace = candidate.lastIndexOf("}")

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }

  return candidate.slice(firstBrace, lastBrace + 1)
}

export function parseToolDecision(raw: string): string {
  const jsonBlock = extractFirstJsonObject(raw)
  if (!jsonBlock) {
    return "none"
  }

  try {
    const parsed = JSON.parse(jsonBlock) as { query?: unknown }
    if (typeof parsed.query === "string") {
      return parsed.query.trim()
    }
  } catch {
    // Ignore
  }

  return "none"
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

// ============================================================================
// COMPONENTS
// ============================================================================

export const LoadingDots = () => (
  <span className="inline-flex space-x-0.5">
    <span className="animate-pulse">.</span>
    <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>
      .
    </span>
    <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>
      .
    </span>
  </span>
)

// ============================================================================
// MARKDOWN COMPONENTS
// ============================================================================

export const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  code: ({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) => {
    const isInline = !className
    return isInline ? (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
        {children}
      </code>
    ) : (
      <pre className="overflow-x-auto rounded-md bg-muted p-3">
        <code className="font-mono text-xs">{children}</code>
      </pre>
    )
  },
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-inside list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-inside list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-primary underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-muted pl-4 italic">
      {children}
    </blockquote>
  ),
}
