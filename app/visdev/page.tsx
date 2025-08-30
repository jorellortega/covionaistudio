'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { OpenAIService, AnthropicService, OpenArtService } from '@/lib/ai-services'
import { AISettingsService } from '@/lib/ai-settings-service'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseClient } from '@/lib/supabase'
import { ProjectSelector } from '@/components/project-selector'
import { MovieService, Movie } from '@/lib/movie-service'
import { TimelineService, SceneWithMetadata } from '@/lib/timeline-service'
import { AssetService, CreateAssetData } from '@/lib/asset-service'
import { PreferencesService } from '@/lib/preferences-service'
import { SavedPromptsService } from '@/lib/saved-prompts-service'
import Header from '@/components/header'
import { Loader2, Eye, EyeOff, Edit3, CheckCircle } from 'lucide-react'

interface VisualDevelopmentItem {
  id: string
  type: 'character' | 'environment' | 'prop' | 'color' | 'lighting' | 'style'
  title: string
  description: string
  prompt: string
  generatedContent?: string
  generatedImage?: string
  tags: string[]
  projectId?: string | null
  sceneId?: string | null
  databaseId?: string | null
  createdAt: string
}

interface SavedPrompt {
  id: string
  type: 'character' | 'environment' | 'prop' | 'color' | 'lighting' | 'style' | 'prompt'
  title: string
  prompt: string
  style: string
  model: string
  tags: string[]
  projectId?: string | null
  sceneId?: string | null
  createdAt: string
  useCount: number
  // Database fields (will be populated when loading from DB)
  user_id?: string
  project_id?: string | null
  scene_id?: string | null
  use_count?: number
  created_at?: string
  updated_at?: string
}

