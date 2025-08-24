import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { audioId, userId } = await request.json()

    if (!audioId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: audioId, userId' },
        { status: 400 }
      )
    }

    // Validate the audio file exists and belongs to the user
    const { data: audioFile, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', audioId)
      .eq('user_id', userId)
      .eq('content_type', 'audio')
      .single()

    if (fetchError || !audioFile) {
      return NextResponse.json(
        { success: false, error: 'Audio file not found or access denied' },
        { status: 404 }
      )
    }

    // Delete the file from storage bucket
    if (audioFile.content_url) {
      try {
        // Extract the file path from the URL
        const urlParts = audioFile.content_url.split('/')
        const filePath = urlParts.slice(-2).join('/') // Get the last two parts (folder/filename)
        
        const { error: storageError } = await supabase.storage
          .from('cinema-files')
          .remove([filePath])

        if (storageError) {
          console.error('Error deleting from storage:', storageError)
          // Continue with database deletion even if storage deletion fails
        }
      } catch (storageError) {
        console.error('Error in storage deletion:', storageError)
        // Continue with database deletion
      }
    }

    // Delete the asset record from the database
    const { error: deleteError } = await supabase
      .from('assets')
      .delete()
      .eq('id', audioId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting asset from database:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete audio file from database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Audio file deleted successfully',
      data: {
        id: audioId,
        fileName: audioFile.title || 'Unknown'
      }
    })

  } catch (error) {
    console.error('Error in delete-audio API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
