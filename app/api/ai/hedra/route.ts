import { NextRequest, NextResponse } from "next/server"
import { HEDRA_API_BASE, getHedraHeaders } from "@/lib/hedra-config"
import { getHedraApiKeyForUser } from "@/lib/hedra-api-key"

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

async function resolveHedraKey(userId: string, override?: string | null): Promise<string | null> {
  return getHedraApiKeyForUser(userId, override)
}

async function hedraFetch(apiKey: string, path: string, init?: RequestInit) {
  const response = await fetch(`${HEDRA_API_BASE}${path}`, {
    ...init,
    headers: {
      ...getHedraHeaders(apiKey, !(init?.body instanceof FormData)),
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
    const message =
      (data as { detail?: string; error?: string; message?: string })?.detail ||
      (data as { error?: string })?.error ||
      (data as { message?: string })?.message ||
      text ||
      `Hedra API error (${response.status})`
    return { ok: false as const, status: response.status, error: message, data }
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
    const apiKey = await resolveHedraKey(user.id, request.nextUrl.searchParams.get("apiKey"))
    if (!apiKey) {
      return NextResponse.json(
        { error: "No Hedra API key. Add one in Setup AI or set HEDRA_API_KEY on the server." },
        { status: 403 },
      )
    }

    if (action === "models") {
      const result = await hedraFetch(apiKey, "/models")
      if (!result.ok) return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      return NextResponse.json({ success: true, models: result.data })
    }

    if (action === "voices") {
      const result = await hedraFetch(apiKey, "/voices")
      if (!result.ok) return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      return NextResponse.json({ success: true, voices: result.data })
    }

    if (action === "status") {
      const generationId = request.nextUrl.searchParams.get("generationId")
      if (!generationId) {
        return NextResponse.json({ error: "generationId is required" }, { status: 400 })
      }
      const result = await hedraFetch(apiKey, `/generations/${generationId}/status`)
      if (!result.ok) return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      return NextResponse.json({ success: true, status: result.data })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("Hedra GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hedra request failed" },
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
      const apiKey = await resolveHedraKey(user.id, formData.get("apiKey") as string | null)
      if (!apiKey) {
        return NextResponse.json({ error: "No Hedra API key configured. Add one in Setup AI." }, { status: 403 })
      }

      if (action === "upload") {
        const file = formData.get("file") as File | null
        const assetType = (formData.get("assetType") as string) || "image"
        if (!file?.size) {
          return NextResponse.json({ error: "file is required" }, { status: 400 })
        }

        const createResult = await hedraFetch(apiKey, "/assets", {
          method: "POST",
          body: JSON.stringify({ name: file.name, type: assetType }),
        })
        if (!createResult.ok) {
          return NextResponse.json({ error: createResult.error, data: createResult.data }, { status: createResult.status })
        }

        const assetId = (createResult.data as { id?: string })?.id
        if (!assetId) {
          return NextResponse.json({ error: "Asset created but no id returned", data: createResult.data }, { status: 502 })
        }

        const uploadForm = new FormData()
        uploadForm.append("file", file)
        const uploadResult = await hedraFetch(apiKey, `/assets/${assetId}/upload`, {
          method: "POST",
          body: uploadForm,
        })
        if (!uploadResult.ok) {
          return NextResponse.json({ error: uploadResult.error, data: uploadResult.data }, { status: uploadResult.status })
        }

        return NextResponse.json({ success: true, assetId, data: uploadResult.data })
      }

      return NextResponse.json({ error: "Unknown upload action" }, { status: 400 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const action = body.action as string
    const apiKey = await resolveHedraKey(user.id, typeof body.apiKey === "string" ? body.apiKey : null)
    if (!apiKey) {
      return NextResponse.json({ error: "No Hedra API key configured. Add one in Setup AI." }, { status: 403 })
    }

    if (action === "generate") {
      const payload = body.payload as Record<string, unknown> | undefined
      if (!payload?.type) {
        return NextResponse.json({ error: "payload.type is required" }, { status: 400 })
      }

      const result = await hedraFetch(apiKey, "/generations", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error, data: result.data }, { status: result.status })
      }
      return NextResponse.json({ success: true, generation: result.data })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("Hedra POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hedra request failed" },
      { status: 500 },
    )
  }
}
