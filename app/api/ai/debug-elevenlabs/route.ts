import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    console.log('🔍 DEBUG: Checking ElevenLabs API status...')

    // Check API key validity
    const isValid = await ElevenLabsService.validateApiKey(apiKey)
    console.log('🔑 API Key Valid:', isValid)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    // Get user info and credits
    const userInfo = await ElevenLabsService.getUserInfo(apiKey)
    
    if (!userInfo.success) {
      return NextResponse.json(
        { error: `Failed to get user info: ${userInfo.error}` },
        { status: 500 }
      )
    }

    // Get available voices
    const voices = await ElevenLabsService.getAvailableVoices(apiKey)
    
    // Prepare debug response
    const debugInfo = {
      timestamp: new Date().toISOString(),
      apiKeyValid: isValid,
      user: userInfo.data,
      voices: voices.success ? voices.data : { error: voices.error },
      subscription: userInfo.data.subscription ? {
        tier: userInfo.data.subscription.tier,
        character_count: userInfo.data.subscription.character_count,
        character_limit: userInfo.data.subscription.character_limit,
        remaining_characters: userInfo.data.subscription.character_limit - userInfo.data.subscription.character_count,
        can_extend: userInfo.data.subscription.can_extend_character_limit,
        reset_date: userInfo.data.subscription.next_character_count_reset,
        is_limit_reached: userInfo.data.subscription.character_count >= userInfo.data.subscription.character_limit
      } : null
    }

    console.log('📊 DEBUG: ElevenLabs Status:', debugInfo)

    return NextResponse.json({
      success: true,
      debug: debugInfo
    })

  } catch (error) {
    console.error('DEBUG ElevenLabs error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
