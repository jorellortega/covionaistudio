import { NextRequest, NextResponse } from 'next/server'
import { ProjectShareService } from '@/lib/project-share-service'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase'

// GET - Access project via share key
export async function GET(
  request: NextRequest,
  { params }: { params: { shareKey: string } }
) {
  try {
    const share = await ProjectShareService.getShareByKey(params.shareKey)
    
    if (!share) {
      return NextResponse.json(
        { error: 'Invalid or expired share key' },
        { status: 404 }
      )
    }

    // Get project details
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
  } catch (error: any) {
    console.error('Error accessing project via share key:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to access project' },
      { status: 500 }
    )
  }
}





















