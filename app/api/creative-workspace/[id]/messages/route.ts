import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import { CREATIVE_CHAT_SYSTEM_PROMPT } from '@/lib/creative-chat-prompt'
import { detectImageRequest, buildImagePromptInstruction } from '@/lib/creative-chat-utils'
import {
  mapDisplayModelToService,
  normalizeDisplayModelToApiId,
  DEFAULT_CINEMATIC_IMAGE_WIDTH,
  DEFAULT_CINEMATIC_IMAGE_HEIGHT,
} from '@/lib/image-model-utils'
import type { AIMessage, AISettingsMap } from '@/lib/ai-chat-types'

type RouteContext = { params: Promise<{ id: string }> }

function mapSettings(settingsData: { setting_key: string; setting_value: string }[]): AISettingsMap {
  const settings: AISettingsMap = {}
  for (const setting of settingsData || []) {
    settings[setting.setting_key] = setting.setting_value
  }
  return settings
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
    requestBody.max_completion_tokens = 6000
    requestBody.reasoning_effort = 'none'
    requestBody.verbosity = 'medium'
  } else {
    requestBody.max_tokens = 4000
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

async function callAnthropic(messages: AIMessage[], settings: AISettingsMap, systemPrompt: string): Promise<string | null> {
  const anthropicKey = settings['anthropic_api_key']?.trim()
  const model = settings['anthropic_model']?.trim() || 'claude-3-5-sonnet-20241022'
  if (!anthropicKey) return null

  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  })

  if (!response.ok) return null
  const data = await response.json()
  return data?.content?.[0]?.text?.trim() || null
}

async function getImageModelSettings(
  serviceSupabase: ReturnType<typeof createClient>,
): Promise<{ displayModel: string; apiModel: string; service: string }> {
  const { data } = await serviceSupabase
    .from('ai_settings')
    .select('locked_model, selected_model, is_locked')
    .eq('tab_type', 'images')
    .is('user_id', null)
    .maybeSingle()

  const displayModel =
    data?.is_locked && data.locked_model
      ? data.locked_model
      : data?.selected_model || data?.locked_model || 'DALL-E 3'

  return {
    displayModel,
    apiModel: normalizeDisplayModelToApiId(displayModel),
    service: mapDisplayModelToService(displayModel),
  }
}

async function generateImageFromConversation(
  request: NextRequest,
  userId: string,
  imagePrompt: string,
  serviceSupabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { apiModel, service } = await getImageModelSettings(serviceSupabase)

  const origin = request.nextUrl.origin
  const response = await fetch(`${origin}/api/ai/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: request.headers.get('cookie') || '',
    },
    body: JSON.stringify({
      prompt: imagePrompt,
      service,
      apiKey: 'configured',
      userId,
      model: apiModel,
      width: DEFAULT_CINEMATIC_IMAGE_WIDTH,
      height: DEFAULT_CINEMATIC_IMAGE_HEIGHT,
      autoSaveToBucket: true,
    }),
  })

  if (!response.ok) return null
  const data = await response.json()
  return data.imageUrl || data.url || data.image || null
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('creative_messages')
      .select('*')
      .eq('workspace_id', id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const body = await request.json()
    const { message } = body
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const { data: userMessage, error: userMsgError } = await supabase
      .from('creative_messages')
      .insert([{ workspace_id: workspaceId, role: 'user', content: message.trim() }])
      .select()
      .single()

    if (userMsgError) return NextResponse.json({ error: userMsgError.message }, { status: 500 })

    const { data: history } = await supabase
      .from('creative_messages')
      .select('role, content')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })

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
    const wantsImage = detectImageRequest(message.trim())
    const systemPrompt = wantsImage
      ? `${CREATIVE_CHAT_SYSTEM_PROMPT}\n\nThe user is asking for an image right now. Keep your reply brief (1-2 sentences). Confirm what you're visualizing and that the image will appear in the Images panel. Do not explain how to find images elsewhere or say you cannot create images.`
      : CREATIVE_CHAT_SYSTEM_PROMPT

    const aiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m) => ({ role: m.role as AIMessage['role'], content: m.content })),
    ]

    let assistantContent = await callOpenAI(aiMessages, settings)
    if (!assistantContent) {
      assistantContent = await callAnthropic(aiMessages, settings, systemPrompt)
    }

    if (!assistantContent) {
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }

    assistantContent = assistantContent.replace(/\*\*(.*?)\*\*/g, '$1')

    const { data: assistantMessage, error: assistantError } = await supabase
      .from('creative_messages')
      .insert([{ workspace_id: workspaceId, role: 'assistant', content: assistantContent }])
      .select()
      .single()

    if (assistantError) return NextResponse.json({ error: assistantError.message }, { status: 500 })

    let imageGenerated = false
    let artifact = null

    if (wantsImage) {
      const promptInstruction = buildImagePromptInstruction(history || [], message.trim())
      const imagePromptMessages: AIMessage[] = [
        { role: 'system', content: 'You write cinematic image prompts. Output only the prompt text.' },
        { role: 'user', content: promptInstruction },
      ]

      let imagePrompt = await callOpenAI(imagePromptMessages, settings)
      if (!imagePrompt) {
        imagePrompt = await callAnthropic(imagePromptMessages, settings, 'You write cinematic image prompts. Output only the prompt text.')
      }

      if (!imagePrompt) {
        const recentContext = (history || [])
          .slice(-4)
          .map((m) => m.content)
          .join(' ')
        imagePrompt = `Cinematic film still, ${message.trim()}. ${recentContext}`.slice(0, 500)
      }

      const imageUrl = await generateImageFromConversation(
        request,
        user.id,
        imagePrompt,
        serviceSupabase,
      )

      if (imageUrl) {
        const { data: newArtifact } = await supabase
          .from('creative_artifacts')
          .insert([{
            user_id: user.id,
            workspace_id: workspaceId,
            artifact_type: 'image',
            title: `Image - ${new Date().toLocaleDateString()}`,
            content: imageUrl,
            message_id: assistantMessage.id,
            metadata: { prompt: imagePrompt, auto_generated: true },
          }])
          .select()
          .single()

        artifact = newArtifact
        imageGenerated = true
      }
    }

    await supabase
      .from('creative_workspaces')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    return NextResponse.json({
      userMessage,
      assistantMessage,
      imageGenerated,
      artifact,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
