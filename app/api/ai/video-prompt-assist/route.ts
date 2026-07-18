import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type VideoPromptAssistBody = {
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
  startImageUrl?: string | null
  endImageUrl?: string | null
  videoModel?: string | null
  userId?: string | null
}

function buildFallbackPrompt(body: VideoPromptAssistBody): string {
  const parts: string[] = []
  const movement = body.movement?.trim().toLowerCase() || ''
  const camera = [
    body.shotType ? `${body.shotType} shot` : null,
    body.cameraAngle ? `${body.cameraAngle} angle` : null,
    movement
      ? movement === 'static'
        ? 'locked-off static camera (subject still moves in frame)'
        : `${body.movement} camera movement`
      : null,
  ].filter(Boolean)

  if (camera.length) parts.push(camera.join(', '))
  if (body.description?.trim()) parts.push(body.description.trim())
  if (body.action?.trim()) {
    parts.push(`Primary subject motion: ${body.action.trim()} — clearly animate this action throughout the clip`)
  }
  if (body.dialogue?.trim()) parts.push(`Dialogue/performance: ${body.dialogue.trim()}`)
  if (body.visualNotes?.trim()) parts.push(`Visual notes: ${body.visualNotes.trim()}`)
  if (body.characterName) parts.push(`Featuring: ${body.characterName}`)
  if (body.locationName) parts.push(`Location: ${body.locationName}`)

  const startUrl = body.startImageUrl?.trim() || body.imageUrl?.trim() || null
  const endUrl = body.endImageUrl?.trim() || null
  if (startUrl && endUrl) {
    parts.push(
      'Interpolate between the start and end reference frames — begin matching the start still, end matching the end still, with continuous natural motion between them',
    )
  } else if (startUrl) {
    parts.push(
      'Animate from the attached reference image — keep the same composition, subject, lighting, and environment while adding clear natural subject motion',
    )
  }
  parts.push(
    'Visible continuous motion of the main subject, photoreal cinematic look, no freeze-frame, no text, no captions, no watermark',
  )
  return parts.join('. ')
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
    const body = (await request.json()) as VideoPromptAssistBody
    const fallback = buildFallbackPrompt(body)

    const apiKey = await resolveOpenAIKey()
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        prompt: fallback,
        source: 'fallback',
        warning: 'OpenAI API key not configured — used shot details directly.',
      })
    }

    const isStaticCamera = (body.movement || '').trim().toLowerCase() === 'static'
    const startUrl = body.startImageUrl?.trim() || body.imageUrl?.trim() || null
    const endUrl = body.endImageUrl?.trim() || null
    const hasPair = !!(startUrl && endUrl)

    const detailLines = [
      body.shotNumber != null ? `Shot number: ${body.shotNumber}` : null,
      body.sceneNumber != null ? `Scene number: ${body.sceneNumber}` : null,
      body.title ? `Title: ${body.title}` : null,
      body.shotType ? `Shot type: ${body.shotType}` : null,
      body.cameraAngle ? `Camera angle: ${body.cameraAngle}` : null,
      body.movement
        ? isStaticCamera
          ? 'Camera movement: static (LOCKED CAMERA ONLY — do NOT freeze the subject; the subject must still move)'
          : `Camera movement: ${body.movement}`
        : null,
      body.description ? `Description: ${body.description}` : null,
      body.action
        ? `Action (MUST be clearly animated as subject motion): ${body.action}`
        : 'Action: not specified — invent believable subject motion from the image(s) (breathing, wingbeats, wind, walking, etc.)',
      body.dialogue ? `Dialogue: ${body.dialogue}` : null,
      body.visualNotes ? `Visual notes: ${body.visualNotes}` : null,
      body.characterName ? `Character: ${body.characterName}` : null,
      body.locationName ? `Location: ${body.locationName}` : null,
      body.videoModel ? `Target video model: ${body.videoModel}` : null,
      hasPair
        ? 'Two reference stills are attached: START FRAME first, END FRAME second. Write a frame-to-frame video prompt that begins on the start and finishes on the end.'
        : startUrl
          ? 'A reference still image is attached and will be used as the first frame / image-to-video input.'
          : 'No reference image is attached — write a self-contained text-to-video prompt.',
    ]
      .filter(Boolean)
      .join('\n')

    const system = `You write concise prompts for AI image-to-video (and frame-to-frame) generation.
Rules:
- Return ONLY the final prompt text, no quotes, no markdown, no preamble.
- Keep it under 450 characters when possible, max 700.
- When reference image(s) are attached, LOOK at them carefully and ground the prompt in what is actually visible. Do not invent major elements that are not in the image(s) or shot details.
- If START and END frames are both attached, describe the transition between them (what changes, how the subject moves from start pose/position to end). Keep identity, wardrobe, lighting, and location consistent across the interpolate.
- CRITICAL: "static" / locked-off camera means the CAMERA does not move. It does NOT mean a freeze-frame. The subject and environment must still have clear continuous motion.
- Prioritize the Action field as the main animation (e.g. if action is "the crow flies", describe wingbeats, forward flight path, body banking — not a still crow).
- Preserve composition/subject/lighting from the still(s); animate motion within that world.
- Explicitly forbid frozen/static subjects. Prefer verbs like flaps, flies, glides, walks, breathes, turns, steps, emerges.
- No on-screen text, logos, or watermarks.`

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [
      {
        type: 'text',
        text: hasPair
          ? `Write one production-ready frame-to-frame video prompt. Study BOTH attached images (start then end) and combine with these shot details:\n\n${detailLines}\n\nDescribe continuous motion that begins matching the start frame and ends matching the end frame.`
          : startUrl
            ? `Write one production-ready image-to-video prompt. Study the attached reference image and combine it with these shot details:\n\n${detailLines}\n\nFocus on clear subject motion matching the Action. If camera is static, keep the camera locked but animate the subject strongly.`
            : `Write one production-ready video prompt from these shot details (no reference image):\n\n${detailLines}\n\nFocus on clear subject motion matching the Action.`,
      },
    ]

    if (startUrl) {
      userContent.push({
        type: 'text',
        text: hasPair ? 'START FRAME:' : 'REFERENCE IMAGE:',
      })
      userContent.push({
        type: 'image_url',
        image_url: { url: startUrl },
      })
    }
    if (endUrl) {
      userContent.push({
        type: 'text',
        text: 'END FRAME:',
      })
      userContent.push({
        type: 'image_url',
        image_url: { url: endUrl },
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
        temperature: 0.4,
        max_tokens: 280,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[video-prompt-assist] OpenAI error:', response.status, errText)
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
      prompt: generated.slice(0, 990),
      source: 'ai',
    })
  } catch (error) {
    console.error('[video-prompt-assist]', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to build video prompt',
      },
      { status: 500 },
    )
  }
}
