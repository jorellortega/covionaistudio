import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import {
  getKlingCreateEndpoint,
  getKlingModelConfig,
  getKlingStatusEndpoint,
  type KlingApiMode,
} from '@/lib/kling-models'

function generateKlingToken() {
  const accessKey = process.env.KLING_ACCESS_KEY
  const secretKey = process.env.KLING_SECRET_KEY

  if (!accessKey || !secretKey) {
    throw new Error('KLING_ACCESS_KEY and KLING_SECRET_KEY environment variables are not set')
  }

  const payload = {
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5,
  }

  return jwt.sign(payload, secretKey, { algorithm: 'HS256' })
}

function mapRatioToKling(ratio: string): string {
  const ratioMap: Record<string, string> = {
    '1280:720': '16:9',
    '1920:1080': '16:9',
    '720:1280': '9:16',
    '1080:1920': '9:16',
    '960:960': '1:1',
    '768:1280': '9:16',
    '832:1104': '3:4',
  }

  if (ratio in ratioMap) return ratioMap[ratio]
  if (ratio === '1280:768' || ratio === '1104:832' || ratio === '1584:672') return '16:9'

  const [w, h] = ratio.split(':').map(Number)
  if (w && h) {
    const aspect = w / h
    if (aspect > 1.5) return '16:9'
    if (aspect < 0.6) return '9:16'
    return '1:1'
  }

  return '16:9'
}

