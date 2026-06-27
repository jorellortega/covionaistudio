import { NextRequest, NextResponse } from "next/server"
import { RUNWAY, getRunwayHeaders } from "@/lib/runway-config"
import { getRunwayApiKeyForUser } from "@/lib/runway-api-key"
import { getTaskEndpoint, type RunwayTaskType } from "@/lib/runway-models"
import {
  buildRunwayReferenceImagesFromFiles,
  ensureRunwayReferenceTagsInPrompt,
  type RunwayReferenceImage,
} from "@/lib/runway-reference"

export const maxDuration = 300
export const runtime = "nodejs"

type ReferenceImageInput = { uri: string; tag?: string }

async function resolveTurboReferenceImages(
  file: File | null,
  styleFile: File | null,
  styleFile2: File | null,
  referenceImages?: ReferenceImageInput[],
  runwayUri?: string | null,
): Promise<RunwayReferenceImage[]> {
  if (file) {
    const extras: File[] = []
    if (styleFile?.size) extras.push(styleFile)
    if (styleFile2?.size) extras.push(styleFile2)
    return buildRunwayReferenceImagesFromFiles(file, extras)
  }
  if (referenceImages?.length) {
    return referenceImages.map((ref, index) => ({
      uri: ref.uri,
      tag: ref.tag || (index === 0 ? "reference" : index === 1 ? "linked" : "extra"),
    }))
  }
  if (runwayUri) {
    return [{ uri: runwayUri, tag: "reference" }]
  }
  return []
}

