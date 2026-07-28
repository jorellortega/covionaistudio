export type LoadDebugPhase = {
  name: string
  status: "pending" | "running" | "done" | "error"
  startedAt?: number
  endedAt?: number
  ms?: number
  detail?: string
}

export type LoadDebugSnapshot = {
  pageLoadAt: number
  phases: LoadDebugPhase[]
  notes: string[]
}

export function createLoadDebug(pageLoadAt = Date.now()): LoadDebugSnapshot {
  return { pageLoadAt, phases: [], notes: [] }
}

export function startPhase(snapshot: LoadDebugSnapshot, name: string, detail?: string): LoadDebugPhase {
  const phase: LoadDebugPhase = {
    name,
    status: "running",
    startedAt: Date.now(),
    detail,
  }
  snapshot.phases.push(phase)
  console.log(`🎬 [load] ▶ ${name}${detail ? ` — ${detail}` : ""}`)
  return phase
}

export function endPhase(phase: LoadDebugPhase, detail?: string) {
  phase.status = "done"
  phase.endedAt = Date.now()
  if (phase.startedAt) phase.ms = phase.endedAt - phase.startedAt
  if (detail) phase.detail = detail
  console.log(
    `🎬 [load] ✓ ${phase.name} (${formatMs(phase.ms)})${detail ? ` — ${detail}` : ""}`,
  )
}

export function failPhase(phase: LoadDebugPhase, detail: string) {
  phase.status = "error"
  phase.endedAt = Date.now()
  if (phase.startedAt) phase.ms = phase.endedAt - phase.startedAt
  phase.detail = detail
  console.log(`🎬 [load] ✗ ${phase.name} (${formatMs(phase.ms)}) — ${detail}`)
}

export function addNote(snapshot: LoadDebugSnapshot, note: string) {
  const elapsed = Date.now() - snapshot.pageLoadAt
  snapshot.notes.push(`${elapsed}ms: ${note}`)
  console.log(`🎬 [load] ${formatMs(elapsed)}: ${note}`)
}

export function elapsedSincePageLoad(snapshot: LoadDebugSnapshot) {
  return Date.now() - snapshot.pageLoadAt
}

export function formatMs(ms?: number) {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function cloneLoadDebugSnapshot(snapshot: LoadDebugSnapshot): LoadDebugSnapshot {
  return {
    pageLoadAt: snapshot.pageLoadAt,
    phases: snapshot.phases.map((phase) => ({ ...phase })),
    notes: [...snapshot.notes],
  }
}

/** Tracks load phases and optionally pushes snapshots to React state for on-page debug UI. */
export function createLoadDebugTracker(onUpdate?: (snapshot: LoadDebugSnapshot) => void) {
  const snapshot = createLoadDebug()
  const publish = () => onUpdate?.(cloneLoadDebugSnapshot(snapshot))

  return {
    snapshot,
    publish,
    startPhase(name: string, detail?: string) {
      const phase = startPhase(snapshot, name, detail)
      publish()
      return phase
    },
    endPhase(phase: LoadDebugPhase, detail?: string) {
      endPhase(phase, detail)
      publish()
    },
    failPhase(phase: LoadDebugPhase, detail: string) {
      failPhase(phase, detail)
      publish()
    },
    addNote(note: string) {
      addNote(snapshot, note)
      publish()
    },
  }
}
