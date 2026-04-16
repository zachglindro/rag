"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, RefreshCw, Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

const BACKEND_URL = "http://localhost:8000"

interface CompareStatusResponse {
  ready: boolean
  indexed_count: number | null
  last_updated: string | null
}

interface CompareSetupResponse {
  indexed_count: number
  setup_duration_ms: number
}

interface CompareRebuildResponse {
  indexed_count: number
  rebuild_duration_ms: number
}

interface RecordRow {
  id: number
  data: Record<string, unknown>
  natural_language_description: string | null
  created_at: string | null
  updated_at: string | null
  distance?: number | null
  rerank_score?: number | null
}

interface RecordSearchResponse {
  query: string
  top_k: number
  records: RecordRow[]
}

interface SearchResult {
  response: RecordSearchResponse | null
  duration: number | null
  error: string | null
}

async function fetchCompareStatus(): Promise<CompareStatusResponse> {
  const response = await fetch(`${BACKEND_URL}/compare/status`)
  if (!response.ok) {
    throw new Error("Failed to fetch compare status")
  }
  return response.json()
}

async function setupCompare(): Promise<CompareSetupResponse> {
  const response = await fetch(`${BACKEND_URL}/compare/setup`, {
    method: "POST",
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || "Setup failed")
  }
  return response.json()
}

async function rebuildCompareIndex(): Promise<CompareRebuildResponse> {
  const response = await fetch(`${BACKEND_URL}/compare/rebuild`, {
    method: "POST",
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || "Rebuild failed")
  }
  return response.json()
}

async function searchSemantic(
  query: string,
  topK: number
): Promise<RecordSearchResponse> {
  const response = await fetch(
    `${BACKEND_URL}/semantic-search/records?query=${encodeURIComponent(query)}&top_k=${topK}`
  )
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || "Semantic search failed")
  }
  return response.json()
}

async function searchKeyword(
  query: string,
  topK: number
): Promise<RecordSearchResponse> {
  const response = await fetch(
    `${BACKEND_URL}/keyword-search/records?query=${encodeURIComponent(query)}&top_k=${topK}`
  )
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || "Keyword search failed")
  }
  return response.json()
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

function getRecordTableColumns(records: RecordRow[]): string[] {
  const keySet = new Set<string>()
  records.forEach((record) => {
    Object.keys(record.data ?? {}).forEach((key) => keySet.add(key))
  })
  return Array.from(keySet)
}

