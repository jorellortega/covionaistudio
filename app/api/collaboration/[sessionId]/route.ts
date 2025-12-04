import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
            // Ignore setAll errors in server components
          }
        },
      },
    }
  )
  
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { user, error: userError } = await getAuthenticatedUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params
    const session = await CollaborationService.getSessionById(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, session })
  } catch (error: any) {
    console.error('Error fetching collaboration session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
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
            } catch {
              // Ignore setAll errors in server components
            }
          },
        },
      }
    )
    
    const { user, error: userError } = await getAuthenticatedUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params
    const body = await request.json()

    // Update session directly using server-side client
    const { data: session, error } = await supabase
      .from('collaboration_sessions')
      .update({
        title: body.title || null,
        description: body.description || null,
        expires_at: body.expires_at || null,
        allow_guests: body.allow_guests ?? true,
        allow_edit: body.allow_edit ?? true,
        allow_delete: body.allow_delete ?? true,
        allow_add_scenes: body.allow_add_scenes ?? true,
        allow_edit_scenes: body.allow_edit_scenes ?? true,
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating collaboration session:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update session' },
        { status: 500 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, session })
  } catch (error: any) {
    console.error('Error updating collaboration session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update session' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { user, error: userError } = await getAuthenticatedUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params
    await CollaborationService.deleteSession(sessionId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting collaboration session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete session' },
      { status: 500 }
    )
  }
}

