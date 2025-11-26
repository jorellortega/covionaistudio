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
  { params }: { params: { sessionId: string } }
) {
  try {
    const { user, error: userError } = await getAuthenticatedUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const session = await CollaborationService.getSessionById(params.sessionId)

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
  { params }: { params: { sessionId: string } }
) {
  try {
    const { user, error: userError } = await getAuthenticatedUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const session = await CollaborationService.updateSession(params.sessionId, body)

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
  { params }: { params: { sessionId: string } }
) {
  try {
    const { user, error: userError } = await getAuthenticatedUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    await CollaborationService.deleteSession(params.sessionId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting collaboration session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete session' },
      { status: 500 }
    )
  }
}

