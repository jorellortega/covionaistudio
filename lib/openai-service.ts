interface GenerateScriptRequest {
  prompt: string
  template: string
  apiKey: string
}

interface GenerateImageRequest {
  prompt: string
  style: string
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
          const errorResponse = await response.text()
          errorDetails = errorResponse
          console.log('OpenAI error response body:', errorResponse)
        } catch (e) {
          errorDetails = 'Could not read error response'
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
    const { prompt, template, apiKey } = request
    
    const systemPrompt = `You are a professional screenwriter. ${template}`
    
    const data = {
      model: "gpt-3.5-turbo",
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
      max_tokens: 1000,
      temperature: 0.7,
    }

    return this.makeRequest('https://api.openai.com/v1/chat/completions', data, apiKey)
  }

  static async generateImage(request: GenerateImageRequest): Promise<OpenAIResponse> {
    const { prompt, style, apiKey } = request
    
    const enhancedPrompt = `${style} style: ${prompt}`
    
    const data = {
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      model: "dall-e-3",
    }

    return this.makeRequest('https://api.openai.com/v1/images/generations', data, apiKey)
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
