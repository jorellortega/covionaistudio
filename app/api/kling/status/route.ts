import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

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

export async function GET(req: NextRequest) {
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
              // ignore
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

    const taskId = req.nextUrl.searchParams.get('taskId')
    const mode = req.nextUrl.searchParams.get('mode') === 'text2video' ? 'text2video' : 'image2video'

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const authToken = generateKlingToken()
    const statusEndpoint =
      mode === 'text2video'
        ? `https://api-singapore.klingai.com/v1/videos/text2video/${taskId}`
        : `https://api-singapore.klingai.com/v1/videos/image2video/${taskId}`

    const statusResponse = await fetch(statusEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      return NextResponse.json(
        { error: `Kling status check failed: ${statusResponse.status}`, details: errorText },
        { status: statusResponse.status },
      )
    }

    const statusData = await statusResponse.json()
    const taskStatus = statusData.data?.task_status as string | undefined
    const videoUrl = statusData.data?.task_result?.videos?.[0]?.url as string | undefined

    if (taskStatus === 'succeed' && videoUrl) {
      return NextResponse.json({
        success: true,
        status: 'completed',
        data: { url: videoUrl, taskId },
      })
    }

    if (taskStatus === 'failed') {
      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          error: statusData.data?.task_status_msg || 'Kling video generation failed',
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
