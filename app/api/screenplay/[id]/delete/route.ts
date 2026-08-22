import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createRouteSupabaseClient, getRouteAuthUser } from "@/lib/supabase-route"
import { supabaseServerFetch } from "@/lib/supabase-server-fetch"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: supabaseServerFetch },
  })
}

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    if (!UUID_RE.test(projectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 })
    }

    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const admin = getServiceClient()
    const db = admin ?? supabase

    const { data: project, error: projectError } = await db
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .maybeSingle()

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 })
    }
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: deletedScenes, error: scenesError } = await db
      .from("screenplay_scenes")
      .delete()
      .eq("project_id", projectId)
      .select("id")

    if (scenesError) {
      return NextResponse.json({ error: scenesError.message }, { status: 500 })
    }

    const { data: timelines, error: timelinesError } = await db
      .from("timelines")
      .select("id")
      .eq("project_id", projectId)

    if (timelinesError) {
      return NextResponse.json({ error: timelinesError.message }, { status: 500 })
    }

    const timelineIds = (timelines || []).map((row) => row.id)
    let clearedTimelineScenes = 0

    if (timelineIds.length > 0) {
      const { data: cleared, error: clearError } = await db
        .from("scenes")
        .update({ screenplay_content: "" })
        .in("timeline_id", timelineIds)
        .select("id")

      if (clearError) {
        return NextResponse.json({ error: clearError.message }, { status: 500 })
      }
      clearedTimelineScenes = cleared?.length ?? 0
    }

    const { data: scriptAssets, error: assetsError } = await db
      .from("assets")
      .select("id")
      .eq("project_id", projectId)
      .eq("content_type", "script")

    if (assetsError) {
      return NextResponse.json({ error: assetsError.message }, { status: 500 })
    }

    const assetIds = (scriptAssets || [])
      .map((row) => row.id)
      .filter((assetId) => UUID_RE.test(assetId))

    if (assetIds.length > 0) {
      const { error: deleteAssetsError } = await db.from("assets").delete().in("id", assetIds)
      if (deleteAssetsError) {
        return NextResponse.json({ error: deleteAssetsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      deletedScreenplayScenes: deletedScenes?.length ?? 0,
      clearedTimelineScenes,
      deletedScriptAssets: assetIds.length,
    })
  } catch (error) {
    console.error("[screenplay delete]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete screenplay" },
      { status: 500 },
    )
  }
}
