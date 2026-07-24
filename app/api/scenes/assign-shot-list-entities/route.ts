import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { OpenAIService } from "@/lib/ai-services"
import {
  applyShotListAssignments,
  formatAssignmentPromptSection,
  resolveCharacterName,
  resolveLocationName,
} from "@/lib/shot-list-assignment-utils"

type ShotRow = {
  id: string
  description?: string | null
  action?: string | null
  dialogue?: string | null
  characters?: string[] | null
  location?: string | null
  metadata?: Record<string, unknown> | null
}

async function getApiKey(userId: string, service: "openai" | "anthropic"): Promise<string> {
  let actualApiKey = ""

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data } = await supabaseAdmin
      .from("users")
      .select("openai_api_key, anthropic_api_key")
      .eq("id", userId)
      .single()

    if (data) {
      if (service === "openai" && data.openai_api_key) {
        actualApiKey = data.openai_api_key.trim()
      } else if (service === "anthropic" && data.anthropic_api_key) {
        actualApiKey = data.anthropic_api_key.trim()
      }
    }
  }

  if (!actualApiKey) {
    actualApiKey =
      service === "openai"
        ? process.env.OPENAI_API_KEY || ""
        : process.env.ANTHROPIC_API_KEY || ""
  }

  return actualApiKey
}

