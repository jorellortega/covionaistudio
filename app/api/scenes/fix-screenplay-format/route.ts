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
function fixScreenplayFormatting(screenplay: string, lineWidth: number = 80): string {
  const lines = screenplay.split('\n')
  const formattedLines: string[] = []
  let changesMade = 0
  
  // Standard screenplay indentation constants (based on line width)
  const LINE_WIDTH = lineWidth                    // Dynamic line width (default 80)
  const CHARACTER_NAME_CENTER = LINE_WIDTH / 2   // Center point for character names
  const PARENTHETICAL_INDENT = Math.floor(LINE_WIDTH * 0.1875)  // ~15 spaces for 80-char line, scales proportionally
  const DIALOGUE_LEFT_MARGIN = Math.floor(LINE_WIDTH * 0.125)   // ~10 spaces for 80-char line (left margin)
  const DIALOGUE_RIGHT_MARGIN = Math.floor(LINE_WIDTH * 0.125)  // ~10 spaces for 80-char line (right margin)
  const DIALOGUE_MAX_WIDTH = LINE_WIDTH - DIALOGUE_LEFT_MARGIN - DIALOGUE_RIGHT_MARGIN  // ~60 chars for 80-char line
  const TRANSITION_COLUMN = Math.floor(LINE_WIDTH * 0.875)     // ~70 for 80-char line, scales proportionally
  
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
      // Use the same calculation as frontend: centerPosition - textCenter
      const nameLength = name.length
      const textCenter = nameLength / 2
      const leftPadding = Math.max(0, Math.floor(CHARACTER_NAME_CENTER - textCenter))
      const formatted = ' '.repeat(leftPadding) + name
      if (formatted !== line) {
        changesMade++
      }
      formattedLines.push(formatted)
      continue
    }
    
    // Check for character name with (CONT'D) or (V.O.) or (O.S.) or (O.C.)
    if (/\(CONT['']D\)|\(V\.O\.\)|\(O\.S\.\)|\(O\.C\.\)$/i.test(trimmed)) {
      const name = trimmed.toUpperCase().trim()
      // PROPERLY CENTER the name on the line
      // Use the same calculation as frontend: centerPosition - textCenter
      const nameLength = name.length
      const textCenter = nameLength / 2
      const leftPadding = Math.max(0, Math.floor(CHARACTER_NAME_CENTER - textCenter))
      const formatted = ' '.repeat(leftPadding) + name
      if (formatted !== line) {
        changesMade++
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
      
      // Dialogue has DIALOGUE_LEFT_MARGIN spaces indentation (allow some flexibility)
      wasDialogue = prevLeadingSpaces >= DIALOGUE_LEFT_MARGIN - 2 && prevLeadingSpaces <= DIALOGUE_LEFT_MARGIN + 2 && 
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
                                    leadingSpaces < DIALOGUE_LEFT_MARGIN && 
                                    !looksLikeCharacterName && 
                                    !/^\(/.test(trimmed) &&
                                    !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
                                    !/^[A-Z][A-Z0-9\s#'-]+$/.test(trimmed)
    
    // 5. DIALOGUE - Has left and right margins (constrained width), follows character name or parenthetical
    const isPotentialDialogueContinuation = leadingSpaces >= 6 && leadingSpaces <= 15 && 
                                            !looksLikeCharacterName && 
                                            !/^\(/.test(trimmed) &&
                                            !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
                                            !/^[A-Z][A-Z0-9\s#'-]+$/.test(trimmed)
    
    if ((wasCharacterName || wasParenthetical || (wasPrevCharacterName && wasParenthetical) || wasDialogue || isPotentialDialogueContinuation || isDialogueContinuation) && 
        !/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i.test(trimmed) &&
        !/^[A-Z][A-Z0-9\s#'-]+$/.test(trimmed) &&
        !/^\(/.test(trimmed)) {
      // Dialogue formatting: LEFT MARGIN + TEXT (constrained) + RIGHT MARGIN
      // Dialogue has its own margins: 10 spaces left, text constrained to 60 chars, 10 spaces right
      // This creates a "dialogue block" with consistent left and right margins
      let dialogueText = trimmed
      
      // If dialogue text exceeds max width, wrap it at word boundaries
      if (dialogueText.length > DIALOGUE_MAX_WIDTH) {
        // Wrap long dialogue lines - split at word boundaries
        const words = dialogueText.split(' ')
        let currentLine = ''
        const wrappedLines: string[] = []
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word
          if (testLine.length <= DIALOGUE_MAX_WIDTH) {
            currentLine = testLine
          } else {
            if (currentLine) {
              wrappedLines.push(currentLine)
            }
            // If word itself is too long, truncate it
            currentLine = word.length > DIALOGUE_MAX_WIDTH ? word.substring(0, DIALOGUE_MAX_WIDTH) : word
          }
        }
        if (currentLine) {
          wrappedLines.push(currentLine)
        }
        
        // Format each wrapped line with LEFT MARGIN + TEXT + RIGHT MARGIN (fill to 80 chars)
        wrappedLines.forEach((wrappedLine, idx) => {
          const leftMargin = ' '.repeat(DIALOGUE_LEFT_MARGIN)  // 10 spaces
          const constrainedText = wrappedLine.substring(0, DIALOGUE_MAX_WIDTH)  // Max 60 chars
          const usedChars = DIALOGUE_LEFT_MARGIN + constrainedText.length
          const rightMargin = ' '.repeat(LINE_WIDTH - usedChars)  // Fill to 80 chars total
          const formatted = leftMargin + constrainedText + rightMargin
          
          if (idx === 0 && formatted.trim() !== line.trim()) {
            changesMade++
          }
          formattedLines.push(formatted)
        })
      } else {
        // Short dialogue line - format with LEFT MARGIN + TEXT + RIGHT MARGIN (fill to 80 chars)
        const leftMargin = ' '.repeat(DIALOGUE_LEFT_MARGIN)  // 10 spaces
        const usedChars = DIALOGUE_LEFT_MARGIN + dialogueText.length
        const rightMargin = ' '.repeat(LINE_WIDTH - usedChars)  // Fill to 80 chars total
        const formatted = leftMargin + dialogueText + rightMargin
        
        if (formatted !== line) {
          changesMade++
        }
        formattedLines.push(formatted)
      }
      continue
    }
    
    // 6. ACTION LINES - Left-aligned, no indentation (remove all leading spaces)
    // Action lines are everything else that doesn't match the above patterns
    // They should have no indentation (0 spaces)
    if (leadingSpaces > 0) {
      const formatted = trimmed
      if (formatted !== line) {
        changesMade++
      }
      formattedLines.push(formatted)
      continue
    }
    
    // If line has no leading spaces and doesn't match any pattern, it's already an action line
    // Keep it as is
    formattedLines.push(line)
  }
  
  const formatted = formattedLines.join('\n')
  return formatted
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { screenplay, sceneId, userId, lineWidth } = body

    if (!screenplay) {
      return NextResponse.json(
        { error: 'Missing required field: screenplay' },
        { status: 400 }
      )
    }

    // Use provided lineWidth or default to 80 (industry standard)
    const actualLineWidth = lineWidth && typeof lineWidth === 'number' && lineWidth > 0 ? lineWidth : 80
    
    // Fix the formatting with the actual line width
    const formattedScreenplay = fixScreenplayFormatting(screenplay, actualLineWidth)

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

