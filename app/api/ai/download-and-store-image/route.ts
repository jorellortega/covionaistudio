import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

// Initialize Supabase client
const supabase = getSupabaseClient()

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, fileName, userId } = await request.json()
    
    if (!imageUrl || !fileName || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl, fileName, userId' },
        { status: 400 }
      )
    }

    console.log('Downloading image from:', imageUrl)
    console.log('File name:', fileName)
    console.log('User ID:', userId)

    // Download the image from OpenAI (server-side, no CORS issues)
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
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

    const { data, error } = await supabase.storage
      .from('cinema_files')
      .upload(filePath, imageBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Supabase upload error:', error)
      throw new Error(`Failed to upload to Supabase: ${error.message}`)
    }

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
