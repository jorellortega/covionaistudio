import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'
import { syncScreenplaySceneToProject } from '@/lib/sync-screenplay-scene'
import { buildTreatmentContextForScreenplay } from '@/lib/build-treatment-context'
import { resolveUserAiApiKey } from '@/lib/resolve-user-ai-api-key'

type RouteContext = { params: Promise<{ id: string }> }

function cleanGeneratedScreenplay(text: string): string {
  let output = text.trim()
  if (output.startsWith('```')) {
    output = output.replace(/^```[a-z]*\n?/i, '')
  }
  if (output.endsWith('```')) {
    output = output.replace(/\n?```$/i, '')
  }
  return output.trim()
}

function isAlreadyScreenplayFormat(content: string): boolean {
  const trimmed = content.trim()
  return /\b(INT\.|EXT\.|INT\/EXT\.)\s+/i.test(trimmed) && trimmed.length > 80
}

async function getUserScriptAiConfig(
  userId: string,
  supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>,
) {
  const { data: settings } = await supabase
    .from('ai_settings')
    .select('tab_type, locked_model, selected_model, is_locked')
    .eq('tab_type', 'scripts')
    .maybeSingle()

  const lockedModel =
    settings?.is_locked && settings.locked_model
      ? settings.locked_model
      : settings?.selected_model

  const { apiKey, normalizedService } = await resolveUserAiApiKey({
    userId,
    service: lockedModel,
    supabase,
  })

  const model =
    settings?.selected_model ||
    (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

  return { apiKey, service: normalizedService, model }
}

async function generateScreenplayText({
  sourceContent,
  sceneName,
  sceneNumber,
  location,
  characters,
  treatmentContext,
  apiKey,
  service,
  model,
}: {
  sourceContent: string
  sceneName: string
  sceneNumber?: string | null
  location?: string | null
  characters?: string[] | null
  treatmentContext?: string | null
  apiKey: string
  service: 'openai' | 'anthropic'
  model: string
}): Promise<string> {
  const systemPrompt = `You are a professional screenwriter. Write in standard screenplay format with scene heading, action lines, character names in caps, dialogue, and parentheticals when needed.

You MUST read the full treatment and prior scenes provided for story continuity — match character voices, plot beats, tone, and world details. The screenplay scene must feel like a natural part of the same story, not a standalone piece.

Output only the screenplay text for this one scene.`

  const continuityBlock = treatmentContext?.trim()
    ? `${treatmentContext.trim()}\n\n`
    : ''

  const userPrompt = `Write a complete professional screenplay scene. Use the treatment and any prior scenes below to maintain story continuity (characters, plot, tone, setting, and what has already happened).

${continuityBlock}=== SCENE TO WRITE ===
Scene Number: ${sceneNumber?.trim() || 'Not specified'}
Scene Title: ${sceneName}
Location: ${location || 'Not specified'}
Characters: ${characters?.length ? characters.join(', ') : 'Not specified'}

SOURCE MATERIAL FOR THIS SCENE:
${sourceContent}

Write the full screenplay scene now. Stay faithful to the treatment's story while expanding this scene into proper screenplay format.`

  if (service === 'anthropic') {
    const response = await AnthropicService.generateScript({
      prompt: userPrompt,
      template: systemPrompt,
      model,
      apiKey,
    })
    if (!response.success) {
      throw new Error(response.error || 'Failed to generate screenplay')
    }
    return cleanGeneratedScreenplay(response.data.content[0].text)
  }

  const response = await OpenAIService.generateScript({
    prompt: userPrompt,
    template: systemPrompt,
    model,
    apiKey,
    maxTokens: model.startsWith('gpt-5') ? 12000 : 8000,
  })

  if (!response.success) {
    throw new Error(response.error || 'Failed to generate screenplay')
  }

  const content = response.data?.choices?.[0]?.message?.content
  if (!content || (typeof content === 'string' && !content.trim())) {
    throw new Error('No screenplay content returned from AI')
  }

  return cleanGeneratedScreenplay(typeof content === 'string' ? content : String(content))
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { screenplaySceneId } = body

    if (!screenplaySceneId || typeof screenplaySceneId !== 'string') {
      return NextResponse.json({ error: 'screenplaySceneId is required' }, { status: 400 })
    }

    const { data: scene, error: sceneError } = await supabase
      .from('screenplay_scenes')
      .select('*')
      .eq('id', screenplaySceneId)
      .eq('user_id', user.id)
      .single()

    if (sceneError || !scene) {
      return NextResponse.json({ error: 'Screenplay scene not found' }, { status: 404 })
    }

    const sourceContent = (scene.content || scene.description || '').trim()
    if (!sourceContent) {
      return NextResponse.json(
        { error: 'This scene has no content to generate a screenplay from.' },
        { status: 400 },
      )
    }

    const treatmentResult = await buildTreatmentContextForScreenplay({
      supabase,
      userId: user.id,
      projectId: scene.project_id,
      workspaceId,
      currentSceneId: scene.id,
    })

    let screenplay = ''
    if (isAlreadyScreenplayFormat(sourceContent)) {
      screenplay = sourceContent
    } else {
      const aiConfig = await getUserScriptAiConfig(user.id, supabase)
      if (!aiConfig.apiKey) {
        return NextResponse.json(
          {
            error:
              'No OpenAI or Anthropic API key found. Add your personal key in Settings, set the site-wide key in Settings → AI Settings Admin, or configure OPENAI_API_KEY on the server.',
          },
          { status: 400 },
        )
      }

      if (!treatmentResult.hasTreatment) {
        return NextResponse.json(
          {
            error:
              'No treatment found for this project. Save a treatment (or acts) to your movie first so the screenplay scene matches story continuity.',
          },
          { status: 400 },
        )
      }

      screenplay = await generateScreenplayText({
        sourceContent,
        sceneName: scene.name,
        sceneNumber: scene.scene_number,
        location: scene.location,
        characters: scene.characters,
        treatmentContext: treatmentResult.context,
        apiKey: aiConfig.apiKey,
        service: aiConfig.service,
        model: aiConfig.model,
      })
    }

    const syncResult = await syncScreenplaySceneToProject({
      supabase,
      userId: user.id,
      workspaceId,
      projectId: scene.project_id,
      scene,
      screenplay,
    })

    return NextResponse.json({
      success: true,
      screenplay,
      sceneId: scene.id,
      artifact: syncResult.artifact,
      assetId: syncResult.assetId,
      usedAi: !isAlreadyScreenplayFormat(sourceContent),
      timelineSceneId: syncResult.timelineSceneId,
      treatmentUsed: treatmentResult.hasTreatment,
      actCount: treatmentResult.actCount,
      priorSceneCount: treatmentResult.priorSceneCount,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