export async function POST(request: NextRequest) {
  try {
    const { createServerClient } = await import("@supabase/ssr")
    const { cookies } = await import("next/headers")

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              /* ignore */
            }
          },
        },
      },
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiKey = await getRunwayApiKeyForUser(user.id)
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No Runway ML API key configured. Add one in Settings → AI Settings or set RUNWAYML_API_SECRET on the server.",
        },
        { status: 403 },
      )
    }

    const contentType = request.headers.get("content-type") || ""
    let task: RunwayTaskType
    let model: string
    let promptText: string | undefined
    let ratio = "1280:720"
    let duration = 5
    let runwayUri: string | null = null
    let referenceVideoUri: string | null = null
    let referenceImages: ReferenceImageInput[] | undefined
    let seed: number | undefined
    let characterType: "image" | "video" = "image"
    let file: File | null = null
    let styleFile: File | null = null
    let styleFile2: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      task = formData.get("task") as RunwayTaskType
      model = (formData.get("model") as string) || ""
      promptText = (formData.get("promptText") as string) || undefined
      ratio = (formData.get("ratio") as string) || "1280:720"
      duration = parseInt((formData.get("duration") as string) || "5", 10) || 5
      runwayUri = (formData.get("runwayUri") as string) || null
      referenceVideoUri = (formData.get("referenceVideoUri") as string) || null
      const seedRaw = formData.get("seed")
      if (seedRaw) seed = parseInt(String(seedRaw), 10)
      characterType = (formData.get("characterType") as "image" | "video") || "image"
      file = formData.get("file") as File | null
      styleFile = formData.get("styleFile") as File | null
      styleFile2 = formData.get("styleFile2") as File | null
      const refImagesRaw = formData.get("referenceImages")
      if (refImagesRaw && typeof refImagesRaw === "string") {
        try {
          referenceImages = JSON.parse(refImagesRaw) as ReferenceImageInput[]
        } catch {
          /* ignore invalid JSON */
        }
      }
    } else {
      const body = await request.json()
      task = body.task
      model = body.model
      promptText = body.promptText
      ratio = body.ratio || "1280:720"
      duration = typeof body.duration === "number" ? body.duration : parseInt(String(body.duration || 5), 10) || 5
      runwayUri = body.runwayUri || null
      referenceVideoUri = body.referenceVideoUri || null
      referenceImages = body.referenceImages
      seed = body.seed
      characterType = body.characterType || "image"
    }

    if (!task || !model) {
      return NextResponse.json({ error: "task and model are required" }, { status: 400 })
    }

    const validDuration = duration === 10 ? 10 : 5
    const endpoint = `${RUNWAY.HOST}${getTaskEndpoint(task)}`
    let requestBody: Record<string, unknown> = {}

    switch (task) {
      case "text_to_image": {
        if (!promptText?.trim()) {
          return NextResponse.json({ error: "promptText is required" }, { status: 400 })
        }
        requestBody = {
          model,
          promptText: promptText.trim(),
          ratio,
        }
        if (seed !== undefined && !Number.isNaN(seed)) requestBody.seed = seed

        if (model === "gen4_image_turbo") {
          const refs = await resolveTurboReferenceImages(
            file,
            styleFile,
            styleFile2,
            referenceImages,
            runwayUri,
          )
          if (!refs.length) {
            return NextResponse.json(
              { error: "Gen-4 Image Turbo requires a reference image (upload or URL)." },
              { status: 400 },
            )
          }
          requestBody.referenceImages = refs
          requestBody.promptText = ensureRunwayReferenceTagsInPrompt(
            promptText.trim(),
            refs.map((ref) => ref.tag),
          )
        } else if (referenceImages?.length) {
          requestBody.referenceImages = referenceImages
          requestBody.promptText = ensureRunwayReferenceTagsInPrompt(
            promptText.trim(),
            referenceImages.map((ref, index) => ref.tag || (index === 0 ? "reference" : "linked")),
          )
        } else if (file) {
          const refs = await buildRunwayReferenceImagesFromFiles(file, [
            ...(styleFile?.size ? [styleFile] : []),
            ...(styleFile2?.size ? [styleFile2] : []),
          ])
          requestBody.referenceImages = refs
          requestBody.promptText = ensureRunwayReferenceTagsInPrompt(
            promptText.trim(),
            refs.map((ref) => ref.tag),
          )
        }
        break
      }

      case "text_to_video": {
        requestBody = {
          model,
          promptText: promptText?.trim() || "",
          ratio,
          duration: validDuration,
        }
        if (runwayUri) {
          requestBody.promptImage = [{ uri: runwayUri, position: "first" }]
        }
        break
      }

      case "image_to_video": {
        if (!runwayUri) {
          return NextResponse.json({ error: "Upload an image first (runwayUri required)." }, { status: 400 })
        }
        requestBody = {
          model,
          promptImage: runwayUri,
          ratio,
          duration: validDuration,
        }
        if (promptText?.trim()) requestBody.promptText = promptText.trim()
        break
      }

      case "video_to_video": {
        if (!runwayUri) {
          return NextResponse.json({ error: "Upload a source video first." }, { status: 400 })
        }
        requestBody = {
          model,
          videoUri: runwayUri,
          ratio,
        }
        if (promptText?.trim()) requestBody.promptText = promptText.trim()
        break
      }

      case "character_performance": {
        if (!runwayUri || !referenceVideoUri) {
          return NextResponse.json(
            { error: "Act-Two requires a character file and a reference performance video." },
            { status: 400 },
          )
        }
        requestBody = {
          model: "act_two",
          character: { type: characterType, uri: runwayUri },
          reference: { type: "video", uri: referenceVideoUri },
          ratio,
        }
        if (promptText?.trim()) requestBody.promptText = promptText.trim()
        break
      }

      case "video_upscale": {
        if (!runwayUri) {
          return NextResponse.json({ error: "Upload a video to upscale." }, { status: 400 })
        }
        requestBody = {
          model: "upscale_v1",
          videoUri: runwayUri,
        }
        break
      }

      default:
        return NextResponse.json({ error: `Unsupported task: ${task}` }, { status: 400 })
    }

    console.log(`🎬 Runway ${task} → ${model}`, { endpoint, ratio, duration: validDuration })

    const runwayResponse = await fetch(endpoint, {
      method: "POST",
      headers: getRunwayHeaders(apiKey),
      body: JSON.stringify(requestBody),
    })

    if (!runwayResponse.ok) {
      const errorText = await runwayResponse.text()
      console.error("Runway API error:", runwayResponse.status, errorText)
      return NextResponse.json(
        { error: `Runway API failed (${runwayResponse.status}): ${errorText.slice(0, 500)}` },
        { status: runwayResponse.status >= 400 && runwayResponse.status < 500 ? runwayResponse.status : 500 },
      )
    }

    const data = await runwayResponse.json()

    return NextResponse.json({
      success: true,
      taskId: data.id,
      task,
      model,
      data,
    })
  } catch (error) {
    console.error("Runway route error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Runway request failed" },
      { status: 500 },
    )
  }
}
