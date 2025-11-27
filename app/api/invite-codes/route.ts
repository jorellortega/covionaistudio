import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - List all invite codes (CEO only)
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
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is CEO
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== 'ceo') {
      return NextResponse.json(
        { error: 'Forbidden: CEO access required' },
        { status: 403 }
      )
    }

    // Fetch all invite codes
    const { data: inviteCodes, error } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invite codes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invite codes' },
        { status: 500 }
      )
    }

    return NextResponse.json({ inviteCodes })
  } catch (error) {
    console.error('Error in GET /api/invite-codes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new invite code (CEO only)
export async function POST(request: NextRequest) {
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
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is CEO
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== 'ceo') {
      return NextResponse.json(
        { error: 'Forbidden: CEO access required' },
        { status: 403 }
      )
    }

    const { role, maxUses, expiresAt, notes } = await request.json()

    // Validate role
    const validRoles = ['user', 'creator', 'studio', 'production']
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: user, creator, studio, production' },
        { status: 400 }
      )
    }

    // Generate invite code using database function
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_invite_code')

    if (codeError || !codeData) {
      console.error('Error generating invite code:', codeError)
      return NextResponse.json(
        { error: 'Failed to generate invite code' },
        { status: 500 }
      )
    }

    // Create invite code
    const { data: inviteCode, error: insertError } = await supabase
      .from('invite_codes')
      .insert({
        code: codeData,
        role,
        created_by: user.id,
        max_uses: maxUses || null,
        expires_at: expiresAt || null,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating invite code:', insertError)
      return NextResponse.json(
        { error: 'Failed to create invite code' },
        { status: 500 }
      )
    }

    return NextResponse.json({ inviteCode })
  } catch (error) {
    console.error('Error in POST /api/invite-codes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

