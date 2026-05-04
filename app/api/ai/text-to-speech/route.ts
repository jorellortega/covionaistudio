import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'

/** ElevenLabs per-request text limit is 10_000; stay under for safety. */
const ELEVENLABS_TTS_MAX_CHARS = 9500

/**
 * Split long text into segments under ElevenLabs' limit, preferring higher-level
 * boundaries (paragraph, line, sentence, word) in that order.
 */
function splitTextForElevenLabsTts(text: string): string[] {
  const t = text.trim()
  if (!t) return []
  if (t.length <= ELEVENLABS_TTS_MAX_CHARS) return [t]

  const delims = ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '] as const
  const out: string[] = []
  let pos = 0

  while (pos < t.length) {
    const limit = pos + ELEVENLABS_TTS_MAX_CHARS
    if (limit >= t.length) {
      const rest = t.slice(pos).trim()
      if (rest) out.push(rest)
      break
    }

    const minPos = pos + Math.floor(ELEVENLABS_TTS_MAX_CHARS * 0.55)
    let split = -1

    for (const d of delims) {
      let searchEnd = Math.min(limit - 1, t.length - 1)
      while (searchEnd >= minPos) {
        const idx = t.lastIndexOf(d, searchEnd)
        if (idx < pos) break
        const after = idx + d.length
        if (after <= limit && after > minPos) {
          split = after
          break
        }
        searchEnd = idx - 1
      }
      if (split !== -1) break
    }

    if (split === -1) split = limit

    const chunk = t.slice(pos, split).trim()
    if (chunk) out.push(chunk)
    pos = split
    while (pos < t.length && /\s/.test(t[pos])) pos++
  }

  return out
}

function mergeMp3ArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  if (buffers.length === 1) return buffers[0]
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const b of buffers) {
    merged.set(new Uint8Array(b), offset)
    offset += b.byteLength
  }
  return merged.buffer
}

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

    const chunks = splitTextForElevenLabsTts(text)
    if (chunks.length > 1) {
      console.log(`📝 Long text: splitting into ${chunks.length} TTS segments`)
    }

    const voice = voiceId || '21m00Tcm4TlvDq8ikWAM'
    const audioBuffers: ArrayBuffer[] = []
    let contentType = 'audio/mpeg'

    for (let c = 0; c < chunks.length; c++) {
      const result = await ElevenLabsService.generateAudio({
        prompt: chunks[c],
        voiceId: voice,
        apiKey: apiKey,
        type: 'audio',
      })

      console.log('🎵 ElevenLabs generateAudio chunk', c + 1, '/', chunks.length, {
        success: result.success,
        error: result.error,
        hasData: !!result.data,
      })

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to generate audio' },
          { status: 500 }
        )
      }

      contentType = result.data?.content_type || contentType

      if (result.data?.audio_array_buffer) {
        audioBuffers.push(result.data.audio_array_buffer)
      } else if (result.data?.blob) {
        audioBuffers.push(await result.data.blob.arrayBuffer())
      } else {
        return NextResponse.json(
          { error: 'Audio data missing from ElevenLabs response' },
          { status: 500 }
        )
      }
    }

    const merged = mergeMp3ArrayBuffers(audioBuffers)
    return new NextResponse(merged, {
      headers: {
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    console.error('Text-to-speech error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
