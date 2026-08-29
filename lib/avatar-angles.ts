import { SINGLE_ANGLE_SHOT_INSTRUCTION } from "@/lib/angle-shot-prompt"

/** Saved multi-angle reference sheet used as a single AI reference image. */
export const AVATAR_REFERENCE_COLLAGE_ANGLE_ID = "reference_collage"

/** Runway / DALL-E 2 style cap. GPT Image 2 can take much more. */
export const AVATAR_PROMPT_MAX_DEFAULT = 990
export const AVATAR_PROMPT_MAX_GPT_IMAGE = 8000

export interface AvatarAngle {
  id: string
  label: string
  shortLabel: string
  prompt: string
  isCustom?: boolean
}

type AvatarPromptOptions = {
  maxLength?: number
  /** Isolate the character with no environment. Defaults to true. */
  noBackground?: boolean
}

const NO_BACKGROUND_INSTRUCTION =
  "NO BACKGROUND — isolate the character only on a plain empty seamless studio void. No environment, landscape, set, scenery, ground, or scene. Do not copy any background from a reference. Character cutout only, clean edges."

/** Practical shot types for scene prep — not redundant left/right turnarounds. */
export const AVATAR_ANGLES: AvatarAngle[] = [
  {
    id: "front",
    label: "Front",
    shortLabel: "Front",
    prompt:
      "FRONT VIEW ONLY — subject faces the camera, both eyes visible, chest toward camera, not a 3/4 turn or profile",
  },
  {
    id: "side",
    label: "Side",
    shortLabel: "Side",
    prompt:
      "TRUE 90-DEGREE SIDE PROFILE ONLY — camera is beside the subject, only one eye and one ear visible, face does not look at the camera",
  },
  {
    id: "back",
    label: "Back",
    shortLabel: "Back",
    prompt:
      "BACK VIEW ONLY — camera is directly behind the subject, back of head, hair, and shoulders, face must not be visible",
  },
  {
    id: "wide_full_body",
    label: "Wide — Full Body",
    shortLabel: "Wide",
    prompt:
      "WIDE FULL-BODY SHOT — head to toe visible, standing pose, entire outfit and proportions clear, cinematic distance",
  },
  {
    id: "close_up",
    label: "Close-Up — Face",
    shortLabel: "Close-up",
    prompt:
      "TIGHT CLOSE-UP OF THE FACE ONLY — dialogue-ready framing, detailed eyes and facial features, shallow depth of field",
  },
  {
    id: "clothing",
    label: "Clothing Detail",
    shortLabel: "Clothing",
    prompt:
      "OUTFIT DETAIL SHOT — torso and costume focus, jacket, shirt, accessories, fabric texture and wardrobe clearly visible",
  },
  {
    id: "feet_shoes",
    label: "Feet & Shoes",
    shortLabel: "Feet",
    prompt:
      "LOWER BODY DETAIL — feet and shoes in frame, pants hem and footwear clearly visible, ground-level angle",
  },
]

/** Core turnaround + full body — good default batch. */
export const AVATAR_TURNAROUND_ANGLE_IDS = [
  "front",
  "side",
  "back",
  "wide_full_body",
] as const

export function avatarPromptMaxLength(apiModel?: string, service?: string): number {
  const model = (apiModel || "").toLowerCase()
  const svc = (service || "").toLowerCase()
  if (svc === "runway" || model.includes("runway") || model.includes("gen4")) {
    return AVATAR_PROMPT_MAX_DEFAULT
  }
  if (model.includes("dall-e-2") || model.includes("dalle-2")) {
    return AVATAR_PROMPT_MAX_DEFAULT
  }
  if (model.includes("gpt-image")) {
    return AVATAR_PROMPT_MAX_GPT_IMAGE
  }
  if (model.includes("dall-e-3") || model.includes("dalle")) {
    return 4000
  }
  return 4000
}

export function createCustomAvatarAngle(label: string, prompt: string): AvatarAngle {
  const trimmedLabel = label.trim()
  const trimmedPrompt = prompt.trim()
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const shortLabel = trimmedLabel.split(/\s+/)[0]?.slice(0, 10) || "Custom"
  return {
    id,
    label: trimmedLabel,
    shortLabel,
    prompt: trimmedPrompt,
    isCustom: true,
  }
}

function joinPriorityPrompt(priority: string[], optional: string[], maxLength: number): string {
  const head = priority.filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  const rest = optional.filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  if (!rest) return head.slice(0, maxLength)
  const separator = " "
  const budget = maxLength - head.length - separator.length
  if (budget < 24) return head.slice(0, maxLength)
  const trimmedRest = rest.length > budget ? rest.slice(0, budget).trimEnd() : rest
  return `${head}${separator}${trimmedRest}`
}

function cameraRequirement(angle: AvatarAngle, fromReference: boolean): string {
  const orbit = fromReference
    ? "The attached image is identity and wardrobe reference ONLY. Do NOT copy its camera angle, pose, or framing. Orbit the camera to a different shot."
    : "The camera view is mandatory and must match exactly."
  return `${orbit} REQUIRED CAMERA: ${angle.prompt}.`
}

export function buildAvatarEditPrompt(
  characterName: string,
  description: string,
  angle: AvatarAngle,
  style: string,
  options?: AvatarPromptOptions,
): string {
  const maxLength = options?.maxLength ?? AVATAR_PROMPT_MAX_DEFAULT
  const noBackground = options?.noBackground ?? true
  const namePart = characterName.trim() ? `Character: ${characterName.trim()}.` : ""
  const descPart = description.trim() ? description.trim() : ""
  const stylePart = style.trim() ? `Look: ${style.trim()}.` : ""

  return joinPriorityPrompt(
    [
      cameraRequirement(angle, true),
      SINGLE_ANGLE_SHOT_INSTRUCTION,
      noBackground ? NO_BACKGROUND_INSTRUCTION : "",
      "Keep the exact same character likeness, face, hair, clothing, colors, and materials from the reference. Change only the camera and framing.",
      "Single character only, no text, no watermark.",
    ],
    [
      namePart,
      descPart,
      stylePart,
      "Even lighting, production reference quality.",
    ],
    maxLength,
  )
}

export function buildAvatarPrompt(
  characterName: string,
  description: string,
  angle: AvatarAngle,
  style: string,
  options?: AvatarPromptOptions,
): string {
  const maxLength = options?.maxLength ?? AVATAR_PROMPT_MAX_DEFAULT
  const noBackground = options?.noBackground ?? true
  const namePart = characterName.trim() ? `Character: ${characterName.trim()}.` : ""
  const descPart = description.trim() ? description.trim() : ""
  const stylePart = style.trim() ? `Style: ${style.trim()}.` : ""

  return joinPriorityPrompt(
    [
      cameraRequirement(angle, false),
      SINGLE_ANGLE_SHOT_INSTRUCTION,
      noBackground ? NO_BACKGROUND_INSTRUCTION : "",
      "Professional character reference image for film production. Consistent character likeness, cinematic lighting, production-ready.",
      "Single character only, no text, no watermark.",
    ],
    [
      namePart,
      descPart,
      stylePart,
    ],
    maxLength,
  )
}
