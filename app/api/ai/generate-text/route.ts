import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received request body:', JSON.stringify(body, null, 2))
    
    const { prompt, field, service, apiKey, selectedText, fullContent, sceneContext, contentType } = body

    // Handle both old format (field-based) and new format (AI text editing)
    if (!prompt || !service) {
      console.log('Validation failed:', { prompt, service, hasPrompt: !!prompt, hasService: !!service })
      return NextResponse.json(
        { 
          error: 'Missing required fields: prompt, service',
          received: { prompt, service, hasPrompt: !!prompt, hasService: !!service }
        },
        { status: 400 }
      )
    }

    // Get actual API keys from environment variables
    let actualApiKey = apiKey
    if (apiKey === 'configured' || apiKey === 'use_env_vars' || !apiKey) {
      if (service === 'openai') {
        actualApiKey = process.env.OPENAI_API_KEY
      } else if (service === 'anthropic') {
        actualApiKey = process.env.ANTHROPIC_API_KEY
      }
    }

    if (!actualApiKey) {
      return NextResponse.json(
        { error: `API key not configured for ${service}. Please set up your API key in the AI settings.` },
        { status: 400 }
      )
    }

    let generatedText = ""

    // New AI text editing functionality
    if (selectedText && fullContent) {
      const systemPrompt = `You are a professional screenwriter and editor. Your task is to modify a specific portion of text within a larger script or scene.

CONTEXT:
- Full Scene Content: ${fullContent}
${sceneContext ? `- Scene Context: ${sceneContext}` : ''}
- Content Type: ${contentType || 'script'}

TASK:
- Original Selected Text: "${selectedText}"
- User Request: "${prompt}"

INSTRUCTIONS:
1. Generate ONLY the replacement text for the selected portion
2. Maintain consistency with the surrounding content and style
3. Ensure the new text flows naturally with the rest of the scene
4. Keep the same approximate length unless specifically requested otherwise
5. Preserve any formatting, dialogue tags, or script conventions
6. Do NOT include the full scene or surrounding text - only the replacement

RESPONSE FORMAT:
Return ONLY the new text that should replace the selected portion, nothing else.`

      const userPrompt = `Please modify this text: "${selectedText}"

User's request: ${prompt}

Generate only the replacement text:`

      switch (service) {
        case 'openai':
          const openaiResponse = await OpenAIService.generateScript({
            prompt: userPrompt,
            template: systemPrompt,
            model: 'gpt-4',
            apiKey: actualApiKey
          })
          
          if (!openaiResponse.success) {
            throw new Error(openaiResponse.error || 'OpenAI API failed')
          }
          
          generatedText = openaiResponse.data.choices[0].message.content
          break

        case 'anthropic':
          const claudeResponse = await AnthropicService.generateScript({
            prompt: userPrompt,
            template: systemPrompt,
            model: 'claude-3-sonnet-20240229',
            apiKey: actualApiKey
          })
          
          if (!claudeResponse.success) {
            throw new Error(claudeResponse.error || 'Claude API failed')
          }
          
          generatedText = claudeResponse.data.content[0].text
          break

        default:
          throw new Error(`Unsupported service: ${service}`)
      }
    } else {
      // Legacy field-based generation (for backward compatibility)
      if (!field) {
        return NextResponse.json(
          { error: 'Missing required field: field' },
          { status: 400 }
        )
      }

      switch (service) {
        case 'openai':
          const openaiResponse = await OpenAIService.generateScript({
            prompt: `Generate ${field} for a storyboard scene: ${prompt}`,
            template: `You are a professional filmmaker. Generate creative and detailed ${field} for a storyboard scene. Be specific about visual details, mood, and cinematic elements.`,
            model: 'gpt-3.5-turbo',
            apiKey: actualApiKey
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
            apiKey: actualApiKey
          })
          
          if (!claudeResponse.success) {
            throw new Error(claudeResponse.error || 'Claude API failed')
          }
          
          generatedText = claudeResponse.data.content[0].text
          break

        default:
          throw new Error(`Unsupported service: ${service}`)
      }
    }

    return NextResponse.json({ 
      success: true, 
      text: generatedText,
      service: service.toUpperCase()
    })

  } catch (error) {
    console.error('AI text generation error:', error)
    
    // Add more detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        service,
        hasApiKey: !!actualApiKey,
        apiKeyLength: actualApiKey ? actualApiKey.length : 0
      })
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
        details: {
          service,
          hasApiKey: !!actualApiKey,
          contentType: contentType || 'unknown'
        }
      },
      { status: 500 }
    )
  }
}