export async function POST(req: NextRequest) {
  try {
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
                cookieStore.set(name, value, options),
              )
            } catch {
              // setAll called from a Server Component
            }
          },
        },
      },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const prompt = formData.get('prompt') as string
    const uiModel = (formData.get('ui_model') as string) || (formData.get('model') as string)
    const duration = parseInt(formData.get('duration') as string) || 5
    const file = formData.get('file') as File | null
    const startFrame = formData.get('start_frame') as File | null
    const endFrame = formData.get('end_frame') as File | null
    const ratio = (formData.get('ratio') as string) || '16:9'
    const sound = formData.get('sound') === 'on' ? 'on' : 'off'

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!uiModel) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 })
    }

    const modelConfig = getKlingModelConfig(uiModel)
    if (!modelConfig) {
      return NextResponse.json({ error: `Unsupported Kling model: ${uiModel}` }, { status: 400 })
    }

    console.log('🎬 Kling AI video generation starting...')
    console.log('🎬 User:', user.id)
    console.log('🎬 UI model:', uiModel)
    console.log('🎬 API model:', modelConfig.modelName)
    console.log('🎬 API mode:', modelConfig.apiMode)
    console.log('🎬 Prompt:', prompt)
    console.log('🎬 Duration:', duration)
    console.log('🎬 Ratio:', ratio)
    console.log('🎬 Sound:', sound)

    let imageBase64: string | undefined
    let imageTailBase64: string | undefined

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      imageBase64 = buffer.toString('base64')
      console.log('🎬 File uploaded - type:', file.type, 'size:', file.size)
    }

    if (startFrame) {
      const buffer = Buffer.from(await startFrame.arrayBuffer())
      imageBase64 = buffer.toString('base64')
      console.log('🎬 Start frame uploaded - type:', startFrame.type, 'size:', startFrame.size)
    }

    if (endFrame) {
      const buffer = Buffer.from(await endFrame.arrayBuffer())
      imageTailBase64 = buffer.toString('base64')
      console.log('🎬 End frame uploaded - type:', endFrame.type, 'size:', endFrame.size)
    }

    const authToken = generateKlingToken()
    const klingAspectRatio = mapRatioToKling(ratio)
    const apiMode: KlingApiMode = modelConfig.apiMode
    const endpoint = getKlingCreateEndpoint(apiMode)
    const durationStr = String(Math.min(15, Math.max(3, duration)))

    let requestBody: Record<string, unknown>

    if (apiMode === 'omni-video') {
      requestBody = {
        model_name: modelConfig.modelName,
        prompt,
        duration: durationStr,
        aspect_ratio: klingAspectRatio,
        mode: 'pro',
        sound,
      }

      const imageList: Array<{ image_url: string; type?: string }> = []
      if (imageBase64) {
        imageList.push({
          image_url: imageBase64,
          type: imageTailBase64 ? 'first_frame' : 'first_frame',
        })
      }
      if (imageTailBase64) {
        imageList.push({ image_url: imageTailBase64, type: 'end_frame' })
      }
      if (imageList.length > 0) {
        requestBody.image_list = imageList
      }
    } else {
      requestBody = {
        model_name: modelConfig.modelName,
        prompt,
        duration: durationStr,
        aspect_ratio: klingAspectRatio,
        mode: 'pro',
        sound,
      }

      if (imageBase64) {
        requestBody.image = imageBase64
      }
      if (imageTailBase64) {
        requestBody.image_tail = imageTailBase64
      }
    }

    console.log('🎬 Calling Kling AI API:', {
      endpoint,
      model_name: modelConfig.modelName,
      apiMode,
      prompt: prompt.slice(0, 120) + (prompt.length > 120 ? '…' : ''),
      duration: durationStr,
      ratio: klingAspectRatio,
      mode: requestBody.mode,
      sound,
      hasImage: !!imageBase64,
      hasImageTail: !!imageTailBase64,
    })

    const createResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('❌ Kling AI error:', createResponse.status, errorText)

      let errorMessage = `Kling AI API error: ${createResponse.status}`
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.message) errorMessage = errorData.message
      } catch {
        errorMessage = errorText
      }

      return NextResponse.json({ error: errorMessage, status: createResponse.status }, { status: createResponse.status })
    }

    const createData = await createResponse.json()
    console.log('✅ Kling AI task created:', createData)

    if (createData.code !== 0 || !createData.data?.task_id) {
      throw new Error(`Kling AI task creation failed: ${createData.message || 'Unknown error'}`)
    }

    const taskId = createData.data.task_id
    const maxAttempts = 24
    let attempts = 0
    let videoUrl: string | null = null
    const statusEndpoint = getKlingStatusEndpoint(apiMode, taskId)

    while (attempts < maxAttempts) {
      attempts++
      await new Promise((resolve) => setTimeout(resolve, 5000))

      console.log(`🔄 Polling task status (attempt ${attempts}/${maxAttempts})...`)

      const statusResponse = await fetch(statusEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!statusResponse.ok) {
        const errBody = await statusResponse.text()
        console.log(`⚠️ Status check failed: ${statusResponse.status}`, errBody.slice(0, 300))
        continue
      }

      const statusData = await statusResponse.json()
      const taskStatus = statusData.data?.task_status
      const statusMsg = statusData.data?.task_status_msg
      const updatedAt = statusData.data?.updated_at
      console.log('🎬 Task status:', {
        taskStatus,
        statusMsg: statusMsg || null,
        updatedAt: updatedAt || null,
        code: statusData.code,
        message: statusData.message,
        hasVideo: !!statusData.data?.task_result?.videos?.[0]?.url,
      })

      if (taskStatus === 'succeed') {
        videoUrl = statusData.data.task_result?.videos?.[0]?.url
        if (videoUrl) {
          console.log('✅ Video generated successfully!')
          break
        }
        console.warn(
          '⚠️ Kling reported succeed but no video URL in task_result:',
          JSON.stringify(statusData.data?.task_result)?.slice(0, 500),
        )
      } else if (taskStatus === 'failed') {
        const errorMsg = statusMsg || 'Unknown error'
        console.error('❌ Video generation failed:', errorMsg, JSON.stringify(statusData.data)?.slice(0, 800))
        throw new Error(`Video generation failed: ${errorMsg}`)
      }
    }

    if (!videoUrl) {
      console.log(
        `⏳ Kling task still processing after ${maxAttempts} polls — returning taskId for client polling`,
        taskId,
      )
      return NextResponse.json({
        success: true,
        processing: true,
        data: {
          taskId,
          mode: apiMode,
          status: 'processing',
          model: uiModel,
          prompt,
          duration,
          ratio,
        },
      })
    }

    console.log('🎬 Video generation successful! URL:', videoUrl)

    return NextResponse.json({
      success: true,
      data: {
        url: videoUrl,
        model: uiModel,
        prompt,
        duration,
        ratio,
        status: 'completed',
        taskId,
        mode: apiMode,
      },
    })
  } catch (error: unknown) {
    console.error('🎬 Kling AI error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    let errorMessage = 'Video generation failed: ' + message

    if (message.includes('Account balance not enough')) {
      errorMessage =
        'Kling AI account has insufficient credits. Please top up your API credits at https://klingai.com/global/dev/pricing'
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
