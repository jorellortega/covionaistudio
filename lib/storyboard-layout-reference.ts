import type { Storyboard } from "./storyboards-service"

export const STORYBOARD_LAYOUT_REFERENCE_URL_KEY = "layout_reference_url"
export const STORYBOARD_LAYOUT_REFERENCE_LABEL_KEY = "layout_reference_label"
export const STORYBOARD_LAYOUT_REFERENCE_SHOT_ID_KEY = "layout_reference_storyboard_id"

export type StoryboardLayoutReference = {
  url: string | null
  label: string | null
  sourceStoryboardId: string | null
}

export function getStoryboardLayoutReference(
  storyboard: { metadata?: Record<string, unknown> | null },
): StoryboardLayoutReference {
  const metadata = storyboard.metadata ?? {}
  const url =
    typeof metadata[STORYBOARD_LAYOUT_REFERENCE_URL_KEY] === "string"
      ? metadata[STORYBOARD_LAYOUT_REFERENCE_URL_KEY].trim()
      : ""
  const label =
    typeof metadata[STORYBOARD_LAYOUT_REFERENCE_LABEL_KEY] === "string"
      ? metadata[STORYBOARD_LAYOUT_REFERENCE_LABEL_KEY].trim()
      : ""
  const sourceStoryboardId =
    typeof metadata[STORYBOARD_LAYOUT_REFERENCE_SHOT_ID_KEY] === "string"
      ? metadata[STORYBOARD_LAYOUT_REFERENCE_SHOT_ID_KEY].trim()
      : ""

  return {
    url: url || null,
    label: label || null,
    sourceStoryboardId: sourceStoryboardId || null,
  }
}

export function buildStoryboardLayoutMetadataPatch(
  existingMetadata: Record<string, unknown> | null | undefined,
  layout: StoryboardLayoutReference | null,
): Record<string, unknown> {
  const base = { ...(existingMetadata ?? {}) }
  if (!layout?.url) {
    delete base[STORYBOARD_LAYOUT_REFERENCE_URL_KEY]
    delete base[STORYBOARD_LAYOUT_REFERENCE_LABEL_KEY]
    delete base[STORYBOARD_LAYOUT_REFERENCE_SHOT_ID_KEY]
    return base
  }
  base[STORYBOARD_LAYOUT_REFERENCE_URL_KEY] = layout.url
  base[STORYBOARD_LAYOUT_REFERENCE_LABEL_KEY] = layout.label ?? "Layout reference"
  if (layout.sourceStoryboardId) {
    base[STORYBOARD_LAYOUT_REFERENCE_SHOT_ID_KEY] = layout.sourceStoryboardId
  } else {
    delete base[STORYBOARD_LAYOUT_REFERENCE_SHOT_ID_KEY]
  }
  return base
}

export const LAYOUT_REFERENCE_PROMPT_INSTRUCTION =
  "Reference image 1 is the blocking/layout guide — match its camera angle, framing, depth, and the exact position of each person in the frame. Do NOT copy faces or clothing from reference image 1."

export const LAYOUT_FACE_SWAP_INSTRUCTION =
  "Reference image 1 is the current shot composition only — keep every body position and pose from image 1, but replace ALL faces using reference images 2 and onward. Do not keep any face from image 1."

export function enrichPromptWithLayoutReference(
  prompt: string,
  options?: {
    layoutLabel?: string | null
    characterNames?: string[]
    layoutMatchesCurrentShot?: boolean
  },
): string {
  let enhanced = prompt.trim()
  const label = options?.layoutLabel?.trim()
  enhanced = `${enhanced}. ${LAYOUT_REFERENCE_PROMPT_INSTRUCTION}`
  if (options?.layoutMatchesCurrentShot) {
    enhanced = `${enhanced} ${LAYOUT_FACE_SWAP_INSTRUCTION}`
  }
  if (label) {
    enhanced = `${enhanced} Layout reference: ${label}.`
  }
  if (options?.characterNames?.length) {
    const start = 2
    const mapping = options.characterNames
      .map((name, i) => `reference image ${start + i} = ${name} (face and wardrobe)`)
      .join("; ")
    enhanced = `${enhanced} Character face references: ${mapping}. Place each named character in the same position as the matching person in reference image 1.`
  }
  return enhanced
}

export function patchStoryboardWithLayoutReference(
  storyboard: Storyboard,
  layout: StoryboardLayoutReference | null,
): Storyboard {
  return {
    ...storyboard,
    metadata: buildStoryboardLayoutMetadataPatch(storyboard.metadata, layout),
  }
}
