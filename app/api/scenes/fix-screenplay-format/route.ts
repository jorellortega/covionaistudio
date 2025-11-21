import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Fixes screenplay formatting issues, particularly excessive spacing in character names
 * and dialogue. Ensures proper indentation following standard screenplay format.
 */
function fixScreenplayFormatting(screenplay: string): string {
  console.log('🎬 FIX FORMAT API - Starting formatting fix')
  console.log('🎬 FIX FORMAT API - Original length:', screenplay.length)
  
  const lines = screenplay.split('\n')
  console.log('🎬 FIX FORMAT API - Total lines:', lines.length)
  const formattedLines: string[] = []
  let changesMade = 0
  
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
    const looksLikeCharacterName = /^[A-Z][A-Z0-9\s#]+$/.test(trimmed) && 
                                    trimmed.length > 0 && 
                                    trimmed.length < 50 &&
                                    !trimmed.includes('.') &&
                                    !trimmed.match(/^[A-Z\s#]+[a-z]/) &&
                                    !/^(SCENE|FADE|CUT|DISSOLVE|INT|EXT)/i.test(trimmed) &&
                                    (isParenthetical || isNextParenthetical || hasNextDialogue || 
                                     (i < lines.length - 2 && /^\(/.test(lines[i + 2]?.trim())))
    
    // Always normalize character names to proper indentation (~40 spaces)
    if (looksLikeCharacterName) {
      const name = trimmed.toUpperCase()
      const formatted = '                                        '.substring(0, Math.max(0, 40 - name.length)) + name
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: CHARACTER NAME fixed`)
        console.log(`  Before: [${line}]`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // Check for character name with (CONT'D) - handle this BEFORE parenthetical check
    if (/\(CONT['']D\)$/i.test(trimmed)) {
      const name = trimmed.toUpperCase()
      const formatted = '                                        '.substring(0, Math.max(0, 40 - name.length)) + name
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: CHARACTER NAME (CONT'D) fixed`)
        console.log(`  Before: [${line}]`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // Check if this is a parenthetical (starts with parenthesis)
    if (/^\(/.test(trimmed)) {
      const content = trimmed.replace(/^\(/, '').replace(/\)$/, '').trim()
      const parenthetical = `(${content})`
      const spaces = '                 ' // Exactly 17 spaces
      const formatted = spaces + parenthetical
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: PARENTHETICAL fixed`)
        console.log(`  Before: [${line}] (${leadingSpaces} leading spaces)`)
        console.log(`  After:  [${formatted}]`)
      }
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
    let wasDialogue = false
    if (formattedLines.length > 0) {
      const prevFormatted = formattedLines[formattedLines.length - 1]
      const prevTrimmed = prevFormatted.trim()
      const prevLeadingSpaces = prevFormatted.match(/^ */)?.[0].length || 0
      
      wasDialogue = prevLeadingSpaces >= 10 && prevLeadingSpaces <= 20 && 
                    prevTrimmed.length > 0 &&
                    !/^\(/.test(prevTrimmed) &&
                    !/^[A-Z][A-Z0-9\s#]+$/.test(prevTrimmed) &&
                    !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(prevTrimmed)
      
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
    
    // Always normalize dialogue
    const isPotentialDialogueContinuation = leadingSpaces >= 6 && leadingSpaces <= 15 && 
                                            !looksLikeCharacterName && 
                                            !/^\(/.test(trimmed) &&
                                            !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
                                            !/^[A-Z][A-Z0-9\s]+$/.test(trimmed)
    
    if ((wasCharacterName || wasParenthetical || (wasPrevCharacterName && wasParenthetical) || wasDialogue || isPotentialDialogueContinuation) && 
        !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
        !/^[A-Z][A-Z0-9\s#]+$/.test(trimmed) &&
        !/^\(/.test(trimmed)) {
      const formatted = '          ' + trimmed // Exactly 10 spaces
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: DIALOGUE fixed`)
        console.log(`  Before: [${line}] (${leadingSpaces} leading spaces)`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // Fix excessive leading spaces on action lines
    if (leadingSpaces > 10) {
      if (trimmed !== line.trim()) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: EXCESSIVE SPACING removed`)
        console.log(`  Before: [${line}] (${leadingSpaces} spaces)`)
        console.log(`  After:  [${trimmed}]`)
      }
      formattedLines.push(trimmed)
      continue
    }
    
    // Keep line as is
    formattedLines.push(line)
  }
  
  const formatted = formattedLines.join('\n')
  console.log('🎬 FIX FORMAT API - Formatting complete')
  console.log('🎬 FIX FORMAT API - Total changes made:', changesMade)
  console.log('🎬 FIX FORMAT API - Formatted length:', formatted.length)
  console.log('🎬 FIX FORMAT API - Content actually changed:', screenplay !== formatted)
  
  return formatted
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { screenplay, sceneId, userId } = body

    if (!screenplay) {
      return NextResponse.json(
        { error: 'Missing required field: screenplay' },
        { status: 400 }
      )
    }

    console.log('🎬 FIX FORMAT API - Received screenplay length:', screenplay.length)
    console.log('🎬 FIX FORMAT API - First 500 chars:', screenplay.substring(0, 500))
    
    // Fix the formatting
    const formattedScreenplay = fixScreenplayFormatting(screenplay)
    
    console.log('🎬 FIX FORMAT API - Formatted screenplay length:', formattedScreenplay.length)
    console.log('🎬 FIX FORMAT API - First 500 chars of formatted:', formattedScreenplay.substring(0, 500))
    console.log('🎬 FIX FORMAT API - Content changed:', screenplay !== formattedScreenplay)
    console.log('🎬 FIX FORMAT API - Length difference:', formattedScreenplay.length - screenplay.length)

    // If sceneId is provided, save it to the scene
    if (sceneId && userId) {
      try {
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
          .update({ screenplay_content: formattedScreenplay })
          .eq('id', sceneId)
          .eq('user_id', userId)

        if (updateError) {
          console.error('Error saving formatted screenplay:', updateError)
          return NextResponse.json(
            { error: 'Failed to save formatted screenplay', details: updateError.message },
            { status: 500 }
          )
        }
      } catch (saveError) {
        console.error('Error saving formatted screenplay:', saveError)
        // Continue even if save fails - we still return the formatted screenplay
      }
    }

    return NextResponse.json({
      success: true,
      screenplay: formattedScreenplay
    })
  } catch (error) {
    console.error('Error fixing screenplay formatting:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

