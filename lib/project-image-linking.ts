import type { Asset } from "@/lib/asset-service"
import type { Character } from "@/lib/characters-service"
import type { Location } from "@/lib/locations-service"

export async function referenceUrlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Could not load reference image")
  }
  const blob = await response.blob()
  const type = blob.type || "image/png"
  return new File([blob], filename, { type })
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
