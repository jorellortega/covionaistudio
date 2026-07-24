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

function parseSupabaseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url)
    if (!parsed.host.endsWith('.supabase.co')) return null
    const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/(.+)/)
    if (!match?.[1] || !match?.[2]) return null
    return {
      bucket: match[1],
      path: decodeURIComponent(match[2]),
    }
  } catch {
    return null
  }
}

async function probeSupabaseStorageVideoDurationMs(videoUrl: string): Promise<number | null> {
  const parsed = parseSupabaseStorageUrl(videoUrl)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!parsed || !serviceKey) return null

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )

  const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.path)
  if (error || !data) return null

  return readMp4DurationMs(Buffer.from(await data.arrayBuffer()))
}

export async function probeRemoteVideoDurationMs(videoUrl: string): Promise<number> {
  try {
    return await probeRemoteVideoDurationViaHttp(videoUrl)
  } catch (httpError) {
    const storageDurationMs = await probeSupabaseStorageVideoDurationMs(videoUrl)
    if (storageDurationMs) return storageDurationMs
    throw httpError instanceof Error ? httpError : new Error('Failed to probe video duration')
  }
}

async function probeRemoteVideoDurationViaHttp(videoUrl: string): Promise<number> {
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
