"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { SidebarInset } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Database, Loader2, Send, User } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"

const BACKEND_URL = "http://localhost:8000"
const GENERATE_URL = `${BACKEND_URL}/generate`
const SEARCH_RECORDS_URL = `${BACKEND_URL}/semantic-search/records`
const RAG_TOP_K = 5

type MessageRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: MessageRole
  content: string
  thinking?: string
  thinkingComplete?: boolean
  retrievedRecords?: RetrievedRecord[]
  retrievalComplete?: boolean
}

type RetrievedRecord = {
  id: number
  data: Record<string, unknown>
  natural_language_description: string | null
  distance?: number | null
  rerank_score?: number | null
}

type RecordSearchResponse = {
  query: string
  top_k: number
  records: RetrievedRecord[]
}

type RagRetrievalResult = {
  context: string | null
  records: RetrievedRecord[]
  completed: boolean
}

function createMessage(role: MessageRole, content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    content,
  }
}

const LoadingDots = () => (
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

function parseThinking(content: string): {
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

function formatRagRecord(record: RetrievedRecord, index: number): string {
  const description = record.natural_language_description?.trim()
  const serializedData = JSON.stringify(record.data)

  return [
    `Record ${index + 1} (id=${record.id})`,
    description ? `Description: ${description}` : `Data: ${serializedData}`,
  ].join("\n")
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? value : "-"
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

function getRecordTableColumns(records: RetrievedRecord[]): string[] {
  const keySet = new Set<string>()
  records.forEach((record) => {
    Object.keys(record.data ?? {}).forEach((key) => keySet.add(key))
  })
  return Array.from(keySet)
}

async function retrieveRagContext(query: string): Promise<RagRetrievalResult> {
  try {
    const response = await fetch(
      `${SEARCH_RECORDS_URL}?query=${encodeURIComponent(query)}&top_k=${RAG_TOP_K}`
    )

    if (!response.ok) {
      return { context: null, records: [], completed: false }
    }

    const data: RecordSearchResponse = await response.json()
    if (!data.records.length) {
      return { context: null, records: [], completed: true }
    }

    const formattedRecords = data.records
      .map((record, index) => formatRagRecord(record, index))
      .join("\n\n")

    const context = [
      "Use the retrieved inventory records below as grounding context.",
      "If the context does not contain the answer, clearly say so and avoid guessing.",
      "",
      formattedRecords,
    ].join("\n")

    return { context, records: data.records, completed: true }
  } catch {
    // Keep chat available even when retrieval is unavailable.
    return { context: null, records: [], completed: false }
  }
}

const markdownComponents = {
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

export default function Page() {
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRecords, setHasRecords] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [textareaMaxHeight, setTextareaMaxHeight] = useState(220)

  useEffect(() => {
    const fetchRecordCount = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/records/count`)
        if (!response.ok) {
          throw new Error("Failed to fetch record count")
        }

        const data: { count: number } = await response.json()
        setHasRecords(data.count > 0)
      } catch {
        // If the API is unavailable, keep chat usable.
        setHasRecords(true)
      }
    }

    void fetchRecordCount()
  }, [])

  const updateTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea || typeof window === "undefined") {
      return
    }

    const nextMaxHeight = Math.max(140, Math.floor(window.innerHeight * 0.32))
    setTextareaMaxHeight(nextMaxHeight)

    textarea.style.height = "0px"
    const nextHeight = Math.max(
      52,
      Math.min(textarea.scrollHeight, nextMaxHeight)
    )
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY =
      textarea.scrollHeight > nextMaxHeight ? "auto" : "hidden"
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    updateTextareaHeight()
  }, [inputValue, updateTextareaHeight])

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus()
    }
  }, [isLoading])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.addEventListener("resize", updateTextareaHeight)
    return () => {
      window.removeEventListener("resize", updateTextareaHeight)
    }
  }, [updateTextareaHeight])

  const sendMessage = async (content?: string) => {
    const nextContent = (content ?? inputValue).trim()
    if (!nextContent || isLoading) {
      return
    }

    const userMessage = createMessage("user", nextContent)
    const assistantMessage = createMessage("assistant", "")
    const nextMessages = [...messages, userMessage, assistantMessage]

    setMessages(nextMessages)
    setInputValue("")
    setError(null)
    setIsLoading(true)

    try {
      const conversationMessages = nextMessages.slice(0, -1).map((message) => ({
        role: message.role,
        content: message.content,
      }))

      const retrieval = await retrieveRagContext(nextContent)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                retrievedRecords: retrieval.records,
                retrievalComplete: retrieval.completed,
              }
            : msg
        )
      )

      const ragContext = retrieval.context
      const requestMessages =
        ragContext && conversationMessages.length > 0
          ? conversationMessages.map((message, index) => {
              const isLastMessage = index === conversationMessages.length - 1
              const isLastUserMessage = isLastMessage && message.role === "user"

              if (!isLastUserMessage) {
                return message
              }

              return {
                ...message,
                content: `${ragContext}\n\nUser question:\n${message.content}`,
              }
            })
          : conversationMessages

      const response = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: requestMessages,
          max_tokens: 1024,
        }),
      })

      if (!response.ok) {
        let detail = "Unable to generate a response right now."
        try {
          const data = (await response.json()) as { detail?: string }
          if (data.detail) {
            detail = data.detail
          }
        } catch {
          // Keep the default error message when response body is not JSON.
        }
        throw new Error(detail)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6)
              if (dataStr === "[DONE]") {
                // Stream ended
                break
              } else {
                try {
                  const parsed = JSON.parse(dataStr)
                  if (parsed.error) {
                    throw new Error(parsed.error)
                  } else if (parsed.token) {
                    accumulatedContent += parsed.token
                    const { thinking, answer, thinkingComplete } =
                      parseThinking(accumulatedContent)
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id
                          ? {
                              ...msg,
                              content: answer,
                              thinking: thinking || undefined,
                              thinkingComplete: thinking
                                ? thinkingComplete
                                : undefined,
                            }
                          : msg
                      )
                    )
                  }
                } catch {
                  // If parsing fails, treat as plain text (fallback)
                  if (!dataStr.startsWith("[ERROR]")) {
                    accumulatedContent += dataStr
                    const { thinking, answer, thinkingComplete } =
                      parseThinking(accumulatedContent)
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id
                          ? {
                              ...msg,
                              content: answer,
                              thinking: thinking || undefined,
                              thinkingComplete: thinking
                                ? thinkingComplete
                                : undefined,
                            }
                          : msg
                      )
                    )
                  } else {
                    throw new Error(dataStr.slice(8))
                  }
                }
              }
            }
          }
        }
      }

      // Finalize the message
      const { thinking, answer, thinkingComplete } = parseThinking(
        accumulatedContent.trim() || "I could not generate a response."
      )
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: answer,
                thinking: thinking || undefined,
                thinkingComplete: thinking ? thinkingComplete : undefined,
              }
            : msg
        )
      )
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unexpected error while calling the model."
      setError(message)
      // Remove the assistant message on error
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== assistantMessage.id)
      )
    } finally {
      setIsLoading(false)
    }
  }

  const renderComposer = (isCentered: boolean) => (
    <div className={`mx-auto w-full ${isCentered ? "max-w-4xl" : "max-w-3xl"}`}>
      <div className="flex items-end gap-2 rounded-[30px] border bg-background p-2.5 shadow-sm">
        <Textarea
          ref={textareaRef}
          style={{ maxHeight: `${textareaMaxHeight}px` }}
          className="h-[52px] min-h-[52px] resize-none border-0 bg-transparent text-sm leading-relaxed focus-visible:ring-0"
          placeholder="Ask about your cereals inventory..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void sendMessage()
            }
          }}
          disabled={isLoading}
        />

        <div className="flex items-center gap-1 pb-1">
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={() => void sendMessage()}
            disabled={isLoading || !inputValue.trim()}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col bg-muted/30">
          {hasRecords === null ? (
            <div className="flex flex-1 items-center justify-center px-4 sm:px-8">
              <div className="w-full max-w-3xl rounded-lg border bg-background p-6 text-center text-sm text-muted-foreground">
                Checking database status...
              </div>
            </div>
          ) : !hasRecords ? (
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
          ) : messages.length === 0 ? (
            <div className="flex flex-1 items-center px-4 sm:px-8">
              <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8">
                <h1 className="text-center text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                  Cereal Crops Search
                </h1>
                {renderComposer(true)}
                {error && (
                  <div className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                <div className="mx-auto w-full max-w-3xl space-y-6">
                  {messages.map((message, index) => {
                    const isUser = message.role === "user"
                    const isStreamingAssistantMessage =
                      !isUser &&
                      isLoading &&
                      index === messages.length - 1 &&
                      !message.content.trim() &&
                      !message.thinking?.trim() &&
                      message.retrievalComplete !== true

                    const recordColumns = getRecordTableColumns(
                      message.retrievedRecords ?? []
                    )
                    const hasRetrievedRecords =
                      !isUser && (message.retrievedRecords?.length ?? 0) > 0

                    return (
                      <div
                        key={message.id}
                        className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser && (
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}

                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            isUser
                              ? "bg-primary whitespace-pre-wrap text-primary-foreground"
                              : "border bg-background text-foreground"
                          }`}
                        >
                          {isStreamingAssistantMessage ? (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Retrieving relevant records...
                            </span>
                          ) : isUser ? (
                            message.content
                          ) : (
                            <div className="space-y-3">
                              {hasRetrievedRecords && (
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground">
                                    Retrieved relevant records
                                  </div>
                                  <div className="max-h-72 overflow-auto rounded-md border">
                                    <table className="w-full min-w-[560px] border-collapse text-xs">
                                      <thead className="sticky top-0 bg-muted">
                                        <tr>
                                          <th className="border-b px-2 py-1.5 text-left font-medium">
                                            ID
                                          </th>
                                          {recordColumns.map((column) => (
                                            <th
                                              key={`${message.id}-col-${column}`}
                                              className="border-b px-2 py-1.5 text-left font-medium"
                                            >
                                              {column}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {message.retrievedRecords?.map(
                                          (record) => (
                                            <tr
                                              key={`${message.id}-row-${record.id}`}
                                            >
                                              <td className="border-b px-2 py-1.5 align-top font-medium">
                                                {record.id}
                                              </td>
                                              {recordColumns.map((column) => (
                                                <td
                                                  key={`${message.id}-row-${record.id}-${column}`}
                                                  className="border-b px-2 py-1.5 align-top"
                                                >
                                                  {stringifyValue(
                                                    record.data?.[column]
                                                  )}
                                                </td>
                                              ))}
                                            </tr>
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {isLoading && index === messages.length - 1 && (
                                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Generating answer...
                                </div>
                              )}

                              {message.thinking && (
                                <details className="group">
                                  <summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                    <span className="transition-transform group-open:rotate-90">
                                      ▶
                                    </span>
                                    {message.thinkingComplete
                                      ? "Thought process"
                                      : "Thinking"}
                                    {!message.thinkingComplete && (
                                      <LoadingDots />
                                    )}
                                  </summary>
                                  <div className="mt-2 rounded-md border-l-2 border-muted bg-muted/50 p-3 text-sm text-muted-foreground">
                                    {message.thinking}
                                  </div>
                                </details>
                              )}
                              <ReactMarkdown components={markdownComponents}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {isUser && (
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="sticky bottom-0 border-t bg-background/95 px-4 py-4 backdrop-blur sm:px-8">
                {renderComposer(false)}
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </>
  )
}
