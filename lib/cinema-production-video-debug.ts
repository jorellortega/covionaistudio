import { formatMs } from "@/lib/load-debug"

export type ShotVideoBottleneck =
  | "ok"
  | "api"
  | "cdn"
  | "no-video"
  | "error"
  | "pending"

export type ShotVideoLoadDiagnostic = {
  storyboardId: string
  shotNumber: number
  title: string
  apiMs: number
  apiStatus: number
  apiError?: string
  videoCount: number
  videoUrl?: string | null
  probeMs?: number | null
  probeNote?: string | null
  bottleneck: ShotVideoBottleneck
}

export type CinemaProductionVideoDiagnostics = {
  updatedAt: number
  shotCount: number
  staggerMsPerShot: number
  streamMs: number | null
  networkHint: string
  shotsWithVideo: number
  shotsWithoutVideo: number
  totalApiMs: number
  totalProbeMs: number
  sequentialStaggerMs: number
  shots: ShotVideoLoadDiagnostic[]
  summary: string
}

export function getNetworkHint(): string {
  if (typeof navigator === "undefined") return "unknown"
  const nav = navigator as Navigator & {
    connection?: {
      effectiveType?: string
      downlink?: number
      rtt?: number
      saveData?: boolean
    }
  }
  const conn = nav.connection
  if (!conn) return "Network API unavailable (cannot measure link speed)"
  const parts = [
    conn.effectiveType ? `type ${conn.effectiveType}` : null,
    conn.downlink != null ? `downlink ${conn.downlink}Mbps` : null,
    conn.rtt != null ? `rtt ${conn.rtt}ms` : null,
    conn.saveData ? "save-data on" : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "unknown connection"
}

export function classifyVideoBottleneck(
  shot: ShotVideoLoadDiagnostic & { apiOk?: boolean },
): ShotVideoBottleneck {
  const apiOk = shot.apiOk ?? (shot.apiStatus >= 200 && shot.apiStatus < 300)
  if (shot.apiStatus === 0 || shot.apiError) return "error"
  if (!apiOk) return "api"
  if (shot.videoCount === 0) return "no-video"
  if (shot.apiMs > 800) return "api"
  if (shot.probeNote && (shot.probeMs == null || shot.probeMs > 800)) {
    return shot.probeNote.includes("timeout") || (shot.probeMs ?? 0) > 800 ? "cdn" : "error"
  }
  if ((shot.probeMs ?? 0) > 1500) return "cdn"
  return "ok"
}

function apiOkFromStatus(status: number) {
  return status >= 200 && status < 300
}

export function buildShotDiagnostic(
  input: Omit<ShotVideoLoadDiagnostic, "bottleneck">,
): ShotVideoLoadDiagnostic {
  const apiOk = apiOkFromStatus(input.apiStatus)
  const shot = { ...input, apiOk }
  return {
    ...input,
    bottleneck: classifyVideoBottleneck(shot),
  }
}

export function probeVideoMetadata(
  url: string,
  timeoutMs = 20000,
): Promise<{ ms: number; note?: string }> {
  return new Promise((resolve) => {
    const started = performance.now()
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true

    let settled = false
    const finish = (note?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute("src")
      video.load()
      resolve({ ms: Math.round(performance.now() - started), note })
    }

    const timer = window.setTimeout(() => finish("probe timeout (CDN/network or large file)"), timeoutMs)
    video.addEventListener("loadedmetadata", () => finish())
    video.addEventListener("error", () => finish("video element error (bad URL, CORS, or storage)"))
    video.src = url
  })
}

export type ShotImageBottleneck = "ok" | "cdn" | "no-image" | "error" | "temp-url"

export type ShotImageLoadDiagnostic = {
  storyboardId: string
  shotNumber: number
  title: string
  imageUrl?: string | null
  imageHost: string
  probeMs?: number | null
  probeNote?: string | null
  bottleneck: ShotImageBottleneck
}

export type CinemaProductionImageDiagnostics = {
  updatedAt: number
  shotCount: number
  storyboardBatchMs: number | null
  staggerMsPerShot: number
  streamMs: number | null
  networkHint: string
  shotsWithImage: number
  shotsWithoutImage: number
  totalProbeMs: number
  sequentialStaggerMs: number
  shots: ShotImageLoadDiagnostic[]
  summary: string
}

export function imageHostLabel(url: string | null | undefined): string {
  if (!url) return "none"
  if (url.includes("cinema_files")) return "supabase storage"
  if (url.includes("oaidalleapiprodscus.blob.core.windows.net")) return "dalle temp (expires)"
  try {
    return new URL(url).hostname
  } catch {
    return "invalid url"
  }
}

export function classifyImageBottleneck(
  input: Omit<ShotImageLoadDiagnostic, "bottleneck">,
): ShotImageBottleneck {
  if (!input.imageUrl) return "no-image"
  if (input.imageHost.includes("dalle temp")) return "temp-url"
  if (input.probeNote) {
    return input.probeNote.includes("timeout") || (input.probeMs ?? 0) > 800 ? "cdn" : "error"
  }
  if ((input.probeMs ?? 0) > 1200) return "cdn"
  return "ok"
}

export function buildShotImageDiagnostic(
  input: Omit<ShotImageLoadDiagnostic, "bottleneck" | "imageHost"> & { imageHost?: string },
): ShotImageLoadDiagnostic {
  const imageHost = input.imageHost ?? imageHostLabel(input.imageUrl)
  const shot: ShotImageLoadDiagnostic = {
    ...input,
    imageHost,
    bottleneck: "ok",
  }
  return {
    ...shot,
    bottleneck: classifyImageBottleneck(shot),
  }
}

export function probeImageLoad(
  url: string,
  timeoutMs = 8000,
): Promise<{ ms: number; note?: string }> {
  return new Promise((resolve) => {
    const started = performance.now()
    const img = new Image()
    let settled = false
    const finish = (note?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      img.src = ""
      resolve({ ms: Math.round(performance.now() - started), note })
    }

    const timer = window.setTimeout(
      () => finish("probe timeout (CDN/network or large image)"),
      timeoutMs,
    )
    img.onload = () => finish()
    img.onerror = () => finish("image load error (bad URL, CORS, or storage)")
    img.src = url
  })
}

export function summarizeImageDiagnostics(
  shots: ShotImageLoadDiagnostic[],
  options: {
    storyboardBatchMs: number | null
    staggerMsPerShot: number
    streamMs: number | null
    networkHint: string
  },
): CinemaProductionImageDiagnostics {
  const shotsWithImage = shots.filter((s) => Boolean(s.imageUrl)).length
  const shotsWithoutImage = shots.length - shotsWithImage
  const probed = shots.filter((s) => s.probeMs != null)
  const totalProbeMs = probed.reduce((sum, s) => sum + (s.probeMs ?? 0), 0)
  const sequentialStaggerMs = Math.max(0, shots.length - 1) * options.staggerMsPerShot

  const cdnSlow = [...probed].sort((a, b) => (b.probeMs ?? 0) - (a.probeMs ?? 0))[0]
  const cdnCount = shots.filter((s) => s.bottleneck === "cdn").length
  const tempCount = shots.filter((s) => s.bottleneck === "temp-url").length
  const noImageCount = shots.filter((s) => s.bottleneck === "no-image").length

  let summary = "Images come from storyboard.image_url (batch-loaded with Fetch storyboards)."
  if (options.storyboardBatchMs != null) {
    summary += ` Batch DB fetch: ${formatMs(options.storyboardBatchMs)}.`
  }
  if (shots.length === 0) {
    summary = "No shot image probes yet."
  } else if (cdnCount > 0) {
    summary = `CDN/network is the main image delay for ${cdnCount} shot(s) — storage download is slow.`
  } else if (tempCount > 0) {
    summary = `${tempCount} shot(s) use expired DALL·E temp URLs — re-save to Supabase storage.`
  } else if (noImageCount > 0) {
    summary = `${noImageCount} shot(s) have no image_url on the storyboard row.`
  } else if (sequentialStaggerMs > 500) {
    summary = `Intentional image stagger adds ~${formatMs(sequentialStaggerMs)} across ${shots.length} shots.`
  }

  if (cdnSlow && (cdnSlow.probeMs ?? 0) > 800) {
    summary += ` Slowest image: shot ${cdnSlow.shotNumber} (${formatMs(cdnSlow.probeMs)} · ${cdnSlow.imageHost}).`
  }

  return {
    updatedAt: Date.now(),
    shotCount: shots.length,
    storyboardBatchMs: options.storyboardBatchMs,
    staggerMsPerShot: options.staggerMsPerShot,
    streamMs: options.streamMs,
    networkHint: options.networkHint,
    shotsWithImage,
    shotsWithoutImage,
    totalProbeMs,
    sequentialStaggerMs,
    shots,
    summary,
  }
}

export function formatCinemaProductionImageDiagnostics(
  diagnostics: CinemaProductionImageDiagnostics | null,
): string[] {
  if (!diagnostics) return ["(no image diagnostics yet)"]

  const lines = [
    `summary: ${diagnostics.summary}`,
    `network: ${diagnostics.networkHint}`,
    `storyboard batch (DB): ${diagnostics.storyboardBatchMs != null ? formatMs(diagnostics.storyboardBatchMs) : "—"}`,
    `shots probed: ${diagnostics.shotCount} (${diagnostics.shotsWithImage} with url, ${diagnostics.shotsWithoutImage} without)`,
    `stream total: ${diagnostics.streamMs != null ? formatMs(diagnostics.streamMs) : "in progress"}`,
    `image probe time (sum): ${formatMs(diagnostics.totalProbeMs)}`,
    `sequential stagger overhead: ~${formatMs(diagnostics.sequentialStaggerMs)} (${diagnostics.staggerMsPerShot}ms × ${Math.max(0, diagnostics.shotCount - 1)} gaps)`,
    "",
    "Per shot (host · probe · bottleneck):",
  ]

  for (const shot of diagnostics.shots) {
    const probe =
      shot.probeMs != null ? formatMs(shot.probeMs) : shot.imageUrl ? "skipped" : "—"
    const note = shot.probeNote ? ` — ${shot.probeNote}` : ""
    lines.push(
      `  shot ${shot.shotNumber} [${shot.bottleneck}] ${shot.imageHost} · probe ${probe}${note}`,
    )
  }

  lines.push(
    "",
    "How to read bottlenecks:",
    "  cdn — image download from storage slow (internet, file size, region)",
    "  no-image — storyboard row has no image_url",
    "  temp-url — DALL·E temp URL (often broken/expired); save to bucket",
    "  error — image element failed to load",
    "  ok — image loaded quickly",
  )

  return lines
}

export function summarizeVideoDiagnostics(
  shots: ShotVideoLoadDiagnostic[],
  options: {
    staggerMsPerShot: number
    streamMs: number | null
    networkHint: string
  },
): CinemaProductionVideoDiagnostics {
  const shotsWithVideo = shots.filter((s) => s.videoCount > 0).length
  const shotsWithoutVideo = shots.length - shotsWithVideo
  const totalApiMs = shots.reduce((sum, s) => sum + s.apiMs, 0)
  const probed = shots.filter((s) => s.probeMs != null)
  const totalProbeMs = probed.reduce((sum, s) => sum + (s.probeMs ?? 0), 0)
  const sequentialStaggerMs = Math.max(0, shots.length - 1) * options.staggerMsPerShot

  const apiSlow = [...shots].sort((a, b) => b.apiMs - a.apiMs)[0]
  const cdnSlow = [...probed].sort((a, b) => (b.probeMs ?? 0) - (a.probeMs ?? 0))[0]

  const apiBottleneckCount = shots.filter((s) => s.bottleneck === "api").length
  const cdnBottleneckCount = shots.filter((s) => s.bottleneck === "cdn").length

  let summary = "Videos stream after storyboards load (top to bottom)."
  if (shots.length === 0) {
    summary = "No shot video fetches yet."
  } else if (apiBottleneckCount > 0 && apiBottleneckCount >= cdnBottleneckCount) {
    summary = `API/DB is the main delay for ${apiBottleneckCount} shot(s) — each shot hits /api/storyboard-videos separately.`
  } else if (cdnBottleneckCount > 0) {
    summary = `CDN/network is the main delay for ${cdnBottleneckCount} shot(s) — Supabase storage download is slow after metadata returns.`
  } else if (shotsWithoutVideo > 0) {
    summary = `${shotsWithoutVideo} shot(s) have no saved video in DB (nothing to play).`
  } else if (sequentialStaggerMs > 500) {
    summary = `Intentional sequential load adds ~${formatMs(sequentialStaggerMs)} stagger across ${shots.length} shots.`
  }

  if (apiSlow && apiSlow.apiMs > 500) {
    summary += ` Slowest API: shot ${apiSlow.shotNumber} (${formatMs(apiSlow.apiMs)}).`
  }
  if (cdnSlow && (cdnSlow.probeMs ?? 0) > 1000) {
    summary += ` Slowest video probe: shot ${cdnSlow.shotNumber} (${formatMs(cdnSlow.probeMs)}).`
  }

  return {
    updatedAt: Date.now(),
    shotCount: shots.length,
    staggerMsPerShot: options.staggerMsPerShot,
    streamMs: options.streamMs,
    networkHint: options.networkHint,
    shotsWithVideo,
    shotsWithoutVideo,
    totalApiMs,
    totalProbeMs,
    sequentialStaggerMs,
    shots,
    summary,
  }
}

export function formatCinemaProductionVideoDiagnostics(
  diagnostics: CinemaProductionVideoDiagnostics | null,
): string[] {
  if (!diagnostics) return ["(no video diagnostics yet)"]

  const lines = [
    `summary: ${diagnostics.summary}`,
    `network: ${diagnostics.networkHint}`,
    `shots probed: ${diagnostics.shotCount} (${diagnostics.shotsWithVideo} with video, ${diagnostics.shotsWithoutVideo} without)`,
    `stream total: ${diagnostics.streamMs != null ? formatMs(diagnostics.streamMs) : "in progress"}`,
    `API time (sum): ${formatMs(diagnostics.totalApiMs)}`,
    `video probe time (sum): ${formatMs(diagnostics.totalProbeMs)}`,
    `sequential stagger overhead: ~${formatMs(diagnostics.sequentialStaggerMs)} (${diagnostics.staggerMsPerShot}ms × ${Math.max(0, diagnostics.shotCount - 1)} gaps)`,
    "",
    "Per shot (api · probe · bottleneck):",
  ]

  for (const shot of diagnostics.shots) {
    const probe = shot.probeMs != null ? formatMs(shot.probeMs) : shot.videoCount > 0 ? "skipped" : "—"
    const note = shot.probeNote ? ` — ${shot.probeNote}` : ""
    lines.push(
      `  shot ${shot.shotNumber} [${shot.bottleneck}] api ${formatMs(shot.apiMs)} (${shot.apiStatus}) · probe ${probe}${note} · ${shot.videoCount} video(s)`,
    )
  }

  lines.push(
    "",
    "How to read bottlenecks:",
    "  api — /api/storyboard-videos or Supabase query slow (server/DB)",
    "  cdn — metadata fetch from storage slow (internet, file size, region)",
    "  no-video — no row in storyboard_videos for this shot",
    "  error — fetch failed or video URL could not load",
  )

  return lines
}
