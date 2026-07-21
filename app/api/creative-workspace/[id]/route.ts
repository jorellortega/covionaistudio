import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

type RouteContext = { params: Promise<{ id: string }> }

async function getOwnedWorkspace(supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>, workspaceId: string, userId: string) {
  const { data, error } = await supabase
    .from('creative_workspaces')
    .select('*')
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await getOwnedWorkspace(supabase, id, user.id)
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    return NextResponse.json({ workspace })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await getOwnedWorkspace(supabase, id, user.id)
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.project_id !== undefined) updates.project_id = body.project_id

    const { data, error } = await supabase
      .from('creative_workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ workspace: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await getOwnedWorkspace(supabase, id, user.id)
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const { error } = await supabase.from('creative_workspaces').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
