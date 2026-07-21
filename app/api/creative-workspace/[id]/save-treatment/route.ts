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
      .select('id, title')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const body = await request.json()
    const {
      title,
      genre,
      logline,
      synopsis,
      prompt,
      projectId,
      createMovie,
      messageId,
    } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Treatment content is required' }, { status: 400 })
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
          description: createMovie.description?.trim() || logline || synopsis || null,
          genre: stripWrappingQuotes(genre || createMovie.genre || '') || null,
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
        .single()
      projectName = project?.name || 'Movie Project'
    }

    const { data: existingTreatment } = await supabase
      .from('treatments')
      .select('id')
      .eq('project_id', resolvedProjectId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const treatmentPayload = {
      title: stripWrappingQuotes(title?.trim() || workspace.title || 'Untitled Treatment'),
      genre: stripWrappingQuotes(genre?.trim() || 'Unspecified'),
      logline: stripWrappingQuotes(logline?.trim() || '') || null,
      synopsis: stripWrappingQuotes(synopsis?.trim() || '') || null,
      prompt: prompt.trim(),
      project_id: resolvedProjectId,
      status: 'draft' as const,
    }

    let treatment
    if (existingTreatment) {
      const { data, error } = await supabase
        .from('treatments')
        .update(treatmentPayload)
        .eq('id', existingTreatment.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      treatment = data
    } else {
      const { data, error } = await supabase
        .from('treatments')
        .insert([{ user_id: user.id, ...treatmentPayload }])
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      treatment = data
    }

    await supabase
      .from('creative_workspaces')
      .update({ project_id: resolvedProjectId, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    if (messageId) {
      await supabase.from('creative_artifacts').insert([{
        user_id: user.id,
        workspace_id: workspaceId,
        message_id: messageId,
        artifact_type: 'treatment',
        title: treatmentPayload.title,
        label: 'Treatment',
        content: prompt.trim(),
        project_id: resolvedProjectId,
        metadata: { treatment_id: treatment.id, auto_linked: true },
      }])
    }

    return NextResponse.json({
      success: true,
      treatment,
      projectId: resolvedProjectId,
      projectName,
      updated: !!existingTreatment,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
