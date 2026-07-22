/** Probe MP4 duration from a buffer by walking atoms for mvhd. */

function readMp4DurationMs(buffer: Buffer): number | null {
  const walk = (start: number, end: number): number | null => {
    let offset = start
    while (offset + 8 <= end) {
      const size = buffer.readUInt32BE(offset)
      if (size < 8 || offset + size > end) break

      const type = buffer.toString('ascii', offset + 4, offset + 8)
      if (type === 'mvhd') {
        const version = buffer.readUInt8(offset + 8)
        if (version === 0 && offset + 28 <= end) {
          const timescale = buffer.readUInt32BE(offset + 20)
          const duration = buffer.readUInt32BE(offset + 24)
          if (timescale > 0 && duration > 0) {
            return Math.floor((duration / timescale) * 1000)
          }
        } else if (version === 1 && offset + 40 <= end) {
          const timescale = buffer.readUInt32BE(offset + 28)
          const durationHigh = buffer.readUInt32BE(offset + 32)
          const durationLow = buffer.readUInt32BE(offset + 36)
          const duration = durationHigh * 2 ** 32 + durationLow
          if (timescale > 0 && duration > 0) {
            return Math.floor((duration / timescale) * 1000)
          }
        }
        return null
      }

      const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts'])
      if (containers.has(type)) {
        const nested = walk(offset + 8, offset + size)
        if (nested) return nested
      }

      offset += size
    }
    return null
  }

  return walk(0, buffer.length)
}

export async function probeRemoteVideoDurationMs(videoUrl: string): Promise<number> {
  const headResponse = await fetch(videoUrl, { method: 'HEAD', cache: 'no-store' })
  const contentLength = Number(headResponse.headers.get('content-length') || 0)

  const fetchRange = async (start: number, end: number) => {
    const response = await fetch(videoUrl, {
      headers: { Range: `bytes=${start}-${end}` },
      cache: 'no-store',
    })
    if (!response.ok && response.status !== 206) {
      throw new Error(`Failed to read video metadata (${response.status})`)
    }
    return Buffer.from(await response.arrayBuffer())
  }

  const firstChunk = await fetchRange(0, 131_071)
  let durationMs = readMp4DurationMs(firstChunk)

  if (!durationMs && contentLength > 131_072) {
    const tailStart = Math.max(0, contentLength - 262_144)
    const tailChunk = await fetchRange(tailStart, contentLength - 1)
    durationMs = readMp4DurationMs(tailChunk)
  }

  if (!durationMs) {
    const fullResponse = await fetch(videoUrl, { cache: 'no-store' })
    if (!fullResponse.ok) {
      throw new Error(`Failed to fetch video (${fullResponse.status})`)
    }
    const fullBuffer = Buffer.from(await fullResponse.arrayBuffer())
    durationMs = readMp4DurationMs(fullBuffer)
  }

  if (!durationMs) {
    throw new Error('Could not determine video duration')
  }

  return durationMs
}
