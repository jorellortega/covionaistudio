import { NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getElevenLabsApiKeyForUser } from '@/lib/elevenlabs-api-key'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

export async function POST() {
  try {
    const supabase = await createRouteSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const apiKey = await getElevenLabsApiKeyForUser(user.id)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured. Add your key in Setup AI.' },
        { status: 403 },
      )
    }

    const result = await ElevenLabsService.getAvailableVoices(apiKey)
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to fetch voices' }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('List voices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
