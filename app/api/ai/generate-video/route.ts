import { NextRequest, NextResponse } from 'next/server'
import { getRunwayEnvHeaders, getImageToVideoUrl, getTextToVideoUrl, getVideoGenerationUrl, RUNWAY } from '@/lib/runway-config'

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

    // Get the request body
    const body = await request.json()
    const { prompt, duration = 5, width = 1024, height = 576, model = 'gen4_turbo' } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Clean and validate the API key
    const rawKey = process.env.RUNWAYML_API_SECRET?.trim()
    console.log('🎬 Raw API Key length:', rawKey?.length)
    
    if (!rawKey) {
      return NextResponse.json({ error: 'RUNWAYML_API_SECRET is missing. Please set this environment variable.' }, { status: 500 })
    }
    
    // Remove any placeholder text that might be appended
    const cleanKey = rawKey.replace(/nway_ml_api_key_here.*$/, '').trim()
    console.log('🎬 Clean API Key prefix:', cleanKey?.slice(0, 10))
    console.log('🎬 Clean API Key length:', cleanKey?.length)
    
    if (!cleanKey.startsWith('key_')) {
      return NextResponse.json({ error: 'RUNWAYML_API_SECRET is invalid. API key must start with "key_".' }, { status: 500 })
    }
    
    if (cleanKey.length < 50) {
      return NextResponse.json({ error: 'RUNWAYML_API_SECRET appears to be too short. Please check your API key.' }, { status: 500 })
    }

    console.log('🎬 Server-side Runway ML video generation starting...')
    console.log('🎬 User:', user.id)
    console.log('🎬 Prompt:', prompt)
    console.log('🎬 Duration:', duration)
    console.log('🎬 Dimensions:', `${width}x${height}`)
    console.log('🎬 Model:', model)

    // Prepare the request to Runway ML
    // Try both text-to-video and image-to-video formats
    const requestFormats = [
      // Text-to-video attempts
      {
        name: 'text_gen4_turbo_1280x720',
        body: {
          model: "gen4_turbo",
          promptText: prompt,
          duration: parseInt(duration.replace('s', '')),
          ratio: "1280:720",
        }
      },
      {
        name: 'text_gen3a_turbo_1280x768', 
        body: {
          model: "gen3a_turbo",
          promptText: prompt,
          duration: parseInt(duration.replace('s', '')),
          ratio: "1280:768",
        }
      },
      // Image-to-video attempts (fallback)
      {
        name: 'image_gen4_turbo_1280x720',
        body: {
          model: "gen4_turbo",
          promptImage: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1280&h=720&fit=crop", // Earth from space image
          duration: parseInt(duration.replace('s', '')),
          ratio: "1280:720",
        }
      },
      {
        name: 'image_gen3a_turbo_1280x768',
        body: {
          model: "gen3a_turbo",
          promptImage: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1280&h=768&fit=crop",
          duration: parseInt(duration.replace('s', '')),
          ratio: "1280:768",
        }
      }
    ]

    console.log('🎬 Runway ML request formats:', requestFormats.map(f => f.name))

    // First, let's try to get available models
    try {
      console.log('🎬 Checking available models...')
      const modelsResponse = await fetch(`${RUNWAY.HOST}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'X-Runway-Version': RUNWAY.VERSION,
        },
      })
      
      if (modelsResponse.ok) {
        const models = await modelsResponse.json()
        console.log('🎬 Available models:', JSON.stringify(models, null, 2))
      } else {
        console.log('🎬 Could not fetch models:', modelsResponse.status)
      }
    } catch (error) {
      console.log('🎬 Error fetching models:', error)
    }

    // Try both endpoints to see what's available
    const endpoints = [
      { name: 'text_to_video', url: getTextToVideoUrl() },
      { name: 'image_to_video', url: getImageToVideoUrl() }
    ]
    
    let response = null
    let lastError = null
    let successfulFormat = null
    let successfulEndpoint = null
    
        // Try each endpoint with each format
    for (const endpoint of endpoints) {
      for (const format of requestFormats) {
        console.log(`🎬 Trying endpoint: ${endpoint.name} with format: ${format.name} at ${endpoint.url}`)
        console.log(`🎬 Request body:`, JSON.stringify(format.body, null, 2))
        
        try {
          response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanKey}`,
              'X-Runway-Version': RUNWAY.VERSION,
            },
            body: JSON.stringify(format.body),
          })
          
          console.log(`🎬 ${endpoint.name} with ${format.name} response status:`, response.status)
          
          if (response.ok) {
            console.log(`🎬 Success with endpoint: ${endpoint.name} and format: ${format.name}`)
            successfulEndpoint = endpoint.name
            successfulFormat = format.name
            break
          } else {
            const errorText = await response.text()
            console.log(`🎬 ${endpoint.name} with ${format.name} error:`, errorText)
            lastError = errorText
          }
        } catch (error) {
          console.log(`🎬 ${endpoint.name} with ${format.name} fetch error:`, error)
          lastError = error
        }
      }
      
      if (response && response.ok) {
        break // Found a working combination
      }
    }
    
    if (!response || !response.ok) {
      console.log('🎬 All endpoint/format combinations failed, using last error:', lastError)
      return NextResponse.json({ error: lastError || 'All endpoint/format combinations failed' }, { status: response?.status || 500 })
    }

    console.log('🎬 Runway ML response status:', response.status)
    console.log('🎬 Runway ML response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('🎬 Runway ML API error response:', errorText)
      
      let errorMessage = `Runway ML API error (${response.status})`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch (e) {
        errorMessage += `: ${errorText}`
      }
      
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const result = await response.json()
    console.log('🎬 Runway ML success response:', result)

    // Runway ML returns a job ID, not a direct URL
    if (result.id) {
      console.log('🎬 Runway ML job ID received:', result.id)
      
      // Poll for completion (Runway ML jobs are async)
      let attempts = 0
      const maxAttempts = 30 // 30 seconds max
      
      while (attempts < maxAttempts) {
        attempts++
        console.log(`🎬 Polling job status (attempt ${attempts}/${maxAttempts})...`)
        
        try {
          // Try different endpoints for checking job status
          const statusEndpoints = [
            `${RUNWAY.HOST}/v1/jobs/${result.id}`,
            `${RUNWAY.HOST}/v1/inference/${result.id}`,
            `${RUNWAY.HOST}/v1/tasks/${result.id}`,
            `${RUNWAY.HOST}/v1/generations/${result.id}`,
          ]
          
          let statusResponse = null
          let statusResult = null
          
          for (const endpoint of statusEndpoints) {
            try {
              console.log(`🎬 Trying status endpoint: ${endpoint}`)
              statusResponse = await fetch(endpoint, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${cleanKey}`,
                  'X-Runway-Version': RUNWAY.VERSION,
                },
              })
              
              if (statusResponse.ok) {
                statusResult = await statusResponse.json()
                console.log(`🎬 Success with endpoint: ${endpoint}`)
                break
              } else {
                console.log(`🎬 Endpoint ${endpoint} failed with status: ${statusResponse.status}`)
              }
            } catch (error) {
              console.log(`🎬 Endpoint ${endpoint} error:`, error)
            }
          }
          
          if (statusResponse && statusResponse.ok) {
            console.log('🎬 Job status:', statusResult)
            
            if ((statusResult.status === 'completed' || statusResult.status === 'SUCCEEDED') && 
                (statusResult.output?.url || (statusResult.output && statusResult.output.length > 0))) {
              
              const videoUrl = statusResult.output?.url || statusResult.output[0]
              console.log('🎬 Video generation completed! URL:', videoUrl)
              
              return NextResponse.json({
                success: true,
                data: {
                  ...statusResult,
                  url: videoUrl,
                  status: 'completed'
                },
              })
            } else if (statusResult.status === 'failed' || statusResult.status === 'FAILED') {
              console.error('🎬 Video generation failed:', statusResult)
              return NextResponse.json({ 
                error: 'Video generation failed: ' + (statusResult.error || 'Unknown error') 
              }, { status: 500 })
            } else {
              // Still processing - log the current status
              console.log('🎬 Video generation status:', statusResult.status, statusResult.message || 'Processing...')
            }
            
            // Still processing, wait 1 second before next poll
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            console.error('🎬 Failed to check job status:', statusResponse.status)
            break
          }
        } catch (error) {
          console.error('🎬 Error polling job status:', error)
          break
        }
      }
      
      // If we get here, the job is still processing or we hit max attempts
      console.log('🎬 Job still processing or timed out, returning job ID for client-side polling')
      return NextResponse.json({
        success: true,
        data: {
          ...result,
          jobId: result.id,
          status: 'processing',
          message: 'Video generation started. Use the job ID to poll for completion.',
        },
      })
    }

    console.warn('🎬 Runway ML response does not contain expected structure:', result)
    return NextResponse.json({
      success: true,
      data: result,
    })

  } catch (error) {
    console.error('🎬 Server-side Runway ML error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
