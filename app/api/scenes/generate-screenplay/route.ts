import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { TreatmentsService } from '@/lib/treatments-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sceneId, treatmentId, service, model, userId } = body

    if (!sceneId) {
      return NextResponse.json(
        { error: 'Missing required field: sceneId' },
        { status: 400 }
      )
    }

    // Get authenticated user
    let targetUserId = userId
    if (!targetUserId) {
      try {
        const cookieStore = await cookies()
        const supabaseAuth = createServerClient(
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
                  // Ignore setAll errors
                }
              },
            },
          }
        )

        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
        targetUserId = authUser?.id
      } catch (authError) {
        console.error('Error getting authenticated user:', authError)
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Fetch scene data using server-side client
    const cookieStore = await cookies()
    const supabaseServer = createServerClient(
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
              // Ignore setAll errors in server components
            }
          },
        },
      }
    )

    const { data: scene, error: sceneError } = await supabaseServer
      .from('scenes')
      .select('*')
      .eq('id', sceneId)
      .eq('user_id', targetUserId)
      .single()

    if (sceneError || !scene) {
      return NextResponse.json(
        { error: 'Scene not found or unauthorized' },
        { status: sceneError ? 404 : 403 }
      )
    }

    // Fetch treatment data if treatmentId provided
    let treatment = null
    if (treatmentId) {
      treatment = await TreatmentsService.getTreatment(treatmentId)
      if (treatment && treatment.user_id !== targetUserId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }
    }

    // Get API key
    let actualApiKey = ''
    const serviceToUse = service || 'openai'
    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') 
      ? 'openai' 
      : serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') 
      ? 'anthropic' 
      : 'openai'

    // Fetch API key from database
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

      const { data, error } = await supabaseAdmin
        .from('users')
        .select('openai_api_key, anthropic_api_key')
        .eq('id', targetUserId)
        .single()

      if (!error && data) {
        if (normalizedService === 'openai' && data.openai_api_key) {
          actualApiKey = data.openai_api_key.trim()
        } else if (normalizedService === 'anthropic' && data.anthropic_api_key) {
          actualApiKey = data.anthropic_api_key.trim()
        }
      }
    }

    // Fallback to environment variables
    if (!actualApiKey) {
      if (normalizedService === 'openai') {
        actualApiKey = process.env.OPENAI_API_KEY || ''
      } else if (normalizedService === 'anthropic') {
        actualApiKey = process.env.ANTHROPIC_API_KEY || ''
      }
    }

    if (!actualApiKey) {
      return NextResponse.json(
        { error: `API key not configured for ${normalizedService}. Please configure it in Settings → AI Settings.` },
        { status: 400 }
      )
    }

    // Parse metadata if it's a string
    let sceneMetadata: any = {}
    try {
      if (scene.metadata) {
        sceneMetadata = typeof scene.metadata === 'string' ? JSON.parse(scene.metadata) : scene.metadata
      }
    } catch (e) {
      console.warn('Could not parse scene metadata:', e)
      sceneMetadata = {}
    }

    // Build context for AI prompt
    const sceneDescription = scene.description || sceneMetadata?.description || ''
    const sceneNumber = sceneMetadata?.sceneNumber || ''
    const location = sceneMetadata?.location || ''
    const characters = sceneMetadata?.characters || []
    const mood = sceneMetadata?.mood || ''

    // Build treatment context
    let treatmentContext = ''
    if (treatment) {
      treatmentContext = `
TREATMENT CONTEXT:
Title: ${treatment.title}
Genre: ${treatment.genre}
Synopsis: ${treatment.synopsis || ''}
Logline: ${treatment.logline || ''}
Characters: ${treatment.characters || ''}
Themes: ${treatment.themes || ''}
`
    }

    // Build the AI prompt
    const systemPrompt = `You are a professional screenwriter. Write a complete, professional screenplay scene in standard screenplay format. Include:
- Scene heading (INT./EXT., location, time of day)
- Action lines (describing what happens visually)
- Character names and dialogue
- Parentheticals (character directions)
- Transitions if needed

Write in proper screenplay format with correct spacing and capitalization. Be detailed and cinematic. Let the scene flow naturally - there is no length limit, write as much as needed to fully develop the scene.`

    const userPrompt = `Write a complete screenplay scene based on the following information:

${treatmentContext}

SCENE INFORMATION:
Scene Number: ${sceneNumber || 'Not specified'}
Location: ${location || 'Not specified'}
Characters: ${characters.length > 0 ? characters.join(', ') : 'Not specified'}
Mood/Tone: ${mood || 'Not specified'}
Description: ${sceneDescription}

Generate a full, professional screenplay scene that brings this scene to life. Include all necessary screenplay elements: scene headings, action descriptions, character dialogue, and any necessary transitions. Write as much as needed to fully develop the scene - there is no length restriction.`

    // Generate screenplay using AI
    let generatedScreenplay = ''
    const modelToUse = model || (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

    if (normalizedService === 'openai') {
      const response = await OpenAIService.generateScript({
        prompt: userPrompt,
        template: systemPrompt,
        model: modelToUse,
        apiKey: actualApiKey
      })

      if (!response.success) {
        return NextResponse.json(
          { error: response.error || 'Failed to generate screenplay' },
          { status: 500 }
        )
      }

      generatedScreenplay = response.data.choices[0].message.content
    } else if (normalizedService === 'anthropic') {
      const response = await AnthropicService.generateScript({
        prompt: userPrompt,
        template: systemPrompt,
        model: modelToUse,
        apiKey: actualApiKey
      })

      if (!response.success) {
        return NextResponse.json(
          { error: response.error || 'Failed to generate screenplay' },
          { status: 500 }
        )
      }

      generatedScreenplay = response.data.content[0].text
    } else {
      return NextResponse.json(
        { error: 'Unsupported AI service' },
        { status: 400 }
      )
    }

    // Save screenplay to scene
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

    const { error: updateError } = await supabaseAdmin
      .from('scenes')
      .update({ screenplay_content: generatedScreenplay })
      .eq('id', sceneId)
      .eq('user_id', targetUserId)

    if (updateError) {
      console.error('Error saving screenplay:', updateError)
      return NextResponse.json(
        { error: 'Failed to save screenplay', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      screenplay: generatedScreenplay
    })
  } catch (error) {
    console.error('Error generating screenplay:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

