"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Edit, Trash2, FileText, Clock, Calendar, User, Target, DollarSign, Film, Eye, Volume2, Save, X, Sparkles, Loader2, ImageIcon, Upload, Download, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { TreatmentsService, Treatment } from '@/lib/treatments-service'
import { MovieService } from '@/lib/movie-service'
import Header from '@/components/header'
import TextToSpeech from '@/components/text-to-speech'
import Link from 'next/link'
import { AISettingsService } from '@/lib/ai-settings-service'
import { useAuthReady } from '@/components/auth-hooks'
import { getSupabaseClient } from '@/lib/supabase'
import { sanitizeFilename } from '@/lib/utils'
import { AssetService, type Asset } from '@/lib/asset-service'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export default function TreatmentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { session } = useAuth()
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [movie, setMovie] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditingTreatment, setIsEditingTreatment] = useState(false)
  const [editingTreatmentData, setEditingTreatmentData] = useState({
    target_audience: '',
    estimated_budget: '',
    estimated_duration: '',
  })
  const [isSavingTreatment, setIsSavingTreatment] = useState(false)
  const [isEditingSynopsis, setIsEditingSynopsis] = useState(false)
  const [editingSynopsis, setEditingSynopsis] = useState('')
  const [isSavingSynopsis, setIsSavingSynopsis] = useState(false)
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState('')
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false)
  const [aiSettings, setAiSettings] = useState<any[]>([])
  const [selectedScriptAIService, setSelectedScriptAIService] = useState<string>('')
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  
  // Cover image editing states
  const [isEditingCover, setIsEditingCover] = useState(false)
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string>('')
  const [selectedAIService, setSelectedAIService] = useState<string>('dalle')
  
  // Script assets states
  const [scriptAssets, setScriptAssets] = useState<Asset[]>([])
  const [scriptContent, setScriptContent] = useState<string>('')
  const [isLoadingScript, setIsLoadingScript] = useState(false)
  const [isGeneratingTreatmentFromScript, setIsGeneratingTreatmentFromScript] = useState(false)
  const [isScriptExpanded, setIsScriptExpanded] = useState(false)

  useEffect(() => {
    if (id) {
      loadTreatment(id as string)
    }
  }, [id])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready || !userId) return
      
      try {
        const settings = await AISettingsService.getUserSettings(userId)
        
        // Ensure default settings exist for scripts and images tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'images'),
        ])
        
        // Merge existing settings with default ones, preferring existing
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
        
        // Auto-select locked model for scripts tab if available
        const scriptsSetting = mergedSettings.find(setting => setting.tab_type === 'scripts')
        if (scriptsSetting?.is_locked && scriptsSetting.locked_model) {
          setSelectedScriptAIService(scriptsSetting.locked_model)
        } else if (scriptsSetting?.selected_model) {
          setSelectedScriptAIService(scriptsSetting.selected_model)
        }
        
        // Auto-select locked model for images tab if available
        const imagesSetting = mergedSettings.find(setting => setting.tab_type === 'images')
        if (imagesSetting?.is_locked && imagesSetting.locked_model) {
          setSelectedAIService(imagesSetting.locked_model)
        } else if (imagesSetting?.selected_model) {
          setSelectedAIService(imagesSetting.selected_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  // Helper functions for AI settings
  const isScriptsTabLocked = () => {
    const setting = aiSettings.find(s => s.tab_type === 'scripts')
    return setting?.is_locked || false
  }

  const getScriptsTabLockedModel = () => {
    const setting = aiSettings.find(s => s.tab_type === 'scripts')
    return setting?.locked_model || ""
  }

  const getImagesTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === 'images')
  }

  const isImagesTabLocked = () => {
    const setting = getImagesTabSetting()
    return setting?.is_locked || false
  }

  const getImagesTabLockedModel = () => {
    const setting = getImagesTabSetting()
    return setting?.locked_model || ""
  }

  const loadTreatment = async (treatmentId: string) => {
    try {
      setIsLoading(true)
      const data = await TreatmentsService.getTreatment(treatmentId)
      if (data) {
        console.log('Loaded treatment data:', {
          id: data.id,
          title: data.title,
          project_id: data.project_id,
          synopsis: data.synopsis?.substring(0, 100),
          prompt: data.prompt?.substring(0, 100),
          hasPrompt: !!data.prompt,
          hasSynopsis: !!data.synopsis
        })
        setTreatment(data)
        
        // Note: Treatment can be saved without project_id (standalone treatment)
        // Audio saving will work even without a project_id
        
        // If treatment is linked to a movie project, load the movie and script assets
        if (data.project_id) {
          try {
            const movieData = await MovieService.getMovieById(data.project_id)
            if (movieData) {
              setMovie(movieData)
            }
            
            // Fetch script assets from the movie project
            await fetchScriptAssets(data.project_id)
          } catch (movieError) {
            console.error('Error loading linked movie:', movieError)
            // Don't show error for movie, just continue without it
          }
        }
      } else {
        toast({
          title: "Error",
          description: "Treatment not found",
          variant: "destructive",
        })
        router.push('/treatments')
      }
    } catch (error) {
      console.error('Error loading treatment:', error)
      toast({
        title: "Error",
        description: "Failed to load treatment",
        variant: "destructive",
      })
      router.push('/treatments')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch script assets from the linked movie project
  const fetchScriptAssets = async (projectId: string) => {
    if (!ready || !userId) return
    
    try {
      setIsLoadingScript(true)
      
      // Get all script assets for this project
      const assets = await AssetService.getAssetsForProject(projectId)
      const scripts = assets.filter(a => a.content_type === 'script' && a.is_latest_version)
      
      // Sort by created_at to get the latest
      scripts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setScriptAssets(scripts)
      
      // Combine script content
      if (scripts.length > 0) {
        if (scripts.length === 1) {
          setScriptContent(scripts[0].content || "")
        } else {
          // Combine all scripts, separated by scene markers
          const combinedScript = scripts
            .map(script => {
              const content = script.content || ""
              return script.title ? `\n\n=== ${script.title} ===\n\n${content}` : content
            })
            .join("\n\n")
          setScriptContent(combinedScript)
        }
      } else {
        // Try fetching scripts from scenes
        await fetchScriptsFromScenes(projectId)
      }
    } catch (error) {
      console.error('Error fetching script assets:', error)
      // Don't show error toast, just log it - script is optional
    } finally {
      setIsLoadingScript(false)
    }
  }

  // Fetch scripts from scenes if no project-level scripts exist
  const fetchScriptsFromScenes = async (projectId: string) => {
    if (!ready || !userId) return
    
    try {
      // Get timeline for this project
      const { data: timeline, error: timelineError } = await getSupabaseClient()
        .from('timelines')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single()

      if (timelineError || !timeline) {
        console.log('No timeline found for project')
        return
      }

      // Get all scenes for this timeline
      const { data: scenes, error: scenesError } = await getSupabaseClient()
        .from('scenes')
        .select('id, name, metadata, order_index')
        .eq('timeline_id', timeline.id)
        .eq('user_id', userId)
        .order('order_index', { ascending: true })

      if (scenesError || !scenes || scenes.length === 0) {
        console.log('No scenes found for timeline')
        return
      }

      // Get scripts for each scene using a batch query
      const sceneIds = scenes.map(s => s.id)
      const { data: sceneScripts, error: scriptsError } = await getSupabaseClient()
        .from('assets')
        .select('*')
        .in('scene_id', sceneIds)
        .eq('content_type', 'script')
        .eq('user_id', userId)
        .eq('is_latest_version', true)
        .order('created_at', { ascending: false })

      if (scriptsError) {
        console.error('Error fetching scene scripts:', scriptsError)
        return
      }

      if (sceneScripts && sceneScripts.length > 0) {
        setScriptAssets(sceneScripts as Asset[])
        
        // Combine scripts in scene order
        const combinedScript = scenes
          .map(scene => {
            const sceneScript = sceneScripts.find((s: any) => s.scene_id === scene.id)
            if (!sceneScript) return null
            
            const sceneNumber = scene.metadata?.sceneNumber || scene.name
            const content = sceneScript.content || ""
            return `\n\n=== SCENE ${sceneNumber}: ${scene.name} ===\n\n${content}`
          })
          .filter(Boolean)
          .join("\n\n")
        
        setScriptContent(combinedScript)
      }
    } catch (error) {
      console.error('Error fetching scripts from scenes:', error)
    }
  }

  // Generate treatment from script using AI
  const generateTreatmentFromScript = async () => {
    if (!treatment || !scriptContent || scriptContent.trim().length === 0) {
      toast({
        title: "Error",
        description: "No script content available to generate treatment from.",
        variant: "destructive",
      })
      return
    }

    if (!ready || !user || !userId) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating treatment.",
        variant: "destructive",
      })
      return
    }

    if (!aiSettingsLoaded) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return
    }

    // Use locked model if available, otherwise use selected service
    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    
    if (!serviceToUse) {
      toast({
        title: "AI Service Not Configured",
        description: "Please configure your AI settings in Settings → AI Settings. You need to set up an OpenAI or Anthropic API key.",
        variant: "destructive",
      })
      return
    }

    // Normalize service name
    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             serviceToUse.toLowerCase().includes('gemini') || serviceToUse.toLowerCase().includes('google') ? 'google' : 
                             'openai'

    if (normalizedService === 'google') {
      toast({
        title: "Service Not Available",
        description: "Google Gemini is not currently configured. Please use OpenAI or Anthropic.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGeneratingTreatmentFromScript(true)

      // Limit script content to avoid token limits (use first 8000 characters for better context)
      const scriptForPrompt = scriptContent.length > 8000 
        ? scriptContent.substring(0, 8000) + '\n\n[... script continues ...]'
        : scriptContent

      const aiPrompt = `Write a comprehensive movie treatment based on the following screenplay script.

REQUIREMENTS:
- Create a full treatment document (similar to a professional pitch document)
- Structure should include:
  * Title (use the movie title if available)
  * Logline (one-sentence summary)
  * Synopsis (2-3 paragraphs summarizing the story)
  * Characters (brief descriptions of main characters)
  * Themes (key themes and messages)
  * Visual Style (cinematic approach and tone)
  * Key Scenes (brief descriptions of important scenes)
- Write in present tense, third person
- Be detailed and cinematic in description
- Focus on story structure, character arcs, and narrative flow
- Include genre and tone descriptions
- NO markdown formatting (no #, *, **, etc.)
- Write as a professional treatment document that could be used for pitching

Script to analyze:
${scriptForPrompt}

Treatment:`

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'treatment',
          service: normalizedService,
          apiKey: 'configured',
          userId: userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate treatment')
      }

      const result = await response.json()

      if (result.success && result.text) {
        // Update the treatment prompt field with the generated treatment
        const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
          prompt: result.text.trim(),
        })

        setTreatment(updatedTreatment)
        
        toast({
          title: "Treatment Generated!",
          description: "AI has generated a treatment from the script.",
        })
      } else {
        throw new Error('No treatment text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate treatment from script:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('API key not configured') || errorMessage.includes('API key')) {
        toast({
          title: "API Key Required",
          description: "Please set up your OpenAI or Anthropic API key in Settings → AI Settings.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Generation Failed",
          description: `Failed to generate treatment: ${errorMessage}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsGeneratingTreatmentFromScript(false)
    }
  }

  const handleDelete = async () => {
    if (!treatment || !confirm('Are you sure you want to delete this treatment?')) return
    
    try {
      setIsDeleting(true)
      await TreatmentsService.deleteTreatment(treatment.id)
      toast({
        title: "Success",
        description: "Treatment deleted successfully",
      })
      router.push('/treatments')
    } catch (error) {
      console.error('Error deleting treatment:', error)
      toast({
        title: "Error",
        description: "Failed to delete treatment",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStartEditTreatment = () => {
    if (!treatment) return
    setEditingTreatmentData({
      target_audience: treatment.target_audience || '',
      estimated_budget: treatment.estimated_budget || '',
      estimated_duration: treatment.estimated_duration || '',
    })
    setIsEditingTreatment(true)
  }

  const handleCancelEditTreatment = () => {
    setIsEditingTreatment(false)
    setEditingTreatmentData({
      target_audience: '',
      estimated_budget: '',
      estimated_duration: '',
    })
  }

  const handleSaveTreatment = async () => {
    if (!treatment) return

    try {
      setIsSavingTreatment(true)
      const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
        target_audience: editingTreatmentData.target_audience || undefined,
        estimated_budget: editingTreatmentData.estimated_budget || undefined,
        estimated_duration: editingTreatmentData.estimated_duration || undefined,
      })
      
      setTreatment(updatedTreatment)
      setIsEditingTreatment(false)
      
      toast({
        title: "Success",
        description: "Treatment updated successfully",
      })
    } catch (error) {
      console.error('Error updating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to update treatment",
        variant: "destructive",
      })
    } finally {
      setIsSavingTreatment(false)
    }
  }

  const handleStartEditSynopsis = () => {
    if (!treatment) return
    setEditingSynopsis(treatment.synopsis || '')
    setIsEditingSynopsis(true)
  }

  const handleCancelEditSynopsis = () => {
    setIsEditingSynopsis(false)
    setEditingSynopsis('')
  }

  const handleSaveSynopsis = async () => {
    if (!treatment) return

    try {
      setIsSavingSynopsis(true)
      const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
        synopsis: editingSynopsis,
      })
      
      setTreatment(updatedTreatment)
      setIsEditingSynopsis(false)
      
      toast({
        title: "Success",
        description: "Synopsis updated successfully",
      })
    } catch (error) {
      console.error('Error updating synopsis:', error)
      toast({
        title: "Error",
        description: "Failed to update synopsis",
        variant: "destructive",
      })
    } finally {
      setIsSavingSynopsis(false)
    }
  }

  const handleStartEditPrompt = () => {
    if (!treatment) return
    setEditingPrompt(treatment.prompt || '')
    setIsEditingPrompt(true)
  }

  const handleCancelEditPrompt = () => {
    setIsEditingPrompt(false)
    setEditingPrompt('')
  }

  const handleSavePrompt = async () => {
    if (!treatment) return

    try {
      setIsSavingPrompt(true)
      const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
        prompt: editingPrompt,
      })
      
      setTreatment(updatedTreatment)
      setIsEditingPrompt(false)
      
      toast({
        title: "Success",
        description: "Treatment updated successfully",
      })
    } catch (error) {
      console.error('Error updating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to update treatment",
        variant: "destructive",
      })
    } finally {
      setIsSavingPrompt(false)
    }
  }

  // Generate AI Synopsis from treatment content
  const generateAISynopsis = async () => {
    if (isGeneratingSynopsis) return
    
    if (!treatment) {
      toast({
        title: "Error",
        description: "Treatment not loaded",
        variant: "destructive",
      })
      return
    }

    // Check if treatment has content to generate from
    const treatmentContent = treatment.prompt || treatment.synopsis || treatment.logline
    if (!treatmentContent || !treatmentContent.trim()) {
      toast({
        title: "Missing Content",
        description: "Treatment needs content (prompt, synopsis, or logline) to generate a new synopsis.",
        variant: "destructive",
      })
      return
    }

    if (!user || !userId) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating synopsis.",
        variant: "destructive",
      })
      return
    }

    if (!aiSettingsLoaded) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return
    }

    // Use locked model if available, otherwise use selected service
    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    
    if (!serviceToUse) {
      toast({
        title: "AI Service Not Configured",
        description: "Please configure your AI settings in Settings → AI Settings. You need to set up an OpenAI or Anthropic API key.",
        variant: "destructive",
      })
      return
    }

    // Normalize service name
    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             serviceToUse.toLowerCase().includes('gemini') || serviceToUse.toLowerCase().includes('google') ? 'google' : 
                             'openai' // Default to OpenAI

    if (normalizedService === 'google') {
      toast({
        title: "Service Not Available",
        description: "Google Gemini is not currently configured. Please use OpenAI or Anthropic.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGeneratingSynopsis(true)

      // Create prompt from treatment content
      // Use prompt if available, otherwise use synopsis or logline
      const sourceText = treatment.prompt || treatment.synopsis || treatment.logline || ''
      
      // Clean the text (remove markdown, normalize)
      const cleanedText = sourceText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      // Limit to first 2000 characters to avoid token limits
      const contentForPrompt = cleanedText.length > 2000 
        ? cleanedText.substring(0, 2000) + '...'
        : cleanedText

      const aiPrompt = `Write a brief movie synopsis (2-3 paragraphs, 150-300 words) based on the treatment content below.

REQUIREMENTS:
- Summarize the MAIN STORY in 2-3 paragraphs only
- Focus on: who is the protagonist, what is their goal, what is the central conflict
- Write in third person, present tense
- Engaging and cinematic tone
- NO markdown formatting
- NO scene breakdowns
- NO character backstories
- NO production details
- NO plot expansion - just summarize what's already there

CRITICAL: This is a SYNOPSIS (brief summary), NOT a full treatment. Keep it short and focused.

Treatment content to summarize:
${contentForPrompt}

Synopsis (2-3 paragraphs only):`

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'synopsis',
          service: normalizedService,
          apiKey: 'configured', // Server will fetch from user's database or use environment variables
          userId: userId, // Pass userId so server can fetch user's API keys
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate synopsis')
      }

      const result = await response.json()

      if (result.success && result.text) {
        // Update the synopsis directly
        const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
          synopsis: result.text.trim(),
        })

        setTreatment(updatedTreatment)
        
        toast({
          title: "Synopsis Generated!",
          description: "AI has generated a new synopsis from your treatment content.",
        })
      } else {
        throw new Error('No synopsis text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI synopsis:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Provide helpful error message if API key is missing
      if (errorMessage.includes('API key not configured') || errorMessage.includes('API key')) {
        toast({
          title: "API Key Required",
          description: "Please set up your OpenAI or Anthropic API key in Settings → AI Settings. Click here to go to settings.",
          variant: "destructive",
        })
        // Navigate to settings after a short delay
        setTimeout(() => {
          if (confirm('Would you like to go to AI Settings to configure your API key?')) {
            router.push('/settings-ai')
          }
        }, 1000)
      } else {
        toast({
          title: "Generation Failed",
          description: `Failed to generate synopsis: ${errorMessage}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsGeneratingSynopsis(false)
    }
  }

  // Upload generated image to Supabase storage
  const uploadGeneratedImageToStorage = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      console.log('Uploading generated treatment cover to Supabase storage...')
      
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

  // Quick generate AI cover from treatment content
  const generateQuickAICover = async () => {
    if (!treatment) {
      toast({
        title: "Error",
        description: "Treatment not loaded",
        variant: "destructive",
      })
      return
    }

    if (!ready || !user || !userId) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating images.",
        variant: "destructive",
      })
      return
    }

    // Check if treatment has content to generate from
    const hasContent = treatment.synopsis || treatment.prompt || treatment.logline || treatment.title
    if (!hasContent) {
      toast({
        title: "Missing Content",
        description: "Treatment needs content (title, synopsis, prompt, or logline) to generate a cover.",
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
        description: "No AI service selected. Please configure your AI settings.",
        variant: "destructive",
      })
      return
    }

    // Normalize service name
    const normalizedService = serviceToUse.toLowerCase().includes('dall') ? 'dalle' : 
                             serviceToUse.toLowerCase().includes('openart') ? 'openart' : 
                             serviceToUse.toLowerCase().includes('leonardo') ? 'leonardo' : 
                             'dalle'

    try {
      setIsGeneratingCover(true)

      // Extract key information from treatment for movie cover
      const title = treatment.title || 'Movie'
      const genre = treatment.genre || ''
      
      // Helper function to build prompt with content summary
      const buildPrompt = (contentSummary: string) => {
        let movieCoverPrompt = `Movie Cover for "${title}"`
        
        if (genre) {
          movieCoverPrompt += `, ${genre} genre`
        }
        
        if (contentSummary) {
          movieCoverPrompt += `. ${contentSummary}`
        }
        
        // Add movie cover specific styling - no text, no poster design elements
        movieCoverPrompt += `. Professional movie cover, cinematic style, high quality, dramatic lighting, no text, no words, visual only`

        // Limit prompt length (DALL-E 3 has 1000 character limit)
        if (movieCoverPrompt.length > 900) {
          movieCoverPrompt = movieCoverPrompt.substring(0, 900)
        }
        
        return movieCoverPrompt
      }

      // Helper function to generate image with a given prompt
      const generateWithPrompt = async (prompt: string, isRetry: boolean = false) => {
        const response = await fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt,
            service: normalizedService,
            apiKey: 'configured',
            userId: user.id,
            autoSaveToBucket: true,
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.error || 'Unknown error'
          
          // Check for server errors (500, 502, 503, 504)
          if (response.status >= 500) {
            throw new Error('OpenAI server is temporarily unavailable. Please try again in a moment.')
          }
          
          // Check for content policy violations - if this is the first attempt and we have synopsis, retry with synopsis
          if (!isRetry && 
              (errorMessage.toLowerCase().includes('content policy') || 
               errorMessage.toLowerCase().includes('safety') ||
               errorMessage.toLowerCase().includes('content_filter')) &&
              treatment.synopsis) {
            // Retry with synopsis only
            console.log('Content policy violation detected, retrying with synopsis only...')
            const synopsisSummary = treatment.synopsis
              .replace(/\*\*/g, '')
              .replace(/\*/g, '')
              .replace(/\n/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 150)
            
            const fallbackPrompt = buildPrompt(synopsisSummary)
            console.log('Retrying with synopsis-based prompt:', fallbackPrompt)
            return generateWithPrompt(fallbackPrompt, true)
          }
          
          // Check for content policy violations (on retry or no synopsis available)
          if (errorMessage.toLowerCase().includes('content policy') || 
              errorMessage.toLowerCase().includes('safety') ||
              errorMessage.toLowerCase().includes('content_filter')) {
            throw new Error('Content may contain material that cannot be generated. Please modify your treatment content.')
          }
          
          // Check for API key errors
          if (errorMessage.toLowerCase().includes('api key') || 
              errorMessage.toLowerCase().includes('authentication') ||
              errorMessage.toLowerCase().includes('unauthorized') ||
              response.status === 401) {
            throw new Error('API key error. Please check your OpenAI API key in Settings → AI Settings.')
          }
          
          throw new Error(`Image generation failed: ${errorMessage}`)
        }

        return response
      }

      // Get a brief summary from synopsis, logline, or prompt (prioritize logline)
      let contentSummary = ''
      if (treatment.logline) {
        // Logline is perfect for a movie cover - it's already concise
        contentSummary = treatment.logline
      } else if (treatment.synopsis) {
        // Use first sentence or first 100 characters of synopsis
        const cleaned = treatment.synopsis
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const firstSentence = cleaned.split(/[.!?]/)[0]
        contentSummary = (firstSentence && firstSentence.length > 0 && firstSentence.length < 150) 
          ? firstSentence 
          : cleaned.substring(0, 150)
      } else if (treatment.prompt) {
        // Use first 150 characters of prompt
        contentSummary = treatment.prompt
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 150)
      }

      // Build initial prompt
      const movieCoverPrompt = buildPrompt(contentSummary)
      console.log('Generating movie cover with prompt:', movieCoverPrompt)

      // Generate image (with automatic retry on content policy violations)
      const response = await generateWithPrompt(movieCoverPrompt)

      const data = await response.json()
      const imageUrl = data.imageUrl

      if (imageUrl) {
        // Upload to Supabase storage
        try {
          const fileName = `treatment-cover-${treatment.id}-${Date.now()}`
          const supabaseUrl = await uploadGeneratedImageToStorage(imageUrl, fileName)
          
          // Update treatment with new cover
          const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
            cover_image_url: supabaseUrl,
          })
          
          setTreatment(updatedTreatment)
          setGeneratedCoverUrl(supabaseUrl)
          
          toast({
            title: "Movie Cover Generated!",
            description: `Cover generated and saved using ${normalizedService.toUpperCase()}`,
          })
        } catch (uploadError) {
          console.error('Failed to upload cover to Supabase:', uploadError)
          // Still set the temporary URL so user can see the generated image
          setGeneratedCoverUrl(imageUrl)
          toast({
            title: "Cover Generated (Upload Failed)",
            description: "Cover generated but failed to upload to storage. Please try again.",
            variant: "destructive",
          })
        }
      } else {
        throw new Error('No image URL received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI cover:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Show appropriate error message based on error type
      if (errorMessage.includes('temporarily unavailable')) {
        toast({
          title: "Server Temporarily Unavailable",
          description: "OpenAI's servers are experiencing issues. Please try again in a few moments.",
          variant: "destructive",
        })
      } else if (errorMessage.includes('API key')) {
        toast({
          title: "API Key Error",
          description: errorMessage,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Generation Failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setIsGeneratingCover(false)
    }
  }

  // Handle cover image upload
  const handleCoverUpload = async (file: File) => {
    if (!treatment || !user || !userId) return

    try {
      setIsGeneratingCover(true)
      
      // Generate unique filename
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop() || 'png'
      const safeFileName = sanitizeFilename(file.name)
      const fileName = `treatment-cover-${treatment.id}-${timestamp}.${fileExtension}`
      const filePath = `${userId}/images/${fileName}`
      
      // Upload to Supabase storage
      const supabase = getSupabaseClient()
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cinema_files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/png'
        })

      if (uploadError) {
        console.error('Supabase upload error:', uploadError)
        throw new Error(`Failed to upload image: ${uploadError.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('cinema_files')
        .getPublicUrl(filePath)

      if (urlData?.publicUrl) {
        // Update treatment with new cover
        const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
          cover_image_url: urlData.publicUrl,
        })
        
        setTreatment(updatedTreatment)
        setIsEditingCover(false)
        
        toast({
          title: "Cover Updated!",
          description: "Cover image has been uploaded successfully.",
        })
      } else {
        throw new Error('Failed to get public URL')
      }
    } catch (error) {
      console.error('Error uploading cover:', error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload cover image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingCover(false)
    }
  }

  // Handle cover URL update (for manual URL entry)
  const handleCoverUrlSave = async (url: string) => {
    if (!treatment) return

    try {
      setIsGeneratingCover(true)
      const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
        cover_image_url: url,
      })
      
      setTreatment(updatedTreatment)
      setIsEditingCover(false)
      
      toast({
        title: "Cover Updated!",
        description: "Cover image has been updated successfully.",
      })
    } catch (error) {
      console.error('Error updating cover URL:', error)
      toast({
        title: "Update Failed",
        description: "Failed to update cover image.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingCover(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'in-progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Please log in to view treatments</h1>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading treatment...</p>
          </div>
        </div>
      </>
    )
  }

  if (!treatment) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Treatment not found</h1>
            <Button asChild>
              <Link href="/treatments">Back to Treatments</Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/treatments" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Treatments
            </Link>
          </Button>
        </div>

        {/* Treatment Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{treatment.title}</h1>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {treatment.genre}
                </Badge>
                <Badge className={`text-lg px-3 py-1 ${getStatusColor(treatment.status)}`}>
                  {treatment.status.replace('-', ' ')}
                </Badge>
                {treatment.project_id && movie && (
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    <Film className="h-3 w-3 mr-1" />
                    Linked to: {movie.name}
                  </Badge>
                )}
              </div>
              {treatment.project_id && movie && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/screenplay/${movie.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Screenplay
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>

        {/* Cover Image */}
          <Card className="mb-8 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Cover Image
              </CardTitle>
              <div className="flex items-center gap-2">
                {!isEditingCover ? (
                  <>
                    {/* Quick Generate AI Button */}
                    {(treatment.synopsis || treatment.prompt || treatment.logline || treatment.title) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateQuickAICover}
                        disabled={isGeneratingCover || !aiSettingsLoaded}
                        className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      >
                        {isGeneratingCover ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Quick Generate AI
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingCover(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {treatment.cover_image_url ? 'Edit' : 'Add Cover'}
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditingCover(false)
                        setGeneratedCoverUrl('')
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isEditingCover ? (
              <div className="space-y-4">
                {/* File Upload */}
                <div>
                  <Label htmlFor="cover-upload">Upload Image</Label>
                  <Input
                    id="cover-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleCoverUpload(file)
                      }
                    }}
                    disabled={isGeneratingCover}
                    className="mt-2"
                  />
                </div>
                {/* URL Input */}
                <div>
                  <Label htmlFor="cover-url">Or Enter Image URL</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="cover-url"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      onChange={(e) => setGeneratedCoverUrl(e.target.value)}
                      disabled={isGeneratingCover}
                    />
                    <Button
                      onClick={() => {
                        if (generatedCoverUrl) {
                          handleCoverUrlSave(generatedCoverUrl)
                        }
                      }}
                      disabled={isGeneratingCover || !generatedCoverUrl}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {treatment.cover_image_url ? (
                  <div className="relative h-64 md:h-80 bg-muted rounded-lg overflow-hidden">
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
                  <Film className="h-16 w-16 mx-auto mb-4" />
                  <p className="text-lg">Cover Image</p>
                </div>
              </div>
            </div>
                ) : (
                  <div className="border-2 border-dashed border-muted rounded-lg p-12 text-center">
                    <ImageIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">No cover image</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add a cover image or generate one with AI
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
          </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Synopsis */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Synopsis
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {!isEditingSynopsis ? (
                      <>
                        {/* Quick Listen Button */}
                        {treatment.synopsis && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => {
                              // Scroll to the text-to-speech component
                              const ttsElement = document.querySelector('[data-tts-synopsis]')
                              if (ttsElement) {
                                ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                            }}
                          >
                            <Volume2 className="h-4 w-4 mr-2" />
                            Listen
                          </Button>
                        )}
                        {/* AI Regenerate Button - Show when treatment has content */}
                        {(treatment.prompt || treatment.synopsis || treatment.logline) && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={generateAISynopsis}
                            disabled={isGeneratingSynopsis || !aiSettingsLoaded}
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                            title="Generate new synopsis from treatment content using AI"
                          >
                            {isGeneratingSynopsis ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                AI Regenerate
                              </>
                            )}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleStartEditSynopsis}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancelEditSynopsis}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSaveSynopsis} disabled={isSavingSynopsis}>
                          <Save className="h-4 w-4 mr-2" />
                          {isSavingSynopsis ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isEditingSynopsis ? (
                    <Textarea
                      value={editingSynopsis}
                      onChange={(e) => setEditingSynopsis(e.target.value)}
                      placeholder="Enter synopsis..."
                      rows={8}
                      className="text-lg leading-relaxed"
                    />
                  ) : (
                    <>
                      {treatment.synopsis ? (
                    <>
                      <p className="text-lg leading-relaxed whitespace-pre-wrap">{treatment.synopsis}</p>
                      
                      {/* Text to Speech Component */}
                      <div data-tts-synopsis>
                        <TextToSpeech 
                          text={treatment.synopsis}
                          title={`${treatment.title} - Synopsis`}
                          projectId={treatment.project_id}
                          sceneId={null}
                              treatmentId={treatment.id}
                          className="mt-4"
                        />
                      </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground italic">No synopsis provided</p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Script from Movie (if available) - Collapsible */}
            {treatment.project_id && (
              <Collapsible open={isScriptExpanded} onOpenChange={setIsScriptExpanded}>
                <Card>
                  <CardHeader className="pb-3">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isScriptExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 text-blue-500" />
                            Script from Movie
                          </CardTitle>
                        </div>
                        {!treatment.prompt && scriptContent && !isLoadingScript && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              generateTreatmentFromScript()
                            }}
                            disabled={isGeneratingTreatmentFromScript || !aiSettingsLoaded || !scriptContent}
                            className="bg-purple-500 hover:bg-purple-600 text-white"
                          >
                            {isGeneratingTreatmentFromScript ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate Treatment
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CardDescription className="pt-1 pl-6">
                      {scriptContent 
                        ? "Script content from the linked movie project"
                        : isLoadingScript 
                        ? "Fetching script content..."
                        : "Click to view script from linked movie project"}
                    </CardDescription>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="space-y-4">
                        {isLoadingScript ? (
                          <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">Loading script from movie project...</p>
                          </div>
                        ) : scriptContent ? (
                          <>
                            <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                              <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                                {scriptContent.length > 2000 
                                  ? scriptContent.substring(0, 2000) + '\n\n... (script truncated for display)'
                                  : scriptContent}
                              </pre>
                            </div>
                            {scriptContent.length > 2000 && (
                              <p className="text-xs text-muted-foreground text-center">
                                Script preview (showing first 2000 characters). Full script will be used for treatment generation.
                              </p>
                            )}
                            {!treatment.prompt && (
                              <div className="border-t pt-4">
                                <p className="text-sm text-muted-foreground mb-2">
                                  No treatment document exists yet. Click "Generate Treatment" above to create one from this script.
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground mb-2">No script found</p>
                            <p className="text-sm text-muted-foreground">
                              No script assets found for this movie project. Upload a script to the movie project first.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Treatment (Full Document) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      Treatment
                    </CardTitle>
                    <CardDescription>Full treatment document - paste your complete treatment here (matches ideas.prompt field)</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditingPrompt ? (
                      <>
                        {treatment.prompt && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => {
                              const ttsElement = document.querySelector('[data-tts-prompt]')
                              if (ttsElement) {
                                ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                            }}
                          >
                            <Volume2 className="h-4 w-4 mr-2" />
                            Listen
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleStartEditPrompt}>
                          <Edit className="h-4 w-4 mr-2" />
                          {treatment.prompt ? 'Edit' : 'Add Treatment'}
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancelEditPrompt}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSavePrompt} disabled={isSavingPrompt}>
                          <Save className="h-4 w-4 mr-2" />
                          {isSavingPrompt ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isEditingPrompt ? (
                    <Textarea
                      value={editingPrompt}
                      onChange={(e) => setEditingPrompt(e.target.value)}
                      placeholder="Paste your full treatment document here. This is the complete treatment (like ideas.prompt), separate from the synopsis above."
                      rows={25}
                      className="text-base leading-relaxed font-mono min-h-[500px]"
                    />
                  ) : (
                    <>
                      {treatment.prompt ? (
                        <div className="space-y-4">
                          <p className="text-base leading-relaxed whitespace-pre-wrap font-mono">{treatment.prompt}</p>
                          
                          {/* Text to Speech Component */}
                          <div data-tts-prompt>
                            <TextToSpeech 
                              text={treatment.prompt}
                              title={`${treatment.title} - Treatment`}
                              projectId={treatment.project_id}
                              sceneId={null}
                              treatmentId={treatment.id}
                              className="mt-4"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
                          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground mb-2">No treatment document yet</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            Click "Add Treatment" to paste your full treatment document
                          </p>
                          <Button variant="outline" onClick={handleStartEditPrompt}>
                            <Edit className="h-4 w-4 mr-2" />
                            Add Treatment
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Treatment Details Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-500" />
                      Treatment Details
                    </CardTitle>
                    <CardDescription>Project information and metadata</CardDescription>
                  </div>
                  {!isEditingTreatment ? (
                    <Button variant="outline" size="sm" onClick={handleStartEditTreatment}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelEditTreatment}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={handleSaveTreatment} disabled={isSavingTreatment}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSavingTreatment ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Project Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium text-sm">Target Audience</Label>
                      </div>
                      {isEditingTreatment ? (
                        <Input
                          value={editingTreatmentData.target_audience}
                          onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, target_audience: e.target.value }))}
                          placeholder="e.g., 18-35"
                          className="ml-6"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground pl-6">
                          {treatment.target_audience || 'Not specified'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium text-sm">Estimated Budget</Label>
                      </div>
                      {isEditingTreatment ? (
                        <Input
                          value={editingTreatmentData.estimated_budget}
                          onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, estimated_budget: e.target.value }))}
                          placeholder="e.g., $10M"
                          className="ml-6"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground pl-6">
                          {treatment.estimated_budget || 'Not specified'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium text-sm">Estimated Duration</Label>
                      </div>
                      {isEditingTreatment ? (
                        <Input
                          value={editingTreatmentData.estimated_duration}
                          onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, estimated_duration: e.target.value }))}
                          placeholder="e.g., 120 min"
                          className="ml-6"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground pl-6">
                          {treatment.estimated_duration || 'Not specified'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status and Genre */}
                  <div className="flex items-center gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm font-medium mb-1">Status</p>
                      <Badge className={getStatusColor(treatment.status)}>
                        {treatment.status.replace('-', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Genre</p>
                      <Badge variant="outline">{treatment.genre}</Badge>
                    </div>
                    {treatment.project_id && movie && (
                      <div>
                        <p className="text-sm font-medium mb-1">Movie Project</p>
                        <Badge variant="secondary">
                          <Film className="h-3 w-3 mr-1" />
                          {movie.name}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium mb-1">Created</p>
                        <p className="text-muted-foreground">
                          {new Date(treatment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Last Updated</p>
                        <p className="text-muted-foreground">
                          {new Date(treatment.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logline */}
            {treatment.logline && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Logline</CardTitle>
                      <CardDescription>One-sentence summary</CardDescription>
                    </div>
                    {/* Quick Listen Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        const ttsElement = document.querySelector('[data-tts-logline]')
                        if (ttsElement) {
                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Listen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-lg font-medium italic">"{treatment.logline}"</p>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-logline>
                      <TextToSpeech 
                        text={treatment.logline}
                        title={`${treatment.title} - Logline`}
                        projectId={treatment.project_id}
                        sceneId={null}
                        treatmentId={treatment.id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Characters */}
            {treatment.characters && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Characters</CardTitle>
                    {/* Quick Listen Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        const ttsElement = document.querySelector('[data-tts-characters]')
                        if (ttsElement) {
                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Listen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="whitespace-pre-line">{treatment.characters}</p>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-characters>
                      <TextToSpeech 
                        text={treatment.characters}
                        title={`${treatment.title} - Characters`}
                        projectId={treatment.project_id}
                        sceneId={null}
                        treatmentId={treatment.id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Themes */}
            {treatment.themes && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Themes</CardTitle>
                    {/* Quick Listen Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        const ttsElement = document.querySelector('[data-tts-themes]')
                        if (ttsElement) {
                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Listen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="whitespace-pre-line">{treatment.themes}</p>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-themes>
                      <TextToSpeech 
                        text={treatment.themes}
                        title={`${treatment.title} - Themes`}
                        projectId={treatment.project_id}
                        sceneId={null}
                        treatmentId={treatment.id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Visual References */}
            {treatment.visual_references && (
              <Card>
                <CardHeader>
                  <CardTitle>Visual References</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{treatment.visual_references}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {treatment.notes && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Notes</CardTitle>
                    {/* Quick Listen Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => {
                        const ttsElement = document.querySelector('[data-tts-notes]')
                        if (ttsElement) {
                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Listen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="whitespace-pre-line">{treatment.notes}</p>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-notes>
                      <TextToSpeech 
                        text={treatment.notes}
                        title={`${treatment.title} - Notes`}
                        projectId={treatment.project_id}
                        sceneId={null}
                        treatmentId={treatment.id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Project Details */}
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Target Audience</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.target_audience || 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Estimated Budget</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.estimated_budget || 'Not specified'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Estimated Duration</p>
                    <p className="text-sm text-muted-foreground">
                      {treatment.estimated_duration || 'Not specified'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(treatment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(treatment.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Treatment
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View in Timeline
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <Film className="h-4 w-4 mr-2" />
                  Create Movie Project
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
