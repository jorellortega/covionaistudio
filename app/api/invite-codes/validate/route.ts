import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - Validate invite code (public endpoint)
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

    // Validate invite code without using it (just check validity)
    const { data: role, error } = await supabase
      .rpc('validate_invite_code', { code_to_use: code.toUpperCase() })

    if (error) {
      // Check if it's a custom exception (invalid code)
      if (error.message?.includes('Invalid or expired')) {
        return NextResponse.json(
          { valid: false, error: 'Invalid or expired invite code' },
          { status: 200 } // Return 200 with valid: false for client-side handling
        )
      }
      console.error('Error validating invite code:', error)
      return NextResponse.json(
        { valid: false, error: 'Failed to validate invite code' },
        { status: 500 }
      )
    }

    // If we get here, the code is valid (but not used yet)
    return NextResponse.json({
      valid: true,
      role,
      message: 'Invite code is valid'
    })
  } catch (error) {
    console.error('Error in GET /api/invite-codes/validate:', error)
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

