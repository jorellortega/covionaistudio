import { NextRequest, NextResponse } from 'next/server'
import { RunwayML } from '@runwayml/sdk'

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

    // Get the request body (handle both JSON and FormData)
    let prompt: string, duration: string | number = 5, width = 1024, height = 576, model = 'gen4_turbo', file: File | null = null
    
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      prompt = formData.get('prompt') as string
      const durationStr = formData.get('duration') as string
      // Handle both "10s" and "10" formats
      duration = parseInt(durationStr?.replace('s', '') || '5') || 5
      width = parseInt(formData.get('width') as string) || 1024
      height = parseInt(formData.get('height') as string) || 576
      model = formData.get('model') as string || 'gen4_turbo'
      file = formData.get('file') as File | null
      console.log('🎬 Server Debug - Received model from frontend (FormData):', model)
      console.log('🎬 Server Debug - Received duration from frontend (FormData):', durationStr, '->', duration)
    } else {
      // Handle JSON request
      const body = await request.json()
      prompt = body.prompt
      const durationStr = body.duration
      // Handle both "10s" and 10 formats
      duration = typeof durationStr === 'string' 
        ? parseInt(durationStr.replace('s', '')) || 5
        : parseInt(String(durationStr)) || 5
      width = body.width || 1024
      height = body.height || 576
      model = body.model || 'gen4_turbo'
      console.log('🎬 Server Debug - Received model from frontend (JSON):', model)
      console.log('🎬 Server Debug - Received duration from frontend (JSON):', durationStr, '->', duration)
    }

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

    // Convert duration to number (handle both "10s" and 10 formats)
    const durationStr = String(duration)
    const durationSeconds = durationStr.includes('s') 
      ? parseInt(durationStr.replace('s', '')) 
      : parseInt(durationStr)
    
    // Ensure duration is valid for Runway ML (5 or 10 seconds)
    const validDuration = durationSeconds === 5 || durationSeconds === 10 ? durationSeconds : 5
    
    // Map resolution to correct ratio format
    const mapResolutionToRatio = (width: number, height: number): string => {
      const ratio = `${width}:${height}`
      // Check if this is a valid ratio for Runway ML
      const validRatios = [
        "1280:720", "1920:1080", "1080:1920", "720:720", "960:720", "720:960",
        "1024:1024", "1080:1080", "1168:880", "1360:768", "1440:1080", "1080:1440",
        "1808:768", "2112:912", "1680:720"
      ]
      
      if (validRatios.includes(ratio)) {
        return ratio
      }
      
      // Default to 1280:720 if not a valid ratio
      return "1280:720"
    }
    
    const ratio = mapResolutionToRatio(width, height)
    
    // Initialize Runway SDK client
    const runway = new RunwayML({
      apiKey: cleanKey,
    })

    // Prepare base parameters
    const baseParams = {
      promptText: prompt,
      duration: validDuration,
      ratio: ratio,
    }

    // Add file if present - convert to data URI for SDK
    let promptImage: string | null = null
    if (file) {
      const fileBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(fileBuffer).toString('base64')
      const mimeType = file.type
      promptImage = `data:${mimeType};base64,${base64}`
    }

    console.log('🎬 Using Runway SDK with model:', model)
    console.log('🎬 Base parameters:', baseParams)

    // Function to try video generation with a specific model
    async function tryVideoGeneration(modelToTry: string) {
      try {
        console.log(`🎬 Attempting video generation with model: ${modelToTry}`)
        
        if (modelToTry === 'act_two') {
          // Act-Two requires video input, but we don't have one
          if (!promptImage) {
            throw new Error('Act-Two model requires a video input file')
          }
          
          // For Act-Two, we need to use characterPerformance.create
          // But since we don't have a video input, we'll skip this model
          throw new Error('Act-Two model requires video input, not image input')
        } else if (modelToTry === 'gen4_aleph') {
          // gen4_aleph uses videoToVideo.create but requires a video input
          if (!promptImage) {
            throw new Error('gen4_aleph model requires a video input file')
          }
          
          // For now, skip gen4_aleph since we don't have video input
          throw new Error('gen4_aleph model requires video input, not image input')
        } else {
          // Gen models (gen3a_turbo, gen4_turbo) use imageToVideo.create
          if (!promptImage) {
            // For text-to-video, we need to create a placeholder image or use a different approach
            // For now, we'll throw an error asking for an image
            throw new Error('Text-to-video generation requires an image input. Please upload an image or use a different model.')
          }
          
          const taskPromise = runway.imageToVideo.create({
            model: modelToTry as 'gen3a_turbo' | 'gen4_turbo',
            promptImage: promptImage,
            ratio: baseParams.ratio as any,
            duration: baseParams.duration as 5 | 10,
            promptText: baseParams.promptText
          })
          
          const task = await taskPromise
          console.log(`🎬 Task created for ${modelToTry}:`, task.id)
          
          // Wait for task completion using the SDK's built-in method
          const result = await taskPromise.waitForTaskOutput({
            timeout: 300000, // 5 minutes timeout
          })
          
          console.log(`🎬 Task completed for ${modelToTry}:`, result)
          return result
        }
      } catch (error: any) {
        console.log(`🎬 Error with model ${modelToTry}:`, error.message)
        
        // Check if it's a model access error or workspace limitation
        if (error.message?.includes('403') || 
            error.message?.includes('not available') || 
            error.message?.includes('forbidden') ||
            error.message?.includes('No video models enabled') ||
            error.message?.includes('workspace')) {
          throw new Error('MODEL_NOT_AVAILABLE')
        }
        
        throw error
      }
    }

    let result = null
    let lastError = null

    // Define available models in order of preference
    const availableModels = ['gen4_turbo', 'gen3a_turbo']
    
    // If the selected model is not suitable for image input, use the first available model
    let modelToTry = model
    if (model === 'gen4_aleph' || model === 'act_two') {
      console.log(`🎬 Model ${model} requires video input, falling back to gen4_turbo`)
      modelToTry = 'gen4_turbo'
    }

    // Try the selected model first
    try {
      result = await tryVideoGeneration(modelToTry)
    } catch (error: any) {
      lastError = error
      console.log(`🎬 Model ${modelToTry} failed:`, error.message)
      
      // If the selected model is not available, try other models as fallback
      if (error.message === 'MODEL_NOT_AVAILABLE') {
        for (const fallbackModel of availableModels) {
          if (fallbackModel !== modelToTry) {
            console.log(`🎬 Model not available, trying fallback: ${fallbackModel}...`)
            try {
              result = await tryVideoGeneration(fallbackModel)
              break // Success, exit the loop
            } catch (fallbackError: any) {
              lastError = fallbackError
              console.log(`🎬 Fallback model ${fallbackModel} also failed:`, fallbackError.message)
            }
          }
        }
      }
    }

    // If all models failed, return clear error with helpful message
    if (!result) {
      let errorMessage = 'Video generation failed. '
      
      if (lastError?.message?.includes('requires video input')) {
        errorMessage += 'The selected model requires a video input file. Please upload a video or select a different model.'
      } else if (lastError?.message?.includes('requires an image input')) {
        errorMessage += 'Please upload an image to generate a video from it.'
      } else if (lastError?.message?.includes('No video models enabled')) {
        errorMessage += 'No video models are enabled on this API workspace. Contact Runway support to enable video models.'
      } else {
        errorMessage += 'All available models failed. Please check your API key and try again.'
      }
      
      console.error('🎬', errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 403 })
    }

    // Extract the video URL from the result
    let videoUrl = null
    if (result.output && Array.isArray(result.output) && result.output.length > 0) {
      videoUrl = result.output[0]
    } else if (result.output && typeof result.output === 'string') {
      videoUrl = result.output
    }

    if (!videoUrl) {
      console.error('🎬 No video URL found in result:', result)
      return NextResponse.json({ error: 'Video generation completed but no URL was returned' }, { status: 500 })
    }

    console.log('🎬 Video generation successful! URL:', videoUrl)

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        url: videoUrl,
        status: 'completed'
      },
    })

  } catch (error: any) {
    console.error('🎬 Server-side Runway ML error:', error)
    
    // Handle specific SDK errors
    if (error.name === 'TaskFailedError') {
      return NextResponse.json({ 
        error: 'Video generation task failed: ' + (error.message || 'Unknown error') 
      }, { status: 500 })
    }
    
    if (error.name === 'TimeoutError') {
      return NextResponse.json({ 
        error: 'Video generation timed out. Please try again.' 
      }, { status: 408 })
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}