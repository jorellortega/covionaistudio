"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuthReady } from "@/components/auth-hooks"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Filter, Image as ImageIcon, FileText, Sparkles, Edit, Trash2, Eye, Download, CheckCircle, ArrowLeft, Film, Clock, RefreshCw, Loader2, Play, Edit3, MessageSquare, Copy, Calendar, User, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StoryboardsService, Storyboard, CreateStoryboardData } from "@/lib/storyboards-service"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { SavedPromptsService } from "@/lib/saved-prompts-service"
import { PreferencesService } from "@/lib/preferences-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"
import { ShotListComponent } from "@/components/shot-list"

// Extended scene type with additional properties we need
type SceneInfo = SceneWithMetadata & {
  project_name?: string
  timeline_name?: string
  project_id?: string
  scene_number?: number
  start_time_seconds?: number
  duration_seconds?: number
}

// AI Models configuration (matching AI Studio)
const aiModels = {
  image: ["OpenArt", "DALL-E 3", "Runway ML", "Midjourney", "Stable Diffusion", "Custom"],
}

export default function SceneStoryboardsPage() {
  
  const params = useParams()
  const router = useRouter()
  const sceneId = params.sceneId as string
  
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()

  // Function to get status badge styling
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'draft':
        return "bg-gray-500/20 text-gray-500 border-gray-500/30"
      case 'in-progress':
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
      case 'review':
        return "bg-orange-500/20 text-orange-500 border-orange-500/30"
      case 'approved':
        return "bg-green-500/20 text-green-500 border-green-500/30"
      case 'rejected':
        return "bg-red-500/20 text-red-500 border-red-500/30"
      case 'completed':
        return "bg-blue-500/20 text-blue-500 border-blue-500/30"
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/30"
    }
  }

  // Function to get status display text
  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'draft':
        return "Draft"
      case 'in-progress':
        return "In Progress"
      case 'review':
        return "Review"
      case 'approved':
        return "Approved"
      case 'rejected':
        return "Rejected"
      case 'completed':
        return "Completed"
      default:
        return "Draft"
    }
  }

  // Function to handle status updates
  const handleStatusUpdate = async (storyboardId: string, newStatus: string) => {
    try {
      // Optimistically update the UI
      setStoryboards(prev => prev.map(sb => 
        sb.id === storyboardId ? { ...sb, status: newStatus as any } : sb
      ))
      
      const updatedStoryboard = await StoryboardsService.updateStoryboard(storyboardId, { status: newStatus as any })
      setStoryboards(prev => prev.map(sb => sb.id === storyboardId ? updatedStoryboard : sb))
      
      toast({
        title: "Status Updated",
        description: `Shot status changed to ${getStatusDisplayText(newStatus)}`
      })
    } catch (error) {
      console.error("Error updating status:", error)
      // Revert the optimistic update on error
      setStoryboards(prev => prev.map(sb => 
        sb.id === storyboardId ? { ...sb, status: storyboards.find(s => s.id === storyboardId)?.status || 'draft' } : sb
      ))
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive"
      })
    }
  }

  // Function to fetch user API keys
  const fetchUserApiKeys = async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserApiKeys(data || {})
    } catch (error) {
      console.error('Error fetching API keys:', error)
    }
  }

  // Function to check model availability
  const checkModelAvailability = (model: string) => {
    if (!ready) return { isReady: false, statusText: "Not logged in" }
    
    if (model === "DALL-E 3") {
      const hasKey = !!userApiKeys.openai_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "OpenAI API Key Required" 
      }
    } else if (model === "OpenArt") {
      const hasKey = !!userApiKeys.openart_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "OpenArt API Key Required" 
      }
    } else if (model === "Runway ML") {
      const hasKey = !!userApiKeys.runway_api_key
      return { 
        isReady: hasKey, 
        statusText: hasKey ? "Ready" : "Runway ML API Key Required" 
      }
    } else if (model === "Midjourney" || model === "Stable Diffusion" || model === "Custom") {
      return { isReady: false, statusText: "Coming Soon" }
    }
    
    return { isReady: true, statusText: "Ready" }
  }

  // Function to map model names to service identifiers
  const mapModelToService = (model: string) => {
    switch (model) {
      case "DALL-E 3": return "dalle"
      case "GPT Image": return "dalle" // GPT Image uses the dalle service but different endpoint
      case "OpenArt": return "openart"
      case "Runway ML": return "runway"
      case "Leonardo AI": return "leonardo"
      default: return "dalle"
    }
  }

  // Helper function to normalize model name from display name to API model identifier
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
  // State variables
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [sceneScript, setSceneScript] = useState<string>("")
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null)
  const [allScenes, setAllScenes] = useState<SceneWithMetadata[]>([])
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(-1)
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [shots, setShots] = useState<any[]>([])
  const [isCreatingAllStoryboards, setIsCreatingAllStoryboards] = useState(false)
  const [formData, setFormData] = useState<CreateStoryboardData>({
    title: "",
    description: "",
    scene_number: 1,
    shot_number: 0, // Start blank for new shots
    shot_type: "wide",
    camera_angle: "eye-level",
    movement: "static",
    sequence_order: 0, // Start blank for new shots
    status: "draft",
    character_id: null
  })
  
  // Loading states
  const [isLoadingScene, setIsLoadingScene] = useState(true)
  const [isLoadingStoryboards, setIsLoadingStoryboards] = useState(true)
  
  // Edit form state
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingStoryboard, setEditingStoryboard] = useState<Storyboard | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  
  // AI generation state
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingText, setIsGeneratingText] = useState(false)
  const [selectedAIService, setSelectedAIService] = useState("dalle")
  const [aiImagePrompt, setAiImagePrompt] = useState("")
  const [aiImagePromptFull, setAiImagePromptFull] = useState("") // Store the actual full prompt text
  const [isGeneratingShotImage, setIsGeneratingShotImage] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [useExactPrompt, setUseExactPrompt] = useState(true)
  const [savedPrompts, setSavedPrompts] = useState<any[]>([])
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false)
  const [hidePromptText, setHidePromptText] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  
  // Script state
  const [isLoadingScript, setIsLoadingScript] = useState(false)
  
  // Text selection state
  const [selectedText, setSelectedText] = useState("")
  const [selectionStart, setSelectionStart] = useState(0)
  const [selectionEnd, setSelectionEnd] = useState(0)
  const [showSelectionActions, setShowSelectionActions] = useState(false)
  const [shotMode, setShotMode] = useState(false)
  const [shotDetails, setShotDetails] = useState({
    shotNumber: 1,
    shotType: "wide",
    cameraAngle: "eye-level",
    movement: "static",
    characterId: null as string | null
  })
  const [editingShotDetails, setEditingShotDetails] = useState(false)
  const [tempShotDetails, setTempShotDetails] = useState({
    shotNumber: 1,
    shotType: "wide",
    cameraAngle: "eye-level",
    movement: "static",
    characterId: null as string | null
  })
  
  // Ref to track current selection
  const currentSelectionRef = useRef<string>("")
  
  // Locked selection state - once set, cannot be cleared by browser interactions
  const [lockedSelection, setLockedSelection] = useState<string>("")
  const [isSelectionLocked, setIsSelectionLocked] = useState(false)
  
  // Store the DOM range for re-applying selection
  const selectionRangeRef = useRef<Range | null>(null)
  
  // Track which text ranges have already been used for shots
  const [usedTextRanges, setUsedTextRanges] = useState<Array<{
    start: number
    end: number
    text: string
    shotNumber: number
  }>>([])
  


  // Function to extract text from selection more reliably
  const extractTextFromSelection = (selection: Selection): string => {
    if (!selection || selection.rangeCount === 0) return ""
    
    const range = selection.getRangeAt(0)
    let text = ""
    
    try {
      // Method 1: Try to get text from the range directly
      text = range.toString().trim()
      console.log("🎬 Range toString result:", text)
      
      // Method 2: If that doesn't work well, try to extract from the common ancestor
      if (text.length === 0 || text.length < 3) {
        const commonAncestor = range.commonAncestorContainer
        if (commonAncestor.nodeType === Node.TEXT_NODE) {
          const textNode = commonAncestor as Text
          const startOffset = range.startOffset
          const endOffset = range.endOffset
          text = textNode.textContent?.substring(startOffset, endOffset).trim() || ""
          console.log("🎬 Text node extraction result:", text)
        } else {
          // Method 3: Try to get text from all text nodes in the range
          const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
              }
            }
          )
          
          let extractedText = ""
          let node
          while (node = walker.nextNode()) {
            const textNode = node as Text
            const nodeRange = document.createRange()
            nodeRange.selectNode(textNode)
            
            if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0 && 
                range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0) {
              extractedText += textNode.textContent || ""
            }
          }
          
          if (extractedText.length > text.length) {
            text = extractedText.trim()
            console.log("🎬 TreeWalker extraction result:", text)
          }
        }
      }
    } catch (error) {
      console.log("🎬 Error in text extraction:", error)
      // Fallback to basic selection
      text = selection.toString().trim()
    }
    
    return text
  }

  // Function to lock the current selection
  const lockSelection = (text: string) => {
    console.log("🎬 lockSelection called with text:", text)
    console.log("🎬 Text length:", text.length)
    
    setLockedSelection(text)
    setIsSelectionLocked(true)
    
    // Store the current DOM selection range
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      selectionRangeRef.current = selection.getRangeAt(0).cloneRange()
      console.log("🎬 Stored selection range")
    }
    
    console.log("🎬 Locked selection set to:", text)
  }
  
  // Function to unlock selection (only when creating shot)
  const unlockSelection = () => {
    setLockedSelection("")
    setIsSelectionLocked(false)
    setSelectedText("")
    setShowSelectionActions(false)
    selectionRangeRef.current = null
  }
  
  // Function to find text range in script
  const findTextRange = (text: string) => {
    if (!sceneScript) return null
    
    const scriptText = sceneScript
    const cleanText = text.trim()
    
    console.log("🎬 findTextRange called with text:", cleanText)
    console.log("🎬 Text length:", cleanText.length)
    console.log("🎬 Script length:", scriptText.length)
    console.log("🎬 Text (first 100 chars):", cleanText.substring(0, 100))
    console.log("🎬 Script (first 200 chars):", scriptText.substring(0, 200))
    
    // Try exact match first
    let startIndex = scriptText.indexOf(cleanText)
    console.log("🎬 Exact match result:", startIndex)
    
    // If exact match fails, try with normalized whitespace
    if (startIndex === -1) {
      console.log("🎬 Trying normalized whitespace match...")
      const normalizedScript = scriptText.replace(/\s+/g, ' ')
      const normalizedText = cleanText.replace(/\s+/g, ' ')
      console.log("🎬 Normalized text:", normalizedText)
      console.log("🎬 Normalized script (first 200 chars):", normalizedScript.substring(0, 200))
      
      startIndex = normalizedScript.indexOf(normalizedText)
      console.log("🎬 Normalized match result:", startIndex)
      
      if (startIndex !== -1) {
        console.log("🎬 Found normalized match, converting back to original position...")
        // Find the actual position in the original script
        let normalizedCount = 0
        for (let i = 0; i < scriptText.length; i++) {
          if (normalizedCount === startIndex) {
            startIndex = i
            break
          }
          if (scriptText[i] === ' ' || scriptText[i] === '\n' || scriptText[i] === '\t') {
            if (i === 0 || !(scriptText[i-1] === ' ' || scriptText[i-1] === '\n' || scriptText[i-1] === '\t')) {
              normalizedCount++
            }
          } else {
            normalizedCount++
          }
        }
        console.log("🎬 Converted start index:", startIndex)
      }
    }
    
    if (startIndex === -1) {
      console.warn("🎬 Could not find text in script:", cleanText)
      console.warn("🎬 Script preview:", scriptText.substring(0, 200))
      console.warn("🎬 Text preview:", cleanText.substring(0, 200))
      
      // Try to find partial matches for debugging
      const words = cleanText.split(/\s+/)
      console.warn("🎬 Trying to find individual words:")
      words.forEach((word, index) => {
        const wordIndex = scriptText.indexOf(word)
        console.warn(`🎬 Word ${index} "${word}":`, wordIndex)
      })
      
      return null
    }
    
    const result = {
      start: startIndex,
      end: startIndex + cleanText.length,
      text: cleanText
    }
    
    console.log("🎬 Found text range:", result)
    console.log("🎬 Extracted text from script:", scriptText.substring(startIndex, startIndex + cleanText.length))
    
    return result
  }
  
  // Function to add used text range
  const addUsedTextRange = (text: string, shotNumber: number) => {
    const range = findTextRange(text)
    if (range) {
      setUsedTextRanges(prev => [...prev, { ...range, shotNumber }])
      console.log("🎬 Added used text range:", { ...range, shotNumber })
    }
  }
  
  // Function to re-apply the visual text selection
  const reapplySelection = () => {
    if (selectionRangeRef.current && isSelectionLocked) {
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(selectionRangeRef.current)
        console.log("🎬 Visual selection re-applied")
      }
    }
  }

  // Load existing storyboards with text ranges for visual highlighting
  const loadStoryboardsWithTextRanges = async () => {
    if (!sceneId) return
    
    try {
      const storyboardsWithRanges = await StoryboardsService.getStoryboardsForSceneWithTextRanges(sceneId)
      console.log("🎬 Loaded storyboards with text ranges:", storyboardsWithRanges)
      
      // Convert to usedTextRanges format
      const ranges = storyboardsWithRanges.map(sb => ({
        start: sb.script_text_start!,
        end: sb.script_text_end!,
        text: sb.script_text_snippet!,
        shotNumber: sb.shot_number
      }))
      
      setUsedTextRanges(ranges)
      console.log("🎬 Set used text ranges:", ranges)
      
    } catch (error) {
      console.error("🎬 Error loading storyboards with text ranges:", error)
    }
  }



  // Load user preferences
  const loadUserPreferences = async () => {
    if (!userId) return
    
    try {
      const hidePromptTextPref = await PreferencesService.getHidePromptText()
      setHidePromptText(hidePromptTextPref)
    } catch (error) {
      console.error("Error loading user preferences:", error)
    }
  }

  // Refresh prompt display when hidePromptText preference changes
  useEffect(() => {
    if (aiImagePromptFull && savedPrompts.length > 0) {
      const matchingPrompt = savedPrompts.find(p => p.prompt === aiImagePromptFull)
      if (matchingPrompt) {
        if (hidePromptText) {
          // Show only the title when hiding text
          setAiImagePrompt(matchingPrompt.title)
        } else {
          // Show the full prompt when showing text
          setAiImagePrompt(matchingPrompt.prompt)
        }
      }
    }
  }, [hidePromptText, aiImagePromptFull, savedPrompts])

  // Load saved prompts from database for AI image generation  
  const loadSavedPrompts = async () => {
    if (!userId) return
    
    try {
      setIsLoadingPrompts(true)
      console.log("🎬 Loading saved prompts for user:", userId)
      
      // Get the current project ID from scene info - we need to wait for it
      const currentProjectId = sceneInfo?.project_id
      console.log("🎬 Current project ID:", currentProjectId)
      
      // If no project ID yet, don't load prompts
      if (!currentProjectId) {
        console.log("🎬 No project ID yet, skipping prompt load")
        setIsLoadingPrompts(false)
        return
      }
      
      // Load prompts from database with project filtering
      const dbPrompts = await SavedPromptsService.getSavedPrompts(userId, currentProjectId)
      console.log("🎬 Loaded prompts from database:", dbPrompts.length)
      console.log("🎬 All database prompts:", dbPrompts)
      
      // Filter to show only image-related prompts for this specific movie/project
      const imagePrompts = dbPrompts.filter((p: any) => {
        const isImageType = p.type === 'character' || p.type === 'environment' || p.type === 'prop' ||
                           p.type === 'color' || p.type === 'lighting' || p.type === 'style' || p.type === 'prompt'
        
        // Show prompts that are either:
        // 1. For this specific movie (project_id matches)
        // 2. Universal prompts (project_id is null - "Free Play" mode)
        const isForThisProject = p.project_id === currentProjectId || p.project_id === null
        
        console.log(`🎬 Prompt "${p.title}": type=${p.type}, project_id=${p.project_id}, isImageType=${isImageType}, isForThisProject=${isForThisProject}`)
        
        return isImageType && isForThisProject
      })
      
      console.log("🎬 Filtered image prompts for this project:", imagePrompts.length)
      console.log("🎬 Final filtered prompts:", imagePrompts)
      setSavedPrompts(imagePrompts)
      
    } catch (error) {
      console.error("🎬 Error loading saved prompts:", error)
    } finally {
      setIsLoadingPrompts(false)
    }
  }

  useEffect(() => {
    if (ready && userId && sceneId) {
      fetchStoryboards()
      fetchSceneInfo()
      loadStoryboardsWithTextRanges()
      // Note: loadSavedPrompts() will be called when sceneInfo loads with project_id
      
      // Load user preferences
      loadUserPreferences()
    }
  }, [ready, userId, sceneId])

  // Fetch script after sceneInfo is loaded (to get screenplay_content)
  useEffect(() => {
    if (sceneInfo && ready && userId) {
      fetchSceneScript()
    }
  }, [sceneInfo, ready, userId])

  // Hide selection actions when clicking outside and handle global selection changes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't hide if clicking on the selection actions themselves
      const target = event.target as Element
      if (target.closest('.selection-actions')) {
        return
      }
      
      // Don't hide if clicking on the shot mode configuration panel
      if (target.closest('.shot-mode-config')) {
        return
      }
      
      // Use functional update to avoid dependency on showSelectionActions
      setShowSelectionActions(prev => {
        if (prev) {
          setSelectedText("")
          return false
        }
        return prev
      })
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().length > 0) {
        const text = selection.toString().trim()
        if (text.length > 0) {
          setSelectedText(text)
          currentSelectionRef.current = text
          
          // Use functional update to avoid dependency on showSelectionActions
          setShowSelectionActions(prev => {
            if (!prev) {
              // LOCK THE SELECTION - this prevents it from being lost
              lockSelection(text)
              return true
            }
            return prev
          })
        }
      } else {
        // Use functional update to avoid dependency on showSelectionActions
        setShowSelectionActions(prev => {
          if (prev) {
            setSelectedText("")
            currentSelectionRef.current = ""
            return false
          }
          return prev
        })
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('selectionchange', handleSelectionChange)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, []) // Remove showSelectionActions from dependencies

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready || !userId) return
      
      try {
        // Load API keys and AI settings in parallel
        await Promise.all([
          fetchUserApiKeys(),
          AISettingsService.getSystemSettings()
        ])
        
        const settings = await AISettingsService.getSystemSettings()
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting('scripts'),
          AISettingsService.getOrCreateDefaultTabSetting('images'),
          AISettingsService.getOrCreateDefaultTabSetting('videos'),
          AISettingsService.getOrCreateDefaultTabSetting('audio')
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
          setSelectedAIService(imagesSetting.locked_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  // Reload prompts when sceneInfo changes (after project_id is available)
  useEffect(() => {
    if (sceneInfo?.project_id && userId) {
      console.log("🎬 SceneInfo loaded with project_id, reloading prompts...")
      loadSavedPrompts()
    }
  }, [sceneInfo?.project_id, userId])

  // Load characters when project_id is available
  useEffect(() => {
    const loadCharacters = async () => {
      if (!sceneInfo?.project_id || !ready || !userId) return
      
      setIsLoadingCharacters(true)
      try {
        const chars = await CharactersService.getCharacters(sceneInfo.project_id)
        setCharacters(chars)
        console.log("🎬 Loaded characters for storyboards:", chars)
      } catch (error) {
        console.error("Error loading characters:", error)
      } finally {
        setIsLoadingCharacters(false)
      }
    }
    
    loadCharacters()
  }, [sceneInfo?.project_id, ready, userId])

  // Update current scene index when sceneId or allScenes changes
  useEffect(() => {
    if (sceneId && allScenes.length > 0) {
      const index = allScenes.findIndex(s => s.id === sceneId)
      setCurrentSceneIndex(index)
    }
  }, [sceneId, allScenes])

  const fetchSceneInfo = async () => {
    try {
      console.log('🎬 fetchSceneInfo: Starting to fetch scene:', sceneId)
      console.log('🎬 fetchSceneInfo: User ID:', userId)
      console.log('🎬 fetchSceneInfo: Ready state:', ready)
      
      // Don't proceed if authentication isn't ready
      if (!ready || !userId) {
        console.log('🎬 fetchSceneInfo: Authentication not ready, skipping')
        return
      }
      
      // Fetch the actual scene data
      const scene = await TimelineService.getSceneById(sceneId)
      
      if (!scene) {
        console.error('🎬 fetchSceneInfo: Scene not found for ID:', sceneId)
        toast({
          title: "Scene Not Found",
          description: "The requested scene could not be found.",
          variant: "destructive"
        })
        router.push('/movies')
        return
      }

      console.log("🎬 Scene found:", scene)
      console.log("🎬 Scene project_id:", scene.project_id)
      console.log("🎬 Scene metadata:", scene.metadata)
      console.log("🎬 Scene order_index:", scene.order_index)

      // Get the timeline and project information
      let timelineName = "Unknown Timeline"
      let projectName = "Unknown Project"
      let projectId = ""
      
      try {
        // Check if scene has project_id or timeline_id
        const sceneProjectId = scene.project_id || (scene as any).timeline_id
        console.log("🎬 Scene project_id:", scene.project_id)
        console.log("🎬 Scene timeline_id:", (scene as any).timeline_id)
        console.log("🎬 Using sceneProjectId:", sceneProjectId)
        
        if (sceneProjectId) {
          // First try to get timeline directly by ID
          console.log("🎬 Looking for timeline with ID:", sceneProjectId)
          
          // Query the timeline directly by ID
          console.log("🎬 Querying timelines table for ID:", sceneProjectId)
          const { data: timeline, error: timelineError } = await getSupabaseClient()
            .from('timelines')
            .select('*')
            .eq('id', sceneProjectId)
            .eq('user_id', userId)
            .single()
          
          console.log("🎬 Timeline query result:", { timeline, error: timelineError })
          
          if (timelineError) {
            console.log("🎬 Timeline lookup error:", timelineError)
          } else if (timeline) {
            timelineName = timeline.name
            projectId = timeline.project_id
            console.log("🎬 Found timeline:", timelineName, "for project:", projectId)
            
            // Get project name from timeline
            const project = await TimelineService.getMovieById(timeline.project_id)
            if (project) {
              projectName = project.name
              console.log("🎬 Found project:", projectName)
            }
          } else {
            console.log("🎬 No timeline found, trying alternative approach...")
            
            // Alternative: try to get project directly from scene's project_id/timeline_id
            try {
              const directProject = await TimelineService.getMovieById(sceneProjectId)
              if (directProject) {
                projectName = directProject.name
                projectId = directProject.id
                timelineName = "Main Timeline"
                console.log("🎬 Found direct project reference:", projectName)
              }
            } catch (directError) {
              console.log("🎬 Direct project lookup also failed:", directError)
            }
          }
        } else {
          console.log("🎬 No project_id or timeline_id found in scene")
        }
      } catch (error) {
        console.warn("Could not fetch timeline/project info:", error)
      }

      setSceneInfo({
        ...scene,
        project_name: projectName,
        timeline_name: timelineName,
        project_id: projectId
      })
      
      // Fetch all scenes for navigation if we have timeline_id
      if ((scene as any).timeline_id) {
        try {
          const scenes = await TimelineService.getScenesForTimeline((scene as any).timeline_id)
          setAllScenes(scenes)
          // Find current scene index
          const index = scenes.findIndex(s => s.id === sceneId)
          setCurrentSceneIndex(index)
        } catch (scenesError) {
          console.error('Error fetching scenes for navigation:', scenesError)
        }
      }
      
      setIsLoadingScene(false)
    } catch (error) {
      console.error("🎬 Error fetching scene info:", error)
      setIsLoadingScene(false)
      toast({
        title: "Error",
        description: "Failed to fetch scene information",
        variant: "destructive"
      })
    }
  }

  const handleTextSelection = () => {
    console.log("🎬 Text selection event triggered (immediate)")
    
    // Add a small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection()
      console.log("🎬 Text selection event triggered (delayed)")
      console.log("🎬 Selection:", selection?.toString())
      console.log("🎬 Selection range count:", selection?.rangeCount)
      console.log("🎬 Current shotMode:", shotMode)
      console.log("🎬 Current showSelectionActions:", showSelectionActions)
      
      if (selection && selection.toString().length > 0) {
        // Use the improved text extraction method
        let text = extractTextFromSelection(selection)
        console.log("🎬 Selected text (extracted):", text)
        console.log("🎬 Selected text length:", text.length)
        
        // Debug: Show the selection range details
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          console.log("🎬 Selection range details:")
          console.log("🎬 - Start container:", range.startContainer)
          console.log("🎬 - Start offset:", range.startOffset)
          console.log("🎬 - End container:", range.endContainer)
          console.log("🎬 - End offset:", range.endOffset)
          console.log("🎬 - Common ancestor:", range.commonAncestorContainer)
        }
        
        console.log("🎬 Final selected text:", text)
        console.log("🎬 Final text length:", text.length)
        console.log("🎬 Selected text (first 100 chars):", text.substring(0, 100))
        console.log("🎬 Selected text (last 100 chars):", text.substring(Math.max(0, text.length - 100)))
        
        if (text.length > 0) {
          setSelectedText(text)
          currentSelectionRef.current = text
          setShowSelectionActions(true)
          
          // LOCK THE SELECTION - this prevents it from being lost
          lockSelection(text)
          
          console.log("🎬 Showing selection actions")
          console.log("🎬 New state will be:", { selectedText: text, showSelectionActions: true, shotMode })
        }
      } else {
        console.log("🎬 No text selected, hiding actions")
        setShowSelectionActions(false)
        setSelectedText("")
        currentSelectionRef.current = ""
      }
    }, 100)
  }

  const handleCreateShotFromSelection = async () => {
    console.log("🎬 handleCreateShotFromSelection called")
    
    // Use the most recent and complete selection - prioritize selectedText over lockedSelection
    const textToUse = selectedText || currentSelectionRef.current || lockedSelection
    console.log("🎬 lockedSelection:", lockedSelection)
    console.log("🎬 selectedText from state:", selectedText)
    console.log("🎬 selectedText from ref:", currentSelectionRef.current)
    console.log("🎬 Using text:", textToUse)
    console.log("🎬 Text to use length:", textToUse?.length || 0)
    console.log("🎬 Text to use (first 200 chars):", textToUse?.substring(0, 200) || "N/A")
    
    // If we're using a stale lockedSelection, update it to match the current selection
    if (textToUse && textToUse !== lockedSelection && (selectedText || currentSelectionRef.current)) {
      console.log("🎬 Updating lockedSelection to match current selection")
      setLockedSelection(textToUse)
    }
    
    console.log("🎬 shotMode:", shotMode)
    console.log("🎬 shotDetails:", shotDetails)
    console.log("🎬 current formData:", formData)
    
    if (textToUse) {
      console.log("🎬 Automatically creating storyboard with selected text")
      
      // Find the text range in the script
      let textRange = findTextRange(textToUse)
      console.log("🎬 Found text range:", textRange)
      console.log("🎬 Script length:", sceneScript?.length || 0)
      console.log("🎬 Text to use length:", textToUse.length)
      console.log("🎬 Text to use (first 100 chars):", textToUse.substring(0, 100))
      console.log("🎬 Script preview (first 200 chars):", sceneScript?.substring(0, 200))
      
      // Validate text range before creating storyboard
      if (textRange && (textRange.start < 0 || textRange.end > (sceneScript?.length || 0))) {
        console.error("🎬 Invalid text range:", textRange)
        toast({
          title: "Error",
          description: "Invalid text selection - please try selecting the text again",
          variant: "destructive"
        })
        return
      }
      
      // Check for overlapping text ranges with existing shots
      if (textRange && typeof textRange === 'object' && textRange.start !== null && textRange.end !== null) {
        const textRangeStart = textRange.start
        const textRangeEnd = textRange.end
        const hasOverlap = storyboards.some(sb => {
          const start = sb.script_text_start
          const end = sb.script_text_end
          if (start !== null && start !== undefined && end !== null && end !== undefined) {
            return (
              (start <= textRangeStart && end > textRangeStart) ||
              (start < textRangeEnd && end >= textRangeEnd) ||
              (start >= textRangeStart && end <= textRangeEnd)
            )
          }
          return false
        })
        
        if (hasOverlap) {
          console.error("🎬 Text range overlaps with existing shot:", textRange)
          toast({
            title: "Warning",
            description: "This text selection overlaps with an existing shot. Creating shot without text range data.",
            variant: "default"
          })
          // Clear text range to avoid database constraint issues
          textRange = null
        }
      }
      
      // Get the next available shot number to avoid conflicts
      const nextShotNumber = getNextShotNumber()
      console.log("🎬 Next available shot number:", nextShotNumber)
      console.log("🎬 Current storyboards in scene:", storyboards.map(sb => ({ id: sb.id, shot_number: sb.shot_number, title: sb.title })))
      
      // Prepare the storyboard data
      const storyboardData = {
        title: `Shot ${nextShotNumber}: ${textToUse.substring(0, 30)}${textToUse.length > 30 ? '...' : ''}`,
        description: textToUse,
        scene_number: 1, // Default scene number (legacy field, now using scene_id)
        shot_number: nextShotNumber,
        shot_type: shotDetails.shotType,
        camera_angle: shotDetails.cameraAngle,
        movement: shotDetails.movement,
        action: textToUse,
        visual_notes: `Shot ${nextShotNumber} - ${shotDetails.shotType} ${shotDetails.cameraAngle} ${shotDetails.movement}`,
        scene_id: sceneId,
        character_id: shotDetails.characterId || null,
        project_id: sceneInfo?.project_id || "",
        script_text_start: textRange && textRange.start !== null ? textRange.start : undefined,
        script_text_end: textRange && textRange.end !== null ? textRange.end : undefined,
        script_text_snippet: textRange ? textToUse : undefined,
        sequence_order: nextShotNumber
      }
      
      console.log("🎬 Creating storyboard with data:", storyboardData)
      
      try {
        // Create the storyboard automatically
        console.log("🎬 About to create storyboard with data:", storyboardData)
        console.log("🎬 Storyboard data keys:", Object.keys(storyboardData))
        console.log("🎬 Storyboard data values:", Object.values(storyboardData))
        const newStoryboard = await StoryboardsService.createStoryboard(storyboardData)
        console.log("🎬 Storyboard created successfully:", newStoryboard)
        
        // Add to local state - add to the end to maintain chronological order
        setStoryboards(prev => [...prev, newStoryboard])
        
        // Add to used text ranges for visual highlighting
        if (textRange) {
          addUsedTextRange(textToUse, nextShotNumber)
        }
        
        // Show success message
        toast({
          title: "Shot Created!",
          description: `Shot ${nextShotNumber} created automatically from script selection`,
        })
        
        // Clear selection and unlock
        unlockSelection()
        window.getSelection()?.removeAllRanges()
        
        // Update shot details to use the next available number
        setShotDetails(prev => ({
          ...prev,
          shotNumber: getNextShotNumber()
        }))
        
        console.log("🎬 Shot creation completed automatically")
        
      } catch (error: any) {
        console.error("🎬 Error creating storyboard:", error)
        console.error("🎬 Error details:", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        })
        console.error("🎬 Full error object:", error)
        
        // Try to extract more specific error information
        if (error?.details) {
          console.error("🎬 Error details:", error.details)
        }
        if (error?.hint) {
          console.error("🎬 Error hint:", error.hint)
        }
        
        // Provide more specific error messages
        let errorMessage = 'Unknown error'
        if (error?.message?.includes('User not authenticated')) {
          errorMessage = 'Your session has expired. Please refresh the page and try again.'
        } else if (error?.message?.includes('please refresh the page')) {
          errorMessage = 'Authentication issue. Please refresh the page and try again.'
        } else if (error?.message) {
          errorMessage = error.message
        }
        
        toast({
          title: "Error",
          description: `Failed to create storyboard: ${errorMessage}`,
          variant: "destructive"
        })
      }
    } else {
      console.log("🎬 No selected text found!")
    }
  }

  const fetchSceneScript = async () => {
    try {
      setIsLoadingScript(true)
      console.log("🎬 Fetching script for scene:", sceneId)
      
      // First, check if scene has screenplay_content
      if (sceneInfo && (sceneInfo as any).screenplay_content) {
        console.log("🎬 Found screenplay_content in scene")
        setSceneScript((sceneInfo as any).screenplay_content)
        return
      }
      
      // Look for script assets for this scene
      const { data: scriptAssets, error } = await getSupabaseClient()
        .from('assets')
        .select('*')
        .eq('scene_id', sceneId)
        .eq('content_type', 'script')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) {
        console.error("Error fetching scene script:", error)
        return
      }
      
      if (scriptAssets && scriptAssets.length > 0) {
        const latestScript = scriptAssets[0]
        console.log("🎬 Found scene script:", latestScript.title)
        setSceneScript(latestScript.content || "")
      } else {
        console.log("🎬 No script found for scene")
        setSceneScript("")
      }
    } catch (error) {
      console.error("Error fetching scene script:", error)
    } finally {
      setIsLoadingScript(false)
    }
  }

  const fetchStoryboards = async () => {
    if (!sceneId) return
    
    try {
      console.log("🎬 Fetching storyboards for scene:", sceneId)
      const sceneStoryboards = await StoryboardsService.getStoryboardsBySceneOrdered(sceneId)
      console.log("🎬 Storyboards fetched for scene:", sceneStoryboards)
      setStoryboards(sceneStoryboards)
      setIsLoadingStoryboards(false)
    } catch (error) {
      console.error("🎬 Error fetching storyboards:", error)
      setIsLoadingStoryboards(false)
    }
  }





  // Reset shot mode and counter
  const resetShotMode = () => {
    setShotDetails({
      shotNumber: getNextShotNumber(),
      shotType: "wide",
      cameraAngle: "eye-level",
      movement: "static"
    })
  }

  // Initialize shot details when storyboards load
  useEffect(() => {
    if (storyboards.length > 0 && shotMode) {
      resetShotMode()
    }
  }, [storyboards, shotMode])

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

      // Get unique shot number and sequence order
      const nextShotNumber = getNextShotNumber()
      
      // Clean up form data - convert empty strings to undefined for optional fields
      const cleanFormData = {
        ...formData,
        shot_number: nextShotNumber,
        sequence_order: formData.sequence_order || nextShotNumber,
        dialogue: formData.dialogue?.trim() || undefined,
        action: formData.action?.trim() || undefined,
        visual_notes: formData.visual_notes?.trim() || undefined,
        image_url: formData.image_url?.trim() || undefined,
        project_id: formData.project_id?.trim() || undefined,
        scene_id: sceneId
      }

      const newStoryboard = await StoryboardsService.createStoryboard(cleanFormData)
      setStoryboards(prev => [...prev, newStoryboard])
      setShowCreateForm(false)
      resetForm()
      
      toast({
        title: "Success",
        description: "Storyboard created successfully"
      })
    } catch (error: any) {
      console.error("Error creating storyboard:", error)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create storyboard'
      if (error?.message?.includes('User not authenticated')) {
        errorMessage = 'Your session has expired. Please refresh the page and try again.'
      } else if (error?.message?.includes('please refresh the page')) {
        errorMessage = 'Authentication issue. Please refresh the page and try again.'
      } else if (error?.message) {
        errorMessage = `Failed to create storyboard: ${error.message}`
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
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

      // Clean up form data - convert empty strings to undefined for optional fields
      const cleanFormData = {
        ...formData,
        dialogue: formData.dialogue?.trim() || undefined,
        action: formData.action?.trim() || undefined,
        visual_notes: formData.visual_notes?.trim() || undefined,
        image_url: formData.image_url?.trim() || undefined,
        project_id: formData.project_id?.trim() || undefined,
        scene_id: sceneId
      }

      const updatedStoryboard = await StoryboardsService.updateStoryboard(editingStoryboard.id, cleanFormData)
      setStoryboards(prev => prev.map(sb => sb.id === editingStoryboard.id ? updatedStoryboard : sb))
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

  // Function to get the next available shot number and sequence order
  const getNextShotNumber = () => {
    if (storyboards.length === 0) return 1
    
    // Find the highest shot_number
    const maxShotNumber = Math.max(...storyboards.map(sb => sb.shot_number))
    
    // Find the highest sequence_order
    const maxSequenceOrder = Math.max(...storyboards.map(sb => sb.sequence_order || sb.shot_number))
    
    return Math.max(maxShotNumber, maxSequenceOrder) + 1
  }

  // Get an available shot number, trying to preserve the preferred number if possible
  const getAvailableShotNumber = (preferredNumber: number): number => {
    // Get all existing shot numbers for this scene from current state
    const existingShotNumbers = new Set(storyboards.map(sb => sb.shot_number))
    
    // If the preferred number is available, use it
    if (!existingShotNumbers.has(preferredNumber)) {
      return preferredNumber
    }
    
    // Otherwise, find the next available number starting from preferred
    let candidate = preferredNumber
    while (existingShotNumbers.has(candidate)) {
      candidate++
    }
    return candidate
  }

  // Fetch storyboards and get available shot number (for use in retry logic)
  const getAvailableShotNumberWithFetch = async (preferredNumber: number): Promise<number> => {
    // Fetch fresh storyboards from database
    const freshStoryboards = await StoryboardsService.getStoryboardsByScene(sceneId)
    const existingShotNumbers = new Set(freshStoryboards.map(sb => sb.shot_number))
    
    // If the preferred number is available, use it
    if (!existingShotNumbers.has(preferredNumber)) {
      return preferredNumber
    }
    
    // Otherwise, find the next available number starting from preferred
    let candidate = preferredNumber
    while (existingShotNumbers.has(candidate)) {
      candidate++
    }
    return candidate
  }

  // Helper function to create a storyboard from a shot (extracted for reuse)
  const createStoryboardFromShot = async (shot: any) => {
    // Parse scene number from metadata
    let sceneNumber = 1
    if (sceneInfo?.metadata?.sceneNumber) {
      const parsed = typeof sceneInfo.metadata.sceneNumber === 'string' 
        ? parseInt(sceneInfo.metadata.sceneNumber) 
        : sceneInfo.metadata.sceneNumber
      sceneNumber = isNaN(parsed) ? 1 : parsed
    }
    
    // Map shot types to valid storyboard values
    const mapShotType = (shotType: string): string => {
      const oldValidTypes = ['wide', 'medium', 'close', 'extreme-close']
      if (oldValidTypes.includes(shotType)) return shotType
      if (['two-shot', 'over-the-shoulder'].includes(shotType)) return 'medium'
      if (['point-of-view', 'establishing'].includes(shotType)) return 'wide'
      if (['insert', 'cutaway'].includes(shotType)) return 'close'
      return 'wide'
    }
    
    // Map camera angles to valid storyboard values
    const mapCameraAngle = (angle: string): string => {
      const oldValidAngles = ['eye-level', 'high-angle', 'low-angle', 'dutch-angle']
      if (oldValidAngles.includes(angle)) return angle
      if (angle === 'bird-eye') return 'high-angle'
      if (angle === 'worm-eye') return 'low-angle'
      return 'eye-level'
    }
    
    // Map movement to valid storyboard values
    const mapMovement = (movement: string): string => {
      const oldValidMovements = ['static', 'panning', 'tilting', 'tracking', 'zooming']
      if (oldValidMovements.includes(movement)) return movement
      if (movement === 'dolly') return 'tracking'
      if (['crane', 'handheld', 'steadicam'].includes(movement)) return 'static'
      return 'static'
    }
    
    // Try to preserve the shot's original shot_number, with retry logic for conflicts
    const preferredShotNumber = shot.shot_number || 1
    let attemptShotNumber = await getAvailableShotNumberWithFetch(preferredShotNumber)
    let attempts = 0
    const maxAttempts = 10
    
    while (attempts < maxAttempts) {
      try {
        // For retries, fetch fresh storyboards and recalculate available shot number
        if (attempts > 0) {
          attemptShotNumber = await getAvailableShotNumberWithFetch(preferredShotNumber)
        }
        
        // Create storyboard from shot list data
        const storyboardData: CreateStoryboardData = {
          title: shot.description || `Shot ${attemptShotNumber}`,
          description: shot.description || shot.action || '',
          scene_number: sceneNumber,
          shot_number: attemptShotNumber,
          shot_type: mapShotType(shot.shot_type),
          camera_angle: mapCameraAngle(shot.camera_angle),
          movement: mapMovement(shot.movement),
          dialogue: shot.dialogue || undefined,
          action: shot.action || undefined,
          visual_notes: shot.visual_notes || undefined,
          scene_id: sceneId,
          project_id: sceneInfo?.project_id || undefined,
          sequence_order: shot.sequence_order || attemptShotNumber,
          status: 'draft',
        }
        
        const newStoryboard = await StoryboardsService.createStoryboard(storyboardData)
        
        // Refresh storyboards list after creation
        await fetchStoryboards()
        
        return { success: true, shotNumber: attemptShotNumber, preferredShotNumber }
      } catch (error: any) {
        attempts++
        
        // Check if it's a 409 conflict error (shot number already taken)
        const isConflictError = error?.code === '23505' || 
                              error?.error?.code === '23505' ||
                              error?.message?.includes('unique') ||
                              error?.error?.message?.includes('unique') ||
                              (error?.status === 409 || error?.error?.status === 409)
        
        if (isConflictError && attempts < maxAttempts) {
          // Shot number conflict - try next available number
          attemptShotNumber = getNextShotNumber()
          continue
        }
        
        // Not a conflict error or max attempts reached - return error
        console.error('Error creating storyboard from shot list:', error)
        return { 
          success: false, 
          error: error?.message || error?.error?.message || 'Failed to create storyboard from shot list.',
          shotNumber: shot.shot_number 
        }
      }
    }
    
    return { success: false, error: 'Max attempts reached', shotNumber: shot.shot_number }
  }

  // Create storyboards for all shots
  const handleCreateAllStoryboards = async () => {
    if (!shots || shots.length === 0) {
      toast({
        title: "No Shots Found",
        description: "There are no shots to create storyboards for.",
        variant: "destructive",
      })
      return
    }
    
    try {
      setIsCreatingAllStoryboards(true)
      
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []
      
      // Process shots sequentially to avoid conflicts
      for (const shot of shots) {
        const result = await createStoryboardFromShot(shot)
        if (result.success) {
          successCount++
          // Small delay between creations to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        } else {
          errorCount++
          errors.push(`Shot ${shot.shot_number}: ${result.error || 'Unknown error'}`)
        }
      }
      
      // Refresh storyboards list one final time
      await fetchStoryboards()
      
      // Show summary toast
      if (errorCount === 0) {
        toast({
          title: "Success!",
          description: `Successfully created ${successCount} storyboard${successCount !== 1 ? 's' : ''} from all shots.`,
        })
      } else {
        toast({
          title: "Partially Complete",
          description: `Created ${successCount} storyboard${successCount !== 1 ? 's' : ''}, but ${errorCount} failed. Check console for details.`,
          variant: "destructive",
        })
        console.error('Errors creating storyboards:', errors)
      }
    } catch (error) {
      console.error('Error creating all storyboards:', error)
      toast({
        title: "Error",
        description: "Failed to create storyboards. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingAllStoryboards(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      scene_number: 1,
      shot_number: 0, // Start blank for new shots
      shot_type: "wide",
      camera_angle: "eye-level",
      movement: "static",
      sequence_order: 0, // Start blank for new shots
      status: "draft",
      character_id: null,
      dialogue: "",
      action: "",
      visual_notes: "",
      image_url: "",
      project_id: "",
      scene_id: sceneId
    })
    setAiPrompt("")
    setSelectedAIService("dalle")
    setEditingStoryboard(null)
  }



  // Reset form when form is closed
  useEffect(() => {
    if (!showCreateForm && !showEditForm) {
      // Only reset if both forms are actually closed
      setTimeout(() => {
        if (!showCreateForm && !showEditForm) {
          resetForm()
        }
      }, 100)
    }
  }, [showCreateForm, showEditForm])

  const filteredStoryboards = storyboards.filter(storyboard => {
    const matchesSearch = storyboard.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         storyboard.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === "all" || 
                         (filterStatus === "ai" && storyboard.ai_generated) ||
                         (filterStatus === "manual" && !storyboard.ai_generated) ||
                         (filterStatus === "draft" && storyboard.status === "draft") ||
                         (filterStatus === "in-progress" && storyboard.status === "in-progress") ||
                         (filterStatus === "review" && storyboard.status === "review") ||
                         (filterStatus === "approved" && storyboard.status === "approved") ||
                         (filterStatus === "rejected" && storyboard.status === "rejected") ||
                         (filterStatus === "completed" && storyboard.status === "completed")
    
    return matchesSearch && matchesFilter
  })


  
  if (!ready || !userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!sceneId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Scene Not Found</h1>
          <p className="text-muted-foreground">No scene ID provided</p>
        </div>
      </div>
    )
  }
  
  // Temporarily bypass loading check to see main content
  const isLoading = false // isLoadingScene || isLoadingStoryboards
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading scene data...</p>
        </div>
      </div>
    )
  }
  
  // Function to render script text with visual highlighting
  const renderHighlightedScript = (script: string, usedRanges: Array<{start: number, end: number, text: string, shotNumber: number}>) => {
    if (!script) return null
    
    console.log("🎬 renderHighlightedScript called")
    console.log("🎬 Script length:", script.length)
    console.log("🎬 Used ranges:", usedRanges)
    console.log("🎬 Script (first 200 chars):", script.substring(0, 200))
    
    // Sort ranges by start position
    const sortedRanges = [...usedRanges].sort((a, b) => a.start - b.start)
    
    // Create highlighted text segments
    const segments: Array<{text: string, isUsed: boolean, shotNumber?: number}> = []
    let currentPos = 0
    
    sortedRanges.forEach((range, index) => {
      // Add unused text before this range
      if (range.start > currentPos) {
        const unusedText = script.substring(currentPos, range.start)
        if (unusedText.trim()) {
          segments.push({ text: unusedText, isUsed: false })
        }
      }
      
      // Add used text
      const usedText = script.substring(range.start, range.end)
      segments.push({ text: usedText, isUsed: true, shotNumber: range.shotNumber })
      
      currentPos = range.end
    })
    
    // Add remaining unused text
    if (currentPos < script.length) {
      const remainingText = script.substring(currentPos)
      if (remainingText.trim()) {
        segments.push({ text: remainingText, isUsed: false })
      }
    }
    
    return segments.map((segment, index) => (
      <span
        key={index}
        className={`${segment.isUsed 
          ? 'bg-green-500/10 text-green-100 border border-green-500/20 rounded px-1 py-0.5 cursor-pointer hover:bg-green-500/20 transition-colors' 
          : 'text-foreground'
        }`}
        title={segment.isUsed ? `Shot ${segment.shotNumber}` : 'Available for new shot'}
        onClick={() => {
          if (segment.isUsed) {
            toast({
              title: `Shot ${segment.shotNumber}`,
              description: "This text has already been used for a shot",
            })
          }
        }}
      >
        {segment.text}
      </span>
    ))
  }
  
  // Function to get user profile with API keys
  const getUserProfile = async () => {
    if (!userId) return null
    
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }
      
      return data
    } catch (error) {
      console.error('Error in getUserProfile:', error)
      return null
    }
  }

  // Function to get the appropriate API key for the selected service
  const getApiKeyForService = (service: string) => {
    if (!userProfile) return null
    
    switch (service) {
      case 'dalle':
      case 'DALL-E 3':
        return userProfile.openai_api_key
      case 'openart':
      case 'OpenArt':
        return userProfile.openart_api_key
      case 'runway':
      case 'Runway ML':
        return userProfile.runway_api_key
      case 'leonardo':
      case 'Leonardo AI':
        return userProfile.leonardo_api_key
      default:
        return userProfile.openai_api_key // fallback to OpenAI
    }
  }

  // Load user profile when component mounts
  useEffect(() => {
    if (ready && userId) {
      getUserProfile().then(profile => {
        setUserProfile(profile)
      })
    }
  }, [ready, userId])

  // Debug: Monitor selectedAIService changes
  useEffect(() => {
    console.log('🎬 selectedAIService changed to:', selectedAIService)
  }, [selectedAIService])

  // Ensure selectedAIService is always valid
  useEffect(() => {
    if (selectedAIService && !['dalle', 'openart', 'leonardo'].includes(selectedAIService)) {
      console.warn('🎬 Invalid selectedAIService detected, resetting to dalle:', selectedAIService)
      setSelectedAIService('dalle')
    }
  }, [selectedAIService])

  // Function to generate AI image for a storyboard shot
  const generateShotImage = async (storyboardId: string, prompt: string) => {
    if (!prompt.trim() || !userId) {
      toast({
        title: "Missing Information",
        description: "Please enter a prompt for the AI image generation.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsGeneratingShotImage(true)
      
      // Get the AI settings for images tab
      const imagesSetting = aiSettings.find(setting => setting.tab_type === 'images')
      
      // Determine which service to use - locked model takes precedence
      let serviceToUse = selectedAIService
      let modelToUse: string | undefined = undefined
      
      if (imagesSetting?.is_locked && imagesSetting.locked_model) {
        serviceToUse = mapModelToService(imagesSetting.locked_model)
        modelToUse = normalizeImageModel(imagesSetting.locked_model)
        console.log('🎬 Using locked model from AI settings:', imagesSetting.locked_model)
        console.log('🎬 Mapped to service identifier:', serviceToUse)
        console.log('🎬 Normalized model for API:', modelToUse)
      } else {
        // Safety check: ensure we have a valid service
        if (!serviceToUse || !['dalle', 'openart', 'runway', 'leonardo'].includes(serviceToUse)) {
          console.warn('🎬 Invalid service selected, falling back to dalle:', serviceToUse)
          serviceToUse = 'dalle'
        }
      }
      
      // Debug: Log the selected service
      console.log('🎬 Selected AI service:', serviceToUse)
      console.log('🎬 Service type:', typeof serviceToUse)
      console.log('🎬 Using locked model:', imagesSetting?.is_locked)
      console.log('🎬 Locked model value:', imagesSetting?.locked_model)
      console.log('🎬 Model to use:', modelToUse)
      
      // Get the API key for the selected service
      const apiKey = getApiKeyForService(serviceToUse)
      if (!apiKey) {
        toast({
          title: "API Key Required",
          description: `Please configure your ${serviceToUse.toUpperCase()} API key in your profile settings.`,
          variant: "destructive"
        })
        return
      }

      // Get the selected character details if a character is selected for this shot
      let characterDetailsText = ""
      const storyboard = storyboards.find(sb => sb.id === storyboardId)
      if (storyboard?.character_id) {
        const selectedCharacter = characters.find(c => c.id === storyboard.character_id)
        if (selectedCharacter) {
          const characterDetails = [
            selectedCharacter.name && `Character name: ${selectedCharacter.name}`,
            selectedCharacter.age && `Age: ${selectedCharacter.age}`,
            selectedCharacter.gender && `Gender: ${selectedCharacter.gender}`,
            selectedCharacter.archetype && `Archetype: ${selectedCharacter.archetype}`,
            selectedCharacter.description && `Description: ${selectedCharacter.description}`,
            selectedCharacter.height && `Height: ${selectedCharacter.height}`,
            selectedCharacter.build && `Build: ${selectedCharacter.build}`,
            selectedCharacter.skin_tone && `Skin tone: ${selectedCharacter.skin_tone}`,
            selectedCharacter.eye_color && `Eye color: ${selectedCharacter.eye_color}`,
            selectedCharacter.hair_color_current && `Hair: ${selectedCharacter.hair_color_current} (${selectedCharacter.hair_length})`,
            selectedCharacter.face_shape && `Face shape: ${selectedCharacter.face_shape}`,
            selectedCharacter.usual_clothing_style && `Clothing style: ${selectedCharacter.usual_clothing_style}`,
            selectedCharacter.typical_color_palette?.length > 0 && `Color palette: ${selectedCharacter.typical_color_palette.join(', ')}`,
            selectedCharacter.personality?.traits?.length > 0 && `Personality traits: ${selectedCharacter.personality.traits.join(', ')}`,
          ].filter(Boolean).join(', ')
          
          if (characterDetails) {
            characterDetailsText = ` Character details: ${characterDetails}.`
          }
        }
      }
      
      // Prepare the enhanced prompt for storyboard shots - keep it minimal
      let enhancedPrompt = prompt.trim()
      
      // Add character details if available
      if (characterDetailsText) {
        enhancedPrompt = `${enhancedPrompt}${characterDetailsText}`
      }
      
      // Only add minimal enhancement if user hasn't chosen exact prompt
      if (!useExactPrompt) {
        enhancedPrompt = `${enhancedPrompt}, storyboard style`
      }

      // Debug: Log the request body
      const requestBody: any = {
        prompt: enhancedPrompt,
        service: serviceToUse,
        apiKey: apiKey,
        userId: userId,
        autoSaveToBucket: true
      }
      
      // Add model parameter if we have one (for GPT Image support)
      if (modelToUse) {
        requestBody.model = modelToUse
      }
      console.log('🎬 Request body being sent:', requestBody)
      console.log('🎬 Service value type:', typeof serviceToUse)
      console.log('🎬 Service value:', JSON.stringify(serviceToUse))
      console.log('🎬 Full request body JSON:', JSON.stringify(requestBody))

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const result = await response.json()
      
      if (result.success && result.imageUrl) {
        // Use bucket URL if available, otherwise fall back to original URL
        const imageUrlToUse = result.bucketUrl || result.imageUrl
        
        console.log('🎬 Image generation result:', {
          success: result.success,
          originalUrl: result.imageUrl,
          bucketUrl: result.bucketUrl,
          savedToBucket: result.savedToBucket,
          usingUrl: imageUrlToUse
        })
        
        // Update the storyboard with the generated image
        const updatedStoryboard = await StoryboardsService.updateStoryboardImage(storyboardId, imageUrlToUse)
        
        // Update local state
        setStoryboards(prev => prev.map(sb => 
          sb.id === storyboardId ? updatedStoryboard : sb
        ))

        toast({
          title: "Image Generated!",
          description: result.savedToBucket 
            ? "AI image has been generated and saved to your bucket!" 
            : "AI image has been generated and added to the storyboard shot.",
        })

        // Clear the prompt
        setAiImagePrompt("")
        
        // Close edit form if it's open
        if (showEditForm) {
          setShowEditForm(false)
          setEditingStoryboard(null)
        }
      } else {
        throw new Error('Failed to generate image')
      }
    } catch (error) {
      console.error('Error generating shot image:', error)
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate AI image",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingShotImage(false)
    }
  }
  
  // Auto-select locked model for images tab if available
  useEffect(() => {
    if (aiSettingsLoaded && aiSettings.length > 0) {
      const imagesSetting = aiSettings.find(setting => setting.tab_type === 'images')
      if (imagesSetting?.is_locked && imagesSetting.locked_model) {
        console.log('🎬 Setting locked model for images:', imagesSetting.locked_model)
        setSelectedAIService(imagesSetting.locked_model)
      }
    }
  }, [aiSettingsLoaded, aiSettings])
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link href="/movies" className="hover:text-foreground">Movies</Link>
            <span>/</span>
            <Link href={`/timeline?movie=${sceneInfo?.project_id}`} className="hover:text-foreground">
              {sceneInfo?.project_name || "Unknown Project"}
            </Link>
            <span>/</span>
            <Link href={`/timeline?movie=${sceneInfo?.project_id}`} className="hover:text-foreground">
              {sceneInfo?.timeline_name || "Unknown Timeline"}
            </Link>
            <span>/</span>
            <span className="text-foreground">
              {sceneInfo?.scene_number ? `Scene ${sceneInfo.scene_number}: ` : ''}{sceneInfo?.name || "Unknown Scene"}
            </span>
          </nav>
        </div>

        {/* Scene Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {sceneInfo?.scene_number && (
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    Scene {sceneInfo.scene_number}
                  </Badge>
                )}
                <h1 className="text-4xl font-bold">{sceneInfo?.name || "Loading Scene..."}</h1>
              </div>
              <p className="text-muted-foreground text-lg">{sceneInfo?.description || "Loading description..."}</p>
            </div>
            
            {/* Scene Navigation */}
            {allScenes.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentSceneIndex > 0) {
                      const prevScene = allScenes[currentSceneIndex - 1]
                      router.push(`/storyboards/${prevScene.id}`)
                    }
                  }}
                  disabled={currentSceneIndex <= 0}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Previous</span>
                </Button>
                
                <Select
                  value={sceneId}
                  onValueChange={(value) => {
                    router.push(`/storyboards/${value}`)
                  }}
                >
                  <SelectTrigger className="w-[200px] sm:w-[250px] border-primary/30">
                    <SelectValue>
                      {sceneInfo ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{sceneInfo.name}</span>
                          {sceneInfo.metadata?.sceneNumber && (
                            <Badge variant="outline" className="text-xs">
                              {sceneInfo.metadata.sceneNumber}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        'Select Scene'
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allScenes.map((s, index) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            {s.metadata?.sceneNumber && (
                              <Badge variant="outline" className="text-xs">
                                {s.metadata.sceneNumber}
                              </Badge>
                            )}
                          </div>
                          {s.id === sceneId && (
                            <Badge variant="secondary" className="text-xs ml-2">
                              Current
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentSceneIndex >= 0 && currentSceneIndex < allScenes.length - 1) {
                      const nextScene = allScenes[currentSceneIndex + 1]
                      router.push(`/storyboards/${nextScene.id}`)
                    }
                  }}
                  disabled={currentSceneIndex < 0 || currentSceneIndex >= allScenes.length - 1}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <span className="hidden sm:inline mr-1">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Film className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{sceneInfo?.project_name || "Loading Project..."}</div>
                <div className="text-xs text-muted-foreground">Project</div>
              </div>
            </div>
            {sceneInfo?.scene_number && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Scene {sceneInfo.scene_number}</div>
                  <div className="text-xs text-muted-foreground">Scene Number</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{sceneInfo?.start_time_seconds || "Loading Time..."}s</div>
                <div className="text-xs text-muted-foreground">Start Time</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{sceneInfo?.duration_seconds || "Loading Duration..."}s</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scene Script Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Scene Script</h2>
            <div className="flex items-center gap-2">
              {isLoadingScript && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Loading...
                </div>
              )}
              <Button
                variant={shotMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const newShotMode = !shotMode
                  console.log("🎬 Shot mode toggle clicked!")
                  console.log("🎬 Current shotMode:", shotMode)
                  console.log("🎬 Setting shotMode to:", newShotMode)
                  setShotMode(newShotMode)
                  if (newShotMode) {
                    console.log("🎬 Resetting shot mode...")
                    resetShotMode()
                  }
                }}
                className={`text-xs ${shotMode ? 'bg-primary text-primary-foreground' : ''}`}
              >
                <Film className="h-3 w-3 mr-1" />
                {shotMode ? 'Shot Mode ON' : 'Shot Mode'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSceneScript}
                disabled={isLoadingScript}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh Script
              </Button>
            </div>
          </div>
          
          {/* Shot Mode Status Indicator */}
          <div className={`mb-4 p-2 rounded-lg text-xs font-medium ${shotMode ? 'bg-green-900 text-green-200 border border-green-700' : 'bg-gray-800 text-gray-300 border border-gray-600'}`}>
            🎬 Shot Mode: {shotMode ? 'ENABLED' : 'DISABLED'} 
            {shotMode && ` | Next Shot: ${shotDetails.shotNumber}`}
          </div>
          {/* Shot Mode Configuration Panel */}
          {shotMode && (
            <Card className="shot-mode-config mb-4" style={{ backgroundColor: '#141414', borderColor: '#333' }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Film className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-medium text-white">Shot Mode Configuration</h3>
                  <Badge variant="secondary" className="text-xs bg-blue-600 text-white">
                    Next Shot: {shotDetails.shotNumber}
                  </Badge>
                </div>
                
                {editingShotDetails ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label htmlFor="edit-shot-type" className="text-xs text-blue-300">Shot Type</Label>
                        <Select 
                          value={tempShotDetails.shotType} 
                          onValueChange={(value) => {
                            setTempShotDetails(prev => ({ ...prev, shotType: value }))
                            // Re-apply visual selection after dropdown change
                            setTimeout(reapplySelection, 50)
                          }}
                        >
                          <SelectTrigger 
                            className="h-8 text-xs bg-gray-800 border-gray-600 text-white"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="wide">Wide</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="close">Close</SelectItem>
                            <SelectItem value="extreme-close">Extreme Close</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="edit-camera-angle" className="text-xs text-blue-300">Camera Angle</Label>
                        <Select 
                          value={tempShotDetails.cameraAngle} 
                          onValueChange={(value) => {
                            setTempShotDetails(prev => ({ ...prev, cameraAngle: value }))
                            // Re-apply visual selection after dropdown change
                            setTimeout(reapplySelection, 50)
                          }}
                        >
                          <SelectTrigger 
                            className="h-8 text-xs bg-gray-800 border-gray-600 text-white"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="eye-level">Eye Level</SelectItem>
                            <SelectItem value="high-angle">High Angle</SelectItem>
                            <SelectItem value="low-angle">Low Angle</SelectItem>
                            <SelectItem value="dutch-angle">Dutch Angle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="edit-movement" className="text-xs text-blue-300">Movement</Label>
                        <Select 
                          value={tempShotDetails.movement} 
                          onValueChange={(value) => {
                            setTempShotDetails(prev => ({ ...prev, movement: value }))
                            // Re-apply visual selection after dropdown change
                            setTimeout(reapplySelection, 50)
                          }}
                        >
                          <SelectTrigger 
                            className="h-8 text-xs bg-gray-800 border-gray-600 text-white"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="static">Static</SelectItem>
                            <SelectItem value="panning">Panning</SelectItem>
                            <SelectItem value="tilting">Tilting</SelectItem>
                            <SelectItem value="tracking">Tracking</SelectItem>
                            <SelectItem value="zooming">Zooming</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setTempShotDetails(prev => ({ ...prev, shotNumber: getNextShotNumber() }))
                            // Re-apply visual selection after button click
                            setTimeout(reapplySelection, 50)
                          }}
                          className="h-8 text-xs bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                        >
                          Reset Shot #
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShotDetails(tempShotDetails)
                          setEditingShotDetails(false)
                          // Re-apply visual selection after button click
                          setTimeout(reapplySelection, 50)
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Save Changes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTempShotDetails(shotDetails)
                          setEditingShotDetails(false)
                          // Re-apply visual selection after button click
                          setTimeout(reapplySelection, 50)
                        }}
                        className="text-xs bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label htmlFor="shot-type" className="text-xs text-blue-300">Shot Type</Label>
                        <Select 
                          value={shotDetails.shotType} 
                          onValueChange={(value) => {
                            setShotDetails(prev => ({ ...prev, shotType: value }))
                            // Re-apply visual selection after dropdown change
                            setTimeout(reapplySelection, 50)
                          }}
                        >
                          <SelectTrigger 
                            className="h-8 text-xs bg-gray-800 border-gray-600 text-white"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="wide">Wide</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="close">Close</SelectItem>
                            <SelectItem value="extreme-close">Extreme Close</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="camera-angle" className="text-xs text-blue-300">Camera Angle</Label>
                        <Select 
                          value={shotDetails.cameraAngle} 
                          onValueChange={(value) => {
                            setShotDetails(prev => ({ ...prev, cameraAngle: value }))
                            // Re-apply visual selection after dropdown change
                            setTimeout(reapplySelection, 50)
                          }}
                        >
                          <SelectTrigger 
                            className="h-8 text-xs bg-gray-800 border-gray-600 text-white"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="eye-level">Eye Level</SelectItem>
                            <SelectItem value="high-angle">High Angle</SelectItem>
                            <SelectItem value="low-angle">Low Angle</SelectItem>
                            <SelectItem value="dutch-angle">Dutch Angle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="movement" className="text-xs text-blue-300">Movement</Label>
                        <Select 
                          value={shotDetails.movement} 
                          onValueChange={(value) => {
                            setShotDetails(prev => ({ ...prev, movement: value }))
                            // Re-apply visual selection after dropdown change
                            setTimeout(reapplySelection, 50)
                          }}
                        >
                          <SelectTrigger 
                            className="h-8 text-xs bg-gray-800 border-gray-600 text-white"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="static">Static</SelectItem>
                            <SelectItem value="panning">Panning</SelectItem>
                            <SelectItem value="tilting">Tilting</SelectItem>
                            <SelectItem value="tracking">Tracking</SelectItem>
                            <SelectItem value="zooming">Zooming</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShotDetails(prev => ({ ...prev, shotNumber: getNextShotNumber() }))
                            // Re-apply visual selection after button click
                            setTimeout(reapplySelection, 50)
                          }}
                          className="h-8 text-xs bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                        >
                          Reset Shot #
                        </Button>
                      </div>
                    </div>
                    {/* Character Selector */}
                    {characters.length > 0 && (
                      <div>
                        <Label htmlFor="character-selector" className="text-xs text-blue-300">Character (Optional)</Label>
                        <Select 
                          value={shotDetails.characterId || "none"} 
                          onValueChange={(value) => {
                            setShotDetails(prev => ({ ...prev, characterId: value === "none" ? null : value }))
                            setTimeout(reapplySelection, 50)
                          }}
                        >
                          <SelectTrigger 
                            className="h-8 text-xs bg-gray-800 border-gray-600 text-white"
                            onMouseDown={(e) => e.stopPropagation()}
                            id="character-selector"
                          >
                            <SelectValue placeholder="Select a character..." />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="none">
                              <span className="text-muted-foreground">No character selected</span>
                            </SelectItem>
                            {characters.map((char) => (
                              <SelectItem key={char.id} value={char.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{char.name}</span>
                                  {char.archetype && (
                                    <span className="text-xs text-muted-foreground">{char.archetype}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-blue-300">
                        💡 Select text in the script below and click "Create Shot" to automatically create storyboards with these settings
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTempShotDetails(shotDetails)
                          setEditingShotDetails(true)
                          // Re-apply visual selection after button click
                          setTimeout(reapplySelection, 50)
                        }}
                        className="text-xs bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                      >
                        Edit Details
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {sceneScript ? (
            <Card className="bg-muted/20 border-border/50">
              <CardContent className="p-6">
                {shotMode && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Film className="h-4 w-4" />
                      <span className="text-sm font-medium">Shot Mode Active</span>
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                        Next: Shot {shotDetails.shotNumber}
                      </Badge>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Select text in the script below to create storyboard shots with your configured settings
                    </p>
                  </div>
                )}
                <div className="bg-background/50 rounded-lg p-4 border border-border/30 relative">
                  {/* Text Highlighting Legend */}
                  {usedTextRanges.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-800/50 border border-gray-600 rounded-lg">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500/20 border border-green-500/30 rounded"></div>
                          <span className="text-green-300">Used Text (Already Shot)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-blue-500/20 border border-blue-500/30 rounded"></div>
                          <span className="text-blue-300">Current Selection</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-transparent border border-gray-500 rounded"></div>
                          <span className="text-gray-300">Available for New Shots</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Click on highlighted text to see shot details. Green text has already been used for shots.
                      </p>
                    </div>
                  )}
                  
                  <pre 
                    className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed select-text cursor-text"
                    onMouseUp={handleTextSelection}
                    onKeyUp={handleTextSelection}
                    onSelect={handleTextSelection}
                    onMouseDown={() => {
                      setShowSelectionActions(false)
                      // Clear any stale locked selection when starting new selection
                      if (lockedSelection && lockedSelection.length < 3) {
                        console.log("🎬 Clearing stale locked selection:", lockedSelection)
                        setLockedSelection("")
                        setIsSelectionLocked(false)
                      }
                    }}
                  >
                    {renderHighlightedScript(sceneScript, usedTextRanges)}
                  </pre>
                  
                  {/* Selection Action Buttons */}
                  {showSelectionActions && (selectedText || lockedSelection) && shotMode && (
                    <div className="selection-actions fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-background border border-border rounded-lg shadow-lg p-2 z-50">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                          {(selectedText || lockedSelection).length} chars selected
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            console.log("🎬 Create Shot button clicked!")
                            console.log("🎬 Selected text:", selectedText || lockedSelection)
                            handleCreateShotFromSelection()
                          }}
                          className="text-xs h-7 px-2 bg-primary text-primary-foreground"
                        >
                          <Film className="h-3 w-3 mr-1" />
                          Create Shot {shotDetails.shotNumber}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            unlockSelection()
                            window.getSelection()?.removeAllRanges()
                          }}
                          className="text-xs h-7 w-7 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-muted/20 border-border/50">
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Script Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This scene doesn't have a script yet. Scripts are typically created in the AI Studio or imported from files.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/ai-studio')}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Create Script in AI Studio
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/timeline-scene/${sceneId}`)}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    View Scene Assets
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>



        {/* Storyboards Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Storyboards</h2>
            <div className="flex gap-2">

              <Button 
                onClick={() => setShowCreateForm(true)}
                className="gradient-button neon-glow text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Storyboard
              </Button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search storyboards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shots</SelectItem>
                  <SelectItem value="ai">AI Generated</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sequence Overview */}
          {filteredStoryboards.length > 0 && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  {sceneInfo?.scene_number ? `Scene ${sceneInfo.scene_number} - ` : ''}Shot Sequence:
                </span>
                <span className="text-xs text-muted-foreground">
                  {filteredStoryboards.length} total shots
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredStoryboards.map((storyboard, index) => (
                  <span key={storyboard.id} className="bg-background px-2 py-1 rounded text-xs font-mono border">
                    {index + 1}. Shot {storyboard.shot_number || 1}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Create New Storyboard for {sceneInfo?.name || "Loading Scene..."}
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
                    placeholder="Shot title"
                  />
                </div>
                <div>
                  <Label htmlFor="shot_number">Shot Number</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use decimals to insert between shots: 1.2, 2.5, etc.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="shot_number"
                      type="number"
                      value={formData.shot_number || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        setFormData(prev => ({ 
                          ...prev, 
                          shot_number: value,
                          sequence_order: value // Sync with sequence_order for proper sorting
                        }))
                      }}
                      min="0.1"
                      step="0.1"
                      placeholder="1.2 for between shots 1 and 2"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextShot = getNextShotNumber()
                        setFormData(prev => ({ 
                          ...prev, 
                          shot_number: nextShot,
                          sequence_order: nextShot // Sync with sequence_order for proper sorting
                        }))
                      }}
                      title="Auto-fill next shot number"
                    >
                      Next
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="sequence_order">Sequence Order (for positioning)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use decimals to insert between shots: 2.5 goes between shots 2 and 3
                  </p>
                  <Input
                    id="sequence_order"
                    type="number"
                    value={formData.sequence_order || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, sequence_order: parseFloat(e.target.value) || 0 }))}
                    min="0.1"
                    step="0.1"
                    placeholder="1.5 for between shots 1 and 2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Shot description"
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

              {/* Character Selector */}
              {characters.length > 0 && (
                <div>
                  <Label htmlFor="character_id">Character (Optional)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Select a character to automatically include their details when generating images
                  </p>
                  <Select 
                    value={formData.character_id || "none"} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, character_id: value === "none" ? null : value }))}
                  >
                    <SelectTrigger id="character_id">
                      <SelectValue placeholder="Select a character..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">No character selected</span>
                      </SelectItem>
                      {characters.map((char) => (
                        <SelectItem key={char.id} value={char.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{char.name}</span>
                            {char.archetype && (
                              <span className="text-xs text-muted-foreground">{char.archetype}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status Field */}
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status || "draft"} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
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
                    placeholder="What happens in this shot"
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

        {/* Edit Storyboard Form */}
        {showEditForm && editingStoryboard && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Storyboard: {editingStoryboard.title}
              </CardTitle>
              <CardDescription>
                Update the storyboard details below. Use AI assistance for image generation.
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
                    placeholder="Shot title"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-shot_number">Shot Number</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use decimals to insert between shots: 1.2, 2.5, etc.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="edit-shot_number"
                      type="number"
                      value={formData.shot_number}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        setFormData(prev => ({ 
                          ...prev, 
                          shot_number: value,
                          sequence_order: value // Sync with sequence_order for proper sorting
                        }))
                      }}
                      min="0.1"
                      step="0.1"
                      placeholder="1.2 for between shots 1 and 2"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextShot = getNextShotNumber()
                        setFormData(prev => ({ 
                          ...prev, 
                          shot_number: nextShot,
                          sequence_order: nextShot // Sync with sequence_order for proper sorting
                        }))
                      }}
                      title="Auto-fill next shot number"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-sequence_order">Sequence Order (for positioning)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Use decimals to insert between shots: 2.5 goes between shots 2 and 3
                </p>
                <Input
                  id="edit-sequence_order"
                  type="number"
                  value={formData.sequence_order || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, sequence_order: parseFloat(e.target.value) || 0 }))}
                  min="0.1"
                  step="0.1"
                  placeholder="1.5 for between shots 1 and 2"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description *</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Shot description"
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

              {/* Character Selector */}
              {characters.length > 0 && (
                <div>
                  <Label htmlFor="edit-character_id">Character (Optional)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Select a character to automatically include their details when generating images
                  </p>
                  <Select 
                    value={formData.character_id || "none"} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, character_id: value === "none" ? null : value }))}
                  >
                    <SelectTrigger id="edit-character_id">
                      <SelectValue placeholder="Select a character..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">No character selected</span>
                      </SelectItem>
                      {characters.map((char) => (
                        <SelectItem key={char.id} value={char.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{char.name}</span>
                            {char.archetype && (
                              <span className="text-xs text-muted-foreground">{char.archetype}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status Field */}
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formData.status || "draft"} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
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
                    placeholder="What happens in this shot"
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

              {/* AI Image Generation Section */}
              <div className="border border-border/30 rounded-lg p-4 bg-muted/20">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <h3 className="text-sm font-medium">AI Image Generation</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ai-image-prompt">Image Prompt</Label>
                    
                    {/* Saved Prompts Dropdown */}
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-2">
                        Saved Prompts: {savedPrompts.length} found for this movie
                        {sceneInfo?.project_id && (
                          <span className="ml-2 text-blue-400">
                            (Project: {sceneInfo.project_id})
                          </span>
                        )}
                      </div>
                      {savedPrompts.length > 0 ? (
                        <>
                          <Label htmlFor="saved-prompt-select" className="text-xs text-muted-foreground mb-2 block">
                            Use Saved Prompt
                          </Label>
                        <Select onValueChange={(promptId) => {
                          const selectedPrompt = savedPrompts.find(p => p.id === promptId)
                          
                          if (selectedPrompt) {
                            if (hidePromptText) {
                              // Insert just the prompt name when hiding text
                              setAiImagePrompt(selectedPrompt.title)
                            } else {
                              // Insert the full prompt when showing text
                              setAiImagePrompt(selectedPrompt.prompt)
                            }
                            // Always store the full prompt text for AI generation
                            setAiImagePromptFull(selectedPrompt.prompt)
                            toast({
                              title: "Prompt Loaded",
                              description: `Loaded: ${selectedPrompt.title}`,
                            })
                          }
                        }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select a saved prompt..." />
                          </SelectTrigger>
                          <SelectContent>
                            {savedPrompts.map((prompt) => (
                              <SelectItem key={prompt.id} value={prompt.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span className="truncate">{prompt.title}</span>
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {prompt.useCount || 0} uses
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          No saved prompts found. Create some in the Visual Dev page first.
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const shotInfo = `${formData.shot_type} shot, ${formData.camera_angle} angle`
                            setAiImagePrompt(prev => {
                              if (prev.trim()) {
                                return `${prev}, ${shotInfo}`
                              }
                              return shotInfo
                            })
                          }}
                          className="text-xs h-7 px-2 bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20"
                          title="Insert shot type and camera angle"
                        >
                          <Film className="h-3 w-3 mr-1" />
                          Insert Shot Details
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="exact-prompt-toggle" className="text-xs text-muted-foreground">
                          Use exact prompt
                        </Label>
                        <input
                          id="exact-prompt-toggle"
                          type="checkbox"
                          checked={useExactPrompt}
                          onChange={(e) => setUseExactPrompt(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    {hidePromptText && aiImagePromptFull ? (
                      <div className="space-y-2">
                        <div className="text-sm text-blue-500 font-medium">
                          {savedPrompts.find(p => p.prompt === aiImagePromptFull)?.title}
                        </div>
                        <Textarea
                          id="ai-image-prompt"
                          value={aiImagePrompt.replace(savedPrompts.find(p => p.prompt === aiImagePromptFull)?.title || '', '')}
                          onChange={(e) => setAiImagePrompt(savedPrompts.find(p => p.prompt === aiImagePromptFull)?.title + ' ' + e.target.value)}
                          placeholder="Type additional text here..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    ) : (
                      <Textarea
                        id="ai-image-prompt"
                        value={aiImagePrompt}
                        onChange={(e) => setAiImagePrompt(e.target.value)}
                        placeholder="Describe the visual style, composition, lighting, and mood for this shot..."
                        rows={2}
                        className="text-sm"
                      />
                    )}
                  </div>
                  
                  {/* AI Service Selection - Only show if not locked */}
                  {!aiSettings.find(setting => setting.tab_type === 'images')?.is_locked && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label htmlFor="ai-service-select">AI Service</Label>
                        <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue placeholder="Select AI model" />
                          </SelectTrigger>
                          <SelectContent className="cinema-card border-border">
                            {aiModels.image.map((model) => {
                              const availability = checkModelAvailability(model)
                              return (
                                <SelectItem key={model} value={mapModelToService(model)} disabled={!availability.isReady}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{model}</span>
                                    <Badge 
                                      variant={availability.isReady ? "default" : "secondary"} 
                                      className="text-xs ml-2"
                                    >
                                      {availability.statusText}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-end">
                        <Button
                          onClick={() => generateShotImage(editingStoryboard.id, aiImagePrompt)}
                          disabled={isGeneratingShotImage || !aiImagePrompt.trim()}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white"
                          size="sm"
                        >
                          {isGeneratingShotImage ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate Image
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Show locked model info if images tab is locked */}
                  {aiSettings.find(setting => setting.tab_type === 'images')?.is_locked && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI model configured
                      </p>
                      <div className="flex items-end mt-3">
                        <Button
                          onClick={() => generateShotImage(editingStoryboard.id, aiImagePrompt)}
                          disabled={isGeneratingShotImage || !aiImagePrompt.trim()}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white"
                          size="sm"
                        >
                          {isGeneratingShotImage ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate Image
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    💡 Tip: Be specific about camera angle, lighting, mood, and visual style. The AI will create a cinematic storyboard image based on your description.
                  </p>
                </div>
              </div>

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
          {filteredStoryboards.map((storyboard, index) => (
            <Card key={storyboard.id} className="cinema-card hover:neon-glow transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <CardTitle className="text-lg">{storyboard.title}</CardTitle>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-blue-500/20 text-blue-500 border-blue-500/30"
                  >
                    Shot
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  <span className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    Shot {storyboard.shot_number || 1}
                  </span>
                  {sceneInfo?.scene_number && (
                    <span className="bg-blue-500/20 text-blue-500 px-2 py-1 rounded text-xs font-mono border border-blue-500/30">
                      Scene {sceneInfo.scene_number}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Badge
                        variant="secondary"
                        className={`px-2 py-1 text-xs font-mono border cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${getStatusBadgeStyle(storyboard.status || 'draft')}`}
                      >
                        {getStatusDisplayText(storyboard.status || 'draft')}
                        <ChevronDown className="h-3 w-3" />
                      </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem 
                        onClick={() => handleStatusUpdate(storyboard.id, 'draft')}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                          Draft
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusUpdate(storyboard.id, 'in-progress')}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          In Progress
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusUpdate(storyboard.id, 'review')}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          Review
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusUpdate(storyboard.id, 'approved')}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          Approved
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusUpdate(storyboard.id, 'rejected')}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          Rejected
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleStatusUpdate(storyboard.id, 'completed')}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          Completed
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {storyboard.image_url && (
                  <div className="relative h-48 bg-muted rounded-lg overflow-hidden group">
                    <img
                      src={storyboard.image_url}
                      alt={storyboard.title}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={async () => {
                        try {
                          const response = await fetch(storyboard.image_url!)
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${storyboard.title || 'storyboard'}-${storyboard.id}.${blob.type.split('/')[1] || 'png'}`
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                          toast({
                            title: "Download Started",
                            description: "Image download has started.",
                          })
                        } catch (error) {
                          toast({
                            title: "Download Failed",
                            description: "Failed to download image. Please try again.",
                            variant: "destructive",
                          })
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
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
                    {storyboard.image_url && (
                      <Badge className="text-xs bg-green-500/20 text-green-500 border-green-500/30">
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Has Image
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Updated {new Date(storyboard.updated_at).toLocaleDateString()}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {/* Quick AI Image Generation Button */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 hover:text-purple-600"
                      title="Generate AI Image"
                      onClick={() => {
                        // Set the editing storyboard and show edit form with AI focus
                        setEditingStoryboard(storyboard)
                        setFormData({
                          title: storyboard.title,
                          description: storyboard.description,
                          scene_number: storyboard.scene_number,
                          shot_number: storyboard.shot_number || 1,
                          shot_type: storyboard.shot_type,
                          camera_angle: storyboard.camera_angle,
                          movement: storyboard.movement,
                          sequence_order: storyboard.sequence_order || storyboard.shot_number || 1,
                          status: storyboard.status || "draft",
                          character_id: storyboard.character_id || null,
                          dialogue: storyboard.dialogue || "",
                          action: storyboard.action || "",
                          visual_notes: storyboard.visual_notes || "",
                          image_url: storyboard.image_url || "",
                          project_id: storyboard.project_id || "",
                          scene_id: sceneId
                        })
                        // Pre-fill AI prompt with shot details
                        const autoPrompt = `${storyboard.shot_type} shot, ${storyboard.camera_angle} angle, ${storyboard.movement} camera, ${storyboard.description}`
                        setAiImagePrompt(autoPrompt)
                        setShowEditForm(true)
                        // Scroll to AI section after form opens
                        setTimeout(() => {
                          const aiSection = document.querySelector('[id="ai-image-prompt"]')
                          if (aiSection) {
                            aiSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }
                        }, 100)
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 hover:text-blue-600"
                      onClick={() => {
                        setEditingStoryboard(storyboard)
                        setFormData({
                          title: storyboard.title,
                          description: storyboard.description,
                          scene_number: storyboard.scene_number,
                          shot_number: storyboard.shot_number || 1,
                          shot_type: storyboard.shot_type,
                          camera_angle: storyboard.camera_angle,
                          movement: storyboard.movement,
                          sequence_order: storyboard.sequence_order || storyboard.shot_number || 1,
                          status: storyboard.status || "draft",
                          character_id: storyboard.character_id || null,
                          dialogue: storyboard.dialogue || "",
                          action: storyboard.action || "",
                          visual_notes: storyboard.visual_notes || "",
                          image_url: storyboard.image_url || "",
                          project_id: storyboard.project_id || "",
                          scene_id: sceneId
                        })
                        // Preserve the current AI service selection
                        // Don't reset selectedAIService here
                        setShowEditForm(true)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={async () => {
                        try {
                          await StoryboardsService.deleteStoryboard(storyboard.id)
                          setStoryboards(prev => prev.filter(sb => sb.id !== storyboard.id))
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
                      }}
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
              <h3 className="text-lg font-medium mb-2">No storyboards for this scene</h3>
              <p className="text-sm">
                {searchTerm || filterStatus !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Get started by creating your first storyboard for this scene"
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

      {/* Shot List Section */}
      <div className="mt-12">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Shot List</CardTitle>
                <CardDescription>
                  Break down this scene into individual shots with detailed technical specifications
                </CardDescription>
              </div>
              {shots && shots.length > 0 && (
                <Button
                  onClick={handleCreateAllStoryboards}
                  disabled={isCreatingAllStoryboards}
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg"
                >
                  {isCreatingAllStoryboards ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating Storyboards...
                    </>
                  ) : (
                    <>
                      <Film className="h-5 w-5 mr-2" />
                      Create All Storyboards ({shots.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {shots && shots.length > 0 && (
              <div className="mb-6 flex justify-center">
                <Button
                  onClick={handleCreateAllStoryboards}
                  disabled={isCreatingAllStoryboards}
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg w-full max-w-md"
                >
                  {isCreatingAllStoryboards ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating {shots.length} Storyboards...
                    </>
                  ) : (
                    <>
                      <Film className="h-5 w-5 mr-2" />
                      Convert All {shots.length} Shots to Storyboards
                    </>
                  )}
                </Button>
              </div>
            )}
            <ShotListComponent
              sceneId={sceneId}
              projectId={sceneInfo?.project_id}
              showCreateStoryboardButton={true}
              onShotsChange={(loadedShots) => {
                setShots(loadedShots)
              }}
              onCreateStoryboard={async (shot) => {
                const result = await createStoryboardFromShot(shot)
                
                if (result.success) {
                  // Show appropriate message based on whether we preserved the shot number
                  const shotNumberMessage = result.shotNumber === result.preferredShotNumber
                    ? `Storyboard created from shot ${shot.shot_number} (preserved shot number).`
                    : `Storyboard created from shot ${shot.shot_number} (assigned shot number ${result.shotNumber} - ${result.preferredShotNumber} was taken).`
                  
                  toast({
                    title: "Storyboard Created!",
                    description: shotNumberMessage,
                  })
                } else {
                  toast({
                    title: "Error",
                    description: result.error || 'Failed to create storyboard from shot list.',
                    variant: "destructive",
                  })
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
  
  // Debug logging after render
  console.log("🎬 Component render completed successfully!")
}
