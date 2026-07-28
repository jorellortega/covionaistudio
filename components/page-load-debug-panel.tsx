"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMs, type LoadDebugSnapshot } from "@/lib/load-debug"
import {
  formatPageLoadDebugReport,
  type PageLoadDebugReportSection,
  type PageLoadStateLine,
} from "@/lib/page-load-debug-report"
import {
  getMoviesLoadGateReason,
  type MoviesLoadAuthDebug,
} from "@/lib/movies-load-debug-report"
import type { MoviesFetchMeta } from "@/lib/movie-service"
import { Bug, Check, ChevronDown, ChevronUp, Clock, Copy, Gauge, Loader2, RefreshCw, X } from "lucide-react"

export type PageLoadDebugBadge = {
  label: string
  loading?: boolean
  variant?: "default" | "ok" | "warn" | "error"
}

type PageLoadDebugPanelProps = {
  title: string
  pathname?: string
  snapshot: LoadDebugSnapshot | null
  auth: MoviesLoadAuthDebug
  isLoading: boolean
  loadCompleteMs: number | null
  badges?: PageLoadDebugBadge[]
  stateLines?: PageLoadStateLine[]
  apiMeta?: MoviesFetchMeta | null
  extraSections?: PageLoadDebugReportSection[]
  onRetry?: () => void
  onMeasureMedia?: () => void
  defaultOpen?: boolean
  defaultVisible?: boolean
}

