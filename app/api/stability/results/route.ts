import { NextRequest, NextResponse } from "next/server"

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
    const body = await request.json()
    const apiKey = String(body.apiKey || "").trim()
    const id = String(body.id || "").trim()
    const kind = body.kind === "audio" ? "audio" : "image"
    const outputFormat = String(body.outputFormat || (kind === "audio" ? "mp3" : "png"))

    if (!apiKey) {
      return NextResponse.json({ error: "Stability API key is required" }, { status: 400 })
    }
    if (!id) {
      return NextResponse.json({ error: "Generation id is required" }, { status: 400 })
    }

    const resultsPath =
      kind === "audio"
        ? `https://api.stability.ai/v2beta/audio/results/${id}`
        : `https://api.stability.ai/v2beta/results/${id}`

    const accept = "application/json"

    const response = await fetch(resultsPath, {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept,
        "stability-client-id": "cinema-platform",
        "stability-client-version": "1.0.0",
      },
    })

    if (response.status === 202) {
      return NextResponse.json({ status: "in-progress" }, { status: 202 })
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
            `Stability results error (${response.status})`,
          details: errorBody,
        },
        { status: response.status }
      )
    }

    const contentType = response.headers.get("content-type") || ""
    const mime =
      kind === "audio"
        ? outputFormat === "wav"
          ? "audio/wav"
          : "audio/mpeg"
        : "image/png"

    // JSON base64 response
    if (contentType.includes("application/json")) {
      const data = await response.json()
      const base64 = extractBase64(data)
      if (!base64) {
        return NextResponse.json(
          { error: `No ${kind} data in result`, details: data },
          { status: 502 }
        )
      }
      const dataUrl = `data:${mime};base64,${base64}`
      return NextResponse.json({
        status: "complete",
        kind,
        ...(kind === "audio" ? { audio: dataUrl } : { image: dataUrl }),
        seed: data?.seed,
        finishReason: data?.finish_reason || data?.finishReason,
      })
    }

    // Binary fallback
    const buffer = Buffer.from(await response.arrayBuffer())
    const dataUrl = `data:${contentType || mime};base64,${buffer.toString("base64")}`
    return NextResponse.json({
      status: "complete",
      kind,
      ...(kind === "audio" ? { audio: dataUrl } : { image: dataUrl }),
    })
  } catch (error: any) {
    console.error("[stability/results]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch Stability result" },
      { status: 500 }
    )
  }
}
