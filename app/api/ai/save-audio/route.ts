import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { audioBlob, fileName, projectId, sceneId, userId } = await request.json()

    if (!audioBlob || !fileName || !projectId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: audioBlob, fileName, projectId, userId' },
        { status: 400 }
      )
    }

    // Get Supabase client
    const supabase = getSupabaseClient()

    // Check if storage bucket exists, create if it doesn't
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    if (bucketError) {
      console.error('Error checking buckets:', bucketError)
      return NextResponse.json(
        { error: `Failed to check storage buckets: ${bucketError.message}` },
        { status: 500 }
      )
    }

    const bucketExists = buckets?.some(bucket => bucket.name === 'cinema_files')
    if (!bucketExists) {
      console.log('Creating cinema_files bucket...')
      const { error: createError } = await supabase.storage.createBucket('cinema_files', {
        public: true,
        allowedMimeTypes: ['audio/*', 'image/*', 'video/*', 'application/*']
      })
      
      if (createError) {
        console.error('Error creating bucket:', createError)
        return NextResponse.json(
          { error: `Failed to create storage bucket: ${createError.message}` },
          { status: 500 }
        )
      }
      console.log('cinema_files bucket created successfully')
    }

    // Convert base64 to blob if needed
    let audioData: Blob
    if (typeof audioBlob === 'string') {
      // Handle base64 string
      const base64Data = audioBlob.split(',')[1] || audioBlob
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      audioData = new Blob([bytes], { type: 'audio/mpeg' })
    } else {
      audioData = audioBlob
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}_${fileName}.mp3`

    // Upload to Supabase storage using the correct folder structure: userId/projectId/audio/timestamp_filename
    // If sceneId is provided, include it in the path, otherwise just use project level
    const filePath = sceneId 
      ? `${userId}/${projectId}/audio/${sceneId}/${uniqueFileName}`
      : `${userId}/${projectId}/audio/${uniqueFileName}`
    
    console.log('Attempting to upload to storage:', {
      bucket: 'cinema_files',
      path: filePath,
      fileSize: audioData.size,
      contentType: 'audio/mpeg'
    })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cinema_files')
      .upload(filePath, audioData, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      console.error('Upload error details:', {
        code: uploadError.code,
        message: uploadError.message,
        details: uploadError.details,
        hint: uploadError.hint
      })
      return NextResponse.json(
        { error: `Failed to upload audio: ${uploadError.message}` },
        { status: 500 }
      )
    }

    console.log('Upload successful:', uploadData)

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('cinema_files')
      .getPublicUrl(filePath)

    // Create asset record in database
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .insert({
        project_id: projectId,
        scene_id: sceneId || null,
        user_id: userId,
        title: fileName,
        content_type: 'audio',
        content_url: urlData.publicUrl,
        prompt: `Text-to-speech generated audio for: ${fileName}`,
        model: 'ElevenLabs',
        version: 1,
        version_name: 'Generated Audio',
        generation_settings: {
          service: 'ElevenLabs',
          timestamp: new Date().toISOString(),
          original_text_length: 0 // Will be updated if we pass the original text
        },
        metadata: {
          audio_duration: 0, // Will be updated if we can extract duration
          voice_id: 'elevenlabs_generated',
          storage_path: filePath,
          generated_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (assetError) {
      console.error('Asset creation error:', assetError)
      // Try to clean up the uploaded file if asset creation fails
      await supabase.storage
        .from('cinema_files')
        .remove([filePath])
      
      return NextResponse.json(
        { error: `Failed to create asset record: ${assetError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        asset: assetData,
        storage_url: urlData.publicUrl,
        file_name: uniqueFileName
      }
    })

  } catch (error) {
    console.error('Save audio error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
