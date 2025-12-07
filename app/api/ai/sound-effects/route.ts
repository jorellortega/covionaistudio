import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  console.log('🔊 SOUND EFFECTS API: Route called!')
  try {
    const { text, duration, prompt_influence, looping, apiKey } = await request.json()
    
    console.log('🔊 SOUND EFFECTS API: Request parsed successfully')
    console.log('🔊 SOUND EFFECTS API: Text length:', text?.length || 0)
    console.log('🔊 SOUND EFFECTS API: Duration:', duration)
    console.log('🔊 SOUND EFFECTS API: Prompt influence:', prompt_influence)
    console.log('🔊 SOUND EFFECTS API: Looping:', looping)
    console.log('🔊 SOUND EFFECTS API: Has API key:', !!apiKey)

    if (!text || !apiKey) {
      console.log('🔊 SOUND EFFECTS API: Missing required fields')
      return NextResponse.json(
        { error: 'Text and API key are required' },
        { status: 400 }
      )
    }

    // Validate API key
    console.log('🔍 Validating ElevenLabs API key...')
    const isValid = await ElevenLabsService.validateApiKey(apiKey)
    
    if (!isValid) {
      console.error('❌ Invalid API key')
      return NextResponse.json(
        { error: 'Invalid ElevenLabs API key' },
        { status: 401 }
      )
    }

    // Generate sound effect using ElevenLabs
    console.log('🔊 Generating sound effect with ElevenLabs...')
    console.log('📝 Text:', text.substring(0, 100) + '...')
    console.log('🔑 API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
    
    const result = await ElevenLabsService.generateSoundEffect({
      prompt: text,
      apiKey: apiKey,
      duration: duration,
      prompt_influence: prompt_influence,
      looping: looping,
    })
    
    console.log('🔊 ElevenLabs generateSoundEffect result:', {
      success: result.success,
      error: result.error,
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : []
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate sound effect' },
        { status: 500 }
      )
    }

    // Return the audio blob
    if (result.data?.audio_array_buffer) {
      return new NextResponse(result.data.audio_array_buffer, {
        headers: {
          'Content-Type': result.data.content_type || 'audio/mpeg',
        },
      })
    }

    return NextResponse.json(
      { error: 'No audio data received' },
      { status: 500 }
    )
  } catch (error) {
    console.error('🔊 SOUND EFFECTS API: Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}




