import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

type RouteContext = { params: Promise<{ id: string; messageId: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId, messageId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const { data: message } = await supabase
      .from('creative_messages')
      .select('id')
      .eq('id', messageId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

    const { error } = await supabase
      .from('creative_messages')
      .delete()
      .eq('id', messageId)
      .eq('workspace_id', workspaceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase
      .from('creative_workspaces')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    return NextResponse.json({ success: true, messageId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
