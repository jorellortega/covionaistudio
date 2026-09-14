import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createRouteSupabaseClient, getRouteAuthUser } from "@/lib/supabase-route"
import { supabaseServerFetch } from "@/lib/supabase-server-fetch"

export const runtime = "nodejs"

const SCENE_LIST_COLUMNS =
  "id, timeline_id, user_id, name, description, start_time_seconds, duration_seconds, scene_type, content_url, metadata, order_index, created_at, updated_at"

function parseSceneNumber(sceneNumber: string): number {
  if (!sceneNumber || !sceneNumber.trim()) return 0
  const trimmed = sceneNumber.trim()
  const numericMatch = trimmed.match(/^(\d+)/)
  if (!numericMatch) return 0
  const numericPart = parseInt(numericMatch[1], 10)
  const letterMatch = trimmed.match(/^(\d+)([A-Za-z])/)
  if (letterMatch) {
    const letterValue = letterMatch[2].toUpperCase().charCodeAt(0) - 64
    return numericPart + letterValue / 10
  }
  return numericPart
}

function parseSceneMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== "object") return {}
  return {
    sceneNumber: (metadata.sceneNumber as string) || "",
    location: (metadata.location as string) || "",
    characters: Array.isArray(metadata.characters) ? metadata.characters : [],
    shotType: (metadata.shotType as string) || "",
    mood: (metadata.mood as string) || "",
    notes: (metadata.notes as string) || "",
    status: (metadata.status as string) || "Planning",
    thumbnail: (metadata.thumbnail as string) || undefined,
  }
}

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: supabaseServerFetch },
  })
}

function userHasShare(
  shares: Array<{
    shared_with_user_id?: string | null
    shared_with_email?: string | null
    deadline?: string | null
  }>,
  userId: string,
  email?: string | null,
) {
  return shares.some((share) => {
    if (share.deadline && new Date(share.deadline) < new Date()) return false
    if (share.shared_with_user_id === userId) return true
    if (share.shared_with_email && email && share.shared_with_email.toLowerCase() === email.toLowerCase()) {
      return true
    }
    return false
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ timelineId: string }> },
) {
  const t0 = Date.now()

  try {
    const { timelineId } = await params
    if (!timelineId) {
      return NextResponse.json({ error: "Timeline id is required" }, { status: 400 })
    }

    const skipThumbnails = request.nextUrl.searchParams.get("skipThumbnails") === "1"
    const includeScreenplay = request.nextUrl.searchParams.get("includeScreenplay") === "1"

    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const db = getServiceClient() || supabase

    const { data: timeline, error: timelineError } = await db
      .from("timelines")
      .select("id, project_id, user_id")
      .eq("id", timelineId)
      .maybeSingle()

    if (timelineError) {
      console.error("[api/timelines/scenes] timeline error:", timelineError)
      return NextResponse.json({ error: timelineError.message }, { status: 500 })
    }

    if (!timeline) {
      return NextResponse.json({ scenes: [] })
    }

    const { data: project, error: projectError } = await db
      .from("projects")
      .select("id, user_id")
      .eq("id", timeline.project_id)
      .maybeSingle()

    if (projectError) {
      console.error("[api/timelines/scenes] project error:", projectError)
      return NextResponse.json({ error: projectError.message }, { status: 500 })
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    let hasAccess = project.user_id === user.id
    if (!hasAccess) {
      const { data: shares, error: shareError } = await db
        .from("project_shares")
        .select("shared_with_user_id, shared_with_email, deadline, is_revoked")
        .eq("project_id", project.id)
        .eq("is_revoked", false)

      if (shareError) {
        console.error("[api/timelines/scenes] share error:", shareError)
        return NextResponse.json({ error: shareError.message }, { status: 500 })
      }

      hasAccess = userHasShare(shares || [], user.id, user.email)
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const selectColumns = includeScreenplay
      ? `${SCENE_LIST_COLUMNS}, screenplay_content`
      : SCENE_LIST_COLUMNS

    const tQuery = Date.now()
    const { data, error } = await db
      .from("scenes")
      .select(selectColumns)
      .eq("timeline_id", timelineId)

    if (error) {
      console.error("[api/timelines/scenes] scenes error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const sortedScenes = [...rows].sort((a, b) => {
      const aNumber = parseSceneNumber(a.metadata?.sceneNumber || "")
      const bNumber = parseSceneNumber(b.metadata?.sceneNumber || "")
      return aNumber - bNumber
    })

    let assets: Array<{
      scene_id: string
      content_url: string | null
      content_type: string
      title: string | null
      created_at: string
    }> = []

    if (!skipThumbnails && sortedScenes.length > 0) {
      const sceneIds = sortedScenes.map((scene) => scene.id)
      const { data: assetsData, error: assetsError } = await db
        .from("assets")
        .select("scene_id, content_url, content_type, title, created_at")
        .in("scene_id", sceneIds)
        .eq("content_type", "image")
        .order("created_at", { ascending: false })

      if (assetsError) {
        console.warn("[api/timelines/scenes] assets error:", assetsError)
      } else {
        assets = assetsData || []
      }
    }

    const scenes = sortedScenes.map((scene) => {
      const parsedMetadata = parseSceneMetadata(scene.metadata)
      if (!skipThumbnails) {
        const sceneAssets = assets.filter((asset) => asset.scene_id === scene.id)
        const bucketAssets = sceneAssets.filter(
          (asset) =>
            asset.content_url &&
            asset.content_url.includes("cinema_files") &&
            !asset.content_url.includes("oaidalleapiprodscus.blob.core.windows.net"),
        )
        if (bucketAssets.length > 0) {
          parsedMetadata.thumbnail = bucketAssets[0].content_url || undefined
        }
      }
      return {
        ...scene,
        metadata: parsedMetadata,
      }
    })

    const queryMs = Date.now() - tQuery
    console.log(
      `[api/timelines/scenes] ${scenes.length} scenes for ${timelineId} in ${Date.now() - t0}ms (query ${queryMs}ms)`,
    )

    return NextResponse.json({ scenes })
  } catch (error) {
    console.error("[api/timelines/scenes] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load scenes" },
      { status: 500 },
    )
  }
}
