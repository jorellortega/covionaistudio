import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AudioKind = 'dialogue' | 'sound-effect' | 'stable-audio'

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

function inferDialogueToneTags(body: AudioPromptAssistBody): string {
  const blob = [
    body.action,
    body.dialogue,
    body.description,
    body.visualNotes,
    body.title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const tags: string[] = []
  if (/\b(whisper|murmur|mutter|quiet|softly|under\s*breath)\b/.test(blob)) {
    tags.push('[whispering]')
  }
  if (/\b(shout|yell|scream|bark|roar)\b/.test(blob)) {
    tags.push('[angry]')
  }
  if (/\b(sad|grief|cry|tear|mourn|heartbroken)\b/.test(blob)) {
    tags.push('[sad]')
  }
  if (/\b(laugh|chuckle|joke|amused)\b/.test(blob)) {
    tags.push('[laughs]')
  }
  if (/\b(tired|weary|exhausted|another day|worn)\b/.test(blob)) {
    tags.push('[tired]')
  }
  if (/\b(fear|afraid|scared|terrified|nervous)\b/.test(blob)) {
    tags.push('[nervous]')
  }
  if (/\b(urgent|panic|hurry|rush)\b/.test(blob)) {
    tags.push('[urgent]')
  }
  if (tags.length === 0) tags.push('[thoughtful]')
  return tags.slice(0, 2).join('')
}

function buildFallbackPrompt(body: AudioPromptAssistBody, kind: AudioKind): string {
  if (kind === 'dialogue') {
    const spoken =
      body.dialogue?.trim() ||
      // Strip obvious "He says ..." wrappers from action when present
      body.action?.trim()?.replace(/^(he|she|they)\s+says?\s+['"]?/i, '').replace(/['"]\s*to\s+himself\.?$/i, '').trim() ||
      null
    const line =
      spoken ||
      [
        body.characterName ? `${body.characterName} speaks` : 'A character speaks',
        body.description?.trim() || body.title?.trim() || 'in this shot',
      ].join(' ')
    return `${inferDialogueToneTags(body)} ${line}`.trim()
  }

  if (kind === 'stable-audio') {
    const moodBits = [
      body.action?.trim(),
      body.description?.trim(),
      body.visualNotes?.trim(),
      body.locationName ? `set in ${body.locationName}` : null,
      body.shotType ? `${body.shotType} framing` : null,
    ].filter(Boolean)
    const base =
      moodBits.join('. ') ||
      body.title?.trim() ||
      `Cinematic underscore for shot ${body.shotNumber ?? ''}`
    return `${base}. Instrumental music bed with clear mood, tempo, and instrumentation. No vocals, no dialogue.`
      .replace(/\s+/g, ' ')
      .trim()
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
    const kind: AudioKind =
      body.kind === 'dialogue'
        ? 'dialogue'
        : body.kind === 'stable-audio'
          ? 'stable-audio'
          : 'sound-effect'
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
        ? 'A reference still image is attached for visual/emotional context.'
        : 'No reference image is attached.',
    ]
      .filter(Boolean)
      .join('\n')

    const system =
      kind === 'dialogue'
        ? `You write ElevenLabs text-to-speech input for a film character line.
Rules:
- Return ONLY the TTS input string — no markdown, no quotes, no labels like "Dialogue:".
- Infer tone/delivery from Action, Description, Visual notes, Character, and the image (if attached).
- ALWAYS include 1–2 ElevenLabs audio tags for delivery BEFORE the spoken words, e.g. [whispering], [tired], [sad], [angry], [nervous], [urgent], [softly], [thoughtful], [laughs], [sighs].
- After the tags, put ONLY the words the character should speak (what the audience hears).
- Prefer the Dialogue field for the spoken words when present; extract the quoted line from Action if needed (e.g. He says "Another day..." → Another day...).
- Shape the spoken line with punctuation/pacing that matches the tone (ellipses, short fragments, emphasis).
- Keep spoken words to 1–3 short sentences.
- Do NOT invent other characters speaking unless dialogue already includes them.
- Do NOT write stage directions as spoken words (no "he says quietly").
Example: [tired][softly] Another day...`
        : kind === 'stable-audio'
          ? `You write prompts for Stability AI Stable Audio (music / ambience generation for film).
Rules:
- Return ONLY the final music/ambience prompt text — no markdown, no quotes, no preamble.
- Describe genre, mood, instrumentation, tempo/energy, and how it should evolve over the clip.
- Prefer cinematic underscore / score language (e.g. "low tense strings, distant percussion, slowly building") over vague words like "epic" alone.
- Match the emotional tone of the shot, action, location, and reference image when present.
- Do NOT include vocals, lyrics, dialogue, or sound-effect Foley lists.
- Keep it under 300 characters when possible, max 500.
- One cohesive musical idea, production-ready for Stable Audio.`
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
            ? `Write ElevenLabs TTS input (audio tags + spoken line) from these shot details. Choose tone that fits the moment:\n\n${detailLines}`
            : kind === 'stable-audio'
              ? `Write one production-ready Stable Audio music/ambience prompt from these shot details:\n\n${detailLines}`
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
        temperature: kind === 'dialogue' ? 0.55 : kind === 'stable-audio' ? 0.5 : 0.4,
        max_tokens: kind === 'dialogue' ? 220 : kind === 'stable-audio' ? 200 : 180,
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

    // Ensure dialogue output has at least one tone tag when the model forgot
    let promptOut = generated
    if (kind === 'dialogue' && !/\[[^\]]+\]/.test(promptOut)) {
      promptOut = `${inferDialogueToneTags(body)} ${promptOut}`.trim()
    }

    return NextResponse.json({
      success: true,
      prompt: promptOut.slice(0, kind === 'dialogue' ? 1200 : kind === 'stable-audio' ? 600 : 500),
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
