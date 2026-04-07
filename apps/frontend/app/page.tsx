"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { SidebarInset } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Database, Loader2, Send, Square, User } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"

const BACKEND_URL = "http://localhost:8000"
const GENERATE_URL = `${BACKEND_URL}/generate`
const SEARCH_RECORDS_URL = `${BACKEND_URL}/semantic-search/records`
const RAG_TOP_K = 5
const ROUTER_MAX_TOKENS = 80
const BASE_RESPONSE_MAX_TOKENS = 512
const RETRIEVAL_RESPONSE_MAX_TOKENS = 320

const TOOL_ROUTER_SYSTEM_PROMPT = [
  "You are a tool-routing assistant.",
  "Your primary goal is to decide whether to call search_database.",
  "Use search_database by default for any user request that could depend on inventory/database facts.",
  "This includes: questions about records, traits, values, IDs, comparisons, filtering, sorting, ranking, counts, trends, summaries, missing data, and any request about specific cereals/crops/items in the dataset.",
  "Also use search_database for follow-up questions that reference prior data (for example: 'which is best?', 'compare those', 'what about the first one?', 'why?').",
  "Only use 'none' for purely social/meta conversation that clearly does not require dataset facts (for example: hello, thanks, rewrite this sentence, explain your process, or general non-database chit-chat).",
  "Never choose 'none' just because the user phrasing is ambiguous. If there is any reasonable chance retrieval is needed, use search_database.",
  "If you are unsure, use search_database.",
  "Output ONLY valid JSON with one of these shapes:",
  '{"tool":"none"}',
  '{"tool":"search_database","query":"<optimized semantic search query>"}',
  "No markdown. No extra text.",
].join("\n")

type MessageRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: MessageRole
  content: string
  thinking?: string
  thinkingComplete?: boolean
  retrievedRecords?: RetrievedRecord[]
  retrievalComplete?: boolean
  retrievalQuery?: string
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

type ToolDecision =
  | {
      tool: "none"
    }
  | {
      tool: "search_database"
      query: string
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
  const preferredText =
    description && description.length > 0 ? description : serializedData

  return [
    `Record ${index + 1} (id=${record.id})`,
    `Description: ${preferredText}`,
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

function extractFirstJsonObject(text: string): string | null {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1]?.trim() ?? text.trim()
  const firstBrace = candidate.indexOf("{")
  const lastBrace = candidate.lastIndexOf("}")

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }

  return candidate.slice(firstBrace, lastBrace + 1)
}

function parseToolDecision(raw: string): ToolDecision {
  const jsonBlock = extractFirstJsonObject(raw)
  if (!jsonBlock) {
    return /search_database/i.test(raw)
      ? { tool: "search_database", query: "" }
      : { tool: "none" }
  }

  try {
    const parsed = JSON.parse(jsonBlock) as {
      tool?: unknown
      query?: unknown
    }
    if (parsed.tool === "search_database") {
      return {
        tool: "search_database",
        query: typeof parsed.query === "string" ? parsed.query.trim() : "",
      }
    }
  } catch {
    return /search_database/i.test(raw)
      ? { tool: "search_database", query: "" }
      : { tool: "none" }
  }

  return { tool: "none" }
}

