import { AVATAR_REFERENCE_COLLAGE_ANGLE_ID } from "./avatar-angles"

export { AVATAR_REFERENCE_COLLAGE_ANGLE_ID }

export interface AvatarCollageItem {
  label: string
  imageUrl: string
}

export interface AvatarCollageOptions {
  width?: number
  height?: number
  title?: string
  backgroundColor?: string
  labelHeight?: number
  padding?: number
  gap?: number
}

function gridDimensions(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 }
  if (count <= 2) return { cols: 2, rows: 1 }
  if (count <= 4) return { cols: 2, rows: 2 }
  if (count <= 6) return { cols: 3, rows: 2 }
  if (count <= 9) return { cols: 3, rows: 3 }
  const cols = Math.ceil(Math.sqrt(count))
  return { cols, rows: Math.ceil(count / cols) }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

async function loadImageForCanvas(url: string): Promise<HTMLImageElement> {
  try {
    return await loadImageElement(url)
  } catch {
    const response = await fetch(
      `/api/ai/proxy-download?url=${encodeURIComponent(url)}&filename=avatar-collage-ref.png`,
    )
    if (!response.ok) {
      throw new Error(`Could not load image for collage (${response.status})`)
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      return await loadImageElement(objectUrl)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceAspect = img.naturalWidth / img.naturalHeight
  const targetAspect = width / height

  let cropW = img.naturalWidth
  let cropH = img.naturalHeight
  let cropX = 0
  let cropY = 0

  if (sourceAspect > targetAspect) {
    cropW = img.naturalHeight * targetAspect
    cropX = (img.naturalWidth - cropW) / 2
  } else if (sourceAspect < targetAspect) {
    cropH = img.naturalWidth / targetAspect
    cropY = (img.naturalHeight - cropH) / 2
  }

  ctx.drawImage(img, cropX, cropY, cropW, cropH, x, y, width, height)
}

export async function buildAvatarCollageCanvas(
  items: AvatarCollageItem[],
  options: AvatarCollageOptions = {},
): Promise<HTMLCanvasElement> {
  if (items.length === 0) {
    throw new Error("Add at least one avatar image before building a collage.")
  }

  const width = options.width ?? 1536
  const height = options.height ?? 1024
  const padding = options.padding ?? 24
  const gap = options.gap ?? 12
  const labelHeight = options.labelHeight ?? 28
  const backgroundColor = options.backgroundColor ?? "#111827"
  const title = options.title?.trim()

  const loaded = await Promise.all(
    items.map(async (item) => ({
      ...item,
      image: await loadImageForCanvas(item.imageUrl),
    })),
  )

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not available")

  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)

  const titleHeight = title ? 44 : 0
  const gridTop = padding + titleHeight
  const gridWidth = width - padding * 2
  const gridHeight = height - gridTop - padding
  const { cols, rows } = gridDimensions(loaded.length)
  const cellWidth = (gridWidth - gap * (cols - 1)) / cols
  const cellHeight = (gridHeight - gap * (rows - 1)) / rows
  const imageHeight = Math.max(40, cellHeight - labelHeight)

  if (title) {
    ctx.fillStyle = "#f9fafb"
    ctx.font = "600 22px system-ui, -apple-system, Segoe UI, sans-serif"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillText(title, padding, padding)
  }

  loaded.forEach((item, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = padding + col * (cellWidth + gap)
    const y = gridTop + row * (cellHeight + gap)

    ctx.fillStyle = "#1f2937"
    ctx.fillRect(x, y, cellWidth, cellHeight)

    drawCoverImage(ctx, item.image, x, y, cellWidth, imageHeight)

    ctx.fillStyle = "rgba(0,0,0,0.72)"
    ctx.fillRect(x, y + imageHeight, cellWidth, labelHeight)

    ctx.fillStyle = "#f3f4f6"
    ctx.font = "500 14px system-ui, -apple-system, Segoe UI, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(item.label, x + cellWidth / 2, y + imageHeight + labelHeight / 2)
  })

  return canvas
}

export async function buildAvatarCollageBlob(
  items: AvatarCollageItem[],
  options: AvatarCollageOptions = {},
): Promise<Blob> {
  const canvas = await buildAvatarCollageCanvas(items, options)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to export collage"))),
      "image/png",
    )
  })
}
