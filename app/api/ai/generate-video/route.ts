import { NextRequest, NextResponse } from 'next/server'
import { RunwayML } from '@runwayml/sdk'

// Increase body size limit for this route (100MB for video uploads)
export const maxDuration = 300 // 5 minutes
export const runtime = 'nodejs'

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
    let runwayUri: string | null = null
    let fileType: 'image' | 'video' | null = null
    let referenceVideoUri: string | null = null
    
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload (legacy support - files are now uploaded client-side)
      const formData = await request.formData()
      prompt = formData.get('prompt') as string
      const durationStr = formData.get('duration') as string
      // Handle both "10s" and "10" formats
      duration = parseInt(durationStr?.replace('s', '') || '5') || 5
      width = parseInt(formData.get('width') as string) || 1024
      height = parseInt(formData.get('height') as string) || 576
      model = formData.get('model') as string || 'gen4_turbo'
      file = formData.get('file') as File | null
      
      // Validate file size on server side (50MB for videos, 10MB for images)
      if (file) {
        const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024
        if (file.size > maxSize) {
          return NextResponse.json({ 
            error: `File too large. ${file.type.startsWith('video/') ? 'Video' : 'Image'} files must be smaller than ${file.type.startsWith('video/') ? '50MB' : '10MB'}. Please compress or use a smaller file.` 
          }, { status: 413 })
        }
        console.log('🎬 Server Debug - File size:', file.size, 'bytes (', (file.size / 1024 / 1024).toFixed(2), 'MB)')
        fileType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null
      }
      
      console.log('🎬 Server Debug - Received model from frontend (FormData):', model)
      console.log('🎬 Server Debug - Received duration from frontend (FormData):', durationStr, '->', duration)
    } else {
      // Handle JSON request (new approach - runwayUri instead of file)
      const body = await request.json()
      prompt = body.prompt
      const durationStr = body.duration
      // Handle both "10s" and 10 formats
      duration = typeof durationStr === 'string' 
        ? parseInt(durationStr.replace('s', '')) || 5
        : parseInt(String(durationStr)) || 5
      width = parseInt(body.width) || 1024
      height = parseInt(body.height) || 576
      model = body.model || 'gen4_turbo'
      runwayUri = body.runwayUri || null
      fileType = body.fileType || null
      referenceVideoUri = body.referenceVideoUri || null
      console.log('🎬 Server Debug - Received model from frontend (JSON):', model)
      console.log('🎬 Server Debug - Received duration from frontend (JSON):', durationStr, '->', duration)
      console.log('🎬 Server Debug - Received runwayUri:', runwayUri ? 'present' : 'none')
      console.log('🎬 Server Debug - Received fileType:', fileType)
      console.log('🎬 Server Debug - Received referenceVideoUri:', referenceVideoUri ? 'present' : 'none')
    }

    // Prompt is not required for upscale_v1
    if (!prompt && model !== 'upscale_v1') {
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

    // Use runwayUri if provided (client-side upload), otherwise upload file server-side
    let promptImage: string | null = null
    
    if (runwayUri) {
      // File was already uploaded client-side, use the runwayUri directly
      promptImage = runwayUri
      console.log('🎬 Using runwayUri from client-side upload:', runwayUri)
    } else if (file) {
      // Legacy support: Upload file server-side (for backward compatibility)
      // Determine file type if not already set
      if (!fileType) {
        fileType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null
      }
      if (!fileType) {
        return NextResponse.json({ 
          error: 'Unsupported file type. Please upload an image or video file.' 
        }, { status: 400 })
      }
      try {
        console.log('🎬 Uploading file to Runway first (server-side) - type:', file.type, 'size:', file.size)
        
        // Step 1: Create upload request to get upload URL
        const uploadRequestResponse = await fetch('https://api.dev.runwayml.com/v1/uploads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanKey}`,
            'X-Runway-Version': '2024-11-06'
          },
          body: JSON.stringify({
            filename: file.name || (file.type.startsWith('video/') ? 'video.mp4' : 'image.jpg'),
            type: 'ephemeral'
          })
        })

        if (!uploadRequestResponse.ok) {
          const errorText = await uploadRequestResponse.text()
          console.error('🎬 Failed to create Runway upload request:', errorText)
          throw new Error(`Failed to create upload request: ${uploadRequestResponse.status} ${errorText}`)
        }

        const uploadRequestData = await uploadRequestResponse.json()
        const { uploadUrl, fields, runwayUri: serverRunwayUri } = uploadRequestData
        
        console.log('🎬 Got Runway upload URL, uploading file...')
        
        // Step 2: Upload file to the provided URL
        const formData = new FormData()
        
        // Add all fields from the response
        if (fields) {
          Object.entries(fields).forEach(([key, value]) => {
            formData.append(key, value as string)
          })
        }
        
        // Add the file (must be last)
        formData.append('file', file)
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: formData
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('🎬 Failed to upload file to Runway:', errorText)
          throw new Error(`Failed to upload file: ${uploadResponse.status} ${errorText}`)
        }

        // Step 3: Use the runwayUri instead of data URI
        promptImage = serverRunwayUri
        console.log('🎬 File uploaded successfully (server-side), using runwayUri:', serverRunwayUri)
        
      } catch (error: any) {
        console.error('🎬 Error uploading file to Runway:', error)
        
        // Fallback: For small files (< 4MB), try data URI approach
        if (file.size < 4 * 1024 * 1024) {
          console.log('🎬 Falling back to data URI for small file')
          const fileBuffer = await file.arrayBuffer()
          const base64 = Buffer.from(fileBuffer).toString('base64')
          const mimeType = file.type
          promptImage = `data:${mimeType};base64,${base64}`
        } else {
          throw new Error(`File upload failed: ${error.message}. Please try a smaller file or check your connection.`)
        }
      }
    }

    // Validate required files for each model
    const imageRequiredModels = ['gen4_turbo', 'gen3a_turbo']
    const videoRequiredModels = ['act_two', 'gen4_aleph', 'upscale_v1']
    
    if (imageRequiredModels.includes(model)) {
      if (!promptImage) {
        return NextResponse.json({ 
          error: `${model} requires an image to be uploaded. Please upload an image and try again.` 
        }, { status: 400 })
      }
      if (fileType && fileType !== 'image') {
        return NextResponse.json({ 
          error: `${model} requires an image file, but a video file was uploaded. Please upload an image file.` 
        }, { status: 400 })
      }
    }
    
    if (videoRequiredModels.includes(model)) {
      if (!promptImage) {
        return NextResponse.json({ 
          error: `${model} requires a video to be uploaded. Please upload a video and try again.` 
        }, { status: 400 })
      }
      if (fileType && fileType !== 'video') {
        // Act-Two can accept image or video for character, but still needs reference video
        if (model === 'act_two') {
          // Character can be image or video, but we still need reference video
          if (!referenceVideoUri) {
            return NextResponse.json({ 
              error: `${model} requires a reference video file (3-30 seconds). Please upload a reference video.` 
            }, { status: 400 })
          }
        } else {
          return NextResponse.json({ 
            error: `${model} requires a video file, but an image file was uploaded. Please upload a video file.` 
          }, { status: 400 })
        }
      }
    }
    
    // Special validation for Act-Two: requires both character and reference video
    if (model === 'act_two') {
      if (!promptImage) {
        return NextResponse.json({ 
          error: 'Act-Two requires a character image or video file. Please upload a character file.' 
        }, { status: 400 })
      }
      if (!referenceVideoUri) {
        return NextResponse.json({ 
          error: 'Act-Two requires a reference video file (3-30 seconds). Please upload a reference video.' 
        }, { status: 400 })
      }
    }

    console.log('🎬 Using Runway SDK with model:', model)
    console.log('🎬 Base parameters:', baseParams)
    console.log('🎬 Has file uploaded:', !!promptImage)
    console.log('🎬 File type:', fileType)

    // Function to try video generation with a specific model
    async function tryVideoGeneration(modelToTry: string) {
      try {
        console.log(`🎬 Attempting video generation with model: ${modelToTry}`)
        
        if (modelToTry === 'act_two') {
          // Act-Two requires character (image or video) and reference video
          if (!promptImage) {
            throw new Error('Act-Two model requires a character image or video file')
          }
          
          if (!referenceVideoUri) {
            throw new Error('Act-Two model requires a reference video file (3-30 seconds)')
          }
          
          // Determine character type
          const characterType = fileType === 'image' ? 'image' : 'video'
          
          // Call character_performance API directly
          const characterPerformanceResponse = await fetch('https://api.dev.runwayml.com/v1/character_performance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanKey}`,
              'X-Runway-Version': '2024-11-06'
            },
            body: JSON.stringify({
              model: 'act_two',
              character: {
                type: characterType,
                uri: promptImage
              },
              reference: {
                type: 'video',
                uri: referenceVideoUri
              },
              ratio: baseParams.ratio,
              promptText: baseParams.promptText || prompt
            })
          })

          if (!characterPerformanceResponse.ok) {
            const errorText = await characterPerformanceResponse.text()
            throw new Error(`Character performance request failed: ${characterPerformanceResponse.status} ${errorText}`)
          }

          const taskData = await characterPerformanceResponse.json()
          const taskId = taskData.id
          
          console.log(`🎬 Task created for ${modelToTry}:`, taskId)
          
          // Poll for task completion
          let result = null
          const maxAttempts = 60 // 5 minutes max (5 second intervals)
          let attempts = 0
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
            
            const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
              headers: {
                'Authorization': `Bearer ${cleanKey}`,
                'X-Runway-Version': '2024-11-06'
              }
            })
            
            if (!statusResponse.ok) {
              throw new Error(`Failed to check task status: ${statusResponse.status}`)
            }
            
            result = await statusResponse.json()
            console.log(`🎬 Task status (${modelToTry}):`, result.status)
            
            if (result.status === 'SUCCEEDED') {
              break
            } else if (result.status === 'FAILED' || result.status === 'ABORTED') {
              throw new Error(`Task failed: ${result.failure || result.failureReason || 'Unknown reason'}`)
            }
            
            attempts++
          }
          
          if (!result || result.status !== 'SUCCEEDED') {
            throw new Error('Task timed out or did not complete')
          }
          
          console.log(`🎬 Task completed for ${modelToTry}:`, result)
          return result
        } else if (modelToTry === 'gen4_aleph') {
          // gen4_aleph uses video_to_video endpoint and requires a video input
          if (!promptImage) {
            throw new Error('gen4_aleph model requires a video input file')
          }
          
          // Check if we have a video file (check fileType from earlier)
          if (fileType !== 'video') {
            throw new Error('gen4_aleph model requires a video file, not an image file')
          }
          
          // Call video_to_video API directly (SDK may not have this method)
          const videoToVideoResponse = await fetch('https://api.dev.runwayml.com/v1/video_to_video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanKey}`,
              'X-Runway-Version': '2024-11-06'
            },
            body: JSON.stringify({
              model: 'gen4_aleph',
              videoUri: promptImage,
              promptText: baseParams.promptText,
              ratio: baseParams.ratio
            })
          })

          if (!videoToVideoResponse.ok) {
            const errorText = await videoToVideoResponse.text()
            throw new Error(`Video generation request failed: ${videoToVideoResponse.status} ${errorText}`)
          }

          const taskData = await videoToVideoResponse.json()
          const taskId = taskData.id
          
          console.log(`🎬 Task created for ${modelToTry}:`, taskId)
          
          // Poll for task completion
          let result = null
          const maxAttempts = 60 // 5 minutes max (5 second intervals)
          let attempts = 0
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
            
            const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
              headers: {
                'Authorization': `Bearer ${cleanKey}`,
                'X-Runway-Version': '2024-11-06'
              }
            })
            
            if (!statusResponse.ok) {
              throw new Error(`Failed to check task status: ${statusResponse.status}`)
            }
            
            result = await statusResponse.json()
            console.log(`🎬 Task status (${modelToTry}):`, result.status)
            
            if (result.status === 'SUCCEEDED') {
              break
            } else if (result.status === 'FAILED' || result.status === 'ABORTED') {
              throw new Error(`Task failed: ${result.failure || result.failureReason || 'Unknown reason'}`)
            }
            
            attempts++
          }
          
          if (!result || result.status !== 'SUCCEEDED') {
            throw new Error('Task timed out or did not complete')
          }
          
          console.log(`🎬 Task completed for ${modelToTry}:`, result)
          return result
        } else if (modelToTry === 'upscale_v1') {
          // upscale_v1 uses video_upscale endpoint and requires a video input
          if (!promptImage) {
            throw new Error('upscale_v1 model requires a video input file')
          }
          
          // Check if we have a video file
          if (fileType !== 'video') {
            throw new Error('upscale_v1 model requires a video file, not an image file')
          }
          
          // Call video_upscale API directly
          const upscaleResponse = await fetch('https://api.dev.runwayml.com/v1/video_upscale', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanKey}`,
              'X-Runway-Version': '2024-11-06'
            },
            body: JSON.stringify({
              model: 'upscale_v1',
              videoUri: promptImage
            })
          })

          if (!upscaleResponse.ok) {
            const errorText = await upscaleResponse.text()
            throw new Error(`Video upscale request failed: ${upscaleResponse.status} ${errorText}`)
          }

          const taskData = await upscaleResponse.json()
          const taskId = taskData.id
          
          console.log(`🎬 Task created for ${modelToTry}:`, taskId)
          
          // Poll for task completion
          let result = null
          const maxAttempts = 60 // 5 minutes max (5 second intervals)
          let attempts = 0
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
            
            const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
              headers: {
                'Authorization': `Bearer ${cleanKey}`,
                'X-Runway-Version': '2024-11-06'
              }
            })
            
            if (!statusResponse.ok) {
              throw new Error(`Failed to check task status: ${statusResponse.status}`)
            }
            
            result = await statusResponse.json()
            console.log(`🎬 Task status (${modelToTry}):`, result.status)
            
            if (result.status === 'SUCCEEDED') {
              break
            } else if (result.status === 'FAILED' || result.status === 'ABORTED') {
              throw new Error(`Task failed: ${result.failure || result.failureReason || 'Unknown reason'}`)
            }
            
            attempts++
          }
          
          if (!result || result.status !== 'SUCCEEDED') {
            throw new Error('Task timed out or did not complete')
          }
          
          console.log(`🎬 Task completed for ${modelToTry}:`, result)
          return result
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
          console.log(`🎬 Task initial status:`, task.status)
          
          // Wait for task completion using the SDK's built-in method
          const result = await taskPromise.waitForTaskOutput({
            timeout: 300000, // 5 minutes timeout
          })
          
          console.log(`🎬 Task completed for ${modelToTry}:`, result)
          console.log(`🎬 Task final status:`, result?.status)
          
          // Check if task failed
          if (result?.status === 'FAILED' || result?.failure) {
            const failureReason = result?.failure || result?.failureReason || 'Unknown reason'
            console.error(`🎬 Task failed with reason:`, failureReason)
            throw new Error(`Video generation failed: ${failureReason}`)
          }
          
          return result
        }
      } catch (error: any) {
        console.log(`🎬 Error with model ${modelToTry}:`, error.message)
        console.error(`🎬 Full error details:`, error)
        
        // Check if it's a model access error or workspace limitation
        if (error.message?.includes('403') || 
            error.message?.includes('not available') || 
            error.message?.includes('forbidden') ||
            error.message?.includes('No video models enabled') ||
            error.message?.includes('workspace')) {
          throw new Error('MODEL_NOT_AVAILABLE')
        }
        
        // Check for specific error types
        if (error.name === 'TaskFailedError' || error.message?.includes('Task failed')) {
          console.error(`🎬 Task failed error details:`, error.task || error)
        }
        
        throw error
      }
    }

    let result = null
    let lastError = null

    // Define available models by type
    const imageModels = ['gen4_turbo', 'gen3a_turbo']
    const videoModels = ['gen4_aleph', 'upscale_v1']
    
    // Try the selected model first
    try {
      result = await tryVideoGeneration(model)
    } catch (error: any) {
      lastError = error
      console.log(`🎬 Model ${model} failed:`, error.message)
      
      // Only fallback if the selected model is not available (not if it's a file type mismatch)
      if (error.message === 'MODEL_NOT_AVAILABLE') {
        // Determine which models are compatible with the uploaded file type
        let compatibleModels: string[] = []
        
        if (fileType === 'image') {
          compatibleModels = imageModels.filter(m => m !== model)
        } else if (fileType === 'video') {
          compatibleModels = videoModels.filter(m => m !== model)
        } else {
          // If no file type, try image models (for text-to-video)
          compatibleModels = imageModels.filter(m => m !== model)
        }
        
        // Try compatible fallback models
        for (const fallbackModel of compatibleModels) {
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

    // If all models failed, return clear error with helpful message
    if (!result) {
      let errorMessage = 'Video generation failed. '
      let errorDetails = lastError?.message || 'Unknown error'
      
      if (lastError?.message?.includes('requires video input')) {
        errorMessage += 'The selected model requires a video input file. Please upload a video or select a different model.'
      } else if (lastError?.message?.includes('requires an image input')) {
        errorMessage += 'Please upload an image to generate a video from it.'
      } else if (lastError?.message?.includes('No video models enabled')) {
        errorMessage += 'No video models are enabled on this API workspace. Contact Runway support to enable video models.'
      } else if (lastError?.message?.includes('credits') || lastError?.message?.includes('quota')) {
        errorMessage += 'You may have run out of credits. Please check your Runway account balance.'
      } else if (lastError?.message?.includes('content') || lastError?.message?.includes('policy')) {
        errorMessage += 'The content may have been flagged. Please try a different prompt or image.'
      } else if (lastError?.message?.includes('timeout') || lastError?.message?.includes('Timeout')) {
        errorMessage += 'The request timed out. Please try again.'
      } else if (errorDetails.includes('An unexpected error occurred')) {
        errorMessage += 'The Runway API returned an unexpected error. This could be due to: image format/quality issues, content policy violations, or temporary API issues. Try a different image or contact Runway support.'
      } else {
        errorMessage += `Error: ${errorDetails}`
      }
      
      console.error('🎬 Final error message:', errorMessage)
      console.error('🎬 Last error object:', lastError)
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
    
    // Handle 413 Request Entity Too Large errors
    if (error.message?.includes('413') || error.message?.includes('Request Entity Too Large') || error.status === 413) {
      return NextResponse.json({ 
        error: 'File too large. The uploaded file exceeds the maximum size limit. Please compress your video/image file to under 50MB (videos) or 10MB (images) and try again.' 
      }, { status: 413 })
    }
    
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