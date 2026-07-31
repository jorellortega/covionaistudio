import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import type { AIMessage, AISettingsMap } from '@/lib/ai-chat-types'

type RouteContext = { params: Promise<{ sceneId: string }> }

function mapSettings(settingsData: { setting_key: string; setting_value: string }[]): AISettingsMap {
  const settings: AISettingsMap = {}
  for (const setting of settingsData || []) {
    settings[setting.setting_key] = setting.setting_value
  }
  return settings
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'""'']+|["'""'']+$/g, '').trim()
}

function normalizeSceneName(value: string): string {
  return stripWrappingQuotes(value.replace(/\*\*(.*?)\*\*/g, '$1').split('\n')[0].trim())
}

async function callOpenAI(messages: AIMessage[], settings: AISettingsMap): Promise<string | null> {
  const openaiKey = settings['openai_api_key']?.trim()
  const model = settings['openai_model']?.trim() || 'gpt-4o-mini'
  if (!openaiKey) return null

  const isGPT5Model = model.startsWith('gpt-5')
  const requestBody: Record<string, unknown> = {
    model,
    messages: messages.map((msg) => ({ role: msg.role, content: msg.content })),
  }

  if (isGPT5Model) {
    requestBody.max_completion_tokens = 80
    requestBody.reasoning_effort = 'none'
    requestBody.verbosity = 'low'
  } else {
    requestBody.max_tokens = 50
    requestBody.temperature = 0.6
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) return null
  const data = await response.json()
  return data?.choices?.[0]?.message?.content?.trim() || null
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { sceneId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, _request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: scene, error: sceneError } = await supabase
      .from('scenes')
      .select('id, name, description, metadata, screenplay_content, timeline_id')
      .eq('id', sceneId)
      .maybeSingle()

    if (sceneError || !scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
    }

    const metadata = (scene.metadata || {}) as Record<string, unknown>
    const sceneNumber =
      typeof metadata.sceneNumber === 'string' ? metadata.sceneNumber : ''
    const location = typeof metadata.location === 'string' ? metadata.location : ''
    const characters = Array.isArray(metadata.characters)
      ? metadata.characters.filter((c): c is string => typeof c === 'string')
      : []
    const notes = typeof metadata.notes === 'string' ? metadata.notes : ''

    let screenplay =
      typeof scene.screenplay_content === 'string' ? scene.screenplay_content.trim() : ''

    let projectId: string | null = null
    let projectName = ''

    if (scene.timeline_id) {
      const { data: timeline } = await supabase
        .from('timelines')
        .select('project_id')
        .eq('id', scene.timeline_id)
        .maybeSingle()
      projectId = timeline?.project_id || null
    }

    if (projectId) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .maybeSingle()
      projectName = project?.name || ''

      if (!screenplay && sceneNumber) {
        const { data: screenplayScene } = await supabase
          .from('screenplay_scenes')
          .select('content')
          .eq('project_id', projectId)
          .eq('scene_number', sceneNumber)
          .maybeSingle()

        if (screenplayScene?.content?.trim()) {
          screenplay = screenplayScene.content.trim()
        }
      }
    }

    const description = scene.description?.trim() || ''
    const contextParts = [
      screenplay ? `Screenplay:\n${screenplay.slice(0, 6000)}` : '',
      description ? `Description:\n${description.slice(0, 2000)}` : '',
      location ? `Location: ${location}` : '',
      characters.length ? `Characters: ${characters.join(', ')}` : '',
      notes ? `Notes: ${notes.slice(0, 500)}` : '',
      sceneNumber ? `Scene number: ${sceneNumber}` : '',
      `Current title: ${scene.name}`,
    ].filter(Boolean)

    if (contextParts.length <= 1 && !screenplay && !description) {
      return NextResponse.json(
        { error: 'Add scene description or screenplay content before using AI naming' },
        { status: 400 },
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const { data: settingsData, error: settingsError } = await serviceSupabase.rpc('get_system_ai_config')
    if (settingsError) {
      return NextResponse.json({ error: 'Failed to load AI configuration' }, { status: 500 })
    }

    const settings = mapSettings(settingsData || [])

    const prompt = `Name this movie scene for a production timeline.

Rules:
- 2 to 8 words, cinematic and specific
- Capture the dramatic beat or setting, not generic labels like "Scene 1"
- No scene numbers, no INT./EXT. sluglines, no quotes
- Output ONLY the scene title, nothing else

${projectName ? `Movie: ${projectName}` : ''}

${contextParts.join('\n\n')}`

    let suggested = await callOpenAI(
      [
        {
          role: 'system',
          content: 'You name film scenes for directors and editors. Output only a short scene title.',
        },
        { role: 'user', content: prompt },
      ],
      settings,
    )

    if (!suggested) {
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }

    suggested = normalizeSceneName(suggested)
    if (!suggested) {
      return NextResponse.json({ error: 'AI returned an empty name' }, { status: 502 })
    }

    return NextResponse.json({ name: suggested })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
