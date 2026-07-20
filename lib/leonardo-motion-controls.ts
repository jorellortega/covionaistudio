/**
 * Leonardo Motion 2.0 camera / effect controls.
 * Source: https://docs.leonardo.ai/docs/generate-with-motion-2-using-generated-images
 */

export type LeonardoMotionControl = {
  id: string
  label: string
  akUUID: string
}

/** Official Motion Control options (akUUID from Leonardo docs). */
export const LEONARDO_MOTION_CONTROLS: LeonardoMotionControl[] = [
  { id: "BULLET_TIME", label: "Bullet Time", akUUID: "fbed015e-594e-4f78-b4be-3b07142aaa1e" },
  { id: "CRANE_DOWN", label: "Crane Down", akUUID: "5a1d2a6a-7709-4097-9158-1b7ae6c9e647" },
  { id: "CRANE_OVER_HEAD", label: "Crane Over Head", akUUID: "1054d533-168c-4821-bd3d-a56182afa4f3" },
  { id: "CRANE_UP", label: "Crane Up", akUUID: "c765bd57-cdc5-4317-a600-69a8bd6c4ce6" },
  { id: "CRASH_ZOOM_IN", label: "Crash Zoom In", akUUID: "b0191ad1-a723-439c-a4bc-a3f5d5884db3" },
  { id: "CRASH_ZOOM_OUT", label: "Crash Zoom Out", akUUID: "1975ac74-92ca-46b3-81b3-6f191a9ae438" },
  { id: "DISINTEGRATION", label: "Disintegration", akUUID: "a51e2e8d-ba5e-44f2-9e00-3d86fd93c9bc" },
  { id: "DOLLY_IN", label: "Dolly In", akUUID: "ece8c6a9-3deb-430e-8c93-4d5061b6adbf" },
  { id: "DOLLY_LEFT", label: "Dolly Left", akUUID: "f507880a-3fa8-4c3a-96bb-3ce3b70ac53b" },
  { id: "DOLLY_OUT", label: "Dolly Out", akUUID: "772cb36a-7d18-4250-b4aa-0c3f1a8431a0" },
  { id: "DOLLY_RIGHT", label: "Dolly Right", akUUID: "587a0109-30be-4781-a18e-e353b580fd10" },
  { id: "EXPLOSION", label: "Explosion", akUUID: "65da803d-c015-495a-8d5c-e969a79c9894" },
  { id: "EYES_IN", label: "Eyes In", akUUID: "148b50d0-2040-4524-a36f-6e330f9e362e" },
  { id: "FLOOD", label: "Flood", akUUID: "a12c150e-95e9-469b-ba9b-6d5323ac5a09" },
  { id: "HANDHELD", label: "Handheld", akUUID: "75722d13-108f-4cea-9471-cb7e5fc049fe" },
  { id: "LENS_CRACK", label: "Lens Crack", akUUID: "193da194-2632-4f6a-a1df-d03ca9ae0ea9" },
  { id: "MEDIUM_ZOOM_IN", label: "Medium Zoom In", akUUID: "f46d8e7f-e0ca-4f6a-90ab-141d731f47ae" },
  { id: "ORBIT_LEFT", label: "Orbit Left", akUUID: "74bea0cc-9942-4d45-9977-28c25078bfd4" },
  { id: "ORBIT_RIGHT", label: "Orbit Right", akUUID: "aec24e36-a2e8-4fae-920c-127d276bbe4b" },
  { id: "ROBO_ARM", label: "Robo Arm", akUUID: "8df55fe2-5c6f-4dbf-8ade-eb997807ca0d" },
  { id: "SUPER_DOLLY_IN", label: "Super Dolly In", akUUID: "a3992d78-34fc-44c6-b157-e2755d905197" },
  { id: "SUPER_DOLLY_OUT", label: "Super Dolly Out", akUUID: "906b93f2-beb3-42be-9283-92236cc90ed6" },
  { id: "TILT_DOWN", label: "Tilt Down", akUUID: "a1923b1b-854a-46a1-9e26-07c435098b87" },
  { id: "TILT_UP", label: "Tilt Up", akUUID: "6ad6de1f-bd15-4d0b-ae0e-81d1a4c6c085" },
]

/** Legacy / mistaken UI ids → official Leonardo control ids. */
const MOTION_CONTROL_ALIASES: Record<string, string> = {
  PAN_UP: "TILT_UP",
  PAN_DOWN: "TILT_DOWN",
  PAN_LEFT: "DOLLY_LEFT",
  PAN_RIGHT: "DOLLY_RIGHT",
  ZOOM_IN: "MEDIUM_ZOOM_IN",
  ZOOM_OUT: "CRASH_ZOOM_OUT",
  PUSH_IN: "DOLLY_IN",
  PUSH_OUT: "DOLLY_OUT",
  TRACK_IN: "DOLLY_IN",
  TRACK_OUT: "DOLLY_OUT",
  TRACK_LEFT: "DOLLY_LEFT",
  TRACK_RIGHT: "DOLLY_RIGHT",
  CRANE_OVERHEAD: "CRANE_OVER_HEAD",
}

export function normalizeLeonardoMotionControlId(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function resolveLeonardoMotionControlId(raw: string): string {
  const normalized = normalizeLeonardoMotionControlId(raw)
  return MOTION_CONTROL_ALIASES[normalized] || normalized
}

export function getLeonardoMotionControlById(
  raw: string,
): LeonardoMotionControl | undefined {
  const id = resolveLeonardoMotionControlId(raw)
  return LEONARDO_MOTION_CONTROLS.find((c) => c.id === id)
}

export function resolveLeonardoMotionControlUUID(
  raw: string,
  apiElements: Array<Record<string, unknown>> = [],
): { uuid: string; label: string; id: string } | null {
  const id = resolveLeonardoMotionControlId(raw)
  const fromDocs = LEONARDO_MOTION_CONTROLS.find((c) => c.id === id)
  if (!fromDocs) return null

  // Prefer live API akUUID when the element name matches (docs are the guaranteed fallback).
  if (apiElements.length > 0) {
    const match = apiElements.find((el) => {
      const name = normalizeLeonardoMotionControlId(
        String(el.name || el.title || el.label || ""),
      )
      return name === id || name === normalizeLeonardoMotionControlId(raw)
    })
    const apiUuid = match ? String(match.akUUID || "").trim() : ""
    if (apiUuid) {
      return {
        uuid: apiUuid,
        id,
        label: String(match?.name || match?.title || fromDocs.label),
      }
    }
  }

  return { uuid: fromDocs.akUUID, id: fromDocs.id, label: fromDocs.label }
}
