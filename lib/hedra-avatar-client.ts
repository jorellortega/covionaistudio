const AVATAR_PERFORMANCE_PROMPT =
  "A person speaking to the camera with natural lip sync and subtle facial expressions"

function apiKeyQuery(apiKey: string) {
  return apiKey.trim() ? `&apiKey=${encodeURIComponent(apiKey.trim())}` : ""
}

export function isHedraCharacter3ModelName(name: string | undefined): boolean {
  if (!name) return false
  const lower = name.toLowerCase()
  return (
    lower.includes("character 3") ||
    lower.includes("character-3") ||
    lower.includes("hedra avatar") ||
    (lower.includes("avatar") && !lower.includes("image"))
  )
}

export async function findHedraCharacter3ModelId(apiKey?: string): Promise<string | null> {
  const res = await fetch(`/api/ai/hedra?action=models${apiKeyQuery(apiKey || "")}`)
  const data = await res.json()
  if (!res.ok) return null
  const models = Array.isArray(data.models) ? data.models : []
  const match = models.find(
    (m: { name?: string; type?: string }) =>
      isHedraCharacter3ModelName(m.name) ||
      (String(m.type || "").toLowerCase().includes("video") &&
        String(m.name || "").toLowerCase().includes("character")),
  )
  return match?.id ?? null
}

export async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Could not load file from URL")
  const blob = await response.blob()
  const type = blob.type || (filename.endsWith(".mp3") ? "audio/mpeg" : "image/png")
  return new File([blob], filename, { type })
}

export async function uploadFileToHedra(
  file: File,
  assetType: "image" | "audio",
  apiKey?: string,
): Promise<string> {
  const formData = new FormData()
  formData.append("action", "upload")
  formData.append("assetType", assetType)
  formData.append("file", file)
  if (apiKey?.trim()) formData.append("apiKey", apiKey.trim())

  const res = await fetch("/api/ai/hedra", { method: "POST", body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Failed to upload ${assetType}`)
  if (!data.assetId) throw new Error(`No Hedra asset id for ${assetType}`)
  return data.assetId as string
}

export async function pollHedraGeneration(
  generationId: string,
  apiKey?: string,
  onStatus?: (status: string) => void,
): Promise<string> {
  const maxAttempts = 120
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 4000))
    const res = await fetch(
      `/api/ai/hedra?action=status&generationId=${encodeURIComponent(generationId)}${apiKeyQuery(apiKey || "")}`,
    )
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || "Failed to poll Hedra status")
    }

    const statusObj = data.status as {
      status?: string
      download_url?: string
      url?: string
      error_message?: string
    }
    const status = statusObj.status || "unknown"
    onStatus?.(status)

    if (status === "complete") {
      const downloadUrl = statusObj.download_url || statusObj.url
      if (!downloadUrl) throw new Error("Hedra completed but no download URL")
      return downloadUrl
    }
    if (status === "error") {
      throw new Error(statusObj.error_message || "Hedra generation failed")
    }
  }
  throw new Error("Timed out waiting for Hedra video")
}

export async function generateHedraAvatarVideo(params: {
  imageAssetId: string
  audioAssetId: string
  aiModelId: string
  textPrompt?: string
  aspectRatio?: string
  resolution?: string
  apiKey?: string
}): Promise<string> {
  const res = await fetch("/api/ai/hedra", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "generate",
      apiKey: params.apiKey?.trim() || undefined,
      payload: {
        type: "video",
        ai_model_id: params.aiModelId,
        start_keyframe_id: params.imageAssetId,
        audio_id: params.audioAssetId,
        generated_video_inputs: {
          text_prompt: params.textPrompt?.trim() || AVATAR_PERFORMANCE_PROMPT,
          aspect_ratio: params.aspectRatio || "16:9",
          resolution: params.resolution || "720p",
        },
      },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Hedra video request failed")
  const generationId = (data.generation as { id?: string })?.id
  if (!generationId) throw new Error("No Hedra generation id returned")
  return generationId
}

export async function runHedraAvatarPipeline(params: {
  imageUrl: string
  audioUrl: string
  imageFilename: string
  audioFilename: string
  aiModelId: string
  textPrompt?: string
  aspectRatio?: string
  resolution?: string
  apiKey?: string
  onStatus?: (status: string) => void
}): Promise<string> {
  const { onStatus } = params

  onStatus?.("Uploading portrait…")
  const imageFile = await urlToFile(params.imageUrl, params.imageFilename)
  const imageAssetId = await uploadFileToHedra(imageFile, "image", params.apiKey)

  onStatus?.("Uploading audio…")
  const audioFile = await urlToFile(params.audioUrl, params.audioFilename)
  const audioAssetId = await uploadFileToHedra(audioFile, "audio", params.apiKey)

  onStatus?.("Starting lip-sync video…")
  const generationId = await generateHedraAvatarVideo({
    imageAssetId,
    audioAssetId,
    aiModelId: params.aiModelId,
    textPrompt: params.textPrompt,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
    apiKey: params.apiKey,
  })

  onStatus?.("Processing…")
  return pollHedraGeneration(generationId, params.apiKey, onStatus)
}
