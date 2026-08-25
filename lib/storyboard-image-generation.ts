import type { Asset } from "./asset-service"
import type { AvatarImageRecord } from "./avatar-images-service"
import type { Character } from "./characters-service"
import type { Location } from "./locations-service"
import type { StoryObject } from "./story-objects-service"
import { getStoryObjectCategoryLabel } from "./story-objects-service"
import type { Storyboard } from "./storyboards-service"
import { getStoryboardDialogueText } from "./script-selection"
import {
  getStoryboardCharacterIds,
  getStoryboardLocationIds,
  getStoryboardObjectIds,
} from "./storyboard-assignments"
import { AVATAR_REFERENCE_COLLAGE_ANGLE_ID } from "./avatar-angles"
import { LOCATION_REFERENCE_COLLAGE_ANGLE_ID } from "./location-angles"
import { OBJECT_REFERENCE_COLLAGE_ANGLE_ID } from "./object-angles"
import { referenceUrlToFile } from "./project-image-linking"
import { isGPTImage2ApiModel } from "./image-model-utils"
import { debugStoryboardImage } from "./storyboard-image-debug"

/** GPT Image 2 edits API supports up to 16 reference images per request. */
export const GPT_IMAGE_MAX_REFERENCE_IMAGES = 16

/** Storyboard shots need one frame — more refs tend to produce collages/grids. */
export const STORYBOARD_MAX_REFERENCE_IMAGES = 3

export type StoryboardReferenceSourceType =
  | "character_portrait"
  | "character_reference"
  | "character_asset"
  | "character_collage"
  | "avatar_angle"
  | "location_image"
  | "location_reference"
  | "location_collage"
  | "location_angle"
  | "object_image"
  | "object_reference"
  | "object_asset"
  | "object_collage"
  | "object_angle"

export interface StoryboardReferenceSource {
  url: string
  label: string
  sourceType: StoryboardReferenceSourceType
  entityId?: string
  entityName?: string
}

export interface StoryboardReferenceLoadFailure extends StoryboardReferenceSource {
  error: string
  fixHint: string
  filename: string
}

export interface StoryboardReferenceLoadResult {
  files: File[]
  loaded: StoryboardReferenceSource[]
  failed: StoryboardReferenceLoadFailure[]
}

export function maxReferenceImagesForModel(apiModel?: string | null): number {
  if (apiModel && isGPTImage2ApiModel(apiModel)) return GPT_IMAGE_MAX_REFERENCE_IMAGES
  return 6
}

export function storyboardReferenceImageLimit(
  apiModel?: string | null,
  options?: { characterCount?: number; locationCount?: number; objectCount?: number },
): number {
  const modelMax = maxReferenceImagesForModel(apiModel)
  const assignmentCount =
    (options?.characterCount ?? 0) +
    (options?.locationCount ?? 0) +
    (options?.objectCount ?? 0)

  if (apiModel && isGPTImage2ApiModel(apiModel)) {
    // GPT Image 2 edits: one collage per assigned character/location/object when possible.
    const needed =
      assignmentCount > 0 ? assignmentCount : STORYBOARD_MAX_REFERENCE_IMAGES
    return Math.min(modelMax, needed)
  }

  return Math.min(modelMax, STORYBOARD_MAX_REFERENCE_IMAGES)
}

export type StoryboardReferenceCoverageEntry = {
  characterId: string
  name: string
  status: "included" | "missing_source" | "dropped_limit" | "not_assigned"
  sourceType?: StoryboardReferenceSourceType
  label?: string
}

export function summarizeStoryboardReferenceCoverage(
  sources: StoryboardReferenceSource[],
  characterIds: string[],
  characters: Character[],
  maxImages: number,
): {
  refLimit: number
  included: StoryboardReferenceCoverageEntry[]
  droppedDueToLimit: StoryboardReferenceCoverageEntry[]
  missingSource: StoryboardReferenceCoverageEntry[]
  characterRefMapping: Array<{ index: number; name: string; sourceType: string; label: string }>
} {
  const finalSources = sources.slice(0, maxImages)
  const droppedSources = sources.slice(maxImages)
  const characterSourceTypes = new Set<StoryboardReferenceSourceType>([
    "character_collage",
    "avatar_angle",
    "character_asset",
    "character_reference",
    "character_portrait",
  ])

  const included: StoryboardReferenceCoverageEntry[] = []
  const missingSource: StoryboardReferenceCoverageEntry[] = []
  const droppedDueToLimit: StoryboardReferenceCoverageEntry[] = []

  for (const characterId of characterIds) {
    const character = characters.find((c) => c.id === characterId)
    const name = character?.name ?? characterId
    const source = finalSources.find(
      (s) => s.entityId === characterId && characterSourceTypes.has(s.sourceType),
    )
    if (source) {
      included.push({
        characterId,
        name,
        status: "included",
        sourceType: source.sourceType,
        label: source.label,
      })
      continue
    }

    const dropped = droppedSources.find(
      (s) => s.entityId === characterId && characterSourceTypes.has(s.sourceType),
    )
    if (dropped) {
      droppedDueToLimit.push({
        characterId,
        name,
        status: "dropped_limit",
        sourceType: dropped.sourceType,
        label: dropped.label,
      })
      continue
    }

    missingSource.push({ characterId, name, status: "missing_source" })
  }

  const characterRefMapping = finalSources
    .filter((s) => characterSourceTypes.has(s.sourceType) && s.entityName)
    .map((s, index) => ({
      index: index + 1,
      name: s.entityName!,
      sourceType: s.sourceType,
      label: s.label,
    }))

  return {
    refLimit: maxImages,
    included,
    droppedDueToLimit,
    missingSource,
    characterRefMapping,
  }
}

