import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

type RouteContext = { params: Promise<{ id: string }> }

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '').trim()
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params
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

    const body = await request.json()
    const { projectId, createMovie, unlink } = body

    if (unlink) {
      const { data, error } = await supabase
        .from('creative_workspaces')
        .update({ project_id: null, updated_at: new Date().toISOString() })
        .eq('id', workspaceId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, workspace: data, projectId: null, projectName: null })
    }

    let resolvedProjectId = projectId || null
    let projectName = ''

    if (createMovie?.name) {
      const movieName = stripWrappingQuotes(createMovie.name)
      const { data: movie, error: movieError } = await supabase
        .from('projects')
        .insert([{
          user_id: user.id,
          name: movieName,
          description: createMovie.description?.trim() || null,
          genre: createMovie.genre ? stripWrappingQuotes(createMovie.genre) : null,
          project_type: 'movie',
          movie_status: 'Pre-Production',
          project_status: 'active',
          status: 'active',
        }])
        .select()
        .single()

      if (movieError) return NextResponse.json({ error: movieError.message }, { status: 500 })
      resolvedProjectId = movie.id
      projectName = movie.name
    }

    if (!resolvedProjectId) {
      return NextResponse.json(
        { error: 'Select an existing movie or create a new one' },
        { status: 400 },
      )
    }

    if (!projectName) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', resolvedProjectId)
        .eq('user_id', user.id)
        .single()

      if (!project) {
        return NextResponse.json({ error: 'Movie project not found' }, { status: 404 })
      }
      projectName = project.name
    }

    const { data: updated, error } = await supabase
      .from('creative_workspaces')
      .update({ project_id: resolvedProjectId, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      workspace: updated,
      projectId: resolvedProjectId,
      projectName,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
