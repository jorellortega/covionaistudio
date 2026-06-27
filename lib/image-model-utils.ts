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

export function displayModelSupportsReferenceImage(displayName: string): boolean {
  const lower = displayName.toLowerCase()
  return (
    lower.includes("runway") ||
    lower.includes("gpt image 2") ||
    lower === LEGACY_GPT_IMAGE_DISPLAY.toLowerCase() ||
    lower === "gpt image"
  )
}
