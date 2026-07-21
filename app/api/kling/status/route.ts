import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getKlingStatusEndpoint, type KlingApiMode } from '@/lib/kling-models'

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

function parseKlingApiMode(raw: string | null): KlingApiMode {
  if (raw === 'text2video' || raw === 'omni-video' || raw === 'image2video') {
    return raw
  }
  return 'image2video'
}

/**
 * Poll Kling task status using server-side Kling credentials.
 * Intentionally does not require a Supabase user session — long /api/kling/generate
 * waits often leave the access token stale, which caused 401s on follow-up polls.
 * Task IDs are opaque Kling IDs and are only returned to the client that created them.
 */
export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get('taskId')?.trim()
    const mode = parseKlingApiMode(req.nextUrl.searchParams.get('mode'))

    if (!taskId || !/^[A-Za-z0-9_-]{8,128}$/.test(taskId)) {
      return NextResponse.json({ error: 'Valid taskId is required' }, { status: 400 })
    }

    const authToken = generateKlingToken()
    const statusEndpoint = getKlingStatusEndpoint(mode, taskId)

    const statusResponse = await fetch(statusEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      console.error('🎬 [kling/status] HTTP error', {
        taskId,
        mode,
        httpStatus: statusResponse.status,
        body: errorText.slice(0, 400),
      })
      return NextResponse.json(
        { error: `Kling status check failed: ${statusResponse.status}`, details: errorText },
        { status: statusResponse.status },
      )
    }

    const statusData = await statusResponse.json()
    const taskStatus = statusData.data?.task_status as string | undefined
    const statusMsg = (statusData.data?.task_status_msg as string | undefined) || null
    const videoUrl = statusData.data?.task_result?.videos?.[0]?.url as string | undefined
    const createdAt = statusData.data?.created_at
    const updatedAt = statusData.data?.updated_at

    console.log('🎬 [kling/status]', {
      taskId,
      mode,
      taskStatus,
      statusMsg,
      createdAt,
      updatedAt,
      hasVideo: !!videoUrl,
      code: statusData.code,
      message: statusData.message,
    })

    if (taskStatus === 'succeed' && videoUrl) {
      return NextResponse.json({
        success: true,
        status: 'completed',
        data: { url: videoUrl, taskId },
        debug: { taskStatus, statusMsg, createdAt, updatedAt },
      })
    }

    if (taskStatus === 'succeed' && !videoUrl) {
      console.warn(
        '🎬 [kling/status] succeed without video URL',
        JSON.stringify(statusData.data?.task_result)?.slice(0, 600),
      )
    }

    if (taskStatus === 'failed') {
      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          error: statusMsg || 'Kling video generation failed',
          debug: { taskStatus, statusMsg, createdAt, updatedAt, raw: statusData.data },
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      status: 'processing',
      taskId,
      mode,
      taskStatus: taskStatus || 'processing',
      debug: {
        taskStatus: taskStatus || 'processing',
        statusMsg,
        createdAt,
        updatedAt,
        code: statusData.code,
        message: statusData.message,
      },
    })
  } catch (error) {
    console.error('🎬 Kling status error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to check Kling task status',
      },
      { status: 500 },
    )
  }
}
