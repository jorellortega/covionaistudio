"use client"

import { useState, useEffect, useRef, useMemo, type ChangeEvent } from "react"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AssetService, type Asset } from "@/lib/asset-service"
import {
  buildLinkedAssetGroups,
  getProjectAssetSourceLabel,
  referenceUrlToFile,
} from "@/lib/project-image-linking"
import {
  displayModelSupportsReferenceImage,
  mapDisplayModelToService,
  migrateGPTImageDisplayLabel,
  normalizeDisplayModelToApiId,
} from "@/lib/image-model-utils"
import { Plus, Search, Filter, Image as ImageIcon, FileText, Sparkles, Edit, Trash2, Eye, Download, CheckCircle, ArrowLeft, Film, Clock, RefreshCw, Loader2, Play, Edit3, MessageSquare, Copy, Calendar, User, ChevronDown, ChevronLeft, ChevronRight, Link2, Wand2, Upload, X, RectangleHorizontal, Zap, Video } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StoryboardsService, Storyboard, CreateStoryboardData } from "@/lib/storyboards-service"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { SavedPromptsService } from "@/lib/saved-prompts-service"
import { PreferencesService } from "@/lib/preferences-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { AvatarImagesService, type AvatarImageRecord } from "@/lib/avatar-images-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { StoryObjectsService, type StoryObject } from "@/lib/story-objects-service"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"
import { SceneViewSwitcher } from "@/components/scene-view-switcher"
import { SceneSyncControls } from "@/components/scene-sync-controls"
import { StoryboardShotNumberPopover } from "@/components/storyboard-shot-number-popover"
import { StoryboardShotPositionEditor } from "@/components/storyboard-shot-position-editor"
import { ImageSizeBadge } from "@/components/image-size-badge"
import { LazyShotImage } from "@/components/lazy-shot-image"
import { ContentViolationDialog } from "@/components/content-violation-dialog"
import { isContentPolicyError, isContentBlockedResponse } from "@/lib/content-policy-utils"
import { StoryboardShotImages, type StoryboardImage } from "@/components/storyboard-shot-images"
import { SCENE_SYNC_APPLIED_EVENT } from "@/lib/scene-shot-sync"
import { formatShotTypeLabel, formatStoryboardSaveError, SHOT_TYPE_OPTIONS } from "@/lib/shot-options"
import { sortStoryboardRows, computeInsertPlacementBetween, shotOrderValue, storyboardPlacementForInsert, displayShotNumber } from "@/lib/shot-list-order"
import { AssignmentBadgePicker } from "@/components/assignment-badge-picker"
import { ShotCameraAngleSelect, ShotMovementSelect } from "@/components/shot-field-selects"
import {
  StoryboardShotReferencePicker,
  type StoryboardShotReference,
} from "@/components/storyboard-shot-reference-picker"
import {
  StoryboardSceneShotImagePicker,
  type SelectedSceneShotImage,
} from "@/components/storyboard-scene-shot-image-picker"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  buildStoryboardAssignmentPatch,
  getStoryboardCharacterIds,
  getStoryboardLocationIds,
  getStoryboardObjectIds,
} from "@/lib/storyboard-assignments"
import {
  buildQuickShotImagePrompt,
  collectStoryboardReferenceSources,
  enrichPromptWithAssignments,
  getStoryboardAssignmentContext,
  loadStoryboardReferenceFiles,
  storyboardReferenceImageLimit,
  summarizeStoryboardReferenceCoverage,
  summarizeObjectReferenceCoverage,
  buildEntityReferenceMapping,
  normalizeReferenceUrl,
  SINGLE_FRAME_STORYBOARD_INSTRUCTION,
  urlsToReferenceFiles,
  type StoryboardReferenceLoadFailure,
} from "@/lib/storyboard-image-generation"
import {
  debugStoryboardImage,
  formatStoryboardImageDebug,
  getLastStoryboardImageDebug,
  pushStoryboardImageTrace,
  traceAsyncStep,
} from "@/lib/storyboard-image-debug"
import { StoryboardReferenceIssues } from "@/components/storyboard-reference-issues"
import { StoryboardLayoutReferenceControl } from "@/components/storyboard-layout-reference"
import {
  buildStoryboardLayoutMetadataPatch,
  enrichPromptWithLayoutReference,
  getStoryboardLayoutReference,
  type StoryboardLayoutReference,
} from "@/lib/storyboard-layout-reference"
import { parseScriptSelection, getStoryboardDialogueText } from "@/lib/script-selection"

