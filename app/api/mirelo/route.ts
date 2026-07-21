import { NextRequest, NextResponse } from "next/server"
import {
  MIRELO_API_BASE,
  type MireloEndpoint,
  type MireloVersion,
  getMireloHeaders,
  mireloApiPath,
} from "@/lib/mirelo-config"
import { getMireloApiKeyForUser } from "@/lib/mirelo-api-key"

export const maxDuration = 300
export const runtime = "nodejs"

const VALID_ENDPOINTS = new Set<MireloEndpoint>([
  "text-to-sfx",
  "video-to-sfx",
  "extend-audio",
  "extend-audio-with-video",
  "inpaint-audio",
  "inpaint-audio-with-video",
])

async function requireUser() {
  const { createServerClient } = await import("@supabase/ssr")
  const { cookies } = await import("next/headers")

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            /* ignore */
          }
        },
      },
    },
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

function mireloErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback
  const obj = data as { error?: string | { message?: string }; message?: string; detail?: string }
  if (typeof obj.error === "string") return obj.error
  if (obj.error?.message) return obj.error.message
  if (typeof obj.message === "string") return obj.message
  if (typeof obj.detail === "string") return obj.detail
  return fallback
}

async function mireloFetch(apiKey: string, path: string, init?: RequestInit) {
  const response = await fetch(`${MIRELO_API_BASE}${path}`, {
    ...init,
    headers: {
      ...getMireloHeaders(apiKey),
      ...(init?.headers as Record<string, string> | undefined),
    },
  })

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: mireloErrorMessage(data, text || `Mirelo API error (${response.status})`),
      data,
    }
  }

  return { ok: true as const, status: response.status, data }
}

function parseEndpoint(raw: string | null): MireloEndpoint | null {
  if (!raw || !VALID_ENDPOINTS.has(raw as MireloEndpoint)) return null
  return raw as MireloEndpoint
}

function parseVersion(raw: string | null): MireloVersion {
  return raw === "v1.5" ? "v1.5" : "v1.6"
}

