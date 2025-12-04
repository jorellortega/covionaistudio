"use client"

import { useState, useEffect, useRef } from 'react'
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
import { ArrowLeft, Edit, Trash2, FileText, Clock, Calendar, User, Users, Target, DollarSign, Film, Eye, Volume2, Save, X, Sparkles, Loader2, ImageIcon, Upload, Download, Zap, ChevronDown, ChevronUp, Plus, RefreshCw, ListFilter, ChevronLeft, ChevronRight, Star, MapPin, Wand2, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react'
import { TreatmentsService, Treatment } from '@/lib/treatments-service'
import { MovieService, type CreateMovieData } from '@/lib/movie-service'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TreatmentScenesService, type TreatmentScene, type CreateTreatmentSceneData } from '@/lib/treatment-scenes-service'
import { CastingService, type CastingSetting } from '@/lib/casting-service'
import { TimelineService, type CreateSceneData } from '@/lib/timeline-service'
import { OpenAIService } from '@/lib/ai-services'
import { CharactersService, type Character } from '@/lib/characters-service'
import { LocationsService, type Location } from '@/lib/locations-service'

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTreatmentData, setEditingTreatmentData] = useState({
    title: '',
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
  const [isEditingMovieName, setIsEditingMovieName] = useState(false)
  const [editingMovieName, setEditingMovieName] = useState('')
  const [isSavingMovieName, setIsSavingMovieName] = useState(false)
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState('')
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false)
  const [isGeneratingLogline, setIsGeneratingLogline] = useState(false)
  const [isGeneratingTreatment, setIsGeneratingTreatment] = useState(false)
  const [aiSettings, setAiSettings] = useState<any[]>([])
  const [selectedScriptAIService, setSelectedScriptAIService] = useState<string>('')
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  
  // Text enhancement states
  const [textEnhancerSettings, setTextEnhancerSettings] = useState<{
    model: string
    prefix: string
  }>({ model: 'gpt-4o-mini', prefix: '' })
  const [isEnhancingText, setIsEnhancingText] = useState(false)
  const [isFormattingAsTreatment, setIsFormattingAsTreatment] = useState(false)
  
  // Cover image editing states
  const [isEditingCover, setIsEditingCover] = useState(false)
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string>('')
  const [selectedAIService, setSelectedAIService] = useState<string>('dalle')
  const [coverImageAssets, setCoverImageAssets] = useState<Asset[]>([])
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0)
  const [isLoadingCoverAssets, setIsLoadingCoverAssets] = useState(false)
  const [isSettingDefaultCover, setIsSettingDefaultCover] = useState(false)
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(false)
  const [isDeletingCover, setIsDeletingCover] = useState(false)
  const [showCoverImageDialog, setShowCoverImageDialog] = useState(false)
  
  // Script assets states
  const [scriptAssets, setScriptAssets] = useState<Asset[]>([])
  const [scriptContent, setScriptContent] = useState<string>('')
  const [isLoadingScript, setIsLoadingScript] = useState(false)
  const [isGeneratingTreatmentFromScript, setIsGeneratingTreatmentFromScript] = useState(false)
  // Default to collapsed - user can expand to view script
  const [isScriptExpanded, setIsScriptExpanded] = useState(false)
  // Default to collapsed - user can expand to view treatment document
  const [isTreatmentExpanded, setIsTreatmentExpanded] = useState(false)
  // Default to collapsed - user can expand to view scenes
  const [isScenesExpanded, setIsScenesExpanded] = useState(false)
  // Default to collapsed - user can expand to view characters
  const [isCharactersExpanded, setIsCharactersExpanded] = useState(false)
  // Default to collapsed - user can expand to view locations
  const [isLocationsExpanded, setIsLocationsExpanded] = useState(false)
  // Default to collapsed - user can expand to view project details
  const [isTreatmentDetailsExpanded, setIsTreatmentDetailsExpanded] = useState(false)
  
  // Treatment scenes states
  const [treatmentScenes, setTreatmentScenes] = useState<TreatmentScene[]>([])
  const [isLoadingScenes, setIsLoadingScenes] = useState(false)
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingScene, setEditingScene] = useState<Partial<TreatmentScene>>({})
  const [isSavingScene, setIsSavingScene] = useState(false)
  const [isRegeneratingScene, setIsRegeneratingScene] = useState<string | null>(null)
  const [isClearingScenes, setIsClearingScenes] = useState(false)
  const [isReorderingScenes, setIsReorderingScenes] = useState(false)
  // Characters and casting states
  const [castingSettings, setCastingSettings] = useState<CastingSetting | null>(null)
  const [charactersFilter, setCharactersFilter] = useState<string>("")
  const [newCharacterRole, setNewCharacterRole] = useState<string>("")
  const [isSyncingRoles, setIsSyncingRoles] = useState(false)
  const [isDetectingCharacters, setIsDetectingCharacters] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const hasAutoDetectedRef = useRef(false)
  
  // Locations states
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [isDetectingLocations, setIsDetectingLocations] = useState(false)
  const [savingLocations, setSavingLocations] = useState<string[]>([])
  const [aiDetectedLocations, setAiDetectedLocations] = useState<string[]>([])
  const [editingCharacterName, setEditingCharacterName] = useState<string | null>(null)
  const [editedCharacterNames, setEditedCharacterNames] = useState<Record<string, string>>({})
  const [savingCharacters, setSavingCharacters] = useState<string[]>([])
  const [savedCharacters, setSavedCharacters] = useState<Array<{id: string; name: string; image_url?: string | null}>>([])
  const [viewCharacterDialogOpen, setViewCharacterDialogOpen] = useState(false)
  const [viewingCharacter, setViewingCharacter] = useState<{id: string; name: string; image_url?: string | null; fullDetails?: Character | null} | null>(null)
  const [savedLocations, setSavedLocations] = useState<Array<{id: string; name: string; image_url?: string | null}>>([])
  const [viewLocationDialogOpen, setViewLocationDialogOpen] = useState(false)
  const [viewingLocation, setViewingLocation] = useState<{id: string; name: string; image_url?: string | null; fullDetails?: Location | null} | null>(null)

  useEffect(() => {
    if (id) {
      loadTreatment(id as string)
      fetchUserApiKeys()
      fetchTextEnhancerSettings()
    }
  }, [id])

  // Reload saved characters when project_id is available
  useEffect(() => {
    const loadSavedCharacters = async () => {
      if (!treatment?.project_id || !ready) return
      
      try {
        const characters = await CharactersService.getCharacters(treatment.project_id)
        const charactersWithThumbnails = characters.map(c => ({ 
          id: c.id, 
          name: c.name, 
          image_url: c.image_url 
        }))
        console.log('📸 Treatment - Reloaded saved characters:', charactersWithThumbnails)
        setSavedCharacters(charactersWithThumbnails)
      } catch (charError) {
        console.error('Error loading characters:', charError)
      }
    }
    
    loadSavedCharacters()
  }, [treatment?.project_id, ready])

  const fetchUserApiKeys = async () => {
    if (!ready || !userId) return
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserApiKeys(data || {})
    } catch (error) {
      console.error('Error fetching user API keys:', error)
    }
  }

  const fetchTextEnhancerSettings = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('system_ai_config')
        .select('setting_key, setting_value')
        .in('setting_key', ['text_enhancer_model', 'text_enhancer_prefix'])

      if (error) {
        console.error('Error fetching text enhancer settings:', error)
        return
      }

      const settings: { model: string; prefix: string } = {
        model: 'gpt-4o-mini',
        prefix: ''
      }

      data?.forEach((item) => {
        if (item.setting_key === 'text_enhancer_model') {
          settings.model = item.setting_value || 'gpt-4o-mini'
        } else if (item.setting_key === 'text_enhancer_prefix') {
          settings.prefix = item.setting_value || ''
        }
      })

      setTextEnhancerSettings(settings)
    } catch (error) {
      console.error('Error fetching text enhancer settings:', error)
    }
  }

  const enhanceTreatmentText = async () => {
    if (!editingPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to enhance",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key && !userApiKeys.anthropic_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI or Anthropic API key in Settings → Profile",
        variant: "destructive",
      })
      return
    }

    setIsEnhancingText(true)
    
    try {
      const model = textEnhancerSettings.model
      const prefix = textEnhancerSettings.prefix || 'You are a professional text enhancer. Fix grammar, spelling, and enhance the writing while keeping the same context and meaning. Return only the enhanced text without explanations.\n\nEnhance the following text:'
      const fullPrompt = `${prefix}\n\n${editingPrompt}`

      // Determine which API to use based on model
      const isAnthropic = model.startsWith('claude-')
      const isGPT5Model = model.startsWith('gpt-5')
      const apiKey = isAnthropic ? userApiKeys.anthropic_api_key : userApiKeys.openai_api_key

      if (!apiKey) {
        throw new Error(`API key missing for ${isAnthropic ? 'Anthropic' : 'OpenAI'}`)
      }

      let response
      if (isAnthropic) {
        // Use Anthropic API
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 4000,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
          }),
        })

        if (!anthropicResponse.ok) {
          const errorText = await anthropicResponse.text()
          throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`)
        }

        const result = await anthropicResponse.json()
        response = result.content?.[0]?.text || ''
      } else {
        // Use OpenAI API
        // Build request body
        const requestBody: any = {
          model: model,
          messages: [
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.7,
        }

        // GPT-5 models use max_completion_tokens instead of max_tokens
        if (isGPT5Model) {
          requestBody.max_completion_tokens = 4000
          requestBody.reasoning_effort = 'none'
          requestBody.verbosity = 'medium'
        } else {
          requestBody.max_tokens = 4000
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
        }

        const result = await openaiResponse.json()
        response = result.choices?.[0]?.message?.content || ''
      }

      if (response) {
        setEditingPrompt(response.trim())
        toast({
          title: "Success",
          description: "Text enhanced successfully",
        })
      } else {
        throw new Error('No response from AI')
      }
    } catch (error) {
      console.error('Error enhancing text:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to enhance text',
        variant: "destructive",
      })
    } finally {
      setIsEnhancingText(false)
    }
  }

  const formatAsTreatment = async () => {
    if (!editingPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to format",
        variant: "destructive",
      })
      return
    }

    if (!ready || !userId) {
      toast({
        title: "Error",
        description: "You must be logged in to format treatment",
        variant: "destructive",
      })
      return
    }

    try {
      setIsFormattingAsTreatment(true)

      // Get AI service settings (same as generateTreatmentFromScript)
      let normalizedService = 'openai'
      let modelToUse = 'gpt-4o'
      try {
        const scriptsSetting = await AISettingsService.getTabSetting('scripts')
        if (scriptsSetting?.selected_model) {
          modelToUse = scriptsSetting.selected_model
          // Determine service from model
          if (scriptsSetting.selected_model.includes('claude')) {
            normalizedService = 'anthropic'
          } else {
            normalizedService = 'openai'
          }
        }
      } catch (err) {
        console.error('Error getting treatment AI settings:', err)
      }

      const aiPrompt = `Write a comprehensive movie treatment based on the following text.

REQUIREMENTS:
- Create a full treatment document (similar to a professional pitch document)
- Structure should include:
  * TITLE
  [Title of the film]
  
  * LOGLINE
  [One-sentence summary]
  
  * SYNOPSIS
  [2-3 paragraph summary of the story]
  
  * CHARACTERS
  [Brief descriptions of main characters]
  
  * ACT I
  [Detailed scene-by-scene narrative description of Act I in prose form, describing what happens visually and emotionally]
  
  * ACT II
  [Detailed scene-by-scene narrative description of Act II in prose form, describing what happens visually and emotionally]
  
  * ACT III
  [Detailed scene-by-scene narrative description of Act III in prose form, describing what happens visually and emotionally]
  
  * THEMES
  [Key themes and messages]
  
  * VISUAL STYLE
  [Description of visual approach, tone, and aesthetic]
- Write in present tense, third person
- Be detailed and cinematic in description
- Focus on story structure, character arcs, and narrative flow
- Include genre and tone descriptions
- NO markdown formatting (no #, *, **, etc.)
- Write as a professional treatment document that could be used for pitching

Text to convert:
${editingPrompt}

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
          model: modelToUse, // Pass the model from AI settings
          apiKey: 'configured',
          userId: userId,
          maxTokens: 4000, // Increased for longer treatments
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to format treatment')
      }

      const result = await response.json()

      if (result.success && result.text) {
        setEditingPrompt(result.text.trim())
        toast({
          title: "Success",
          description: "Treatment formatted successfully",
        })
      } else {
        throw new Error('No response from AI')
      }
    } catch (error) {
      console.error('Error formatting as treatment:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to format as treatment',
        variant: "destructive",
      })
    } finally {
      setIsFormattingAsTreatment(false)
    }
  }

  useEffect(() => {
    if (treatment?.id) {
      // Load scenes from timeline if treatment is linked to a project, otherwise show empty
      if (treatment.project_id) {
        loadTimelineScenes(treatment.project_id)
      } else {
        // Load treatment scenes directly if no project_id
        const loadTreatmentScenes = async () => {
          try {
            setIsLoadingScenes(true)
            const scenes = await TreatmentScenesService.getTreatmentScenes(treatment.id)
            setTreatmentScenes(scenes)
          } catch (error) {
            console.error('Error loading treatment scenes:', error)
            setTreatmentScenes([])
          } finally {
            setIsLoadingScenes(false)
          }
        }
        loadTreatmentScenes()
      }
    }
  }, [treatment?.id, treatment?.project_id])


  // Load cover image assets when treatment is loaded
  useEffect(() => {
    const loadCoverAssets = async () => {
      if (!treatment?.id || !ready) {
        setCoverImageAssets([])
        return
      }
      
      try {
        setIsLoadingCoverAssets(true)
        let assets: Asset[] = []
        
        // Try to fetch by project_id first (if treatment is linked to a movie)
        if (treatment.project_id) {
          assets = await AssetService.getCoverImageAssets(treatment.project_id)
        }
        
        // Also fetch by treatment_id (for standalone treatments or treatment-specific assets)
        const treatmentAssets = await AssetService.getCoverImageAssetsForTreatment(treatment.id)
        
        // Merge assets, avoiding duplicates
        const assetMap = new Map<string, Asset>()
        assets.forEach(asset => assetMap.set(asset.id, asset))
        treatmentAssets.forEach(asset => assetMap.set(asset.id, asset))
        
        const mergedAssets = Array.from(assetMap.values())
        
        // Sort merged assets: default cover first, then by created date
        mergedAssets.sort((a, b) => {
          if (a.is_default_cover && !b.is_default_cover) return -1
          if (!a.is_default_cover && b.is_default_cover) return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        
        setCoverImageAssets(mergedAssets)
        
        // Find the default cover index
        const defaultIndex = mergedAssets.findIndex(a => a.is_default_cover)
        if (defaultIndex >= 0) {
          setCurrentCoverIndex(defaultIndex)
          setIsSlideshowPaused(true) // Pause slideshow when default cover exists
        } else if (mergedAssets.length > 0) {
          setCurrentCoverIndex(0)
          setIsSlideshowPaused(false) // Allow auto-play when no default cover
        }
      } catch (error) {
        console.error('Error loading cover assets:', error)
        setCoverImageAssets([])
      } finally {
        setIsLoadingCoverAssets(false)
      }
    }
    
    loadCoverAssets()
  }, [treatment?.id, treatment?.project_id, ready])

  // Auto-play slideshow when there's no default cover
  useEffect(() => {
    // Only auto-play if:
    // 1. There are multiple cover images
    // 2. No default cover is set
    // 3. Slideshow is not paused (user interaction)
    const hasDefaultCover = coverImageAssets.some(asset => asset.is_default_cover)
    const shouldAutoPlay = coverImageAssets.length > 1 && !hasDefaultCover && !isSlideshowPaused

    if (!shouldAutoPlay) {
      return
    }

    // Auto-cycle through covers every 6 seconds
    const interval = setInterval(() => {
      setCurrentCoverIndex((prev) => (prev + 1) % coverImageAssets.length)
    }, 6000)

    return () => clearInterval(interval)
  }, [coverImageAssets, isSlideshowPaused])

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

  // Load locations when project_id available
  useEffect(() => {
    const loadLocations = async () => {
      if (!treatment?.project_id) {
        setLocations([])
        setSavedLocations([])
        return
      }
      try {
        setIsLoadingLocations(true)
        const locs = await LocationsService.getLocations(treatment.project_id)
        setLocations(locs)
        
        // Also update savedLocations with thumbnails
        const locationsWithThumbnails = locs.map(l => ({ 
          id: l.id, 
          name: l.name, 
          image_url: l.image_url 
        }))
        console.log('📸 Treatment - Reloaded saved locations with thumbnails:', locationsWithThumbnails)
        setSavedLocations(locationsWithThumbnails)
      } catch (e) {
        console.error('Failed loading locations:', e)
        setLocations([])
        setSavedLocations([])
      } finally {
        setIsLoadingLocations(false)
      }
    }
    loadLocations()
  }, [treatment?.project_id])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready) return
      
      try {
        const settings = await AISettingsService.getSystemSettings()
        
        // Ensure default settings exist for scripts and images tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting('scripts'),
          AISettingsService.getOrCreateDefaultTabSetting('images'),
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

  // Clear all scenes (deletes from timeline scenes directly)
  const clearAllScenes = async () => {
    if (!treatment) return
    if (treatmentScenes.length === 0) return
    if (!confirm('Are you sure you want to delete ALL scenes from this timeline? This cannot be undone.')) {
      return
    }
    try {
      setIsClearingScenes(true)
      // Delete sequentially to avoid DB rate limits; still fast for typical counts
      for (const scene of treatmentScenes) {
        await TimelineService.deleteScene(scene.id)
      }
      setTreatmentScenes([])
      toast({
        title: "Scenes Cleared",
        description: "All timeline scenes have been deleted.",
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
            
            // Load saved characters for thumbnails
            try {
              const characters = await CharactersService.getCharacters(data.project_id)
              const charactersWithThumbnails = characters.map(c => ({ 
                id: c.id, 
                name: c.name, 
                image_url: c.image_url 
              }))
              console.log('📸 Treatment - Loaded saved characters with thumbnails:', charactersWithThumbnails)
              setSavedCharacters(charactersWithThumbnails)
            } catch (charError) {
              console.error('Error loading characters:', charError)
            }
            
            // Load saved locations for thumbnails
            try {
              const locs = await LocationsService.getLocations(data.project_id)
              const locationsWithThumbnails = locs.map(l => ({ 
                id: l.id, 
                name: l.name, 
                image_url: l.image_url 
              }))
              console.log('📸 Treatment - Loaded saved locations with thumbnails:', locationsWithThumbnails)
              setSavedLocations(locationsWithThumbnails)
            } catch (locError) {
              console.error('Error loading locations:', locError)
            }
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

    // Get the model from AI settings
    const scriptsSetting = aiSettings.find((s: any) => s.tab_type === 'scripts')
    const modelToUse = scriptsSetting?.selected_model || 
                      (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

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
          model: modelToUse, // Pass the model from AI settings
          apiKey: 'configured',
          userId: userId,
          maxTokens: 4000, // Increased for longer treatments
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
      title: treatment.title || '',
      target_audience: treatment.target_audience || '',
      estimated_budget: treatment.estimated_budget || '',
      estimated_duration: treatment.estimated_duration || '',
      status: (treatment.status as any) || 'draft',
      genre: treatment.genre || '',
    })
    setIsEditingTreatment(true)
    setIsEditDialogOpen(true)
  }

  const handleCancelEditTreatment = () => {
    setIsEditingTreatment(false)
    setIsEditDialogOpen(false)
    setEditingTreatmentData({
      title: '',
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
        title: editingTreatmentData.title || undefined,
        target_audience: editingTreatmentData.target_audience || undefined,
        estimated_budget: editingTreatmentData.estimated_budget || undefined,
        estimated_duration: editingTreatmentData.estimated_duration || undefined,
        status: (editingTreatmentData.status as any) || undefined,
        genre: editingTreatmentData.genre || undefined,
      })
      
      setTreatment(updatedTreatment)
      setIsEditingTreatment(false)
      setIsEditDialogOpen(false)
      
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

  const handleStartEditMovieName = () => {
    if (!movie) return
    setEditingMovieName(movie.name || '')
    setIsEditingMovieName(true)
  }

  const handleCancelEditMovieName = () => {
    setIsEditingMovieName(false)
    setEditingMovieName('')
  }

  const handleSaveMovieName = async () => {
    if (!movie) return

    try {
      setIsSavingMovieName(true)
      const updatedMovie = await MovieService.updateMovie(movie.id, {
        name: editingMovieName,
      })
      
      setMovie(updatedMovie)
      setIsEditingMovieName(false)
      
      toast({
        title: "Success",
        description: "Movie name updated successfully",
      })
    } catch (error) {
      console.error('Error updating movie name:', error)
      toast({
        title: "Error",
        description: "Failed to update movie name",
        variant: "destructive",
      })
    } finally {
      setIsSavingMovieName(false)
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

    // Get the model from AI settings
    const scriptsSetting = aiSettings.find((s: any) => s.tab_type === 'scripts')
    const modelToUse = scriptsSetting?.selected_model || 
                      (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

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
          model: modelToUse, // Pass the model from AI settings
          apiKey: 'configured', // Server will fetch from user's database or use environment variables
          userId: userId, // Pass userId so server can fetch user's API keys
          maxTokens: 2000, // Increased for synopsis generation
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

    // Get the model from AI settings
    const scriptsSetting = aiSettings.find((s: any) => s.tab_type === 'scripts')
    const modelToUse = scriptsSetting?.selected_model || 
                      (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

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

      const aiPrompt = `You are a professional screenwriter. Convert the following material into a comprehensive movie treatment document.

CRITICAL FORMATTING REQUIREMENTS:
- This is a TREATMENT, not a screenplay or story. Write in narrative prose form, NOT screenplay format.
- Use the following EXACT structure with these EXACT section headers:

TITLE
[Title of the film]

LOGLINE
[One-sentence summary of the story]

SYNOPSIS
[2-3 paragraph summary of the entire story]

CHARACTERS
[Brief descriptions of main characters - name, role, key traits]

ACT I
[Detailed scene-by-scene narrative description of Act I in prose form. Describe what happens visually and emotionally. Write in present tense, third person. This should be a flowing narrative, NOT screenplay format.]

ACT II
[Detailed scene-by-scene narrative description of Act II in prose form. Describe what happens visually and emotionally. Write in present tense, third person. This should be a flowing narrative, NOT screenplay format.]

ACT III
[Detailed scene-by-scene narrative description of Act III in prose form. Describe what happens visually and emotionally. Write in present tense, third person. This should be a flowing narrative, NOT screenplay format.]

THEMES
[Key themes and messages of the story]

VISUAL STYLE
[Description of visual approach, tone, and aesthetic]

ADDITIONAL REQUIREMENTS:
- Write in present tense, third person narrative prose
- DO NOT use screenplay format (no INT./EXT., no character names in caps, no dialogue formatting)
- DO NOT write as a story - write as a treatment document describing what happens
- Be detailed and cinematic in description
- Focus on story structure, character arcs, and narrative flow
- NO markdown formatting (no #, *, **, etc.)
- Write as a professional treatment document that could be used for pitching

Source material to convert:
${seed}

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
          model: modelToUse, // Pass the model from AI settings
          apiKey: 'configured',
          userId: userId,
          maxTokens: 4000, // Increased for longer treatments
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

    // Normalize service name and model
    const normalizeImageModel = (displayName: string | null | undefined): string => {
      if (!displayName) return "dall-e-3"
      const model = displayName.toLowerCase()
      if (model === "gpt image" || model.includes("gpt-image")) {
        return "gpt-image-1"
      } else if (model.includes("dall") || model.includes("dalle")) {
        return "dall-e-3"
      }
      return "dall-e-3"
    }
    
    const normalizedModel = normalizeImageModel(lockedModel || serviceToUse)
    const normalizedService = serviceToUse.toLowerCase().includes('dall') || normalizedModel === 'gpt-image-1' ? 'dalle' : 
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
            model: normalizedModel, // Pass the normalized model (gpt-image-1 or dall-e-3)
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
          
          // Create asset record for the cover image
          try {
            const assetData = {
              project_id: treatment.project_id || null,
              treatment_id: treatment.id, // Link to treatment
              scene_id: null, // Treatment covers are project/treatment-level, not scene-level
              title: `Treatment Cover - ${treatment.title} - ${new Date().toLocaleDateString()}`,
              content_type: 'image' as const,
              content: '', // No text content for images
              content_url: supabaseUrl,
              prompt: movieCoverPrompt,
              model: normalizedService,
              generation_settings: {
                service: normalizedService,
                prompt: movieCoverPrompt,
                timestamp: new Date().toISOString(),
              },
              metadata: {
                generated_at: new Date().toISOString(),
                source: 'treatment_page_cover_generation',
                treatment_title: treatment.title,
                is_treatment_cover: true,
              }
            }

            await AssetService.createAsset(assetData)
            
            // Reload cover assets to show the new one
            let assets: Asset[] = []
            if (treatment.project_id) {
              assets = await AssetService.getCoverImageAssets(treatment.project_id)
            }
            const treatmentAssets = await AssetService.getCoverImageAssetsForTreatment(treatment.id)
            
            const assetMap = new Map<string, Asset>()
            assets.forEach(asset => assetMap.set(asset.id, asset))
            treatmentAssets.forEach(asset => assetMap.set(asset.id, asset))
            const mergedAssets = Array.from(assetMap.values())
            mergedAssets.sort((a, b) => {
              if (a.is_default_cover && !b.is_default_cover) return -1
              if (!a.is_default_cover && b.is_default_cover) return 1
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            })
            setCoverImageAssets(mergedAssets)
            if (mergedAssets.length > 0) {
              setCurrentCoverIndex(0) // Show the newly generated cover
              // Check if there's a default cover and pause slideshow if so
              const hasDefaultCover = mergedAssets.some(asset => asset.is_default_cover)
              if (hasDefaultCover) {
                setIsSlideshowPaused(true)
              } else {
                setIsSlideshowPaused(false) // Resume auto-play if no default
              }
            }
          } catch (assetError) {
            console.error('Failed to create asset record for cover:', assetError)
            // Don't fail the whole operation if asset creation fails
          }
          
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
        // Create asset record for the cover image (instead of replacing)
        try {
          const assetData = {
            project_id: treatment.project_id || null,
            treatment_id: treatment.id, // Link to treatment
            scene_id: null, // Treatment covers are project/treatment-level, not scene-level
            title: `Treatment Cover - ${treatment.title} - ${new Date().toLocaleDateString()}`,
            content_type: 'image' as const,
            content: '', // No text content for images
            content_url: urlData.publicUrl,
            prompt: `Manual upload: ${safeFileName}`,
            model: 'manual_upload',
            generation_settings: {},
            metadata: {
              uploaded_at: new Date().toISOString(),
              source: 'treatment_page_manual_upload',
              treatment_title: treatment.title,
              is_treatment_cover: true,
              original_filename: file.name,
            }
          }

          await AssetService.createAsset(assetData)
          
          // Only update treatment cover_image_url if this is the first cover (for backward compatibility)
          const isFirstCover = coverImageAssets.length === 0
          if (isFirstCover) {
            const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
              cover_image_url: urlData.publicUrl,
            })
            setTreatment(updatedTreatment)
          }
          
          // Reload cover assets to show the new one
          let assets: Asset[] = []
          if (treatment.project_id) {
            assets = await AssetService.getCoverImageAssets(treatment.project_id)
          }
          const treatmentAssets = await AssetService.getCoverImageAssetsForTreatment(treatment.id)
          
          const assetMap = new Map<string, Asset>()
          assets.forEach(asset => assetMap.set(asset.id, asset))
          treatmentAssets.forEach(asset => assetMap.set(asset.id, asset))
          const mergedAssets = Array.from(assetMap.values())
          mergedAssets.sort((a, b) => {
            if (a.is_default_cover && !b.is_default_cover) return -1
            if (!a.is_default_cover && b.is_default_cover) return 1
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
          setCoverImageAssets(mergedAssets)
          
          // Show the newly uploaded cover
          if (mergedAssets.length > 0) {
            const newCoverIndex = mergedAssets.findIndex(a => a.content_url === urlData.publicUrl)
            if (newCoverIndex >= 0) {
              setCurrentCoverIndex(newCoverIndex)
            } else {
              setCurrentCoverIndex(0) // Show most recent if not found
            }
            // Check if there's a default cover and pause slideshow if so
            const hasDefaultCover = mergedAssets.some(asset => asset.is_default_cover)
            if (hasDefaultCover) {
              setIsSlideshowPaused(true)
            } else {
              setIsSlideshowPaused(false) // Resume auto-play if no default
            }
          }
        } catch (assetError) {
          console.error('Failed to create asset record for cover:', assetError)
          // Fallback: update treatment directly if asset creation fails
          const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
            cover_image_url: urlData.publicUrl,
          })
          setTreatment(updatedTreatment)
        }
        
        setIsEditingCover(false)
        
        toast({
          title: "Cover Added!",
          description: "Cover image has been uploaded and added to your collection.",
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
  // Load timeline scenes (shared scenes - same as timeline and screenplay pages)
  const loadTimelineScenes = async (projectId: string) => {
    if (!ready || !userId || !projectId) {
      setTreatmentScenes([])
      setIsLoadingScenes(false)
      return
    }
    
    try {
      setIsLoadingScenes(true)
      
      // Get or create timeline for the project
      let timeline = await TimelineService.getTimelineForMovie(projectId)
      if (!timeline) {
        timeline = await TimelineService.createTimelineForMovie(projectId, {
          name: `${movie?.name || treatment?.title || 'Movie'} Timeline`,
          description: `Timeline for ${movie?.name || treatment?.title || 'Movie'}`,
          duration_seconds: 0,
          fps: 24,
          resolution_width: 1920,
          resolution_height: 1080,
        })
      }
      
      // Load scenes from timeline (same as timeline and screenplay pages use)
      const scenes = await TimelineService.getScenesForTimeline(timeline.id)
      
      // Convert timeline scenes to treatment scene format for display
      const treatmentScenesData = scenes.map(scene => ({
        id: scene.id,
        treatment_id: treatment?.id || null,
        user_id: userId!,
        name: scene.name,
        description: scene.metadata?.description || scene.description || '',
        scene_number: scene.metadata?.sceneNumber || '',
        location: scene.metadata?.location || '',
        characters: scene.metadata?.characters || [],
        shot_type: scene.metadata?.shotType || '',
        mood: scene.metadata?.mood || '',
        notes: scene.metadata?.notes || '',
        status: scene.metadata?.status || 'Planning',
        content: scene.description || '',
        metadata: scene.metadata || {},
        order_index: scene.order_index || 0,
        created_at: scene.created_at,
        updated_at: scene.updated_at,
      }))
      
      setTreatmentScenes(treatmentScenesData as any)
    } catch (error) {
      console.error('Error loading timeline scenes:', error)
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
      // Use full treatment content - no truncation to allow unlimited scene generation
      const contentForPrompt = treatmentContent

      console.log('🎬 [Scene Generation] Starting scene generation:', {
        treatmentId: treatment.id,
        treatmentTitle: treatment.title,
        contentLength: contentForPrompt.length,
        service: normalizedService,
        contentPreview: contentForPrompt.substring(0, 200) + '...'
      })

      const aiPrompt = `Based on the following movie treatment, break it down into individual scene titles.

REQUIREMENTS:
- Analyze the treatment and create scene titles that naturally cover all the story beats
- Create as many scenes as needed to properly break down the story - let the content determine the number
- DO NOT limit yourself to 20 scenes - generate as many scenes as the story requires (could be 30, 40, 50, or more)
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

      // Determine the model to use
      const modelToUse = normalizedService === 'openai' 
        ? 'gpt-4o' // Use gpt-4o for better quality and higher token limits
        : 'claude-3-5-sonnet-20241022' // Use latest Claude for better quality

      console.log('🎬 [Scene Generation] Sending request to API:', {
        promptLength: aiPrompt.length,
        maxTokens: 8000, // Increased from default 1000 to allow for 50+ scenes
        service: normalizedService,
        model: modelToUse
      })

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'scenes',
          service: normalizedService,
          model: modelToUse, // Explicitly pass model for better control
          apiKey: 'configured',
          userId: userId,
          maxTokens: 8000, // Increased to allow for 50+ scenes (each scene ~100-150 tokens)
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ [Scene Generation] API request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500)
        })
        throw new Error(`Failed to generate scenes: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('✅ [Scene Generation] API response received:', {
        hasText: !!data.text,
        hasResponse: !!data.response,
        hasContent: !!data.content,
        textLength: (data.text || data.response || data.content || '').length,
        rawResponsePreview: (data.text || data.response || data.content || '').substring(0, 500) + '...'
      })
      
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
            console.log(`✅ [Scene Generation] Extracted ${scenes.length} scenes from partial JSON response`)
          } else {
            console.error('❌ [Scene Generation] No valid scene objects found in partial JSON')
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
          console.warn('⚠️ [Scene Generation] Response is not an array, wrapping:', typeof scenes)
          scenes = [scenes]
        }
        
        // Filter out any null or invalid scenes
        const beforeFilter = scenes.length
        scenes = scenes.filter(s => s && (s.name || s.scene_number || s.description))
        const afterFilter = scenes.length
        
        if (beforeFilter !== afterFilter) {
          console.warn(`⚠️ [Scene Generation] Filtered out ${beforeFilter - afterFilter} invalid scenes`)
        }
        
        console.log(`✅ [Scene Generation] Successfully parsed ${scenes.length} scenes from JSON`)
        
      } catch (parseError) {
        console.error('❌ [Scene Generation] Error parsing scenes JSON:', parseError)
        console.error('❌ [Scene Generation] Raw response text:', data.text || data.response || data.content)
        
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
              console.log(`✅ [Scene Generation] Extracted ${scenes.length} scenes using fallback parser`)
            } else {
              console.error('❌ [Scene Generation] Could not extract scenes from response using fallback parser')
              throw new Error('Could not extract scenes from response')
            }
          } else {
            throw new Error('Could not extract scenes from response')
          }
        } catch (fallbackError) {
          console.error('❌ [Scene Generation] Fallback parsing also failed:', fallbackError)
          console.error('❌ [Scene Generation] Final scenes count:', scenes.length)
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

      console.log(`🎬 [Scene Generation] Final scenes count before saving: ${scenes.length}`)
      if (scenes.length <= 20) {
        console.warn(`⚠️ [Scene Generation] Only ${scenes.length} scenes generated. This might be due to token limits or response truncation.`)
      }

      // Create scenes directly in timeline (shared scenes table)
      // Need project_id to create timeline scenes
      if (!treatment.project_id) {
        toast({
          title: "Treatment Not Linked",
          description: "This treatment must be linked to a movie project to create scenes. Please link it to a movie first.",
          variant: "destructive",
        })
        return
      }

      // Get or create timeline for the project
      let timeline = await TimelineService.getTimelineForMovie(treatment.project_id)
      if (!timeline) {
        timeline = await TimelineService.createTimelineForMovie(treatment.project_id, {
          name: `${movie?.name || treatment?.title || 'Movie'} Timeline`,
          description: `Timeline for ${movie?.name || treatment?.title || 'Movie'}`,
          duration_seconds: 0,
          fps: 24,
          resolution_width: 1920,
          resolution_height: 1080,
        })
      }

      // Get existing timeline scenes to calculate start times and check for duplicates
      const existingScenes = await TimelineService.getScenesForTimeline(timeline.id)
      let lastEndTime = existingScenes.length > 0
        ? existingScenes[existingScenes.length - 1].start_time_seconds + existingScenes[existingScenes.length - 1].duration_seconds
        : 0

      // Create scenes directly in timeline (shared scenes table)
      const createdScenes = []
      for (const scene of scenes) {
        const sceneNumber = scene.scene_number || String(scenes.indexOf(scene) + 1)
        
        // Check if scene with this number already exists
        const existingScene = existingScenes.find(s => 
          s.metadata?.sceneNumber === sceneNumber
        )

        if (!existingScene) {
          const durationSeconds = 60 // Default 1 minute per scene
          const sceneData: CreateSceneData = {
            timeline_id: timeline.id,
            name: scene.name || `Scene ${sceneNumber}`,
            description: scene.description || '',
            start_time_seconds: lastEndTime,
            duration_seconds: durationSeconds,
            scene_type: 'video',
            content_url: '',
            metadata: {
              sceneNumber: sceneNumber,
              location: scene.location || '',
              characters: Array.isArray(scene.characters) ? scene.characters : [],
              shotType: scene.shot_type || '',
              mood: scene.mood || '',
              notes: scene.notes || '',
              status: 'draft',
            }
          }

          const createdScene = await TimelineService.createScene(sceneData)
          
          // Convert to treatment scene format for local state
          const treatmentSceneData = {
            id: createdScene.id,
            treatment_id: treatment.id,
            user_id: userId!,
            name: createdScene.name,
            description: createdScene.metadata?.description || createdScene.description || '',
            scene_number: createdScene.metadata?.sceneNumber || '',
            location: createdScene.metadata?.location || '',
            characters: createdScene.metadata?.characters || [],
            shot_type: createdScene.metadata?.shotType || '',
            mood: createdScene.metadata?.mood || '',
            notes: createdScene.metadata?.notes || '',
            status: createdScene.metadata?.status || 'Planning',
            content: createdScene.description || '',
            metadata: createdScene.metadata || {},
            order_index: createdScene.order_index || 0,
            created_at: createdScene.created_at,
            updated_at: createdScene.updated_at,
          }
          
          createdScenes.push(treatmentSceneData)
          lastEndTime += durationSeconds
        }
      }

      setTreatmentScenes([...treatmentScenes, ...createdScenes as any])
      
      // Expand the scenes card to show the generated scenes
      setIsScenesExpanded(true)

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

  // Add a new empty scene
  const addNewScene = async () => {
    if (!treatment || !userId || !ready) return

    try {
      // Calculate next scene number
      const nextSceneNumber = treatmentScenes.length > 0
        ? String(Math.max(...treatmentScenes.map(s => {
            const num = parseInt(s.scene_number || '0')
            return isNaN(num) ? 0 : num
          })) + 1)
        : '1'

      if (treatment.project_id) {
        // Create scene in timeline
        let timeline = await TimelineService.getTimelineForMovie(treatment.project_id)
        if (!timeline) {
          // Create a default timeline if it doesn't exist
          timeline = await TimelineService.createTimelineForMovie(treatment.project_id, {
            name: 'Main Timeline',
            description: 'Primary timeline for movie scenes',
            duration_seconds: 0,
            fps: 24,
            resolution_width: 1920,
            resolution_height: 1080,
          })
        }

        // Get existing scenes to calculate start time
        const existingScenes = await TimelineService.getScenesForTimeline(timeline.id)
        const lastEndTime = existingScenes.length > 0
          ? existingScenes[existingScenes.length - 1].start_time_seconds + existingScenes[existingScenes.length - 1].duration_seconds
          : 0

        const newSceneData: CreateSceneData = {
          timeline_id: timeline.id,
          name: `Scene ${nextSceneNumber}`,
          description: '',
          start_time_seconds: lastEndTime,
          duration_seconds: 60, // Default 1 minute
          metadata: {
            sceneNumber: nextSceneNumber,
            location: '',
            characters: [],
            shotType: '',
            mood: '',
            notes: '',
            status: 'Planning',
          }
        }

        const createdScene = await TimelineService.createScene(newSceneData)
        
        // Convert to treatment scene format
        const treatmentSceneData = {
          id: createdScene.id,
          treatment_id: treatment.id,
          user_id: userId,
          name: createdScene.name,
          description: createdScene.metadata?.description || createdScene.description || '',
          scene_number: createdScene.metadata?.sceneNumber || nextSceneNumber,
          location: createdScene.metadata?.location || '',
          characters: createdScene.metadata?.characters || [],
          shot_type: createdScene.metadata?.shotType || '',
          mood: createdScene.metadata?.mood || '',
          notes: createdScene.metadata?.notes || '',
          status: createdScene.metadata?.status || 'Planning',
          content: createdScene.description || '',
          metadata: createdScene.metadata || {},
          order_index: createdScene.order_index || 0,
          created_at: createdScene.created_at,
          updated_at: createdScene.updated_at,
        }

        const updatedScenes = [...treatmentScenes, treatmentSceneData as any]
        setTreatmentScenes(updatedScenes)
        
        // Expand scenes card and start editing the new scene
        setIsScenesExpanded(true)
        setEditingSceneId(treatmentSceneData.id)
        setEditingScene({
          name: treatmentSceneData.name,
          description: treatmentSceneData.description,
          scene_number: treatmentSceneData.scene_number,
          location: treatmentSceneData.location,
          characters: treatmentSceneData.characters,
          shot_type: treatmentSceneData.shot_type,
          mood: treatmentSceneData.mood,
          notes: treatmentSceneData.notes,
          status: treatmentSceneData.status,
          content: treatmentSceneData.content,
        })
      } else {
        // Create scene in treatment_scenes table
        const newSceneData: CreateTreatmentSceneData = {
          treatment_id: treatment.id,
          name: `Scene ${nextSceneNumber}`,
          scene_number: nextSceneNumber,
          description: '',
          status: 'Planning',
          order_index: treatmentScenes.length,
        }

        const createdScene = await TreatmentScenesService.createTreatmentScene(newSceneData)
        const updatedScenes = [...treatmentScenes, createdScene]
        setTreatmentScenes(updatedScenes)
        
        // Expand scenes card and start editing the new scene
        setIsScenesExpanded(true)
        setEditingSceneId(createdScene.id)
        setEditingScene({
          name: createdScene.name,
          description: createdScene.description,
          scene_number: createdScene.scene_number,
          location: createdScene.location,
          characters: createdScene.characters,
          shot_type: createdScene.shot_type,
          mood: createdScene.mood,
          notes: createdScene.notes,
          status: createdScene.status,
          content: createdScene.content,
        })
      }

      toast({
        title: "Success",
        description: "New scene added",
      })
    } catch (error) {
      console.error('Error adding new scene:', error)
      toast({
        title: "Error",
        description: "Failed to add new scene",
        variant: "destructive",
      })
    }
  }

  // Move scene up in order and update scene numbers
  const moveSceneUp = async (sceneId: string) => {
    if (!treatment || !userId || !ready || isReorderingScenes) return

    const currentIndex = treatmentScenes.findIndex(s => s.id === sceneId)
    if (currentIndex <= 0) return // Already at the top

    try {
      setIsReorderingScenes(true)
      const newScenes = [...treatmentScenes]
      const sceneToMove = newScenes[currentIndex]
      const sceneAbove = newScenes[currentIndex - 1]

      // Swap positions
      newScenes[currentIndex - 1] = sceneToMove
      newScenes[currentIndex] = sceneAbove

      // Update scene numbers based on new order (starting from 0)
      const updatedScenes = newScenes.map((scene, index) => {
        const newSceneNumber = String(index)
        return {
          ...scene,
          scene_number: newSceneNumber,
        }
      })

      // Save all updated scenes
      if (treatment.project_id) {
        // Update timeline scenes
        for (const scene of updatedScenes) {
          const existingScene = treatmentScenes.find(s => s.id === scene.id)
          const sceneUpdate: Partial<CreateSceneData> = {
            metadata: {
              sceneNumber: scene.scene_number,
              location: existingScene?.location || '',
              characters: existingScene?.characters || [],
              shotType: existingScene?.shot_type || '',
              mood: existingScene?.mood || '',
              notes: existingScene?.notes || '',
              status: existingScene?.status || 'Planning',
            }
          }
          await TimelineService.updateScene(scene.id, sceneUpdate)
        }
        // Reload scenes to get updated order
        await loadTimelineScenes(treatment.project_id)
      } else {
        // Update treatment scenes
        for (const scene of updatedScenes) {
          await TreatmentScenesService.updateTreatmentScene(scene.id, {
            scene_number: scene.scene_number,
          })
        }
        // Reload scenes
        const scenes = await TreatmentScenesService.getTreatmentScenes(treatment.id)
        setTreatmentScenes(scenes)
      }

      toast({
        title: "Success",
        description: "Scene moved up and scene numbers updated",
      })
    } catch (error) {
      console.error('Error moving scene up:', error)
      toast({
        title: "Error",
        description: "Failed to move scene",
        variant: "destructive",
      })
    } finally {
      setIsReorderingScenes(false)
    }
  }

  // Move scene down in order and update scene numbers
  const moveSceneDown = async (sceneId: string) => {
    if (!treatment || !userId || !ready || isReorderingScenes) return

    const currentIndex = treatmentScenes.findIndex(s => s.id === sceneId)
    if (currentIndex < 0 || currentIndex >= treatmentScenes.length - 1) return // Already at the bottom

    try {
      setIsReorderingScenes(true)
      const newScenes = [...treatmentScenes]
      const sceneToMove = newScenes[currentIndex]
      const sceneBelow = newScenes[currentIndex + 1]

      // Swap positions
      newScenes[currentIndex + 1] = sceneToMove
      newScenes[currentIndex] = sceneBelow

      // Update scene numbers based on new order
      const updatedScenes = newScenes.map((scene, index) => {
        const newSceneNumber = String(index)
        return {
          ...scene,
          scene_number: newSceneNumber,
        }
      })

      // Save all updated scenes
      if (treatment.project_id) {
        // Update timeline scenes
        for (const scene of updatedScenes) {
          const existingScene = treatmentScenes.find(s => s.id === scene.id)
          const sceneUpdate: Partial<CreateSceneData> = {
            metadata: {
              sceneNumber: scene.scene_number,
              location: existingScene?.location || '',
              characters: existingScene?.characters || [],
              shotType: existingScene?.shot_type || '',
              mood: existingScene?.mood || '',
              notes: existingScene?.notes || '',
              status: existingScene?.status || 'Planning',
            }
          }
          await TimelineService.updateScene(scene.id, sceneUpdate)
        }
        // Reload scenes to get updated order
        await loadTimelineScenes(treatment.project_id)
      } else {
        // Update treatment scenes
        for (const scene of updatedScenes) {
          await TreatmentScenesService.updateTreatmentScene(scene.id, {
            scene_number: scene.scene_number,
          })
        }
        // Reload scenes
        const scenes = await TreatmentScenesService.getTreatmentScenes(treatment.id)
        setTreatmentScenes(scenes)
      }

      toast({
        title: "Success",
        description: "Scene moved down and scene numbers updated",
      })
    } catch (error) {
      console.error('Error moving scene down:', error)
      toast({
        title: "Error",
        description: "Failed to move scene",
        variant: "destructive",
      })
    } finally {
      setIsReorderingScenes(false)
    }
  }

  // Save edited scene (updates timeline scene directly)
  const handleSaveScene = async () => {
    if (!editingSceneId || !treatment?.project_id) return

    try {
      setIsSavingScene(true)
      
      // Update the scene in timeline directly
      const sceneUpdate: Partial<CreateSceneData> = {
        name: editingScene.name,
        description: editingScene.description || '',
        metadata: {
          sceneNumber: editingScene.scene_number || '',
          location: editingScene.location || '',
          characters: editingScene.characters || [],
          shotType: editingScene.shot_type || '',
          mood: editingScene.mood || '',
          notes: editingScene.notes || '',
          status: editingScene.status || 'Planning',
        }
      }

      const updatedScene = await TimelineService.updateScene(editingSceneId, sceneUpdate)
      
      // Convert back to treatment scene format for local state
      const updatedTreatmentScene = {
        id: updatedScene.id,
        treatment_id: treatment.id,
        user_id: userId!,
        name: updatedScene.name,
        description: updatedScene.metadata?.description || updatedScene.description || '',
        scene_number: updatedScene.metadata?.sceneNumber || '',
        location: updatedScene.metadata?.location || '',
        characters: updatedScene.metadata?.characters || [],
        shot_type: updatedScene.metadata?.shotType || '',
        mood: updatedScene.metadata?.mood || '',
        notes: updatedScene.metadata?.notes || '',
        status: updatedScene.metadata?.status || 'Planning',
        content: updatedScene.description || '',
        metadata: updatedScene.metadata || {},
        order_index: updatedScene.order_index || 0,
        created_at: updatedScene.created_at,
        updated_at: updatedScene.updated_at,
      }
      
      setTreatmentScenes(treatmentScenes.map(s => s.id === editingSceneId ? updatedTreatmentScene as any : s))
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
      // Check both direct fields and metadata fields
      const description = scene.description?.trim() || scene.metadata?.description?.trim() || ''
      const location = scene.location?.trim() || scene.metadata?.location?.trim() || ''
      const characters = scene.characters || scene.metadata?.characters || []
      
      const hasDetails = description && location && characters && characters.length > 0
      
      if (!hasDetails) {
        console.log(`Scene ${scene.scene_number} (${scene.name}) needs details:`, {
          hasDescription: !!description,
          hasLocation: !!location,
          hasCharacters: characters.length > 0
        })
      }
      
      return !hasDetails
    })
    
    console.log(`📋 Scenes needing details: ${scenesNeedingDetails.length} out of ${treatmentScenes.length}`)

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
  * Scene setting: Specify as "Interior" or "Exterior" followed by "Daytime" or "Night" (e.g., "Interior Daytime", "Exterior Night", "Interior Night", "Exterior Daytime")
  * Mood/tone (e.g., "Tense", "Comedic", "Dramatic", "Action-packed")
  * Notes (any important production details)

OUTPUT FORMAT: Return a JSON array. Each scene should match the scene numbers above and have these fields:
{
  "scene_number": "1",
  "description": "Detailed description...",
  "location": "Location name",
  "characters": ["Character 1", "Character 2"],
  "shot_type": "Interior Daytime" or "Exterior Night" etc. (format: "Interior/Exterior" + "Daytime/Night"),
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
        
        // First, try to parse as a complete JSON array
        try {
          const parsed = JSON.parse(jsonText)
          if (Array.isArray(parsed)) {
            sceneDetails = parsed.filter((item: any) => item && item.scene_number)
            console.log(`✅ Parsed ${sceneDetails.length} scenes from JSON array`)
          } else if (parsed && parsed.scene_number) {
            // Single object
            sceneDetails = [parsed]
            console.log(`✅ Parsed 1 scene from single JSON object`)
          }
        } catch (arrayParseError) {
          // If array parsing fails, try regex pattern matching
          console.log('Array parse failed, trying regex pattern matching...')
          
          // Improved regex pattern that handles nested objects better
          const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gs
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
            console.log(`✅ Parsed ${sceneDetails.length} scenes from regex pattern matching`)
          }
        }
        
        // Log which scenes were requested vs received
        const requestedSceneNumbers = scenesNeedingDetails.map(s => s.scene_number || String(s.scene_number))
        const receivedSceneNumbers = sceneDetails.map(d => String(d.scene_number))
        const missingScenes = requestedSceneNumbers.filter(num => !receivedSceneNumbers.includes(num))
        
        if (missingScenes.length > 0) {
          console.warn(`⚠️ Missing scenes in AI response: ${missingScenes.join(', ')}`)
          console.log(`Requested: ${requestedSceneNumbers.join(', ')}, Received: ${receivedSceneNumbers.join(', ')}`)
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

      // Update only scenes that need details (don't overwrite existing) - update timeline scenes directly
      const updatePromises = scenesNeedingDetails.map(async (scene) => {
        const details = sceneDetails.find(d => d.scene_number === scene.scene_number || d.scene_number === String(scene.scene_number))
        if (details) {
          try {
            // Only update fields that are empty, preserve existing data
            // Check both direct fields and metadata fields to match filtering logic
            const currentDescription = scene.description?.trim() || scene.metadata?.description?.trim() || ''
            const currentLocation = scene.location?.trim() || scene.metadata?.location?.trim() || ''
            const currentCharacters = scene.characters || scene.metadata?.characters || []
            const currentShotType = scene.shot_type?.trim() || scene.metadata?.shotType?.trim() || ''
            const currentMood = scene.mood?.trim() || scene.metadata?.mood?.trim() || ''
            const currentNotes = scene.notes?.trim() || scene.metadata?.notes?.trim() || ''
            
            const updates: Partial<CreateSceneData> = {
              metadata: { ...scene.metadata }
            }
            
            if (!currentDescription && details.description) {
              updates.description = details.description
            }
            if (!currentLocation && details.location) {
              updates.metadata!.location = details.location
            }
            if ((!currentCharacters || currentCharacters.length === 0) && details.characters && details.characters.length > 0) {
              updates.metadata!.characters = details.characters
            }
            if (!currentShotType && details.shot_type) {
              updates.metadata!.shotType = details.shot_type
            }
            if (!currentMood && details.mood) {
              updates.metadata!.mood = details.mood
            }
            if (!currentNotes && details.notes) {
              updates.metadata!.notes = details.notes
            }

            // Ensure we preserve existing metadata
            updates.metadata = {
              sceneNumber: scene.metadata?.sceneNumber || scene.scene_number || '',
              status: scene.metadata?.status || scene.status || 'Planning',
              ...updates.metadata,
            }

            // Only update if there are changes
            if (Object.keys(updates).length > 0 && (updates.description || Object.keys(updates.metadata || {}).length > 2)) {
              const updatedScene = await TimelineService.updateScene(scene.id, updates)
              
              // Convert back to treatment scene format for local state
              return {
                id: updatedScene.id,
                treatment_id: treatment.id,
                user_id: userId!,
                name: updatedScene.name,
                description: updatedScene.metadata?.description || updatedScene.description || '',
                scene_number: updatedScene.metadata?.sceneNumber || '',
                location: updatedScene.metadata?.location || '',
                characters: updatedScene.metadata?.characters || [],
                shot_type: updatedScene.metadata?.shotType || '',
                mood: updatedScene.metadata?.mood || '',
                notes: updatedScene.metadata?.notes || '',
                status: updatedScene.metadata?.status || 'Planning',
                content: updatedScene.description || '',
                metadata: updatedScene.metadata || {},
                order_index: updatedScene.order_index || 0,
                created_at: updatedScene.created_at,
                updated_at: updatedScene.updated_at,
              } as any
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

      // Count how many scenes were actually updated (check both direct fields and metadata)
      const updatedCount = updatedScenes.filter((s, idx) => {
        const original = scenesNeedingDetails[idx]
        const originalDesc = original.description?.trim() || original.metadata?.description?.trim() || ''
        const originalLoc = original.location?.trim() || original.metadata?.location?.trim() || ''
        const originalChars = original.characters || original.metadata?.characters || []
        
        const updatedDesc = s.description?.trim() || s.metadata?.description?.trim() || ''
        const updatedLoc = s.location?.trim() || s.metadata?.location?.trim() || ''
        const updatedChars = s.characters || s.metadata?.characters || []
        
        return updatedDesc !== originalDesc ||
               updatedLoc !== originalLoc ||
               updatedChars.length > originalChars.length
      }).length

      const skippedCount = scenesNeedingDetails.length - updatedCount
      
      // Check which scenes from the request were actually received in the AI response
      const requestedSceneNumbers = scenesNeedingDetails.map(s => String(s.scene_number || ''))
      const receivedSceneNumbers = sceneDetails.map(d => String(d.scene_number || ''))
      const missingFromResponse = requestedSceneNumbers.filter(num => !receivedSceneNumbers.includes(num))

      if (missingFromResponse.length > 0) {
        console.warn(`⚠️ AI response missing ${missingFromResponse.length} scenes: ${missingFromResponse.join(', ')}`)
      }

      toast({
        title: updatedCount > 0 ? "Success" : "Partial Success",
        description: `Generated details for ${updatedCount} scene${updatedCount !== 1 ? 's' : ''}${skippedCount > 0 ? `. ${skippedCount} scene${skippedCount !== 1 ? 's' : ''} still need details - click "Generate All Details" again to continue.` : ''}`,
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

  // Aggregate locations from treatment scenes
  const detectedLocations = (() => {
    const set = new Set<string>()
    const counts = new Map<string, number>()
    
    // First add locations from scenes
    for (const s of treatmentScenes) {
      const location = (s.location || s.metadata?.location || "").trim()
      if (!location) continue
      set.add(location)
      counts.set(location, (counts.get(location) || 0) + 1)
    }
    
    // Then add AI-detected locations that aren't already in scenes
    for (const locationName of aiDetectedLocations) {
      if (!set.has(locationName)) {
        set.add(locationName)
        counts.set(locationName, 0) // Mark as AI-detected but not in scenes yet
      }
    }
    
    const list = Array.from(set.values()).map((name) => ({
      name,
      count: counts.get(name) || 0,
    }))
    return list
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
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

  const startEditingCharacter = (characterName: string) => {
    setEditingCharacterName(characterName)
    setEditedCharacterNames(prev => ({
      ...prev,
      [characterName]: characterName
    }))
  }

  const cancelEditingCharacter = () => {
    setEditingCharacterName(null)
  }

  const saveCharacterNameEdit = async (oldName: string) => {
    const newName = editedCharacterNames[oldName]?.trim()
    if (!newName || newName === oldName) {
      setEditingCharacterName(null)
      return
    }

    try {
      // Update character name in all scenes
      for (const scene of treatmentScenes) {
        if (scene.characters?.includes(oldName)) {
          const updatedCharacters = scene.characters.map(c => c === oldName ? newName : c)
          if (treatment?.project_id) {
            // Update timeline scenes
            const timelineScenes = await TimelineService.getScenesForTimeline(treatment.project_id)
            const matchingScene = timelineScenes.find(s => s.metadata?.characters?.includes(oldName))
            if (matchingScene) {
              await TimelineService.updateScene(matchingScene.id, {
                metadata: {
                  ...matchingScene.metadata,
                  characters: updatedCharacters,
                },
              })
            }
          } else {
            // Update treatment scenes
            await TreatmentScenesService.updateTreatmentScene(scene.id, {
              characters: updatedCharacters,
              metadata: {
                ...scene.metadata,
                characters: updatedCharacters,
              },
            })
          }
        }
      }

      // Reload scenes
      if (treatment?.project_id) {
        await loadTimelineScenes(treatment.project_id)
      } else if (treatment) {
        const scenes = await TreatmentScenesService.getTreatmentScenes(treatment.id)
        setTreatmentScenes(scenes)
      }

      setEditingCharacterName(null)
      toast({
        title: "Character Name Updated",
        description: `"${oldName}" renamed to "${newName}" in all scenes.`,
      })
    } catch (error) {
      console.error('Error updating character name:', error)
      toast({
        title: "Error",
        description: "Failed to update character name.",
        variant: "destructive",
      })
    }
  }

  const convertTreatmentToMovie = async () => {
    if (!treatment || !user || !userId) return null

    try {
      const movieData: CreateMovieData = {
        name: treatment.title,
        description: treatment.synopsis || treatment.prompt?.substring(0, 500) || '',
        genre: treatment.genre || 'Drama',
        project_type: 'movie',
        movie_status: 'Pre-Production',
        project_status: 'active',
        writer: user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown',
        cowriters: [],
      }

      const movie = await MovieService.createMovie(movieData)
      const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
        project_id: movie.id
      })
      setTreatment(updatedTreatment)

      toast({
        title: "Treatment Linked",
        description: `Treatment linked to movie "${movie.name}". You can now save characters.`,
      })

      return movie.id
    } catch (error) {
      console.error('Error converting treatment to movie:', error)
      throw error
    }
  }

  const saveCharacterAsRecord = async (characterName: string) => {
    if (!ready || !userId || !user) {
      toast({
        title: "Not Ready",
        description: "Please wait for authentication to complete.",
        variant: "destructive",
      })
      return
    }

    setSavingCharacters(prev => [...prev, characterName])

    try {
      let projectId = treatment?.project_id

      // If no project_id, automatically create a movie project
      if (!projectId) {
        console.log('No project_id, creating movie project automatically...')
        projectId = await convertTreatmentToMovie()
        if (!projectId) {
          throw new Error('Failed to create movie project')
        }
      }

      // Check if character already exists
      const existingCharacters = await CharactersService.getCharacters(projectId)
      const existing = existingCharacters.find(c => c.name.toLowerCase() === characterName.toLowerCase())

      if (existing) {
        toast({
          title: "Character Exists",
          description: `"${characterName}" already exists in characters.`,
        })
        return
      }

      // Create character record
      const character = await CharactersService.createCharacter({
        project_id: projectId,
        name: characterName,
        description: `Character from treatment: ${treatment?.title || 'Untitled'}`,
      })

      // Fetch the first image asset for this character to use as thumbnail
      let thumbnailUrl: string | null = null
      try {
        const characterAssets = await AssetService.getAssetsForCharacter(character.id)
        const firstImageAsset = characterAssets.find(asset => asset.content_type === 'image' && asset.content_url)
        
        if (firstImageAsset?.content_url) {
          thumbnailUrl = firstImageAsset.content_url
          // Update character with thumbnail
          await CharactersService.updateCharacter(character.id, {
            image_url: thumbnailUrl
          })
        }
      } catch (assetError) {
        // Non-critical error - character is saved, just no thumbnail
        console.log('Could not fetch character thumbnail:', assetError)
      }

      // Reload saved characters to get updated thumbnails
      try {
        const updatedCharacters = await CharactersService.getCharacters(projectId)
        const charactersWithThumbnails = updatedCharacters.map(c => ({ 
          id: c.id, 
          name: c.name, 
          image_url: c.image_url 
        }))
        console.log('📸 Treatment - Updated saved characters after save:', charactersWithThumbnails)
        setSavedCharacters(charactersWithThumbnails)
      } catch (charError) {
        console.error('Error reloading characters:', charError)
        // Fallback to local update
        setSavedCharacters(prev => {
          const existing = prev.find(sc => sc.name.toLowerCase() === characterName.toLowerCase())
          if (existing) {
            return prev.map(sc => 
              sc.name.toLowerCase() === characterName.toLowerCase()
                ? { ...sc, image_url: thumbnailUrl }
                : sc
            )
          }
          return [...prev, { id: character.id, name: characterName, image_url: thumbnailUrl }]
        })
      }

      toast({
        title: "Character Saved",
        description: `"${characterName}" has been saved to characters. You can view it on the Characters page.`,
      })
    } catch (error) {
      console.error('Error saving character:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast({
        title: "Error",
        description: `Failed to save character: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setSavingCharacters(prev => prev.filter(name => name !== characterName))
    }
  }

  const detectCharactersFromTreatment = async () => {
    if (!treatment || !ready || !userId) return

    if (!aiSettingsLoaded) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key && !userApiKeys.anthropic_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI or Anthropic API key in Settings → Profile",
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
      setIsDetectingCharacters(true)

      // Get treatment content - prioritize prompt (full treatment) over synopsis
      // Check explicitly for prompt first since it contains the full treatment document
      let treatmentContent = ''
      if (treatment.prompt && treatment.prompt.trim().length > 0) {
        treatmentContent = treatment.prompt.trim()
        console.log('Using treatment prompt for character detection:', treatmentContent.length, 'characters')
      } else if (treatment.synopsis && treatment.synopsis.trim().length > 0) {
        treatmentContent = treatment.synopsis.trim()
        console.log('Using treatment synopsis for character detection:', treatmentContent.length, 'characters')
      } else if (treatment.logline && treatment.logline.trim().length > 0) {
        treatmentContent = treatment.logline.trim()
        console.log('Using treatment logline for character detection:', treatmentContent.length, 'characters')
      }

      if (!treatmentContent) {
        toast({
          title: "No Content",
          description: "Treatment has no content to analyze. Please add treatment content (prompt field) first.",
          variant: "destructive",
        })
        return
      }

      // Limit content to avoid token limits (use more for prompt since it's the full treatment)
      const maxLength = treatment.prompt ? 6000 : 4000
      const contentForPrompt = treatmentContent.length > maxLength 
        ? treatmentContent.substring(0, maxLength) + '...'
        : treatmentContent
      
      console.log('Character detection - content length:', contentForPrompt.length, 'characters')

      const aiPrompt = `Analyze the following movie treatment and extract all character names mentioned. Return ONLY a JSON array of character names (strings), nothing else. Format: ["Character Name 1", "Character Name 2", ...]

TREATMENT:
${contentForPrompt}

Return the character names as a JSON array:`

      const modelToUse = aiSettings.find((s: any) => s.tab_type === 'scripts')?.selected_model || 
                        (normalizedService === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022')

      // Check if this is a GPT-5 model
      const isGPT5Model = modelToUse.startsWith('gpt-5')

      let response
      if (normalizedService === 'anthropic') {
        const apiKey = userApiKeys.anthropic_api_key
        if (!apiKey) {
          throw new Error('Anthropic API key not found')
        }

        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelToUse,
            max_tokens: 1000,
            messages: [
              { role: 'user', content: aiPrompt }
            ],
          }),
        })

        if (!anthropicResponse.ok) {
          const errorText = await anthropicResponse.text()
          throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`)
        }

        const result = await anthropicResponse.json()
        response = result.content?.[0]?.text || ''
      } else {
        const apiKey = userApiKeys.openai_api_key
        if (!apiKey) {
          throw new Error('OpenAI API key not found')
        }

        // Build request body for OpenAI
        const requestBody: any = {
          model: modelToUse,
          messages: [
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.3,
        }

        // GPT-5 models use max_completion_tokens instead of max_tokens
        if (isGPT5Model) {
          requestBody.max_completion_tokens = 1000
          requestBody.reasoning_effort = 'none'
          requestBody.verbosity = 'medium'
        } else {
          requestBody.max_tokens = 1000
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
        }

        const result = await openaiResponse.json()
        response = result.choices?.[0]?.message?.content || ''
      }

      console.log('AI Response received:', response.substring(0, 500))

      // Extract JSON array from response - try multiple patterns
      let jsonMatch = response.match(/\[[\s\S]*?\]/)
      if (!jsonMatch) {
        // Try to find JSON object with characters array
        const objMatch = response.match(/\{[\s\S]*?"characters"[\s\S]*?\}/)
        if (objMatch) {
          try {
            const parsed = JSON.parse(objMatch[0])
            if (parsed.characters && Array.isArray(parsed.characters)) {
              jsonMatch = [JSON.stringify(parsed.characters)]
            }
          } catch (e) {
            console.error('Error parsing object match:', e)
          }
        }
      }

      if (!jsonMatch) {
        console.error('Full AI response:', response)
        throw new Error('Could not extract character names from AI response. Response: ' + response.substring(0, 200))
      }

      let characterNames: string[] = []
      try {
        const jsonText = jsonMatch[0]
        console.log('Extracted JSON:', jsonText)
        characterNames = JSON.parse(jsonText)
        if (!Array.isArray(characterNames)) {
          throw new Error('Response is not an array')
        }
        characterNames = characterNames
          .filter((name: any) => typeof name === 'string' && name.trim().length > 0)
          .map((name: string) => name.trim())
        console.log('Parsed character names:', characterNames)
      } catch (parseError) {
        console.error('Error parsing character names:', parseError)
        console.error('Response that failed to parse:', response)
        throw new Error('Failed to parse character names from AI response: ' + (parseError instanceof Error ? parseError.message : String(parseError)))
      }

      if (characterNames.length === 0) {
        console.warn('No characters found in parsed response')
        toast({
          title: "No Characters Found",
          description: "AI could not detect any character names in the treatment. Check console for details.",
          variant: "destructive",
        })
        return
      }

      console.log('Successfully extracted', characterNames.length, 'characters:', characterNames)

      // Add characters to scenes - distribute them across existing scenes or create a new scene
      if (treatmentScenes.length === 0) {
        // No scenes exist - create a new scene
        if (treatment.project_id) {
          // Create timeline scene if project exists
          console.log('No scenes exist, creating new timeline scene with characters')
          try {
            // Get or create timeline for the project
            let timeline = await TimelineService.getTimelineForMovie(treatment.project_id)
            if (!timeline) {
              timeline = await TimelineService.createTimelineForMovie(treatment.project_id, {
                name: `${treatment.title} Timeline`,
                description: `Timeline for ${treatment.title}`,
                duration_seconds: 0,
                fps: 24,
                resolution_width: 1920,
                resolution_height: 1080,
              })
            }

            // Get user for direct insert
            const { data: { user: authUser } } = await getSupabaseClient().auth.getUser()
            if (!authUser) throw new Error('User not authenticated')
            
            // Calculate order_index manually (since getNextSceneOrderIndex is failing)
            let orderIndex = 1
            try {
              const { data: existingScenes } = await getSupabaseClient()
                .from('scenes')
                .select('order_index')
                .eq('timeline_id', timeline.id)
                .eq('user_id', authUser.id)
                .order('order_index', { ascending: false })
                .limit(1)
              
              if (existingScenes && existingScenes.length > 0 && existingScenes[0].order_index) {
                orderIndex = existingScenes[0].order_index + 1
              }
            } catch (error) {
              console.warn('Could not get existing scenes, using order_index 1:', error)
              orderIndex = 1
            }
            
            // Insert scene directly to avoid getOrderIndexForSceneNumber issues
            // Note: scene_type must be one of: 'video', 'image', 'text', 'audio' (not 'scene')
            const sceneData = {
              timeline_id: timeline.id,
              name: 'Character Introduction',
              description: 'Characters detected from treatment',
              start_time_seconds: 0,
              duration_seconds: 60,
              scene_type: 'video', // Must be 'video', 'image', 'text', or 'audio'
              order_index: orderIndex,
              metadata: {
                characters: characterNames,
                location: '',
                sceneNumber: '1',
              },
              user_id: authUser.id,
            }
            
            const { data: createdScene, error: insertError } = await getSupabaseClient()
              .from('scenes')
              .insert(sceneData)
              .select()
              .single()
            
            if (insertError) {
              console.error('Error inserting scene:', insertError)
              console.error('Scene data attempted:', JSON.stringify(sceneData, null, 2))
              console.error('Error details:', {
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code,
              })
              throw new Error(`Failed to create scene: ${insertError.message || JSON.stringify(insertError)}`)
            }
            
            console.log('Scene created successfully:', createdScene)
            await loadTimelineScenes(treatment.project_id)
            console.log('Created new timeline scene with characters')
            toast({
              title: "Characters Detected",
              description: `Found ${characterNames.length} character(s) and created a new scene with them.`,
            })
          } catch (error) {
            console.error('Error creating timeline scene:', error)
            throw error
          }
        } else {
          // No project_id - create a treatment scene directly
          console.log('No project_id, creating treatment scene directly with characters')
          const sceneData: CreateTreatmentSceneData = {
            treatment_id: treatment.id,
            scene_number: 1,
            name: 'Character Introduction',
            description: 'Characters detected from treatment',
            location: '',
            characters: characterNames,
            metadata: {
              characters: characterNames,
            },
          }
          try {
            await TreatmentScenesService.createTreatmentScene(sceneData)
            // Reload scenes - if project_id exists, use loadTimelineScenes, otherwise reload treatment scenes
            if (treatment.project_id) {
              await loadTimelineScenes(treatment.project_id)
            } else {
              // Load treatment scenes directly
              const scenes = await TreatmentScenesService.getTreatmentScenes(treatment.id)
              setTreatmentScenes(scenes)
            }
            console.log('Created new treatment scene with characters')
            toast({
              title: "Characters Detected",
              description: `Found ${characterNames.length} character(s) and created a new scene with them.`,
            })
          } catch (error) {
            console.error('Error creating treatment scene:', error)
            throw error
          }
        }
      } else {
        // Distribute characters across existing scenes
        console.log('Distributing', characterNames.length, 'characters across', treatmentScenes.length, 'scenes')
        const charactersPerScene = Math.ceil(characterNames.length / treatmentScenes.length)
        let updatedCount = 0
        
        // Check if these are timeline scenes (when project_id exists) or treatment scenes
        const isTimelineScenes = !!treatment.project_id
        
        for (let i = 0; i < treatmentScenes.length; i++) {
          const scene = treatmentScenes[i]
          const startIdx = i * charactersPerScene
          const endIdx = Math.min(startIdx + charactersPerScene, characterNames.length)
          const sceneCharacters = characterNames.slice(startIdx, endIdx)
          
          if (sceneCharacters.length > 0) {
            const existingCharacters = scene.characters || []
            const mergedCharacters = Array.from(new Set([...existingCharacters, ...sceneCharacters].map(c => c.trim()).filter(Boolean)))
            
            console.log(`Updating scene ${scene.id} (${scene.name}) with characters:`, mergedCharacters)
            try {
              if (isTimelineScenes) {
                // These are timeline scenes - update via TimelineService with metadata.characters
                const existingMetadata = scene.metadata || {}
                await TimelineService.updateScene(scene.id, {
                  metadata: {
                    ...existingMetadata,
                    characters: mergedCharacters,
                  },
                })
              } else {
                // These are treatment scenes - update via TreatmentScenesService with characters column
                await TreatmentScenesService.updateTreatmentScene(scene.id, {
                  characters: mergedCharacters,
                })
              }
              updatedCount++
            } catch (error: any) {
              console.error(`Error updating scene ${scene.id}:`, error)
              console.error('Error details:', {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code,
              })
              // Continue with other scenes even if one fails
            }
          }
        }
        
        // Reload scenes
        if (treatment.project_id) {
          await loadTimelineScenes(treatment.project_id)
        } else {
          // Reload treatment scenes directly
          const scenes = await TreatmentScenesService.getTreatmentScenes(treatment.id)
          setTreatmentScenes(scenes)
        }
        console.log('Updated', updatedCount, 'scenes with characters')
        
        toast({
          title: "Characters Detected",
          description: `Found ${characterNames.length} character(s) and added them to ${updatedCount} scene(s).`,
        })
      }
    } catch (error) {
      console.error('Error detecting characters:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to detect characters from treatment.",
        variant: "destructive",
      })
    } finally {
      setIsDetectingCharacters(false)
    }
  }

  const detectLocationsFromTreatment = async () => {
    if (!treatment || !ready || !userId) return

    if (!aiSettingsLoaded) {
      toast({
        title: "AI Settings Not Loaded",
        description: "Please wait for AI settings to load.",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key && !userApiKeys.anthropic_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI or Anthropic API key in Settings → Profile",
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
      setIsDetectingLocations(true)

      // Get treatment content - prioritize prompt (full treatment) over synopsis
      let treatmentContent = ''
      if (treatment.prompt && treatment.prompt.trim().length > 0) {
        treatmentContent = treatment.prompt.trim()
        console.log('Using treatment prompt for location detection:', treatmentContent.length, 'characters')
      } else if (treatment.synopsis && treatment.synopsis.trim().length > 0) {
        treatmentContent = treatment.synopsis.trim()
        console.log('Using treatment synopsis for location detection:', treatmentContent.length, 'characters')
      } else if (treatment.logline && treatment.logline.trim().length > 0) {
        treatmentContent = treatment.logline.trim()
        console.log('Using treatment logline for location detection:', treatmentContent.length, 'characters')
      }

      if (!treatmentContent) {
        toast({
          title: "No Content",
          description: "Treatment has no content to analyze. Please add treatment content (prompt field) first.",
          variant: "destructive",
        })
        return
      }

      // Limit content to avoid token limits
      const maxLength = treatment.prompt ? 6000 : 4000
      const contentForPrompt = treatmentContent.length > maxLength 
        ? treatmentContent.substring(0, maxLength) + '...'
        : treatmentContent
      
      console.log('Location detection - content length:', contentForPrompt.length, 'characters')

      const aiPrompt = `Analyze the following movie treatment and extract all location names mentioned (places where scenes take place). Return ONLY a JSON array of location names (strings), nothing else. Format: ["Location Name 1", "Location Name 2", ...]

Include:
- Specific places (e.g., "Coffee Shop", "Police Station", "Apartment")
- Generic settings if named (e.g., "The Office", "The Kitchen")
- Geographic locations if important to the story (e.g., "New York City", "Beach")

Exclude:
- Non-specific descriptions (e.g., "outside", "inside" without context)
- Generic time references without location context

TREATMENT:
${contentForPrompt}

Return the location names as a JSON array:`

      const modelToUse = aiSettings.find((s: any) => s.tab_type === 'scripts')?.selected_model || 
                        (normalizedService === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022')

      // Check if this is a GPT-5 model
      const isGPT5Model = modelToUse.startsWith('gpt-5')

      let response
      if (normalizedService === 'anthropic') {
        const apiKey = userApiKeys.anthropic_api_key
        if (!apiKey) {
          throw new Error('Anthropic API key not found')
        }

        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelToUse,
            max_tokens: 1000,
            messages: [
              { role: 'user', content: aiPrompt }
            ],
          }),
        })

        if (!anthropicResponse.ok) {
          const errorText = await anthropicResponse.text()
          throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`)
        }

        const result = await anthropicResponse.json()
        response = result.content?.[0]?.text || ''
      } else {
        const apiKey = userApiKeys.openai_api_key
        if (!apiKey) {
          throw new Error('OpenAI API key not found')
        }

        // Build request body for OpenAI
        const requestBody: any = {
          model: modelToUse,
          messages: [
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.3,
        }

        // GPT-5 models use max_completion_tokens instead of max_tokens
        if (isGPT5Model) {
          requestBody.max_completion_tokens = 1000
          requestBody.reasoning_effort = 'none'
          requestBody.verbosity = 'medium'
        } else {
          requestBody.max_tokens = 1000
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
        }

        const result = await openaiResponse.json()
        response = result.choices?.[0]?.message?.content || ''
      }

      // Parse JSON array from response
      let locationNames: string[] = []
      try {
        // Clean the response - remove markdown code blocks if present
        let cleanResponse = response.trim()
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '')
        } else if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/```\s*$/, '')
        }
        
        const parsed = JSON.parse(cleanResponse)
        if (Array.isArray(parsed)) {
          locationNames = parsed
            .map((name) => String(name || '').trim())
            .filter((name) => name.length > 0)
        } else if (typeof parsed === 'string') {
          // Sometimes the API returns just a string
          locationNames = [parsed.trim()].filter((name) => name.length > 0)
        }
      } catch (parseError) {
        console.error('Failed to parse location detection response:', parseError, 'Response:', response)
        // Try to extract array-like content manually
        const arrayMatch = response.match(/\[(.*?)\]/s)
        if (arrayMatch) {
          try {
            const parsed = JSON.parse(arrayMatch[0])
            if (Array.isArray(parsed)) {
              locationNames = parsed
                .map((name) => String(name || '').trim())
                .filter((name) => name.length > 0)
            }
          } catch (e) {
            console.error('Failed to parse extracted array:', e)
          }
        }
      }

      if (locationNames.length === 0) {
        toast({
          title: "No Locations Found",
          description: "AI did not detect any locations in the treatment. They may need to be added manually.",
          variant: "destructive",
        })
        return
      }

      console.log('Detected locations:', locationNames)

      // Store detected locations in state so they can be displayed and saved
      setAiDetectedLocations(locationNames)

      toast({
        title: "Locations Detected!",
        description: `Found ${locationNames.length} location${locationNames.length !== 1 ? 's' : ''}: ${locationNames.slice(0, 3).join(', ')}${locationNames.length > 3 ? '...' : ''}. Review and save them below.`,
      })

    } catch (error) {
      console.error('Error detecting locations:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast({
        title: "Detection Failed",
        description: `Failed to detect locations: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setIsDetectingLocations(false)
    }
  }

  const saveLocationAsRecord = async (locationName: string) => {
    if (!treatment?.project_id || !locationName.trim()) return

    setSavingLocations(prev => [...prev, locationName])

    try {
      // Check if location already exists
      const existingLocations = await LocationsService.getLocations(treatment.project_id)
      const exists = existingLocations.some(loc => 
        loc.name.toLowerCase() === locationName.trim().toLowerCase()
      )

      if (exists) {
        toast({
          title: "Location Already Exists",
          description: `"${locationName}" already exists in locations.`,
        })
        setSavingLocations(prev => prev.filter(l => l !== locationName))
        return
      }

      const location = await LocationsService.createLocation({
        project_id: treatment.project_id,
        name: locationName.trim(),
        description: `Location from treatment: ${treatment?.title || 'Untitled'}`,
      })

      // Fetch the first image asset for this location to use as thumbnail
      let thumbnailUrl: string | null = null
      try {
        const locationAssets = await AssetService.getAssetsForLocation(location.id)
        const firstImageAsset = locationAssets.find(asset => asset.content_type === 'image' && asset.content_url)
        
        if (firstImageAsset?.content_url) {
          thumbnailUrl = firstImageAsset.content_url
          // Update location with thumbnail
          await LocationsService.updateLocation(location.id, {
            image_url: thumbnailUrl
          })
        }
      } catch (assetError) {
        // Non-critical error - location is saved, just no thumbnail
        console.log('Could not fetch location thumbnail:', assetError)
      }

      // Remove from AI-detected locations since it's now saved
      setAiDetectedLocations(prev => prev.filter(l => l.toLowerCase() !== locationName.toLowerCase()))

      // Refresh locations list
      const updatedLocations = await LocationsService.getLocations(treatment.project_id)
      setLocations(updatedLocations)

      // Reload saved locations to get updated thumbnails
      try {
        const locationsWithThumbnails = updatedLocations.map(l => ({ 
          id: l.id, 
          name: l.name, 
          image_url: l.image_url 
        }))
        console.log('📸 Treatment - Updated saved locations after save:', locationsWithThumbnails)
        setSavedLocations(locationsWithThumbnails)
      } catch (locError) {
        console.error('Error reloading locations:', locError)
        // Fallback to local update
        setSavedLocations(prev => {
          const existing = prev.find(sl => sl.name.toLowerCase() === locationName.toLowerCase())
          if (existing) {
            return prev.map(sl => 
              sl.name.toLowerCase() === locationName.toLowerCase()
                ? { ...sl, image_url: thumbnailUrl }
                : sl
            )
          }
          return [...prev, { id: location.id, name: locationName, image_url: thumbnailUrl }]
        })
      }

      toast({
        title: "Location Saved",
        description: `"${locationName}" has been saved to locations. You can view it on the Locations page.`,
      })
    } catch (error) {
      console.error('Error saving location:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast({
        title: "Error",
        description: `Failed to save location: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setSavingLocations(prev => prev.filter(name => name !== locationName))
    }
  }

  // Auto-detect characters from treatment when treatment loads and has no characters in scenes
  useEffect(() => {
    // Only auto-detect once per treatment load
    if (hasAutoDetectedRef.current) {
      return
    }

    // Only auto-detect if:
    // 1. Treatment is loaded
    // 2. Scenes are loaded (not loading)
    // 3. No characters detected in scenes
    // 4. Treatment has content (prompt or synopsis)
    // 5. User is ready
    // 6. Not already detecting
    if (
      !treatment ||
      !ready ||
      !userId ||
      isLoadingScenes ||
      isDetectingCharacters ||
      (!treatment.prompt && !treatment.synopsis)
    ) {
      return
    }

    // Check if we have API keys
    if (!userApiKeys.openai_api_key && !userApiKeys.anthropic_api_key) {
      return // Don't auto-detect if no API keys
    }

    // Calculate detected characters count from scenes
    const hasCharacters = treatmentScenes.some(scene => 
      scene.characters && scene.characters.length > 0
    )

    // Only auto-detect if no characters are found
    if (hasCharacters) {
      hasAutoDetectedRef.current = true
      return
    }

    // Small delay to avoid running immediately on every render
    const timeoutId = setTimeout(() => {
      console.log('Auto-detecting characters from treatment...')
      hasAutoDetectedRef.current = true
      detectCharactersFromTreatment().catch((error) => {
        console.error('Error in auto-detection:', error)
        // Don't show error toast for auto-detection failures
        hasAutoDetectedRef.current = false // Allow retry on error
      })
    }, 2000) // Increased delay to ensure everything is loaded

    return () => clearTimeout(timeoutId)
  }, [treatment?.id, treatment?.prompt, treatment?.synopsis, treatmentScenes.length, isLoadingScenes, ready, userId, userApiKeys.openai_api_key, userApiKeys.anthropic_api_key, isDetectingCharacters, detectCharactersFromTreatment])

  // Reset auto-detection flag when treatment changes
  useEffect(() => {
    hasAutoDetectedRef.current = false
  }, [treatment?.id])

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
- Scene setting: Specify as "Interior" or "Exterior" followed by "Daytime" or "Night" (e.g., "Interior Daytime", "Exterior Night", "Interior Night", "Exterior Daytime")
- Suggest appropriate mood/tone
- Add production notes if relevant

OUTPUT FORMAT: Return a JSON object with these fields:
{
  "name": "Scene name",
  "description": "Detailed description...",
  "location": "Location name",
  "characters": ["Character 1", "Character 2"],
  "shot_type": "Interior Daytime" or "Exterior Night" etc. (format: "Interior/Exterior" + "Daytime/Night"),
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

      // Update timeline scene directly
      const updates: Partial<CreateSceneData> = {
        metadata: {
          ...scene.metadata,
          location: regeneratedScene.location || scene.location || '',
          characters: regeneratedScene.characters || scene.characters || [],
          shotType: regeneratedScene.shot_type || scene.shot_type || '',
          mood: regeneratedScene.mood || scene.mood || '',
          notes: regeneratedScene.notes || scene.notes || '',
          sceneNumber: scene.metadata?.sceneNumber || scene.scene_number || '',
          status: scene.metadata?.status || scene.status || 'Planning',
        }
      }
      
      if (regeneratedScene.description || scene.description) {
        updates.description = regeneratedScene.description || scene.description || ''
      }
      
      if (regeneratedScene.name || scene.name) {
        updates.name = regeneratedScene.name || scene.name
      }

      const updatedScene = await TimelineService.updateScene(scene.id, updates)
      
      // Convert back to treatment scene format for local state
      const updatedTreatmentScene = {
        id: updatedScene.id,
        treatment_id: treatment.id,
        user_id: userId!,
        name: updatedScene.name,
        description: updatedScene.metadata?.description || updatedScene.description || '',
        scene_number: updatedScene.metadata?.sceneNumber || '',
        location: updatedScene.metadata?.location || '',
        characters: updatedScene.metadata?.characters || [],
        shot_type: updatedScene.metadata?.shotType || '',
        mood: updatedScene.metadata?.mood || '',
        notes: updatedScene.metadata?.notes || '',
        status: updatedScene.metadata?.status || 'Planning',
        content: updatedScene.description || '',
        metadata: updatedScene.metadata || {},
        order_index: updatedScene.order_index || 0,
        created_at: updatedScene.created_at,
        updated_at: updatedScene.updated_at,
      }

      setTreatmentScenes(treatmentScenes.map(s => s.id === scene.id ? updatedTreatmentScene as any : s))

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
  // Delete a scene (deletes from timeline scenes directly)
  const handleDeleteScene = async (sceneId: string) => {
    try {
      await TimelineService.deleteScene(sceneId)
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
      
      // Create asset record for the cover image (instead of replacing)
      try {
        const assetData = {
          project_id: treatment.project_id || null,
          treatment_id: treatment.id, // Link to treatment
          scene_id: null, // Treatment covers are project/treatment-level, not scene-level
          title: `Treatment Cover - ${treatment.title} - ${new Date().toLocaleDateString()}`,
          content_type: 'image' as const,
          content: '', // No text content for images
          content_url: url,
          prompt: `Manual URL entry`,
          model: 'manual_url',
          generation_settings: {},
          metadata: {
            uploaded_at: new Date().toISOString(),
            source: 'treatment_page_manual_url',
            treatment_title: treatment.title,
            is_treatment_cover: true,
          }
        }

        await AssetService.createAsset(assetData)
        
        // Only update treatment cover_image_url if this is the first cover (for backward compatibility)
        const isFirstCover = coverImageAssets.length === 0
        if (isFirstCover) {
          const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
            cover_image_url: url,
          })
          setTreatment(updatedTreatment)
        }
        
        // Reload cover assets to show the new one
        let assets: Asset[] = []
        if (treatment.project_id) {
          assets = await AssetService.getCoverImageAssets(treatment.project_id)
        }
        const treatmentAssets = await AssetService.getCoverImageAssetsForTreatment(treatment.id)
        
        const assetMap = new Map<string, Asset>()
        assets.forEach(asset => assetMap.set(asset.id, asset))
        treatmentAssets.forEach(asset => assetMap.set(asset.id, asset))
        const mergedAssets = Array.from(assetMap.values())
        mergedAssets.sort((a, b) => {
          if (a.is_default_cover && !b.is_default_cover) return -1
          if (!a.is_default_cover && b.is_default_cover) return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        setCoverImageAssets(mergedAssets)
        
        // Show the newly added cover
        if (mergedAssets.length > 0) {
          const newCoverIndex = mergedAssets.findIndex(a => a.content_url === url)
          if (newCoverIndex >= 0) {
            setCurrentCoverIndex(newCoverIndex)
          } else {
            setCurrentCoverIndex(0) // Show most recent if not found
          }
          // Check if there's a default cover and pause slideshow if so
          const hasDefaultCover = mergedAssets.some(asset => asset.is_default_cover)
          if (hasDefaultCover) {
            setIsSlideshowPaused(true)
          } else {
            setIsSlideshowPaused(false) // Resume auto-play if no default
          }
        }
      } catch (assetError) {
        console.error('Failed to create asset record for cover:', assetError)
        // Fallback: update treatment directly if asset creation fails
        const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
          cover_image_url: url,
        })
        setTreatment(updatedTreatment)
      }
      
      setIsEditingCover(false)
      
      toast({
        title: "Cover Added!",
        description: "Cover image has been added to your collection.",
      })
    } catch (error) {
      console.error('Error updating cover URL:', error)
      toast({
        title: "Update Failed",
        description: "Failed to add cover image.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingCover(false)
    }
  }

  // Set default cover and update treatment cover_image_url
  const handleSetDefaultCover = async (assetId: string) => {
    if (!treatment) return

    try {
      setIsSettingDefaultCover(true)
      
      // Set asset as default cover
      const asset = await AssetService.setDefaultCover(assetId)
      
      // Update treatment cover_image_url to match the asset
      if (asset.content_url) {
        const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
          cover_image_url: asset.content_url,
        })
        setTreatment(updatedTreatment)
      }
      
      // Reload cover assets to reflect the change
      let assets: Asset[] = []
      if (treatment.project_id) {
        assets = await AssetService.getCoverImageAssets(treatment.project_id)
      }
      const treatmentAssets = await AssetService.getCoverImageAssetsForTreatment(treatment.id)
      
      const assetMap = new Map<string, Asset>()
      assets.forEach(asset => assetMap.set(asset.id, asset))
      treatmentAssets.forEach(asset => assetMap.set(asset.id, asset))
      const mergedAssets = Array.from(assetMap.values())
      mergedAssets.sort((a, b) => {
        if (a.is_default_cover && !b.is_default_cover) return -1
        if (!a.is_default_cover && b.is_default_cover) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      
      setCoverImageAssets(mergedAssets)
      
      const defaultIndex = mergedAssets.findIndex(a => a.is_default_cover)
      if (defaultIndex >= 0) {
        setCurrentCoverIndex(defaultIndex)
      }
      
      // Pause slideshow when default cover is set
      setIsSlideshowPaused(true)
      
      toast({
        title: "Default Cover Set!",
        description: "This cover is now set as the default for the project.",
      })
    } catch (error) {
      console.error('Error setting default cover:', error)
      toast({
        title: "Failed to Set Default",
        description: error instanceof Error ? error.message : "Failed to set default cover.",
        variant: "destructive",
      })
    } finally {
      setIsSettingDefaultCover(false)
    }
  }

  // Unset default cover
  const handleUnsetDefaultCover = async (assetId: string) => {
    if (!treatment) return

    try {
      setIsSettingDefaultCover(true)
      
      // Unset asset as default cover
      await AssetService.unsetDefaultCover(assetId)
      
      // Reload cover assets to reflect the change
      let assets: Asset[] = []
      if (treatment.project_id) {
        assets = await AssetService.getCoverImageAssets(treatment.project_id)
      }
      const treatmentAssets = await AssetService.getCoverImageAssetsForTreatment(treatment.id)
      
      const assetMap = new Map<string, Asset>()
      assets.forEach(asset => assetMap.set(asset.id, asset))
      treatmentAssets.forEach(asset => assetMap.set(asset.id, asset))
      const mergedAssets = Array.from(assetMap.values())
      mergedAssets.sort((a, b) => {
        if (a.is_default_cover && !b.is_default_cover) return -1
        if (!a.is_default_cover && b.is_default_cover) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      
      setCoverImageAssets(mergedAssets)
      
      // Resume slideshow when default cover is unset
      setIsSlideshowPaused(false)
      
      toast({
        title: "Default Cover Removed!",
        description: "The default cover has been unset. Slideshow will resume.",
      })
    } catch (error) {
      console.error('Error unsetting default cover:', error)
      toast({
        title: "Failed to Remove Default",
        description: error instanceof Error ? error.message : "Failed to unset default cover.",
        variant: "destructive",
      })
    } finally {
      setIsSettingDefaultCover(false)
    }
  }

  // Delete cover image
  const handleDeleteCover = async (assetId: string) => {
    if (!treatment) return
    
    const assetToDelete = coverImageAssets.find(a => a.id === assetId)
    if (!assetToDelete) return

    if (!confirm(`Are you sure you want to delete this cover image? This action cannot be undone.`)) {
      return
    }

    try {
      setIsDeletingCover(true)
      
      const wasDefaultCover = assetToDelete.is_default_cover
      const deletedIndex = coverImageAssets.findIndex(a => a.id === assetId)
      
      // Delete the asset
      await AssetService.deleteAsset(assetId)
      
      // If it was the default cover, update treatment cover_image_url
      if (wasDefaultCover) {
        // Find the next available cover or set to null
        const remainingAssets = coverImageAssets.filter(a => a.id !== assetId)
        if (remainingAssets.length > 0) {
          // Set the first remaining asset as default
          const newDefault = await AssetService.setDefaultCover(remainingAssets[0].id)
          if (newDefault.content_url) {
            const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
              cover_image_url: newDefault.content_url,
            })
            setTreatment(updatedTreatment)
          }
        } else {
          // No more covers, clear treatment cover_image_url
          const updatedTreatment = await TreatmentsService.updateTreatment(treatment.id, {
            cover_image_url: null,
          })
          setTreatment(updatedTreatment)
        }
      }
      
      // Reload cover assets to reflect the change
      let assets: Asset[] = []
      if (treatment.project_id) {
        assets = await AssetService.getCoverImageAssets(treatment.project_id)
      }
      const treatmentAssets = await AssetService.getCoverImageAssetsForTreatment(treatment.id)
      
      const assetMap = new Map<string, Asset>()
      assets.forEach(asset => assetMap.set(asset.id, asset))
      treatmentAssets.forEach(asset => assetMap.set(asset.id, asset))
      const mergedAssets = Array.from(assetMap.values())
      mergedAssets.sort((a, b) => {
        if (a.is_default_cover && !b.is_default_cover) return -1
        if (!a.is_default_cover && b.is_default_cover) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      
      setCoverImageAssets(mergedAssets)
      
      // Adjust current index if needed
      if (mergedAssets.length > 0) {
        if (deletedIndex >= mergedAssets.length) {
          setCurrentCoverIndex(mergedAssets.length - 1)
        } else if (deletedIndex < currentCoverIndex) {
          // Deleted item was before current, no change needed
        } else {
          // Deleted item was at or after current, stay at same index
          setCurrentCoverIndex(Math.min(deletedIndex, mergedAssets.length - 1))
        }
        
        const defaultIndex = mergedAssets.findIndex(a => a.is_default_cover)
        if (defaultIndex >= 0) {
          setCurrentCoverIndex(defaultIndex)
        }
      } else {
        setCurrentCoverIndex(0)
      }
      
      toast({
        title: "Cover Deleted",
        description: "The cover image has been deleted successfully.",
      })
    } catch (error) {
      console.error('Error deleting cover:', error)
      toast({
        title: "Failed to Delete Cover",
        description: error instanceof Error ? error.message : "Failed to delete cover image.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingCover(false)
    }
  }

  // Navigate cover slideshow
  const nextCover = () => {
    if (coverImageAssets.length > 0) {
      setIsSlideshowPaused(true) // Pause auto-play when user interacts
      setCurrentCoverIndex((prev) => (prev + 1) % coverImageAssets.length)
    }
  }

  const prevCover = () => {
    if (coverImageAssets.length > 0) {
      setIsSlideshowPaused(true) // Pause auto-play when user interacts
      setCurrentCoverIndex((prev) => (prev - 1 + coverImageAssets.length) % coverImageAssets.length)
    }
  }

  const handleThumbnailClick = (index: number) => {
    setIsSlideshowPaused(true) // Pause auto-play when user clicks thumbnail
    setCurrentCoverIndex(index)
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
      
      {/* Hero Section with Cover Image */}
      <div className="relative w-full">
        {/* Cover Image Background */}
        {(coverImageAssets.length > 0 || treatment.cover_image_url) ? (
          <div className="relative h-[400px] md:h-[500px] w-full overflow-hidden bg-gradient-to-b from-muted to-background group">
            <div 
              className="relative h-full w-full"
              onMouseEnter={() => setIsSlideshowPaused(true)}
              onMouseLeave={() => {
                const hasDefaultCover = coverImageAssets.some(asset => asset.is_default_cover)
                if (!hasDefaultCover) {
                  setIsSlideshowPaused(false)
                }
              }}
            >
              {coverImageAssets.length > 0 && coverImageAssets[currentCoverIndex] ? (
                <img
                  src={coverImageAssets[currentCoverIndex].content_url || treatment.cover_image_url}
                  alt={`${treatment.title} cover ${currentCoverIndex + 1}`}
                  className="w-full h-full object-cover object-top cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCoverImageDialog(true)
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : treatment.cover_image_url ? (
                <img
                  src={treatment.cover_image_url}
                  alt={`${treatment.title} cover`}
                  className="w-full h-full object-cover object-top cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCoverImageDialog(true)
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : null}
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/70 to-background/30 z-0 pointer-events-none" />
              
              {/* Cover Management Buttons - Top right */}
              <div className="absolute top-4 right-4 flex gap-2 z-50 pointer-events-auto">
                {!isEditingCover ? (
                  <>
                    {/* Quick Generate AI Button */}
                    {(treatment.synopsis || treatment.prompt || treatment.logline || treatment.title) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          console.log('🎬 Quick Generate button clicked')
                          generateQuickAICover()
                        }}
                        disabled={isGeneratingCover || !aiSettingsLoaded}
                        className="backdrop-blur-sm bg-white/20 text-white border-white/30 hover:bg-white/30 pointer-events-auto"
                      >
                        {isGeneratingCover ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Quick Generate
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('🎬 Edit/Add Cover button clicked')
                        setIsEditingCover(true)
                      }}
                      className="backdrop-blur-sm bg-white/20 text-white border-white/30 hover:bg-white/30 pointer-events-auto"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {treatment.cover_image_url || coverImageAssets.length > 0 ? 'Edit Cover' : 'Add Cover'}
                    </Button>
                    {/* Set as Default Button - Only show if current cover is not default */}
                    {(coverImageAssets.length > 0 && coverImageAssets[currentCoverIndex] && !coverImageAssets[currentCoverIndex].is_default_cover) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (coverImageAssets[currentCoverIndex]) {
                            handleSetDefaultCover(coverImageAssets[currentCoverIndex].id)
                          }
                        }}
                        disabled={isSettingDefaultCover}
                        className="backdrop-blur-sm bg-yellow-500/20 text-white border-yellow-500/30 hover:bg-yellow-500/30 pointer-events-auto"
                        title="Set as Default Cover"
                      >
                        {isSettingDefaultCover ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {/* Delete Cover Button - Only show if there's a cover to delete */}
                    {(coverImageAssets.length > 0 && coverImageAssets[currentCoverIndex]) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (coverImageAssets[currentCoverIndex]) {
                            handleDeleteCover(coverImageAssets[currentCoverIndex].id)
                          }
                        }}
                        disabled={isDeletingCover}
                        className="backdrop-blur-sm bg-red-500/20 text-white border-red-500/30 hover:bg-red-500/30 pointer-events-auto"
                        title="Delete Cover"
                      >
                        {isDeletingCover ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsEditingCover(false)
                      setGeneratedCoverUrl('')
                    }}
                    className="backdrop-blur-sm bg-white/20 text-white border-white/30 hover:bg-white/30 pointer-events-auto"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
              
              {/* Navigation Arrows for Cover Slideshow */}
              {coverImageAssets.length > 1 && (
                <>
                  <button
                    onClick={prevCover}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    aria-label="Previous cover"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={nextCover}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    aria-label="Next cover"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  {coverImageAssets[currentCoverIndex]?.is_default_cover && (
                    <button
                      onClick={() => handleUnsetDefaultCover(coverImageAssets[currentCoverIndex].id)}
                      disabled={isSettingDefaultCover}
                      className="absolute top-4 left-4 bg-yellow-500/90 hover:bg-yellow-500 text-yellow-950 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                    >
                      <Star className="h-3 w-3 fill-current" />
                      Default Cover
                    </button>
                  )}
                </>
              )}
              
              {/* Edit and Delete Buttons - Above thumbnails */}
              <div className={`absolute ${coverImageAssets.length > 1 ? 'bottom-20' : 'bottom-4'} right-4 flex gap-2 z-30 pointer-events-auto`}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleStartEditTreatment()
                  }}
                  className="backdrop-blur-sm bg-white/20 text-white border-white/30 hover:bg-white/30 pointer-events-auto"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDelete()
                  }}
                  disabled={isDeleting}
                  className="backdrop-blur-sm bg-red-500/20 text-white border-red-500/30 hover:bg-red-500/30 pointer-events-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>

              {/* Thumbnail Strip - Show in bottom-right */}
              {coverImageAssets.length > 1 && (
                <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-20">
                  {/* Counter */}
                  <div className="bg-black/70 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">
                    {currentCoverIndex + 1} / {coverImageAssets.length}
                  </div>
                  {/* Thumbnails */}
                  <div className="flex gap-2">
                    {coverImageAssets.map((asset, index) => (
                      <button
                        key={asset.id}
                        onClick={() => handleThumbnailClick(index)}
                        className={`relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all backdrop-blur-sm ${
                          index === currentCoverIndex
                            ? 'border-white ring-2 ring-white/50'
                            : 'border-white/30 hover:border-white/60'
                        }`}
                      >
                        <img
                          src={asset.content_url || ''}
                          alt={`Cover ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {asset.is_default_cover && (
                          <div className="absolute top-0.5 right-0.5 bg-yellow-500 rounded-full p-0.5">
                            <Star className="h-1.5 w-1.5 fill-yellow-950 text-yellow-950" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[300px] md:h-[400px] w-full bg-gradient-to-br from-muted/50 to-muted/30 border-b group relative">
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="h-20 w-20 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-4">No cover image</p>
                {/* Cover Management Buttons - Always visible on placeholder */}
                <div className="flex gap-2 justify-center">
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
                          Quick Generate
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
                    Add Cover
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Hero Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
          <div className="container mx-auto max-w-7xl">
            {/* Back Button */}
            <div className="mb-4">
              <Button variant="ghost" asChild className="text-white/90 hover:text-white hover:bg-white/20 backdrop-blur-sm">
                <Link href="/treatments" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Treatments
                </Link>
              </Button>
            </div>
            
            {/* Title and Meta */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  {treatment.project_id && movie ? movie.name : treatment.title}
                </h1>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Badge variant="secondary" className="text-base px-3 py-1 backdrop-blur-sm bg-white/20 text-white border-white/30">
                    {treatment.genre}
                  </Badge>
                  <Badge className={`text-base px-3 py-1 backdrop-blur-sm ${getStatusColor(treatment.status)}`}>
                    {treatment.status.replace('-', ' ')}
                  </Badge>
                  {treatment.project_id && movie && (
                    <Badge variant="secondary" className="text-base px-3 py-1 backdrop-blur-sm bg-white/20 text-white border-white/30">
                      <Film className="h-3 w-3 mr-1" />
                      {movie.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cover Editing Dialog */}
      <Dialog open={isEditingCover} onOpenChange={setIsEditingCover}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Cover Image</DialogTitle>
            <DialogDescription>
              Upload a new cover image or enter an image URL
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* File Upload */}
            <div>
              <Label htmlFor="cover-upload-dialog">Upload Image</Label>
              <Input
                id="cover-upload-dialog"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleCoverUpload(file)
                    setIsEditingCover(false)
                  }
                }}
                disabled={isGeneratingCover}
                className="mt-2"
              />
            </div>
            {/* URL Input */}
            <div>
              <Label htmlFor="cover-url-dialog">Or Enter Image URL</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="cover-url-dialog"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={generatedCoverUrl}
                  onChange={(e) => setGeneratedCoverUrl(e.target.value)}
                  disabled={isGeneratingCover}
                />
                <Button
                  onClick={() => {
                    if (generatedCoverUrl) {
                      handleCoverUrlSave(generatedCoverUrl)
                      setIsEditingCover(false)
                      setGeneratedCoverUrl('')
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
        </DialogContent>
      </Dialog>

      {/* Edit Treatment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!open && !isSavingTreatment) {
          handleCancelEditTreatment()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Treatment</DialogTitle>
            <DialogDescription>
              Update treatment details and metadata
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="edit-title" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Title
              </Label>
              <Input
                id="edit-title"
                value={editingTreatmentData.title}
                onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter treatment title"
              />
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <Label htmlFor="edit-target-audience" className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Target Audience
              </Label>
              <Input
                id="edit-target-audience"
                value={editingTreatmentData.target_audience}
                onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, target_audience: e.target.value }))}
                placeholder="e.g., 18-35"
              />
            </div>

            {/* Estimated Budget */}
            <div className="space-y-2">
              <Label htmlFor="edit-estimated-budget" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Estimated Budget
              </Label>
              <Input
                id="edit-estimated-budget"
                value={editingTreatmentData.estimated_budget}
                onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, estimated_budget: e.target.value }))}
                placeholder="e.g., $10M"
              />
            </div>

            {/* Estimated Duration */}
            <div className="space-y-2">
              <Label htmlFor="edit-estimated-duration" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Estimated Duration
              </Label>
              <Input
                id="edit-estimated-duration"
                value={editingTreatmentData.estimated_duration}
                onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, estimated_duration: e.target.value }))}
                placeholder="e.g., 120 min"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editingTreatmentData.status}
                onValueChange={(val) => setEditingTreatmentData(prev => ({ ...prev, status: val as any }))}
              >
                <SelectTrigger id="edit-status">
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

            {/* Genre */}
            <div className="space-y-2">
              <Label htmlFor="edit-genre">Genre</Label>
              <Input
                id="edit-genre"
                value={editingTreatmentData.genre}
                onChange={(e) => setEditingTreatmentData(prev => ({ ...prev, genre: e.target.value }))}
                placeholder="e.g., Sci-Fi"
              />
            </div>

            {/* Dialog Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleCancelEditTreatment}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveTreatment} disabled={isSavingTreatment}>
                <Save className="h-4 w-4 mr-2" />
                {isSavingTreatment ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Synopsis - Full Width */}
        {(() => {
          // Check if synopsis and prompt are the same or very similar
          const synopsisText = treatment.synopsis?.trim() || ''
          const promptText = treatment.prompt?.trim() || ''
          
          // Only hide content if they are exactly the same (to avoid duplication)
          // But always show the card so user can add/edit synopsis
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
          
          // Always show the card, but hide content if identical to prompt
          // This allows users to add a synopsis even when there's no synopsis yet
          if (areIdentical) {
            return null
          }
          
          return (
            <Card className="mb-8">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">Synopsis</span>
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {!isEditingSynopsis ? (
                      <>
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

        {/* Treatment (Full Document) - Full Width */}
        <Collapsible open={isTreatmentExpanded} onOpenChange={setIsTreatmentExpanded}>
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CollapsibleTrigger className="flex items-center gap-2 flex-shrink-0 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
                  {isTreatmentExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <CardTitle className="flex items-center gap-2 text-base min-w-0">
                    <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span className="truncate">Treatment</span>
                  </CardTitle>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                  {!isEditingPrompt ? (
                    <>
                      {/* AI Regenerate Button */}
                      {(treatment.synopsis || treatment.logline || treatment.title || treatment.prompt) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={generateAITreatment}
                          disabled={isGeneratingTreatment || !aiSettingsLoaded}
                          className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 flex-shrink-0"
                          title="Generate a new full treatment using AI from existing content"
                        >
                          {isGeneratingTreatment ? (
                            <>
                              <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                              <span className="hidden sm:inline">Generating...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">AI Regenerate</span>
                              <span className="sm:hidden">AI</span>
                            </>
                          )}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={handleStartEditPrompt} className="flex-shrink-0">
                        <Edit className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">{treatment.prompt ? 'Edit' : 'Add Treatment'}</span>
                        <span className="sm:hidden">Edit</span>
                      </Button>
                    </>
                  ) : (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={handleCancelEditPrompt} className="flex-1 sm:flex-initial">
                          <X className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Cancel</span>
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSavePrompt} disabled={isSavingPrompt} className="flex-1 sm:flex-initial">
                          <Save className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">{isSavingPrompt ? 'Saving...' : 'Save'}</span>
                          <span className="sm:hidden">{isSavingPrompt ? '...' : 'Save'}</span>
                        </Button>
                      </div>
                    )}
                </div>
              </div>
              <CardDescription className="pt-1 pl-6">
                Full treatment document - paste your complete treatment here (matches ideas.prompt field)
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-4">
                  {isEditingPrompt ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="treatment-textarea">Treatment Document</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={enhanceTreatmentText}
                            disabled={isEnhancingText || !editingPrompt.trim()}
                            className="flex items-center gap-2"
                          >
                            {isEnhancingText ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4" />
                            )}
                            {isEnhancingText ? "Enhancing..." : "Enhance Text"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={formatAsTreatment}
                            disabled={isFormattingAsTreatment || !editingPrompt.trim()}
                            className="flex items-center gap-2"
                          >
                            {isFormattingAsTreatment ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                            {isFormattingAsTreatment ? "Formatting..." : "Format as Treatment"}
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        id="treatment-textarea"
                        value={editingPrompt}
                        onChange={(e) => setEditingPrompt(e.target.value)}
                        placeholder="Paste your full treatment document here. This is the complete treatment (like ideas.prompt), separate from the synopsis above."
                        rows={25}
                        className="text-base leading-relaxed font-mono min-h-[500px]"
                      />
                    </div>
                  ) : (
                    <>
                      {treatment.prompt ? (
                        <p className="text-base leading-relaxed whitespace-pre-wrap font-mono">{treatment.prompt}</p>
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
            </CollapsibleContent>
            {/* Text to Speech Component - Always visible outside collapsible */}
            {treatment.prompt && !isEditingPrompt && (
              <CardContent className="pt-0">
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
              </CardContent>
            )}
          </Card>
        </Collapsible>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Characters */}
            {treatment.characters && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Characters</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="whitespace-pre-line">{treatment.characters}</p>
                    
                    {/* Saved Characters with Thumbnails */}
                    {treatment.project_id && savedCharacters.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <Label className="text-sm font-medium mb-3 block">Saved Characters ({savedCharacters.length})</Label>
                        <div className="flex flex-wrap gap-3">
                          {savedCharacters.map((char) => (
                            <div
                              key={char.id}
                              className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                            >
                              {char.image_url ? (
                                <div className="w-8 h-8 rounded overflow-hidden border border-border flex-shrink-0">
                                  <img
                                    src={char.image_url}
                                    alt={char.name}
                                    className="w-full h-full object-cover object-top"
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded border border-border flex-shrink-0 flex items-center justify-center bg-muted">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <span className="text-sm font-medium">{char.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
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

            {/* Locations - Collapsible */}
            {treatment?.project_id && (
              <Collapsible open={isLocationsExpanded} onOpenChange={setIsLocationsExpanded}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CollapsibleTrigger className="flex items-center gap-2 flex-shrink-0 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
                        {isLocationsExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <CardTitle className="flex items-center gap-2 text-base min-w-0">
                          <MapPin className="h-5 w-5 text-purple-500 flex-shrink-0" />
                          <span className="truncate">Locations</span>
                        </CardTitle>
                      </CollapsibleTrigger>
                    </div>
                  <CardDescription className="pt-1 pl-6">
                    Aggregate locations from treatment scenes and manage location records.
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Detected Locations Section */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h3 className="text-sm font-medium flex items-center gap-2">
                            <ListFilter className="h-4 w-4 flex-shrink-0" />
                            Detected Locations ({detectedLocations.length})
                          </h3>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={detectLocationsFromTreatment}
                            disabled={isDetectingLocations || !treatment}
                            className="gap-2 flex-shrink-0 whitespace-nowrap"
                          >
                            {isDetectingLocations ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Detecting...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3" />
                                Detect from Treatment
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {detectedLocations.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              {treatmentScenes.length === 0 
                                ? "No locations found. Click 'Detect from Treatment' to find locations in your treatment content."
                                : "No locations found in scenes."}
                            </div>
                          ) : (
                            detectedLocations.map((loc) => {
                              const alreadyExists = locations.some(
                                (l) => l.name.toLowerCase() === loc.name.toLowerCase(),
                              )
                              const isSaving = savingLocations.includes(loc.name)
                              
                              return (
                                <div key={loc.name} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Badge variant="outline">{loc.count}</Badge>
                                    <span className="flex-1">{loc.name}</span>
                                  </div>
                                  {alreadyExists ? (
                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                      Saved
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async () => {
                                        await saveLocationAsRecord(loc.name)
                                      }}
                                      disabled={isSaving || !treatment?.project_id}
                                      className="gap-1 h-8 text-xs"
                                    >
                                      {isSaving ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Save className="h-3 w-3" />
                                          Save
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Saved Locations Section */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <h3 className="text-sm font-medium">
                            Saved Locations ({savedLocations.length})
                          </h3>
                          <Link href={`/locations?movie=${treatment.project_id}`}>
                            <Button variant="outline" size="sm" className="gap-2">
                              <MapPin className="h-4 w-4" />
                              Manage Locations
                            </Button>
                          </Link>
                        </div>
                        {isLoadingLocations ? (
                          <div className="flex items-center gap-2 py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Loading locations...</span>
                          </div>
                        ) : (savedLocations.length === 0 && locations.length === 0) ? (
                          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                            No locations saved yet. Use "Detect from Treatment" or "Save" to create location records.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {(savedLocations.length > 0 ? savedLocations : locations.map(l => ({ id: l.id, name: l.name, image_url: l.image_url }))).map((loc) => {
                              const savedLocation = savedLocations.find(sl => sl.id === loc.id) || locations.find(l => l.id === loc.id)
                              return (
                                <div
                                  key={loc.id}
                                  className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                                  onClick={async () => {
                                    setViewLocationDialogOpen(true)
                                    setViewingLocation({
                                      ...loc,
                                      fullDetails: null
                                    })
                                    
                                    // Load full location details
                                    try {
                                      const locationDetails = await LocationsService.getLocations(treatment?.project_id || '')
                                      const locationDetail = locationDetails.find(l => l.id === loc.id)
                                      if (locationDetail) {
                                        setViewingLocation({
                                          ...loc,
                                          fullDetails: locationDetail
                                        })
                                      }
                                    } catch (error) {
                                      console.error('Error fetching location details:', error)
                                      setViewingLocation({
                                        ...loc,
                                        fullDetails: null
                                      })
                                    }
                                  }}
                                  title="Click to view location details"
                                >
                                  {loc.image_url ? (
                                    <div className="w-8 h-8 rounded overflow-hidden border border-border flex-shrink-0">
                                      <img
                                        src={loc.image_url}
                                        alt={loc.name}
                                        className="w-full h-full object-cover object-center"
                                        onError={(e) => {
                                          console.error('📸 Treatment - Image failed to load:', loc.image_url)
                                          const target = e.target as HTMLImageElement
                                          target.style.display = 'none'
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded border border-border flex-shrink-0 flex items-center justify-center bg-muted">
                                      <MapPin className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <span className="text-sm font-medium">{loc.name}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Characters & Casting Integration - Collapsible */}
            <Collapsible open={isCharactersExpanded} onOpenChange={setIsCharactersExpanded}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CollapsibleTrigger className="flex items-center gap-2 flex-shrink-0 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
                      {isCharactersExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <CardTitle className="flex items-center gap-2 text-base min-w-0">
                        <Users className="h-5 w-5 text-purple-500 flex-shrink-0" />
                        <span className="truncate">Characters</span>
                      </CardTitle>
                    </CollapsibleTrigger>
                  </div>
                  <CardDescription className="pt-1 pl-6">
                    Aggregate characters from treatment scenes and sync with casting roles.
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
                      <Input
                        placeholder="Filter characters/roles..."
                        value={charactersFilter}
                        onChange={(e) => setCharactersFilter(e.target.value)}
                        className="h-8 bg-input border-border flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={missingInRoles.length === 0 || isSyncingRoles || !treatment?.project_id}
                        onClick={syncAllMissingToRoles}
                        className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 flex-shrink-0"
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <ListFilter className="h-4 w-4 flex-shrink-0" />
                        Detected Characters ({detectedCharacters.length})
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={detectCharactersFromTreatment}
                        disabled={isDetectingCharacters || !treatment}
                        className="gap-2 flex-shrink-0 whitespace-nowrap"
                      >
                        {isDetectingCharacters ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Detecting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Detect from Treatment
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {detectedCharacters.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No characters found in scenes.</div>
                      ) : (
                        detectedCharacters.map((c) => {
                          const alreadyRole = (castingSettings?.roles_available || []).some(
                            (r) => r.toLowerCase() === c.name.toLowerCase(),
                          )
                          const isEditing = editingCharacterName === c.name
                          const displayName = editedCharacterNames[c.name] || c.name
                          const isSaving = savingCharacters.includes(c.name)
                          // Find saved character to get thumbnail (try exact match first, then partial match)
                          const savedCharacter = savedCharacters.find(
                            sc => {
                              const savedNameLower = sc.name.toLowerCase().trim()
                              const detectedNameLower = c.name.toLowerCase().trim()
                              // Exact match
                              if (savedNameLower === detectedNameLower) {
                                console.log('📸 Treatment - Exact match:', c.name, '->', sc.name, 'thumbnail:', sc.image_url ? 'Yes' : 'No')
                                return true
                              }
                              // Partial match - saved name contains detected name or vice versa
                              if (savedNameLower.includes(detectedNameLower) || detectedNameLower.includes(savedNameLower)) {
                                console.log('📸 Treatment - Partial match:', c.name, '->', sc.name, 'thumbnail:', sc.image_url ? 'Yes' : 'No')
                                return true
                              }
                              return false
                            }
                          )
                          if (!savedCharacter) {
                            console.log('📸 Treatment - No match found for:', c.name, 'Available saved:', savedCharacters.map(sc => sc.name))
                          }
                          
                          return (
                            <div key={c.name} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {savedCharacter?.image_url ? (
                                  <div 
                                    className="w-8 h-8 rounded overflow-hidden border border-border flex-shrink-0 bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                    onClick={async () => {
                                      // Fetch full character details
                                      try {
                                        const fullCharacter = await CharactersService.getCharacters(treatment?.project_id || '')
                                        const characterDetails = fullCharacter.find(ch => ch.id === savedCharacter.id)
                                        setViewingCharacter({
                                          ...savedCharacter,
                                          fullDetails: characterDetails || null
                                        })
                                        setViewCharacterDialogOpen(true)
                                      } catch (error) {
                                        console.error('Error fetching character details:', error)
                                        setViewingCharacter({
                                          ...savedCharacter,
                                          fullDetails: null
                                        })
                                        setViewCharacterDialogOpen(true)
                                      }
                                    }}
                                    title="Click to view character details"
                                  >
                                    <img
                                      src={savedCharacter.image_url}
                                      alt={c.name}
                                      className="w-full h-full object-cover object-top"
                                      onError={(e) => {
                                        console.error('📸 Treatment - Image failed to load:', savedCharacter.image_url)
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                      }}
                                    />
                                  </div>
                                ) : savedCharacter ? (
                                  <div className="w-8 h-8 rounded border border-border flex-shrink-0 flex items-center justify-center bg-muted">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-xs">{c.count}</Badge>
                                )}
                                {isEditing ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      value={displayName}
                                      onChange={(e) => setEditedCharacterNames(prev => ({
                                        ...prev,
                                        [c.name]: e.target.value
                                      }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveCharacterNameEdit(c.name)
                                        } else if (e.key === 'Escape') {
                                          cancelEditingCharacter()
                                        }
                                      }}
                                      className="h-8 flex-1"
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => saveCharacterNameEdit(c.name)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={cancelEditingCharacter}
                                      className="h-8 w-8 p-0"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="flex-1">{c.name}</span>
                                )}
                              </div>
                              {!isEditing && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditingCharacter(c.name)}
                                    disabled={isSaving || !treatment?.project_id}
                                    className="h-8 w-8 p-0"
                                    title="Edit name"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      await saveCharacterAsRecord(c.name)
                                    }}
                                    disabled={isSaving || !ready}
                                    className="h-8 w-8 p-0 hover:bg-muted"
                                    title="Save as character (will create movie project if needed)"
                                  >
                                    {isSaving ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                  </Button>
                                  {alreadyRole ? (
                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                      In Casting
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addRole(c.name)}
                                      disabled={isSyncingRoles || !treatment?.project_id}
                                      className="gap-1 h-8 text-xs"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Casting
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ListFilter className="h-4 w-4 flex-shrink-0 opacity-0" />
                      Casting Roles ({rolesAvailable.length})
                    </h3>
                    <div className="flex items-end gap-2 mb-3">
                      <div className="flex-1 min-w-0">
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
                        className="gap-2 flex-shrink-0"
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
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Treatment Scenes - Collapsible */}
            <Collapsible open={isScenesExpanded} onOpenChange={setIsScenesExpanded}>
              <Card>
                <CardHeader className="pb-3 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
                    <CollapsibleTrigger className="flex items-center gap-2 flex-shrink-0 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
                      {isScenesExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <CardTitle className="flex items-center gap-2 text-base min-w-0">
                        <Film className="h-5 w-5 text-purple-500 flex-shrink-0" />
                        <span className="truncate">Scenes</span>
                      </CardTitle>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2 flex-wrap min-w-0" onClick={(e) => e.stopPropagation()}>
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
                        onClick={addNewScene}
                        className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                        title="Add a new empty scene"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Scene
                      </Button>
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
                  <CardDescription className="pt-1 pl-6">
                    Break down your treatment into individual scenes
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
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
                        <CardHeader className="pb-3 overflow-hidden">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  Scene {scene.scene_number || 'N/A'}
                                </Badge>
                                {scene.status && (
                                  <Badge variant="outline" className="text-xs flex-shrink-0">
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
                                <CardTitle className="text-lg break-words">{scene.name}</CardTitle>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
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
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => moveSceneUp(scene.id)}
                                      disabled={treatmentScenes.findIndex(s => s.id === scene.id) === 0 || isReorderingScenes}
                                      className="h-6 w-6 p-0 border-gray-300 hover:bg-gray-100"
                                      title="Move scene up"
                                    >
                                      {isReorderingScenes ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <ArrowUp className="h-3 w-3" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => moveSceneDown(scene.id)}
                                      disabled={treatmentScenes.findIndex(s => s.id === scene.id) === treatmentScenes.length - 1 || isReorderingScenes}
                                      className="h-6 w-6 p-0 border-gray-300 hover:bg-gray-100"
                                      title="Move scene down"
                                    >
                                      {isReorderingScenes ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <ArrowDown className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/timeline-scene/${scene.id}`)}
                                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    title="Open scene page"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
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
                                  <Label>Setting</Label>
                                  <Input
                                    value={editingScene.shot_type || ''}
                                    onChange={(e) => setEditingScene({ ...editingScene, shot_type: e.target.value })}
                                    placeholder="e.g., Interior Daytime, Exterior Night"
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
                                    <span className="font-medium">Setting: </span>
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
                </CollapsibleContent>
              </Card>
            </Collapsible>

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

          </div>

          {/* Right Column - Details - Sticky Sidebar */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-8 space-y-6">
              {/* Project Details Card - Collapsible */}
              <Collapsible open={isTreatmentDetailsExpanded} onOpenChange={setIsTreatmentDetailsExpanded}>
                <Card id="treatment-details">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CollapsibleTrigger className="flex items-center gap-2 flex-shrink-0 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
                        {isTreatmentDetailsExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <CardTitle className="flex items-center gap-2 text-base min-w-0">
                          <FileText className="h-5 w-5 text-purple-500 flex-shrink-0" />
                          <span className="truncate">Project Details</span>
                        </CardTitle>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
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
                    </div>
                    <CardDescription className="pt-1 pl-6">
                      Project information and metadata
                    </CardDescription>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                  <div className="space-y-6">
                    {/* Project Details */}
                    <div className="grid grid-cols-1 gap-4">
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
                    <div className="flex flex-col gap-4 pt-4 border-t">
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
                    </div>

                    {/* Timeline & Quick Info */}
                    <div className="pt-4 border-t space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Created</span>
                        </div>
                        <p className="text-sm font-medium pl-6">
                          {new Date(treatment.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Last Updated</span>
                        </div>
                        <p className="text-sm font-medium pl-6">
                          {new Date(treatment.updated_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>

                      {treatment.project_id && movie && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Film className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Linked Project</span>
                              </div>
                              {!isEditingMovieName && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleStartEditMovieName}
                                  className="h-6 px-2"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {isEditingMovieName ? (
                              <div className="pl-6 space-y-2">
                                <Input
                                  value={editingMovieName}
                                  onChange={(e) => setEditingMovieName(e.target.value)}
                                  placeholder="Movie name"
                                  className="max-w-xs"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEditMovieName}
                                    disabled={isSavingMovieName}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleSaveMovieName}
                                    disabled={isSavingMovieName}
                                  >
                                    <Save className="h-3 w-3 mr-1" />
                                    {isSavingMovieName ? 'Saving...' : 'Save'}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Link href={`/screenplay/${movie.id}`} className="pl-6">
                                <Button variant="link" className="p-0 h-auto font-medium text-green-400 hover:text-green-300" size="sm">
                                  {movie.name}
                                </Button>
                              </Link>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Logline */}
              {treatment.logline && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle>Logline</CardTitle>
                        <CardDescription>One-sentence summary</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
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

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    size="sm"
                    onClick={() => {
                      const element = document.getElementById('treatment-details')
                      element?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Details
                  </Button>
                  {treatment.project_id && (
                    <Button variant="outline" className="w-full justify-start" size="sm" asChild>
                      <Link href={`/screenplay/${treatment.project_id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Screenplay
                      </Link>
                    </Button>
                  )}
                  {treatment.project_id && (
                    <Button variant="outline" className="w-full justify-start" size="sm" asChild>
                      <Link href={`/timeline?movie=${treatment.project_id}`}>
                        <Film className="h-4 w-4 mr-2" />
                        View Timeline
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* View Character Details Dialog */}
      <Dialog open={viewCharacterDialogOpen} onOpenChange={setViewCharacterDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle className="text-2xl">{viewingCharacter?.name || 'Character Details'}</DialogTitle>
            {viewingCharacter?.fullDetails && (
              <DialogDescription>
                {viewingCharacter.fullDetails.archetype && `Archetype: ${viewingCharacter.fullDetails.archetype}`}
                {viewingCharacter.fullDetails.age && viewingCharacter.fullDetails.gender && ` • ${viewingCharacter.fullDetails.age} years old, ${viewingCharacter.fullDetails.gender}`}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Character Image */}
              {viewingCharacter?.image_url && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Character Image</Label>
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                    <img
                      src={viewingCharacter.image_url}
                      alt={viewingCharacter.name}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (viewingCharacter?.id) {
                        router.push(`/characters/${viewingCharacter.id}`)
                        setViewCharacterDialogOpen(false)
                      }
                    }}
                    className="w-full"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Character Page
                  </Button>
                </div>
              )}
              
              {/* Character Details */}
              <div className="space-y-4">
                {viewingCharacter?.fullDetails ? (
                  <>
                    {viewingCharacter.fullDetails.description && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Description</Label>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingCharacter.fullDetails.description}</p>
                      </div>
                    )}
                    {!viewingCharacter.fullDetails.description && (
                      <div className="text-sm text-muted-foreground">
                        No description available for this character.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Character details not available. This character has been saved but full details haven't been loaded.
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 flex-shrink-0">
            {viewingCharacter?.id && (
              <Button
                variant="outline"
                onClick={() => {
                  router.push(`/characters/${viewingCharacter.id}`)
                  setViewCharacterDialogOpen(false)
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                View Full Character Page
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setViewCharacterDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Location Dialog */}
      <Dialog open={viewLocationDialogOpen} onOpenChange={setViewLocationDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle className="text-2xl">{viewingLocation?.name || 'Location Details'}</DialogTitle>
            {viewingLocation?.fullDetails && (
              <DialogDescription>
                {viewingLocation.fullDetails.type && `Type: ${viewingLocation.fullDetails.type}`}
                {viewingLocation.fullDetails.address && ` • ${viewingLocation.fullDetails.address}`}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Location Image */}
              {viewingLocation?.image_url && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Location Image</Label>
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                    <img
                      src={viewingLocation.image_url}
                      alt={viewingLocation.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (viewingLocation?.id) {
                        router.push(`/locations/${viewingLocation.id}`)
                      }
                    }}
                    className="w-full"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Location Page
                  </Button>
                </div>
              )}
              
              {/* Location Details */}
              <div className="space-y-4">
                {viewingLocation?.fullDetails ? (
                  <>
                    {viewingLocation.fullDetails.description && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Description</Label>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingLocation.fullDetails.description}</p>
                      </div>
                    )}
                    {!viewingLocation.fullDetails.description && (
                      <div className="text-sm text-muted-foreground">
                        No description available for this location.
                      </div>
                    )}
                    {viewingLocation.fullDetails.visual_description && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Visual Description</Label>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingLocation.fullDetails.visual_description}</p>
                      </div>
                    )}
                    {viewingLocation.fullDetails.atmosphere && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Atmosphere</Label>
                        <p className="text-sm text-muted-foreground">{viewingLocation.fullDetails.atmosphere}</p>
                      </div>
                    )}
                    {viewingLocation.fullDetails.mood && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Mood</Label>
                        <p className="text-sm text-muted-foreground">{viewingLocation.fullDetails.mood}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Location details not available. This location has been saved but full details haven't been loaded.
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 flex-shrink-0">
            {viewingLocation?.id && (
              <Button
                variant="outline"
                onClick={() => {
                  router.push(`/locations/${viewingLocation.id}`)
                }}
              >
                <MapPin className="h-4 w-4 mr-2" />
                View Full Location Page
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setViewLocationDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cover Image View Dialog */}
      <Dialog open={showCoverImageDialog} onOpenChange={setShowCoverImageDialog}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Cover Image</DialogTitle>
            <DialogDescription>
              {treatment?.title} - {coverImageAssets.length > 0 && coverImageAssets[currentCoverIndex] 
                ? `Cover ${currentCoverIndex + 1} of ${coverImageAssets.length}`
                : 'Cover Image'}
            </DialogDescription>
          </DialogHeader>
          <div className="relative flex items-center justify-center bg-muted/50 p-6 min-h-[400px] max-h-[80vh] overflow-auto">
            {coverImageAssets.length > 0 && coverImageAssets[currentCoverIndex] ? (
              <img
                src={coverImageAssets[currentCoverIndex].content_url || treatment?.cover_image_url}
                alt={`${treatment?.title} cover ${currentCoverIndex + 1}`}
                className="max-w-full max-h-[75vh] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : treatment?.cover_image_url ? (
              <img
                src={treatment.cover_image_url}
                alt={`${treatment.title} cover`}
                className="max-w-full max-h-[75vh] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : null}
            {coverImageAssets.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const prevIndex = currentCoverIndex > 0 ? currentCoverIndex - 1 : coverImageAssets.length - 1
                    setCurrentCoverIndex(prevIndex)
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-3 backdrop-blur-sm"
                  aria-label="Previous cover"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={() => {
                    const nextIndex = (currentCoverIndex + 1) % coverImageAssets.length
                    setCurrentCoverIndex(nextIndex)
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-3 backdrop-blur-sm"
                  aria-label="Next cover"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button
              variant="outline"
              onClick={() => setShowCoverImageDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

