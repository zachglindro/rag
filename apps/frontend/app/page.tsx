"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { SidebarInset } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Loader2, Send, Sprout, User } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const suggestions = [
  "Accessions from Visayas with good bacterial stalk rot resistance",
  "Show me flint-type maize lines with purple silk and a plant height below 160 cm",
  "Lines with purple silk and early anthesis",
  "Varieties tolerant to waterlogging and perform well under drought conditions",
]

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
  const [showExamples, setShowExamples] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const sendMessage = async (content?: string) => {
    const nextContent = (content ?? inputValue).trim()
    if (!nextContent || isLoading) {
      return
    }

    const userMessage = createMessage("user", nextContent)
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInputValue("")
    setShowExamples(false)
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

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col bg-muted/30">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto w-full max-w-3xl space-y-6">
              {messages.length === 0 && (
                <div className="flex min-h-[65vh] flex-col items-center justify-center gap-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Sprout className="h-7 w-7 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-semibold">
                      Cereals Inventory Assistant
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Ask about traits, stress tolerance, and accession
                      filtering.
                    </p>
                  </div>

                  <div className="w-full max-w-2xl space-y-3">
                    {!showExamples && (
                      <Button
                        variant="outline"
                        onClick={() => setShowExamples(true)}
                      >
                        Show example prompts
                      </Button>
                    )}
                    {showExamples && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {suggestions.map((suggestion) => (
                          <Button
                            key={suggestion}
                            variant="outline"
                            className="h-auto min-h-[80px] w-full justify-start px-4 py-3 text-left text-sm leading-relaxed break-words whitespace-pre-wrap normal-case"
                            onClick={() => {
                              setInputValue(suggestion)
                            }}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
            <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border bg-background p-2 shadow-sm">
              <Textarea
                className="max-h-36 min-h-[52px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
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
              <Button
                size="icon"
                className="shrink-0"
                onClick={() => void sendMessage()}
                disabled={isLoading || !inputValue.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
