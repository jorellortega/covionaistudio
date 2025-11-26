import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'
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

    const body = await request.json()
    const {
      project_id,
      title,
      description,
      expires_at,
      max_participants,
      allow_guests = true,
      allow_edit = true,
      allow_delete = true,
      allow_add_scenes = true,
      allow_edit_scenes = true,
    } = body

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    const session = await CollaborationService.createSession({
      project_id,
      title,
      description,
      expires_at: expires_at || null,
      max_participants: max_participants || null,
      allow_guests,
      allow_edit,
      allow_delete,
      allow_add_scenes,
      allow_edit_scenes,
    }, supabase)

    return NextResponse.json({ success: true, session })
  } catch (error: any) {
    console.error('Error creating collaboration session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create collaboration session' },
      { status: 500 }
    )
  }
}

