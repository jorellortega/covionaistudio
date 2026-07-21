export const HEYGEN_API_BASE = "https://api.heygen.com"

export function getHeyGenHeaders(apiKey: string, json = true): Record<string, string> {
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
  }
  if (json) headers["Content-Type"] = "application/json"
  return headers
}

export type HeyGenLook = {
  id: string
  name: string
  avatar_type: string
  group_id?: string | null
  preview_image_url?: string | null
  preview_video_url?: string | null
  status?: string | null
  supported_api_engines?: string[]
  default_voice_id?: string | null
}

export type HeyGenAvatarGroup = {
  id: string
  name?: string
  consent_status?: string | null
  looks_count?: number
  created_at?: number
}
