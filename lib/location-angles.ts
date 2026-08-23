import { SINGLE_ANGLE_SHOT_INSTRUCTION } from "@/lib/angle-shot-prompt"

/** Saved multi-angle reference sheet used as a single AI reference image. */
export const LOCATION_REFERENCE_COLLAGE_ANGLE_ID = "reference_collage"

export interface LocationAngle {
  id: string
  label: string
  shortLabel: string
  prompt: string
  isCustom?: boolean
}

/** Practical camera views for location reference sheets. */
export const LOCATION_ANGLES: LocationAngle[] = [
  {
    id: "establishing",
    label: "Establishing Wide",
    shortLabel: "Wide",
    prompt:
      "wide establishing shot of the full location, environment and spatial layout clearly visible, cinematic depth",
  },
  {
    id: "eye_level",
    label: "Eye Level",
    shortLabel: "Eye",
    prompt:
      "natural eye-level view into the space, human perspective, balanced composition, immersive framing",
  },
  {
    id: "low_angle",
    label: "Low Angle",
    shortLabel: "Low",
    prompt:
      "low angle looking upward, dramatic perspective, architecture and scale emphasized, cinematic tension",
  },
  {
    id: "high_angle",
    label: "High Angle",
    shortLabel: "High",
    prompt:
      "elevated high angle looking down into the location, overview of layout, spatial relationships clear",
  },
  {
    id: "birds_eye",
    label: "Bird's Eye",
    shortLabel: "Aerial",
    prompt:
      "overhead bird's eye view, top-down perspective of the location layout, map-like spatial clarity",
  },
  {
    id: "detail",
    label: "Architectural Detail",
    shortLabel: "Detail",
    prompt:
      "tight detail shot of distinctive architectural features, textures, signage, or key set dressing",
  },
  {
    id: "reverse",
    label: "Reverse Angle",
    shortLabel: "Reverse",
    prompt:
      "reverse angle from the opposite direction, same location and lighting, different viewpoint",
  },
]

/** Core coverage set — good default batch. */
export const LOCATION_TURNAROUND_ANGLE_IDS = [
  "establishing",
  "eye_level",
  "low_angle",
  "high_angle",
] as const

export function createCustomLocationAngle(label: string, prompt: string): LocationAngle {
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

export function buildLocationAngleEditPrompt(
  angle: LocationAngle,
  location: {
    name: string
    visual_description?: string | null
    atmosphere?: string | null
    mood?: string | null
    lighting_notes?: string | null
    type?: string | null
  },
): string {
  const details = [
    location.visual_description?.trim(),
    location.type?.trim() && `Type: ${location.type.trim()}`,
    location.atmosphere?.trim() && `Atmosphere: ${location.atmosphere.trim()}`,
    location.mood?.trim() && `Mood: ${location.mood.trim()}`,
    location.lighting_notes?.trim() && `Lighting: ${location.lighting_notes.trim()}`,
  ]
    .filter(Boolean)
    .join(". ")

  return [
    SINGLE_ANGLE_SHOT_INSTRUCTION,
    `Change only the camera angle and framing to: ${angle.prompt}.`,
    details ? `${details}.` : "",
    "Edit the attached reference image only. Keep the same location, architecture, set dressing, time of day, lighting, and world — change only the camera view described above.",
    "Photoreal cinematic location photography, production reference quality.",
    "No text, no typography, no captions, no labels, no watermark, no written words.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 990)
}
