export type StoryboardImageDebugStage =
  | "quick-start"
  | "generate-start"
  | "validation-failed"
  | "service-resolved"
  | "api-key-check"
  | "storyboard-resolved"
  | "prompt-built"
  | "references-collected"
  | "request-sent"
  | "response-received"
  | "save-start"
  | "save-complete"
  | "reference-edit-start"
  | "error"

export type StoryboardImageDebugEntry = {
  stage: StoryboardImageDebugStage
  data?: Record<string, unknown>
  ts: number
}

export type StoryboardImageTraceLevel = "info" | "ok" | "warn" | "error"

let lastDebugEntry: StoryboardImageDebugEntry | null = null

export function isStoryboardImageDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return process.env.NODE_ENV === "development"
  }

  try {
    return (
      process.env.NODE_ENV === "development" ||
      window.localStorage.getItem("storyboard-image-debug") === "1" ||
      new URLSearchParams(window.location.search).has("debug")
    )
  } catch {
    return process.env.NODE_ENV === "development"
  }
}

function redactValue(value: unknown): unknown {
  if (value == null) return value

  if (typeof value === "string") {
    if (value.startsWith("sk-") || value.startsWith("Bearer ")) {
      return `[redacted:${value.length} chars]`
    }
    if (value.length > 120) {
      return `${value.slice(0, 120)}… (${value.length} chars)`
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map(redactValue)
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/api[_-]?key/i.test(key)) {
        out[key] = nested ? "[redacted]" : nested
      } else {
        out[key] = redactValue(nested)
      }
    }
    return out
  }

  return value
}

export function pushStoryboardImageTrace(
  level: StoryboardImageTraceLevel,
  message: string,
  detail?: string,
): void {
  const prefix = `[storyboard-trace:${level}]`
  if (detail) console.log(prefix, message, detail)
  else console.log(prefix, message)
}

export function debugStoryboardImage(
  stage: StoryboardImageDebugStage,
  data?: Record<string, unknown>,
): StoryboardImageDebugEntry {
  const entry: StoryboardImageDebugEntry = {
    stage,
    data: data ? (redactValue(data) as Record<string, unknown>) : undefined,
    ts: Date.now(),
  }

  lastDebugEntry = entry

  if (isStoryboardImageDebugEnabled()) {
    console.log(`[storyboard-image] ${stage}`, entry.data ?? "")
  }

  return entry
}

export function getLastStoryboardImageDebug(): StoryboardImageDebugEntry | null {
  return lastDebugEntry
}

export function formatStoryboardImageDebug(entry: StoryboardImageDebugEntry | null): string {
  if (!entry) return "No debug info yet."
  const parts = [`stage=${entry.stage}`]
  if (entry.data) {
    for (const [key, value] of Object.entries(entry.data)) {
      parts.push(`${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    }
  }
  return parts.join(" | ")
}

export async function traceAsyncStep<T>(
  message: string,
  fn: () => Promise<T>,
  options?: { warnOnSlowMs?: number },
): Promise<T> {
  const started = Date.now()
  pushStoryboardImageTrace("info", `→ ${message}`)
  try {
    const result = await fn()
    const elapsed = Date.now() - started
    const slow = options?.warnOnSlowMs && elapsed >= options.warnOnSlowMs
    pushStoryboardImageTrace(slow ? "warn" : "ok", `✓ ${message}`, `${elapsed}ms`)
    return result
  } catch (error) {
    const elapsed = Date.now() - started
    const detail = error instanceof Error ? error.message : String(error)
    pushStoryboardImageTrace("error", `✗ ${message}`, `${detail} (${elapsed}ms)`)
    throw error
  }
}
