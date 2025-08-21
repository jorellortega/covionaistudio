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
}

interface GenerateAudioRequest {
  prompt: string
  type: string
  model: string
  apiKey: string
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
            duration: request.duration,
          },
        }),
      })

      if (!response.ok) throw new Error(`Runway ML API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.runwayml.com/v1/user', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// ElevenLabs Service (Voice Generation)
export class ElevenLabsService {
  static async generateAudio(request: GenerateAudioRequest): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': request.apiKey,
        },
        body: JSON.stringify({
          text: request.prompt,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      })

      if (!response.ok) throw new Error(`ElevenLabs API error: ${response.status}`)
      const result = await response.json()
      return { success: true, data: result }
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
