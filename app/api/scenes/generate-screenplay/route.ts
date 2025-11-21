import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { TreatmentsService } from '@/lib/treatments-service'

/**
 * Fixes screenplay formatting issues, particularly excessive spacing in character names
 * and dialogue. Ensures proper indentation following standard screenplay format.
 */
function fixScreenplayFormatting(screenplay: string): string {
  console.log('🎬 SCREENPLAY FORMAT - Starting formatting fix')
  console.log('🎬 SCREENPLAY FORMAT - Original length:', screenplay.length)
  console.log('🎬 SCREENPLAY FORMAT - First 500 chars:', screenplay.substring(0, 500))
  
  const lines = screenplay.split('\n')
  console.log('🎬 SCREENPLAY FORMAT - Total lines:', lines.length)
  const formattedLines: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const leadingSpaces = line.match(/^ */)?.[0].length || 0
    
    // Skip empty lines
    if (!trimmed) {
      formattedLines.push('')
      continue
    }
    
    // Check if this is a scene heading (INT./EXT.)
    if (/^(INT\.|EXT\.)/i.test(trimmed)) {
      formattedLines.push(trimmed.toUpperCase())
      continue
    }
    
    // Check if this is a transition (FADE IN, CUT TO, etc.)
    if (/^(FADE IN|FADE OUT|CUT TO|DISSOLVE TO|SMASH CUT|MATCH CUT)/i.test(trimmed)) {
      formattedLines.push(trimmed.toUpperCase().padStart(65))
      continue
    }
    
    // Look ahead to determine context
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''
    const nextNextLine = i < lines.length - 2 ? lines[i + 2].trim() : ''
    const isParenthetical = /^\(/.test(nextLine)
    const isNextParenthetical = /^\(/.test(nextNextLine)
    const hasNextDialogue = nextLine && !isParenthetical && !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(nextLine) && !/^[A-Z][A-Z0-9\s]+$/.test(nextLine)
    
    // Check if this is a character name (ALL CAPS, no lowercase, reasonable length)
    // Character names are typically ALL CAPS and followed by parenthetical or dialogue
    // Match pattern: all caps, may contain spaces, numbers, and # character, no periods (except for abbreviations)
    const looksLikeCharacterName = /^[A-Z][A-Z0-9\s#]+$/.test(trimmed) && 
                                    trimmed.length > 0 && 
                                    trimmed.length < 50 &&
                                    !trimmed.includes('.') &&
                                    !trimmed.match(/^[A-Z\s#]+[a-z]/) && // Not mixed case
                                    !/^(SCENE|FADE|CUT|DISSOLVE|INT|EXT)/i.test(trimmed) &&
                                    (isParenthetical || isNextParenthetical || hasNextDialogue || 
                                     (i < lines.length - 2 && /^\(/.test(lines[i + 2]?.trim())))
    
    // Always normalize character names to proper indentation (~40 spaces - industry standard)
    if (looksLikeCharacterName) {
      // Character name should be at position 40 (starting at column 40, meaning 40 spaces before it)
      // But if the name is long, we still want it left-aligned at position 40
      const name = trimmed.toUpperCase()
      const formatted = '                                        '.substring(0, Math.max(0, 40 - name.length)) + name
      console.log(`🎬 SCREENPLAY FORMAT - Line ${i + 1}: CHARACTER NAME detected`)
      console.log(`  Original: [${line}] (${leadingSpaces} leading spaces)`)
      console.log(`  Trimmed: [${trimmed}], Length: ${trimmed.length}`)
      console.log(`  Formatted: [${formatted}]`)
      console.log(`  Formatted length: ${formatted.length}, Leading spaces in formatted: ${formatted.match(/^ */)?.[0].length || 0}`)
      formattedLines.push(formatted)
      continue
    }
    
    // Check for character name with (CONT'D) - this should also be treated as character name
    const characterNameWithContd = trimmed.match(/^([A-Z][A-Z0-9\s#]+)\s*\(CONT['']D\)$/i)
    if (characterNameWithContd) {
      const name = trimmed.toUpperCase()
      const formatted = '                                        '.substring(0, Math.max(0, 40 - name.length)) + name
      console.log(`🎬 SCREENPLAY FORMAT - Line ${i + 1}: CHARACTER NAME (CONT'D) detected`)
      console.log(`  Original: [${line}] (${leadingSpaces} leading spaces)`)
      console.log(`  Trimmed: [${trimmed}], Length: ${trimmed.length}`)
      console.log(`  Formatted: [${formatted}]`)
      console.log(`  Formatted length: ${formatted.length}, Leading spaces in formatted: ${formatted.match(/^ */)?.[0].length || 0}`)
      formattedLines.push(formatted)
      continue
    }
    
    // Check if this is a parenthetical (starts with parenthesis)
    if (/^\(/.test(trimmed)) {
      // Parenthetical should be LEFT-ALIGNED at column 17 (always exactly 17 spaces before it, regardless of length)
      const content = trimmed.replace(/^\(/, '').replace(/\)$/, '').trim()
      const parenthetical = `(${content})`
      // Always add exactly 17 spaces before parenthetical (left-aligned at column 17)
      const spaces = '                 ' // Exactly 17 spaces
      const formatted = spaces + parenthetical
      console.log(`🎬 SCREENPLAY FORMAT - Line ${i + 1}: PARENTHETICAL detected`)
      console.log(`  Original: [${line}] (${leadingSpaces} leading spaces)`)
      console.log(`  Trimmed: [${trimmed}], Content: [${content}], Parenthetical: [${parenthetical}], Length: ${parenthetical.length}`)
      console.log(`  Formatted: [${formatted}]`)
      console.log(`  Formatted length: ${formatted.length}, Leading spaces in formatted: ${formatted.match(/^ */)?.[0].length || 0}`)
      formattedLines.push(formatted)
      continue
    }
    
    // Look behind to determine if this is dialogue
    const prevLine = i > 0 ? lines[i - 1].trim() : ''
    const prevPrevLine = i > 1 ? lines[i - 2].trim() : ''
    const wasCharacterName = /^[A-Z][A-Z0-9\s#]+$/.test(prevLine) && prevLine.length < 50 && !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(prevLine)
    const wasParenthetical = /^\(/.test(prevLine)
    const wasPrevCharacterName = /^[A-Z][A-Z0-9\s#]+$/.test(prevPrevLine) && prevPrevLine.length < 50 && !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(prevPrevLine)
    
    // Check if previous lines were dialogue (for continuation lines)
    // Look at already-formatted lines to detect dialogue continuation
    let wasDialogue = false
    if (formattedLines.length > 0) {
      const prevFormatted = formattedLines[formattedLines.length - 1]
      const prevTrimmed = prevFormatted.trim()
      const prevLeadingSpaces = prevFormatted.match(/^ */)?.[0].length || 0
      
      // Check if previous formatted line was dialogue (indented ~10 spaces, not character name, not parenthetical)
      wasDialogue = prevLeadingSpaces >= 10 && prevLeadingSpaces <= 20 && 
                    prevTrimmed.length > 0 &&
                    !/^\(/.test(prevTrimmed) &&
                    !/^[A-Z][A-Z0-9\s#]+$/.test(prevTrimmed) &&
                    !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(prevTrimmed)
      
      // Also check line before that if current line has excessive spacing (likely dialogue continuation)
      if (!wasDialogue && leadingSpaces >= 6 && leadingSpaces <= 15 && formattedLines.length > 1) {
        const prevPrevFormatted = formattedLines[formattedLines.length - 2]
        const prevPrevLeadingSpaces = prevPrevFormatted.match(/^ */)?.[0].length || 0
        const prevPrevTrimmed = prevPrevFormatted.trim()
        wasDialogue = prevPrevLeadingSpaces >= 10 && prevPrevLeadingSpaces <= 20 &&
                      prevPrevTrimmed.length > 0 &&
                      !/^\(/.test(prevPrevTrimmed) &&
                      !/^[A-Z][A-Z0-9\s#]+$/.test(prevPrevTrimmed) &&
                      !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(prevPrevTrimmed)
      }
    }
    
    // Always normalize dialogue (follows character name, parenthetical, or previous dialogue) to proper indentation
    // Also catch continuation lines with excessive spacing (6-15 spaces typically indicates dialogue continuation)
    const isPotentialDialogueContinuation = leadingSpaces >= 6 && leadingSpaces <= 15 && 
                                            !looksLikeCharacterName && 
                                            !/^\(/.test(trimmed) &&
                                            !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
                                            !/^[A-Z][A-Z0-9\s]+$/.test(trimmed)
    
    if ((wasCharacterName || wasParenthetical || (wasPrevCharacterName && wasParenthetical) || wasDialogue || isPotentialDialogueContinuation) && 
        !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
        !/^[A-Z][A-Z0-9\s#]+$/.test(trimmed) &&
        !/^\(/.test(trimmed)) {
      // Dialogue is typically indented ~10 spaces (industry standard)
      // Use explicit string concatenation - always 10 spaces before dialogue
      const formatted = '          ' + trimmed // Exactly 10 spaces
      console.log(`🎬 SCREENPLAY FORMAT - Line ${i + 1}: DIALOGUE detected`)
      console.log(`  Original: [${line}] (${leadingSpaces} leading spaces)`)
      console.log(`  Trimmed: [${trimmed}], Length: ${trimmed.length}`)
      console.log(`  Formatted: [${formatted}]`)
      console.log(`  Formatted length: ${formatted.length}, Leading spaces in formatted: ${formatted.match(/^ */)?.[0].length || 0}`)
      console.log(`  Dialogue check - First 15 chars: [${formatted.substring(0, 15)}]`)
      console.log(`  Context: wasCharacterName=${wasCharacterName}, wasParenthetical=${wasParenthetical}, wasPrevCharacterName=${wasPrevCharacterName}, wasDialogue=${wasDialogue}`)
      formattedLines.push(formatted)
      continue
    }
    
    // Fix excessive leading spaces on action lines (more than 10) - remove all excessive spacing
    if (leadingSpaces > 10) {
      console.log(`🎬 SCREENPLAY FORMAT - Line ${i + 1}: EXCESSIVE SPACING detected (${leadingSpaces} spaces)`)
      console.log(`  Original: [${line}]`)
      console.log(`  Trimmed: [${trimmed}]`)
      console.log(`  This line was NOT matched as character/parenthetical/dialogue - treating as action line`)
      console.log(`  Character name check: ${looksLikeCharacterName}`)
      console.log(`  Parenthetical check: ${/^\(/.test(trimmed)}`)
      console.log(`  Scene heading check: ${/^(INT\.|EXT\.)/i.test(trimmed)}`)
      formattedLines.push(trimmed)
      continue
    }
    
    // Keep line as is
    formattedLines.push(line)
  }
  
  const formatted = formattedLines.join('\n')
  console.log('🎬 SCREENPLAY FORMAT - Formatting complete')
  console.log('🎬 SCREENPLAY FORMAT - Formatted length:', formatted.length)
  console.log('🎬 SCREENPLAY FORMAT - First 500 chars of formatted:', formatted.substring(0, 500))
  
  return formatted
}

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
      
      // Clean up markdown code block markers if present
      generatedScreenplay = generatedScreenplay.trim()
      if (generatedScreenplay.startsWith('```')) {
        generatedScreenplay = generatedScreenplay.replace(/^```[a-z]*\n?/i, '')
      }
      if (generatedScreenplay.endsWith('```')) {
        generatedScreenplay = generatedScreenplay.replace(/\n?```$/i, '')
      }
      generatedScreenplay = generatedScreenplay.trim()
      
      console.log('🎬 SCREENPLAY GENERATION - Raw output before formatting (OpenAI):')
      console.log('🎬 SCREENPLAY GENERATION - First 1000 chars:', generatedScreenplay.substring(0, 1000))
      console.log('🎬 SCREENPLAY GENERATION - Total length:', generatedScreenplay.length)
      
      // Fix formatting issues (excessive spacing, improper indentation)
      generatedScreenplay = fixScreenplayFormatting(generatedScreenplay)
      
      console.log('🎬 SCREENPLAY GENERATION - After formatting (OpenAI):')
      console.log('🎬 SCREENPLAY GENERATION - First 1000 chars:', generatedScreenplay.substring(0, 1000))
      console.log('🎬 SCREENPLAY GENERATION - Total length:', generatedScreenplay.length)
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
      
      // Clean up markdown code block markers if present
      generatedScreenplay = generatedScreenplay.trim()
      if (generatedScreenplay.startsWith('```')) {
        generatedScreenplay = generatedScreenplay.replace(/^```[a-z]*\n?/i, '')
      }
      if (generatedScreenplay.endsWith('```')) {
        generatedScreenplay = generatedScreenplay.replace(/\n?```$/i, '')
      }
      generatedScreenplay = generatedScreenplay.trim()
      
      console.log('🎬 SCREENPLAY GENERATION - Raw output before formatting (Anthropic):')
      console.log('🎬 SCREENPLAY GENERATION - First 1000 chars:', generatedScreenplay.substring(0, 1000))
      console.log('🎬 SCREENPLAY GENERATION - Total length:', generatedScreenplay.length)
      
      // Fix formatting issues (excessive spacing, improper indentation)
      generatedScreenplay = fixScreenplayFormatting(generatedScreenplay)
      
      console.log('🎬 SCREENPLAY GENERATION - After formatting (Anthropic):')
      console.log('🎬 SCREENPLAY GENERATION - First 1000 chars:', generatedScreenplay.substring(0, 1000))
      console.log('🎬 SCREENPLAY GENERATION - Total length:', generatedScreenplay.length)
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

