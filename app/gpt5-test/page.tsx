"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, Sparkles, CheckCircle2, Image as ImageIcon, Eye, Wand2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"

const GPT5_MODELS = [
  'gpt-5.1',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5',
]

const IMAGE_MODELS = [
  'gpt-image-1',
  'dall-e-3',
  'dall-e-2',
]

const VISION_MODELS = [
  'gpt-4.1-mini',
  'gpt-4.1',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-5.1',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5',
]

const IMAGE_GENERATION_MODELS = [
  'gpt-image-1',
  'gpt-4.1-mini',
  'gpt-4.1',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-5.1',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5',
  'dall-e-3',
  'dall-e-2',
]

const MODE_OPTIONS = [
  { value: 'text', label: 'Text Generation', icon: Send },
  { value: 'image', label: 'Image Generation', icon: Wand2 },
  { value: 'vision', label: 'Image Analysis', icon: Eye },
]

const REASONING_EFFORT_OPTIONS = [
  { value: 'none', label: 'None (Fastest)' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High (Best Quality)' },
]

const VERBOSITY_OPTIONS = [
  { value: 'low', label: 'Low (Concise)' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High (Detailed)' },
]

export default function GPT5TestPage() {
  const { toast } = useToast()
  const { ready, userId } = useAuthReady()
  const [apiKey, setApiKey] = useState('')
  const [apiKeySource, setApiKeySource] = useState<'user' | 'system' | 'manual' | null>(null)
  const [isLoadingKey, setIsLoadingKey] = useState(true)
  const [mode, setMode] = useState<'text' | 'image' | 'vision'>('text')
  const [model, setModel] = useState('gpt-5.1')
  const [imageModel, setImageModel] = useState('gpt-image-1')
  const [visionModel, setVisionModel] = useState('gpt-4.1-mini')
  const [reasoningEffort, setReasoningEffort] = useState('none')
  const [verbosity, setVerbosity] = useState('medium')
  const [temperature, setTemperature] = useState('0.7')
  const [prompt, setPrompt] = useState('Write a haiku about code.')
  const [response, setResponse] = useState('')
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageDetail, setImageDetail] = useState<'low' | 'high' | 'auto'>('auto')
  const [isLoading, setIsLoading] = useState(false)
  const [rawResponse, setRawResponse] = useState<any>(null)

  // Fetch API key from system settings
  useEffect(() => {
    const fetchApiKey = async () => {
      if (!ready) return
      
      setIsLoadingKey(true)
      try {
        const supabase = getSupabaseClient()
        
        // First, try to get user's API key
        if (userId) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('openai_api_key')
            .eq('id', userId)
            .single()

          if (!userError && userData?.openai_api_key?.trim()) {
            setApiKey(userData.openai_api_key.trim())
            setApiKeySource('user')
            setIsLoadingKey(false)
            return
          }
        }

        // If no user key, try system-wide key
        const { data: systemData, error: systemError } = await supabase
          .from('system_ai_config')
          .select('setting_key, setting_value')
          .eq('setting_key', 'openai_api_key')
          .single()

        if (!systemError && systemData?.setting_value?.trim()) {
          setApiKey(systemData.setting_value.trim())
          setApiKeySource('system')
          setIsLoadingKey(false)
          return
        }

        // No key found
        setApiKey('')
        setApiKeySource(null)
      } catch (error) {
        console.error('Error fetching API key:', error)
        setApiKey('')
        setApiKeySource(null)
      } finally {
        setIsLoadingKey(false)
      }
    }

    fetchApiKey()
  }, [ready, userId])

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Convert image to base64
  const imageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenAI API key",
        variant: "destructive",
      })
      return
    }

    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a test prompt",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setResponse('')
    setRawResponse(null)
    setGeneratedImage(null)

    try {
      if (mode === 'image') {
        // Image generation - use Responses API for GPT Image 1, Images API for DALL·E
        if (visionModel === 'gpt-image-1' || visionModel.startsWith('gpt-')) {
          // Use Responses API for GPT Image 1
          console.log('🖼️ IMAGE GENERATION - Using GPT Image (Responses API)')
          console.log('🖼️ IMAGE GENERATION - Model:', visionModel === 'gpt-image-1' ? 'gpt-4.1-mini (with image_generation tool)' : visionModel)
          console.log('🖼️ IMAGE GENERATION - Prompt:', prompt)
          console.log('🖼️ IMAGE GENERATION - API Endpoint: /v1/responses')
          
          const requestBody: any = {
            model: visionModel === 'gpt-image-1' ? 'gpt-4.1-mini' : visionModel,
            input: prompt,
            tools: [{ type: "image_generation" }],
          }

          // Add GPT-5 specific parameters if using GPT-5 model
          if (visionModel.startsWith('gpt-5')) {
            requestBody.reasoning_effort = reasoningEffort
            requestBody.verbosity = verbosity
            console.log('🖼️ IMAGE GENERATION - GPT-5 parameters:', {
              reasoning_effort: reasoningEffort,
              verbosity: verbosity
            })
          }

          console.log('🖼️ IMAGE GENERATION - Request body:', JSON.stringify(requestBody, null, 2))

          const apiResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
          })

          if (!apiResponse.ok) {
            const errorText = await apiResponse.text()
            let errorJson: any = {}
            try {
              errorJson = JSON.parse(errorText)
            } catch {
              // If not JSON, use the text as is
            }
            
            const errorMessage = errorJson.error?.message || errorText || 'Unknown error'
            throw new Error(`API Error (${apiResponse.status}): ${errorMessage}`)
          }

          console.log('🖼️ IMAGE GENERATION - Response status:', apiResponse.status)
          
          const data = await apiResponse.json()
          setRawResponse(data)
          
          console.log('🖼️ IMAGE GENERATION - Full response:', JSON.stringify(data, null, 2))
          
          // Extract image from response
          const imageData = data.output?.filter((output: any) => output.type === "image_generation_call")?.[0]?.result
          console.log('🖼️ IMAGE GENERATION - Image data found:', !!imageData)
          console.log('🖼️ IMAGE GENERATION - Output items:', data.output?.length || 0)
          
          if (imageData) {
            console.log('🖼️ IMAGE GENERATION - ✅ Successfully generated image using GPT Image (Responses API)')
            setGeneratedImage(`data:image/png;base64,${imageData}`)
            setResponse('Image generated successfully using GPT Image (Responses API)!')
            toast({
              title: "Success",
              description: "Image generated successfully using GPT Image",
            })
          } else {
            console.error('🖼️ IMAGE GENERATION - ❌ No image data in response')
            throw new Error('No image in response')
          }
        } else if (visionModel.startsWith('dall-e')) {
          // Use Images API for DALL·E models
          console.log('🎨 IMAGE GENERATION - Using DALL·E (Images API)')
          console.log('🎨 IMAGE GENERATION - Model:', visionModel)
          console.log('🎨 IMAGE GENERATION - Prompt:', prompt)
          console.log('🎨 IMAGE GENERATION - API Endpoint: /v1/images/generations')
          
          const requestBody: any = {
            model: visionModel,
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
          }

          console.log('🎨 IMAGE GENERATION - Request body:', JSON.stringify(requestBody, null, 2))

          const apiResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
          })
          
          console.log('🎨 IMAGE GENERATION - Response status:', apiResponse.status)

          if (!apiResponse.ok) {
            const errorText = await apiResponse.text()
            let errorJson: any = {}
            try {
              errorJson = JSON.parse(errorText)
            } catch {
              // If not JSON, use the text as is
            }
            
            const errorMessage = errorJson.error?.message || errorText || 'Unknown error'
            throw new Error(`API Error (${apiResponse.status}): ${errorMessage}`)
          }

          const data = await apiResponse.json()
          setRawResponse(data)
          
          console.log('🎨 IMAGE GENERATION - Full response:', JSON.stringify(data, null, 2))
          
          // Extract image URL from response
          const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json
          console.log('🎨 IMAGE GENERATION - Image URL found:', !!imageUrl)
          console.log('🎨 IMAGE GENERATION - Response format:', data.data?.[0]?.url ? 'URL' : data.data?.[0]?.b64_json ? 'Base64' : 'None')
          
          if (imageUrl) {
            if (data.data[0].b64_json) {
              // Base64 encoded image
              console.log('🎨 IMAGE GENERATION - ✅ Successfully generated image using DALL·E (Images API) - Base64 format')
              setGeneratedImage(`data:image/png;base64,${imageUrl}`)
              setResponse('Image generated successfully using DALL·E (Images API - Base64)!')
            } else {
              // URL
              console.log('🎨 IMAGE GENERATION - ✅ Successfully generated image using DALL·E (Images API) - URL format')
              setGeneratedImage(imageUrl)
              setResponse(`Image generated successfully using DALL·E (Images API - URL)!\nURL: ${imageUrl}`)
            }
            toast({
              title: "Success",
              description: "Image generated successfully using DALL·E",
            })
          } else {
            console.error('🎨 IMAGE GENERATION - ❌ No image data in response')
            throw new Error('No image in response')
          }
        } else {
          throw new Error('Unsupported image model')
        }
      } else if (mode === 'vision') {
        // Image analysis using Responses API
        if (!uploadedImage) {
          toast({
            title: "Image Required",
            description: "Please upload an image to analyze",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }

        const base64Image = await imageToBase64(uploadedImage)
        const imageMimeType = uploadedImage.type || 'image/jpeg'

        const requestBody: any = {
          model: visionModel,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt || "What's in this image?" },
                {
                  type: "input_image",
                  image_url: `data:${imageMimeType};base64,${base64Image}`,
                  detail: imageDetail,
                },
              ],
            },
          ],
        }

        // Add GPT-5 specific parameters if using GPT-5 model
        if (visionModel.startsWith('gpt-5')) {
          requestBody.reasoning_effort = reasoningEffort
          requestBody.verbosity = verbosity
        }

        const apiResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text()
          let errorJson: any = {}
          try {
            errorJson = JSON.parse(errorText)
          } catch {
            // If not JSON, use the text as is
          }
          
          const errorMessage = errorJson.error?.message || errorText || 'Unknown error'
          throw new Error(`API Error (${apiResponse.status}): ${errorMessage}`)
        }

        const data = await apiResponse.json()
        setRawResponse(data)
        
        const message = data?.output_text?.trim()
        if (message) {
          setResponse(message)
          toast({
            title: "Success",
            description: "Image analyzed successfully",
          })
        } else {
          throw new Error('No analysis in response')
        }
      } else {
        // Text generation (existing code)
        // Check if this is a GPT-5 model
        const isGPT5Model = model.startsWith('gpt-5')
        
        // Build request body
        const requestBody: any = {
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }

        // GPT-5 models use max_completion_tokens instead of max_tokens
        if (isGPT5Model) {
          requestBody.max_completion_tokens = 2000
        } else {
          requestBody.max_tokens = 2000
        }

        // Add GPT-5 specific parameters
        if (isGPT5Model) {
          requestBody.reasoning_effort = reasoningEffort
          requestBody.verbosity = verbosity

          // GPT-5 models only support temperature = 1 (default)
          // Don't send temperature parameter, let it use default value of 1
        } else {
          // For non-GPT-5 models, use standard temperature
          requestBody.temperature = parseFloat(temperature) || 0.7
        }

        const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text()
          let errorJson: any = {}
          try {
            errorJson = JSON.parse(errorText)
          } catch {
            // If not JSON, use the text as is
          }
          
          const errorMessage = errorJson.error?.message || errorText || 'Unknown error'
          throw new Error(`API Error (${apiResponse.status}): ${errorMessage}`)
        }

        const data = await apiResponse.json()
        setRawResponse(data)
        
        const message = data?.choices?.[0]?.message?.content?.trim()
        if (message) {
          setResponse(message)
          toast({
            title: "Success",
            description: "Response received successfully",
          })
        } else {
          throw new Error('No message in response')
        }
      }
    } catch (error) {
      console.error('GPT-5 test error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setResponse(`Error: ${errorMessage}`)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">GPT-5.1 Test Page</h1>
            <p className="text-muted-foreground">
              Test GPT-5 models independently from system-wide preferences
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Configure your GPT-5 test parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode Selection */}
              <div className="space-y-2">
                <Label htmlFor="mode">Mode</Label>
                <Select value={mode} onValueChange={(value: 'text' | 'image' | 'vision') => setMode(value)}>
                  <SelectTrigger id="mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODE_OPTIONS.map((opt) => {
                      const Icon = opt.icon
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{opt.label}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-key">OpenAI API Key</Label>
                  {apiKeySource && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>
                        {apiKeySource === 'user' && 'From your account'}
                        {apiKeySource === 'system' && 'From system settings'}
                        {apiKeySource === 'manual' && 'Manually entered'}
                      </span>
                    </div>
                  )}
                </div>
                {isLoadingKey ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading API key...</span>
                  </div>
                ) : (
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setApiKeySource('manual')
                    }}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {apiKeySource 
                    ? 'API key automatically loaded from your settings. You can override it manually.'
                    : 'Enter your OpenAI API key to test GPT-5 models'}
                </p>
              </div>

              {/* Model Selection - Text Mode */}
              {mode === 'text' && (
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GPT5_MODELS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Vision Model Selection - Image/Vision Mode */}
              {(mode === 'image' || mode === 'vision') && (
                <div className="space-y-2">
                  <Label htmlFor="vision-model">Model</Label>
                  <Select value={visionModel} onValueChange={setVisionModel}>
                    <SelectTrigger id="vision-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(mode === 'image' ? IMAGE_GENERATION_MODELS : VISION_MODELS).map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {mode === 'image' 
                      ? 'Model with image generation capabilities (GPT Image 1 uses Responses API, DALL·E uses Images API)'
                      : 'Model with vision capabilities for image analysis'}
                  </p>
                </div>
              )}

              {/* Image Detail - Vision Mode */}
              {mode === 'vision' && (
                <div className="space-y-2">
                  <Label htmlFor="image-detail">Image Detail Level</Label>
                  <Select value={imageDetail} onValueChange={(value: 'low' | 'high' | 'auto') => setImageDetail(value)}>
                    <SelectTrigger id="image-detail">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Model decides)</SelectItem>
                      <SelectItem value="low">Low (85 tokens, faster)</SelectItem>
                      <SelectItem value="high">High (Better understanding)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Low detail uses 512px resolution, high detail provides better understanding
                  </p>
                </div>
              )}

              {/* Image Upload - Vision Mode */}
              {mode === 'vision' && (
                <div className="space-y-2">
                  <Label htmlFor="image-upload">Upload Image</Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={handleImageUpload}
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="max-w-full h-auto rounded-lg border"
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supported: PNG, JPEG, WEBP, GIF (up to 50MB)
                  </p>
                </div>
              )}

              {/* Reasoning Effort - Text and Vision modes with GPT-5 */}
              {(mode === 'text' || mode === 'vision') && (mode === 'text' ? model.startsWith('gpt-5') : visionModel.startsWith('gpt-5')) && (
                <div className="space-y-2">
                  <Label htmlFor="reasoning-effort">Reasoning Effort</Label>
                  <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                    <SelectTrigger id="reasoning-effort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONING_EFFORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Controls how much reasoning the model does before responding
                  </p>
                </div>
              )}

              {/* Verbosity - Text and Vision modes with GPT-5 */}
              {(mode === 'text' || mode === 'vision') && (mode === 'text' ? model.startsWith('gpt-5') : visionModel.startsWith('gpt-5')) && (
                <div className="space-y-2">
                  <Label htmlFor="verbosity">Verbosity</Label>
                  <Select value={verbosity} onValueChange={setVerbosity}>
                    <SelectTrigger id="verbosity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERBOSITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Controls the length and detail of the response
                  </p>
                </div>
              )}

              {/* Temperature - Text mode only, not available for GPT-5 models */}
              {mode === 'text' && !model.startsWith('gpt-5') && (
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness (0-2). Not available for GPT-5 models (defaults to 1).
                  </p>
                </div>
              )}

              {/* Prompt Input */}
              <div className="space-y-2">
                <Label htmlFor="prompt">
                  {mode === 'image' ? 'Image Generation Prompt' : 
                   mode === 'vision' ? 'Image Analysis Prompt (optional)' : 
                   'Test Prompt'}
                </Label>
                <Textarea
                  id="prompt"
                  placeholder={
                    mode === 'image' ? 'Describe the image you want to generate...' :
                    mode === 'vision' ? 'What would you like to know about this image? (optional)' :
                    'Enter your test prompt here...'
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                />
                {mode === 'image' && (
                  <p className="text-xs text-muted-foreground">
                    Example: "Generate an image of a gray tabby cat hugging an otter with an orange scarf"
                  </p>
                )}
                {mode === 'vision' && (
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use default: "What's in this image?"
                  </p>
                )}
              </div>

              {/* Test Button */}
              <Button
                onClick={handleTest}
                disabled={
                  isLoading || 
                  !apiKey.trim() || 
                  (mode === 'text' && !prompt.trim()) ||
                  (mode === 'image' && !prompt.trim()) ||
                  (mode === 'vision' && !uploadedImage)
                }
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'image' ? 'Generating Image...' : 
                     mode === 'vision' ? 'Analyzing Image...' : 
                     'Testing...'}
                  </>
                ) : (
                  <>
                    {mode === 'image' ? <Wand2 className="mr-2 h-4 w-4" /> :
                     mode === 'vision' ? <Eye className="mr-2 h-4 w-4" /> :
                     <Send className="mr-2 h-4 w-4" />}
                    {mode === 'image' ? 'Generate Image' : 
                     mode === 'vision' ? 'Analyze Image' : 
                     'Test GPT-5'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Response Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Response</CardTitle>
              <CardDescription>
                GPT-5 model response will appear here
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : generatedImage ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <img 
                      src={generatedImage} 
                      alt="Generated" 
                      className="max-w-full h-auto rounded-lg"
                    />
                  </div>
                  {response && (
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <pre className="whitespace-pre-wrap text-sm">{response}</pre>
                    </div>
                  )}
                  {/* Raw Response Toggle */}
                  {rawResponse && (
                    <details className="rounded-lg border p-4">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                        View Raw Response
                      </summary>
                      <pre className="mt-4 overflow-auto text-xs">
                        {JSON.stringify(rawResponse, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ) : response ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <pre className="whitespace-pre-wrap text-sm">{response}</pre>
                  </div>

                  {/* Raw Response Toggle */}
                  {rawResponse && (
                    <details className="rounded-lg border p-4">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                        View Raw Response
                      </summary>
                      <pre className="mt-4 overflow-auto text-xs">
                        {JSON.stringify(rawResponse, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  {mode === 'image' ? (
                    <Wand2 className="h-12 w-12 text-muted-foreground mb-4" />
                  ) : mode === 'vision' ? (
                    <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                  ) : (
                    <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {mode === 'image' 
                      ? 'Enter a prompt and click "Generate Image" to create an image'
                      : mode === 'vision'
                      ? 'Upload an image and click "Analyze Image" to analyze it'
                      : 'Enter a prompt and click "Test GPT-5" to see the response'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>About GPT-5.1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>GPT-5.1</strong> is OpenAI's newest flagship model with enhanced reasoning capabilities.
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <strong>Reasoning Effort:</strong> Controls how much the model "thinks" before responding.
                "None" is fastest, "High" provides best quality for complex tasks.
              </li>
              <li>
                <strong>Verbosity:</strong> Controls response length. "Low" is concise, "High" is detailed.
              </li>
              <li>
                <strong>Temperature:</strong> Not available for GPT-5 models (defaults to 1). Available for other models to control randomness (0-2).
              </li>
              <li>
                <strong>Best Practices:</strong> Use "none" reasoning for speed, "high" for complex coding/planning tasks.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

