/** Display labels shown in AI Settings and UI */
export const GPT_IMAGE_2_DISPLAY = "GPT Image 2"
export const GPT_IMAGE_1_DISPLAY = "GPT Image 1"
export const LEGACY_GPT_IMAGE_DISPLAY = "GPT Image"

/** Upgrade legacy "GPT Image" settings to the explicit v2 label */
export function migrateGPTImageDisplayLabel(label: string): string {
  if (label === LEGACY_GPT_IMAGE_DISPLAY) return GPT_IMAGE_2_DISPLAY
  return label
}

/** Map AI Settings display name → OpenAI / provider API model id */
export function normalizeDisplayModelToApiId(displayName: string | null | undefined): string {
  if (!displayName) return "dall-e-3"
  const model = displayName.toLowerCase().trim()

  if (model === "gpt image 2" || model.includes("gpt-image-2")) return "gpt-image-2"
  if (model === "gpt image 1" || model.includes("gpt-image-1")) return "gpt-image-1"
  if (model === LEGACY_GPT_IMAGE_DISPLAY.toLowerCase() || model === "gpt image") {
    return "gpt-image-2"
  }
  if (model.includes("gpt-image")) return "gpt-image-2"
  if (model.includes("dall")) return "dall-e-3"
  if (model.includes("runway")) return "gen4_image"

  return "dall-e-3"
}

/** Map AI Settings display name → generate-image service key */
export function mapDisplayModelToService(displayName: string): string {
  const lower = displayName.toLowerCase()
  if (lower.includes("runway")) return "runway"
  if (lower.includes("openart") || lower.includes("stable diffusion")) return "openart"
  if (lower.includes("leonardo")) return "leonardo"
  return "dalle"
}

export function isGPTImageApiModel(apiModel: string): boolean {
  return (
    apiModel === "gpt-image-1" ||
    apiModel.startsWith("gpt-image-1") ||
    apiModel === "gpt-image-2" ||
    apiModel.startsWith("gpt-image-2") ||
    (apiModel.startsWith("gpt-") &&
      !apiModel.startsWith("gpt-image-1") &&
      !apiModel.startsWith("gpt-image-2"))
  )
}

/** GPT Image 2 edits API accepts up to 16 reference images per request. */
export const GPT_IMAGE_MAX_REFERENCE_IMAGES = 16

/** GPT Image 2 and DALL-E use /v1/images/generations */
export function usesOpenAIImagesGenerationsApi(apiModel: string): boolean {
  return (
    apiModel === "gpt-image-2" ||
    apiModel.startsWith("gpt-image-2") ||
    apiModel === "dall-e-3" ||
    apiModel.startsWith("dall-e")
  )
}

/** GPT Image 1 (and GPT-5 image tool) use /v1/responses */
export function usesOpenAIResponsesImageApi(apiModel: string): boolean {
  if (usesOpenAIImagesGenerationsApi(apiModel)) return false
  return isGPTImageApiModel(apiModel)
}

export function getGPTImageApiLabel(apiModel: string): string {
  if (apiModel === "gpt-image-2" || apiModel.startsWith("gpt-image-2")) return GPT_IMAGE_2_DISPLAY
  if (apiModel === "gpt-image-1" || apiModel.startsWith("gpt-image-1")) return GPT_IMAGE_1_DISPLAY
  return apiModel
}

export function isGPTImage2ApiModel(apiModel: string): boolean {
  return apiModel === "gpt-image-2" || apiModel.startsWith("gpt-image-2")
}

/** Cinematic landscape default — avoid square 1024x1024 for storyboards / production. */
export const DEFAULT_CINEMATIC_IMAGE_SIZE = "1536x1024"
export const DEFAULT_CINEMATIC_IMAGE_WIDTH = 1536
export const DEFAULT_CINEMATIC_IMAGE_HEIGHT = 1024

/**
 * Resolve OpenAI `size` string from width/height and model.
 * GPT Image 2: flexible (multiples of 16, etc.) — use WxH or popular presets.
 * GPT Image 1: 1024x1024 | 1024x1536 | 1536x1024 | auto
 * DALL-E 3: 1024x1024 | 1792x1024 | 1024x1792
 */
export function resolveOpenAIImageSize(
  apiModel: string,
  width?: number,
  height?: number,
  fallback: string = DEFAULT_CINEMATIC_IMAGE_SIZE,
): string {
  const w = width && Number.isFinite(width) ? Math.round(width) : undefined
  const h = height && Number.isFinite(height) ? Math.round(height) : undefined
  const requested = w && h ? `${w}x${h}` : fallback

  if (isGPTImage2ApiModel(apiModel)) {
    // GPT Image 2 enforces a minimum pixel budget (~1M+ pixels)
    const pixels = (w ?? 0) * (h ?? 0)
    if (!w || !h || pixels < 1_048_576) {
      return DEFAULT_CINEMATIC_IMAGE_SIZE
    }
    return requested
  }

  if (apiModel === "dall-e-3" || apiModel.startsWith("dall-e")) {
    if (requested === "1024x1024" || requested === "1792x1024" || requested === "1024x1792") {
      return requested
    }
    // Map cinematic landscape / portrait onto DALL-E 3 sizes
    if (w && h) {
      if (w === h) return "1024x1024"
      return w > h ? "1792x1024" : "1024x1792"
    }
    return "1792x1024"
  }

  // GPT Image 1 / older GPT image models
  if (
    requested === "1024x1024" ||
    requested === "1024x1536" ||
    requested === "1536x1024" ||
    requested === "auto"
  ) {
    return requested
  }
  if (w && h) {
    if (w === h) return "1024x1024"
    return w > h ? "1536x1024" : "1024x1536"
  }
  return DEFAULT_CINEMATIC_IMAGE_SIZE
}

export function displayModelSupportsReferenceImage(displayName: string): boolean {
  const lower = displayName.toLowerCase()
  return (
    lower.includes("runway") ||
    lower.includes("gpt image 2") ||
    lower === LEGACY_GPT_IMAGE_DISPLAY.toLowerCase() ||
    lower === "gpt image"
  )
}
