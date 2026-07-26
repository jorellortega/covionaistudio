const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

export function isAllowedReferenceImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null
    if (supabaseHost && parsed.host === supabaseHost) return true
    if (parsed.host.endsWith(".supabase.co") && parsed.pathname.includes("/storage/v1/object/")) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png"
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp"
  }

  return null
}

function resolveImageMime(buffer: Buffer, declaredType?: string | null): string {
  const detected = detectImageMime(buffer)
  if (detected) return detected

  const normalized = declaredType?.split(";")[0]?.trim().toLowerCase()
  if (normalized && SUPPORTED_IMAGE_MIME_TYPES.has(normalized)) {
    return normalized
  }

  throw new Error(
    `Reference URL is not a valid image (${declaredType || "unknown content type"})`,
  )
}

/** Download a storage reference server-side (avoids large browser → API uploads on Vercel). */
export async function downloadReferenceUrlToFile(
  url: string,
  filename: string,
): Promise<File> {
  if (!isAllowedReferenceImageUrl(url)) {
    throw new Error("Reference image URL is not allowed")
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not download reference image (${response.status})`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const mime = resolveImageMime(buffer, response.headers.get("content-type"))
  return new File([buffer], filename, { type: mime })
}

export async function downloadReferenceUrlsToFiles(
  urls: string[],
  filenamePrefix = "style-ref",
): Promise<File[]> {
  return Promise.all(
    urls.map((url, index) =>
      downloadReferenceUrlToFile(url, `${filenamePrefix}-${index}.png`),
    ),
  )
}
