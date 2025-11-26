import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'
import { createClient } from '@supabase/supabase-js'

// GET all scenes for a project (for guests)
export async function GET(request: NextRequest) {
  try {
    console.log('📋 [API] GET scenes request')
    const { searchParams } = new URL(request.url)
    const accessCode = searchParams.get('access_code')

    console.log('📋 [API] Access code provided:', !!accessCode)

    if (!accessCode) {
      console.error('❌ [API] No access code provided')
      return NextResponse.json(
        { error: 'access_code is required' },
        { status: 400 }
      )
    }

    // Validate access code
    console.log('📋 [API] Validating access code...')
    const validation = await CollaborationService.validateAccessCode(accessCode)
    console.log('📋 [API] Validation result:', { valid: validation.valid, hasSession: !!validation.session })
    
    if (!validation.valid || !validation.session) {
      console.error('❌ [API] Invalid access code:', validation.reason)
      return NextResponse.json(
        { error: 'Invalid or expired access code' },
        { status: 403 }
      )
    }

    // Use service role client to bypass RLS for guest access
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get timeline for the project
    console.log('📋 [API] Fetching timeline for project:', validation.session.project_id)
    const { data: timeline, error: timelineError } = await supabaseAdmin
      .from('timelines')
      .select('id')
      .eq('project_id', validation.session.project_id)
      .single()

    if (timelineError || !timeline) {
      console.log('⚠️ [API] No timeline found for project:', timelineError?.message)
      return NextResponse.json({ success: true, scenes: [] })
    }

    console.log('📋 [API] Timeline found:', timeline.id)

    // Get all scenes for the timeline
    console.log('📋 [API] Fetching scenes for timeline:', timeline.id)
    const { data: scenes, error: scenesError } = await supabaseAdmin
      .from('scenes')
      .select('id, name, description, screenplay_content, metadata, order_index, created_at, updated_at')
      .eq('timeline_id', timeline.id)
      .order('order_index', { ascending: true })

    if (scenesError) {
      console.error('❌ [API] Error fetching scenes:', scenesError)
      return NextResponse.json(
        { error: 'Failed to fetch scenes' },
        { status: 500 }
      )
    }

    console.log('✅ [API] Found', scenes?.length || 0, 'scenes')
    return NextResponse.json({ success: true, scenes: scenes || [] })
  } catch (error: any) {
    console.error('Error fetching scenes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scenes' },
      { status: 500 }
    )
  }
}

// POST create new scene (for guests)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_code, name, description, scene_number, location } = body

    if (!access_code) {
      return NextResponse.json(
        { error: 'access_code is required' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    // Validate access code
    const validation = await CollaborationService.validateAccessCode(access_code)
    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { error: 'Invalid or expired access code' },
        { status: 403 }
      )
    }

    // Check permissions
    if (!validation.session.allow_add_scenes) {
      return NextResponse.json(
        { error: 'Adding scenes is not allowed for this session' },
        { status: 403 }
      )
    }

    // Use service role client to bypass RLS for guest access
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get timeline for the project
    const { data: timeline, error: timelineError } = await supabaseAdmin
      .from('timelines')
      .select('id')
      .eq('project_id', validation.session.project_id)
      .single()

    if (timelineError || !timeline) {
      return NextResponse.json(
        { error: 'Timeline not found for this project' },
        { status: 404 }
      )
    }

    // Create new scene
    const { data: newScene, error: createError } = await supabaseAdmin
      .from('scenes')
      .insert({
        timeline_id: timeline.id,
        name,
        description,
        start_time_seconds: 0,
        duration_seconds: 0,
        scene_type: 'text',
        metadata: {
          sceneNumber: scene_number || '',
          location: location || '',
        },
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json(
        { error: 'Failed to create scene' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, scene: newScene })
  } catch (error: any) {
    console.error('Error creating scene:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create scene' },
      { status: 500 }
    )
  }
}

