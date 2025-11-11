import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Helper function to map settings array to object
function mapSettings(settingsData: any[]): Record<string, string> {
  const settings: Record<string, string> = {}
  if (settingsData) {
    settingsData.forEach((setting: any) => {
      settings[setting.setting_key] = setting.setting_value
    })
  }
  return settings
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role to access settings
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Get AI settings from database
    const { data: settingsData, error: settingsError } = await supabase.rpc('get_system_ai_config')

    if (settingsError) {
      console.error('Error fetching AI settings:', settingsError)
      return NextResponse.json(
        { error: 'Failed to load AI configuration' },
        { status: 500 }
      )
    }

    const settings = mapSettings(settingsData || [])
    const openaiKey = settings['openai_api_key']?.trim()

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 400 }
      )
    }

    // Call OpenAI to enhance the prompt
    const enhancementPrompt = `You are an expert at crafting system prompts for AI assistants. Review the following system prompt and suggest improvements to make it more effective, clear, and comprehensive. Focus on:
1. Clarity and specificity of instructions
2. Tone and personality
3. Scope of capabilities
4. Edge cases and limitations
5. Best practices for AI system prompts

Current prompt:
"""
${prompt}
"""

Provide an improved version of this prompt. Return ONLY the improved prompt text, without any additional commentary or explanation.`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: settings['openai_model']?.trim() || 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: enhancementPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OpenAI API error:', response.status, errorText)
        return NextResponse.json(
          { error: 'Failed to generate enhanced prompt' },
          { status: 500 }
        )
      }

      const data = await response.json()
      const improvedPrompt = data?.choices?.[0]?.message?.content?.trim()

      if (!improvedPrompt) {
        return NextResponse.json(
          { error: 'No improved prompt generated' },
          { status: 500 }
        )
      }

      return NextResponse.json({ prompt: improvedPrompt })
    } catch (error) {
      console.error('OpenAI API call failed:', error)
      return NextResponse.json(
        { error: 'Failed to generate enhanced prompt' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Generate AI prompt error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

