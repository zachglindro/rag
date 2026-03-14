"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sprout, Send } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import maizeDataJson from "@/lib/maize_data.json"
import { useRouter } from "next/navigation"

const suggestions = [
  "Accessions from Visayas with good bacterial stalk rot resistance",
  "Show me flint-type maize lines with purple silk and a plant height below 160 cm",
  "Lines with purple silk and early anthesis",
  "Varieties tolerant to waterlogging and perform well under drought conditions",
]

type MaizeRow = Record<string, string>
type QueryResult = {
  row: MaizeRow
  score: number
  reasons: string[]
  matchPercent: number
}

type QueryIntent = {
  waterlogging: boolean
  drought: boolean
  bacterialStalkRot: boolean
  flint: boolean
  purpleSilk: boolean
  earlyAnthesis: boolean
  visayas: boolean
  shortMaturity: boolean
  heightBelow?: number
}

const maizeData = maizeDataJson as MaizeRow[]

const VISAYAS_PROVINCES = [
  "aklan",
  "antique",
  "bohol",
  "capiz",
  "cebu",
  "guimaras",
  "iloilo",
  "leyte",
  "biliran",
  "eastern samar",
  "northern samar",
  "samar",
  "southern leyte",
  "negros occidental",
  "negros oriental",
  "siquijor",
]

const valueFor = (row: MaizeRow, keys: string[]) => {
  for (const key of keys) {
    const value = (row[key] ?? "").toString().trim()
    if (value) return value
  }
  return "Not specified"
}

const normalized = (value: string) => value.toLowerCase().trim()

const parseNumber = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const containsAny = (value: string, terms: string[]) => {
  const text = normalized(value)
  return terms.some((term) => text.includes(term))
}

const isPositiveTrait = (value: string) =>
  containsAny(value, ["resistant", "tolerant", "moderately resistant", "immune"])

const isNegativeTrait = (value: string) =>
  containsAny(value, [
    "susceptible",
    "highly susceptible",
    "not yet screened",
    "no data",
    "unknown",
  ])

const getQueryIntent = (query: string): QueryIntent => {
  const q = normalized(query)
  const heightMatch = q.match(/below\s*(\d+(?:\.\d+)?)/)

  return {
    waterlogging: q.includes("waterlogging"),
    drought: q.includes("drought"),
    bacterialStalkRot: q.includes("bacterial") || q.includes("stalk rot"),
    flint: q.includes("flint"),
    purpleSilk: q.includes("purple") && q.includes("silk"),
    earlyAnthesis: q.includes("early anthesis") || q.includes("early flowering"),
    visayas: q.includes("visayas"),
    shortMaturity:
      q.includes("short maturing") ||
      q.includes("early maturing") ||
      q.includes("quick growing"),
    heightBelow: heightMatch?.[1] ? Number.parseFloat(heightMatch[1]) : undefined,
  }
}

const getRowSearchText = (row: MaizeRow) =>
  Object.values(row)
    .map((value) => (value ?? "").toString().toLowerCase())
    .join(" ")

