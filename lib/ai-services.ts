import { RUNWAY } from '@/lib/runway-config'

// Base interfaces for AI services
interface AIResponse {
  success: boolean
  data?: any
  error?: string
}

interface GenerateScriptRequest {
  prompt: string
  template: string
  model: string
  apiKey: string
  maxTokens?: number
}

interface GenerateImageRequest {
  prompt: string
  style: string
  model: string
  apiKey: string
}

interface GenerateVideoRequest {
  prompt: string
  duration: string
  model: string
  apiKey?: string
  resolution?: string
  file?: File | null
  startFrame?: File | null
  endFrame?: File | null
}

interface GenerateAudioRequest {
  prompt: string
  type: string
  model: string
  apiKey: string
  voiceId?: string
}

// OpenAI Service (ChatGPT, DALL-E)
export class OpenAIService {
  static async generateScript(request: GenerateScriptRequest): Promise<AIResponse> {
    try {
      // Check if this is a GPT-5 model
      const isGPT5Model = request.model.startsWith('gpt-5')
      
      console.log('🔍 OpenAIService.generateScript:', {
        model: request.model,
        isGPT5Model,
        promptLength: request.prompt.length,
        maxTokens: request.maxTokens
      })
      
      // Build request body
      const requestBody: any = {
        model: request.model,
        messages: [
          { role: "system", content: `You are a professional screenwriter. ${request.template}` },
          { role: "user", content: request.prompt }
        ],
      }

      // GPT-5 models use max_completion_tokens instead of max_tokens
      // Note: max_completion_tokens is for OUTPUT tokens only, reasoning tokens are separate
      // So we need to set it higher to account for both reasoning and output
      if (isGPT5Model) {
        // For GPT-5, increase tokens significantly to allow for reasoning + output
        // If reasoning_effort is "none", reasoning should be minimal, but we still need buffer
        const baseTokens = request.maxTokens || 1000
        // Increase by 2-3x to account for reasoning tokens when reasoning_effort is not "none"
        requestBody.max_completion_tokens = baseTokens * 3
      } else {
        requestBody.max_tokens = request.maxTokens || 1000
      }

      // For GPT-5 models, add reasoning_effort and verbosity parameters
      if (isGPT5Model) {
        // Default to "none" for faster responses (as per GPT-5.1 API)
        requestBody.reasoning_effort = "none"
        requestBody.verbosity = "medium"
        
        // GPT-5 models only support temperature = 1 (default)
        // Don't send temperature parameter, let it use default value of 1
      } else {
        // For non-GPT-5 models, use standard parameters
        requestBody.temperature = 0.7
      }

      console.log('📤 OpenAI API request body:', {
        model: requestBody.model,
        hasReasoningEffort: !!requestBody.reasoning_effort,
        reasoningEffort: requestBody.reasoning_effort,
        hasVerbosity: !!requestBody.verbosity,
        verbosity: requestBody.verbosity,
        maxTokens: requestBody.max_tokens,
        maxCompletionTokens: requestBody.max_completion_tokens,
        hasTemperature: !!requestBody.temperature,
        temperature: requestBody.temperature
      })

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`,
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
        
        const errorMessage = errorJson.error?.message || errorText || `OpenAI API error: ${response.status}`
        console.error('OpenAI API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          model: request.model,
          isGPT5: isGPT5Model
        })
        throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`)
      }
      
      const result = await response.json()
      
      // Log FULL response structure for debugging
      console.log('📥 OpenAI API response (full):', JSON.stringify(result, null, 2))
      console.log('📥 OpenAI API response (summary):', {
        hasChoices: !!result.choices,
        choicesLength: result.choices?.length || 0,
        firstChoice: result.choices?.[0] ? {
          hasMessage: !!result.choices[0].message,
          messageKeys: result.choices[0].message ? Object.keys(result.choices[0].message) : [],
          hasContent: !!result.choices[0].message?.content,
          contentType: typeof result.choices[0].message?.content,
          contentLength: result.choices[0].message?.content?.length || 0,
          contentPreview: result.choices[0].message?.content?.substring(0, 100) || 'empty',
          fullMessage: result.choices[0].message
        } : null,
        model: result.model,
        responseKeys: Object.keys(result),
        fullResult: result
      })
      
