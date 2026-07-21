/** Runway Gen-4 / Gen-3 image-to-video supported output ratios. */
export const RUNWAY_GEN4_RATIOS = [
  { ratio: '1280:720', label: '16:9 (1280×720)', width: 1280, height: 720 },
  { ratio: '720:1280', label: '9:16 (720×1280)', width: 720, height: 1280 },
  { ratio: '1104:832', label: '4:3 (1104×832)', width: 1104, height: 832 },
  { ratio: '832:1104', label: '3:4 (832×1104)', width: 832, height: 1104 },
  { ratio: '960:960', label: '1:1 (960×960)', width: 960, height: 960 },
  { ratio: '1584:672', label: '21:9 (1584×672)', width: 1584, height: 672 },
] as const

export type RunwayGen4Ratio = (typeof RUNWAY_GEN4_RATIOS)[number]['ratio']

const RUNWAY_PROMPT_MAX = 1000

export function truncateRunwayPrompt(prompt: string): string {
  const trimmed = prompt.trim()
  if (trimmed.length <= RUNWAY_PROMPT_MAX) return trimmed
  return trimmed.slice(0, RUNWAY_PROMPT_MAX - 1).trimEnd() + '…'
}

export function pickClosestRunwayRatio(
  sourceWidth: number,
  sourceHeight: number,
  preferredWidth?: number,
  preferredHeight?: number,
): RunwayGen4Ratio {
  const sourceAspect = sourceWidth / sourceHeight
  const preferredAspect =
    preferredWidth && preferredHeight ? preferredWidth / preferredHeight : sourceAspect

  // Image-to-video fails when output ratio doesn't match the source — favor source when they diverge
  const aspectDiff = Math.abs(sourceAspect - preferredAspect)
  const targetAspect = aspectDiff > 0.12 ? sourceAspect : preferredAspect

  let best: RunwayGen4Ratio = '1280:720'
  let bestScore = Number.POSITIVE_INFINITY

  for (const entry of RUNWAY_GEN4_RATIOS) {
    const aspect = entry.width / entry.height
    const score = Math.abs(aspect - targetAspect)
    if (score < bestScore) {
      bestScore = score
      best = entry.ratio
    }
  }

  return best
}

export function mapResolutionToRunwayRatio(width: number, height: number): RunwayGen4Ratio {
  const exact = RUNWAY_GEN4_RATIOS.find((r) => r.width === width && r.height === height)
  if (exact) return exact.ratio
  return pickClosestRunwayRatio(width, height, width, height)
}

/** Read width/height from PNG or JPEG buffer (no extra deps). */
export function readImageDimensionsFromBuffer(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 24) return null

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }

  // JPEG — scan for SOF0/SOF2
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      const length = buffer.readUInt16BE(offset + 2)
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        }
      }
      offset += 2 + length
    }
  }

  return null
}

export function getRunwayRatioDimensions(ratio: RunwayGen4Ratio): { width: number; height: number } {
  const entry = RUNWAY_GEN4_RATIOS.find((r) => r.ratio === ratio)
  if (!entry) return { width: 1280, height: 720 }
  return { width: entry.width, height: entry.height }
}

export function resolveRunwayOutputRatio(
  sourceWidth: number,
  sourceHeight: number,
  preferredWidth?: number,
  preferredHeight?: number,
): { ratio: RunwayGen4Ratio; width: number; height: number } {
  const ratio = pickClosestRunwayRatio(sourceWidth, sourceHeight, preferredWidth, preferredHeight)
  return { ratio, ...getRunwayRatioDimensions(ratio) }
}

export function isRunwayRetryableFailure(failureCode?: string): boolean {
  return Boolean(failureCode?.startsWith('INTERNAL.BAD_OUTPUT') || failureCode === 'INTERNAL')
}

export function describeRunwayFailureCode(failureCode?: string): string | null {
  if (!failureCode) return null
  if (failureCode.startsWith('INTERNAL.BAD_OUTPUT')) {
    return 'Runway rejected the output for quality reasons. Complex scenes (many moving objects, birds, crowds) often fail. Try a simpler prompt, a cleaner source image without text overlays, or use Kling instead.'
  }
  if (failureCode.startsWith('SAFETY.')) {
    return 'Runway flagged the content under its safety policy. Try a different prompt or image.'
  }
  if (failureCode.startsWith('ASSET.')) {
    return 'Runway could not process the input image. Try re-exporting the image as JPEG without text overlays.'
  }
  return null
}

export function formatRunwayTaskFailure(error: unknown): string {
  const err = error as {
    message?: string
    taskDetails?: { failure?: string; failureCode?: string; status?: string; id?: string }
  }
  const parts: string[] = []
  if (err.taskDetails?.failure) parts.push(err.taskDetails.failure)
  else if (err.message) parts.push(err.message)
  if (err.taskDetails?.failureCode) parts.push(`code: ${err.taskDetails.failureCode}`)
  if (err.taskDetails?.id) parts.push(`task: ${err.taskDetails.id}`)
  return parts.join(' — ') || 'Unknown Runway error'
}
