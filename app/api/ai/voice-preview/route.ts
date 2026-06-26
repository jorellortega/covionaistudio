import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getElevenLabsApiKeyForUser } from '@/lib/elevenlabs-api-key'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

export async function POST(request: NextRequest) {
  try {
    const { voiceId } = await request.json()

    if (!voiceId) {
      return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 })
    }

    const supabase = await createRouteSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const elevenLabsApiKey = await getElevenLabsApiKeyForUser(user.id)
    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured (check Setup AI or system config)' },
        { status: 403 },
      )
    }

    const result = await ElevenLabsService.getVoicePreview(elevenLabsApiKey, voiceId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to get voice preview' },
        { status: 500 },
      )
    }

    if (result.data?.audioUrl) {
      if (result.data.audioUrl.startsWith('data:')) {
        const base64Data = result.data.audioUrl.split(',')[1]
        const audioBuffer = Buffer.from(base64Data, 'base64')
        return new NextResponse(audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length.toString(),
          },
        })
      }

      return NextResponse.json({
        success: true,
        audioUrl: result.data.audioUrl,
      })
    }

    return NextResponse.json({ error: 'No audio URL in response' }, { status: 500 })
  } catch (error) {
    console.error('Voice preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
