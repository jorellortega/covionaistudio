import { NextRequest, NextResponse } from "next/server"
import { ElevenLabsService } from "@/lib/ai-services"
import { getElevenLabsApiKeyForUser } from "@/lib/elevenlabs-api-key"
import { createRouteSupabaseClient } from "@/lib/supabase-route"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createRouteSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    }

    const { data: record, error: fetchError } = await supabase
      .from("project_voices")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!record) {
      return NextResponse.json({ error: "Voice not found" }, { status: 404 })
    }

    const deleteFromElevenLabs =
      request.nextUrl.searchParams.get("deleteFromElevenLabs") === "true"

    if (deleteFromElevenLabs) {
      const apiKey = await getElevenLabsApiKeyForUser(user.id)
      if (apiKey) {
        const result = await ElevenLabsService.deleteVoice(
          apiKey,
          record.elevenlabs_voice_id,
        )
        if (!result.success) {
          return NextResponse.json(
            { error: result.error || "Failed to delete voice from ElevenLabs" },
            { status: 500 },
          )
        }
      }
    }

    const { error: deleteError } = await supabase
      .from("project_voices")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete project voice error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
