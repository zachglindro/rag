"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { SidebarInset } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Loader2, Mic, Plus, Send, User } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

const GENERATE_URL = "http://localhost:8000/generate"

type MessageRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: MessageRole
  content: string
}

function createMessage(role: MessageRole, content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    content,
  }
}

export default function Page() {
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [textareaMaxHeight, setTextareaMaxHeight] = useState(220)

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
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInputValue("")
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
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

      const data = (await response.json()) as { response?: string }
      const assistantReply =
        (data.response ?? "").trim() || "I could not generate a response."

      setMessages((prev) => [
        ...prev,
        createMessage("assistant", assistantReply),
      ])
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unexpected error while calling the model."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const renderComposer = (isCentered: boolean) => (
    <div className={`mx-auto w-full ${isCentered ? "max-w-4xl" : "max-w-3xl"}`}>
      <div className="flex items-end gap-2 rounded-[30px] border bg-background p-2.5 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
          disabled={isLoading}
          aria-label="Add attachment"
        >
          <Plus className="h-4 w-4" />
        </Button>

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
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
            disabled={isLoading}
            aria-label="Voice input"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={() => void sendMessage()}
            disabled={isLoading || !inputValue.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
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
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center px-4 sm:px-8">
              <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8">
                <h1 className="text-center text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                  What&apos;s on your mind today?
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
                  {messages.map((message) => {
                    const isUser = message.role === "user"

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
                          className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : "border bg-background text-foreground"
                          }`}
                        >
                          {message.content}
                        </div>

                        {isUser && (
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {isLoading && (
                    <div className="flex w-full justify-start gap-3">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  )}

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

          {messages.length === 0 && isLoading && (
            <div className="px-4 pb-4 sm:px-8">
              <div className="mx-auto flex w-full max-w-3xl justify-start gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </>
  )
}
