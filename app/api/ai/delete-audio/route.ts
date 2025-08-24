import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { audioId, userId } = await request.json()

    console.log('🎵 DELETE-AUDIO - Starting deletion for:', { audioId, userId })

    if (!audioId || !userId) {
      console.error('🎵 DELETE-AUDIO - Missing required fields:', { audioId, userId })
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
      console.error('🎵 DELETE-AUDIO - Audio file not found or access denied:', { audioId, userId, fetchError })
      return NextResponse.json(
        { success: false, error: 'Audio file not found or access denied' },
        { status: 404 }
      )
    }

    console.log('🎵 DELETE-AUDIO - Found audio file:', { 
      id: audioFile.id, 
      title: audioFile.title, 
      content_url: audioFile.content_url 
    })

    // Delete the file from storage bucket
    if (audioFile.content_url) {
      try {
        // Extract the file path from the URL
        let filePath = ''
        
        if (audioFile.content_url.includes('cinema_files')) {
          // If it's a Supabase storage URL, extract the path after the bucket name
          const urlParts = audioFile.content_url.split('cinema_files/')
          if (urlParts.length > 1) {
            filePath = urlParts[1]
          }
        } else {
          // Fallback: try to extract from the end of the URL
          const urlParts = audioFile.content_url.split('/')
          filePath = urlParts.slice(-2).join('/') // Get the last two parts (folder/filename)
        }
        
        if (filePath) {
          console.log('🎵 DELETE-AUDIO - Attempting to delete from storage:', { bucket: 'cinema_files', filePath })
          
          const { error: storageError } = await supabase.storage
            .from('cinema_files')
            .remove([filePath])

          if (storageError) {
            console.error('🎵 DELETE-AUDIO - Error deleting from storage:', storageError)
            // Continue with database deletion even if storage deletion fails
          } else {
            console.log('🎵 DELETE-AUDIO - Successfully deleted from storage:', filePath)
          }
        } else {
          console.warn('🎵 DELETE-AUDIO - Could not extract file path from URL:', audioFile.content_url)
        }
      } catch (storageError) {
        console.error('🎵 DELETE-AUDIO - Error in storage deletion:', storageError)
        // Continue with database deletion
      }
    } else {
      console.log('🎵 DELETE-AUDIO - No content_url to delete from storage')
    }

    // Delete the asset record from the database
    console.log('🎵 DELETE-AUDIO - Deleting asset from database:', audioId)
    
    const { error: deleteError } = await supabase
      .from('assets')
      .delete()
      .eq('id', audioId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('🎵 DELETE-AUDIO - Error deleting asset from database:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete audio file from database' },
        { status: 500 }
      )
    }

    console.log('🎵 DELETE-AUDIO - Successfully deleted audio asset:', audioId)

    return NextResponse.json({
      success: true,
      message: 'Audio file deleted successfully',
      data: {
        id: audioId,
        fileName: audioFile.title || 'Unknown'
      }
    })

  } catch (error) {
    console.error('🎵 DELETE-AUDIO - Error in delete-audio API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
