import {
  RecordSearchResponse,
  RagRetrievalResult,
  formatRagRecord,
  parseToolDecision,
} from "@/lib/chat-utils"
import { BACKEND_URL } from "@/app/data/types"

const RAG_TOP_K = 5
const ROUTER_MAX_TOKENS = 80

// ============================================================================
// STREAM GENERATION
// ============================================================================

export async function streamGenerateTokens(
  requestMessages: Array<{ role: string; content: string }>,
  maxTokens: number,
  task: string = "general",
  databaseColumns?: string[],
  signal?: AbortSignal,
  onToken?: (token: string) => void
): Promise<string> {
  const GENERATE_URL = `${BACKEND_URL}/generate`

  const response = await fetch(GENERATE_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: requestMessages,
      max_tokens: maxTokens,
      task: task,
      database_columns: databaseColumns,
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

// ============================================================================
// SEARCH QUERY ROUTING
// ============================================================================

export async function getSearchQuery(
  conversationMessages: Array<{ role: string; content: string }>,
  databaseColumns: string[],
  signal?: AbortSignal,
  log?: (message: string) => void
): Promise<string> {
  const lastUserMessage = [...conversationMessages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content?.trim()

  const fallbackQuery =
    lastUserMessage && lastUserMessage.length > 0 ? lastUserMessage : ""

  const recentMessages = conversationMessages.slice(-8)
  const routingMessages = recentMessages

  const inputText = routingMessages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n")
  log?.(`ROUTER INPUT TEXT:\n${inputText}`)

  try {
    const queryRaw = await streamGenerateTokens(
      routingMessages,
      ROUTER_MAX_TOKENS,
      "routing",
      databaseColumns,
      signal
    )

    if (!queryRaw.trim()) {
      log?.("ROUTER OUTPUT TEXT: [empty response; fallback=last user message]")
      return fallbackQuery
    }

    log?.(`ROUTER OUTPUT TEXT:\n${queryRaw}`)
    return parseToolDecision(queryRaw)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    // Prefer retrieval on router failures so data questions still use grounding.
    log?.("ROUTER OUTPUT TEXT: [router error; fallback=last user message]")
    return fallbackQuery
  }
}

// ============================================================================
// RAG RETRIEVAL
// ============================================================================

export async function retrieveRagContext(
  query: string,
  searchType: "semantic" | "keyword",
  signal?: AbortSignal
): Promise<RagRetrievalResult> {
  try {
    const endpoint =
      searchType === "keyword"
        ? `${BACKEND_URL}/keyword-search/records`
        : `${BACKEND_URL}/semantic-search/records`

    const response = await fetch(
      `${endpoint}?query=${encodeURIComponent(query)}&top_k=${RAG_TOP_K}`,
      { signal }
    )

    if (!response.ok) {
      return { context: null, records: [], completed: false }
    }

    const data: RecordSearchResponse = await response.json()
    if (!data.records.length) {
      return {
        context:
          "No matching records found in the database for the given query.",
        records: [],
        completed: true,
      }
    }

    const formattedRecords = data.records
      .slice(0, 3)
      .map((record, index) => formatRagRecord(record, index))
      .join("\n\n")

    const fullContext = [
      "Use the retrieved inventory records below as grounding context.",
      "Your task is to analyze and summarize these records to answer the user, not to restate them verbatim.",
      "Do not dump raw rows, do not repeat every field/value, and do not copy the descriptions line-by-line.",
      "Provide concise conclusions, comparisons, or insights that are useful for decision-making.",
      "Only quote specific values when they directly support your conclusion.",
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
