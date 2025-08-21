import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, sceneId, movieId, fileName } = await request.json()
    
    if (!imageUrl || !sceneId || !movieId) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl, sceneId, movieId' },
        { status: 400 }
      )
    }

    console.log('Downloading and storing image:', { imageUrl, sceneId, movieId, fileName })

    // Download the image from the external URL
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`)
    }

    const imageBlob = await imageResponse.blob()
    const imageBuffer = await imageBlob.arrayBuffer()

    // Generate a safe filename
    const safeFileName = fileName || `ai_generated_${Date.now()}.png`
    const filePath = `${movieId}/${sceneId}/${Date.now()}_${safeFileName}`

    console.log('Uploading to Supabase storage:', filePath)

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('cinema_files')
      .upload(filePath, imageBuffer, {
        contentType: imageBlob.type || 'image/png',
        cacheControl: '3600',
        upsert: false,
        metadata: {
          originalName: safeFileName,
          source: 'ai_generated',
          sceneId,
          movieId,
          originalUrl: imageUrl
        }
      })

    if (error) {
      console.error('Storage upload error:', error)
      throw new Error(`Failed to upload to storage: ${error.message}`)
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('cinema_files')
      .getPublicUrl(filePath)

    console.log('Image stored successfully:', urlData.publicUrl)

    return NextResponse.json({ 
      success: true, 
      localUrl: urlData.publicUrl,
      filePath
    })

  } catch (error) {
    console.error('Error downloading and storing image:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}
