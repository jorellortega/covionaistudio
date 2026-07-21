import { NextRequest, NextResponse } from "next/server"
import { HEYGEN_API_BASE, getHeyGenHeaders } from "@/lib/heygen-config"
import { getHeyGenApiKeyForUser } from "@/lib/heygen-api-key"

export const maxDuration = 300
export const runtime = "nodejs"

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

function heyGenErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback
  const err = (data as { error?: { message?: string; code?: string }; message?: string }).error
  if (err?.message) return err.message
  if (typeof (data as { message?: string }).message === "string") {
    return (data as { message: string }).message
  }
  return fallback
}

async function heyGenFetch(apiKey: string, path: string, init?: RequestInit) {
  const response = await fetch(`${HEYGEN_API_BASE}${path}`, {
    ...init,
    headers: {
      ...getHeyGenHeaders(apiKey, !(init?.body instanceof FormData)),
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
      error: heyGenErrorMessage(data, text || `HeyGen API error (${response.status})`),
      data,
    }
  }

  return { ok: true as const, status: response.status, data }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const action = request.nextUrl.searchParams.get("action")
    const apiKey = await getHeyGenApiKeyForUser(user.id, request.nextUrl.searchParams.get("apiKey"))
    if (!apiKey) {
      return NextResponse.json(
        { error: "No HeyGen API key. Add one in Setup AI or set HEYGEN_API_KEY on the server." },
        { status: 403 },
      )
    }

    if (action === "key-check") {
      const result = await heyGenFetch(apiKey, "/v3/avatars/looks?limit=1&ownership=private")
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true })
    }

    if (action === "looks") {
      const params = new URLSearchParams()
      const avatarType = request.nextUrl.searchParams.get("avatar_type")
      const ownership = request.nextUrl.searchParams.get("ownership")
      const groupId = request.nextUrl.searchParams.get("group_id")
      if (avatarType) params.set("avatar_type", avatarType)
      if (ownership) params.set("ownership", ownership)
      if (groupId) params.set("group_id", groupId)
      params.set("limit", request.nextUrl.searchParams.get("limit") || "50")

      const result = await heyGenFetch(apiKey, `/v3/avatars/looks?${params.toString()}`)
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    if (action === "groups") {
      const params = new URLSearchParams()
      params.set("limit", request.nextUrl.searchParams.get("limit") || "50")
      const ownership = request.nextUrl.searchParams.get("ownership")
      if (ownership) params.set("ownership", ownership)

      const result = await heyGenFetch(apiKey, `/v3/avatars/groups?${params.toString()}`)
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    if (action === "avatar-group") {
      const groupId = request.nextUrl.searchParams.get("groupId")
      if (!groupId) {
        return NextResponse.json({ error: "groupId is required" }, { status: 400 })
      }
      const result = await heyGenFetch(apiKey, `/v3/avatars/${encodeURIComponent(groupId)}`)
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    if (action === "voices") {
      const params = new URLSearchParams()
      params.set("limit", request.nextUrl.searchParams.get("limit") || "50")
      const result = await heyGenFetch(apiKey, `/v3/voices?${params.toString()}`)
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    if (action === "video") {
      const videoId = request.nextUrl.searchParams.get("videoId")
      if (!videoId) {
        return NextResponse.json({ error: "videoId is required" }, { status: 400 })
      }
      const result = await heyGenFetch(apiKey, `/v3/videos/${encodeURIComponent(videoId)}`)
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("HeyGen GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "HeyGen request failed" },
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

    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const action = formData.get("action") as string
      const apiKey = await getHeyGenApiKeyForUser(user.id, formData.get("apiKey") as string | null)
      if (!apiKey) {
        return NextResponse.json(
          { error: "No HeyGen API key. Add one in Setup AI or set HEYGEN_API_KEY on the server." },
          { status: 403 },
        )
      }

      if (action === "upload") {
        const file = formData.get("file") as File | null
        if (!file?.size) {
          return NextResponse.json({ error: "file is required" }, { status: 400 })
        }

        const uploadForm = new FormData()
        uploadForm.append("file", file)
        const result = await heyGenFetch(apiKey, "/v3/assets", {
          method: "POST",
          body: uploadForm,
        })
        if (!result.ok) {
          return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
        }
        return NextResponse.json({ success: true, ...(result.data as object) })
      }

      return NextResponse.json({ error: "Unknown upload action" }, { status: 400 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const action = body.action as string
    const apiKey = await getHeyGenApiKeyForUser(user.id, typeof body.apiKey === "string" ? body.apiKey : null)
    if (!apiKey) {
      return NextResponse.json(
        { error: "No HeyGen API key. Add one in Setup AI or set HEYGEN_API_KEY on the server." },
        { status: 403 },
      )
    }

    if (action === "create-twin") {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      const file = body.file as Record<string, unknown> | undefined
      if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 })
      }
      if (!file?.type) {
        return NextResponse.json({ error: "file is required" }, { status: 400 })
      }

      const payload: Record<string, unknown> = {
        type: "digital_twin",
        name,
        file,
      }
      if (typeof body.avatar_group_id === "string" && body.avatar_group_id.trim()) {
        payload.avatar_group_id = body.avatar_group_id.trim()
      }

      const result = await heyGenFetch(apiKey, "/v3/avatars", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    if (action === "consent") {
      const groupId = typeof body.groupId === "string" ? body.groupId.trim() : ""
      if (!groupId) {
        return NextResponse.json({ error: "groupId is required" }, { status: 400 })
      }

      const result = await heyGenFetch(apiKey, `/v3/avatars/${encodeURIComponent(groupId)}/consent`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    if (action === "create-video") {
      const payload = body.payload as Record<string, unknown> | undefined
      if (!payload?.avatar_id || !payload?.script || !payload?.voice_id) {
        return NextResponse.json(
          { error: "payload.avatar_id, payload.script, and payload.voice_id are required" },
          { status: 400 },
        )
      }

      const videoPayload = {
        type: "avatar",
        title: payload.title || "Digital Twin Video",
        avatar_id: payload.avatar_id,
        script: payload.script,
        voice_id: payload.voice_id,
        resolution: payload.resolution || "1080p",
        aspect_ratio: payload.aspect_ratio || "auto",
        ...(payload.engine ? { engine: payload.engine } : {}),
      }

      const result = await heyGenFetch(apiKey, "/v3/videos", {
        method: "POST",
        body: JSON.stringify(videoPayload),
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, ...(result.data as object) })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("HeyGen POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "HeyGen request failed" },
      { status: 500 },
    )
  }
}
