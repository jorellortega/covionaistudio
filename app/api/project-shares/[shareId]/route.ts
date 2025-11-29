import { NextRequest, NextResponse } from 'next/server'
import { ProjectShareService } from '@/lib/project-share-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - Get a specific share
export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
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
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const share = await ProjectShareService.getShareById(params.shareId, supabase)
    
    if (!share) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, share })
  } catch (error: any) {
    console.error('Error fetching share:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch share' },
      { status: 500 }
    )
  }
}

// PATCH - Update a share
export async function PATCH(
  request: NextRequest,
  { params }: { params: { shareId: string } }
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
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      shared_with_user_id,
      shared_with_email,
      share_key,
      deadline,
      requires_approval,
      permissions,
      metadata,
      is_revoked,
      revoked_at,
    } = body

    const share = await ProjectShareService.updateShare(params.shareId, {
      shared_with_user_id,
      shared_with_email,
      share_key,
      deadline,
      requires_approval,
      permissions,
      metadata,
      is_revoked,
      revoked_at,
    }, supabase)

    return NextResponse.json({ success: true, share })
  } catch (error: any) {
    console.error('Error updating share:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update share' },
      { status: 500 }
    )
  }
}

// DELETE - Delete/revoke a share
export async function DELETE(
  request: NextRequest,
  { params }: { params: { shareId: string } }
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
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const revoke = searchParams.get('revoke') === 'true'

    if (revoke) {
      await ProjectShareService.revokeShare(params.shareId, supabase)
    } else {
      await ProjectShareService.deleteShare(params.shareId, supabase)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting share:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete share' },
      { status: 500 }
    )
  }
}

