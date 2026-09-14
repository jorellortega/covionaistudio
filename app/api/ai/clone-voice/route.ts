import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getElevenLabsApiKeyForUser } from '@/lib/elevenlabs-api-key'
import { logApiCostFromRequest } from '@/lib/api-cost-tracker'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import {
  chargeCreateVoiceCredits,
  insufficientCreditsPayload,
  InsufficientCreditsError,
  refundStudioCredits,
} from '@/lib/studio-credits'

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

    const formData = await request.formData()
    const name = (formData.get('name') as string | null)?.trim()
    const description = (formData.get('description') as string | null)?.trim() || ''
    const projectId = (formData.get('projectId') as string | null)?.trim() || ''
    const characterId = (formData.get('characterId') as string | null)?.trim() || null
    const bodyApiKey = (formData.get('apiKey') as string | null)?.trim() || ''
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)

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

    if (!projectId) {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one audio sample is required' }, { status: 400 })
    }

    let reserved: { userId: string; amount: number } | null = null
    try {
      const charged = await chargeCreateVoiceCredits({
        userId: user.id,
        kind: 'instant-voice-clone',
        description: 'Create voice (instant clone)',
        metadata: { projectId, characterId, name },
      })
      reserved = { userId: user.id, amount: charged.amount }

      const result = await ElevenLabsService.cloneVoice(apiKey, name, description, files)
      if (!result.success) {
        throw new Error(result.error || 'Failed to clone voice')
      }

      const voiceId = result.data?.voice_id as string | undefined
      const voiceName = (result.data?.name as string | undefined) || name

      if (voiceId) {
        try {
          await saveProjectVoice(supabase, user.id, {
            projectId,
            voiceId,
            name: voiceName,
            description,
            category: 'cloned',
            characterId,
          })
        } catch (saveError) {
          console.error('Failed to save project voice record:', saveError)
        }
      }

      await logApiCostFromRequest({
        request,
        userId: user.id,
        costSource: 'create-voice',
        fallbackSource: 'create-voice',
        generationType: 'audio',
        provider: 'elevenlabs',
        model: 'instant-voice-clone',
        audioKind: 'instant-voice-clone',
        costUsd: charged.costUsd,
        prompt: description || name,
        metadata: {
          kind: 'instant-voice-clone',
          creditsCharged: charged.amount,
          projectId,
        },
      })

      return NextResponse.json({
        success: true,
        ...result.data,
        creditsCharged: charged.amount,
        creditsRemaining: charged.balance,
      })
    } catch (error) {
      if (reserved) {
        await refundStudioCredits({
          userId: reserved.userId,
          amount: reserved.amount,
          description: 'Refund: voice clone failed',
          metadata: { source: 'create-voice', kind: 'instant-voice-clone' },
        })
      }
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json(insufficientCreditsPayload(error), { status: 402 })
      }
      throw error
    }
  } catch (error) {
    console.error('Clone voice error:', error)
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(insufficientCreditsPayload(error), { status: 402 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
