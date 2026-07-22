const MP3_BITRATES = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
] as const

const MP3_SAMPLE_RATES = [44100, 48000, 32000, 0] as const

/** Estimate MP3 duration by walking frame sync headers. */
export function probeMp3DurationMs(buffer: Buffer): number | null {
  let offset = 0
  let totalSamples = 0
  let sampleRate = 44100
  let foundFrame = false

  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      offset += 1
      continue
    }

    const version = (buffer[offset + 1] >> 3) & 0x03
    const layer = (buffer[offset + 1] >> 1) & 0x03
    if (layer !== 0x01 || version === 0x01) {
      offset += 1
      continue
    }

    const bitrateIndex = (buffer[offset + 2] >> 4) & 0x0f
    const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x03
    const padding = (buffer[offset + 2] >> 1) & 0x01
    const bitrateKbps = MP3_BITRATES[bitrateIndex]
    const frameSampleRate = MP3_SAMPLE_RATES[sampleRateIndex]

    if (!bitrateKbps || !frameSampleRate) {
      offset += 1
      continue
    }

    const bitrate = bitrateKbps * 1000
    sampleRate = frameSampleRate
    const frameSize = Math.floor((144 * bitrate) / frameSampleRate) + padding
    if (frameSize <= 0) {
      offset += 1
      continue
    }

    totalSamples += version === 0x03 ? 1152 : 576
    foundFrame = true
    offset += frameSize
  }

  if (!foundFrame || totalSamples <= 0) return null
  return Math.round((totalSamples / sampleRate) * 1000)
}

export function probeWavDurationMs(buffer: Buffer): number | null {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF") {
    return null
  }
  const byteRate = buffer.readUInt32LE(28)
  const dataSize = buffer.readUInt32LE(40)
  if (!byteRate || !dataSize) return null
  return Math.round((dataSize / byteRate) * 1000)
}

export function probeAudioDurationMs(buffer: Buffer): number | null {
  const wav = probeWavDurationMs(buffer)
  if (wav) return wav
  return probeMp3DurationMs(buffer)
}

export async function probeAudioDurationFromUrl(url: string): Promise<number | null> {
  const response = await fetch(url)
  if (!response.ok) return null
  const buffer = Buffer.from(await response.arrayBuffer())
  return probeAudioDurationMs(buffer)
}

export function probeAudioDurationFromBase64(base64: string): number | null {
  const buffer = Buffer.from(base64, "base64")
  return probeAudioDurationMs(buffer)
}

/** Keep end time slightly under the real duration for Kling validation. */
export function klingSoundEndTimeMs(durationMs: number): number {
  const safe = Math.floor(durationMs * 0.98)
  return Math.min(60_000, Math.max(500, safe))
}
