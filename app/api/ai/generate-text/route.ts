import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, AnthropicService } from '@/lib/ai-services'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received request body:', JSON.stringify(body, null, 2))
    
    const { prompt, field, service, apiKey, model, selectedText, fullContent, sceneContext, contentType, userId, maxTokens } = body

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

    // Get actual API keys - check system-wide keys first (set by CEO), then environment variables
    // NOTE: Users cannot set their own API keys - only CEO can set system-wide keys
    let actualApiKey = apiKey
    if (apiKey === 'configured' || apiKey === 'use_env_vars' || !apiKey) {
      // FIRST: Check system-wide API keys from system_ai_config (set by CEO)
      try {
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

          // Get system-wide API keys using RPC function (bypasses RLS)
          const { data: systemConfig, error: systemError } = await supabaseAdmin.rpc('get_system_ai_config')
          
          if (!systemError && systemConfig && Array.isArray(systemConfig)) {
            const configMap: Record<string, string> = {}
            systemConfig.forEach((item: any) => {
              configMap[item.setting_key] = item.setting_value
            })

            if (service === 'openai' && configMap['openai_api_key']?.trim()) {
              actualApiKey = configMap['openai_api_key'].trim()
              console.log('✅ Using system-wide OpenAI API key from system_ai_config (CEO-set)')
            } else if (service === 'anthropic' && configMap['anthropic_api_key']?.trim()) {
              actualApiKey = configMap['anthropic_api_key'].trim()
              console.log('✅ Using system-wide Anthropic API key from system_ai_config (CEO-set)')
            } else {
              console.log(`ℹ️ System-wide ${service} API key not found in system_ai_config, will try environment variables`)
            }
          } else if (systemError) {
            console.error('❌ Error fetching system-wide API keys:', systemError)
          }
        }
      } catch (systemKeyError) {
        console.error('❌ Error checking system-wide API keys:', systemKeyError)
      }

      // Fallback to environment variables if no system-wide key found
      if (!actualApiKey || actualApiKey === 'configured' || actualApiKey === 'use_env_vars') {
        if (service === 'openai') {
          actualApiKey = process.env.OPENAI_API_KEY || ''
          if (actualApiKey) {
            console.log('✅ Using OpenAI API key from environment variables')
          }
        } else if (service === 'anthropic') {
          actualApiKey = process.env.ANTHROPIC_API_KEY || ''
          if (actualApiKey) {
            console.log('✅ Using Anthropic API key from environment variables')
          }
        }
      }
    }

    if (!actualApiKey) {
      return NextResponse.json(
        { 
          error: `API key not configured for ${service}. CEO must set system-wide API keys in Settings → AI Settings Admin, or configure environment variables.`,
          details: 'System-wide API keys are required. Contact your administrator.'
        },
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
          // Use provided model or default to gpt-4o-mini
          const openaiModel = model || 'gpt-4o-mini'
          console.log('🔍 [API] Calling OpenAI with:', {
            model: openaiModel,
            promptLength: userPrompt.length,
            maxTokens: maxTokens || 'default (1000)',
            field
          })
          const openaiResponse = await OpenAIService.generateScript({
            prompt: userPrompt,
            template: systemPrompt,
            model: openaiModel,
            apiKey: actualApiKey,
            maxTokens: maxTokens // Pass through maxTokens if provided
          })
          
          if (!openaiResponse.success) {
            throw new Error(openaiResponse.error || 'OpenAI API failed')
          }
          
          generatedText = openaiResponse.data.choices[0].message.content
          break

        case 'anthropic':
          // Use provided model or default to claude-3-5-sonnet-20241022
          const anthropicModel = model || 'claude-3-5-sonnet-20241022'
          console.log('🔍 [API] Calling Anthropic with:', {
            model: anthropicModel,
            promptLength: userPrompt.length,
            maxTokens: maxTokens || 'default (1000)',
            field
          })
          const claudeResponse = await AnthropicService.generateScript({
            prompt: userPrompt,
            template: systemPrompt,
            model: anthropicModel,
            apiKey: actualApiKey,
            maxTokens: maxTokens // Pass through maxTokens if provided
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

      // Check if the prompt already contains detailed instructions (like for synopsis generation)
      // If it does, use it directly; otherwise use the generic template
      const hasDetailedInstructions = prompt.includes('SYNOPSIS REQUIREMENTS') || 
                                      prompt.includes('IMPORTANT:') || 
                                      prompt.includes('You are a professional')
      
      let systemTemplate: string
      let userPromptText: string

      if (hasDetailedInstructions) {
        // Use the prompt as-is since it contains detailed instructions
        // Extract system instructions and user prompt if present, otherwise use prompt as user message
        if (field === 'synopsis' && prompt.includes('SYNOPSIS REQUIREMENTS')) {
          // For synopsis, use a simple system prompt and the detailed user prompt
          systemTemplate = `You are a professional screenwriter. Follow the user's instructions precisely to generate a concise synopsis.`
          userPromptText = prompt
        } else {
          systemTemplate = `You are a professional screenwriter. Follow the user's instructions precisely.`
          userPromptText = prompt
        }
      } else {
        // Use generic template for backward compatibility
        if (field === 'synopsis') {
          systemTemplate = `You are a professional screenwriter. Generate a concise 2-3 paragraph synopsis (150-300 words). Focus on the main story, protagonist, and central conflict. Do not generate a full treatment, scene breakdown, or detailed character descriptions.`
          userPromptText = prompt
        } else if (field === 'script') {
          systemTemplate = `You are a professional screenwriter. Generate a creative movie script outline or scene based on the user's idea. Focus on storytelling, character development, and cinematic elements. Do not use markdown formatting like **, *, ---, or ###. Use plain text with clear headings and paragraphs.`
          userPromptText = prompt
        } else {
          systemTemplate = `You are a professional filmmaker. Generate creative and detailed ${field} for a storyboard scene. Be specific about visual details, mood, and cinematic elements.`
          userPromptText = `Generate ${field} for a storyboard scene: ${prompt}`
        }
      }

      switch (service) {
        case 'openai':
          // Use provided model or default to gpt-4o-mini for legacy calls
          const legacyOpenaiModel = model || 'gpt-4o-mini'
          console.log('🔍 [API] Calling OpenAI (legacy) with:', {
            model: legacyOpenaiModel,
            promptLength: userPromptText.length,
            maxTokens: maxTokens || 'default (1000)',
            field
          })
          const openaiResponse = await OpenAIService.generateScript({
            prompt: userPromptText,
            template: systemTemplate,
            model: legacyOpenaiModel,
            apiKey: actualApiKey,
            maxTokens: maxTokens // Pass through maxTokens if provided
          })
          
          if (!openaiResponse.success) {
            throw new Error(openaiResponse.error || 'OpenAI API failed')
          }
          
          generatedText = openaiResponse.data.choices[0].message.content
          break

        case 'anthropic':
          // Use provided model or default to claude-3-5-sonnet-20241022 for legacy calls
          const legacyAnthropicModel = model || 'claude-3-5-sonnet-20241022'
          console.log('🔍 [API] Calling Anthropic (legacy) with:', {
            model: legacyAnthropicModel,
            promptLength: userPromptText.length,
            maxTokens: maxTokens || 'default (1000)',
            field
          })
          const claudeResponse = await AnthropicService.generateScript({
            prompt: userPromptText,
            template: systemTemplate,
            model: legacyAnthropicModel,
            apiKey: actualApiKey,
            maxTokens: maxTokens // Pass through maxTokens if provided
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

    // Post-process the generated text for synopsis field
    if (field === 'synopsis') {
      // Clean up the text
      let cleanedText = generatedText.trim()
      
      // Remove any markdown formatting that might have been added
      cleanedText = cleanedText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      // If the text is very long (likely a full treatment), try to extract just the synopsis
      // Split into paragraphs and take first 2-3 paragraphs
      const paragraphs = cleanedText.split(/\n\n+/).filter(p => p.trim().length > 0)
      
      if (paragraphs.length > 3 || cleanedText.length > 1000) {
        // Likely generated a full treatment, extract synopsis
        console.log('⚠️ Generated text appears to be a full treatment, extracting synopsis...')
        
        // Take first 2-3 paragraphs that are reasonable length
        let synopsisParagraphs: string[] = []
        let totalLength = 0
        
        for (const para of paragraphs.slice(0, 5)) {
          const paraTrimmed = para.trim()
          if (paraTrimmed.length > 50 && totalLength + paraTrimmed.length <= 800) {
            synopsisParagraphs.push(paraTrimmed)
            totalLength += paraTrimmed.length
            if (synopsisParagraphs.length >= 3) break
          }
        }
        
        if (synopsisParagraphs.length > 0) {
          cleanedText = synopsisParagraphs.join('\n\n')
          console.log(`✅ Extracted ${synopsisParagraphs.length} paragraph synopsis (${cleanedText.length} chars)`)
        } else {
          // Fallback: take first 500 characters
          cleanedText = cleanedText.substring(0, 500).trim()
          // Try to end at a sentence
          const lastPeriod = cleanedText.lastIndexOf('.')
          if (lastPeriod > 400) {
            cleanedText = cleanedText.substring(0, lastPeriod + 1)
          }
        }
      }
      
      generatedText = cleanedText
    }

    console.log('✅ [API] Generation complete:', {
      service: service.toUpperCase(),
      field,
      textLength: generatedText.length,
      textPreview: generatedText.substring(0, 200) + '...'
    })
    
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
