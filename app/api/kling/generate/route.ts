import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// Generate JWT token for Kling AI authentication
function generateKlingToken() {
  const accessKey = process.env.KLING_ACCESS_KEY
  const secretKey = process.env.KLING_SECRET_KEY

  if (!accessKey || !secretKey) {
    throw new Error('KLING_ACCESS_KEY and KLING_SECRET_KEY environment variables are not set')
  }

  const payload = {
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    nbf: Math.floor(Date.now() / 1000) - 5 // 5 seconds ago
  }

  const token = jwt.sign(payload, secretKey, { algorithm: 'HS256' })
  return token
}

export async function POST(req: NextRequest) {
  try {
    // Get the current user using server-side Supabase client
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
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await req.formData()
    const prompt = formData.get('prompt') as string
    const model = formData.get('model') as string
    const duration = parseInt(formData.get('duration') as string) || 5
    const file = formData.get('file') as File | null
    const startFrame = formData.get('start_frame') as File | null
    const endFrame = formData.get('end_frame') as File | null
    const ratio = formData.get('ratio') as string || '16:9'

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!model) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 })
    }

    console.log('🎬 Kling AI video generation starting...')
    console.log('🎬 User:', user.id)
    console.log('🎬 Prompt:', prompt)
    console.log('🎬 Model:', model)
    console.log('🎬 Duration:', duration)
    console.log('🎬 Ratio:', ratio)
    console.log('🎬 Has file:', !!file)
    console.log('🎬 Has start frame:', !!startFrame)
    console.log('🎬 Has end frame:', !!endFrame)

    // Convert files to base64 if provided
    let imageBase64: string | undefined
    let imageTailBase64: string | undefined

    // Handle single file (for I2V)
    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      // Kling AI wants ONLY the base64 string, no data URI prefix
      imageBase64 = buffer.toString('base64')
      console.log('🎬 File uploaded - type:', file.type, 'size:', file.size)
    }

    // Handle start/end frames (for I2V Extended)
    if (startFrame) {
      const arrayBuffer = await startFrame.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      imageBase64 = buffer.toString('base64')
      console.log('🎬 Start frame uploaded - type:', startFrame.type, 'size:', startFrame.size)
    }

    if (endFrame) {
      const arrayBuffer = await endFrame.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      imageTailBase64 = buffer.toString('base64')
      console.log('🎬 End frame uploaded - type:', endFrame.type, 'size:', endFrame.size)
    }

    // Generate JWT token for Kling AI
    const authToken = generateKlingToken()

    // Determine endpoint based on model type
    let endpoint: string
    
    if (model === 'kling_i2v' && imageBase64) {
      endpoint = 'https://api-singapore.klingai.com/v1/videos/image2video'
    } else if (imageBase64) {
      endpoint = 'https://api-singapore.klingai.com/v1/videos/image2video'
    } else {
      endpoint = 'https://api-singapore.klingai.com/v1/videos/text2video'
    }

    // Map ratio to Kling AI format
    let klingAspectRatio = '16:9' // default
    const ratioMap: Record<string, string> = {
      '1280:720': '16:9',
      '1920:1080': '16:9',
      '720:1280': '9:16',
      '1080:1920': '9:16',
      '960:960': '1:1',
      '768:1280': '9:16',
      '832:1104': '3:4',
    }
    
    if (ratio in ratioMap) {
      klingAspectRatio = ratioMap[ratio]
    } else if (ratio === '1280:768' || ratio === '1104:832' || ratio === '1584:672') {
      klingAspectRatio = '16:9'
    } else {
      const [w, h] = ratio.split(':').map(Number)
      if (w && h) {
        const aspect = w / h
        if (aspect > 1.5) klingAspectRatio = '16:9'
        else if (aspect < 0.6) klingAspectRatio = '9:16'
        else klingAspectRatio = '1:1'
      }
    }

    // Prepare request body
    const requestBody: any = {
      prompt: prompt,
      duration: duration.toString(), // Must be string: "5" or "10"
      aspect_ratio: klingAspectRatio,
      mode: 'pro', // Use pro mode for highest quality
    }

    // Add images if provided (base64 only, no data URI prefix)
    if (imageBase64) {
      requestBody.image = imageBase64
    }

    // Add end frame if provided (for I2V Extended)
    if (imageTailBase64) {
      requestBody.image_tail = imageTailBase64
    }

    console.log('🎬 Calling Kling AI API:', { 
      endpoint, 
      prompt, 
      duration, 
      ratio: klingAspectRatio,
      hasImage: !!imageBase64,
      hasImageTail: !!imageTailBase64
    })
    
    // Step 1: Create task
    const createResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('❌ Kling AI error:', createResponse.status, errorText)
      
      // Parse error message
      let errorMessage = `Kling AI API error: ${createResponse.status}`
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch {
        errorMessage = errorText
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        status: createResponse.status
      }, { status: createResponse.status })
    }

    const createData = await createResponse.json()
    console.log('✅ Kling AI task created:', createData)

    // Check if task creation was successful
    if (createData.code !== 0 || !createData.data?.task_id) {
      throw new Error(`Kling AI task creation failed: ${createData.message || 'Unknown error'}`)
    }

    const taskId = createData.data.task_id

    // Step 2: Poll for task completion
    const maxAttempts = 60 // Try for up to 5 minutes (5s intervals)
    let attempts = 0
    let videoUrl: string | null = null

    // Use the same endpoint type for polling
    const statusEndpoint = endpoint.includes('image2video')
      ? `https://api-singapore.klingai.com/v1/videos/image2video/${taskId}`
      : `https://api-singapore.klingai.com/v1/videos/text2video/${taskId}`

    while (attempts < maxAttempts) {
      attempts++
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds

      console.log(`🔄 Polling task status (attempt ${attempts}/${maxAttempts})...`)
      
      const statusResponse = await fetch(statusEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!statusResponse.ok) {
        console.log(`⚠️ Status check failed: ${statusResponse.status}`)
        continue
      }

      const statusData = await statusResponse.json()
      console.log(`🎬 Task status:`, statusData.data?.task_status)

      if (statusData.data?.task_status === 'succeed') {
        videoUrl = statusData.data.task_result?.videos?.[0]?.url
        if (videoUrl) {
          console.log('✅ Video generated successfully!')
          break
        }
      } else if (statusData.data?.task_status === 'failed') {
        const errorMsg = statusData.data?.task_status_msg || 'Unknown error'
        console.error('❌ Video generation failed:', errorMsg)
        throw new Error(`Video generation failed: ${errorMsg}`)
      }
    }

    if (!videoUrl) {
      throw new Error('Video generation timed out after maximum polling attempts')
    }

    console.log('🎬 Video generation successful! URL:', videoUrl)

    return NextResponse.json({
      success: true,
      data: {
        url: videoUrl,
        model: model,
        prompt: prompt,
        duration: duration,
        ratio: ratio,
        status: 'completed'
      }
    })

  } catch (error: any) {
    console.error('🎬 Kling AI error:', error)
    
    let errorMessage = 'Video generation failed: ' + (error.message || 'Unknown error')
    
    if (error.message?.includes('Account balance not enough')) {
      errorMessage = 'Kling AI account has insufficient credits. Please top up your API credits at https://klingai.com/global/dev/pricing'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

