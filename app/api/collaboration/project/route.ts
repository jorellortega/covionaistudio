import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase'

// GET project info (for guests)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accessCode = searchParams.get('access_code')

    if (!accessCode) {
      return NextResponse.json(
        { error: 'access_code is required' },
        { status: 400 }
      )
    }

    // Validate access code
    const validation = await CollaborationService.validateAccessCode(accessCode)
    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { error: 'Invalid or expired access code' },
        { status: 403 }
      )
    }

    // Use service role client to bypass RLS for guest access
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

    // Get project info
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('id, name, thumbnail')
      .eq('id', validation.session.project_id)
      .single()

    if (error) {
      console.error('Error fetching project:', error)
      return NextResponse.json(
        { error: 'Failed to fetch project' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, project })
  } catch (error: any) {
    console.error('Error fetching project:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch project' },
      { status: 500 }
    )
  }
}



