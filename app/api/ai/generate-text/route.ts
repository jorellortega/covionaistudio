import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  try {
    const { prompt, field, service, apiKey } = await request.json()

    if (!prompt || !field || !service || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, field, service, apiKey' },
        { status: 400 }
      )
    }

    let generatedText = ""

    switch (service) {
      case 'openai':
        const openaiResponse = await OpenAIService.generateScript({
          prompt: `Generate ${field} for a storyboard scene: ${prompt}`,
          template: `You are a professional filmmaker. Generate creative and detailed ${field} for a storyboard scene. Be specific about visual details, mood, and cinematic elements.`,
          model: 'gpt-3.5-turbo',
          apiKey
        })
        
        if (!openaiResponse.success) {
          throw new Error(openaiResponse.error || 'OpenAI API failed')
        }
        
        generatedText = openaiResponse.data.choices[0].message.content
        break

      case 'anthropic':
        const claudeResponse = await AnthropicService.generateScript({
          prompt: `Generate ${field} for a storyboard scene: ${prompt}`,
          template: `You are a professional filmmaker. Generate creative and detailed ${field} for a storyboard scene. Be specific about visual details, mood, and cinematic elements.`,
          model: 'claude-3-sonnet-20240229',
          apiKey
        })
        
        if (!claudeResponse.success) {
          throw new Error(claudeResponse.error || 'Claude API failed')
        }
        
        generatedText = claudeResponse.data.content[0].text
        break

      default:
        throw new Error(`Unsupported service: ${service}`)
    }

    return NextResponse.json({ 
      success: true, 
      text: generatedText,
      service: service.toUpperCase()
    })

  } catch (error) {
    console.error('AI text generation error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}
