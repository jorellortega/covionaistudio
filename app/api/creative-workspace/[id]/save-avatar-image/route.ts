import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import { AVATAR_ANGLES } from '@/lib/avatar-angles'

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
      imageUrl,
      characterName,
      characterId,
      createCharacter,
      projectId,
      createMovie,
      angleId,
      prompt,
      messageId,
      setAsCharacterPortrait,
      addToCharacterReferences,
    } = body

    if (!imageUrl || typeof imageUrl !== 'string' || !/^https?:\/\//.test(imageUrl)) {
      return NextResponse.json({ error: 'A valid image URL is required' }, { status: 400 })
    }

    const name = stripWrappingQuotes(characterName?.trim() || 'Unnamed Character')
    if (!name) {
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

    let resolvedCharacterId: string | null = characterId || null

    if (!resolvedCharacterId) {
      const { data: existingCharacter } = await supabase
        .from('characters')
        .select('id')
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .ilike('name', name)
        .maybeSingle()

      if (existingCharacter) {
        resolvedCharacterId = existingCharacter.id
      } else if (createCharacter) {
        const { data: createdCharacter, error: characterError } = await supabase
          .from('characters')
          .insert({
            user_id: user.id,
            project_id: resolvedProjectId,
            name,
            image_url: setAsCharacterPortrait !== false ? imageUrl : null,
            reference_images: [imageUrl],
          })
          .select('id')
          .single()

        if (characterError) return NextResponse.json({ error: characterError.message }, { status: 500 })
        resolvedCharacterId = createdCharacter.id
      }
    }

    if (!resolvedCharacterId) {
      return NextResponse.json(
        { error: 'Select an existing character or enable create new character' },
        { status: 400 },
      )
    }

    const resolvedAngleId = angleId || 'front'
    const angle = AVATAR_ANGLES.find((a) => a.id === resolvedAngleId)
    const angleLabel = angle?.label || 'Front'

    const { data: existingSet } = await supabase
      .from('avatar_sets')
      .select('id')
      .eq('project_id', resolvedProjectId)
      .eq('user_id', user.id)
      .eq('character_id', resolvedCharacterId)
      .maybeSingle()

    let avatarSetId = existingSet?.id

    if (!avatarSetId) {
      const { data: newSet, error: setError } = await supabase
        .from('avatar_sets')
        .insert({
          user_id: user.id,
          project_id: resolvedProjectId,
          character_id: resolvedCharacterId,
          character_name: name,
          metadata: { source: 'creative_workspace' },
        })
        .select('id')
        .single()

      if (setError) return NextResponse.json({ error: setError.message }, { status: 500 })
      avatarSetId = newSet.id
    }

    const { data: existingAvatarImage } = await supabase
      .from('avatar_images')
      .select('id')
      .eq('character_id', resolvedCharacterId)
      .eq('angle_id', resolvedAngleId)
      .eq('image_url', imageUrl)
      .maybeSingle()

    let avatarImageId: string

    if (existingAvatarImage) {
      avatarImageId = existingAvatarImage.id
    } else {
      const { data: avatarImage, error: avatarError } = await supabase
        .from('avatar_images')
        .insert({
          user_id: user.id,
          avatar_set_id: avatarSetId,
          project_id: resolvedProjectId,
          character_id: resolvedCharacterId,
          angle_id: resolvedAngleId,
          angle_label: angleLabel,
          image_url: imageUrl,
          prompt: typeof prompt === 'string' ? prompt.trim().slice(0, 500) : null,
          source: 'from_reference',
          sort_order: 0,
          metadata: { creative_workspace_id: workspaceId },
        })
        .select('id')
        .single()

      if (avatarError) return NextResponse.json({ error: avatarError.message }, { status: 500 })
      avatarImageId = avatarImage.id
    }

    if (setAsCharacterPortrait !== false || addToCharacterReferences !== false) {
      const { data: character } = await supabase
        .from('characters')
        .select('id, reference_images, image_url')
        .eq('id', resolvedCharacterId)
        .single()

      if (character) {
        const referenceImages = Array.isArray(character.reference_images)
          ? character.reference_images.filter((url: string) => typeof url === 'string')
          : []
        if (addToCharacterReferences !== false && !referenceImages.includes(imageUrl)) {
          referenceImages.unshift(imageUrl)
        }

        await supabase
          .from('characters')
          .update({
            reference_images: referenceImages,
            ...(setAsCharacterPortrait !== false ? { image_url: imageUrl } : {}),
          })
          .eq('id', resolvedCharacterId)
      }
    }

    const { data: asset } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        project_id: resolvedProjectId,
        character_id: resolvedCharacterId,
        title: `${name} - ${angleLabel}`,
        content_type: 'image',
        content_url: imageUrl,
        prompt: name,
        metadata: {
          creative_workspace_id: workspaceId,
          artifact_type: 'character',
          avatar_image_id: avatarImageId,
          type: 'avatar',
        },
      })
      .select('id')
      .single()

    if (asset?.id) {
      await supabase
        .from('avatar_images')
        .update({ asset_id: asset.id })
        .eq('id', avatarImageId)
    }

    await supabase
      .from('creative_workspaces')
      .update({ project_id: resolvedProjectId, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    if (messageId) {
      const artifactPayload = {
        artifact_type: 'character' as const,
        title: `${name} - ${angleLabel}`,
        label: name,
        content: imageUrl,
        project_id: resolvedProjectId,
        metadata: {
          character_id: resolvedCharacterId,
          avatar_image_id: avatarImageId,
          auto_linked: true,
          type: 'avatar',
        },
      }

      const { data: existingImageArtifact } = await supabase
        .from('creative_artifacts')
        .select('id, metadata')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('message_id', messageId)
        .eq('content', imageUrl)
        .maybeSingle()

      if (existingImageArtifact) {
        await supabase
          .from('creative_artifacts')
          .update({
            ...artifactPayload,
            metadata: {
              ...(existingImageArtifact.metadata || {}),
              ...artifactPayload.metadata,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingImageArtifact.id)
      } else {
        await supabase.from('creative_artifacts').insert([{
          user_id: user.id,
          workspace_id: workspaceId,
          message_id: messageId,
          ...artifactPayload,
        }])
      }
    }

    return NextResponse.json({
      success: true,
      avatarImageId,
      characterId: resolvedCharacterId,
      projectId: resolvedProjectId,
      projectName,
      characterName: name,
      angleLabel,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