async function streamGenerateTokens(
  requestMessages: Array<{ role: string; content: string }>,
  maxTokens: number,
  signal?: AbortSignal,
  onToken?: (token: string) => void
): Promise<string> {
  const response = await fetch(GENERATE_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: requestMessages,
      max_tokens: maxTokens,
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
  if (!reader) {
    return ""
  }

  const decoder = new TextDecoder()
  let sseBuffer = ""
  let accumulatedContent = ""

  const processEventData = (dataStr: string) => {
    if (dataStr === "[DONE]") {
      return
    }

    let parsed: { token?: unknown; error?: unknown } | null = null
    try {
      parsed = JSON.parse(dataStr) as {
        token?: unknown
        error?: unknown
      }
    } catch {
      parsed = null
    }

    if (parsed) {
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        throw new Error(parsed.error)
      }

      if (typeof parsed.token === "string") {
        accumulatedContent += parsed.token
        onToken?.(parsed.token)
      }
      return
    }

    if (dataStr.startsWith("[ERROR]")) {
      throw new Error(dataStr.slice(8))
    }

    accumulatedContent += dataStr
    onToken?.(dataStr)
  }

  const processEventBlock = (eventBlock: string) => {
    const normalizedBlock = eventBlock.replace(/\r/g, "")
    const dataLines = normalizedBlock
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())

    if (dataLines.length > 0) {
      processEventData(dataLines.join("\n"))
      return
    }

    const trimmed = normalizedBlock.trim()
    if (trimmed) {
      processEventData(trimmed)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    sseBuffer += decoder.decode(value, { stream: !done })

    let separatorIndex = sseBuffer.indexOf("\n\n")
    while (separatorIndex !== -1) {
      const eventBlock = sseBuffer.slice(0, separatorIndex)
      sseBuffer = sseBuffer.slice(separatorIndex + 2)

      processEventBlock(eventBlock)

      separatorIndex = sseBuffer.indexOf("\n\n")
    }

    if (done) {
      // Some servers flush a final chunk without the SSE \n\n delimiter.
      if (sseBuffer.trim()) {
        processEventBlock(sseBuffer)
      }
      break
    }
  }

  return accumulatedContent
}

async function decideRetrievalToolUse(
  conversationMessages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
  log?: (message: string) => void
): Promise<ToolDecision> {
  const lastUserMessage = [...conversationMessages]
    .reverse()
    .find((message) => message.role === "user")?.content
    ?.trim()

  const fallbackSearchDecision: ToolDecision = {
    tool: "search_database",
    query: lastUserMessage && lastUserMessage.length > 0 ? lastUserMessage : "",
  }

  const recentMessages = conversationMessages.slice(-8)
  const routingMessages = [
    { role: "system", content: TOOL_ROUTER_SYSTEM_PROMPT },
    ...recentMessages,
  ]

  const inputText = routingMessages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n")
  log?.(`ROUTER INPUT TEXT:\n${inputText}`)

  try {
    const decisionRaw = await streamGenerateTokens(
      routingMessages,
      ROUTER_MAX_TOKENS,
      signal
    )

    if (!decisionRaw.trim()) {
      log?.("ROUTER OUTPUT TEXT: [empty response; fallback=search_database]")
      return fallbackSearchDecision
    }

    log?.(`ROUTER OUTPUT TEXT:\n${decisionRaw}`)
    return parseToolDecision(decisionRaw)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    // Prefer retrieval on router failures so data questions still use grounding.
    log?.("ROUTER OUTPUT TEXT: [router error; fallback=search_database]")
    return fallbackSearchDecision
  }
}

