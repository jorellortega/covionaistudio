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

// Helper function to convert image URL to base64
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    // If already a data URL, return as is
    if (imageUrl.startsWith('data:image/')) {
      const base64Part = imageUrl.split(',')[1]
      if (!base64Part) {
        throw new Error('Invalid data URL format')
      }
      return base64Part
    }

    console.log('📥 Fetching image from URL:', imageUrl.substring(0, 100))
    
    // Fetch the image with a timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'image/*'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded image is empty')
      }
      
      console.log('✅ Image downloaded, size:', arrayBuffer.byteLength, 'bytes')
      
      const buffer = Buffer.from(arrayBuffer)
      return buffer.toString('base64')
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    console.error('❌ Error converting image to base64:', error)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Image download timeout. Please try again.')
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  console.log('🎬 [Analyze Character Image] API endpoint called')
  
  try {
    const body = await request.json()
    const { imageUrl, characterId, characterName } = body

    console.log('📥 Request received:', {
      hasImageUrl: !!imageUrl,
      imageUrlPreview: imageUrl?.substring(0, 100),
      characterId,
      characterName
    })

    if (!imageUrl) {
      console.error('❌ Missing imageUrl in request')
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    // Get OpenAI API key
    console.log('🔑 Fetching OpenAI API key...')
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) {
      console.error('❌ OpenAI API key not found')
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set it in AI Settings.' },
        { status: 500 }
      )
    }
    console.log('✅ OpenAI API key found')

    // Convert image to base64
    let base64Image: string
    let mimeType = 'image/jpeg'

    try {
      console.log('🖼️ Processing image URL:', imageUrl.substring(0, 100))
      
      if (imageUrl.startsWith('data:image/')) {
        console.log('📝 Image is data URL, extracting base64...')
        // Extract mime type and base64 from data URL
        const match = imageUrl.match(/data:(image\/[^;]+);base64,(.+)/)
        if (match) {
          mimeType = match[1]
          base64Image = match[2]
          console.log('✅ Extracted base64 from data URL, mime type:', mimeType, 'base64 length:', base64Image.length)
        } else {
          // Try simple split
          const parts = imageUrl.split(',')
          if (parts.length > 1) {
            base64Image = parts[1]
            console.log('✅ Extracted base64 using simple split, length:', base64Image.length)
          } else {
            throw new Error('Invalid data URL format - no base64 data found')
          }
        }
      } else {
        console.log('🌐 Image is URL, fetching and converting to base64...')
        base64Image = await imageUrlToBase64(imageUrl)
        // Try to detect mime type from URL
        if (imageUrl.includes('.png') || imageUrl.includes('image/png')) mimeType = 'image/png'
        else if (imageUrl.includes('.webp') || imageUrl.includes('image/webp')) mimeType = 'image/webp'
        else if (imageUrl.includes('.gif') || imageUrl.includes('image/gif')) mimeType = 'image/gif'
        else if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') || imageUrl.includes('image/jpeg')) mimeType = 'image/jpeg'
        
        console.log('✅ Image converted to base64, detected mime type:', mimeType, 'base64 length:', base64Image.length)
      }
      
      if (!base64Image || base64Image.length === 0) {
        throw new Error('Base64 image data is empty')
      }
      
      // Check image size (OpenAI has limits - roughly 20MB for base64)
      const estimatedSizeMB = (base64Image.length * 3) / 4 / 1024 / 1024
      console.log('📊 Image size estimate:', estimatedSizeMB.toFixed(2), 'MB')
      
      if (estimatedSizeMB > 20) {
        console.warn('⚠️ Image size may be too large for OpenAI API')
      }
    } catch (error) {
      console.error('❌ Error processing image:', error)
      return NextResponse.json(
        { 
          error: `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: 'Please ensure the image URL is accessible and the image format is supported (JPEG, PNG, WebP, GIF).'
        },
        { status: 400 }
      )
    }

    // Use GPT-4 Vision (gpt-4o or gpt-4-turbo) for image analysis
    const visionPrompt = `Analyze this character image in detail. Extract all visible character attributes and details. Focus on:

1. **Physical Appearance**:
   - Height/build/body type
   - Skin tone
   - Eye color, shape, and expression
   - Hair color (natural and current), length, texture, and style
   - Face shape
   - Distinguishing marks (tattoos, scars, birthmarks, etc.)
   - Age estimate
   - Gender presentation

2. **Clothing & Style**:
   - Clothing style
   - Color palette
   - Accessories (jewelry, glasses, etc.)
   - Overall fashion aesthetic

3. **Body Language & Presence**:
   - Posture
   - Body language
   - Expression/mood

4. **Character Details**:
   - Any visible characteristics that could inform personality
   - Setting/environment if visible
   - Any props or objects

Return the analysis as a detailed JSON object with the following structure (use null for unknown values):
{
  "physical_appearance": {
    "height": "string or null",
    "build": "string or null (e.g., thin, athletic, average, stocky)",
    "skin_tone": "string or null",
    "eye_color": "string or null",
    "eye_shape": "string or null",
    "eye_expression": "string or null",
    "hair_color_natural": "string or null",
    "hair_color_current": "string or null",
    "hair_length": "string or null (e.g., short, medium, long)",
    "hair_texture": "string or null (e.g., straight, wavy, curly)",
    "usual_hairstyle": "string or null",
    "face_shape": "string or null",
    "distinguishing_marks": "string or null",
    "age_estimate": "number or null",
    "gender": "string or null"
  },
  "clothing_style": {
    "usual_clothing_style": "string or null",
    "typical_color_palette": ["array of color strings"],
    "accessories": "string or null"
  },
  "body_language": {
    "posture": "string or null",
    "body_language": "string or null"
  },
  "description": "Overall detailed description of the character's appearance and presence"
}

Be thorough and extract every visible detail. ${characterName ? `The character's name is "${characterName}".` : ''}`

    let analysisResult: any
    let lastError: Error | null = null

    // Try using chat/completions API directly (more reliable for vision tasks)
    try {
      console.log('🔍 Starting GPT Vision analysis...')
      
      const responseBody = {
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
      }

      console.log('📤 Calling OpenAI Chat/Completions API for vision analysis...')
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(responseBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ OpenAI API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        
        let errorMessage = `OpenAI API error: ${response.status}`
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error?.message || errorText || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('✅ OpenAI API response received')
      
      analysisResult = data.choices?.[0]?.message?.content || null
      
      if (!analysisResult) {
        console.error('⚠️ No content in OpenAI response:', JSON.stringify(data, null, 2))
        throw new Error('OpenAI API returned empty response')
      }
      
      console.log('✅ Analysis result received, length:', analysisResult.length)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error('❌ Error calling OpenAI API:', lastError)
      
      // Return a more helpful error message
      return NextResponse.json(
        { 
          error: `Failed to analyze image: ${lastError.message}`,
          details: 'Please check that your OpenAI API key is valid and has access to GPT-4 Vision models.'
        },
        { status: 500 }
      )
    }

    if (!analysisResult) {
      console.error('❌ Analysis result is null or empty')
      return NextResponse.json(
        { 
          error: 'Failed to get analysis from OpenAI',
          details: lastError?.message || 'The API returned an empty response.'
        },
        { status: 500 }
      )
    }

    // Try to extract JSON from the response
    let characterData: any = {}
    try {
      // Try to find JSON in the response
      const jsonMatch = analysisResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        characterData = JSON.parse(jsonMatch[0])
      } else {
        // If no JSON found, create a structured object from the text
        characterData = {
          description: analysisResult
        }
      }
    } catch (parseError) {
      // If parsing fails, just use the description
      characterData = {
        description: analysisResult
      }
    }

    // Transform the extracted data to match our character model structure
    const extractedData: any = {}

    if (characterData.physical_appearance) {
      const pa = characterData.physical_appearance
      if (pa.height) extractedData.height = pa.height
      if (pa.build) extractedData.build = pa.build
      if (pa.skin_tone) extractedData.skin_tone = pa.skin_tone
      if (pa.eye_color) extractedData.eye_color = pa.eye_color
      if (pa.eye_shape) extractedData.eye_shape = pa.eye_shape
      if (pa.eye_expression) extractedData.eye_expression = pa.eye_expression
      if (pa.hair_color_natural) extractedData.hair_color_natural = pa.hair_color_natural
      if (pa.hair_color_current) extractedData.hair_color_current = pa.hair_color_current
      if (pa.hair_length) extractedData.hair_length = pa.hair_length
      if (pa.hair_texture) extractedData.hair_texture = pa.hair_texture
      if (pa.usual_hairstyle) extractedData.usual_hairstyle = pa.usual_hairstyle
      if (pa.face_shape) extractedData.face_shape = pa.face_shape
      if (pa.distinguishing_marks) extractedData.distinguishing_marks = pa.distinguishing_marks
      if (pa.age_estimate) extractedData.age = pa.age_estimate
      if (pa.gender) extractedData.gender = pa.gender
    }

    if (characterData.clothing_style) {
      const cs = characterData.clothing_style
      if (cs.usual_clothing_style) extractedData.usual_clothing_style = cs.usual_clothing_style
      if (cs.typical_color_palette && Array.isArray(cs.typical_color_palette)) {
        extractedData.typical_color_palette = cs.typical_color_palette
      }
      if (cs.accessories) extractedData.accessories = cs.accessories
    }

    if (characterData.body_language) {
      const bl = characterData.body_language
      if (bl.posture) extractedData.posture = bl.posture
      if (bl.body_language) extractedData.body_language = bl.body_language
    }

    // Add or update description
    if (characterData.description) {
      extractedData.description = characterData.description
    }

    return NextResponse.json({
      success: true,
      extractedData,
      rawAnalysis: analysisResult,
      imageUrl
    })

  } catch (error) {
    console.error('❌ [Analyze Character Image] Unexpected error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze character image',
        details: 'An unexpected error occurred. Please check the server logs for more details.',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
