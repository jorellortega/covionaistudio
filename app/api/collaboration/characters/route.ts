import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase'

// GET characters (for guests)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accessCode = searchParams.get('access_code')

    if (!accessCode) {
      return NextResponse.json(
        { error: 'access_code is required' },
        { status: 400 }
      )
    }

    // Validate access code
    const validation = await CollaborationService.validateAccessCode(accessCode)
    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { error: 'Invalid or expired access code' },
        { status: 403 }
      )
    }

    // Use service role client to bypass RLS for guest access
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get characters for the project
    const { data: characters, error } = await supabaseAdmin
      .from('characters')
      .select('id, name, description, archetype, image_url')
      .eq('project_id', validation.session.project_id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching characters:', error)
      return NextResponse.json(
        { error: 'Failed to fetch characters' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, characters: characters || [] })
  } catch (error: any) {
    console.error('Error fetching characters:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch characters' },
      { status: 500 }
    )
  }
}



























