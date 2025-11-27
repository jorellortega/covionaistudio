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

    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    // Use invite code (this increments used_count)
    const { data: role, error } = await supabase
      .rpc('use_invite_code', { code_to_use: code.toUpperCase() })

    if (error) {
      if (error.message?.includes('Invalid or expired')) {
        return NextResponse.json(
          { error: 'Invalid or expired invite code' },
          { status: 400 }
        )
      }
      console.error('Error using invite code:', error)
      return NextResponse.json(
        { error: 'Failed to use invite code' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      role,
      message: 'Invite code used successfully'
    })
  } catch (error) {
    console.error('Error in GET /api/invite-codes/use:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