const MAX_LINKED_REFERENCE_IMAGES = 5
const IMAGE_GENERATION_FETCH_TIMEOUT_MS = 240_000

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = IMAGE_GENERATION_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

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

  // Card outline matching the status dropdown dots. Draft keeps the default cinema-card border.
  const getStatusCardBorderStyle = (status: string) => {
    switch (status) {
      case 'in-progress':
        return "!border-2 !border-yellow-500/80"
      case 'review':
        return "!border-2 !border-orange-500/80"
      case 'approved':
        return "!border-2 !border-green-500/80"
      case 'rejected':
        return "!border-2 !border-red-500/80"
      case 'completed':
        return "!border-2 !border-blue-500/80"
      default:
        return ""
    }
  }

  const getStatusJumperStyle = (status: string) => {
    switch (status) {
      case 'in-progress':
        return "text-yellow-500 border-yellow-500/50"
      case 'review':
        return "text-orange-500 border-orange-500/50"
      case 'approved':
        return "text-green-500 border-green-500/50"
      case 'rejected':
        return "text-red-500 border-red-500/50"
      case 'completed':
        return "text-blue-500 border-blue-500/50"
      default:
        return "text-muted-foreground border-border"
    }
  }

  const scrollToShot = (storyboardId: string) => {
    const el = document.getElementById(`storyboard-shot-${storyboardId}`)
    if (!el) return
    const headerOffset = 96
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" })
    setJumpedShotId(storyboardId)
    if (jumpTimeoutRef.current) window.clearTimeout(jumpTimeoutRef.current)
    jumpTimeoutRef.current = window.setTimeout(() => {
      setJumpedShotId((current) => (current === storyboardId ? null : current))
      jumpTimeoutRef.current = null
    }, 1400)
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

  const mapModelToService = (model: string) => mapDisplayModelToService(model)
  // State variables
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [sceneScript, setSceneScript] = useState<string>("")
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null)
  const sceneNumberForSync = useMemo(() => {
    if (sceneInfo?.scene_number) return sceneInfo.scene_number
    const raw = sceneInfo?.metadata?.sceneNumber
    if (raw == null) return 1
    const parsed = typeof raw === 'string' ? parseInt(raw, 10) : raw
    return Number.isNaN(parsed) ? 1 : parsed
  }, [sceneInfo])
  
  // Pagination state for scene script
  const LINES_PER_PAGE = 55
  const [scriptPages, setScriptPages] = useState<string[]>([])
  const [currentScriptPage, setCurrentScriptPage] = useState(1)
  const [totalScriptPages, setTotalScriptPages] = useState(1)
  const [showSceneScript, setShowSceneScript] = useState(false) // Default to hidden
  const [allScenes, setAllScenes] = useState<SceneWithMetadata[]>([])
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(-1)
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [storyObjects, setStoryObjects] = useState<StoryObject[]>([])
  const [isLoadingStoryObjects, setIsLoadingStoryObjects] = useState(false)

  const sceneProjectId = useMemo(() => {
    if (sceneInfo?.project_id) return sceneInfo.project_id
    const fromShot = storyboards.find((sb) => sb.project_id)?.project_id
    return fromShot || undefined
  }, [sceneInfo?.project_id, storyboards])

  const [showCreateForm, setShowCreateForm] = useState(false)
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
    character_id: null,
    location_id: null
  })
  
  // Loading states
  const [isLoadingScene, setIsLoadingScene] = useState(true)
  const [isLoadingStoryboards, setIsLoadingStoryboards] = useState(true)
  const [showClearStoryboardsConfirm, setShowClearStoryboardsConfirm] = useState(false)
  const [isClearingStoryboards, setIsClearingStoryboards] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingStoryboard, setEditingStoryboard] = useState<Storyboard | null>(null)
  const [formCharacterIds, setFormCharacterIds] = useState<string[]>([])
  const [formLocationIds, setFormLocationIds] = useState<string[]>([])
  const [formObjectIds, setFormObjectIds] = useState<string[]>([])
  const [updatingAssignmentStoryboardId, setUpdatingAssignmentStoryboardId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [jumpedShotId, setJumpedShotId] = useState<string | null>(null)
  const jumpTimeoutRef = useRef<number | null>(null)
  
  // AI generation state
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingText, setIsGeneratingText] = useState(false)
  const [selectedAIService, setSelectedAIService] = useState("dalle")
  const [aiImagePrompt, setAiImagePrompt] = useState("")
  const [aiImagePromptFull, setAiImagePromptFull] = useState("") // Store the actual full prompt text
  const [selectedAiImagePromptId, setSelectedAiImagePromptId] = useState("")
  const [isGeneratingShotImage, setIsGeneratingShotImage] = useState(false)
  const [quickGeneratingShotIds, setQuickGeneratingShotIds] = useState<Set<string>>(() => new Set())
  const [quickInsertingKey, setQuickInsertingKey] = useState<string | null>(null)
  const [regeneratingLandscapeId, setRegeneratingLandscapeId] = useState<string | null>(null)
  const [storyboardImages, setStoryboardImages] = useState<Map<string, StoryboardImage[]>>(new Map())
  const [referenceIssuesByStoryboardId, setReferenceIssuesByStoryboardId] = useState<
    Map<string, StoryboardReferenceLoadFailure[]>
  >(() => new Map())
  const [contentBlockedDialog, setContentBlockedDialog] = useState<{
    prompt: string
    storyboardId: string
    options?: {
      quick?: boolean
      includeCharacterDetails?: boolean
      includeMasterPrompt?: boolean
    }
  } | null>(null)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
  const [fullImageViewerOpen, setFullImageViewerOpen] = useState(false)
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null)
  const [fullImageTitle, setFullImageTitle] = useState("")

  const openFullImageViewer = (storyboard: Storyboard) => {
    if (!storyboard.image_url) return
    setFullImageUrl(storyboard.image_url)
    setFullImageTitle(storyboard.title || `Shot ${storyboard.shot_number}`)
    setFullImageViewerOpen(true)
  }
  const [userProfile, setUserProfile] = useState<any>(null)
  const [useExactPrompt, setUseExactPrompt] = useState(true)
  const [includeCharacterDetails, setIncludeCharacterDetails] = useState(false)
  const [includeMasterPrompt, setIncludeMasterPrompt] = useState(false)
  const [savedPrompts, setSavedPrompts] = useState<any[]>([])
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false)
  const [hidePromptText, setHidePromptText] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false)
  const [projectImageAssets, setProjectImageAssets] = useState<Asset[]>([])
  const [projectAvatarImages, setProjectAvatarImages] = useState<AvatarImageRecord[]>([])
  const [isLoadingProjectAssets, setIsLoadingProjectAssets] = useState(false)
  const [linkImageDialogOpen, setLinkImageDialogOpen] = useState(false)
  const [linkingStoryboard, setLinkingStoryboard] = useState<Storyboard | null>(null)
  const [selectedLinkAssetId, setSelectedLinkAssetId] = useState<string | null>(null)
  const [selectedLinkShotImage, setSelectedLinkShotImage] = useState<SelectedSceneShotImage | null>(
    null,
  )
  const [linkImageSource, setLinkImageSource] = useState<"project" | "scene">("scene")
  const [linkImageSearch, setLinkImageSearch] = useState("")
  const [isLinkingImage, setIsLinkingImage] = useState(false)

  // Reference-based image edit (secondary edit — opens in dialog)
  const [referenceEditDialogOpen, setReferenceEditDialogOpen] = useState(false)
  const [referenceEditStoryboard, setReferenceEditStoryboard] = useState<Storyboard | null>(null)
  const [inlineCustomShotPrompt, setInlineCustomShotPrompt] = useState("")
  const [selectedInlineEditPromptId, setSelectedInlineEditPromptId] = useState("")
  const [inlineShotReferenceFile, setInlineShotReferenceFile] = useState<File | null>(null)
  const [inlineShotReferencePreview, setInlineShotReferencePreview] = useState<string | null>(null)
  const [inlineStyleLinkAssetIds, setInlineStyleLinkAssetIds] = useState<string[]>([])
  const [inlineStoryboardShotRefs, setInlineStoryboardShotRefs] = useState<StoryboardShotReference[]>(
    [],
  )
  const [referenceEditingShotIds, setReferenceEditingShotIds] = useState<Set<string>>(() => new Set())
  const [referenceEditProgressByShotId, setReferenceEditProgressByShotId] = useState<
    Map<string, string>
  >(() => new Map())
  const referenceEditDialogStoryboardIdRef = useRef<string | null>(null)
  
  // Script state
  const [isLoadingScript, setIsLoadingScript] = useState(false)
  
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
      
      // Get the current project ID from scene info or loaded storyboards
      const currentProjectId = sceneProjectId
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
      // Note: loadSavedPrompts() will be called when sceneInfo loads with project_id
      
      // Load user preferences
      loadUserPreferences()
    }
  }, [ready, userId, sceneId])

  useEffect(() => {
    if (!sceneId) return
    const reload = (event: Event) => {
      const detail = (event as CustomEvent<{ sceneId?: string }>).detail
      if (!detail?.sceneId || detail.sceneId !== sceneId) return
      void fetchStoryboards()
    }
    window.addEventListener(SCENE_SYNC_APPLIED_EVENT, reload)
    return () => window.removeEventListener(SCENE_SYNC_APPLIED_EVENT, reload)
  }, [sceneId])

  // Fetch script after sceneInfo is loaded (to get screenplay_content)
  useEffect(() => {
    if (sceneInfo && ready && userId) {
      fetchSceneScript()
    }
  }, [sceneInfo, ready, userId])

  // Calculate pages from scene script
  useEffect(() => {
    if (!sceneScript) {
      setScriptPages([])
      setTotalScriptPages(1)
      setCurrentScriptPage(1)
      return
    }

    const lines = sceneScript.split('\n')
    const pageCount = Math.ceil(lines.length / LINES_PER_PAGE)
    setTotalScriptPages(pageCount)

    // Split script into pages
    const pageArray: string[] = []
    for (let i = 0; i < pageCount; i++) {
      const startLine = i * LINES_PER_PAGE
      const endLine = Math.min(startLine + LINES_PER_PAGE, lines.length)
      const pageContent = lines.slice(startLine, endLine).join('\n')
      pageArray.push(pageContent)
    }

    setScriptPages(pageArray)
    // Reset to page 1 when script changes
    setCurrentScriptPage(1)
  }, [sceneScript])

  // Get current page content
  const getCurrentPageScript = () => {
    return scriptPages[currentScriptPage - 1] || ""
  }

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

  // Reload prompts when project is resolved
  useEffect(() => {
    if (sceneProjectId && userId) {
      console.log("🎬 Scene project resolved, reloading prompts...")
      loadSavedPrompts()
    }
  }, [sceneProjectId, userId])

  // Load characters when project is resolved
  useEffect(() => {
    const loadCharacters = async () => {
      if (!sceneProjectId || !ready || !userId) return
      
      setIsLoadingCharacters(true)
      try {
        const chars = await CharactersService.getCharacters(sceneProjectId)
        setCharacters(chars)
        console.log("🎬 Loaded characters for storyboards:", chars)
      } catch (error) {
        console.error("Error loading characters:", error)
      } finally {
        setIsLoadingCharacters(false)
      }
    }
    
    loadCharacters()
  }, [sceneProjectId, ready, userId])

  // Load locations when project is resolved
  useEffect(() => {
    const loadLocations = async () => {
      if (!sceneProjectId || !ready || !userId) return
      
      setIsLoadingLocations(true)
      try {
        const locs = await LocationsService.getLocations(sceneProjectId)
        setLocations(locs)
        console.log("🎬 Loaded locations for storyboards:", locs)
      } catch (error) {
        console.error("Error loading locations:", error)
      } finally {
        setIsLoadingLocations(false)
      }
    }
    
    loadLocations()
  }, [sceneProjectId, ready, userId])

  // Load story objects when project is resolved
  useEffect(() => {
    const loadStoryObjects = async () => {
      if (!sceneProjectId || !ready || !userId) return

      setIsLoadingStoryObjects(true)
      try {
        const objects = await StoryObjectsService.getStoryObjects(sceneProjectId)
        setStoryObjects(objects)
        console.log("🎬 Loaded story objects for storyboards:", objects)
      } catch (error) {
        console.error("Error loading story objects:", error)
      } finally {
        setIsLoadingStoryObjects(false)
      }
    }

    loadStoryObjects()
  }, [sceneProjectId, ready, userId])

  // Load project image assets for linking to shots
  useEffect(() => {
    const loadProjectAssets = async () => {
      if (!sceneProjectId || !ready || !userId) {
        setProjectImageAssets([])
        return
      }
      setIsLoadingProjectAssets(true)
      try {
        const assets = await AssetService.getAssetsForProject(sceneProjectId)
        setProjectImageAssets(
          assets.filter((a) => a.content_type === "image" && a.content_url),
        )
      } catch (error) {
        console.error("Error loading project image assets:", error)
        setProjectImageAssets([])
      } finally {
        setIsLoadingProjectAssets(false)
      }
    }
    loadProjectAssets()
  }, [sceneProjectId, ready, userId])

  // Load avatar studio images for reference linking
  useEffect(() => {
    const loadAvatarImages = async () => {
      if (!sceneProjectId || !ready || !userId) {
        setProjectAvatarImages([])
        return
      }
      try {
        const images = await AvatarImagesService.listImagesForProject(sceneProjectId)
        setProjectAvatarImages(images.filter((img) => img.image_url))
      } catch (error) {
        console.error("Error loading avatar images:", error)
        setProjectAvatarImages([])
      }
    }
    void loadAvatarImages()
  }, [sceneProjectId, ready, userId])

  const avatarImageAssets = useMemo(
    () =>
      projectAvatarImages.map(
        (row) =>
          ({
            id: `avatar-${row.id}`,
            user_id: row.user_id,
            project_id: row.project_id,
            character_id: row.character_id ?? undefined,
            title: `${row.angle_label} avatar`,
            content_type: "image",
            content_url: row.image_url,
            prompt: row.prompt ?? undefined,
            version: 1,
            is_latest_version: true,
            metadata: {
              type: "avatar",
              avatar_angle: row.angle_id,
              avatar_source: row.source,
            },
            created_at: row.created_at,
            updated_at: row.updated_at,
          }) satisfies Asset,
      ),
    [projectAvatarImages],
  )

  const linkableImageAssets = useMemo(
    () => [...projectImageAssets, ...avatarImageAssets],
    [projectImageAssets, avatarImageAssets],
  )

  const characterImageAssets = useMemo(
    () => projectImageAssets.filter((a) => a.character_id && a.content_url),
    [projectImageAssets],
  )

  const objectImageAssets = useMemo(
    () => projectImageAssets.filter((a) => a.story_object_id && a.content_url),
    [projectImageAssets],
  )

  const linkedProjectImageGroups = useMemo(() => {
    const groups = buildLinkedAssetGroups(linkableImageAssets, locations, characters)
    const avatarOnly = avatarImageAssets.filter(
      (asset) => !groups.some((group) => group.assets.some((a) => a.id === asset.id)),
    )
    if (avatarOnly.length > 0) {
      groups.unshift({
        label: "Avatar Studio",
        assets: avatarOnly,
      })
    }
    return groups
  }, [linkableImageAssets, avatarImageAssets, locations, characters])

  const filteredLinkImageGroups = useMemo(() => {
    const term = linkImageSearch.trim().toLowerCase()
    if (!term) return linkedProjectImageGroups
    return linkedProjectImageGroups
      .map((group) => ({
        ...group,
        assets: group.assets.filter((asset) => {
          const label = getProjectAssetSourceLabel(asset, locations, characters)
          return (
            asset.title.toLowerCase().includes(term) ||
            label.toLowerCase().includes(term)
          )
        }),
      }))
      .filter((group) => group.assets.length > 0)
  }, [linkedProjectImageGroups, linkImageSearch, locations, characters])

  const orderedStoryboards = useMemo(() => sortStoryboardRows(storyboards), [storyboards])

  const fetchStoryboardImagesApi = async (input: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession()
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`)
    }
    return fetch(input, { ...init, headers, credentials: "include" })
  }

  const loadStoryboardImages = async (storyboardId: string): Promise<StoryboardImage[]> => {
    try {
      const query = new URLSearchParams({ storyboardId })
      if (userId) query.set("userId", userId)
      const response = await fetchStoryboardImagesApi(`/api/storyboard-images?${query.toString()}`)
      const result = await response.json()
      if (response.ok && result.success) {
        const images = (result.data || []) as StoryboardImage[]
        setStoryboardImages((prev) => {
          const next = new Map(prev)
          next.set(storyboardId, images)
          return next
        })
        return images
      }
    } catch (error) {
      console.error("Error loading storyboard images:", error)
    }
    return []
  }

  const loadAllStoryboardImages = async (storyboardIds: string[]) => {
    await Promise.all(storyboardIds.map((id) => loadStoryboardImages(id)))
  }

  const saveStoryboardImage = async (
    storyboardId: string,
    imageUrl: string,
    options?: {
      isDefault?: boolean
      generationPrompt?: string
      generationModel?: string
      imageName?: string
    },
  ) => {
    const isDefault = options?.isDefault ?? true
    debugStoryboardImage("save-start", {
      storyboardId,
      imageUrl: imageUrl.slice(0, 80),
      isDefault,
      generationModel: options?.generationModel,
    })

    const response = await fetchStoryboardImagesApi("/api/storyboard-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyboardId,
        imageUrl,
        isDefault,
        userId,
        generationPrompt: options?.generationPrompt,
        generationModel: options?.generationModel,
        imageName: options?.imageName,
      }),
    })
    const result = await response.json()
    if (!response.ok || !result.success) {
      debugStoryboardImage("error", {
        step: "save-storyboard-image",
        status: response.status,
        error: result.error || "Failed to save storyboard image",
      })
      throw new Error(result.error || "Failed to save storyboard image")
    }

    if (isDefault) {
      const updatedStoryboard = await StoryboardsService.updateStoryboardImage(storyboardId, imageUrl)
      setStoryboards((prev) =>
        prev.map((sb) => (sb.id === storyboardId ? updatedStoryboard : sb)),
      )
    }

    await loadStoryboardImages(storyboardId)
    debugStoryboardImage("save-complete", {
      storyboardId,
      imageId: result.data?.id,
      isDefault,
    })
    return result.data as StoryboardImage
  }

  const handleSelectStoryboardImage = async (image: StoryboardImage) => {
    try {
      const response = await fetchStoryboardImagesApi("/api/storyboard-images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: image.id, isDefault: true, userId }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to select image")
      }

      const updatedStoryboard = await StoryboardsService.updateStoryboardImage(
        image.storyboard_id,
        image.image_url,
      )
      setStoryboards((prev) =>
        prev.map((sb) => (sb.id === image.storyboard_id ? updatedStoryboard : sb)),
      )
      await loadStoryboardImages(image.storyboard_id)
    } catch (error) {
      toast({
        title: "Could not select image",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteStoryboardImage = async (image: StoryboardImage) => {
    setDeletingImageId(image.id)
    try {
      const deleteQuery = new URLSearchParams({ imageId: image.id })
      if (userId) deleteQuery.set("userId", userId)
      const response = await fetchStoryboardImagesApi(
        `/api/storyboard-images?${deleteQuery.toString()}`,
        {
        method: "DELETE",
        },
      )
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete image")
      }

      const refreshed = await loadStoryboardImages(image.storyboard_id)
      const nextDefault = refreshed.find((img) => img.is_default) || refreshed[0]

      setStoryboards((prev) =>
        prev.map((sb) => {
          if (sb.id !== image.storyboard_id) return sb
          return {
            ...sb,
            image_url: nextDefault?.image_url || undefined,
          }
        }),
      )

      toast({
        title: "Image deleted",
        description: nextDefault
          ? "Another image is now shown for this shot."
          : "This shot no longer has an image.",
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete image.",
        variant: "destructive",
      })
    } finally {
      setDeletingImageId(null)
    }
  }

  const openLinkImageDialog = (storyboard: Storyboard) => {
    setLinkingStoryboard(storyboard)
    setSelectedLinkAssetId(null)
    setSelectedLinkShotImage(null)
    setLinkImageSource("scene")
    setLinkImageSearch("")
    setLinkImageDialogOpen(true)
  }

  const handleLinkExistingImageToShot = async () => {
    if (!linkingStoryboard) return

    if (linkImageSource === "scene") {
      if (!selectedLinkShotImage?.imageUrl) return
      setIsLinkingImage(true)
      try {
        await saveStoryboardImage(linkingStoryboard.id, selectedLinkShotImage.imageUrl, {
          imageName: selectedLinkShotImage.label,
        })
        setLinkImageDialogOpen(false)
        setLinkingStoryboard(null)
        setSelectedLinkShotImage(null)
        toast({
          title: "Image inserted into shot",
          description: `Shot ${linkingStoryboard.shot_number} now uses ${selectedLinkShotImage.label}.`,
        })
      } catch (error) {
        toast({
          title: "Insert failed",
          description: error instanceof Error ? error.message : "Could not insert image into shot.",
          variant: "destructive",
        })
      } finally {
        setIsLinkingImage(false)
      }
      return
    }

    if (!selectedLinkAssetId) return
    const asset = linkableImageAssets.find((a) => a.id === selectedLinkAssetId)
    if (!asset?.content_url) return

    setIsLinkingImage(true)
    try {
      await saveStoryboardImage(linkingStoryboard.id, asset.content_url, {
        imageName: asset.title,
      })
      setLinkImageDialogOpen(false)
      setLinkingStoryboard(null)
      toast({
        title: "Image linked to shot",
        description: `Shot ${linkingStoryboard.shot_number} now uses your selected project image.`,
      })
    } catch (error) {
      toast({
        title: "Link failed",
        description: error instanceof Error ? error.message : "Could not link image to shot.",
        variant: "destructive",
      })
    } finally {
      setIsLinkingImage(false)
    }
  }

  const getLockedImageModelLabel = () => {
    const imagesSetting = aiSettings.find((s) => s.tab_type === "images")
    if (imagesSetting?.is_locked && imagesSetting.locked_model) {
      return migrateGPTImageDisplayLabel(imagesSetting.locked_model)
    }
    return null
  }

  const normalizeLockedImageModel = (
    displayName: string,
    options?: { withReferenceImage?: boolean },
  ): string => {
    const lower = displayName.toLowerCase()
    if (lower.includes("runway")) {
      return options?.withReferenceImage ? "gen4_image_turbo" : "gen4_image"
    }
    return normalizeDisplayModelToApiId(displayName)
  }

  const getLockedImageConfig = (options?: { withReferenceImage?: boolean }) => {
    const imagesSetting = aiSettings.find((s) => s.tab_type === "images")
    if (!imagesSetting?.is_locked || !imagesSetting.locked_model) {
      return null
    }
    const lockedModel = imagesSetting.locked_model
    return {
      lockedModel,
      service: mapDisplayModelToService(lockedModel),
      apiModel: normalizeLockedImageModel(lockedModel, options),
      supportsReference: displayModelSupportsReferenceImage(lockedModel),
    }
  }

  const requireLockedImageConfig = (options?: { withReferenceImage?: boolean }) => {
    const config = getLockedImageConfig(options)
    if (!config) {
      throw new Error("Please lock an image model in AI Settings first.")
    }
    return config
  }

  const requestLockedImageGeneration = async (
    prompt: string,
    config: ReturnType<typeof requireLockedImageConfig>,
    options?: {
      referenceFile?: File
      referenceImageUrl?: string
      styleReferenceFiles?: File[]
      styleReferenceUrls?: string[]
      width?: number
      height?: number
    },
  ) => {
    return requestImageGenerationWithReferences(prompt, {
      service: config.service,
      model: config.apiModel,
      apiKey: "configured",
      referenceFile: options?.referenceFile,
      referenceImageUrl: options?.referenceImageUrl,
      styleReferenceFiles: options?.styleReferenceFiles,
      styleReferenceUrls: options?.styleReferenceUrls,
      width: options?.width,
      height: options?.height,
      supportsReference: config.supportsReference,
    })
  }

  const requestImageGenerationWithReferences = async (
    prompt: string,
    options: {
      service: string
      model?: string
      apiKey: string
      referenceFile?: File
      referenceImageUrl?: string
      styleReferenceFiles?: File[]
      styleReferenceUrls?: string[]
      width?: number
      height?: number
      supportsReference?: boolean
    },
  ) => {
    const width = options.width ?? (options.service === "runway" ? 1280 : 1536)
    const height = options.height ?? (options.service === "runway" ? 720 : 1024)
    const hasUrlReference = Boolean(options.referenceImageUrl)
    const hasFileReference = Boolean(options.referenceFile)
    const canUseReference =
      Boolean(options.supportsReference) && (hasUrlReference || hasFileReference)

    debugStoryboardImage("request-sent", {
      service: options.service,
      model: options.model,
      width,
      height,
      canUseReference,
      referenceMode: hasUrlReference ? "url" : hasFileReference ? "file" : "none",
      referenceFileSize: options.referenceFile?.size,
      styleReferenceCount:
        (options.styleReferenceUrls?.length ?? 0) + (options.styleReferenceFiles?.length ?? 0),
      promptLength: prompt.length,
      apiKeyMode: options.apiKey === "configured" ? "configured" : "profile",
    })

    if (canUseReference && hasUrlReference) {
      return fetchWithTimeout("/api/ai/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          service: options.service,
          apiKey: options.apiKey,
          userId,
          model: options.model,
          width,
          height,
          autoSaveToBucket: true,
          referenceImageUrl: options.referenceImageUrl,
          styleReferenceUrls:
            options.styleReferenceUrls && options.styleReferenceUrls.length > 0
              ? options.styleReferenceUrls
              : undefined,
          seed:
            options.service === "runway"
              ? Math.floor(Math.random() * 2147483647)
              : undefined,
        }),
      })
    }

    if (canUseReference && options.referenceFile) {
      const formData = new FormData()
      formData.append("prompt", prompt)
      if (options.model) formData.append("model", options.model)
      formData.append("service", options.service)
      formData.append("width", String(width))
      formData.append("height", String(height))
      formData.append("apiKey", options.apiKey)
      formData.append("userId", userId!)
      formData.append("file", options.referenceFile)
      formData.append("autoSaveToBucket", "true")
      for (const styleFile of options.styleReferenceFiles ?? []) {
        formData.append("styleFiles", styleFile)
      }
      if (options.service === "runway") {
        formData.append("seed", String(Math.floor(Math.random() * 2147483647)))
      }

      return fetchWithTimeout("/api/ai/generate-image", {
        method: "POST",
        body: formData,
      })
    }

    return fetchWithTimeout("/api/ai/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        service: options.service,
        apiKey: options.apiKey,
        userId,
        model: options.model,
        width,
        height,
        autoSaveToBucket: true,
      }),
    })
  }

  const getImageGenerationErrorMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof Error)) return fallback
    if (error.message.includes("API key")) {
      return `${error.message} Add the API key for your locked image model in Settings → AI Settings.`
    }
    return error.message
  }

  const findStyleLinkAsset = (assetId: string) =>
    linkableImageAssets.find((a) => a.id === assetId)

  const getAvatarImagesForCharacter = (characterId?: string | null) => {
    if (!characterId) return []
    return projectAvatarImages.filter(
      (img) => img.character_id === characterId && img.image_url,
    )
  }

  const getAvatarLinkAssetIds = (characterId?: string | null) =>
    getAvatarImagesForCharacter(characterId)
      .map((img) => `avatar-${img.id}`)
      .slice(0, MAX_LINKED_REFERENCE_IMAGES)

  const buildAvatarReferenceFiles = async (characterId?: string | null) => {
    const images = getAvatarImagesForCharacter(characterId).slice(
      0,
      MAX_LINKED_REFERENCE_IMAGES,
    )
    return Promise.all(
      images.map((img, index) =>
        referenceUrlToFile(img.image_url, `avatar-ref-${img.angle_id}-${index}.png`),
      ),
    )
  }

  const resolveStoryboardForGeneration = (storyboardId: string) => {
    const storyboard = storyboards.find((sb) => sb.id === storyboardId)
    if (!storyboard) return null
    if (editingStoryboard?.id !== storyboardId) return storyboard
    const characterIds =
      formCharacterIds.length > 0
        ? formCharacterIds
        : getStoryboardCharacterIds(storyboard)
    const locationIds =
      formLocationIds.length > 0 ? formLocationIds : getStoryboardLocationIds(storyboard)
    const objectIds =
      formObjectIds.length > 0 ? formObjectIds : getStoryboardObjectIds(storyboard)
    return {
      ...storyboard,
      character_id: characterIds[0] ?? formData.character_id ?? storyboard.character_id,
      location_id: locationIds[0] ?? formData.location_id ?? storyboard.location_id,
      story_object_id: objectIds[0] ?? formData.story_object_id ?? storyboard.story_object_id,
      metadata: {
        ...(storyboard.metadata || {}),
        character_ids: characterIds,
        location_ids: locationIds,
        object_ids: objectIds,
      },
      title: formData.title || storyboard.title,
      description: formData.description || storyboard.description,
      action: formData.action || storyboard.action,
      shot_type: formData.shot_type || storyboard.shot_type,
      camera_angle: formData.camera_angle || storyboard.camera_angle,
      movement: formData.movement || storyboard.movement,
      dialogue: formData.dialogue || storyboard.dialogue,
      visual_notes: formData.visual_notes || storyboard.visual_notes,
    }
  }

  const buildStoryboardEditPrompt = (userDirection: string, storyboard: Storyboard) => {
    let prompt = userDirection.trim()
    if (storyboard.title) {
      prompt += ` Shot: ${storyboard.title}.`
    }
    prompt +=
      " Edit the attached reference image only. Keep the same composition, subject, framing, camera angle, and environment — change only what is described above. Do not add new elements."
    return prompt.slice(0, 990)
  }

  const buildStoryboardCreatePrompt = (userDirection: string, storyboard: Storyboard) => {
    const assignmentContext = getStoryboardAssignmentContext(storyboard, characters, locations, storyObjects)
    const shotContext = buildQuickShotImagePrompt(storyboard, {
      characterNames: assignmentContext.characterNames,
      locationNames: assignmentContext.locationNames,
      objectNames: assignmentContext.objectNames,
    })
    const parts = [userDirection.trim(), shotContext].filter(Boolean)
    let prompt = parts.join(". ")
    if (!/storyboard/i.test(prompt)) {
      prompt += ", cinematic storyboard style"
    }
    return prompt.slice(0, 990)
  }

  const hasPrimaryReferenceForEdit = (
    storyboard: Storyboard,
    uploadedReference?: File | null,
  ) => Boolean(uploadedReference || storyboard.image_url)

  const handleInlineShotReferenceSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (inlineShotReferencePreview) {
      URL.revokeObjectURL(inlineShotReferencePreview)
    }
    setInlineShotReferenceFile(file)
    setInlineShotReferencePreview(URL.createObjectURL(file))
    event.target.value = ""
  }

  const clearInlineShotReference = () => {
    if (inlineShotReferencePreview) {
      URL.revokeObjectURL(inlineShotReferencePreview)
    }
    setInlineShotReferenceFile(null)
    setInlineShotReferencePreview(null)
  }

  const clearInlineStyleLink = () => {
    setInlineStyleLinkAssetIds([])
    setInlineStoryboardShotRefs([])
  }

  const toggleInlineStyleLinkAsset = (assetId: string) => {
    setInlineStyleLinkAssetIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId)
      }
      if (prev.length + inlineStoryboardShotRefs.length >= MAX_LINKED_REFERENCE_IMAGES) {
        toast({
          title: "Maximum references reached",
          description: `You can link up to ${MAX_LINKED_REFERENCE_IMAGES} images at a time.`,
          variant: "destructive",
        })
        return prev
      }
      return [...prev, assetId]
    })
  }

  const clearInlineReferenceEditState = () => {
    setInlineCustomShotPrompt("")
    setSelectedInlineEditPromptId("")
    clearInlineShotReference()
    clearInlineStyleLink()
  }

  const getStoryboardCharacterMasterPrompt = (storyboard: Storyboard): string | null => {
    for (const characterId of getStoryboardCharacterIds(storyboard)) {
      const master = characters.find((c) => c.id === characterId)?.master_prompt?.trim()
      if (master) return master
    }
    return null
  }

  const hasInlineEditPromptOptions = (storyboard: Storyboard) =>
    savedPrompts.length > 0 || Boolean(getStoryboardCharacterMasterPrompt(storyboard))

  const handleInlineEditPromptSelect = (storyboard: Storyboard, value: string) => {
    if (value === "__none__") {
      setSelectedInlineEditPromptId("")
      return
    }

    if (value === "__character_master__") {
      const master = getStoryboardCharacterMasterPrompt(storyboard)
      if (!master) {
        toast({
          title: "No master prompt",
          description: "Assigned character(s) do not have a master prompt saved yet.",
          variant: "destructive",
        })
        return
      }
      setSelectedInlineEditPromptId(value)
      setInlineCustomShotPrompt(master)
      toast({
        title: "Prompt applied",
        description: "Character master prompt loaded into the edit field.",
      })
      return
    }

    const saved = savedPrompts.find((p) => p.id === value)
    if (!saved) return
    setSelectedInlineEditPromptId(value)
    setInlineCustomShotPrompt(saved.prompt)
    toast({
      title: "Prompt applied",
      description: `Loaded: ${saved.title}`,
    })
  }

  const handleAiImagePromptSelect = (value: string) => {
    if (value === "__none__") {
      setSelectedAiImagePromptId("")
      return
    }

    if (value === "__character_master__") {
      if (!editingStoryboard) return
      const master = getStoryboardCharacterMasterPrompt(editingStoryboard)
      if (!master) {
        toast({
          title: "No master prompt",
          description: "Assigned character(s) do not have a master prompt saved yet.",
          variant: "destructive",
        })
        return
      }
      setSelectedAiImagePromptId(value)
      if (hidePromptText) {
        setAiImagePrompt("Character master prompt")
      } else {
        setAiImagePrompt(master)
      }
      setAiImagePromptFull(master)
      toast({
        title: "Prompt applied",
        description: "Character master prompt loaded into image prompt.",
      })
      return
    }

    const selectedPrompt = savedPrompts.find((p) => p.id === value)
    if (!selectedPrompt) return
    setSelectedAiImagePromptId(value)
    if (hidePromptText) {
      setAiImagePrompt(selectedPrompt.title)
    } else {
      setAiImagePrompt(selectedPrompt.prompt)
    }
    setAiImagePromptFull(selectedPrompt.prompt)
    toast({
      title: "Prompt applied",
      description: `Loaded: ${selectedPrompt.title}`,
    })
  }

  const openReferenceEditDialog = (storyboard: Storyboard) => {
    setReferenceEditStoryboard(storyboard)
    clearInlineReferenceEditState()
    const resolved = resolveStoryboardForGeneration(storyboard.id) ?? storyboard
    const isCreateMode = !hasPrimaryReferenceForEdit(resolved)
    if (isCreateMode) {
      const characterIds = getStoryboardCharacterIds(resolved)
      const avatarAssetIds = characterIds.flatMap((characterId) =>
        getAvatarLinkAssetIds(characterId),
      )
      if (avatarAssetIds.length > 0) {
        setInlineStyleLinkAssetIds(avatarAssetIds.slice(0, MAX_LINKED_REFERENCE_IMAGES))
      }
    }
    setReferenceEditDialogOpen(true)
  }

  const closeReferenceEditDialog = () => {
    setReferenceEditDialogOpen(false)
    setReferenceEditStoryboard(null)
    clearInlineReferenceEditState()
  }

  const closeEditStoryboardDialog = () => {
    setShowEditForm(false)
    setEditingStoryboard(null)
    closeReferenceEditDialog()
    resetForm()
  }

  const openEditStoryboardDialog = (
    storyboard: Storyboard,
    options?: { prefillAiPrompt?: boolean },
  ) => {
    closeReferenceEditDialog()
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
      location_id: storyboard.location_id || null,
      dialogue: storyboard.dialogue || "",
      action: storyboard.action || "",
      visual_notes: storyboard.visual_notes || "",
      image_url: storyboard.image_url || "",
      project_id: storyboard.project_id || "",
      scene_id: sceneId,
    })
    syncFormAssignmentsFromStoryboard(storyboard)
    if (options?.prefillAiPrompt) {
      setAiImagePrompt(buildQuickShotImagePrompt(storyboard))
    }
    setShowEditForm(true)
  }

  const setReferenceEditProgressForShot = (storyboardId: string, progress: string) => {
    setReferenceEditProgressByShotId((prev) => new Map(prev).set(storyboardId, progress))
  }

  const clearReferenceEditProgressForShot = (storyboardId: string) => {
    setReferenceEditProgressByShotId((prev) => {
      const next = new Map(prev)
      next.delete(storyboardId)
      return next
    })
  }

  const startReferenceEditForShot = (storyboardId: string) => {
    setReferenceEditingShotIds((prev) => new Set(prev).add(storyboardId))
  }

  const finishReferenceEditForShot = (storyboardId: string) => {
    setReferenceEditingShotIds((prev) => {
      const next = new Set(prev)
      next.delete(storyboardId)
      return next
    })
    clearReferenceEditProgressForShot(storyboardId)
  }

  useEffect(() => {
    referenceEditDialogStoryboardIdRef.current = referenceEditStoryboard?.id ?? null
  }, [referenceEditStoryboard])

  const handleGenerateStoryboardReferenceEdit = async (storyboardId: string) => {
    debugStoryboardImage("reference-edit-start", { storyboardId })
    pushStoryboardImageTrace(
      "info",
      "Edit Image clicked",
      typeof window !== "undefined" ? window.location.host : "server",
    )

    const direction = inlineCustomShotPrompt.trim()
    const shotReferenceFile = inlineShotReferenceFile
    const styleLinkAssetIds = [...inlineStyleLinkAssetIds]
    const storyboardShotRefs = [...inlineStoryboardShotRefs]
    if (!direction) {
      debugStoryboardImage("validation-failed", {
        reason: "empty-reference-edit-direction",
        storyboardId,
      })
      pushStoryboardImageTrace("error", "Validation failed", "Description is empty")
      toast({
        title: "Description required",
        description: 'Enter what you want, e.g. "wide shot in a rainy alley" or "warmer lighting".',
        variant: "destructive",
      })
      return
    }

    const storyboard = resolveStoryboardForGeneration(storyboardId)
    if (!storyboard || !userId) {
      debugStoryboardImage("validation-failed", {
        reason: !storyboard ? "storyboard-not-found" : "missing-user-id",
        storyboardId,
      })
      pushStoryboardImageTrace(
        "error",
        "Validation failed",
        !storyboard ? "Storyboard not found" : "Missing user session",
      )
      toast({
        title: "Edit failed",
        description: !storyboard
          ? "Could not find this storyboard shot."
          : "Your session is not ready yet. Refresh and try again.",
        variant: "destructive",
      })
      return
    }

    const assignmentContext = getStoryboardAssignmentContext(storyboard, characters, locations, storyObjects)
    const isCreateMode = !hasPrimaryReferenceForEdit(storyboard, shotReferenceFile)
    const lockedConfigPreview = getLockedImageConfig(
      isCreateMode ? undefined : { withReferenceImage: true },
    )

    pushStoryboardImageTrace(
      "info",
      "Config",
      `mode=${isCreateMode ? "create" : "edit"}, model=${lockedConfigPreview?.lockedModel ?? "none"}, supportsRef=${lockedConfigPreview?.supportsReference ?? false}, styleLinks=${inlineStyleLinkAssetIds.length}, storyboardRefs=${inlineStoryboardShotRefs.length}`,
    )

    if (!isCreateMode && !lockedConfigPreview?.supportsReference) {
      pushStoryboardImageTrace(
        "error",
        "Locked model cannot edit from reference",
        lockedConfigPreview?.lockedModel ?? "No locked image model",
      )
      toast({
        title: "Model not supported",
        description:
          "Your locked image model does not support reference editing. Lock GPT Image 2 or Runway ML in AI Settings.",
        variant: "destructive",
      })
      return
    }

    startReferenceEditForShot(storyboardId)
    setReferenceEditProgressForShot(
      storyboardId,
      isCreateMode ? "Loading references..." : "Loading reference image...",
    )
    try {
      const styleReferenceUrls: string[] = []
      const layoutRef = getStoryboardLayoutReference(storyboard)
      for (const assetId of styleLinkAssetIds) {
        const styleAsset = findStyleLinkAsset(assetId)
        if (styleAsset?.content_url) {
          styleReferenceUrls.push(styleAsset.content_url)
          pushStoryboardImageTrace("ok", `Style reference URL ${styleAsset.id}`, styleAsset.content_url.slice(0, 80))
        }
      }
      for (const shotRef of storyboardShotRefs) {
        styleReferenceUrls.push(shotRef.imageUrl)
        pushStoryboardImageTrace(
          "ok",
          `Storyboard shot reference ${shotRef.storyboardId}`,
          shotRef.imageUrl.slice(0, 80),
        )
      }

      const shouldAutoLoadEntityRefs =
        isCreateMode &&
        (assignmentContext.characterIds.length > 0 ||
          assignmentContext.locationIds.length > 0 ||
          assignmentContext.objectIds.length > 0) &&
        (layoutRef.url || styleReferenceUrls.length === 0)

      const entityStyleUrls = shouldAutoLoadEntityRefs
        ? collectStoryboardReferenceSources({
            characterIds: assignmentContext.characterIds,
            locationIds: assignmentContext.locationIds,
            objectIds: assignmentContext.objectIds,
            characters,
            locations,
            storyObjects,
            avatarImages: projectAvatarImages,
            characterAssets: characterImageAssets,
            objectAssets: objectImageAssets,
            maxImages: storyboardReferenceImageLimit(),
            excludeUrls: layoutRef.url ? [layoutRef.url] : [],
          }).map((source) => source.url)
        : []

      if (entityStyleUrls.length > 0) {
        pushStoryboardImageTrace(
          "info",
          "Auto-loading assigned character/location/object references",
          `${entityStyleUrls.length} URL(s)`,
        )
      }

      const linkedStyleUrls = [...styleReferenceUrls, ...entityStyleUrls]

      setReferenceEditProgressForShot(
        storyboardId,
        isCreateMode ? "Generating image..." : "Editing image...",
      )
      const config = isCreateMode
        ? requireLockedImageConfig()
        : requireLockedImageConfig({ withReferenceImage: true })
      let prompt = isCreateMode
        ? buildStoryboardCreatePrompt(direction, storyboard)
        : buildStoryboardEditPrompt(direction, storyboard)

      if (isCreateMode && layoutRef.url) {
        prompt = enrichPromptWithLayoutReference(prompt, {
          layoutLabel: layoutRef.label,
          characterNames: assignmentContext.characterNames,
          layoutMatchesCurrentShot: Boolean(
            layoutRef.url &&
              storyboard.image_url &&
              normalizeReferenceUrl(layoutRef.url) ===
                normalizeReferenceUrl(storyboard.image_url),
          ),
        })
        pushStoryboardImageTrace(
          "info",
          "Using saved layout reference for blocking",
          layoutRef.label ?? layoutRef.url.slice(0, 80),
        )
      }

      pushStoryboardImageTrace(
        "info",
        "AI request prepared",
        `service=${config.service}, model=${config.apiModel}, promptLen=${prompt.length}`,
      )

      let referenceImageUrl: string | undefined
      let referenceFile: File | undefined
      if (config.supportsReference) {
        if (!isCreateMode) {
          if (shotReferenceFile) {
            referenceFile = shotReferenceFile
            pushStoryboardImageTrace(
              "ok",
              "Using uploaded primary reference",
              `${shotReferenceFile.size} bytes`,
            )
          } else if (storyboard.image_url) {
            referenceImageUrl = storyboard.image_url
            pushStoryboardImageTrace("ok", "Using shot image URL as primary reference", referenceImageUrl.slice(0, 80))
          }
        } else if (layoutRef.url) {
          referenceImageUrl = layoutRef.url
          pushStoryboardImageTrace("ok", "Layout reference as primary", referenceImageUrl.slice(0, 80))
        } else if (shotReferenceFile) {
          referenceFile = shotReferenceFile
          pushStoryboardImageTrace(
            "ok",
            "Using uploaded primary reference",
            `${shotReferenceFile.size} bytes`,
          )
        } else if (linkedStyleUrls.length > 0) {
          referenceImageUrl = linkedStyleUrls[0]
          pushStoryboardImageTrace("ok", "Using first linked URL as primary reference")
        }
      }

      if (!isCreateMode && config.supportsReference && !referenceImageUrl && !referenceFile) {
        throw new Error("No reference image available for edit mode")
      }

      const extraStyleReferenceUrls = linkedStyleUrls.filter(
        (url) => url !== referenceImageUrl,
      )

      pushStoryboardImageTrace(
        "info",
        "Calling /api/ai/generate-image",
        referenceImageUrl
          ? `primary=url, extras=${extraStyleReferenceUrls.length}`
          : referenceFile
            ? `primary=file ${referenceFile.size}B, extras=${extraStyleReferenceUrls.length}`
            : "no reference",
      )

      const response = await traceAsyncStep(
        "AI image generation API",
        () =>
          requestLockedImageGeneration(prompt, config, {
            referenceFile,
            referenceImageUrl,
            styleReferenceUrls:
              extraStyleReferenceUrls.length > 0 ? extraStyleReferenceUrls : undefined,
          }),
        { warnOnSlowMs: 30000 },
      )

      const responseText = await traceAsyncStep("Read API response body", () => response.text())
      let result: Record<string, unknown> = {}
      try {
        result = JSON.parse(responseText) as Record<string, unknown>
      } catch {
        pushStoryboardImageTrace(
          "error",
          "API returned non-JSON",
          `status=${response.status}, body=${responseText.slice(0, 200)}`,
        )
        throw new Error(
          response.ok
            ? "Server returned an invalid response"
            : `Server error ${response.status}: ${responseText.slice(0, 200) || "empty body"}`,
        )
      }

      if (!response.ok) {
        const apiError =
          (typeof result.error === "string" && result.error) ||
          "Failed to edit image from reference"
        debugStoryboardImage("error", {
          step: "reference-edit",
          storyboardId,
          status: response.status,
          error: apiError,
        })
        pushStoryboardImageTrace("error", `API HTTP ${response.status}`, apiError)
        throw new Error(apiError)
      }

      debugStoryboardImage("response-received", {
        storyboardId,
        mode: "reference-edit",
        success: result.success,
        hasImageUrl: Boolean(result.imageUrl),
        hasBucketUrl: Boolean(result.bucketUrl),
        error: result.error,
      })

      if (!result.success || !result.imageUrl) {
        const apiError =
          (typeof result.error === "string" && result.error) ||
          "Failed to edit image from reference"
        pushStoryboardImageTrace("error", "API success=false", apiError)
        throw new Error(apiError)
      }

      const imageUrlToUse = String(result.bucketUrl || result.imageUrl)
      pushStoryboardImageTrace("ok", "Image generated", imageUrlToUse.slice(0, 80))

      const existingImages = storyboardImages.get(storyboardId) ?? []
      const hasExisting =
        existingImages.length > 0 || Boolean(storyboard.image_url)

      await traceAsyncStep("Save image to storyboard gallery", () =>
        saveStoryboardImage(storyboardId, imageUrlToUse, {
          isDefault: !hasExisting,
          generationPrompt: prompt,
        }),
      )

      if (editingStoryboard?.id === storyboardId) {
        setFormData((prev) => ({ ...prev, image_url: imageUrlToUse }))
        const refreshed = storyboards.find((sb) => sb.id === storyboardId)
        if (refreshed) {
          setEditingStoryboard({ ...refreshed, image_url: imageUrlToUse })
        }
      }

      if (referenceEditDialogStoryboardIdRef.current === storyboardId) {
        setReferenceEditStoryboard((prev) =>
          prev?.id === storyboardId ? { ...prev, image_url: imageUrlToUse } : prev,
        )
      }

      pushStoryboardImageTrace("ok", "Edit complete")
      toast({
        title: isCreateMode ? "Image created" : "Image edited",
        description: isCreateMode
          ? "Your new shot image was generated and added to the gallery."
          : "A new version was added to this shot's image gallery.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      debugStoryboardImage("error", {
        step: "reference-edit",
        storyboardId,
        message,
      })
      pushStoryboardImageTrace("error", "Edit stopped", message)
      toast({
        title: "Edit failed",
        description: getImageGenerationErrorMessage(
          error,
          "Could not edit the storyboard image.",
        ),
        variant: "destructive",
      })
    } finally {
      finishReferenceEditForShot(storyboardId)
    }
  }

  const renderStoryboardReferenceEdit = (
    storyboard: Storyboard,
    idPrefix: string,
    inDialog = false,
  ) => {
    const isCreateMode = !hasPrimaryReferenceForEdit(storyboard, inlineShotReferenceFile)
    const isEditingThisShot = referenceEditingShotIds.has(storyboard.id)
    const editProgress = referenceEditProgressByShotId.get(storyboard.id)
    const lockedModel = getLockedImageModelLabel()
    const lockedConfig = getLockedImageConfig(
      isCreateMode ? undefined : { withReferenceImage: true },
    )
    const canSubmit =
      Boolean(inlineCustomShotPrompt.trim()) &&
      Boolean(isCreateMode ? getLockedImageConfig() : lockedConfig?.supportsReference)

    return (
    <div
      className={
        inDialog
          ? "space-y-3 min-w-0 w-full overflow-hidden"
          : "border border-violet-500/20 rounded-lg p-4 bg-violet-500/5 space-y-3"
      }
    >
      {!inDialog && (
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-medium">
            {isCreateMode ? "Generate Image" : "Reference Image Edit"}
          </h3>
        </div>
      )}
      {!inDialog && (
      <p className="text-xs text-muted-foreground break-words">
        {isCreateMode
          ? `Create a new shot image with your locked model (${lockedModel || "lock one in AI Settings"}). Describe the scene below — shot details are included automatically.`
          : `Edit using your locked model (${lockedModel || "lock one in AI Settings"}).${
              getLockedImageConfig({ withReferenceImage: true })?.supportsReference
                ? " Only the current shot image is sent unless you manually link extras below."
                : " Your locked model does not support reference editing — use GPT Image 2 or Runway ML."
            }`}
      </p>
      )}
      {isEditingThisShot && editProgress ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {editProgress}
          {inDialog ? (
            <span className="text-muted-foreground/80">
              — you can close this window and keep working
            </span>
          ) : null}
        </p>
      ) : null}
      {hasInlineEditPromptOptions(storyboard) ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-saved-prompt`} className="text-xs sm:text-sm">
            Saved prompt
          </Label>
          <Select
            value={selectedInlineEditPromptId || "__none__"}
            onValueChange={(v) => handleInlineEditPromptSelect(storyboard, v)}
            disabled={isEditingThisShot || isLoadingPrompts}
          >
            <SelectTrigger
              id={`${idPrefix}-saved-prompt`}
              className="bg-input border-border text-xs sm:text-sm"
            >
              <SelectValue
                placeholder={
                  isLoadingPrompts ? "Loading prompts…" : "Apply a saved prompt…"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                {isCreateMode ? "None (custom description)" : "None (custom edit)"}
              </SelectItem>
              {getStoryboardCharacterMasterPrompt(storyboard) ? (
                <SelectItem value="__character_master__">Character master prompt</SelectItem>
              ) : null}
              {savedPrompts.map((prompt) => (
                <SelectItem key={prompt.id} value={prompt.id}>
                  {prompt.title}
                  {prompt.type === "style" ? " (style)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground break-words">
            {isCreateMode
              ? "Loads into the description below, then generate the shot image."
              : "Loads into the edit field below — then click Edit Image to apply to this shot."}
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-inline-edit`} className="text-xs sm:text-sm">
          {isCreateMode ? "Describe the image" : "Describe your edit"}
        </Label>
        <Textarea
          id={`${idPrefix}-inline-edit`}
          value={inlineCustomShotPrompt}
          onChange={(e) => {
            setInlineCustomShotPrompt(e.target.value)
            if (selectedInlineEditPromptId) setSelectedInlineEditPromptId("")
          }}
          placeholder={
            isCreateMode
              ? "e.g., wide shot of a detective in a rainy neon alley, moody cinematic lighting"
              : 'e.g., warmer lighting, wider framing, add rain, closer on the character'
          }
          className="bg-input border-border min-h-[72px] text-xs sm:text-sm resize-none"
          disabled={isEditingThisShot}
        />
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-ref-upload`} className="text-xs text-muted-foreground">
            Primary reference (optional)
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`${idPrefix}-ref-upload`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInlineShotReferenceSelect}
              disabled={isEditingThisShot}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isEditingThisShot}
              onClick={() =>
                document.getElementById(`${idPrefix}-ref-upload`)?.click()
              }
            >
              <Upload className="h-4 w-4" />
              Upload reference
            </Button>
            {inlineShotReferencePreview && (
              <>
                <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-primary ring-2 ring-primary/40">
                  <img
                    src={inlineShotReferencePreview}
                    alt="Uploaded reference"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isEditingThisShot}
                  onClick={clearInlineShotReference}
                  title="Remove uploaded reference"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {!inlineShotReferencePreview && storyboard.image_url && (
              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border">
                <img
                  src={storyboard.image_url}
                  alt="Current shot"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground break-words">
            {inlineShotReferenceFile
              ? "Using your uploaded image as the primary reference."
              : storyboard.image_url
                ? "Uses the current shot image if you don't upload one."
                : isCreateMode
                  ? "Optional — upload a reference or link character/location images below to guide the look."
                  : "Upload a reference or link an image to this shot first."}
          </p>
        </div>
        <StoryboardShotReferencePicker
          projectId={sceneProjectId || ""}
          excludeStoryboardId={storyboard.id}
          selectedRefs={inlineStoryboardShotRefs}
          onSelectedRefsChange={setInlineStoryboardShotRefs}
          maxTotalReferences={MAX_LINKED_REFERENCE_IMAGES}
          otherLinkedCount={inlineStyleLinkAssetIds.length}
          disabled={isEditingThisShot}
        />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">
              Link existing image (optional)
            </Label>
          </div>
          <p className="text-xs text-muted-foreground break-words">
            {isCreateMode
              ? `Adds more images as references from characters, locations, avatar studio, or project assets. Select up to ${MAX_LINKED_REFERENCE_IMAGES} total including storyboard shots. Your description above is the only prompt.${
                  storyboard.character_id &&
                  getAvatarImagesForCharacter(storyboard.character_id).length > 0
                    ? " This character's avatar images are pre-selected when available."
                    : ""
                }`
              : `Optional — only select these if you want to blend in another look. Edits use the shot image above by default; character and location images are not sent unless you pick them here.`}
          </p>
          {isLoadingProjectAssets ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading project assets…
            </div>
          ) : linkedProjectImageGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              No other images in this project yet. Generate character or location images to link here.
            </p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto overflow-x-hidden rounded-lg border border-border/60 p-2 min-w-0">
              {linkedProjectImageGroups.map((group) => (
                <div key={group.label} className="space-y-1.5 min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        disabled={isEditingThisShot}
                        onClick={() => toggleInlineStyleLinkAsset(asset.id)}
                        className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                          inlineStyleLinkAssetIds.includes(asset.id)
                            ? "border-violet-500 ring-2 ring-violet-500/40"
                            : "border-border hover:border-violet-500/50"
                        }`}
                        title={`${getProjectAssetSourceLabel(asset, locations, characters)} — ${asset.title.replace(/ - AI Generated Image.*$/, "")}`}
                      >
                        <img
                          src={asset.content_url!}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(inlineStyleLinkAssetIds.length > 0 || inlineStoryboardShotRefs.length > 0) ? (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-violet-400">
                {inlineStyleLinkAssetIds.length + inlineStoryboardShotRefs.length} of {MAX_LINKED_REFERENCE_IMAGES} linked as additional references
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isEditingThisShot}
                onClick={clearInlineStyleLink}
              >
                Clear all
              </Button>
            </div>
          ) : null}
        </div>
        <Button
          size="sm"
          onClick={() => handleGenerateStoryboardReferenceEdit(storyboard.id)}
          disabled={isEditingThisShot || !canSubmit}
          className="gap-2 w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white"
        >
          {isEditingThisShot ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isCreateMode ? "Generating..." : "Editing..."}
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              {isCreateMode ? "Generate Image" : "Edit Image"}
            </>
          )}
        </Button>
        {!canSubmit && inlineCustomShotPrompt.trim() ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Button disabled:{" "}
            {!lockedConfig?.supportsReference && !isCreateMode
              ? "locked model does not support reference editing"
              : "check AI Settings"}
          </p>
        ) : null}
      </div>
    </div>
    )
  }

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

      const resolveProjectFromTimelineId = async (timelineId: string) => {
        const { data: timeline } = await getSupabaseClient()
          .from("timelines")
          .select("id, name, project_id")
          .eq("id", timelineId)
          .maybeSingle()

        if (!timeline?.project_id) return false

        timelineName = timeline.name || timelineName
        projectId = timeline.project_id
        const project = await TimelineService.getMovieById(timeline.project_id)
        if (project) {
          projectName = project.name
        }
        return true
      }

      try {
        const timelineId = (scene as { timeline_id?: string }).timeline_id
        if (timelineId && (await resolveProjectFromTimelineId(timelineId))) {
          console.log("🎬 Resolved project from scene timeline_id:", projectId)
        } else {
          const sceneProjectId = scene.project_id || timelineId
          console.log("🎬 Scene project_id:", scene.project_id)
          console.log("🎬 Scene timeline_id:", timelineId)
          console.log("🎬 Using sceneProjectId:", sceneProjectId)

          if (sceneProjectId) {
            if (!(await resolveProjectFromTimelineId(sceneProjectId))) {
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
      void loadAllStoryboardImages(sceneStoryboards.map((sb) => sb.id))
      setIsLoadingStoryboards(false)
    } catch (error) {
      console.error("🎬 Error fetching storyboards:", error)
      setIsLoadingStoryboards(false)
    }
  }

  const handleClearStoryboards = async () => {
    if (!sceneId) {
      toast({
        title: "Error",
        description: "Scene ID missing.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsClearingStoryboards(true)
      const deletedCount = await StoryboardsService.clearStoryboardsForScene(sceneId)
      setShowClearStoryboardsConfirm(false)
      setStoryboards([])
      setStoryboardImages(new Map())
      await fetchStoryboards()
      toast({
        title: "Storyboards cleared",
        description:
          deletedCount > 0
            ? `Removed ${deletedCount} storyboard${deletedCount === 1 ? "" : "s"} from this scene.`
            : "This scene had no storyboards to remove.",
      })
    } catch (error) {
      console.error("Error clearing storyboards:", error)
      toast({
        title: "Could not clear storyboards",
        description: error instanceof Error ? error.message : "Failed to clear storyboards for this scene.",
        variant: "destructive",
      })
    } finally {
      setIsClearingStoryboards(false)
    }
  }

  const resolveCreateShotPlacement = (): { shot_number: number; sequence_order: number } | { error: string } => {
    const formShot = formData.shot_number ?? 0
    const formSequence = formData.sequence_order ?? 0
    const hasShot = formShot > 0
    const hasSequence = formSequence > 0

    if (hasShot || hasSequence) {
      const sequence_order = hasSequence ? formSequence : formShot

      const duplicateSequence = storyboards.some(
        (sb) => shotOrderValue(sb) === sequence_order
      )

      if (duplicateSequence) {
        return {
          error: `Sequence order ${sequence_order} is already used. Pick another value (e.g. 8.5 between shots 8 and 9).`,
        }
      }

      if (
        Number.isInteger(sequence_order) &&
        storyboards.some((sb) => Number(sb.shot_number) === sequence_order)
      ) {
        return {
          error: `Shot number ${sequence_order} is already used. Try a decimal like ${Number(sequence_order) + 0.5} to insert between shots.`,
        }
      }

      return storyboardPlacementForInsert(storyboards, sequence_order)
    }

    const nextShotNumber = getNextShotNumber()
    return { shot_number: nextShotNumber, sequence_order: nextShotNumber }
  }

  const handleCreateStoryboard = async () => {
    if (!formData.title?.trim()) {
      toast({
        title: "Missing Title",
        description: "Please enter a title for this shot.",
        variant: "destructive"
      })
      return
    }

    if (!formData.description?.trim()) {
      toast({
        title: "Missing Description",
        description: "Please enter a shot description before creating.",
        variant: "destructive"
      })
      return
    }

    const placement = resolveCreateShotPlacement()
    if ("error" in placement) {
      toast({
        title: "Shot Number Conflict",
        description: placement.error,
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreating(true)
      
      // Clean up form data - convert empty strings to undefined for optional fields
      const cleanFormData = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        shot_number: placement.shot_number,
        sequence_order: placement.sequence_order,
        dialogue: formData.dialogue?.trim() || undefined,
        action: formData.action?.trim() || undefined,
        visual_notes: formData.visual_notes?.trim() || undefined,
        image_url: formData.image_url?.trim() || undefined,
        project_id: formData.project_id?.trim() || sceneProjectId,
        scene_id: sceneId,
        ...buildStoryboardAssignmentPatch(formCharacterIds, formLocationIds, {
          objectIds: formObjectIds,
        }),
      }

      const newStoryboard = await StoryboardsService.createStoryboard(cleanFormData)
      setStoryboards((prev) => sortStoryboardRows([...prev, newStoryboard]))
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
      } else if (error?.code === '23505') {
        if (error?.message?.includes('unique_scene_sequence_order')) {
          errorMessage = `Sequence order ${placement.sequence_order} is already taken. Try another decimal between existing shots.`
        } else {
          errorMessage = `Shot number ${placement.shot_number} is already taken in this scene. Try a decimal like 8.5 to insert between shots.`
        }
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
      const { shot_number: _shotNumber, sequence_order: _sequenceOrder, ...formWithoutPosition } =
        formData
      const cleanFormData = {
        ...formWithoutPosition,
        dialogue: formData.dialogue?.trim() || undefined,
        action: formData.action?.trim() || undefined,
        visual_notes: formData.visual_notes?.trim() || undefined,
        image_url: formData.image_url?.trim() || undefined,
        project_id: formData.project_id?.trim() || sceneProjectId,
        scene_id: sceneId,
        ...buildStoryboardAssignmentPatch(formCharacterIds, formLocationIds, {
          objectIds: formObjectIds,
          existingMetadata: editingStoryboard.metadata,
        }),
      }

      const updatedStoryboard = await StoryboardsService.updateStoryboard(editingStoryboard.id, cleanFormData)
      setStoryboards(prev => prev.map(sb => sb.id === editingStoryboard.id ? updatedStoryboard : sb))
      closeEditStoryboardDialog()
      
      toast({
        title: "Success",
        description: "Storyboard updated successfully"
      })
    } catch (error) {
      console.error("Error updating storyboard:", error)
      toast({
        title: "Error",
        description: formatStoryboardSaveError(error, formData.movement),
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const resolveQuickInsertPlacement = (
    anchorId: string,
    side: "before" | "after"
  ): { shot_number: number; sequence_order: number } | { error: string } => {
    const index = orderedStoryboards.findIndex((sb) => sb.id === anchorId)
    if (index === -1) return { error: "Shot not found" }

    const taken = orderedStoryboards.map((sb) => shotOrderValue(sb))

    let beforeOrder: number
    let afterOrder: number
    if (side === "before") {
      afterOrder = shotOrderValue(orderedStoryboards[index])
      beforeOrder = index > 0 ? shotOrderValue(orderedStoryboards[index - 1]) : 0
    } else {
      beforeOrder = shotOrderValue(orderedStoryboards[index])
      afterOrder =
        index < orderedStoryboards.length - 1
          ? shotOrderValue(orderedStoryboards[index + 1])
          : beforeOrder + 1
    }

    const sequence_order = computeInsertPlacementBetween(beforeOrder, afterOrder, taken)
    if (sequence_order == null) {
      return { error: "No space to insert here. Try renumbering shots first." }
    }

    return storyboardPlacementForInsert(orderedStoryboards, sequence_order)
  }

  const handleQuickInsertAdjacent = async (anchorId: string, side: "before" | "after") => {
    const insertKey = `${side}-${anchorId}`
    if (quickInsertingKey) return

    const placement = resolveQuickInsertPlacement(anchorId, side)
    if ("error" in placement) {
      toast({
        title: "Cannot insert shot",
        description: placement.error,
        variant: "destructive",
      })
      return
    }

    const shotLabel = displayShotNumber({ shot_number: placement.shot_number, sequence_order: placement.sequence_order })

    try {
      setQuickInsertingKey(insertKey)
      const newStoryboard = await StoryboardsService.createStoryboard({
        title: `Shot ${shotLabel}`,
        description: `New shot ${shotLabel}`,
        scene_number: sceneNumberForSync,
        shot_number: placement.shot_number,
        sequence_order: placement.sequence_order,
        shot_type: "wide",
        camera_angle: "eye-level",
        movement: "static",
        status: "draft",
        scene_id: sceneId,
        project_id: sceneProjectId,
      })
      setStoryboards((prev) => sortStoryboardRows([...prev, newStoryboard]))
      toast({
        title: "Shot inserted",
        description: `Created Shot ${shotLabel}`,
      })
    } catch (error: any) {
      console.error("Error quick-inserting storyboard:", error)
      toast({
        title: "Error",
        description: error?.message || error?.details || "Failed to insert shot",
        variant: "destructive",
      })
    } finally {
      setQuickInsertingKey(null)
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
      location_id: null,
      dialogue: "",
      action: "",
      visual_notes: "",
      image_url: "",
      project_id: "",
      scene_id: sceneId
    })
    setFormCharacterIds([])
    setFormLocationIds([])
    setAiPrompt("")
    setSelectedAIService("dalle")
    setEditingStoryboard(null)
    setAiImagePrompt("")
    setAiImagePromptFull("")
    setSelectedAiImagePromptId("")
    setIncludeCharacterDetails(false)
    setIncludeMasterPrompt(false)
    setUseExactPrompt(true)
  }

  const syncFormAssignmentsFromStoryboard = (storyboard: Storyboard) => {
    setFormCharacterIds(getStoryboardCharacterIds(storyboard))
    setFormLocationIds(getStoryboardLocationIds(storyboard))
    setFormObjectIds(getStoryboardObjectIds(storyboard))
  }

  const applyStoryboardAssignments = async (
    storyboard: Storyboard,
    characterIds: string[],
    locationIds: string[],
    objectIds: string[],
  ) => {
    setUpdatingAssignmentStoryboardId(storyboard.id)
    try {
      const patch = buildStoryboardAssignmentPatch(characterIds, locationIds, {
        objectIds,
        existingMetadata: storyboard.metadata,
      })
      const updated = await StoryboardsService.updateStoryboard(storyboard.id, patch)
      setStoryboards((prev) =>
        sortStoryboardRows(prev.map((existing) => (existing.id === storyboard.id ? updated : existing))),
      )
    } catch (error) {
      console.error("Error updating storyboard assignments:", error)
      toast({
        title: "Error",
        description: "Failed to update character/location assignments.",
        variant: "destructive",
      })
    } finally {
      setUpdatingAssignmentStoryboardId(null)
    }
  }

  const saveStoryboardLayoutReference = async (
    storyboardId: string,
    layout: StoryboardLayoutReference | null,
  ) => {
    const storyboard = storyboards.find((row) => row.id === storyboardId)
    if (!storyboard) return
    const metadata = buildStoryboardLayoutMetadataPatch(storyboard.metadata, layout)
    const updated = await StoryboardsService.updateStoryboard(storyboardId, { metadata })
    setStoryboards((prev) =>
      sortStoryboardRows(
        prev.map((existing) => (existing.id === storyboardId ? updated : existing)),
      ),
    )
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

  useEffect(() => {
    if (!ready || !userId) return
    void (async () => {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }
      setUserProfile(data)
    })()
  }, [ready, userId])

  useEffect(() => {
    console.log('🎬 selectedAIService changed to:', selectedAIService)
  }, [selectedAIService])

  useEffect(() => {
    if (selectedAIService && !['dalle', 'openart', 'leonardo'].includes(selectedAIService)) {
      console.warn('🎬 Invalid selectedAIService detected, resetting to dalle:', selectedAIService)
      setSelectedAIService('dalle')
    }
  }, [selectedAIService])

  useEffect(() => {
    if (aiSettingsLoaded && aiSettings.length > 0) {
      const imagesSetting = aiSettings.find(setting => setting.tab_type === 'images')
      if (imagesSetting?.is_locked && imagesSetting.locked_model) {
        console.log('🎬 Setting locked model for images:', imagesSetting.locked_model)
        setSelectedAIService(imagesSetting.locked_model)
      }
    }
  }, [aiSettingsLoaded, aiSettings])

  useEffect(() => {
    return () => {
      if (jumpTimeoutRef.current) window.clearTimeout(jumpTimeoutRef.current)
    }
  }, [])

  const filteredStoryboards = storyboards.filter(storyboard => {
    const matchesSearch = storyboard.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         storyboard.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (storyboard.dialogue?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                         (storyboard.action?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
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

  const quickGenerateShotImage = async (storyboard: Storyboard) => {
    debugStoryboardImage("quick-start", {
      storyboardId: storyboard.id,
      shotNumber: storyboard.shot_number,
      title: storyboard.title,
    })

    const assignmentContext = getStoryboardAssignmentContext(storyboard, characters, locations, storyObjects)
    const prompt = buildQuickShotImagePrompt(storyboard, {
      characterNames: assignmentContext.characterNames,
      locationNames: assignmentContext.locationNames,
    })
    if (!prompt.trim()) {
      debugStoryboardImage("validation-failed", {
        reason: "empty-quick-prompt",
        storyboardId: storyboard.id,
      })
      toast({
        title: "No shot details",
        description: "Add a description, action, or shot details before generating.",
        variant: "destructive",
      })
      return
    }

    debugStoryboardImage("prompt-built", {
      mode: "quick",
      storyboardId: storyboard.id,
      promptLength: prompt.length,
      characterIds: assignmentContext.characterIds,
      locationIds: assignmentContext.locationIds,
    })

    await generateShotImage(storyboard.id, prompt, {
      quick: true,
      includeCharacterDetails: assignmentContext.characterIds.length > 0,
      includeMasterPrompt: assignmentContext.characterIds.length > 0,
    })
  }

  // Function to generate AI image for a storyboard shot
  const generateShotImage = async (
    storyboardId: string,
    prompt: string,
    options?: {
      quick?: boolean
      includeCharacterDetails?: boolean
      includeMasterPrompt?: boolean
      skipEnrichment?: boolean
    },
  ) => {
    const isQuick = options?.quick ?? false
    const useCharacterDetails =
      options?.includeCharacterDetails ?? includeCharacterDetails
    const useMasterPrompt = options?.includeMasterPrompt ?? includeMasterPrompt
    const skipEnrichment = options?.skipEnrichment ?? false
    let generationPrompt = prompt.trim()

    debugStoryboardImage("generate-start", {
      storyboardId,
      isQuick,
      promptLength: prompt.trim().length,
      userId: userId ?? null,
      useCharacterDetails,
      useMasterPrompt,
    })

    if (!prompt.trim() || !userId) {
      debugStoryboardImage("validation-failed", {
        reason: !prompt.trim() ? "empty-prompt" : "missing-user-id",
        storyboardId,
      })
      toast({
        title: "Missing Information",
        description: "Please enter a prompt for the AI image generation.",
        variant: "destructive"
      })
      return
    }

    try {
      if (isQuick) {
        setQuickGeneratingShotIds((prev) => new Set(prev).add(storyboardId))
      } else {
        setIsGeneratingShotImage(true)
      }
      
      // Get the AI settings for images tab
      const imagesSetting = aiSettings.find(setting => setting.tab_type === 'images')
      const isLockedModel = Boolean(imagesSetting?.is_locked && imagesSetting.locked_model)
      
      // Determine which service to use - locked model takes precedence
      let serviceToUse = selectedAIService
      let modelToUse: string | undefined = undefined
      
      if (isLockedModel) {
        serviceToUse = mapDisplayModelToService(imagesSetting!.locked_model!)
        modelToUse = normalizeDisplayModelToApiId(imagesSetting!.locked_model!)
      } else {
        // Safety check: ensure we have a valid service
        if (!serviceToUse || !['dalle', 'openart', 'runway', 'leonardo'].includes(serviceToUse)) {
          serviceToUse = 'dalle'
        }
      }

      debugStoryboardImage("service-resolved", {
        storyboardId,
        serviceToUse,
        modelToUse,
        isLockedModel,
        lockedModel: imagesSetting?.locked_model,
        selectedAIService,
      })
      
      // Locked models resolve API keys server-side (system or user settings).
      let apiKey: string | null | undefined
      if (isLockedModel) {
        apiKey = "configured"
      } else {
        apiKey = getApiKeyForService(serviceToUse)
      }

      debugStoryboardImage("api-key-check", {
        storyboardId,
        serviceToUse,
        apiKeyMode: apiKey === "configured" ? "configured" : apiKey ? "profile" : "missing",
        hasUserProfile: Boolean(userProfile),
      })

      if (!apiKey) {
        debugStoryboardImage("validation-failed", {
          reason: "missing-api-key",
          storyboardId,
          serviceToUse,
        })
        toast({
          title: "API Key Required",
          description: `Please configure your ${serviceToUse.toUpperCase()} API key in your profile settings.`,
          variant: "destructive"
        })
        return
      }

      const storyboard = resolveStoryboardForGeneration(storyboardId)
      if (!storyboard) {
        debugStoryboardImage("validation-failed", {
          reason: "storyboard-not-found",
          storyboardId,
          knownStoryboardIds: storyboards.map((sb) => sb.id),
        })
        toast({
          title: "Shot not found",
          description: "Could not find this storyboard shot. Refresh the page and try again.",
          variant: "destructive",
        })
        return
      }

      debugStoryboardImage("storyboard-resolved", {
        storyboardId,
        title: storyboard.title,
        characterIds: getStoryboardCharacterIds(storyboard),
        locationIds: getStoryboardLocationIds(storyboard),
      })

      const assignmentContext = getStoryboardAssignmentContext(storyboard, characters, locations, storyObjects)
      const layoutRef = getStoryboardLayoutReference(storyboard)

      // Prepare the enhanced prompt for storyboard shots
      let enhancedPrompt = generationPrompt

      if (
        !skipEnrichment &&
        (useMasterPrompt || useCharacterDetails || assignmentContext.locationDetails.length > 0)
      ) {
        enhancedPrompt = enrichPromptWithAssignments(enhancedPrompt, {
          characterNames: useCharacterDetails ? assignmentContext.characterNames : [],
          locationNames: assignmentContext.locationNames,
          objectNames: assignmentContext.objectNames,
          characterDetails: useCharacterDetails ? assignmentContext.characterDetails : [],
          locationDetails: assignmentContext.locationDetails,
          objectDetails: assignmentContext.objectDetails,
          masterPrompts: useMasterPrompt ? assignmentContext.masterPrompts : [],
          referenceCount: 0,
        })
      }

      // Only add minimal enhancement if user hasn't chosen exact prompt
      if (!skipEnrichment && !useExactPrompt) {
        enhancedPrompt = `${enhancedPrompt}, cinematic storyboard frame, film production still. ${SINGLE_FRAME_STORYBOARD_INSTRUCTION}`
      }

      generationPrompt = enhancedPrompt

      const modelLabel = modelToUse || imagesSetting?.locked_model || serviceToUse
      const refLimit = storyboardReferenceImageLimit(modelToUse, {
        characterCount: assignmentContext.characterIds.length,
        locationCount: assignmentContext.locationIds.length,
        objectCount: assignmentContext.objectIds.length,
      })
      const shotGallery = storyboardImages.get(storyboardId) ?? []
      const hasShotImages = Boolean(storyboard.image_url) || shotGallery.length > 0
      const hasAssignedRefs =
        assignmentContext.characterIds.length > 0 ||
        assignmentContext.locationIds.length > 0 ||
        assignmentContext.objectIds.length > 0
      // Quick regen on a shot with images used to skip entity refs only when nothing to guide generation.
      const skipReferenceImages =
        isQuick && hasShotImages && !hasAssignedRefs && !layoutRef.url
      const excludeReferenceUrls = isQuick
        ? [
            ...(storyboard.image_url ? [storyboard.image_url] : []),
            ...shotGallery.map((image) => image.image_url).filter(Boolean),
          ]
        : []
      if (layoutRef.url) {
        excludeReferenceUrls.push(layoutRef.url)
      }

      const referenceSources = skipReferenceImages
        ? []
        : collectStoryboardReferenceSources({
            characterIds: assignmentContext.characterIds,
            locationIds: assignmentContext.locationIds,
            objectIds: assignmentContext.objectIds,
            characters,
            locations,
            storyObjects,
            avatarImages: projectAvatarImages,
            characterAssets: characterImageAssets,
            objectAssets: objectImageAssets,
            maxImages: refLimit,
            excludeUrls: excludeReferenceUrls,
          })

      if (isQuick && hasShotImages) {
        pushStoryboardImageTrace(
          "info",
          skipReferenceImages
            ? "Quick generate — no assignments or layout ref; references skipped"
            : layoutRef.url
              ? "Quick generate — layout ref + character/location refs"
              : "Quick generate — using assigned references (shot gallery URLs excluded)",
          `sources=${referenceSources.length}, layout=${layoutRef.url ? "yes" : "no"}`,
        )
      }
      if (layoutRef.url) {
        pushStoryboardImageTrace(
          "info",
          "Layout / blocking reference",
          layoutRef.label ?? layoutRef.url.slice(0, 80),
        )
      }
      for (const source of referenceSources) {
        pushStoryboardImageTrace(
          "ok",
          `Reference: ${source.label}`,
          `${source.sourceType} · ${source.url.slice(0, 80)}`,
        )
      }

      const referenceCoverage = summarizeStoryboardReferenceCoverage(
        referenceSources,
        assignmentContext.characterIds,
        characters,
        refLimit,
      )
      const objectReferenceCoverage = summarizeObjectReferenceCoverage(
        referenceSources,
        assignmentContext.objectIds,
        storyObjects,
        refLimit,
      )
      debugStoryboardImage("references-collected", {
        phase: "multi-character-coverage",
        storyboardId,
        model: modelToUse,
        refLimit,
        assignedCharacters: assignmentContext.characterNames,
        assignedObjects: assignmentContext.objectNames,
        characterRefMapping: referenceCoverage.characterRefMapping,
        objectRefMapping: objectReferenceCoverage.objectRefMapping,
        included: referenceCoverage.included,
        missingSource: referenceCoverage.missingSource,
        droppedDueToLimit: referenceCoverage.droppedDueToLimit,
        objectIncluded: objectReferenceCoverage.included,
        objectMissingSource: objectReferenceCoverage.missingSource,
        objectDroppedDueToLimit: objectReferenceCoverage.droppedDueToLimit,
      })
      if (objectReferenceCoverage.missingSource.length > 0) {
        pushStoryboardImageTrace(
          "warn",
          "Objects with NO reference image (model may invent props/vehicles)",
          objectReferenceCoverage.missingSource.map((e) => e.name).join(", "),
        )
      }
      for (const entry of objectReferenceCoverage.objectRefMapping) {
        pushStoryboardImageTrace(
          "info",
          `GPT ref #${entry.index} → ${entry.name} (${entry.category})`,
          `${entry.sourceType}: ${entry.label}`,
        )
      }
      if (referenceCoverage.missingSource.length > 0) {
        pushStoryboardImageTrace(
          "warn",
          "Characters with NO reference image (model may invent faces)",
          referenceCoverage.missingSource.map((e) => e.name).join(", "),
        )
      }
      if (referenceCoverage.droppedDueToLimit.length > 0) {
        pushStoryboardImageTrace(
          "warn",
          "Characters dropped — ref limit exceeded",
          `${referenceCoverage.droppedDueToLimit.map((e) => e.name).join(", ")} (limit=${refLimit})`,
        )
      }
      for (const entry of referenceCoverage.characterRefMapping) {
        pushStoryboardImageTrace(
          "info",
          `GPT ref #${entry.index} → ${entry.name}`,
          `${entry.sourceType}: ${entry.label}`,
        )
      }

      const referenceLoad =
        referenceSources.length > 0
          ? await loadStoryboardReferenceFiles(referenceSources)
          : { files: [], loaded: [], failed: [] as StoryboardReferenceLoadFailure[] }
      const referenceFiles = referenceLoad.files.slice(0, refLimit)

      if (referenceLoad.failed.length > 0) {
        setReferenceIssuesByStoryboardId((prev) => {
          const next = new Map(prev)
          next.set(storyboardId, referenceLoad.failed)
          return next
        })
        debugStoryboardImage("validation-failed", {
          reason: referenceFiles.length === 0 ? "all-reference-images-invalid" : "some-reference-images-invalid",
          storyboardId,
          referenceUrlCount: referenceSources.length,
          loadedReferenceCount: referenceFiles.length,
          failedReferences: referenceLoad.failed.map((issue) => ({
            label: issue.label,
            error: issue.error,
          })),
        })
        toast({
          title: `${referenceLoad.failed.length} reference image${referenceLoad.failed.length === 1 ? "" : "s"} couldn't load`,
          description:
            referenceFiles.length > 0 || layoutRef.url
              ? `Used ${referenceFiles.length} valid reference${referenceFiles.length === 1 ? "" : "s"}${layoutRef.url ? " plus layout reference" : ""}. See the warning on this shot for what to fix.`
              : "No valid references were found. Generation continued with text only — see the warning on this shot.",
          variant: "destructive",
        })
      } else {
        setReferenceIssuesByStoryboardId((prev) => {
          if (!prev.has(storyboardId)) return prev
          const next = new Map(prev)
          next.delete(storyboardId)
          return next
        })
      }

      if (!skipEnrichment && referenceFiles.length > 0) {
        enhancedPrompt = enrichPromptWithAssignments(enhancedPrompt, {
          characterNames: assignmentContext.characterNames,
          locationNames: assignmentContext.locationNames,
          objectNames: assignmentContext.objectNames,
          characterDetails: [],
          locationDetails: [],
          objectDetails: assignmentContext.objectDetails,
          masterPrompts: [],
          referenceCount: referenceFiles.length,
          entityRefMapping: buildEntityReferenceMapping(
            referenceLoad.loaded,
            { startIndex: layoutRef.url ? 2 : 1 },
          ),
        })
      }

      const layoutMatchesCurrentShot = Boolean(
        layoutRef.url &&
          storyboard.image_url &&
          normalizeReferenceUrl(layoutRef.url) ===
            normalizeReferenceUrl(storyboard.image_url),
      )

      if (!skipEnrichment && layoutRef.url) {
        enhancedPrompt = enrichPromptWithLayoutReference(enhancedPrompt, {
          layoutLabel: layoutRef.label,
          characterNames: assignmentContext.characterNames,
          layoutMatchesCurrentShot,
        })
      }

      generationPrompt = enhancedPrompt

      debugStoryboardImage("prompt-built", {
        storyboardId,
        mode: isQuick ? "quick" : "manual",
        enhancedPromptLength: enhancedPrompt.length,
        referenceUrlCount: referenceSources.length,
        referenceFileCount: referenceFiles.length,
        skipReferenceImages,
        useExactPrompt,
        layoutReferenceUrl: layoutRef.url,
      })

      const entityReferenceUrls = referenceLoad.loaded.map((source) => source.url)
      const hasReferencePayload = Boolean(layoutRef.url) || entityReferenceUrls.length > 0
      const lockedImageConfig =
        imagesSetting?.is_locked && imagesSetting.locked_model
          ? getLockedImageConfig({ withReferenceImage: hasReferencePayload })
          : null
      const supportsReference =
        lockedImageConfig?.supportsReference ||
        displayModelSupportsReferenceImage(modelLabel)

      let response: Response
      if (hasReferencePayload && supportsReference) {
        const primaryReferenceUrl = layoutRef.url ?? entityReferenceUrls[0]
        const styleReferenceUrls = layoutRef.url
          ? entityReferenceUrls
          : entityReferenceUrls.slice(1)
        const generationConfig = lockedImageConfig ?? {
          service: serviceToUse,
          apiModel: modelToUse,
          supportsReference: true,
        }
        response = await requestImageGenerationWithReferences(enhancedPrompt, {
          service: generationConfig.service,
          model: generationConfig.apiModel,
          apiKey,
          referenceImageUrl: primaryReferenceUrl,
          styleReferenceUrls:
            styleReferenceUrls.length > 0 ? styleReferenceUrls : undefined,
          supportsReference: true,
        })
        pushStoryboardImageTrace(
          "info",
          "GPT Image reference payload",
          `primary=${layoutRef.url ? "layout" : "entity"} (${primaryReferenceUrl?.slice(0, 60) ?? "none"}), styleRefs=${styleReferenceUrls.length}, total=${1 + styleReferenceUrls.length}`,
        )
      } else {
        debugStoryboardImage("request-sent", {
          storyboardId,
          transport: "json",
          service: serviceToUse,
          model: modelToUse,
          supportsReference,
          skippedReferencesBecauseUnsupported: referenceFiles.length > 0 && !supportsReference,
        })

        const requestBody: Record<string, unknown> = {
          prompt: enhancedPrompt,
          service: serviceToUse,
          apiKey: apiKey,
          userId: userId,
          autoSaveToBucket: true,
          width: 1536,
          height: 1024,
        }

        if (modelToUse) {
          requestBody.model = modelToUse
        }

        response = await fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
      }

      const responseText = await response.text()
      let result: Record<string, unknown> = {}
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = { rawBody: responseText.slice(0, 500) }
      }

      debugStoryboardImage("response-received", {
        storyboardId,
        ok: response.ok,
        status: response.status,
        success: result.success,
        hasImageUrl: Boolean(result.imageUrl),
        hasBucketUrl: Boolean(result.bucketUrl),
        savedToBucket: result.savedToBucket,
        error: result.error,
      })

      if (!response.ok) {
        const errorMessage =
          typeof result.error === "string" ? result.error : "Failed to generate image"
        if (isContentBlockedResponse(result)) {
          setContentBlockedDialog({
            prompt: generationPrompt,
            storyboardId,
            options: { quick: isQuick, includeCharacterDetails: useCharacterDetails, includeMasterPrompt: useMasterPrompt },
          })
          return
        }
        throw new Error(errorMessage)
      }
      
      if (result.success && result.imageUrl) {
        // Use bucket URL if available, otherwise fall back to original URL
        const imageUrlToUse = (result.bucketUrl || result.imageUrl) as string
        
        // Add to gallery without replacing the current main image
        const existingImages = storyboardImages.get(storyboardId) ?? []
        const currentStoryboard = storyboards.find((sb) => sb.id === storyboardId)
        const hasExisting =
          existingImages.length > 0 || Boolean(currentStoryboard?.image_url)

        await saveStoryboardImage(storyboardId, imageUrlToUse, {
          isDefault: !hasExisting,
          generationPrompt: enhancedPrompt,
          generationModel: modelToUse,
        })

        toast({
          title: "Image Generated!",
          description: hasExisting
            ? "New image added below. Click a thumbnail to use it as the main shot image."
            : referenceFiles.length > 0
              ? `Image generated using ${referenceFiles.length} reference image${referenceFiles.length === 1 ? "" : "s"} (characters & locations).`
              : referenceLoad.failed.length > 0
                ? "Image generated without valid reference images. See the warning on this shot to fix broken links."
              : result.savedToBucket
                ? "Image generated and saved to your bucket!"
                : "Image added to this shot.",
        })

        if (!isQuick) {
          // Clear the prompt
          setAiImagePrompt("")

          // Close edit form if it's open
          if (showEditForm) {
            closeEditStoryboardDialog()
          }
        }
      } else {
        const errorMessage =
          typeof result.error === "string"
            ? result.error
            : "Failed to generate image — API returned success without an image URL"
        if (isContentBlockedResponse(result)) {
          setContentBlockedDialog({
            prompt: generationPrompt,
            storyboardId,
            options: { quick: isQuick, includeCharacterDetails: useCharacterDetails, includeMasterPrompt: useMasterPrompt },
          })
          return
        }
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const debugEntry = debugStoryboardImage("error", {
        storyboardId,
        message: errorMessage,
      })
      console.error('Error generating shot image:', error, debugEntry)

      if (isContentPolicyError(errorMessage)) {
        setContentBlockedDialog({
          prompt: generationPrompt,
          storyboardId,
          options: { quick: isQuick, includeCharacterDetails: useCharacterDetails, includeMasterPrompt: useMasterPrompt },
        })
        return
      }

      toast({
        title: "Generation Failed",
        description: [
          errorMessage,
          formatStoryboardImageDebug(getLastStoryboardImageDebug()),
        ].join(" — "),
        variant: "destructive"
      })
    } finally {
      if (isQuick) {
        setQuickGeneratingShotIds((prev) => {
          const next = new Set(prev)
          next.delete(storyboardId)
          return next
        })
      } else {
        setIsGeneratingShotImage(false)
      }
    }
  }

  /** Redo the current shot image at cinematic landscape size (1536×1024). */
  const regenerateShotAtLandscapeSize = async (storyboard: Storyboard) => {
    if (!storyboard.image_url || !userId) {
      toast({
        title: "No image to redo",
        description: "This shot needs an existing image first.",
        variant: "destructive",
      })
      return
    }

    setRegeneratingLandscapeId(storyboard.id)
    try {
      const config = requireLockedImageConfig({ withReferenceImage: true })
      if (!config.supportsReference) {
        throw new Error("Lock GPT Image 2 or Runway in AI Settings to redo images at landscape size.")
      }

      const promptParts = [
        "Recreate this exact image as a widescreen cinematic landscape frame (1536x1024).",
        "Keep the same subject, composition, lighting, colors, and style.",
        "Do not add text, captions, labels, or watermarks.",
        storyboard.title ? `Shot: ${storyboard.title}.` : "",
        storyboard.description?.trim() ? storyboard.description.trim() : "",
      ].filter(Boolean)
      const prompt = promptParts.join(" ").slice(0, 990)

      const response = await requestLockedImageGeneration(prompt, config, {
        referenceImageUrl: storyboard.image_url,
        width: 1536,
        height: 1024,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to regenerate landscape image")
      }

      const result = await response.json()
      if (!result.success || !result.imageUrl) {
        throw new Error("Failed to regenerate landscape image")
      }

      const imageUrlToUse = result.bucketUrl || result.imageUrl
      const existingImages = storyboardImages.get(storyboard.id) ?? []
      const hasExisting = existingImages.length > 0 || Boolean(storyboard.image_url)

      await saveStoryboardImage(storyboard.id, imageUrlToUse, {
        isDefault: !hasExisting,
        generationPrompt: prompt,
        imageName: "Landscape redo",
      })

      toast({
        title: "Landscape image ready",
        description: hasExisting
          ? "New landscape version added below. Click a thumbnail to use it."
          : "Redid this shot at 1536×1024 widescreen.",
      })
    } catch (error) {
      toast({
        title: "Landscape redo failed",
        description: getImageGenerationErrorMessage(
          error,
          "Could not regenerate this image at landscape size.",
        ),
        variant: "destructive",
      })
    } finally {
      setRegeneratingLandscapeId(null)
    }
  }
  
  return (
    <div className={`min-h-screen bg-background overflow-x-hidden ${filteredStoryboards.length > 0 ? "pb-14" : ""}`}>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Breadcrumb + view switcher */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground overflow-x-auto">
            <Link href="/movies" className="hover:text-foreground whitespace-nowrap">Movies</Link>
            <span>/</span>
            <Link href={`/timeline?movie=${sceneProjectId}`} className="hover:text-foreground whitespace-nowrap break-words">
              {sceneInfo?.project_name || "Unknown Project"}
            </Link>
            <span>/</span>
            <Link href={`/timeline?movie=${sceneProjectId}`} className="hover:text-foreground whitespace-nowrap break-words">
              {sceneInfo?.timeline_name || "Unknown Timeline"}
            </Link>
            <span>/</span>
            <span className="text-foreground whitespace-nowrap break-words">
              {sceneInfo?.scene_number ? `Scene ${sceneInfo.scene_number}: ` : ''}{sceneInfo?.name || "Unknown Scene"}
            </span>
          </nav>
          <div className="flex flex-col items-start gap-2 sm:items-end sm:flex-shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              {sceneProjectId ? (
                <Button variant="outline" size="sm" asChild className="h-8 text-xs sm:text-sm">
                  <Link href={`/cinema-production?project=${sceneProjectId}&scene=${sceneId}`}>
                    <Video className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Cinema Production</span>
                    <span className="sm:hidden">Production</span>
                  </Link>
                </Button>
              ) : null}
              <SceneViewSwitcher sceneId={sceneId} activeView="storyboards" />
            </div>
            <SceneSyncControls
              sceneId={sceneId}
              projectId={sceneProjectId}
              sceneNumber={sceneNumberForSync}
              primaryDirection="storyboards-to-shotlist"
              onSynced={() => {
                void fetchStoryboards()
              }}
            />
          </div>
        </div>

        {/* Scene Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
            <Button variant="outline" size="sm" onClick={() => router.back()} className="w-full sm:w-auto text-xs sm:text-sm">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                {sceneInfo?.scene_number && (
                  <Badge variant="secondary" className="text-sm sm:text-lg px-2 sm:px-3 py-1 flex-shrink-0">
                    Scene {sceneInfo.scene_number}
                  </Badge>
                )}
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold break-words">{sceneInfo?.name || "Loading Scene..."}</h1>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDescriptionDialog(true)}
                className="text-muted-foreground hover:text-foreground text-xs sm:text-sm -ml-2 w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 sm:mr-2" />
                View Description
              </Button>
            </div>
            
            {/* Scene Navigation */}
            {allScenes.length > 1 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
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
                  <SelectTrigger className="w-full sm:w-[200px] lg:w-[250px] border-primary/30 text-xs sm:text-sm">
                    <SelectValue>
                      {sceneInfo ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{sceneInfo.name}</span>
                          {sceneInfo.metadata?.sceneNumber && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
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
          
          {/* Description Dialog */}
          <Dialog open={showDescriptionDialog} onOpenChange={setShowDescriptionDialog}>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader className="pb-4 sm:pb-6">
                <DialogTitle className="text-lg sm:text-xl">Scene Description</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm break-words">
                  {sceneInfo?.name && `Description for "${sceneInfo.name}"`}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground whitespace-pre-wrap break-words">
                  {sceneInfo?.description || "No description available for this scene."}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Scene Script Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold">Scene Script</h2>
              {sceneScript && (
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {totalScriptPages} {totalScriptPages === 1 ? 'page' : 'pages'}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {isLoadingScript && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Loading...
                </div>
              )}
              {sceneScript && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSceneScript(!showSceneScript)}
                  className="text-xs flex-1 sm:flex-initial"
                >
                  <Eye className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">{showSceneScript ? "Hide Script" : "Show Script"}</span>
                  <span className="sm:hidden">{showSceneScript ? "Hide" : "Show"}</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSceneScript}
                disabled={isLoadingScript}
                className="text-xs flex-1 sm:flex-initial"
              >
                <RefreshCw className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Refresh Script</span>
                <span className="sm:hidden">Refresh</span>
              </Button>
            </div>
          </div>
          
          {showSceneScript && sceneScript ? (
            <Card className="bg-muted/20 border-border/50">
              <CardContent className="p-6">
                <div className="bg-background/50 rounded-lg p-4 border border-border/30 relative">
                  {/* Pagination Controls */}
                  {totalScriptPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mb-4 pb-4 border-b border-border/30">
                      <Badge variant="outline" className="px-4 py-2">
                        Page {currentScriptPage} of {totalScriptPages}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentScriptPage(prev => Math.max(1, prev - 1))}
                        disabled={currentScriptPage === 1}
                        className="border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={totalScriptPages}
                        value={currentScriptPage}
                        onChange={(e) => {
                          const page = parseInt(e.target.value)
                          if (page && page >= 1 && page <= totalScriptPages) {
                            setCurrentScriptPage(page)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const page = parseInt((e.target as HTMLInputElement).value)
                            if (page && page >= 1 && page <= totalScriptPages) {
                              setCurrentScriptPage(page)
                            }
                          }
                        }}
                        className="w-20 text-center"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentScriptPage(prev => Math.min(totalScriptPages, prev + 1))}
                        disabled={currentScriptPage === totalScriptPages}
                        className="border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed select-text cursor-text">
                    {getCurrentPageScript()}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ) : showSceneScript ? (
            <Card className="bg-muted/20 border-border/50">
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Script Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This scene doesn't have a script yet. Import a script or add one from the scene page.
                </p>
                <div className="flex gap-2 justify-center">
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
          ) : null}
        </div>



        {/* Storyboards Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold">Storyboards</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              {storyboards.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/40 hover:border-destructive/60 w-full sm:w-auto text-xs sm:text-sm"
                  disabled={isClearingStoryboards}
                  onClick={() => setShowClearStoryboardsConfirm(true)}
                >
                  {isClearingStoryboards ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear All
                </Button>
              ) : null}
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="gradient-button neon-glow text-white w-full sm:w-auto text-xs sm:text-sm"
              >
                <Plus className="sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Storyboard</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search storyboards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-xs sm:text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm">
                  <Filter className="h-4 w-4 sm:mr-2" />
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
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6 sm:mb-8">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl break-words">
                <FileText className="h-5 w-5 flex-shrink-0" />
                <span className="hidden sm:inline">Create New Storyboard for {sceneInfo?.name || "Loading Scene..."}</span>
                <span className="sm:hidden">New Storyboard</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm break-words">
                Fill in the details below. Use AI assistance for text and image generation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="shot_type">Shot Type</Label>
                  <Select value={formData.shot_type} onValueChange={(value) => setFormData(prev => ({ ...prev, shot_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="camera_angle">Camera Angle</Label>
                  <ShotCameraAngleSelect
                    id="camera_angle"
                    value={formData.camera_angle}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, camera_angle: value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="movement">Camera Movement</Label>
                  <ShotMovementSelect
                    id="movement"
                    value={formData.movement}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, movement: value }))}
                  />
                </div>
              </div>

              {characters.length > 0 && (
                <div className="space-y-2">
                  <Label>Character / Avatar (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Assign characters to include their details and Avatar Studio images when generating
                  </p>
                  <AssignmentBadgePicker
                    kind="character"
                    items={characters.map((character) => ({
                      id: character.id,
                      name: character.name,
                      subtitle: character.archetype ?? undefined,
                    }))}
                    selectedIds={formCharacterIds}
                    onSelectedIdsChange={setFormCharacterIds}
                    disabled={isCreating}
                  />
                </div>
              )}

              {locations.length > 0 && (
                <div className="space-y-2">
                  <Label>Location (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Assign locations to include their details when generating images
                  </p>
                  <AssignmentBadgePicker
                    kind="location"
                    items={locations.map((location) => ({
                      id: location.id,
                      name: location.name,
                      subtitle: location.type ?? undefined,
                    }))}
                    selectedIds={formLocationIds}
                    onSelectedIdsChange={setFormLocationIds}
                    disabled={isCreating}
                  />
                </div>
              )}

              {storyObjects.length > 0 && (
                <div className="space-y-2">
                  <Label>Object (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Assign props, vehicles, and other story objects for image generation
                  </p>
                  <AssignmentBadgePicker
                    kind="object"
                    items={storyObjects.map((object) => ({
                      id: object.id,
                      name: object.name,
                      subtitle: object.category ?? undefined,
                    }))}
                    selectedIds={formObjectIds}
                    onSelectedIdsChange={setFormObjectIds}
                    disabled={isCreating}
                  />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dialogue" className="text-xs sm:text-sm">Dialogue</Label>
                  <Textarea
                    id="dialogue"
                    value={formData.dialogue}
                    onChange={(e) => setFormData(prev => ({ ...prev, dialogue: e.target.value }))}
                    placeholder="Character dialogue or narration"
                    rows={3}
                    className="text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="action" className="text-xs sm:text-sm">Action</Label>
                  <Textarea
                    id="action"
                    value={formData.action}
                    onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    placeholder="What happens in this shot"
                    rows={3}
                    className="text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="visual_notes" className="text-xs sm:text-sm">Visual Notes</Label>
                <Textarea
                  id="visual_notes"
                  value={formData.visual_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, visual_notes: e.target.value }))}
                  placeholder="Lighting, color, mood, special effects"
                  rows={3}
                  className="text-xs sm:text-sm"
                />
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false)
                    resetForm()
                  }}
                  className="w-full sm:w-auto text-xs sm:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateStoryboard}
                  disabled={isCreating}
                  className="gradient-button neon-glow text-white w-full sm:w-auto text-xs sm:text-sm"
                >
                  {isCreating ? "Creating..." : "Create Storyboard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Storyboard Dialog */}
        <Dialog
          open={showEditForm && !!editingStoryboard}
          onOpenChange={(open) => {
            if (!open && !isUpdating) closeEditStoryboardDialog()
          }}
        >
          <DialogContent className="cinema-card border-border w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            {editingStoryboard ? (
              <>
                <DialogHeader className="pb-2 min-w-0">
                  <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 min-w-0 pr-8 break-words">
                    <Edit className="h-5 w-5 flex-shrink-0" />
                    Edit Shot {displayShotNumber(editingStoryboard)}
                    {editingStoryboard.title ? ` · ${editingStoryboard.title}` : ""}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm break-words">
                    Update shot details, assignments, and AI image settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 sm:space-y-6 min-w-0 w-full overflow-hidden">
              {/* Basic Info */}
              <div>
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Shot title"
                />
              </div>

              <StoryboardShotPositionEditor
                storyboard={editingStoryboard}
                storyboards={storyboards}
                sceneId={sceneId}
                disabled={isUpdating}
                onChanged={async (updated) => {
                  await fetchStoryboards()
                  if (updated) {
                    setEditingStoryboard(updated)
                    setFormData((prev) => ({
                      ...prev,
                      shot_number: updated.shot_number,
                      sequence_order: updated.sequence_order ?? updated.shot_number,
                    }))
                  }
                }}
              />

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-shot_type">Shot Type</Label>
                  <Select value={formData.shot_type} onValueChange={(value) => setFormData(prev => ({ ...prev, shot_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-camera_angle">Camera Angle</Label>
                  <ShotCameraAngleSelect
                    id="edit-camera_angle"
                    value={formData.camera_angle}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, camera_angle: value }))}
                    disabled={isUpdating}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-movement">Camera Movement</Label>
                  <ShotMovementSelect
                    id="edit-movement"
                    value={formData.movement}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, movement: value }))}
                    disabled={isUpdating}
                  />
                </div>
              </div>

              {characters.length > 0 && (
                <div className="space-y-2">
                  <Label>Character / Avatar (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Assign characters to include their details and Avatar Studio images when generating
                  </p>
                  <AssignmentBadgePicker
                    kind="character"
                    items={characters.map((character) => ({
                      id: character.id,
                      name: character.name,
                      subtitle: character.archetype ?? undefined,
                    }))}
                    selectedIds={formCharacterIds}
                    onSelectedIdsChange={setFormCharacterIds}
                    disabled={isUpdating}
                  />
                </div>
              )}

              {locations.length > 0 && (
                <div className="space-y-2">
                  <Label>Location (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Assign locations to include their details when generating images
                  </p>
                  <AssignmentBadgePicker
                    kind="location"
                    items={locations.map((location) => ({
                      id: location.id,
                      name: location.name,
                      subtitle: location.type ?? undefined,
                    }))}
                    selectedIds={formLocationIds}
                    onSelectedIdsChange={setFormLocationIds}
                    disabled={isUpdating}
                  />
                </div>
              )}

              {storyObjects.length > 0 && (
                <div className="space-y-2">
                  <Label>Object (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Assign props, vehicles, and other story objects for image generation
                  </p>
                  <AssignmentBadgePicker
                    kind="object"
                    items={storyObjects.map((object) => ({
                      id: object.id,
                      name: object.name,
                      subtitle: object.category ?? undefined,
                    }))}
                    selectedIds={formObjectIds}
                    onSelectedIdsChange={setFormObjectIds}
                    disabled={isUpdating}
                  />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    
                    {/* Saved prompt */}
                    {(savedPrompts.length > 0 ||
                      (editingStoryboard &&
                        getStoryboardCharacterMasterPrompt(editingStoryboard))) ? (
                      <div className="mb-3 space-y-2">
                        <Label htmlFor="saved-prompt-select" className="text-xs text-muted-foreground">
                          Saved prompt
                        </Label>
                        <Select
                          value={selectedAiImagePromptId || "__none__"}
                          onValueChange={handleAiImagePromptSelect}
                          disabled={isLoadingPrompts}
                        >
                          <SelectTrigger id="saved-prompt-select" className="h-8 text-xs bg-input border-border">
                            <SelectValue
                              placeholder={
                                isLoadingPrompts
                                  ? "Loading prompts…"
                                  : "Apply a saved prompt…"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None (custom prompt)</SelectItem>
                            {editingStoryboard &&
                            getStoryboardCharacterMasterPrompt(editingStoryboard) ? (
                              <SelectItem value="__character_master__">
                                Character master prompt
                              </SelectItem>
                            ) : null}
                            {savedPrompts.map((prompt) => (
                              <SelectItem key={prompt.id} value={prompt.id}>
                                {prompt.title}
                                {prompt.type === "style" ? " (style)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Applies to the image prompt below. Saved in VisDev or character prompts.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mb-3">
                        No saved prompts for this movie yet — create some in VisDev.
                      </p>
                    )}
                    
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
                    
                    {/* Optional Character Details and Master Prompt Options */}
                    {editingStoryboard?.character_id && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
                        <div className="text-xs text-muted-foreground mb-1">Optional Enhancements:</div>
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2">
                            <input
                              id="include-character-details"
                              type="checkbox"
                              checked={includeCharacterDetails}
                              onChange={(e) => setIncludeCharacterDetails(e.target.checked)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <Label htmlFor="include-character-details" className="text-xs text-muted-foreground cursor-pointer">
                              Include Character Details
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              id="include-master-prompt"
                              type="checkbox"
                              checked={includeMasterPrompt}
                              onChange={(e) => setIncludeMasterPrompt(e.target.checked)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <Label htmlFor="include-master-prompt" className="text-xs text-muted-foreground cursor-pointer">
                              Include Master Prompt
                            </Label>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {hidePromptText && aiImagePromptFull ? (
                      <div className="space-y-2">
                        <div className="text-sm text-blue-500 font-medium">
                          {savedPrompts.find(p => p.prompt === aiImagePromptFull)?.title}
                        </div>
                        <Textarea
                          id="ai-image-prompt"
                          value={aiImagePrompt.replace(savedPrompts.find(p => p.prompt === aiImagePromptFull)?.title || '', '')}
                        onChange={(e) => {
                          setAiImagePrompt(savedPrompts.find(p => p.prompt === aiImagePromptFull)?.title + ' ' + e.target.value)
                          if (selectedAiImagePromptId) setSelectedAiImagePromptId("")
                        }}
                          placeholder="Type additional text here..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    ) : (
                      <Textarea
                        id="ai-image-prompt"
                        value={aiImagePrompt}
                        onChange={(e) => {
                          setAiImagePrompt(e.target.value)
                          if (selectedAiImagePromptId) setSelectedAiImagePromptId("")
                        }}
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
                  
                  <p className="text-xs text-muted-foreground break-words">
                    💡 Tip: Be specific about camera angle, lighting, mood, and visual style. The AI will create a cinematic storyboard image based on your description.
                  </p>
                </div>
              </div>

              {/* Reference Image Edit — opens in dialog */}
              <div className="border border-violet-500/20 rounded-lg p-4 bg-violet-500/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-violet-500" />
                      Reference Image Edit
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Edit the current shot image using your locked model and optional project references.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-violet-500/30 text-violet-600 hover:bg-violet-500/10 shrink-0"
                    onClick={() => openReferenceEditDialog(editingStoryboard)}
                  >
                    <Wand2 className="h-4 w-4" />
                    Edit Image
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={closeEditStoryboardDialog}
                  disabled={isUpdating}
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
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Storyboards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredStoryboards.map((storyboard, index) => {
            const dialogueText = getStoryboardDialogueText(storyboard)
            const hasDialogue = dialogueText.length > 0

            return (
            <div
              key={storyboard.id}
              id={`storyboard-shot-${storyboard.id}`}
              className={`flex flex-col scroll-mt-24 rounded-lg transition-shadow duration-300 ${
                jumpedShotId === storyboard.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
              }`}
            >
            <Card className={`cinema-card hover:neon-glow transition-all duration-300 flex-1 ${getStatusCardBorderStyle(storyboard.status || 'draft')}`}>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <StoryboardShotNumberPopover
                      storyboard={storyboard}
                      storyboards={storyboards}
                      sceneId={sceneId}
                      onChanged={fetchStoryboards}
                    />
                    <CardTitle className="text-base sm:text-lg break-words">{storyboard.title}</CardTitle>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs flex-shrink-0"
                  >
                    Shot
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  <span className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    Shot {displayShotNumber(storyboard)}
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
              <CardContent className="space-y-4 p-4 sm:p-6">
                {storyboard.image_url ? (
                  <div className="relative h-40 sm:h-48 bg-muted rounded-lg overflow-hidden group">
                    <button
                      type="button"
                      className="absolute inset-0 z-0 cursor-zoom-in"
                      title="Click to view full image"
                      onClick={() => openFullImageViewer(storyboard)}
                    >
                      <LazyShotImage
                        src={storyboard.image_url}
                        alt={storyboard.title}
                        thumbnailWidth={720}
                        thumbnailQuality={70}
                        className="absolute inset-0 w-full h-full"
                        imgClassName="w-full h-full object-contain transition-opacity group-hover:opacity-95"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-black/25">
                        <span className="rounded-full bg-black/60 text-white text-xs px-3 py-1.5">
                          View full image
                        </span>
                      </div>
                    </button>
                    {referenceEditingShotIds.has(storyboard.id) ? (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                        <span className="mt-2 text-sm font-medium text-white">
                          {referenceEditProgressByShotId.get(storyboard.id) || "Editing image…"}
                        </span>
                      </div>
                    ) : null}
                    <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="sm"
                        title="Insert an image from a scene shot or project asset"
                        onClick={(e) => {
                          e.stopPropagation()
                          openLinkImageDialog(storyboard)
                        }}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Insert
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation()
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
                  </div>
                ) : (
                  <div className="flex h-40 sm:h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                    {quickGeneratingShotIds.has(storyboard.id) ||
                    referenceEditingShotIds.has(storyboard.id) ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2
                          className={`h-8 w-8 animate-spin ${
                            referenceEditingShotIds.has(storyboard.id)
                              ? "text-violet-500"
                              : "text-purple-500"
                          }`}
                        />
                        <span className="text-sm font-medium">
                          {referenceEditingShotIds.has(storyboard.id)
                            ? referenceEditProgressByShotId.get(storyboard.id) || "Editing image…"
                            : "Generating image…"}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white"
                          disabled={quickGeneratingShotIds.has(storyboard.id)}
                          onClick={() => void quickGenerateShotImage(storyboard)}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Quick Generate
                        </Button>
                        <button
                          type="button"
                          onClick={() => openLinkImageDialog(storyboard)}
                          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Link2 className="h-5 w-5" />
                          <span className="text-xs">or insert from scene / assets</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                <StoryboardShotImages
                  images={storyboardImages.get(storyboard.id) ?? []}
                  activeImageUrl={storyboard.image_url}
                  onSelect={handleSelectStoryboardImage}
                  onDelete={handleDeleteStoryboardImage}
                  deletingImageId={deletingImageId}
                />

                {(referenceIssuesByStoryboardId.get(storyboard.id) ?? []).length > 0 ? (
                  <StoryboardReferenceIssues
                    issues={referenceIssuesByStoryboardId.get(storyboard.id) ?? []}
                    onDismiss={() =>
                      setReferenceIssuesByStoryboardId((prev) => {
                        const next = new Map(prev)
                        next.delete(storyboard.id)
                        return next
                      })
                    }
                  />
                ) : null}

                {sceneProjectId ? (
                  <StoryboardLayoutReferenceControl
                    storyboard={storyboard}
                    projectId={sceneProjectId}
                    disabled={
                      quickGeneratingShotIds.has(storyboard.id) ||
                      referenceEditingShotIds.has(storyboard.id)
                    }
                    onLayoutChange={saveStoryboardLayoutReference}
                  />
                ) : null}
                
                <div className="space-y-2">
                  {storyboard.description?.trim() ? (
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 break-words whitespace-pre-wrap">
                      {storyboard.description}
                    </p>
                  ) : null}

                  {hasDialogue ? (
                    <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Dialogue</span>
                      </div>
                      <p className="text-xs sm:text-sm italic text-foreground whitespace-pre-wrap line-clamp-5">
                        {dialogueText}
                      </p>
                    </div>
                  ) : null}

                  {storyboard.action?.trim() &&
                  storyboard.action.trim() !== storyboard.description?.trim() ? (
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Action</p>
                      <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap line-clamp-4">
                        {storyboard.action}
                      </p>
                    </div>
                  ) : null}

                  {sceneProjectId && (characters.length > 0 || locations.length > 0 || storyObjects.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1">
                      {characters.length > 0 && (
                        <AssignmentBadgePicker
                          kind="character"
                          items={characters.map((character) => ({
                            id: character.id,
                            name: character.name,
                            subtitle: character.archetype ?? undefined,
                          }))}
                          selectedIds={getStoryboardCharacterIds(storyboard)}
                          onSelectedIdsChange={(ids) => {
                            void applyStoryboardAssignments(
                              storyboard,
                              ids,
                              getStoryboardLocationIds(storyboard),
                              getStoryboardObjectIds(storyboard),
                            )
                          }}
                          disabled={updatingAssignmentStoryboardId === storyboard.id}
                        />
                      )}
                      {locations.length > 0 && (
                        <AssignmentBadgePicker
                          kind="location"
                          items={locations.map((location) => ({
                            id: location.id,
                            name: location.name,
                            subtitle: location.type ?? undefined,
                          }))}
                          selectedIds={getStoryboardLocationIds(storyboard)}
                          onSelectedIdsChange={(ids) => {
                            void applyStoryboardAssignments(
                              storyboard,
                              getStoryboardCharacterIds(storyboard),
                              ids,
                              getStoryboardObjectIds(storyboard),
                            )
                          }}
                          disabled={updatingAssignmentStoryboardId === storyboard.id}
                        />
                      )}
                      {storyObjects.length > 0 && (
                        <AssignmentBadgePicker
                          kind="object"
                          items={storyObjects.map((object) => ({
                            id: object.id,
                            name: object.name,
                            subtitle: object.category ?? undefined,
                          }))}
                          selectedIds={getStoryboardObjectIds(storyboard)}
                          onSelectedIdsChange={(ids) => {
                            void applyStoryboardAssignments(
                              storyboard,
                              getStoryboardCharacterIds(storyboard),
                              getStoryboardLocationIds(storyboard),
                              ids,
                            )
                          }}
                          disabled={updatingAssignmentStoryboardId === storyboard.id}
                        />
                      )}
                      {updatingAssignmentStoryboardId === storyboard.id && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {formatShotTypeLabel(storyboard.shot_type)}
                    </Badge>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {storyboard.camera_angle}
                    </Badge>
                    {hasDialogue ? (
                      <Badge className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex-shrink-0">
                        <MessageSquare className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Dialogue</span>
                      </Badge>
                    ) : null}
                    {storyboard.image_url && (
                      <Badge className="text-xs bg-green-500/20 text-green-500 border-green-500/30 flex-shrink-0">
                        <ImageIcon className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Has Image</span>
                        <span className="sm:hidden">Image</span>
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="break-words">Updated {new Date(storyboard.updated_at).toLocaleDateString()}</span>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      title="View full image"
                      disabled={!storyboard.image_url}
                      onClick={() => openFullImageViewer(storyboard)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {/* Insert image from scene shot or project asset */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:text-violet-500 flex-shrink-0"
                      title="Insert image from a scene shot or project asset"
                      onClick={() => openLinkImageDialog(storyboard)}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>

                    {/* Open AI generation form with prompt editor */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 hover:text-purple-600 flex-shrink-0"
                      title="Open AI image generator (custom prompt)"
                      onClick={() => openEditStoryboardDialog(storyboard, { prefillAiPrompt: true })}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>

                    {/* Redo existing image at cinematic landscape size */}
                    {storyboard.image_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:text-emerald-500 flex-shrink-0"
                        title="Redo same image at 1536×1024 landscape"
                        disabled={
                          regeneratingLandscapeId === storyboard.id ||
                          isGeneratingShotImage ||
                          referenceEditingShotIds.has(storyboard.id)
                        }
                        onClick={() => void regenerateShotAtLandscapeSize(storyboard)}
                      >
                        {regeneratingLandscapeId === storyboard.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RectangleHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}

                    {/* Secondary reference-based image edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0 hover:text-violet-500"
                      title={
                        storyboard.image_url
                          ? "Edit image from reference"
                          : "Generate image with AI"
                      }
                      disabled={referenceEditingShotIds.has(storyboard.id)}
                      onClick={() => {
                        closeEditStoryboardDialog()
                        openReferenceEditDialog(storyboard)
                      }}
                    >
                      {referenceEditingShotIds.has(storyboard.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                    </Button>

                    {/* Quick one-click AI image generation */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:text-purple-600 flex-shrink-0"
                      title={
                        storyboard.image_url
                          ? "Quick generate another image (adds to gallery)"
                          : "Quick generate image from shot details"
                      }
                      disabled={
                        quickGeneratingShotIds.has(storyboard.id) ||
                        referenceEditingShotIds.has(storyboard.id)
                      }
                      onClick={() => void quickGenerateShotImage(storyboard)}
                    >
                      {quickGeneratingShotIds.has(storyboard.id) ||
                      referenceEditingShotIds.has(storyboard.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 hover:text-blue-600"
                      onClick={() => openEditStoryboardDialog(storyboard)}
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
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/40 px-1 pt-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                title="Insert shot before this one"
                disabled={!!quickInsertingKey}
                onClick={() => void handleQuickInsertAdjacent(storyboard.id, "before")}
              >
                {quickInsertingKey === `before-${storyboard.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
              <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground select-none">
                Insert Shot
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                title="Insert shot after this one"
                disabled={!!quickInsertingKey}
                onClick={() => void handleQuickInsertAdjacent(storyboard.id, "after")}
              >
                {quickInsertingKey === `after-${storyboard.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
            </div>
            )
          })}
        </div>

        {filteredStoryboards.length === 0 && !isLoadingStoryboards && (
          <div className="text-center py-8 sm:py-12 px-4">
            <div className="text-muted-foreground mb-4">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2 break-words">No storyboards for this scene</h3>
              <p className="text-xs sm:text-sm break-words">
                {searchTerm || filterStatus !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Get started by creating your first storyboard for this scene"
                }
              </p>
            </div>
            {!searchTerm && filterStatus === "all" && (
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="gradient-button neon-glow text-white text-xs sm:text-sm w-full sm:w-auto"
              >
                <Plus className="sm:mr-2 h-4 w-4" />
                Create Storyboard
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Link Existing Image — project assets or scene shot */}
      <Dialog
        open={linkImageDialogOpen}
        onOpenChange={(open) => {
          setLinkImageDialogOpen(open)
          if (!open) {
            setLinkingStoryboard(null)
            setSelectedLinkAssetId(null)
            setSelectedLinkShotImage(null)
            setLinkImageSearch("")
            setLinkImageSource("scene")
          }
        }}
      >
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">Insert Image into Shot</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {linkingStoryboard
                ? `Add an image to Shot ${linkingStoryboard.shot_number}${linkingStoryboard.title ? ` · ${linkingStoryboard.title}` : ""} from another scene shot or a project asset.`
                : "Choose an image to use on this storyboard shot."}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={linkImageSource}
            onValueChange={(value) => {
              const next = value === "project" ? "project" : "scene"
              setLinkImageSource(next)
              setSelectedLinkAssetId(null)
              setSelectedLinkShotImage(null)
            }}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="scene" className="gap-1.5 text-xs sm:text-sm">
                <Film className="h-3.5 w-3.5" />
                Scene shots
              </TabsTrigger>
              <TabsTrigger value="project" className="gap-1.5 text-xs sm:text-sm">
                <ImageIcon className="h-3.5 w-3.5" />
                Project assets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scene" className="mt-4">
              {sceneProjectId ? (
                <StoryboardSceneShotImagePicker
                  projectId={sceneProjectId}
                  scenes={allScenes}
                  currentSceneId={sceneId}
                  currentSceneStoryboards={storyboards}
                  excludeStoryboardId={linkingStoryboard?.id}
                  selected={selectedLinkShotImage}
                  onSelect={setSelectedLinkShotImage}
                  userId={userId}
                  disabled={isLinkingImage}
                />
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Loading project…
                </p>
              )}
            </TabsContent>

            <TabsContent value="project" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-image-search">Search</Label>
                <Input
                  id="link-image-search"
                  value={linkImageSearch}
                  onChange={(e) => setLinkImageSearch(e.target.value)}
                  placeholder="Search by title, character, or location…"
                  className="bg-input border-border"
                />
              </div>

              {isLoadingProjectAssets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading project images…
                </div>
              ) : filteredLinkImageGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {projectImageAssets.length === 0
                      ? "No images in this project yet. Generate some on the Characters or Locations pages first."
                      : "No images match your search."}
                  </p>
                  {projectImageAssets.length === 0 && sceneProjectId && (
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/characters?movie=${sceneProjectId}`}>Characters</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/locations?movie=${sceneProjectId}`}>Locations</Link>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredLinkImageGroups.map((group) => (
                    <div key={group.label} className="space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {group.assets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() =>
                              setSelectedLinkAssetId((prev) =>
                                prev === asset.id ? null : asset.id,
                              )
                            }
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              selectedLinkAssetId === asset.id
                                ? "border-primary ring-2 ring-primary/40"
                                : "border-border hover:border-primary/50"
                            }`}
                            title={`${getProjectAssetSourceLabel(asset, locations, characters)} — ${asset.title}`}
                          >
                            <img
                              src={asset.content_url!}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedLinkAssetId && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 flex gap-3 items-center">
                  <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={
                        linkableImageAssets.find((a) => a.id === selectedLinkAssetId)?.content_url ||
                        ""
                      }
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {linkableImageAssets.find((a) => a.id === selectedLinkAssetId)?.title}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setLinkImageDialogOpen(false)}
              disabled={isLinkingImage}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleLinkExistingImageToShot()}
              disabled={
                isLinkingImage ||
                !linkingStoryboard ||
                (linkImageSource === "scene"
                  ? !selectedLinkShotImage
                  : !selectedLinkAssetId)
              }
              className="gap-2"
            >
              {isLinkingImage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Inserting…
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Insert into Shot
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full image viewer */}
      <Dialog
        open={fullImageViewerOpen}
        onOpenChange={(open) => {
          setFullImageViewerOpen(open)
          if (!open) {
            setFullImageUrl(null)
            setFullImageTitle("")
          }
        }}
      >
        <DialogContent className="flex flex-col gap-2 p-3 sm:p-4 w-[min(96vw,72rem)] h-[92vh] max-h-[92vh] max-w-[min(96vw,72rem)] sm:max-w-[min(96vw,72rem)] overflow-hidden">
          <DialogHeader className="shrink-0 px-1 pr-8">
            <DialogTitle className="truncate text-sm sm:text-base">
              {fullImageTitle || "Storyboard image"}
            </DialogTitle>
          </DialogHeader>
          {fullImageUrl ? (
            <div className="relative flex-1 min-h-0 w-full rounded-md bg-muted/40 overflow-hidden flex items-center justify-center">
              <img
                src={fullImageUrl}
                alt={fullImageTitle || "Storyboard image"}
                className="max-h-full max-w-full w-auto h-auto object-contain"
              />
              <ImageSizeBadge src={fullImageUrl} className="bottom-3 left-3 text-[11px] px-2 py-1" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reference image edit dialog */}
      <Dialog
        open={referenceEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeReferenceEditDialog()
        }}
      >
        <DialogContent className="cinema-card border-border w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader className="pb-2 min-w-0">
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 min-w-0 pr-8 break-words">
              <Wand2 className="h-5 w-5 text-violet-500" />
              {referenceEditStoryboard &&
              !hasPrimaryReferenceForEdit(referenceEditStoryboard, inlineShotReferenceFile)
                ? "Generate Image"
                : "Edit Image"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              {referenceEditStoryboard
                ? hasPrimaryReferenceForEdit(referenceEditStoryboard, inlineShotReferenceFile)
                  ? `Reference edit for Shot ${referenceEditStoryboard.shot_number}${referenceEditStoryboard.title ? ` · ${referenceEditStoryboard.title}` : ""}.`
                  : `Create an image for Shot ${referenceEditStoryboard.shot_number}${referenceEditStoryboard.title ? ` · ${referenceEditStoryboard.title}` : ""}.`
                : "Create or edit this storyboard shot image."}
            </DialogDescription>
          </DialogHeader>

          {referenceEditStoryboard && (
            <div className="min-w-0 w-full overflow-hidden">
              {referenceEditStoryboard.image_url && (
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30 max-h-40">
                  <img
                    src={referenceEditStoryboard.image_url}
                    alt={referenceEditStoryboard.title}
                    className="w-full h-full max-h-40 object-contain"
                  />
                </div>
              )}
              {renderStoryboardReferenceEdit(
                referenceEditStoryboard,
                "reference-edit-dialog",
                true,
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ContentViolationDialog
        isOpen={Boolean(contentBlockedDialog)}
        onClose={() => setContentBlockedDialog(null)}
        contentType="image"
        originalPrompt={contentBlockedDialog?.prompt || ""}
        onPromptUpdated={(rewritten) => {
          setAiImagePrompt(rewritten)
          setAiImagePromptFull(rewritten)
        }}
        onRetryWithPrompt={async (rewritten) => {
          if (!contentBlockedDialog) return
          const { storyboardId: blockedStoryboardId, options } = contentBlockedDialog
          setContentBlockedDialog(null)
          await generateShotImage(blockedStoryboardId, rewritten, {
            ...options,
            skipEnrichment: true,
          })
        }}
        onTryDifferentPrompt={() => {
          document.getElementById("storyboard-image-prompt")?.focus()
        }}
      />

      <AlertDialog open={showClearStoryboardsConfirm} onOpenChange={setShowClearStoryboardsConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all storyboards for this scene?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {storyboards.length} storyboard
              {storyboards.length === 1 ? "" : "s"} in this scene so you can start over.
              Storyboards in other scenes will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingStoryboards}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleClearStoryboards()
              }}
              disabled={isClearingStoryboards}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearingStoryboards ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                "Clear all storyboards"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {filteredStoryboards.length > 0 && (
        <nav
          aria-label="Jump to shot"
          className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/90 backdrop-blur-md"
        >
          <div
            className="flex items-stretch gap-px overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 py-1.5 touch-pan-x"
            onWheel={(event) => {
              if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
              event.currentTarget.scrollLeft += event.deltaY
              event.preventDefault()
            }}
          >
            {filteredStoryboards.map((storyboard) => {
              const label = displayShotNumber(storyboard)
              const status = storyboard.status || "draft"
              return (
                <button
                  key={storyboard.id}
                  type="button"
                  title={`Jump to shot ${label}`}
                  onClick={() => scrollToShot(storyboard.id)}
                  className={`h-8 min-w-fit flex-1 shrink-0 whitespace-nowrap rounded border px-1.5 font-mono text-[11px] leading-none tabular-nums hover:bg-muted ${getStatusJumperStyle(status)} ${
                    jumpedShotId === storyboard.id ? "bg-muted text-foreground" : ""
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
  
  // Debug logging after render
  console.log("🎬 Component render completed successfully!")
}