export function summarizeObjectReferenceCoverage(
  sources: StoryboardReferenceSource[],
  objectIds: string[],
  storyObjects: StoryObject[],
  maxImages: number,
): {
  refLimit: number
  included: StoryboardReferenceCoverageEntry[]
  droppedDueToLimit: StoryboardReferenceCoverageEntry[]
  missingSource: StoryboardReferenceCoverageEntry[]
  objectRefMapping: Array<{ index: number; name: string; sourceType: string; label: string; category: string }>
} {
  const finalSources = sources.slice(0, maxImages)
  const droppedSources = sources.slice(maxImages)
  const objectSourceTypes = new Set<StoryboardReferenceSourceType>([
    "object_collage",
    "object_angle",
    "object_image",
    "object_reference",
    "object_asset",
  ])

  const included: StoryboardReferenceCoverageEntry[] = []
  const missingSource: StoryboardReferenceCoverageEntry[] = []
  const droppedDueToLimit: StoryboardReferenceCoverageEntry[] = []

  for (const objectId of objectIds) {
    const object = storyObjects.find((item) => item.id === objectId)
    const name = object?.name ?? objectId
    const source = finalSources.find(
      (s) => s.entityId === objectId && objectSourceTypes.has(s.sourceType),
    )
    if (source) {
      included.push({
        characterId: objectId,
        name,
        status: "included",
        sourceType: source.sourceType,
        label: source.label,
      })
      continue
    }

    const dropped = droppedSources.find(
      (s) => s.entityId === objectId && objectSourceTypes.has(s.sourceType),
    )
    if (dropped) {
      droppedDueToLimit.push({
        characterId: objectId,
        name,
        status: "dropped_limit",
        sourceType: dropped.sourceType,
        label: dropped.label,
      })
      continue
    }

    missingSource.push({ characterId: objectId, name, status: "missing_source" })
  }

  const objectRefMapping = finalSources
    .filter((s) => objectSourceTypes.has(s.sourceType) && s.entityName)
    .map((s, index) => {
      const object = storyObjects.find((item) => item.id === s.entityId)
      return {
        index: index + 1,
        name: s.entityName!,
        sourceType: s.sourceType,
        label: s.label,
        category: object ? getStoryObjectCategoryLabel(object.category) : "Object",
      }
    })

  return {
    refLimit: maxImages,
    included,
    droppedDueToLimit,
    missingSource,
    objectRefMapping,
  }
}

export function buildEntityReferenceMapping(
  loaded: StoryboardReferenceSource[],
  options?: { startIndex?: number },
): Array<{ index: number; name: string; sourceType: string; label: string }> {
  const startIndex = options?.startIndex ?? 1
  return loaded.map((source, index) => ({
    index: startIndex + index,
    name: source.entityName ?? source.label,
    sourceType: source.sourceType,
    label: source.label,
  }))
}

export function buildObjectReferenceLabel(object: StoryObject): string {
  const categoryLabel = getStoryObjectCategoryLabel(object.category)
  return `${object.name} · ${categoryLabel}`
}

export function buildQuickShotImagePrompt(
  storyboard: Storyboard,
  options?: {
    characterNames?: string[]
    locationNames?: string[]
    objectNames?: string[]
  },
): string {
  const actionText =
    storyboard.action?.trim() &&
    storyboard.action.trim() !== storyboard.description?.trim()
      ? storyboard.action.trim()
      : null

  const parts = [
    storyboard.title?.trim() ? `Shot: ${storyboard.title.trim()}` : null,
    options?.characterNames?.length
      ? `Characters: ${options.characterNames.join(", ")}`
      : null,
    options?.locationNames?.length
      ? `Location: ${options.locationNames.join(", ")}`
      : null,
    options?.objectNames?.length
      ? `Objects: ${options.objectNames.join(", ")}`
      : null,
    storyboard.shot_type ? `${storyboard.shot_type} shot` : null,
    storyboard.camera_angle ? `${storyboard.camera_angle} angle` : null,
    storyboard.movement && storyboard.movement !== "static"
      ? `${storyboard.movement} camera`
      : null,
    storyboard.description?.trim() || null,
    actionText ? `Action: ${actionText}` : null,
    storyboard.visual_notes?.trim()
      ? `Visual notes: ${storyboard.visual_notes.trim()}`
      : null,
    getStoryboardDialogueText(storyboard)
      ? `Dialogue context: ${getStoryboardDialogueText(storyboard)}`
      : null,
  ].filter(Boolean)

  return parts.join(", ")
}

