import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getElevenLabsApiKeyForUser } from '@/lib/elevenlabs-api-key'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

async function saveProjectVoice(
  supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>,
  userId: string,
  input: {
    projectId: string
    voiceId: string
    name: string
    description?: string
    category?: string
    characterId?: string | null
  },
) {
  const { data: existing } = await supabase
    .from('project_voices')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', input.projectId)
    .eq('elevenlabs_voice_id', input.voiceId)
    .maybeSingle()

  const payload = {
    name: input.name,
    description: input.description || null,
    category: input.category || null,
    character_id: input.characterId || null,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    await supabase.from('project_voices').update(payload).eq('id', existing.id)
    return
  }

  await supabase.from('project_voices').insert({
    user_id: userId,
    project_id: input.projectId,
    elevenlabs_voice_id: input.voiceId,
    ...payload,
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not signed in. Refresh the page and try again.' }, { status: 401 })
    }

    const { voiceId, name: customName, projectId, characterId } = await request.json()
    const trimmedId = typeof voiceId === 'string' ? voiceId.trim() : ''
    const trimmedProjectId = typeof projectId === 'string' ? projectId.trim() : ''
    const trimmedCharacterId = typeof characterId === 'string' ? characterId.trim() : null

    if (!trimmedId) {
      return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 })
    }

    if (!trimmedProjectId) {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    }

    const apiKey = await getElevenLabsApiKeyForUser(user.id)
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'No ElevenLabs API key found. Add your key in Setup AI, or ask an admin to set the platform key.',
        },
        { status: 403 },
      )
    }

    const result = await ElevenLabsService.getVoiceById(apiKey, trimmedId)
    if (!result.success || !result.data) {
      const message = result.error || ''
      const status = message.includes('401') || message.includes('403') ? 403 : 404
      return NextResponse.json(
        {
          error:
            status === 403
              ? 'ElevenLabs rejected the API key, or this voice ID belongs to a different ElevenLabs account than your configured key.'
              : 'Voice not found. The ID must belong to the ElevenLabs account linked to your API key.',
        },
        { status },
      )
    }

    const voice = result.data as {
      voice_id: string
      name?: string
      category?: string
      description?: string
    }

    const resolvedName =
      (typeof customName === 'string' && customName.trim()) || voice.name || trimmedId

    try {
      await saveProjectVoice(supabase, user.id, {
        projectId: trimmedProjectId,
        voiceId: voice.voice_id,
        name: resolvedName,
        description: voice.description,
        category: voice.category,
        characterId: trimmedCharacterId,
      })
    } catch (saveError) {
      console.error('Failed to save project voice record:', saveError)
    }

    return NextResponse.json({
      success: true,
      voice_id: voice.voice_id,
      name: resolvedName,
      category: voice.category,
      description: voice.description,
    })
  } catch (error) {
    console.error('Import voice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
