"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { SidebarInset } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Loader2, Send, User } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"

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
      const response = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.slice(0, -1).map((message) => ({
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
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    )
                  }
                } catch {
                  // If parsing fails, treat as plain text (fallback)
                  if (!dataStr.startsWith("[ERROR]")) {
                    accumulatedContent += dataStr
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: accumulatedContent }
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
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content:
                  accumulatedContent.trim() ||
                  "I could not generate a response.",
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
                  {messages.map((message, index) => {
                    const isUser = message.role === "user"
                    const isStreamingAssistantMessage =
                      !isUser &&
                      isLoading &&
                      index === messages.length - 1 &&
                      !message.content.trim()

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
                              Thinking...
                            </span>
                          ) : isUser ? (
                            message.content
                          ) : (
                            <ReactMarkdown components={markdownComponents}>
                              {message.content}
                            </ReactMarkdown>
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
