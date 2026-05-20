"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ChatMessage,
  createMessage,
  isAbortError,
  parseThinking,
} from "@/lib/chat-utils"
import {
  streamGenerateTokens,
  getSearchQuery,
  retrieveRagContext,
} from "@/lib/chat-api"
import { BACKEND_URL } from "@/app/data/types"

const BASE_RESPONSE_MAX_TOKENS = 1024
const RETRIEVAL_RESPONSE_MAX_TOKENS = 1024

// ============================================================================
// TYPES
// ============================================================================

export interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  inputValue: string
  setInputValue: (value: string) => void
  hasRecords: boolean | null
  llmAvailable: boolean | null
  enableDebugging: boolean
  searchType: "semantic" | "keyword"
  debugLogs: string[]
  sendMessage: (content?: string) => Promise<void>
  stopGeneration: () => void
  startNewChat: () => void
}

// ============================================================================
// HOOK
// ============================================================================

export function useChat(): UseChatReturn {
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRecords, setHasRecords] = useState<boolean | null>(null)
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null)
  const [enableDebugging, setEnableDebugging] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("enableDebugging") === "true"
    }
    return false
  })
  const [searchType, setSearchType] = useState<"semantic" | "keyword">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("searchType") as "semantic" | "keyword") ||
        "semantic"
      )
    }
    return "semantic"
  })
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  const isLoadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestSeqRef = useRef(0)
  const activeRequestIdRef = useRef<number | null>(null)

  // ========================================================================
  // INITIALIZATION EFFECTS
  // ========================================================================

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

  useEffect(() => {
    const fetchModelStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/model-status`)
        if (response.ok) {
          const data: {
            llm_available: boolean
            embedding_model_available: boolean
          } = await response.json()
          setLlmAvailable(data.llm_available)

          // If embedding model is not available, switch to keyword search
          if (!data.embedding_model_available) {
            setSearchType("keyword")
            localStorage.setItem("searchType", "keyword")
          }
        }
      } catch {
        // If the API is unavailable, assume models are available
        setLlmAvailable(true)
      }
    }

    void fetchModelStatus()

    // Refetch model status when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchModelStatus()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "enableDebugging") {
        setEnableDebugging(e.newValue === "true")
      }
      if (e.key === "searchType") {
        setSearchType((e.newValue as "semantic" | "keyword") || "semantic")
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  // ========================================================================
  // CONTROL FUNCTIONS
  // ========================================================================

  const stopGeneration = useCallback(() => {
    activeRequestIdRef.current = null
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    isLoadingRef.current = false
    setIsLoading(false)
  }, [])

  const startNewChat = useCallback(() => {
    stopGeneration()
    setMessages([])
    setInputValue("")
    setError(null)
    setDebugLogs([])
  }, [stopGeneration])

  // ========================================================================
  // SEND MESSAGE
  // ========================================================================

  const sendMessage = useCallback(
    async (content?: string) => {
      const nextContent = (content ?? inputValue).trim()
      if (!nextContent || isLoadingRef.current) {
        return
      }

      // Check if LLM is available
      if (llmAvailable === false) {
        setError("The large language model isn't downloaded.")
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
        const conversationMessages = nextMessages
          .slice(0, -1)
          .map((message) => ({
            role: message.role,
            content: message.content,
          }))

        // Fetch column metadata for the backend
        let databaseColumns: string[] = []
        try {
          const colResponse = await fetch(`${BACKEND_URL}/column-metadata`)
          if (colResponse.ok) {
            const colData = (await colResponse.json()) as {
              column_name: string
            }[]
            databaseColumns = colData.map((c) => c.column_name)
          }
        } catch (e) {
          setDebugLogs((prev) => [...prev, `Error fetching columns: ${e}`])
        }

        const searchQuery = await getSearchQuery(
          conversationMessages,
          databaseColumns,
          abortController.signal,
          (log: string) => setDebugLogs((prev: string[]) => [...prev, log])
        )

        if (activeRequestIdRef.current !== requestId) {
          return
        }

        const shouldRetrieve = searchQuery !== "none"
        const retrievalQuery = shouldRetrieve ? searchQuery : ""
        const retrieval = shouldRetrieve
          ? await retrieveRagContext(
              retrievalQuery,
              searchType,
              abortController.signal
            )
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
                  retrievalSearchType: shouldRetrieve ? searchType : undefined,
                }
              : msg
          )
        )

        const ragContext = retrieval.context
        const requestMessages =
          ragContext && conversationMessages.length > 0
            ? conversationMessages.map((message, index) => {
                const isLastMessage = index === conversationMessages.length - 1
                const isLastUserMessage =
                  isLastMessage && message.role === "user"

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
          "general",
          databaseColumns,
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
    },
    [inputValue, messages, llmAvailable, searchType]
  )

  return {
    messages,
    isLoading,
    error,
    inputValue,
    setInputValue,
    hasRecords,
    llmAvailable,
    enableDebugging,
    searchType,
    debugLogs,
    sendMessage,
    stopGeneration,
    startNewChat,
  }
}
