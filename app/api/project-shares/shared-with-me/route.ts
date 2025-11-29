import { NextRequest, NextResponse } from 'next/server'
import { ProjectShareService } from '@/lib/project-share-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase'

// GET - Get projects shared with current user
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

    // Get shares for current user (check both user_id and email)
    const shares = await ProjectShareService.getSharesForUser(supabase)
    
    if (shares.length === 0) {
      return NextResponse.json({ success: true, projects: [] })
    }

    // Get project details for each share
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const projectIds = shares.map(share => share.project_id)
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .in('id', projectIds)

    if (projectsError) {
      console.error('Error fetching shared projects:', projectsError)
      return NextResponse.json(
        { error: 'Failed to fetch shared projects' },
        { status: 500 }
      )
    }

    // Combine share info with project details
    const sharedProjects = projects.map(project => {
      const share = shares.find(s => s.project_id === project.id)
      return {
        ...project,
        share: {
          id: share?.id,
          share_key: share?.share_key,
          deadline: share?.deadline,
          requires_approval: share?.requires_approval,
          permissions: share?.permissions,
          created_at: share?.created_at,
        }
      }
    })

    return NextResponse.json({ success: true, projects: sharedProjects })
  } catch (error: any) {
    console.error('Error fetching shared projects:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch shared projects' },
      { status: 500 }
    )
  }
}

