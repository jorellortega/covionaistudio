import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Helper function to get OpenAI API key (system-wide or env)
async function getOpenAIApiKey(): Promise<string | null> {
  // First check system-wide API keys
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    try {
      const { data: systemConfig } = await supabaseAdmin.rpc('get_system_ai_config')
      
      if (systemConfig && Array.isArray(systemConfig)) {
        const configMap: Record<string, string> = {}
        systemConfig.forEach((item: any) => {
          configMap[item.setting_key] = item.setting_value
        })

        if (configMap['openai_api_key']?.trim()) {
          return configMap['openai_api_key'].trim()
        }
      }
    } catch (error) {
      console.error('Error fetching system-wide API key:', error)
    }
  }

  // Fallback to environment variable
  return process.env.OPENAI_API_KEY || null
}

async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    // If already a data URL, extract base64
    if (imageUrl.startsWith('data:image/')) {
      const base64Part = imageUrl.split(',')[1]
      if (!base64Part) {
        throw new Error('Invalid data URL format')
      }
      return base64Part
    }

    // Fetch the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return buffer.toString('base64')
  } catch (error) {
    console.error('Error converting image to base64:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrl } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    // Get OpenAI API key
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set it in AI Settings.' },
        { status: 500 }
      )
    }

    // Convert image to base64
    let base64Image: string
    let mimeType = 'image/jpeg'

    try {
      if (imageUrl.startsWith('data:')) {
        // Already base64
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          mimeType = match[1]
          base64Image = match[2]
        } else {
          throw new Error('Invalid data URL format')
        }
      } else {
        // Fetch and convert
        base64Image = await imageUrlToBase64(imageUrl)
        // Try to detect mime type from URL
        if (imageUrl.toLowerCase().includes('.png')) {
          mimeType = 'image/png'
        } else if (imageUrl.toLowerCase().includes('.webp')) {
          mimeType = 'image/webp'
        }
      }
    } catch (error) {
      console.error('Error processing image:', error)
      return NextResponse.json(
        { error: 'Failed to process image. Please ensure the image URL is accessible.' },
        { status: 400 }
      )
    }

    const visionPrompt = `Analyze this image and create a technical, cinematic AI image generation prompt in the style of professional production briefs. 

The prompt should be formatted as a universal template focusing on:
- Technical camera specifications (lens type, depth of field, shot format)
- Color grading and palette (specific color descriptions, saturation levels, tone)
- Lighting techniques (volumetric rays, time of day, light quality, shadows)
- Visual effects and atmosphere (particles, mist, glow, bokeh)
- Cinematic composition and framing
- Texture and material details
- Overall aesthetic and mood (but described technically, not narratively)

CRITICAL: Write the prompt in a technical, template-style format like this example:
"Cinematic ultra-realistic 8K shot, photographic detail, [atmosphere description]. [Lighting description] with [specific effects]. Color grade: [specific colors and tones]. [Material/texture details]. Shot on [lens type], [depth of field], [format specs], with [composition details]. [Subject description if needed]. Overall palette [color description], creating [mood] cinematic look."

DO NOT write narrative descriptions like "A scene featuring..." or "The setting includes...". Instead, use technical, direct language like "Cinematic shot, [specs], [subject], [lighting], [color grade], [composition]."

IMPORTANT: You MUST return ONLY valid JSON, no markdown, no code blocks, no additional text. The response must be parseable JSON with this exact structure:
{
  "title": "A concise technical title (e.g., 'Cinematic Sci-Fi Landscape', 'Dramatic Portrait Lighting')",
  "prompt": "A technical, template-style prompt in the format shown above. Start with 'Cinematic' or similar technical descriptor, include camera specs, color grading, lighting, composition, and atmosphere. NO narrative sentences.",
  "type": "One of: character, environment, prop, color, lighting, style, prompt",
  "style": "The visual style (e.g., cinematic, photorealistic, stylized, painterly, etc.)",
  "tags": "Comma-separated tags describing key elements (e.g., sci-fi, sunset, dramatic, moody, portrait, landscape)"
}

Return ONLY the JSON object, nothing else.`

    // Use GPT-4 Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: visionPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
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
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()
    const analysisText = data.choices?.[0]?.message?.content || ''

    if (!analysisText) {
      return NextResponse.json(
        { error: 'No analysis received from AI' },
        { status: 500 }
      )
    }

    // Try to parse JSON from the response
    let analysisResult: any
    try {
      // Extract JSON from markdown code blocks if present
      let jsonText = analysisText.trim()
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/i, '')
      jsonText = jsonText.replace(/\n?```\s*$/i, '')
      jsonText = jsonText.trim()

      // Try to find JSON object in the text if it's wrapped in other text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }

      analysisResult = JSON.parse(jsonText)
      
      // Validate required fields
      if (!analysisResult.prompt) {
        throw new Error('Missing prompt field in response')
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      console.error('Raw response:', analysisText.substring(0, 500))
      
      // Fallback: try to extract information manually
      // Try to infer type and style from the text
      const lowerText = analysisText.toLowerCase()
      let inferredType = 'prompt'
      if (lowerText.includes('character') || lowerText.includes('person') || lowerText.includes('portrait')) {
        inferredType = 'character'
      } else if (lowerText.includes('environment') || lowerText.includes('landscape') || lowerText.includes('scene')) {
        inferredType = 'environment'
      } else if (lowerText.includes('lighting') || lowerText.includes('light')) {
        inferredType = 'lighting'
      } else if (lowerText.includes('color') || lowerText.includes('palette')) {
        inferredType = 'color'
      }

      let inferredStyle = ''
      if (lowerText.includes('cinematic')) inferredStyle = 'cinematic'
      else if (lowerText.includes('photorealistic') || lowerText.includes('realistic')) inferredStyle = 'photorealistic'
      else if (lowerText.includes('stylized')) inferredStyle = 'stylized'

      // Extract a title from the first sentence or create one
      const firstSentence = analysisText.split(/[.!?]/)[0].trim()
      const title = firstSentence.length > 60 ? firstSentence.substring(0, 60) + '...' : firstSentence || 'Image Analysis'

      analysisResult = {
        title: title,
        prompt: analysisText,
        type: inferredType,
        style: inferredStyle,
        tags: ''
      }
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult
    })
  } catch (error: any) {
    console.error('Error analyzing image:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to analyze image' },
      { status: 500 }
    )
  }
}

