/** Kling video model metadata for cinema-production and API routes. */

export type KlingApiMode = 'text2video' | 'image2video' | 'omni-video'

export type KlingModelName = 'kling-v3' | 'kling-v3-omni'

export const KLING_V3_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const

export const KLING_3_UI_MODELS = [
  'Kling 3.0 T2V',
  'Kling 3.0 I2V',
  'Kling 3.0 I2V Extended',
  'Kling 3.0 Omni T2V',
  'Kling 3.0 Omni I2V',
  'Kling 3.0 Omni I2V Extended',
] as const

export type Kling3UiModel = (typeof KLING_3_UI_MODELS)[number]

const LEGACY_UI_MODEL_MAP: Record<string, Kling3UiModel> = {
  'Kling T2V': 'Kling 3.0 T2V',
  'Kling I2V': 'Kling 3.0 I2V',
  'Kling I2V Extended': 'Kling 3.0 I2V Extended',
}

export function normalizeKlingUiModel(model: string): string {
  return LEGACY_UI_MODEL_MAP[model] || model
}

export function isNativeKlingModel(model: string): boolean {
  const normalized = normalizeKlingUiModel(model)
  return (KLING_3_UI_MODELS as readonly string[]).includes(normalized)
}

export function isKlingOmniModel(model: string): boolean {
  const normalized = normalizeKlingUiModel(model)
  return normalized.includes('Omni')
}

export function getKlingModelConfig(uiModel: string): {
  apiMode: KlingApiMode
  modelName: KlingModelName
  needsImage: boolean
  needsStartEnd: boolean
} | null {
  const model = normalizeKlingUiModel(uiModel)

  switch (model) {
    case 'Kling 3.0 T2V':
      return { apiMode: 'text2video', modelName: 'kling-v3', needsImage: false, needsStartEnd: false }
    case 'Kling 3.0 I2V':
      return { apiMode: 'image2video', modelName: 'kling-v3', needsImage: true, needsStartEnd: false }
    case 'Kling 3.0 I2V Extended':
      return { apiMode: 'image2video', modelName: 'kling-v3', needsImage: true, needsStartEnd: true }
    case 'Kling 3.0 Omni T2V':
      return { apiMode: 'omni-video', modelName: 'kling-v3-omni', needsImage: false, needsStartEnd: false }
    case 'Kling 3.0 Omni I2V':
      return { apiMode: 'omni-video', modelName: 'kling-v3-omni', needsImage: true, needsStartEnd: false }
    case 'Kling 3.0 Omni I2V Extended':
      return { apiMode: 'omni-video', modelName: 'kling-v3-omni', needsImage: true, needsStartEnd: true }
    default:
      return null
  }
}

export function getKlingStatusEndpoint(mode: KlingApiMode, taskId: string): string {
  const base = 'https://api-singapore.klingai.com/v1/videos'
  switch (mode) {
    case 'text2video':
      return `${base}/text2video/${taskId}`
    case 'omni-video':
      return `${base}/omni-video/${taskId}`
    default:
      return `${base}/image2video/${taskId}`
  }
}

export function getKlingCreateEndpoint(mode: KlingApiMode): string {
  const base = 'https://api-singapore.klingai.com/v1/videos'
  switch (mode) {
    case 'text2video':
      return `${base}/text2video`
    case 'omni-video':
      return `${base}/omni-video`
    default:
      return `${base}/image2video`
  }
}
