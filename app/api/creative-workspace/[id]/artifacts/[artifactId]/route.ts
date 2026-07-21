import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

type RouteContext = { params: Promise<{ id: string; artifactId: string }> }

const VALID_TYPES = ['image', 'document', 'treatment', 'cover', 'character', 'location', 'scene', 'other']

function isImageUrl(value: string | null | undefined): value is string {
  return !!value && (value.startsWith('http://') || value.startsWith('https://'))
}

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

    const { data: existing, error: fetchError } = await supabase
      .from('creative_artifacts')
      .select('*')
      .eq('id', artifactId)
      .eq('workspace_id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
    }

    const merged = {
      ...existing,
      ...updates,
      metadata: {
        ...(existing.metadata || {}),
        ...(body.metadata || {}),
      },
    }

    const projectId = (merged.project_id as string | null) || null
    const artifactType = merged.artifact_type as string
    const imageUrl = isImageUrl(merged.content as string | null) ? merged.content : null
    const label = (merged.label as string | null)?.trim() || null
    const title = (merged.title as string | null)?.trim() || 'Creative workspace image'

    let syncMessage: string | null = null

    if (projectId && imageUrl && body.sync_to_project !== false) {
      const characterId = body.character_id as string | undefined
      const locationId = body.location_id as string | undefined
      const createCharacter = !!body.create_character
      const createLocation = !!body.create_location
      const setAsPrimary = body.set_as_primary_image !== false
      const setAsCover = !!body.set_as_project_cover

      let resolvedCharacterId: string | null = characterId || null
      let resolvedLocationId: string | null = locationId || null

      if (artifactType === 'character' && !resolvedCharacterId && createCharacter && label) {
        const { data: createdCharacter, error: characterError } = await supabase
          .from('characters')
          .insert({
            user_id: user.id,
            project_id: projectId,
            name: label,
            image_url: setAsPrimary ? imageUrl : null,
            reference_images: setAsPrimary ? [imageUrl] : [imageUrl],
          })
          .select('id')
          .single()

        if (characterError) {
          return NextResponse.json({ error: characterError.message }, { status: 500 })
        }
        resolvedCharacterId = createdCharacter.id
        syncMessage = `Saved to new character "${label}"`
      }

      if (artifactType === 'location' && !resolvedLocationId && createLocation && label) {
        const { data: createdLocation, error: locationError } = await supabase
          .from('locations')
          .insert({
            user_id: user.id,
            project_id: projectId,
            name: label,
            image_url: setAsPrimary ? imageUrl : null,
            reference_images: setAsPrimary ? [imageUrl] : [imageUrl],
          })
          .select('id')
          .single()

        if (locationError) {
          return NextResponse.json({ error: locationError.message }, { status: 500 })
        }
        resolvedLocationId = createdLocation.id
        syncMessage = `Saved to new location "${label}"`
      }

      if (resolvedCharacterId) {
        const { data: character, error: characterFetchError } = await supabase
          .from('characters')
          .select('id, name, reference_images, image_url')
          .eq('id', resolvedCharacterId)
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .single()

        if (characterFetchError || !character) {
          return NextResponse.json({ error: 'Character not found for this project' }, { status: 400 })
        }

        const referenceImages = Array.isArray(character.reference_images)
          ? character.reference_images.filter((url: string) => typeof url === 'string')
          : []
        if (!referenceImages.includes(imageUrl)) {
          referenceImages.unshift(imageUrl)
        }

        await supabase
          .from('characters')
          .update({
            reference_images: referenceImages,
            ...(setAsPrimary ? { image_url: imageUrl } : {}),
          })
          .eq('id', resolvedCharacterId)

        if (!syncMessage) syncMessage = `Saved to character "${character.name}"`
      }

      if (resolvedLocationId) {
        const { data: location, error: locationFetchError } = await supabase
          .from('locations')
          .select('id, name, reference_images, image_url')
          .eq('id', resolvedLocationId)
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .single()

        if (locationFetchError || !location) {
          return NextResponse.json({ error: 'Location not found for this project' }, { status: 400 })
        }

        const referenceImages = Array.isArray(location.reference_images)
          ? location.reference_images.filter((url: string) => typeof url === 'string')
          : []
        if (!referenceImages.includes(imageUrl)) {
          referenceImages.unshift(imageUrl)
        }

        await supabase
          .from('locations')
          .update({
            reference_images: referenceImages,
            ...(setAsPrimary ? { image_url: imageUrl } : {}),
          })
          .eq('id', resolvedLocationId)

        if (!syncMessage) syncMessage = `Saved to location "${location.name}"`
      }

      const assetPayload = {
        user_id: user.id,
        project_id: projectId,
        character_id: resolvedCharacterId,
        location_id: resolvedLocationId,
        title,
        content_type: 'image' as const,
        content_url: imageUrl,
        prompt: label,
        metadata: {
          creative_workspace_artifact_id: artifactId,
          creative_workspace_id: id,
          artifact_type: artifactType,
          ...(setAsCover || artifactType === 'cover' ? { is_default_cover: true } : {}),
        },
        is_default_cover: setAsCover || artifactType === 'cover',
      }

      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .insert(assetPayload)
        .select('id')
        .single()

      if (assetError) {
        return NextResponse.json({ error: assetError.message }, { status: 500 })
      }

      merged.metadata = {
        ...merged.metadata,
        asset_id: asset.id,
        character_id: resolvedCharacterId,
        location_id: resolvedLocationId,
        synced_to_project: true,
        synced_at: new Date().toISOString(),
      }

      if (!syncMessage) {
        if (artifactType === 'cover' || setAsCover) syncMessage = 'Saved as project cover'
        else if (artifactType === 'scene') syncMessage = 'Saved to project assets'
        else syncMessage = 'Saved to project assets'
      }
    }

    const { data, error } = await supabase
      .from('creative_artifacts')
      .update({
        title: merged.title,
        content: merged.content,
        label: merged.label,
        artifact_type: merged.artifact_type,
        project_id: merged.project_id,
        metadata: merged.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artifactId)
      .eq('workspace_id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })

    return NextResponse.json({ artifact: data, syncMessage })
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
