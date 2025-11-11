import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AIMessage, AISettingsMap } from '@/lib/ai-chat-types'

// Helper function to map settings array to object
function mapSettings(settingsData: any[]): AISettingsMap {
  const settings: AISettingsMap = {}
  if (settingsData) {
    settingsData.forEach((setting: any) => {
      settings[setting.setting_key] = setting.setting_value
    })
  }
  return settings
}

// Call OpenAI
async function callOpenAI(messages: AIMessage[], settings: AISettingsMap): Promise<{ message: string } | null> {
  const openaiKey = settings['openai_api_key']?.trim()
  const model = settings['openai_model']?.trim() || 'gpt-4o-mini'

  if (!openaiKey) {
    console.log('OpenAI API key not configured')
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', response.status, errorText)
      return null
    }

    const data = await response.json()
    const message = data?.choices?.[0]?.message?.content?.trim()

    if (!message) {
      console.error('No message in OpenAI response')
      return null
    }

    return { message }
  } catch (error) {
    console.error('OpenAI API call failed:', error)
    return null
  }
}

// Call Anthropic (fallback)
async function callAnthropic(messages: AIMessage[], settings: AISettingsMap, systemPrompt?: string): Promise<{ message: string } | null> {
  const anthropicKey = settings['anthropic_api_key']?.trim()
  const model = settings['anthropic_model']?.trim() || 'claude-3-5-sonnet-20241022'

  if (!anthropicKey) {
    console.log('Anthropic API key not configured')
    return null
  }

  try {
    // Convert messages format for Anthropic
    // Filter out system messages and convert to Anthropic format
    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
    const conversationMessages = messages.filter(m => m.role !== 'system')

    for (const msg of conversationMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    // Build request body - Anthropic API supports system parameter
    const requestBody: any = {
      model,
      max_tokens: 2000,
      messages: anthropicMessages,
    }

    // Add system prompt if available (Anthropic API supports system parameter in newer versions)
    if (systemPrompt) {
      requestBody.system = systemPrompt
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', response.status, errorText)
      return null
    }

    const data = await response.json()
    const message = data?.content?.[0]?.text?.trim()

    if (!message) {
      console.error('No message in Anthropic response')
      return null
    }

    return { message }
  } catch (error) {
    console.error('Anthropic API call failed:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationHistory = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
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
    const systemPrompt = settings['system_prompt']?.trim()

    // Build messages array
    const messages: AIMessage[] = []
    
    // Add system prompt if available
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    // Add conversation history
    if (Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory)
    }

    // Add current user message
    messages.push({ role: 'user', content: message.trim() })

    // Try OpenAI first, then Anthropic as fallback
    let responsePayload = await callOpenAI(messages, settings)

    if (!responsePayload) {
      console.log('OpenAI failed, trying Anthropic...')
      responsePayload = await callAnthropic(messages, settings, systemPrompt)
    }

    if (!responsePayload) {
      return NextResponse.json(
        { error: 'AI service unavailable. Please check API key configuration.' },
        { status: 503 }
      )
    }

    // Remove bold markdown formatting (convert **text** to text)
    const cleanedMessage = responsePayload.message.replace(/\*\*(.*?)\*\*/g, '$1')

    return NextResponse.json({ message: cleanedMessage })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

