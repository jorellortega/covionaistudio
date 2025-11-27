import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sceneId, screenplayContent, pageNumber, service, model, userId } = body

    if (!sceneId) {
      return NextResponse.json(
        { error: 'Missing required field: sceneId' },
        { status: 400 }
      )
    }

    if (!screenplayContent) {
      return NextResponse.json(
        { error: 'Missing required field: screenplayContent' },
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

    // Fetch scene data to get project_id
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
      .select('*, timelines!inner(project_id)')
      .eq('id', sceneId)
      .eq('user_id', targetUserId)
      .single()

    if (sceneError || !scene) {
      return NextResponse.json(
        { error: 'Scene not found or unauthorized' },
        { status: sceneError ? 404 : 403 }
      )
    }

    const projectId = (scene.timelines as any)?.project_id

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

    // Build the AI prompt for shot list generation
    const systemPrompt = `You are a professional director and cinematographer. Analyze the provided screenplay content and create a detailed shot list. 

CRITICAL: You MUST return ONLY valid JSON. Do not include any explanatory text, markdown code blocks, or formatting. Return ONLY the JSON array.

For each shot, provide:
- shot_type: wide, medium, close, extreme-close, two-shot, over-the-shoulder, point-of-view, establishing, insert, or cutaway
- camera_angle: eye-level, high-angle, low-angle, dutch-angle, bird-eye, or worm-eye
- movement: static, panning, tilting, tracking, zooming, dolly, crane, handheld, or steadicam
- description: Brief description of what the shot shows
- action: What happens in this shot
- dialogue: Key dialogue if any (can be empty string)
- characters: Array of character names in the shot
- duration_seconds: Estimated duration in seconds (number)

Return ONLY a valid JSON array. Example format:
[
  {
    "shot_type": "wide",
    "camera_angle": "eye-level",
    "movement": "static",
    "description": "Establishing shot of the location",
    "action": "Camera shows the full scene",
    "dialogue": "",
    "characters": ["Character1"],
    "duration_seconds": 5,
    "visual_notes": "",
    "location": "",
    "time_of_day": ""
  }
]

IMPORTANT: Return ONLY the JSON array, no markdown, no code blocks, no explanations.`

    const userPrompt = `Analyze this screenplay content and create a comprehensive shot list. Break down the scene into individual shots that would be needed to film it. Consider camera movements, angles, and shot types that best serve the story.

SCREENPLAY CONTENT:
${screenplayContent}

${pageNumber ? `This is page ${pageNumber} of the screenplay. Focus on creating shots for this specific page.` : ''}

Generate a shot list as a JSON array. Each shot should be detailed and specific to the screenplay content.`

    // Generate shot list using AI
    let generatedResponse = ''
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
          { error: response.error || 'Failed to generate shot list' },
          { status: 500 }
        )
      }

      generatedResponse = response.data.choices[0].message.content
    } else if (normalizedService === 'anthropic') {
      const response = await AnthropicService.generateScript({
        prompt: userPrompt,
        template: systemPrompt,
        model: modelToUse,
        apiKey: actualApiKey
      })

      if (!response.success) {
        return NextResponse.json(
          { error: response.error || 'Failed to generate shot list' },
          { status: 500 }
        )
      }

      generatedResponse = response.data.content[0].text
    } else {
      return NextResponse.json(
        { error: 'Unsupported AI service' },
        { status: 400 }
      )
    }

    // Log the raw response for debugging
    console.log('Raw AI response (first 500 chars):', generatedResponse.substring(0, 500))
    console.log('Full response length:', generatedResponse.length)

    // Clean up markdown code block markers if present
    generatedResponse = generatedResponse.trim()
    
    // Remove markdown code blocks more aggressively
    generatedResponse = generatedResponse.replace(/^```(?:json|plaintext|text)?\s*\n?/i, '')
    generatedResponse = generatedResponse.replace(/\n?```\s*$/i, '')
    generatedResponse = generatedResponse.trim()
    
    // Try to extract JSON from the response if it's wrapped in text
    const jsonMatch = generatedResponse.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      generatedResponse = jsonMatch[0]
    } else {
      // Try to find JSON object with shots array
      const objectMatch = generatedResponse.match(/\{[\s\S]*\}/)
      if (objectMatch) {
        generatedResponse = objectMatch[0]
      }
    }

    // Try to repair malformed JSON by finding the last complete object
    const repairJSON = (jsonStr: string): string => {
      let repaired = jsonStr.trim()
      
      // Find all complete objects (properly closed with })
      const completeObjects: number[] = []
      let braceCount = 0
      let inString = false
      let escapeNext = false
      
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i]
        
        if (escapeNext) {
          escapeNext = false
          continue
        }
        
        if (char === '\\') {
          escapeNext = true
          continue
        }
        
        if (char === '"') {
          inString = !inString
          continue
        }
        
        if (!inString) {
          if (char === '{') {
            braceCount++
          } else if (char === '}') {
            braceCount--
            if (braceCount === 0) {
              completeObjects.push(i)
            }
          }
        }
      }
      
      // If we found complete objects, use the last one
      if (completeObjects.length > 0) {
        const lastCompleteIndex = completeObjects[completeObjects.length - 1]
        // Find the start of this object
        let objectStart = lastCompleteIndex
        braceCount = 0
        for (let i = lastCompleteIndex; i >= 0; i--) {
          if (repaired[i] === '}') braceCount++
          if (repaired[i] === '{') {
            braceCount--
            if (braceCount === 0) {
              objectStart = i
              break
            }
          }
        }
        
        // Extract everything up to and including the last complete object
        let truncated = repaired.substring(0, lastCompleteIndex + 1)
        
        // Find where the array starts
        const arrayStart = repaired.indexOf('[')
        if (arrayStart >= 0) {
          truncated = repaired.substring(arrayStart, lastCompleteIndex + 1)
        }
        
        // Remove any trailing comma
        truncated = truncated.replace(/,\s*$/, '')
        
        // Close the array
        if (!truncated.trim().endsWith(']')) {
          truncated += '\n]'
        }
        
        return truncated
      }
      
      return repaired
    }

    // Try to repair the JSON
    let repairedJSON = repairJSON(generatedResponse)

    // Parse JSON response
    let shotListData: any[] = []
    try {
      shotListData = JSON.parse(repairedJSON)
      if (!Array.isArray(shotListData)) {
        // If it's wrapped in an object, try to extract the array
        if (shotListData.shots && Array.isArray(shotListData.shots)) {
          shotListData = shotListData.shots
        } else if (shotListData.shot_list && Array.isArray(shotListData.shot_list)) {
          shotListData = shotListData.shot_list
        } else if (shotListData.data && Array.isArray(shotListData.data)) {
          shotListData = shotListData.data
        } else {
          // If it's a single object, wrap it in an array
          if (shotListData.shot_type || shotListData.camera_angle) {
            shotListData = [shotListData]
          } else {
            throw new Error('Response is not an array and cannot be converted')
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing shot list JSON:', parseError)
      console.error('Raw response (first 1000 chars):', generatedResponse.substring(0, 1000))
      console.error('Repaired response (first 1000 chars):', repairedJSON.substring(0, 1000))
      console.error('Full response length:', generatedResponse.length)
      
      // Try one more time with a simpler repair - just truncate at the last complete object
      try {
        const lastCompleteObject = repairedJSON.lastIndexOf('}')
        if (lastCompleteObject > 0) {
          const truncated = repairedJSON.substring(0, lastCompleteObject + 1)
          // Ensure it's a valid array
          if (truncated.trim().startsWith('[') && !truncated.trim().endsWith(']')) {
            const fixed = truncated.trim().replace(/,\s*$/, '') + '\n]'
            shotListData = JSON.parse(fixed)
            console.log('Successfully parsed after truncation repair')
          } else {
            throw new Error('Truncation repair failed')
          }
        } else {
          throw parseError
        }
      } catch (secondTryError) {
        // Return a more helpful error with the actual response
        return NextResponse.json(
          { 
            error: 'Failed to parse AI response. The AI did not return valid JSON.', 
            details: generatedResponse.substring(0, 1000),
            hint: 'The AI may have returned malformed JSON. Check the details field for the actual response.',
            parseError: parseError instanceof Error ? parseError.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }

    // Validation functions to ensure values match database constraints
    const validShotTypes = ['wide', 'medium', 'close', 'extreme-close', 'two-shot', 'over-the-shoulder', 'point-of-view', 'establishing', 'insert', 'cutaway']
    const validCameraAngles = ['eye-level', 'high-angle', 'low-angle', 'dutch-angle', 'bird-eye', 'worm-eye']
    const validMovements = ['static', 'panning', 'tilting', 'tracking', 'zooming', 'dolly', 'crane', 'handheld', 'steadicam']
    
    const normalizeShotType = (value: string | undefined): string => {
      if (!value) return 'wide'
      const normalized = value.toLowerCase().trim()
      // Map common variations to valid values
      if (normalized.includes('establishing')) return 'establishing'
      if (normalized.includes('extreme') || normalized.includes('extreme-close')) return 'extreme-close'
      if (normalized.includes('two') || normalized.includes('two-shot')) return 'two-shot'
      if (normalized.includes('over') || normalized.includes('shoulder') || normalized.includes('ots')) return 'over-the-shoulder'
      if (normalized.includes('point') || normalized.includes('pov')) return 'point-of-view'
      if (normalized.includes('insert')) return 'insert'
      if (normalized.includes('cutaway')) return 'cutaway'
      if (normalized.includes('close')) return 'close'
      if (normalized.includes('medium')) return 'medium'
      if (normalized.includes('wide')) return 'wide'
      return validShotTypes.includes(normalized) ? normalized : 'wide'
    }
    
    const normalizeCameraAngle = (value: string | undefined): string => {
      if (!value) return 'eye-level'
      const normalized = value.toLowerCase().trim()
      // Map common variations
      if (normalized.includes('bird') || normalized.includes('aerial') || normalized.includes('overhead')) return 'bird-eye'
      if (normalized.includes('worm') || normalized.includes('ground')) return 'worm-eye'
      if (normalized.includes('high') || normalized.includes('above')) return 'high-angle'
      if (normalized.includes('low') || normalized.includes('below')) return 'low-angle'
      if (normalized.includes('dutch') || normalized.includes('tilted')) return 'dutch-angle'
      if (normalized.includes('eye') || normalized.includes('level')) return 'eye-level'
      return validCameraAngles.includes(normalized) ? normalized : 'eye-level'
    }
    
    const normalizeMovement = (value: string | undefined): string => {
      if (!value) return 'static'
      const normalized = value.toLowerCase().trim()
      // Map common variations
      if (normalized.includes('sweep') || normalized.includes('sweeping')) return 'panning'
      if (normalized.includes('pan') || normalized.includes('panning')) return 'panning'
      if (normalized.includes('tilt') || normalized.includes('tilting')) return 'tilting'
      if (normalized.includes('track') || normalized.includes('tracking') || normalized.includes('follow')) return 'tracking'
      if (normalized.includes('zoom') || normalized.includes('zooming')) return 'zooming'
      if (normalized.includes('dolly')) return 'dolly'
      if (normalized.includes('crane')) return 'crane'
      if (normalized.includes('handheld') || normalized.includes('hand-held')) return 'handheld'
      if (normalized.includes('steadicam') || normalized.includes('steady')) return 'steadicam'
      if (normalized.includes('static') || normalized.includes('fixed') || normalized.includes('still')) return 'static'
      return validMovements.includes(normalized) ? normalized : 'static'
    }

    // Validate and format shot list data
    const formattedShots = shotListData.map((shot, index) => ({
      scene_id: sceneId,
      project_id: projectId,
      shot_number: index + 1,
      shot_type: normalizeShotType(shot.shot_type),
      camera_angle: normalizeCameraAngle(shot.camera_angle),
      movement: normalizeMovement(shot.movement),
      lens: shot.lens || undefined,
      framing: shot.framing || undefined,
      duration_seconds: shot.duration_seconds || undefined,
      description: shot.description || '',
      action: shot.action || '',
      dialogue: shot.dialogue || undefined,
      visual_notes: shot.visual_notes || undefined,
      audio_notes: shot.audio_notes || undefined,
      props: shot.props || undefined,
      characters: shot.characters || [],
      location: shot.location || undefined,
      time_of_day: shot.time_of_day || undefined,
      lighting_notes: shot.lighting_notes || undefined,
      camera_notes: shot.camera_notes || undefined,
      status: 'planned' as const,
      sequence_order: index + 1,
    }))

    return NextResponse.json({
      success: true,
      shots: formattedShots,
      count: formattedShots.length
    })
  } catch (error) {
    console.error('Error generating shot list:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

