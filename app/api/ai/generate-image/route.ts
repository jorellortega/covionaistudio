import { NextRequest, NextResponse } from 'next/server'
import { OpenAIService, OpenArtService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  try {
    console.log('AI image generation request received')
    
    const body = await request.json()
    console.log('Request body:', { ...body, apiKey: body.apiKey ? `${body.apiKey.substring(0, 10)}...` : 'undefined' })
    
    const { prompt, service, apiKey } = body

    if (!prompt || !service || !apiKey) {
      console.error('Missing required fields:', { prompt: !!prompt, service: !!service, apiKey: !!apiKey })
      return NextResponse.json(
        { error: 'Missing required fields: prompt, service, apiKey' },
        { status: 400 }
      )
    }

    let imageUrl = ""

    switch (service) {
      case 'dalle':
        console.log('Generating DALL-E image with prompt:', prompt)
        console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined')
        
        // Use the OpenAIService from ai-services.ts
        const dalleResponse = await OpenAIService.generateImage({
          prompt: prompt, // Send only the user's exact prompt
          style: 'cinematic',
          model: 'dall-e-3',
          apiKey
        })
        
        console.log('DALL-E response:', dalleResponse)
        
        if (!dalleResponse.success) {
          throw new Error(dalleResponse.error || 'DALL-E API failed')
        }
        
        if (!dalleResponse.data || !dalleResponse.data.data || !dalleResponse.data.data[0] || !dalleResponse.data.data[0].url) {
          console.error('Invalid DALL-E response structure:', dalleResponse.data)
          throw new Error('Invalid response structure from DALL-E API')
        }
        
        imageUrl = dalleResponse.data.data[0].url
        console.log('Generated image URL:', imageUrl)
        break

      case 'openart':
        console.log('Generating OpenArt image with prompt:', prompt)
        console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined')
        
        const openartResponse = await OpenArtService.generateImage({
          prompt: prompt, // Send only the user's exact prompt
          style: 'cinematic',
          model: 'sdxl',
          apiKey
        })
        
        console.log('OpenArt response:', openartResponse)
        
        if (!openartResponse.success) {
          throw new Error(openartResponse.error || 'OpenArt API failed')
        }
        
        if (!openartResponse.data || !openartResponse.data.images || !openartResponse.data.images[0] || !openartResponse.data.images[0].url) {
          console.error('Invalid OpenArt response structure:', openartResponse.data)
          throw new Error('Invalid response structure from OpenArt API')
        }
        
        imageUrl = openartResponse.data.images[0].url
        console.log('Generated image URL:', imageUrl)
        break

      case 'stable-diffusion':
        // For now, using OpenArt as Stable Diffusion alternative
        const sdResponse = await OpenArtService.generateImage({
          prompt: prompt, // Send only the user's exact prompt
          style: 'cinematic',
          model: 'sdxl',
          apiKey
        })
        
        if (!sdResponse.success) {
          throw new Error(sdResponse.error || 'Stable Diffusion API failed')
        }
        
        imageUrl = sdResponse.data.images[0].url
        break

      case 'leonardo':
        // Leonardo AI integration (requires Leonardo API key)
        const leonardoResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            prompt: prompt, // Send only the user's exact prompt
            modelId: "6bef9f1b-29cb-40c7-b9df-32b51c1ed67c", // Leonardo Creative
            width: 1024,
            height: 1024,
            num_images: 1,
            promptMagic: true,
            highContrast: true,
            public: false,
            tiling: false,
            negative_prompt: "blurry, low quality, distorted, amateur"
          })
        })
        
        if (!leonardoResponse.ok) {
          const errorText = await leonardoResponse.text()
          console.error('Leonardo AI API error:', leonardoResponse.status, errorText)
          throw new Error(`Leonardo AI API failed: ${leonardoResponse.status} - ${errorText}`)
        }
        
        const leonardoData = await leonardoResponse.json()
        // Leonardo returns a generation ID, we need to poll for the result
        const generationId = leonardoData.sdGenerationJob.generationId
        
        // For now, return a placeholder - in production you'd poll for completion
        imageUrl = `https://generation.leonardo.ai/${generationId}/0.png`
        break

      case 'runway':
        // Runway ML is primarily for video, but can generate images
        const runwayResponse = await fetch('https://api.runwayml.com/v1/inference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gen-2",
            input: {
              prompt: prompt, // Send only the user's exact prompt
              image_dimensions: "1024x1024"
            },
          })
        })
        
        if (!runwayResponse.ok) {
          const errorText = await runwayResponse.text()
          console.error('Runway ML API error:', runwayResponse.status, errorText)
          throw new Error(`Runway ML API failed: ${runwayResponse.status} - ${errorText}`)
        }
        
        const runwayData = await runwayResponse.json()
        imageUrl = runwayData.output.images[0]
        break

      case 'midjourney':
        // Midjourney requires Discord bot integration
        // For now, return an error suggesting setup
        throw new Error('Midjourney integration requires Discord bot setup. Please use DALL-E or other services for now.')
        
      default:
        throw new Error(`Unsupported service: ${service}`)
    }

    console.log('Successfully generated image:', imageUrl)
    return NextResponse.json({ 
      success: true, 
      imageUrl: imageUrl,
      service: service.toUpperCase()
    })

  } catch (error) {
    console.error('AI image generation error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error occurred'
    if (error instanceof Error) {
      if (error.message.includes('OpenAI API error')) {
        errorMessage = 'DALL-E API request failed. Please check your API key and try again.'
      } else if (error.message.includes('OpenArt API error')) {
        errorMessage = 'OpenArt API request failed. Please check your API key and try again.'
      } else if (error.message.includes('Invalid response structure')) {
        errorMessage = 'AI service returned an invalid response. Please try again.'
      } else {
        errorMessage = error.message
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
