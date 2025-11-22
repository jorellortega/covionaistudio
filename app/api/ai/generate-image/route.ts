import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, OpenArtService } from '@/lib/ai-services'
import { sanitizeFilename } from '@/lib/utils'

// Function to download and store image in bucket
async function downloadAndStoreImage(imageUrl: string, fileName: string, userId: string): Promise<string> {
  try {
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

    console.log('Downloading image from:', imageUrl)
    console.log('File name:', fileName)
    console.log('User ID:', userId)

    // Download the image from the AI service (server-side, no CORS issues)
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

    return urlData.publicUrl

  } catch (error) {
    console.error('Error in downloadAndStoreImage:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('AI image generation request received')
    
    // Handle both JSON and FormData requests
    let body: any
    let file: File | null = null
    
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (file upload)
      const formData = await request.formData()
      body = {
        prompt: formData.get('prompt'),
        model: formData.get('model'),
        service: formData.get('service'),
        width: parseInt(formData.get('width') as string),
        height: parseInt(formData.get('height') as string),
        apiKey: formData.get('apiKey'),
        userId: formData.get('userId')
      }
      file = formData.get('file') as File
      console.log('FormData request received with file:', file?.name)
    } else {
      // Handle JSON request
      body = await request.json()
      console.log('JSON request received')
    }
    
    console.log('Request body:', { ...body, apiKey: body.apiKey ? `${body.apiKey.substring(0, 10)}...` : 'undefined' })
    
    let { prompt, service, apiKey, userId, model, width, height, autoSaveToBucket = true } = body

    // Set default width and height if not provided
    if (!width) width = 1280
    if (!height) height = 720

    if (!prompt || !service || !apiKey) {
      console.error('Missing required fields:', { prompt: !!prompt, service: !!service, apiKey: !!apiKey })
      return NextResponse.json(
        { error: 'Missing required fields: prompt, service, apiKey' },
        { status: 400 }
      )
    }

    // If autoSaveToBucket is true, userId is required
    if (autoSaveToBucket && !userId) {
      console.error('Missing userId for bucket storage')
      return NextResponse.json(
        { error: 'Missing userId for bucket storage' },
        { status: 400 }
      )
    }

    // If apiKey is 'configured', fetch the actual API key from user settings
    if (apiKey === 'configured') {
      console.log('Fetching configured API key for service:', service)
      const { createServerClient } = await import('@supabase/ssr')
      const { cookies } = await import('next/headers')
      
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
              } catch {}
            },
          },
        }
      )

      // Fetch API key from users table based on service
      let keyColumn = ''
      switch (service.toLowerCase()) {
        case 'dalle':
          keyColumn = 'openai_api_key'
          break
        case 'openart':
          keyColumn = 'openart_api_key'
          break
        case 'leonardo':
          keyColumn = 'leonardo_api_key'
          break
        case 'runway':
          keyColumn = 'runway_api_key'
          break
        case 'stable-diffusion':
          keyColumn = 'openart_api_key' // Using OpenArt as SD alternative
          break
        default:
          keyColumn = `${service.toLowerCase()}_api_key`
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(keyColumn)
        .eq('id', userId)
        .single()

      if (userError || !userData || !userData[keyColumn]) {
        console.error('Failed to fetch API key:', userError)
        const serviceName = service.toLowerCase() === 'dalle' ? 'OpenAI' : 
                          service.toLowerCase() === 'openart' ? 'OpenArt' :
                          service.toLowerCase() === 'leonardo' ? 'Leonardo' :
                          service.toLowerCase() === 'runway' ? 'Runway ML' : service
        return NextResponse.json(
          { error: `No API key configured for ${serviceName}. Please add your API key in Settings → AI Settings.` },
          { status: 400 }
        )
      }

      apiKey = userData[keyColumn]
      console.log('Successfully fetched configured API key for', keyColumn)
    }

    let imageUrl = ""

    switch (service) {
      case 'dalle':
        console.log('Generating DALL-E image with prompt:', prompt)
        console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined')
        
        // Use the OpenAIService from ai-services.ts
        const dalleResponse = await OpenAIService.generateImage({
          prompt: prompt, // Send only the user's exact prompt
          style: 'cinematic',
          model: 'dall-e-3',
          apiKey
        })
        
        console.log('DALL-E response:', dalleResponse)
        
        if (!dalleResponse.success) {
          // The error message from OpenAIService is already user-friendly for content policy violations
          throw new Error(dalleResponse.error || 'Image generation failed')
        }
        
        if (!dalleResponse.data || !dalleResponse.data.data || !dalleResponse.data.data[0] || !dalleResponse.data.data[0].url) {
          console.error('Invalid DALL-E response structure:', dalleResponse.data)
          throw new Error('Invalid response structure from DALL-E API')
        }
        
        imageUrl = dalleResponse.data.data[0].url
        console.log('Generated image URL:', imageUrl)
        break

      case 'openart':
        console.log('Generating OpenArt image with prompt:', prompt)
        console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined')
        
        const openartResponse = await OpenArtService.generateImage({
          prompt: prompt, // Send only the user's exact prompt
          style: 'cinematic',
          model: 'sdxl',
          apiKey
        })
        
        console.log('OpenArt response:', openartResponse)
        
        if (!openartResponse.success) {
          throw new Error(openartResponse.error || 'OpenArt API failed')
        }
        
        if (!openartResponse.data || !openartResponse.data.images || !openartResponse.data.images[0] || !openartResponse.data.images[0].url) {
          console.error('Invalid OpenArt response structure:', openartResponse.data)
          throw new Error('Invalid response structure from OpenArt API')
        }
        
        imageUrl = openartResponse.data.images[0].url
        console.log('Generated image URL:', imageUrl)
        break

      case 'stable-diffusion':
        // For now, using OpenArt as Stable Diffusion alternative
        const sdResponse = await OpenArtService.generateImage({
          prompt: prompt, // Send only the user's exact prompt
          style: 'cinematic',
          model: 'sdxl',
          apiKey
        })
        
        if (!sdResponse.success) {
          throw new Error(sdResponse.error || 'Stable Diffusion API failed')
        }
        
        imageUrl = sdResponse.data.images[0].url
        break

      case 'leonardo':
        // Leonardo AI integration (requires Leonardo API key)
        const leonardoResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            prompt: prompt, // Send only the user's exact prompt
            modelId: "6bef9f1b-29cb-40c7-b9df-32b51c1ed67c", // Leonardo Creative
            width: 1024,
            height: 1024,
            num_images: 1,
            promptMagic: true,
            highContrast: true,
            public: false,
            tiling: false,
            negative_prompt: "blurry, low quality, distorted, amateur"
          })
        })
        
        if (!leonardoResponse.ok) {
          const errorText = await leonardoResponse.text()
          console.error('Leonardo AI API error:', leonardoResponse.status, errorText)
          throw new Error(`Leonardo AI API failed: ${leonardoResponse.status} - ${errorText}`)
        }
        
        const leonardoData = await leonardoResponse.json()
        // Leonardo returns a generation ID, we need to poll for the result
        const generationId = leonardoData.sdGenerationJob.generationId
        
        // For now, return a placeholder - in production you'd poll for completion
        imageUrl = `https://generation.leonardo.ai/${generationId}/0.png`
        break

      case 'runway':
        // Runway ML is primarily for video, but can generate images
        // Different request structure based on model type
        
        // Set default model if not provided
        // Valid Runway ML image models: gen4_image, gen4_image_turbo, gemini_2.5_flash, gemini_3_pro
        if (!model || Array.isArray(model)) {
          model = 'gen4_image' // Default to gen4_image for text-to-image
        }
        
        // Ensure model is a string, not an array
        const runwayModel = Array.isArray(model) ? model[0] : model
        
        // Validate model is one of the supported values
        const validModels = ['gen4_image', 'gen4_image_turbo', 'gemini_2.5_flash', 'gemini_3_pro']
        if (!validModels.includes(runwayModel)) {
          console.warn(`Invalid Runway ML model "${runwayModel}", defaulting to gen4_image`)
          model = 'gen4_image'
        } else {
          model = runwayModel
        }
        
        console.log('🎬 Using Runway ML model:', model)
        
        let requestBody: any
        
        if (model === 'gen4_image_turbo') {
          if (!file) {
            throw new Error('Gen-4 Image Turbo requires a reference image file')
          }
          
          // Convert file to base64 for Runway ML API
          const fileBuffer = await file.arrayBuffer()
          const base64File = Buffer.from(fileBuffer).toString('base64')
          const dataUrl = `data:${file.type};base64,${base64File}`
          
          requestBody = {
            model: model,
            promptText: prompt,
            ratio: `${width}:${height}`,
            referenceImages: [{
              uri: dataUrl
            }]
          }
        } else {
          requestBody = {
            model: model,
            promptText: prompt,
            ratio: `${width}:${height}`
          }
        }
        
        const runwayResponse = await fetch('https://api.dev.runwayml.com/v1/text_to_image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-Runway-Version': '2024-11-06',
          },
          body: JSON.stringify(requestBody)
        })
        
        if (!runwayResponse.ok) {
          const errorText = await runwayResponse.text()
          console.error('Runway ML API error:', runwayResponse.status, errorText)
          throw new Error(`Runway ML API failed: ${runwayResponse.status} - ${errorText}`)
        }
        
        const runwayData = await runwayResponse.json()
        console.log('Runway ML response data:', JSON.stringify(runwayData, null, 2))
        
        // Runway ML returns a job ID, we need to poll for completion
        if (runwayData.id) {
          console.log('Runway ML job started with ID:', runwayData.id)
          
          // Try different possible endpoints for job status
          const possibleEndpoints = [
            `https://api.dev.runwayml.com/v1/jobs/${runwayData.id}`,
            `https://api.dev.runwayml.com/v1/tasks/${runwayData.id}`,
            `https://api.dev.runwayml.com/v1/text_to_image/${runwayData.id}`,
            `https://api.dev.runwayml.com/v1/inference/${runwayData.id}`
          ]
          
          // Poll for job completion
          let attempts = 0
          const maxAttempts = 30 // 30 attempts = 5 minutes max
          let jobCompleted = false
          
          while (!jobCompleted && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
            attempts++
            
            console.log(`Polling Runway ML job ${runwayData.id}, attempt ${attempts}/${maxAttempts}`)
            
            // Try each possible endpoint
            for (const endpoint of possibleEndpoints) {
              try {
                console.log(`Trying endpoint: ${endpoint}`)
                const statusResponse = await fetch(endpoint, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-Runway-Version': '2024-11-06',
                  },
                })
                
                if (statusResponse.ok) {
                  const statusData = await statusResponse.json()
                  console.log('Job status:', JSON.stringify(statusData, null, 2))
                  
                  if (statusData.status === 'SUCCEEDED' && statusData.output) {
                    // Extract image URL from completed job
                    if (Array.isArray(statusData.output) && statusData.output[0]) {
                      imageUrl = statusData.output[0]
                      jobCompleted = true
                      break
                    } else if (statusData.output.images && statusData.output.images[0]) {
                      imageUrl = statusData.output.images[0]
                      jobCompleted = true
                      break
                    } else if (statusData.output.image_url) {
                      imageUrl = statusData.output.image_url
                      jobCompleted = true
                      break
                    } else if (statusData.output.url) {
                      imageUrl = statusData.output.url
                      jobCompleted = true
                      break
                    }
                  } else if (statusData.status === 'FAILED') {
                    throw new Error(`Runway ML job failed: ${statusData.error || 'Unknown error'}`)
                  }
                  // If status is 'processing' or 'pending', continue polling
                } else {
                  console.log(`Endpoint ${endpoint} returned ${statusResponse.status}`)
                }
              } catch (error) {
                console.error(`Error polling endpoint ${endpoint}:`, error)
              }
            }
            
            if (jobCompleted) break
          }
          
          if (!jobCompleted) {
            throw new Error('Runway ML job timed out after 5 minutes')
          }
        } else {
          console.error('Unexpected Runway ML response structure:', runwayData)
          throw new Error('Unexpected response structure from Runway ML API')
        }
        break

      case 'midjourney':
        // Midjourney requires Discord bot integration
        // For now, return an error suggesting setup
        throw new Error('Midjourney integration requires Discord bot setup. Please use DALL-E or other services for now.')
        
      default:
        throw new Error(`Unsupported service: ${service}`)
    }

    console.log('Successfully generated image:', imageUrl)
    
    // If autoSaveToBucket is enabled, save the image to the bucket
    let finalImageUrl = imageUrl
    let bucketUrl = null
    
    if (autoSaveToBucket && userId) {
      try {
        const sanitizedPrompt = sanitizeFilename(prompt.substring(0, 30))
        const fileName = `${Date.now()}-${service}-${sanitizedPrompt}.png`
        bucketUrl = await downloadAndStoreImage(imageUrl, fileName, userId)
        finalImageUrl = bucketUrl
        console.log('✅ Image automatically saved to bucket:', bucketUrl)
      } catch (error) {
        console.error('❌ Failed to save image to bucket:', error)
        // Continue with original URL if bucket save fails
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      imageUrl: finalImageUrl,
      originalUrl: imageUrl, // Keep original URL for reference
      bucketUrl: bucketUrl, // Include bucket URL if available
      service: service.toUpperCase(),
      savedToBucket: !!bucketUrl
    })

  } catch (error) {
    console.error('AI image generation error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error occurred'
    if (error instanceof Error) {
      // Check for content policy violations first
      if (error.message.includes('copyrighted material') || 
          error.message.includes('explicit content') ||
          error.message.includes('content policy') ||
          error.message.includes('violates our usage policy')) {
        errorMessage = error.message // Use the user-friendly message we set
      } else if (error.message.includes('OpenAI API error')) {
        // Check if it's a content policy issue
        if (error.message.toLowerCase().includes('content') || 
            error.message.toLowerCase().includes('policy') ||
            error.message.toLowerCase().includes('safety')) {
          errorMessage = 'This content may contain copyrighted material or explicit content that cannot be generated. Please try a different description or modify your treatment content.'
        } else {
          errorMessage = 'Image generation failed. Please check your API key and try again.'
        }
      } else if (error.message.includes('OpenArt API error')) {
        errorMessage = 'Image generation failed. Please check your API key and try again.'
      } else if (error.message.includes('Invalid response structure')) {
        errorMessage = 'Image generation service returned an invalid response. Please try again.'
      } else {
        errorMessage = error.message
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
