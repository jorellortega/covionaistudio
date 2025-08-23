import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { projectId, sceneId, userId } = await request.json()

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, userId' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // List audio files for this project using the correct folder structure: userId/projectId/audio
    // If sceneId is provided, look in scene-specific folder, otherwise look in project-level folder
    const audioPath = sceneId 
      ? `${userId}/${projectId}/audio/${sceneId}`
      : `${userId}/${projectId}/audio`
    
    const { data: files, error: listError } = await supabase.storage
      .from('cinema_files')
      .list(audioPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (listError) {
      console.error('Error listing audio files:', listError)
      return NextResponse.json(
        { error: `Failed to list audio files: ${listError.message}` },
        { status: 500 }
      )
    }

    // Get public URLs for each file
    const audioFiles = files?.map(file => {
      const { data: urlData } = supabase.storage
        .from('cinema_files')
        .getPublicUrl(`${audioPath}/${file.name}`)
      
      return {
        name: file.name,
        size: file.metadata?.size || 0,
        created_at: file.created_at,
        public_url: urlData.publicUrl,
        storage_path: `${audioPath}/${file.name}`
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        audioFiles,
        count: audioFiles.length
      }
    })

  } catch (error) {
    console.error('Get scene audio error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
