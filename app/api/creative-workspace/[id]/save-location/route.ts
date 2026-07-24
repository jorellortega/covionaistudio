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
      description,
      type,
      atmosphere,
      mood,
      visualDescription,
      lightingNotes,
      city,
      prompt,
      projectId,
      createMovie,
      messageId,
      locationId,
      imageUrls,
    } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Location content is required' }, { status: 400 })
    }

    const locationName = stripWrappingQuotes(name?.trim() || 'Unnamed Location')
    if (!locationName) {
      return NextResponse.json({ error: 'Location name is required' }, { status: 400 })
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
          description: createMovie.description?.trim() || description?.trim() || null,
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

    const validImageUrls = Array.isArray(imageUrls)
      ? imageUrls.filter((url: unknown) => typeof url === 'string' && /^https?:\/\//.test(url))
      : []
    const primaryImage = validImageUrls[0] || null

    const locationPayload: Record<string, unknown> = {
      name: locationName,
      description: description?.trim() || prompt.trim(),
      type: type || null,
      atmosphere: atmosphere?.trim() || null,
      mood: mood?.trim() || null,
      visual_description: visualDescription?.trim() || description?.trim() || prompt.trim(),
      lighting_notes: lightingNotes?.trim() || null,
      city: city?.trim() || null,
      project_id: resolvedProjectId,
    }

    if (primaryImage) {
      locationPayload.image_url = primaryImage
      locationPayload.reference_images = validImageUrls
    }

    let location
    let updated = false

    if (locationId) {
      const { data, error } = await supabase
        .from('locations')
        .update(locationPayload)
        .eq('id', locationId)
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      location = data
      updated = true
    } else {
      const { data: existingLocation } = await supabase
        .from('locations')
        .select('id, reference_images, image_url')
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .ilike('name', locationName)
        .maybeSingle()

      if (existingLocation) {
        const existingRefs = Array.isArray(existingLocation.reference_images)
          ? existingLocation.reference_images.filter((url: string) => typeof url === 'string')
          : []
        const mergedRefs = [...validImageUrls, ...existingRefs.filter((url: string) => !validImageUrls.includes(url))]

        const { data, error } = await supabase
          .from('locations')
          .update({
            ...locationPayload,
            reference_images: mergedRefs.length > 0 ? mergedRefs : existingRefs,
            image_url: primaryImage || existingLocation.image_url,
          })
          .eq('id', existingLocation.id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        location = data
        updated = true
      } else {
        const { data, error } = await supabase
          .from('locations')
          .insert([{ user_id: user.id, ...locationPayload }])
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        location = data
      }
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
        artifact_type: 'location',
        title: locationName,
        label: locationName,
        content: prompt.trim(),
        project_id: resolvedProjectId,
        metadata: { location_id: location.id, auto_linked: true },
      }])
    }

    if (primaryImage) {
      await supabase.from('assets').insert({
        user_id: user.id,
        project_id: resolvedProjectId,
        location_id: location.id,
        title: `${locationName} - Reference`,
        content_type: 'image',
        content_url: primaryImage,
        prompt: locationName,
        metadata: {
          creative_workspace_id: workspaceId,
          artifact_type: 'location',
        },
      })
    }

    return NextResponse.json({
      success: true,
      location,
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