function phaseStatusColor(status: string) {
  switch (status) {
    case "running":
      return "bg-amber-500/20 text-amber-500 border-amber-500/30"
    case "done":
      return "bg-green-500/20 text-green-400 border-green-500/30"
    case "error":
      return "bg-red-500/20 text-red-400 border-red-500/30"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function badgeClassName(variant: PageLoadDebugBadge["variant"], loading?: boolean) {
  if (loading || variant === "warn") {
    return "text-[10px] border-amber-500/40 text-amber-500"
  }
  if (variant === "ok") {
    return "text-[10px] border-green-500/40 text-green-400"
  }
  if (variant === "error") {
    return "text-[10px] border-red-500/40 text-red-400"
  }
  return "text-[10px]"
}

export function PageLoadDebugPanel({
  title,
  pathname = "/",
  snapshot,
  auth,
  isLoading,
  loadCompleteMs,
  badges = [],
  stateLines = [],
  apiMeta = null,
  extraSections = [],
  onRetry,
  onMeasureMedia,
  defaultOpen = false,
  defaultVisible = false,
}: PageLoadDebugPanelProps) {
  const [visible, setVisible] = useState(defaultVisible)
  const [open, setOpen] = useState(defaultOpen)
  const [now, setNow] = useState(Date.now())
  const [copied, setCopied] = useState(false)

  const isActive = auth.authLoading || isLoading

  useEffect(() => {
    if (!isActive && !snapshot) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [isActive, snapshot])

  const elapsed = snapshot ? now - snapshot.pageLoadAt : 0
  const bottleneckPhase = snapshot?.phases
    .filter((p) => p.status === "done" && p.ms != null)
    .sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0))[0]

  const reportText = useMemo(
    () =>
      formatPageLoadDebugReport({
        title,
        pathname,
        snapshot,
        auth,
        isLoading,
        loadCompleteMs,
        elapsedMs: elapsed,
        stateLines,
        apiMeta,
        extraSections,
      }),
    [title, pathname, snapshot, auth, isLoading, loadCompleteMs, elapsed, stateLines, apiMeta, extraSections],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = reportText
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  const gateReason = auth.loadGateReason ?? getMoviesLoadGateReason(auth)

  if (!visible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-violet-500/40 bg-background/95 text-xs shadow-lg backdrop-blur-sm"
          onClick={() => setVisible(true)}
          title={`Show ${title.toLowerCase()}`}
        >
          {isActive ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
          ) : (
            <Bug className="h-3.5 w-3.5 text-violet-400" />
          )}
          Debug
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(100vw-2rem,26rem)]">
      <Card className="border-violet-500/40 bg-background/95 shadow-lg backdrop-blur-sm">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {isActive ? (
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              ) : (
                <Clock className="h-4 w-4 text-violet-400" />
              )}
              {title}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Hide debug panel"
                onClick={() => setVisible(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Copy debug report"
                onClick={() => void handleCopy()}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              {onRetry ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Retry load"
                  onClick={onRetry}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {onMeasureMedia ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Probe image/video load times (slow)"
                  onClick={onMeasureMedia}
                >
                  <Gauge className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
              >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className="text-[10px]">
              {isActive ? "loading" : loadCompleteMs != null ? `done ${formatMs(loadCompleteMs)}` : "idle"}{" "}
              {isActive ? formatMs(elapsed) : loadCompleteMs != null ? `(on page ${formatMs(elapsed)})` : ""}
            </Badge>
            <Badge
              variant="outline"
              className={
                auth.authLoading
                  ? "text-[10px] border-amber-500/40 text-amber-500"
                  : auth.authReady
                    ? "text-[10px] border-green-500/40 text-green-400"
                    : "text-[10px] border-red-500/40 text-red-400"
              }
            >
              auth {auth.authLoading ? "loading" : auth.authReady ? "ready" : "waiting"}
              {auth.authReadyMs != null ? ` (${formatMs(auth.authReadyMs)})` : ""}
            </Badge>
            <Badge
              variant="outline"
              className={
                auth.loadGateStatus === "ok"
                  ? "text-[10px] border-green-500/40 text-green-400"
                  : "text-[10px] border-red-500/40 text-red-400"
              }
            >
              gate {auth.loadGateStatus}
            </Badge>
            {badges.map((badge) => (
              <Badge
                key={badge.label}
                variant="outline"
                className={badgeClassName(badge.variant, badge.loading)}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
          {!isActive && bottleneckPhase ? (
            <p className="text-[10px] text-muted-foreground mt-2">
              Slowest step: <span className="text-foreground">{bottleneckPhase.name}</span> (
              {formatMs(bottleneckPhase.ms)})
            </p>
          ) : null}
          {extraSections[0]?.lines[0] ? (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
              {extraSections[0].lines[0]}
            </p>
          ) : null}
        </CardHeader>

        {open ? (
          <CardContent className="px-4 pb-4 pt-0 space-y-3 max-h-[45vh] overflow-y-auto">
            <div className="space-y-1.5 rounded border border-border/60 p-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Auth
              </p>
              <ul className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
                <li>loading: {String(auth.authLoading)}</li>
                <li>
                  ready: {String(auth.authReady)}
                  {auth.authReadyMs != null ? ` (${formatMs(auth.authReadyMs)})` : ""}
                </li>
                <li>session: {auth.hasSession ? "present" : "missing"}</li>
                <li>userId: {auth.userId ? `${auth.userId.slice(0, 8)}…` : "missing"}</li>
                <li>access_token: {auth.hasAccessToken ? "present" : "missing"}</li>
                <li>email: {auth.userEmail ? auth.userEmail.replace(/(.{3}).+(@.+)/, "$1…$2") : "—"}</li>
                <li
                  className={
                    auth.loadGateStatus === "ok"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  load gate: {auth.loadGateStatus}
                  {gateReason ? ` — ${gateReason}` : ""}
                </li>
              </ul>
            </div>

            {stateLines.length > 0 ? (
              <div className="space-y-1.5 rounded border border-border/60 p-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Load state
                </p>
                <ul className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
                  {stateLines.map((line) => (
                    <li key={line.label}>
                      {line.label}: {line.value}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!snapshot ? (
              <p className="text-xs text-muted-foreground">Waiting for load to start…</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Phases
                  </p>
                  {snapshot.phases.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No phases yet</p>
                  ) : (
                    <ul className="space-y-1">
                      {snapshot.phases.map((phase, index) => (
                        <li
                          key={`${phase.name}-${index}`}
                          className="text-xs rounded border border-border/60 px-2 py-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{phase.name}</span>
                            <Badge className={`text-[9px] shrink-0 ${phaseStatusColor(phase.status)}`}>
                              {phase.status}
                              {phase.ms != null ? ` · ${formatMs(phase.ms)}` : ""}
                            </Badge>
                          </div>
                          {phase.detail ? (
                            <p className="text-[10px] text-muted-foreground mt-0.5 break-words">
                              {phase.detail}
                            </p>
                          ) : null}
                          {phase.status === "running" && phase.startedAt ? (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                              running {formatMs(now - phase.startedAt)}…
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {apiMeta ? (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Last API
                    </p>
                    <ul className="text-[10px] text-muted-foreground font-mono space-y-0.5">
                      <li>query: {formatMs(apiMeta.queryMs)}</li>
                      <li>auth: {formatMs(apiMeta.authMs)}</li>
                      <li>total: {formatMs(apiMeta.totalMs)}</li>
                      <li>cached: {String(apiMeta.cached ?? false)}</li>
                    </ul>
                  </div>
                ) : null}

                {snapshot.notes.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Notes
                    </p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
                      {snapshot.notes.slice(-12).map((note, index) => (
                        <li key={`${note}-${index}`} className="break-words">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {extraSections.map((section) => (
                  <div key={section.title} className="space-y-1.5 rounded border border-border/60 p-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      {section.title}
                    </p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
                      {section.lines.map((line, index) => (
                        <li key={`${section.title}-${index}`} className="break-words">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] gap-1.5"
                    onClick={() => void handleCopy()}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy report
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {loadCompleteMs != null
                    ? `Active load finished in ${formatMs(loadCompleteMs)}.`
                    : "Loading in progress…"}{" "}
                  Copy report to share timing + auth gate status.
                </p>
              </>
            )}
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
