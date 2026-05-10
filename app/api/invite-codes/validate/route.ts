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
    const linkToken = searchParams.get('token') || searchParams.get('st') || null

    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    const { data: payload, error } = await supabase.rpc('validate_invite_for_signup', {
      code_to_use: code.toUpperCase(),
      link_token: linkToken,
    })

    if (error) {
      console.error('Error validating invite code:', error)
      return NextResponse.json(
        { valid: false, error: 'Failed to validate invite code' },
        { status: 500 }
      )
    }

    const row = payload as Record<string, unknown> | null
    if (!row || row.valid !== true) {
      return NextResponse.json({
        valid: false,
        error: (typeof row?.error === 'string' && row.error) || 'Invalid or expired invite code',
      })
    }

    return NextResponse.json({
      valid: true,
      role: row.role,
      requiresLinkToken: row.requires_link_token === true,
      accountAccessExpiresAt: row.account_access_expires_at ?? null,
      blockedRoutes: row.blocked_routes ?? [],
      message: 'Invite code is valid',
    })
  } catch (error) {
    console.error('Error in GET /api/invite-codes/validate:', error)
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

