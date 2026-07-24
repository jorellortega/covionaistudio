import type { AvatarImageRecord } from "./avatar-images-service"
import type { Character } from "./characters-service"
import type { Location } from "./locations-service"
import type { Storyboard } from "./storyboards-service"
import { getStoryboardCharacterIds, getStoryboardLocationIds } from "./storyboard-assignments"
import { referenceUrlToFile } from "./project-image-linking"
import { isGPTImage2ApiModel } from "./image-model-utils"
import { debugStoryboardImage } from "./storyboard-image-debug"

/** GPT Image 2 edits API supports up to 16 reference images per request. */
export const GPT_IMAGE_MAX_REFERENCE_IMAGES = 16

export type StoryboardReferenceSourceType =
  | "character_portrait"
  | "character_reference"
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

export function buildQuickShotImagePrompt(
  storyboard: Storyboard,
  options?: {
    characterNames?: string[]
    locationNames?: string[]
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

export function collectStoryboardReferenceSources(options: {
  characterIds: string[]
  locationIds: string[]
  characters: Character[]
  locations: Location[]
  avatarImages: AvatarImageRecord[]
  maxImages: number
}): StoryboardReferenceSource[] {
  const { characterIds, locationIds, characters, locations, avatarImages, maxImages } = options
  const sources: StoryboardReferenceSource[] = []
  const seen = new Set<string>()

  const addSource = (source: StoryboardReferenceSource) => {
    if (!source.url || seen.has(source.url) || sources.length >= maxImages) return
    seen.add(source.url)
    sources.push(source)
  }

  const avatarsForCharacter = (characterId: string) =>
    avatarImages.filter((img) => img.character_id === characterId && img.image_url)

  for (const characterId of characterIds) {
    const character = characters.find((c) => c.id === characterId)
    const name = character?.name || "Character"
    const avatars = avatarsForCharacter(characterId)
    const front = avatars.find((a) => a.angle_id === "front")
    const primaryAvatar = front ?? avatars[0]

    if (primaryAvatar?.image_url) {
      addSource({
        url: primaryAvatar.image_url,
        label: `${name} · Avatar (${primaryAvatar.angle_id || "angle"})`,
        sourceType: "avatar_angle",
        entityId: characterId,
        entityName: name,
      })
    }

    if (character?.image_url) {
      addSource({
        url: character.image_url,
        label: `${name} · Portrait`,
        sourceType: "character_portrait",
        entityId: characterId,
        entityName: name,
      })
    }

    for (const [index, ref] of (character?.reference_images ?? []).entries()) {
      addSource({
        url: ref,
        label: `${name} · Reference image ${index + 1}`,
        sourceType: "character_reference",
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

  for (const characterId of characterIds) {
    const character = characters.find((c) => c.id === characterId)
    const name = character?.name || "Character"
    for (const avatar of avatarsForCharacter(characterId)) {
      if (!avatar.image_url || seen.has(avatar.image_url)) continue
      addSource({
        url: avatar.image_url,
        label: `${name} · Avatar (${avatar.angle_id || "angle"})`,
        sourceType: "avatar_angle",
        entityId: characterId,
        entityName: name,
      })
    }
  }

  return sources.slice(0, maxImages)
}

export function collectStoryboardReferenceUrls(options: {
  characterIds: string[]
  locationIds: string[]
  characters: Character[]
  locations: Location[]
  avatarImages: AvatarImageRecord[]
  maxImages: number
}): string[] {
  return collectStoryboardReferenceSources(options).map((source) => source.url)
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
      case "location_image":
        return `Open Locations, select ${name}, and upload or generate a new cover image.`
      case "location_reference":
        return `Open Locations, select ${name}, and replace the broken reference image.`
      default:
        return "Re-upload or replace the image link in storage."
    }
  }

  if (error.toLowerCase().includes("text/html") || error.includes("not a valid image")) {
    return `Replace this link with a direct image file URL on the ${source.sourceType.startsWith("location") ? "Locations" : source.sourceType === "avatar_angle" ? "Avatars" : "Characters"} page.`
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

export function enrichPromptWithAssignments(
  prompt: string,
  options: {
    characterNames: string[]
    locationNames: string[]
    characterDetails: string[]
    locationDetails: string[]
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
    ].filter(Boolean)
    if (refParts.length > 0) {
      enhanced = `${enhanced}. Use the attached reference image(s) for ${refParts.join(" and ")}.`
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

  return enhanced
}

export function getStoryboardAssignmentContext(
  storyboard: Storyboard,
  characters: Character[],
  locations: Location[],
) {
  const characterIds = getStoryboardCharacterIds(storyboard)
  const locationIds = getStoryboardLocationIds(storyboard)
  const assignedCharacters = characterIds
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => Boolean(c))
  const assignedLocations = locationIds
    .map((id) => locations.find((l) => l.id === id))
    .filter((l): l is Location => Boolean(l))

  return {
    characterIds,
    locationIds,
    characterNames: assignedCharacters.map((c) => c.name),
    locationNames: assignedLocations.map((l) => l.name),
    characterDetails: assignedCharacters.map(buildCharacterDetailsText).filter(Boolean),
    locationDetails: assignedLocations.map(buildLocationDetailsText).filter(Boolean),
    masterPrompts: assignedCharacters
      .map((c) => c.master_prompt?.trim())
      .filter((p): p is string => Boolean(p)),
  }
}
