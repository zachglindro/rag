"use client"

import { useRouter } from "next/navigation"
import { Bot, ExternalLink, Loader2, User } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import {
  ChatMessage as ChatMessageType,
  LoadingDots,
  getRecordTableColumns,
  markdownComponents,
} from "@/lib/chat-utils"
import { RetrievalTable } from "./retrieval-table"

interface ChatMessageProps {
  message: ChatMessageType
  isLoading: boolean
  isLastMessage: boolean
}

export function ChatMessage({
  message,
  isLoading,
  isLastMessage,
}: ChatMessageProps) {
  const router = useRouter()
  const isUser = message.role === "user"
  const isStreamingAssistantMessage =
    !isUser &&
    isLoading &&
    isLastMessage &&
    !message.content.trim() &&
    !message.thinking?.trim() &&
    message.retrievalComplete !== true

  const recordColumns = getRecordTableColumns(message.retrievedRecords ?? [])
  const hasRetrievedRecords =
    !isUser && (message.retrievedRecords?.length ?? 0) > 0
  const hadRetrievalAttempt =
    !isUser &&
    message.retrievalComplete === true &&
    message.retrievalQuery !== undefined

  return (
    <div
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
            {hadRetrievalAttempt && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {hasRetrievedRecords
                      ? "Retrieved relevant records"
                      : "Search attempted"}
                    {hasRetrievedRecords && (
                      <span className="text-[10px] font-normal italic opacity-60">
                        (scroll to explore)
                      </span>
                    )}
                  </div>
                  {message.retrievalQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-[10px]"
                      onClick={() =>
                        router.push(
                          `/data?query=${encodeURIComponent(message.retrievalQuery || "")}&type=${message.retrievalSearchType || "semantic"}`
                        )
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                      View all
                    </Button>
                  )}
                </div>
                {message.retrievalQuery && (
                  <div className="text-xs text-muted-foreground">
                    Query: &quot;{message.retrievalQuery}&quot;
                  </div>
                )}
                {hasRetrievedRecords ? (
                  <RetrievalTable
                    records={message.retrievedRecords ?? []}
                    columns={recordColumns}
                    messageId={message.id}
                  />
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                    No matching records found in the database.
                  </div>
                )}
              </div>
            )}

            {isLoading && isLastMessage && (
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
                  {message.thinkingComplete ? "Thought process" : "Thinking"}
                  {!message.thinkingComplete && <LoadingDots />}
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
}