export function buildCharacterDetailsText(character: Character): string {
  return [
    character.name && `Character name: ${character.name}`,
    character.age && `Age: ${character.age}`,
    character.gender && `Gender: ${character.gender}`,
    character.archetype && `Archetype: ${character.archetype}`,
    character.description && `Description: ${character.description}`,
    character.height && `Height: ${character.height}`,
    character.build && `Build: ${character.build}`,
    character.skin_tone && `Skin tone: ${character.skin_tone}`,
    character.eye_color && `Eye color: ${character.eye_color}`,
    character.hair_color_current &&
      `Hair: ${character.hair_color_current} (${character.hair_length})`,
    character.face_shape && `Face shape: ${character.face_shape}`,
    character.usual_clothing_style && `Clothing style: ${character.usual_clothing_style}`,
    character.typical_color_palette && character.typical_color_palette.length > 0
      ? `Color palette: ${character.typical_color_palette.join(", ")}`
      : null,
    character.personality?.traits && character.personality.traits.length > 0
      ? `Personality traits: ${character.personality.traits.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(", ")
}

export function buildLocationDetailsText(location: Location): string {
  return [
    location.name && `Location name: ${location.name}`,
    location.type && `Type: ${location.type}`,
    location.description && `Description: ${location.description}`,
    location.address && `Address: ${location.address}`,
    location.city && `City: ${location.city}`,
    location.state && `State: ${location.state}`,
    location.country && `Country: ${location.country}`,
    location.time_of_day && location.time_of_day.length > 0
      ? `Time of day: ${location.time_of_day.join(", ")}`
      : null,
    location.atmosphere && `Atmosphere: ${location.atmosphere}`,
    location.mood && `Mood: ${location.mood}`,
    location.visual_description && `Visual description: ${location.visual_description}`,
    location.lighting_notes && `Lighting: ${location.lighting_notes}`,
    location.key_features && location.key_features.length > 0
      ? `Key features: ${location.key_features.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(", ")
}

export function buildObjectDetailsText(object: StoryObject): string {
  return [
    object.name && `Object name: ${object.name}`,
    object.category && `Type: ${getStoryObjectCategoryLabel(object.category)}`,
    object.description && `Description: ${object.description}`,
    object.visual_description && `Visual description: ${object.visual_description}`,
    object.material && `Material: ${object.material}`,
    object.color && `Color: ${object.color}`,
    object.era && `Era: ${object.era}`,
  ]
    .filter(Boolean)
    .join(", ")
}

function avatarBelongsToCharacter(
  img: AvatarImageRecord,
  characterId: string,
  characterName?: string,
): boolean {
  if (img.character_id === characterId) return true
  const name = characterName?.trim().toLowerCase()
  if (!name) return false
  if (img.character_name?.trim().toLowerCase() === name) return true
  const metaName = img.metadata?.character_name
  if (typeof metaName === "string" && metaName.trim().toLowerCase() === name) return true
  return false
}

function isCollageAsset(asset: Asset): boolean {
  return (
    asset.metadata?.avatar_angle === AVATAR_REFERENCE_COLLAGE_ANGLE_ID ||
    asset.metadata?.type === "avatar_collage"
  )
}

function isLocationCollageAsset(asset: Asset): boolean {
  return (
    asset.metadata?.location_angle === LOCATION_REFERENCE_COLLAGE_ANGLE_ID ||
    asset.metadata?.type === "location_angle_collage" ||
    asset.metadata?.location_angle_source === "collage"
  )
}

function isObjectCollageAsset(asset: Asset): boolean {
  return (
    asset.metadata?.object_angle === OBJECT_REFERENCE_COLLAGE_ANGLE_ID ||
    asset.metadata?.type === "object_angle_collage" ||
    asset.metadata?.object_angle_source === "collage"
  )
}

function pickBestLinkedImageAsset(
  assets: Asset[],
  options: {
    match: (asset: Asset) => boolean
    preferredAngleIds: string[]
    readAngleId: (asset: Asset) => string | undefined
  },
): Asset | undefined {
  const candidates = assets.filter(
    (asset) =>
      asset.content_type === "image" &&
      !!asset.content_url &&
      options.match(asset),
  )
  for (const angleId of options.preferredAngleIds) {
    const found = candidates.find((asset) => options.readAngleId(asset) === angleId)
    if (found) return found
  }
  return candidates.find((asset) => options.readAngleId(asset)) ?? candidates[0]
}

function resolveCharacterCollageUrl(
  characterId: string,
  character: Character | undefined,
  avatarImages: AvatarImageRecord[],
  characterAssets: Asset[],
): string | null {
  const name = character?.name
  const knownCollageUrls = new Set<string>()

  for (const img of avatarImages) {
    if (img.angle_id !== AVATAR_REFERENCE_COLLAGE_ANGLE_ID || !img.image_url) continue
    if (!avatarBelongsToCharacter(img, characterId, name)) continue
    knownCollageUrls.add(img.image_url)
    return img.image_url
  }

  for (const asset of characterAssets) {
    if (asset.character_id !== characterId || !asset.content_url || !isCollageAsset(asset)) {
      continue
    }
    knownCollageUrls.add(asset.content_url)
    return asset.content_url
  }

  for (const ref of character?.reference_images ?? []) {
    if (!ref || knownCollageUrls.has(ref)) continue
    const matchesAsset = characterAssets.some(
      (asset) => asset.character_id === characterId && asset.content_url === ref && isCollageAsset(asset),
    )
    const matchesAvatar = avatarImages.some(
      (img) =>
        img.angle_id === AVATAR_REFERENCE_COLLAGE_ANGLE_ID &&
        img.image_url === ref &&
        avatarBelongsToCharacter(img, characterId, name),
    )
    if (matchesAsset || matchesAvatar) return ref
  }

  return null
}

function resolveLocationCollageUrl(
  locationId: string,
  location: Location | undefined,
  locationAssets: Asset[],
): string | null {
  for (const asset of locationAssets) {
    if (asset.location_id !== locationId || !asset.content_url || !isLocationCollageAsset(asset)) {
      continue
    }
    return asset.content_url
  }

  const knownCollageUrls = new Set(
    locationAssets
      .filter(
        (asset) =>
          asset.location_id === locationId && asset.content_url && isLocationCollageAsset(asset),
      )
      .map((asset) => asset.content_url as string),
  )
  if (location?.image_url && knownCollageUrls.has(location.image_url)) return location.image_url
  for (const ref of location?.reference_images ?? []) {
    if (ref && knownCollageUrls.has(ref)) return ref
  }
  return null
}

function resolveObjectCollageUrl(
  objectId: string,
  object: StoryObject | undefined,
  objectAssets: Asset[],
): string | null {
  for (const asset of objectAssets) {
    if (asset.story_object_id !== objectId || !asset.content_url || !isObjectCollageAsset(asset)) {
      continue
    }
    return asset.content_url
  }

  const knownCollageUrls = new Set(
    objectAssets
      .filter(
        (asset) =>
          asset.story_object_id === objectId && asset.content_url && isObjectCollageAsset(asset),
      )
      .map((asset) => asset.content_url as string),
  )
  if (object?.image_url && knownCollageUrls.has(object.image_url)) return object.image_url
  for (const ref of object?.reference_images ?? []) {
    if (ref && knownCollageUrls.has(ref)) return ref
  }
  return null
}

export type CollectStoryboardReferenceOptions = {
  characterIds: string[]
  locationIds: string[]
  objectIds?: string[]
  characters: Character[]
  locations: Location[]
  storyObjects?: StoryObject[]
  avatarImages: AvatarImageRecord[]
  /** Linked project assets (character_id set) — used when portrait/reference URLs are stale */
  characterAssets?: Asset[]
  /** Linked project assets (location_id set) */
  locationAssets?: Asset[]
  /** Linked project assets (story_object_id set) */
  objectAssets?: Asset[]
  maxImages: number
  /** Skip these URLs when collecting references (e.g. the current shot's gallery images). */
  excludeUrls?: string[]
}

export function normalizeReferenceUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url.split("?")[0] ?? url
  }
}

