import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - Use invite code (increment used_count)
export async function GET(request: NextRequest) {
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
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore setAll errors in server components
            }
          },
        },
      }
    )
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const linkToken = searchParams.get('token') || searchParams.get('st') || null

    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    const { data: payload, error } = await supabase.rpc('use_invite_for_signup', {
      code_to_use: code.toUpperCase(),
      link_token: linkToken,
    })

    if (error) {
      console.error('Error using invite code:', error)
      return NextResponse.json(
        { error: 'Failed to use invite code' },
        { status: 500 }
      )
    }

    const row = payload as Record<string, unknown> | null
    if (!row || row.success !== true) {
      return NextResponse.json(
        { error: (typeof row?.error === 'string' && row.error) || 'Invalid or expired invite code' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      role: row.role,
      message: 'Invite code used successfully',
    })
  } catch (error) {
    console.error('Error in GET /api/invite-codes/use:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