export default function VisualDevelopmentPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<VisualDevelopmentItem[]>([])
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  const [activeTab, setActiveTab] = useState('characters')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiSettings, setAiSettings] = useState<any>(null)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const [selectedProject, setSelectedProject] = useState<string>("all")
  const [selectedScene, setSelectedScene] = useState<string>("movie")
  const [movies, setMovies] = useState<Movie[]>([])
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [prompt, setPrompt] = useState('')
  const [promptTitle, setPromptTitle] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('none')
  const [selectedModel, setSelectedModel] = useState('openai')
  const [promptFilter, setPromptFilter] = useState('all')
  const [promptProjectFilter, setPromptProjectFilter] = useState('all')
  const [promptSceneFilter, setPromptSceneFilter] = useState('all')
  const [promptSearch, setPromptSearch] = useState('')
  const [customStyles, setCustomStyles] = useState<{[key: string]: string}>({})
  const [showCustomStyleInput, setShowCustomStyleInput] = useState(false)
  const [newCustomStyle, setNewCustomStyle] = useState({ name: '', description: '' })
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<VisualDevelopmentItem | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFiles, setImportFiles] = useState<File[]>([])
  const [importData, setImportData] = useState({
    title: '',
    description: '',
    prompt: '',
    type: 'character' as 'character' | 'environment' | 'prop' | 'color' | 'lighting' | 'style',
    style: 'cinematic'
  })
  const [isImporting, setIsImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedPromptId, setSelectedPromptId] = useState('none')
  const [hidePromptText, setHidePromptText] = useState(false)
  
  // Edit prompt state
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null)
  const [showEditPromptDialog, setShowEditPromptDialog] = useState(false)
  const [editPromptForm, setEditPromptForm] = useState({
    title: '',
    prompt: '',
    style: 'none',
    model: 'openai',
    type: 'character' as 'character' | 'environment' | 'prop' | 'color' | 'lighting' | 'style' | 'prompt'
  })

  const styles = {
    cinematic: 'Cinematic movie poster style, dramatic lighting, professional photography',
    concept: 'Concept art style, detailed illustration, professional artwork',
    sketch: 'Rough sketch style, pencil drawing, concept development',
    realistic: 'Photorealistic style, high detail, professional photography',
    stylized: 'Stylized art style, unique visual approach, artistic interpretation',
    // Custom styles
    cyberpunk: 'Cyberpunk aesthetic, neon lighting, futuristic urban decay, high contrast',
    fantasy: 'Fantasy art style, magical atmosphere, ethereal lighting, mystical elements',
    noir: 'Film noir style, high contrast, dramatic shadows, moody atmosphere',
    watercolor: 'Watercolor painting style, soft edges, artistic texture, flowing colors',
    anime: 'Anime style, cel-shaded, vibrant colors, expressive characters',
    steampunk: 'Steampunk aesthetic, brass and copper tones, Victorian era technology',
    sciFi: 'Science fiction style, futuristic technology, clean lines, advanced aesthetics',
    horror: 'Horror atmosphere, dark mood, unsettling elements, dramatic shadows'
  }

  // Combine built-in and custom styles
  const allStyles = {
    ...styles,
    ...customStyles
  }

  const models = {
    openai: 'OpenAI DALL-E 3',
    anthropic: 'Anthropic Claude',
    openart: 'OpenArt SDXL'
  }

    useEffect(() => {
    if (user) {
      loadAISettings()
      loadUserApiKeys()
      loadMovies()
      loadExistingItems()
      loadPreferences()
    }
  }, [user])

  // Load scenes when project changes
  useEffect(() => {
    if (selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
      loadScenes(selectedProject)
      setSelectedScene("movie") // Reset scene selection when project changes
    } else {
      setScenes([])
      setSelectedScene("movie")
    }
    
    // Reload prompts when project changes to show appropriate prompts
    if (user) {
      loadExistingItems()
    }
  }, [selectedProject, user])

  // Auto-select locked model when AI settings change
  useEffect(() => {
    if (aiSettings && aiSettings.is_locked && aiSettings.locked_model) {
      // Map the locked model to our model keys
      const modelMapping: { [key: string]: string } = {
        'DALL-E 3': 'openai',
        'Claude': 'anthropic',
        'SDXL': 'openart'
      }
      const mappedModel = modelMapping[aiSettings.locked_model]
      if (mappedModel) {
        setSelectedModel(mappedModel)
      }
    }
  }, [aiSettings])

  // Log prompts whenever they change for debugging
  useEffect(() => {
    console.log('🔄 Prompts updated:', savedPrompts.length, 'total prompts')
    console.log('📊 Prompt breakdown:', savedPrompts.reduce((acc, p) => {
      const key = p.projectId ? `Project: ${p.projectId}` : 'Universal (no project)'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>))
  }, [savedPrompts])

  // Function to migrate localStorage prompts to database
  const migratePromptsToDatabase = async () => {
    if (!user) {
      toast({
        title: "Cannot Migrate",
        description: "Please log in to migrate prompts to the database.",
        variant: "destructive"
      })
      return
    }

    try {
      const localPrompts = savedPrompts.filter(p => !p.user_id) // Only prompts not in database
      if (localPrompts.length === 0) {
        toast({
          title: "No Prompts to Migrate",
          description: "All prompts are already in the database.",
        })
        return
      }

      let migratedCount = 0
      for (const prompt of localPrompts) {
        try {
          // Determine project_id based on prompt's current projectId or current selection
          let project_id = prompt.projectId
          if (!project_id && selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
            project_id = selectedProject
          }
          // If still no project_id, it becomes a universal prompt (null)

          const dbPrompt = await SavedPromptsService.createSavedPrompt(user.id, {
            project_id: project_id,
            scene_id: prompt.sceneId,
            title: prompt.title,
            prompt: prompt.prompt,
            type: prompt.type,
            style: prompt.style,
            model: prompt.model,
            tags: prompt.tags
          })

          // Update the prompt with database fields
          const updatedPrompt = {
            ...prompt,
            id: dbPrompt.id,
            user_id: dbPrompt.user_id,
            project_id: dbPrompt.project_id,
            scene_id: dbPrompt.scene_id,
            use_count: dbPrompt.use_count,
            created_at: dbPrompt.created_at,
            updated_at: dbPrompt.updated_at
          }

          // Update local state
          const updatedPrompts = savedPrompts.map(p => 
            p.id === prompt.id ? updatedPrompt : p
          )
          setSavedPrompts(updatedPrompts)
          localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))

          migratedCount++
          console.log('✅ Migrated prompt to database:', prompt.title)
        } catch (error) {
          console.error('❌ Failed to migrate prompt:', prompt.title, error)
        }
      }

      toast({
        title: "Migration Complete",
        description: `Successfully migrated ${migratedCount} prompts to the database.`,
      })

      // Reload prompts to show updated state
      loadExistingItems()
    } catch (error) {
      console.error('Error migrating prompts:', error)
      toast({
        title: "Migration Failed",
        description: "Failed to migrate prompts. Check console for details.",
        variant: "destructive"
      })
    }
  }

  const loadAISettings = async () => {
    try {
      const settings = await AISettingsService.getUserSettings(user!.id)
      const imageSettings = settings.find(s => s.tab_type === 'images')
      setAiSettings(imageSettings)
    } catch (error) {
      console.error('Failed to load AI settings:', error)
    }
  }

  const loadUserApiKeys = async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      setUserApiKeys(data || {})
    } catch (error) {
      console.error('Error fetching user API keys:', error)
    }
  }

  const loadMovies = async () => {
    try {
      const userMovies = await MovieService.getMovies()
      setMovies(userMovies)
    } catch (error) {
      console.error('Error loading movies:', error)
      setMovies([])
    }
  }

  const loadScenes = async (movieId: string) => {
    try {
      if (movieId && movieId !== 'all' && movieId !== 'free') {
        const movieScenes = await TimelineService.getMovieScenes(movieId)
        setScenes(movieScenes)
        console.log('Loaded scenes for movie:', movieId, 'Count:', movieScenes.length)
      } else {
        setScenes([])
      }
    } catch (error) {
      console.error('Error loading scenes:', error)
      setScenes([])
    }
  }

  const loadPreferences = async () => {
    try {
      const hidePrompt = await PreferencesService.getHidePromptText()
      setHidePromptText(hidePrompt)
    } catch (error) {
      console.error('Error loading preferences:', error)
    }
  }

  const loadExistingItems = async () => {
    // In a real app, this would load from your database
    // For now, we'll use localStorage
    const saved = localStorage.getItem('visdev-items')
    if (saved) {
      setItems(JSON.parse(saved))
    }
    
    // Load prompts from both localStorage and database
    let allPrompts: SavedPrompt[] = []
    
    // First, try to load from database if user is logged in
    if (user) {
      try {
        // When no project is selected, only load universal prompts (no project_id)
        // When a project is selected, load both project-specific and universal prompts
        let dbPrompts
        if (selectedProject === 'all' || selectedProject === 'free') {
          // In free play mode, only show universal prompts (no project_id)
          dbPrompts = await SavedPromptsService.getSavedPrompts(user.id, null)
        } else {
          // When a specific project is selected, show both project-specific and universal prompts
          dbPrompts = await SavedPromptsService.getSavedPrompts(user.id, selectedProject)
        }
        
        console.log('✅ Loaded prompts from database:', dbPrompts.length, 'for project:', selectedProject)
        console.log('📋 Prompt details:', dbPrompts.map(p => ({ id: p.id, title: p.title, project_id: p.project_id, type: p.type })))
        
        // Debug: Check if we're getting the right prompts for the current mode
        if (selectedProject === 'all' || selectedProject === 'free') {
          const universalPrompts = dbPrompts.filter(p => p.project_id === null)
          const projectPrompts = dbPrompts.filter(p => p.project_id !== null)
          console.log('🔍 Free Play Mode - Universal prompts:', universalPrompts.length, 'Project prompts:', projectPrompts.length)
        } else {
          const projectPrompts = dbPrompts.filter(p => p.project_id === selectedProject)
          const universalPrompts = dbPrompts.filter(p => p.project_id === null)
          console.log('🔍 Project Mode - Project prompts:', projectPrompts.length, 'Universal prompts:', universalPrompts.length)
        }
        
        // Convert database format to local format
        const convertedDbPrompts: SavedPrompt[] = dbPrompts.map(dbPrompt => ({
          id: dbPrompt.id,
          type: dbPrompt.type,
          title: dbPrompt.title,
          prompt: dbPrompt.prompt,
          style: dbPrompt.style || 'none',
          model: dbPrompt.model || 'openai',
          tags: dbPrompt.tags || [],
          projectId: dbPrompt.project_id,
          sceneId: dbPrompt.scene_id,
          createdAt: dbPrompt.created_at,
          useCount: dbPrompt.use_count || 0,
          // Database fields
          user_id: dbPrompt.user_id,
          project_id: dbPrompt.project_id,
          scene_id: dbPrompt.scene_id,
          use_count: dbPrompt.use_count,
          created_at: dbPrompt.created_at,
          updated_at: dbPrompt.updated_at
        }))
        
        allPrompts = [...convertedDbPrompts]
      } catch (error) {
        console.error('❌ Failed to load prompts from database:', error)
      }
    }
    
    // Then load from localStorage as backup/merge, but filter by current project selection
    const savedPromptsData = localStorage.getItem('visdev-saved-prompts')
    if (savedPromptsData) {
      const localPrompts = JSON.parse(savedPromptsData)
      console.log('✅ Loaded prompts from localStorage:', localPrompts.length)
      
      // Filter localStorage prompts based on current project selection
      let filteredLocalPrompts = localPrompts
      if (selectedProject === 'all' || selectedProject === 'free') {
        // In Free Play Mode, only show prompts without project association
        filteredLocalPrompts = localPrompts.filter((p: SavedPrompt) => !p.projectId)
        console.log('🔍 Free Play Mode - Filtered localStorage prompts:', filteredLocalPrompts.length, 'of', localPrompts.length)
      } else {
        // In Project Mode, show both project-specific and universal prompts
        filteredLocalPrompts = localPrompts.filter((p: SavedPrompt) => 
          !p.projectId || p.projectId === selectedProject
        )
        console.log('🔍 Project Mode - Filtered localStorage prompts:', filteredLocalPrompts.length, 'of', localPrompts.length)
      }
      
      // Merge with database prompts, avoiding duplicates
      const localPromptIds = new Set(allPrompts.map(p => p.id))
      const uniqueLocalPrompts = filteredLocalPrompts.filter((p: SavedPrompt) => !localPromptIds.has(p.id))
      
      allPrompts = [...allPrompts, ...uniqueLocalPrompts]
    }
    
    console.log('✅ Total prompts loaded:', allPrompts.length)
    setSavedPrompts(allPrompts)
    
    const savedCustomStyles = localStorage.getItem('visdev-custom-styles')
    if (savedCustomStyles) {
      setCustomStyles(JSON.parse(savedCustomStyles))
    }
  }

  const saveItems = (newItems: VisualDevelopmentItem[]) => {
    setItems(newItems)
    localStorage.setItem('visdev-items', JSON.stringify(newItems))
  }

  const savePrompt = async (newPrompt: SavedPrompt) => {
    try {
      // Always save to database if user is logged in
      if (user) {
        try {
          // Determine project_id based on current selection
          let project_id = null
          if (selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
            project_id = selectedProject
          }
          // If no project selected, project_id remains null (universal prompt)
          
          const dbPrompt = await SavedPromptsService.createSavedPrompt(user.id, {
            project_id: project_id,
            scene_id: selectedScene === 'movie' ? null : selectedScene,
            title: newPrompt.title,
            prompt: newPrompt.prompt,
            type: newPrompt.type,
            style: newPrompt.style,
            model: newPrompt.model,
            tags: newPrompt.tags
          })
          
          // Update the prompt with database ID and fields
          newPrompt = {
            ...newPrompt,
            id: dbPrompt.id,
            user_id: dbPrompt.user_id,
            project_id: dbPrompt.project_id,
            scene_id: dbPrompt.scene_id,
            use_count: dbPrompt.use_count,
            created_at: dbPrompt.created_at,
            updated_at: dbPrompt.updated_at
          }
          
          console.log('✅ Prompt saved to database:', dbPrompt)
        } catch (error) {
          console.error('❌ Failed to save prompt to database:', error)
          // Continue with localStorage save even if database save fails
        }
      }
      
      // Always save to localStorage as backup
      const updatedPrompts = [...savedPrompts, newPrompt]
      setSavedPrompts(updatedPrompts)
      localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))
    } catch (error) {
      console.error('Error saving prompt:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save prompt. Check console for details.",
        variant: "destructive"
      })
    }
  }

  const updatePromptUseCount = async (promptId: string) => {
    try {
      // Update in database if prompt has database fields
      const prompt = savedPrompts.find(p => p.id === promptId)
      if (prompt && prompt.user_id) {
        try {
          await SavedPromptsService.incrementUseCount(promptId)
          console.log('✅ Use count updated in database for prompt:', promptId)
        } catch (error) {
          console.error('❌ Failed to update use count in database:', error)
        }
      }
      
      // Update local state
      const updatedPrompts = savedPrompts.map(p => 
        p.id === promptId ? { ...p, useCount: p.useCount + 1 } : p
      )
      setSavedPrompts(updatedPrompts)
      localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))
    } catch (error) {
      console.error('Error updating prompt use count:', error)
    }
  }

  const deletePrompt = async (promptId: string) => {
    try {
      // Delete from database if prompt has database fields
      const prompt = savedPrompts.find(p => p.id === promptId)
      if (prompt && prompt.user_id) {
        try {
          await SavedPromptsService.deleteSavedPrompt(promptId)
          console.log('✅ Prompt deleted from database:', promptId)
        } catch (error) {
          console.error('❌ Failed to delete prompt from database:', error)
        }
      }
      
      // Update local state
      const updatedPrompts = savedPrompts.filter(p => p.id !== promptId)
      setSavedPrompts(updatedPrompts)
      localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))
    } catch (error) {
      console.error('Error deleting prompt:', error)
    }
  }

  const editPrompt = (prompt: SavedPrompt) => {
    setEditingPrompt(prompt)
    setEditPromptForm({
      title: prompt.title,
      prompt: prompt.prompt,
      style: prompt.style,
      model: prompt.model,
      type: prompt.type
    })
    setShowEditPromptDialog(true)
  }

  const saveEditedPrompt = async () => {
    if (!editingPrompt) return

    try {
      // Update in database if prompt has database fields
      if (editingPrompt.user_id) {
        try {
          await SavedPromptsService.updateSavedPrompt(editingPrompt.id, {
            title: editPromptForm.title,
            prompt: editPromptForm.prompt,
            style: editPromptForm.style,
            model: editPromptForm.model,
            type: editPromptForm.type
          })
          console.log('✅ Prompt updated in database:', editingPrompt.id)
        } catch (error) {
          console.error('❌ Failed to update prompt in database:', error)
        }
      }

      // Update local state
      const updatedPrompts = savedPrompts.map(p => 
        p.id === editingPrompt.id ? {
          ...p,
          title: editPromptForm.title,
          prompt: editPromptForm.prompt,
          style: editPromptForm.style,
          model: editPromptForm.model,
          type: editPromptForm.type
        } : p
      )
      setSavedPrompts(updatedPrompts)
      localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))

      // Close dialog and reset
      setShowEditPromptDialog(false)
      setEditingPrompt(null)
      setEditPromptForm({
        title: '',
        prompt: '',
        style: 'none',
        model: 'openai',
        type: 'character'
      })

      toast({
        title: "Prompt Updated",
        description: "Prompt has been updated successfully!",
      })
    } catch (error) {
      console.error('Error updating prompt:', error)
      toast({
        title: "Update Failed",
        description: "Failed to update prompt. Check console for details.",
        variant: "destructive"
      })
    }
  }

  const savePromptToDatabase = async (prompt: SavedPrompt) => {
    try {
      // Only save if user is logged in
      if (!user) {
        toast({
          title: "Cannot Save",
          description: "Please log in to save prompts to the database.",
          variant: "destructive"
        })
        return
      }

      // Check if prompt is already in database
      if (prompt.user_id) {
        toast({
          title: "Already Saved",
          description: "This prompt is already saved to the database.",
        })
        return
      }

      // Determine project_id based on current selection
      let project_id = null
      if (selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
        project_id = selectedProject
      }
      // If no project selected, project_id remains null (universal prompt)

      // Save to database
      const dbPrompt = await SavedPromptsService.createSavedPrompt(user.id, {
        project_id: project_id,
        scene_id: selectedScene === 'movie' ? null : selectedScene,
        title: prompt.title,
        prompt: prompt.prompt,
        type: prompt.type,
        style: prompt.style,
        model: prompt.model,
        tags: prompt.tags
      })

      // Update the prompt with database fields
      const updatedPrompt = {
        ...prompt,
        id: dbPrompt.id,
        user_id: dbPrompt.user_id,
        project_id: dbPrompt.project_id,
        scene_id: dbPrompt.scene_id,
        use_count: dbPrompt.use_count,
        created_at: dbPrompt.created_at,
        updated_at: dbPrompt.updated_at
      }

      // Update local state
      const updatedPrompts = savedPrompts.map(p => 
        p.id === prompt.id ? updatedPrompt : p
      )
      setSavedPrompts(updatedPrompts)
      localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))

      toast({
        title: "Prompt Saved!",
        description: `Prompt "${prompt.title}" has been saved to the database.`,
      })
    } catch (error) {
      console.error('Error saving prompt to database:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save prompt to database. Check console for details.",
        variant: "destructive"
      })
    }
  }

  const addCustomStyle = () => {
    if (newCustomStyle.name && newCustomStyle.description) {
      const styleKey = newCustomStyle.name.toLowerCase().replace(/\s+/g, '-')
      const updatedCustomStyles = {
        ...customStyles,
        [styleKey]: newCustomStyle.description
      }
      setCustomStyles(updatedCustomStyles)
      localStorage.setItem('visdev-custom-styles', JSON.stringify(updatedCustomStyles))
      setNewCustomStyle({ name: '', description: '' })
      setShowCustomStyleInput(false)
      toast({
        title: "Success",
        description: "Custom style added successfully!",
      })
    }
  }

  const deleteCustomStyle = (styleKey: string) => {
    const updatedCustomStyles = { ...customStyles }
    delete updatedCustomStyles[styleKey]
    setCustomStyles(updatedCustomStyles)
    localStorage.setItem('visdev-custom-styles', JSON.stringify(updatedCustomStyles))
    toast({
      title: "Style Deleted",
      description: "Custom style removed successfully!",
    })
  }

  const saveImageToBucket = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      const response = await fetch('/api/ai/download-and-store-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          fileName,
          userId: user!.id
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to save image: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        return result.supabaseUrl
      } else {
        throw new Error(result.error || 'Failed to save image')
      }
    } catch (error) {
      console.error('Error saving image to bucket:', error)
      throw error
    }
  }

  const saveToDatabase = async (item: VisualDevelopmentItem): Promise<void> => {
    try {
      if (!selectedProject || selectedProject === 'all' || selectedProject === 'free') {
        console.log('No project selected, skipping database save')
        return
      }

      // If the image is still a DALL-E URL and we have a project, try to save it to bucket first
      let finalImageUrl = item.generatedImage
      if (item.generatedImage && item.generatedImage.includes('oaidalleapiprodscus.blob.core.windows.net') && selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
        try {
          const fileName = `${Date.now()}-${item.type}-${item.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.png`
          const bucketUrl = await saveImageToBucket(item.generatedImage, fileName)
          finalImageUrl = bucketUrl
          console.log('✅ Image saved to bucket during database save:', bucketUrl)
          
          // Update the local item with the bucket URL
          const updatedItem = { ...item, generatedImage: bucketUrl }
          const updatedItems = items.map(i => i.id === item.id ? updatedItem : i)
          setItems(updatedItems)
          localStorage.setItem('visdev-items', JSON.stringify(updatedItems))
        } catch (error) {
          console.error('❌ Failed to save image to bucket during database save:', error)
          // Continue with DALL-E URL if bucket save fails
        }
      }

      // Prepare asset data
      const assetData: CreateAssetData = {
        project_id: selectedProject,
        scene_id: selectedScene === 'movie' ? null : selectedScene,
        title: item.title,
        content_type: 'image',
        content: item.generatedContent,
        content_url: finalImageUrl,
        prompt: item.prompt,
        model: selectedModel,
        generation_settings: {
          style: selectedStyle,
          type: item.type,
          tags: item.tags
        },
        metadata: {
          type: item.type,
          style: selectedStyle,
          tags: item.tags,
          projectId: item.projectId,
          sceneId: item.sceneId
        }
      }

      // Save to database
      const savedAsset = await AssetService.createAsset(assetData)
      console.log('Asset saved to database:', savedAsset)

      // Update local item with database ID
      const updatedItem = { ...item, databaseId: savedAsset.id }
      const updatedItems = items.map(i => i.id === item.id ? updatedItem : i)
      setItems(updatedItems)
      localStorage.setItem('visdev-items', JSON.stringify(updatedItems))

      toast({
        title: "Saved to Database",
        description: `Content saved to project: ${movies.find(m => m.id.toString() === selectedProject)?.name}`,
      })

    } catch (error) {
      console.error('Error saving to database:', error)
      toast({
        title: "Database Save Failed",
        description: "Content saved locally only. Check console for details.",
        variant: "destructive"
      })
    }
  }

  const deleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId)
    setItems(updatedItems)
    localStorage.setItem('visdev-items', JSON.stringify(updatedItems))
    toast({
      title: "Item Deleted",
      description: "Content removed successfully!",
    })
  }

  const saveEditedItem = async (editedItem: VisualDevelopmentItem) => {
    try {
      const updatedItems = items.map(item => 
        item.id === editedItem.id ? editedItem : item
      )
      setItems(updatedItems)
      localStorage.setItem('visdev-items', JSON.stringify(updatedItems))
      
      // If the item has a database ID, update it in the database too
      if (editedItem.databaseId && selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
        await saveToDatabase(editedItem)
      }
      
      setShowEditDialog(false)
      setEditingItem(null)
      
      toast({
        title: "Item Updated",
        description: "Content updated successfully!",
      })
    } catch (error) {
      console.error('Error updating item:', error)
      toast({
        title: "Update Failed",
        description: "Failed to update item. Check console for details.",
        variant: "destructive"
      })
    }
  }

  const handleFileSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    setImportFiles(fileArray)
    
    // Auto-generate title from first filename if multiple files
    if (fileArray.length === 1) {
      const fileName = fileArray[0].name.replace(/\.[^/.]+$/, '') // Remove file extension
      setImportData(prev => ({
        ...prev,
        title: fileName,
        description: `Imported ${fileName}`,
        prompt: `Imported image: ${fileName}`
      }))
    } else if (fileArray.length > 1) {
      setImportData(prev => ({
        ...prev,
        title: `${fileArray.length} Images`,
        description: `Imported ${fileArray.length} images`,
        prompt: `Imported ${fileArray.length} images`
      }))
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024
      )
      if (files.length > 0) {
        handleFileSelect(files)
      } else {
        toast({
          title: "Invalid Files",
          description: "Please select valid image files under 10MB each.",
          variant: "destructive"
        })
      }
    }
  }

  const importImages = async () => {
    if (!importFiles.length || !user) return
    
    setIsImporting(true)
    try {
      const supabase = getSupabaseClient()
      const newItems: VisualDevelopmentItem[] = []
      
      // Process each file
      for (let i = 0; i < importFiles.length; i++) {
        const file = importFiles[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${i}-imported-${importData.type}-${file.name.replace(/[^a-zA-Z0-9]/g, '-')}.${fileExt}`
        const filePath = `${user.id}/images/${fileName}`
        
        // Upload file to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('cinema_files')
          .upload(filePath, file)
        
        if (uploadError) throw uploadError
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('cinema_files')
          .getPublicUrl(filePath)
        
        const imageUrl = urlData.publicUrl
        
        // Create new visual development item
        const newItem: VisualDevelopmentItem = {
          id: Date.now().toString(),
          type: importData.type,
          title: importFiles.length === 1 ? importData.title : `${importData.title} - ${file.name.replace(/\.[^/.]+$/, '')}`,
          description: importFiles.length === 1 ? importData.description : `Imported ${file.name}`,
          prompt: importFiles.length === 1 ? importData.prompt : `Imported image: ${file.name}`,
          generatedImage: imageUrl,
          tags: [importData.type, importData.style],
          projectId: selectedProject === 'all' ? null : selectedProject,
          sceneId: selectedScene === 'movie' ? null : selectedScene || null,
          createdAt: new Date().toISOString()
        }
        
        newItems.push(newItem)
      }
      
      // Add all items to the list
      const updatedItems = [...items, ...newItems]
      setItems(updatedItems)
      localStorage.setItem('visdev-items', JSON.stringify(updatedItems))
      
      // Save to database if project is selected
      if (selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
        for (const item of newItems) {
          await saveToDatabase(item)
        }
      }
      
      // Reset form and close dialog
      setShowImportDialog(false)
      setImportFiles([])
      setImportData({
        title: '',
        description: '',
        prompt: '',
        type: 'character',
        style: 'cinematic'
      })
      
      toast({
        title: "Images Imported!",
        description: `${importFiles.length} image${importFiles.length === 1 ? '' : 's'} added to your visual development library.`,
      })
      
    } catch (error) {
      console.error('Error importing images:', error)
      toast({
        title: "Import Failed",
        description: "Failed to import images. Check console for details.",
        variant: "destructive"
      })
    } finally {
      setIsImporting(false)
    }
  }

  const editItem = (item: VisualDevelopmentItem) => {
    setEditingItem(item)
    setShowEditDialog(true)
    
    console.log('Edit item:', {
      type: item.type,
      prompt: item.prompt,
      style: item.tags.find(tag => Object.values(allStyles).includes(tag)) || 'cinematic'
    })
  }

  const isModelAvailable = (modelKey: string) => {
    if (!aiSettings || !aiSettings.is_locked) return false
    
    const modelMapping: { [key: string]: string } = {
      'openai': 'DALL-E 3',
      'anthropic': 'Claude',
      'openart': 'SDXL'
    }
    
    return aiSettings.locked_model === modelMapping[modelKey]
  }

  const getModelStatus = (modelKey: string) => {
    if (!aiSettings) return 'Not Configured'
    if (!aiSettings.is_locked) return 'Not Locked'
    if (isModelAvailable(modelKey)) return 'Available'
    return 'Not Available'
  }

  const generateContent = async (type: string, prompt: string) => {
    if (!prompt.trim() || !aiSettings) {
      toast({
        title: "Error",
        description: "Please enter a prompt and ensure AI settings are configured",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      let response
      let apiKey = ''
      
      if (selectedModel === 'openai') {
        apiKey = userApiKeys.openai_api_key || ''
      } else if (selectedModel === 'anthropic') {
        apiKey = userApiKeys.anthropic_api_key || ''
      } else if (selectedModel === 'openart') {
        apiKey = userApiKeys.openart_api_key || ''
      }

      if (!apiKey) {
        toast({
          title: "API Key Missing",
          description: `Please add your ${models[selectedModel as keyof typeof models]} API key in Settings → Profile`,
          variant: "destructive"
        })
        return
      }

      if (selectedModel === 'openai') {
        const stylePrefix = selectedStyle !== 'none' ? `${styles[selectedStyle as keyof typeof styles]} style: ` : ''
        response = await OpenAIService.generateImage({
          prompt: `${stylePrefix}${prompt}`,
          style: selectedStyle !== 'none' ? styles[selectedStyle as keyof typeof styles] : '',
          model: 'dall-e-3',
          apiKey
        })
      } else if (selectedModel === 'anthropic') {
        response = await AnthropicService.generateScript({
          prompt: `Generate detailed visual development content for: ${prompt}`,
          template: `You are a professional visual development artist. Create detailed descriptions for ${type} including visual style, mood, and technical specifications.`,
          model: 'claude-3-sonnet-20240229',
          apiKey
        })
      } else if (selectedModel === 'openart') {
        const stylePrefix = selectedStyle !== 'none' ? `${styles[selectedStyle as keyof typeof styles]} style: ` : ''
        response = await OpenArtService.generateImage({
          prompt: `${stylePrefix}${prompt}`,
          style: selectedStyle !== 'none' ? styles[selectedStyle as keyof typeof styles] : '',
          model: 'sdxl',
          apiKey
        })
      }

      if (response?.success) {
        let imageUrl = response.data?.data?.[0]?.url
        
        // If we have an image URL and a project is selected, save it to the bucket
        if (imageUrl && selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
          try {
            const fileName = `${Date.now()}-${type}-${prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.png`
            const bucketUrl = await saveImageToBucket(imageUrl, fileName)
            imageUrl = bucketUrl // Use the bucket URL instead of DALL-E URL
            console.log('✅ Image saved to bucket:', bucketUrl)
          } catch (error) {
            console.error('❌ Failed to save image to bucket:', error)
            // Continue with DALL-E URL if bucket save fails
          }
        }

        const newItem: VisualDevelopmentItem = {
          id: Date.now().toString(),
          type: type as any,
          title: prompt.substring(0, 50) + '...',
          description: prompt,
          prompt,
          generatedContent: response.data?.content || response.data?.choices?.[0]?.message?.content,
          generatedImage: imageUrl,
          tags: selectedStyle !== 'none' ? [type, selectedStyle] : [type],
          projectId: selectedProject === 'all' ? null : selectedProject,
          sceneId: selectedScene === 'movie' ? null : selectedScene || null,
          createdAt: new Date().toISOString()
        }

        saveItems([...items, newItem])
        
        // Save the successful prompt
        const newSavedPrompt: SavedPrompt = {
          id: Date.now().toString() + '-prompt',
          type: type as any,
          title: promptTitle || `Prompt: ${prompt.substring(0, 50)}...`,
          prompt,
          style: selectedStyle,
          model: selectedModel,
          tags: selectedStyle !== 'none' ? [type, selectedStyle, selectedModel] : [type, selectedModel],
          projectId: selectedProject === 'all' ? null : selectedProject,
          sceneId: selectedScene === 'movie' ? null : selectedScene || null,
          createdAt: new Date().toISOString(),
          useCount: 1
        }
        savePrompt(newSavedPrompt)
        
        toast({
          title: "Success",
          description: `${type} generated successfully!${imageUrl !== response.data?.data?.[0]?.url ? ' (Saved to bucket)' : ''}`,
        })
      } else {
        throw new Error(response?.error || 'Generation failed')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to generate ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const saveCurrentPrompt = async (type: string) => {
    if (!prompt.trim() || !user) return

    try {
      const newSavedPrompt: SavedPrompt = {
        id: Date.now().toString() + '-manual',
        type: type as any,
        title: promptTitle || `Prompt: ${prompt.substring(0, 30)}...`,
        prompt,
        style: selectedStyle,
        model: selectedModel,
        tags: [type, selectedStyle, selectedModel],
        projectId: selectedProject === 'all' ? null : selectedProject,
        sceneId: selectedScene === 'movie' ? null : selectedScene || null,
        createdAt: new Date().toISOString(),
        useCount: 0
      }
      savePrompt(newSavedPrompt)
      toast({
        title: "Prompt Saved",
        description: "Prompt saved successfully!",
      })
      clearPromptForm() // Clear form after saving
    } catch (error) {
      console.error('Error saving prompt:', error)
      toast({
        title: "Save Prompt Failed",
        description: "Failed to save prompt. Check console for details.",
        variant: "destructive"
      })
    }
  }

  const clearPromptForm = () => {
    setPrompt('')
    setPromptTitle('')
  }

  const getTabContent = (type: string) => {
    const typeItems = items.filter(item => item.type === type)
    .filter(item => selectedProject === 'all' || 
      (selectedProject === 'free' && !item.projectId) || 
      (selectedProject === item.projectId))
    
    return (
      <div className="space-y-8">
        <div className="max-w-5xl mx-auto">
          {/* AI Model Status Indicator */}
          {!aiSettings?.is_locked ? (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2">
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Setup Required:</strong> Lock an AI model in Settings → AI Settings to enable generation.
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-sm text-green-600 flex items-center gap-2">
                <span className="text-green-500">●</span>
                AI Online
              </p>
            </div>
          )}
          
          <div className="bg-card border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4 text-center sm:text-left">Generate New {type.charAt(0).toUpperCase() + type.slice(1)}</h3>
            
            {/* Use Saved Prompt Dropdown */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Use Saved Prompt (Optional)</label>
              <div className="flex gap-2">
                <Select 
                  value={selectedPromptId} 
                  onValueChange={(promptId) => {
                    setSelectedPromptId(promptId)
                    if (promptId && promptId !== 'none') {
                      const selectedPrompt = savedPrompts.find(p => p.id === promptId)
                      if (selectedPrompt) {
                        setPrompt(selectedPrompt.prompt)
                        setSelectedStyle(selectedPrompt.style)
                        setSelectedModel(selectedPrompt.model)
                        setPromptTitle(selectedPrompt.title)
                        // Update use count
                        updatePromptUseCount(promptId)
                        toast({
                          title: "Prompt Loaded",
                          description: `Loaded: ${selectedPrompt.title}`,
                        })
                      }
                    } else {
                      // Clear form when "No saved prompt" is selected
                      clearPromptForm()
                    }
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a saved prompt to use..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No saved prompt</SelectItem>
                    {savedPrompts
                      .filter(p => p.type === type || p.type === 'prompt')
                      .sort((a, b) => b.useCount - a.useCount)
                      .map((savedPrompt) => (
                        <SelectItem key={savedPrompt.id} value={savedPrompt.id}>
                          <div className="flex flex-col w-full">
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="font-medium truncate">{savedPrompt.title}</span>
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {savedPrompt.useCount} uses
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {hidePromptText ? null : savedPrompt.prompt}
                            </div>
                            {savedPrompt.type === 'prompt' && (
                              <div className="text-xs text-blue-500 mt-1">
                                Universal prompt
                              </div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedPromptId && selectedPromptId !== 'none' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const selectedPrompt = savedPrompts.find(p => p.id === selectedPromptId)
                      if (selectedPrompt) {
                        setPromptTitle(`${selectedPrompt.title} (Modified)`)
                        toast({
                          title: "Ready to Modify",
                          description: "You can now modify the loaded prompt before generating",
                        })
                      }
                    }}
                    className="px-3"
                    title="Modify loaded prompt"
                  >
                    ✏️ Modify
                  </Button>
                )}
              </div>
              
              {/* Show loaded prompt details */}
              {selectedPromptId && selectedPromptId !== 'none' && (
                <div className="mt-3 p-3 bg-muted/20 rounded-lg border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Loaded from: {savedPrompts.find(p => p.id === selectedPromptId)?.title}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const selectedPrompt = savedPrompts.find(p => p.id === selectedPromptId)
                        if (selectedPrompt) {
                          const newPrompt: SavedPrompt = {
                            ...selectedPrompt,
                            id: Date.now().toString() + '-modified',
                            title: `${selectedPrompt.title} (Modified)`,
                            prompt: prompt, // Use current modified prompt
                            style: selectedStyle,
                            model: selectedModel,
                            createdAt: new Date().toISOString(),
                            useCount: 0
                          }
                          savePrompt(newPrompt)
                          toast({
                            title: "Modified Prompt Saved",
                            description: "Your modified version has been saved as a new prompt",
                          })
                        }
                      }}
                      className="text-xs h-6 px-2"
                    >
                      Save as New
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hidePromptText ? null : `Original: ${savedPrompts.find(p => p.id === selectedPromptId)?.prompt}`}
                  </p>
                </div>
              )}
            </div>
            
            {/* Prompt Title Input */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Prompt Title (Optional, for saving)</label>
              <Input
                placeholder="Enter a title for this prompt..."
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Main Prompt</label>
              <div className="flex gap-2">
                <Input
                  placeholder={`Describe your ${type}...`}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="flex-1 min-w-0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText()
                      setPrompt(text)
                      toast({
                        title: "Prompt Pasted",
                        description: "Prompt pasted from clipboard successfully!",
                      })
                    } catch (error) {
                      toast({
                        title: "Paste Failed",
                        description: "Failed to paste from clipboard. Please paste manually.",
                        variant: "destructive"
                      })
                    }
                  }}
                  className="px-3"
                  title="Paste from clipboard"
                >
                  📋
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Style</label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific style (Default)</SelectItem>
                    {Object.entries(allStyles).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center justify-between w-full">
                          <span>{key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ')}</span>
                          {customStyles[key] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteCustomStyle(key)
                              }}
                              className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="add-custom" onSelect={() => setShowCustomStyleInput(true)}>
                      + Add Custom Style
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Only show model selection when NOT locked */}
              {!aiSettings?.is_locked ? (
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">AI Model</label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(models).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                /* Show AI Online status when locked */
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">AI Status</label>
                  <div className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-md flex items-center justify-center">
                    <span className="text-sm text-green-600 font-medium">
                      AI Online
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => saveCurrentPrompt(type)}
                disabled={!prompt.trim()}
                className="px-4"
              >
                Save Prompt
              </Button>
              <Button 
                variant="outline"
                onClick={clearPromptForm}
                disabled={!prompt.trim() && !promptTitle.trim()}
                className="px-4"
              >
                Clear
              </Button>
              <Button 
                onClick={() => generateContent(type, prompt)}
                disabled={isGenerating || !prompt.trim() || !aiSettings?.is_locked}
                className="px-8"
              >
                {isGenerating ? 'Generating...' : 
                 !aiSettings?.is_locked ? 'Lock AI Model First' : 'Generate'}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Content Filter */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-center sm:justify-start">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="free">Free Play Only</SelectItem>
                {movies.map((movie) => (
                  <SelectItem key={movie.id} value={movie.id}>
                    {movie.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Save All Button and Status */}
          {selectedProject && selectedProject !== 'all' && selectedProject !== 'free' && (
            <div className="mb-4 flex flex-col sm:flex-row gap-4 justify-center sm:justify-start items-center">
              {/* Status Info */}
              <div className="text-sm text-muted-foreground">
                {typeItems.filter(item => item.databaseId).length} of {typeItems.length} items saved to database
              </div>
              
              {/* Save All Button */}
              {typeItems.some(item => !item.databaseId) && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const unsavedItems = typeItems.filter(item => !item.databaseId)
                    for (const item of unsavedItems) {
                      await saveToDatabase(item)
                    }
                  }}
                  className="px-6"
                >
                  💾 Save All to Database
                </Button>
              )}
            </div>
          )}
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {typeItems.map((item) => (
              <Card key={item.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {item.generatedImage && (
                  <div className="aspect-square overflow-hidden">
                    <img 
                      src={item.generatedImage} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {item.projectId ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        {movies.find(m => m.id.toString() === item.projectId)?.name || 'Project'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                        Free Play
                      </Badge>
                    )}
                    {item.sceneId && (
                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                        Scene {scenes.find(s => s.id === item.sceneId)?.metadata?.sceneNumber || 'N/A'}: {scenes.find(s => s.id === item.sceneId)?.name}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                {item.generatedContent && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {item.generatedContent}
                    </p>
                  </CardContent>
                )}
                
                {/* Action Buttons */}
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-2">
                    {/* Save to Database Button */}
                    {selectedProject && selectedProject !== 'all' && selectedProject !== 'free' && !item.databaseId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveToDatabase(item)}
                        className="text-xs"
                      >
                        💾 Save
                      </Button>
                    )}
                    
                    {/* Already Saved Indicator */}
                    {item.databaseId && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="text-xs bg-green-50 text-green-700 border-green-200"
                      >
                        ✅ Saved
                      </Button>
                    )}
                    
                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editItem(item)}
                      className="text-xs"
                    >
                      ✏️ Edit
                    </Button>
                    
                    {/* Delete Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteItem(item.id)}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      🗑️ Del
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {typeItems.length === 0 && (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="bg-muted/50 rounded-lg p-8 border-2 border-dashed border-muted-foreground/20">
              <p className="text-lg text-muted-foreground mb-2">No {type} created yet</p>
              <p className="text-sm text-muted-foreground/70">Start by describing what you want to generate above!</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Visual Development</h1>
          <p className="text-muted-foreground">Please log in to access visual development tools.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-center sm:text-left">Visual Development</h1>
          <p className="text-xl text-muted-foreground text-center sm:text-left max-w-3xl mx-auto sm:mx-0 mb-6">
            Create and manage visual elements for your project with AI assistance
          </p>
          
          {/* Project Selection and Import */}
          <div className="max-w-md mx-auto sm:mx-0">
            <label className="text-sm font-medium mb-2 block">Link to Movie Project (Optional)</label>
            <ProjectSelector
              selectedProject={selectedProject}
              onProjectChange={setSelectedProject}
              placeholder="Free Play - No Project Linked"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {selectedProject === 'all' ? (
                <span className="text-blue-600">
                  🎨 Free Play Mode - Content saved locally for experimentation
                </span>
              ) : selectedProject === 'free' ? (
                <span className="text-blue-600">
                  🎨 Free Play Mode - Content saved locally for experimentation
                </span>
              ) : (
                <span className="text-green-600">
                  ✅ Will save to: <strong>{movies.find((m) => m.id.toString() === selectedProject)?.name}</strong>
                </span>
              )}
            </p>
            
            {/* Import Button */}
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(true)}
                className="w-full"
              >
                📁 Import Image
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Upload existing images, concept art, or reference materials
              </p>
            </div>
          </div>

          {/* Scene Selection - Only show when a movie is selected */}
          {selectedProject && selectedProject !== 'all' && selectedProject !== 'free' && scenes.length > 0 && (
            <div className="max-w-md mx-auto sm:mx-0 mt-4">
              <label className="text-sm font-medium mb-2 block">Link to Specific Scene (Optional)</label>
              <Select value={selectedScene} onValueChange={setSelectedScene}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a scene (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">No Scene - Movie Level</SelectItem>
                  {scenes.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      <span className="text-sm font-medium">
                        Scene {scene.metadata?.sceneNumber || 'N/A'}: {scene.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                              {selectedScene && selectedScene !== 'movie' ? (
                <span className="text-green-600">
                  🎬 Linked to: <strong>Scene {scenes.find(s => s.id === selectedScene)?.metadata?.sceneNumber || 'N/A'}: {scenes.find(s => s.id === selectedScene)?.name}</strong>
                </span>
              ) : (
                <span className="text-blue-600">
                  🎬 Movie Level - Content linked to entire project
                </span>
              )}
              </p>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 max-w-6xl mx-auto">
            <TabsTrigger value="characters">Characters</TabsTrigger>
            <TabsTrigger value="environments">Environments</TabsTrigger>
            <TabsTrigger value="props">Props</TabsTrigger>
            <TabsTrigger value="colors">Color Scripts</TabsTrigger>
            <TabsTrigger value="lighting">Lighting</TabsTrigger>
            <TabsTrigger value="style">Style Guides</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
          </TabsList>

          <TabsContent value="characters" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Character Development</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Design how characters look, dress, move, and express emotions. Generate character concepts, 
                expressions, poses, and costume variations.
              </p>
            </div>
            {getTabContent('character')}
          </TabsContent>

          <TabsContent value="environments" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Environment & Location Design</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Create the style, scale, and mood of your world. From forests to futuristic cities, 
                design the spaces where your story unfolds.
              </p>
            </div>
            {getTabContent('environment')}
          </TabsContent>

          <TabsContent value="props" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Props & Objects</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Design objects, vehicles, weapons, furniture, and interactive elements. 
                Create props that enhance storytelling and character development.
              </p>
            </div>
            {getTabContent('prop')}
          </TabsContent>

          <TabsContent value="colors" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Color Scripts</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Plan how color shifts across your film/animation to guide mood and storytelling. 
                Create color palettes for different scenes and emotional beats.
              </p>
            </div>
            {getTabContent('color')}
          </TabsContent>

          <TabsContent value="lighting" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Lighting & Atmosphere</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Design how scenes feel through lighting - warm, cold, scary, magical, etc. 
                Create atmospheric lighting that enhances the emotional impact of your story.
              </p>
            </div>
            {getTabContent('lighting')}
          </TabsContent>

          <TabsContent value="style" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Style Guides & Bibles</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Create rulebooks for your project's visual identity. Ensure all artists stay consistent 
                with design principles, color schemes, and visual language.
              </p>
            </div>
            {getTabContent('style')}
          </TabsContent>

          <TabsContent value="prompts" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Saved Prompts</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Manage and reuse your successful prompts. Organize prompts by type, style, and model for quick access.
              </p>
            </div>
            
            <div className="max-w-4xl mx-auto mb-8 p-6 border rounded-lg bg-card shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Save Current Prompt</h3>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {savedPrompts.filter(p => p.user_id).length} in database • {savedPrompts.filter(p => !p.user_id).length} in localStorage
                  </div>
                  <Button
                    variant="outline"
                    onClick={migratePromptsToDatabase}
                    className="text-sm"
                    disabled={savedPrompts.filter(p => !p.user_id).length === 0}
                  >
                    🚀 Migrate localStorage → Database
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {/* Prompt Input with Paste Functionality */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Prompt</label>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Paste or type your prompt here..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="flex-1 min-h-[80px]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setPrompt(text)
                          toast({
                            title: "Prompt Pasted",
                            description: "Prompt pasted from clipboard successfully!",
                          })
                        } catch (error) {
                          toast({
                            title: "Paste Failed",
                            description: "Failed to paste from clipboard. Please paste manually.",
                            variant: "destructive"
                          })
                        }
                      }}
                      className="px-3 h-10"
                      title="Paste from clipboard"
                    >
                      📋
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Prompt Title</label>
                    <Input
                      placeholder="Enter a title for this prompt..."
                      value={promptTitle}
                      onChange={(e) => setPromptTitle(e.target.value)}
                    />
                  </div>
                  <div className="w-40">
                    <label className="text-sm font-medium mb-2 block">Type</label>
                    <Select value={activeTab.replace('s', '')} onValueChange={(value) => setActiveTab(value + 's')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="character">Character</SelectItem>
                        <SelectItem value="environment">Environment</SelectItem>
                        <SelectItem value="prop">Prop</SelectItem>
                        <SelectItem value="color">Color</SelectItem>
                        <SelectItem value="lighting">Lighting</SelectItem>
                        <SelectItem value="style">Style</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={clearPromptForm}
                      disabled={!prompt.trim() && !promptTitle.trim()}
                      className="px-4"
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={() => saveCurrentPrompt(activeTab.replace('s', ''))}
                      disabled={!prompt.trim()}
                      className="px-6"
                    >
                      Save Prompt
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              {savedPrompts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No saved prompts yet. Generate some content to see your prompts here!</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Select value={promptFilter} onValueChange={setPromptFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="character">Characters</SelectItem>
                        <SelectItem value="environment">Environments</SelectItem>
                        <SelectItem value="prop">Props</SelectItem>
                        <SelectItem value="color">Colors</SelectItem>
                        <SelectItem value="lighting">Lighting</SelectItem>
                        <SelectItem value="style">Style</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={promptProjectFilter} onValueChange={setPromptProjectFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        <SelectItem value="free">Free Play</SelectItem>
                        {movies.map((movie) => (
                          <SelectItem key={movie.id} value={movie.id}>
                            {movie.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {promptProjectFilter && promptProjectFilter !== 'all' && promptProjectFilter !== 'free' && scenes.length > 0 && (
                      <Select value={promptSceneFilter} onValueChange={setPromptSceneFilter}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filter by scene" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Scenes</SelectItem>
                          <SelectItem value="movie">Movie Level</SelectItem>
                          {scenes.map((scene) => (
                            <SelectItem key={scene.id} value={scene.id}>
                              Scene {scene.metadata?.sceneNumber || 'N/A'}: {scene.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder="Search prompts..."
                      value={promptSearch}
                      onChange={(e) => setPromptSearch(e.target.value)}
                      className="flex-1 max-w-md"
                    />
                  </div>
                  
                  <div className="max-w-6xl mx-auto">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {savedPrompts
                        .filter(p => promptFilter === 'all' || p.type === promptFilter)
                        .filter(p => promptProjectFilter === 'all' || 
                          (promptProjectFilter === 'free' && !p.projectId) || 
                          (promptProjectFilter === p.projectId))
                        .filter(p => promptSceneFilter === 'all' || 
                          (promptSceneFilter === 'movie' && !p.sceneId) || 
                          (promptSceneFilter === p.sceneId))
                        .filter(p => !promptSearch || p.prompt.toLowerCase().includes(promptSearch.toLowerCase()) || p.title.toLowerCase().includes(promptSearch.toLowerCase()))
                        .map((savedPrompt) => (
                          <Card key={savedPrompt.id} className="relative">
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-lg">{savedPrompt.title}</CardTitle>
                                  <CardDescription className="mt-2">
                                    {hidePromptText ? null : savedPrompt.prompt}
                                  </CardDescription>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deletePrompt(savedPrompt.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  ×
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-3">
                                <Badge variant="outline" className="text-xs">
                                  {savedPrompt.type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {savedPrompt.style}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {savedPrompt.model}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  Used {savedPrompt.useCount} times
                                </Badge>
                                {savedPrompt.projectId ? (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                    {movies.find(m => m.id.toString() === savedPrompt.projectId)?.name || 'Project'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                    Free Play
                                  </Badge>
                                )}
                                {savedPrompt.sceneId && (
                                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                                    Scene {scenes.find(s => s.id === savedPrompt.sceneId)?.metadata?.sceneNumber || 'N/A'}: {scenes.find(s => s.id === savedPrompt.sceneId)?.name}
                                  </Badge>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPrompt(savedPrompt.prompt)
                                    setSelectedStyle(savedPrompt.style)
                                    setSelectedModel(savedPrompt.model)
                                    setActiveTab(savedPrompt.type + 's')
                                  }}
                                  className="flex-1 min-w-[100px]"
                                >
                                  Use Prompt
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPrompt(savedPrompt.prompt)
                                    setSelectedStyle(savedPrompt.style)
                                    setSelectedModel(savedPrompt.model)
                                    setActiveTab(savedPrompt.type + 's')
                                    generateContent(savedPrompt.type, savedPrompt.prompt)
                                    updatePromptUseCount(savedPrompt.id)
                                  }}
                                  className="min-w-[100px]"
                                >
                                  Regenerate
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => editPrompt(savedPrompt)}
                                  className="min-w-[80px]"
                                >
                                  <Edit3 className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                {!savedPrompt.user_id && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => savePromptToDatabase(savedPrompt)}
                                    className="min-w-[80px] bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {(!aiSettings || Object.keys(userApiKeys).length === 0) && (
          <div className="max-w-4xl mx-auto mt-12">
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader className="text-center">
                <CardTitle className="text-yellow-800">Setup Required</CardTitle>
                <CardDescription className="text-yellow-700">
                  Please configure your AI settings in Settings → AI and add your API keys in Settings → Profile to use the visual development tools.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}
      </div>

      {/* Import Image Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Import Image</h3>
            
            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="text-sm font-medium mb-2 block">Select Image Files</label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragActive 
                      ? 'border-primary bg-primary/10' 
                      : 'border-muted-foreground/25'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {importFiles.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-green-600">
                        ✅ {importFiles.length} file{importFiles.length === 1 ? '' : 's'} selected
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importFiles.map((file, index) => (
                          <div key={index} className="text-xs text-muted-foreground flex items-center justify-between bg-muted/50 p-2 rounded">
                            <span className="truncate">{file.name}</span>
                            <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportFiles([])}
                      >
                        Clear All
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl">📁</div>
                      <div className="text-sm font-medium">Click to select or drag & drop</div>
                      <div className="text-xs text-muted-foreground">
                        Supports: JPG, PNG, GIF, WebP (Max 10MB each)
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = 'image/*'
                          input.multiple = true
                          input.onchange = (e) => {
                            const files = (e.target as HTMLInputElement).files
                            if (files) {
                              const validFiles = Array.from(files).filter(file => 
                                file.size <= 10 * 1024 * 1024
                              )
                              if (validFiles.length > 0) {
                                handleFileSelect(validFiles)
                              } else {
                                toast({
                                  title: "No Valid Files",
                                  description: "Please select files smaller than 10MB each.",
                                  variant: "destructive"
                                })
                              }
                            }
                          }
                          input.click()
                        }}
                      >
                        Choose Files
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Image Type */}
              <div>
                <label className="text-sm font-medium mb-2 block">Image Type</label>
                <Select 
                  value={importData.type}
                  onValueChange={(value) => setImportData(prev => ({ ...prev, type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="character">Character</SelectItem>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="prop">Prop</SelectItem>
                    <SelectItem value="color">Color</SelectItem>
                    <SelectItem value="lighting">Lighting</SelectItem>
                    <SelectItem value="style">Style</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Style */}
              <div>
                <label className="text-sm font-medium mb-2 block">Visual Style</label>
                <Select 
                  value={importData.style}
                  onValueChange={(value) => setImportData(prev => ({ ...prev, style: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(allStyles).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Title */}
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  placeholder="Enter a title for this image..."
                  value={importData.title}
                  onChange={(e) => setImportData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  placeholder="Describe what this image represents..."
                  value={importData.description}
                  onChange={(e) => setImportData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              
              {/* Prompt */}
              <div>
                <label className="text-sm font-medium mb-2 block">Prompt/Notes</label>
                <Textarea
                  placeholder="Add any notes, inspiration, or description..."
                  value={importData.prompt}
                  onChange={(e) => setImportData(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                onClick={importImages}
                disabled={!importFiles.length || isImporting}
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing {importFiles.length} Image{importFiles.length === 1 ? '' : 's'}...
                  </>
                ) : (
                  `Import ${importFiles.length} Image${importFiles.length === 1 ? '' : 's'}`
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false)
                  setImportFiles([])
                  setImportData({
                    title: '',
                    description: '',
                    prompt: '',
                    type: 'character',
                    style: 'cinematic'
                  })
                }}
                disabled={isImporting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Dialog */}
      {showEditDialog && editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Edit {editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)}</h3>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  placeholder="Enter title..."
                  value={editingItem.title}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, title: e.target.value } : null)}
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  placeholder="Enter description..."
                  value={editingItem.description}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>
              
              {/* Prompt */}
              <div>
                <label className="text-sm font-medium mb-2 block">Prompt</label>
                <Textarea
                  placeholder="Enter prompt..."
                  value={editingItem.title}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, prompt: e.target.value } : null)}
                  rows={2}
                />
              </div>
              
              {/* Style */}
              <div>
                <label className="text-sm font-medium mb-2 block">Style</label>
                <Select 
                  value={editingItem.tags.find(tag => Object.values(allStyles).includes(tag)) || 'cinematic'}
                  onValueChange={(value) => {
                    setEditingItem(prev => {
                      if (!prev) return null
                      const newTags = prev.tags.filter(tag => !Object.values(allStyles).includes(tag))
                      return { ...prev, tags: [...newTags, value] }
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(allStyles).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Generated Image Preview */}
              {editingItem.generatedImage && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Generated Image</label>
                  <div className="aspect-square overflow-hidden rounded-lg border max-w-xs">
                    <img 
                      src={editingItem.generatedImage} 
                      alt={editingItem.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              
              {/* Generated Content */}
              {editingItem.generatedContent && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Generated Content</label>
                  <Textarea
                    value={editingItem.generatedContent}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, generatedContent: e.target.value } : null)}
                    rows={4}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => editingItem && saveEditedItem(editingItem)}
                className="flex-1"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false)
                  setEditingItem(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Style Input Modal */}
      {showCustomStyleInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Add Custom Style</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Style Name</label>
                <Input
                  placeholder="e.g., Cyberpunk, Fantasy, Noir"
                  value={newCustomStyle.name}
                  onChange={(e) => setNewCustomStyle(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Style Description</label>
                <Textarea
                  placeholder="Describe the visual style, lighting, mood, etc."
                  value={newCustomStyle.description}
                  onChange={(e) => setNewCustomStyle(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={addCustomStyle}
                  disabled={!newCustomStyle.name || !newCustomStyle.description}
                  className="flex-1"
                >
                  Add Style
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCustomStyleInput(false)
                    setNewCustomStyle({ name: '', description: '' })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Prompt Dialog */}
      {showEditPromptDialog && editingPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Edit Prompt</h3>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  placeholder="Enter prompt title..."
                  value={editPromptForm.title}
                  onChange={(e) => setEditPromptForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              {/* Prompt */}
              <div>
                <label className="text-sm font-medium mb-2 block">Prompt</label>
                <Textarea
                  placeholder="Enter your prompt..."
                  value={editPromptForm.prompt}
                  onChange={(e) => setEditPromptForm(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={4}
                />
              </div>
              
              {/* Type */}
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select 
                  value={editPromptForm.type}
                  onValueChange={(value) => setEditPromptForm(prev => ({ ...prev, type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="character">Character</SelectItem>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="prop">Prop</SelectItem>
                    <SelectItem value="color">Color</SelectItem>
                    <SelectItem value="lighting">Lighting</SelectItem>
                    <SelectItem value="style">Style</SelectItem>
                    <SelectItem value="prompt">Prompt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Style */}
              <div>
                <label className="text-sm font-medium mb-2 block">Style</label>
                <Select 
                  value={editPromptForm.style}
                  onValueChange={(value) => setEditPromptForm(prev => ({ ...prev, style: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Style</SelectItem>
                    {Object.entries(allStyles).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Model */}
              <div>
                <label className="text-sm font-medium mb-2 block">Model</label>
                <Select 
                  value={editPromptForm.model}
                  onValueChange={(value) => setEditPromptForm(prev => ({ ...prev, model: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI DALL-E 3</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    <SelectItem value="openart">OpenArt SDXL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                onClick={saveEditedPrompt}
                className="flex-1"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditPromptDialog(false)
                  setEditingPrompt(null)
                  setEditPromptForm({
                    title: '',
                    prompt: '',
                    style: 'none',
                    model: 'openai',
                    type: 'character'
                  })
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