function buildMediaSource(
  url: string | undefined,
  assetId: string | undefined,
  media: "audio" | "video",
): Record<string, unknown> | null {
  if (assetId?.trim()) {
    return { type: "asset", asset_id: assetId.trim() }
  }
  if (url?.trim()) {
    return media === "audio"
      ? { type: "url", audio_url: url.trim() }
      : { type: "url", video_url: url.trim() }
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const action = request.nextUrl.searchParams.get("action")
    const apiKey = await getMireloApiKeyForUser(user.id, request.nextUrl.searchParams.get("apiKey"))
    if (!apiKey) {
      return NextResponse.json(
        { error: "No Mirelo API key. Add one on this page, in Setup AI, or set MIRELO_API_KEY on the server." },
        { status: 403 },
      )
    }

    if (action === "key-check") {
      const result = await mireloFetch(apiKey, mireloApiPath("text-to-sfx", "v1.6", "preflight") + "?duration_ms=1000&num_samples=1")
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, preflight: result.data })
    }

    if (action === "me") {
      const result = await mireloFetch(apiKey, "/v2/me")
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, account: result.data })
    }

    if (action === "preflight") {
      const endpoint = parseEndpoint(request.nextUrl.searchParams.get("endpoint"))
      if (!endpoint) {
        return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
      }

      const version = parseVersion(request.nextUrl.searchParams.get("version"))
      const params = new URLSearchParams()
      for (const key of ["duration_ms", "num_samples", "append_duration_ms"]) {
        const value = request.nextUrl.searchParams.get(key)
        if (value) params.set(key, value)
      }

      const qs = params.toString()
      const path = mireloApiPath(endpoint, version, "preflight") + (qs ? `?${qs}` : "")
      const result = await mireloFetch(apiKey, path)
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, preflight: result.data })
    }

    if (action === "job-status") {
      const endpoint = parseEndpoint(request.nextUrl.searchParams.get("endpoint"))
      const jobId = request.nextUrl.searchParams.get("jobId")
      if (!endpoint || !jobId) {
        return NextResponse.json({ error: "endpoint and jobId are required" }, { status: 400 })
      }

      const version = parseVersion(request.nextUrl.searchParams.get("version"))
      const result = await mireloFetch(apiKey, mireloApiPath(endpoint, version, "job-status", jobId))
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, job: result.data })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("Mirelo GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mirelo request failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const action = body.action as string
    const apiKey = await getMireloApiKeyForUser(user.id, typeof body.apiKey === "string" ? body.apiKey : null)
    if (!apiKey) {
      return NextResponse.json(
        { error: "No Mirelo API key. Add one on this page, in Setup AI, or set MIRELO_API_KEY on the server." },
        { status: 403 },
      )
    }

    if (action === "create-asset") {
      const contentType = typeof body.content_type === "string" ? body.content_type.trim() : ""
      if (!contentType) {
        return NextResponse.json({ error: "content_type is required" }, { status: 400 })
      }

      const result = await mireloFetch(apiKey, "/v2/assets", {
        method: "POST",
        body: JSON.stringify({ content_type: contentType }),
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    if (action === "generate") {
      const endpoint = parseEndpoint(typeof body.endpoint === "string" ? body.endpoint : null)
      if (!endpoint) {
        return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
      }

      const version = parseVersion(typeof body.version === "string" ? body.version : null)
      const mode = body.mode === "async" ? "async" : "sync"
      const payload = (body.payload as Record<string, unknown>) || {}

      const result = await mireloFetch(apiKey, mireloApiPath(endpoint, version, mode === "async" ? "async" : "sync"), {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, mode, ...(result.data as object) })
    }

    // Legacy action aliases for backwards compatibility
    if (action === "text-to-sfx") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
      if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 })

      const version = parseVersion(typeof body.version === "string" ? body.version : null)
      const mode = body.mode === "async" ? "async" : "sync"
      const payload: Record<string, unknown> = {
        prompt,
        duration_ms: typeof body.duration_ms === "number" ? body.duration_ms : 5000,
        num_samples: typeof body.num_samples === "number" ? body.num_samples : 1,
      }
      if (body.loop === true) payload.loop = true

      const result = await mireloFetch(apiKey, mireloApiPath("text-to-sfx", version, mode === "async" ? "async" : "sync"), {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (!result.ok) return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      return NextResponse.json({ success: true, mode, ...(result.data as object) })
    }

    if (action === "video-to-sfx") {
      const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() : ""
      const videoAssetId = typeof body.video_asset_id === "string" ? body.video_asset_id.trim() : ""
      const video = buildMediaSource(videoUrl, videoAssetId, "video")
      if (!video) return NextResponse.json({ error: "video_url or video_asset_id is required" }, { status: 400 })

      const version = parseVersion(typeof body.version === "string" ? body.version : null)
      const mode = body.mode === "async" ? "async" : "sync"
      const payload: Record<string, unknown> = {
        video,
        duration_ms: typeof body.duration_ms === "number" ? body.duration_ms : 5000,
        start_offset_ms: typeof body.start_offset_ms === "number" ? body.start_offset_ms : 0,
        output: body.output === "video" ? "video" : "audio",
        num_samples: typeof body.num_samples === "number" ? body.num_samples : 1,
      }

      const result = await mireloFetch(apiKey, mireloApiPath("video-to-sfx", version, mode === "async" ? "async" : "sync"), {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (!result.ok) return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      return NextResponse.json({ success: true, mode, ...(result.data as object) })
    }

    if (action === "extend-audio" || action === "extend-audio-with-video") {
      const endpoint: MireloEndpoint =
        action === "extend-audio-with-video" ? "extend-audio-with-video" : "extend-audio"

      const audioUrl = typeof body.audio_url === "string" ? body.audio_url.trim() : ""
      const audioAssetId = typeof body.audio_asset_id === "string" ? body.audio_asset_id.trim() : ""
      const audio = buildMediaSource(audioUrl, audioAssetId, "audio")
      if (!audio) return NextResponse.json({ error: "audio_url or audio_asset_id is required" }, { status: 400 })

      const appendDurationMs = typeof body.append_duration_ms === "number" ? body.append_duration_ms : 5000
      const mode = body.mode === "async" ? "async" : "sync"
      const payload: Record<string, unknown> = {
        audio,
        append_duration_ms: appendDurationMs,
        num_samples: typeof body.num_samples === "number" ? body.num_samples : 1,
      }

      if (typeof body.prompt === "string" && body.prompt.trim()) payload.prompt = body.prompt.trim()
      if (body.loop === true) payload.loop = true

      if (endpoint === "extend-audio-with-video") {
        const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() : ""
        const videoAssetId = typeof body.video_asset_id === "string" ? body.video_asset_id.trim() : ""
        const video = buildMediaSource(videoUrl, videoAssetId, "video")
        if (!video) return NextResponse.json({ error: "video_url or video_asset_id is required" }, { status: 400 })
        payload.video = video
        if (typeof body.start_offset_ms === "number") payload.start_offset_ms = body.start_offset_ms
      }

      const result = await mireloFetch(apiKey, mireloApiPath(endpoint, "v1.6", mode === "async" ? "async" : "sync"), {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (!result.ok) return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      return NextResponse.json({ success: true, mode, ...(result.data as object) })
    }

    if (action === "inpaint-audio" || action === "inpaint-audio-with-video") {
      const endpoint: MireloEndpoint =
        action === "inpaint-audio-with-video" ? "inpaint-audio-with-video" : "inpaint-audio"

      const audioUrl = typeof body.audio_url === "string" ? body.audio_url.trim() : ""
      const audioAssetId = typeof body.audio_asset_id === "string" ? body.audio_asset_id.trim() : ""
      const audio = buildMediaSource(audioUrl, audioAssetId, "audio")
      if (!audio) return NextResponse.json({ error: "audio_url or audio_asset_id is required" }, { status: 400 })

      const startMs = typeof body.start_ms === "number" ? body.start_ms : 2000
      const endMs = typeof body.end_ms === "number" ? body.end_ms : 4000
      const mode = body.mode === "async" ? "async" : "sync"

      const payload: Record<string, unknown> = {
        audio,
        segment: { start_ms: startMs, end_ms: endMs },
        num_samples: typeof body.num_samples === "number" ? body.num_samples : 1,
      }

      if (typeof body.prompt === "string" && body.prompt.trim()) payload.prompt = body.prompt.trim()

      if (endpoint === "inpaint-audio-with-video") {
        const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() : ""
        const videoAssetId = typeof body.video_asset_id === "string" ? body.video_asset_id.trim() : ""
        const video = buildMediaSource(videoUrl, videoAssetId, "video")
        if (!video) return NextResponse.json({ error: "video_url or video_asset_id is required" }, { status: 400 })
        payload.video = video
      }

      const result = await mireloFetch(apiKey, mireloApiPath(endpoint, "v1.6", mode === "async" ? "async" : "sync"), {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (!result.ok) return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      return NextResponse.json({ success: true, mode, ...(result.data as object) })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("Mirelo POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mirelo request failed" },
      { status: 500 },
    )
  }
}
