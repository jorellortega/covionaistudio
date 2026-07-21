import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import type { AIMessage, AISettingsMap } from '@/lib/ai-chat-types'

type RouteContext = { params: Promise<{ id: string }> }

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
    requestBody.max_completion_tokens = 100
    requestBody.reasoning_effort = 'none'
    requestBody.verbosity = 'low'
  } else {
    requestBody.max_tokens = 60
    requestBody.temperature = 0.7
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
    const { id: workspaceId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id, title')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const { data: messages } = await supabase
      .from('creative_messages')
      .select('role, content')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(20)

    const conversation = (messages || [])
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}`)
      .join('\n\n')

    if (!conversation.trim()) {
      return NextResponse.json({ error: 'Add some messages first so AI can suggest a title' }, { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const { data: settingsData, error: settingsError } = await serviceSupabase.rpc('get_system_ai_config')
    if (settingsError) return NextResponse.json({ error: 'Failed to load AI configuration' }, { status: 500 })

    const settings = mapSettings(settingsData || [])
    const prompt = `You name movie development projects. Based on this conversation, suggest ONE short, professional project title.

Rules:
- 2 to 6 words maximum
- Sounds like a real film or series title
- No quotes, no colons unless part of a proper title
- Output ONLY the title, nothing else

Current title: ${workspace.title}

Conversation:
${conversation}`

    let title = await callOpenAI(
      [
        { role: 'system', content: 'You suggest concise movie project titles. Output only the title.' },
        { role: 'user', content: prompt },
      ],
      settings,
    )

    if (!title) {
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }

    title = stripWrappingQuotes(title.replace(/\*\*(.*?)\*\*/g, '$1').split('\n')[0].trim())

    const { data: updated, error: updateError } = await supabase
      .from('creative_workspaces')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ title, workspace: updated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
