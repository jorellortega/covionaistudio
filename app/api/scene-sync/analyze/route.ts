import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { SyncDirection } from '@/lib/scene-shot-sync'
import {
  buildSceneSyncPrompt,
  compactShotsForAI,
  compactStoryboardsForAI,
  parseAISyncPlan,
  type AISyncPlan,
} from '@/lib/scene-sync-ai'
import type { ShotList } from '@/lib/shot-list-service'
import type { Storyboard } from '@/lib/storyboards-service'

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ignore
          }
        },
      },
    }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

async function resolveOpenAIKey(userId: string): Promise<string | null> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: userRow } = await admin
    .from('users')
    .select('openai_api_key')
    .eq('id', userId)
    .maybeSingle()

  if (userRow?.openai_api_key?.trim()) {
    return userRow.openai_api_key.trim()
  }

  const { data: settingsData } = await admin.rpc('get_system_ai_config')
  if (Array.isArray(settingsData)) {
    const map: Record<string, string> = {}
    for (const row of settingsData) {
      map[row.setting_key] = row.setting_value
    }
    if (map.openai_api_key?.trim()) return map.openai_api_key.trim()
  }

  return process.env.OPENAI_API_KEY?.trim() ?? null
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const direction = body.direction as SyncDirection
    const shots = body.shots as ShotList[]
    const storyboards = body.storyboards as Storyboard[]

    if (direction !== 'storyboards-to-shotlist' && direction !== 'shotlist-to-storyboards') {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
    }
    if (!Array.isArray(shots) || !Array.isArray(storyboards)) {
      return NextResponse.json({ error: 'shots and storyboards arrays required' }, { status: 400 })
    }

    const apiKey = await resolveOpenAIKey(user.id)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured', fallback: true },
        { status: 400 }
      )
    }

    const compactShots = compactShotsForAI(shots)
    const compactStoryboards = compactStoryboardsForAI(storyboards)
    const prompt = buildSceneSyncPrompt(direction, compactShots, compactStoryboards)
    const model = 'gpt-4o-mini'

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You match film shot lists to storyboards. Output only valid JSON matching the requested schema.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[scene-sync/analyze] OpenAI error:', response.status, errText)
      return NextResponse.json(
        { error: 'AI analysis failed', fallback: true },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Empty AI response', fallback: true },
        { status: 502 }
      )
    }

    const plan = parseAISyncPlan(content, direction)
    if (!plan || plan.operations.length === 0) {
      return NextResponse.json(
        { error: 'Could not parse AI sync plan', fallback: true },
        { status: 502 }
      )
    }

    const payload: AISyncPlan = { ...plan, model }
    return NextResponse.json({ plan: payload, ai: true })
  } catch (error) {
    console.error('[scene-sync/analyze]', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        fallback: true,
      },
      { status: 500 }
    )
  }
}
