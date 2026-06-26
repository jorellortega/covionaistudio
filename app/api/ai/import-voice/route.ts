import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getElevenLabsApiKeyForUser } from '@/lib/elevenlabs-api-key'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

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

    const { voiceId, name: customName } = await request.json()
    const trimmedId = typeof voiceId === 'string' ? voiceId.trim() : ''

    if (!trimmedId) {
      return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 })
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

    return NextResponse.json({
      success: true,
      voice_id: voice.voice_id,
      name: (typeof customName === 'string' && customName.trim()) || voice.name || trimmedId,
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
