export const HEDRA_API_BASE = "https://api.hedra.com/web-app/public"

export function getHedraHeaders(apiKey: string, json = true): Record<string, string> {
  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
  }
  if (json) headers["Content-Type"] = "application/json"
  return headers
}

export type HedraGenerationStatus = {
  status?: string
  asset_id?: string
  download_url?: string
  url?: string
  error_message?: string
  [key: string]: unknown
}