export function collectStoryboardReferenceSources(
  options: CollectStoryboardReferenceOptions,
): StoryboardReferenceSource[] {
  const {
    characterIds,
    locationIds,
    objectIds = [],
    characters,
    locations,
    storyObjects = [],
    avatarImages,
    characterAssets = [],
    locationAssets = [],
    objectAssets = [],
    maxImages,
    excludeUrls = [],
  } = options
  const sources: StoryboardReferenceSource[] = []
  const seen = new Set<string>()
  const excluded = new Set(excludeUrls.map(normalizeReferenceUrl))

  const addSource = (source: StoryboardReferenceSource) => {
    if (!source.url || seen.has(source.url) || sources.length >= maxImages) return
    if (excluded.has(normalizeReferenceUrl(source.url))) return
    seen.add(source.url)
    sources.push(source)
  }

  const avatarsForCharacter = (characterId: string, characterName?: string) =>
    avatarImages.filter(
      (img) => img.image_url && avatarBelongsToCharacter(img, characterId, characterName),
    )

  const collageResolution: Array<{
    characterId: string
    name: string
    collageUrl: string | null
    avatarCollageRows: number
    collageAssets: number
  }> = []

  for (const characterId of characterIds) {
    const character = characters.find((c) => c.id === characterId)
    const name = character?.name || "Character"
    const collageUrl = resolveCharacterCollageUrl(
      characterId,
      character,
      avatarImages,
      characterAssets,
    )

    collageResolution.push({
      characterId,
      name,
      collageUrl,
      avatarCollageRows: avatarImages.filter(
        (img) =>
          img.angle_id === AVATAR_REFERENCE_COLLAGE_ANGLE_ID &&
          avatarBelongsToCharacter(img, characterId, character?.name),
      ).length,
      collageAssets: characterAssets.filter(
        (a) => a.character_id === characterId && a.content_url && isCollageAsset(a),
      ).length,
    })

    if (collageUrl) {
      addSource({
        url: collageUrl,
        label: `${name} · Avatar collage`,
        sourceType: "character_collage",
        entityId: characterId,
        entityName: name,
      })
      continue
    }

    const sourceCountBefore = sources.length

    const avatars = avatarsForCharacter(characterId, character?.name)
    const front = avatars.find((a) => a.angle_id === "front")
    const bestAvatar =
      front ??
      avatars.find((a) => a.angle_id !== AVATAR_REFERENCE_COLLAGE_ANGLE_ID) ??
      null

    if (bestAvatar?.image_url && !seen.has(bestAvatar.image_url)) {
      addSource({
        url: bestAvatar.image_url,
        label: `${name} · Avatar (${bestAvatar.angle_id || "angle"})`,
        sourceType: "avatar_angle",
        entityId: characterId,
        entityName: name,
      })
    }

    if (sources.length === sourceCountBefore) {
      const galleryAsset = characterAssets.find(
        (a) =>
          a.character_id === characterId &&
          a.content_type === "image" &&
          a.content_url &&
          !isCollageAsset(a),
      )
      if (galleryAsset?.content_url) {
        addSource({
          url: galleryAsset.content_url,
          label: `${name} · ${galleryAsset.title?.trim() || "Gallery image"}`,
          sourceType: "character_asset",
          entityId: characterId,
          entityName: name,
        })
      }
    }

    const portraitUrl = character?.image_url?.trim()
    if (sources.length === sourceCountBefore && portraitUrl) {
      addSource({
        url: portraitUrl,
        label: `${name} · Portrait`,
        sourceType: "character_portrait",
        entityId: characterId,
        entityName: name,
      })
    }
  }

  for (const locationId of locationIds) {
    const location = locations.find((l) => l.id === locationId)
    const name = location?.name || "Location"
    const collageUrl = resolveLocationCollageUrl(locationId, location, locationAssets)

    if (collageUrl) {
      addSource({
        url: collageUrl,
        label: `${name} · Location collage`,
        sourceType: "location_collage",
        entityId: locationId,
        entityName: name,
      })
      continue
    }

    const sourceCountBefore = sources.length
    const bestAngle = pickBestLinkedImageAsset(locationAssets, {
      match: (asset) =>
        asset.location_id === locationId && !isLocationCollageAsset(asset),
      preferredAngleIds: ["establishing", "eye_level"],
      readAngleId: (asset) =>
        typeof asset.metadata?.location_angle === "string"
          ? asset.metadata.location_angle
          : undefined,
    })
    if (bestAngle?.content_url) {
      const angleLabel =
        (typeof bestAngle.metadata?.location_angle_label === "string" &&
          bestAngle.metadata.location_angle_label) ||
        bestAngle.title?.trim() ||
        "Angle"
      addSource({
        url: bestAngle.content_url,
        label: `${name} · ${angleLabel}`,
        sourceType: "location_angle",
        entityId: locationId,
        entityName: name,
      })
    }

    if (sources.length === sourceCountBefore && location?.image_url) {
      addSource({
        url: location.image_url,
        label: `${name} · Cover image`,
        sourceType: "location_image",
        entityId: locationId,
        entityName: name,
      })
    }

    if (sources.length === sourceCountBefore) {
      const refUrl = (location?.reference_images ?? []).find((ref) => !!ref?.trim())
      if (refUrl) {
        addSource({
          url: refUrl,
          label: `${name} · Reference image`,
          sourceType: "location_reference",
          entityId: locationId,
          entityName: name,
        })
      }
    }

    if (sources.length === sourceCountBefore) {
      const galleryAsset = locationAssets.find(
        (asset) =>
          asset.location_id === locationId &&
          asset.content_type === "image" &&
          asset.content_url &&
          !isLocationCollageAsset(asset),
      )
      if (galleryAsset?.content_url) {
        addSource({
          url: galleryAsset.content_url,
          label: `${name} · ${galleryAsset.title?.trim() || "Gallery image"}`,
          sourceType: "location_image",
          entityId: locationId,
          entityName: name,
        })
      }
    }
  }

  for (const objectId of objectIds) {
    const object = storyObjects.find((item) => item.id === objectId)
    const name = object?.name || "Object"
    const categoryLabel = object ? getStoryObjectCategoryLabel(object.category) : "Object"
    const kindLabel = `${name} · ${categoryLabel}`
    const collageUrl = resolveObjectCollageUrl(objectId, object, objectAssets)

    if (collageUrl) {
      addSource({
        url: collageUrl,
        label: `${kindLabel} · Object collage`,
        sourceType: "object_collage",
        entityId: objectId,
        entityName: name,
      })
      continue
    }

    const sourceCountBefore = sources.length
    const coverUrl = object?.image_url?.trim()
    const bestAngle = pickBestLinkedImageAsset(objectAssets, {
      match: (asset) =>
        asset.story_object_id === objectId && !isObjectCollageAsset(asset),
      preferredAngleIds: ["front", "side"],
      readAngleId: (asset) =>
        typeof asset.metadata?.object_angle === "string"
          ? asset.metadata.object_angle
          : undefined,
    })
    if (bestAngle?.content_url) {
      const angleLabel =
        (typeof bestAngle.metadata?.object_angle_label === "string" &&
          bestAngle.metadata.object_angle_label) ||
        bestAngle.title?.trim() ||
        "Angle"
      addSource({
        url: bestAngle.content_url,
        label: `${kindLabel} · ${angleLabel}`,
        sourceType: "object_angle",
        entityId: objectId,
        entityName: name,
      })
    }

    if (sources.length === sourceCountBefore && coverUrl) {
      addSource({
        url: coverUrl,
        label: `${kindLabel} (cover)`,
        sourceType: "object_image",
        entityId: objectId,
        entityName: name,
      })
    }

    if (sources.length === sourceCountBefore) {
      const refUrl = (object?.reference_images ?? []).find(
        (ref) => ref && ref.trim() && ref !== coverUrl,
      )
      if (refUrl) {
        addSource({
          url: refUrl,
          label: `${kindLabel} (reference)`,
          sourceType: "object_reference",
          entityId: objectId,
          entityName: name,
        })
      }
    }

    if (sources.length === sourceCountBefore) {
      const galleryAsset = objectAssets.find(
        (asset) =>
          asset.story_object_id === objectId &&
          asset.content_type === "image" &&
          asset.content_url &&
          !isObjectCollageAsset(asset),
      )
      if (galleryAsset?.content_url) {
        addSource({
          url: galleryAsset.content_url,
          label: `${kindLabel} · ${galleryAsset.title?.trim() || "Gallery image"}`,
          sourceType: "object_asset",
          entityId: objectId,
          entityName: name,
        })
      }
    }
  }

  const coverage = summarizeStoryboardReferenceCoverage(
    sources,
    characterIds,
    characters,
    maxImages,
  )

  const objectCoverage = summarizeObjectReferenceCoverage(
    sources,
    objectIds,
    storyObjects,
    maxImages,
  )

  debugStoryboardImage("references-collected", {
    phase: "collection",
    characterIds,
    locationIds,
    objectIds,
    maxImages,
    excludedUrlCount: excludeUrls.length,
    collageResolution: collageResolution.map((entry) => ({
      name: entry.name,
      usedCollage: Boolean(entry.collageUrl),
      avatarCollageRows: entry.avatarCollageRows,
      collageAssets: entry.collageAssets,
      collageUrl: entry.collageUrl,
    })),
    locationCollageResolution: locationIds.map((locationId) => {
      const location = locations.find((item) => item.id === locationId)
      const collageUrl = resolveLocationCollageUrl(locationId, location, locationAssets)
      return {
        name: location?.name || locationId,
        usedCollage: Boolean(collageUrl),
        collageUrl,
      }
    }),
    objectCollageResolution: objectIds.map((objectId) => {
      const object = storyObjects.find((item) => item.id === objectId)
      const collageUrl = resolveObjectCollageUrl(objectId, object, objectAssets)
      return {
        name: object?.name || objectId,
        usedCollage: Boolean(collageUrl),
        collageUrl,
      }
    }),
    coverage: {
      refLimit: coverage.refLimit,
      characterRefMapping: coverage.characterRefMapping,
      included: coverage.included,
      missingSource: coverage.missingSource,
      droppedDueToLimit: coverage.droppedDueToLimit,
      objectIncluded: objectCoverage.included,
      objectMissingSource: objectCoverage.missingSource,
      objectDroppedDueToLimit: objectCoverage.droppedDueToLimit,
      objectRefMapping: objectCoverage.objectRefMapping,
      totalSourcesBeforeCap: sources.length,
    },
    selectedSources: sources.slice(0, maxImages).map((s) => ({
      sourceType: s.sourceType,
      label: s.label,
      entityName: s.entityName,
      url: s.url,
    })),
  })

  return sources.slice(0, maxImages)
}

