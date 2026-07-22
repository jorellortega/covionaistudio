import { NextRequest, NextResponse } from 'next/server'

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

function isAllowedAudioUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { url?: string }
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url || !isAllowedAudioUrl(url)) {
      return NextResponse.json({ error: 'A valid audio URL is required' }, { status: 400 })
    }

    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch audio (${response.status})` },
        { status: 502 },
      )
    }

    const buffer = await response.arrayBuffer()
    if (!buffer.byteLength) {
      return NextResponse.json({ error: 'Audio file is empty' }, { status: 502 })
    }

    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('download-audio error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download audio' },
      { status: 500 },
    )
  }
}
