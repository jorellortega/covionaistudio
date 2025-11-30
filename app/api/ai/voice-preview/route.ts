import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getSupabaseClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

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

    // Get ElevenLabs API key (check system-wide first, then user-specific)
    let elevenLabsApiKey: string | null = null
    
    // First, check system-wide API key
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        )

        const { data: systemConfig, error: systemError } = await supabaseAdmin.rpc('get_system_ai_config')
        
        if (!systemError && systemConfig && Array.isArray(systemConfig)) {
          const configMap: Record<string, string> = {}
          systemConfig.forEach((item: any) => {
            configMap[item.setting_key] = item.setting_value
          })

          if (configMap['elevenlabs_api_key']?.trim()) {
            elevenLabsApiKey = configMap['elevenlabs_api_key'].trim()
            console.log('✅ Using system-wide ElevenLabs API key from system_ai_config (CEO-set)')
          }
        }
      }
    } catch (systemKeyError) {
      console.error('❌ Error checking system-wide API keys:', systemKeyError)
    }

    // Fallback to user-specific key if no system-wide key found
    if (!elevenLabsApiKey) {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('elevenlabs_api_key')
      .eq('id', user.id)
        .maybeSingle()

      if (!userError && userData?.elevenlabs_api_key?.trim()) {
        elevenLabsApiKey = userData.elevenlabs_api_key.trim()
      }
    }

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured (check user profile or system config)' },
        { status: 401 }
      )
    }

    // Get voice preview
    const result = await ElevenLabsService.getVoicePreview(elevenLabsApiKey, voiceId)

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