export function collectStoryboardReferenceUrls(
  options: CollectStoryboardReferenceOptions,
): string[] {
  return collectStoryboardReferenceSources(options).map((source) => source.url)
}

export async function loadAssignedStoryboardReferenceFiles(
  options: CollectStoryboardReferenceOptions,
): Promise<StoryboardReferenceLoadResult> {
  const sources = collectStoryboardReferenceSources(options)
  if (sources.length === 0) {
    return { files: [], loaded: [], failed: [] }
  }
  return loadStoryboardReferenceFiles(sources)
}

export function referenceFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    return decodeURIComponent(pathname.split("/").pop() || url)
  } catch {
    return url
  }
}

export function humanizeReferenceLoadError(error: string): string {
  if (error.includes("(400)")) return "File not found in storage (400)"
  if (error.includes("(404)")) return "File not found (404)"
  if (error.includes("(403)")) return "Access denied (403)"
  if (error.toLowerCase().includes("text/html") || error.includes("not a valid image")) {
    return "URL returned a web page, not an image file"
  }
  return error
}

export function getReferenceFixHint(source: StoryboardReferenceSource, error: string): string {
  const name = source.entityName || "this item"

  if (error.includes("(400)") || error.includes("(404)")) {
    switch (source.sourceType) {
      case "avatar_angle":
        return `Open Avatars, select ${name}, and re-generate or re-upload the ${source.label.split("·").pop()?.trim() || "angle"}.`
      case "character_portrait":
        return `Open Characters, select ${name}, and upload or generate a new portrait image.`
      case "character_reference":
        return `Open Characters, select ${name}, and replace reference image ${source.label.split(" ").pop()}.`
      case "character_asset":
        return `Open Characters, select ${name}, and re-upload or replace the gallery image "${source.label.split("·").pop()?.trim() || "image"}".`
      case "character_collage":
        return `Open Avatar Studio, regenerate the reference collage for ${name}, and save it to the project.`
      case "location_collage":
        return `Open Location Views, regenerate the reference collage for ${name}, and save it to the project.`
      case "location_angle":
        return `Open Location Views, select ${name}, and re-generate or re-upload the ${source.label.split("·").pop()?.trim() || "angle"}.`
      case "location_image":
        return `Open Locations, select ${name}, and upload or generate a new cover image.`
      case "location_reference":
        return `Open Locations, select ${name}, and replace the broken reference image.`
      case "object_collage":
        return `Open Object Views, regenerate the reference collage for ${name}, and save it to the project.`
      case "object_angle":
        return `Open Object Views, select ${name}, and re-generate or re-upload the ${source.label.split("·").pop()?.trim() || "angle"}.`
      case "object_image":
        return `Open Objects, select ${name}, and upload or generate a new cover image.`
      case "object_reference":
        return `Open Objects, select ${name}, and replace the broken reference image.`
      case "object_asset":
        return `Open Objects, select ${name}, and re-upload or replace the gallery image.`
      default:
        return "Re-upload or replace the image link in storage."
    }
  }

  if (error.toLowerCase().includes("text/html") || error.includes("not a valid image")) {
    const page = source.sourceType.startsWith("location")
      ? source.sourceType === "location_collage" || source.sourceType === "location_angle"
        ? "Location Views"
        : "Locations"
      : source.sourceType.startsWith("object")
        ? source.sourceType === "object_collage" || source.sourceType === "object_angle"
          ? "Object Views"
          : "Objects"
        : source.sourceType === "character_collage"
          ? "Avatar Studio"
          : source.sourceType === "avatar_angle"
            ? "Avatars"
            : "Characters"
    return `Replace this link with a direct image file URL on the ${page} page.`
  }

  const page = source.sourceType.startsWith("location")
    ? source.sourceType === "location_collage" || source.sourceType === "location_angle"
      ? "Location Views"
      : "Locations"
    : source.sourceType.startsWith("object")
      ? source.sourceType === "object_collage" || source.sourceType === "object_angle"
        ? "Object Views"
        : "Objects"
      : source.sourceType === "character_collage"
        ? "Avatar Studio"
        : source.sourceType === "avatar_angle"
          ? "Avatars"
          : "Characters"
  return `Check the image on the ${page} page for ${name}.`
}

