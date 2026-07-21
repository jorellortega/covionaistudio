import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import type { AIMessage, AISettingsMap } from '@/lib/ai-chat-types'

type RouteContext = { params: Promise<{ id: string; artifactId: string }> }

function mapSettings(settingsData: { setting_key: string; setting_value: string }[]): AISettingsMap {
  const settings: AISettingsMap = {}
  for (const setting of settingsData || []) {
    settings[setting.setting_key] = setting.setting_value
  }
  return settings
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '').trim()
}

function normalizeTitle(value: string): string {
  return stripWrappingQuotes(value.replace(/\*\*(.*?)\*\*/g, '$1').split('\n')[0].trim())
}

function ensureUniqueName(baseName: string, existingTitles: string[]): string {
  const trimmed = normalizeTitle(baseName)
  if (!trimmed) return trimmed

  const exists = (candidate: string) =>
    existingTitles.some((title) => title.toLowerCase() === candidate.toLowerCase())

  if (!exists(trimmed)) return trimmed

  let counter = 2
  while (exists(`${trimmed} (${counter})`)) {
    counter += 1
  }
  return `${trimmed} (${counter})`
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId, artifactId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: artifact, error: artifactError } = await supabase
      .from('creative_artifacts')
      .select('*')
      .eq('id', artifactId)
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (artifactError || !artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
    }

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id, title, project_id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    const { data: siblings } = await supabase
      .from('creative_artifacts')
      .select('title')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .neq('id', artifactId)

    const existingTitles = (siblings || [])
      .map((row) => row.title?.trim())
      .filter((title): title is string => !!title)

    let messageContext = ''
    if (artifact.message_id) {
      const { data: message } = await supabase
        .from('creative_messages')
        .select('content')
        .eq('id', artifact.message_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (message?.content) {
        messageContext = message.content.slice(0, 800)
      }
    }

    let projectName = ''
    if (workspace?.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', workspace.project_id)
        .maybeSingle()
      projectName = project?.name || ''
    }

    const metadata = (artifact.metadata || {}) as Record<string, unknown>
    const imagePrompt =
      typeof metadata.prompt === 'string' ? metadata.prompt.slice(0, 800) : ''

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
    const existingList =
      existingTitles.length > 0
        ? existingTitles.map((title) => `- ${title}`).join('\n')
        : '(none yet)'

    const prompt = `Name this creative workspace image asset for a film project.

Rules:
- 2 to 6 words, descriptive and professional
- Describe what the image shows or its story purpose
- No file extensions, no dates, no "Image -" prefix
- Do NOT reuse any existing asset name below
- If a similar name already exists, make this one clearly distinct (different angle, subject detail, or scene beat)
- Output ONLY the name, nothing else

Project: ${workspace?.title || 'Untitled'}
${projectName ? `Movie: ${projectName}` : ''}
Current name: ${artifact.title}
Type: ${artifact.artifact_type}
${artifact.label ? `Label: ${artifact.label}` : ''}
${imagePrompt ? `Generation prompt: ${imagePrompt}` : ''}
${messageContext ? `Chat context: ${messageContext}` : ''}

Existing asset names in this workspace:
${existingList}`

    let suggested = await callOpenAI(
      [
        {
          role: 'system',
          content:
            'You name film production image assets. Output only a short unique asset name.',
        },
        { role: 'user', content: prompt },
      ],
      settings,
    )

    if (!suggested) {
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }

    suggested = normalizeTitle(suggested)
    if (!suggested) {
      return NextResponse.json({ error: 'AI returned an empty name' }, { status: 502 })
    }

    const uniqueTitle = ensureUniqueName(suggested, existingTitles)

    const { data: updated, error: updateError } = await supabase
      .from('creative_artifacts')
      .update({
        title: uniqueTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artifactId)
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      title: uniqueTitle,
      suggested,
      wasRenamedForUniqueness: uniqueTitle !== suggested,
      artifact: updated,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
