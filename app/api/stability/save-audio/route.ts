import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const { audioBlob, fileName, audioTitle, userId, prompt, endpoint, seed, metadata } =
      await request.json()

    if (!audioBlob || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: audioBlob, userId" },
        { status: 400 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server storage configuration missing. Please check SUPABASE env variables." },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error: bucketInfoError } = await supabase.storage.getBucket("cinema_files")
    if (bucketInfoError) {
      const { error: createBucketError } = await supabase.storage.createBucket("cinema_files", {
        public: true,
        allowedMimeTypes: ["audio/*", "image/*", "video/*", "application/*"],
      })
      if (createBucketError && (createBucketError as any).status !== 400) {
        return NextResponse.json(
          { error: `Failed to ensure storage bucket: ${createBucketError.message}` },
          { status: 500 }
        )
      }
    }

    let contentType = "audio/mpeg"
    let ext = "mp3"
    const blobStr = typeof audioBlob === "string" ? audioBlob : ""
    if (blobStr.includes("audio/wav") || blobStr.includes("audio/wave")) {
      contentType = "audio/wav"
      ext = "wav"
    } else if (blobStr.includes("audio/mpeg") || blobStr.includes("audio/mp3")) {
      contentType = "audio/mpeg"
      ext = "mp3"
    }

    const base64Data = blobStr.includes(",") ? blobStr.split(",")[1] : blobStr
    if (!base64Data) {
      return NextResponse.json({ error: "Invalid audioBlob payload" }, { status: 400 })
    }
    const audioBuffer = Buffer.from(base64Data, "base64")

    const safeName = String(fileName || "stability_audio")
      .replace(/[^a-z0-9_-]/gi, "_")
      .toLowerCase()
      .slice(0, 80)
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}_${safeName}.${ext}`
    const filePath = `${userId}/stability-ai-test/audio/${uniqueFileName}`

    const { error: uploadError } = await supabase.storage
      .from("cinema_files")
      .upload(filePath, audioBuffer, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      console.error("[stability/save-audio] upload error:", uploadError)
      return NextResponse.json(
        { error: `Failed to upload audio: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage.from("cinema_files").getPublicUrl(filePath)
    const title =
      audioTitle ||
      `Stability Audio — ${endpoint || "generation"} — ${new Date().toLocaleString()}`

    const { data: assetData, error: assetError } = await supabase
      .from("assets")
      .insert({
        project_id: null,
        scene_id: null,
        treatment_id: null,
        user_id: userId,
        title,
        content_type: "audio",
        content_url: urlData.publicUrl,
        prompt: prompt || "Stability AI audio generation",
        model: "Stability AI",
        version: 1,
        version_name: "Stability Audio",
        is_latest_version: true,
        generation_settings: {
          service: "Stability AI",
          endpoint: endpoint || null,
          seed: seed ?? null,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          storage_path: filePath,
          generated_at: new Date().toISOString(),
          source: "stability-ai-test",
          file_size: audioBuffer.byteLength,
          size: audioBuffer.byteLength,
          content_type: contentType,
          ...(metadata || {}),
        },
      })
      .select()
      .single()

    if (assetError) {
      console.error("[stability/save-audio] asset error:", assetError)
      // Keep the file even if asset insert fails — still useful for playback/download
      return NextResponse.json({
        success: true,
        warning: `Uploaded but asset record failed: ${assetError.message}`,
        data: {
          publicUrl: urlData.publicUrl,
          storagePath: filePath,
          asset: null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        publicUrl: urlData.publicUrl,
        storagePath: filePath,
        asset: assetData,
      },
    })
  } catch (error: any) {
    console.error("[stability/save-audio]", error)
    return NextResponse.json(
      { error: error?.message || "Failed to save Stability audio" },
      { status: 500 }
    )
  }
}
