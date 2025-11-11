import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { projectId, sceneId, treatmentId, userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      )
    }

    // Require at least one of projectId, sceneId, or treatmentId
    if (!projectId && !sceneId && !treatmentId) {
      return NextResponse.json(
        { error: 'Missing required field: at least one of projectId, sceneId, or treatmentId must be provided' },
        { status: 400 }
      )
    }

    // Get Supabase client
    const supabase = getSupabaseClient()

    // Query assets table to get audio files for this treatment/scene/project
    // This gives us proper asset IDs for delete/rename operations
    let query = supabase
      .from('assets')
      .select('id, title, content_url, created_at, metadata')
      .eq('user_id', userId)
      .eq('content_type', 'audio')
      .order('created_at', { ascending: false })
      .limit(100)

    // Filter by treatment_id, scene_id, or project_id
    if (treatmentId) {
      // For treatments, filter by treatment_id
      // If projectId is provided, also filter by it; otherwise allow null project_id
      query = query.eq('treatment_id', treatmentId)
      if (projectId) {
        query = query.eq('project_id', projectId)
      } else {
        // Standalone treatment: project_id should be null
        query = query.is('project_id', null)
      }
    } else if (sceneId) {
      // For scenes, filter by scene_id
      // If projectId is provided, also filter by it; otherwise allow null project_id
      query = query.eq('scene_id', sceneId)
      if (projectId) {
        query = query.eq('project_id', projectId)
      } else {
        // Standalone scene: project_id should be null (unlikely but handle it)
        query = query.is('project_id', null)
      }
    } else if (projectId) {
      // Project-level: no treatment_id and no scene_id
      query = query.eq('project_id', projectId)
        .is('treatment_id', null)
        .is('scene_id', null)
    }

    const { data: assets, error: queryError } = await query

    if (queryError) {
      console.error('Error querying audio assets:', queryError)
      return NextResponse.json(
        { error: `Failed to fetch audio files: ${queryError.message}` },
        { status: 500 }
      )
    }

    // Map assets to audio files format
    const audioFiles = (assets || []).map(asset => {
      // Extract file size from metadata if available
      const fileSize = asset.metadata?.file_size || asset.metadata?.size || 0
      
      return {
        id: asset.id, // Use asset ID for delete/rename operations
        name: asset.title || 'Untitled Audio',
        size: fileSize,
        created_at: asset.created_at,
        public_url: asset.content_url || '',
        storage_path: asset.metadata?.storage_path || ''
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        audioFiles,
        count: audioFiles.length
      }
    })

  } catch (error) {
    console.error('Get audio error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
