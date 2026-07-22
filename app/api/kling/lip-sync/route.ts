import { NextRequest, NextResponse } from 'next/server'
import { generateKlingToken } from '@/lib/kling-auth'
import {
  KLING_IDENTIFY_FACE_ENDPOINT,
  KLING_LIP_SYNC_CREATE_ENDPOINT,
  getKlingStatusEndpoint,
} from '@/lib/kling-models'

import {
  klingSoundEndTimeMs,
  probeAudioDurationFromBase64,
  probeAudioDurationFromUrl,
} from '@/lib/audio-duration'

type KlingFaceData = {
  face_id: string
  start_time?: number
  end_time?: number
}

function clampAudioDurationMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.min(60_000, Math.round(ms))
}

async function resolveSoundEndTimeMs(options: {
  audioUrl?: string
  audioBase64?: string
  clientDurationMs?: number
}): Promise<number> {
  let probedMs: number | null = null

  if (options.audioUrl) {
    probedMs = await probeAudioDurationFromUrl(options.audioUrl)
  } else if (options.audioBase64) {
    probedMs = probeAudioDurationFromBase64(options.audioBase64)
  }

  const clientMs = clampAudioDurationMs(options.clientDurationMs || 0)
  const durationMs = probedMs || clientMs

  if (!durationMs) {
    throw new Error('Could not determine audio duration for lip sync')
  }

  return klingSoundEndTimeMs(durationMs)
}

async function identifyFaces(videoUrl: string, authToken: string) {
  const response = await fetch(KLING_IDENTIFY_FACE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ video_url: videoUrl }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.code !== 0) {
    const message =
      data.message ||
      data.data?.task_status_msg ||
      `Face identification failed (${response.status})`
    throw new Error(message)
  }

  const sessionId = data.data?.session_id as string | undefined
  const faceData =
    (data.data?.face_data as KlingFaceData[] | undefined) ||
    (data.data?.face_list as KlingFaceData[] | undefined) ||
    []

  if (!sessionId) {
    throw new Error('Kling did not return a session_id for lip sync')
  }
  if (!faceData.length) {
    throw new Error(
      'No faces detected in this video. Use a clip with a clear, front-facing face.',
    )
  }

  return { sessionId, faceData }
}

async function createLipSyncTask(
  authToken: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(KLING_LIP_SYNC_CREATE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.code !== 0 || !data.data?.task_id) {
    const message =
      data.message ||
      data.data?.task_status_msg ||
      `Lip sync task creation failed (${response.status})`
    throw new Error(message)
  }

  return data.data.task_id as string
}

async function pollLipSyncTask(
  authToken: string,
  taskId: string,
  maxAttempts = 36,
): Promise<string | null> {
  const statusEndpoint = getKlingStatusEndpoint('lip-sync', taskId)

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
        statusData.data?.task_status_msg || 'Kling lip sync generation failed',
      )
    }
  }

  return null
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const videoUrl = String(body.videoUrl || '').trim()
    const audioUrl = body.audioUrl ? String(body.audioUrl).trim() : ''
    const audioBase64 = body.audioBase64 ? String(body.audioBase64).trim() : ''
    const clientDurationMs = clampAudioDurationMs(Number(body.audioDurationMs) || 0)
    const faceId = body.faceId ? String(body.faceId) : undefined
    const soundInsertTimeMs = Number(body.soundInsertTimeMs) || 0

    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
    }
    if (!audioUrl && !audioBase64) {
      return NextResponse.json(
        { error: 'audioUrl or audioBase64 is required' },
        { status: 400 },
      )
    }

    const authToken = generateKlingToken()
    const { sessionId, faceData } = await identifyFaces(videoUrl, authToken)
    const selectedFace =
      faceData.find((face) => face.face_id === faceId) || faceData[0]

    const soundFile = audioUrl && !audioUrl.startsWith('blob:') ? audioUrl : audioBase64
    if (!soundFile) {
      return NextResponse.json(
        { error: 'Provide a public audio URL or base64 audio data' },
        { status: 400 },
      )
    }

    const soundEndTimeMs = await resolveSoundEndTimeMs({
      audioUrl: audioUrl && !audioUrl.startsWith('blob:') ? audioUrl : undefined,
      audioBase64: audioBase64 || undefined,
      clientDurationMs,
    })

    const lipSyncBody = {
      session_id: sessionId,
      face_choose: [
        {
          face_id: selectedFace.face_id,
          sound_file: soundFile,
          sound_start_time: 0,
          sound_end_time: soundEndTimeMs,
          sound_insert_time:
            soundInsertTimeMs || selectedFace.start_time || 0,
          sound_volume: 1,
          original_audio_volume: 0,
        },
      ],
    }

    const taskId = await createLipSyncTask(authToken, lipSyncBody)
    const resultUrl = await pollLipSyncTask(authToken, taskId)

    if (!resultUrl) {
      return NextResponse.json({
        success: true,
        processing: true,
        data: {
          taskId,
          mode: 'lip-sync',
          status: 'processing',
          sessionId,
          faceId: selectedFace.face_id,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        url: resultUrl,
        taskId,
        mode: 'lip-sync',
        status: 'completed',
        sessionId,
        faceId: selectedFace.face_id,
      },
    })
  } catch (error) {
    console.error('🎬 Kling lip sync error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Kling lip sync failed',
      },
      { status: 500 },
    )
  }
}