export async function loadStoryboardReferenceFiles(
  sources: StoryboardReferenceSource[],
): Promise<StoryboardReferenceLoadResult> {
  const results = await Promise.all(
    sources.map(async (source, index) => {
      try {
        const file = await referenceUrlToFile(source.url, `storyboard-ref-${index}.png`)
        return { source, file }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        debugStoryboardImage("references-collected", {
          skippedReferenceUrl: source.url,
          skippedLabel: source.label,
          error: message,
        })
        return {
          source,
          file: null,
          error: message,
          fixHint: getReferenceFixHint(source, message),
        }
      }
    }),
  )

  const loaded = results.flatMap((result) =>
    result.file ? [{ source: result.source, file: result.file }] : [],
  )
  const failed = results.flatMap((result) =>
    result.file || !("error" in result)
      ? []
      : [
          {
            ...result.source,
            error: result.error,
            fixHint: result.fixHint,
            filename: referenceFilenameFromUrl(result.source.url),
          },
        ],
  )

  debugStoryboardImage("references-collected", {
    requestedUrls: sources.length,
    loadedFiles: loaded.length,
    skippedCount: failed.length,
    fileSizes: loaded.map((entry) => entry.file.size),
    fileTypes: loaded.map((entry) => entry.file.type),
    skipped: failed.map((entry) => ({
      label: entry.label,
      url: entry.url,
      error: entry.error,
      fixHint: entry.fixHint,
    })),
  })

  return {
    files: loaded.map((entry) => entry.file),
    loaded: loaded.map((entry) => entry.source),
    failed,
  }
}

