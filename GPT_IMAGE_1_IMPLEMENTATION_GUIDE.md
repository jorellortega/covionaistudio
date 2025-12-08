# GPT Image 1 Implementation Guide

## Overview

GPT Image 1 (also called `gpt-image-1`) is OpenAI's image generation model that uses the **Responses API** instead of the traditional Images API. It works differently from DALL-E 3:

- **DALL-E 3**: Uses `/v1/images/generations` endpoint, returns image URLs
- **GPT Image 1**: Uses `/v1/responses` endpoint with `image_generation` tool, returns base64-encoded images

## Core Implementation

### 1. Service Layer (`lib/ai-services.ts`)

The main logic is in `OpenAIService.generateImage()`:

```179:351:lib/ai-services.ts
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
```

### Key Points:

1. **Model Detection**: Checks if model is `gpt-image-1` or starts with `gpt-` (e.g., `gpt-5`)
2. **API Endpoint**: Uses `/v1/responses` instead of `/v1/images/generations`
3. **Request Format**: 
   - Model: `gpt-4.1-mini` (when `gpt-image-1` is specified) or the actual model name
   - Input: Formatted prompt with style prefix
   - Tools: `[{ type: "image_generation" }]`
   - Tool Choice: Forces `image_generation` tool to be called
4. **Response Parsing**: Extracts base64 image from multiple possible locations in the response structure
5. **Return Format**: Returns base64 as both `url` (data URI) and `b64_json` for compatibility

## Usage Examples

### 1. Characters Page

```1986:2162:app/(protected)/characters/page.tsx
  const handleGenerateDetailReferenceImage = async (
    detailKey: string,
    detailLabel: string,
    prompt: string,
    category: string = 'general',
    subcategory?: string
  ) => {
    if (!selectedCharacterId || !analysisExtractedData || !userId || !ready) {
      toast({
        title: "Error",
        description: "Please ensure character is selected and you're logged in.",
        variant: "destructive",
      })
      return
    }

    const selectedChar = characters.find(c => c.id === selectedCharacterId)
    if (!selectedChar) return

    setGeneratingDetailImage(`${category}_${detailKey}`)

    try {
      // Get AI settings for image generation
      const imagesSetting = aiSettings.find(setting => setting.tab_type === 'images')
      const service = imagesSetting?.selected_service?.toLowerCase() || 'dalle'
      const model = imagesSetting?.selected_model || 'dall-e-3'

      // Get API key
      const supabase = getSupabaseClient()
      const { data: userData } = await supabase
        .from('users')
        .select('openai_api_key')
        .eq('id', userId)
        .single()

      const apiKey = userData?.openai_api_key || process.env.NEXT_PUBLIC_OPENAI_API_KEY

      if (!apiKey) {
        toast({
          title: "Missing API Key",
          description: "Please configure your OpenAI API key in settings.",
          variant: "destructive",
        })
        setGeneratingDetailImage(null)
        return
      }

      // Build enhanced prompt with character context
      const characterContext = `Character: ${selectedChar.name || 'Character'}. `
      const fullPrompt = characterContext + prompt

      // Normalize service and model
      const normalizeImageModel = (service: string, model: string) => {
        if (model === 'gpt-image-1' || model?.startsWith('gpt-')) {
          return model
        }
        if (service === 'dalle' || service?.toLowerCase().includes('dalle')) {
          return 'dall-e-3'
        }
        return model || 'dall-e-3'
      }

      const normalizedService = service === 'dalle' || service?.toLowerCase().includes('dalle') ? 'dalle' : service.toLowerCase()
      const normalizedModel = normalizeImageModel(normalizedService, model)

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          service: normalizedService,
          model: normalizedModel,
          apiKey: apiKey,
          userId: userId,
          autoSaveToBucket: true
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to generate ${detailLabel}`)
      }

      const result = await response.json()

      if (result.success && result.imageUrl) {
        const imageUrlToUse = result.bucketUrl || result.imageUrl

        // Save as character asset
        const timestamp = Date.now()
        const safeLabel = detailLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const filePath = `${projectId}/characters/${selectedCharacterId}/${timestamp}_${category}_${safeLabel}.png`
        
        // If image is already in bucket, just create asset record
        let finalImageUrl = imageUrlToUse
        
        if (!result.bucketUrl) {
          // Download and save to Supabase storage
          const imageResponse = await fetch(imageUrlToUse)
          const imageBlob = await imageResponse.blob()
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('cinema_files')
            .upload(filePath, imageBlob, {
              contentType: 'image/png',
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            console.error('Upload error:', uploadError)
            // Continue with original URL if upload fails
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('cinema_files')
              .getPublicUrl(filePath)
            finalImageUrl = publicUrl
          }
        }

        const assetData = {
          project_id: projectId,
          character_id: selectedCharacterId,
          title: `${selectedChar.name} - ${detailLabel}${subcategory ? ` (${subcategory})` : ''}`,
          content_type: 'image',
          content: '',
          content_url: finalImageUrl,
          prompt: fullPrompt,
          model: normalizedModel,
          generation_settings: {},
          metadata: {
            character_name: selectedChar.name,
            category: category,
            detail_key: detailKey,
            detail_type: 'reference_image',
            subcategory: subcategory,
            generated_at: new Date().toISOString(),
          }
        }

        await AssetService.createAsset(assetData)

        // Add to reference_images array
        const currentRefImages = selectedChar.reference_images || []
        if (!currentRefImages.includes(finalImageUrl)) {
          await CharactersService.updateCharacter(selectedCharacterId, {
            reference_images: [...currentRefImages, finalImageUrl]
          })
          
          // Update local state
          setCharacters(prev => prev.map(c => 
            c.id === selectedCharacterId 
              ? { ...c, reference_images: [...currentRefImages, finalImageUrl] }
              : c
          ))
        }

        // Reload character assets
        const assets = await AssetService.getAssetsForCharacter(selectedCharacterId)
        setCharacterAssets(assets)

        toast({
          title: "Success",
          description: `${detailLabel}${subcategory ? ` (${subcategory})` : ''} reference image generated and saved!`,
        })
      }
    } catch (err) {
      console.error(`Error generating ${detailLabel}:`, err)
      toast({
        title: `Failed: ${detailLabel}`,
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: "destructive",
      })
    } finally {
      setGeneratingDetailImage(null)
    }
  }
