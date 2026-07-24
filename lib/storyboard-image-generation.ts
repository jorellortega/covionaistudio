import type { AvatarImageRecord } from "./avatar-images-service"
import type { Character } from "./characters-service"
import type { Location } from "./locations-service"
import type { Storyboard } from "./storyboards-service"
import { getStoryboardCharacterIds, getStoryboardLocationIds } from "./storyboard-assignments"
import { referenceUrlToFile } from "./project-image-linking"
import { isGPTImage2ApiModel } from "./image-model-utils"

/** GPT Image 2 edits API supports up to 16 reference images per request. */
export const GPT_IMAGE_MAX_REFERENCE_IMAGES = 16

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

export function collectStoryboardReferenceUrls(options: {
  characterIds: string[]
  locationIds: string[]
  characters: Character[]
  locations: Location[]
  avatarImages: AvatarImageRecord[]
  maxImages: number
}): string[] {
  const { characterIds, locationIds, characters, locations, avatarImages, maxImages } = options
  const urls: string[] = []
  const seen = new Set<string>()

  const addUrl = (url?: string | null) => {
    if (!url || seen.has(url) || urls.length >= maxImages) return
    seen.add(url)
    urls.push(url)
  }

  const avatarsForCharacter = (characterId: string) =>
    avatarImages.filter((img) => img.character_id === characterId && img.image_url)

  for (const characterId of characterIds) {
    const avatars = avatarsForCharacter(characterId)
    const front = avatars.find((a) => a.angle_id === "front")
    addUrl(front?.image_url ?? avatars[0]?.image_url)

    const character = characters.find((c) => c.id === characterId)
    addUrl(character?.image_url)
    for (const ref of character?.reference_images ?? []) {
      addUrl(ref)
    }
  }

  for (const locationId of locationIds) {
    const location = locations.find((l) => l.id === locationId)
    addUrl(location?.image_url)
    for (const ref of location?.reference_images ?? []) {
      addUrl(ref)
    }
  }

  for (const characterId of characterIds) {
    for (const avatar of avatarsForCharacter(characterId)) {
      addUrl(avatar.image_url)
    }
  }

  return urls.slice(0, maxImages)
}

export async function urlsToReferenceFiles(urls: string[]): Promise<File[]> {
  const files: File[] = []
  for (let index = 0; index < urls.length; index++) {
    try {
      files.push(await referenceUrlToFile(urls[index], `storyboard-ref-${index}.png`))
    } catch (error) {
      console.warn("[storyboard-image-generation] skipped reference URL:", urls[index], error)
    }
  }
  return files
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
