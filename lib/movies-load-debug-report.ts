import { formatMs, type LoadDebugSnapshot } from "@/lib/load-debug"
import type { MoviesFetchMeta } from "@/lib/movie-service"

export type MoviesLoadAuthDebug = {
  authLoading: boolean
  authReady: boolean
  authReadyMs: number | null
  hasSession: boolean
  hasUserId: boolean
  hasAccessToken: boolean
  userId: string | null
  userEmail: string | null
  sessionExpiresAt: number | null
  /** Why the movies fetch effect may be blocked */
  loadGateStatus: "ok" | "blocked"
  loadGateReason: string | null
}

export type MoviesLoadDebugReportInput = {
  snapshot: LoadDebugSnapshot | null
  auth: MoviesLoadAuthDebug
  moviesLoading: boolean
  moviesCount: number
  sharedLoading: boolean
  coversLoading: boolean
  loadCompleteMs: number | null
  elapsedMs: number
  localCacheCount: number
  apiMeta: MoviesFetchMeta | null
  pathname?: string
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

export function getMoviesLoadGateReason(
  auth: Omit<MoviesLoadAuthDebug, "loadGateStatus" | "loadGateReason">,
): string | null {
  if (auth.authLoading) return "AuthProvider still loading"
  if (!auth.hasSession) return "No session — protected layout should redirect to login"
  if (!auth.hasUserId) return "Session present but no userId"
  if (!auth.hasAccessToken) {
    return "No access_token — movies page blocks fetch until token is set (strict gate)"
  }
  return null
}

export function formatMoviesLoadDebugReport(input: MoviesLoadDebugReportInput): string {
  const {
    snapshot,
    auth,
    moviesLoading,
    moviesCount,
    sharedLoading,
    coversLoading,
    loadCompleteMs,
    elapsedMs,
    localCacheCount,
    apiMeta,
    pathname = "/movies",
  } = input

  const lines: string[] = [
    "=== Movies Load Debug ===",
    `Captured: ${new Date().toISOString()}`,
    `Page: ${pathname}`,
    `On page: ${formatMs(elapsedMs)}`,
    loadCompleteMs != null ? `Active load: ${formatMs(loadCompleteMs)}` : "Active load: in progress",
    `Status: ${moviesLoading || sharedLoading || coversLoading || auth.authLoading ? "loading" : loadCompleteMs != null ? "complete" : "idle"}`,
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
    auth.loadGateStatus === "ok"
      ? "auth strictness: OK — not blocking movies fetch"
      : "auth strictness: BLOCKING — fetch waiting on auth",
    "",
    "--- Load state ---",
    `movies loading: ${moviesLoading}`,
    `movies shown: ${moviesCount}`,
    `shared loading: ${sharedLoading}`,
    `covers loading: ${coversLoading}`,
    `local cache on load: ${localCacheCount > 0 ? `${localCacheCount} movies` : "none"}`,
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
      (apiMeta.queryMs ?? 0) > 2000 ? "slowQuery: true (IPv6 hang — restart dev with ipv4first)" : "slowQuery: false",
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

  return lines.join("\n")
}