const calculateRawMatch = (query: string, row: MaizeRow): Omit<QueryResult, "matchPercent"> => {
  const q = normalized(query)
  const rowText = getRowSearchText(row)
  const intent = getQueryIntent(q)

  const waterlogging = valueFor(row, ["Waterlogging"])
  const drought = valueFor(row, ["Drought"])
  const bacterialStalkRot = valueFor(row, ["Bacterial_Stalk_Rot"])
  const kernelType = valueFor(row, ["Kernel_Type"])
  const silkColor = valueFor(row, ["Silk_color_2015", "Silk_color"])
  const anthesis = valueFor(row, ["Days_to_50__anthesis_2015", "Days_to_Anthesis"])
  const plantHeight = valueFor(row, ["Plant_Height_cm"])
  const region = valueFor(row, ["Region"])
  const province = valueFor(row, ["Province"])
  const maturity = valueFor(row, ["Maturity"])

  let score = 0
  const reasons: string[] = []

  if (intent.waterlogging) {
    if (isPositiveTrait(waterlogging)) {
      score += 34
      reasons.push(`Waterlogging response is \"${waterlogging}\"`)
    } else if (isNegativeTrait(waterlogging)) {
      score -= 16
    }
  }

  if (intent.drought) {
    if (isPositiveTrait(drought)) {
      score += 30
      reasons.push(`Drought response is \"${drought}\"`)
    } else if (isNegativeTrait(drought)) {
      score -= 14
    }
  }

  if (intent.bacterialStalkRot) {
    if (isPositiveTrait(bacterialStalkRot)) {
      score += 28
      reasons.push(`Bacterial stalk rot is \"${bacterialStalkRot}\"`)
    } else if (isNegativeTrait(bacterialStalkRot)) {
      score -= 12
    }
  }

  if (intent.flint) {
    if (containsAny(kernelType, ["flint"])) {
      score += 20
      reasons.push(`Kernel type is \"${kernelType}\"`)
    } else {
      score -= 8
    }
  }

  if (intent.purpleSilk) {
    if (containsAny(silkColor, ["purple"])) {
      score += 22
      reasons.push(`Silk color is \"${silkColor}\"`)
    } else {
      score -= 8
    }
  }

  if (intent.earlyAnthesis || intent.shortMaturity) {
    const anthesisDays = parseNumber(anthesis)
    if (anthesisDays && anthesisDays <= 60) {
      score += 24
      reasons.push(`Early anthesis candidate at ${anthesisDays} days`)
    } else if (anthesisDays && anthesisDays <= 65) {
      score += 12
    } else {
      const maturityText = normalized(maturity)
      if (containsAny(maturityText, ["short", "early", "2 month"])) {
        score += 12
        reasons.push(`Maturity profile is \"${maturity}\"`)
      } else {
        score -= 6
      }
    }
  }

  if (intent.heightBelow) {
    const height = parseNumber(plantHeight)
    if (height && height <= intent.heightBelow) {
      score += 20
      reasons.push(`Plant height (${height} cm) is below ${intent.heightBelow} cm`)
    } else if (height) {
      score -= 10
    } else {
      score -= 4
    }
  }

  if (intent.visayas) {
    const provinceNorm = normalized(province)
    if (
      containsAny(region, [" vi", "vii", "viii", "visayas"]) ||
      VISAYAS_PROVINCES.some((item) => provinceNorm.includes(item))
    ) {
      score += 14
      reasons.push(`Located in/near Visayas (${province})`)
    } else {
      score -= 6
    }
  }

  const stopWords = new Set([
    "from",
    "with",
    "that",
    "show",
    "lines",
    "line",
    "varieties",
    "variety",
    "good",
    "perform",
    "well",
    "under",
    "conditions",
    "type",
    "accessions",
  ])

  const queryTokens = q
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token))

  let tokenHits = 0
  for (const token of queryTokens) {
    if (rowText.includes(token)) tokenHits += 1
  }

  score += Math.min(20, tokenHits * 3)
  if (tokenHits > 0) {
    reasons.push(`Matched ${tokenHits} query keyword${tokenHits > 1 ? "s" : ""}`)
  }

  return { row, score, reasons }
}

