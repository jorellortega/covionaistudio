import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

const supabase = getSupabaseClient()

export async function POST(request: NextRequest) {
  try {
    const { audioId, newName, userId } = await request.json()

    if (!audioId || !newName || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: audioId, newName, userId' },
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

    // Update the asset name in the database
    const { error: updateError } = await supabase
      .from('assets')
      .update({ 
        title: newName,
        updated_at: new Date().toISOString()
      })
      .eq('id', audioId)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error updating asset name:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update audio file name' },
        { status: 500 }
      )
    }

    // Note: We don't rename the actual file in storage as it would require
    // downloading, renaming, and re-uploading. The database title serves as
    // the display name for the user.

    return NextResponse.json({
      success: true,
      message: 'Audio file renamed successfully',
      data: {
        id: audioId,
        newName: newName
      }
    })

  } catch (error) {
    console.error('Error in rename-audio API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
