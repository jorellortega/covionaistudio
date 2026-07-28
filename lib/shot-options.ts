export const SHOT_TYPE_OPTIONS = [
  { value: "wide", label: "Wide Shot" },
  { value: "medium", label: "Medium Shot" },
  { value: "close", label: "Close Up" },
  { value: "extreme-close", label: "Extreme Close Up" },
  { value: "two-shot", label: "Two Shot" },
  { value: "over-the-shoulder", label: "Over the Shoulder" },
  { value: "point-of-view", label: "Point of View" },
  { value: "establishing", label: "Establishing" },
  { value: "insert", label: "Insert" },
  { value: "cutaway", label: "Cutaway" },
] as const

export type ShotTypeValue = (typeof SHOT_TYPE_OPTIONS)[number]["value"]

export const STORYBOARD_SHOT_TYPE_VALUES = new Set<string>(
  SHOT_TYPE_OPTIONS.map((option) => option.value),
)

export const CAMERA_ANGLE_OPTIONS = [
  { value: "eye-level", label: "Eye Level" },
  { value: "high-angle", label: "High Angle" },
  { value: "low-angle", label: "Low Angle" },
  { value: "dutch-angle", label: "Dutch Angle" },
  { value: "bird-eye", label: "Bird's Eye" },
  { value: "worm-eye", label: "Worm's Eye" },
] as const

export type CameraAngleValue = (typeof CAMERA_ANGLE_OPTIONS)[number]["value"]

export const CAMERA_ANGLE_VALUES = new Set<string>(
  CAMERA_ANGLE_OPTIONS.map((option) => option.value),
)

export const MOVEMENT_OPTIONS = [
  { value: "static", label: "Static" },
  { value: "panning", label: "Panning" },
  { value: "pan-left", label: "Pan Left" },
  { value: "pan-right", label: "Pan Right" },
  { value: "tilting", label: "Tilting" },
  { value: "tilt-up", label: "Tilt Up" },
  { value: "tilt-down", label: "Tilt Down" },
  { value: "tracking", label: "Tracking" },
  { value: "zooming", label: "Zooming" },
  { value: "zoom-in", label: "Zoom In" },
  { value: "zoom-out", label: "Zoom Out" },
  { value: "dolly", label: "Dolly" },
  { value: "dolly-in", label: "Dolly In" },
  { value: "dolly-out", label: "Dolly Out" },
  { value: "push-in", label: "Push In" },
  { value: "pull-out", label: "Pull Out" },
  { value: "crane", label: "Crane / Jib" },
  { value: "handheld", label: "Handheld" },
  { value: "steadicam", label: "Steadicam / Gimbal" },
  { value: "orbit", label: "Orbit / Arc" },
  { value: "whip-pan", label: "Whip Pan" },
] as const

export type MovementValue = (typeof MOVEMENT_OPTIONS)[number]["value"]

export const MOVEMENT_VALUES = new Set<string>(MOVEMENT_OPTIONS.map((option) => option.value))

export function formatShotTypeLabel(value: string | null | undefined): string {
  if (!value) return ""
  return SHOT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value.replace(/-/g, " ")
}

export function formatCameraAngleLabel(value: string | null | undefined): string {
  if (!value) return ""
  return CAMERA_ANGLE_OPTIONS.find((option) => option.value === value)?.label ?? value.replace(/-/g, " ")
}

export function formatMovementLabel(value: string | null | undefined): string {
  if (!value) return ""
  return MOVEMENT_OPTIONS.find((option) => option.value === value)?.label ?? value.replace(/-/g, " ")
}

export function resolveMovementValue(value: string | null | undefined): string {
  if (!value) return "static"
  const normalized = value.toLowerCase().trim()
  if (MOVEMENT_VALUES.has(normalized)) return normalized
  if (normalized.includes("whip")) return "whip-pan"
  if (normalized.includes("orbit") || normalized.includes("arc")) return "orbit"
  if (normalized.includes("push")) return "push-in"
  if (normalized.includes("pull")) return "pull-out"
  if (normalized.includes("dolly-in") || normalized === "dolly in") return "dolly-in"
  if (normalized.includes("dolly-out") || normalized === "dolly out") return "dolly-out"
  if (normalized.includes("dolly")) return "dolly"
  if (normalized.includes("pan-left") || normalized === "pan left") return "pan-left"
  if (normalized.includes("pan-right") || normalized === "pan right") return "pan-right"
  if (normalized.includes("pan")) return "panning"
  if (normalized.includes("tilt-up") || normalized === "tilt up") return "tilt-up"
  if (normalized.includes("tilt-down") || normalized === "tilt down") return "tilt-down"
  if (normalized.includes("tilt")) return "tilting"
  if (normalized.includes("zoom-in") || normalized === "zoom in") return "zoom-in"
  if (normalized.includes("zoom-out") || normalized === "zoom out") return "zoom-out"
  if (normalized.includes("zoom")) return "zooming"
  if (normalized.includes("track") || normalized.includes("follow")) return "tracking"
  if (normalized.includes("crane") || normalized.includes("jib")) return "crane"
  if (normalized.includes("handheld") || normalized.includes("hand-held")) return "handheld"
  if (normalized.includes("steadicam") || normalized.includes("gimbal") || normalized.includes("steady")) {
    return "steadicam"
  }
  return "static"
}

export function resolveCameraAngleValue(value: string | null | undefined): string {
  if (!value) return "eye-level"
  const normalized = value.toLowerCase().trim()
  if (CAMERA_ANGLE_VALUES.has(normalized)) return normalized
  if (normalized.includes("bird") || normalized.includes("aerial") || normalized.includes("overhead")) {
    return "bird-eye"
  }
  if (normalized.includes("worm") || normalized.includes("ground")) return "worm-eye"
  if (normalized.includes("high") || normalized.includes("above")) return "high-angle"
  if (normalized.includes("low") || normalized.includes("below")) return "low-angle"
  if (normalized.includes("dutch") || normalized.includes("tilted")) return "dutch-angle"
  return "eye-level"
}
