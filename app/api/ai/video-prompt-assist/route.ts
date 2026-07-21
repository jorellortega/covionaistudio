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
  /** Leonardo Motion 2.0 camera preset id/label */
  motionControl?: string | null
  motionStrength?: number | null
  duration?: string | null
  klingNativeAudio?: boolean | null
  userId?: string | null
  /** User's in-progress prompt — creative direction to preserve and refine */
  currentPrompt?: string | null
}

function getVideoModelGuidance(model: string | null | undefined): string | null {
  if (!model?.trim()) return null
  const m = model.toLowerCase()

  if (m.includes('leonardo motion')) {
    return 'Leonardo Motion 2.0: image-to-video with optional Motion Control camera presets. Describe subject motion clearly; camera movement is often set separately via Motion Control — focus prompt on what moves in the scene (subjects, environment, atmosphere), not duplicate camera instructions unless no Motion Control is set.'
  }
  if (m.includes('kling') && m.includes('omni')) {
    return 'Kling 3.0 Omni: reference-driven I2V/T2V with native audio support. Strong on character consistency and atmosphere; describe motion, mood, and optional audio (dialogue, ambient, SFX) if native audio is enabled.'
  }
  if (m.includes('kling') && m.includes('extended')) {
    return 'Kling 3.0 I2V Extended: frame-to-frame interpolation between start and end stills. Describe the transition — what changes from start pose to end pose with continuous motion.'
  }
  if (m.includes('kling') && m.includes('i2v')) {
    return 'Kling 3.0 I2V: animate a single reference image. Keep composition/lighting; describe clear subject and environmental motion.'
  }
  if (m.includes('kling') && m.includes('t2v')) {
    return 'Kling 3.0 T2V: text-only video generation. Be vivid and specific about scene, motion, camera, and atmosphere — no reference image.'
  }
  if (m.includes('kling 2.1') || m.includes('frame-to-frame')) {
    return 'Kling 2.1 Pro (Leonardo): frame-to-frame via Leonardo API. Describe motion between start and optional end frame.'
  }
  if (m.includes('veo')) {
    return 'Veo 3.1: high-fidelity frame-to-frame. Describe cinematic motion and transition between frames; keep prompts focused and production-ready.'
  }
  if (m.includes('runway gen-4 turbo') || m.includes('gen-4 turbo')) {
    return 'Runway Gen-4 Turbo: image-to-video. Animate from a still — describe motion within the existing frame; avoid major scene changes.'
  }
  if (m.includes('gen-3a') || m.includes('gen-3')) {
    return 'Runway Gen-3A Turbo: image-to-video. Describe natural motion from the reference still.'
  }
  if (m.includes('act-two') || m.includes('act_two')) {
    return 'Runway Act-Two: character performance driven by a reference video. Prompt should describe the performance/emotion; motion comes from the reference clip.'
  }
  if (m.includes('aleph')) {
    return 'Runway Gen-4 Aleph: video-to-video editing/transform. Describe how to change or stylize the input video, not animate a still.'
  }
  if (m.includes('hedra')) {
    return 'Hedra Character 3: talking-head lip-sync avatar. Prompt should describe facial expression, subtle head movement, and speaking performance — not full-body action.'
  }

  return `Target model: ${model}. Tailor the prompt to this model's typical input mode (image-to-video, text-to-video, or frame-to-frame).`
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
  if (body.currentPrompt?.trim()) {
    parts.push(`Creator direction: ${body.currentPrompt.trim()}`)
  }
  if (body.videoModel?.trim()) {
    parts.push(`For ${body.videoModel}`)
    const modelHint = getVideoModelGuidance(body.videoModel)
    if (modelHint) parts.push(modelHint)
  }
  if (body.motionControl?.trim()) {
    parts.push(`Leonardo Motion Control preset: ${body.motionControl}`)
  }
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

    const modelGuidance = getVideoModelGuidance(body.videoModel)

    const detailLines = [
      body.videoModel
        ? `SELECTED VIDEO MODEL (tailor prompt to this model): ${body.videoModel}`
        : 'Video model: not selected — write a general cinematic video prompt.',
      modelGuidance ? `Model-specific guidance: ${modelGuidance}` : null,
      body.motionControl?.trim()
        ? `Leonardo Motion Control preset (camera is handled by this — focus prompt on subject/environment motion): ${body.motionControl}`
        : null,
      body.motionStrength != null && body.motionControl?.trim()
        ? null
        : body.motionStrength != null
          ? `Motion strength (Leonardo): ${body.motionStrength}/10`
          : null,
      body.duration ? `Clip duration: ${body.duration}` : null,
      body.klingNativeAudio
        ? 'Native audio: ON — include brief audio cues (ambient, dialogue tone, SFX) if relevant.'
        : body.videoModel?.toLowerCase().includes('kling')
          ? 'Native audio: OFF — visual motion only.'
          : null,
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
      body.currentPrompt?.trim()
        ? `Creator's draft prompt / creative direction (MUST incorporate and refine — do not discard their intent): ${body.currentPrompt.trim()}`
        : null,
      body.characterName ? `Character: ${body.characterName}` : null,
      body.locationName ? `Location: ${body.locationName}` : null,
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
- If the user provided a draft prompt or creative direction, weave their specific ideas (mood, motion, atmosphere, details they mentioned) into the final prompt. Do not replace their intent with a generic description — refine and expand what they wrote using the shot details and image(s).
- Tailor phrasing to the SELECTED VIDEO MODEL and its model-specific guidance (I2V vs T2V vs frame-to-frame vs lip-sync vs video-edit). Do not write a generic prompt that ignores the model.
- For Leonardo Motion 2.0 with Motion Control set, describe subject/environment motion; avoid conflicting camera moves in the prompt.
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
