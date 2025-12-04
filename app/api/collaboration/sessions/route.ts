import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
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
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    // Query sessions directly using the server client
    const { data: sessions, error } = await supabase
      .from('collaboration_sessions')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching collaboration sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch collaboration sessions' },
        { status: 500 }
      )
    }

    // Filter out revoked sessions
    const activeSessions = (sessions || []).filter((s: any) => !s.is_revoked)

    return NextResponse.json({ success: true, sessions: activeSessions })
  } catch (error: any) {
    console.error('Error fetching collaboration sessions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch collaboration sessions' },
      { status: 500 }
    )
  }
}