export default function Page() {
  const router = useRouter()
  const [showExamples, setShowExamples] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [displayQuery, setDisplayQuery] = useState("")
  const [submittedQuery, setSubmittedQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
      }
    }
  }, [])

  const queryResults = useMemo(() => {
    if (!submittedQuery.trim()) return []

    const ranked = maizeData
      .map((row) => calculateRawMatch(submittedQuery, row))
      .sort((a, b) => b.score - a.score)

    const topResults = ranked.slice(0, 12)
    const topScore = topResults[0]?.score ?? 1
    const bottomScore = topResults[topResults.length - 1]?.score ?? 0

    return topResults.map((result, index) => {
      let matchPercent = 70

      if (topScore === bottomScore) {
        matchPercent = Math.max(70, 94 - index * 4)
      } else if (result.score > 0) {
        const normalizedScore = (result.score - bottomScore) / (topScore - bottomScore)
        matchPercent = Math.round(84 + normalizedScore * 15)
      } else {
        const normalizedScore = (result.score - bottomScore) / (topScore - bottomScore)
        matchPercent = Math.round(62 + normalizedScore * 16)
      }

      return {
        ...result,
        matchPercent: Math.max(55, Math.min(99, matchPercent)),
      }
    })
  }, [submittedQuery])

  const runSearch = (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return

    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
    }

    setSearchQuery(trimmed)
    setDisplayQuery(trimmed)
    setShowExamples(false)
    setIsLoading(true)

    loadingTimerRef.current = setTimeout(() => {
      setSubmittedQuery(trimmed)
      setIsLoading(false)
    }, 900)
  }

  const goToDataRow = (result: QueryResult) => {
    const apn = valueFor(result.row, ["APN"])
    if (apn === "Not specified") {
      router.push("/data")
      return
    }

    const params = new URLSearchParams({ apn })
    if (submittedQuery) {
      params.set("query", submittedQuery)
    }
    router.push(`/data?${params.toString()}`)
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          {/* Main content */}
          <div className="flex flex-1 flex-col items-center gap-8 p-6 pt-10">
            {/* Header with icon and title */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sprout className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-xl font-medium">Cereals Inventory Search</h1>
            </div>

            {/* Examples button and suggestion cards */}
            <div className="flex w-full max-w-2xl flex-col items-center gap-3">
              {!showExamples && (
                <Button
                  variant="outline"
                  onClick={() => setShowExamples(true)}
                  className="text-sm"
                >
                  Examples
                </Button>
              )}
              {showExamples && (
                <div className="grid w-full grid-cols-2 gap-3">
                  {suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="h-auto min-h-[80px] w-full justify-start px-4 py-3 text-left text-sm leading-relaxed break-words whitespace-pre-wrap normal-case hover:bg-accent"
                      onClick={() => runSearch(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Query + results cards */}
            {displayQuery && (
              <div className="w-full max-w-4xl space-y-5">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-3xl bg-muted px-4 py-2.5 text-sm shadow-sm">
                    {displayQuery}
                  </div>
                </div>

                {isLoading && (
                  <div className="space-y-3 rounded-2xl border bg-card p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Sprout className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">Analyzing traits and ranking matches</p>
                      <div className="ml-1 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
                      <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
                      <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
                    </div>
                  </div>
                )}

                {!isLoading && submittedQuery && (
                  <div className="rounded-2xl border bg-card p-5">
                  <p className="mb-2 text-lg font-medium">
                    I found {queryResults.length} varieties that match your request for{" "}
                    <span className="font-semibold">&quot;{submittedQuery}&quot;</span>.
                  </p>
                  {queryResults[0] && (
                    <p className="text-sm text-muted-foreground">
                      The top result is{" "}
                      <span className="font-semibold">
                        {valueFor(queryResults[0].row, ["CGUARD_N", "APN"])}
                      </span>
                      , from {valueFor(queryResults[0].row, ["Province"])}.
                    </p>
                  )}

                  <div className="mt-5 space-y-5">
                    {queryResults.map((result, index) => {
                      const accession = valueFor(result.row, ["CGUARD_N", "APN"])
                      const localName = valueFor(result.row, ["Local_Name"])
                      const kernelType = valueFor(result.row, ["Kernel_Type"])
                      const kernelColor = valueFor(result.row, ["Kernel_Color"])
                      const waterlogging = valueFor(result.row, ["Waterlogging"])
                      const drought = valueFor(result.row, ["Drought"])
                      const location = `${valueFor(result.row, ["Town_Municipality"])}${valueFor(result.row, ["Province"]) !== "Not specified" ? `, ${valueFor(result.row, ["Province"])}` : ""}`
                      const matchPct = result.matchPercent

                      return (
                        <button
                          type="button"
                          key={`${accession}-${index}`}
                          className="w-full rounded-xl border bg-background p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-muted/40"
                          onClick={() => goToDataRow(result)}
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-xl font-semibold tracking-tight">
                              {accession} ({localName})
                            </h3>
                            <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                              {matchPct}% MATCH
                            </span>
                          </div>

                          <div className="mb-4 rounded-lg border-l-4 border-primary/70 bg-primary/10 px-3 py-2 text-sm">
                            <span className="font-semibold">AI Insight:</span>{" "}
                            {result.reasons[0] ?? "General trait overlap with your query"}
                          </div>

                          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                            <p>
                              <span className="font-semibold">Kernel Type:</span> {kernelType}
                            </p>
                            <p>
                              <span className="font-semibold">Kernel Color:</span> {kernelColor}
                            </p>
                            <p>
                              <span className="font-semibold">Waterlogging:</span> {waterlogging}
                            </p>
                            <p>
                              <span className="font-semibold">Drought:</span> {drought}
                            </p>
                            <p>
                              <span className="font-semibold">Maturity:</span>{" "}
                              {valueFor(result.row, ["Maturity", "Days_to_50__anthesis_2015", "Days_to_Anthesis"])}
                            </p>
                            <p>
                              <span className="font-semibold">Location:</span> {location}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
                )}
              </div>
            )}
          </div>

          {/* Floating search bar */}
          <div className="sticky bottom-6 mx-auto w-full max-w-2xl px-6 pb-6">
            <div className="relative flex items-center gap-2 rounded-xl border bg-background p-2 shadow-lg">
              <Input
                className="flex-1 border-0 bg-transparent px-4 text-base focus-visible:ring-0"
                placeholder="Describe what you are looking for..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    runSearch(searchQuery)
                  }
                }}
              />
              <Button
                size="icon"
                className="shrink-0"
                onClick={() => runSearch(searchQuery)}
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
