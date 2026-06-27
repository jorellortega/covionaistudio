import { NextRequest, NextResponse } from "next/server"
import { RUNWAY, getRunwayHeaders } from "@/lib/runway-config"
import { getRunwayApiKeyForUser } from "@/lib/runway-api-key"

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

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
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiKey = await getRunwayApiKeyForUser(user.id)
    if (!apiKey) {
      return NextResponse.json({ error: "No Runway ML API key configured" }, { status: 403 })
    }

    console.log("🎬 Checking Runway job status for:", jobId)

    const statusEndpoints = [
      `${RUNWAY.HOST}/v1/tasks/${jobId}`,
      `${RUNWAY.HOST}/v1/jobs/${jobId}`,
      `${RUNWAY.HOST}/v1/inference/${jobId}`,
      `${RUNWAY.HOST}/v1/generations/${jobId}`,
    ]

    let statusResult: Record<string, unknown> | null = null

    for (const endpoint of statusEndpoints) {
      try {
        const statusResponse = await fetch(endpoint, {
          method: "GET",
          headers: getRunwayHeaders(apiKey),
        })

        if (statusResponse.ok) {
          statusResult = await statusResponse.json()
          break
        }
      } catch {
        /* try next endpoint */
      }
    }

    if (!statusResult) {
      return NextResponse.json({ error: "Could not check job status — all endpoints failed" }, { status: 404 })
    }

    let responseData: Record<string, unknown> = { ...statusResult }
    const output = statusResult.output as unknown

    if (statusResult.status === "SUCCEEDED" && output) {
      let url: string | undefined
      if (Array.isArray(output) && output[0]) {
        url = String(output[0])
      } else if (typeof output === "object" && output !== null) {
        const out = output as Record<string, unknown>
        url = (out.url || out.image_url || (Array.isArray(out.images) ? out.images[0] : undefined)) as
          | string
          | undefined
      }
      responseData = { ...statusResult, status: "completed", url }
    }

    return NextResponse.json({ success: true, data: responseData })
  } catch (error) {
    console.error("🎬 Error checking video status:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