export async function urlsToReferenceFiles(urls: string[]): Promise<File[]> {
  const result = await loadStoryboardReferenceFiles(
    urls.map((url, index) => ({
      url,
      label: `Reference ${index + 1}`,
      sourceType: "character_reference",
    })),
  )
  return result.files
}

export const SINGLE_FRAME_STORYBOARD_INSTRUCTION =
  "Generate ONE single unified cinematic storyboard frame for this shot. Do NOT create a collage, grid, contact sheet, split-screen, storyboard panel layout, or multi-image composite."

export function enrichPromptWithAssignments(
  prompt: string,
  options: {
    characterNames: string[]
    locationNames: string[]
    objectNames?: string[]
    characterDetails: string[]
    locationDetails: string[]
    objectDetails?: string[]
    masterPrompts: string[]
    referenceCount: number
    characterRefMapping?: Array<{ index: number; name: string; sourceType: string }>
    entityRefMapping?: Array<{ index: number; name: string; sourceType: string; label: string }>
  },
): string {
  let enhanced = prompt.trim()

  if (options.referenceCount > 0) {
    const refParts = [
      options.characterNames.length
        ? `character likeness for ${options.characterNames.join(", ")}`
        : null,
      options.locationNames.length
        ? `location/setting for ${options.locationNames.join(", ")}`
        : null,
      options.objectNames?.length
        ? `object/prop appearance for ${options.objectNames.join(", ")}`
        : null,
    ].filter(Boolean)
    if (refParts.length > 0) {
      enhanced = `${enhanced}. Use the attached reference image(s) only as visual inspiration for ${refParts.join(" and ")}. ${SINGLE_FRAME_STORYBOARD_INSTRUCTION}`
    } else {
      enhanced = `${enhanced}. ${SINGLE_FRAME_STORYBOARD_INSTRUCTION}`
    }

    const refMapping = options.entityRefMapping ?? options.characterRefMapping
    if (refMapping && refMapping.length > 0) {
      const mapping = refMapping
        .map((entry) => {
          const label = "label" in entry && entry.label ? entry.label : entry.sourceType
          return `reference image ${entry.index} = ${entry.name} (${label})`
        })
        .join("; ")
      enhanced = `${enhanced} Match each reference: ${mapping}.`
      if (options.characterNames.length > 0) {
        enhanced = `${enhanced} Every assigned character must appear and look like their reference — do not substitute random people.`
      }
      if (options.objectNames?.length) {
        enhanced = `${enhanced} Props, vehicles, and objects must match their reference images with the correct type and appearance (e.g. car, weapon, furniture).`
      }
    }
  }

  for (const masterPrompt of options.masterPrompts) {
    enhanced = `${enhanced} Master prompt: ${masterPrompt}.`
  }
  for (const details of options.characterDetails) {
    if (details) enhanced = `${enhanced} Character details: ${details}.`
  }
  for (const details of options.locationDetails) {
    if (details) enhanced = `${enhanced} Location details: ${details}.`
  }
  for (const details of options.objectDetails ?? []) {
    if (details) enhanced = `${enhanced} Object details: ${details}.`
  }

  return enhanced
}

