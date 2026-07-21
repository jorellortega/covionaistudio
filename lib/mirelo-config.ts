export const MIRELO_API_BASE = "https://api.mirelo.ai"

export type MireloVersion = "v1.5" | "v1.6"

export type MireloEndpoint =
  | "text-to-sfx"
  | "video-to-sfx"
  | "extend-audio"
  | "extend-audio-with-video"
  | "inpaint-audio"
  | "inpaint-audio-with-video"

export type MireloRequestMode = "sync" | "async" | "preflight"

export function getMireloHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }
}

/** Build a Mirelo v2 API path for sync, async job submit, preflight, or job status. */
export function mireloApiPath(
  endpoint: MireloEndpoint,
  version: MireloVersion,
  mode: MireloRequestMode | "job-status",
  jobId?: string,
): string {
  const action =
    mode === "sync"
      ? "sync"
      : mode === "preflight"
        ? "preflight"
        : mode === "job-status"
          ? `jobs/${jobId}`
          : "jobs"

  switch (endpoint) {
    case "text-to-sfx":
      return `/v2/text-to-sfx/${version}/${action}`
    case "video-to-sfx":
      return `/v2/video-to-sfx/${version}/${action}`
    case "extend-audio":
      return `/v2/extend-audio/${version}/${action}`
    case "extend-audio-with-video":
      return `/v2/extend-audio/with_video/${version}/${action}`
    case "inpaint-audio":
      return `/v2/inpaint-audio/${version}/${action}`
    case "inpaint-audio-with-video":
      return `/v2/inpaint-audio/with_video/${version}/${action}`
  }
}

export type MireloPreflightResponse = {
  credits: number
  estimated_ms: number
}

export type MireloGenerateResponse = {
  result_urls: string[]
}

export type MireloJobSubmitResponse = {
  job_id: string
  job_url: string
  estimated_ms: number
  estimated_completion_at?: string
}

export type MireloJobStatusResponse = {
  status: "processing" | "succeeded" | "errored"
  progress_percent?: number
  estimated_completion_at?: string
  result?: { result_urls: string[] }
  error?: { code: string; message: string; http_status: number }
}

export type MireloMeResponse = {
  id: string
  email: string
  credits_available: number
  overage_enabled: boolean
}

export const MIRELO_ENDPOINT_LABELS: Record<MireloEndpoint, string> = {
  "text-to-sfx": "Text → SFX",
  "video-to-sfx": "Video → SFX",
  "extend-audio": "Extend Audio",
  "extend-audio-with-video": "Extend Audio (with video)",
  "inpaint-audio": "Inpaint Audio",
  "inpaint-audio-with-video": "Inpaint Audio (with video)",
}

/** Endpoints that only support v1.6 per Mirelo docs. */
export const V16_ONLY_ENDPOINTS = new Set<MireloEndpoint>([
  "extend-audio",
  "extend-audio-with-video",
  "inpaint-audio",
  "inpaint-audio-with-video",
])
