"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Loader2, 
  Image as ImageIcon, 
  Video, 
  Upload, 
  Wand2, 
  Box,
  CheckCircle,
  XCircle,
  Play,
  Download,
  RefreshCw,
  Settings,
  ZoomIn,
  ZoomOut,
  Sparkles,
  MessageSquare,
  Maximize2,
  Save
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"

interface Generation {
  id: string
  type: 'image' | 'video' | 'texture' | 'variation' | 'upscale' | 'nobg' | 'unzoom' | 'text-to-video' | 'image-to-video' | 'motion-svd' | 'video-upscale'
  prompt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  imageUrl?: string
  videoUrl?: string
  createdAt: string
  modelId?: string
  originalImageId?: string
  originalVideoId?: string
}

export default function TestLeonardoPage() {
  const { userId, ready } = useAuthReady()
  const { toast } = useToast()
  
  const [apiKey, setApiKey] = useState("")
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generations, setGenerations] = useState<Generation[]>([])
  
  // Image Generation State
  const [imagePrompt, setImagePrompt] = useState("")
  const [imageModel, setImageModel] = useState("ac614f96-1082-45bf-be9d-757f2d31c174") // Leonardo Creative
  const [imageWidth, setImageWidth] = useState(1024)
  const [imageHeight, setImageHeight] = useState(1024)
  const [numImages, setNumImages] = useState(1)
  const [promptMagic, setPromptMagic] = useState(true)
  const [highContrast, setHighContrast] = useState(true)
  const [negativePrompt, setNegativePrompt] = useState("blurry, low quality, distorted, amateur")
  
  // Video Generation State (Motion)
  const [videoType, setVideoType] = useState<'single' | 'frame-to-frame'>('single')
  const [videoImageFile, setVideoImageFile] = useState<File | null>(null)
  const [videoImagePreview, setVideoImagePreview] = useState<string | null>(null)
  const [startFrameFile, setStartFrameFile] = useState<File | null>(null)
  const [startFramePreview, setStartFramePreview] = useState<string | null>(null)
  const [endFrameFile, setEndFrameFile] = useState<File | null>(null)
  const [endFramePreview, setEndFramePreview] = useState<string | null>(null)
  const [videoPrompt, setVideoPrompt] = useState("")
  const [videoMotionStrength, setVideoMotionStrength] = useState(2)
  const [videoModel, setVideoModel] = useState('motion-svd') // motion-svd (Motion 2.0), image-to-video, text-to-video
  const [videoModelType, setVideoModelType] = useState<'KLING2_1' | 'VEO3_1' | 'VEO3_1FAST'>('VEO3_1') // For frame-to-frame with image-to-video
  const [videoDuration, setVideoDuration] = useState(8) // Duration for frame-to-frame (8s for Veo, 5/10s for Kling)
  const [textToVideoPrompt, setTextToVideoPrompt] = useState("")
  const [textToVideoDuration, setTextToVideoDuration] = useState(5)
  
  // Platform Models & Motion Control
  const [platformModels, setPlatformModels] = useState<any[]>([])
  const [motion20ModelId, setMotion20ModelId] = useState<string | null>(null)
  const [motionControl, setMotionControl] = useState<string>("") // Motion control option (e.g., "CRASH_ZOOM_OUT", "BULLET_TIME", etc.)
  const [motionElements, setMotionElements] = useState<string[]>([]) // Motion elements array
  const [motionControlElements, setMotionControlElements] = useState<any[]>([]) // Fetched motion control elements with UUIDs
  
  // 3D Texture Generation State
  const [textureModelFile, setTextureModelFile] = useState<File | null>(null)
  const [texturePrompt, setTexturePrompt] = useState("")
  
  // Variations State
  const [variationImageId, setVariationImageId] = useState("")
  const [variationImageFile, setVariationImageFile] = useState<File | null>(null)
  const [variationImagePreview, setVariationImagePreview] = useState<string | null>(null)
  const [variationType, setVariationType] = useState<'upscale' | 'universal-upscaler' | 'nobg' | 'unzoom'>('upscale')
  
  // Video Upscale State
  const [videoUpscaleVideoId, setVideoUpscaleVideoId] = useState("")
  const [videoUpscaleVideoFile, setVideoUpscaleVideoFile] = useState<File | null>(null)
  const [videoUpscaleVideoPreview, setVideoUpscaleVideoPreview] = useState<string | null>(null)
  
  // Tools State
  const [promptToImprove, setPromptToImprove] = useState("")
  const [improvedPrompt, setImprovedPrompt] = useState("")
  const [randomPrompt, setRandomPrompt] = useState("")
  const [userInfo, setUserInfo] = useState<any>(null)
  
  // Load API key from database
  useEffect(() => {
    const loadApiKey = async () => {
      if (!ready || !userId) return
      
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('users')
          .select('leonardo_api_key')
          .eq('id', userId)
          .single()
        
        if (!error && data?.leonardo_api_key) {
          setApiKey(data.leonardo_api_key)
          setApiKeyLoaded(true)
        }
      } catch (error) {
        console.error('Error loading API key:', error)
      }
    }
    
    loadApiKey()
  }, [ready, userId])

  // Fetch platform models to get Motion 2.0 model ID
  useEffect(() => {
    const fetchPlatformModels = async () => {
      if (!apiKey || !apiKeyLoaded) return
      
      try {
        const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/platformModels', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.error('Failed to fetch platform models:', response.status)
          return
        }

        const result = await response.json()
        console.log('📋 Platform models fetched:', result)
        console.log('📋 Platform models structure:', {
          hasCustomModels: !!result.custom_models,
          hasModels: !!result.models,
          keys: Object.keys(result)
        })
        
        // Handle different response structures
        const models = result.custom_models || result.models || result || []
        setPlatformModels(Array.isArray(models) ? models : [])
        
        // Find Motion 2.0 model - check various possible fields and naming patterns
        const motion20 = (Array.isArray(models) ? models : []).find((model: any) => {
          const name = (model.name || model.title || '').toLowerCase()
          const id = (model.id || model.modelId || '').toLowerCase()
          
          return (
            name.includes('motion 2.0') || 
            name.includes('motion2.0') ||
            name.includes('motion-2.0') ||
            name.includes('motion_2.0') ||
            id.includes('motion-2.0') ||
            id.includes('motion2.0') ||
            id.includes('motion_2.0') ||
            model.id === 'motion-2.0' ||
            model.modelId === 'motion-2.0'
          )
        })
        
        if (motion20) {
          const modelId = motion20.id || motion20.modelId || motion20._id
          setMotion20ModelId(modelId)
          console.log('✅ Motion 2.0 model ID found:', modelId, 'Model:', motion20)
        } else {
          // Motion 2.0 is likely the default model for motion-svd endpoint
          // It may not appear in platform models as it's a built-in video model
          console.log('ℹ️ Motion 2.0 not in platform models (likely default for motion-svd endpoint)')
          console.log('📋 Available image models:', models.slice(0, 10).map((m: any) => ({ 
            name: m.name || m.title, 
            id: m.id || m.modelId 
          })))
          console.log('ℹ️ Motion 2.0 will be used as default for motion-svd endpoint')
        }
      } catch (error) {
        console.error('Error fetching platform models:', error)
      }
    }
    
    fetchPlatformModels()
    
    // Fetch motion control elements
    const fetchMotionControlElements = async () => {
      if (!apiKey || !apiKeyLoaded) return
      
      try {
        // Try different possible endpoints for motion control elements
        const endpoints = [
          'https://cloud.leonardo.ai/api/rest/v1/motion-control-elements',
          'https://cloud.leonardo.ai/api/rest/v1/elements',
          'https://cloud.leonardo.ai/api/rest/v1/generation-elements',
        ]
        
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (response.ok) {
              const result = await response.json()
              console.log('📋 Motion control elements fetched from:', endpoint, result)
              setMotionControlElements(Array.isArray(result) ? result : (result.elements || result.data || []))
              return
            }
          } catch (err) {
            // Try next endpoint
            continue
          }
        }
        
        console.log('ℹ️ Could not fetch motion control elements from API - will use hardcoded UUIDs')
      } catch (error) {
        console.error('Error fetching motion control elements:', error)
      }
    }
    
    fetchMotionControlElements()
  }, [apiKey, apiKeyLoaded])

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'start' | 'end' = 'video') => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const preview = e.target?.result as string
        if (type === 'video') {
          setVideoImageFile(file)
          setVideoImagePreview(preview)
        } else if (type === 'start') {
          setStartFrameFile(file)
          setStartFramePreview(preview)
        } else if (type === 'end') {
          setEndFrameFile(file)
          setEndFramePreview(preview)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleModelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTextureModelFile(file)
    }
  }

  const pollGenerationStatus = async (generationId: string, type: 'image' | 'video' | 'texture' | 'text-to-video' | 'motion-svd' | 'image-to-video' | 'video-upscale') => {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0
    
    const poll = async () => {
      try {
        attempts++
        console.log(`🔄 [POLLING] Attempt ${attempts}/${maxAttempts} for generation ID: ${generationId}`)
        console.log(`🔄 [POLLING] Type: ${type}`)
        
        let endpoint = ''
        if (type === 'image') {
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`
        } else if (type === 'text-to-video') {
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/generations-text-to-video/${generationId}`
          console.log(`🔄 [POLLING] Using text-to-video endpoint: ${endpoint}`)
        } else if (type === 'video-upscale') {
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/generations-video-upscale/${generationId}`
          console.log(`🔄 [POLLING] Using video-upscale endpoint: ${endpoint}`)
        } else if (type === 'image-to-video') {
          // Try multiple endpoints for image-to-video status
          // motionVideoGenerationJob might use a different endpoint
          const endpoints = [
            `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
            `https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video/${generationId}`,
            `https://cloud.leonardo.ai/api/rest/v1/motion-video/${generationId}`,
          ]
          endpoint = endpoints[0] // Try general generations endpoint first
          console.log(`🔄 [POLLING] Trying image-to-video endpoints, starting with: ${endpoint}`)
        } else if (type === 'video' || type === 'motion-svd') {
          // Try general generations endpoint first (motion-svd uses this)
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`
          console.log(`🔄 [POLLING] Trying general generations endpoint for motion-svd: ${endpoint}`)
        } else {
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`
        }
        
        console.log(`🔄 [POLLING] Fetching: ${endpoint}`)
        let response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })
        
        console.log(`🔄 [POLLING] Response status: ${response.status}`)
        
        // If 404 and image-to-video, try alternative endpoints
        if (!response.ok && response.status === 404 && type === 'image-to-video') {
          const alternativeEndpoints = [
            `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
            `https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video/${generationId}`,
          ]
          
          for (const altEndpoint of alternativeEndpoints) {
            if (altEndpoint === endpoint) continue // Skip the one we already tried
            console.log(`🔄 [POLLING] Trying alternative endpoint: ${altEndpoint}`)
            response = await fetch(altEndpoint, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            })
            console.log(`🔄 [POLLING] Alternative endpoint response status: ${response.status}`)
            if (response.ok) {
              endpoint = altEndpoint
              break
            }
          }
        }
        
        // If 404 and motion-svd, try alternative endpoints
        if (!response.ok && response.status === 404 && type === 'motion-svd') {
          const alternativeEndpoints = [
            `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
            `https://cloud.leonardo.ai/api/rest/v1/generations-motion-svd/${generationId}`,
          ]
          
          for (const altEndpoint of alternativeEndpoints) {
            if (altEndpoint === endpoint) continue // Skip the one we already tried
            console.log(`🔄 [POLLING] Trying alternative endpoint for motion-svd: ${altEndpoint}`)
            response = await fetch(altEndpoint, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            })
            console.log(`🔄 [POLLING] Alternative endpoint response status: ${response.status}`)
            if (response.ok) {
              endpoint = altEndpoint
              break
            }
          }
        }
        
        if (response.ok) {
          const result = await response.json()
          console.log('📊 [POLLING] Generation status response:', JSON.stringify(result, null, 2))
          
          // Determine status and URLs from result BEFORE updating state
          let determinedStatus: Generation['status'] = 'processing'
          let determinedImageUrl: string | undefined = undefined
          let determinedVideoUrl: string | undefined = undefined
          
          if (type === 'image') {
            if (result.generations?.[0]?.status === 'COMPLETE') {
              determinedStatus = 'completed'
              determinedImageUrl = result.generations[0].generated_images?.[0]?.url
            } else if (result.generations?.[0]?.status === 'FAILED') {
              determinedStatus = 'failed'
            }
          } else if (type === 'text-to-video') {
            // Handle text-to-video response
            console.log('📊 [POLLING] Processing text-to-video status...')
            const jobStatus = result.textToVideoGenerationJob?.status ||
                            result.status ||
                            result.generation?.status
            const videoUrlResult = result.textToVideoGenerationJob?.videoURL ||
                                  result.videoUrl ||
                                  result.url ||
                                  result.generation?.videoUrl
            
            console.log('📊 [POLLING] Text-to-video status:', jobStatus)
            console.log('📊 [POLLING] Video URL found:', !!videoUrlResult, videoUrlResult)
            
            if (jobStatus === 'COMPLETE' || jobStatus === 'complete' || jobStatus === 'COMPLETED' || jobStatus === 'succeeded') {
              determinedStatus = 'completed'
              determinedVideoUrl = videoUrlResult
              console.log('✅ [POLLING] Text-to-video completed! URL:', determinedVideoUrl)
            } else if (jobStatus === 'FAILED' || jobStatus === 'failed' || jobStatus === 'error') {
              determinedStatus = 'failed'
              console.error('❌ [POLLING] Text-to-video failed')
            } else {
              console.log('⏳ [POLLING] Text-to-video still processing, status:', jobStatus)
            }
          } else if (type === 'video-upscale') {
            // Handle video upscale response
            console.log('📊 [POLLING] Processing video-upscale status...')
            const jobStatus = result.videoUpscaleGenerationJob?.status ||
                            result.status ||
                            result.generation?.status
            const videoUrlResult = result.videoUpscaleGenerationJob?.videoURL ||
                                  result.videoUrl ||
                                  result.url ||
                                  result.generation?.videoUrl
            
            console.log('📊 [POLLING] Video-upscale status:', jobStatus)
            console.log('📊 [POLLING] Video URL found:', !!videoUrlResult, videoUrlResult)
            
            if (jobStatus === 'COMPLETE' || jobStatus === 'complete' || jobStatus === 'COMPLETED' || jobStatus === 'succeeded') {
              determinedStatus = 'completed'
              determinedVideoUrl = videoUrlResult
              console.log('✅ [POLLING] Video-upscale completed! URL:', determinedVideoUrl)
            } else if (jobStatus === 'FAILED' || jobStatus === 'failed' || jobStatus === 'error') {
              determinedStatus = 'failed'
              console.error('❌ [POLLING] Video-upscale failed')
            } else {
              console.log('⏳ [POLLING] Video-upscale still processing, status:', jobStatus)
            }
          } else if (type === 'image-to-video') {
            // Handle image-to-video response structure
            // Note: The /generations/{id} endpoint returns generations_by_pk structure
            console.log('📊 [POLLING] Processing image-to-video status...')
            console.log('📊 [POLLING] Response structure:', {
              hasGenerationsByPk: !!result.generations_by_pk,
              hasMotionVideoJob: !!result.motionVideoGenerationJob,
              hasImageToVideoJob: !!result.imageToVideoGenerationJob,
              hasGeneration: !!result.generation,
              hasStatus: !!result.status,
              generationsByPkStatus: result.generations_by_pk?.status,
              motionVideoStatus: result.motionVideoGenerationJob?.status,
              imageToVideoStatus: result.imageToVideoGenerationJob?.status,
              generationStatus: result.generation?.status,
              rootStatus: result.status,
            })
            
            // Check generations_by_pk structure first (from /generations/{id} endpoint)
            const generationsByPk = result.generations_by_pk
            const jobStatus = generationsByPk?.status ||
                            result.motionVideoGenerationJob?.status ||
                            result.imageToVideoGenerationJob?.status ||
                            result.generation?.status ||
                            result.status
            
            // Extract video URL from generations_by_pk.generated_images[0].motionMP4URL
            const videoUrlResult = generationsByPk?.generated_images?.[0]?.motionMP4URL ||
                                  generationsByPk?.generated_images?.[0]?.url ||
                                  result.motionVideoGenerationJob?.videoURL ||
                                  result.motionVideoGenerationJob?.url ||
                                  result.imageToVideoGenerationJob?.videoURL ||
                                  result.generation?.videoURL ||
                                  result.videoUrl ||
                                  result.url ||
                                  result.imageToVideoGenerationJob?.url ||
                                  result.generation?.url
            
            console.log('📊 [POLLING] Job status:', jobStatus)
            console.log('📊 [POLLING] Video URL found:', !!videoUrlResult, videoUrlResult)
            
            if (jobStatus === 'COMPLETE' || jobStatus === 'complete' || jobStatus === 'COMPLETED' || jobStatus === 'succeeded') {
              determinedStatus = 'completed'
              determinedVideoUrl = videoUrlResult
              console.log('✅ [POLLING] Image-to-video generation completed! URL:', determinedVideoUrl)
            } else if (jobStatus === 'FAILED' || jobStatus === 'failed' || jobStatus === 'error') {
              determinedStatus = 'failed'
              console.error('❌ [POLLING] Image-to-video generation failed')
            } else {
              console.log('⏳ [POLLING] Image-to-video still processing, status:', jobStatus)
            }
          } else if (type === 'video' || type === 'motion-svd') {
            // Handle motion SVD response structure
            // The general generations endpoint returns: { generations_by_pk: { status, generated_images: [{ motionMP4URL }] } }
            console.log('📊 [POLLING] Processing motion SVD status...')
            console.log('📊 [POLLING] Response structure:', {
              hasGenerationsByPk: !!result.generations_by_pk,
              hasMotionSvdJob: !!result.motionSvdGenerationJob,
              hasStatus: !!result.status,
              generationsByPkStatus: result.generations_by_pk?.status,
              motionSvdStatus: result.motionSvdGenerationJob?.status,
              rootStatus: result.status,
            })
            
            // Check both structures: generations_by_pk (from general endpoint) and motionSvdGenerationJob (from specific endpoint)
            const generation = result.generations_by_pk || result
            const jobStatus = generation.status ||
                            result.motionSvdGenerationJob?.status ||
                            result.status
            
            // Get video URL from generated_images array (motion-svd stores it there)
            const generatedImage = generation.generated_images?.[0] || result.generated_images?.[0]
            const videoUrlResult = generatedImage?.motionMP4URL ||
                                  result.motionSvdGenerationJob?.motionMP4URL ||
                                  generation.videoUrl ||
                                  result.videoUrl ||
                                  result.url ||
                                  result.motionSvdGenerationJob?.url
            
            console.log('📊 [POLLING] Job status:', jobStatus)
            console.log('📊 [POLLING] Video URL found:', !!videoUrlResult, videoUrlResult)
            console.log('📊 [POLLING] Generated image:', generatedImage ? { hasMotionMP4URL: !!generatedImage.motionMP4URL } : 'none')
            
            if (jobStatus === 'COMPLETE' || jobStatus === 'complete' || jobStatus === 'COMPLETED' || jobStatus === 'succeeded') {
              determinedStatus = 'completed'
              determinedVideoUrl = videoUrlResult
              console.log('✅ [POLLING] Motion SVD generation completed! URL:', determinedVideoUrl)
            } else if (jobStatus === 'FAILED' || jobStatus === 'failed' || jobStatus === 'error') {
              determinedStatus = 'failed'
              console.error('❌ [POLLING] Motion SVD generation failed')
            } else {
              console.log('⏳ [POLLING] Motion SVD still processing, status:', jobStatus)
            }
          }
          
          // Update generation status
          setGenerations(prev => prev.map(gen => {
            if (gen.id === generationId) {
              return { 
                ...gen, 
                status: determinedStatus, 
                imageUrl: determinedImageUrl || gen.imageUrl, 
                videoUrl: determinedVideoUrl || gen.videoUrl 
              }
            }
            return gen
          }))
          
          // Check if completed or failed
          if (determinedStatus === 'completed' || determinedStatus === 'failed') {
            if (determinedStatus === 'completed') {
              console.log('✅ [POLLING] Generation completed successfully!')
              toast({
                title: "Generation Complete!",
                description: `${type === 'image' ? 'Image' : type === 'video' ? 'Video' : 'Texture'} generated successfully.`,
              })
            } else {
              console.error('❌ [POLLING] Generation failed')
            }
            return // Stop polling
          }
        } else {
          console.warn(`⚠️ [POLLING] Response not OK: ${response.status}`)
          const errorText = await response.text().catch(() => 'Unable to read error')
          console.warn(`⚠️ [POLLING] Error response:`, errorText)
        }
        
        // Continue polling if not completed
        if (attempts < maxAttempts) {
          console.log(`⏳ [POLLING] Waiting 5 seconds before next attempt...`)
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          console.error('⏰ [POLLING] Max attempts reached, timing out')
          setGenerations(prev => prev.map(gen => 
            gen.id === generationId ? { ...gen, status: 'failed' } : gen
          ))
          toast({
            title: "Generation Timeout",
            description: "Generation took too long. Please try again.",
            variant: "destructive"
          })
        }
      } catch (error) {
        console.error('❌ [POLLING] Error polling generation status:', error)
        console.error('❌ [POLLING] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        })
        if (attempts < maxAttempts) {
          console.log(`⏳ [POLLING] Retrying after error in 5 seconds...`)
          setTimeout(poll, 5000)
        } else {
          console.error('⏰ [POLLING] Max attempts reached after error')
        }
      }
    }
    
    setTimeout(poll, 5000) // Start polling after 5 seconds
  }

  const generateImage = async () => {
    if (!apiKey || !imagePrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter an API key and prompt.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          modelId: imageModel,
          width: imageWidth,
          height: imageHeight,
          num_images: numImages,
          promptMagic: promptMagic,
          highContrast: highContrast,
          negative_prompt: negativePrompt || undefined,
          public: false,
          tiling: false,
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `API Error: ${response.status}`)
      }

      const result = await response.json()
      const generationId = result.sdGenerationJob?.generationId || result.generationId

      if (!generationId) {
        throw new Error('No generation ID returned')
      }

      const newGeneration: Generation = {
        id: generationId,
        type: 'image',
        prompt: imagePrompt,
        status: 'processing',
        createdAt: new Date().toISOString(),
        modelId: imageModel
      }

      setGenerations(prev => [newGeneration, ...prev])
      
      // Start polling
      pollGenerationStatus(generationId, 'image')
      
      toast({
        title: "Image Generation Started",
        description: "Your image is being generated. This may take a few minutes.",
      })
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const generateVideo = async () => {
    console.log('🎬 [VIDEO GENERATION] Starting video generation...')
    console.log('🎬 [VIDEO GENERATION] Video Type:', videoType)
    console.log('🎬 [VIDEO GENERATION] Video Model:', videoModel)
    console.log('🎬 [VIDEO GENERATION] Motion Strength:', videoMotionStrength)
    console.log('🎬 [VIDEO GENERATION] Has API Key:', !!apiKey)
    
    // Handle text-to-video differently
    if (videoModel === 'text-to-video') {
      if (!apiKey || !textToVideoPrompt.trim()) {
        toast({
          title: "Missing Information",
          description: "Please enter a prompt for text-to-video generation.",
          variant: "destructive"
        })
        return
      }
      
      setLoading(true)
      try {
        console.log('🎬 [VIDEO GENERATION] Text-to-Video mode')
        console.log('🎬 [VIDEO GENERATION] Prompt:', textToVideoPrompt)
        console.log('🎬 [VIDEO GENERATION] Duration:', textToVideoDuration)
        
        const endpoint = 'https://cloud.leonardo.ai/api/rest/v1/generations-text-to-video'
        const requestBody = {
          prompt: textToVideoPrompt.trim(),
          duration: textToVideoDuration,
        }
        
        console.log('🎬 [VIDEO GENERATION] Request endpoint:', endpoint)
        console.log('🎬 [VIDEO GENERATION] Request body:', JSON.stringify(requestBody, null, 2))
        
        const videoResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody)
        })
        
        console.log('🎬 [VIDEO GENERATION] Response status:', videoResponse.status)
        
        if (!videoResponse.ok) {
          const errorText = await videoResponse.text()
          console.error('🎬 [VIDEO GENERATION] Error response:', errorText)
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText }
          }
          throw new Error(errorData.error || errorData.message || `API Error: ${videoResponse.status} - ${errorText}`)
        }
        
        const result = await videoResponse.json()
        console.log('🎬 [VIDEO GENERATION] Response data:', JSON.stringify(result, null, 2))
        
        const generationId = result.generationId || 
                            result.id ||
                            result.textToVideoGenerationJob?.id ||
                            result.jobId
        
        console.log('🎬 [VIDEO GENERATION] Extracted generation ID:', generationId)
        
        if (!generationId) {
          console.error('🎬 [VIDEO GENERATION] No generation ID found in response')
          throw new Error('No generation ID returned. Check console for full response.')
        }
        
        const newGeneration: Generation = {
          id: generationId,
          type: 'text-to-video',
          prompt: textToVideoPrompt.trim(),
          status: 'processing',
          createdAt: new Date().toISOString(),
        }
        
        setGenerations(prev => [newGeneration, ...prev])
        pollGenerationStatus(generationId, 'text-to-video')
        
        toast({
          title: "Video Generation Started",
          description: "Your text-to-video is being generated. This may take a few minutes.",
        })
        
        setLoading(false)
        return
      } catch (error) {
        console.error('🎬 [VIDEO GENERATION] Text-to-video failed:', error)
        toast({
          title: "Generation Failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        })
        setLoading(false)
        return
      }
    }
    
    if (videoType === 'single') {
      console.log('🎬 [VIDEO GENERATION] Single image mode')
      console.log('🎬 [VIDEO GENERATION] Has video image file:', !!videoImageFile)
      if (!apiKey || !videoImageFile) {
        toast({
          title: "Missing Information",
          description: "Please upload an image to generate video from.",
          variant: "destructive"
        })
        return
      }
    } else {
      console.log('🎬 [VIDEO GENERATION] Frame-to-frame mode')
      console.log('🎬 [VIDEO GENERATION] Has start frame:', !!startFrameFile)
      console.log('🎬 [VIDEO GENERATION] Has end frame:', !!endFrameFile)
      // Frame-to-frame requires at least start frame
      if (!apiKey || !startFrameFile) {
        toast({
          title: "Missing Information",
          description: "Frame-to-frame requires at least a start frame. End frame is optional.",
          variant: "destructive"
        })
        return
      }
    }

    setLoading(true)
    try {
      let startImageId: string | null = null
      let endImageId: string | null = null

      // Upload start frame (required for frame-to-frame, or used as single image)
      const fileToUpload = videoType === 'single' ? videoImageFile : startFrameFile
      if (fileToUpload) {
        console.log('🎬 [VIDEO GENERATION] Uploading start image...')
        console.log('🎬 [VIDEO GENERATION] File name:', fileToUpload.name)
        console.log('🎬 [VIDEO GENERATION] File size:', fileToUpload.size, 'bytes')
        console.log('🎬 [VIDEO GENERATION] File type:', fileToUpload.type)
        
        // Extract file extension from filename
        const fileName = fileToUpload.name
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
        console.log('🎬 [VIDEO GENERATION] File extension:', fileExtension)
        
        const formData = new FormData()
        formData.append('file', fileToUpload)
        formData.append('extension', fileExtension)
        
        console.log('🎬 [VIDEO GENERATION] Uploading to: https://cloud.leonardo.ai/api/rest/v1/init-image')
        const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData
        })

        console.log('🎬 [VIDEO GENERATION] Upload response status:', uploadResponse.status)
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('🎬 [VIDEO GENERATION] Upload failed:', errorText)
          throw new Error(`Failed to upload start image: ${uploadResponse.status} - ${errorText}`)
        }

        const uploadData = await uploadResponse.json()
        console.log('🎬 [VIDEO GENERATION] Upload response data:', JSON.stringify(uploadData, null, 2))
        
        // Try multiple possible response structures
        startImageId = uploadData.uploadInitImage?.id || 
                       uploadData.id || 
                       uploadData.initImageId ||
                       uploadData.imageId

        if (!startImageId) {
          console.error('🎬 [VIDEO GENERATION] No image ID in response:', uploadData)
          throw new Error('No image ID returned from upload')
        }
        
        console.log('🎬 [VIDEO GENERATION] Start image ID:', startImageId)
        
        // If we have S3 upload fields, upload the file to S3
        if (uploadData.uploadInitImage?.fields && uploadData.uploadInitImage?.url) {
          console.log('🎬 [VIDEO GENERATION] Uploading file to S3...')
          try {
            const s3Fields = JSON.parse(uploadData.uploadInitImage.fields)
            const s3FormData = new FormData()
            
            // Add all S3 fields
            Object.keys(s3Fields).forEach(key => {
              s3FormData.append(key, s3Fields[key])
            })
            
            // Add the file last (S3 requirement)
            s3FormData.append('file', fileToUpload)
            
            // Upload through our API route to avoid CORS issues
            const s3Response = await fetch('/api/leonardo/upload-s3', {
              method: 'POST',
              headers: {
                'x-s3-url': uploadData.uploadInitImage.url,
              },
              body: s3FormData
            })
            
            if (!s3Response.ok) {
              const errorData = await s3Response.json()
              console.error('🎬 [VIDEO GENERATION] S3 upload failed:', s3Response.status, errorData)
              throw new Error(`Failed to upload file to S3: ${s3Response.status}`)
            }
            
            console.log('🎬 [VIDEO GENERATION] File uploaded to S3 successfully')
            // Wait longer for S3 to process and image to be available
            // Motion-svd endpoint may need more time for image processing
            console.log('🎬 [VIDEO GENERATION] Waiting for image to be processed (5 seconds)...')
            await new Promise(resolve => setTimeout(resolve, 5000))
          } catch (s3Error) {
            console.error('🎬 [VIDEO GENERATION] S3 upload error:', s3Error)
            // Continue anyway - the image ID might still work
          }
        } else {
          // Delay to allow API to process the uploaded image
          // Motion-svd endpoint may need more time for image processing
          console.log('🎬 [VIDEO GENERATION] Waiting for image processing (5 seconds)...')
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }

      // Upload end frame if provided (frame-to-frame mode)
      if (videoType === 'frame-to-frame' && endFrameFile) {
        console.log('🎬 [VIDEO GENERATION] Uploading end frame...')
        console.log('🎬 [VIDEO GENERATION] End frame file name:', endFrameFile.name)
        console.log('🎬 [VIDEO GENERATION] End frame file size:', endFrameFile.size, 'bytes')
        
        // Extract file extension from filename
        const fileName = endFrameFile.name
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
        console.log('🎬 [VIDEO GENERATION] End frame file extension:', fileExtension)
        
        const formData = new FormData()
        formData.append('file', endFrameFile)
        formData.append('extension', fileExtension)
        
        const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData
        })

        console.log('🎬 [VIDEO GENERATION] End frame upload response status:', uploadResponse.status)
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('🎬 [VIDEO GENERATION] End frame upload failed:', errorText)
          throw new Error(`Failed to upload end image: ${uploadResponse.status} - ${errorText}`)
        }

        const uploadData = await uploadResponse.json()
        console.log('🎬 [VIDEO GENERATION] End frame upload response:', JSON.stringify(uploadData, null, 2))
        
        // Try multiple possible response structures
        endImageId = uploadData.uploadInitImage?.id || 
                     uploadData.id || 
                     uploadData.initImageId ||
                     uploadData.imageId

        if (!endImageId) {
          console.error('🎬 [VIDEO GENERATION] No end image ID in response:', uploadData)
          throw new Error('No image ID returned from end frame upload')
        }
        
        console.log('🎬 [VIDEO GENERATION] End image ID:', endImageId)
        
        // If we have S3 upload fields, upload the file to S3
        if (uploadData.uploadInitImage?.fields && uploadData.uploadInitImage?.url) {
          console.log('🎬 [VIDEO GENERATION] Uploading end frame file to S3...')
          try {
            const s3Fields = JSON.parse(uploadData.uploadInitImage.fields)
            const s3FormData = new FormData()
            
            // Add all S3 fields
            Object.keys(s3Fields).forEach(key => {
              s3FormData.append(key, s3Fields[key])
            })
            
            // Add the file last (S3 requirement)
            s3FormData.append('file', endFrameFile)
            
            // Upload through our API route to avoid CORS issues
            const s3Response = await fetch('/api/leonardo/upload-s3', {
              method: 'POST',
              headers: {
                'x-s3-url': uploadData.uploadInitImage.url,
              },
              body: s3FormData
            })
            
            if (!s3Response.ok) {
              const errorData = await s3Response.json()
              console.error('🎬 [VIDEO GENERATION] End frame S3 upload failed:', s3Response.status, errorData)
              throw new Error(`Failed to upload end frame file to S3: ${s3Response.status}`)
            }
            
            console.log('🎬 [VIDEO GENERATION] End frame file uploaded to S3 successfully')
            // Wait a bit for S3 to process
            await new Promise(resolve => setTimeout(resolve, 1000))
          } catch (s3Error) {
            console.error('🎬 [VIDEO GENERATION] End frame S3 upload error:', s3Error)
            // Continue anyway - the image ID might still work
          }
        } else {
          // Delay to allow API to process the uploaded image
          console.log('🎬 [VIDEO GENERATION] Waiting for end frame processing (2 seconds)...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // Determine which endpoint to use
      // If motion control is selected, use image-to-video endpoint (motion-svd doesn't support it)
      const shouldUseImageToVideo = videoModel === 'image-to-video' || (videoModel === 'motion-svd' && motionControl)
      
      let endpoint = ''
      let requestBody: any = {}

      if (shouldUseImageToVideo) {
        // If motion control was selected but model was motion-svd, switch to image-to-video
        if (videoModel === 'motion-svd' && motionControl) {
          console.log('🎬 [VIDEO GENERATION] Motion control selected - switching to image-to-video endpoint')
          console.log('🎬 [VIDEO GENERATION] motion-svd does not support motion control, using image-to-video instead')
        }
        // Use Image-to-Video endpoint
        endpoint = 'https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video'
        
        if (videoType === 'frame-to-frame' && endImageId) {
          // Frame-to-frame mode with end frame - requires specific model
          console.log('🎬 [VIDEO GENERATION] Frame-to-frame mode with end frame')
          console.log('🎬 [VIDEO GENERATION] Selected model:', videoModelType)
          console.log('🎬 [VIDEO GENERATION] Duration:', videoDuration, typeof videoDuration)
          
          // Ensure duration is a valid integer
          const validDurations = videoModelType === 'KLING2_1' ? [5, 10] : [4, 6, 8]
          const duration = parseInt(videoDuration.toString(), 10)
          
          if (!validDurations.includes(duration)) {
            toast({
              title: "Invalid Duration",
              description: `Duration must be ${validDurations.join(', ')} seconds for ${videoModelType}`,
              variant: "destructive",
            })
            setLoading(false)
            return
          }
          
          // Wait a bit longer after S3 upload to ensure images are fully processed
          console.log('🎬 [VIDEO GENERATION] Waiting additional time for image processing...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Use exact structure from API documentation
          // For Kling models, duration is required (5 or 10 seconds)
          // For Veo models, duration is also recommended (4, 6, or 8 seconds)
          requestBody = {
            prompt: videoPrompt.trim() || "Smooth transition between frames",
            imageId: startImageId,
            imageType: "UPLOADED",
            endFrameImage: {
              id: endImageId,
              type: "UPLOADED"
            },
            model: videoModelType,
            resolution: "RESOLUTION_1080",
            height: 1080,
            width: 1920,
            duration: duration, // Required for Kling, recommended for Veo
          }
          
          console.log('🎬 [VIDEO GENERATION] Request body before JSON:', requestBody)
          console.log('🎬 [VIDEO GENERATION] Duration value:', duration, 'Type:', typeof duration)
          
          // Log the exact request body for debugging
          console.log('🎬 [VIDEO GENERATION] Final request body:', JSON.stringify(requestBody, null, 2))
          console.log('🎬 [VIDEO GENERATION] Duration type:', typeof requestBody.duration, 'Value:', requestBody.duration)
          
          console.log('🎬 [VIDEO GENERATION] Using Image-to-Video endpoint with frame-to-frame')
        } else {
          // Single image mode
          // Note: image-to-video endpoint has different parameters than motion-svd
          requestBody = {
            imageId: startImageId,
            imageType: "UPLOADED",
            // motionStrength is NOT supported on image-to-video endpoint
            // It's only for motion-svd endpoint
          }
          // Add prompt if provided
          if (videoPrompt.trim()) {
            requestBody.prompt = videoPrompt.trim()
            console.log('🎬 [VIDEO GENERATION] Adding prompt to request')
          }
          
          // Add motion control if selected (image-to-video endpoint supports elements)
          if (motionControl) {
            console.log('🎬 [VIDEO GENERATION] Adding motion control to image-to-video request:', motionControl)
            
            let motionControlUUID: string | null = null
            
            // First, try to find UUID from fetched motion control elements
            if (motionControlElements.length > 0) {
              const element = motionControlElements.find((el: any) => {
                const name = (el.name || el.title || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')
                return name === motionControl || name.includes(motionControl.replace('_', ''))
              })
              if (element) {
                motionControlUUID = element.akUUID || element.id || element.uuid
                console.log('🎬 [VIDEO GENERATION] Found motion control UUID from API:', motionControlUUID)
              }
            }
            
            // If not found, use hardcoded mapping (from Leonardo AI documentation)
            if (!motionControlUUID) {
              const motionControlUUIDs: Record<string, string> = {
                'DOLLY_OUT': '74bea0cc-9942-4d45-9977-28c25078bfd4', // Common UUID pattern - may need verification
                'DOLLY_IN': 'ece8c6a9-3deb-430e-8c93-4d5061b6adbf', // From docs
                'TILT_UP': '6ad6de1f-bd15-4d0b-ae0e-81d1a4c6c085', // From docs
                'ORBIT_LEFT': '74bea0cc-9942-4d45-9977-28c25078bfd4', // From docs
                // Note: These UUIDs need to be verified from Leonardo AI documentation
                // The complete list is available at: https://docs.leonardo.ai/docs/generate-with-motion-20-using-generated-images
              }
              motionControlUUID = motionControlUUIDs[motionControl] || null
            }
            
            if (motionControlUUID) {
              if (!requestBody.elements) {
                requestBody.elements = []
              }
              requestBody.elements.push({
                akUUID: motionControlUUID,
                weight: 1
              })
              console.log('🎬 [VIDEO GENERATION] ✅ Added motion control element:', motionControl, 'UUID:', motionControlUUID)
            } else {
              console.warn('🎬 [VIDEO GENERATION] ⚠️ Motion control UUID not found for:', motionControl)
              console.warn('🎬 [VIDEO GENERATION] Motion control will not be applied')
              console.warn('🎬 [VIDEO GENERATION] Please check Leonardo AI documentation for motion control element UUIDs')
              console.warn('🎬 [VIDEO GENERATION] Docs: https://docs.leonardo.ai/docs/generate-with-motion-20-using-generated-images')
            }
          }
          
          console.log('🎬 [VIDEO GENERATION] Using Image-to-Video endpoint (single image)')
        }
      } else {
        // Use Motion SVD endpoint (Motion 2.0 is the default model)
        // motion-svd endpoint accepts imageId with isInitImage flag for uploaded images
        endpoint = 'https://cloud.leonardo.ai/api/rest/v1/generations-motion-svd'
        // Use imageId with isInitImage: true for uploaded images (from init-image endpoint)
        requestBody = {
          imageId: startImageId,
          motionStrength: videoMotionStrength,
          isInitImage: true, // Required when using uploaded images
        }
        console.log('🎬 [VIDEO GENERATION] Using imageId with isInitImage: true for motion-svd (uploaded image)')
        
        // Add Motion 2.0 model ID if available (optional - Motion 2.0 is default)
        if (motion20ModelId) {
          requestBody.modelId = motion20ModelId
          console.log('🎬 [VIDEO GENERATION] Using Motion 2.0 model ID:', motion20ModelId)
        } else {
          console.log('🎬 [VIDEO GENERATION] Using Motion 2.0 as default (no modelId needed)')
        }
        
        // Note: Motion control for motion-svd endpoint
        // The motion-svd endpoint does NOT accept motion control parameters
        // Based on API testing, it only accepts: imageId, motionStrength, isInitImage
        // Motion control appears to only be available on:
        // 1. Text-to-video endpoint (with elements array)
        // 2. Image-to-video endpoint with GENERATED images (not uploaded)
        // 
        // For uploaded images with motion control, you may need to:
        // 1. First generate an image using Leonardo
        // 2. Then use that generated image's ID with image-to-video endpoint
        if (motionControl) {
          console.log('🎬 [VIDEO GENERATION] Motion control selected:', motionControl)
          console.log('🎬 [VIDEO GENERATION] ⚠️ motion-svd endpoint does NOT support motion control')
          console.log('🎬 [VIDEO GENERATION] Motion control requires using image-to-video endpoint with generated images')
          console.log('🎬 [VIDEO GENERATION] Motion control will NOT be applied to this generation')
        }
        
        // Note: motion elements also not supported on motion-svd
        if (motionElements.length > 0) {
          console.log('🎬 [VIDEO GENERATION] Motion elements not supported on motion-svd endpoint')
        }
        
        // Note: motion-svd endpoint does not accept a prompt parameter
        // Motion control and motion elements are used instead to guide the animation
        if (videoPrompt.trim()) {
          console.log('🎬 [VIDEO GENERATION] Note: prompt provided but motion-svd endpoint does not accept prompt parameter')
          console.log('🎬 [VIDEO GENERATION] Use motion control and motion elements to guide the animation instead')
        }
        console.log('🎬 [VIDEO GENERATION] Using Motion 2.0 (Motion SVD) endpoint')
        
        // Add end frame if provided (frame-to-frame mode)
        if (videoType === 'frame-to-frame' && endImageId) {
          requestBody.endImageId = endImageId
          console.log('🎬 [VIDEO GENERATION] Adding end frame to request (endImageId)')
        }
      }

      console.log('🎬 [VIDEO GENERATION] Request endpoint:', endpoint)
      console.log('🎬 [VIDEO GENERATION] Request body:', JSON.stringify(requestBody, null, 2))
      
      let videoResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody)
      })

      console.log('🎬 [VIDEO GENERATION] Response status:', videoResponse.status)
      console.log('🎬 [VIDEO GENERATION] Response headers:', Object.fromEntries(videoResponse.headers.entries()))

      // Workaround: Try different approaches if request fails
      let errorText = ''
      
      if (!videoResponse.ok && videoType === 'frame-to-frame') {
        errorText = await videoResponse.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        
        const errorMessage = errorData.error || errorData.message || ''
        
        // If error mentions duration is required, try adding it with correct value for model
        if (errorMessage.includes('duration') && !requestBody.duration) {
          const defaultDuration = videoModelType === 'KLING2_1' ? 5 : 8
          console.log(`🎬 [VIDEO GENERATION] Duration required, adding duration ${defaultDuration} for ${videoModelType}...`)
          requestBody.duration = defaultDuration
          
          videoResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody)
          })
          
          console.log('🎬 [VIDEO GENERATION] Retry with duration response status:', videoResponse.status)
        }
        // If duration parameter exists but fails, try without it
        else if (errorMessage.includes('duration') && requestBody.duration) {
          console.log('🎬 [VIDEO GENERATION] Duration parameter causing issues, trying without duration...')
          delete requestBody.duration
          
          videoResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody)
          })
          
          console.log('🎬 [VIDEO GENERATION] Retry without duration response status:', videoResponse.status)
        }
      }

      // Log motion-svd errors for debugging
      if (!videoResponse.ok && videoModel === 'motion-svd') {
        errorText = await videoResponse.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        console.log('🎬 [VIDEO GENERATION] Motion-svd failed, error:', errorData)
        console.log('🎬 [VIDEO GENERATION] Request body was:', JSON.stringify(requestBody, null, 2))
      }

      if (!videoResponse.ok) {
        // Only read error text if we haven't already
        if (!errorText) {
          errorText = await videoResponse.text()
        }
        console.error('🎬 [VIDEO GENERATION] Error response:', errorText)
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        
        // If it's a duration error, provide helpful message
        const errorMessage = errorData.error || errorData.message || `API Error: ${videoResponse.status} - ${errorText}`
        if (errorMessage.includes('duration') && videoType === 'frame-to-frame') {
          throw new Error(`${errorMessage}. Note: If duration 4 is failing, try 6 or 8 seconds. This may be an API validation issue.`)
        }
        
        // Provide helpful error message for motion-svd
        if (videoModel === 'motion-svd') {
          const detailedError = errorData.details || errorData.message || errorMessage
          throw new Error(`Motion SVD generation failed: ${detailedError}. Make sure the image was uploaded successfully and is fully processed.`)
        }
        
        throw new Error(errorMessage)
      }

      const result = await videoResponse.json()
      console.log('🎬 [VIDEO GENERATION] Response data:', JSON.stringify(result, null, 2))
      
      // Handle different response structures
      const generationId = result.motionVideoGenerationJob?.generationId ||
                          result.motionSvdGenerationJob?.id || 
                          result.motionSvdGenerationJob?.generationId ||
                          result.generationId || 
                          result.id ||
                          result.imageToVideoGenerationJob?.id ||
                          result.imageToVideoGenerationJob?.generationId ||
                          result.jobId ||
                          result.textToVideoGenerationJob?.id ||
                          result.textToVideoGenerationJob?.generationId

      console.log('🎬 [VIDEO GENERATION] Extracted generation ID:', generationId)
      console.log('🎬 [VIDEO GENERATION] Full result structure:', {
        hasMotionVideoJob: !!result.motionVideoGenerationJob,
        motionVideoJobGenerationId: result.motionVideoGenerationJob?.generationId,
        hasMotionSvdJob: !!result.motionSvdGenerationJob,
        hasImageToVideoJob: !!result.imageToVideoGenerationJob,
        hasGenerationId: !!result.generationId,
        hasId: !!result.id,
        hasJobId: !!result.jobId,
      })

      if (!generationId) {
        console.error('🎬 [VIDEO GENERATION] No generation ID found in response')
        console.error('🎬 [VIDEO GENERATION] Full response:', result)
        throw new Error('No generation ID returned. Check console for full response.')
      }

      const generationType: Generation['type'] = videoModel === 'image-to-video' ? 'image-to-video' : 'motion-svd'
      
      const newGeneration: Generation = {
        id: generationId,
        type: generationType,
        prompt: videoPrompt.trim() || (videoType === 'single' 
          ? `${videoModel === 'image-to-video' ? `Image-to-Video (${videoModelType})` : 'Motion SVD'} from uploaded image (strength: ${videoMotionStrength})`
          : `Frame-to-frame: ${endImageId ? `Start + End frames (${videoModelType})` : 'Start frame only'} (strength: ${videoMotionStrength})`),
        status: 'processing',
        createdAt: new Date().toISOString(),
      }

      setGenerations(prev => [newGeneration, ...prev])
      
      console.log('🎬 [VIDEO GENERATION] Generation created successfully')
      console.log('🎬 [VIDEO GENERATION] Starting status polling for ID:', generationId)
      console.log('🎬 [VIDEO GENERATION] Polling type:', generationType)
      
      // Start polling with correct type
      pollGenerationStatus(generationId, generationType)
      
      toast({
        title: "Video Generation Started",
        description: "Your video is being generated. This may take a few minutes. Check console for progress.",
      })
    } catch (error) {
      console.error('🎬 [VIDEO GENERATION] Generation failed:', error)
      console.error('🎬 [VIDEO GENERATION] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      console.log('🎬 [VIDEO GENERATION] Generation process completed')
    }
  }

  const generateTexture = async () => {
    if (!apiKey || !textureModelFile || !texturePrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please upload a 3D model and enter a prompt.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      // Upload 3D model
      const fileName = textureModelFile.name
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
      
      const formData = new FormData()
      formData.append('file', textureModelFile)
      formData.append('extension', fileExtension)
      
      const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload 3D model')
      }

      const uploadData = await uploadResponse.json()
      const modelId = uploadData.uploadInitImage?.id

      if (!modelId) {
        throw new Error('No model ID returned from upload')
      }

      // Generate texture
      const textureResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: texturePrompt,
          modelId: imageModel, // Use same model for textures
          init_image_id: modelId,
          width: 1024,
          height: 1024,
          num_images: 1,
        })
      })

      if (!textureResponse.ok) {
        const errorData = await textureResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `API Error: ${textureResponse.status}`)
      }

      const result = await textureResponse.json()
      const generationId = result.sdGenerationJob?.generationId || result.generationId

      if (!generationId) {
        throw new Error('No generation ID returned')
      }

      const newGeneration: Generation = {
        id: generationId,
        type: 'texture',
        prompt: texturePrompt,
        status: 'processing',
        createdAt: new Date().toISOString(),
      }

      setGenerations(prev => [newGeneration, ...prev])
      
      // Start polling
      pollGenerationStatus(generationId, 'texture')
      
      toast({
        title: "Texture Generation Started",
        description: "Your texture is being generated. This may take a few minutes.",
      })
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const generateVariation = async () => {
    if (!apiKey || (!variationImageId && !variationImageFile)) {
      toast({
        title: "Missing Information",
        description: "Please provide an image ID or upload an image.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      let imageId = variationImageId

      // If file uploaded, upload it first
      if (variationImageFile && !imageId) {
        const fileName = variationImageFile.name
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
        
        const formData = new FormData()
        formData.append('file', variationImageFile)
        formData.append('extension', fileExtension)
        
        const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image')
        }

        const uploadData = await uploadResponse.json()
        imageId = uploadData.uploadInitImage?.id

        if (!imageId) {
          throw new Error('No image ID returned from upload')
        }
      }

      if (!imageId) {
        throw new Error('No image ID available')
      }

      // Generate variation based on type
      let endpoint = ''
      let requestBody: any = {}

      switch (variationType) {
        case 'upscale':
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/variations/upscale`
          requestBody = { id: imageId }
          break
        case 'universal-upscaler':
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/variations/universal-upscaler`
          requestBody = { id: imageId }
          break
        case 'nobg':
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/variations/nobg`
          requestBody = { id: imageId }
          break
        case 'unzoom':
          endpoint = `https://cloud.leonardo.ai/api/rest/v1/variations/unzoom`
          requestBody = { id: imageId }
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `API Error: ${response.status}`)
      }

      const result = await response.json()
      const variationId = result.variation?.id || result.id

      if (!variationId) {
        throw new Error('No variation ID returned')
      }

      const newGeneration: Generation = {
        id: variationId,
        type: variationType === 'upscale' || variationType === 'universal-upscaler' ? 'upscale' : variationType,
        prompt: `${variationType} variation`,
        status: 'processing',
        createdAt: new Date().toISOString(),
        originalImageId: imageId
      }

      setGenerations(prev => [newGeneration, ...prev])
      
      // Start polling
      pollGenerationStatus(variationId, 'image')
      
      toast({
        title: "Variation Started",
        description: `Your ${variationType} variation is being processed.`,
      })
    } catch (error) {
      toast({
        title: "Variation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const improvePrompt = async () => {
    if (!apiKey || !promptToImprove.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a prompt to improve.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/prompt/improve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: promptToImprove
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `API Error: ${response.status}`)
      }

      const result = await response.json()
      setImprovedPrompt(result.prompt || result.improvedPrompt || 'No improved prompt returned')
      
      toast({
        title: "Prompt Improved",
        description: "Your prompt has been improved!",
      })
    } catch (error) {
      toast({
        title: "Improvement Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getRandomPrompt = async () => {
    if (!apiKey) {
      toast({
        title: "Missing API Key",
        description: "Please enter your API key first.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/prompt/random', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `API Error: ${response.status}`)
      }

      const result = await response.json()
      setRandomPrompt(result.prompt || result.randomPrompt || 'No prompt returned')
      
      toast({
        title: "Random Prompt Generated",
        description: "A random prompt has been generated!",
      })
    } catch (error) {
      toast({
        title: "Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getUserInfo = async () => {
    if (!apiKey) {
      toast({
        title: "Missing API Key",
        description: "Please enter your API key first.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `API Error: ${response.status}`)
      }

      const result = await response.json()
      setUserInfo(result)
      
      toast({
        title: "User Info Loaded",
        description: "Your account information has been loaded.",
      })
    } catch (error) {
      toast({
        title: "Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'processing':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Leonardo AI Test Page</h1>
          <p className="text-muted-foreground">
            Test all Leonardo AI features: Image Generation, Motion (Image-to-Video), and 3D Texture Generation
          </p>
        </div>

        {/* API Key Setup */}
        <Card className="cinema-card mb-6">
          <CardHeader>
            <CardTitle>API Key Configuration</CardTitle>
            <CardDescription>
              {apiKeyLoaded ? "API key loaded from your account" : "Enter your Leonardo AI API key"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Leonardo AI API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={async () => {
                  if (!ready || !userId) return
                  try {
                    const supabase = getSupabaseClient()
                    const { error } = await supabase
                      .from('users')
                      .update({ leonardo_api_key: apiKey })
                      .eq('id', userId)
                    
                    if (error) throw error
                    
                    setApiKeyLoaded(true)
                    toast({
                      title: "Success",
                      description: "API key saved to your account",
                    })
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to save API key",
                      variant: "destructive"
                    })
                  }
                }}
                disabled={!apiKey.trim()}
              >
                Save to Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Features Tabs */}
        <Tabs defaultValue="image" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="image">
              <ImageIcon className="h-4 w-4 mr-2" />
              Image Gen
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="h-4 w-4 mr-2" />
              Video
            </TabsTrigger>
            <TabsTrigger value="texture">
              <Box className="h-4 w-4 mr-2" />
              Texture
            </TabsTrigger>
            <TabsTrigger value="variations">
              <Wand2 className="h-4 w-4 mr-2" />
              Variations
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Settings className="h-4 w-4 mr-2" />
              Tools
            </TabsTrigger>
          </TabsList>

          {/* Image Generation Tab */}
          <TabsContent value="image" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Text-to-Image Generation</CardTitle>
                <CardDescription>
                  Generate images from text prompts using Leonardo AI models
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Prompt</Label>
                  <Textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="A cinematic scene of a futuristic city at sunset..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Model</Label>
                    <Select value={imageModel} onValueChange={setImageModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ac614f96-1082-45bf-be9d-757f2d31c174">Leonardo Creative</SelectItem>
                        <SelectItem value="6bef9f1b-29cb-40c7-b9df-32b51c1ed67c">Leonardo Kino XL</SelectItem>
                        <SelectItem value="291be633-cb24-434f-898f-e662799936ad">Leonardo Vision XL</SelectItem>
                        <SelectItem value="e316348f-7773-490e-adcd-46757c738eb7">Leonardo Anime XL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Number of Images</Label>
                    <Select value={numImages.toString()} onValueChange={(v) => setNumImages(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Width</Label>
                    <Select value={imageWidth.toString()} onValueChange={(v) => setImageWidth(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512</SelectItem>
                        <SelectItem value="768">768</SelectItem>
                        <SelectItem value="1024">1024</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Height</Label>
                    <Select value={imageHeight.toString()} onValueChange={(v) => setImageHeight(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512</SelectItem>
                        <SelectItem value="768">768</SelectItem>
                        <SelectItem value="1024">1024</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Negative Prompt</Label>
                  <Input
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Things to avoid in the image..."
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="promptMagic"
                      checked={promptMagic}
                      onChange={(e) => setPromptMagic(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="promptMagic">Prompt Magic</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="highContrast"
                      checked={highContrast}
                      onChange={(e) => setHighContrast(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="highContrast">High Contrast</Label>
                  </div>
                </div>

                <Button
                  onClick={generateImage}
                  disabled={loading || !apiKey || !imagePrompt.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Image
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Video Generation Tab */}
          <TabsContent value="video" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Motion - Image to Video</CardTitle>
                <CardDescription>
                  Animate static images into short videos. Supports single image or frame-to-frame (start + end frames).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Video Type</Label>
                  <Select value={videoType} onValueChange={(v: 'single' | 'frame-to-frame') => {
                    setVideoType(v)
                    // Clear files when switching modes
                    if (v === 'single') {
                      setStartFrameFile(null)
                      setStartFramePreview(null)
                      setEndFrameFile(null)
                      setEndFramePreview(null)
                    } else {
                      setVideoImageFile(null)
                      setVideoImagePreview(null)
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single Image to Video</SelectItem>
                      <SelectItem value="frame-to-frame">Frame-to-Frame (Start + End)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Video Generation Method</Label>
                  <Select value={videoModel} onValueChange={(value) => {
                    setVideoModel(value)
                    // Clear files when switching to text-to-video
                    if (value === 'text-to-video') {
                      setVideoImageFile(null)
                      setVideoImagePreview(null)
                      setStartFrameFile(null)
                      setStartFramePreview(null)
                      setEndFrameFile(null)
                      setEndFramePreview(null)
                    }
                    // Clear motion control when switching away from motion-svd
                    if (value !== 'motion-svd') {
                      setMotionControl("")
                      setMotionElements([])
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motion-svd">Motion 2.0 (Recommended - with Motion Control)</SelectItem>
                      <SelectItem value="image-to-video">Image to Video (I2V)</SelectItem>
                      <SelectItem value="text-to-video">Text to Video (T2V)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Motion 2.0 supports advanced motion control options for cinematic effects
                  </p>
                </div>

                {/* Motion Control for Motion 2.0 */}
                {videoModel === 'motion-svd' && (
                  <div>
                    <Label>Motion Control (Optional)</Label>
                    <Select value={motionControl || "none"} onValueChange={(value) => setMotionControl(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select motion control (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="BULLET_TIME">Bullet Time</SelectItem>
                        <SelectItem value="CRANE_DOWN">Crane Down</SelectItem>
                        <SelectItem value="CRANE_OVER_HEAD">Crane Over Head</SelectItem>
                        <SelectItem value="CRANE_UP">Crane Up</SelectItem>
                        <SelectItem value="CRASH_ZOOM_IN">Crash Zoom In</SelectItem>
                        <SelectItem value="CRASH_ZOOM_OUT">Crash Zoom Out</SelectItem>
                        <SelectItem value="DISINTEGRATION">Disintegration</SelectItem>
                        <SelectItem value="DOLLY_IN">Dolly In</SelectItem>
                        <SelectItem value="DOLLY_LEFT">Dolly Left</SelectItem>
                        <SelectItem value="DOLLY_OUT">Dolly Out</SelectItem>
                        <SelectItem value="DOLLY_RIGHT">Dolly Right</SelectItem>
                        <SelectItem value="DUTCH_ANGLE">Dutch Angle</SelectItem>
                        <SelectItem value="EXPLOSION">Explosion</SelectItem>
                        <SelectItem value="EYES_IN">Eyes In</SelectItem>
                        <SelectItem value="EYES_OUT">Eyes Out</SelectItem>
                        <SelectItem value="FADE_IN">Fade In</SelectItem>
                        <SelectItem value="FADE_OUT">Fade Out</SelectItem>
                        <SelectItem value="PAN_DOWN">Pan Down</SelectItem>
                        <SelectItem value="PAN_LEFT">Pan Left</SelectItem>
                        <SelectItem value="PAN_RIGHT">Pan Right</SelectItem>
                        <SelectItem value="PAN_UP">Pan Up</SelectItem>
                        <SelectItem value="PUSH_IN">Push In</SelectItem>
                        <SelectItem value="PUSH_OUT">Push Out</SelectItem>
                        <SelectItem value="ROLL">Roll</SelectItem>
                        <SelectItem value="ROTATE_CLOCKWISE">Rotate Clockwise</SelectItem>
                        <SelectItem value="ROTATE_COUNTER_CLOCKWISE">Rotate Counter Clockwise</SelectItem>
                        <SelectItem value="TILT_DOWN">Tilt Down</SelectItem>
                        <SelectItem value="TILT_UP">Tilt Up</SelectItem>
                        <SelectItem value="TRACK_IN">Track In</SelectItem>
                        <SelectItem value="TRACK_OUT">Track Out</SelectItem>
                        <SelectItem value="TRACK_LEFT">Track Left</SelectItem>
                        <SelectItem value="TRACK_RIGHT">Track Right</SelectItem>
                        <SelectItem value="ZOOM_IN">Zoom In</SelectItem>
                        <SelectItem value="ZOOM_OUT">Zoom Out</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select a cinematic motion control effect (optional). Motion 2.0 supports advanced camera movements.
                    </p>
                  </div>
                )}

                {/* Model Selection for Frame-to-Frame with Image-to-Video */}
                {videoModel === 'image-to-video' && videoType === 'frame-to-frame' && (
                  <div>
                    <Label>Model (Required for Frame-to-Frame)</Label>
                    <Select value={videoModelType} onValueChange={(v: 'KLING2_1' | 'VEO3_1' | 'VEO3_1FAST') => {
                      setVideoModelType(v)
                      // Set default duration based on model
                      if (v === 'VEO3_1' || v === 'VEO3_1FAST') {
                        setVideoDuration(8)
                      } else if (v === 'KLING2_1') {
                        setVideoDuration(5)
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VEO3_1">Veo 3.1 (4/6/8s, supports end frames)</SelectItem>
                        <SelectItem value="VEO3_1FAST">Veo 3.1 Fast (4/6/8s, supports end frames)</SelectItem>
                        <SelectItem value="KLING2_1">Kling 2.1 Pro (5s or 10s, supports end frames)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select one of the three models that support frame-to-frame generation with end frames.
                    </p>
                  </div>
                )}

                {/* Duration Selection for Frame-to-Frame */}
                {videoModel === 'image-to-video' && videoType === 'frame-to-frame' && (
                  <div>
                    <Label>Duration (seconds)</Label>
                    <Select 
                      value={videoDuration.toString()} 
                      onValueChange={(v) => setVideoDuration(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(videoModelType === 'VEO3_1' || videoModelType === 'VEO3_1FAST') ? (
                          <>
                            <SelectItem value="4">4 seconds</SelectItem>
                            <SelectItem value="6">6 seconds</SelectItem>
                            <SelectItem value="8">8 seconds</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="5">5 seconds</SelectItem>
                            <SelectItem value="10">10 seconds</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {videoModelType === 'VEO3_1' || videoModelType === 'VEO3_1FAST' 
                        ? 'Veo 3.1 supports 4, 6, or 8 seconds with end frames'
                        : 'Kling 2.1 Pro supports 5 or 10 seconds'}
                    </p>
                  </div>
                )}

                {videoModel === 'text-to-video' ? (
                  <div>
                    <Label>Video Prompt (Required)</Label>
                    <Textarea
                      value={textToVideoPrompt}
                      onChange={(e) => setTextToVideoPrompt(e.target.value)}
                      placeholder="Describe the video you want to generate... (e.g., 'A cinematic scene of a futuristic city at sunset with flying cars')"
                      rows={4}
                    />
                    <div className="mt-2">
                      <Label>Duration (seconds)</Label>
                      <Select value={textToVideoDuration.toString()} onValueChange={(v) => setTextToVideoDuration(parseInt(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 seconds</SelectItem>
                          <SelectItem value="10">10 seconds</SelectItem>
                          <SelectItem value="15">15 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <>

                {videoType === 'single' ? (
                  <div>
                    <Label>Upload Image</Label>
                    {videoImagePreview ? (
                      <div className="relative mt-2">
                        <img 
                          src={videoImagePreview} 
                          alt="Preview" 
                          className="w-full h-64 object-cover rounded-md"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setVideoImageFile(null)
                            setVideoImagePreview(null)
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 border-2 border-dashed border-border rounded-md p-8 text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageFileUpload(e, 'video')}
                          className="hidden"
                          id="video-image-upload"
                        />
                        <Label htmlFor="video-image-upload" className="cursor-pointer">
                          <Button variant="outline" asChild>
                            <span>Upload Image</span>
                          </Button>
                        </Label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Frame (Required)</Label>
                      {startFramePreview ? (
                        <div className="relative mt-2">
                          <img 
                            src={startFramePreview} 
                            alt="Start Frame" 
                            className="w-full h-48 object-cover rounded-md"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setStartFrameFile(null)
                              setStartFramePreview(null)
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 border-2 border-dashed border-border rounded-md p-6 text-center">
                          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageFileUpload(e, 'start')}
                            className="hidden"
                            id="start-frame-upload"
                          />
                          <Label htmlFor="start-frame-upload" className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                              <span>Upload Start</span>
                            </Button>
                          </Label>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>End Frame (Optional)</Label>
                      {endFramePreview ? (
                        <div className="relative mt-2">
                          <img 
                            src={endFramePreview} 
                            alt="End Frame" 
                            className="w-full h-48 object-cover rounded-md"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setEndFrameFile(null)
                              setEndFramePreview(null)
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 border-2 border-dashed border-border rounded-md p-6 text-center">
                          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageFileUpload(e, 'end')}
                            className="hidden"
                            id="end-frame-upload"
                          />
                          <Label htmlFor="end-frame-upload" className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                              <span>Upload End</span>
                            </Button>
                          </Label>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label>Video Prompt (Optional)</Label>
                  <Textarea
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Describe the motion or transition you want between the frames... (e.g., 'Smooth transition with camera pan', 'Character stands up and walks forward')"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional: Add a prompt to guide the motion and transition between frames
                  </p>
                </div>

                <div>
                  <Label>Motion Strength (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={videoMotionStrength}
                    onChange={(e) => setVideoMotionStrength(parseInt(e.target.value) || 2)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher values create more dramatic motion
                  </p>
                </div>

                  </>
                )}

                <Button
                  onClick={generateVideo}
                  disabled={loading || !apiKey || (
                    videoModel === 'text-to-video' 
                      ? !textToVideoPrompt.trim() 
                      : (videoType === 'single' 
                          ? !videoImageFile 
                          : !startFrameFile)
                  )}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3D Texture Tab */}
          <TabsContent value="texture" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>3D Texture Generation</CardTitle>
                <CardDescription>
                  Generate textures for 3D models (OBJ files)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Upload 3D Model (OBJ)</Label>
                  <div className="mt-2 border-2 border-dashed border-border rounded-md p-8 text-center">
                    <Box className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <Input
                      type="file"
                      accept=".obj"
                      onChange={handleModelFileUpload}
                      className="hidden"
                      id="model-upload"
                    />
                    <Label htmlFor="model-upload" className="cursor-pointer">
                      <Button variant="outline" asChild>
                        <span>Upload OBJ File</span>
                      </Button>
                    </Label>
                    {textureModelFile && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {textureModelFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Texture Prompt</Label>
                  <Textarea
                    value={texturePrompt}
                    onChange={(e) => setTexturePrompt(e.target.value)}
                    placeholder="Describe the texture you want to generate..."
                    rows={3}
                  />
                </div>

                <Button
                  onClick={generateTexture}
                  disabled={loading || !apiKey || !textureModelFile || !texturePrompt.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Texture...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Texture
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Variations Tab */}
          <TabsContent value="variations" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Image Variations & Enhancements</CardTitle>
                <CardDescription>
                  Upscale, remove background, unzoom, and create variations of images
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Variation Type</Label>
                  <Select value={variationType} onValueChange={(v: any) => setVariationType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upscale">
                        <div className="flex items-center gap-2">
                          <ZoomIn className="h-4 w-4" />
                          Upscale
                        </div>
                      </SelectItem>
                      <SelectItem value="universal-upscaler">
                        <div className="flex items-center gap-2">
                          <Maximize2 className="h-4 w-4" />
                          Universal Upscaler
                        </div>
                      </SelectItem>
                      <SelectItem value="nobg">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Remove Background
                        </div>
                      </SelectItem>
                      <SelectItem value="unzoom">
                        <div className="flex items-center gap-2">
                          <ZoomOut className="h-4 w-4" />
                          Unzoom
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Image ID (from previous generation)</Label>
                  <Input
                    value={variationImageId}
                    onChange={(e) => setVariationImageId(e.target.value)}
                    placeholder="Enter image ID or upload image below"
                  />
                </div>

                <div>
                  <Label>Or Upload Image</Label>
                  {variationImagePreview ? (
                    <div className="relative mt-2">
                      <img 
                        src={variationImagePreview} 
                        alt="Preview" 
                        className="w-full h-48 object-cover rounded-md"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setVariationImageFile(null)
                          setVariationImagePreview(null)
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 border-2 border-dashed border-border rounded-md p-6 text-center">
                      <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setVariationImageFile(file)
                            const reader = new FileReader()
                            reader.onload = (e) => {
                              setVariationImagePreview(e.target?.result as string)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                        className="hidden"
                        id="variation-image-upload"
                      />
                      <Label htmlFor="variation-image-upload" className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild>
                          <span>Upload Image</span>
                        </Button>
                      </Label>
                    </div>
                  )}
                </div>

                <Button
                  onClick={generateVariation}
                  disabled={loading || !apiKey || (!variationImageId && !variationImageFile)}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate {variationType === 'upscale' ? 'Upscale' : 
                               variationType === 'universal-upscaler' ? 'Universal Upscale' :
                               variationType === 'nobg' ? 'Remove Background' : 'Unzoom'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Video Upscale Card */}
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Video Upscale</CardTitle>
                <CardDescription>
                  Upscale generated videos to higher resolution
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Video ID (from previous generation)</Label>
                  <Input
                    value={videoUpscaleVideoId}
                    onChange={(e) => setVideoUpscaleVideoId(e.target.value)}
                    placeholder="Enter video generation ID from history below"
                  />
                </div>

                <div>
                  <Label>Or Upload Video File</Label>
                  {videoUpscaleVideoPreview ? (
                    <div className="relative mt-2">
                      <video 
                        src={videoUpscaleVideoPreview} 
                        controls 
                        className="w-full h-48 rounded-md"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setVideoUpscaleVideoFile(null)
                          setVideoUpscaleVideoPreview(null)
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 border-2 border-dashed border-border rounded-md p-6 text-center">
                      <Video className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <Input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setVideoUpscaleVideoFile(file)
                            const reader = new FileReader()
                            reader.onload = (e) => {
                              setVideoUpscaleVideoPreview(e.target?.result as string)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                        className="hidden"
                        id="video-upscale-upload"
                      />
                      <Label htmlFor="video-upscale-upload" className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild>
                          <span>Upload Video</span>
                        </Button>
                      </Label>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Note: Video upscale typically requires a video generation ID from a previous Leonardo AI generation. Uploading a video file may require additional processing.
                </p>

                <Button
                  onClick={async () => {
                    if (!apiKey || !videoUpscaleVideoId) {
                      toast({
                        title: "Missing Information",
                        description: "Please enter a video generation ID.",
                        variant: "destructive"
                      })
                      return
                    }

                    setLoading(true)
                    try {
                      console.log('🎬 [VIDEO UPSCALE] Starting video upscale...')
                      console.log('🎬 [VIDEO UPSCALE] Video ID:', videoUpscaleVideoId)
                      
                      const endpoint = 'https://cloud.leonardo.ai/api/rest/v1/generations-video-upscale'
                      const requestBody = {
                        generationId: videoUpscaleVideoId,
                      }
                      
                      console.log('🎬 [VIDEO UPSCALE] Request endpoint:', endpoint)
                      console.log('🎬 [VIDEO UPSCALE] Request body:', JSON.stringify(requestBody, null, 2))
                      
                      const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(requestBody)
                      })
                      
                      console.log('🎬 [VIDEO UPSCALE] Response status:', response.status)
                      
                      if (!response.ok) {
                        const errorText = await response.text()
                        console.error('🎬 [VIDEO UPSCALE] Error response:', errorText)
                        let errorData
                        try {
                          errorData = JSON.parse(errorText)
                        } catch {
                          errorData = { error: errorText }
                        }
                        throw new Error(errorData.error || errorData.message || `API Error: ${response.status}`)
                      }
                      
                      const result = await response.json()
                      console.log('🎬 [VIDEO UPSCALE] Response data:', JSON.stringify(result, null, 2))
                      
                      const upscaleId = result.videoUpscaleGenerationJob?.id ||
                                      result.generationId ||
                                      result.id ||
                                      result.jobId
                      
                      console.log('🎬 [VIDEO UPSCALE] Upscale ID:', upscaleId)
                      
                      if (!upscaleId) {
                        throw new Error('No upscale ID returned')
                      }
                      
                      const newGeneration: Generation = {
                        id: upscaleId,
                        type: 'video-upscale',
                        prompt: `Video upscale for generation ${videoUpscaleVideoId}`,
                        status: 'processing',
                        createdAt: new Date().toISOString(),
                        originalVideoId: videoUpscaleVideoId
                      }
                      
                      setGenerations(prev => [newGeneration, ...prev])
                      pollGenerationStatus(upscaleId, 'video')
                      
                      toast({
                        title: "Video Upscale Started",
                        description: "Your video is being upscaled. This may take a few minutes.",
                      })
                    } catch (error) {
                      console.error('🎬 [VIDEO UPSCALE] Failed:', error)
                      toast({
                        title: "Upscale Failed",
                        description: error instanceof Error ? error.message : "Unknown error",
                        variant: "destructive",
                      })
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading || !apiKey || !videoUpscaleVideoId}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Upscaling...
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Upscale Video
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Prompt Tools</CardTitle>
                <CardDescription>
                  Improve prompts and generate random prompts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Improve Prompt</Label>
                  <Textarea
                    value={promptToImprove}
                    onChange={(e) => setPromptToImprove(e.target.value)}
                    placeholder="Enter a prompt to improve..."
                    rows={3}
                  />
                  <Button
                    onClick={improvePrompt}
                    disabled={loading || !apiKey || !promptToImprove.trim()}
                    className="w-full mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Improving...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Improve Prompt
                      </>
                    )}
                  </Button>
                  {improvedPrompt && (
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <Label className="text-sm font-medium mb-2 block">Improved Prompt:</Label>
                      <p className="text-sm">{improvedPrompt}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setImagePrompt(improvedPrompt)
                          toast({
                            title: "Prompt Copied",
                            description: "Improved prompt copied to Image Generation tab",
                          })
                        }}
                      >
                        Use in Image Generation
                      </Button>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Label>Random Prompt Generator</Label>
                  <Button
                    onClick={getRandomPrompt}
                    disabled={loading || !apiKey}
                    className="w-full mt-2"
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Random Prompt
                      </>
                    )}
                  </Button>
                  {randomPrompt && (
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <Label className="text-sm font-medium mb-2 block">Random Prompt:</Label>
                      <p className="text-sm">{randomPrompt}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setImagePrompt(randomPrompt)
                          toast({
                            title: "Prompt Copied",
                            description: "Random prompt copied to Image Generation tab",
                          })
                        }}
                      >
                        Use in Image Generation
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  View your Leonardo AI account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={getUserInfo}
                  disabled={loading || !apiKey}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Get User Info
                    </>
                  )}
                </Button>
                {userInfo && (
                  <div className="mt-4 p-4 bg-muted rounded-md">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(userInfo, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Generations History */}
        <Card className="cinema-card mt-6">
          <CardHeader>
            <CardTitle>Generation History</CardTitle>
            <CardDescription>
              View all your generations and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No generations yet. Start generating to see results here.
              </div>
            ) : (
              <div className="space-y-4">
                {generations.map((gen) => (
                  <Card key={gen.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(gen.status)}>
                            {gen.status}
                          </Badge>
                          <Badge variant="outline">
                            {gen.type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(gen.createdAt).toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="text-sm mb-3">{gen.prompt}</p>
                      
                      {gen.status === 'processing' && (
                        <div className="flex items-center gap-2 text-blue-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Processing...</span>
                        </div>
                      )}
                      
                      {gen.status === 'completed' && (
                        <div className="mt-3">
                          {gen.type === 'image' || gen.type === 'texture' ? (
                            gen.imageUrl && (
                              <div className="relative">
                                <img 
                                  src={gen.imageUrl} 
                                  alt="Generated" 
                                  className="w-full rounded-md"
                                />
                                <div className="absolute top-2 right-2 flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (!userId) {
                                        toast({
                                          title: "Error",
                                          description: "User ID not available. Please refresh the page.",
                                          variant: "destructive",
                                        })
                                        return
                                      }
                                      try {
                                        const urlParts = gen.imageUrl!.split('/')
                                        const filename = urlParts[urlParts.length - 1] || `image-${gen.id}.png`
                                        
                                        const response = await fetch('/api/ai/download-and-store-image', {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                          body: JSON.stringify({
                                            imageUrl: gen.imageUrl,
                                            fileName: filename.replace(/\.(png|jpg|jpeg|webp|gif)$/i, ''),
                                            userId: userId,
                                          }),
                                        })

                                        const result = await response.json()

                                        if (!response.ok || !result.success) {
                                          throw new Error(result.error || 'Failed to save image')
                                        }

                                        toast({
                                          title: "Image Saved!",
                                          description: "Image has been saved to your bucket.",
                                        })
                                      } catch (error) {
                                        console.error('Error saving image to bucket:', error)
                                        toast({
                                          title: "Save Failed",
                                          description: error instanceof Error ? error.message : "Failed to save image to bucket. Please try again.",
                                          variant: "destructive",
                                        })
                                      }
                                    }}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(gen.imageUrl!)
                                        const blob = await response.blob()
                                        const url = window.URL.createObjectURL(blob)
                                        const a = document.createElement('a')
                                        a.href = url
                                        // Extract filename from URL or use a default
                                        const urlParts = gen.imageUrl!.split('/')
                                        const filename = urlParts[urlParts.length - 1] || `image-${gen.id}.${blob.type.split('/')[1] || 'png'}`
                                        a.download = filename
                                        document.body.appendChild(a)
                                        a.click()
                                        window.URL.revokeObjectURL(url)
                                        document.body.removeChild(a)
                                        toast({
                                          title: "Download Started",
                                          description: "Image download has started.",
                                        })
                                      } catch (error) {
                                        console.error('Error downloading image:', error)
                                        toast({
                                          title: "Download Failed",
                                          description: "Failed to download image. Please try again.",
                                          variant: "destructive",
                                        })
                                      }
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )
                          ) : (gen.type === 'video' || gen.type === 'image-to-video' || gen.type === 'text-to-video' || gen.type === 'motion-svd' || gen.type === 'video-upscale') && gen.videoUrl ? (
                            <div className="relative">
                              <video 
                                src={gen.videoUrl} 
                                controls 
                                className="w-full rounded-md"
                              />
                              <div className="absolute top-2 right-2 flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    if (!userId) {
                                      toast({
                                        title: "Error",
                                        description: "User ID not available. Please refresh the page.",
                                        variant: "destructive",
                                      })
                                      return
                                    }
                                    try {
                                      const urlParts = gen.videoUrl!.split('/')
                                      const filename = urlParts[urlParts.length - 1] || `video-${gen.id}.mp4`
                                      
                                      const response = await fetch('/api/ai/download-and-store-video', {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                          videoUrl: gen.videoUrl,
                                          fileName: filename.replace(/\.(mp4|webm|mov|avi)$/i, ''),
                                          userId: userId,
                                        }),
                                      })

                                      const result = await response.json()

                                      if (!response.ok || !result.success) {
                                        throw new Error(result.error || 'Failed to save video')
                                      }

                                      toast({
                                        title: "Video Saved!",
                                        description: "Video has been saved to your bucket.",
                                      })
                                    } catch (error) {
                                      console.error('Error saving video to bucket:', error)
                                      toast({
                                        title: "Save Failed",
                                        description: error instanceof Error ? error.message : "Failed to save video to bucket. Please try again.",
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(gen.videoUrl!)
                                      const blob = await response.blob()
                                      const url = window.URL.createObjectURL(blob)
                                      const a = document.createElement('a')
                                      a.href = url
                                      // Extract filename from URL or use a default
                                      const urlParts = gen.videoUrl!.split('/')
                                      const filename = urlParts[urlParts.length - 1] || `video-${gen.id}.mp4`
                                      a.download = filename
                                      document.body.appendChild(a)
                                      a.click()
                                      window.URL.revokeObjectURL(url)
                                      document.body.removeChild(a)
                                      toast({
                                        title: "Download Started",
                                        description: "Video download has started.",
                                      })
                                    } catch (error) {
                                      console.error('Error downloading video:', error)
                                      toast({
                                        title: "Download Failed",
                                        description: "Failed to download video. Please try again.",
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                      
                      {gen.status === 'failed' && (
                        <div className="flex items-center gap-2 text-red-400 mt-2">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">Generation failed</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

