"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ChatMessage } from "@/components/chat/chat-message"
import { ChatComposer } from "@/components/chat/chat-composer"
import { ChatEmptyState } from "@/components/chat/chat-empty-state"
import { useChat } from "@/hooks/use-chat"
import { useEffect, useRef } from "react"

export default function Page() {
  const {
    messages,
    isLoading,
    error,
    inputValue,
    setInputValue,
    hasRecords,
    llmAvailable,
    enableDebugging,
    debugLogs,
    sendMessage,
    stopGeneration,
    startNewChat,
  } = useChat()

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const showMessages =
    hasRecords !== null && hasRecords !== false && messages.length > 0

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="relative flex min-h-svh flex-col bg-muted/30">
          {messages.length > 0 && (
            <div className="fixed top-4 right-4 z-20">
              <Button
                variant="outline"
                size="sm"
                onClick={startNewChat}
                className="h-9 gap-2 rounded-full bg-black px-4 text-white shadow-sm hover:bg-gray-900"
              >
                <Plus className="h-4 w-4" />
                <span className="text-xs font-medium">New Chat</span>
              </Button>
            </div>
          )}

          {!showMessages ? (
            <ChatEmptyState
              hasRecords={hasRecords}
              onSend={sendMessage}
              onStop={stopGeneration}
              isLoading={isLoading}
              llmAvailable={llmAvailable}
              inputValue={inputValue}
              onInputChange={setInputValue}
              error={error}
            />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                <div className="mx-auto w-full max-w-3xl space-y-6">
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isLoading={isLoading}
                      isLastMessage={index === messages.length - 1}
                    />
                  ))}

                  {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="px-4 py-4">
                {enableDebugging && (
                  <details className="w-full">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                      Debug Logs
                    </summary>
                    <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap text-muted-foreground">
                      {debugLogs.join("\n\n")}
                    </pre>
                  </details>
                )}
              </div>

              <div className="sticky bottom-0 border-t bg-background/95 px-4 py-4 backdrop-blur sm:px-8">
                <ChatComposer
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={() => sendMessage()}
                  onStop={stopGeneration}
                  isLoading={isLoading}
                  llmAvailable={llmAvailable}
                />
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </>
  )
}
