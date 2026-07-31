import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

type RouteContext = { params: Promise<{ id: string }> }

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'""'']+|["'""'']+$/g, '').trim()
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id, title, project_id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const body = await request.json()
    const {
      name,
      sceneNumber,
      location,
      characters,
      content,
      prompt,
      projectId,
      createMovie,
      messageId,
      sceneId,
    } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Scene content is required' }, { status: 400 })
    }

    const sceneName = stripWrappingQuotes(name?.trim() || 'Unnamed Scene')
    if (!sceneName) {
      return NextResponse.json({ error: 'Scene name is required' }, { status: 400 })
    }

    let resolvedProjectId = projectId || workspace.project_id || null
    let projectName = ''

    if (createMovie?.name) {
      const movieName = stripWrappingQuotes(createMovie.name)
      const { data: movie, error: movieError } = await supabase
        .from('projects')
        .insert([{
          user_id: user.id,
          name: movieName,
          description: createMovie.description?.trim() || null,
          genre: stripWrappingQuotes(createMovie.genre || '') || null,
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

    const scenePayload: Record<string, unknown> = {
      name: sceneName,
      scene_number: sceneNumber?.trim() || null,
      location: location?.trim() || null,
      characters: Array.isArray(characters)
        ? characters.filter((c: unknown) => typeof c === 'string' && c.trim())
        : [],
      content: content?.trim() || prompt.trim(),
      description: prompt.trim().slice(0, 500),
      status: 'draft',
    }

    let scene
    let updated = false

    if (sceneId) {
      const { data, error } = await supabase
        .from('screenplay_scenes')
        .update(scenePayload)
        .eq('id', sceneId)
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      scene = data
      updated = true
    } else if (sceneNumber?.trim()) {
      const { data: existingScene } = await supabase
        .from('screenplay_scenes')
        .select('id')
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .eq('scene_number', sceneNumber.trim())
        .maybeSingle()

      if (existingScene) {
        const { data, error } = await supabase
          .from('screenplay_scenes')
          .update(scenePayload)
          .eq('id', existingScene.id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        scene = data
        updated = true
      }
    }

    if (!scene) {
      const { data: existingScenes } = await supabase
        .from('screenplay_scenes')
        .select('order_index')
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .order('order_index', { ascending: false })
        .limit(1)

      const nextOrder =
        typeof existingScenes?.[0]?.order_index === 'number'
          ? existingScenes[0].order_index + 1
          : sceneNumber
            ? parseInt(sceneNumber, 10) || 1
            : 1

      const { data, error } = await supabase
        .from('screenplay_scenes')
        .insert([{
          user_id: user.id,
          project_id: resolvedProjectId,
          ...scenePayload,
          order_index: nextOrder,
        }])
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      scene = data
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
        artifact_type: 'scene',
        title: sceneName,
        label: sceneNumber ? `Scene ${sceneNumber}` : 'Scene',
        content: content?.trim() || prompt.trim(),
        project_id: resolvedProjectId,
        metadata: {
          screenplay_scene_id: scene.id,
          scene_number: sceneNumber,
          auto_linked: true,
        },
      }])
    }

    await supabase.from('assets').insert({
      user_id: user.id,
      project_id: resolvedProjectId,
      title: sceneName,
      content_type: 'script',
      content: content?.trim() || prompt.trim(),
      prompt: sceneNumber ? `Scene ${sceneNumber}` : sceneName,
      version: 1,
      is_latest_version: true,
      metadata: {
        creative_workspace_id: workspaceId,
        screenplay_scene_id: scene.id,
        scene_number: sceneNumber,
        source: 'creative_workspace_scene_save',
      },
    })

    return NextResponse.json({
      success: true,
      scene,
      projectId: resolvedProjectId,
      projectName,
      updated,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
