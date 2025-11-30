import { NextRequest, NextResponse } from 'next/server'
import { ProjectShareService } from '@/lib/project-share-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase'

// POST - Accept a share via share key
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

    const { share_key } = await request.json()

    if (!share_key || !share_key.trim()) {
      return NextResponse.json(
        { error: 'Share key is required' },
        { status: 400 }
      )
    }

    // Get the share by key using server-side client
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

    const { data: share, error: shareError } = await supabaseAdmin
      .from('project_shares')
      .select('*')
      .eq('share_key', share_key.trim())
      .eq('is_revoked', false)
      .single()

    if (shareError || !share) {
      if (shareError?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Invalid or expired share key' },
          { status: 404 }
        )
      }
      console.error('Error fetching share by key:', shareError)
      return NextResponse.json(
        { error: 'Invalid or expired share key' },
        { status: 404 }
      )
    }

    // Check if expired
    if (share.deadline && new Date(share.deadline) < new Date()) {
      return NextResponse.json(
        { error: 'Share key has expired' },
        { status: 404 }
      )
    }

    // Check if share is already linked to this user
    if (share.shared_with_user_id === user.id) {
      // Already linked, just return the project
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', share.project_id)
        .single()

      if (projectError || !project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        project: {
          ...project,
          share: {
            id: share.id,
            share_key: share.share_key,
            deadline: share.deadline,
            requires_approval: share.requires_approval,
            permissions: share.permissions,
            created_at: share.created_at,
          }
        }
      })
    }

    // Update the share to link it to the current user
    const { data: updatedShare, error: updateError } = await supabaseAdmin
      .from('project_shares')
      .update({
        shared_with_user_id: user.id,
        shared_with_email: user.email, // Also set email for consistency
      })
      .eq('id', share.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating share:', updateError)
      return NextResponse.json(
        { error: 'Failed to accept share' },
        { status: 500 }
      )
    }

    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', share.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        share: {
          id: updatedShare.id,
          share_key: updatedShare.share_key,
          deadline: updatedShare.deadline,
          requires_approval: updatedShare.requires_approval,
          permissions: updatedShare.permissions,
          created_at: updatedShare.created_at,
        }
      }
    })
  } catch (error: any) {
    console.error('Error accepting share key:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to accept share' },
      { status: 500 }
    )
  }
}

