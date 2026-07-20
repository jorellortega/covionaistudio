import { NextRequest, NextResponse } from "next/server"

const STABILITY_BASE = "https://api.stability.ai"

const ALLOWED_ENDPOINTS: Record<string, string> = {
  ultra: "/v2beta/stable-image/generate/ultra",
  core: "/v2beta/stable-image/generate/core",
  sd3: "/v2beta/stable-image/generate/sd3",
  "upscale-conservative": "/v2beta/stable-image/upscale/conservative",
  "upscale-fast": "/v2beta/stable-image/upscale/fast",
  "upscale-creative": "/v2beta/stable-image/upscale/creative",
  erase: "/v2beta/stable-image/edit/erase",
  inpaint: "/v2beta/stable-image/edit/inpaint",
  outpaint: "/v2beta/stable-image/edit/outpaint",
  "search-and-replace": "/v2beta/stable-image/edit/search-and-replace",
  "search-and-recolor": "/v2beta/stable-image/edit/search-and-recolor",
  "remove-background": "/v2beta/stable-image/edit/remove-background",
  "control-sketch": "/v2beta/stable-image/control/sketch",
  "control-structure": "/v2beta/stable-image/control/structure",
  "control-style": "/v2beta/stable-image/control/style",
  "control-style-transfer": "/v2beta/stable-image/control/style-transfer",
  // Stable Audio 2.5 (sync)
  "audio-2-text": "/v2beta/audio/stable-audio-2/text-to-audio",
  "audio-2-audio": "/v2beta/audio/stable-audio-2/audio-to-audio",
  "audio-2-inpaint": "/v2beta/audio/stable-audio-2/inpaint",
  // Stable Audio 3.0 (async)
  "audio-3-text": "/v2beta/audio/stable-audio/text-to-audio",
  "audio-3-audio": "/v2beta/audio/stable-audio/audio-to-audio",
  "audio-3-inpaint": "/v2beta/audio/stable-audio/inpaint",
}

const ASYNC_ENDPOINTS = new Set([
  "upscale-creative",
  "audio-3-text",
  "audio-3-audio",
  "audio-3-inpaint",
])

const AUDIO_ENDPOINTS = new Set([
  "audio-2-text",
  "audio-2-audio",
  "audio-2-inpaint",
  "audio-3-text",
  "audio-3-audio",
  "audio-3-inpaint",
])

function mimeForOutput(outputFormat: string, isAudio: boolean) {
  if (isAudio) {
    return outputFormat === "wav" ? "audio/wav" : "audio/mpeg"
  }
  if (outputFormat === "jpeg" || outputFormat === "jpg") return "image/jpeg"
  if (outputFormat === "webp") return "image/webp"
  return "image/png"
}

function extractBase64(data: any) {
  return (
    data?.image ||
    data?.audio ||
    data?.base64 ||
    data?.artifacts?.[0]?.base64 ||
    null
  )
}

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData()
    const apiKey = String(incoming.get("apiKey") || "").trim()
    const endpointKey = String(incoming.get("endpoint") || "").trim()
    const acceptJson = String(incoming.get("acceptJson") || "true") !== "false"

    if (!apiKey) {
      return NextResponse.json({ error: "Stability API key is required" }, { status: 400 })
    }

    const path = ALLOWED_ENDPOINTS[endpointKey]
    if (!path) {
      return NextResponse.json(
        { error: `Unsupported endpoint: ${endpointKey}`, allowed: Object.keys(ALLOWED_ENDPOINTS) },
        { status: 400 }
      )
    }

    const isAudio = AUDIO_ENDPOINTS.has(endpointKey)
    const isAsync = ASYNC_ENDPOINTS.has(endpointKey)

    const outbound = new FormData()
    for (const [key, value] of incoming.entries()) {
      if (key === "apiKey" || key === "endpoint" || key === "acceptJson") continue
      if (typeof value === "string") {
        if (value.trim() !== "") outbound.append(key, value)
      } else {
        outbound.append(key, value)
      }
    }

    const accept = isAsync
      ? "application/json"
      : acceptJson
        ? "application/json"
        : isAudio
          ? "audio/*"
          : "image/*"

    const response = await fetch(`${STABILITY_BASE}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept,
        "stability-client-id": "cinema-platform",
        "stability-client-version": "1.0.0",
      },
      body: outbound,
    })

    if (isAsync || response.status === 202) {
      const data = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 202) {
        return NextResponse.json(
          {
            error:
              (Array.isArray(data?.errors) && data.errors.join(", ")) ||
              data?.name ||
              data?.message ||
              "Stability request failed",
            details: data,
          },
          { status: response.status }
        )
      }
      return NextResponse.json({
        async: true,
        kind: isAudio ? "audio" : "image",
        id: data.id,
        ...data,
      })
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(async () => ({
        message: await response.text().catch(() => "Unknown error"),
      }))
      return NextResponse.json(
        {
          error:
            (Array.isArray(errorBody?.errors) && errorBody.errors.join(", ")) ||
            errorBody?.name ||
            errorBody?.message ||
            `Stability API error (${response.status})`,
          details: errorBody,
        },
        { status: response.status }
      )
    }

    const outputFormat = String(
      incoming.get("output_format") || (isAudio ? "mp3" : "png")
    )
    const mime = mimeForOutput(outputFormat, isAudio)

    if (acceptJson) {
      const contentType = response.headers.get("content-type") || ""

      // Prefer JSON base64; fall back to binary if Stability returned media bytes
      if (contentType.includes("application/json")) {
        const data = await response.json()
        const base64 = extractBase64(data)
        const finishReason = data?.finish_reason || data?.finishReason
        const seed = data?.seed

        if (!base64) {
          return NextResponse.json(
            {
              error: `No ${isAudio ? "audio" : "image"} data in Stability response`,
              details: data,
            },
            { status: 502 }
          )
        }

        const dataUrl = `data:${mime};base64,${base64}`
        return NextResponse.json({
          kind: isAudio ? "audio" : "image",
          ...(isAudio ? { audio: dataUrl } : { image: dataUrl }),
          seed,
          finishReason,
          endpoint: endpointKey,
        })
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const resolvedType = contentType || mime
      const dataUrl = `data:${resolvedType};base64,${buffer.toString("base64")}`
      return NextResponse.json({
        kind: isAudio ? "audio" : "image",
        ...(isAudio ? { audio: dataUrl } : { image: dataUrl }),
        endpoint: endpointKey,
      })
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get("content-type") || mime
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`

    return NextResponse.json({
      kind: isAudio ? "audio" : "image",
      ...(isAudio ? { audio: dataUrl } : { image: dataUrl }),
      endpoint: endpointKey,
    })
  } catch (error: any) {
    console.error("[stability/generate]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to call Stability API" },
      { status: 500 }
    )
  }
}
