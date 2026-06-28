import { NextRequest, NextResponse } from "next/server"
import { createRouteSupabaseClient } from "@/lib/supabase-route"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    }

    const projectId = request.nextUrl.searchParams.get("projectId")?.trim()
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("project_voices")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (error) {
      const msg = error.message || ""
      if (
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        msg.includes("project_voices")
      ) {
        return NextResponse.json({
          voices: [],
          warning: "project_voices table not migrated yet — run migration 080",
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ voices: data || [] })
  } catch (error) {
    console.error("List project voices error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    }

    const body = await request.json()
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : ""
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const description = typeof body.description === "string" ? body.description.trim() : null
    const category = typeof body.category === "string" ? body.category.trim() : null
    const characterId = typeof body.characterId === "string" ? body.characterId.trim() : null

    if (!projectId || !voiceId || !name) {
      return NextResponse.json(
        { error: "projectId, voiceId, and name are required" },
        { status: 400 },
      )
    }

    const { data: existing } = await supabase
      .from("project_voices")
      .select("id")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .eq("elevenlabs_voice_id", voiceId)
      .maybeSingle()

    const payload = {
      name,
      description,
      category,
      character_id: characterId || null,
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) {
      const { data, error } = await supabase
        .from("project_voices")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, voice: data })
    }

    const { data, error } = await supabase
      .from("project_voices")
      .insert({
        user_id: user.id,
        project_id: projectId,
        elevenlabs_voice_id: voiceId,
        ...payload,
      })
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, voice: data })
  } catch (error) {
    console.error("Save project voice error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
