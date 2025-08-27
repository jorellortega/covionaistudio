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
    const { title, fileName, genre, userId, ideaId } = body

    if (!title || !fileName || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // For now, we'll create a movie idea entry that references the document
    // TODO: Implement actual document storage and text extraction
    const { data: ideaData, error: ideaError } = await supabase
      .from('movie_ideas')
      .insert({
        user_id: userId,
        title: title,
        description: `Document: ${fileName} - ${title}`,
        genre: genre || 'Unspecified',
        status: 'concept',
        original_prompt: `Imported document: ${fileName}`,
        prompt: `Document: ${title}`,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (ideaError) {
      console.error('Database insert error:', ideaError)
      return NextResponse.json({ error: 'Failed to create idea from document' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      idea: ideaData,
      message: `Document ${fileName} imported successfully. Note: Text extraction not yet implemented.`
    })

  } catch (error) {
    console.error('Document import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
