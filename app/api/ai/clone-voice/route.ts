import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'
import { getElevenLabsApiKeyForUser } from '@/lib/elevenlabs-api-key'
import { createRouteSupabaseClient } from '@/lib/supabase-route'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const apiKey = await getElevenLabsApiKeyForUser(user.id)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured. Add your key in Setup AI.' },
        { status: 403 },
      )
    }

    const formData = await request.formData()
    const name = (formData.get('name') as string | null)?.trim()
    const description = (formData.get('description') as string | null)?.trim() || ''
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)

    if (!name) {
      return NextResponse.json({ error: 'Voice name is required' }, { status: 400 })
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one audio sample is required' }, { status: 400 })
    }

    const result = await ElevenLabsService.cloneVoice(apiKey, name, description, files)
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to clone voice' }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...result.data })
  } catch (error) {
    console.error('Clone voice error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
