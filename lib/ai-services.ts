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
          model: request.model,
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
      console.log('🎬 DEBUG - OpenAI API request:', {
        promptLength: request.prompt.length,
        promptPreview: request.prompt.substring(0, 200) + '...',
        style: request.style,
        model: request.model
      })

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
        console.error('🎬 DEBUG - OpenAI API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        })
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }
      const result = await response.json()
      return { success: true, data: result }
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

// Kling Service (Video Generation)
export class KlingService {
  static async generateVideo(request: GenerateVideoRequest): Promise<AIResponse> {
    try {
      console.log('🎬 Kling generateVideo called with:', {
        promptLength: request.prompt?.length || 0,
        duration: request.duration,
        hasApiKey: !!request.apiKey,
        apiKeyStart: request.apiKey?.substring(0, 10) + '...',
      })
      
      const response = await fetch('https://api.klingai.com/v1/generations', {
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

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Kling API error (${response.status}): ${errorText}`)
      }
      
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
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
      console.log('🧪 Testing Kling API connection...')
      
      const response = await fetch('https://api.klingai.com/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: "test",
          duration: "3s",
          model: "kling-v1",
        }),
      })
      
      console.log('🧪 Kling API test response status:', response.status)
      
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
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      return { 
        success: true, 
        data: {
          url: audioUrl,
          blob: audioBlob,
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
