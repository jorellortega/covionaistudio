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

    // Get all timelines for the project (there can be multiple)
    console.log('📋 [API] Fetching timelines for project:', validation.session.project_id)
    const { data: timelines, error: timelineError } = await supabaseAdmin
      .from('timelines')
      .select('id')
      .eq('project_id', validation.session.project_id)

    if (timelineError) {
      console.error('❌ [API] Error fetching timelines:', timelineError)
      return NextResponse.json({ success: true, scenes: [] })
    }

    if (!timelines || timelines.length === 0) {
      console.log('⚠️ [API] No timelines found for project - returning empty scenes')
      return NextResponse.json({ success: true, scenes: [] })
    }

    console.log('📋 [API] Found', timelines.length, 'timeline(s) for project')

    // Get all scenes from all timelines for this project
    const timelineIds = timelines.map(t => t.id)
    console.log('📋 [API] Fetching scenes for timelines:', timelineIds)
    const { data: scenes, error: scenesError } = await supabaseAdmin
      .from('scenes')
      .select('id, name, description, screenplay_content, metadata, order_index, created_at, updated_at')
      .in('timeline_id', timelineIds)
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

    // Get project owner to use as user_id for timeline and scenes
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('user_id')
      .eq('id', validation.session.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const userId = project.user_id

    // Get or create timeline for the project
    let { data: timeline, error: timelineError } = await supabaseAdmin
      .from('timelines')
      .select('id')
      .eq('project_id', validation.session.project_id)
      .single()

    // If timeline doesn't exist, create one
    if (timelineError || !timeline) {
      console.log('📋 [API] Timeline not found, creating one for project:', validation.session.project_id)
      
      // Create timeline
      const { data: newTimeline, error: createTimelineError } = await supabaseAdmin
        .from('timelines')
        .insert({
          project_id: validation.session.project_id,
          user_id: userId,
          name: 'Main Timeline',
          description: 'Default timeline for collaboration',
        })
        .select('id')
        .single()

      if (createTimelineError || !newTimeline) {
        console.error('❌ [API] Error creating timeline:', createTimelineError)
        return NextResponse.json(
          { error: 'Failed to create timeline for this project' },
          { status: 500 }
        )
      }

      timeline = newTimeline
      console.log('✅ [API] Created timeline:', timeline.id)
    }

    // Get the next order_index for this timeline
    const { data: existingScenes, error: scenesCountError } = await supabaseAdmin
      .from('scenes')
      .select('order_index')
      .eq('timeline_id', timeline.id)
      .order('order_index', { ascending: false })
      .limit(1)

    // Calculate next order_index (start at 1 if no scenes exist)
    const nextOrderIndex = existingScenes && existingScenes.length > 0
      ? (existingScenes[0].order_index || 0) + 1
      : 1

    console.log('📋 [API] Creating scene with order_index:', nextOrderIndex)

    // Create new scene
    const { data: newScene, error: createError } = await supabaseAdmin
      .from('scenes')
      .insert({
        timeline_id: timeline.id,
        user_id: userId, // Required field - use project owner's user_id
        name,
        description,
        start_time_seconds: 0,
        duration_seconds: 0,
        scene_type: 'text',
        order_index: nextOrderIndex, // Required field - must be > 0
        metadata: {
          sceneNumber: scene_number || '',
          location: location || '',
        },
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ [API] Error creating scene:', createError)
      console.error('❌ [API] Error details:', JSON.stringify(createError, null, 2))
      console.error('❌ [API] Scene data attempted:', {
        timeline_id: timeline.id,
        user_id: userId,
        name,
        description,
        start_time_seconds: 0,
        duration_seconds: 0,
        scene_type: 'text',
        order_index: nextOrderIndex,
      })
      return NextResponse.json(
        { error: 'Failed to create scene', details: createError.message },
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

