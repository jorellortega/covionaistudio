import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, fileName, userId, generationId } = await request.json()
    
    if (!videoUrl || !fileName || !userId) {
      console.error('Missing required fields:', { videoUrl: !!videoUrl, fileName: !!fileName, userId: !!userId })
      return NextResponse.json(
        { error: 'Missing required fields: videoUrl, fileName, userId' },
        { status: 400 }
      )
    }
    
    console.log('Generation ID (optional):', generationId)

    // Create server-side Supabase client with service role for bucket operations
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {
            // No-op for service role client
          },
        },
      }
    )

    console.log('Downloading video from:', videoUrl.substring(0, 100))
    console.log('File name:', fileName)
    console.log('User ID:', userId)

    let videoBlob: Blob
    let mimeType = 'video/mp4'
    let fileExtension = 'mp4'

    // Download the video from URL (server-side, no CORS issues)
    console.log('Downloading video from URL')
    const response = await fetch(videoUrl)
    if (!response.ok) {
      console.error('Failed to download video:', response.status, response.statusText)
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`)
    }

    // Try to get content type from response headers
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.startsWith('video/')) {
      mimeType = contentType
      const mimePart = contentType.split('/')[1]?.split(';')[0]
      if (mimePart) {
        const mimeToExt: Record<string, string> = {
          'mp4': 'mp4',
          'webm': 'webm',
          'quicktime': 'mov',
          'x-msvideo': 'avi'
        }
        fileExtension = mimeToExt[mimePart] || 'mp4'
      }
    } else {
      // Fallback: try to extract from URL
      const urlExt = videoUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
      if (urlExt && ['mp4', 'webm', 'mov', 'avi'].includes(urlExt)) {
        fileExtension = urlExt
        mimeType = `video/${urlExt === 'mov' ? 'quicktime' : urlExt}`
      }
    }

    const videoBuffer = await response.arrayBuffer()
    videoBlob = new Blob([videoBuffer], { type: mimeType })
    console.log('Video downloaded from URL, size:', videoBlob.size, 'type:', mimeType)
    
    console.log('Video processed, size:', videoBlob.size, 'extension:', fileExtension)

    // Create a unique filename
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}-${fileName}.${fileExtension}`

    // Upload to Supabase storage
    const filePath = `${userId}/videos/${uniqueFileName}`
    console.log('Uploading to Supabase path:', filePath)

    // Check if bucket exists
    const { data: bucketData, error: bucketError } = await supabase.storage
      .from('cinema_files')
      .list('', { limit: 1 })

    if (bucketError) {
      console.error('Bucket access error:', bucketError)
      throw new Error(`Bucket access error: ${bucketError.message}`)
    }

    console.log('Bucket access successful, proceeding with upload...')

    // Prepare metadata including generation ID if provided
    const metadata: Record<string, string> = {}
    if (generationId) {
      metadata.leonardoGenerationId = generationId
      console.log('Storing generation ID in file metadata:', generationId)
    }
    
    const { data, error } = await supabase.storage
      .from('cinema_files')
      .upload(filePath, videoBlob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
        metadata: metadata
      })

    if (error) {
      console.error('Supabase upload error:', error)
      console.error('Error details:', {
        message: error.message,
        name: error.name
      })
      throw new Error(`Failed to upload to Supabase: ${error.message}`)
    }

    console.log('Upload successful, data:', data)

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('cinema_files')
      .getPublicUrl(filePath)

    console.log('Video uploaded successfully to Supabase:', urlData.publicUrl)

    return NextResponse.json({
      success: true,
      supabaseUrl: urlData.publicUrl,
      filePath: filePath,
      generationId: generationId || null // Return the generation ID if it was provided
    })

  } catch (error) {
    console.error('Error in download-and-store-video API:', error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}