      // Check if content exists in the expected location
      const content = result?.choices?.[0]?.message?.content
      if (!content && isGPT5Model) {
        console.error('⚠️ GPT-5 model returned empty content. Full response:', JSON.stringify(result, null, 2))
        // Try alternative locations
        if (result.output_text) {
          console.log('✅ Found content in output_text field')
          result.choices = [{
            message: {
              content: result.output_text,
              role: 'assistant'
            }
          }]
        }
      }
      
      return { success: true, data: result }
    } catch (error) {
      console.error('OpenAIService.generateScript error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async generateImage(request: GenerateImageRequest): Promise<AIResponse> {
    try {
      console.log('🎬 DEBUG - OpenAI API request:', {
        promptLength: request.prompt.length,
        promptPreview: request.prompt.substring(0, 200) + '...',
        style: request.style,
        model: request.model
      })

      // Check if this is a GPT image model (gpt-image-1 or GPT-5 models)
      const isGPTImageModel = request.model === 'gpt-image-1' || request.model.startsWith('gpt-')
      
      if (isGPTImageModel) {
        // Use Responses API for GPT Image models
        console.log('🖼️ IMAGE GENERATION - Using GPT Image (Responses API)')
        console.log('🖼️ IMAGE GENERATION - Model:', request.model === 'gpt-image-1' ? 'gpt-4.1-mini (with image_generation tool)' : request.model)
        console.log('🖼️ IMAGE GENERATION - Prompt:', request.prompt)
        console.log('🖼️ IMAGE GENERATION - API Endpoint: /v1/responses')
        
        const requestBody: any = {
          model: request.model === 'gpt-image-1' ? 'gpt-4.1-mini' : request.model,
          input: `Create a visual image. ${request.style} style: ${request.prompt}. Generate the image now.`,
          tools: [{ type: "image_generation" }],
          tool_choice: { type: "image_generation" }, // Force the tool to be called
        }

        // Add GPT-5 specific parameters if using GPT-5 model
        if (request.model.startsWith('gpt-5')) {
          requestBody.reasoning_effort = 'none'
          requestBody.verbosity = 'medium'
          console.log('🖼️ IMAGE GENERATION - GPT-5 parameters:', {
            reasoning_effort: 'none',
            verbosity: 'medium'
          })
        }

        console.log('🖼️ IMAGE GENERATION - Request body:', JSON.stringify(requestBody, null, 2))

        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${request.apiKey}`,
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

        console.log('🖼️ IMAGE GENERATION - Response status:', response.status)
        
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
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${request.apiKey}`,
          },
          body: JSON.stringify({
            prompt: `${request.style} style: ${request.prompt}`,
            n: 1,
            size: "1024x1024",
            model: "dall-e-3",
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          let errorJson: any = {}
          try {
            errorJson = JSON.parse(errorText)
          } catch {
            // If not JSON, use the text as is
          }
          
          console.error('🎬 DEBUG - OpenAI API error response:', {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText,
            errorJson: errorJson
          })
          
          // Check for content policy violations
          const errorMessage = errorJson.error?.message || errorText || 'Unknown error'
          if (errorMessage.toLowerCase().includes('content policy') || 
              errorMessage.toLowerCase().includes('safety') ||
              errorMessage.toLowerCase().includes('content_filter') ||
              errorMessage.toLowerCase().includes('violates our usage policy') ||
              errorMessage.toLowerCase().includes('not allowed') ||
              errorMessage.toLowerCase().includes('sensitive content') ||
              errorJson.error?.code === 'content_filter' ||
              response.status === 400) {
            throw new Error('This content may contain copyrighted material or explicit content that cannot be generated. Please try a different description or modify your treatment content.')
          }
          
          throw new Error(`OpenAI API error: ${response.status} - ${errorMessage}`)
        }
        const result = await response.json()
        return { success: true, data: result }
      }
    } catch (error) {
      console.error('🎬 DEBUG - OpenAI API error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Anthropic Service (Claude)
export class AnthropicService {
  static async generateScript(request: GenerateScriptRequest): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': request.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: [
            { role: "user", content: `${request.template}\n\n${request.prompt}` }
          ],
        }),
      })

      if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      })
      return response.status === 200 || response.status === 400 // 400 means valid key but bad request
    } catch {
      return false
    }
  }
}

