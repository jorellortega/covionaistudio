import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'
import { syncScreenplaySceneToProject } from '@/lib/sync-screenplay-scene'
import { buildTreatmentContextForScreenplay } from '@/lib/build-treatment-context'
import { resolveUserAiApiKey } from '@/lib/resolve-user-ai-api-key'
import { isCompleteScreenplayFormat } from '@/lib/screenplay-format-utils'
import { resolveScreenplaySceneForGeneration } from '@/lib/resolve-workspace-screenplay-scene'

export const maxDuration = 300

const SCREENPLAY_LINES_PER_PAGE = 55

type RouteContext = { params: Promise<{ id: string }> }

function estimateScreenplayPages(content: string): {
  lineCount: number
  estimatedPages: number
  characterCount: number
} {
  const trimmed = content.trim()
  const lineCount = trimmed ? trimmed.split('\n').length : 0
  const estimatedPages = lineCount > 0 ? Math.ceil(lineCount / SCREENPLAY_LINES_PER_PAGE) : 0
  return {
    lineCount,
    estimatedPages,
    characterCount: trimmed.length,
  }
}

function buildPageLengthDebug(input: {
  screenplaySceneId: string
  sceneName: string
  targetPages: number
  screenplay: string
  usedAi: boolean
  skippedBecauseAlreadyFormatted?: boolean
  maxLineCountAllowed?: number
  truncated?: boolean
  originalLineCount?: number
}) {
  const { lineCount, estimatedPages, characterCount } = estimateScreenplayPages(input.screenplay)
  const pageDelta = estimatedPages - input.targetPages

  return {
    screenplaySceneId: input.screenplaySceneId,
    sceneName: input.sceneName,
    targetPagesRequested: input.targetPages,
    estimatedPagesReturned: estimatedPages,
    pageDelta,
    lineCount,
    characterCount,
    linesPerPageAssumption: SCREENPLAY_LINES_PER_PAGE,
    usedAi: input.usedAi,
    skippedBecauseAlreadyFormatted: input.skippedBecauseAlreadyFormatted ?? false,
    withinOnePage: Math.abs(pageDelta) <= 1,
    hitTarget: Math.abs(pageDelta) <= 1 ? 'yes' : pageDelta > 0 ? 'too long' : 'too short',
    maxLineCountAllowed: input.maxLineCountAllowed,
    truncated: input.truncated ?? false,
    originalLineCountBeforeTrim: input.originalLineCount,
  }
}

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
  return isCompleteScreenplayFormat(content)
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

function maxTokensForTargetPages(targetPages: number, model: string): number {
  const ceiling = model.startsWith('gpt-5') ? 16000 : 12000
  const estimated = Math.round(targetPages * SCREENPLAY_LINES_PER_PAGE * 18) + 400
  return Math.max(1200, Math.min(estimated, ceiling))
}

function trimScreenplayToMaxLines(
  content: string,
  maxLines: number,
): { text: string; truncated: boolean; originalLineCount: number } {
  const trimmed = content.trim()
  const lines = trimmed ? trimmed.split('\n') : []
  const originalLineCount = lines.length

  if (originalLineCount <= maxLines) {
    return { text: trimmed, truncated: false, originalLineCount }
  }

  let cut = lines.slice(0, maxLines)
  while (cut.length > 0 && !cut[cut.length - 1]?.trim()) {
    cut = cut.slice(0, -1)
  }

  return {
    text: cut.join('\n').trim(),
    truncated: true,
    originalLineCount,
  }
}

async function generateScreenplayText({
  sourceContent,
  sceneName,
  sceneNumber,
  location,
  characters,
  treatmentContext,
  targetPages,
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
  targetPages: number
  apiKey: string
  service: 'openai' | 'anthropic'
  model: string
}): Promise<{
  screenplay: string
  maxLineCount: number
  truncated: boolean
  originalLineCount?: number
}> {
  const targetLineCount = targetPages * SCREENPLAY_LINES_PER_PAGE
  const maxLineCount = Math.round(targetLineCount * 1.08)

  const systemPrompt = `You are a professional screenwriter. Write in standard screenplay format with scene heading, action lines, character names in ALL CAPS, dialogue, and parentheticals when needed.

You MUST read the full treatment and prior scenes provided for story continuity — match character voices, plot beats, tone, and world details.

CRITICAL: If characters speak in the treatment or source material, you MUST write their dialogue in proper screenplay format (CHARACTER NAME on its own line, then dialogue). Do not output action-only prose. Every speaking character needs at least one dialogue block unless they only appear silently.

LENGTH IS MANDATORY: The user requested exactly ${targetPages} standard screenplay page${targetPages === 1 ? '' : 's'}. Your output must stay within ${maxLineCount} lines total (~${targetLineCount} lines target at 55 lines/page). Stop when you reach that length even if more story beats remain.

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

TARGET LENGTH (STRICT): ${targetPages} page${targetPages === 1 ? '' : 's'} = about ${targetLineCount} lines (55 lines/page). Do NOT exceed ${maxLineCount} lines. Condense or expand to hit this length — not shorter than ${Math.round(targetLineCount * 0.85)} lines and not longer than ${maxLineCount} lines.

Write the full screenplay scene now. Stay faithful to the treatment's story while expanding this scene into proper screenplay format with character dialogue where characters speak.`

  const maxTokens = maxTokensForTargetPages(targetPages, model)

  if (service === 'anthropic') {
      const response = await AnthropicService.generateScript({
      prompt: userPrompt,
      template: systemPrompt,
      model,
      apiKey,
      maxTokens,
    })
    if (!response.success) {
      throw new Error(response.error || 'Failed to generate screenplay')
    }
    return finalizeScreenplay(cleanGeneratedScreenplay(response.data.content[0].text), maxLineCount)
  }

  const response = await OpenAIService.generateScript({
    prompt: userPrompt,
    template: systemPrompt,
    model,
    apiKey,
    maxTokens,
    strictOutputCap: true,
  })

  if (!response.success) {
    throw new Error(response.error || 'Failed to generate screenplay')
  }

  const content = response.data?.choices?.[0]?.message?.content
  if (!content || (typeof content === 'string' && !content.trim())) {
    throw new Error('No screenplay content returned from AI')
  }

  return finalizeScreenplay(
    cleanGeneratedScreenplay(typeof content === 'string' ? content : String(content)),
    maxLineCount,
  )
}

