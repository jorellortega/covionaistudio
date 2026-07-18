import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AudioKind = 'dialogue' | 'sound-effect'

type AudioPromptAssistBody = {
  kind?: AudioKind
  title?: string | null
  description?: string | null
  action?: string | null
  dialogue?: string | null
  visualNotes?: string | null
  shotType?: string | null
  cameraAngle?: string | null
  movement?: string | null
  shotNumber?: number | null
  sceneNumber?: number | null
  characterName?: string | null
  locationName?: string | null
  imageUrl?: string | null
  userId?: string | null
}

function buildFallbackPrompt(body: AudioPromptAssistBody, kind: AudioKind): string {
  if (kind === 'dialogue') {
    const spoken = body.dialogue?.trim() || body.action?.trim()
    if (spoken) return spoken
    const bits = [
      body.characterName ? `${body.characterName} speaks` : 'A character speaks',
      body.description?.trim() || body.title?.trim() || 'in this shot',
    ]
    return bits.join(' ')
  }

  const parts: string[] = []
  if (body.action?.trim()) parts.push(body.action.trim())
  if (body.description?.trim()) parts.push(body.description.trim())
  if (body.visualNotes?.trim()) parts.push(body.visualNotes.trim())
  if (body.locationName) parts.push(`Ambience for ${body.locationName}`)
  if (body.imageUrl) {
    parts.push('Match the atmosphere and implied sounds of the reference image')
  }
  if (!parts.length && body.title?.trim()) parts.push(body.title.trim())
  return (
    parts.join('. ') ||
    'Subtle cinematic ambient soundscape matching the shot mood'
  )
}

async function resolveOpenAIKey(): Promise<string | null> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: { autoRefreshToken: false, persistSession: false },
        },
      )
      const { data: systemConfig } = await supabaseAdmin.rpc('get_system_ai_config')
      if (systemConfig && Array.isArray(systemConfig)) {
        const configMap: Record<string, string> = {}
        systemConfig.forEach((item: { setting_key: string; setting_value: string }) => {
          configMap[item.setting_key] = item.setting_value
        })
        if (configMap['openai_api_key']?.trim()) {
          return configMap['openai_api_key'].trim()
        }
      }
    }
  } catch {
    // fall through to env
  }
  return process.env.OPENAI_API_KEY?.trim() || null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AudioPromptAssistBody
    const kind: AudioKind = body.kind === 'dialogue' ? 'dialogue' : 'sound-effect'
    const fallback = buildFallbackPrompt(body, kind)

    const apiKey = await resolveOpenAIKey()
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        prompt: fallback,
        source: 'fallback',
        warning: 'OpenAI API key not configured — used shot details directly.',
      })
    }

    const detailLines = [
      body.shotNumber != null ? `Shot number: ${body.shotNumber}` : null,
      body.sceneNumber != null ? `Scene number: ${body.sceneNumber}` : null,
      body.title ? `Title: ${body.title}` : null,
      body.shotType ? `Shot type: ${body.shotType}` : null,
      body.cameraAngle ? `Camera angle: ${body.cameraAngle}` : null,
      body.movement ? `Camera movement: ${body.movement}` : null,
      body.description ? `Description: ${body.description}` : null,
      body.action ? `Action: ${body.action}` : null,
      body.dialogue ? `Dialogue: ${body.dialogue}` : null,
      body.visualNotes ? `Visual notes: ${body.visualNotes}` : null,
      body.characterName ? `Character: ${body.characterName}` : null,
      body.locationName ? `Location: ${body.locationName}` : null,
      body.imageUrl
        ? 'A reference still image is attached for visual/audio context.'
        : 'No reference image is attached.',
    ]
      .filter(Boolean)
      .join('\n')

    const system =
      kind === 'dialogue'
        ? `You write spoken dialogue lines for text-to-speech (ElevenLabs).
Rules:
- Return ONLY the words the character should say, no quotes, no markdown, no stage directions, no labels.
- Prefer the provided Dialogue field when present; polish lightly for natural speech if needed.
- If no dialogue exists, invent a short, in-character line that fits the shot (1–3 sentences max).
- Do not invent other characters speaking unless dialogue already includes them.
- No sound-effect onomatopoeia, no parentheticals like (whispering).`
        : `You write concise prompts for AI sound-effect generation (ElevenLabs Sound Effects).
Rules:
- Return ONLY the final sound-effect prompt text, no quotes, no markdown, no preamble.
- Describe audible events, materials, space, distance, and mood — not camera or lighting.
- Keep it under 250 characters when possible, max 400.
- Prefer concrete sounds (e.g. "distant crow wings beating through dense forest canopy") over vague film jargon.
- Do not invent sounds unsupported by the shot details or image.
- No dialogue, no music bed descriptions unless the shot clearly calls for them.`

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [
      {
        type: 'text',
        text:
          kind === 'dialogue'
            ? `Write spoken dialogue for TTS from these shot details:\n\n${detailLines}`
            : `Write one production-ready sound-effect prompt from these shot details:\n\n${detailLines}`,
      },
    ]

    if (body.imageUrl?.trim()) {
      userContent.push({
        type: 'image_url',
        image_url: { url: body.imageUrl.trim() },
      })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: kind === 'dialogue' ? 0.5 : 0.4,
        max_tokens: kind === 'dialogue' ? 200 : 180,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[audio-prompt-assist] OpenAI error:', response.status, errText)
      return NextResponse.json({
        success: true,
        prompt: fallback,
        source: 'fallback',
        warning: 'AI assist unavailable — used shot details directly.',
      })
    }

    const data = await response.json()
    const generated =
      data?.choices?.[0]?.message?.content?.trim()?.replace(/^["']|["']$/g, '') || ''

    if (!generated) {
      return NextResponse.json({
        success: true,
        prompt: fallback,
        source: 'fallback',
      })
    }

    return NextResponse.json({
      success: true,
      prompt: generated.slice(0, kind === 'dialogue' ? 1200 : 500),
      source: 'ai',
    })
  } catch (error) {
    console.error('[audio-prompt-assist]', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to build audio prompt',
      },
      { status: 500 },
    )
  }
}
