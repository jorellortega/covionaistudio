import { NextRequest, NextResponse } from 'next/server'

// Increase body size limit for this route (100MB for video uploads)
export const maxDuration = 300 // 5 minutes
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Get the current user using server-side Supabase client
    const { createServerClient } = await import('@supabase/ssr')
    const { cookies } = await import('next/headers')
    
    // Create server-side Supabase client with proper authentication
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the file from FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (50MB for videos, 10MB for images)
    const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: `File too large. ${file.type.startsWith('video/') ? 'Video' : 'Image'} files must be smaller than ${file.type.startsWith('video/') ? '50MB' : '10MB'}. Please compress or use a smaller file.` 
      }, { status: 413 })
    }

    // Get the API key from environment variable
    const rawKey = process.env.RUNWAYML_API_SECRET?.trim()
    
    if (!rawKey) {
      return NextResponse.json({ error: 'RUNWAYML_API_SECRET is missing. Please set this environment variable.' }, { status: 500 })
    }
    
    // Remove any placeholder text that might be appended
    const cleanKey = rawKey.replace(/nway_ml_api_key_here.*$/, '').trim()
    
    if (!cleanKey.startsWith('key_')) {
      return NextResponse.json({ error: 'RUNWAYML_API_SECRET is invalid. API key must start with "key_".' }, { status: 500 })
    }
    
    if (cleanKey.length < 50) {
      return NextResponse.json({ error: 'RUNWAYML_API_SECRET appears to be too short. Please check your API key.' }, { status: 500 })
    }

    console.log('🎬 Uploading file to Runway ML - type:', file.type, 'size:', file.size)

    // Step 1: Create upload request to get upload URL
    const uploadRequestResponse = await fetch('https://api.dev.runwayml.com/v1/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        filename: file.name || (file.type.startsWith('video/') ? 'video.mp4' : 'image.jpg'),
        type: 'ephemeral'
      })
    })

    if (!uploadRequestResponse.ok) {
      const errorText = await uploadRequestResponse.text()
      console.error('🎬 Failed to create Runway upload request:', errorText)
      return NextResponse.json({ 
        error: `Failed to create upload request: ${uploadRequestResponse.status} ${errorText}` 
      }, { status: uploadRequestResponse.status })
    }

    const uploadRequestData = await uploadRequestResponse.json()
    const { uploadUrl, fields, runwayUri } = uploadRequestData
    
    console.log('🎬 Got Runway upload URL, uploading file...')
    
    // Step 2: Upload file to the provided URL
    const uploadFormData = new FormData()
    
    // Add all fields from the response
    if (fields) {
      Object.entries(fields).forEach(([key, value]) => {
        uploadFormData.append(key, value as string)
      })
    }
    
    // Add the file (must be last)
    uploadFormData.append('file', file)

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: uploadFormData
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('🎬 Failed to upload file to Runway:', errorText)
      return NextResponse.json({ 
        error: `Failed to upload file: ${uploadResponse.status} ${errorText}` 
      }, { status: uploadResponse.status })
    }

    console.log('🎬 File uploaded successfully, runwayUri:', runwayUri)
    
    // Determine file type
    const fileType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image'

    return NextResponse.json({
      success: true,
      runwayUri,
      fileType
    })

  } catch (error: any) {
    console.error('🎬 Error uploading file to Runway:', error)
    
    // Handle 413 Request Entity Too Large errors
    if (error.message?.includes('413') || error.message?.includes('Request Entity Too Large') || error.status === 413) {
      return NextResponse.json({ 
        error: 'File too large. The uploaded file exceeds the maximum size limit. Please compress your video/image file to under 50MB (videos) or 10MB (images) and try again.' 
      }, { status: 413 })
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}