function finalizeScreenplay(
  screenplay: string,
  maxLineCount: number,
): {
  screenplay: string
  maxLineCount: number
  truncated: boolean
  originalLineCount?: number
} {
  const { text, truncated, originalLineCount } = trimScreenplayToMaxLines(
    screenplay,
    maxLineCount,
  )
  return {
    screenplay: text,
    maxLineCount,
    truncated,
    originalLineCount: truncated ? originalLineCount : undefined,
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { screenplaySceneId, targetPages: rawTargetPages } = body

    if (!screenplaySceneId || typeof screenplaySceneId !== 'string') {
      return NextResponse.json({ error: 'screenplaySceneId is required' }, { status: 400 })
    }

    const parsedTargetPages =
      typeof rawTargetPages === 'number'
        ? rawTargetPages
        : typeof rawTargetPages === 'string'
          ? Number.parseInt(rawTargetPages, 10)
          : 1
    const targetPages =
      Number.isFinite(parsedTargetPages) && parsedTargetPages >= 1
        ? Math.min(Math.floor(parsedTargetPages), 20)
        : 1

    const scene =
      (await resolveScreenplaySceneForGeneration({
        supabase,
        userId: user.id,
        workspaceId,
        screenplaySceneId,
      })) ?? null

    if (!scene) {
      return NextResponse.json(
        {
          error:
            'Screenplay scene not found. Re-save the scene from chat (Save to Scene) or refresh the workspace and try again.',
        },
        { status: 404 },
      )
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
    let pageLengthTrim: {
      maxLineCount: number
      truncated: boolean
      originalLineCount?: number
    } | null = null
    const skippedBecauseAlreadyFormatted = isAlreadyScreenplayFormat(sourceContent)
    if (skippedBecauseAlreadyFormatted) {
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

      const generated = await generateScreenplayText({
        sourceContent,
        sceneName: scene.name,
        sceneNumber: scene.scene_number,
        location: scene.location,
        characters: scene.characters,
        treatmentContext: treatmentResult.context,
        targetPages,
        apiKey: aiConfig.apiKey,
        service: aiConfig.service,
        model: aiConfig.model,
      })
      screenplay = generated.screenplay
      pageLengthTrim = {
        maxLineCount: generated.maxLineCount,
        truncated: generated.truncated,
        originalLineCount: generated.originalLineCount,
      }
    }

    const maxLineCountForDebug =
      pageLengthTrim?.maxLineCount ?? Math.round(targetPages * SCREENPLAY_LINES_PER_PAGE * 1.08)

    const pageLengthDebug = buildPageLengthDebug({
      screenplaySceneId: scene.id,
      sceneName: scene.name,
      targetPages,
      screenplay,
      usedAi: !skippedBecauseAlreadyFormatted,
      skippedBecauseAlreadyFormatted,
      maxLineCountAllowed: maxLineCountForDebug,
      truncated: pageLengthTrim?.truncated,
      originalLineCount: pageLengthTrim?.originalLineCount,
    })

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
      sceneId: scene.id,
      screenplaySceneId: scene.id,
      usedAi: !skippedBecauseAlreadyFormatted,
      timelineSceneId: syncResult.timelineSceneId,
      treatmentUsed: treatmentResult.hasTreatment,
      actCount: treatmentResult.actCount,
      priorSceneCount: treatmentResult.priorSceneCount,
      targetPages,
      warnings: syncResult.warnings,
      pageLengthDebug,
    })
  } catch (error) {
    console.error('[generate-screenplay-scene]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
