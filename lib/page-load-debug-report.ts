import { formatMs, type LoadDebugSnapshot } from "@/lib/load-debug"
import type { MoviesFetchMeta } from "@/lib/movie-service"
import type { MoviesLoadAuthDebug } from "@/lib/movies-load-debug-report"

export type PageLoadStateLine = {
  label: string
  value: string
}

export type PageLoadDebugReportSection = {
  title: string
  lines: string[]
}

export type PageLoadDebugReportInput = {
  title: string
  pathname: string
  snapshot: LoadDebugSnapshot | null
  auth: MoviesLoadAuthDebug
  isLoading: boolean
  loadCompleteMs: number | null
  elapsedMs: number
  stateLines: PageLoadStateLine[]
  apiMeta?: MoviesFetchMeta | null
  extraSections?: PageLoadDebugReportSection[]
}

function maskEmail(email: string | null): string {
  if (!email) return "—"
  const [local, domain] = email.split("@")
  if (!domain) return email.slice(0, 3) + "…"
  return `${local.slice(0, 3)}…@${domain}`
}

function maskUserId(userId: string | null): string {
  if (!userId) return "—"
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`
}

export function formatPageLoadDebugReport(input: PageLoadDebugReportInput): string {
  const {
    title,
    pathname,
    snapshot,
    auth,
    isLoading,
    loadCompleteMs,
    elapsedMs,
    stateLines,
    apiMeta,
    extraSections = [],
  } = input

  const lines: string[] = [
    `=== ${title} ===`,
    `Captured: ${new Date().toISOString()}`,
    `Page: ${pathname}`,
    `On page: ${formatMs(elapsedMs)}`,
    loadCompleteMs != null ? `Active load: ${formatMs(loadCompleteMs)}` : "Active load: in progress",
    `Status: ${isLoading || auth.authLoading ? "loading" : loadCompleteMs != null ? "complete" : "idle"}`,
    "",
    "--- Auth ---",
    `authLoading: ${auth.authLoading}`,
    `authReady: ${auth.authReady}${auth.authReadyMs != null ? ` (${formatMs(auth.authReadyMs)})` : ""}`,
    `session: ${auth.hasSession ? "present" : "missing"}`,
    `userId: ${maskUserId(auth.userId)}`,
    `access_token: ${auth.hasAccessToken ? "present" : "missing"}`,
    `email: ${maskEmail(auth.userEmail)}`,
    auth.sessionExpiresAt
      ? `session expires: ${new Date(auth.sessionExpiresAt * 1000).toISOString()}`
      : "session expires: —",
    `load gate: ${auth.loadGateStatus}${auth.loadGateReason ? ` — ${auth.loadGateReason}` : ""}`,
    "",
    "--- Load state ---",
    ...stateLines.map((line) => `${line.label}: ${line.value}`),
    "",
    "--- API (last fetch) ---",
  ]

  if (apiMeta) {
    lines.push(
      `clientMs: ${apiMeta.clientMs ?? "?"}`,
      `totalMs: ${apiMeta.totalMs ?? "?"}`,
      `authMs: ${apiMeta.authMs ?? "?"}`,
      `queryMs: ${apiMeta.queryMs ?? "?"}`,
      `cached: ${apiMeta.cached ?? false}`,
      `serviceRole: ${apiMeta.serviceRole ?? false}`,
      (apiMeta.queryMs ?? 0) > 2000 ? "slowQuery: true" : "slowQuery: false",
    )
  } else {
    lines.push("(no API fetch completed yet)")
  }

  lines.push("", "--- Phases ---")
  if (!snapshot?.phases.length) {
    lines.push("(none)")
  } else {
    for (const phase of snapshot.phases) {
      const timing = phase.ms != null ? ` ${formatMs(phase.ms)}` : ""
      const detail = phase.detail ? ` — ${phase.detail}` : ""
      lines.push(`[${phase.status}] ${phase.name}${timing}${detail}`)
    }
  }

  lines.push("", "--- Notes ---")
  if (!snapshot?.notes.length) {
    lines.push("(none)")
  } else {
    lines.push(...snapshot.notes)
  }

  for (const section of extraSections) {
    lines.push("", `--- ${section.title} ---`, ...section.lines)
  }

  return lines.join("\n")
}
