/** Leonardo AI image-to-video with optional end frame (Kling 2.1 / Veo 3.1). */

export type LeonardoFrameVideoModel = "KLING2_1" | "VEO3_1" | "VEO3_1FAST"

const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1"

async function uploadFileToLeonardo(apiKey: string, file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "png"
  const formData = new FormData()
  formData.append("file", file)
  formData.append("extension", extension)

  const uploadResponse = await fetch(`${LEONARDO_BASE}/init-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(`Leonardo upload failed (${uploadResponse.status}): ${errorText.slice(0, 200)}`)
  }

  const uploadData = await uploadResponse.json()
  const imageId =
    uploadData.uploadInitImage?.id ||
    uploadData.id ||
    uploadData.initImageId ||
    uploadData.imageId

  if (!imageId) {
    throw new Error("Leonardo did not return an image ID after upload")
  }

  if (uploadData.uploadInitImage?.fields && uploadData.uploadInitImage?.url) {
    const s3Fields = JSON.parse(uploadData.uploadInitImage.fields) as Record<string, string>
    const s3FormData = new FormData()
    Object.keys(s3Fields).forEach((key) => s3FormData.append(key, s3Fields[key]))
    s3FormData.append("file", file)

    const s3Response = await fetch(uploadData.uploadInitImage.url, {
      method: "POST",
      body: s3FormData,
    })
    if (!s3Response.ok) {
      console.warn("Leonardo S3 upload returned", s3Response.status)
    }
    await new Promise((resolve) => setTimeout(resolve, 5000))
  } else {
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  return imageId
}

export async function uploadUrlToLeonardo(apiKey: string, imageUrl: string, label: string): Promise<string> {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Could not load ${label} image`)
  }
  const blob = await imageResponse.blob()
  const file = new File([blob], `${label}.jpg`, { type: blob.type || "image/jpeg" })
  return uploadFileToLeonardo(apiKey, file)
}

export function getValidDurationsForLeonardoModel(model: LeonardoFrameVideoModel): number[] {
  return model === "KLING2_1" ? [5, 10] : [4, 6, 8]
}

export async function startLeonardoFrameToVideoGeneration(
  apiKey: string,
  options: {
    startImageId: string
    endImageId?: string | null
    model: LeonardoFrameVideoModel
    prompt: string
    duration: number
  },
): Promise<string> {
  const valid = getValidDurationsForLeonardoModel(options.model)
  if (!valid.includes(options.duration)) {
    throw new Error(`Duration must be one of: ${valid.join(", ")} seconds`)
  }

  const requestBody: Record<string, unknown> = {
    prompt: options.prompt.trim() || "Smooth cinematic transition between frames",
    imageId: options.startImageId,
    imageType: "UPLOADED",
    model: options.model,
    resolution: "RESOLUTION_1080",
    height: 1080,
    width: 1920,
    duration: options.duration,
  }

  if (options.endImageId) {
    requestBody.endFrameImage = { id: options.endImageId, type: "UPLOADED" }
  }

  const response = await fetch(`${LEONARDO_BASE}/generations-image-to-video`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Leonardo video generation failed (${response.status}): ${errorText.slice(0, 300)}`)
  }

  const result = await response.json()
  const generationId =
    result.motionVideoGenerationJob?.generationId ||
    result.imageToVideoGenerationJob?.generationId ||
    result.imageToVideoGenerationJob?.id ||
    result.generationId ||
    result.id

  if (!generationId) {
    throw new Error("Leonardo did not return a generation ID")
  }

  return generationId
}

export async function pollLeonardoFrameVideo(apiKey: string, generationId: string): Promise<string> {
  const endpoints = [
    `${LEONARDO_BASE}/generations/${generationId}`,
    `${LEONARDO_BASE}/generations-image-to-video/${generationId}`,
    `${LEONARDO_BASE}/motion-video/${generationId}`,
  ]

  for (let attempt = 0; attempt < 60; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    for (const endpoint of endpoints) {
      try {
        const statusResponse = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!statusResponse.ok) continue

        const statusData = await statusResponse.json()
        const jobStatus =
          statusData.generations_by_pk?.status ||
          statusData.motionVideoGenerationJob?.status ||
          statusData.imageToVideoGenerationJob?.status ||
          statusData.status

        if (jobStatus === "FAILED" || jobStatus === "failed" || jobStatus === "error") {
          throw new Error("Leonardo video generation failed")
        }

        if (jobStatus === "COMPLETE" || jobStatus === "complete" || jobStatus === "COMPLETED" || jobStatus === "succeeded") {
          const videoUrl =
            statusData.generations_by_pk?.generated_images?.[0]?.motionMP4URL ||
            statusData.motionVideoGenerationJob?.videoURL ||
            statusData.imageToVideoGenerationJob?.videoURL ||
            statusData.generations_by_pk?.generated_videos?.[0]?.url ||
            statusData.videoUrl ||
            statusData.url

          if (videoUrl) return videoUrl as string
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("failed")) throw error
      }
    }
  }

  throw new Error("Leonardo video generation timed out")
}