async function retrieveRagContext(
  query: string,
  signal?: AbortSignal
): Promise<RagRetrievalResult> {
  try {
    const response = await fetch(
      `${SEARCH_RECORDS_URL}?query=${encodeURIComponent(query)}&top_k=${RAG_TOP_K}`,
      { signal }
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

    const fullContext = [
      "Use the retrieved inventory records below as grounding context.",
      "If the context does not contain the answer, clearly say so and avoid guessing.",
      "",
      formattedRecords,
    ].join("\n")

    return { context: fullContext, records: data.records, completed: true }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    // Keep chat available even when retrieval is unavailable.
    return { context: null, records: [], completed: false }
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
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
  const isLoadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestSeqRef = useRef(0)
  const activeRequestIdRef = useRef<number | null>(null)
  const [textareaMaxHeight, setTextareaMaxHeight] = useState(220)
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  const stopGeneration = useCallback(() => {
    activeRequestIdRef.current = null
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    isLoadingRef.current = false
    setIsLoading(false)
  }, [])

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
    if (!nextContent || isLoadingRef.current) {
      return
    }

    setDebugLogs((prev: string[]) => [
      ...prev,
      `=== NEW MESSAGE: ${nextContent} ===`,
    ])

    const requestId = ++requestSeqRef.current
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    activeRequestIdRef.current = requestId

    const userMessage = createMessage("user", nextContent)
    const assistantMessage = createMessage("assistant", "")
    const nextMessages = [...messages, userMessage, assistantMessage]

    setMessages(nextMessages)
    setInputValue("")
    setError(null)
    isLoadingRef.current = true
    setIsLoading(true)

    let streamedContent = ""

    try {
      const conversationMessages = nextMessages.slice(0, -1).map((message) => ({
        role: message.role,
        content: message.content,
      }))

      const toolDecision = await decideRetrievalToolUse(
        conversationMessages,
        abortController.signal,
        (log: string) => setDebugLogs((prev: string[]) => [...prev, log])
      )

      if (activeRequestIdRef.current !== requestId) {
        return
      }

      const shouldRetrieve = toolDecision.tool === "search_database"
      const retrievalQuery =
        shouldRetrieve && toolDecision.query.trim().length > 0
          ? toolDecision.query
          : nextContent

      const retrieval = shouldRetrieve
        ? await retrieveRagContext(retrievalQuery, abortController.signal)
        : { context: null, records: [], completed: true }

      if (activeRequestIdRef.current !== requestId) {
        return
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                retrievedRecords: retrieval.records,
                retrievalComplete: retrieval.completed,
                retrievalQuery: shouldRetrieve ? retrievalQuery : undefined,
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

      const inputText = requestMessages
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n\n")
      setDebugLogs((prev: string[]) => [
        ...prev,
        `GENERATION INPUT TEXT:\n${inputText}`,
      ])

      const responseMaxTokens = shouldRetrieve
        ? RETRIEVAL_RESPONSE_MAX_TOKENS
        : BASE_RESPONSE_MAX_TOKENS

      const accumulatedContent = await streamGenerateTokens(
        requestMessages,
        responseMaxTokens,
        abortController.signal,
        (token) => {
          if (activeRequestIdRef.current !== requestId) {
            return
          }

          streamedContent += token
          const { thinking, answer, thinkingComplete } =
            parseThinking(streamedContent)
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
        }
      )

      setDebugLogs((prev: string[]) => [
        ...prev,
        `GENERATION OUTPUT TEXT:\n${accumulatedContent}`,
      ])

      // Finalize the message
      if (activeRequestIdRef.current !== requestId) {
        return
      }

      const { thinking, answer, thinkingComplete } = parseThinking(
        streamedContent.trim() ||
          accumulatedContent.trim() ||
          "I could not generate a response."
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
      if (isAbortError(err)) {
        setMessages((prev) =>
          prev.filter(
            (msg) =>
              !(
                msg.id === assistantMessage.id &&
                !msg.content.trim() &&
                !msg.thinking?.trim()
              )
          )
        )
        return
      }

      if (activeRequestIdRef.current !== requestId) {
        return
      }

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
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null
        abortControllerRef.current = null
        isLoadingRef.current = false
        setIsLoading(false)
      }
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
            onClick={() => {
              if (isLoading) {
                stopGeneration()
                return
              }

              void sendMessage()
            }}
            disabled={!isLoading && !inputValue.trim()}
            aria-label={isLoading ? "Stop generation" : "Send message"}
          >
            {isLoading ? (
              <Square className="h-3.5 w-3.5" />
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
                                  {message.retrievalQuery && (
                                    <div className="text-xs text-muted-foreground">
                                      Query: &quot;{message.retrievalQuery}
                                      &quot;
                                    </div>
                                  )}
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

              <div className="px-4 py-4">
                <details className="w-full">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                    Debug Logs
                  </summary>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap text-muted-foreground">
                    {debugLogs.join("\n\n")}
                  </pre>
                </details>
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
