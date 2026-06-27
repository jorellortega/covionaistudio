/** Helpers for Runway Gen-4 reference images (up to 3 per request). */

export const RUNWAY_REF_TAGS = {
  primary: "reference",
  secondary: "linked",
  tertiary: "extra",
} as const

export type RunwayReferenceImage = { uri: string; tag: string }

export async function fileToRunwayDataUri(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  return `data:${file.type || "image/png"};base64,${base64}`
}

export async function buildRunwayReferenceImagesFromFiles(
  primaryFile: File,
  additionalFiles?: File[],
): Promise<RunwayReferenceImage[]> {
  const tags = [RUNWAY_REF_TAGS.primary, RUNWAY_REF_TAGS.secondary, RUNWAY_REF_TAGS.tertiary]
  const files = [primaryFile, ...(additionalFiles ?? [])].slice(0, 3)
  const refs: RunwayReferenceImage[] = []
  for (let i = 0; i < files.length; i++) {
    refs.push({
      uri: await fileToRunwayDataUri(files[i]),
      tag: tags[i],
    })
  }
  return refs
}

/** Runway requires @tag mentions in promptText for each reference image. */
export function ensureRunwayReferenceTagsInPrompt(prompt: string, tags: string[]): string {
  const trimmed = prompt.trim()
  const missing = tags.filter((tag) => !trimmed.includes(`@${tag}`))
  if (missing.length === 0) return trimmed.slice(0, 990)
  const suffix = missing.map((tag) => `@${tag}`).join(" ")
  const combined = trimmed ? `${trimmed} ${suffix}` : suffix
  return combined.slice(0, 990)
}

export function normalizeRunwayRatio(width: number, height: number): string {
  return `${width}:${height}`
}
