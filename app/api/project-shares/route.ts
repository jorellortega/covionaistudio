import { NextRequest, NextResponse } from 'next/server'
import { ProjectShareService } from '@/lib/project-share-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - List shares for a project
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

    const shares = await ProjectShareService.getSharesByProject(projectId, supabase)
    return NextResponse.json({ success: true, shares })
  } catch (error: any) {
    console.error('Error fetching project shares:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch project shares' },
      { status: 500 }
    )
  }
}

// POST - Create a new project share
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
      shared_with_user_id,
      shared_with_email,
      share_key,
      deadline,
      requires_approval,
      permissions,
      metadata,
    } = body

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    if (!shared_with_user_id && !shared_with_email) {
      return NextResponse.json(
        { error: 'Either shared_with_user_id or shared_with_email is required' },
        { status: 400 }
      )
    }

    const share = await ProjectShareService.createShare({
      project_id,
      shared_with_user_id,
      shared_with_email,
      share_key: share_key || null,
      deadline: deadline || null,
      requires_approval: requires_approval || false,
      permissions,
      metadata,
    }, supabase)

    return NextResponse.json({ success: true, share })
  } catch (error: any) {
    console.error('Error creating project share:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create project share' },
      { status: 500 }
    )
  }
}

