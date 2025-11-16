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
import { ArrowLeft, Edit, Trash2, FileText, Clock, Calendar, User, Users, Target, DollarSign, Film, Eye, Volume2, Save, X, Sparkles, Loader2, ImageIcon, Upload, Download, Zap, ChevronDown, ChevronUp, Plus, RefreshCw, ListFilter } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TreatmentScenesService, type TreatmentScene, type CreateTreatmentSceneData } from '@/lib/treatment-scenes-service'
import { CastingService, type CastingSetting } from '@/lib/casting-service'
import { TimelineService } from '@/lib/timeline-service'
import { OpenAIService } from '@/lib/ai-services'

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
    status: 'draft',
    genre: '',
  })
  const [isSavingTreatment, setIsSavingTreatment] = useState(false)
  const [isEditingSynopsis, setIsEditingSynopsis] = useState(false)
  const [editingSynopsis, setEditingSynopsis] = useState('')
  const [isSavingSynopsis, setIsSavingSynopsis] = useState(false)
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState('')
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false)
  const [isGeneratingLogline, setIsGeneratingLogline] = useState(false)
  const [isGeneratingTreatment, setIsGeneratingTreatment] = useState(false)
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
  
  // Treatment scenes states
  const [treatmentScenes, setTreatmentScenes] = useState<TreatmentScene[]>([])
  const [isLoadingScenes, setIsLoadingScenes] = useState(false)
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingScene, setEditingScene] = useState<Partial<TreatmentScene>>({})
  const [isSavingScene, setIsSavingScene] = useState(false)
  const [isRegeneratingScene, setIsRegeneratingScene] = useState<string | null>(null)
  const [isClearingScenes, setIsClearingScenes] = useState(false)
  // Characters and casting states
  const [castingSettings, setCastingSettings] = useState<CastingSetting | null>(null)
  const [charactersFilter, setCharactersFilter] = useState<string>("")
  const [newCharacterRole, setNewCharacterRole] = useState<string>("")
  const [isSyncingRoles, setIsSyncingRoles] = useState(false)

  useEffect(() => {
    if (id) {
      loadTreatment(id as string)
    }
  }, [id])

  useEffect(() => {
    if (treatment?.id) {
      loadTreatmentScenes(treatment.id)
    }
  }, [treatment?.id])

  // Load casting settings when project_id available
  useEffect(() => {
    const loadCasting = async () => {
      if (!treatment?.project_id) {
        setCastingSettings(null)
        return
      }
      try {
        const settings = await CastingService.getCastingSettings(treatment.project_id)
        setCastingSettings(settings)
      } catch (e) {
        console.error('Failed loading casting settings:', e)
      }
    }
    loadCasting()
  }, [treatment?.project_id])

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

  // Clear all treatment scenes
  const clearAllScenes = async () => {
    if (!treatment) return
    if (treatmentScenes.length === 0) return
    if (!confirm('Are you sure you want to delete ALL scenes for this treatment? This cannot be undone.')) {
      return
    }
    try {
      setIsClearingScenes(true)
      // Delete sequentially to avoid DB rate limits; still fast for typical counts
      for (const scene of treatmentScenes) {
        await TreatmentScenesService.deleteTreatmentScene(scene.id)
      }
      setTreatmentScenes([])
      toast({
        title: "Scenes Cleared",
        description: "All treatment scenes have been deleted.",
      })
    } catch (error) {
      console.error('Failed to clear scenes:', error)
      toast({
        title: "Error",
        description: "Failed to clear scenes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsClearingScenes(false)
    }
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
      status: (treatment.status as any) || 'draft',
      genre: treatment.genre || '',
    })
    setIsEditingTreatment(true)
  }

  const handleCancelEditTreatment = () => {
    setIsEditingTreatment(false)
    setEditingTreatmentData({
      target_audience: '',
      estimated_budget: '',
      estimated_duration: '',
      status: 'draft',
      genre: '',
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
        status: (editingTreatmentData.status as any) || undefined,
        genre: editingTreatmentData.genre || undefined,
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

  // Generate AI Logline from treatment content
  const generateAILogline = async () => {
    if (isGeneratingLogline) return
    
    if (!treatment) {
      toast({
        title: "Error",
        description: "Treatment not loaded",
        variant: "destructive",
      })
      return
    }

    // Check if treatment has content to generate from
    const treatmentContent = treatment.prompt || treatment.synopsis || treatment.title
    if (!treatmentContent || !treatmentContent.trim()) {
      toast({
        title: "Missing Content",
        description: "Treatment needs content (prompt, synopsis, or title) to generate a logline.",
        variant: "destructive",
      })
      return
    }

    if (!user || !userId) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating a logline.",
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
      setIsGeneratingLogline(true)

      // Build content source
      const sourceText = treatment.prompt || treatment.synopsis || treatment.title || ''
      const cleanedText = sourceText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      const contentForPrompt = cleanedText.length > 1200 
        ? cleanedText.substring(0, 1200) + '...'
        : cleanedText

      const aiPrompt = `Write a single-sentence movie logline based on the following treatment content.

REQUIREMENTS:
- Exactly 1 sentence, 20-35 words
- Clearly state protagonist, goal, central conflict/stakes
- Present tense, cinematic, concise
- No character names unless iconic; use roles (e.g., "a cynical detective")
- No markdown, no quotes, no extra commentary

Treatment content:
${contentForPrompt}

Logline (one sentence only):`

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'logline',
          service: normalizedService,
          apiKey: 'configured',
          userId: userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate logline')
      }

      const result = await response.json()

      if (result.success && result.text) {
        const newLogline = result.text.trim().replace(/^"|"$/g, '')
        const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
          logline: newLogline,
        })

        setTreatment(updatedTreatment)
        
        toast({
          title: "Logline Generated!",
          description: "AI has generated a new logline.",
        })
      } else {
        throw new Error('No logline text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI logline:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('API key not configured') || errorMessage.includes('API key')) {
        toast({
          title: "API Key Required",
          description: "Please set up your OpenAI or Anthropic API key in Settings → AI Settings. Click here to go to settings.",
          variant: "destructive",
        })
        setTimeout(() => {
          if (confirm('Would you like to go to AI Settings to configure your API key?')) {
            router.push('/settings-ai')
          }
        }, 1000)
      } else {
        toast({
          title: "Generation Failed",
          description: `Failed to generate logline: ${errorMessage}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsGeneratingLogline(false)
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

  // Generate AI Treatment (full document) from existing content
  const generateAITreatment = async () => {
    if (isGeneratingTreatment) return
    
    if (!treatment) {
      toast({
        title: "Error",
        description: "Treatment not loaded",
        variant: "destructive",
      })
      return
    }

    // Use synopsis/logline/title as seed content. If a prompt exists, prefer that as input to improve result.
    const sourceContent = treatment.prompt || treatment.synopsis || treatment.logline || treatment.title
    if (!sourceContent || !sourceContent.trim()) {
      toast({
        title: "Missing Content",
        description: "Need at least a title, logline, synopsis, or existing treatment to generate.",
        variant: "destructive",
      })
      return
    }

    if (!user || !userId) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating a treatment.",
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

    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    if (!serviceToUse) {
      toast({
        title: "AI Service Not Configured",
        description: "Configure OpenAI or Anthropic in Settings → AI Settings.",
        variant: "destructive",
      })
      return
    }

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
      setIsGeneratingTreatment(true)

      const cleaned = sourceContent
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      const seed = cleaned.length > 4000 ? cleaned.substring(0, 4000) + '...' : cleaned

      const aiPrompt = `Write a professional film treatment based on the material below.

REQUIREMENTS:
- Length: 700-1200 words, 6-10 concise paragraphs
- Clear beginning, middle, end; strong arc and escalating stakes
- Third person, present tense; cinematic yet efficient prose
- Introduce protagonist(s), core conflict, antagonist or opposing force
- Focus on the spine of the story; avoid dialog, shot lists, and scene numbers
- No markdown formatting

Source material:
${seed}

Write the treatment now:`

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
        const newTreatment = result.text.trim()
        const updated = await TreatmentsService.updateTreatment(treatment.id, { prompt: newTreatment })
        setTreatment(updated)
        toast({
          title: "Treatment Generated!",
          description: "AI created a new full treatment document.",
        })
      } else {
        throw new Error('No treatment text received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI treatment:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('API key')) {
        toast({
          title: "API Key Required",
          description: "Please set up your OpenAI or Anthropic API key in Settings → AI Settings. Click here to go to settings.",
          variant: "destructive",
        })
        setTimeout(() => {
          if (confirm('Go to AI Settings to configure your API key?')) {
            router.push('/settings-ai')
          }
        }, 1000)
      } else {
        toast({
          title: "Generation Failed",
          description: `Failed to generate treatment: ${errorMessage}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsGeneratingTreatment(false)
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
  // Load treatment scenes
  const loadTreatmentScenes = async (treatmentId: string) => {
    if (!ready || !userId) return
    
    try {
      setIsLoadingScenes(true)
      const scenes = await TreatmentScenesService.getTreatmentScenes(treatmentId)
      setTreatmentScenes(scenes)
    } catch (error) {
      console.error('Error loading treatment scenes:', error)
      toast({
        title: "Error",
        description: "Failed to load scenes",
        variant: "destructive",
      })
    } finally {
      setIsLoadingScenes(false)
    }
  }

  // Generate scenes from treatment using AI
  const generateScenesFromTreatment = async () => {
    if (!treatment || !ready || !userId) return

    if (!aiSettingsLoaded) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return
    }

    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    
    if (!serviceToUse) {
      toast({
        title: "AI Service Not Configured",
        description: "Please configure your AI settings in Settings → AI Settings.",
        variant: "destructive",
      })
      return
    }

    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             'openai'

    try {
      setIsGeneratingScenes(true)

      const treatmentContent = treatment.prompt || treatment.synopsis || treatment.logline || ''
      const contentForPrompt = treatmentContent.length > 6000 
        ? treatmentContent.substring(0, 6000) + '...'
        : treatmentContent

      const aiPrompt = `Based on the following movie treatment, break it down into individual scene titles.

REQUIREMENTS:
- Analyze the treatment and create scene titles that naturally cover all the story beats
- Create as many scenes as needed to properly break down the story - let the content determine the number
- Each scene should have:
  * Scene number (e.g., "1", "2", "3")
  * Name/title (brief, descriptive, 2-5 words)

OUTPUT FORMAT: Return a JSON array of scenes. Each scene should be an object with ONLY these fields:
{
  "scene_number": "1",
  "name": "Opening Scene"
}

Treatment content:
${contentForPrompt}

Return ONLY the JSON array, no other text:`

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'scenes',
          service: normalizedService,
          apiKey: 'configured',
          userId: userId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate scenes')
      }

      const data = await response.json()
      let scenes: any[] = []

      // Try to parse JSON from response
      try {
        let jsonText = data.text || data.response || data.content || ''
        
        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        
        // Try to extract all complete JSON objects from the array (handles truncated responses)
        const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g
        const objectMatches = jsonText.match(objectPattern)
        
        if (objectMatches && objectMatches.length > 0) {
          // Try to parse each object individually
          scenes = []
          for (const objStr of objectMatches) {
            try {
              const parsedObj = JSON.parse(objStr)
              // Validate it has required fields
              if (parsedObj && (parsedObj.name || parsedObj.scene_number || parsedObj.description)) {
                scenes.push(parsedObj)
              }
            } catch (objError) {
              // Skip invalid objects
              console.warn('Skipping invalid scene object:', objError)
            }
          }
          
          if (scenes.length > 0) {
            // Successfully extracted scenes from individual objects
            console.log(`Extracted ${scenes.length} scenes from partial JSON response`)
          } else {
            throw new Error('No valid scene objects found')
          }
        } else {
          // Try to extract JSON array (complete or partial)
          let jsonMatch = jsonText.match(/\[[\s\S]*/)
          if (jsonMatch) {
            let arrayText = jsonMatch[0]
            
            // If array is incomplete, try to close it
            if (!arrayText.endsWith(']')) {
              // Find the last complete object and close the array
              const lastCompleteObj = arrayText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)
              if (lastCompleteObj && lastCompleteObj.length > 0) {
                // Reconstruct array with only complete objects
                arrayText = '[' + lastCompleteObj.join(',') + ']'
              } else {
                arrayText = arrayText + ']'
              }
            }
            
            try {
              scenes = JSON.parse(arrayText)
            } catch (arrayError) {
              // If array parsing fails, try extracting individual objects
              const objects = jsonText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || []
              scenes = objects.map(obj => {
                try {
                  return JSON.parse(obj)
                } catch {
                  return null
                }
              }).filter(Boolean)
            }
          } else {
            // Try to find single JSON object and wrap in array
            const objMatch = jsonText.match(/\{[\s\S]*\}/)
            if (objMatch) {
              scenes = [JSON.parse(objMatch[0])]
            } else {
              // Try parsing the whole text
              scenes = JSON.parse(jsonText)
            }
          }
        }
        
        // Ensure scenes is an array
        if (!Array.isArray(scenes)) {
          scenes = [scenes]
        }
        
        // Filter out any null or invalid scenes
        scenes = scenes.filter(s => s && (s.name || s.scene_number || s.description))
        
      } catch (parseError) {
        console.error('Error parsing scenes JSON:', parseError)
        console.error('Raw response text:', data.text || data.response || data.content)
        
        // Try to extract scenes manually from text using regex
        try {
          const text = data.text || data.response || data.content || ''
          
          // Extract individual JSON objects even if array is incomplete
          const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g
          const objectMatches = text.match(objectPattern)
          
          if (objectMatches && objectMatches.length > 0) {
            scenes = []
            for (const objStr of objectMatches) {
              try {
                const parsed = JSON.parse(objStr)
                if (parsed && (parsed.name || parsed.scene_number || parsed.description)) {
                  scenes.push(parsed)
                }
              } catch {
                // Try to extract fields manually
                const sceneNum = objStr.match(/"scene_number"\s*:\s*"([^"]+)"/)?.[1] || 
                               objStr.match(/"scene_number"\s*:\s*(\d+)/)?.[1] ||
                               String(scenes.length + 1)
                const name = objStr.match(/"name"\s*:\s*"([^"]+)"/)?.[1] || `Scene ${sceneNum}`
                const desc = objStr.match(/"description"\s*:\s*"([^"]]+)"/)?.[1] || ''
                const location = objStr.match(/"location"\s*:\s*"([^"]+)"/)?.[1] || ''
                const shotType = objStr.match(/"shot_type"\s*:\s*"([^"]+)"/)?.[1] || ''
                const mood = objStr.match(/"mood"\s*:\s*"([^"]+)"/)?.[1] || ''
                const notes = objStr.match(/"notes"\s*:\s*"([^"]]+)"/)?.[1] || ''
                
                // Extract characters array
                const charsMatch = objStr.match(/"characters"\s*:\s*\[([^\]]+)\]/)
                let characters: string[] = []
                if (charsMatch) {
                  characters = charsMatch[1]
                    .split(',')
                    .map(c => c.trim().replace(/"/g, ''))
                    .filter(Boolean)
                }
                
                scenes.push({
                  scene_number: sceneNum,
                  name: name,
                  description: desc,
                  location: location,
                  characters: characters,
                  shot_type: shotType,
                  mood: mood,
                  notes: notes,
                })
              }
            }
            
            if (scenes.length > 0) {
              console.log(`Extracted ${scenes.length} scenes using fallback parser`)
            } else {
              throw new Error('Could not extract scenes from response')
            }
          } else {
            throw new Error('Could not extract scenes from response')
          }
        } catch (fallbackError) {
          console.error('Fallback parsing also failed:', fallbackError)
          toast({
            title: "Error",
            description: `Failed to parse generated scenes. ${scenes.length > 0 ? `However, ${scenes.length} scenes were extracted.` : 'Please try again.'}`,
            variant: "destructive",
          })
          if (scenes.length === 0) {
            return
          }
        }
      }

      // Create treatment scenes (just titles for now)
      const sceneData: CreateTreatmentSceneData[] = scenes.map((scene, index) => ({
        treatment_id: treatment.id,
        name: scene.name || `Scene ${scene.scene_number || index + 1}`,
        description: scene.description || '', // Will be empty initially
        scene_number: scene.scene_number || String(index + 1),
        location: scene.location || '',
        characters: Array.isArray(scene.characters) ? scene.characters : [],
        shot_type: scene.shot_type || '',
        mood: scene.mood || '',
        notes: scene.notes || '',
        status: 'draft',
        content: scene.description || '',
        order_index: index,
      }))

      const createdScenes = await TreatmentScenesService.bulkCreateTreatmentScenes(sceneData)
      setTreatmentScenes([...treatmentScenes, ...createdScenes])

      toast({
        title: "Success",
        description: `Generated ${createdScenes.length} scenes from treatment`,
      })
    } catch (error) {
      console.error('Error generating scenes:', error)
      toast({
        title: "Error",
        description: "Failed to generate scenes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingScenes(false)
    }
  }

  // Start editing a scene
  const handleStartEditScene = (scene: TreatmentScene) => {
    setEditingSceneId(scene.id)
    setEditingScene({
      name: scene.name,
      description: scene.description,
      scene_number: scene.scene_number,
      location: scene.location,
      characters: scene.characters,
      shot_type: scene.shot_type,
      mood: scene.mood,
      notes: scene.notes,
      status: scene.status,
      content: scene.content,
    })
  }

  // Cancel editing
  const handleCancelEditScene = () => {
    setEditingSceneId(null)
    setEditingScene({})
  }

  // Save edited scene
  const handleSaveScene = async () => {
    if (!editingSceneId) return

    try {
      setIsSavingScene(true)
      const updatedScene = await TreatmentScenesService.updateTreatmentScene(editingSceneId, editingScene)
      setTreatmentScenes(treatmentScenes.map(s => s.id === editingSceneId ? updatedScene : s))
      setEditingSceneId(null)
      setEditingScene({})
      
      toast({
        title: "Success",
        description: "Scene updated successfully",
      })
    } catch (error) {
      console.error('Error updating scene:', error)
      toast({
        title: "Error",
        description: "Failed to update scene",
        variant: "destructive",
      })
    } finally {
      setIsSavingScene(false)
    }
  }

  // Generate full details for all scenes at once
  const generateAllSceneDetails = async () => {
    if (!treatment || !ready || !userId || treatmentScenes.length === 0) return

    // Filter to only scenes that are missing details (empty description, location, etc.)
    const scenesNeedingDetails = treatmentScenes.filter(scene => {
      const hasDetails = scene.description?.trim() && 
                        scene.location?.trim() && 
                        scene.characters && scene.characters.length > 0
      return !hasDetails
    })

    if (scenesNeedingDetails.length === 0) {
      toast({
        title: "All Scenes Complete",
        description: "All scenes already have details. Use individual scene regeneration to update specific scenes.",
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

    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    
    if (!serviceToUse) {
      toast({
        title: "AI Service Not Configured",
        description: "Please configure your AI settings.",
        variant: "destructive",
      })
      return
    }

    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             'openai'

    try {
      setIsGeneratingScenes(true)

      const treatmentContext = treatment.prompt || treatment.synopsis || ''
      const contextForPrompt = treatmentContext.length > 3000 
        ? treatmentContext.substring(0, 3000) + '...'
        : treatmentContext

      // Create a list of scene titles that need details
      const sceneTitles = scenesNeedingDetails.map(s => `Scene ${s.scene_number}: ${s.name}`).join('\n')

      const aiPrompt = `Based on the following movie treatment and scene titles, generate full details for each scene.

TREATMENT CONTEXT:
${contextForPrompt}

SCENE TITLES (${scenesNeedingDetails.length} scenes need details):
${sceneTitles}

REQUIREMENTS:
- For each scene listed above, provide:
  * Description (2-4 sentences describing what happens)
  * Location (where the scene takes place)
  * Characters (list of main characters in the scene)
  * Shot type (e.g., "Wide", "Close-up", "Medium", "Two-shot")
  * Mood/tone (e.g., "Tense", "Comedic", "Dramatic", "Action-packed")
  * Notes (any important production details)

OUTPUT FORMAT: Return a JSON array. Each scene should match the scene numbers above and have these fields:
{
  "scene_number": "1",
  "description": "Detailed description...",
  "location": "Location name",
  "characters": ["Character 1", "Character 2"],
  "shot_type": "Shot type",
  "mood": "Mood/tone",
  "notes": "Production notes"
}

IMPORTANT: Only include scenes from the list above. Return ONLY the JSON array, no other text:`

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'scenes',
          service: normalizedService,
          apiKey: 'configured',
          userId: userId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate scene details')
      }

      const data = await response.json()
      let sceneDetails: any[] = []

      // Parse the response (same logic as generateScenesFromTreatment)
      try {
        let jsonText = data.text || data.response || data.content || ''
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        
        const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g
        const objectMatches = jsonText.match(objectPattern)
        
        if (objectMatches && objectMatches.length > 0) {
          sceneDetails = []
          for (const objStr of objectMatches) {
            try {
              const parsedObj = JSON.parse(objStr)
              if (parsedObj && parsedObj.scene_number) {
                sceneDetails.push(parsedObj)
              }
            } catch (objError) {
              console.warn('Skipping invalid scene detail object:', objError)
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing scene details JSON:', parseError)
        toast({
          title: "Error",
          description: "Failed to parse generated scene details. Please try generating individually.",
          variant: "destructive",
        })
        return
      }

      // Update only scenes that need details (don't overwrite existing)
      const updatePromises = scenesNeedingDetails.map(async (scene) => {
        const details = sceneDetails.find(d => d.scene_number === scene.scene_number || d.scene_number === String(scene.scene_number))
        if (details) {
          try {
            // Only update fields that are empty, preserve existing data
            const updates: any = {}
            if (!scene.description?.trim() && details.description) {
              updates.description = details.description
              updates.content = details.description
            }
            if (!scene.location?.trim() && details.location) {
              updates.location = details.location
            }
            if ((!scene.characters || scene.characters.length === 0) && details.characters && details.characters.length > 0) {
              updates.characters = details.characters
            }
            if (!scene.shot_type?.trim() && details.shot_type) {
              updates.shot_type = details.shot_type
            }
            if (!scene.mood?.trim() && details.mood) {
              updates.mood = details.mood
            }
            if (!scene.notes?.trim() && details.notes) {
              updates.notes = details.notes
            }

            // Only update if there are changes
            if (Object.keys(updates).length > 0) {
              return await TreatmentScenesService.updateTreatmentScene(scene.id, updates)
            }
            return scene
          } catch (error) {
            console.error(`Error updating scene ${scene.id}:`, error)
            return scene
          }
        }
        return scene
      })

      const updatedScenes = await Promise.all(updatePromises)
      
      // Merge updated scenes back into full list
      const updatedScenesMap = new Map(updatedScenes.map(s => [s.id, s]))
      const finalScenes = treatmentScenes.map(scene => updatedScenesMap.get(scene.id) || scene)
      setTreatmentScenes(finalScenes)

      const updatedCount = updatedScenes.filter((s, idx) => {
        const original = scenesNeedingDetails[idx]
        return s.description?.trim() !== original.description?.trim() ||
               s.location?.trim() !== original.location?.trim() ||
               (s.characters?.length || 0) > (original.characters?.length || 0)
      }).length

      const skippedCount = scenesNeedingDetails.length - updatedCount

      toast({
        title: "Success",
        description: `Generated details for ${updatedCount} scene${updatedCount !== 1 ? 's' : ''}${skippedCount > 0 ? `. ${skippedCount} scene${skippedCount !== 1 ? 's' : ''} still need details - run again to continue.` : ''}`,
      })
    } catch (error) {
      console.error('Error generating scene details:', error)
      toast({
        title: "Error",
        description: "Failed to generate scene details. Please try generating individually.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingScenes(false)
    }
  }

  // ===== Characters aggregation from treatment scenes and casting sync =====
  const detectedCharacters = (() => {
    const set = new Set<string>()
    const counts = new Map<string, number>()
    for (const s of treatmentScenes) {
      const names = s.characters || []
      for (const raw of names) {
        const name = (raw || "").trim()
        if (!name) continue
        set.add(name)
        counts.set(name, (counts.get(name) || 0) + 1)
      }
    }
    const list = Array.from(set.values()).map((name) => ({
      name,
      count: counts.get(name) || 0,
    }))
    return list
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .filter((c) => (charactersFilter ? c.name.toLowerCase().includes(charactersFilter.toLowerCase()) : true))
  })()

  const rolesAvailable = (() => {
    const roles = castingSettings?.roles_available || []
    return roles
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .filter((r) => (charactersFilter ? r.toLowerCase().includes(charactersFilter.toLowerCase()) : true))
  })()

  const missingInRoles = (() => {
    const roles = new Set((castingSettings?.roles_available || []).map((r) => r.toLowerCase()))
    return detectedCharacters
      .filter((c) => !roles.has(c.name.toLowerCase()))
      .map((c) => c.name)
  })()

  const addRole = async (name: string) => {
    if (!treatment?.project_id || !name.trim()) return
    setIsSyncingRoles(true)
    try {
      const current = castingSettings?.roles_available || []
      if (current.some((r) => r.toLowerCase() === name.trim().toLowerCase())) {
        toast({ title: "Already Added", description: `"${name}" is already in casting roles.` })
        return
      }
      const next = [...current, name.trim()]
      const updated = await CastingService.upsertCastingSettings(treatment.project_id, { roles_available: next })
      setCastingSettings(updated)
      toast({ title: "Role Added", description: `"${name}" added to casting roles.` })
    } catch (err) {
      console.error("Failed adding role:", err)
      toast({ title: "Error", description: "Failed to add role.", variant: "destructive" })
    } finally {
      setIsSyncingRoles(false)
    }
  }

  const addNewCharacterAsRole = async () => {
    if (!newCharacterRole.trim()) return
    await addRole(newCharacterRole.trim())
    setNewCharacterRole("")
  }

  const syncAllMissingToRoles = async () => {
    if (!treatment?.project_id || missingInRoles.length === 0) return
    setIsSyncingRoles(true)
    try {
      const current = castingSettings?.roles_available || []
      const merged = Array.from(new Set([...current, ...missingInRoles].map((r) => r.trim())).values())
      const updated = await CastingService.upsertCastingSettings(treatment.project_id, { roles_available: merged })
      setCastingSettings(updated)
      toast({ title: "Synced", description: "All detected characters synced to casting roles." })
    } catch (err) {
      console.error("Failed syncing roles:", err)
      toast({ title: "Error", description: "Failed to sync roles.", variant: "destructive" })
    } finally {
      setIsSyncingRoles(false)
    }
  }

  // Regenerate a single scene with AI
  const regenerateSceneWithAI = async (scene: TreatmentScene) => {
    if (!treatment || !ready || !userId) return

    if (!aiSettingsLoaded) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return
    }

    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse = (isScriptsTabLocked() && lockedModel) ? lockedModel : selectedScriptAIService
    
    if (!serviceToUse) {
      toast({
        title: "AI Service Not Configured",
        description: "Please configure your AI settings.",
        variant: "destructive",
      })
      return
    }

    const normalizedService = serviceToUse.toLowerCase().includes('gpt') || serviceToUse.toLowerCase().includes('openai') ? 'openai' : 
                             serviceToUse.toLowerCase().includes('claude') || serviceToUse.toLowerCase().includes('anthropic') ? 'anthropic' : 
                             'openai'

    try {
      setIsRegeneratingScene(scene.id)

      const treatmentContext = treatment.prompt || treatment.synopsis || ''
      const contextForPrompt = treatmentContext.length > 2000 
        ? treatmentContext.substring(0, 2000) + '...'
        : treatmentContext

      const aiPrompt = `Based on the following movie treatment, regenerate this scene with more detail and depth.

TREATMENT CONTEXT:
${contextForPrompt}

CURRENT SCENE:
- Scene Number: ${scene.scene_number || 'N/A'}
- Name: ${scene.name}
- Description: ${scene.description || 'N/A'}
- Location: ${scene.location || 'N/A'}
- Characters: ${scene.characters?.join(', ') || 'N/A'}

REQUIREMENTS:
- Keep the same scene number and general concept
- Expand the description to 3-5 sentences with more detail
- Enhance location description if needed
- Add or refine characters list
- Suggest appropriate shot type and mood
- Add production notes if relevant

OUTPUT FORMAT: Return a JSON object with these fields:
{
  "name": "Scene name",
  "description": "Detailed description...",
  "location": "Location name",
  "characters": ["Character 1", "Character 2"],
  "shot_type": "Shot type",
  "mood": "Mood/tone",
  "notes": "Production notes"
}

Return ONLY the JSON object, no other text:`

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'scene',
          service: normalizedService,
          apiKey: 'configured',
          userId: userId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to regenerate scene')
      }

      const data = await response.json()
      let regeneratedScene: any = {}

      try {
        let jsonText = data.text || data.response || data.content || ''
        
        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        
        // Try to extract JSON object
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          regeneratedScene = JSON.parse(jsonMatch[0])
        } else {
          // Try parsing the whole text
          regeneratedScene = JSON.parse(jsonText)
        }
      } catch (parseError) {
        console.error('Error parsing regenerated scene JSON:', parseError)
        console.error('Raw response text:', data.text || data.response || data.content)
        
        toast({
          title: "Error",
          description: "Failed to parse regenerated scene. The AI response format was unexpected. Please try again.",
          variant: "destructive",
        })
        return
      }

      const updatedScene = await TreatmentScenesService.updateTreatmentScene(scene.id, {
        name: regeneratedScene.name || scene.name,
        description: regeneratedScene.description || scene.description,
        location: regeneratedScene.location || scene.location,
        characters: regeneratedScene.characters || scene.characters,
        shot_type: regeneratedScene.shot_type || scene.shot_type,
        mood: regeneratedScene.mood || scene.mood,
        notes: regeneratedScene.notes || scene.notes,
        content: regeneratedScene.description || scene.content,
      })

      setTreatmentScenes(treatmentScenes.map(s => s.id === scene.id ? updatedScene : s))

      toast({
        title: "Success",
        description: "Scene regenerated successfully",
      })
    } catch (error) {
      console.error('Error regenerating scene:', error)
      toast({
        title: "Error",
        description: "Failed to regenerate scene. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRegeneratingScene(null)
    }
  }

  // Delete a scene
  const handleDeleteScene = async (sceneId: string) => {
    try {
      await TreatmentScenesService.deleteTreatmentScene(sceneId)
      setTreatmentScenes(treatmentScenes.filter(s => s.id !== sceneId))
      toast({
        title: "Success",
        description: "Scene deleted successfully",
      })
    } catch (error) {
      console.error('Error deleting scene:', error)
      toast({
        title: "Error",
        description: "Failed to delete scene",
        variant: "destructive",
      })
    }
  }

  // Push a single scene to timeline
  const pushSceneToTimeline = async (scene: TreatmentScene, movieId: string) => {
    if (!treatment || !treatment.project_id) {
      toast({
        title: "Error",
        description: "Treatment must be linked to a movie project first",
        variant: "destructive",
      })
      return
    }

    try {
      // Get or create timeline for the movie
      let timeline
      try {
        const { data: timelines, error: timelineError } = await getSupabaseClient()
          .from('timelines')
          .select('*')
          .eq('project_id', movieId)
          .eq('user_id', userId)
          .limit(1)
        
        if (!timelineError && timelines && timelines.length > 0) {
          timeline = timelines[0]
        } else {
          timeline = await TimelineService.createTimelineForMovie(movieId, {
            name: `${treatment.title} Timeline`,
            description: `Timeline for ${treatment.title}`,
          })
        }
      } catch (error) {
        timeline = await TimelineService.createTimelineForMovie(movieId, {
          name: `${treatment.title} Timeline`,
          description: `Timeline for ${treatment.title}`,
        })
      }

      if (!timeline) {
        throw new Error('Failed to get or create timeline')
      }

      // Get existing scenes to calculate start time
      const existingScenes = await TimelineService.getScenesForTimeline(timeline.id)
      const lastScene = existingScenes[existingScenes.length - 1]
      const startTimeSeconds = lastScene 
        ? lastScene.start_time_seconds + lastScene.duration_seconds 
        : 0

      const durationSeconds = 60 // Default 1 minute per scene
      
      const sceneData = {
        timeline_id: timeline.id,
        name: scene.name,
        description: scene.description || '',
        start_time_seconds: startTimeSeconds,
        duration_seconds: durationSeconds,
        scene_type: 'video' as const,
        content_url: '',
        metadata: {
          sceneNumber: scene.scene_number || '',
          location: scene.location || '',
          characters: scene.characters || [],
          shotType: scene.shot_type || '',
          mood: scene.mood || '',
          notes: scene.notes || '',
          status: scene.status || 'Planning',
        }
      }

      await TimelineService.createScene(sceneData)

      toast({
        title: "Success",
        description: `Scene "${scene.name}" added to timeline`,
      })
    } catch (error) {
      console.error('Error pushing scene to timeline:', error)
      toast({
        title: "Error",
        description: "Failed to add scene to timeline. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Push scenes to timeline
  const pushScenesToTimeline = async (movieId: string) => {
    if (!treatment || !treatment.project_id) {
      toast({
        title: "Error",
        description: "Treatment must be linked to a movie project first",
        variant: "destructive",
      })
      return
    }

    if (treatmentScenes.length === 0) {
      toast({
        title: "No Scenes",
        description: "No scenes to push to timeline",
        variant: "destructive",
      })
      return
    }

    try {
      // Get or create timeline for the movie
      let timeline
      try {
        // Try to get existing timeline
        const { data: timelines, error: timelineError } = await getSupabaseClient()
          .from('timelines')
          .select('*')
          .eq('project_id', movieId)
          .eq('user_id', userId)
          .limit(1)
        
        if (!timelineError && timelines && timelines.length > 0) {
          timeline = timelines[0]
        } else {
          // Timeline doesn't exist, create it
          timeline = await TimelineService.createTimelineForMovie(movieId, {
            name: `${treatment.title} Timeline`,
            description: `Timeline for ${treatment.title}`,
          })
        }
      } catch (error) {
        // If error, try to create timeline
        timeline = await TimelineService.createTimelineForMovie(movieId, {
          name: `${treatment.title} Timeline`,
          description: `Timeline for ${treatment.title}`,
        })
      }

      if (!timeline) {
        throw new Error('Failed to get or create timeline')
      }

      // Get existing scenes to calculate start time
      const existingScenes = await TimelineService.getScenesForTimeline(timeline.id)
      const lastScene = existingScenes[existingScenes.length - 1]
      let startTimeSeconds = lastScene 
        ? lastScene.start_time_seconds + lastScene.duration_seconds 
        : 0

      // Convert treatment scenes to timeline scenes
      const timelineScenes = []
      for (const treatmentScene of treatmentScenes) {
        const durationSeconds = 60 // Default 1 minute per scene, can be adjusted
        
        const sceneData = {
          timeline_id: timeline.id,
          name: treatmentScene.name,
          description: treatmentScene.description || '',
          start_time_seconds: startTimeSeconds,
          duration_seconds: durationSeconds,
          scene_type: 'video' as const,
          content_url: '',
          metadata: {
            sceneNumber: treatmentScene.scene_number || '',
            location: treatmentScene.location || '',
            characters: treatmentScene.characters || [],
            shotType: treatmentScene.shot_type || '',
            mood: treatmentScene.mood || '',
            notes: treatmentScene.notes || '',
            status: treatmentScene.status || 'Planning',
          }
        }

        const createdScene = await TimelineService.createScene(sceneData)
        timelineScenes.push(createdScene)
        startTimeSeconds += durationSeconds
      }

      toast({
        title: "Success",
        description: `Pushed ${timelineScenes.length} scenes to timeline`,
      })

      // Navigate to timeline
      router.push(`/timeline?movie=${movieId}`)
    } catch (error) {
      console.error('Error pushing scenes to timeline:', error)
      toast({
        title: "Error",
        description: "Failed to push scenes to timeline. Please try again.",
        variant: "destructive",
      })
    }
  }

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
            {/* Synopsis - Only show if it's different from treatment prompt */}
            {(() => {
              // Check if synopsis and prompt are the same or very similar
              const synopsisText = treatment.synopsis?.trim() || ''
              const promptText = treatment.prompt?.trim() || ''
              
              // Only hide if they are exactly the same or synopsis is empty
              // Don't hide if synopsis is just similar - they should be separate
              const areIdentical = synopsisText && promptText && synopsisText === promptText
              
              console.log('📋 Treatment display check:', {
                hasSynopsis: !!synopsisText,
                synopsisLength: synopsisText.length,
                hasPrompt: !!promptText,
                promptLength: promptText.length,
                areIdentical,
                synopsisPreview: synopsisText.substring(0, 100),
                promptPreview: promptText.substring(0, 100)
              })
              
              // Only show synopsis if it exists and is not identical to prompt
              if (!synopsisText || areIdentical) {
                return null
              }
              
              return (
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
              )
            })()}

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
                        {/* AI Regenerate Button */}
                        {(treatment.synopsis || treatment.logline || treatment.title || treatment.prompt) && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={generateAITreatment}
                            disabled={isGeneratingTreatment || !aiSettingsLoaded}
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                            title="Generate a new full treatment using AI from existing content"
                          >
                            {isGeneratingTreatment ? (
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
                      {isEditingTreatment ? (
                        <div className="pl-0 ml-0">
                          <Select
                            value={editingTreatmentData.status}
                            onValueChange={(val) => setEditingTreatmentData(prev => ({ ...prev, status: val as any }))}
                          >
                            <SelectTrigger className="ml-0">
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
                      ) : (
                        <Badge className={getStatusColor(treatment.status)}>
                          {treatment.status.replace('-', ' ')}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Genre</p>
                      {isEditingTreatment ? (
                        <Input
                          value={editingTreatmentData.genre}
                          onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, genre: e.target.value }))}
                          placeholder="e.g., Sci-Fi"
                          className="ml-0"
                        />
                      ) : (
                        <Badge variant="outline">{treatment.genre}</Badge>
                      )}
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
                    <div className="flex items-center gap-2">
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
                      {/* AI Regenerate Button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={generateAILogline}
                        disabled={isGeneratingLogline || !aiSettingsLoaded}
                        className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                        title="Generate a new logline from treatment content using AI"
                      >
                        {isGeneratingLogline ? (
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
                    </div>
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

            {/* Characters & Casting Integration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-500" />
                      Characters
                    </CardTitle>
                    <CardDescription>
                      Aggregate characters from treatment scenes and sync with casting roles.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Filter characters/roles..."
                      value={charactersFilter}
                      onChange={(e) => setCharactersFilter(e.target.value)}
                      className="h-8 bg-input border-border"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={missingInRoles.length === 0 || isSyncingRoles || !treatment?.project_id}
                      onClick={syncAllMissingToRoles}
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      {isSyncingRoles ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync All To Casting
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ListFilter className="h-4 w-4" />
                      Detected Characters ({detectedCharacters.length})
                    </h3>
                    <div className="space-y-2">
                      {detectedCharacters.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No characters found in scenes.</div>
                      ) : (
                        detectedCharacters.map((c) => {
                          const alreadyRole = (castingSettings?.roles_available || []).some(
                            (r) => r.toLowerCase() === c.name.toLowerCase(),
                          )
                          return (
                            <div key={c.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{c.count}</Badge>
                                <span>{c.name}</span>
                              </div>
                              {alreadyRole ? (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                  In Casting
                                </Badge>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addRole(c.name)}
                                  disabled={isSyncingRoles || !treatment?.project_id}
                                  className="gap-2"
                                >
                                  <Plus className="h-4 w-4" />
                                  Add to Casting
                                </Button>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Casting Roles ({rolesAvailable.length})</h3>
                    <div className="flex items-end gap-2 mb-3">
                      <div className="flex-1">
                        <Label htmlFor="add-role">Add role</Label>
                        <Input
                          id="add-role"
                          placeholder="e.g., Protagonist, Detective Jane"
                          value={newCharacterRole}
                          onChange={(e) => setNewCharacterRole(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addNewCharacterAsRole()
                            }
                          }}
                          className="bg-input border-border"
                        />
                      </div>
                      <Button
                        onClick={addNewCharacterAsRole}
                        disabled={!newCharacterRole.trim() || isSyncingRoles || !treatment?.project_id}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {rolesAvailable.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No casting roles yet.</div>
                      ) : (
                        rolesAvailable.map((role) => (
                          <div key={role} className="flex items-center justify-between">
                            <span>{role}</span>
                            <Badge variant="outline">Role</Badge>
                          </div>
                        ))
                      )}
                    </div>
                    {treatment?.project_id && (
                      <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Link href={`/casting/${treatment.project_id}`}>
                          <Button variant="outline" className="w-full">
                            Open Casting
                          </Button>
                        </Link>
                        <Link href={`/characters?movie=${treatment.project_id}`}>
                          <Button variant="outline" className="w-full">
                            Open Characters
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Treatment Scenes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Film className="h-5 w-5 text-purple-500" />
                      Scenes
                    </CardTitle>
                    <CardDescription>
                      Break down your treatment into individual scenes
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {treatmentScenes.length > 0 && treatment.project_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pushScenesToTimeline(treatment.project_id!)}
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      >
                        <Film className="h-4 w-4 mr-2" />
                        Push to Timeline
                      </Button>
                    )}
                    {treatmentScenes.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateAllSceneDetails}
                        disabled={isGeneratingScenes || !aiSettingsLoaded}
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        title="Generate full details (description, location, etc.) for all scenes"
                      >
                        {isGeneratingScenes ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate All Details
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateScenesFromTreatment}
                      disabled={isGeneratingScenes || !aiSettingsLoaded}
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      {isGeneratingScenes ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Scene Titles
                        </>
                      )}
                    </Button>
                    {treatmentScenes.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllScenes}
                        disabled={isClearingScenes}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        title="Delete all scenes for this treatment"
                      >
                        {isClearingScenes ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Clearing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear Scenes
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingScenes ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading scenes...</p>
                  </div>
                ) : treatmentScenes.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                    <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">No scenes yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click "Generate Scenes" to automatically break down your treatment into scenes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {treatmentScenes.map((scene) => (
                      <Card key={scene.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  Scene {scene.scene_number || 'N/A'}
                                </Badge>
                                {scene.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {scene.status}
                                  </Badge>
                                )}
                              </div>
                              {editingSceneId === scene.id ? (
                                <Input
                                  value={editingScene.name || ''}
                                  onChange={(e) => setEditingScene({ ...editingScene, name: e.target.value })}
                                  className="mb-2"
                                  placeholder="Scene name"
                                />
                              ) : (
                                <CardTitle className="text-lg">{scene.name}</CardTitle>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {editingSceneId === scene.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={handleSaveScene}
                                    disabled={isSavingScene}
                                  >
                                    {isSavingScene ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEditScene}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {treatment.project_id && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => pushSceneToTimeline(scene, treatment.project_id!)}
                                      className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                                      title="Send this scene to timeline"
                                    >
                                      <Film className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => regenerateSceneWithAI(scene)}
                                    disabled={isRegeneratingScene === scene.id || !aiSettingsLoaded}
                                    title="Regenerate scene with AI"
                                  >
                                    {isRegeneratingScene === scene.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStartEditScene(scene)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteScene(scene.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {editingSceneId === scene.id ? (
                            <>
                              <div>
                                <Label>Description</Label>
                                <Textarea
                                  value={editingScene.description || ''}
                                  onChange={(e) => setEditingScene({ ...editingScene, description: e.target.value })}
                                  rows={3}
                                  placeholder="Scene description"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Location</Label>
                                  <Input
                                    value={editingScene.location || ''}
                                    onChange={(e) => setEditingScene({ ...editingScene, location: e.target.value })}
                                    placeholder="Location"
                                  />
                                </div>
                                <div>
                                  <Label>Shot Type</Label>
                                  <Input
                                    value={editingScene.shot_type || ''}
                                    onChange={(e) => setEditingScene({ ...editingScene, shot_type: e.target.value })}
                                    placeholder="Shot type"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label>Characters (comma-separated)</Label>
                                <Input
                                  value={editingScene.characters?.join(', ') || ''}
                                  onChange={(e) => setEditingScene({ 
                                    ...editingScene, 
                                    characters: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                                  })}
                                  placeholder="Character 1, Character 2"
                                />
                              </div>
                              <div>
                                <Label>Mood</Label>
                                <Input
                                  value={editingScene.mood || ''}
                                  onChange={(e) => setEditingScene({ ...editingScene, mood: e.target.value })}
                                  placeholder="Mood/tone"
                                />
                              </div>
                              <div>
                                <Label>Notes</Label>
                                <Textarea
                                  value={editingScene.notes || ''}
                                  onChange={(e) => setEditingScene({ ...editingScene, notes: e.target.value })}
                                  rows={2}
                                  placeholder="Production notes"
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              {scene.description && (
                                <p className="text-sm text-muted-foreground">{scene.description}</p>
                              )}
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                {scene.location && (
                                  <div>
                                    <span className="font-medium">Location: </span>
                                    <span className="text-muted-foreground">{scene.location}</span>
                                  </div>
                                )}
                                {scene.shot_type && (
                                  <div>
                                    <span className="font-medium">Shot: </span>
                                    <span className="text-muted-foreground">{scene.shot_type}</span>
                                  </div>
                                )}
                                {scene.characters && scene.characters.length > 0 && (
                                  <div>
                                    <span className="font-medium">Characters: </span>
                                    <span className="text-muted-foreground">{scene.characters.join(', ')}</span>
                                  </div>
                                )}
                                {scene.mood && (
                                  <div>
                                    <span className="font-medium">Mood: </span>
                                    <span className="text-muted-foreground">{scene.mood}</span>
                                  </div>
                                )}
                              </div>
                              {scene.notes && (
                                <div className="pt-2 border-t">
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-medium">Notes: </span>
                                    {scene.notes}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
