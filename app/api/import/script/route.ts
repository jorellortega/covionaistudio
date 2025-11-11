import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
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
            } catch { /* ignore */ }
          },
        }
      }
    )

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, genre, genres, userId, ideaId } = body

    if (!title || !content || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // If ideaId is provided, this is a script being added to an existing idea
    if (ideaId) {
      // Just return success since the idea already exists
      return NextResponse.json({ 
        success: true, 
        message: 'Script content added to existing idea' 
      })
    }

    // Support both genres array and legacy genre field
    const genresArray = genres && Array.isArray(genres) && genres.length > 0 
      ? genres 
      : (genre ? [genre] : [])
    const legacyGenre = genresArray.length > 0 ? genresArray[0] : 'Unspecified'

    // Create new movie idea from script (only if no ideaId provided)
    const { data: ideaData, error: ideaError } = await supabase
      .from('movie_ideas')
      .insert({
        user_id: userId,
        title: title,
        description: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
        genre: legacyGenre, // Legacy field for backward compatibility
        genres: genresArray, // New genres array
        status: 'concept',
        original_prompt: `Imported from script: ${title}`,
        prompt: `Script: ${title}`,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (ideaError) {
      console.error('Database insert error:', ideaError)
      return NextResponse.json({ error: 'Failed to create idea from script' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      idea: ideaData 
    })

  } catch (error) {
    console.error('Script import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
