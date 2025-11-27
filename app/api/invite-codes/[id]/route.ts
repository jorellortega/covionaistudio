import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// PATCH - Update invite code (CEO only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params
    const updates = await request.json()

    // Validate role if provided
    if (updates.role) {
      const validRoles = ['user', 'creator', 'studio', 'production']
      if (!validRoles.includes(updates.role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be one of: user, creator, studio, production' },
          { status: 400 }
        )
      }
    }

    // Update invite code
    const { data: inviteCode, error } = await supabase
      .from('invite_codes')
      .update({
        ...(updates.role && { role: updates.role }),
        ...(updates.maxUses !== undefined && { max_uses: updates.maxUses }),
        ...(updates.expiresAt !== undefined && { expires_at: updates.expiresAt }),
        ...(updates.isActive !== undefined && { is_active: updates.isActive }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating invite code:', error)
      return NextResponse.json(
        { error: 'Failed to update invite code' },
        { status: 500 }
      )
    }

    return NextResponse.json({ inviteCode })
  } catch (error) {
    console.error('Error in PATCH /api/invite-codes/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete invite code (CEO only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Delete invite code
    const { error } = await supabase
      .from('invite_codes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting invite code:', error)
      return NextResponse.json(
        { error: 'Failed to delete invite code' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/invite-codes/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

