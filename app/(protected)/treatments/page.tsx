"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuthReady } from '@/components/auth-hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, FileText, Clock, User, Filter, Calendar, Edit, Trash2, Eye, Sparkles, ImageIcon, Save, Loader2, CheckCircle, Download, Film, Link as LinkIcon, ChevronDown, Zap } from 'lucide-react'
import { TreatmentsService, Treatment, CreateTreatmentData } from '@/lib/treatments-service'
import Header from '@/components/header'
import Link from 'next/link'
import { AISettingsService, type AISetting } from '@/lib/ai-settings-service'

export default function TreatmentsPage() {
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all') // 'all', 'linked', 'standalone'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [isLoadingTreatments, setIsLoadingTreatments] = useState(true)
  
  // Edit states
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const [newTreatment, setNewTreatment] = useState({
    title: '',
    genre: '',
    status: 'draft' as 'draft' | 'in-progress' | 'completed' | 'archived',
    cover_image_url: '',
    synopsis: '',
    target_audience: '',
    estimated_budget: '',
    estimated_duration: ''
  })

  // AI Image Generation States
  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedAIService, setSelectedAIService] = useState('dalle')
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState('')
  
  // AI Script Generation States
  const [scriptAiPrompt, setScriptAiPrompt] = useState('')
  const [selectedScriptAIService, setSelectedScriptAIService] = useState('openai')
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false)
  const [generatedSynopsis, setGeneratedSynopsis] = useState('')
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  
  // Quick AI generation state
  const [generatingTreatmentId, setGeneratingTreatmentId] = useState<string | null>(null)

  // Load treatments on component mount
  useEffect(() => {
    loadTreatments()
  }, [])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready) return
      
      try {
        const settings = await AISettingsService.getUserSettings(userId!)
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(userId!, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(userId!, 'images'),
          AISettingsService.getOrCreateDefaultTabSetting(userId!, 'videos'),
          AISettingsService.getOrCreateDefaultTabSetting(userId!, 'audio')
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
        
        // Auto-select locked model for scripts tab if available
        const scriptsSetting = mergedSettings.find(setting => setting.tab_type === 'scripts')
        if (scriptsSetting?.is_locked) {
          console.log('Setting locked model for scripts:', scriptsSetting.locked_model)
          setSelectedScriptAIService(scriptsSetting.locked_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  // Debug: Monitor synopsis state changes
  useEffect(() => {
    console.log('Generated synopsis state changed:', generatedSynopsis)
  }, [generatedSynopsis])

  // Debug: Monitor treatment synopsis changes
  useEffect(() => {
    console.log('Treatment synopsis state changed:', newTreatment.synopsis)
  }, [newTreatment.synopsis])

  const loadTreatments = async () => {
    try {
      setIsLoadingTreatments(true)
      const data = await TreatmentsService.getTreatments()
      setTreatments(data)
    } catch (error) {
      console.error('Error loading treatments:', error)
      toast({
        title: "Error",
        description: "Failed to load treatments",
        variant: "destructive",
      })
    } finally {
      setIsLoadingTreatments(false)
    }
  }

  // Upload generated image to Supabase storage
  const uploadGeneratedImageToStorage = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      console.log('Uploading generated treatment cover to Supabase storage...')
      
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
        console.log('Treatment cover uploaded successfully to Supabase:', result.supabaseUrl)
        return result.supabaseUrl
      } else {
        throw new Error('API did not return a valid Supabase URL')
      }
      
    } catch (error) {
      console.error('Error uploading treatment cover to Supabase:', error)
      throw error
    }
  }

  const generateAICoverImage = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a prompt to generate a cover image.",
        variant: "destructive",
      })
      return
    }

    // Check if user is loaded
    if (!ready) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating images.",
        variant: "destructive",
      })
      return
    }

    // Sanitize the prompt to avoid content filter issues
    const sanitizedPrompt = aiPrompt
      .replace(/godzilla/gi, 'giant monster')
      .replace(/violence|blood|gore/gi, 'action')
      .trim()

    // Check prompt length for DALL-E 3 (1000 character limit)
    const fullPrompt = `Treatment cover: ${sanitizedPrompt}. Cinematic style, dramatic lighting.`
    if (fullPrompt.length > 1000) {
      toast({
        title: "Prompt Too Long",
        description: "Please keep your description shorter. DALL-E 3 has a 1000 character limit.",
        variant: "destructive",
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

    // Normalize service name for locked models
    const normalizedService = serviceToUse.toLowerCase().includes('dall') ? 'dalle' : 
                             serviceToUse.toLowerCase().includes('openart') ? 'openart' : 
                             serviceToUse.toLowerCase().includes('leonardo') ? 'leonardo' : 
                             serviceToUse

    // For now, use a placeholder API key since these aren't stored in user object
    const apiKey = 'configured'

    try {
      setIsGeneratingCover(true)

      console.log(`Generating treatment cover using ${serviceToUse} (${isImagesTabLocked() ? 'locked model' : 'user selected'}) - normalized to: ${normalizedService}`)

      let imageUrl = ""
      
      // Use the service to use for cover generation
      switch (normalizedService) {
        case "dalle":
          console.log('Making DALL-E request with prompt:', fullPrompt)
          
          const dalleResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: fullPrompt,
              service: 'dalle',
              apiKey: 'configured',
              userId: user?.id, // Add userId for bucket storage
              autoSaveToBucket: true, // Enable automatic bucket storage
            })
          })
          if (!dalleResponse.ok) {
            const errorData = await dalleResponse.json().catch(() => ({}))
            console.error('DALL-E API error details:', errorData)
            throw new Error(`DALL-E API failed: ${dalleResponse.status} - ${errorData.error || 'Unknown error'}`)
          }
          const dalleData = await dalleResponse.json()
          imageUrl = dalleData.imageUrl
          break
          
        case "openart":
          const openartResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Treatment cover: ${sanitizedPrompt}. Cinematic, professional style, high quality, dramatic lighting.`,
              service: 'openart',
              apiKey: 'configured',
              userId: user?.id, // Add userId for bucket storage
              autoSaveToBucket: true, // Enable automatic bucket storage
            })
          })
          if (!openartResponse.ok) {
            const errorData = await openartResponse.json().catch(() => ({}))
            console.error('OpenArt API error details:', errorData)
            throw new Error(`OpenArt API failed: ${openartResponse.status} - ${errorData.error || 'Unknown error'}`)
          }
          const openartData = await openartResponse.json()
          imageUrl = openartData.imageUrl
          break
          
        case "leonardo":
          const leonardoResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Treatment cover: ${sanitizedPrompt}. Cinematic, professional style, high quality, dramatic lighting.`,
              service: 'leonardo',
              apiKey: 'configured',
              userId: user?.id, // Add userId for bucket storage
              autoSaveToBucket: true, // Enable automatic bucket storage
            })
          })
          if (!leonardoResponse.ok) throw new Error('Leonardo AI API request failed')
          const leonardoData = await leonardoResponse.json()
          imageUrl = leonardoData.imageUrl
          break
          
        default:
          // Fallback to DALL-E
          const fallbackResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: fullPrompt,
              service: 'dalle',
              apiKey: 'configured',
              userId: user?.id, // Add userId for bucket storage
              autoSaveToBucket: true, // Enable automatic bucket storage
            })
          })
          if (!fallbackResponse.ok) throw new Error('DALL-E API request failed')
          const fallbackData = await fallbackResponse.json()
          imageUrl = fallbackData.imageUrl
      }

      if (imageUrl) {
        setGeneratedCoverUrl(imageUrl)
        setNewTreatment(prev => ({ ...prev, cover_image_url: imageUrl }))
        
        // Upload the generated image to Supabase storage
        try {
          console.log('Uploading generated treatment cover to Supabase...')
          const fileName = `treatment-cover-${Date.now()}`
          const supabaseUrl = await uploadGeneratedImageToStorage(imageUrl, fileName)
          
          // Update with the Supabase URL instead of the temporary AI service URL
          setGeneratedCoverUrl(supabaseUrl)
          setNewTreatment(prev => ({ ...prev, cover_image_url: supabaseUrl }))
          
          toast({
            title: "AI Cover Generated & Uploaded",
            description: `Cover generated and uploaded to storage using ${normalizedService.toUpperCase()}`,
          })
        } catch (uploadError) {
          console.error('Failed to upload treatment cover to Supabase:', uploadError)
          toast({
            title: "Cover Generated (Upload Failed)",
            description: "Cover generated but failed to upload to storage. Using temporary URL.",
            variant: "destructive",
          })
          // Keep the temporary URL if upload fails
        }
      } else {
        throw new Error('No image URL received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI cover:', error)
      toast({
        title: "Generation Failed",
        description: `Failed to generate cover: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingCover(false)
    }
  }

  // Download generated cover image
  const downloadGeneratedCover = () => {
    if (!generatedCoverUrl) {
      toast({
        title: "No Generated Cover",
        description: "Generate a cover first before downloading.",
        variant: "destructive",
      })
      return
    }

    try {
      const link = document.createElement('a')
      link.href = generatedCoverUrl
      link.download = `generated_treatment_cover_${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "🎨 Download Started!",
        description: "Generated cover image is downloading...",
      })
    } catch (error) {
      console.error('Error downloading generated cover:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download the cover image. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Download treatment cover image
  const downloadTreatmentCover = async (treatment: Treatment) => {
    if (!treatment.cover_image_url) {
      toast({
        title: "No Cover Image",
        description: "This treatment doesn't have a cover image to download.",
        variant: "destructive",
      })
      return
    }

    try {
      // Create a temporary link element to trigger download
      const link = document.createElement('a')
      link.href = treatment.cover_image_url
      link.download = `${treatment.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_cover.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "📄 Download Started!",
        description: `Cover for "${treatment.title}" is downloading...`,
      })
    } catch (error) {
      console.error('Error downloading treatment cover:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download the cover image. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Generate AI Synopsis
  const generateAISynopsis = useCallback(async () => {
    console.log('generateAISynopsis called with prompt:', scriptAiPrompt)
    
    if (isGeneratingSynopsis) {
      console.log('Already generating synopsis, ignoring call')
      return
    }
    
    if (!scriptAiPrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a prompt to generate a synopsis.",
        variant: "destructive",
      })
      return
    }

    // Check if user is loaded
    if (!user) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating synopsis.",
        variant: "destructive",
      })
      return
    }

    // Use locked model if available, otherwise use selected service
    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    
    if (!serviceToUse) {
      toast({
        title: "Error",
        description: "No AI service selected. Please choose an AI service or configure your settings.",
        variant: "destructive",
      })
      return
    }

    // Normalize service name for locked models
    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             serviceToUse.toLowerCase().includes('gemini') || serviceToUse.toLowerCase().includes('google') ? 'google' : 
                             serviceToUse

    // Check if user has the required API key for the service to use
    let apiKey = ''
    switch (normalizedService) {
      case 'openai':
        apiKey = 'configured'
        break
      case 'anthropic':
        apiKey = 'configured'
        break
      case 'google':
        toast({
          title: "Service Not Available",
          description: "Google Gemini is not currently configured. Please use OpenAI or Anthropic.",
          variant: "destructive",
        })
        return
      default:
        throw new Error(`Unsupported AI service: ${serviceToUse} (normalized to: ${normalizedService})`)
    }

    try {
      setIsGeneratingSynopsis(true)

      console.log(`Generating treatment synopsis using ${serviceToUse} (${isScriptsTabLocked() ? 'locked model' : 'user selected'}) - normalized to: ${normalizedService}`)

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Write a compelling 2-3 paragraph movie treatment synopsis for: ${scriptAiPrompt}. Make it engaging, cinematic, and professional. Focus on the main plot, key characters, and dramatic stakes.`,
          field: 'synopsis',
          service: normalizedService,
          apiKey: apiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate synopsis')
      }

      const result = await response.json()
      console.log('AI synopsis generated:', result)
      console.log('Generated synopsis text:', result.text)

      if (result.success && result.text) {
        console.log('Setting generated synopsis:', result.text)
        setGeneratedSynopsis(result.text)
        // Automatically apply the synopsis to the treatment
        setNewTreatment(prev => {
          console.log('Previous treatment state:', prev)
          const updated = { ...prev, synopsis: result.text }
          console.log('Updated treatment state:', updated)
          return updated
        })
        toast({
          title: "Synopsis Generated & Applied",
          description: "AI has generated and automatically applied your treatment synopsis!",
        })
      } else {
        throw new Error('No synopsis text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI synopsis:', error)
      toast({
        title: "Generation Failed",
        description: `Failed to generate synopsis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingSynopsis(false)
    }
  }, [scriptAiPrompt, isGeneratingSynopsis, userId, selectedScriptAIService, toast])

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setGeneratedCoverUrl(result)
      setNewTreatment(prev => ({ ...prev, cover_image_url: result }))
      toast({
        title: "Image Uploaded",
        description: "Cover image has been uploaded successfully!",
      })
    }
    reader.readAsDataURL(file)
  }

  const resetTreatmentForm = () => {
    setNewTreatment({
      title: '',
      genre: '',
      status: 'draft',
      cover_image_url: '',
      synopsis: '',
      target_audience: '',
      estimated_budget: '',
      estimated_duration: ''
    })
    setAiPrompt('')
    setSelectedAIService('dalle')
    setGeneratedCoverUrl('')
    setScriptAiPrompt('')
    setSelectedScriptAIService('openai')
    setGeneratedSynopsis('')
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

  // Get current scripts tab AI setting
  const getScriptsTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === 'scripts')
  }

  // Check if scripts tab has a locked model
  const isScriptsTabLocked = () => {
    const setting = getScriptsTabSetting()
    return setting?.is_locked || false
  }

  // Get the locked model for scripts tab
  const getScriptsTabLockedModel = () => {
    const setting = getScriptsTabSetting()
    return setting?.locked_model || ""
  }

  const handleEditTreatment = (treatment: Treatment) => {
    setEditingTreatment(treatment)
    setNewTreatment({
      title: treatment.title,
      genre: treatment.genre,
      status: treatment.status,
      cover_image_url: treatment.cover_image_url || '',
      synopsis: treatment.synopsis,
      target_audience: treatment.target_audience || '',
      estimated_budget: treatment.estimated_budget || '',
      estimated_duration: treatment.estimated_duration || ''
    })
    setGeneratedCoverUrl(treatment.cover_image_url || '')
    setGeneratedSynopsis('')
    setScriptAiPrompt('')
    setIsEditDialogOpen(true)
  }

  const handleUpdateTreatment = async () => {
    if (!editingTreatment || !newTreatment.title || !newTreatment.genre || !newTreatment.synopsis) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsUpdating(true)

      // If there's a generated cover image, upload it to Supabase storage first
      let finalCoverUrl = newTreatment.cover_image_url
      if (newTreatment.cover_image_url && newTreatment.cover_image_url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
        try {
          console.log('Uploading generated cover image to Supabase storage...')
          const fileName = `treatment-cover-${Date.now()}`
          finalCoverUrl = await uploadGeneratedImageToStorage(newTreatment.cover_image_url, fileName)
          console.log('Cover image uploaded to Supabase, new URL:', finalCoverUrl)
        } catch (uploadError) {
          console.error('Failed to upload cover image to Supabase:', uploadError)
          toast({
            title: "Image Upload Warning",
            description: "Failed to upload cover image to storage, but saving with original URL.",
            variant: "destructive",
          })
          // Continue with original URL if upload fails
        }
      }

      const treatmentData: CreateTreatmentData = {
        title: newTreatment.title,
        genre: newTreatment.genre,
        status: newTreatment.status,
        cover_image_url: finalCoverUrl,
        synopsis: newTreatment.synopsis,
        target_audience: newTreatment.target_audience || undefined,
        estimated_budget: newTreatment.estimated_budget || undefined,
        estimated_duration: newTreatment.estimated_duration || undefined,
      }
      
      const updatedTreatment = await TreatmentsService.updateTreatment(editingTreatment.id, treatmentData)
      
      setTreatments(prev => 
        prev.map(t => t.id === editingTreatment.id ? updatedTreatment : t)
      )
      
      setIsEditDialogOpen(false)
      setEditingTreatment(null)
      resetTreatmentForm()
      
      toast({
        title: "Success",
        description: "Treatment updated successfully!",
      })
    } catch (error) {
      console.error('Error updating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to update treatment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredTreatments = treatments.filter(treatment => {
    const matchesSearch = treatment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         treatment.synopsis.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         treatment.genre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || treatment.status === statusFilter
    const matchesProject = projectFilter === 'all' || 
                          (projectFilter === 'linked' && treatment.project_id) ||
                          (projectFilter === 'standalone' && !treatment.project_id)
    return matchesSearch && matchesStatus && matchesProject
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'in-progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleDeleteTreatment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this treatment?')) return
    
    try {
      await TreatmentsService.deleteTreatment(id)
      setTreatments(prev => prev.filter(t => t.id !== id))
      toast({
        title: "Success",
        description: "Treatment deleted successfully",
      })
    } catch (error) {
      console.error('Error deleting treatment:', error)
      toast({
        title: "Error",
        description: "Failed to delete treatment",
        variant: "destructive",
      })
    }
  }

  const handleQuickStatusUpdate = async (treatmentId: string, newStatus: 'draft' | 'in-progress' | 'completed' | 'archived') => {
    try {
      await TreatmentsService.updateTreatment(treatmentId, { status: newStatus })
      
      setTreatments(prev => 
        prev.map(t => t.id === treatmentId ? { ...t, status: newStatus } : t)
      )
      
      toast({
        title: "Status Updated",
        description: `Treatment status changed to ${newStatus.replace('-', ' ')}`,
      })
    } catch (error) {
      console.error('Error updating treatment status:', error)
      toast({
        title: "Error",
        description: "Failed to update treatment status",
        variant: "destructive",
      })
    }
  }

  const handleQuickAIGenerate = async (treatment: Treatment) => {
    if (!ready || !user) {
      toast({
        title: "Authentication required",
        description: "Please log in to use AI features",
        variant: "destructive"
      })
      return
    }

    try {
      setGeneratingTreatmentId(treatment.id)

      // Create prompt from treatment details
      const prompt = `Movie treatment cover for "${treatment.title}". ${treatment.genre} genre. ${treatment.synopsis.substring(0, 300)}. Cinematic movie poster style, dramatic lighting, professional quality.`
      
      console.log('🎬 Generating cover for treatment with prompt:', prompt)

      // Get the locked AI service for images
      const imagesSetting = aiSettings.find(setting => setting.tab_type === 'images')
      
      if (!imagesSetting || !imagesSetting.is_locked) {
        toast({
          title: "AI not configured",
          description: "Please configure your Images AI settings in AI Settings first",
          variant: "destructive"
        })
        setGeneratingTreatmentId(null)
        return
      }

      const serviceToUse = imagesSetting.locked_model.toLowerCase().includes('dall') ? 'dalle' : 
                          imagesSetting.locked_model.toLowerCase().includes('openart') ? 'openart' : 
                          imagesSetting.locked_model.toLowerCase().includes('leonardo') ? 'leonardo' : 
                          'dalle'

      // Generate image
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          service: serviceToUse,
          apiKey: 'configured',
          userId: user.id,
          autoSaveToBucket: true,
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`AI API failed: ${response.status} - ${errorData.error || 'Unknown error'}`)
      }

      const data = await response.json()
      const imageUrl = data.imageUrl

      if (!imageUrl) {
        throw new Error('No image URL received from AI service')
      }

      // Upload to Supabase storage
      const uploadResponse = await fetch('/api/ai/download-and-store-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          fileName: `treatment-cover-${treatment.id}-${Date.now()}`,
          userId: user.id
        })
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image to storage')
      }

      const uploadResult = await uploadResponse.json()
      const finalImageUrl = uploadResult.supabaseUrl || imageUrl

      // Update treatment with new cover
      await TreatmentsService.updateTreatment(treatment.id, { 
        cover_image_url: finalImageUrl 
      })

      // Update local state
      setTreatments(prev => 
        prev.map(t => t.id === treatment.id ? { ...t, cover_image_url: finalImageUrl } : t)
      )

      toast({
        title: "✨ Cover Generated!",
        description: "AI has created a cover image for your treatment",
      })

    } catch (error) {
      console.error('Error generating AI cover:', error)
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : 'Failed to generate cover',
        variant: "destructive",
      })
    } finally {
      setGeneratingTreatmentId(null)
    }
  }

  const handleCreateTreatment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTreatment.title || !newTreatment.genre || !newTreatment.synopsis) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsLoading(true)

      // If there's a generated cover image, upload it to Supabase storage first
      let finalCoverUrl = newTreatment.cover_image_url
      if (newTreatment.cover_image_url && newTreatment.cover_image_url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
        try {
          console.log('Uploading generated cover image to Supabase storage...')
          const fileName = `treatment-cover-${Date.now()}`
          finalCoverUrl = await uploadGeneratedImageToStorage(newTreatment.cover_image_url, fileName)
          console.log('Cover image uploaded to Supabase, new URL:', finalCoverUrl)
        } catch (uploadError) {
          console.error('Failed to upload cover image to Supabase:', uploadError)
          toast({
            title: "Image Upload Warning",
            description: "Failed to upload cover image to storage, but saving with original URL.",
            variant: "destructive",
          })
          // Continue with original URL if upload fails
        }
      }

      const treatmentData: CreateTreatmentData = {
        title: newTreatment.title,
        genre: newTreatment.genre,
        status: newTreatment.status,
        cover_image_url: finalCoverUrl,
        synopsis: newTreatment.synopsis,
        target_audience: newTreatment.target_audience || undefined,
        estimated_budget: newTreatment.estimated_budget || undefined,
        estimated_duration: newTreatment.estimated_duration || undefined,
      }
      
      const createdTreatment = await TreatmentsService.createTreatment(treatmentData)
      
      setTreatments(prev => [createdTreatment, ...prev])
      resetTreatmentForm()
      setShowCreateForm(false)
      
      toast({
        title: "Success",
        description: "Treatment created successfully",
      })
    } catch (error) {
      console.error('Error creating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to create treatment",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Please log in to access treatments</h1>
        </div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Cinema Treatments</h1>
            <p className="text-muted-foreground">Manage your film treatments and story concepts</p>
          </div>
          <Button onClick={() => {
            setShowCreateForm(true)
            resetTreatmentForm()
          }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Treatment
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search treatments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Treatments</SelectItem>
              <SelectItem value="linked">Linked to Projects</SelectItem>
              <SelectItem value="standalone">Standalone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Create Treatment Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
            <CardTitle>Create New Treatment</CardTitle>
            <CardDescription>Add a new film treatment to your collection</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTreatment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newTreatment.title}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter treatment title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={newTreatment.genre} onValueChange={(value) => setNewTreatment(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                      <SelectItem value="Documentary">Documentary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={newTreatment.status} onValueChange={(value: any) => setNewTreatment(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Cover Image Section */}
              <div className="space-y-4">
                <Label>Cover Image</Label>
                
                {/* AI Image Generation */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">AI Cover Generation</h3>
                  </div>
                  
                  {!user ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Loading user profile...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* AI Service Selection - Only show if not locked */}
                      {!isImagesTabLocked() && (
                        <div>
                          <Label htmlFor="ai-service">AI Service</Label>
                          <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="cinema-card border-border">
                              <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                              <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                              <SelectItem value="leonardo">Leonardo AI</SelectItem>
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
                      
                      {/* AI Prompt */}
                      <div>
                        <Label htmlFor="ai-prompt">AI Prompt</Label>
                        <div className="flex gap-2">
                          <Input
                            id="ai-prompt"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Describe your treatment cover (e.g., 'Sci-fi movie poster with spaceship and alien planet')"
                            className="flex-1 bg-input border-border"
                          />
                          <Button
                            type="button"
                            onClick={generateAICoverImage}
                            disabled={isGeneratingCover || !aiPrompt.trim()}
                            variant="outline"
                            size="sm"
                            className="border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10"
                          >
                            {isGeneratingCover ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Generate
                          </Button>
                        </div>
                      </div>
                      
                      {/* Generated Image Preview */}
                      {generatedCoverUrl && (
                        <div className="space-y-3">
                          <Label>Generated Cover</Label>
                          <div className="relative">
                            <img
                              src={generatedCoverUrl}
                              alt="AI generated treatment cover"
                              className="w-full h-48 object-cover rounded-lg border border-border"
                            />
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-green-600/90 text-white">
                                Generated ✓
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={downloadGeneratedCover}
                              variant="outline"
                              size="sm"
                              className="border-green-500/20 hover:border-green-500 hover:bg-green-500/10"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Cover
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This cover will be automatically saved when you create the treatment.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Upload */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Manual Upload</h3>
                  </div>
                  
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="cover-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                      </div>
                      <input
                        id="cover-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(file)
                          }
                        }}
                      />
                    </label>
                  </div>
                  
                  {/* Manual URL Input */}
                  <div className="mt-4">
                    <Label htmlFor="coverImageUrl">Or enter image URL</Label>
                    <Input
                      id="coverImageUrl"
                      value={newTreatment.cover_image_url}
                      onChange={(e) => setNewTreatment(prev => ({ ...prev, cover_image_url: e.target.value }))}
                      placeholder="Enter cover image URL"
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
              {/* AI Script Generation for Synopsis */}
              <div className="space-y-4">
                <Label>Synopsis</Label>
                
                {/* AI Script Generation */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">AI Synopsis Generation</h3>
                  </div>
                  
                  {!user ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Loading user profile...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* AI Service Selection - Only show if not locked */}
                      {!isScriptsTabLocked() && (
              <div>
                          <Label htmlFor="script-ai-service">AI Service</Label>
                          <Select value={selectedScriptAIService} onValueChange={setSelectedScriptAIService}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="cinema-card border-border">
                              <SelectItem value="openai">OpenAI GPT-4</SelectItem>
                              <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                              <SelectItem value="google">Google Gemini</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Show locked model info if scripts tab is locked */}
                      {isScriptsTabLocked() && (
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <p className="text-sm text-blue-600 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            AI Scripts Online
                          </p>
                        </div>
                      )}
                      
                      {/* AI Prompt for Synopsis */}
                      <div>
                        <Label htmlFor="script-ai-prompt">AI Prompt</Label>
                        <div className="flex gap-2">
                          <Input
                            id="script-ai-prompt"
                            value={scriptAiPrompt}
                            onChange={(e) => setScriptAiPrompt(e.target.value)}
                            placeholder="Describe your story concept (e.g., 'A sci-fi thriller about time travel and corporate espionage')"
                            className="flex-1 bg-input border-border"
                          />
                          <Button
                            type="button"
                            onClick={generateAISynopsis}
                            disabled={isGeneratingSynopsis || !scriptAiPrompt.trim()}
                            variant="outline"
                            size="sm"
                            className="border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10"
                          >
                            {isGeneratingSynopsis ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Generate Synopsis
                          </Button>
                        </div>
                      </div>
                      
                      {/* Generated Synopsis Preview */}
                      {generatedSynopsis && (
                        <div className="space-y-3">
                          <Label>Generated Synopsis</Label>
                          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <p className="text-sm text-blue-600 mb-2 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              AI Generated
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{generatedSynopsis}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                setNewTreatment(prev => ({ ...prev, synopsis: generatedSynopsis }))
                                setGeneratedSynopsis('')
                                setScriptAiPrompt('')
                                toast({
                                  title: "Synopsis Applied",
                                  description: "AI-generated synopsis has been added to your treatment.",
                                })
                              }}
                              variant="outline"
                              size="sm"
                              className="border-green-500/20 hover:border-green-500 hover:bg-green-500/10"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Use This Synopsis
                            </Button>
                            <Button
                              type="button"
                              onClick={() => setGeneratedSynopsis('')}
                              variant="outline"
                              size="sm"
                              className="border-gray-500/20 hover:border-gray-500 hover:bg-gray-500/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Discard
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Synopsis Input */}
                <div>
                <Textarea
                  id="synopsis"
                  value={newTreatment.synopsis}
                  onChange={(e) => setNewTreatment(prev => ({ ...prev, synopsis: e.target.value }))}
                    placeholder="Enter a brief synopsis of your story (or use AI generation above)"
                  rows={3}
                  required
                />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="targetAudience">Target Audience</Label>
                  <Input
                    id="targetAudience"
                    value={newTreatment.target_audience}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, target_audience: e.target.value }))}
                    placeholder="e.g., 18-35, Action fans"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedBudget">Estimated Budget</Label>
                  <Input
                    id="estimatedBudget"
                    value={newTreatment.estimated_budget}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimated_budget: e.target.value }))}
                    placeholder="e.g., $10M"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedDuration">Estimated Duration</Label>
                  <Input
                    id="estimatedDuration"
                    value={newTreatment.estimated_duration}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimated_duration: e.target.value }))}
                    placeholder="e.g., 120 min"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Treatment'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowCreateForm(false)
                  resetTreatmentForm()
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Edit Treatment Dialog */}
      {isEditDialogOpen && editingTreatment && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit Treatment: {editingTreatment.title}</CardTitle>
            <CardDescription>Update your treatment details and cover image</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateTreatment(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={newTreatment.title}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter treatment title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-genre">Genre</Label>
                  <Select value={newTreatment.genre} onValueChange={(value) => setNewTreatment(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                      <SelectItem value="Documentary">Documentary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={newTreatment.status} onValueChange={(value: any) => setNewTreatment(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cover Image Section for Edit */}
              <div className="space-y-4">
                <Label>Cover Image</Label>
                
                {/* AI Image Generation */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">AI Cover Generation</h3>
                  </div>
                  
                  {!user ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Loading user profile...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* AI Service Selection - Only show if not locked */}
                      {!isImagesTabLocked() && (
                        <div>
                          <Label htmlFor="edit-ai-service">AI Service</Label>
                          <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="cinema-card border-border">
                              <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                              <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                              <SelectItem value="leonardo">Leonardo AI</SelectItem>
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
                      
                      {/* AI Prompt */}
                      <div>
                        <Label htmlFor="edit-ai-prompt">AI Prompt</Label>
                        <div className="flex gap-2">
                          <Input
                            id="edit-ai-prompt"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Describe your treatment cover (e.g., 'Sci-fi movie poster with spaceship and alien planet')"
                            className="flex-1 bg-input border-border"
                          />
                          <Button
                            type="button"
                            onClick={generateAICoverImage}
                            disabled={isGeneratingCover || !aiPrompt.trim()}
                            variant="outline"
                            size="sm"
                            className="border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10"
                          >
                            {isGeneratingCover ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Generate
                          </Button>
                        </div>
                      </div>
                      
                      {/* Generated Image Preview */}
                      {generatedCoverUrl && (
                        <div className="space-y-3">
                          <Label>Generated Cover</Label>
                          <div className="relative">
                            <img
                              src={generatedCoverUrl}
                              alt="AI generated treatment cover"
                              className="w-full h-48 object-cover rounded-lg border border-border"
                            />
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-green-600/90 text-white">
                                Generated ✓
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={downloadGeneratedCover}
                              variant="outline"
                              size="sm"
                              className="border-green-500/20 hover:border-green-500 hover:bg-green-500/10"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Cover
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This cover will be automatically saved when you update the treatment.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Upload for Edit */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Manual Upload</h3>
                  </div>
                  
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="edit-cover-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                      </div>
                      <input
                        id="edit-cover-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(file)
                          }
                        }}
                      />
                    </label>
                  </div>
                  
                  {/* Manual URL Input for Edit */}
                  <div className="mt-4">
                    <Label htmlFor="edit-coverImageUrl">Or enter image URL</Label>
                    <Input
                      id="edit-coverImageUrl"
                      value={newTreatment.cover_image_url}
                      onChange={(e) => setNewTreatment(prev => ({ ...prev, cover_image_url: e.target.value }))}
                      placeholder="Enter cover image URL"
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* AI Script Generation for Synopsis - Edit Form */}
              <div className="space-y-4">
                <Label>Synopsis</Label>
                
                {/* AI Script Generation */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">AI Synopsis Generation</h3>
                  </div>
                  
                  {!user ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Loading user profile...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* AI Service Selection - Only show if not locked */}
                      {!isScriptsTabLocked() && (
              <div>
                          <Label htmlFor="edit-script-ai-service">AI Service</Label>
                          <Select value={selectedScriptAIService} onValueChange={setSelectedScriptAIService}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="cinema-card border-border">
                              <SelectItem value="openai">OpenAI GPT-4</SelectItem>
                              <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                              <SelectItem value="google">Google Gemini</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Show locked model info if scripts tab is locked */}
                      {isScriptsTabLocked() && (
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <p className="text-sm text-blue-600 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            AI Scripts Online
                          </p>
                        </div>
                      )}
                      
                      {/* AI Prompt for Synopsis */}
                      <div>
                        <Label htmlFor="edit-script-ai-prompt">AI Prompt</Label>
                        <div className="flex gap-2">
                          <Input
                            id="edit-script-ai-prompt"
                            value={scriptAiPrompt}
                            onChange={(e) => setScriptAiPrompt(e.target.value)}
                            placeholder="Describe your story concept (e.g., 'A sci-fi thriller about time travel and corporate espionage')"
                            className="flex-1 bg-input border-border"
                          />
                          <Button
                            type="button"
                            onClick={generateAISynopsis}
                            disabled={isGeneratingSynopsis || !scriptAiPrompt.trim()}
                            variant="outline"
                            size="sm"
                            className="border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10"
                          >
                            {isGeneratingSynopsis ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Generate Synopsis
                          </Button>
                        </div>
                      </div>
                      
                      {/* Generated Synopsis Preview */}
                      {generatedSynopsis && (
                        <div className="space-y-3">
                          <Label>Generated Synopsis</Label>
                          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <p className="text-sm text-blue-600 mb-2 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              AI Generated
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{generatedSynopsis}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                setNewTreatment(prev => ({ ...prev, synopsis: generatedSynopsis }))
                                setGeneratedSynopsis('')
                                setScriptAiPrompt('')
                                toast({
                                  title: "Synopsis Applied",
                                  description: "AI-generated synopsis has been added to your treatment.",
                                })
                              }}
                              variant="outline"
                              size="sm"
                              className="border-green-500/20 hover:border-green-500 hover:bg-green-500/10"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Use This Synopsis
                            </Button>
                            <Button
                              type="button"
                              onClick={() => setGeneratedSynopsis('')}
                              variant="outline"
                              size="sm"
                              className="border-gray-500/20 hover:border-gray-500 hover:bg-gray-500/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Discard
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Synopsis Input */}
                <div>
                <Textarea
                  id="edit-synopsis"
                  value={newTreatment.synopsis}
                  onChange={(e) => setNewTreatment(prev => ({ ...prev, synopsis: e.target.value }))}
                    placeholder="Enter a brief synopsis of your story (or use AI generation above)"
                  rows={3}
                  required
                />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-targetAudience">Target Audience</Label>
                  <Input
                    id="edit-targetAudience"
                    value={newTreatment.target_audience}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, target_audience: e.target.value }))}
                    placeholder="e.g., 18-35, Action fans"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-estimatedBudget">Estimated Budget</Label>
                  <Input
                    id="edit-estimatedBudget"
                    value={newTreatment.estimated_budget}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimated_budget: e.target.value }))}
                    placeholder="e.g., $10M"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-estimatedDuration">Estimated Duration</Label>
                  <Input
                    id="edit-estimatedDuration"
                    value={newTreatment.estimated_duration}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimated_duration: e.target.value }))}
                    placeholder="e.g., 120 min"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update Treatment'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingTreatment(null)
                  resetTreatmentForm()
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

        {/* Treatments Grid */}
        {isLoadingTreatments ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading treatments...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTreatments.map((treatment) => (
              <Card key={treatment.id} className="hover:shadow-lg transition-shadow">
                {/* Cover Image */}
                {treatment.cover_image_url && (
                  <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden group">
                    <img
                      src={treatment.cover_image_url}
                      alt={`${treatment.title} cover`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-sm">Cover Image</p>
                      </div>
                    </div>
                    {/* Quick AI Button Overlay */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          handleQuickAIGenerate(treatment)
                        }}
                        disabled={generatingTreatmentId === treatment.id}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white shadow-lg"
                      >
                        {generatingTreatmentId === treatment.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            AI
                          </>
                        ) : (
                          <>
                            <Zap className="h-3 w-3 mr-1" />
                            Quick AI
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {/* No Cover Image - Show Quick AI Button */}
                {!treatment.cover_image_url && (
                  <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden flex items-center justify-center">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-3">No Cover Image</p>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          handleQuickAIGenerate(treatment)
                        }}
                        disabled={generatingTreatmentId === treatment.id}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white"
                      >
                        {generatingTreatmentId === treatment.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Generate with AI
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{treatment.title}</CardTitle>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline">{treatment.genre}</Badge>
                        
                        {/* Clickable Status Badge with Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Badge 
                              className={`${getStatusColor(treatment.status)} cursor-pointer hover:opacity-80 transition-opacity`}
                            >
                              {treatment.status.replace('-', ' ')}
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(treatment.id, 'draft')}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-500" />
                                Draft
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(treatment.id, 'in-progress')}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                In Progress
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(treatment.id, 'completed')}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Completed
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusUpdate(treatment.id, 'archived')}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                Archived
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        {treatment.project_id && (
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            <LinkIcon className="h-3 w-3 mr-1" />
                            Linked to Project
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {treatment.synopsis}
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{treatment.estimated_duration || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{treatment.estimated_budget || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Updated {new Date(treatment.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/treatments/${treatment.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditTreatment(treatment)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleDeleteTreatment(treatment.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                  
                  {/* Download Cover Button */}
                  {treatment.cover_image_url && (
                    <div className="mt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => downloadTreatmentCover(treatment)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download Cover
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoadingTreatments && filteredTreatments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No treatments found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first treatment'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setShowCreateForm(true)}>
                Create Treatment
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
