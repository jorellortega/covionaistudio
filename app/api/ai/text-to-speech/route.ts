import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  console.log('🚀 TEXT-TO-SPEECH API: Route called!')
  try {
    const { text, voiceId, apiKey } = await request.json()
    
    console.log('🚀 TEXT-TO-SPEECH API: Request parsed successfully')
    console.log('🚀 TEXT-TO-SPEECH API: Text length:', text?.length || 0)
    console.log('🚀 TEXT-TO-SPEECH API: Voice ID:', voiceId)
    console.log('🚀 TEXT-TO-SPEECH API: Has API key:', !!apiKey)

    if (!text || !apiKey) {
      console.log('🚀 TEXT-TO-SPEECH API: Missing required fields')
      return NextResponse.json(
        { error: 'Text and API key are required' },
        { status: 400 }
      )
    }

    // Check user info and credits before generating audio
    console.log('🔍 Checking ElevenLabs user info and credits...')
    const userInfo = await ElevenLabsService.getUserInfo(apiKey)
    
    if (!userInfo.success) {
      console.error('❌ Failed to get user info:', userInfo.error)
      return NextResponse.json(
        { error: `Failed to verify API key: ${userInfo.error}` },
        { status: 401 }
      )
    }

    // Log user info for debugging
    const user = userInfo.data
    console.log('👤 ElevenLabs User Info:', {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      subscription: user.subscription,
      is_new_user: user.is_new_user,
      xi_api_key: user.xi_api_key ? 'Set' : 'Not set'
    })

    // Check subscription status
    if (user.subscription) {
      console.log('💳 Subscription Details:', {
        tier: user.subscription.tier,
        character_count: user.subscription.character_count,
        character_limit: user.subscription.character_limit,
        can_extend_character_limit: user.subscription.can_extend_character_limit,
        allowed_to_extend_character_limit: user.subscription.allowed_to_extend_character_limit,
        next_character_count_reset: user.subscription.next_character_count_reset
      })
      
      // Check if user has enough characters
      if (user.subscription.character_count >= user.subscription.character_limit) {
        const resetDate = user.subscription.next_character_count_reset 
          ? new Date(user.subscription.next_character_count_reset).toLocaleDateString()
          : 'unknown'
        
        return NextResponse.json(
          { 
            error: `Character limit reached. You've used ${user.subscription.character_count}/${user.subscription.character_limit} characters. Reset date: ${resetDate}` 
          },
          { status: 402 }
        )
      }
    }

    // Generate audio using ElevenLabs
    console.log('🎵 Generating audio with ElevenLabs...')
    console.log('📝 Text length:', text.length)
    console.log('🎤 Voice ID:', voiceId || "21m00Tcm4TlvDq8ikWAM")
    console.log('🔑 API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
    
    const result = await ElevenLabsService.generateAudio({
      prompt: text,
      voiceId: voiceId || "21m00Tcm4TlvDq8ikWAM", // Default to Rachel voice
      apiKey: apiKey,
      type: 'audio'
    })
    
    console.log('🎵 ElevenLabs generateAudio result:', {
      success: result.success,
      error: result.error,
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : []
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate audio' },
        { status: 500 }
      )
    }

    // Return the audio blob as a response
    const contentType = result.data?.content_type || 'audio/mpeg'

    if (result.data?.audio_array_buffer) {
      return new NextResponse(result.data.audio_array_buffer, {
        headers: {
          'Content-Type': contentType,
        },
      })
    }

    if (result.data?.blob) {
      const arrayBuffer = await result.data.blob.arrayBuffer()
      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': contentType,
        },
      })
    }

    return NextResponse.json(
      { error: 'Audio data missing from ElevenLabs response' },
      { status: 500 }
    )
  } catch (error) {
    console.error('Text-to-speech error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