function parseAiAssignmentResponse(
  raw: string,
): Array<{ shot_id: string; characters?: string[]; location?: string }> {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) text = arrayMatch[0]
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not an array")
  }
  return parsed
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sceneId, userId, shotId } = body as {
      sceneId?: string
      userId?: string
      shotId?: string
    }

    if (!sceneId) {
      return NextResponse.json({ error: "Missing required field: sceneId" }, { status: 400 })
    }

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
              // ignore
            }
          },
        },
      },
    )

    let targetUserId = userId
    if (!targetUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      targetUserId = user?.id
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: scene, error: sceneError } = await supabase
      .from("scenes")
      .select("*, timelines!inner(project_id)")
      .eq("id", sceneId)
      .eq("user_id", targetUserId)
      .single()

    if (sceneError || !scene) {
      return NextResponse.json({ error: "Scene not found or unauthorized" }, { status: 404 })
    }

    const projectId = (scene.timelines as { project_id?: string })?.project_id
    if (!projectId) {
      return NextResponse.json({ error: "Project not found for scene" }, { status: 404 })
    }

    const [{ data: shots, error: shotsError }, { data: characters }, { data: locations }] =
      await Promise.all([
        supabase
          .from("shot_lists")
          .select("id, description, action, dialogue, characters, location, metadata")
          .eq("scene_id", sceneId)
          .eq("user_id", targetUserId)
          .order("sequence_order", { ascending: true }),
        supabase.from("characters").select("id, name").eq("project_id", projectId),
        supabase.from("locations").select("id, name").eq("project_id", projectId),
      ])

    if (shotsError) {
      return NextResponse.json({ error: "Failed to load shot list" }, { status: 500 })
    }

    const shotRows = (shots ?? []) as ShotRow[]
    const characterCatalog = characters ?? []
    const locationCatalog = locations ?? []

    const targetShots = shotId ? shotRows.filter((shot) => shot.id === shotId) : shotRows

    if (shotId && targetShots.length === 0) {
      return NextResponse.json({ error: "Shot not found in this scene" }, { status: 404 })
    }

    if (targetShots.length === 0) {
      return NextResponse.json({ error: "No shots found for this scene" }, { status: 400 })
    }

    if (characterCatalog.length === 0 && locationCatalog.length === 0) {
      return NextResponse.json(
        {
          error: "Add characters and locations to this project first.",
        },
        { status: 400 },
      )
    }

    const assignments = new Map<
      string,
      { characters: string[]; location?: string; metadata?: Record<string, unknown> }
    >()

    for (const shot of targetShots) {
      const resolved = applyShotListAssignments(
        {
          characters: shot.characters ?? [],
          location: shot.location ?? undefined,
          description: shot.description ?? "",
          action: shot.action ?? "",
          dialogue: shot.dialogue ?? "",
          metadata: shot.metadata ?? {},
        },
        characterCatalog,
        locationCatalog,
      )

      assignments.set(shot.id, {
        characters: resolved.characters ?? [],
        location: resolved.location,
        metadata: resolved.metadata,
      })
    }

    const shotsNeedingAi = targetShots.filter((shot) => {
      const current = assignments.get(shot.id)!
      const missingCharacters =
        characterCatalog.length > 0 && current.characters.length === 0
      const missingLocation = locationCatalog.length > 0 && !current.location
      return missingCharacters || missingLocation
    })

    if (shotsNeedingAi.length > 0) {
      const apiKey = await getApiKey(targetUserId, "openai")
      if (!apiKey) {
        return NextResponse.json(
          { error: "OpenAI API key not configured. Please configure it in AI Settings." },
          { status: 400 },
        )
      }

      const assignmentSection = formatAssignmentPromptSection(characterCatalog, locationCatalog)
      const shotPayload = shotsNeedingAi.map((shot) => ({
        shot_id: shot.id,
        description: shot.description ?? "",
        action: shot.action ?? "",
        dialogue: shot.dialogue ?? "",
        characters: shot.characters ?? [],
        location: shot.location ?? "",
      }))

      const systemPrompt = `You assign characters and locations to film shots.
Return ONLY a JSON array. Each item must have:
- shot_id (string, must match input)
- characters (array of exact character names from the catalog, can be empty)
- location (string, exact location name from catalog, or empty string)

${assignmentSection}

Do not invent characters or locations not in the catalog.`

      const userPrompt = `Assign the best matching characters and location for each shot.

SHOTS:
${JSON.stringify(shotPayload, null, 2)}

Return JSON array only.`

      const response = await OpenAIService.generateScript({
        prompt: userPrompt,
        template: systemPrompt,
        model: "gpt-4o-mini",
        apiKey,
        maxTokens: 4000,
      })

      if (!response.success) {
        return NextResponse.json(
          { error: response.error || "Failed to assign characters and locations" },
          { status: 500 },
        )
      }

      const content = response.data?.choices?.[0]?.message?.content || ""
      const aiAssignments = parseAiAssignmentResponse(content)

      for (const item of aiAssignments) {
        if (!item.shot_id || !assignments.has(item.shot_id)) continue
        const current = assignments.get(item.shot_id)!
        const aiCharacters = (item.characters ?? [])
          .map((name) => resolveCharacterName(name, characterCatalog))
          .filter((name): name is string => Boolean(name))
        const aiLocation = resolveLocationName(item.location, locationCatalog) || undefined

        const mergedCharacters = [...new Set([...current.characters, ...aiCharacters])]
        const mergedLocation = current.location || aiLocation

        assignments.set(item.shot_id, {
          characters: mergedCharacters,
          location: mergedLocation,
          metadata: {
            ...(current.metadata || {}),
            ...(mergedLocation ? { locations: [mergedLocation] } : {}),
          },
        })
      }
    }

    let updatedCount = 0
    for (const shot of targetShots) {
      const next = assignments.get(shot.id)
      if (!next) continue

      const prevCharacters = shot.characters ?? []
      const prevLocation = shot.location ?? ""
      const changed =
        JSON.stringify(prevCharacters) !== JSON.stringify(next.characters) ||
        prevLocation !== (next.location ?? "")

      if (!changed) continue

      const { error: updateError } = await supabase
        .from("shot_lists")
        .update({
          characters: next.characters,
          location: next.location ?? null,
          metadata: next.metadata ?? {},
        })
        .eq("id", shot.id)
        .eq("user_id", targetUserId)

      if (!updateError) updatedCount += 1
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      totalShots: targetShots.length,
      aiAssistedCount: shotsNeedingAi.length,
    })
  } catch (error) {
    console.error("Error assigning shot list entities:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to assign characters and locations",
      },
      { status: 500 },
    )
  }
}
