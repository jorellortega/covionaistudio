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

    console.log('Downloading image from:', imageUrl)
    console.log('File name:', fileName)
    console.log('User ID:', userId)

    // Download the image from OpenAI (server-side, no CORS issues)
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error('Failed to download image:', response.status, response.statusText)
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
    }

    const imageBuffer = await response.arrayBuffer()
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' })
    
    console.log('Image downloaded, size:', imageBlob.size)

    // Create a unique filename
    const timestamp = Date.now()
    const fileExtension = imageUrl.split('.').pop()?.split('?')[0] || 'png'
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
        contentType: 'image/png',
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
