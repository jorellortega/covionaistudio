import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

type RouteContext = { params: Promise<{ id: string; artifactId: string }> }

const VALID_TYPES = ['image', 'document', 'treatment', 'cover', 'character', 'location', 'scene', 'other']

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id, artifactId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.artifact_type !== undefined) {
      if (!VALID_TYPES.includes(body.artifact_type)) {
        return NextResponse.json({ error: 'Invalid artifact_type' }, { status: 400 })
      }
      updates.artifact_type = body.artifact_type
    }
    if (body.title !== undefined) updates.title = body.title
    if (body.content !== undefined) updates.content = body.content
    if (body.label !== undefined) updates.label = body.label
    if (body.project_id !== undefined) updates.project_id = body.project_id
    if (body.metadata !== undefined) updates.metadata = body.metadata

    const { data, error } = await supabase
      .from('creative_artifacts')
      .update(updates)
      .eq('id', artifactId)
      .eq('workspace_id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })

    return NextResponse.json({ artifact: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id, artifactId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('creative_artifacts')
      .delete()
      .eq('id', artifactId)
      .eq('workspace_id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
