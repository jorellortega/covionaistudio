import { NextRequest, NextResponse } from "next/server"
import {
  pollLeonardoFrameVideo,
  startLeonardoFrameToVideoGeneration,
  uploadUrlToLeonardo,
  type LeonardoFrameVideoModel,
} from "@/lib/leonardo-frame-to-video"

export const maxDuration = 300
export const runtime = "nodejs"

const LEONARDO_MODELS: LeonardoFrameVideoModel[] = ["KLING2_1", "VEO3_1", "VEO3_1FAST"]

async function getLeonardoApiKey(userId: string): Promise<string | null> {
  const { createClient } = await import("@supabase/supabase-js")
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data } = await supabase
    .from("users")
    .select("leonardo_api_key")
    .eq("id", userId)
    .maybeSingle()

  const key = data?.leonardo_api_key?.trim()
  return key && key.length > 10 ? key : null
}

export async function POST(request: NextRequest) {
  try {
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
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              )
            } catch {
              /* ignore */
            }
          },
        },
      },
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const prompt = (body.prompt as string) || ""
    const model = body.model as LeonardoFrameVideoModel
    const duration = Number(body.duration) || 8
    const startFrameUrl = body.startFrameUrl as string
    const endFrameUrl = (body.endFrameUrl as string) || null

    if (!startFrameUrl) {
      return NextResponse.json({ error: "startFrameUrl is required" }, { status: 400 })
    }

    if (!LEONARDO_MODELS.includes(model)) {
      return NextResponse.json({ error: "Invalid Leonardo frame-to-frame model" }, { status: 400 })
    }

    const apiKey = await getLeonardoApiKey(user.id)
    if (!apiKey) {
      return NextResponse.json(
        { error: "Leonardo API key required. Add one in Settings → AI Settings." },
        { status: 403 },
      )
    }

    const startImageId = await uploadUrlToLeonardo(apiKey, startFrameUrl, "start-frame")
    const endImageId = endFrameUrl ? await uploadUrlToLeonardo(apiKey, endFrameUrl, "end-frame") : null

    const generationId = await startLeonardoFrameToVideoGeneration(apiKey, {
      startImageId,
      endImageId,
      model,
      prompt,
      duration,
    })

    const videoUrl = await pollLeonardoFrameVideo(apiKey, generationId)

    return NextResponse.json({
      success: true,
      data: {
        url: videoUrl,
        model,
        generationId,
      },
    })
  } catch (error) {
    console.error("frame-to-frame-video error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Frame-to-frame video failed" },
      { status: 500 },
    )
  }
}
