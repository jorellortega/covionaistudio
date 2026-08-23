import { SINGLE_ANGLE_SHOT_INSTRUCTION } from "@/lib/angle-shot-prompt"

/** Saved multi-angle reference sheet used as a single AI reference image. */
export const OBJECT_REFERENCE_COLLAGE_ANGLE_ID = "reference_collage"

export interface ObjectAngle {
  id: string
  label: string
  shortLabel: string
  prompt: string
  isCustom?: boolean
}

/** Practical views for props, vehicles, and story objects. */
export const OBJECT_ANGLES: ObjectAngle[] = [
  {
    id: "front",
    label: "Front",
    shortLabel: "Front",
    prompt:
      "front-facing product shot, object centered, clear silhouette, materials and markings visible",
  },
  {
    id: "side",
    label: "Side",
    shortLabel: "Side",
    prompt: "clean side profile view, 90 degree angle, full object silhouette and depth",
  },
  {
    id: "back",
    label: "Back",
    shortLabel: "Back",
    prompt: "back view showing rear details, opposite face, and overall form",
  },
  {
    id: "top",
    label: "Top Down",
    shortLabel: "Top",
    prompt: "top-down overhead view, bird's eye angle, layout and surface details visible",
  },
  {
    id: "detail",
    label: "Detail Close-Up",
    shortLabel: "Detail",
    prompt:
      "tight macro close-up highlighting surface texture, wear, markings, and fine details",
  },
  {
    id: "scale",
    label: "Scale Reference",
    shortLabel: "Scale",
    prompt:
      "object beside a familiar item or held in hand to communicate size and proportions",
  },
  {
    id: "in_context",
    label: "In Context",
    shortLabel: "Scene",
    prompt:
      "object placed naturally in its story environment, cinematic still life, contextual placement",
  },
]

/** Core turnaround views — good default batch. */
export const OBJECT_TURNAROUND_ANGLE_IDS = ["front", "side", "back", "top"] as const

export function createCustomObjectAngle(label: string, prompt: string): ObjectAngle {
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

export function buildObjectAngleEditPrompt(
  angle: ObjectAngle,
  object: {
    name: string
    visual_description?: string | null
    material?: string | null
    color?: string | null
  },
): string {
  const details = [
    object.visual_description?.trim(),
    object.material?.trim() && `Material: ${object.material.trim()}`,
    object.color?.trim() && `Color: ${object.color.trim()}`,
  ]
    .filter(Boolean)
    .join(". ")

  return [
    SINGLE_ANGLE_SHOT_INSTRUCTION,
    `Change only the camera angle and framing to: ${angle.prompt}.`,
    details ? `${details}.` : "",
    "Edit the attached reference image only. Keep the same object design, materials, proportions, wear, and style.",
    "Photoreal product photography, studio or cinematic lighting, production reference quality.",
    "No text, no typography, no captions, no labels, no watermark, no written words.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 990)
}
