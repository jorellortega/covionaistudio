import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateKlingToken } from '@/lib/kling-auth'
import {
  KLING_MOTION_CONTROL_CREATE_ENDPOINT,
  getKlingStatusEndpoint,
} from '@/lib/kling-models'

async function uploadReferenceVideo(
  userId: string,
  file: File,
): Promise<string> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    },
  )

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'mp4'
  const mimeType = file.type || 'video/mp4'
  const filePath = `${userId}/videos/motion-ref-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('cinema_files')
    .upload(filePath, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload reference video: ${error.message}`)
  }

  const { data } = supabase.storage.from('cinema_files').getPublicUrl(filePath)
  return data.publicUrl
}

async function resolveImageUrl(
  imageFile: File | null,
  imageUrl: string,
): Promise<string> {
  if (imageFile) {
    const buffer = Buffer.from(await imageFile.arrayBuffer())
    return buffer.toString('base64')
  }
  if (imageUrl) {
    return imageUrl
  }
  throw new Error('Character image is required')
}

async function resolveReferenceVideoUrl(
  userId: string,
  referenceVideoFile: File | null,
  referenceVideoUrl: string,
): Promise<string> {
  if (referenceVideoUrl && !referenceVideoUrl.startsWith('blob:')) {
    return referenceVideoUrl
  }
  if (referenceVideoFile) {
    return uploadReferenceVideo(userId, referenceVideoFile)
  }
  throw new Error('Reference motion video is required')
}

async function pollMotionControlTask(
  authToken: string,
  taskId: string,
  maxAttempts = 36,
): Promise<string | null> {
  const statusEndpoint = getKlingStatusEndpoint('motion-control', taskId)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000))

    const statusResponse = await fetch(statusEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!statusResponse.ok) continue

    const statusData = await statusResponse.json()
    const taskStatus = statusData.data?.task_status as string | undefined
    const videoUrl = statusData.data?.task_result?.videos?.[0]?.url as
      | string
      | undefined

    if (taskStatus === 'succeed' && videoUrl) {
      return videoUrl
    }
    if (taskStatus === 'failed') {
      throw new Error(
        statusData.data?.task_status_msg ||
          'Kling motion control generation failed',
      )
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const prompt = String(formData.get('prompt') || '').trim()
    const imageFile = formData.get('image') as File | null
    const imageUrl = String(formData.get('image_url') || '').trim()
    const referenceVideoFile = formData.get('reference_video') as File | null
    const referenceVideoUrl = String(
      formData.get('reference_video_url') || '',
    ).trim()
    const characterOrientation =
      String(formData.get('character_orientation') || 'image') === 'video'
        ? 'video'
        : 'image'
    const mode = String(formData.get('mode') || 'pro') === 'std' ? 'std' : 'pro'
    const keepOriginalSound =
      String(formData.get('keep_original_sound') || 'yes') === 'no'
        ? 'no'
        : 'yes'

    const resolvedImage = await resolveImageUrl(imageFile, imageUrl)
    const resolvedVideoUrl = await resolveReferenceVideoUrl(
      user.id,
      referenceVideoFile,
      referenceVideoUrl,
    )

    const authToken = generateKlingToken()
    const requestBody: Record<string, unknown> = {
      model_name: 'kling-v3-motion-control',
      image_url: resolvedImage,
      video_url: resolvedVideoUrl,
      character_orientation: characterOrientation,
      mode,
      keep_original_sound: keepOriginalSound,
    }

    if (prompt) {
      requestBody.prompt = prompt
    }

    const createResponse = await fetch(KLING_MOTION_CONTROL_CREATE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const createData = await createResponse.json().catch(() => ({}))
    if (!createResponse.ok || createData.code !== 0 || !createData.data?.task_id) {
      const message =
        createData.message ||
        createData.data?.task_status_msg ||
        `Motion control task creation failed (${createResponse.status})`
      throw new Error(message)
    }

    const taskId = createData.data.task_id as string
    const resultUrl = await pollMotionControlTask(authToken, taskId)

    if (!resultUrl) {
      return NextResponse.json({
        success: true,
        processing: true,
        data: {
          taskId,
          mode: 'motion-control',
          status: 'processing',
          characterOrientation,
          qualityMode: mode,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        url: resultUrl,
        taskId,
        mode: 'motion-control',
        status: 'completed',
        characterOrientation,
        qualityMode: mode,
      },
    })
  } catch (error) {
    console.error('🎬 Kling motion control error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Kling motion control failed',
      },
      { status: 500 },
    )
  }
}
