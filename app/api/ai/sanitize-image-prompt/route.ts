import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

async function getOpenAIApiKey(): Promise<string | null> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    try {
      const { data: systemConfig } = await supabaseAdmin.rpc("get_system_ai_config")
      if (systemConfig && Array.isArray(systemConfig)) {
        const configMap: Record<string, string> = {}
        systemConfig.forEach((item: { setting_key: string; setting_value: string }) => {
          configMap[item.setting_key] = item.setting_value
        })
        if (configMap.openai_api_key?.trim()) {
          return configMap.openai_api_key.trim()
        }
      }
    } catch (error) {
      console.error("Error fetching system-wide API key:", error)
    }
  }

  return process.env.OPENAI_API_KEY || null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const apiKey = await getOpenAIApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please set it in AI Settings." },
        { status: 500 },
      )
    }

    const systemPrompt = `You rewrite image generation prompts so they pass OpenAI/DALL-E/GPT Image safety filters while preserving the creative intent as closely as possible.

Rules:
- Keep character names, location, shot type, camera angle, lighting, mood, and action
- Replace lingerie, underwear, swimwear in suggestive contexts with athletic wear, workout clothing, or modest casual clothing
- Remove sexual or suggestive framing; keep the scene professional and cinematic
- Replace graphic violence, weapons, gore, nudity, and explicit content with safe cinematic equivalents
- Do not add new story elements; only rephrase what is already implied
- Output ONLY the rewritten prompt text — no quotes, labels, or explanation`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Rewrite this image prompt to be AI-safe while staying as close as possible to the original:\n\n${prompt}`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.4,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `OpenAI API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorText || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const data = await response.json()
    const sanitized =
      data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") || ""

    if (!sanitized) {
      return NextResponse.json({ error: "No rewritten prompt received from AI" }, { status: 500 })
    }

    return NextResponse.json({ success: true, prompt: sanitized })
  } catch (error) {
    console.error("Error sanitizing image prompt:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sanitize prompt" },
      { status: 500 },
    )
  }
}
