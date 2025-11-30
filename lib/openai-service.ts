interface GenerateScriptRequest {
  prompt: string
  template: string
  apiKey: string
  model?: string
  maxTokens?: number
}

interface GenerateImageRequest {
  prompt: string
  shot?: string
  style?: string
  model?: string
  apiKey: string
}

interface OpenAIResponse {
  success: boolean
  data?: any
  error?: string
}

export class OpenAIService {
  private static async makeRequest(endpoint: string, data: any, apiKey: string): Promise<OpenAIResponse> {
    try {
      console.log('Making OpenAI request to:', endpoint)
      console.log('Request data:', data)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(data),
      })

      console.log('OpenAI response status:', response.status)
      console.log('OpenAI response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        // Try to get the error details from the response
        let errorDetails = ''
        try {
          const errorResponse = await response.json()
          errorDetails = JSON.stringify(errorResponse)
          console.log('OpenAI error response details:', errorResponse)
        } catch (e) {
          try {
            const errorText = await response.text()
            errorDetails = errorText
            console.log('OpenAI error response text:', errorText)
          } catch (e2) {
            errorDetails = 'Could not read error response'
          }
        }
        
        throw new Error(`OpenAI API error: ${response.status} - ${errorDetails}`)
      }

      const result = await response.json()
      console.log('OpenAI success response:', result)
      return { success: true, data: result }
    } catch (error) {
      console.error('OpenAI request failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  static async generateScript(request: GenerateScriptRequest): Promise<OpenAIResponse> {
    const { prompt, template, apiKey, model = 'gpt-4o', maxTokens = 2000 } = request
    
    const systemPrompt = `You are a professional screenwriter. ${template}`
    
    // Check if this is a GPT-5 model
    const isGPT5Model = model.startsWith('gpt-5')
    
    // GPT-5 models use max_completion_tokens instead of max_tokens
    // Note: max_completion_tokens is for OUTPUT tokens only, reasoning tokens are separate
    const baseTokens = maxTokens || 2000
    
    const data: any = {
      model: model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
    }
    
    if (isGPT5Model) {
      // GPT-5 models need max_completion_tokens (3x for reasoning + output)
      data.max_completion_tokens = baseTokens * 3
      data.reasoning_effort = "none"
      data.verbosity = "medium"
      // GPT-5 only supports default temperature (1), so we omit it
    } else {
      data.max_tokens = baseTokens
      data.temperature = 0.7
    }

    return this.makeRequest('https://api.openai.com/v1/chat/completions', data, apiKey)
  }

  static async generateImage(request: GenerateImageRequest): Promise<OpenAIResponse> {
    const { prompt, shot, style, model, apiKey } = request
    
    // Check if this is a GPT image model (gpt-image-1 or GPT-5 models)
    const isGPTImageModel = model === 'gpt-image-1' || (model && model.startsWith('gpt-'))
    
    if (isGPTImageModel) {
      // Use Responses API for GPT Image models
      console.log('🖼️ IMAGE GENERATION - Using GPT Image (Responses API)')
      console.log('🖼️ IMAGE GENERATION - Model:', model === 'gpt-image-1' ? 'gpt-4.1-mini (with image_generation tool)' : model)
      console.log('🖼️ IMAGE GENERATION - Prompt:', prompt)
      
      // Use style if provided, otherwise default to 'cinematic'
      const stylePrefix = style ? `${style} style: ` : 'cinematic style: '
      
      const requestBody: any = {
        model: model === 'gpt-image-1' ? 'gpt-4.1-mini' : model,
        input: `Create a visual image. ${stylePrefix}${prompt}. Generate the image now.`,
        tools: [{ type: "image_generation" }],
        tool_choice: { type: "image_generation" }, // Force the tool to be called
      }

      // Add GPT-5 specific parameters if using GPT-5 model
      if (model && model.startsWith('gpt-5')) {
        requestBody.reasoning_effort = 'none'
        requestBody.verbosity = 'medium'
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorJson: any = {}
        try {
          errorJson = JSON.parse(errorText)
        } catch {
          // If not JSON, use the text as is
        }

        const errorMessage = errorJson.error?.message || errorText || 'Unknown error'
        throw new Error(`API Error (${response.status}): ${errorMessage}`)
      }

      const data = await response.json()
      console.log('🖼️ IMAGE GENERATION - Full response:', JSON.stringify(data, null, 2))

      // Extract image from response - check multiple possible locations
      let imageData = null
      
      // First, try to find image_generation_call in output
      const imageGenerationCall = data.output?.find((output: any) => output.type === "image_generation_call")
      if (imageGenerationCall) {
        imageData = imageGenerationCall.result
        console.log('🖼️ IMAGE GENERATION - Found image in image_generation_call')
      } else {
        // Check if there's a message with tool_calls
        const messageOutput = data.output?.find((output: any) => output.type === "message")
        if (messageOutput?.content) {
          // Look for tool calls in content
          for (const contentItem of messageOutput.content) {
            if (contentItem.type === "tool_call" && contentItem.tool_call?.type === "image_generation") {
              imageData = contentItem.tool_call.result
              console.log('🖼️ IMAGE GENERATION - Found image in tool_call')
              break
            }
          }
        }
        
        // Also check if there are tool_calls at the message level
        if (!imageData && messageOutput?.tool_calls) {
          const imageToolCall = messageOutput.tool_calls.find((tc: any) => tc.type === "image_generation")
          if (imageToolCall) {
            imageData = imageToolCall.result
            console.log('🖼️ IMAGE GENERATION - Found image in message tool_calls')
          }
        }
      }
      
      console.log('🖼️ IMAGE GENERATION - Image data found:', !!imageData)
      console.log('🖼️ IMAGE GENERATION - Output items:', data.output?.length || 0)

      if (imageData) {
        console.log('🖼️ IMAGE GENERATION - ✅ Successfully generated image using GPT Image (Responses API)')
        // Return in the same format as DALL-E for compatibility
        return {
          success: true,
          data: {
            data: [{
              url: `data:image/png;base64,${imageData}`,
              b64_json: imageData
            }]
          }
        }
      } else {
        console.error('🖼️ IMAGE GENERATION - ❌ No image data in response')
        console.error('🖼️ IMAGE GENERATION - Response structure:', JSON.stringify(data, null, 2))
        throw new Error('No image in response - model returned text instead of generating image. Try a different prompt or use DALL-E 3.')
      }
    } else {
      // Use Images API for DALL-E models
      // The prompt already comes enhanced from the frontend (includes shot, character info, etc.)
      // Just clean it and ensure it's within DALL-E 3's 1000 character limit
      const cleanPrompt = prompt.trim().replace(/\s+/g, ' ')
      let enhancedPrompt = cleanPrompt
      
      // DALL-E 3 has a 1000 character limit for the prompt
      // If the prompt is too long, we need to truncate it intelligently
      // ALWAYS preserve the shot instruction at the top if present
      const MAX_PROMPT_LENGTH = 1000
      
      // Extract shot instruction from the top if present
      // Note: cleanPrompt has normalized whitespace (\n\n becomes a space)
      const shotInstructionMatch = cleanPrompt.match(/^IMPORTANT: Ensure this is a ([^.]+)\.\s+/i)
      const shotInstruction = shotInstructionMatch ? shotInstructionMatch[0] : ''
      const promptWithoutShot = shotInstruction ? cleanPrompt.substring(shotInstruction.length) : cleanPrompt
      
      if (enhancedPrompt.length > MAX_PROMPT_LENGTH) {
        console.warn(`Prompt too long (${enhancedPrompt.length} chars), truncating to ${MAX_PROMPT_LENGTH} chars`)
        
        // Find where the actual user prompt starts (after character reference)
        const userPromptMatch = promptWithoutShot.match(/outside.*?$/i) || promptWithoutShot.match(/inside.*?$/i) || promptWithoutShot.match(/([^.]{10,})$/i)
        const userPromptPart = userPromptMatch ? userPromptMatch[0] : ''
        
        // Build a shorter version: preserve shot instruction + character summary + user prompt
        if (promptWithoutShot.includes('--- CHARACTER REFERENCE ---')) {
          // Extract character name and key details
          const charNameMatch = promptWithoutShot.match(/Name: ([^\n]+)/)
          const charDescMatch = promptWithoutShot.match(/Description: ([^\n]+)/)
          const charName = charNameMatch ? charNameMatch[1] : ''
          const charDesc = charDescMatch ? charDescMatch[1] : ''
          
          // Build shortened character info
          let shortCharInfo = ''
          if (charName) shortCharInfo += `Character: ${charName}. `
          if (charDesc) shortCharInfo += `${charDesc.substring(0, 200)}. `
          
          // Calculate available length after shot instruction
          const availableLength = MAX_PROMPT_LENGTH - shotInstruction.length
          const contentToKeep = shortCharInfo + userPromptPart || promptWithoutShot.substring(promptWithoutShot.length - Math.min(availableLength - 100, 300))
          
          // Reconstruct with shot instruction at top
          enhancedPrompt = shotInstruction + contentToKeep
          
          // Final truncation if still too long (preserve shot instruction)
          if (enhancedPrompt.length > MAX_PROMPT_LENGTH) {
            const maxContentLength = MAX_PROMPT_LENGTH - shotInstruction.length - 3
            const truncatedContent = (shortCharInfo + userPromptPart).substring(0, maxContentLength)
            enhancedPrompt = shotInstruction + truncatedContent + '...'
          }
        } else {
          // No character reference, just preserve shot instruction and truncate from end
          const availableLength = MAX_PROMPT_LENGTH - shotInstruction.length
          const truncatedContent = promptWithoutShot.substring(0, availableLength)
          enhancedPrompt = shotInstruction + truncatedContent
        }
        
        console.log(`Prompt truncated from ${prompt.length} to ${enhancedPrompt.length} characters`)
        if (shotInstruction) {
          console.log('Shot instruction preserved at top:', shotInstruction.trim())
        }
      }
      
      console.log('Generating image with prompt (length:', enhancedPrompt.length, '):', enhancedPrompt.substring(0, 200) + '...')
      if (shot) console.log('Shot specified:', shot)
      console.log('Using model:', model || 'dall-e-3')
      
      const data = {
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1792", // Portrait size for movie posters
        model: model || "dall-e-3", // Use the passed model or default to dall-e-3
        quality: "standard", // Add quality parameter for better results
      }

      return this.makeRequest('https://api.openai.com/v1/images/generations', data, apiKey)
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }
}
