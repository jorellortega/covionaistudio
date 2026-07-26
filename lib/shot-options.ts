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

export function formatShotTypeLabel(value: string | null | undefined): string {
  if (!value) return ""
  return SHOT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value.replace(/-/g, " ")
}
