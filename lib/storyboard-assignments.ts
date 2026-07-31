export type StoryboardAssignmentSource = {
  character_id?: string | null
  location_id?: string | null
  story_object_id?: string | null
  metadata?: Record<string, unknown> | null
}

export function getStoryboardCharacterIds(storyboard: StoryboardAssignmentSource): string[] {
  const fromMetadata = storyboard.metadata?.character_ids
  if (Array.isArray(fromMetadata) && fromMetadata.length > 0) {
    return fromMetadata.filter((id): id is string => typeof id === "string" && !!id)
  }
  return storyboard.character_id ? [storyboard.character_id] : []
}

export function getStoryboardLocationIds(storyboard: StoryboardAssignmentSource): string[] {
  const fromMetadata = storyboard.metadata?.location_ids
  if (Array.isArray(fromMetadata) && fromMetadata.length > 0) {
    return fromMetadata.filter((id): id is string => typeof id === "string" && !!id)
  }
  return storyboard.location_id ? [storyboard.location_id] : []
}

export function getStoryboardObjectIds(storyboard: StoryboardAssignmentSource): string[] {
  const fromMetadata = storyboard.metadata?.object_ids
  if (Array.isArray(fromMetadata) && fromMetadata.length > 0) {
    return fromMetadata.filter((id): id is string => typeof id === "string" && !!id)
  }
  return storyboard.story_object_id ? [storyboard.story_object_id] : []
}

export function buildStoryboardAssignmentPatch(
  characterIds: string[],
  locationIds: string[],
  options?: {
    objectIds?: string[]
    existingMetadata?: Record<string, unknown> | null
  },
) {
  const objectIds = options?.objectIds ?? []
  return {
    character_id: characterIds[0] ?? null,
    location_id: locationIds[0] ?? null,
    story_object_id: objectIds[0] ?? null,
    metadata: {
      ...(options?.existingMetadata || {}),
      character_ids: characterIds,
      location_ids: locationIds,
      object_ids: objectIds,
    },
  }
}

export function characterNamesForStoryboard(
  storyboard: StoryboardAssignmentSource,
  characterNamesById?: Record<string, string>,
): string[] {
  if (!characterNamesById) return []
  return getStoryboardCharacterIds(storyboard)
    .map((id) => characterNamesById[id])
    .filter((name): name is string => Boolean(name))
}

export function locationNamesForStoryboard(
  storyboard: StoryboardAssignmentSource,
  locationNamesById?: Record<string, string>,
): string[] {
  if (!locationNamesById) return []
  return getStoryboardLocationIds(storyboard)
    .map((id) => locationNamesById[id])
    .filter((name): name is string => Boolean(name))
}

export function objectNamesForStoryboard(
  storyboard: StoryboardAssignmentSource,
  objectNamesById?: Record<string, string>,
): string[] {
  if (!objectNamesById) return []
  return getStoryboardObjectIds(storyboard)
    .map((id) => objectNamesById[id])
    .filter((name): name is string => Boolean(name))
}
