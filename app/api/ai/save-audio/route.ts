import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { audioBlob, fileName, audioTitle, projectId, sceneId, treatmentId, userId, metadata } = await request.json()

    if (!audioBlob || !fileName || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: audioBlob, fileName, userId' },
        { status: 400 }
      )
    }

    // Require either projectId, sceneId, or treatmentId
    if (!projectId && !sceneId && !treatmentId) {
      return NextResponse.json(
        { error: 'Missing required field: at least one of projectId, sceneId, or treatmentId must be provided' },
        { status: 400 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase environment variables missing for save-audio route')
      return NextResponse.json(
        { error: 'Server storage configuration missing. Please check SUPABASE env variables.' },
        { status: 500 }
      )
    }

    // Use service role client on the server so we can bypass RLS for uploads
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Ensure bucket exists (service role required)
    const { error: bucketInfoError } = await supabase.storage.getBucket('cinema_files')
    if (bucketInfoError) {
      console.log('cinema_files bucket missing, attempting to create...')
      const { error: createBucketError } = await supabase.storage.createBucket('cinema_files', {
        public: true,
        allowedMimeTypes: ['audio/*', 'image/*', 'video/*', 'application/*']
      })
      if (createBucketError && createBucketError.status !== 400) {
        console.error('Error creating bucket:', createBucketError)
        return NextResponse.json(
          { error: `Failed to ensure storage bucket: ${createBucketError.message}` },
          { status: 500 }
        )
      }
    }

    // Convert base64 to blob if needed
    let audioBuffer: Buffer
    let contentType = 'audio/mpeg'
    if (typeof audioBlob === 'string') {
      // Handle base64 string
      const base64Data = audioBlob.split(',')[1] || audioBlob
      audioBuffer = Buffer.from(base64Data, 'base64')
    } else {
      // Assume this is already an ArrayBuffer/Buffer; convert to Buffer if needed
      audioBuffer = Buffer.isBuffer(audioBlob) ? audioBlob : Buffer.from(audioBlob)
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}_${fileName}.mp3`

    // Upload to Supabase storage using the correct folder structure
    // Priority: treatmentId > sceneId > project level
    // Handle cases where projectId might be null (standalone treatments)
    let filePath: string
    if (treatmentId) {
      if (projectId) {
        filePath = `${userId}/${projectId}/audio/treatment/${treatmentId}/${uniqueFileName}`
      } else {
        // Standalone treatment without project
        filePath = `${userId}/treatments/${treatmentId}/audio/${uniqueFileName}`
      }
    } else if (sceneId) {
      if (projectId) {
        filePath = `${userId}/${projectId}/audio/${sceneId}/${uniqueFileName}`
      } else {
        // Scene without project (unlikely but handle it)
        filePath = `${userId}/scenes/${sceneId}/audio/${uniqueFileName}`
      }
    } else if (projectId) {
      filePath = `${userId}/${projectId}/audio/${uniqueFileName}`
    } else {
      // Fallback: user-level audio (shouldn't happen due to validation above)
      filePath = `${userId}/audio/${uniqueFileName}`
    }
    
    console.log('Attempting to upload to storage:', {
      bucket: 'cinema_files',
      path: filePath,
      fileSize: audioBuffer.byteLength,
      contentType
    })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cinema_files')
      .upload(filePath, audioBuffer, {
        contentType,
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
    // project_id can be null if this is a standalone treatment
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .insert({
        project_id: projectId || null, // Can be null for standalone treatments
        scene_id: sceneId || null,
        treatment_id: treatmentId || null,
        user_id: userId,
        title: audioTitle || fileName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), // Use provided audioTitle or convert filename
        content_type: 'audio',
        content_url: urlData.publicUrl,
        prompt: `Text-to-speech generated audio for: ${fileName}`,
        model: 'ElevenLabs',
        version: 1,
        version_name: 'Generated Audio',
        is_latest_version: true,
        generation_settings: {
          service: 'ElevenLabs',
          timestamp: new Date().toISOString(),
          original_text_length: 0 // Will be updated if we pass the original text
        },
        metadata: {
          audio_duration: 0, // Will be updated if we can extract duration
          voice_id: 'elevenlabs_generated',
          storage_path: filePath,
          generated_at: new Date().toISOString(),
          source: treatmentId ? 'treatment' : sceneId ? 'scene' : 'project',
          file_size: audioBuffer.byteLength, // Store file size in bytes
          size: audioBuffer.byteLength, // Also store as 'size' for backward compatibility
          has_project: !!projectId, // Track if this asset has a project
          // Include page number and scene ID from metadata for screenplay page audio tracking
          pageNumber: metadata?.pageNumber || null,
          sceneId: sceneId || metadata?.sceneId || null,
          totalPages: metadata?.totalPages || null,
          ...(metadata || {}) // Merge any additional metadata (e.g., audioType: 'scene_description')
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
