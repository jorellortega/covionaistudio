export type StorageImageTransform = {
  width?: number
  height?: number
  /** 20–100; defaults to Supabase's 80 if omitted */
  quality?: number
  resize?: "cover" | "contain" | "fill"
}

const OBJECT_PUBLIC = "/storage/v1/object/public/"
const RENDER_PUBLIC = "/storage/v1/render/image/public/"

/**
 * Rewrite a Supabase Storage public URL to an on-the-fly resized thumbnail.
 * Non-Supabase URLs (and URLs that can't be transformed) are returned unchanged.
 *
 * Requires Image Transformations on the Supabase project. Callers should fall
 * back to the original URL on load error.
 */
export function getStorageImageUrl(
  url: string | null | undefined,
  transform?: StorageImageTransform,
): string {
  if (!url) return ""
  if (!transform?.width && !transform?.height) return url

  try {
    const next = new URL(url)
    if (next.pathname.includes(OBJECT_PUBLIC)) {
      next.pathname = next.pathname.replace(OBJECT_PUBLIC, RENDER_PUBLIC)
    } else if (!next.pathname.includes(RENDER_PUBLIC)) {
      return url
    }

    next.search = ""
    if (transform.width) next.searchParams.set("width", String(Math.round(transform.width)))
    if (transform.height) next.searchParams.set("height", String(Math.round(transform.height)))
    if (transform.quality != null) {
      next.searchParams.set(
        "quality",
        String(Math.min(100, Math.max(20, Math.round(transform.quality)))),
      )
    }
    // Default to contain so widescreen shots aren't cropped by the transform.
    next.searchParams.set("resize", transform.resize ?? "contain")
    return next.toString()
  } catch {
    return url
  }
}
