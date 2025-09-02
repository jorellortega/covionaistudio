import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, OpenArtService } from '@/lib/ai-services'
import { sanitizeFilename } from '@/lib/utils'

// Function to download and store image in bucket
async function downloadAndStoreImage(imageUrl: string, fileName: string, userId: string): Promise<string> {
  try {
    const response = await fetch('/api/ai/download-and-store-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl,
        fileName,
        userId
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Failed to save image: ${errorData.error || response.statusText}`)
    }

    const result = await response.json()
    if (result.success && result.supabaseUrl) {
      return result.supabaseUrl
    } else {
      throw new Error('Failed to get bucket URL')
    }
  } catch (error) {
    console.error('Error saving image to bucket:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 DEBUG - Timeline scene image generation request received')
    
    const body = await request.json()
    const { prompt, service, apiKey, userId, autoSaveToBucket = true } = body

    console.log('🎬 DEBUG - Request body received:', {
      hasPrompt: !!prompt,
      promptLength: prompt?.length || 0,
      promptPreview: prompt?.substring(0, 200) + '...',
      fullPrompt: prompt,
      service: service,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      hasUserId: !!userId,
      autoSaveToBucket
    })

    if (!prompt || !service || !apiKey) {
      console.error('🎬 DEBUG - Missing required fields:', { 
        prompt: !!prompt, 
        service: !!service, 
        apiKey: !!apiKey 
      })
      return NextResponse.json(
        { error: 'Missing required fields: prompt, service, apiKey' },
        { status: 400 }
      )
    }

    // If autoSaveToBucket is true, userId is required
    if (autoSaveToBucket && !userId) {
      console.error('🎬 DEBUG - Missing userId for bucket storage')
      return NextResponse.json(
        { error: 'Missing userId for bucket storage' },
        { status: 400 }
      )
    }

    console.log(`🎬 DEBUG - Service: ${service}, API key exists: ${!!apiKey}, Key length: ${apiKey ? apiKey.length : 0}`)

    let imageUrl = ""

    switch (service) {
      case 'DALL-E 3':
      case 'dalle':
        console.log('🎬 DEBUG - Generating DALL-E image with prompt:', {
          promptLength: prompt.length,
          promptPreview: prompt.substring(0, 200) + '...',
          fullPrompt: prompt
        })
        
        const dalleResponse = await OpenAIService.generateImage({
          prompt: prompt,
          style: 'cinematic',
          model: 'dall-e-3',
          apiKey
        })
        
        console.log('🎬 DEBUG - DALL-E response:', dalleResponse)
        
        if (!dalleResponse.success) {
          throw new Error(dalleResponse.error || 'DALL-E API failed')
        }
        
        if (!dalleResponse.data || !dalleResponse.data.data || !dalleResponse.data.data[0] || !dalleResponse.data.data[0].url) {
          throw new Error('Invalid response structure from DALL-E API')
        }
        
        imageUrl = dalleResponse.data.data[0].url
        console.log('🎬 DEBUG - DALL-E image URL generated:', imageUrl)
        break

      case 'OpenArt':
      case 'openart':
        console.log('🎬 DEBUG - Generating OpenArt image with prompt:', {
          promptLength: prompt.length,
          promptPreview: prompt.substring(0, 200) + '...',
          fullPrompt: prompt
        })
        
        const openartResponse = await OpenArtService.generateImage({
          prompt: prompt,
          style: 'cinematic',
          model: 'sdxl',
          apiKey
        })
        
        console.log('🎬 DEBUG - OpenArt response:', openartResponse)
        
        if (!openartResponse.success) {
          throw new Error(openartResponse.error || 'OpenArt API failed')
        }
        
        if (!openartResponse.data || !openartResponse.data.images || !openartResponse.data.images[0] || !openartResponse.data.images[0].url) {
          throw new Error('Invalid response structure from OpenArt API')
        }
        
        imageUrl = openartResponse.data.images[0].url
        console.log('🎬 DEBUG - OpenArt image URL generated:', imageUrl)
        break

      case 'Leonardo AI':
      case 'leonardo':
        console.log('🎬 DEBUG - Generating Leonardo AI image with prompt:', {
          promptLength: prompt.length,
          promptPreview: prompt.substring(0, 200) + '...',
          fullPrompt: prompt
        })
        
        const leonardoResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            prompt: prompt,
            modelId: "ac614f96-1082-45bf-be9d-757f2d31c174", // Leonardo Creative
            width: 1024,
            height: 1024,
            num_images: 1,
            promptMagic: true,
            highContrast: true,
            negative_prompt: "blurry, low quality, distorted, deformed"
          })
        })

        if (!leonardoResponse.ok) {
          const errorData = await leonardoResponse.json()
          throw new Error(`Leonardo API failed: ${errorData.error || leonardoResponse.statusText}`)
        }

        const leonardoData = await leonardoResponse.json()
        console.log('🎬 DEBUG - Leonardo response:', leonardoData)
        
        if (!leonardoData.generations || !leonardoData.generations[0] || !leonardoData.generations[0].generated_images || !leonardoData.generations[0].generated_images[0]) {
          throw new Error('Invalid response structure from Leonardo API')
        }

        imageUrl = leonardoData.generations[0].generated_images[0].url
        console.log('🎬 DEBUG - Leonardo image URL generated:', imageUrl)
        break

      default:
        console.log('🎬 DEBUG - Unsupported service:', service)
        return NextResponse.json(
          { error: 'Unsupported AI service' },
          { status: 400 }
        )
    }

    if (!imageUrl) {
      throw new Error('Failed to generate image URL')
    }

    console.log('🎬 DEBUG - Final image URL:', imageUrl)
    
    // If autoSaveToBucket is enabled, save the image to the bucket
    let finalImageUrl = imageUrl
    let bucketUrl = null
    
    if (autoSaveToBucket && userId) {
      try {
        const sanitizedPrompt = sanitizeFilename(prompt.substring(0, 30))
        const fileName = `${Date.now()}-${service}-${sanitizedPrompt}.png`
        bucketUrl = await downloadAndStoreImage(imageUrl, fileName, userId)
        finalImageUrl = bucketUrl
        console.log('🎬 DEBUG - ✅ Image automatically saved to bucket:', bucketUrl)
      } catch (error) {
        console.error('🎬 DEBUG - ❌ Failed to save image to bucket:', error)
        // Continue with original URL if bucket save fails
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: finalImageUrl,
      originalUrl: imageUrl, // Keep original URL for reference
      bucketUrl: bucketUrl, // Include bucket URL if available
      service: service,
      savedToBucket: !!bucketUrl
    })

  } catch (error) {
    console.error('🎬 DEBUG - Scene image generation failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
