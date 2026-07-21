import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_TYPES = ['image', 'document', 'treatment', 'cover', 'character', 'location', 'scene', 'other']

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('creative_artifacts')
      .select('*')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ artifacts: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const body = await request.json()
    const { artifact_type, title, content, label, message_id, project_id, metadata } = body

    if (!artifact_type || !VALID_TYPES.includes(artifact_type)) {
      return NextResponse.json({ error: 'Valid artifact_type is required' }, { status: 400 })
    }
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('creative_artifacts')
      .insert([{
        user_id: user.id,
        workspace_id: id,
        artifact_type,
        title,
        content: content ?? null,
        label: label ?? null,
        message_id: message_id ?? null,
        project_id: project_id ?? null,
        metadata: metadata ?? {},
      }])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ artifact: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
