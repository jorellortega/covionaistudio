"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Header from "@/components/header"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"
import {
  formatUsd,
  SOURCE_LABELS,
  type ApiCostEvent,
} from "@/lib/api-cost-tracker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Loader2,
  Receipt,
  RefreshCw,
  Sparkles,
  Video,
} from "lucide-react"

type DateRange = "today" | "7d" | "30d" | "all"
type SourceFilter = "all" | "storyboard" | "shotlist" | "screenplay" | "workspace" | "cinema-production" | "other"

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All pages" },
  { value: "storyboard", label: "Storyboard" },
  { value: "shotlist", label: "Shot list" },
  { value: "screenplay", label: "Screenplay" },
  { value: "workspace", label: "Workspace" },
  { value: "cinema-production", label: "Cinema production" },
  { value: "other", label: "Other" },
]

function rangeStartIso(range: DateRange): string | null {
  const now = new Date()
  if (range === "today") {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }
  if (range === "7d") return new Date(now.getTime() - 7 * 86_400_000).toISOString()
  if (range === "30d") return new Date(now.getTime() - 30 * 86_400_000).toISOString()
  return null
}

function generationLabel(type: string): string {
  switch (type) {
    case "image":
      return "Image"
    case "video":
      return "Video"
    case "shot_list":
      return "Shot list"
    case "screenplay":
      return "Screenplay"
    case "chat":
      return "Chat"
    default:
      return "Text"
  }
}

function sourceIcon(source: string) {
  const className = "h-4 w-4"
  switch (source) {
    case "storyboard":
      return <ImageIcon className={className} />
    case "shotlist":
      return <Clapperboard className={className} />
    case "screenplay":
      return <FileText className={className} />
    case "workspace":
      return <Sparkles className={className} />
    case "cinema-production":
      return <Video className={className} />
    default:
      return <Receipt className={className} />
  }
}

export default function TrackerPage() {
  const { userId, ready } = useAuthReady()
  const [events, setEvents] = useState<ApiCostEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange>("30d")
  const [source, setSource] = useState<SourceFilter>("all")

  const loadEvents = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      let query = supabase
        .from("api_cost_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500)

      const start = rangeStartIso(range)
      if (start) query = query.gte("created_at", start)
      if (source !== "all") query = query.eq("source", source)

      const { data, error: queryError } = await query
      if (queryError) {
        const missingTable =
          queryError.message.includes("does not exist") ||
          queryError.message.includes("schema cache") ||
          queryError.code === "42P01"
        setError(
          missingTable
            ? "Cost tracking is not set up yet. Apply supabase/migrations/097_create_api_cost_events.sql, then refresh."
            : queryError.message,
        )
        setEvents([])
        return
      }
      setEvents((data || []) as ApiCostEvent[])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load cost events")
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [range, source, userId])

  useEffect(() => {
    if (!ready || !userId) return
    void loadEvents()
  }, [loadEvents, ready, userId])

  const totals = useMemo(() => {
    const totalSpend = events.reduce((sum, event) => sum + Number(event.cost_usd || 0), 0)
    const bySource = new Map<string, { spend: number; count: number }>()
    const byModel = new Map<string, { spend: number; count: number; provider: string }>()

    for (const event of events) {
      const sourceKey = event.source || "other"
      const sourceEntry = bySource.get(sourceKey) || { spend: 0, count: 0 }
      sourceEntry.spend += Number(event.cost_usd || 0)
      sourceEntry.count += 1
      bySource.set(sourceKey, sourceEntry)

      const modelKey = event.model || "unknown"
      const modelEntry = byModel.get(modelKey) || { spend: 0, count: 0, provider: event.provider }
      modelEntry.spend += Number(event.cost_usd || 0)
      modelEntry.count += 1
      byModel.set(modelKey, modelEntry)
    }

    const topModel = [...byModel.entries()].sort((a, b) => b[1].spend - a[1].spend)[0]
    return {
      totalSpend,
      count: events.length,
      average: events.length ? totalSpend / events.length : 0,
      topModel: topModel ? topModel[0] : "—",
      bySource: [...bySource.entries()].sort((a, b) => b[1].spend - a[1].spend),
      byModel: [...byModel.entries()].sort((a, b) => b[1].spend - a[1].spend),
    }
  }, [events])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 p-2">
                <Receipt className="h-6 w-6 text-white" />
              </span>
              <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                API cost tracker
              </span>
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              See how much each generation costs from Storyboard, Shot List, Screenplay, Workspace, and Cinema Production — including the model used.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(value) => setRange(value as DateRange)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(value) => setSource(value as SourceFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_FILTERS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void loadEvents()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total spend</CardDescription>
              <CardTitle className="text-3xl">{formatUsd(totals.totalSpend)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Generations</CardDescription>
              <CardTitle className="text-3xl">{totals.count}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average per generation</CardDescription>
              <CardTitle className="text-3xl">{formatUsd(totals.average)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Highest-cost model</CardDescription>
              <CardTitle className="truncate text-xl">{totals.topModel}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By page</CardTitle>
              <CardDescription>Spend grouped by where the generation ran</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {totals.bySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No generations in this range.</p>
              ) : (
                totals.bySource.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {sourceIcon(key)}
                      <span className="font-medium">{SOURCE_LABELS[key] || key}</span>
                      <Badge variant="outline">{value.count}</Badge>
                    </div>
                    <span className="tabular-nums font-semibold">{formatUsd(value.spend)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By model</CardTitle>
              <CardDescription>Which models are costing the most</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {totals.byModel.length === 0 ? (
                <p className="text-sm text-muted-foreground">No generations in this range.</p>
              ) : (
                totals.byModel.slice(0, 8).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{key}</p>
                      <p className="text-xs text-muted-foreground">
                        {value.provider} · {value.count} run{value.count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="tabular-nums font-semibold">{formatUsd(value.spend)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generation history</CardTitle>
            <CardDescription>
              Estimated USD from public list prices. Actual invoices from OpenAI, Anthropic, Kling, and Runway can differ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && events.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading costs…
              </div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No generations recorded yet. Create an image, video, screenplay, shot list, or workspace reply and it will show up here.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(event.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {sourceIcon(event.source)}
                          {SOURCE_LABELS[event.source] || event.source}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{generationLabel(event.generation_type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{event.model}</p>
                          <p className="text-xs text-muted-foreground">{event.provider}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.input_tokens || event.output_tokens
                          ? `${event.input_tokens || 0} in / ${event.output_tokens || 0} out`
                          : event.duration_seconds
                            ? `${event.duration_seconds}s`
                            : event.prompt_preview
                              ? event.prompt_preview.slice(0, 48) + (event.prompt_preview.length > 48 ? "…" : "")
                              : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatUsd(Number(event.cost_usd || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
