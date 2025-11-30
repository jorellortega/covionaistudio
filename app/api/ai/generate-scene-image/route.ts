import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, OpenArtService } from '@/lib/ai-services'
import { sanitizeFilename } from '@/lib/utils'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Function to download and store image in bucket
async function downloadAndStoreImage(imageUrl: string, fileName: string, userId: string): Promise<string> {
  try {
    const { createServerClient } = await import('@supabase/ssr')
    
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

    console.log('🎬 DEBUG - Downloading image from:', imageUrl)
    console.log('🎬 DEBUG - File name:', fileName)
    console.log('🎬 DEBUG - User ID:', userId)

    // Download the image from the AI service (server-side, no CORS issues)
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error('🎬 DEBUG - Failed to download image:', response.status, response.statusText)
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
    }

    const imageBuffer = await response.arrayBuffer()
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' })
    
    console.log('🎬 DEBUG - Image downloaded, size:', imageBlob.size)

    // Create a unique filename
    const timestamp = Date.now()
    const fileExtension = imageUrl.split('.').pop()?.split('?')[0] || 'png'
    const uniqueFileName = `${timestamp}-${fileName}.${fileExtension}`

    // Upload to Supabase storage
    const filePath = `${userId}/images/${uniqueFileName}`
    console.log('🎬 DEBUG - Uploading to Supabase path:', filePath)

    const { data, error } = await supabase.storage
      .from('cinema_files')
      .upload(filePath, imageBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('🎬 DEBUG - Supabase upload error:', error)
      throw new Error(`Failed to upload to Supabase: ${error.message}`)
    }

    console.log('🎬 DEBUG - Upload successful, data:', data)

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('cinema_files')
      .getPublicUrl(filePath)

    console.log('🎬 DEBUG - Image uploaded successfully to Supabase:', urlData.publicUrl)

    return urlData.publicUrl

  } catch (error) {
    console.error('🎬 DEBUG - Error in downloadAndStoreImage:', error)
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

    // Get actual API key from database if apiKey is 'configured' or not provided
    let actualApiKey = apiKey
    if (apiKey === 'configured' || apiKey === 'use_env_vars' || !apiKey) {
      // FIRST: Check system-wide API keys from system_ai_config (set by CEO)
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              }
            }
          )

          // Get system-wide API keys using RPC function (bypasses RLS)
          const { data: systemConfig, error: systemError } = await supabaseAdmin.rpc('get_system_ai_config')
          
          if (!systemError && systemConfig && Array.isArray(systemConfig)) {
            const configMap: Record<string, string> = {}
            systemConfig.forEach((item: any) => {
              configMap[item.setting_key] = item.setting_value
            })

            // Check for system-wide keys based on service
            if ((service === 'DALL-E 3' || service === 'dalle') && configMap['openai_api_key']?.trim()) {
              actualApiKey = configMap['openai_api_key'].trim()
              console.log('✅ Using system-wide OpenAI API key from system_ai_config (CEO-set)')
            } else if (service === 'OpenArt' || service === 'openart') {
              if (configMap['openart_api_key']?.trim()) {
                actualApiKey = configMap['openart_api_key'].trim()
                console.log('✅ Using system-wide OpenArt API key from system_ai_config (CEO-set)')
              }
            } else if (service === 'Kling' || service === 'kling') {
              if (configMap['kling_api_key']?.trim()) {
                actualApiKey = configMap['kling_api_key'].trim()
                console.log('✅ Using system-wide Kling API key from system_ai_config (CEO-set)')
              }
            } else if (service === 'Runway ML' || service === 'runway') {
              if (configMap['runway_api_key']?.trim()) {
                actualApiKey = configMap['runway_api_key'].trim()
                console.log('✅ Using system-wide Runway ML API key from system_ai_config (CEO-set)')
              }
            } else if (service === 'ElevenLabs' || service === 'elevenlabs') {
              if (configMap['elevenlabs_api_key']?.trim()) {
                actualApiKey = configMap['elevenlabs_api_key'].trim()
                console.log('✅ Using system-wide ElevenLabs API key from system_ai_config (CEO-set)')
              }
            } else if (service === 'Suno AI' || service === 'suno') {
              if (configMap['suno_api_key']?.trim()) {
                actualApiKey = configMap['suno_api_key'].trim()
                console.log('✅ Using system-wide Suno AI API key from system_ai_config (CEO-set)')
              }
            }
          } else if (systemError) {
            console.error('❌ Error fetching system-wide API keys:', systemError)
          }
        }
      } catch (systemKeyError) {
        console.error('❌ Error checking system-wide API keys:', systemKeyError)
      }

      // Fallback to user-specific keys if no system-wide key found
      if (!actualApiKey || actualApiKey === 'configured' || actualApiKey === 'use_env_vars') {
      if (!userId) {
        console.error('🎬 DEBUG - No userId provided for database API key lookup')
        return NextResponse.json(
          { error: 'Missing userId for API key lookup' },
          { status: 400 }
        )
      }

      try {
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

        const { data, error } = await supabase
          .from('users')
          .select('openai_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
          .eq('id', userId)
            .maybeSingle()

        if (error) {
          console.error('🎬 DEBUG - Error fetching API keys from database:', error)
          return NextResponse.json(
            { error: `Failed to fetch API keys from database: ${error.message}` },
            { status: 500 }
          )
        }

        if (service === 'DALL-E 3' || service === 'dalle') {
            actualApiKey = data?.openai_api_key || actualApiKey
          console.log('🎬 DEBUG - Retrieved OpenAI API key:', {
            hasKey: !!actualApiKey,
            keyLength: actualApiKey?.length || 0,
            keyPrefix: actualApiKey?.substring(0, 10) + '...' || 'None'
          })
        } else if (service === 'OpenArt' || service === 'openart') {
            actualApiKey = data?.openart_api_key || actualApiKey
        } else if (service === 'Kling' || service === 'kling') {
            actualApiKey = data?.kling_api_key || actualApiKey
        } else if (service === 'Runway ML' || service === 'runway') {
            actualApiKey = data?.runway_api_key || actualApiKey
        } else if (service === 'ElevenLabs' || service === 'elevenlabs') {
            actualApiKey = data?.elevenlabs_api_key || actualApiKey
        } else if (service === 'Suno AI' || service === 'suno') {
            actualApiKey = data?.suno_api_key || actualApiKey
        }

      } catch (error) {
        console.error('🎬 DEBUG - Database error:', error)
        return NextResponse.json(
          { error: 'Database error while fetching API keys' },
          { status: 500 }
        )
        }
      }
    }

    if (!actualApiKey) {
      console.error('🎬 DEBUG - No API key available for service:', service)
      return NextResponse.json(
        { error: `API key not configured for ${service}. Please set up your API key in the AI settings.` },
        { status: 400 }
      )
    }

    console.log(`🎬 DEBUG - Service: ${service}, API key exists: ${!!actualApiKey}, Key length: ${actualApiKey ? actualApiKey.length : 0}`)

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
          apiKey: actualApiKey
        })
        
        console.log('🎬 DEBUG - DALL-E response:', dalleResponse)
        
        if (!dalleResponse.success) {
          console.error('🎬 DEBUG - DALL-E API failed with error:', dalleResponse.error)
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
          apiKey: actualApiKey
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
            'Authorization': `Bearer ${actualApiKey}`,
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
