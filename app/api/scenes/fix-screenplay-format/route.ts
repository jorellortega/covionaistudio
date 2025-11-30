import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Fixes screenplay formatting to proper industry standard format.
 * Standard format (for 80-character monospace line):
 * - Scene headings (INT./EXT.): Left-aligned, all caps, no indentation
 * - Action lines: Left-aligned, no indentation (0 spaces)
 * - Character names: CENTERED on the line (around column 40 for 80-char line)
 * - Parentheticals: Indented 15-17 spaces from left
 * - Dialogue: Indented 10 spaces from left
 * - Transitions: Right-aligned (around column 65-70)
 */
function fixScreenplayFormatting(screenplay: string): string {
  console.log('🎬 FIX FORMAT API - Starting formatting fix')
  console.log('🎬 FIX FORMAT API - Original length:', screenplay.length)
  
  const lines = screenplay.split('\n')
  console.log('🎬 FIX FORMAT API - Total lines:', lines.length)
  const formattedLines: string[] = []
  let changesMade = 0
  
  // Standard screenplay indentation constants (for 80-character line)
  const LINE_WIDTH = 80                    // Standard screenplay line width
  const CHARACTER_NAME_CENTER = 40         // Center point for character names
  const PARENTHETICAL_INDENT = 15          // Parentheticals indented 15 spaces
  const DIALOGUE_INDENT = 10               // Dialogue indented 10 spaces
  const TRANSITION_COLUMN = 70             // Transitions right-aligned at column 70
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const leadingSpaces = line.match(/^ */)?.[0].length || 0
    
    // Skip empty lines (preserve them)
    if (!trimmed) {
      formattedLines.push('')
      continue
    }
    
    // 1. SCENE HEADINGS (INT./EXT.) - Left-aligned, all caps, no indentation
    if (/^(INT\.|EXT\.)/i.test(trimmed)) {
      const formatted = trimmed.toUpperCase()
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: SCENE HEADING fixed`)
        console.log(`  Before: [${line}]`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // 2. TRANSITIONS (FADE IN, CUT TO, etc.) - Right-aligned, all caps
    // Remove colon if present, add it back, then right-align
    const transitionMatch = trimmed.match(/^(FADE IN|FADE OUT|CUT TO|DISSOLVE TO|SMASH CUT|MATCH CUT|FADE TO BLACK|FADE IN:|FADE OUT:|CUT TO:|DISSOLVE TO:)/i)
    if (transitionMatch) {
      let transition = transitionMatch[1].toUpperCase()
      // Ensure it ends with colon for standard transitions
      if (!transition.endsWith(':') && (transition.includes('CUT') || transition.includes('DISSOLVE') || transition.includes('FADE'))) {
        transition = transition + ':'
      }
      // Right-align to TRANSITION_COLUMN
      const formatted = transition.padStart(TRANSITION_COLUMN)
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: TRANSITION fixed`)
        console.log(`  Before: [${line}]`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // Look ahead to determine context (check up to 3 lines ahead)
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''
    const nextNextLine = i < lines.length - 2 ? lines[i + 2].trim() : ''
    const nextNextNextLine = i < lines.length - 3 ? lines[i + 3].trim() : ''
    const isParenthetical = /^\(/.test(nextLine)
    const isNextParenthetical = /^\(/.test(nextNextLine)
    const isNextNextParenthetical = /^\(/.test(nextNextNextLine)
    
    // Check if next non-empty line is dialogue (not a character name, not a scene heading, not a transition)
    const hasNextDialogue = nextLine && !isParenthetical && 
                           !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(nextLine) && 
                           !/^[A-Z][A-Z0-9\s#'-]+$/.test(nextLine) &&
                           nextLine.length > 0 &&
                           !/^\(/.test(nextLine)
    
    // 3. CHARACTER NAMES - All caps, CENTERED on the line
    // Character names are typically:
    // - All caps (or mostly caps, but we'll uppercase them)
    // - No periods (except in names like O'BRIEN, but we check for scene headings separately)
    // - Reasonable length (usually < 50 chars)
    // - Followed by parenthetical or dialogue (within 1-2 lines)
    const isAllCaps = /^[A-Z0-9\s#'-]+$/.test(trimmed) && trimmed.length > 0
    const isReasonableLength = trimmed.length > 0 && trimmed.length < 50
    const hasNoPeriods = !trimmed.includes('.') || trimmed.match(/^[A-Z\s#'-]+\.?$/) // Allow period only at end for names like "MR."
    const isNotSceneHeading = !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE|SCENE)/i.test(trimmed)
    const hasContext = isParenthetical || isNextParenthetical || isNextNextParenthetical || hasNextDialogue || 
                       (i < lines.length - 2 && /^\(/.test(lines[i + 2]?.trim())) ||
                       (i < lines.length - 3 && /^\(/.test(lines[i + 3]?.trim()))
    
    const looksLikeCharacterName = isAllCaps && 
                                    isReasonableLength &&
                                    hasNoPeriods &&
                                    isNotSceneHeading &&
                                    hasContext
    
    if (looksLikeCharacterName) {
      const name = trimmed.toUpperCase().trim()
      // PROPERLY CENTER the name on the line
      // Center point is CHARACTER_NAME_CENTER, so we calculate left padding
      const nameLength = name.length
      const leftPadding = Math.max(0, Math.floor((LINE_WIDTH - nameLength) / 2))
      const formatted = ' '.repeat(leftPadding) + name
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: CHARACTER NAME fixed (centered)`)
        console.log(`  Before: [${line}]`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // Check for character name with (CONT'D) or (V.O.) or (O.S.) or (O.C.)
    if (/\(CONT['']D\)|\(V\.O\.\)|\(O\.S\.\)|\(O\.C\.\)$/i.test(trimmed)) {
      const name = trimmed.toUpperCase().trim()
      // PROPERLY CENTER the name on the line
      const nameLength = name.length
      const leftPadding = Math.max(0, Math.floor((LINE_WIDTH - nameLength) / 2))
      const formatted = ' '.repeat(leftPadding) + name
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: CHARACTER NAME (with modifier) fixed (centered)`)
        console.log(`  Before: [${line}]`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // 4. PARENTHETICALS - Indented 15 spaces, wrapped in parentheses
    if (/^\(/.test(trimmed)) {
      // Clean up parenthetical: ensure it has parentheses
      let content = trimmed.trim()
      // Remove extra opening/closing parentheses
      content = content.replace(/^\(+/, '(').replace(/\)+$/, ')')
      // Ensure it starts and ends with parentheses
      if (!content.startsWith('(')) content = '(' + content
      if (!content.endsWith(')')) content = content + ')'
      // Normalize spacing inside parentheses
      const innerContent = content.slice(1, -1).trim()
      content = `(${innerContent})`
      
      const formatted = ' '.repeat(PARENTHETICAL_INDENT) + content
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
    const wasCharacterName = /^[A-Z][A-Z0-9\s#'-]+$/.test(prevLine) && 
                             prevLine.length < 50 && 
                             !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(prevLine) &&
                             !/^\(/.test(prevLine)
    const wasParenthetical = /^\(/.test(prevLine)
    const wasPrevCharacterName = /^[A-Z][A-Z0-9\s#'-]+$/.test(prevPrevLine) && 
                                  prevPrevLine.length < 50 && 
                                  !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(prevPrevLine)
    
    // Check if previous lines were dialogue (for continuation lines)
    let wasDialogue = false
    if (formattedLines.length > 0) {
      const prevFormatted = formattedLines[formattedLines.length - 1]
      const prevTrimmed = prevFormatted.trim()
      const prevLeadingSpaces = prevFormatted.match(/^ */)?.[0].length || 0
      
      // Dialogue has DIALOGUE_INDENT spaces indentation (allow some flexibility)
      wasDialogue = prevLeadingSpaces >= DIALOGUE_INDENT - 2 && prevLeadingSpaces <= DIALOGUE_INDENT + 2 && 
                    prevTrimmed.length > 0 &&
                    !/^\(/.test(prevTrimmed) &&
                    !/^[A-Z][A-Z0-9\s#'-]+$/.test(prevTrimmed) &&
                    !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(prevTrimmed)
    }
    
    // Check if this is a continuation line of dialogue (even if it starts at hard left)
    // A continuation line is one that:
    // 1. Follows a dialogue line (wasDialogue is true), OR
    // 2. Follows a character name or parenthetical, OR
    // 3. Has some indentation (6-15 spaces) and looks like dialogue
    // 4. Starts at hard left (0 spaces) but follows dialogue - this is the key fix
    const isDialogueContinuation = wasDialogue && 
                                    leadingSpaces < DIALOGUE_INDENT && 
                                    !looksLikeCharacterName && 
                                    !/^\(/.test(trimmed) &&
                                    !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
                                    !/^[A-Z][A-Z0-9\s#'-]+$/.test(trimmed)
    
    // 5. DIALOGUE - Indented 10 spaces, follows character name or parenthetical
    const isPotentialDialogueContinuation = leadingSpaces >= 6 && leadingSpaces <= 15 && 
                                            !looksLikeCharacterName && 
                                            !/^\(/.test(trimmed) &&
                                            !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
                                            !/^[A-Z][A-Z0-9\s#'-]+$/.test(trimmed)
    
    if ((wasCharacterName || wasParenthetical || (wasPrevCharacterName && wasParenthetical) || wasDialogue || isPotentialDialogueContinuation || isDialogueContinuation) && 
        !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
        !/^[A-Z][A-Z0-9\s#'-]+$/.test(trimmed) &&
        !/^\(/.test(trimmed)) {
      const formatted = ' '.repeat(DIALOGUE_INDENT) + trimmed
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: DIALOGUE fixed${isDialogueContinuation ? ' (continuation)' : ''}`)
        console.log(`  Before: [${line}] (${leadingSpaces} leading spaces)`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // 6. ACTION LINES - Left-aligned, no indentation (remove all leading spaces)
    // Action lines are everything else that doesn't match the above patterns
    // They should have no indentation (0 spaces)
    if (leadingSpaces > 0) {
      const formatted = trimmed
      if (formatted !== line) {
        changesMade++
        console.log(`🎬 FIX FORMAT API - Line ${i + 1}: ACTION LINE fixed (removed ${leadingSpaces} leading spaces)`)
        console.log(`  Before: [${line}]`)
        console.log(`  After:  [${formatted}]`)
      }
      formattedLines.push(formatted)
      continue
    }
    
    // If line has no leading spaces and doesn't match any pattern, it's already an action line
    // Keep it as is
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

