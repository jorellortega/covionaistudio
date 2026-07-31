import type { Asset } from "./asset-service"
import type { AvatarImageRecord } from "./avatar-images-service"
import type { Character } from "./characters-service"
import type { Location } from "./locations-service"
import type { StoryObject } from "./story-objects-service"
import type { Storyboard } from "./storyboards-service"
import {
  getStoryboardCharacterIds,
  getStoryboardLocationIds,
  getStoryboardObjectIds,
} from "./storyboard-assignments"
import { AVATAR_REFERENCE_COLLAGE_ANGLE_ID } from "./avatar-angles"
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

export function storyboardReferenceImageLimit(apiModel?: string | null): number {
  return Math.min(maxReferenceImagesForModel(apiModel), STORYBOARD_MAX_REFERENCE_IMAGES)
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
    storyboard.dialogue?.trim()
      ? `Dialogue context: ${storyboard.dialogue.trim()}`
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
    object.category && `Category: ${object.category}`,
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

export type CollectStoryboardReferenceOptions = {
  characterIds: string[]
  locationIds: string[]
  characters: Character[]
  locations: Location[]
  avatarImages: AvatarImageRecord[]
  /** Linked project assets (character_id set) — used when portrait/reference URLs are stale */
  characterAssets?: Asset[]
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
    characters,
    locations,
    avatarImages,
    characterAssets = [],
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

  for (const characterId of characterIds) {
    const character = characters.find((c) => c.id === characterId)
    const name = character?.name || "Character"
    const collageUrl = resolveCharacterCollageUrl(
      characterId,
      character,
      avatarImages,
      characterAssets,
    )

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
    const orderedAvatars = [
      ...(front ? [front] : []),
      ...avatars.filter((a) => a !== front && a.angle_id !== AVATAR_REFERENCE_COLLAGE_ANGLE_ID),
    ]

    for (const avatar of orderedAvatars) {
      if (!avatar.image_url || seen.has(avatar.image_url)) continue
      addSource({
        url: avatar.image_url,
        label: `${name} · Avatar (${avatar.angle_id || "angle"})`,
        sourceType: "avatar_angle",
        entityId: characterId,
        entityName: name,
      })
    }

    for (const asset of characterAssets.filter(
      (a) =>
        a.character_id === characterId &&
        a.content_type === "image" &&
        a.content_url &&
        !isCollageAsset(a),
    )) {
      addSource({
        url: asset.content_url!,
        label: `${name} · ${asset.title?.trim() || "Gallery image"}`,
        sourceType: "character_asset",
        entityId: characterId,
        entityName: name,
      })
    }

    const portraitUrl = character?.image_url?.trim()
    for (const [index, ref] of (character?.reference_images ?? []).entries()) {
      if (!ref || ref === portraitUrl) continue
      addSource({
        url: ref,
        label: `${name} · Reference image ${index + 1}`,
        sourceType: "character_reference",
        entityId: characterId,
        entityName: name,
      })
    }

    const addedCharacterSources = sources.length > sourceCountBefore
    if (!addedCharacterSources && portraitUrl) {
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

    if (location?.image_url) {
      addSource({
        url: location.image_url,
        label: `${name} · Cover image`,
        sourceType: "location_image",
        entityId: locationId,
        entityName: name,
      })
    }

    for (const [index, ref] of (location?.reference_images ?? []).entries()) {
      addSource({
        url: ref,
        label: `${name} · Reference image ${index + 1}`,
        sourceType: "location_reference",
        entityId: locationId,
        entityName: name,
      })
    }
  }

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
      case "location_image":
        return `Open Locations, select ${name}, and upload or generate a new cover image.`
      case "location_reference":
        return `Open Locations, select ${name}, and replace the broken reference image.`
      default:
        return "Re-upload or replace the image link in storage."
    }
  }

  if (error.toLowerCase().includes("text/html") || error.includes("not a valid image")) {
    return `Replace this link with a direct image file URL on the ${source.sourceType.startsWith("location") ? "Locations" : source.sourceType === "character_collage" ? "Avatar Studio" : source.sourceType === "avatar_angle" ? "Avatars" : "Characters"} page.`
  }

  return `Check the image on the ${source.sourceType.startsWith("location") ? "Locations" : source.sourceType === "avatar_angle" ? "Avatars" : "Characters"} page for ${name}.`
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
