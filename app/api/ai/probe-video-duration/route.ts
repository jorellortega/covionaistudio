import { NextRequest, NextResponse } from 'next/server'
import { probeRemoteVideoDurationMs } from '@/lib/video-duration'

async function requireUser() {
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
            /* ignore */
          }
        },
      },
    },
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { url?: string }
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ error: 'A valid video URL is required' }, { status: 400 })
    }

    const durationMs = await probeRemoteVideoDurationMs(url)
    return NextResponse.json({ success: true, durationMs })
  } catch (error) {
    console.error('probe-video-duration error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to probe video duration',
      },
      { status: 500 },
    )
  }
}