export function getStoryboardAssignmentContext(
  storyboard: Storyboard,
  characters: Character[],
  locations: Location[],
  storyObjects: StoryObject[] = [],
) {
  const characterIds = getStoryboardCharacterIds(storyboard)
  const locationIds = getStoryboardLocationIds(storyboard)
  const objectIds = getStoryboardObjectIds(storyboard)
  const assignedCharacters = characterIds
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => Boolean(c))
  const assignedLocations = locationIds
    .map((id) => locations.find((l) => l.id === id))
    .filter((l): l is Location => Boolean(l))
  const assignedObjects = objectIds
    .map((id) => storyObjects.find((item) => item.id === id))
    .filter((item): item is StoryObject => Boolean(item))

  return {
    characterIds,
    locationIds,
    objectIds,
    characterNames: assignedCharacters.map((c) => c.name),
    locationNames: assignedLocations.map((l) => l.name),
    objectNames: assignedObjects.map((item) => item.name),
    characterDetails: assignedCharacters.map(buildCharacterDetailsText).filter(Boolean),
    locationDetails: assignedLocations.map(buildLocationDetailsText).filter(Boolean),
    objectDetails: assignedObjects.map(buildObjectDetailsText).filter(Boolean),
    masterPrompts: assignedCharacters
      .map((c) => c.master_prompt?.trim())
      .filter((p): p is string => Boolean(p)),
  }
}