// OpenArt Service (Image Generation)
export class OpenArtService {
  static async generateImage(request: GenerateImageRequest): Promise<AIResponse> {
    try {
      const response = await fetch('https://openart.ai/api/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          prompt: `${request.style} style: ${request.prompt}`,
          width: 1024,
          height: 1024,
          num_images: 1,
          model: "sdxl",
        }),
      })

      if (!response.ok) throw new Error(`OpenArt API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://openart.ai/api/v1/user', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Kling Service (Video Generation) - Server-side only
export class KlingService {
  static async generateVideo(request: GenerateVideoRequest): Promise<AIResponse> {
    try {
      console.log('🎬 Kling generateVideo called - forwarding to server-side API')
      console.log('🎬 Request:', {
        promptLength: request.prompt?.length || 0,
        duration: request.duration,
        model: request.model,
        hasFile: !!request.file,
        hasStartFrame: !!request.startFrame,
        hasEndFrame: !!request.endFrame,
      })
      
      // Prepare form data for file upload support
      const formData = new FormData()
      formData.append('prompt', request.prompt || '')
      
      // Map model to API model format
      let apiModel = 'kling_t2v'
      if (request.model === 'Kling I2V' || request.model === 'Kling I2V Extended') {
        apiModel = 'kling_i2v'
      }
      formData.append('model', apiModel)
      
      // Parse duration (handle both "10s" and 10 formats)
      const durationStr = String(request.duration || '5')
      const durationNum = durationStr.includes('s') 
        ? parseInt(durationStr.replace('s', '')) 
        : parseInt(durationStr)
      formData.append('duration', durationNum.toString())
      
      // Map resolution to ratio
      const resolutionToRatio: Record<string, string> = {
        '1280:720': '16:9',
        '1920:1080': '16:9',
        '720:1280': '9:16',
        '1080:1920': '9:16',
        '960:960': '1:1',
        '1024:1024': '1:1',
      }
      const ratio = resolutionToRatio[request.resolution || '1280:720'] || '16:9'
      formData.append('ratio', ratio)
      
      // Add files based on model type
      if (request.model === 'Kling I2V' && request.file) {
        formData.append('file', request.file)
      } else if (request.model === 'Kling I2V Extended') {
        if (request.startFrame) {
          formData.append('start_frame', request.startFrame)
        }
        if (request.endFrame) {
          formData.append('end_frame', request.endFrame)
        }
      }
      
      // Call our server-side API route
      const response = await fetch('/api/kling/generate', {
        method: 'POST',
        body: formData, // Use FormData for file upload support
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `API error (${response.status})`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.error || 'Unknown error' }
      }
    } catch (error) {
      console.error('🎬 Kling video generation error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.klingai.com/v1/user', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }

  static async testApiConnection(apiKey: string): Promise<{ success: boolean; status?: number; error?: string }> {
    try {
      console.log('🧪 Testing Kling API connection via server-side...')
      
      // Test with a simple prompt via our server-side API
      const formData = new FormData()
      formData.append('prompt', 'test')
      formData.append('model', 'kling_t2v')
      formData.append('duration', '5')
      formData.append('ratio', '16:9')
      
      const response = await fetch('/api/kling/generate', {
        method: 'POST',
        body: formData,
      })
      
      console.log('🧪 Kling API test response status:', response.status)
      
      if (response.status === 401 || response.status === 403) {
        return { success: false, status: response.status, error: 'Invalid API key or insufficient credits' }
      }
      
      if (response.status === 400) {
        const errorText = await response.text()
        return { success: false, status: response.status, error: `Bad request: ${errorText}` }
      }
      
      if (response.ok) {
        return { success: true, status: response.status }
      }
      
      return { success: false, status: response.status, error: `HTTP ${response.status}` }
      
    } catch (error) {
      console.error('🧪 Kling API test error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }
}

// Runway ML Service (Video Generation) - Server-side only
export class RunwayMLService {
  static async generateVideo(request: GenerateVideoRequest): Promise<AIResponse> {
    try {
      console.log('🎬 Runway ML generateVideo called - forwarding to server-side API')
      
      const response = await fetch('/api/ai/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          duration: request.duration,
          width: request.resolution === '1024x576' ? 1024 : 512,
          height: request.resolution === '1024x576' ? 576 : 288,
          model: 'Runway ML',
        }),
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.error || 'Unknown error' }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    // Client-side validation disabled to avoid CORS issues
    // Validation is now handled server-side
    return true
  }

  static async testApiConnection(apiKey: string): Promise<{ success: boolean; status?: number; error?: string }> {
    // Client-side testing disabled to avoid CORS issues
    return { success: false, error: 'API testing is handled server-side' }
  }
}

// ElevenLabs Service (Voice Generation)
export class ElevenLabsService {
  static async generateAudio(request: GenerateAudioRequest): Promise<AIResponse> {
    try {
      console.log('🎵 ElevenLabs generateAudio called with:', {
        promptLength: request.prompt?.length || 0,
        voiceId: request.voiceId,
        hasApiKey: !!request.apiKey,
        apiKeyStart: request.apiKey?.substring(0, 10) + '...',
        type: request.type
      })
      
      // Use the voice from the request or default to Rachel
      const voiceId = request.voiceId || "21m00Tcm4TlvDq8ikWAM"
      console.log('🎤 Using voice ID:', voiceId)
      
      const requestBody = {
        text: request.prompt,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true,
        },
      }
      
      console.log('📤 Request body:', requestBody)
      console.log('🔑 API Key header:', request.apiKey?.substring(0, 10) + '...')
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': request.apiKey,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`)
      }
      
      // For audio, we need to handle the binary response
      const arrayBuffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'audio/mpeg'
      
      if (typeof window === 'undefined') {
        return {
          success: true,
          data: {
            audio_array_buffer: arrayBuffer,
            content_type: contentType,
            voiceId: voiceId
          }
        }
      }

      const audioBlob = new Blob([arrayBuffer], { type: contentType })
      const audioUrl = URL.createObjectURL(audioBlob)
      
      return { 
        success: true, 
        data: {
          url: audioUrl,
          blob: audioBlob,
          audio_blob: audioBlob,
          content_type: contentType,
          voiceId: voiceId
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': apiKey },
      })
      return response.ok
    } catch {
      return false
    }
  }

  static async getAvailableVoices(apiKey: string): Promise<AIResponse> {
    try {
      console.log('🎤 Fetching available voices from ElevenLabs...')
      
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`)
      }
      
      const result = await response.json()
      console.log('🎤 Voices fetched successfully:', result.voices?.length || 0, 'voices')
      
      return { 
        success: true, 
        data: {
          voices: result.voices || []
        }
      }
    } catch (error) {
      console.error('🎤 Error fetching voices:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch voices' }
    }
  }

  static async getUserInfo(apiKey: string): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      console.error('🎤 Error fetching ElevenLabs user info:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch user info' }
    }
  }

  static async testApiConnection(apiKey: string): Promise<{ success: boolean; status?: number; error?: string }> {
    try {
      console.log('🧪 Testing ElevenLabs API connection...')
      
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: "test",
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      })
      
      console.log('🧪 ElevenLabs API test response status:', response.status)
      
      if (response.status === 401 || response.status === 403) {
        return { success: false, status: response.status, error: 'Invalid API key' }
      }
      
      if (response.status === 400) {
        const errorText = await response.text()
        return { success: false, status: response.status, error: `Bad request: ${errorText}` }
      }
      
      if (response.ok) {
        return { success: true, status: response.status }
      }
      
      return { success: false, status: response.status, error: `HTTP ${response.status}` }
      
    } catch (error) {
      console.error('🧪 ElevenLabs API test error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }

  static async getVoicePreview(apiKey: string, voiceId: string): Promise<AIResponse> {
    try {
      console.log('🎵 Getting voice preview for voice ID:', voiceId)
      
      // First, try to get the voice details to see if there's a preview_url
      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      })

      if (voicesResponse.ok) {
        const voicesData = await voicesResponse.json()
        const voice = voicesData.voices?.find((v: any) => v.voice_id === voiceId)
        
        // If voice has a preview_url, use it
        if (voice?.preview_url) {
          return {
            success: true,
            data: {
              audioUrl: voice.preview_url,
              voiceId: voiceId
            }
          }
        }
      }

      // If no preview_url, generate a short preview using text-to-speech
      const previewText = "Hello, this is a voice preview."
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: previewText,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'audio/mpeg'

      if (typeof window === 'undefined') {
        // Server-side: return base64 encoded audio
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        return {
          success: true,
          data: {
            audioUrl: `data:${contentType};base64,${base64}`,
            voiceId: voiceId
          }
        }
      }

      // Client-side: create blob URL
      const audioBlob = new Blob([arrayBuffer], { type: contentType })
      const audioUrl = URL.createObjectURL(audioBlob)
      
      return {
        success: true,
        data: {
          audioUrl: audioUrl,
          voiceId: voiceId
        }
      }
    } catch (error) {
      console.error('🎵 Error getting voice preview:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get voice preview'
      }
    }
  }
}

// Suno AI Service (Music Generation)
export class SunoAIService {
  static async generateAudio(request: GenerateAudioRequest): Promise<AIResponse> {
    try {
      console.log('🎵 Suno AI generateAudio called with:', {
        promptLength: request.prompt?.length || 0,
        type: request.type,
        hasApiKey: !!request.apiKey,
        apiKeyStart: request.apiKey?.substring(0, 10) + '...',
      })
      
      const response = await fetch('https://api.suno.ai/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          type: request.type,
          model: "suno-v1",
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Suno AI API error (${response.status}): ${errorText}`)
      }
      
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.suno.ai/v1/user', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }

  static async testApiConnection(apiKey: string): Promise<{ success: boolean; status?: number; error?: string }> {
    try {
      console.log('🧪 Testing Suno AI API connection...')
      
      const response = await fetch('https://api.suno.ai/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: "test music",
          type: "music",
          model: "suno-v1",
        }),
      })
      
      console.log('🧪 Suno AI API test response status:', response.status)
      
      if (response.status === 401 || response.status === 403) {
        return { success: false, status: response.status, error: 'Invalid API key' }
      }
      
      if (response.status === 400) {
        const errorText = await response.text()
        return { success: false, status: response.status, error: `Bad request: ${errorText}` }
      }
      
      if (response.ok) {
        return { success: true, status: response.status }
      }
      
      return { success: false, status: response.status, error: `HTTP ${response.status}` }
      
    } catch (error) {
      console.error('🧪 Suno AI API test error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }
}

// Main AI Service Manager
export class AIServiceManager {
  static async generateContent(
    type: 'script' | 'image' | 'video' | 'audio',
    model: string,
    request: any
  ): Promise<AIResponse> {
    switch (model) {
      case 'ChatGPT':
        if (type === 'script') return OpenAIService.generateScript(request)
        if (type === 'image') return OpenAIService.generateImage(request)
        break
      
      case 'Claude':
        if (type === 'script') return AnthropicService.generateScript(request)
        break
      
      case 'OpenArt':
        if (type === 'image') return OpenArtService.generateImage(request)
        break
      
      case 'Kling':
        if (type === 'video') return KlingService.generateVideo(request)
        break
      
      case 'Runway ML':
        if (type === 'video') return RunwayMLService.generateVideo(request)
        break
      
      case 'ElevenLabs':
        if (type === 'audio') return ElevenLabsService.generateAudio(request)
        break
      
      case 'Suno AI':
        if (type === 'audio') return SunoAIService.generateAudio(request)
        break
      
      default:
        return { success: false, error: `Model ${model} not supported for ${type} generation` }
    }
    
    return { success: false, error: `Model ${model} not supported for ${type} generation` }
  }

  static async validateApiKey(model: string, apiKey: string): Promise<boolean> {
    switch (model) {
      case 'ChatGPT':
      case 'DALL-E 3':
        return OpenAIService.validateApiKey(apiKey)
      
      case 'Claude':
        return AnthropicService.validateApiKey(apiKey)
      
      case 'OpenArt':
        return OpenArtService.validateApiKey(apiKey)
      
      case 'Kling':
        return KlingService.validateApiKey(apiKey)
      
      case 'Runway ML':
        return RunwayMLService.validateApiKey(apiKey)
      
      case 'ElevenLabs':
        return ElevenLabsService.validateApiKey(apiKey)
      
      case 'Suno AI':
        return SunoAIService.validateApiKey(apiKey)
      
      default:
        return false
    }
  }
}
