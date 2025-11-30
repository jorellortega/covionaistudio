import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, fileName, userId } = await request.json()
    
    if (!imageUrl || !fileName || !userId) {
      console.error('Missing required fields:', { imageUrl: !!imageUrl, fileName: !!fileName, userId: !!userId })
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl, fileName, userId' },
        { status: 400 }
      )
    }

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

    console.log('Downloading image from:', imageUrl.substring(0, 100))
    console.log('File name:', fileName)
    console.log('User ID:', userId)

    let imageBlob: Blob
    let mimeType = 'image/png'
    let fileExtension = 'png'

    // Check if this is a data URL (base64)
    if (imageUrl.startsWith('data:image/')) {
      // Handle base64 data URL
      console.log('Processing base64 data URL')
      
      // Extract MIME type from data URL (e.g., "data:image/png;base64," -> "image/png")
      const mimeMatch = imageUrl.match(/data:image\/([^;]+)/)
      if (mimeMatch && mimeMatch[1]) {
        mimeType = `image/${mimeMatch[1]}`
        // Map common MIME types to file extensions
        const mimeToExt: Record<string, string> = {
          'png': 'png',
          'jpeg': 'jpg',
          'jpg': 'jpg',
          'webp': 'webp',
          'gif': 'gif'
        }
        fileExtension = mimeToExt[mimeMatch[1]] || 'png'
      }
      
      // Extract base64 data (everything after the comma)
      const base64Data = imageUrl.split(',')[1]
      if (!base64Data) {
        throw new Error('Invalid base64 data URL: missing data')
      }
      
      try {
        const imageBuffer = Buffer.from(base64Data, 'base64')
        imageBlob = new Blob([imageBuffer], { type: mimeType })
        console.log('Base64 image processed, size:', imageBlob.size, 'type:', mimeType)
      } catch (error) {
        console.error('Error decoding base64:', error)
        throw new Error(`Failed to decode base64 image: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      // Download the image from URL (server-side, no CORS issues)
      console.log('Downloading image from URL')
      const response = await fetch(imageUrl)
      if (!response.ok) {
        console.error('Failed to download image:', response.status, response.statusText)
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
      }

      // Try to get content type from response headers
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.startsWith('image/')) {
        mimeType = contentType
        const mimePart = contentType.split('/')[1]?.split(';')[0]
        if (mimePart) {
          const mimeToExt: Record<string, string> = {
            'png': 'png',
            'jpeg': 'jpg',
            'jpg': 'jpg',
            'webp': 'webp',
            'gif': 'gif'
          }
          fileExtension = mimeToExt[mimePart] || 'png'
        }
      } else {
        // Fallback: try to extract from URL
        const urlExt = imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
        if (urlExt && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(urlExt)) {
          fileExtension = urlExt
        }
      }

      const imageBuffer = await response.arrayBuffer()
      imageBlob = new Blob([imageBuffer], { type: mimeType })
      console.log('Image downloaded from URL, size:', imageBlob.size, 'type:', mimeType)
    }
    
    console.log('Image processed, size:', imageBlob.size, 'extension:', fileExtension)

    // Create a unique filename
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}-${fileName}.${fileExtension}`

    // Upload to Supabase storage
    const filePath = `${userId}/images/${uniqueFileName}`
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

    const { data, error } = await supabase.storage
      .from('cinema_files')
      .upload(filePath, imageBlob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
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

    console.log('Image uploaded successfully to Supabase:', urlData.publicUrl)

    return NextResponse.json({
      success: true,
      supabaseUrl: urlData.publicUrl,
      filePath: filePath
    })

  } catch (error) {
    console.error('Error in download-and-store-image API:', error)
    
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
