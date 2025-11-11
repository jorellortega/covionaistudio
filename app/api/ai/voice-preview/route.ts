import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { voiceId } = await request.json()
    
    if (!voiceId) {
      return NextResponse.json(
        { error: 'Voice ID is required' },
        { status: 400 }
      )
    }

    // Get the current user's API key
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's ElevenLabs API key
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('elevenlabs_api_key')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.elevenlabs_api_key) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 401 }
      )
    }

    // Get voice preview
    const result = await ElevenLabsService.getVoicePreview(userData.elevenlabs_api_key, voiceId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to get voice preview' },
        { status: 500 }
      )
    }

    // If we got a URL, return it
    if (result.data?.audioUrl) {
      // If it's a data URL (base64), we need to convert it to a response
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
      
      // If it's a URL, return it
      return NextResponse.json({
        success: true,
        audioUrl: result.data.audioUrl
      })
    }

    return NextResponse.json(
      { error: 'No audio URL in response' },
      { status: 500 }
    )
  } catch (error) {
    console.error('Voice preview error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

