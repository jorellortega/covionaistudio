export interface AvatarAngle {
  id: string
  label: string
  shortLabel: string
  prompt: string
}

/** Practical shot types for scene prep — not redundant left/right turnarounds. */
export const AVATAR_ANGLES: AvatarAngle[] = [
  {
    id: "front",
    label: "Front",
    shortLabel: "Front",
    prompt:
      "front-facing shot, character looking at camera, medium framing from chest up, clear face and upper body",
  },
  {
    id: "side",
    label: "Side",
    shortLabel: "Side",
    prompt:
      "clean side profile view, 90 degree angle, full silhouette of head, hair, and shoulders",
  },
  {
    id: "back",
    label: "Back",
    shortLabel: "Back",
    prompt:
      "back view, showing back of head, hair, shoulders, and upper back",
  },
  {
    id: "wide_full_body",
    label: "Wide — Full Body",
    shortLabel: "Wide",
    prompt:
      "wide full-body shot, head to toe visible, standing pose, entire outfit and proportions clear, cinematic distance",
  },
  {
    id: "close_up",
    label: "Close-Up — Face",
    shortLabel: "Close-up",
    prompt:
      "tight close-up of face only, dialogue-ready framing, detailed eyes and facial features, shallow depth of field",
  },
  {
    id: "clothing",
    label: "Clothing Detail",
    shortLabel: "Clothing",
    prompt:
      "outfit detail shot, torso and costume focus, jacket, shirt, accessories, fabric texture and wardrobe clearly visible",
  },
  {
    id: "feet_shoes",
    label: "Feet & Shoes",
    shortLabel: "Feet",
    prompt:
      "lower body detail shot, feet and shoes in frame, pants hem and footwear clearly visible, ground-level angle",
  },
]

/** Core turnaround + full body — good default batch. */
export const AVATAR_TURNAROUND_ANGLE_IDS = [
  "front",
  "side",
  "back",
  "wide_full_body",
] as const

export function buildAvatarEditPrompt(
  characterName: string,
  description: string,
  angle: AvatarAngle,
  style: string,
): string {
  const namePart = characterName.trim() ? `Character: ${characterName.trim()}. ` : ""
  const descPart = description.trim() ? `${description.trim()}. ` : ""
  return [
    "Keep the exact same character likeness, face, hair, clothing, and style from the reference image.",
    namePart + descPart,
    `Change only the shot framing to: ${angle.prompt}.`,
    `Maintain ${style} style.`,
    "Consistent wardrobe and appearance, even lighting, production reference quality.",
    "Single character only, no text, no watermark.",
  ].join(" ").slice(0, 990)
}

export function buildAvatarPrompt(
  characterName: string,
  description: string,
  angle: AvatarAngle,
  style: string,
): string {
  const namePart = characterName.trim() ? `Character: ${characterName.trim()}. ` : ""
  const descPart = description.trim() ? `${description.trim()}. ` : ""
  return [
    "Professional character reference image for film production.",
    namePart + descPart,
    angle.prompt + ".",
    `Style: ${style}.`,
    "Consistent character likeness, cinematic lighting, production-ready reference.",
    "Single character only, no text, no watermark.",
  ].join(" ")
}
