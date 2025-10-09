"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"
import { 
  Video, 
  Play, 
  Download, 
  Upload, 
  Settings, 
  TestTube, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Image as ImageIcon,
  FileVideo,
  Loader2,
  RefreshCw
} from "lucide-react"

interface KlingGeneration {
  id: string
  prompt: string
  type: 'text_to_video' | 'image_to_video' | 'frame_to_frame'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  video_url?: string
  thumbnail_url?: string
  created_at: string
  duration?: number
  model?: string
}

interface KlingUser {
  id: string
  email: string
  credits: number
  subscription: string
}

export default function TempKlingPage() {
  // Add custom styles for active tab
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .kling-tab-trigger[data-state="active"] {
        background-color: #10b981 !important;
        color: white !important;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  
  // API Key state
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [apiKeyValid, setApiKeyValid] = useState(false)
  const [userInfo, setUserInfo] = useState<KlingUser | null>(null)
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.klingai.com')
  
  // Generation states
  const [generations, setGenerations] = useState<KlingGeneration[]>([])
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  
  // Text to Video state
  const [textPrompt, setTextPrompt] = useState('')
  const [textDuration, setTextDuration] = useState('10')
  const [textModel, setTextModel] = useState('kling-v1')
  
  // Image to Video state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageDuration, setImageDuration] = useState('10')
  const [imageModel, setImageModel] = useState('kling-v1')
  
  // Frame to Frame state
  const [frameFile, setFrameFile] = useState<File | null>(null)
  const [framePreview, setFramePreview] = useState<string | null>(null)
  const [framePrompt, setFramePrompt] = useState('')
  const [frameDuration, setFrameDuration] = useState('10')
  const [frameModel, setFrameModel] = useState('kling-v1')
  
  // Load API key from database
  useEffect(() => {
    if (ready && userId) {
      loadApiKey()
    }
  }, [ready, userId])
  
  const loadApiKey = async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('kling_api_key, kling_secret_key')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      
      if (data?.kling_api_key) {
        setApiKey(data.kling_api_key)
      }
      if (data?.kling_secret_key) {
        setSecretKey(data.kling_secret_key)
      }
      
      // Try to validate with the available key(s)
      const keyToValidate = data?.kling_secret_key || data?.kling_api_key
      if (keyToValidate) {
        await validateApiKey(keyToValidate)
      }
    } catch (error) {
      console.error('Error loading Kling API keys:', error)
    }
  }
  
  const validateApiKey = async (key: string) => {
    try {
      console.log('🔑 Validating Kling API key...', { keyLength: key.length, keyPrefix: key.substring(0, 10) })
      
      const response = await fetch('https://api.klingai.com/v1/user', {
        headers: { 'Authorization': `Bearer ${key}` },
      })
      
      console.log('🔑 Kling API validation response:', { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok 
      })
      
      if (response.ok) {
        const userData = await response.json()
        console.log('🔑 Kling user data:', userData)
        setUserInfo(userData)
        setApiKeyValid(true)
        toast({
          title: "API Key Valid",
          description: `Connected to Kling as ${userData.email || 'User'}`,
        })
      } else {
        const errorText = await response.text()
        console.log('🔑 Kling API validation error:', errorText)
        setApiKeyValid(false)
        setUserInfo(null)
        toast({
          title: "Invalid API Key",
          description: `API Error: ${response.status} - ${errorText}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('🔑 Kling API validation error:', error)
      setApiKeyValid(false)
      setUserInfo(null)
      toast({
        title: "Connection Error",
        description: `Failed to validate API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }
  
  const saveApiKey = async () => {
    if (!userId) return
    
    try {
      const updateData: any = {}
      if (apiKey) updateData.kling_api_key = apiKey
      if (secretKey) updateData.kling_secret_key = secretKey
      
      const { error } = await getSupabaseClient()
        .from('users')
        .update(updateData)
        .eq('id', userId)
      
      if (error) throw error
      
      // Try to validate with the secret key first, then access key
      const keyToValidate = secretKey || apiKey
      if (keyToValidate) {
        await validateApiKey(keyToValidate)
      }
      
      toast({
        title: "API Keys Saved",
        description: "Kling API keys saved successfully",
      })
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save API keys",
        variant: "destructive",
      })
    }
  }
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }
  
  const handleFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFrameFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setFramePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }
  
  const generateTextToVideo = async () => {
    if (!apiKey || !textPrompt.trim()) {
      console.log('❌ Cannot generate video:', { hasApiKey: !!apiKey, hasPrompt: !!textPrompt.trim() })
      return
    }
    
    console.log('🎬 Starting text-to-video generation...', {
      prompt: textPrompt,
      duration: textDuration,
      model: textModel,
      apiKeyLength: apiKey.length
    })
    
    setLoading(true)
    try {
      const requestBody = {
        prompt: textPrompt,
        duration: parseInt(textDuration),
        model: textModel,
        type: 'text_to_video'
      }
      
      console.log('🎬 Making request to server-side API...', requestBody)
      
      const response = await fetch(`/api/ai/generate-kling-video?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      
      console.log('🎬 Server response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error('🎬 Server API Error:', error)
        throw new Error(`Server API Error (${response.status}): ${error.error || 'Unknown error'}`)
      }
      
      const result = await response.json()
      console.log('🎬 Generation result:', result)
      
      const newGeneration: KlingGeneration = {
        id: result.data?.id || Date.now().toString(),
        prompt: textPrompt,
        type: 'text_to_video',
        status: 'processing',
        created_at: new Date().toISOString(),
        duration: parseInt(textDuration),
        model: textModel,
      }
      
      setGenerations(prev => [newGeneration, ...prev])
      
      // Poll for completion
      pollGenerationStatus(result.data?.id || newGeneration.id)
      
      toast({
        title: "Video Generation Started",
        description: `Using endpoint: ${result.endpoint}. Your video is being generated.`,
      })
      
    } catch (error) {
      console.error('🎬 Generation error:', error)
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }
  
  const generateImageToVideo = async () => {
    if (!apiKey || !imageFile || !imagePrompt.trim()) return
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('prompt', imagePrompt)
      formData.append('duration', imageDuration)
      formData.append('model', imageModel)
      
      const response = await fetch('https://api.klingai.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API Error: ${error}`)
      }
      
      const result = await response.json()
      
      const newGeneration: KlingGeneration = {
        id: result.id || Date.now().toString(),
        prompt: imagePrompt,
        type: 'image_to_video',
        status: 'processing',
        created_at: new Date().toISOString(),
        duration: parseInt(imageDuration),
        model: imageModel,
      }
      
      setGenerations(prev => [newGeneration, ...prev])
      
      // Poll for completion
      pollGenerationStatus(result.id || newGeneration.id)
      
      toast({
        title: "Video Generation Started",
        description: "Your image-to-video is being generated. This may take a few minutes.",
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
  
  const generateFrameToFrame = async () => {
    if (!apiKey || !frameFile || !framePrompt.trim()) return
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', frameFile)
      formData.append('prompt', framePrompt)
      formData.append('duration', frameDuration)
      formData.append('model', frameModel)
      
      const response = await fetch('https://api.klingai.com/v1/frame_to_frame', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API Error: ${error}`)
      }
      
      const result = await response.json()
      
      const newGeneration: KlingGeneration = {
        id: result.id || Date.now().toString(),
        prompt: framePrompt,
        type: 'frame_to_frame',
        status: 'processing',
        created_at: new Date().toISOString(),
        duration: parseInt(frameDuration),
        model: frameModel,
      }
      
      setGenerations(prev => [newGeneration, ...prev])
      
      // Poll for completion
      pollGenerationStatus(result.id || newGeneration.id)
      
      toast({
        title: "Frame-to-Frame Generation Started",
        description: "Your frame-to-frame video is being generated. This may take a few minutes.",
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
  
  const pollGenerationStatus = async (generationId: string) => {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0
    
    const poll = async () => {
      try {
        const response = await fetch(`https://api.klingai.com/v1/generations/${generationId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        })
        
        if (response.ok) {
          const result = await response.json()
          
          setGenerations(prev => prev.map(gen => 
            gen.id === generationId 
              ? {
                  ...gen,
                  status: result.status === 'completed' ? 'completed' : 
                         result.status === 'failed' ? 'failed' : 'processing',
                  video_url: result.video_url,
                  thumbnail_url: result.thumbnail_url,
                }
              : gen
          ))
          
          if (result.status === 'completed' || result.status === 'failed') {
            return
          }
        }
        
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000) // Poll every 5 seconds
        }
      } catch (error) {
        console.error('Error polling generation status:', error)
      }
    }
    
    setTimeout(poll, 5000) // Start polling after 5 seconds
  }
  
  const downloadVideo = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  const testApiConnection = async () => {
    if (!apiKey) {
      console.log('❌ No API key provided for test')
      return
    }
    
    console.log('🧪 Testing Kling API connection via server...', { apiKeyLength: apiKey.length })
    setTesting(true)
    
    try {
      console.log('🧪 Testing server-side Kling API route...')
      const response = await fetch('/api/ai/generate-kling-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: "test video generation",
          duration: 3,
          model: "kling-v1",
          type: 'text_to_video'
        }),
      })
      
      console.log('🧪 Server response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('🧪 Server test result:', result)
        toast({
          title: "API Test Successful",
          description: `Kling API is working via server. Endpoint: ${result.endpoint}`,
        })
      } else {
        const error = await response.json()
        console.error('🧪 Server test error:', error)
        toast({
          title: "API Test Failed",
          description: `Error (${response.status}): ${error.error || 'Unknown error'}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('🧪 API test error:', error)
      toast({
        title: "API Test Failed",
        description: error instanceof Error ? error.message : "Connection error",
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }
  
  if (!ready) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        </main>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto max-w-6xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TestTube className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                Kling API Testing
              </h1>
              <p className="text-muted-foreground">
                Test all Kling video generation features including frame-to-frame
              </p>
            </div>
          </div>
          
          {userInfo && (
            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Connected as <strong>{userInfo.email}</strong> • 
                Credits: <strong>{userInfo.credits}</strong> • 
                Plan: <strong>{userInfo.subscription}</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        {/* API Key Setup */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              API Key Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter your Kling Access Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    type={showSecretKey ? "text" : "password"}
                    placeholder="Enter your Kling Secret Key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                  >
                    {showSecretKey ? "Hide" : "Show"}
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={saveApiKey}
                    disabled={!apiKey.trim() && !secretKey.trim()}
                    className="flex-1"
                  >
                    Save Keys
                  </Button>
                  <Button
                    variant="outline"
                    onClick={testApiConnection}
                    disabled={(!apiKey && !secretKey) || testing}
                  >
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test API"}
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Label htmlFor="api-base-url" className="flex items-center">API Base URL:</Label>
                <Input
                  id="api-base-url"
                  type="text"
                  placeholder="https://api.klingai.com"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            
            {apiKeyValid && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">API Key is valid and ready to use</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Generation Tabs */}
        <Tabs defaultValue="text-to-video" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger 
              value="text-to-video"
              className="kling-tab-trigger"
            >
              Text to Video
            </TabsTrigger>
            <TabsTrigger 
              value="image-to-video"
              className="kling-tab-trigger"
            >
              Image to Video
            </TabsTrigger>
            <TabsTrigger 
              value="frame-to-frame"
              className="kling-tab-trigger"
            >
              Frame to Frame
            </TabsTrigger>
          </TabsList>
          
          {/* Text to Video */}
          <TabsContent value="text-to-video" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Text to Video Generation
                </CardTitle>
                <CardDescription>
                  Generate videos from text prompts using Kling AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="text-prompt">Video Prompt</Label>
                  <Textarea
                    id="text-prompt"
                    placeholder="Describe the video you want to generate..."
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="text-duration">Duration (seconds)</Label>
                    <Select value={textDuration} onValueChange={setTextDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 seconds</SelectItem>
                        <SelectItem value="5">5 seconds</SelectItem>
                        <SelectItem value="10">10 seconds</SelectItem>
                        <SelectItem value="15">15 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="text-model">Model</Label>
                    <Select value={textModel} onValueChange={setTextModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kling-v1">Kling V1</SelectItem>
                        <SelectItem value="kling-v2">Kling V2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button
                  onClick={generateTextToVideo}
                  disabled={!apiKey || !textPrompt.trim() || loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Generate Video
                </Button>
                
                {/* Debug info */}
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                  <div>Debug: API Key: {apiKey ? `Present (${apiKey.length} chars)` : 'Missing'}</div>
                  <div>Prompt: {textPrompt ? `Present (${textPrompt.length} chars)` : 'Missing'}</div>
                  <div>Loading: {loading ? 'Yes' : 'No'} | API Valid: {apiKeyValid ? 'Yes' : 'No'}</div>
                  <div>Duration: {textDuration}s | Model: {textModel}</div>
                  <div>Button Disabled: {(!apiKey || !textPrompt.trim() || loading) ? 'Yes' : 'No'}</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Image to Video */}
          <TabsContent value="image-to-video" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Image to Video Generation
                </CardTitle>
                <CardDescription>
                  Generate videos from uploaded images using Kling AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-upload">Upload Image</Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="image-prompt">Video Prompt</Label>
                  <Textarea
                    id="image-prompt"
                    placeholder="Describe how the image should move and transform..."
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="image-duration">Duration (seconds)</Label>
                    <Select value={imageDuration} onValueChange={setImageDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 seconds</SelectItem>
                        <SelectItem value="5">5 seconds</SelectItem>
                        <SelectItem value="10">10 seconds</SelectItem>
                        <SelectItem value="15">15 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="image-model">Model</Label>
                    <Select value={imageModel} onValueChange={setImageModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kling-v1">Kling V1</SelectItem>
                        <SelectItem value="kling-v2">Kling V2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button
                  onClick={generateImageToVideo}
                  disabled={!apiKeyValid || !imageFile || !imagePrompt.trim() || loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Generate Video from Image
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Frame to Frame */}
          <TabsContent value="frame-to-frame" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileVideo className="h-5 w-5" />
                  Frame to Frame Video Generation
                </CardTitle>
                <CardDescription>
                  Generate videos that start and end with specific frames using Kling AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="frame-upload">Upload Starting Frame</Label>
                  <Input
                    id="frame-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFrameUpload}
                  />
                  {framePreview && (
                    <div className="mt-2">
                      <img
                        src={framePreview}
                        alt="Frame Preview"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="frame-prompt">Video Prompt</Label>
                  <Textarea
                    id="frame-prompt"
                    placeholder="Describe how the video should start from this frame and end with another frame..."
                    value={framePrompt}
                    onChange={(e) => setFramePrompt(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="frame-duration">Duration (seconds)</Label>
                    <Select value={frameDuration} onValueChange={setFrameDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 seconds</SelectItem>
                        <SelectItem value="5">5 seconds</SelectItem>
                        <SelectItem value="10">10 seconds</SelectItem>
                        <SelectItem value="15">15 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="frame-model">Model</Label>
                    <Select value={frameModel} onValueChange={setFrameModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kling-v1">Kling V1</SelectItem>
                        <SelectItem value="kling-v2">Kling V2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button
                  onClick={generateFrameToFrame}
                  disabled={!apiKeyValid || !frameFile || !framePrompt.trim() || loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Generate Frame-to-Frame Video
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Generated Videos */}
        {generations.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Generated Videos
              </CardTitle>
              <CardDescription>
                Your video generations will appear here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {generations.map((generation) => (
                  <div key={generation.id} className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{generation.type.replace('_', ' ').toUpperCase()}</Badge>
                        <Badge 
                          variant={generation.status === 'completed' ? 'default' : 
                                  generation.status === 'failed' ? 'destructive' : 'secondary'}
                        >
                          {generation.status}
                        </Badge>
                        {generation.duration && (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {generation.duration}s
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(generation.created_at).toLocaleString()}
                      </div>
                    </div>
                    
                    <p className="text-sm mb-3">{generation.prompt}</p>
                    
                    {generation.status === 'completed' && generation.video_url && (
                      <div className="space-y-2">
                        <video
                          src={generation.video_url}
                          controls
                          className="w-full max-w-md rounded-lg"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => downloadVideo(generation.video_url!, `kling-video-${generation.id}.mp4`)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(generation.video_url, '_blank')}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Open in New Tab
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {generation.status === 'processing' && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Generating video... This may take a few minutes.</span>
                      </div>
                    )}
                    
                    {generation.status === 'failed' && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Video generation failed. Please try again.</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
