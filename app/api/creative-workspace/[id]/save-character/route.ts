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
      age,
      gender,
      archetype,
      backstory,
      roleInStory,
      characterType,
      prompt,
      projectId,
      createMovie,
      messageId,
      characterId,
      imageUrls,
      saveAsAvatar,
    } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Character content is required' }, { status: 400 })
    }

    const characterName = stripWrappingQuotes(name?.trim() || 'Unnamed Character')
    if (!characterName) {
      return NextResponse.json({ error: 'Character name is required' }, { status: 400 })
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

    const characterPayload: Record<string, unknown> = {
      name: characterName,
      description: description?.trim() || prompt.trim(),
      archetype: archetype?.trim() || null,
      backstory: backstory?.trim() || null,
      role_in_story: roleInStory?.trim() || null,
      age: typeof age === 'number' && age > 0 ? age : null,
      gender: gender?.trim() || null,
      character_type: characterType || null,
      project_id: resolvedProjectId,
    }

    if (primaryImage) {
      characterPayload.image_url = primaryImage
      characterPayload.reference_images = validImageUrls
    }

    let character
    let updated = false

    if (characterId) {
      const { data, error } = await supabase
        .from('characters')
        .update(characterPayload)
        .eq('id', characterId)
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      character = data
      updated = true
    } else {
      const { data: existingCharacter } = await supabase
        .from('characters')
        .select('id, reference_images, image_url')
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .ilike('name', characterName)
        .maybeSingle()

      if (existingCharacter) {
        const existingRefs = Array.isArray(existingCharacter.reference_images)
          ? existingCharacter.reference_images.filter((url: string) => typeof url === 'string')
          : []
        const mergedRefs = [...validImageUrls, ...existingRefs.filter((url: string) => !validImageUrls.includes(url))]

        const { data, error } = await supabase
          .from('characters')
          .update({
            ...characterPayload,
            reference_images: mergedRefs.length > 0 ? mergedRefs : existingRefs,
            image_url: primaryImage || existingCharacter.image_url,
          })
          .eq('id', existingCharacter.id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        character = data
        updated = true
      } else {
        const { data, error } = await supabase
          .from('characters')
          .insert([{ user_id: user.id, ...characterPayload }])
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        character = data
      }
    }

    await supabase
      .from('creative_workspaces')
      .update({ project_id: resolvedProjectId, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    if (messageId) {
      const artifactPayload = {
        artifact_type: 'character' as const,
        title: characterName,
        label: characterName,
        content: prompt.trim(),
        project_id: resolvedProjectId,
        metadata: { character_id: character.id, auto_linked: true },
      }

      const { data: existingTextArtifact } = await supabase
        .from('creative_artifacts')
        .select('id, metadata')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('message_id', messageId)
        .eq('artifact_type', 'character')
        .not('content', 'like', 'http%')
        .maybeSingle()

      if (existingTextArtifact) {
        await supabase
          .from('creative_artifacts')
          .update({
            ...artifactPayload,
            metadata: {
              ...(existingTextArtifact.metadata || {}),
              ...artifactPayload.metadata,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTextArtifact.id)
      } else {
        await supabase.from('creative_artifacts').insert([{
          user_id: user.id,
          workspace_id: workspaceId,
          message_id: messageId,
          ...artifactPayload,
        }])
      }

      if (primaryImage) {
        await supabase
          .from('creative_artifacts')
          .update({
            artifact_type: 'character',
            label: characterName,
            title: `${characterName} - Portrait`,
            project_id: resolvedProjectId,
            metadata: {
              character_id: character.id,
              auto_linked: true,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .eq('message_id', messageId)
          .eq('content', primaryImage)
      }
    }

    let avatarImageId: string | null = null

    if (saveAsAvatar && primaryImage) {
      const { data: existingSet } = await supabase
        .from('avatar_sets')
        .select('id')
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .eq('character_id', character.id)
        .maybeSingle()

      let avatarSetId = existingSet?.id

      if (!avatarSetId) {
        const { data: newSet, error: setError } = await supabase
          .from('avatar_sets')
          .insert({
            user_id: user.id,
            project_id: resolvedProjectId,
            character_id: character.id,
            character_name: characterName,
            description: description?.trim() || null,
            metadata: { source: 'creative_workspace' },
          })
          .select('id')
          .single()

        if (setError) return NextResponse.json({ error: setError.message }, { status: 500 })
        avatarSetId = newSet.id
      }

      const { data: avatarImage, error: avatarError } = await supabase
        .from('avatar_images')
        .insert({
          user_id: user.id,
          avatar_set_id: avatarSetId,
          project_id: resolvedProjectId,
          character_id: character.id,
          angle_id: 'front',
          angle_label: 'Front',
          image_url: primaryImage,
          prompt: prompt.trim().slice(0, 500),
          source: 'generated',
          sort_order: 0,
          metadata: { creative_workspace_id: workspaceId },
        })
        .select('id')
        .single()

      if (avatarError) return NextResponse.json({ error: avatarError.message }, { status: 500 })
      avatarImageId = avatarImage.id
    }

    if (primaryImage) {
      await supabase.from('assets').insert({
        user_id: user.id,
        project_id: resolvedProjectId,
        character_id: character.id,
        title: `${characterName} - Portrait`,
        content_type: 'image',
        content_url: primaryImage,
        prompt: characterName,
        metadata: {
          creative_workspace_id: workspaceId,
          artifact_type: 'character',
          avatar_image_id: avatarImageId,
        },
      })
    }

    return NextResponse.json({
      success: true,
      character,
      projectId: resolvedProjectId,
      projectName,
      updated,
      avatarImageId,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
