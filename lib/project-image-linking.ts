import type { Asset } from "@/lib/asset-service"
import type { Character } from "@/lib/characters-service"
import type { Location } from "@/lib/locations-service"

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

function isSupabaseStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.host.endsWith(".supabase.co") &&
      parsed.pathname.includes("/storage/v1/object/")
    )
  } catch {
    return false
  }
}

function detectImageMime(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 12) return null

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png"
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }

  return null
}

function resolveImageMime(buffer: ArrayBuffer, declaredType?: string | null): string | null {
  const detected = detectImageMime(buffer)
  if (detected) return detected

  if (declaredType && SUPPORTED_IMAGE_MIME_TYPES.has(declaredType)) {
    return declaredType
  }

  return null
}

async function fetchReferenceResponse(url: string): Promise<Response> {
  const direct = await fetch(url)
  if (direct.ok) return direct

  // Missing files won't load via proxy either — skip the extra round trip.
  const skipProxy = direct.status === 400 || direct.status === 404
  if (!skipProxy && isSupabaseStorageUrl(url)) {
    const proxy = await fetch(
      `/api/ai/proxy-download?url=${encodeURIComponent(url)}&filename=reference.png`,
    )
    if (proxy.ok) return proxy
  }

  throw new Error(`Could not load reference image (${direct.status})`)
}

export async function referenceUrlToFile(url: string, filename: string): Promise<File> {
  const response = await fetchReferenceResponse(url)
  const buffer = await response.arrayBuffer()
  const mime = resolveImageMime(buffer, response.headers.get("content-type")?.split(";")[0]?.trim())

  if (!mime) {
    const preview = new TextDecoder().decode(buffer.slice(0, 64)).replace(/\s+/g, " ").trim()
    throw new Error(
      `Reference URL is not a valid image (${response.headers.get("content-type") || preview || "unknown"})`,
    )
  }

  return new File([buffer], filename, { type: mime })
}

export function getProjectAssetSourceLabel(
  asset: Asset,
  locations: Location[],
  characters: Character[],
): string {
  if (asset.character_id) {
    const character = characters.find((c) => c.id === asset.character_id)
    return character ? `Character · ${character.name}` : "Character"
  }
  if (asset.location_id) {
    const location = locations.find((l) => l.id === asset.location_id)
    return location ? `Location · ${location.name}` : "Location"
  }
  if (asset.is_default_cover) return "Project cover"
  const source = asset.metadata?.source ?? asset.metadata?.page
  if (typeof source === "string" && source.trim()) return source
  return "Project asset"
}

export function buildLinkedAssetGroups(
  assets: Asset[],
  locations: Location[],
  characters: Character[],
): { label: string; assets: Asset[] }[] {
  const characterAssets = assets.filter((a) => a.character_id)
  const locationAssets = assets.filter((a) => a.location_id && !a.character_id)
  const projectAssets = assets.filter((a) => !a.character_id && !a.location_id)

  const groups: { label: string; assets: Asset[] }[] = []

  if (characterAssets.length > 0) {
    groups.push({
      label: "Characters",
      assets: [...characterAssets].sort((a, b) => {
        const nameA = characters.find((c) => c.id === a.character_id)?.name ?? a.title
        const nameB = characters.find((c) => c.id === b.character_id)?.name ?? b.title
        return nameA.localeCompare(nameB)
      }),
    })
  }

  if (locationAssets.length > 0) {
    groups.push({
      label: "Locations",
      assets: [...locationAssets].sort((a, b) => {
        const nameA = locations.find((l) => l.id === a.location_id)?.name ?? a.title
        const nameB = locations.find((l) => l.id === b.location_id)?.name ?? b.title
        return nameA.localeCompare(nameB)
      }),
    })
  }

  if (projectAssets.length > 0) {
    groups.push({ label: "Project assets", assets: projectAssets })
  }

  return groups
}

export async function downloadMediaToDevice(url: string, fileName: string): Promise<void> {
  const safeName = fileName.replace(/[^\w.\-() ]/g, "_") || "download.mp4"
  const proxyUrl = `/api/ai/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || "Download failed")
  }
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = blobUrl
  link.download = safeName
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }, 100)
}
