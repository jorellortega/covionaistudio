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
  shouldChargeAudioCredits,
} from '@/lib/studio-credits'

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
    const body = await request.json()
    const { text, voiceId, apiKey: bodyApiKey, costSource } = body

    console.log('🚀 TEXT-TO-SPEECH API: Request parsed successfully')
    console.log('🚀 TEXT-TO-SPEECH API: Text length:', text?.length || 0)
    console.log('🚀 TEXT-TO-SPEECH API: Voice ID:', voiceId)

    if (!text) {
      console.log('🚀 TEXT-TO-SPEECH API: Missing required fields')
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    const supabase = await createRouteSupabaseClient()
    const authUser = await getRouteAuthUser(supabase, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    let apiKey = await getElevenLabsApiKeyForUser(authUser.id)
    if (!apiKey && typeof bodyApiKey === 'string' && bodyApiKey.trim()) {
      apiKey = bodyApiKey.trim()
    }

    console.log('🚀 TEXT-TO-SPEECH API: Has API key:', !!apiKey)

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured. Add your key in Setup AI, or ask an admin to set the platform key.' },
        { status: 403 },
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
    const elevenLabsUser = userInfo.data
    console.log('👤 ElevenLabs User Info:', {
      id: elevenLabsUser.id,
      email: elevenLabsUser.email,
      first_name: elevenLabsUser.first_name,
      last_name: elevenLabsUser.last_name,
      subscription: elevenLabsUser.subscription,
      is_new_user: elevenLabsUser.is_new_user,
      xi_api_key: elevenLabsUser.xi_api_key ? 'Set' : 'Not set'
    })

    // Check subscription status
    if (elevenLabsUser.subscription) {
      console.log('💳 Subscription Details:', {
        tier: elevenLabsUser.subscription.tier,
        character_count: elevenLabsUser.subscription.character_count,
        character_limit: elevenLabsUser.subscription.character_limit,
        can_extend_character_limit: elevenLabsUser.subscription.can_extend_character_limit,
        allowed_to_extend_character_limit: elevenLabsUser.subscription.allowed_to_extend_character_limit,
        next_character_count_reset: elevenLabsUser.subscription.next_character_count_reset
      })
      
      // Check if user has enough characters
      if (elevenLabsUser.subscription.character_count >= elevenLabsUser.subscription.character_limit) {
        const resetDate = elevenLabsUser.subscription.next_character_count_reset 
          ? new Date(elevenLabsUser.subscription.next_character_count_reset).toLocaleDateString()
          : 'unknown'
        
        return NextResponse.json(
          { 
            error: `Character limit reached. You've used ${elevenLabsUser.subscription.character_count}/${elevenLabsUser.subscription.character_limit} characters. Reset date: ${resetDate}` 
          },
          { status: 402 }
        )
      }
    }

    const characterCount = typeof text === 'string' ? text.length : 0
    const chargeAudio = shouldChargeAudioCredits(
      request,
      typeof costSource === 'string' ? costSource : null,
    )

    let reserved: { userId: string; amount: number } | null = null
    let charged: { amount: number; balance: number; costUsd: number } | null = null

    if (chargeAudio) {
      try {
        charged = await chargeCreateVoiceCredits({
          userId: authUser.id,
          kind: 'tts',
          characterCount,
          description: 'Create voice (test line TTS)',
          metadata: { voiceId: voiceId || null, characterCount },
        })
        reserved = { userId: authUser.id, amount: charged.amount }
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return NextResponse.json(insufficientCreditsPayload(error), { status: 402 })
        }
        throw error
      }
    }

    try {
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
          throw new Error(result.error || 'Failed to generate audio')
        }

        contentType = result.data?.content_type || contentType

        if (result.data?.audio_array_buffer) {
          audioBuffers.push(result.data.audio_array_buffer)
        } else if (result.data?.blob) {
          audioBuffers.push(await result.data.blob.arrayBuffer())
        } else {
          throw new Error('Audio data missing from ElevenLabs response')
        }
      }

      if (charged) {
        await logApiCostFromRequest({
          request,
          userId: authUser.id,
          costSource: 'create-voice',
          fallbackSource: 'create-voice',
          generationType: 'audio',
          provider: 'elevenlabs',
          model: 'eleven_multilingual_v2',
          audioKind: 'tts',
          costUsd: charged.costUsd,
          inputTokens: characterCount,
          prompt: typeof text === 'string' ? text : '',
          metadata: {
            kind: 'tts',
            creditsCharged: charged.amount,
            characterCount,
            voiceId: voiceId || null,
          },
        })
      }

      const merged = mergeMp3ArrayBuffers(audioBuffers)
      return new NextResponse(merged, {
        headers: {
          'Content-Type': contentType,
          ...(charged
            ? {
                'X-Credits-Charged': String(charged.amount),
                'X-Credits-Remaining': String(charged.balance),
                'Access-Control-Expose-Headers': 'X-Credits-Charged, X-Credits-Remaining',
              }
            : {}),
        },
      })
    } catch (error) {
      if (reserved) {
        await refundStudioCredits({
          userId: reserved.userId,
          amount: reserved.amount,
          description: 'Refund: create-voice TTS failed',
          metadata: { source: 'create-voice', kind: 'tts' },
        })
      }
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json(insufficientCreditsPayload(error), { status: 402 })
      }
      throw error
    }
  } catch (error) {
    console.error('Text-to-speech error:', error)
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(insufficientCreditsPayload(error), { status: 402 })
    }
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
