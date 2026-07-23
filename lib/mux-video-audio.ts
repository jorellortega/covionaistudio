import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoading: Promise<FFmpeg> | null = null

async function getFfmpeg(onStatus?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  if (ffmpegLoading) return ffmpegLoading

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg()
    ffmpeg.on("log", ({ message }) => {
      if (message.includes("time=")) onStatus?.("Muxing audio into video…")
    })

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
    onStatus?.("Loading export engine…")
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    })

    ffmpegInstance = ffmpeg
    return ffmpeg
  })()

  return ffmpegLoading
}

function videoExtensionFromBlob(blob: Blob): string {
  const type = blob.type.toLowerCase()
  if (type.includes("webm")) return "webm"
  if (type.includes("quicktime")) return "mov"
  return "mp4"
}

function audioExtensionFromBlob(blob: Blob): string {
  const type = blob.type.toLowerCase()
  if (type.includes("wav")) return "wav"
  if (type.includes("ogg")) return "ogg"
  if (type.includes("mp4") || type.includes("m4a")) return "m4a"
  return "mp3"
}

function blobToBytes(data: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof data === "string") {
    return new TextEncoder().encode(data)
  }
  if (data instanceof Uint8Array) {
    return data
  }
  return new Uint8Array(data)
}

export async function muxVideoWithAudios(
  videoBlob: Blob,
  audioBlobs: Blob[],
  onStatus?: (message: string) => void,
): Promise<Blob> {
  if (audioBlobs.length === 0) {
    throw new Error("At least one audio track is required")
  }

  if (audioBlobs.length === 1) {
    return muxVideoWithAudio(videoBlob, audioBlobs[0], onStatus)
  }

  const ffmpeg = await getFfmpeg(onStatus)
  const videoExt = videoExtensionFromBlob(videoBlob)
  const inputVideo = `input.${videoExt}`

  onStatus?.("Preparing files…")
  await ffmpeg.writeFile(inputVideo, await fetchFile(videoBlob))

  const audioInputLabels: string[] = []
  for (let index = 0; index < audioBlobs.length; index += 1) {
    const audioExt = audioExtensionFromBlob(audioBlobs[index])
    const inputAudio = `audio${index}.${audioExt}`
    await ffmpeg.writeFile(inputAudio, await fetchFile(audioBlobs[index]))
    audioInputLabels.push(`[${index + 1}:a]`)
  }

  const filterComplex = `${audioInputLabels.join("")}amix=inputs=${audioBlobs.length}:duration=shortest:dropout_transition=0[aout]`

  onStatus?.(`Mixing ${audioBlobs.length} audio tracks (video stream copy)…`)
  const args = [
    "-i",
    inputVideo,
    ...audioBlobs.flatMap((_, index) => {
      const audioExt = audioExtensionFromBlob(audioBlobs[index])
      return ["-i", `audio${index}.${audioExt}`]
    }),
    "-filter_complex",
    filterComplex,
    "-map",
    "0:v:0",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    "output.mp4",
  ]

  const exitCode = await ffmpeg.exec(args)
  if (exitCode !== 0) {
    throw new Error("Failed to mux audio into video")
  }

  const data = await ffmpeg.readFile("output.mp4")
  return new Blob([blobToBytes(data)], { type: "video/mp4" })
}

export async function muxVideoWithAudio(
  videoBlob: Blob,
  audioBlob: Blob,
  onStatus?: (message: string) => void,
): Promise<Blob> {
  const ffmpeg = await getFfmpeg(onStatus)
  const videoExt = videoExtensionFromBlob(videoBlob)
  const audioExt = audioExtensionFromBlob(audioBlob)
  const inputVideo = `input.${videoExt}`
  const inputAudio = `audio.${audioExt}`

  onStatus?.("Preparing files…")
  await ffmpeg.writeFile(inputVideo, await fetchFile(videoBlob))
  await ffmpeg.writeFile(inputAudio, await fetchFile(audioBlob))

  onStatus?.("Muxing (video stream copy, no re-encode)…")
  const exitCode = await ffmpeg.exec([
    "-i",
    inputVideo,
    "-i",
    inputAudio,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    "output.mp4",
  ])

  if (exitCode !== 0) {
    throw new Error("Failed to mux audio into video")
  }

  const data = await ffmpeg.readFile("output.mp4")
  return new Blob([blobToBytes(data)], { type: "video/mp4" })
}
