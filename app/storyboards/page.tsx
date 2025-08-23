"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context-fixed"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Filter, Image as ImageIcon, FileText, Sparkles, Edit, Trash2, Eye, Download, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StoryboardsService, Storyboard, CreateStoryboardData } from "@/lib/storyboards-service"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import Link from "next/link"



export default function StoryboardsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [isLoadingStoryboards, setIsLoadingStoryboards] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingStoryboard, setEditingStoryboard] = useState<Storyboard | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateStoryboardData>({
    title: "",
    description: "",
    scene_number: 1,
    shot_type: "wide",
    camera_angle: "eye-level",
    movement: "static",
    dialogue: "",
    action: "",
    visual_notes: "",
    image_url: "",
    project_id: ""
  })

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingText, setIsGeneratingText] = useState(false)
  const [selectedAIService, setSelectedAIService] = useState("dalle")
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)

  useEffect(() => {
    if (user) {
      fetchStoryboards()
    }
  }, [user])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!user) return
      
      try {
        const settings = await AISettingsService.getUserSettings(user.id)
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'images'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'videos'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'audio')
        ])
        
        // Merge existing settings with default ones, preferring existing
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
        
        // Auto-select locked model for images tab if available
        const imagesSetting = mergedSettings.find(setting => setting.tab_type === 'images')
        if (imagesSetting?.is_locked) {
          console.log('Setting locked model for images:', imagesSetting.locked_model)
          setSelectedAIService(imagesSetting.locked_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [user])

  const fetchStoryboards = async () => {
    try {
      const data = await StoryboardsService.getStoryboards()
      setStoryboards(data)
    } catch (error) {
      console.error("Error fetching storyboards:", error)
      toast({
        title: "Error",
        description: "Failed to fetch storyboards",
        variant: "destructive"
      })
    } finally {
      setIsLoadingStoryboards(false)
    }
  }

  const handleCreateStoryboard = async () => {
    if (!formData.title || !formData.description) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreating(true)

      // If there's a generated image, upload it to Supabase storage first
      let finalImageUrl = formData.image_url
      if (formData.image_url && formData.image_url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
        try {
          console.log('Uploading generated image to Supabase storage...')
          const fileName = `storyboard-${Date.now()}`
          finalImageUrl = await uploadGeneratedImageToStorage(formData.image_url, fileName)
          console.log('Image uploaded to Supabase, new URL:', finalImageUrl)
        } catch (uploadError) {
          console.error('Failed to upload image to Supabase:', uploadError)
          toast({
            title: "Image Upload Warning",
            description: "Failed to upload image to storage, but saving with original URL.",
            variant: "destructive",
          })
          // Continue with original URL if upload fails
        }
      }

      const newStoryboard = await StoryboardsService.createStoryboard({
        ...formData,
        image_url: finalImageUrl
      })
      setStoryboards(prev => [newStoryboard, ...prev])
      setShowCreateForm(false)
      resetForm()
      
      toast({
        title: "Success",
        description: "Storyboard created successfully"
      })
    } catch (error) {
      console.error("Error creating storyboard:", error)
      toast({
        title: "Error",
        description: "Failed to create storyboard",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditStoryboard = (storyboard: Storyboard) => {
    setEditingStoryboard(storyboard)
    setFormData({
      title: storyboard.title,
      description: storyboard.description,
      scene_number: storyboard.scene_number,
      shot_type: storyboard.shot_type,
      camera_angle: storyboard.camera_angle,
      movement: storyboard.movement,
      dialogue: storyboard.dialogue || "",
      action: storyboard.action || "",
      visual_notes: storyboard.visual_notes || "",
      image_url: storyboard.image_url || "",
      project_id: storyboard.project_id || ""
    })
    setShowEditForm(true)
  }

  const handleUpdateStoryboard = async () => {
    if (!editingStoryboard || !formData.title || !formData.description) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsUpdating(true)

      // If there's a generated image, upload it to Supabase storage first
      let finalImageUrl = formData.image_url
      if (formData.image_url && formData.image_url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
        try {
          console.log('Uploading generated image to Supabase storage...')
          const fileName = `storyboard-${Date.now()}`
          finalImageUrl = await uploadGeneratedImageToStorage(formData.image_url, fileName)
          console.log('Image uploaded to Supabase, new URL:', finalImageUrl)
        } catch (uploadError) {
          console.error('Failed to upload image to Supabase:', uploadError)
          toast({
            title: "Image Upload Warning",
            description: "Failed to upload image to storage, but saving with original URL.",
            variant: "destructive",
          })
          // Continue with original URL if upload fails
        }
      }

      const updatedStoryboard = await StoryboardsService.updateStoryboard(editingStoryboard.id, {
        ...formData,
        image_url: finalImageUrl
      })
      
      setStoryboards(prev => prev.map(sb => 
        sb.id === editingStoryboard.id ? updatedStoryboard : sb
      ))
      
      setShowEditForm(false)
      setEditingStoryboard(null)
      resetForm()
      
      toast({
        title: "Success",
        description: "Storyboard updated successfully"
      })
    } catch (error) {
      console.error("Error updating storyboard:", error)
      toast({
        title: "Error",
        description: "Failed to update storyboard",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteStoryboard = async (id: string) => {
    try {
      await StoryboardsService.deleteStoryboard(id)
      
      setStoryboards(prev => prev.filter(sb => sb.id !== id))
      toast({
        title: "Success",
        description: "Storyboard deleted successfully"
      })
    } catch (error) {
      console.error("Error deleting storyboard:", error)
      toast({
        title: "Error",
        description: "Failed to delete storyboard",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      scene_number: 1,
      shot_type: "wide",
      camera_angle: "eye-level",
      movement: "static",
      dialogue: "",
      action: "",
      visual_notes: "",
      image_url: "",
      project_id: ""
    })
    setAiPrompt("")
    setSelectedAIService("dalle")
    setEditingStoryboard(null)
  }

  // Get current images tab AI setting
  const getImagesTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === 'images')
  }

  // Check if images tab has a locked model
  const isImagesTabLocked = () => {
    const setting = getImagesTabSetting()
    return setting?.is_locked || false
  }

  // Get the locked model for images tab
  const getImagesTabLockedModel = () => {
    const setting = getImagesTabSetting()
    return setting?.locked_model || ""
  }

  // AI Integration Functions
  const generateAIText = async (field: keyof CreateStoryboardData) => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for AI generation",
        variant: "destructive"
      })
      return
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to use AI services",
        variant: "destructive"
      })
      return
    }

    // Use locked model if available, otherwise use selected service
    const lockedModel = getImagesTabLockedModel()
    const serviceToUse = (isImagesTabLocked() && lockedModel) ? lockedModel : selectedAIService
    
    if (!serviceToUse) {
      toast({
        title: "Error",
        description: "No AI service selected. Please choose an AI service or configure your settings.",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingText(true)
    try {
      let generatedText = ""
      
      console.log(`Generating storyboard text using ${serviceToUse} (${isImagesTabLocked() ? 'locked model' : 'user selected'})`)
      
      // Use the service to use
      switch (serviceToUse) {
        case "dalle":
          if (!user.openaiApiKey) {
            throw new Error("OpenAI API key not configured")
          }
          // Use OpenAI for text generation
          const openaiResponse = await fetch('/api/ai/generate-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              field: field,
              service: 'openai',
              apiKey: user.openaiApiKey
            })
          })
          if (!openaiResponse.ok) throw new Error('OpenAI API request failed')
          const openaiData = await openaiResponse.json()
          generatedText = openaiData.text
          break
          
        case "claude":
          if (!user.anthropicApiKey) {
            throw new Error("Anthropic API key not configured")
          }
          // Use Claude for text generation
          const claudeResponse = await fetch('/api/ai/generate-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              field: field,
              service: 'anthropic',
              apiKey: user.anthropicApiKey
            })
          })
          if (!claudeResponse.ok) throw new Error('Claude API request failed')
          const claudeData = await claudeResponse.json()
          generatedText = claudeData.text
          break
          
        default:
          // Fallback to OpenAI
          if (!user.openaiApiKey) {
            throw new Error("OpenAI API key not configured")
          }
          const fallbackResponse = await fetch('/api/ai/generate-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              field: field,
              service: 'openai',
              apiKey: user.openaiApiKey
            })
          })
          if (!fallbackResponse.ok) throw new Error('OpenAI API request failed')
          const fallbackData = await fallbackResponse.json()
          generatedText = fallbackData.text
      }
      
      setFormData(prev => ({
        ...prev,
        [field]: generatedText
      }))
      
      toast({
        title: "AI Generation Complete",
        description: `${field} generated successfully using ${selectedAIService.toUpperCase()}`
      })
    } catch (error) {
      console.error("Error generating AI text:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate AI text",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingText(false)
    }
  }

  // Upload generated image to Supabase storage
  const uploadGeneratedImageToStorage = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      console.log('Uploading generated image to Supabase storage...')
      
      // Use our API route to download and upload (bypasses CORS)
      const response = await fetch('/api/ai/download-and-store-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          fileName: fileName,
          userId: user!.id
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API error: ${errorData.error || response.statusText}`)
      }
      
      const result = await response.json()
      console.log('Image upload API response:', result)
      
      if (result.success && result.supabaseUrl) {
        console.log('Image uploaded successfully to Supabase:', result.supabaseUrl)
        return result.supabaseUrl
      } else {
        throw new Error('API did not return a valid Supabase URL')
      }
      
    } catch (error) {
      console.error('Error uploading image to Supabase:', error)
      throw error
    }
  }

  const generateAIImage = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for image generation",
        variant: "destructive"
      })
      return
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to use AI services",
        variant: "destructive"
      })
      return
    }

    // Use locked model if available, otherwise use selected service
    const lockedModel = getImagesTabLockedModel()
    const serviceToUse = (isImagesTabLocked() && lockedModel) ? lockedModel : selectedAIService
    
    if (!serviceToUse) {
      toast({
        title: "Error",
        description: "No AI service selected. Please choose an AI service or configure your settings.",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingImage(true)
    try {
      let imageUrl = ""
      
      console.log(`Generating storyboard image using ${serviceToUse} (${isImagesTabLocked() ? 'locked model' : 'user selected'})`)
      
      // Use the service to use for image generation
      switch (serviceToUse) {
        case "dalle":
          if (!user.openaiApiKey) {
            throw new Error("OpenAI API key not configured")
          }
          // Use DALL-E for image generation
          const dalleResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              service: 'dalle',
              apiKey: user.openaiApiKey
            })
          })
          if (!dalleResponse.ok) throw new Error('DALL-E API request failed')
          const dalleData = await dalleResponse.json()
          imageUrl = dalleData.imageUrl
          break
          
        case "openart":
          if (!user.openaiApiKey) {
            throw new Error("OpenArt requires API key")
          }
          // Use OpenArt for image generation
          const openartResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              service: 'openart',
              apiKey: user.openaiApiKey
            })
          })
          if (!openartResponse.ok) throw new Error('OpenArt API request failed')
          const openartData = await openartResponse.json()
          imageUrl = openartData.imageUrl
          break
          
        case "stable-diffusion":
          if (!user.openaiApiKey) {
            throw new Error("Stable Diffusion requires API key")
          }
          // Use Stable Diffusion
          const sdResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              service: 'stable-diffusion',
              apiKey: user.openaiApiKey
            })
          })
          if (!sdResponse.ok) throw new Error('Stable Diffusion API request failed')
          const sdData = await sdResponse.json()
          imageUrl = sdData.imageUrl
          break
          
        case "leonardo":
          if (!user.openaiApiKey) {
            throw new Error("Leonardo AI requires API key")
          }
          // Use Leonardo AI
          const leonardoResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              service: 'leonardo',
              apiKey: user.openaiApiKey
            })
          })
          if (!leonardoResponse.ok) throw new Error('Leonardo AI API request failed')
          const leonardoData = await leonardoResponse.json()
          imageUrl = leonardoData.imageUrl
          break
          
        case "runway":
          if (!user.runwayApiKey) {
            throw new Error("Runway ML API key not configured")
          }
          // Use Runway ML
          const runwayResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              service: 'runway',
              apiKey: user.runwayApiKey
            })
          })
          if (!runwayResponse.ok) throw new Error('Runway ML API request failed')
          const runwayData = await runwayResponse.json()
          imageUrl = runwayData.imageUrl
          break
          
        default:
          // Fallback to DALL-E
          if (!user.openaiApiKey) {
            throw new Error("OpenAI API key not configured")
          }
          const fallbackResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: aiPrompt,
              service: 'dalle',
              apiKey: user.openaiApiKey
            })
          })
          if (!fallbackResponse.ok) throw new Error('DALL-E API request failed')
          const fallbackData = await fallbackResponse.json()
          imageUrl = fallbackData.imageUrl
      }
      
      setFormData(prev => ({
        ...prev,
        image_url: imageUrl
      }))
      
      toast({
        title: "AI Image Generated",
        description: `Image generated successfully using ${selectedAIService.toUpperCase()}`
      })
    } catch (error) {
      console.error("Error generating AI image:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate AI image",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }



  const filteredStoryboards = storyboards.filter(storyboard => {
    const matchesSearch = storyboard.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         storyboard.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === "all" || 
                         (filterStatus === "ai" && storyboard.ai_generated) ||
                         (filterStatus === "manual" && !storyboard.ai_generated)
    
    return matchesSearch && matchesFilter
  })

  if (isLoadingStoryboards) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Storyboards</h1>
          <p className="text-muted-foreground text-lg">
            Create and manage visual storyboards for your movie scenes with AI-powered assistance
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search storyboards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ai">AI Generated</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="gradient-button neon-glow text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Storyboard
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Create New Storyboard
              </CardTitle>
              <CardDescription>
                Fill in the details below. Use AI assistance for text and image generation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Scene title"
                  />
                </div>
                <div>
                  <Label htmlFor="scene_number">Scene Number</Label>
                  <Input
                    id="scene_number"
                    type="number"
                    value={formData.scene_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, scene_number: parseInt(e.target.value) || 1 }))}
                    min="1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Scene description"
                  rows={3}
                />
              </div>

              {/* Technical Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="shot_type">Shot Type</Label>
                  <Select value={formData.shot_type} onValueChange={(value) => setFormData(prev => ({ ...prev, shot_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wide">Wide Shot</SelectItem>
                      <SelectItem value="medium">Medium Shot</SelectItem>
                      <SelectItem value="close">Close Up</SelectItem>
                      <SelectItem value="extreme-close">Extreme Close Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="camera_angle">Camera Angle</Label>
                  <Select value={formData.camera_angle} onValueChange={(value) => setFormData(prev => ({ ...prev, camera_angle: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eye-level">Eye Level</SelectItem>
                      <SelectItem value="high-angle">High Angle</SelectItem>
                      <SelectItem value="low-angle">Low Angle</SelectItem>
                      <SelectItem value="dutch-angle">Dutch Angle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="movement">Camera Movement</Label>
                  <Select value={formData.movement} onValueChange={(value) => setFormData(prev => ({ ...prev, movement: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Static</SelectItem>
                      <SelectItem value="panning">Panning</SelectItem>
                      <SelectItem value="tilting">Tilting</SelectItem>
                      <SelectItem value="tracking">Tracking</SelectItem>
                      <SelectItem value="zooming">Zooming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Integration Section */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold">AI Assistance</h3>
                </div>
                
                <div className="space-y-4">
                  {/* AI Service Selection - Only show if not locked */}
                  {!isImagesTabLocked() && (
                    <div>
                      <Label htmlFor="ai-service">AI Service</Label>
                      <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                          <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                          <SelectItem value="stable-diffusion">Stable Diffusion</SelectItem>
                          <SelectItem value="leonardo">Leonardo AI</SelectItem>
                          <SelectItem value="runway">Runway ML</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Show locked model info if images tab is locked */}
                  {isImagesTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="ai-prompt">AI Prompt</Label>
                    <div className="flex gap-2">
                      <Input
                        id="ai-prompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe what you want to generate..."
                        className="flex-1"
                      />
                      <Button
                        onClick={() => generateAIText('action')}
                        disabled={isGeneratingText || !aiPrompt.trim()}
                        variant="outline"
                        size="sm"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Action
                      </Button>
                      <Button
                        onClick={() => generateAIText('visual_notes')}
                        disabled={isGeneratingText || !aiPrompt.trim()}
                        variant="outline"
                        size="sm"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Visual Notes
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={generateAIImage}
                      disabled={isGeneratingImage || !aiPrompt.trim()}
                      variant="outline"
                      className="flex-1"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      {isGeneratingImage ? "Generating..." : "Generate Image"}
                    </Button>
                  </div>


                </div>
              </div>

              {/* Content Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dialogue">Dialogue</Label>
                  <Textarea
                    id="dialogue"
                    value={formData.dialogue}
                    onChange={(e) => setFormData(prev => ({ ...prev, dialogue: e.target.value }))}
                    placeholder="Character dialogue or narration"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="action">Action</Label>
                  <Textarea
                    id="action"
                    value={formData.action}
                    onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    placeholder="What happens in this scene"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="visual_notes">Visual Notes</Label>
                <Textarea
                  id="visual_notes"
                  value={formData.visual_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, visual_notes: e.target.value }))}
                  placeholder="Lighting, color, mood, special effects"
                  rows={3}
                />
              </div>

              {formData.image_url && (
                <div>
                  <Label>Generated Image</Label>
                  <div className="mt-2">
                    <img
                      src={formData.image_url}
                      alt="Storyboard"
                      className="w-full max-w-md h-auto rounded-lg border"
                    />
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateStoryboard}
                  disabled={isCreating}
                  className="gradient-button neon-glow text-white"
                >
                  {isCreating ? "Creating..." : "Create Storyboard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Form */}
        {showEditForm && editingStoryboard && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Storyboard
              </CardTitle>
              <CardDescription>
                Update the storyboard details below. Use AI assistance for text and image generation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-title">Title *</Label>
                  <Input
                    id="edit-title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Scene title"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-scene_number">Scene Number</Label>
                  <Input
                    id="edit-scene_number"
                    type="number"
                    value={formData.scene_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, scene_number: parseInt(e.target.value) || 1 }))}
                    min="1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-description">Description *</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Scene description"
                  rows={3}
                />
              </div>

              {/* Technical Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-shot_type">Shot Type</Label>
                  <Select value={formData.shot_type} onValueChange={(value) => setFormData(prev => ({ ...prev, shot_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wide">Wide Shot</SelectItem>
                      <SelectItem value="medium">Medium Shot</SelectItem>
                      <SelectItem value="close">Close Up</SelectItem>
                      <SelectItem value="extreme-close">Extreme Close Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-camera_angle">Camera Angle</Label>
                  <Select value={formData.camera_angle} onValueChange={(value) => setFormData(prev => ({ ...prev, camera_angle: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eye-level">Eye Level</SelectItem>
                      <SelectItem value="high-angle">High Angle</SelectItem>
                      <SelectItem value="low-angle">Low Angle</SelectItem>
                      <SelectItem value="dutch-angle">Dutch Angle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-movement">Camera Movement</Label>
                  <Select value={formData.movement} onValueChange={(value) => setFormData(prev => ({ ...prev, movement: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Static</SelectItem>
                      <SelectItem value="panning">Panning</SelectItem>
                      <SelectItem value="tilting">Tilting</SelectItem>
                      <SelectItem value="tracking">Tracking</SelectItem>
                      <SelectItem value="zooming">Zooming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Integration Section */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold">AI Assistance</h3>
                </div>
                
                <div className="space-y-4">
                  {/* AI Service Selection - Only show if not locked */}
                  {!isImagesTabLocked() && (
                    <div>
                      <Label htmlFor="edit-ai-service">AI Service</Label>
                      <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                          <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                          <SelectItem value="stable-diffusion">Stable Diffusion</SelectItem>
                          <SelectItem value="leonardo">Leonardo AI</SelectItem>
                          <SelectItem value="runway">Runway ML</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Show locked model info if images tab is locked */}
                  {isImagesTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="edit-ai-prompt">AI Prompt</Label>
                    <div className="flex gap-2">
                      <Input
                        id="edit-ai-prompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe what you want to generate..."
                        className="flex-1"
                      />
                      <Button
                        onClick={() => generateAIText('action')}
                        disabled={isGeneratingText || !aiPrompt.trim()}
                        variant="outline"
                        size="sm"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Action
                      </Button>
                      <Button
                        onClick={() => generateAIText('visual_notes')}
                        disabled={isGeneratingText || !aiPrompt.trim()}
                        variant="outline"
                        size="sm"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Visual Notes
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={generateAIImage}
                      disabled={isGeneratingImage || !aiPrompt.trim()}
                      variant="outline"
                      className="flex-1"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      {isGeneratingImage ? "Generating..." : "Generate Image"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Content Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-dialogue">Dialogue</Label>
                  <Textarea
                    id="edit-dialogue"
                    value={formData.dialogue}
                    onChange={(e) => setFormData(prev => ({ ...prev, dialogue: e.target.value }))}
                    placeholder="Character dialogue or narration"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-action">Action</Label>
                  <Textarea
                    id="edit-action"
                    value={formData.action}
                    onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    placeholder="What happens in this scene"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-visual_notes">Visual Notes</Label>
                <Textarea
                  id="edit-visual_notes"
                  value={formData.visual_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, visual_notes: e.target.value }))}
                  placeholder="Lighting, color, mood, special effects"
                  rows={3}
                />
              </div>

              {formData.image_url && (
                <div>
                  <Label>Generated Image</Label>
                  <div className="mt-2">
                    <img
                      src={formData.image_url}
                      alt="Storyboard"
                      className="w-full max-w-md h-auto rounded-lg border"
                    />
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditForm(false)
                    setEditingStoryboard(null)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateStoryboard}
                  disabled={isUpdating}
                  className="gradient-button neon-glow text-white"
                >
                  {isUpdating ? "Updating..." : "Update Storyboard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Storyboards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStoryboards.map((storyboard) => (
            <Card key={storyboard.id} className="cinema-card hover:neon-glow transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{storyboard.title}</CardTitle>
                  <Badge
                    variant="secondary"
                    className={storyboard.ai_generated ? "bg-purple-500/20 text-purple-500 border-purple-500/30" : "bg-blue-500/20 text-blue-500 border-blue-500/30"}
                  >
                    {storyboard.ai_generated ? "AI Generated" : "Manual"}
                  </Badge>
                </div>
                <CardDescription>Scene {storyboard.scene_number}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {storyboard.image_url && (
                  <div className="relative h-48 bg-muted rounded-lg overflow-hidden">
                    <img
                      src={storyboard.image_url}
                      alt={storyboard.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {storyboard.description}
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {storyboard.shot_type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {storyboard.camera_angle}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Updated {new Date(storyboard.updated_at).toLocaleDateString()}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 hover:text-blue-600"
                      onClick={() => handleEditStoryboard(storyboard)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteStoryboard(storyboard.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredStoryboards.length === 0 && !isLoadingStoryboards && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <FileText className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No storyboards found</h3>
              <p className="text-sm">
                {searchTerm || filterStatus !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Get started by creating your first storyboard"
                }
              </p>
            </div>
            {!searchTerm && filterStatus === "all" && (
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="gradient-button neon-glow text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Storyboard
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