```

### 2. Ideas Page

```1910:1977:app/(protected)/ideas/page.tsx
    setIsLoadingAI(true)
    setGeneratedImage("")
    
    try {
      const originalModel = imagesSetting.locked_model
      const normalizedModel = normalizeImageModel(originalModel)
      console.log('🖼️ IDEAS - generateImage - Original locked_model:', originalModel)
      console.log('🖼️ IDEAS - generateImage - Normalized model name:', normalizedModel)
      console.log('🖼️ IDEAS - generateImage - Will use GPT Image API:', normalizedModel === 'gpt-image-1' || normalizedModel.startsWith('gpt-'))
      
      const response = await OpenAIService.generateImage({
        prompt: prompt,
        style: "cinematic, movie poster",
        model: normalizedModel,
        apiKey: userApiKeys.openai_api_key || ""
      })

      if (response.success && response.data) {
        // Handle both URL (DALL-E) and base64 (GPT Image) responses
        const imageData = response.data.data?.[0]
        const imageUrl = imageData?.url || (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : "")
        
        // Save the image to the bucket instead of storing temporary URL
        setIsSavingImage(true)
        const saveResponse = await fetch('/api/ai/download-and-store-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imageUrl,
            fileName: `ai_prompt_studio_${prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
            userId: userId
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save image to bucket')
        }

        const saveResult = await saveResponse.json()
        
        if (saveResult.success) {
          // Store the permanent bucket URL instead of temporary DALL-E URL
          const bucketUrl = saveResult.supabaseUrl
          setGeneratedImage(bucketUrl)
          toast({
            title: "Success",
            description: "AI image generated and saved to your bucket!",
          })
        } else {
          throw new Error(saveResult.error || 'Failed to save image')
        }
      } else {
        throw new Error(response.error || "Failed to generate image")
      }
    } catch (error) {
      console.error('Error generating image:', error)
      toast({
        title: "Error",
        description: "Failed to generate image with AI",
        variant: "destructive",
      })
    } finally {
      setIsLoadingAI(false)
      setIsSavingImage(false)
    }
  }
```

### 3. AI Studio Page

```1085:1116:app/(protected)/ai-studio/page.tsx
          const isOpenAIImageModel = selectedModel === "DALL-E 3" || 
                                     selectedModel === "GPT Image" ||
                                     (actualImageModel && (actualImageModel === 'gpt-image-1' || actualImageModel.startsWith('gpt-')))
          
          if (isOpenAIImageModel) {
          console.log(`🚀 IMAGE GENERATION - Calling OpenAIService.generateImage...`)
          
          // Use actual model from settings if available, otherwise use default mapping
          let modelToUse: string
          if (actualImageModel && (actualImageModel === 'gpt-image-1' || actualImageModel.startsWith('gpt-'))) {
            // Use the model from settings (could be gpt-image-1 or gpt-5*)
            modelToUse = actualImageModel
            console.log(`🚀 IMAGE GENERATION - Using model from settings: ${modelToUse}`)
          } else if (selectedModel === "GPT Image") {
            // Fallback to gpt-image-1 if GPT Image is selected but no model in settings
            modelToUse = "gpt-image-1"
            console.log(`🚀 IMAGE GENERATION - Using default GPT Image model: ${modelToUse}`)
          } else {
            // DALL-E 3
            modelToUse = "dall-e-3"
            console.log(`🚀 IMAGE GENERATION - Using DALL-E 3 model: ${modelToUse}`)
          }
          
            response = await OpenAIService.generateImage({
              prompt: enhancedPrompt,
              style: 'cinematic',
              model: modelToUse,
              apiKey: userApiKeys.openai_api_key!,
            })
            console.log(`🚀 IMAGE GENERATION - Response received:`, response)
            console.log(`🚀 IMAGE GENERATION - Response success:`, response?.success)
            console.log(`🚀 IMAGE GENERATION - Response error:`, response?.error)
```

## API Route Handler

The `/api/ai/generate-image` route handles the request and processes the response:

```365:422:app/api/ai/generate-image/route.ts
    switch (normalizedService) {
      case 'dalle':
        console.log('Generating image with prompt:', prompt)
        console.log('Using model:', model || 'dall-e-3')
        console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined')
        
        // Determine the model to use - support GPT image models
        const imageModel = model || 'dall-e-3'
        const isGPTImageModel = imageModel === 'gpt-image-1' || imageModel.startsWith('gpt-')
        
        if (isGPTImageModel) {
          console.log('🖼️ API ROUTE - Using GPT Image (Responses API) for model:', imageModel)
        } else {
          console.log('🖼️ API ROUTE - Using DALL-E (Images API) for model:', imageModel)
        }
        
        // Use the OpenAIService from ai-services.ts
        const dalleResponse = await OpenAIService.generateImage({
          prompt: prompt, // Send only the user's exact prompt
          style: 'cinematic',
          model: imageModel,
          apiKey
        })
        
        console.log('Image generation response:', dalleResponse)
        if (isGPTImageModel && dalleResponse.success) {
          console.log('🖼️ API ROUTE - GPT Image generation successful (base64 response)')
        } else if (!isGPTImageModel && dalleResponse.success) {
          console.log('🖼️ API ROUTE - DALL-E generation successful (URL response)')
        }
        
        if (!dalleResponse.success) {
          // The error message from OpenAIService is already user-friendly for content policy violations
          throw new Error(dalleResponse.error || 'Image generation failed')
        }
        
        // Handle both DALL-E (URL) and GPT Image (base64) responses
        if (isGPTImageModel) {
          // GPT Image returns base64 data
          if (!dalleResponse.data || !dalleResponse.data.data || !dalleResponse.data.data[0] || !dalleResponse.data.data[0].b64_json) {
            console.error('Invalid GPT Image response structure:', dalleResponse.data)
            throw new Error('Invalid response structure from GPT Image API')
          }
          
          // Convert base64 to data URL
          imageUrl = dalleResponse.data.data[0].url || `data:image/png;base64,${dalleResponse.data.data[0].b64_json}`
          console.log('Generated image (base64):', imageUrl.substring(0, 50) + '...')
        } else {
          // DALL-E returns URL
          if (!dalleResponse.data || !dalleResponse.data.data || !dalleResponse.data.data[0] || !dalleResponse.data.data[0].url) {
            console.error('Invalid DALL-E response structure:', dalleResponse.data)
            throw new Error('Invalid response structure from DALL-E API')
          }
          
          imageUrl = dalleResponse.data.data[0].url
          console.log('Generated image URL:', imageUrl)
        }
        break
```

## Key Differences from DALL-E 3

| Feature | DALL-E 3 | GPT Image 1 |
|---------|----------|-------------|
| **API Endpoint** | `/v1/images/generations` | `/v1/responses` |
| **Request Format** | Simple prompt object | Tool-based with `image_generation` tool |
| **Response Format** | Direct image URL | Base64 in nested response structure |
| **Model Name** | `dall-e-3` | `gpt-4.1-mini` (when using `gpt-image-1`) |
| **Image Format** | URL (temporary) | Base64 (data URI) |

## Response Structure

The GPT Image API returns a complex nested structure. The code checks multiple locations:

1. `data.output[].type === "image_generation_call"` → `result`
2. `data.output[].type === "message"` → `content[].tool_call.result`
3. `data.output[].type === "message"` → `tool_calls[].result`

## Image Storage

After generation, images are typically saved to a bucket (Supabase storage in this case):

1. **Base64 Handling**: GPT Image returns base64, which is converted to a data URI
2. **Bucket Upload**: The image is uploaded to storage via `/api/ai/download-and-store-image`
3. **Permanent URL**: The bucket URL replaces the temporary data URI

## Implementation Checklist for Another Website

1. ✅ **Model Detection**: Check if model is `gpt-image-1` or starts with `gpt-`
2. ✅ **API Endpoint**: Use `https://api.openai.com/v1/responses`
3. ✅ **Request Body**: 
   - Model: `gpt-4.1-mini` (for `gpt-image-1`) or actual model name
   - Input: Formatted prompt with style
   - Tools: `[{ type: "image_generation" }]`
   - Tool Choice: `{ type: "image_generation" }`
4. ✅ **Response Parsing**: Check multiple locations for base64 image data
5. ✅ **Base64 Conversion**: Convert to data URI format: `data:image/png;base64,{base64}`
6. ✅ **Error Handling**: Handle cases where no image is returned
7. ✅ **Storage**: Save base64/image to your storage system

## Example Minimal Implementation

```typescript
async function generateGPTImage(prompt: string, apiKey: string, style: string = 'cinematic') {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: `Create a visual image. ${style} style: ${prompt}. Generate the image now.`,
      tools: [{ type: "image_generation" }],
      tool_choice: { type: "image_generation" },
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract base64 from response
  let imageData = null;
  const imageGenerationCall = data.output?.find((output: any) => output.type === "image_generation_call");
  if (imageGenerationCall) {
    imageData = imageGenerationCall.result;
  } else {
    const messageOutput = data.output?.find((output: any) => output.type === "message");
    if (messageOutput?.tool_calls) {
      const imageToolCall = messageOutput.tool_calls.find((tc: any) => tc.type === "image_generation");
      if (imageToolCall) {
        imageData = imageToolCall.result;
      }
    }
  }

  if (!imageData) {
    throw new Error('No image in response');
  }

  return `data:image/png;base64,${imageData}`;
}
```

## Notes

- GPT Image models return **base64-encoded images**, not URLs
- The response structure can vary, so check multiple locations
- For `gpt-image-1`, the actual model used is `gpt-4.1-mini` with the image generation tool
- GPT-5 models can also be used with additional parameters (`reasoning_effort`, `verbosity`)
- Always save generated images to permanent storage (bucket) rather than relying on temporary URLs






