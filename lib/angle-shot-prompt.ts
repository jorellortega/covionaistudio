import type { Asset } from "@/lib/asset-service"

/** Instruct image models to return one photograph per angle — not a sheet or grid. */
export const SINGLE_ANGLE_SHOT_INSTRUCTION =
  "Deliver exactly ONE single full-frame photograph of this shot only. No collage, no grid, no multi-panel layout, no turnaround sheet, no contact sheet, no split screen, and no multiple camera views in one image."

export type CollageSourceItem = { label: string; imageUrl: string }

export type AngleGalleryMap = Record<
  string,
  { images: { imageUrl: string }[]; selectedIndex: number }
>

export function isAngleCollageReferenceAsset(asset: Asset): boolean {
  if (asset.metadata?.type === "avatar_collage") return true
  const angleId = asset.metadata?.object_angle ?? asset.metadata?.location_angle
  return angleId === "reference_collage"
}

/** Build collage inputs from in-memory galleries, falling back to saved angle assets. */
export function buildCollageSourceItems(options: {
  shots: { id: string; label: string }[]
  angleGalleries: AngleGalleryMap
  assets: Asset[]
  entityId: string
  isAngleAsset: (asset: Asset, entityId: string) => boolean
  readAngleId: (asset: Asset) => string | undefined
}): CollageSourceItem[] {
  const { shots, angleGalleries, assets, entityId, isAngleAsset, readAngleId } = options
  const items: CollageSourceItem[] = []

  for (const shot of shots) {
    const allowedUrls = new Set(
      assets.filter((asset) => asset.content_url).map((asset) => asset.content_url!),
    )
    const allowedAssetIds = new Set(assets.map((asset) => asset.id))

    const gallery = angleGalleries[shot.id]
    if (gallery?.images.length) {
      const image = gallery.images[gallery.selectedIndex] ?? gallery.images[0]
      const belongsToEntity =
        (image.assetId && allowedAssetIds.has(image.assetId)) ||
        allowedUrls.has(image.imageUrl)
      if (belongsToEntity) {
        items.push({ label: shot.label, imageUrl: image.imageUrl })
        continue
      }
    }

    const savedAsset = assets
      .filter(
        (asset) =>
          isAngleAsset(asset, entityId) &&
          readAngleId(asset) === shot.id &&
          Boolean(asset.content_url),
      )
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0]

    if (savedAsset?.content_url) {
      items.push({ label: shot.label, imageUrl: savedAsset.content_url })
    }
  }

  return items
}
