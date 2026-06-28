import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getElevenLabsApiKeyForUser } from '@/lib/elevenlabs-api-key'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

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
  const { data: existing, error: lookupError } = await supabase
    .from('project_voices')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', input.projectId)
    .eq('elevenlabs_voice_id', input.voiceId)
    .maybeSingle()

  if (lookupError) {
    const msg = lookupError.message || ''
    if (
      lookupError.code === '42P01' ||
      lookupError.code === 'PGRST205' ||
      msg.includes('project_voices')
    ) {
      return
    }
    throw lookupError
  }

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

  const { error: insertError } = await supabase.from('project_voices').insert({
    user_id: userId,
    project_id: input.projectId,
    elevenlabs_voice_id: input.voiceId,
    ...payload,
  })

  if (insertError) {
    const msg = insertError.message || ''
    if (
      insertError.code === '42P01' ||
      insertError.code === 'PGRST205' ||
      msg.includes('project_voices')
    ) {
      return
    }
    throw insertError
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)

    if (!user) {
      return NextResponse.json(
        { error: 'Not signed in. Refresh the page and try again.' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const characterId = typeof body.characterId === 'string' ? body.characterId.trim() : null
    const previewText = typeof body.previewText === 'string' ? body.previewText.trim() : undefined
    const bodyApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''

    let apiKey = await getElevenLabsApiKeyForUser(user.id)
    if (!apiKey && bodyApiKey) apiKey = bodyApiKey
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured. Add your key in Setup AI.' },
        { status: 403 },
      )
    }

    if (!name) {
      return NextResponse.json({ error: 'Voice name is required' }, { status: 400 })
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Voice description is required for Voice Design' },
        { status: 400 },
      )
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    }

    const action =
      body.action === 'confirm' ? 'confirm' : 'preview'
    const generatedVoiceId =
      typeof body.generatedVoiceId === 'string' ? body.generatedVoiceId.trim() : ''

    if (action === 'confirm') {
      if (!generatedVoiceId) {
        return NextResponse.json({ error: 'generatedVoiceId is required' }, { status: 400 })
      }

      const createResult = await ElevenLabsService.createVoiceFromDesignPreview(
        apiKey,
        name,
        description,
        generatedVoiceId,
      )

      if (!createResult.success) {
        return NextResponse.json(
          { error: createResult.error || 'Failed to create voice from design' },
          { status: 502 },
        )
      }

      const voiceId = createResult.data?.voice_id as string | undefined
      const voiceName = (createResult.data?.name as string | undefined) || name

      if (voiceId) {
        try {
          await saveProjectVoice(supabase, user.id, {
            projectId,
            voiceId,
            name: voiceName,
            description,
            category: 'generated',
            characterId,
          })
        } catch (saveError) {
          console.error('Failed to save project voice record:', saveError)
        }
      }

      return NextResponse.json({
        success: true,
        action: 'confirm',
        voice_id: voiceId,
        name: voiceName,
        method: 'design',
      })
    }

    const designResult = await ElevenLabsService.designVoicePreviews(
      apiKey,
      description,
      previewText,
    )

    if (!designResult.success || !designResult.data?.previews?.length) {
      const message = designResult.error || 'Failed to generate voice previews'
      const status = message.includes('401') || message.includes('403') ? 403 : 502
      return NextResponse.json({ error: message }, { status })
    }

    const previews = (designResult.data.previews as Array<Record<string, unknown>>).map(
      (preview, index) => ({
        generated_voice_id: String(preview.generated_voice_id || ''),
        audio_base64:
          typeof preview.audio_base_64 === 'string'
            ? preview.audio_base_64
            : typeof preview.audio_base64 === 'string'
              ? preview.audio_base64
              : undefined,
        duration_secs:
          typeof preview.duration_secs === 'number' ? preview.duration_secs : undefined,
        language: typeof preview.language === 'string' ? preview.language : null,
        label: `Option ${index + 1}`,
      }),
    )

    return NextResponse.json({
      success: true,
      action: 'preview',
      previews: previews.filter((p) => p.generated_voice_id),
    })
  } catch (error) {
    console.error('Design voice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