export default function ComparePage() {
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [indexedCount, setIndexedCount] = useState<number | null>(null)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [query, setQuery] = useState("")
  const [topK, setTopK] = useState(10)
  const [isSearching, setIsSearching] = useState(false)
  const [semanticResult, setSemanticResult] = useState<SearchResult>({
    response: null,
    duration: null,
    error: null,
  })
  const [keywordResult, setKeywordResult] = useState<SearchResult>({
    response: null,
    duration: null,
    error: null,
  })

  const checkStatus = useCallback(async () => {
    setIsCheckingStatus(true)
    try {
      const status = await fetchCompareStatus()
      setIsReady(status.ready)
      setIndexedCount(status.indexed_count)
    } catch (error) {
      toast.error("Failed to check compare status")
      console.error(error)
    } finally {
      setIsCheckingStatus(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const handleSetup = async () => {
    setIsSettingUp(true)
    try {
      const result = await setupCompare()
      toast.success(
        `Compare mode set up with ${result.indexed_count} records (${result.setup_duration_ms}ms)`
      )
      await checkStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed")
      console.error(error)
    } finally {
      setIsSettingUp(false)
    }
  }

  const handleRebuild = async () => {
    setIsRebuilding(true)
    try {
      const result = await rebuildCompareIndex()
      toast.success(
        `Keyword index rebuilt with ${result.indexed_count} records (${result.rebuild_duration_ms}ms)`
      )
      await checkStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rebuild failed")
      console.error(error)
    } finally {
      setIsRebuilding(false)
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query")
      return
    }

    setIsSearching(true)
    setSemanticResult({ response: null, duration: null, error: null })
    setKeywordResult({ response: null, duration: null, error: null })

    const startTime = Date.now()

    try {
      const [semanticResponse, keywordResponse] = await Promise.allSettled([
        searchSemantic(query, topK),
        searchKeyword(query, topK),
      ])

      const endTime = Date.now()
      const totalDuration = endTime - startTime

      if (semanticResponse.status === "fulfilled") {
        setSemanticResult({
          response: semanticResponse.value,
          duration: totalDuration / 2,
          error: null,
        })
      } else {
        setSemanticResult({
          response: null,
          duration: null,
          error: semanticResponse.reason.message,
        })
      }

      if (keywordResponse.status === "fulfilled") {
        setKeywordResult({
          response: keywordResponse.value,
          duration: totalDuration / 2,
          error: null,
        })
      } else {
        setKeywordResult({
          response: null,
          duration: null,
          error: keywordResponse.reason.message,
        })
      }
    } catch (error) {
      toast.error("Search failed")
      console.error(error)
    } finally {
      setIsSearching(false)
    }
  }

  const semanticRecords = semanticResult.response?.records || []
  const keywordRecords = keywordResult.response?.records || []
  const semanticIds = new Set(semanticRecords.map((r) => r.id))
  const keywordIds = new Set(keywordRecords.map((r) => r.id))
  const overlapCount = Array.from(semanticIds).filter((id) =>
    keywordIds.has(id)
  ).length

  const allColumns = Array.from(
    new Set([
      ...getRecordTableColumns(semanticRecords),
      ...getRecordTableColumns(keywordRecords),
    ])
  )

  if (isCheckingStatus) {
    return (
      <>
        <AppSidebar />
        <SidebarInset>
          <div className="flex min-h-svh p-6">
            <div className="flex w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Checking compare status...</span>
            </div>
          </div>
        </SidebarInset>
      </>
    )
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh p-6">
          <div className="w-full space-y-6">
            <div>
              <h1 className="text-lg font-medium">Compare Search Methods</h1>
              <p className="text-sm text-muted-foreground">
                Compare semantic search (embeddings + reranking) vs keyword
                search (BM25 scoring)
              </p>
              {isReady && indexedCount !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Keyword index ready with {indexedCount} records
                </p>
              )}
            </div>

            {!isReady && (
              <div className="rounded-lg border p-6 text-center">
                <h2 className="mb-2 font-medium">Setup Required</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Keyword search requires an index to be built from your data.
                </p>
                <Button onClick={handleSetup} disabled={isSettingUp}>
                  {isSettingUp && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Set up comparison
                </Button>
              </div>
            )}

            {isReady && (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="mb-1 text-sm font-medium">Search Query</div>
                    <Input
                      id="query"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Enter search query..."
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                  </div>
                  <div className="w-24">
                    <div className="mb-1 text-sm font-medium">Top K</div>
                    <Select
                      value={String(topK)}
                      onValueChange={(value) => setTopK(Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={handleSearch} disabled={isSearching}>
                      {isSearching && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRebuild}
                      disabled={isRebuilding}
                    >
                      {isRebuilding && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Index
                    </Button>
                  </div>
                </div>

                {(semanticResult.response || keywordResult.response) && (
                  <div className="text-sm text-muted-foreground">
                    Semantic: {semanticRecords.length} results (
                    {semanticResult.duration}ms) • Keyword:{" "}
                    {keywordRecords.length} results ({keywordResult.duration}ms)
                    • Overlap: {overlapCount} records
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Semantic Search Panel */}
                  <div className="rounded-lg border">
                    <div className="border-b p-4">
                      <h3 className="font-medium">Semantic Search</h3>
                      <p className="text-sm text-muted-foreground">
                        Embeddings + reranking
                      </p>
                      {semanticResult.duration && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {semanticResult.duration}ms • {semanticRecords.length}{" "}
                          results
                        </p>
                      )}
                      {semanticResult.error && (
                        <p className="mt-1 text-xs text-red-600">
                          Error: {semanticResult.error}
                        </p>
                      )}
                    </div>
                    <div className="p-4">
                      {semanticRecords.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Score</TableHead>
                              <TableHead>ID</TableHead>
                              {allColumns.map((col) => (
                                <TableHead key={col}>{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {semanticRecords.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell>
                                  {record.rerank_score != null
                                    ? record.rerank_score.toFixed(3)
                                    : "-"}
                                </TableCell>
                                <TableCell>{record.id}</TableCell>
                                {allColumns.map((col) => (
                                  <TableCell key={col}>
                                    {stringifyValue(record.data[col])}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          {semanticResult.error
                            ? "Search failed"
                            : "No results"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Keyword Search Panel */}
                  <div className="rounded-lg border">
                    <div className="border-b p-4">
                      <h3 className="font-medium">Keyword Search</h3>
                      <p className="text-sm text-muted-foreground">
                        BM25 scoring
                      </p>
                      {keywordResult.duration && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {keywordResult.duration}ms • {keywordRecords.length}{" "}
                          results
                        </p>
                      )}
                      {keywordResult.error && (
                        <p className="mt-1 text-xs text-red-600">
                          Error: {keywordResult.error}
                        </p>
                      )}
                    </div>
                    <div className="p-4">
                      {keywordRecords.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Score</TableHead>
                              <TableHead>ID</TableHead>
                              {allColumns.map((col) => (
                                <TableHead key={col}>{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {keywordRecords.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell>
                                  {record.rerank_score != null
                                    ? record.rerank_score.toFixed(3)
                                    : "-"}
                                </TableCell>
                                <TableCell>{record.id}</TableCell>
                                {allColumns.map((col) => (
                                  <TableCell key={col}>
                                    {stringifyValue(record.data[col])}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          {keywordResult.error ? "Search failed" : "No results"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
