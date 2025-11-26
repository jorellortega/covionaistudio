import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'
import { createClient } from '@supabase/supabase-js'

// GET scene content (for guests)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    const { sceneId } = await params
    console.log('📄 [API] GET scene content request for:', sceneId)
    const { searchParams } = new URL(request.url)
    const accessCode = searchParams.get('access_code')

    console.log('📄 [API] Access code provided:', !!accessCode)

    if (!accessCode) {
      console.error('❌ [API] No access code provided')
      return NextResponse.json(
        { error: 'access_code is required' },
        { status: 400 }
      )
    }

    // Validate access code
    console.log('📄 [API] Validating access code...')
    const validation = await CollaborationService.validateAccessCode(accessCode)
    console.log('📄 [API] Validation result:', { valid: validation.valid, hasSession: !!validation.session })
    
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

    // Get scene
    console.log('📄 [API] Fetching scene from database:', sceneId)
    const { data: scene, error } = await supabaseAdmin
      .from('scenes')
      .select('id, name, description, screenplay_content, metadata, timeline_id')
      .eq('id', sceneId)
      .single()

    if (error) {
      console.error('❌ [API] Error fetching scene:', error)
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      )
    }

    console.log('📄 [API] Scene found:', {
      id: scene.id,
      name: scene.name,
      hasContent: !!scene.screenplay_content,
      contentLength: scene.screenplay_content?.length || 0,
      timelineId: scene.timeline_id
    })

    // Verify scene belongs to the project
    // We need to check if the scene's timeline belongs to the project
    console.log('📄 [API] Verifying timeline belongs to project:', validation.session.project_id)
    const { data: timeline, error: timelineError } = await supabaseAdmin
      .from('timelines')
      .select('project_id')
      .eq('id', scene.timeline_id)
      .single()

    if (timelineError) {
      console.error('❌ [API] Timeline error:', timelineError)
    }

    if (timelineError || timeline?.project_id !== validation.session.project_id) {
      console.error('❌ [API] Scene does not belong to project:', {
        timelineProjectId: timeline?.project_id,
        sessionProjectId: validation.session.project_id,
        match: timeline?.project_id === validation.session.project_id
      })
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      )
    }

    console.log('✅ [API] Scene verified, returning content')
    return NextResponse.json({ success: true, scene })
  } catch (error: any) {
    console.error('Error fetching scene:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scene' },
      { status: 500 }
    )
  }
}

// PATCH scene content (for guests)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    const { sceneId } = await params
    const body = await request.json()
    const { access_code, screenplay_content, name, description, metadata } = body

    if (!access_code) {
      return NextResponse.json(
        { error: 'access_code is required' },
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
    if (!validation.session.allow_edit) {
      return NextResponse.json(
        { error: 'Editing is not allowed for this session' },
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

    // Get scene to verify it belongs to the project
    const { data: scene, error: sceneError } = await supabaseAdmin
      .from('scenes')
      .select('timeline_id')
      .eq('id', sceneId)
      .single()

    if (sceneError || !scene) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      )
    }

    // Verify scene belongs to the project
    const { data: timeline, error: timelineError } = await supabaseAdmin
      .from('timelines')
      .select('project_id')
      .eq('id', scene.timeline_id)
      .single()

    if (timelineError || timeline?.project_id !== validation.session.project_id) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      )
    }

    // Update scene
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (screenplay_content !== undefined) {
      updates.screenplay_content = screenplay_content
    }
    if (name !== undefined && validation.session.allow_edit_scenes) {
      updates.name = name
    }
    if (description !== undefined && validation.session.allow_edit_scenes) {
      updates.description = description
    }
    if (metadata !== undefined && validation.session.allow_edit_scenes) {
      updates.metadata = metadata
    }

    const { data: updatedScene, error: updateError } = await supabaseAdmin
      .from('scenes')
      .update(updates)
      .eq('id', sceneId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update scene' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, scene: updatedScene })
  } catch (error: any) {
    console.error('Error updating scene:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update scene' },
      { status: 500 }
    )
  }
}

