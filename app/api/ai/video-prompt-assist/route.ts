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
  videoModel?: string | null
  userId?: string | null
}

function buildFallbackPrompt(body: VideoPromptAssistBody): string {
  const parts: string[] = []
  const camera = [
    body.shotType ? `${body.shotType} shot` : null,
    body.cameraAngle ? `${body.cameraAngle} angle` : null,
    body.movement
      ? body.movement.toLowerCase() === 'static'
        ? 'static locked-off camera'
        : `${body.movement} camera movement`
      : null,
  ].filter(Boolean)

  if (camera.length) parts.push(camera.join(', '))
  if (body.description?.trim()) parts.push(body.description.trim())
  if (body.action?.trim()) parts.push(`Action: ${body.action.trim()}`)
  if (body.dialogue?.trim()) parts.push(`Dialogue/performance: ${body.dialogue.trim()}`)
  if (body.visualNotes?.trim()) parts.push(`Visual notes: ${body.visualNotes.trim()}`)
  if (body.characterName) parts.push(`Featuring: ${body.characterName}`)
  if (body.locationName) parts.push(`Location: ${body.locationName}`)
  if (body.imageUrl) {
    parts.push(
      'Animate from the attached reference image — preserve the same composition, subject, lighting, and environment while adding natural cinematic motion',
    )
  }
  parts.push('Photoreal cinematic look, smooth motion, no text, no captions, no watermark')
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
      body.videoModel ? `Target video model: ${body.videoModel}` : null,
      body.imageUrl
        ? 'A reference still image is attached and will be used as the first frame / image-to-video input.'
        : 'No reference image is attached — write a self-contained text-to-video prompt.',
    ]
      .filter(Boolean)
      .join('\n')

    const system = `You write concise prompts for AI image-to-video generation.
Rules:
- Return ONLY the final prompt text, no quotes, no markdown, no preamble.
- Keep it under 450 characters when possible, max 700.
- When a reference image is attached, LOOK at it carefully and ground the prompt in what is actually visible (subject appearance, wardrobe, environment, lighting, composition). Do not invent major elements that are not in the image or shot details.
- For image-to-video: preserve the existing frame — describe camera movement and subtle natural motion only; do not ask to redesign the scene.
- Include shot type, camera angle, and movement from the shot details when provided.
- No on-screen text, logos, or watermarks.`

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [
      {
        type: 'text',
        text: body.imageUrl?.trim()
          ? `Write one production-ready image-to-video prompt. Study the attached reference image and combine it with these shot details:\n\n${detailLines}\n\nDescribe motion and camera behavior that fit this exact still.`
          : `Write one production-ready video prompt from these shot details (no reference image):\n\n${detailLines}`,
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
