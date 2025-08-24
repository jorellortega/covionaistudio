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
  apiKey: string
  resolution?: string
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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: `You are a professional screenwriter. ${request.template}` },
            { role: "user", content: request.prompt }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      })

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async generateImage(request: GenerateImageRequest): Promise<AIResponse> {
    try {
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

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
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
          model: "claude-3-sonnet-20240229",
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
          model: "claude-3-sonnet-20240229",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// OpenArt Service
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
          model: "sdxl",
          width: 1024,
          height: 1024,
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

// Kling Service (Video Generation)
export class KlingService {
  static async generateVideo(request: GenerateVideoRequest): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.kling.ai/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          duration: request.duration,
          model: "kling-v1",
        }),
      })

      if (!response.ok) throw new Error(`Kling API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.kling.ai/v1/user', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Runway ML Service
export class RunwayMLService {
  static async generateVideo(request: GenerateVideoRequest): Promise<AIResponse> {
    try {
      // Runway ML uses a different API structure
      // Parse resolution if provided
      let width = 1024
      let height = 576
      
      if (request.resolution) {
        const [w, h] = request.resolution.split('x').map(Number)
        if (w && h) {
          width = w
          height = h
        }
      }
      
      const response = await fetch('https://api.runwayml.com/v1/inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          model: "gen-2",
          input: {
            prompt: request.prompt,
            duration: parseInt(request.duration.replace('s', '')),
            width: width,
            height: height,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Runway ML API error:', response.status, errorText)
        throw new Error(`Runway ML API error: ${response.status} - ${errorText}`)
      }
      
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      console.error('Runway ML generation error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Test the API key by making a simple request
      const response = await fetch('https://api.runwayml.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch (error) {
      console.error('Runway ML API key validation error:', error)
      return false
    }
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

      console.log('📡 ElevenLabs TTS response status:', response.status)
      console.log('📡 ElevenLabs TTS response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ ElevenLabs TTS API error:', response.status, errorText)
        
        // Try to parse error response for more details
        let errorDetails = errorText
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.detail) {
            errorDetails = errorJson.detail
          }
          if (errorJson.message) {
            errorDetails = errorJson.message
          }
        } catch (e) {
          // If parsing fails, use the raw text
        }
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your ElevenLabs API key.')
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.')
        } else if (response.status === 400) {
          throw new Error(`Invalid request: ${errorDetails}`)
        } else if (response.status === 402) {
          throw new Error(`Payment required: ${errorDetails}`)
        } else if (response.status === 403) {
          throw new Error(`Forbidden: ${errorDetails}`)
        } else if (response.status === 413) {
          throw new Error(`Text too long: ${errorDetails}`)
        } else if (response.status === 422) {
          throw new Error(`Validation error: ${errorDetails}`)
        } else {
          throw new Error(`ElevenLabs API error: ${response.status} - ${errorDetails}`)
        }
      }
      
      console.log('✅ ElevenLabs TTS request successful, processing audio blob...')
      
      // ElevenLabs returns audio data, not JSON
      const audioBlob = await response.blob()
      console.log('🎵 Audio blob received, size:', audioBlob.size, 'bytes')
      
      return { 
        success: true, 
        data: { 
          audio_blob: audioBlob,
          message: "Audio generated successfully"
        } 
      }
    } catch (error) {
      console.error('❌ ElevenLabs generation error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log('🔍 ElevenLabs: Validating API key...')
      console.log('🔑 API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
      
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': apiKey },
      })
      
      console.log('📡 ElevenLabs validation response status:', response.status)
      const isValid = response.ok
      console.log('✅ API Key valid:', isValid)
      
      return isValid
    } catch (error) {
      console.error('❌ ElevenLabs validation error:', error)
      return false
    }
  }

  static async getUserInfo(apiKey: string): Promise<AIResponse> {
    try {
      console.log('🔍 ElevenLabs: Fetching user info...')
      console.log('🔑 API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
      
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': apiKey },
      })
      
      console.log('📡 ElevenLabs response status:', response.status)
      console.log('📡 ElevenLabs response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ ElevenLabs user info error:', response.status, errorText)
        
        // Try to parse error response for more details
        let errorDetails = errorText
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.detail) {
            errorDetails = errorJson.detail
          }
          if (errorJson.message) {
            errorDetails = errorJson.message
          }
        } catch (e) {
          // If parsing fails, use the raw text
        }
        
        throw new Error(`ElevenLabs API error ${response.status}: ${errorDetails}`)
      }
      
      const userInfo = await response.json()
      console.log('✅ ElevenLabs user info:', userInfo)
      
      return { 
        success: true, 
        data: userInfo 
      }
    } catch (error) {
      console.error('❌ ElevenLabs user info error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  static async getAvailableVoices(apiKey: string): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey },
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('ElevenLabs voices API error:', response.status, errorText)
        throw new Error(`ElevenLabs voices API error: ${response.status} - ${errorText}`)
      }
      
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      console.error('ElevenLabs voices error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async cloneVoice(apiKey: string, name: string, description: string, files: File[]): Promise<AIResponse> {
    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('description', description)
      
      files.forEach((file, index) => {
        formData.append('files', file)
      })

      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('ElevenLabs voice cloning error:', response.status, errorText)
        throw new Error(`ElevenLabs voice cloning error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      console.error('ElevenLabs voice cloning error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async getVoicePreview(apiKey: string, voiceId: string, text: string = "Hello, this is a preview of my voice."): Promise<AIResponse> {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text,
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
        console.error('ElevenLabs voice preview error:', response.status, errorText)
        throw new Error(`ElevenLabs voice preview error: ${response.status} - ${errorText}`)
      }

      // Return the audio blob for preview
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      return { success: true, data: { audioUrl, audioBlob } }
    } catch (error) {
      console.error('ElevenLabs voice preview error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async deleteVoice(apiKey: string, voiceId: string): Promise<AIResponse> {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': apiKey,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('ElevenLabs voice deletion error:', response.status, errorText)
        throw new Error(`ElevenLabs voice deletion error: ${response.status} - ${errorText}`)
      }

      return { success: true, data: { message: 'Voice deleted successfully' } }
    } catch (error) {
      console.error('ElevenLabs voice deletion error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

// Suno AI Service (Music Generation)
export class SunoAIService {
  static async generateAudio(request: GenerateAudioRequest): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.suno.ai/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          type: request.type,
          duration: 30,
        }),
      })

      if (!response.ok) throw new Error(`Suno AI API error: ${response.status}`)
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
