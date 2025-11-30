import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase'

// PATCH character (for guests)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const body = await request.json()
    const { access_code, name, description, archetype } = body

    if (!access_code) {
      return NextResponse.json(
        { error: 'access_code is required' },
        { status: 400 }
      )
    }

    // Validate access code
    const validation = await CollaborationService.validateAccessCode(access_code)
    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { error: 'Invalid or expired access code' },
        { status: 403 }
      )
    }

    // Check permissions
    if (!validation.session.allow_edit) {
      return NextResponse.json(
        { error: 'Editing is not allowed for this session' },
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

    // Get character to verify it belongs to the project
    const { data: character, error: characterError } = await supabaseAdmin
      .from('characters')
      .select('project_id')
      .eq('id', characterId)
      .single()

    if (characterError || !character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      )
    }

    // Verify character belongs to the project
    if (character.project_id !== validation.session.project_id) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      )
    }

    // Update character
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) {
      updates.name = name
    }
    if (description !== undefined) {
      updates.description = description
    }
    if (archetype !== undefined) {
      updates.archetype = archetype
    }

    const { data: updatedCharacter, error: updateError } = await supabaseAdmin
      .from('characters')
      .update(updates)
      .eq('id', characterId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update character' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, character: updatedCharacter })
  } catch (error: any) {
    console.error('Error updating character:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update character' },
      { status: 500 }
    )
  }
}

// DELETE character (for guests)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const body = await request.json()
    const { access_code } = body

    if (!access_code) {
      return NextResponse.json(
        { error: 'access_code is required' },
        { status: 400 }
      )
    }

    // Validate access code
    const validation = await CollaborationService.validateAccessCode(access_code)
    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { error: 'Invalid or expired access code' },
        { status: 403 }
      )
    }

    // Check permissions
    if (!validation.session.allow_delete) {
      return NextResponse.json(
        { error: 'Deleting is not allowed for this session' },
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

    // Get character to verify it belongs to the project
    const { data: character, error: characterError } = await supabaseAdmin
      .from('characters')
      .select('project_id')
      .eq('id', characterId)
      .single()

    if (characterError || !character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      )
    }

    // Verify character belongs to the project
    if (character.project_id !== validation.session.project_id) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      )
    }

    // Delete character
    const { error: deleteError } = await supabaseAdmin
      .from('characters')
      .delete()
      .eq('id', characterId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete character' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting character:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete character' },
      { status: 500 }
    )
  }
}












