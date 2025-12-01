"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Save,
  Loader2,
  RefreshCw,
  Bot,
  Volume2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Download,
  ChevronDown,
  ChevronUp,
  Upload,
  ArrowDown,
  Film,
  Sparkles,
  Edit,
  Trash2,
  X,
  Users,
  Copy,
  MessageSquare,
  MapPin,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
} from "lucide-react"
import jsPDF from "jspdf"
import { useToast } from "@/hooks/use-toast"
import { useParams, useRouter } from "next/navigation"
import { AssetService, type Asset } from "@/lib/asset-service"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from '@/lib/supabase'
import TextToSpeech from "@/components/text-to-speech"
import AITextEditor from "@/components/ai-text-editor"
import { Navigation } from "@/components/navigation"
import { MovieService, type Movie } from "@/lib/movie-service"
import FileImport from "@/components/file-import"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScreenplayScenesService, type ScreenplayScene, type CreateScreenplaySceneData } from "@/lib/screenplay-scenes-service"
import { TimelineService, type CreateSceneData } from "@/lib/timeline-service"
import { AISettingsService } from "@/lib/ai-settings-service"
import { CharactersService } from "@/lib/characters-service"
import { LocationsService } from "@/lib/locations-service"
import { ShotListComponent } from "@/components/shot-list"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

// Screenplay page number calculation (standard: ~55 lines per page)
const LINES_PER_PAGE = 55

// Helper function to parse scene number for sorting (same logic as TimelineService)
function parseSceneNumber(sceneNumber: string): number {
  if (!sceneNumber || !sceneNumber.trim()) return 0
  
  const trimmed = sceneNumber.trim()
  
  // Extract the numeric part
  const numericMatch = trimmed.match(/^(\d+)/)
  if (!numericMatch) return 0
  
  const numericPart = parseInt(numericMatch[1], 10)
  
  // Extract the letter part (if any)
  const letterMatch = trimmed.match(/^(\d+)([A-Za-z])/)
  if (letterMatch) {
    const letter = letterMatch[2].toUpperCase()
    const letterValue = letter.charCodeAt(0) - 64 // A=1, B=2, C=3, etc.
    return numericPart + (letterValue / 10)
  }
  
  // If no letter, just return the number
  return numericPart
}

// Helper function to sort screenplay scenes by scene number and order_index
function sortScreenplayScenes(scenes: ScreenplayScene[]): ScreenplayScene[] {
  return [...scenes].sort((a, b) => {
    // First try to sort by scene number
    const aNumber = parseSceneNumber(a.scene_number || '')
    const bNumber = parseSceneNumber(b.scene_number || '')
    
    if (aNumber !== bNumber) {
      return aNumber - bNumber
    }
    
    // If scene numbers are the same or both 0, fall back to order_index
    const aOrder = a.order_index || 0
    const bOrder = b.order_index || 0
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder
    }
    
    // Finally, sort by creation date as a last resort
    const aDate = new Date(a.created_at || 0).getTime()
    const bDate = new Date(b.created_at || 0).getTime()
    return aDate - bDate
  })
}

export default function ScreenplayPage() {
  const params = useParams()
  const id = params.id as string

  return <ScreenplayPageClient id={id} />
}

function ScreenplayPageClient({ id }: { id: string }) {
  const { toast } = useToast()
  const { user, userId, ready } = useAuthReady()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [movie, setMovie] = useState<Movie | null>(null)
  const [scriptAssets, setScriptAssets] = useState<Asset[]>([])
  const [fullScript, setFullScript] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pages, setPages] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editedPages, setEditedPages] = useState<Map<number, string>>(new Map())
  const [saving, setSaving] = useState(false)
  
  // AI text editing states
  const [showAITextEditor, setShowAITextEditor] = useState(false)
  const [aiEditData, setAiEditData] = useState<{
    selectedText: string;
    fullContent: string;
    assetId: string;
    field: 'content';
  } | null>(null)
  
  // Text selection and toolbar states
  const [selectedText, setSelectedText] = useState<string>("")
  const [selectionStart, setSelectionStart] = useState<number>(0)
  const [selectionEnd, setSelectionEnd] = useState<number>(0)
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Active script asset
  const [activeScriptAsset, setActiveScriptAsset] = useState<Asset | null>(null)
  
  // File import collapsible state
  const [isFileImportExpanded, setIsFileImportExpanded] = useState(false)
  
  // Screenplay scenes states
  const [screenplayScenes, setScreenplayScenes] = useState<ScreenplayScene[]>([])
  const [sceneBoundaries, setSceneBoundaries] = useState<Array<{sceneNumber: string, sceneName: string, position: number}>>([])
  const [isLoadingScenes, setIsLoadingScenes] = useState(false)
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingScene, setEditingScene] = useState<Partial<ScreenplayScene>>({})
  const [isSavingScene, setIsSavingScene] = useState(false)
  
  // Delete confirmation states
  const [showDeletePageConfirm, setShowDeletePageConfirm] = useState(false)
  const [showDeleteEntireConfirm, setShowDeleteEntireConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Characters and locations for screenplay toolbar
  const [characters, setCharacters] = useState<Array<{id: string; name: string}>>([])
  const [locations, setLocations] = useState<Array<{id: string; name: string; type?: string | null}>>([])
  const [loadingCharacters, setLoadingCharacters] = useState(false)
  const [loadingLocations, setLoadingLocations] = useState(false)
  
  // Collaboration states
  const [showCollaborationDialog, setShowCollaborationDialog] = useState(false)
  const [collaborationSession, setCollaborationSession] = useState<any>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [collaborationForm, setCollaborationForm] = useState({
    title: "",
    description: "",
    expires_at: "",
    allow_guests: true,
    allow_edit: true,
    allow_delete: true,
    allow_add_scenes: true,
    allow_edit_scenes: true,
  })
  
  // Text enhancer states
  const [textEnhancerSettings, setTextEnhancerSettings] = useState<{model: string; prefix: string}>({
    model: 'gpt-4o-mini',
    prefix: ''
  })
  const [userApiKeys, setUserApiKeys] = useState<{openai_api_key?: string; anthropic_api_key?: string}>({})
  const [isEnhancingText, setIsEnhancingText] = useState(false)
  const [isRegeneratingScene, setIsRegeneratingScene] = useState<string | null>(null)
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())
  const [isScenesCardExpanded, setIsScenesCardExpanded] = useState(false)
  const [aiSettings, setAiSettings] = useState<any[]>([])
  const [selectedScriptAIService, setSelectedScriptAIService] = useState<string>('')
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)

  // Fetch movie data
  useEffect(() => {
    if (!ready || !userId) return
    
    const fetchMovie = async () => {
      try {
        setLoading(true)
        const movieData = await MovieService.getMovieById(id)
        setMovie(movieData)
      } catch (error) {
        console.error('Error fetching movie:', error)
        toast({
          title: "Error",
          description: "Failed to load movie data.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchMovie()
  }, [id, ready, userId])

  // Load timeline scenes (shared with timeline page)
  useEffect(() => {
    if (id && ready && userId) {
      loadTimelineScenes(id)
    }
  }, [id, ready, userId])

  // Load text enhancer settings and API keys
  useEffect(() => {
    if (!ready || !userId) return
    fetchTextEnhancerSettings()
    fetchUserApiKeys()
  }, [ready, userId])

  // Load characters and locations when movie is available
  useEffect(() => {
    if (!movie?.id || !ready) return
    
    const loadData = async () => {
      try {
        setLoadingCharacters(true)
        const chars = await CharactersService.getCharacters(movie.id)
        setCharacters(chars.map(c => ({ id: c.id, name: c.name })))
      } catch (error) {
        console.error('Error loading characters:', error)
        setCharacters([])
      } finally {
        setLoadingCharacters(false)
      }
      
      try {
        setLoadingLocations(true)
        const locs = await LocationsService.getLocations(movie.id)
        setLocations(locs.map(l => ({ id: l.id, name: l.name, type: l.type })))
      } catch (error) {
        console.error('Error loading locations:', error)
        setLocations([])
      } finally {
        setLoadingLocations(false)
      }
    }
    
    loadData()
  }, [movie?.id, ready])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready) return
      
      try {
        const settings = await AISettingsService.getSystemSettings()
        
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting('scripts'),
        ])
        
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
        
        const scriptsSetting = mergedSettings.find(setting => setting.tab_type === 'scripts')
        if (scriptsSetting?.is_locked && scriptsSetting.locked_model) {
          setSelectedScriptAIService(scriptsSetting.locked_model)
        } else if (scriptsSetting?.selected_model) {
          setSelectedScriptAIService(scriptsSetting.selected_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  // Fetch script assets for the project
  useEffect(() => {
    if (!ready || !userId || !id) return
    
    const fetchScripts = async () => {
      try {
        setLoading(true)
        
        // Get all script assets for this project
        const assets = await AssetService.getAssetsForProject(id)
        const scripts = assets.filter(a => a.content_type === 'script' && a.is_latest_version)
        
        // Separate project-level scripts from scene-level scripts
        const projectScripts = scripts.filter(s => s.project_id && !s.scene_id)
        const sceneScripts = scripts.filter(s => s.scene_id)
        
        // Cleanup: If there are multiple project-level scripts, mark all but the latest as not latest
        if (projectScripts.length > 1) {
          projectScripts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          const latestScript = projectScripts[0]
          const olderScripts = projectScripts.slice(1)
          
          if (olderScripts.length > 0) {
            await getSupabaseClient()
              .from('assets')
              .update({ is_latest_version: false })
              .in('id', olderScripts.map(s => s.id))
            
            console.log(`Marked ${olderScripts.length} older project-level scripts as not latest`)
          }
        }
        
        // Sort project scripts by created_at to get the latest
        projectScripts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        // Use the LATEST project-level script only (don't combine multiple project scripts)
        if (projectScripts.length > 0) {
          const latestProjectScript = projectScripts[0]
          console.log('Using project-level script:', latestProjectScript.title)
          setActiveScriptAsset(latestProjectScript)
          setFullScript(latestProjectScript.content || "")
          setScriptAssets([latestProjectScript])
        } else {
          // If no project-level script, always try to fetch screenplay_content from scenes
          console.log('No project-level scripts found, fetching from scenes...')
          console.log('Scene script assets found:', sceneScripts.length)
          await fetchScriptsFromScenes()
        }
      } catch (error) {
        console.error('Error fetching scripts:', error)
        toast({
          title: "Error",
          description: "Failed to load screenplay.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchScripts()
  }, [id, ready, userId])

  // Fetch scripts from scenes if no project-level scripts exist
  const fetchScriptsFromScenes = async () => {
    try {
      console.log('📝 fetchScriptsFromScenes: Starting to fetch screenplay from scenes...')
      
      // Get timeline for this project - need to check shared access
      // First get the project to find the owner
      const { data: project, error: projectError } = await getSupabaseClient()
        .from('projects')
        .select('user_id')
        .eq('id', id)
        .maybeSingle()

      if (projectError || !project) {
        console.log('❌ fetchScriptsFromScenes: Project not found')
        return
      }

      // Check if user has access (owner or shared)
      const isOwner = project.user_id === userId
      let hasAccess = isOwner
      
      if (!isOwner) {
        const { data: share, error: shareError } = await getSupabaseClient()
          .from('project_shares')
          .select('*')
          .eq('project_id', id)
          .or(`shared_with_user_id.eq.${userId},shared_with_email.eq.${user?.email}`)
          .eq('is_revoked', false)
          .maybeSingle()

        hasAccess = !shareError && share && (!share.deadline || new Date(share.deadline) > new Date())
      }
      
      if (!hasAccess) {
        console.log('❌ fetchScriptsFromScenes: User does not have access to this project')
        return
      }

      // Get timeline using owner's user_id (timelines are created by owner)
      const { data: timeline, error: timelineError } = await getSupabaseClient()
        .from('timelines')
        .select('id')
        .eq('project_id', id)
        .eq('user_id', project.user_id) // Use owner's user_id
        .maybeSingle()

      if (timelineError || !timeline) {
        console.log('❌ fetchScriptsFromScenes: No timeline found for project')
        return
      }

      console.log('✅ fetchScriptsFromScenes: Found timeline:', timeline.id)

      // Get all scenes for this timeline with screenplay_content
      // RLS policy will handle access control for shared users
      const { data: scenes, error: scenesError } = await getSupabaseClient()
        .from('scenes')
        .select('id, name, metadata, order_index, screenplay_content, created_at, updated_at')
        .eq('timeline_id', timeline.id)

      if (scenesError) {
        console.error('❌ fetchScriptsFromScenes: Error fetching scenes:', scenesError)
        return
      }

      if (!scenes || scenes.length === 0) {
        console.log('❌ fetchScriptsFromScenes: No scenes found for timeline')
        setFullScript("")
        setScriptAssets([])
        setActiveScriptAsset(null)
        return
      }

      console.log(`✅ fetchScriptsFromScenes: Found ${scenes.length} scenes`)
      
      // Log which scenes have screenplay_content
      const scenesWithScreenplayContent = scenes.filter(s => s.screenplay_content && s.screenplay_content.trim().length > 0)
      console.log(`📄 fetchScriptsFromScenes: ${scenesWithScreenplayContent.length} scenes have screenplay_content`)
      scenesWithScreenplayContent.forEach(scene => {
        console.log(`   - Scene "${scene.name}" (${scene.metadata?.sceneNumber || 'no number'}): ${scene.screenplay_content?.length || 0} chars`)
      })

      // Sort scenes by scene number (using the same logic as TimelineService)
      const sortedScenes = scenes.sort((a, b) => {
        const aNumber = parseSceneNumber(a.metadata?.sceneNumber || '')
        const bNumber = parseSceneNumber(b.metadata?.sceneNumber || '')
        
        if (aNumber !== bNumber) {
          return aNumber - bNumber
        }
        
        // Fall back to order_index if scene numbers are the same
        const aOrder = a.order_index || 0
        const bOrder = b.order_index || 0
        
        if (aOrder !== bOrder) {
          return aOrder - bOrder
        }
        
        // Finally, sort by creation date
        const aDate = new Date(a.created_at || 0).getTime()
        const bDate = new Date(b.created_at || 0).getTime()
        return aDate - bDate
      })

      // Get scripts for each scene (as fallback)
      // RLS policy will handle access control for shared users
      const sceneIds = sortedScenes.map(s => s.id)
      const { data: sceneScripts, error: scriptsError } = await getSupabaseClient()
        .from('assets')
        .select('*')
        .in('scene_id', sceneIds)
        .eq('content_type', 'script')
        .eq('is_latest_version', true)
        .order('created_at', { ascending: false })

      if (scriptsError) {
        console.error('Error fetching scene scripts:', scriptsError)
        // Continue anyway - we might have screenplay_content on scenes
      }

      // Combine scripts in scene order, prioritizing screenplay_content from scenes
      const scenesWithContent = sortedScenes.filter(scene => {
        const hasScreenplayContent = scene.screenplay_content && scene.screenplay_content.trim().length > 0
        const hasScriptAsset = sceneScripts?.some(s => s.scene_id === scene.id)
        if (hasScreenplayContent || hasScriptAsset) {
          console.log(`✅ Scene "${scene.name}" has content (screenplay: ${hasScreenplayContent}, asset: ${hasScriptAsset})`)
        }
        return hasScreenplayContent || hasScriptAsset
      })

      if (scenesWithContent.length === 0) {
        console.log('❌ fetchScriptsFromScenes: No screenplay content found in any scenes')
        console.log('   Checking scenes:')
        sortedScenes.forEach(scene => {
          const hasContent = scene.screenplay_content && scene.screenplay_content.trim().length > 0
          const hasAsset = sceneScripts?.some(s => s.scene_id === scene.id)
          console.log(`   - "${scene.name}": screenplay_content=${hasContent}, script_asset=${hasAsset}`)
        })
        setFullScript("")
        setScriptAssets([])
        setActiveScriptAsset(null)
        return
      }

      console.log(`✅ fetchScriptsFromScenes: Found ${scenesWithContent.length} scenes with content to combine`)

      // Combine scripts in scene order and track scene info for visual separators
      const sceneInfo: Array<{sceneNumber: string, sceneName: string, content: string}> = []
      const combinedScript = scenesWithContent
        .map(scene => {
          // Prioritize screenplay_content from scene, fall back to script asset
          let content = ''
          if (scene.screenplay_content && scene.screenplay_content.trim().length > 0) {
            content = scene.screenplay_content
          } else if (sceneScripts) {
            const sceneScript = sceneScripts.find(s => s.scene_id === scene.id)
            if (sceneScript) {
              content = sceneScript.content || ""
            }
          }
          
          if (!content || content.trim().length === 0) {
            return null
          }
          
          // Store scene info for visual separators
          const sceneNumber = scene.metadata?.sceneNumber || scene.scene_number || ''
          sceneInfo.push({
            sceneNumber: sceneNumber,
            sceneName: scene.name || '',
            content: content
          })
          
          // Return content without scene markers - they'll be displayed as visual separators in the UI
          return content
        })
        .filter(Boolean)
        .join("\n\n")
      
      // Store scene info for display - this will be used to add separators
      setSceneBoundaries(sceneInfo.map((info, index) => ({
        sceneNumber: info.sceneNumber,
        sceneName: info.sceneName,
        position: index // Use index to identify scene position
      })))
      
      if (combinedScript.trim().length === 0) {
        console.log('❌ fetchScriptsFromScenes: Combined script is empty')
        setFullScript("")
        setScriptAssets([])
        setActiveScriptAsset(null)
        return
      }
      
      console.log(`✅ fetchScriptsFromScenes: Combined screenplay has ${combinedScript.length} characters`)
      console.log(`✅ fetchScriptsFromScenes: Preview (first 200 chars):`, combinedScript.substring(0, 200))
      
      setFullScript(combinedScript)
      
      // Create virtual assets for screenplay_content if needed
      const virtualAssets: Asset[] = scenesWithContent.map(scene => {
        const sceneNumber = scene.metadata?.sceneNumber || ''
        return {
          id: `scene-${scene.id}`,
          project_id: id,
          scene_id: scene.id,
          user_id: userId!,
          title: `Scene ${sceneNumber || scene.name}`,
          content: scene.screenplay_content || sceneScripts?.find(s => s.scene_id === scene.id)?.content || '',
          content_type: 'script',
          created_at: scene.created_at || new Date().toISOString(),
          updated_at: scene.updated_at || new Date().toISOString(),
          is_latest_version: true,
        } as Asset
      })
      
      setScriptAssets(virtualAssets)
      
      // Use the combined script as the active script
      setActiveScriptAsset({
        id: `combined-${id}`,
        project_id: id,
        user_id: userId!,
        title: `${movie?.name || 'Screenplay'} - Full Script`,
        content: combinedScript,
        content_type: 'script',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_latest_version: true,
      } as Asset)
      
      console.log('Successfully fetched and combined screenplay from', scenesWithContent.length, 'scenes')
    } catch (error) {
      console.error('Error fetching scripts from scenes:', error)
      toast({
        title: "Error",
        description: "Failed to fetch screenplay from scenes",
        variant: "destructive",
      })
    }
  }

  // Calculate pages from script content
  useEffect(() => {
    if (!fullScript) {
      setPages([])
      setTotalPages(1)
      return
    }

    const lines = fullScript.split('\n')
    const pageCount = Math.ceil(lines.length / LINES_PER_PAGE)
    setTotalPages(pageCount)

    // Split script into pages
    const pageArray: string[] = []
    for (let i = 0; i < pageCount; i++) {
      const startLine = i * LINES_PER_PAGE
      const endLine = Math.min(startLine + LINES_PER_PAGE, lines.length)
      const pageContent = lines.slice(startLine, endLine).join('\n')
      pageArray.push(pageContent)
    }

    setPages(pageArray)
  }, [fullScript])

  // Handle script editing
  const handleEdit = () => {
    // Initialize editedPages with current pages
    const initialPages = new Map<number, string>()
    if (pages.length > 0) {
      pages.forEach((pageContent, index) => {
        initialPages.set(index + 1, pageContent)
      })
    } else {
      // If no script exists, start with one empty page
      initialPages.set(1, "")
      setTotalPages(1)
      setCurrentPage(1)
    }
    setEditedPages(initialPages)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedPages(new Map())
  }

  // Get current page edit content
  const getCurrentPageEditContent = () => {
    if (!isEditing) return ""
    return editedPages.get(currentPage) || pages[currentPage - 1] || ""
  }

  // Save current page edit
  const saveCurrentPageEdit = (content: string) => {
    if (!isEditing) return
    setEditedPages(prev => {
      const newMap = new Map(prev)
      newMap.set(currentPage, content)
      return newMap
    })
  }

  // Insert text at cursor position in textarea
  const insertTextAtCursor = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentContent = getCurrentPageEditContent()
    const newContent = currentContent.substring(0, start) + text + currentContent.substring(end)
    
    // Update state
    saveCurrentPageEdit(newContent)
    
    // Directly update textarea value and cursor position for immediate feedback
    textarea.value = newContent
    const newPosition = start + text.length
    textarea.setSelectionRange(newPosition, newPosition)
    textarea.focus()
    
    // Trigger onChange to sync with state
    const event = new Event('input', { bubbles: true })
    textarea.dispatchEvent(event)
  }

  // Insert action line
  const insertActionLine = () => {
    insertTextAtCursor('\n\n')
  }

  // Insert character name (with proper 22-space indentation)
  const insertCharacter = (characterName: string) => {
    const name = characterName.toUpperCase()
    const spaces = ' '.repeat(22)
    insertTextAtCursor(`\n${spaces}${name}\n`)
  }

  // Insert location (scene heading)
  const insertLocation = (locationName: string, locationType?: string | null) => {
    const intExt = locationType === 'interior' ? 'INT.' : locationType === 'exterior' ? 'EXT.' : 'INT.'
    insertTextAtCursor(`\n${intExt} ${locationName.toUpperCase()} - DAY\n`)
  }

  // Insert scene heading (INT/EXT)
  const insertSceneHeading = () => {
    insertTextAtCursor('\nINT. LOCATION - DAY\n')
  }

  // Insert dialogue (with proper 12-space indentation)
  const insertDialogue = () => {
    insertTextAtCursor('\n            ') // Newline + 12 spaces for dialogue indentation
  }

  // Insert title page format (centered)
  const insertTitlePage = () => {
    // Center text on an 80-character line (standard screenplay width)
    // Using explicit spacing for accurate centering
    const centerText = (text: string) => {
      const lineWidth = 80
      const textLength = text.length
      const leftPadding = Math.floor((lineWidth - textLength) / 2)
      // Use explicit spaces to ensure proper centering
      return '                                        '.substring(0, Math.max(0, leftPadding)) + text
    }
    
    // Title page with proper vertical spacing (centered on page)
    // Standard title page has ~20-25 blank lines before title
    const titlePage = `















${centerText('TITLE HERE')}


${centerText('Written by')}


${centerText('AUTHOR NAME')}

















`
    insertTextAtCursor(titlePage)
  }

  // Helper function to center text on an 80-character line
  const centerText = (text: string) => {
    const lineWidth = 80
    const centerPosition = 40 // Center of 80-character line (0-indexed, between 39 and 40)
    
    // Remove any existing leading/trailing spaces from the text
    const trimmed = text.trim()
    const textLength = trimmed.length
    
    if (textLength > lineWidth) {
      // Text is too long, just return it as-is
      console.log('🎯 CENTER DEBUG: Text too long, returning as-is', { text, textLength, lineWidth })
      return trimmed
    }
    
    // Calculate where the center of the text should be positioned
    // The center of the text is at textLength/2
    // To center it at position 40, we need: leftPadding = 40 - textLength/2
    // Round to nearest integer for best visual centering
    const textCenter = textLength / 2
    const leftPadding = Math.round(centerPosition - textCenter)
    const rightPadding = lineWidth - leftPadding - textLength
    
    // Create spaces using String.repeat for reliability
    const leftSpaces = ' '.repeat(leftPadding)
    const rightSpaces = ' '.repeat(rightPadding)
    
    const result = leftSpaces + trimmed + rightSpaces
    const resultLength = result.length
    
    // Verify the result by counting actual spaces
    const leftSpacesCount = result.match(/^ */)?.[0].length || 0
    const rightSpacesCount = result.match(/ *$/)?.[0].length || 0
    
    // Create a visual representation for debugging (using dots to show spaces)
    const visualRep = '·'.repeat(Math.min(leftSpacesCount, 40)) + trimmed + '·'.repeat(Math.min(rightSpacesCount, 40))
    
    // Create a reference line showing where center should be (character 40)
    const referenceLine = '|'.repeat(39) + '^' + '|'.repeat(40) // ^ marks position 40 (center of 80)
    
    // Log in a more readable format
    const totalPadding = leftPadding + rightPadding
    const calculatedCenter = leftPadding + textCenter
    console.log('🎯 CENTER DEBUG:')
    console.log('  Original text:', `"${text}"`)
    console.log('  Trimmed text:', `"${trimmed}"`)
    console.log('  Text length:', textLength)
    console.log('  Text center (char position):', textCenter)
    console.log('  Line width:', lineWidth)
    console.log('  Target center position:', centerPosition)
    console.log('  Left padding:', leftPadding, 'spaces')
    console.log('  Right padding:', rightPadding, 'spaces')
    console.log('  Total padding:', totalPadding)
    console.log('  Result length:', resultLength, '(expected:', lineWidth, ')')
    console.log('  Actual left spaces:', leftSpacesCount)
    console.log('  Actual right spaces:', rightSpacesCount)
    console.log('  Calculated center position:', calculatedCenter, '(expected: 40)')
    console.log('  Center offset from target:', Math.abs(calculatedCenter - centerPosition))
    console.log('  Visual representation:', visualRep)
    console.log('  Reference line (^ = center):', referenceLine)
    console.log('  Is properly centered:', Math.abs(calculatedCenter - centerPosition) <= 0.5 && resultLength === lineWidth)
    console.log('  Full result:', `"${result}"`)
    
    return result
  }

  // Helper function to right-align text on an 80-character line
  const rightAlignText = (text: string) => {
    const lineWidth = 80
    const trimmed = text.trim()
    const textLength = trimmed.length
    const leftPadding = Math.max(0, lineWidth - textLength)
    return ' '.repeat(leftPadding) + trimmed
  }

  // Align selected text or current line
  const alignText = (alignment: 'left' | 'center' | 'right') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentContent = getCurrentPageEditContent()
    
    console.log('🎯 ALIGN DEBUG - Start:')
    console.log('  Alignment:', alignment)
    console.log('  Selection start:', start)
    console.log('  Selection end:', end)
    console.log('  Content length:', currentContent.length)
    
    // Get the line containing the cursor or selection
    const lines = currentContent.split('\n')
    let startLine = 0
    let endLine = 0
    let charCount = 0
    
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1 // +1 for newline
      if (charCount <= start && start < charCount + lineLength) {
        startLine = i
      }
      if (charCount <= end && end <= charCount + lineLength) {
        endLine = i
        break
      }
      charCount += lineLength
    }
    
    console.log('🎯 ALIGN DEBUG - Lines:')
    console.log('  Start line:', startLine)
    console.log('  End line:', endLine)
    console.log('  Total lines:', lines.length)
    console.log('  Selected lines:', lines.slice(startLine, endLine + 1).map(l => `"${l}"`))
    
    // Format the selected lines
    for (let i = startLine; i <= endLine; i++) {
      if (lines[i] && lines[i].trim()) {
        const trimmed = lines[i].trim()
        const original = lines[i]
        if (alignment === 'center') {
          lines[i] = centerText(trimmed)
          console.log('🎯 ALIGN DEBUG - Centered line:')
          console.log('  Original:', `"${original}"`)
          console.log('  Trimmed:', `"${trimmed}"`)
          console.log('  Result:', `"${lines[i]}"`)
          console.log('  Result length:', lines[i].length)
        } else if (alignment === 'right') {
          lines[i] = rightAlignText(trimmed)
        } else {
          lines[i] = trimmed // Left align (flush left)
        }
      }
    }
    
    const newContent = lines.join('\n')
    saveCurrentPageEdit(newContent)
    
    // Update textarea
    textarea.value = newContent
    textarea.focus()
    
    // Trigger onChange
    const event = new Event('input', { bubbles: true })
    textarea.dispatchEvent(event)
  }

  // Combine edited pages into full script
  const combineEditedPages = (): string => {
    if (!isEditing) return fullScript
    
    // Get the maximum page number from either editedPages or totalPages
    const maxPage = Math.max(
      totalPages,
      editedPages.size > 0 ? Math.max(...Array.from(editedPages.keys())) : 1
    )
    
    const combinedPages: string[] = []
    for (let i = 1; i <= maxPage; i++) {
      // For the current page, check textarea first to get latest unsaved content
      if (i === currentPage && textareaRef.current) {
        const textareaContent = textareaRef.current.value
        if (textareaContent !== undefined) {
          combinedPages.push(textareaContent)
          continue
        }
      }
      
      const editedContent = editedPages.get(i)
      if (editedContent !== undefined) {
        combinedPages.push(editedContent)
      } else if (pages[i - 1] !== undefined) {
        combinedPages.push(pages[i - 1])
      } else {
        // Include empty pages to preserve page structure
        combinedPages.push("")
      }
    }
    
    // Join pages with newline to preserve structure
    // Each page already has its lines separated by '\n'
    // We need to ensure that when pages are split back by line count (55 lines per page),
    // the content stays on the correct page. To do this, we pad pages that have fewer than
    // 55 lines with empty lines so that the next page starts at the right line number.
    const paddedPages: string[] = []
    for (let i = 0; i < combinedPages.length; i++) {
      const pageContent = combinedPages[i]
      const lineCount = pageContent.split('\n').length
      
      // If this page has fewer than 55 lines and it's not the last page, pad it
      if (lineCount < LINES_PER_PAGE && i < combinedPages.length - 1) {
        const paddingNeeded = LINES_PER_PAGE - lineCount
        const padding = '\n'.repeat(paddingNeeded)
        paddedPages.push(pageContent + padding)
      } else {
        paddedPages.push(pageContent)
      }
    }
    
    const result = paddedPages
      .filter(page => page !== undefined) // Remove undefined pages
      .join('\n')
    
    console.log('🔍 Combining pages:', {
      maxPage,
      pagesCount: combinedPages.length,
      paddedPagesCount: paddedPages.length,
      resultLength: result.length,
      resultLines: result.split('\n').length,
      firstPageLines: combinedPages[0]?.split('\n').length,
      secondPageLines: combinedPages[1]?.split('\n').length,
      firstPagePaddedLines: paddedPages[0]?.split('\n').length,
      secondPagePaddedLines: paddedPages[1]?.split('\n').length,
    })
    
    return result
  }

  const handleSave = async () => {
    if (!userId) return

    try {
      setSaving(true)

      // Combine all edited pages into full script
      // combineEditedPages will get the current page from textarea if editing
      const combinedContent = combineEditedPages()
      
      console.log('💾 Saving combined content:', {
        contentLength: combinedContent.length,
        contentLines: combinedContent.split('\n').length,
        first100Chars: combinedContent.substring(0, 100),
        last100Chars: combinedContent.substring(Math.max(0, combinedContent.length - 100)),
      })
      
      // Save current page content to state after combining (for consistency)
      if (isEditing && textareaRef.current) {
        saveCurrentPageEdit(textareaRef.current.value)
      }

      // Check if this is a scene-based script or project-level script
      const isSceneBased = activeScriptAsset?.scene_id || scriptAssets.some(s => s.scene_id)
      
      if (isSceneBased || !activeScriptAsset) {
        // This is a combined script from scenes or new script, create/update a project-level asset
        // First, mark old project-level scripts as not latest
        const { data: oldProjectScripts } = await getSupabaseClient()
          .from('assets')
          .select('id')
          .eq('project_id', id)
          .eq('user_id', userId)
          .eq('content_type', 'script')
          .eq('is_latest_version', true)
          .is('scene_id', null)
        
        if (oldProjectScripts && oldProjectScripts.length > 0) {
          await getSupabaseClient()
            .from('assets')
            .update({ is_latest_version: false })
            .in('id', oldProjectScripts.map(s => s.id))
        }
        
        // Create new project-level asset
        await AssetService.createAsset({
          project_id: id,
          title: `${movie?.name || 'Screenplay'} - Full Script`,
          content_type: 'script',
          content: combinedContent,
          version_name: 'Full Script',
        })
        
        toast({
          title: "Script Saved",
          description: "Your screenplay has been saved as a new project-level script.",
        })
      } else {
        // Update existing project-level asset
        // Also mark other project-level scripts as not latest
        const { data: otherProjectScripts } = await getSupabaseClient()
          .from('assets')
          .select('id')
          .eq('project_id', id)
          .eq('user_id', userId)
          .eq('content_type', 'script')
          .eq('is_latest_version', true)
          .is('scene_id', null)
          .neq('id', activeScriptAsset.id)
        
        if (otherProjectScripts && otherProjectScripts.length > 0) {
          await getSupabaseClient()
            .from('assets')
            .update({ is_latest_version: false })
            .in('id', otherProjectScripts.map(s => s.id))
        }
        
        await AssetService.updateAsset(activeScriptAsset.id, {
          content: combinedContent,
        })
        
        toast({
          title: "Script Updated",
          description: "Your screenplay has been updated successfully.",
        })
      }

      // Refresh scripts - only get the latest project-level script
      const assets = await AssetService.getAssetsForProject(id)
      const projectScripts = assets.filter(a => 
        a.content_type === 'script' && 
        a.is_latest_version && 
        a.project_id && 
        !a.scene_id
      )
      projectScripts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      if (projectScripts.length > 0) {
        setActiveScriptAsset(projectScripts[0])
        setFullScript(projectScripts[0].content || "")
        setScriptAssets([projectScripts[0]])
      } else {
        // Fall back to scene scripts if no project-level script
        await fetchScriptsFromScenes()
      }

      setIsEditing(false)
      setEditedPages(new Map())
    } catch (error) {
      console.error('Error saving script:', error)
      toast({
        title: "Error",
        description: "Failed to save screenplay.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Debug function to log container and textarea dimensions
  const debugContainerDimensions = () => {
    const textarea = textareaRef.current
    if (!textarea) {
      console.log('📐 CONTAINER DEBUG: Textarea not found')
      return
    }
    
    const textareaRect = textarea.getBoundingClientRect()
    const textareaStyles = window.getComputedStyle(textarea)
    
    // Find parent containers
    const cardContent = textarea.closest('[class*="CardContent"]') || textarea.closest('.card-content')
    const card = textarea.closest('[class*="Card"]') || textarea.closest('.card')
    const container = textarea.closest('[class*="container"]')
    
    const cardContentRect = cardContent?.getBoundingClientRect()
    const cardRect = card?.getBoundingClientRect()
    const containerRect = container?.getBoundingClientRect()
    
    console.log('📐 CONTAINER DEBUG - Dimensions:')
    console.log('  Textarea:')
    console.log('    - Computed width:', textareaStyles.width)
    console.log('    - Computed max-width:', textareaStyles.maxWidth)
    console.log('    - Computed min-width:', textareaStyles.minWidth)
    console.log('    - Actual width (getBoundingClientRect):', textareaRect.width, 'px')
    console.log('    - Style width:', textarea.style.width)
    console.log('    - Style maxWidth:', textarea.style.maxWidth)
    console.log('    - Style minWidth:', textarea.style.minWidth)
    console.log('    - Padding left:', textareaStyles.paddingLeft)
    console.log('    - Padding right:', textareaStyles.paddingRight)
    console.log('    - Font size:', textareaStyles.fontSize)
    console.log('    - Font family:', textareaStyles.fontFamily)
    
    if (cardContentRect) {
      console.log('  CardContent:')
      console.log('    - Width:', cardContentRect.width, 'px')
      console.log('    - Padding:', window.getComputedStyle(cardContent as Element).padding)
    }
    
    if (cardRect) {
      console.log('  Card:')
      console.log('    - Width:', cardRect.width, 'px')
      console.log('    - Max-width:', window.getComputedStyle(card as Element).maxWidth)
    }
    
    if (containerRect) {
      console.log('  Container:')
      console.log('    - Width:', containerRect.width, 'px')
      console.log('    - Max-width:', window.getComputedStyle(container as Element).maxWidth)
    }
    
    // Calculate expected width for 80 characters
    const fontSize = parseFloat(textareaStyles.fontSize)
    const charWidth = fontSize * 0.6 // Approximate for monospace (Courier New)
    const expectedWidth = (80 * charWidth) + 24 // 80 chars + 24px padding
    console.log('  Calculations:')
    console.log('    - Font size:', fontSize, 'px')
    console.log('    - Estimated char width:', charWidth, 'px')
    console.log('    - Expected width for 80ch + 24px:', expectedWidth, 'px')
    console.log('    - Actual textarea width:', textareaRect.width, 'px')
    console.log('    - Difference:', textareaRect.width - expectedWidth, 'px')
  }

  // Update toolbar position based on textarea position
  const updateToolbarPosition = (textarea: HTMLTextAreaElement) => {
    const rect = textarea.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft
    
    // Position toolbar above the textarea, aligned to the left
    // Offset by scroll position to keep it fixed relative to viewport
    setToolbarPosition({
      top: rect.top + scrollTop - 50,
      left: rect.left + scrollLeft + 10
    })
  }
  
  // Handle text selection for AI editing
  const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (!isEditing) return
    
    const target = e.target as HTMLTextAreaElement
    const start = target.selectionStart
    const end = target.selectionEnd
    const selection = target.value.substring(start, end)
    
    if (selection.length > 0) {
      setSelectedText(selection)
      setSelectionStart(start)
      setSelectionEnd(end)
      
      // Calculate toolbar position based on textarea position
      updateToolbarPosition(target)
    } else {
      setSelectedText("")
      setToolbarPosition(null)
    }
  }
  
  // Update toolbar position on scroll
  useEffect(() => {
    if (!isEditing || !selectedText || !toolbarPosition) return
    
    const handleScroll = () => {
      const textarea = document.querySelector('textarea[data-screenplay-editor]') as HTMLTextAreaElement
      if (textarea) {
        updateToolbarPosition(textarea)
      }
    }
    
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isEditing, selectedText, toolbarPosition])

  // Debug container dimensions when textarea is rendered or window resizes
  useEffect(() => {
    if (!isEditing) return
    
    const debugOnMount = () => {
      // Wait a bit for DOM to settle
      setTimeout(() => {
        debugContainerDimensions()
      }, 100)
    }
    
    debugOnMount()
    window.addEventListener('resize', debugOnMount)
    
    return () => {
      window.removeEventListener('resize', debugOnMount)
    }
  }, [isEditing, currentPage])
  
  // Clear selection when clicking outside (with delay to allow toolbar button clicks)
  useEffect(() => {
    if (!isEditing) {
      setSelectedText("")
      setToolbarPosition(null)
      return
    }
    
    let clickTimeout: NodeJS.Timeout | null = null
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Don't clear if clicking on toolbar, textarea, or AI editor dialog
      if (
        target.closest('textarea[data-screenplay-editor]') ||
        target.closest('[data-selection-toolbar]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[data-radix-dialog-content]')
      ) {
        // Clear any pending timeout
        if (clickTimeout) {
          clearTimeout(clickTimeout)
          clickTimeout = null
        }
        return
      }
      
      // Clear selection after a short delay to allow toolbar interactions
      clickTimeout = setTimeout(() => {
        setSelectedText("")
        setToolbarPosition(null)
        clickTimeout = null
      }, 150)
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (clickTimeout) {
        clearTimeout(clickTimeout)
      }
    }
  }, [isEditing])

  // Handle AI edit button click from toolbar
  const handleAITextEdit = () => {
    if (!isEditing || !selectedText || selectedText.length === 0) {
      toast({
        title: "No Text Selected",
        description: "Please select some text to edit with AI.",
        variant: "destructive",
      })
      return
    }
    
    if (activeScriptAsset) {
      const currentPageContent = getCurrentPageEditContent()
      setAiEditData({
        selectedText: selectedText,
        fullContent: currentPageContent,
        assetId: activeScriptAsset.id,
        field: 'content'
      })
      setShowAITextEditor(true)
    }
  }


  // Handle AI text replacement
  const handleAITextReplace = (newText: string) => {
    if (!aiEditData || !isEditing) return
    
    // Get current textarea and its selection to ensure we use the latest positions
    const textarea = document.querySelector('textarea[data-screenplay-editor]') as HTMLTextAreaElement
    const currentPageContent = getCurrentPageEditContent()
    
    if (!textarea) {
      // Fallback to stored selection positions
      const newValue = currentPageContent.substring(0, selectionStart) + newText + currentPageContent.substring(selectionEnd)
      saveCurrentPageEdit(newValue)
    } else {
      // Use current textarea selection positions (in case content changed)
      // Try to use stored positions first, but validate them
      let start = selectionStart
      let end = selectionEnd
      
      // Validate that stored positions are still valid
      if (start < 0 || end > currentPageContent.length || start > end) {
        // Fallback to textarea's current selection
        start = textarea.selectionStart
        end = textarea.selectionEnd
      }
      
      // Replace the selected text
      const newValue = currentPageContent.substring(0, start) + newText + currentPageContent.substring(end)
      saveCurrentPageEdit(newValue)
      
      // Set cursor position after replacement
      setTimeout(() => {
        const newCursorPos = start + newText.length
        textarea.focus()
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 50)
    }
    
    // Clear selection and toolbar
    setSelectedText("")
    setToolbarPosition(null)
    setAiEditData(null)
    setShowAITextEditor(false)
    
    toast({
      title: "Text Replaced",
      description: "The AI-generated text has been applied to your selection.",
    })
  }

  // Fetch text enhancer settings
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

  // Fetch user API keys
  const fetchUserApiKeys = async () => {
    if (!userId) return
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('openai_api_key, anthropic_api_key')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user API keys:', error)
        return
      }

      setUserApiKeys({
        openai_api_key: data?.openai_api_key || undefined,
        anthropic_api_key: data?.anthropic_api_key || undefined
      })
    } catch (error) {
      console.error('Error fetching user API keys:', error)
    }
  }

  // Enhance current page
  const enhanceCurrentPage = async () => {
    if (!isEditing) {
      toast({
        title: "Error",
        description: "Please enter edit mode first",
        variant: "destructive",
      })
      return
    }

    const currentPageContent = getCurrentPageEditContent()
    if (!currentPageContent || !currentPageContent.trim()) {
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
      const fullPrompt = `${prefix}\n\n${currentPageContent}`

      // Determine which API to use based on model
      const isAnthropic = model.startsWith('claude-')
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
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: fullPrompt
            }]
          })
        })

        if (!anthropicResponse.ok) {
          const errorData = await anthropicResponse.json().catch(() => ({}))
          throw new Error(errorData.error?.message || `Anthropic API error: ${anthropicResponse.status}`)
        }

        const data = await anthropicResponse.json()
        response = data.content[0]?.text || ''
      } else {
        // Use OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{
              role: 'user',
              content: fullPrompt
            }],
            temperature: 0.7
          })
        })

        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json().catch(() => ({}))
          throw new Error(errorData.error?.message || `OpenAI API error: ${openaiResponse.status}`)
        }

        const data = await openaiResponse.json()
        response = data.choices[0]?.message?.content || ''
      }

      if (!response || !response.trim()) {
        throw new Error('Empty response from AI')
      }

      // Update the current page with enhanced text
      saveCurrentPageEdit(response.trim())
      
      toast({
        title: "Text Enhanced",
        description: "The current page has been enhanced by AI.",
      })
    } catch (error: any) {
      console.error('Error enhancing text:', error)
      toast({
        title: "Enhancement Failed",
        description: error.message || "Failed to enhance text. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsEnhancingText(false)
    }
  }

  // Get current page content
  const getCurrentPageContent = () => {
    if (isEditing) {
      return getCurrentPageEditContent()
    }
    return pages[currentPage - 1] || fullScript
  }

  // Get current page text for audio generation
  const getCurrentPageText = () => {
    if (isEditing) {
      return getCurrentPageEditContent()
    }
    return pages[currentPage - 1] || ""
  }

  // Navigate to page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      // If editing, save current page edits before switching
      if (isEditing && textareaRef.current) {
        saveCurrentPageEdit(textareaRef.current.value)
      }
      setCurrentPage(page)
    }
  }

  // Push last line(s) from current page to next page
  const handlePushToNextPage = () => {
    if (!isEditing) return
    
    // Save current page content first
    const currentContent = textareaRef.current?.value || getCurrentPageEditContent()
    if (!currentContent.trim()) {
      toast({
        title: "No Content",
        description: "Current page is empty. Nothing to push.",
        variant: "destructive",
      })
      return
    }

    const lines = currentContent.split('\n')
    if (lines.length === 0) return

    // Find the last non-empty line (skip trailing empty lines)
    let lastNonEmptyIndex = lines.length - 1
    while (lastNonEmptyIndex >= 0 && !lines[lastNonEmptyIndex].trim()) {
      lastNonEmptyIndex--
    }

    if (lastNonEmptyIndex < 0) {
      toast({
        title: "No Content",
        description: "Current page only has empty lines. Nothing to push.",
        variant: "destructive",
      })
      return
    }

    // Take the last non-empty line and any trailing empty lines after it
    const linesToPush = lines.slice(lastNonEmptyIndex)
    const remainingLines = lines.slice(0, lastNonEmptyIndex)

    // Update current page with remaining lines
    const updatedCurrentPage = remainingLines.join('\n')

    // Get or create next page - use current editedPages state
    const nextPageNum = currentPage + 1
    const currentNextPageContent = editedPages.get(nextPageNum) || pages[nextPageNum - 1] || ""
    
    // Add the pushed line(s) to the beginning of next page
    const pushedContent = linesToPush.join('\n')
    const updatedNextPage = currentNextPageContent 
      ? `${pushedContent}\n${currentNextPageContent}`
      : pushedContent

    // Update editedPages with both pages in a single state update
    // This ensures both updates happen atomically
    setEditedPages(prev => {
      const newMap = new Map(prev)
      // Update current page
      newMap.set(currentPage, updatedCurrentPage)
      // Update next page
      newMap.set(nextPageNum, updatedNextPage)
      
      return newMap
    })
    
    // Update totalPages if we're creating a new page
    if (nextPageNum > totalPages) {
      setTotalPages(nextPageNum)
    }

    toast({
      title: "Content Pushed",
      description: `Last line(s) moved to page ${nextPageNum}.`,
    })
  }

  // Delete current page
  const handleDeleteCurrentPage = async () => {
    if (!userId || totalPages === 0) return
    
    try {
      setIsDeleting(true)
      
      // If editing, save current page content first
      if (isEditing && textareaRef.current) {
        saveCurrentPageEdit(textareaRef.current.value)
      }
      
      // Build new full script without the current page
      const allPages: string[] = []
      
      // Collect all pages content
      for (let i = 1; i <= totalPages; i++) {
        if (i !== currentPage) {
          let pageContent: string
          if (isEditing) {
            pageContent = editedPages.get(i) || pages[i - 1] || ""
          } else {
            pageContent = pages[i - 1] || ""
          }
          allPages.push(pageContent)
        }
      }
      
      // Rebuild fullScript by joining all remaining pages
      const newFullScript = allPages.join('\n')
      
      // Check if all content is deleted
      if (newFullScript.trim().length === 0) {
        // All content deleted
        setFullScript("")
        setPages([])
        setEditedPages(new Map())
        setTotalPages(1)
        setCurrentPage(1)
        
        // Delete the asset if it exists
        if (activeScriptAsset) {
          try {
            await AssetService.deleteAsset(activeScriptAsset.id)
            setActiveScriptAsset(null)
            setScriptAssets([])
          } catch (error) {
            console.error('Error deleting asset:', error)
          }
        }
        
        toast({
          title: "Page Deleted",
          description: `Page ${currentPage} has been deleted. The script is now empty.`,
        })
        
        setShowDeletePageConfirm(false)
        return
      }
      
      // Update fullScript - this will trigger the useEffect to rebuild pages
      setFullScript(newFullScript)
      
      // Adjust current page if needed (will be recalculated by useEffect)
      // If we deleted the last page or the current page is beyond the new total, go to the last page
      if (currentPage >= totalPages) {
        // Will be adjusted after pages are rebuilt by useEffect
        // For now, set to a safe value - will be corrected after useEffect runs
        setCurrentPage(Math.max(1, currentPage - 1))
      }
      
      // Clear editedPages if we're not in editing mode
      if (!isEditing) {
        setEditedPages(new Map())
      } else {
        // Rebuild editedPages with adjusted page numbers
        const newEditedPages = new Map<number, string>()
        let newPageNum = 1
        for (let i = 1; i <= totalPages; i++) {
          if (i !== currentPage) {
            const content = editedPages.get(i) || pages[i - 1] || ""
            newEditedPages.set(newPageNum, content)
            newPageNum++
          }
        }
        setEditedPages(newEditedPages)
      }
      
      // Save the updated script if we have an active asset
      if (activeScriptAsset && newFullScript.trim()) {
        try {
          await AssetService.updateAsset(activeScriptAsset.id, {
            content: newFullScript,
          })
          
          toast({
            title: "Page Deleted",
            description: `Page ${currentPage} has been deleted and the script has been saved.`,
          })
        } catch (error) {
          console.error('Error saving after page deletion:', error)
          toast({
            title: "Page Deleted",
            description: `Page ${currentPage} has been deleted locally. There was an error saving to the database.`,
            variant: "destructive",
          })
        }
      } else if (newFullScript.trim()) {
        // Create new asset if no active asset exists
        try {
          const newAsset = await AssetService.createAsset({
            project_id: id,
            title: `${movie?.name || 'Screenplay'} - Full Script`,
            content_type: 'script',
            content: newFullScript,
            version_name: 'Full Script',
          })
          setActiveScriptAsset(newAsset)
          setScriptAssets([newAsset])
          
          toast({
            title: "Page Deleted",
            description: `Page ${currentPage} has been deleted and the script has been saved.`,
          })
        } catch (error) {
          console.error('Error creating asset after page deletion:', error)
          toast({
            title: "Page Deleted",
            description: `Page ${currentPage} has been deleted locally. There was an error saving to the database.`,
            variant: "destructive",
          })
        }
      }
      
      setShowDeletePageConfirm(false)
    } catch (error) {
      console.error('Error deleting page:', error)
      toast({
        title: "Error",
        description: "Failed to delete page. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Delete entire screenplay
  const handleDeleteEntireScreenplay = async () => {
    if (!userId) return
    
    try {
      setIsDeleting(true)
      
      // Delete all script assets for this project
      const scriptAssetIds = scriptAssets
        .filter(asset => asset.content_type === 'script')
        .map(asset => asset.id)
      
      // Also check for any other script assets we might have missed
      const { data: allScriptAssets, error: fetchError } = await getSupabaseClient()
        .from('assets')
        .select('id')
        .eq('project_id', id)
        .eq('user_id', userId)
        .eq('content_type', 'script')
      
      if (!fetchError && allScriptAssets) {
        const allIds = allScriptAssets.map(a => a.id)
        const uniqueIds = Array.from(new Set([...scriptAssetIds, ...allIds]))
        
        // Delete all script assets
        for (const assetId of uniqueIds) {
          try {
            await AssetService.deleteAsset(assetId)
          } catch (error) {
            console.error(`Error deleting asset ${assetId}:`, error)
          }
        }
      }
      
      // Clear all state
      setFullScript("")
      setPages([])
      setTotalPages(1)
      setCurrentPage(1)
      setScriptAssets([])
      setActiveScriptAsset(null)
      setEditedPages(new Map())
      setIsEditing(false)
      
      toast({
        title: "Screenplay Deleted",
        description: "The entire screenplay has been deleted.",
      })
      
      setShowDeleteEntireConfirm(false)
    } catch (error) {
      console.error('Error deleting entire screenplay:', error)
      toast({
        title: "Error",
        description: "Failed to delete screenplay. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Helper functions for AI settings
  const isScriptsTabLocked = () => {
    const setting = aiSettings.find(s => s.tab_type === 'scripts')
    return setting?.is_locked || false
  }

  const getScriptsTabLockedModel = () => {
    const setting = aiSettings.find(s => s.tab_type === 'scripts')
    return setting?.locked_model || ""
  }

  // Load timeline scenes (shared scenes - same as timeline page)
  const loadTimelineScenes = async (projectId: string) => {
    if (!ready || !userId) return
    
    try {
      setIsLoadingScenes(true)
      
      // Get or create timeline for the project
      let timeline = await TimelineService.getTimelineForMovie(projectId)
      if (!timeline) {
        timeline = await TimelineService.createTimelineForMovie(projectId, {
          name: `${movie?.name || 'Movie'} Timeline`,
          description: `Timeline for ${movie?.name || 'Movie'}`,
          duration_seconds: 0,
          fps: 24,
          resolution_width: 1920,
          resolution_height: 1080,
        })
      }
      
      // Load scenes from timeline (same as timeline page uses)
      const scenes = await TimelineService.getScenesForTimeline(timeline.id)
      
      // Convert timeline scenes to screenplay scene format for display
      const screenplayScenesData = scenes.map(scene => ({
        id: scene.id,
        project_id: projectId,
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
        content: (scene as any).screenplay_content || scene.description || '',
        metadata: scene.metadata || {},
        order_index: scene.order_index || 0,
        created_at: scene.created_at,
        updated_at: scene.updated_at,
      }))
      
      // Sort scenes to ensure proper order (by scene number, then order_index, then created_at)
      const sortedScenes = sortScreenplayScenes(screenplayScenesData as any)
      
      setScreenplayScenes(sortedScenes)
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

  // Generate scenes from screenplay using AI
  const generateScenesFromScreenplay = async () => {
    if (!fullScript || !ready || !userId) return

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

    // Get the model from AI settings
    const scriptsSetting = aiSettings.find((s: any) => s.tab_type === 'scripts')
    const modelToUse = scriptsSetting?.selected_model || 
                      (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

    try {
      setIsGeneratingScenes(true)

      const scriptForPrompt = fullScript.length > 8000 
        ? fullScript.substring(0, 8000) + '...'
        : fullScript

      const aiPrompt = `Based on the following screenplay, break it down into individual scene titles.

REQUIREMENTS:
- Analyze the screenplay and create scene titles that naturally cover all the story beats
- Create as many scenes as needed to properly break down the story - let the content determine the number
- Each scene should have:
  * Scene number (e.g., "1", "2", "3")
  * Name/title (brief, descriptive, 2-5 words)
  * Description (1 sentence describing what happens in the scene)

OUTPUT FORMAT: Return a JSON array of scenes. Each scene should be an object with ONLY these fields:
{
  "scene_number": "1",
  "name": "Opening Scene",
  "description": "Brief one sentence description of what happens."
}

Screenplay:
${scriptForPrompt}

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
          model: modelToUse, // Pass the model from AI settings
          apiKey: 'configured',
          userId: userId,
          maxTokens: 8000, // Increased for scene generation
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate scenes')
      }

      const data = await response.json()
      let scenes: any[] = []

      // Parse the response (same logic as treatment scenes)
      try {
        let jsonText = data.text || data.response || data.content || ''
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        
        const objectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g
        const objectMatches = jsonText.match(objectPattern)
        
        if (objectMatches && objectMatches.length > 0) {
          scenes = []
          for (const objStr of objectMatches) {
            try {
              const parsedObj = JSON.parse(objStr)
              if (parsedObj && (parsedObj.name || parsedObj.scene_number || parsedObj.description)) {
                scenes.push(parsedObj)
              }
            } catch (objError) {
              console.warn('Skipping invalid scene object:', objError)
            }
          }
        } else {
          const jsonMatch = jsonText.match(/\[[\s\S]*/)
          if (jsonMatch) {
            let arrayText = jsonMatch[0]
            if (!arrayText.endsWith(']')) {
              const lastCompleteObj = arrayText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)
              if (lastCompleteObj && lastCompleteObj.length > 0) {
                arrayText = '[' + lastCompleteObj.join(',') + ']'
              } else {
                arrayText = arrayText + ']'
              }
            }
            try {
              scenes = JSON.parse(arrayText)
            } catch (arrayError) {
              const objects = jsonText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || []
              scenes = objects.map(obj => {
                try {
                  return JSON.parse(obj)
                } catch {
                  return null
                }
              }).filter(Boolean)
            }
          }
        }
        
        if (!Array.isArray(scenes)) {
          scenes = [scenes]
        }
        
        scenes = scenes.filter(s => s && (s.name || s.scene_number || s.description))
        
      } catch (parseError) {
        console.error('Error parsing scenes JSON:', parseError)
        toast({
          title: "Error",
          description: "Failed to parse generated scenes. Please try again.",
          variant: "destructive",
        })
        return
      }

      // Get or create timeline for the project
      let timeline = await TimelineService.getTimelineForMovie(id)
      if (!timeline) {
        timeline = await TimelineService.createTimelineForMovie(id, {
          name: `${movie?.name || 'Movie'} Timeline`,
          description: `Timeline for ${movie?.name || 'Movie'}`,
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
              location: '',
              characters: [],
              shotType: '',
              mood: '',
              notes: '',
              status: 'draft',
            }
          }

          const createdScene = await TimelineService.createScene(sceneData)
          
          // Convert to screenplay scene format for local state
          const screenplaySceneData = {
            id: createdScene.id,
            project_id: id,
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
          
          createdScenes.push(screenplaySceneData)
          lastEndTime += durationSeconds
        }
      }

      const allScenes = [...screenplayScenes, ...createdScenes as any]
      setScreenplayScenes(sortScreenplayScenes(allScenes))

      toast({
        title: "Success",
        description: `Generated ${createdScenes.length} scenes from screenplay`,
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
  const handleStartEditScene = (scene: ScreenplayScene) => {
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

  // Save edited scene (updates timeline scene directly)
  const handleSaveScene = async () => {
    if (!editingSceneId || !id) return

    try {
      setIsSavingScene(true)
      
      // Get timeline for the project
      let timeline = await TimelineService.getTimelineForMovie(id)
      if (!timeline) {
        timeline = await TimelineService.createTimelineForMovie(id, {
          name: `${movie?.name || 'Movie'} Timeline`,
          description: `Timeline for ${movie?.name || 'Movie'}`,
          duration_seconds: 0,
          fps: 24,
          resolution_width: 1920,
          resolution_height: 1080,
        })
      }

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
      
      // Convert back to screenplay scene format for local state
      const updatedScreenplayScene = {
        id: updatedScene.id,
        project_id: id,
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
      
      const updatedScenes = screenplayScenes.map(s => s.id === editingSceneId ? updatedScreenplayScene as any : s)
      setScreenplayScenes(sortScreenplayScenes(updatedScenes))
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

  // Delete a scene (deletes from timeline scenes directly)
  const handleDeleteScene = async (sceneId: string) => {
    try {
      await TimelineService.deleteScene(sceneId)
      const filteredScenes = screenplayScenes.filter(s => s.id !== sceneId)
      setScreenplayScenes(sortScreenplayScenes(filteredScenes))
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

  // Regenerate a single scene with AI (only fills empty fields)
  const regenerateSceneWithAI = async (scene: ScreenplayScene) => {
    if (!fullScript || !ready || !userId) return

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

    // Get the model from AI settings
    const scriptsSetting = aiSettings.find((s: any) => s.tab_type === 'scripts')
    const modelToUse = scriptsSetting?.selected_model || 
                      (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

    try {
      setIsRegeneratingScene(scene.id)

      const scriptContext = fullScript.length > 2000 
        ? fullScript.substring(0, 2000) + '...'
        : fullScript

      const aiPrompt = `Based on the following screenplay, generate or enhance details for this scene. Only fill in fields that are currently empty or missing.

SCREENPLAY CONTEXT:
${scriptContext}

CURRENT SCENE:
- Scene Number: ${scene.scene_number || 'N/A'}
- Name: ${scene.name}
- Description: ${scene.description || 'N/A (needs generation)'}
- Location: ${scene.location || 'N/A (needs generation)'}
- Characters: ${scene.characters?.join(', ') || 'N/A (needs generation)'}
- Shot Type: ${scene.shot_type || 'N/A (needs generation)'}
- Mood: ${scene.mood || 'N/A (needs generation)'}
- Notes: ${scene.notes || 'N/A (needs generation)'}

REQUIREMENTS:
- Keep the same scene number and name
- Only generate fields that are marked as "needs generation" (empty/missing)
- If a field already has a value, do NOT change it
- For description: CRITICAL - You MUST write a MINIMUM of 3-5 full sentences. Each sentence should be complete and detailed. The description must include:
  * What happens in the scene (the main action/event)
  * Character actions and behaviors
  * Dialogue context or key exchanges
  * Emotional tone and atmosphere
  * Key story beats or plot points
  DO NOT write just one sentence. Write multiple detailed sentences that paint a complete picture.
  
  Example of GOOD description (3-5 sentences):
  "The protagonist enters the dimly lit coffee shop, scanning the room nervously. They spot their contact sitting in a corner booth, tapping their fingers impatiently. As they approach, the contact slides a manila envelope across the table without making eye contact. The protagonist's hands tremble slightly as they reach for the envelope, knowing its contents will change everything. The tension in the air is palpable as other customers seem to sense something is wrong."
  
  Example of BAD description (too short):
  "The protagonist meets their contact in a coffee shop."
  
- For location: where the scene takes place
- For characters: list of main characters in the scene
- For shot type: appropriate shot type (e.g., "Wide", "Close-up", "Medium", "Two-shot")
- For mood: scene tone (e.g., "Tense", "Comedic", "Dramatic", "Action-packed")
- For notes: any important production details

OUTPUT FORMAT: Return a JSON object with ONLY the fields that need to be filled (don't include fields that already have values):
{
  "description": "MUST be 3-5 complete sentences. Each sentence should be detailed and descriptive. Do not write just one sentence.",
  "location": "Location name",
  "characters": ["Character 1", "Character 2"],
  "shot_type": "Shot type",
  "mood": "Mood/tone",
  "notes": "Production notes"
}

CRITICAL REQUIREMENT: The description field MUST contain at least 3-5 full sentences. Do not write a single sentence. Write multiple detailed sentences that fully describe the scene. Return ONLY the JSON object, no other text:`

      const response = await fetch('/api/ai/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: 'scene',
          service: normalizedService,
          model: modelToUse, // Pass the model from AI settings
          apiKey: 'configured',
          userId: userId,
          maxTokens: 4000, // Increased for detailed scene descriptions
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

      // For individual regeneration, always update fields if AI generated them
      // This allows enhancing/expanding existing descriptions
      // Update timeline scene directly
      const updates: Partial<CreateSceneData> = {
        metadata: {}
      }
      
      if (regeneratedScene.description) {
        updates.description = regeneratedScene.description
        // Also keep existing metadata values, just update what's new
        updates.metadata = {
          ...scene.metadata,
          description: regeneratedScene.description,
        }
      }
      if (regeneratedScene.location) {
        updates.metadata = {
          ...updates.metadata,
          ...scene.metadata,
          location: regeneratedScene.location,
        }
      }
      if (regeneratedScene.characters && regeneratedScene.characters.length > 0) {
        updates.metadata = {
          ...updates.metadata,
          ...scene.metadata,
          characters: regeneratedScene.characters,
        }
      }
      if (regeneratedScene.shot_type) {
        updates.metadata = {
          ...updates.metadata,
          ...scene.metadata,
          shotType: regeneratedScene.shot_type,
        }
      }
      if (regeneratedScene.mood) {
        updates.metadata = {
          ...updates.metadata,
          ...scene.metadata,
          mood: regeneratedScene.mood,
        }
      }
      if (regeneratedScene.notes) {
        updates.metadata = {
          ...updates.metadata,
          ...scene.metadata,
          notes: regeneratedScene.notes,
        }
      }

      // Ensure we preserve existing metadata that wasn't regenerated
      updates.metadata = {
        sceneNumber: scene.metadata?.sceneNumber || scene.scene_number || '',
        status: scene.metadata?.status || scene.status || 'Planning',
        ...updates.metadata,
      }

      if (Object.keys(updates).length > 0 && (updates.description || Object.keys(updates.metadata || {}).length > 2)) {
        const updatedScene = await TimelineService.updateScene(scene.id, updates)
        
        // Convert back to screenplay scene format for local state
        const updatedScreenplayScene = {
          id: updatedScene.id,
          project_id: id,
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
          content: (updatedScene as any).screenplay_content || updatedScene.description || '',
          metadata: updatedScene.metadata || {},
          order_index: updatedScene.order_index || 0,
          created_at: updatedScene.created_at,
          updated_at: updatedScene.updated_at,
        }
        
        const updatedScenes = screenplayScenes.map(s => s.id === scene.id ? updatedScreenplayScene as any : s)
        setScreenplayScenes(sortScreenplayScenes(updatedScenes))

        toast({
          title: "Success",
          description: "Scene details generated successfully",
        })
      } else {
        toast({
          title: "No Updates",
          description: "AI did not generate any updates. Please try again.",
          variant: "destructive",
        })
      }
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

  // Generate full details for all scenes at once
  const generateAllSceneDetails = async () => {
    if (!fullScript || !ready || !userId || screenplayScenes.length === 0) return

    // Filter to only scenes that are missing details (empty description, location, etc.)
    const scenesNeedingDetails = screenplayScenes.filter(scene => {
      const hasDetails = scene.description?.trim() && 
                        scene.location?.trim() && 
                        scene.characters && scene.characters.length > 0
      return !hasDetails
    })

    if (scenesNeedingDetails.length === 0) {
      toast({
        title: "All Scenes Complete",
        description: "All scenes already have details. Use individual scene editing to update specific scenes.",
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

    // Get the model from AI settings
    const scriptsSetting = aiSettings.find((s: any) => s.tab_type === 'scripts')
    const modelToUse = scriptsSetting?.selected_model || 
                      (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

    try {
      setIsGeneratingScenes(true)

      const scriptContext = fullScript.length > 3000 
        ? fullScript.substring(0, 3000) + '...'
        : fullScript

      // Create a list of scene titles
      const sceneTitles = scenesNeedingDetails.map(s => `Scene ${s.scene_number}: ${s.name}`).join('\n')

      const aiPrompt = `Based on the following screenplay and scene titles, generate full details for each scene.

SCREENPLAY CONTEXT:
${scriptContext}

SCENE TITLES (${scenesNeedingDetails.length} scenes need details):
${sceneTitles}

REQUIREMENTS:
- For each scene, provide:
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
          model: modelToUse, // Pass the model from AI settings
          apiKey: 'configured',
          userId: userId,
          maxTokens: 8000, // Increased for multiple scene details
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate scene details')
      }

      const data = await response.json()
      let sceneDetails: any[] = []

      // Parse the response (same logic as treatment scenes)
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

      // Update only scenes that need details (don't overwrite existing) - update timeline scenes directly
      const updatePromises = scenesNeedingDetails.map(async (scene) => {
        const details = sceneDetails.find(d => d.scene_number === scene.scene_number || d.scene_number === String(scene.scene_number))
        if (details) {
          try {
            // Only update fields that are empty, preserve existing data
            const updates: Partial<CreateSceneData> = {
              metadata: { ...scene.metadata }
            }
            
            if (!scene.description?.trim() && details.description) {
              updates.description = details.description
            }
            if (!scene.location?.trim() && details.location) {
              updates.metadata!.location = details.location
            }
            if ((!scene.characters || scene.characters.length === 0) && details.characters && details.characters.length > 0) {
              updates.metadata!.characters = details.characters
            }
            if (!scene.shot_type?.trim() && details.shot_type) {
              updates.metadata!.shotType = details.shot_type
            }
            if (!scene.mood?.trim() && details.mood) {
              updates.metadata!.mood = details.mood
            }
            if (!scene.notes?.trim() && details.notes) {
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
              
              // Convert back to screenplay scene format for local state
              return {
                id: updatedScene.id,
                project_id: id,
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
      const finalScenes = screenplayScenes.map(scene => updatedScenesMap.get(scene.id) || scene)
      setScreenplayScenes(sortScreenplayScenes(finalScenes))

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

  // Push a single scene to timeline
  const pushSceneToTimeline = async (scene: ScreenplayScene) => {
    if (!id) return

    try {
      // Get or create timeline for the movie
      let timeline
      try {
        const { data: timelines, error: timelineError } = await getSupabaseClient()
          .from('timelines')
          .select('*')
          .eq('project_id', id)
          .eq('user_id', userId)
          .limit(1)
        
        if (!timelineError && timelines && timelines.length > 0) {
          timeline = timelines[0]
        } else {
          timeline = await TimelineService.createTimelineForMovie(id, {
            name: `${movie?.name || 'Movie'} Timeline`,
            description: `Timeline for ${movie?.name || 'Movie'}`,
          })
        }
      } catch (error) {
        timeline = await TimelineService.createTimelineForMovie(id, {
          name: `${movie?.name || 'Movie'} Timeline`,
          description: `Timeline for ${movie?.name || 'Movie'}`,
        })
      }

      if (!timeline) {
        throw new Error('Failed to get or create timeline')
      }

      // Get existing scenes to check if scene already exists and calculate start time
      const existingScenes = await TimelineService.getScenesForTimeline(timeline.id)
      
      // Check if a scene with this scene number already exists
      const sceneNumber = scene.scene_number || ''
      const existingScene = existingScenes.find(s => 
        s.metadata?.sceneNumber === sceneNumber
      )

      const durationSeconds = 60 // Default 1 minute per scene
      
      const sceneData = {
        timeline_id: timeline.id,
        name: scene.name,
        description: scene.description || '',
        duration_seconds: durationSeconds,
        scene_type: 'video' as const,
        content_url: '',
        metadata: {
          sceneNumber: sceneNumber,
          location: scene.location || '',
          characters: scene.characters || [],
          shotType: scene.shot_type || '',
          mood: scene.mood || '',
          notes: scene.notes || '',
          status: scene.status || 'Planning',
        }
      }

      if (existingScene) {
        // Update existing scene instead of creating a new one
        await TimelineService.updateScene(existingScene.id, {
          ...sceneData,
          // Preserve start_time_seconds if it exists
          start_time_seconds: existingScene.start_time_seconds,
        })
        
        toast({
          title: "Success",
          description: `Scene "${scene.name}" updated in timeline`,
        })
      } else {
        // Calculate start time for new scene
        const lastScene = existingScenes[existingScenes.length - 1]
        const startTimeSeconds = lastScene 
          ? lastScene.start_time_seconds + lastScene.duration_seconds 
          : 0

        await TimelineService.createScene({
          ...sceneData,
          start_time_seconds: startTimeSeconds,
        })

        toast({
          title: "Success",
          description: `Scene "${scene.name}" added to timeline`,
        })
      }
    } catch (error) {
      console.error('Error pushing scene to timeline:', error)
      toast({
        title: "Error",
        description: "Failed to add scene to timeline. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Push all scenes to timeline
  const pushAllScenesToTimeline = async () => {
    if (!id || screenplayScenes.length === 0) return

    try {
      // Get or create timeline
      let timeline
      try {
        const { data: timelines, error: timelineError } = await getSupabaseClient()
          .from('timelines')
          .select('*')
          .eq('project_id', id)
          .eq('user_id', userId)
          .limit(1)
        
        if (!timelineError && timelines && timelines.length > 0) {
          timeline = timelines[0]
        } else {
          timeline = await TimelineService.createTimelineForMovie(id, {
            name: `${movie?.name || 'Movie'} Timeline`,
            description: `Timeline for ${movie?.name || 'Movie'}`,
          })
        }
      } catch (error) {
        timeline = await TimelineService.createTimelineForMovie(id, {
          name: `${movie?.name || 'Movie'} Timeline`,
          description: `Timeline for ${movie?.name || 'Movie'}`,
        })
      }

      if (!timeline) {
        throw new Error('Failed to get or create timeline')
      }

      // Get existing scenes to check for duplicates and calculate start time
      const existingScenes = await TimelineService.getScenesForTimeline(timeline.id)
      
      // Convert screenplay scenes to timeline scenes
      const timelineScenes = []
      let updatedCount = 0
      let createdCount = 0
      
      // Track the last scene's end time for calculating new scene start times
      let lastEndTime = existingScenes.length > 0
        ? existingScenes[existingScenes.length - 1].start_time_seconds + existingScenes[existingScenes.length - 1].duration_seconds
        : 0
      
      for (const screenplayScene of screenplayScenes) {
        const durationSeconds = 60 // Default 1 minute per scene
        const sceneNumber = screenplayScene.scene_number || ''
        
        // Check if a scene with this scene number already exists
        const existingScene = existingScenes.find(s => 
          s.metadata?.sceneNumber === sceneNumber
        )
        
        const sceneData = {
          timeline_id: timeline.id,
          name: screenplayScene.name,
          description: screenplayScene.description || '',
          duration_seconds: durationSeconds,
          scene_type: 'video' as const,
          content_url: '',
          metadata: {
            sceneNumber: sceneNumber,
            location: screenplayScene.location || '',
            characters: screenplayScene.characters || [],
            shotType: screenplayScene.shot_type || '',
            mood: screenplayScene.mood || '',
            notes: screenplayScene.notes || '',
            status: screenplayScene.status || 'Planning',
          }
        }

        if (existingScene) {
          // Update existing scene instead of creating a new one
          const updatedScene = await TimelineService.updateScene(existingScene.id, {
            ...sceneData,
            // Preserve start_time_seconds if it exists
            start_time_seconds: existingScene.start_time_seconds,
          })
          timelineScenes.push(updatedScene)
          updatedCount++
        } else {
          // Calculate start time for new scene
          const createdScene = await TimelineService.createScene({
            ...sceneData,
            start_time_seconds: lastEndTime,
          })
          timelineScenes.push(createdScene)
          // Update lastEndTime for next iteration
          lastEndTime = createdScene.start_time_seconds + createdScene.duration_seconds
          createdCount++
        }
      }

      const successMessage = createdCount > 0 && updatedCount > 0
        ? `Pushed ${createdCount} new scene${createdCount !== 1 ? 's' : ''} and updated ${updatedCount} existing scene${updatedCount !== 1 ? 's' : ''} to timeline`
        : createdCount > 0
        ? `Pushed ${createdCount} scene${createdCount !== 1 ? 's' : ''} to timeline`
        : `Updated ${updatedCount} scene${updatedCount !== 1 ? 's' : ''} in timeline`

      toast({
        title: "Success",
        description: successMessage,
      })

      // Navigate to timeline
      router.push(`/timeline?movie=${id}`)
    } catch (error) {
      console.error('Error pushing scenes to timeline:', error)
      toast({
        title: "Error",
        description: "Failed to push scenes to timeline. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle file import callback
  const handleFileImported = async (assetId: string) => {
    try {
      toast({
        title: "Script Imported",
        description: "Your script has been imported successfully.",
      })
      
      // Mark old project-level scripts as not latest to avoid duplicates
      const { data: oldProjectScripts } = await getSupabaseClient()
        .from('assets')
        .select('id')
        .eq('project_id', id)
        .eq('user_id', userId)
        .eq('content_type', 'script')
        .eq('is_latest_version', true)
        .is('scene_id', null)
        .neq('id', assetId)
      
      if (oldProjectScripts && oldProjectScripts.length > 0) {
        await getSupabaseClient()
          .from('assets')
          .update({ is_latest_version: false })
          .in('id', oldProjectScripts.map(s => s.id))
      }
      
      // Refresh scripts - only get the latest project-level script
      const assets = await AssetService.getAssetsForProject(id)
      const projectScripts = assets.filter(a => 
        a.content_type === 'script' && 
        a.is_latest_version && 
        a.project_id && 
        !a.scene_id
      )
      projectScripts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      if (projectScripts.length > 0) {
        setActiveScriptAsset(projectScripts[0])
        setFullScript(projectScripts[0].content || "")
        setScriptAssets([projectScripts[0]])
      }
    } catch (error) {
      console.error('Error refreshing scripts after import:', error)
    }
  }

  // Export screenplay to PDF
  const exportToPDF = () => {
    if (!fullScript || fullScript.trim().length === 0) {
      toast({
        title: "No Script to Export",
        description: "There's no screenplay content to export.",
        variant: "destructive",
      })
      return
    }

    try {
      // Create a new PDF document (US Letter size for screenplays)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      })

      // Set up margins (standard screenplay format: 1.5" left, 1" right, 1" top/bottom)
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const leftMargin = 1.5
      const rightMargin = 1.0
      const topMargin = 1.0
      const bottomMargin = 1.0
      const maxWidth = pageWidth - leftMargin - rightMargin
      let yPosition = topMargin

      // Set default font
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(12)
      const lineHeight = 0.2 // Approximate line height in inches
      const paragraphSpacing = 0.15

      // Helper function to add text with word wrapping
      const addTextWithWrap = (text: string, x: number, startY: number, maxWidth: number, isCentered: boolean = false) => {
        let y = startY
        const words = text.split(' ')
        let currentLine = ''
        
        words.forEach((word: string) => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word
          const testWidth = doc.getTextWidth(testLine)
          
          if (testWidth > maxWidth && currentLine) {
            // Output current line
            const outputX = isCentered ? (pageWidth - doc.getTextWidth(currentLine)) / 2 : x
            doc.text(currentLine, outputX, y)
            y += lineHeight
            
            // Check if we need a new page
            if (y + lineHeight > pageHeight - bottomMargin) {
              doc.addPage()
              y = topMargin
            }
            
            currentLine = word
          } else {
            currentLine = testLine
          }
        })
        
        // Output remaining line
        if (currentLine) {
          const outputX = isCentered ? (pageWidth - doc.getTextWidth(currentLine)) / 2 : x
          doc.text(currentLine, outputX, y)
          y += lineHeight
        }
        
        return y
      }

      // Split script into lines
      const lines = fullScript.split('\n')
      
      lines.forEach((line: string) => {
        // Check if we need a new page before processing line
        if (yPosition + lineHeight > pageHeight - bottomMargin) {
          doc.addPage()
          yPosition = topMargin
        }

        const trimmedLine = line.trim()
        
        // Handle empty lines
        if (trimmedLine.length === 0) {
          yPosition += paragraphSpacing
          return
        }

        // Detect screenplay element types
        const isSceneHeading = /^(INT\.|EXT\.|INTERIOR|EXTERIOR)/i.test(trimmedLine)
        const isCharacterName = trimmedLine === trimmedLine.toUpperCase() && 
                               trimmedLine.length < 50 && 
                               !trimmedLine.includes('.') &&
                               !trimmedLine.includes('(') &&
                               trimmedLine.length > 2 &&
                               /^[A-Z\s]+$/.test(trimmedLine)
        const isParenthetical = trimmedLine.startsWith('(') && trimmedLine.endsWith(')')
        const isTransition = /^(FADE IN|FADE OUT|CUT TO|DISSOLVE TO|SMASH CUT|MATCH CUT)/i.test(trimmedLine)

        // Format based on element type
        if (isSceneHeading) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          yPosition = addTextWithWrap(trimmedLine, leftMargin, yPosition, maxWidth)
          yPosition += paragraphSpacing
          doc.setFont('helvetica', 'normal')
        } else if (isCharacterName) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          yPosition = addTextWithWrap(trimmedLine, leftMargin, yPosition, maxWidth, true) // Center character names
          yPosition += 0.1
          doc.setFont('helvetica', 'normal')
        } else if (isParenthetical) {
          // Indent parentheticals
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(11)
          const indentX = leftMargin + 1.0
          yPosition = addTextWithWrap(trimmedLine, indentX, yPosition, maxWidth - 1.0)
          yPosition += 0.1
          doc.setFont('helvetica', 'normal')
        } else if (isTransition) {
          // Right-align transitions
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(12)
          const textWidth = doc.getTextWidth(trimmedLine)
          const rightX = pageWidth - rightMargin - textWidth
          doc.text(trimmedLine, rightX, yPosition)
          yPosition += lineHeight + paragraphSpacing
        } else {
          // Regular action/description/dialogue
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(12)
          yPosition = addTextWithWrap(trimmedLine, leftMargin, yPosition, maxWidth)
        }
      })

      // Save the PDF
      const safeFileName = (movie?.name || 'Screenplay').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const fileName = `${safeFileName}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)

      toast({
        title: "PDF Exported",
        description: `Your screenplay has been exported as ${fileName}`,
      })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export screenplay to PDF.",
        variant: "destructive",
      })
    }
  }

  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-lg">Loading screenplay...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <h1 className="text-2xl font-bold mb-4">Movie Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The movie you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button asChild>
              <Link href="/movies">Back to Movies</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          {/* Title at the top */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2">{movie.name}</h1>
            <p className="text-muted-foreground">
              Screenplay
              {fullScript && totalPages > 0 && (
                <span className="ml-2 text-muted-foreground/70">
                  ({totalPages} {totalPages === 1 ? 'page' : 'pages'})
                </span>
              )}
            </p>
          </div>
          
          {/* Navigation and Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 sticky top-4 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 border-b border-border/40">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/movies">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Movies
              </Link>
            </Button>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" asChild className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                <Link href={`/storyboards?movie=${id}`}>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Storyboards
                </Link>
              </Button>
              <Collapsible open={isFileImportExpanded} onOpenChange={setIsFileImportExpanded} className="relative">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="border-green-500/30 text-green-400 hover:bg-green-500/10">
                    {isFileImportExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Hide Import
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import Documents
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="absolute top-full right-0 mt-2 z-50 w-[calc(100vw-2rem)] max-w-2xl">
                  <div className="overflow-hidden rounded-lg border border-green-500/30 shadow-lg bg-background max-w-full">
                    <div className="overflow-auto max-h-[80vh] w-full">
                      <div className="w-full max-w-full p-4">
                        <FileImport
                          projectId={id}
                          sceneId={null}
                          onFileImported={handleFileImported}
                          className="w-full max-w-full"
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              {!isEditing ? (
                <>
                  <Button 
                    onClick={() => setShowCollaborationDialog(true)} 
                    variant="outline" 
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Start Collaboration
                  </Button>
                  {fullScript && fullScript.trim().length > 0 && (
                    <Button onClick={exportToPDF} variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                  )}
                  {fullScript && fullScript.trim().length > 0 && totalPages > 0 && (
                    <Button 
                      onClick={() => setShowDeletePageConfirm(true)} 
                      variant="outline" 
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Page
                    </Button>
                  )}
                  {fullScript && fullScript.trim().length > 0 && (
                    <Button 
                      onClick={() => setShowDeleteEntireConfirm(true)} 
                      variant="outline" 
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All
                    </Button>
                  )}
                  <Button onClick={handleEdit} variant="outline">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleCancelEdit} variant="outline">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Script Content */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {isEditing ? 'Editing Screenplay' : 'Screenplay'}
              </CardTitle>
              {fullScript && (
                <div className="flex items-center gap-4">
                  <Badge variant="outline">
                    Page {currentPage} of {totalPages}
                  </Badge>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={currentPage}
                        onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                        className="w-20 text-center"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4" data-script-content>
              {!fullScript && !isEditing ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Screenplay Found</h3>
                  <p className="text-muted-foreground mb-4">
                    This movie doesn't have a screenplay yet. Import a script file or create one by editing.
                  </p>
                  <Button onClick={handleEdit} variant="outline">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Create Screenplay
                  </Button>
                </div>
              ) : isEditing ? (
                <div className="space-y-4">
                  {/* Page number and action buttons row */}
                  <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                    <div className="flex items-center gap-4">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </Label>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                              const page = parseInt(e.target.value)
                              if (page && page >= 1 && page <= totalPages) {
                                goToPage(page)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const page = parseInt((e.target as HTMLInputElement).value)
                                if (page && page >= 1 && page <= totalPages) {
                                  goToPage(page)
                                }
                              }
                            }}
                            className="w-20 text-center"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={enhanceCurrentPage}
                        disabled={isEnhancingText}
                        className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      >
                        {isEnhancingText ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-1" />
                        )}
                        Enhance
                      </Button>
                    </div>
                  </div>
                  
                  {/* Fix Formatting Button */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                      onClick={async () => {
                        try {
                          const content = getCurrentPageEditContent()
                          if (!content) {
                            toast({
                              title: "Error",
                              description: "No screenplay content to format.",
                              variant: "destructive",
                            })
                            return
                          }

                          setLoading(true)
                          
                          const response = await fetch('/api/scenes/fix-screenplay-format', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              screenplay: content,
                            }),
                          })

                          if (!response.ok) {
                            const errorData = await response.json()
                            throw new Error(errorData.error || 'Failed to fix formatting')
                          }

                          const result = await response.json()
                          
                          if (result.success && result.screenplay) {
                            saveCurrentPageEdit(result.screenplay)
                            
                            toast({
                              title: "Formatting Fixed!",
                              description: "The screenplay has been reformatted with proper spacing.",
                            })
                          } else {
                            throw new Error('No formatted screenplay returned')
                          }
                        } catch (error) {
                          console.error('Error fixing screenplay formatting:', error)
                          toast({
                            title: "Error",
                            description: error instanceof Error ? error.message : "Failed to fix formatting. Please try again.",
                            variant: "destructive",
                          })
                        } finally {
                          setLoading(false)
                        }
                      }}
                      disabled={loading || !isEditing}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Fix Formatting
                    </Button>
                  </div>
                  
                  {/* Toolbar for inserting screenplay elements */}
                  <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={insertActionLine}
                      className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Action
                    </Button>
                    {loadingCharacters || characters.length === 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="h-8 px-3 text-sm border-purple-500/30 text-purple-400/50 w-[140px]"
                      >
                        {loadingCharacters ? "Loading..." : "No characters"}
                      </Button>
                    ) : (
                      <Select onValueChange={insertCharacter}>
                        <SelectTrigger className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10 w-[140px]">
                          <SelectValue placeholder="Character" />
                        </SelectTrigger>
                        <SelectContent>
                          {characters.map((char) => (
                            <SelectItem key={char.id} value={char.name}>
                              {char.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {loadingLocations || locations.length === 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="h-8 px-3 text-sm border-purple-500/30 text-purple-400/50 w-[140px]"
                      >
                        {loadingLocations ? "Loading..." : "No locations"}
                      </Button>
                    ) : (
                      <Select onValueChange={(locationName) => {
                        const location = locations.find(l => l.name === locationName)
                        insertLocation(locationName, location?.type)
                      }}>
                        <SelectTrigger className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10 w-[140px]">
                          <SelectValue placeholder="Location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.name}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={insertSceneHeading}
                      className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      INT/EXT
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={insertDialogue}
                      className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Dialogue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={insertTitlePage}
                      className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Title Page
                    </Button>
                    <div className="h-6 w-px bg-border mx-1" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => alignText('left')}
                      className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      title="Align Left"
                    >
                      <AlignLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => alignText('center')}
                      className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      title="Align Center"
                    >
                      <AlignCenter className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => alignText('right')}
                      className="h-8 px-3 text-sm border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      title="Align Right"
                    >
                      <AlignRight className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2 relative w-full">
                    <div className="relative w-full">
                      {/* Visual ruler for 80-character line width with center marker */}
                      <div className="absolute top-0 left-0 right-0 h-6 bg-muted/20 border-b border-border/50 flex items-center text-xs text-muted-foreground font-mono pointer-events-none z-10">
                        <div className="flex items-center w-full relative" style={{ maxWidth: 'calc(80ch + 24px)', margin: '0 auto', paddingLeft: '12px', paddingRight: '12px' }}>
                          <span className="absolute left-0 opacity-30">0</span>
                          <span className="absolute left-[20%] opacity-30">16</span>
                          <span className="absolute left-[50%] opacity-70 font-bold text-purple-400">40</span>
                          <span className="absolute left-[80%] opacity-30">64</span>
                          <span className="absolute right-0 opacity-30">80</span>
                          {/* Center line indicator */}
                          <div className="absolute left-[50%] top-0 bottom-0 w-px bg-purple-400/30 opacity-50"></div>
                        </div>
                      </div>
                      <Textarea
                        key={`page-${currentPage}`}
                        ref={textareaRef}
                        data-screenplay-editor
                        value={getCurrentPageEditContent()}
                        onChange={(e) => saveCurrentPageEdit(e.target.value)}
                        onSelect={handleTextSelection}
                        className="min-h-[600px] font-mono text-sm leading-relaxed pt-8"
                        style={{ 
                          fontFamily: '"Courier New", Courier, "Lucida Console", Monaco, monospace',
                          tabSize: 1,
                          letterSpacing: '0px',
                          paddingLeft: '12px',
                          paddingRight: '12px',
                          textAlign: 'left',
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'break-word',
                          wordWrap: 'break-word',
                          fontVariantNumeric: 'normal',
                          fontFeatureSettings: 'normal',
                          width: 'calc(80ch + 24px)',
                          maxWidth: 'calc(80ch + 24px)',
                          minWidth: 'calc(80ch + 24px)',
                          margin: '0 auto',
                          display: 'block',
                          overflowX: 'hidden'
                        }}
                        placeholder="Enter your screenplay here..."
                        onFocus={() => {
                          // Debug when textarea is focused
                          setTimeout(() => debugContainerDimensions(), 100)
                        }}
                      />
                    </div>
                  {/* Floating Selection Toolbar */}
                  {selectedText && toolbarPosition && (
                    <div
                      data-selection-toolbar
                      className="fixed z-50 flex items-center gap-2 p-2 bg-background border border-border rounded-lg shadow-lg"
                      style={{
                        top: `${toolbarPosition.top}px`,
                        left: `${toolbarPosition.left}px`,
                      }}
                    >
                      <Badge variant="outline" className="text-xs">
                        {selectedText.length} chars
                      </Badge>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={handleAITextEdit}
                        className="bg-purple-500 hover:bg-purple-600 text-white"
                      >
                        <Bot className="h-3 w-3 mr-1" />
                        AI Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedText("")
                          setToolbarPosition(null)
                          const textarea = document.querySelector('textarea[data-screenplay-editor]') as HTMLTextAreaElement
                          if (textarea) {
                            textarea.focus()
                          }
                        }}
                        className="h-7 w-7 p-0"
                        title="Clear selection"
                      >
                        ×
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={enhanceCurrentPage}
                        disabled={isEnhancingText || saving}
                        className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      >
                        {isEnhancingText ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Enhance
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        💡 Tip: Select text to see the AI edit button in the floating toolbar.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePushToNextPage}
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      disabled={!getCurrentPageEditContent().trim()}
                    >
                      <ArrowDown className="h-4 w-4 mr-2" />
                      Push Last Line to Next Page
                    </Button>
                  </div>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/20 p-6 rounded-lg border">
                  <div className="font-mono text-sm leading-relaxed space-y-4">
                    {(() => {
                      const content = getCurrentPageContent()
                      if (!content) return null
                      
                      // Split by double newlines (scene separators) and add visual separators
                      const scenes = content.split('\n\n').filter(s => s.trim().length > 0)
                      const result: JSX.Element[] = []
                      
                      console.log('🎬 Display - Scene boundaries:', sceneBoundaries.length, 'Scenes in content:', scenes.length)
                      
                      scenes.forEach((sceneContent, sceneIndex) => {
                        // Add visual separator before each scene (including first if we have boundary info)
                        if (sceneBoundaries.length > sceneIndex) {
                          const boundary = sceneBoundaries[sceneIndex]
                          if (boundary) {
                            // Different color for each scene
                            const colors = [
                              'bg-green-500',
                              'bg-blue-500',
                              'bg-purple-500',
                              'bg-orange-500',
                              'bg-pink-500',
                              'bg-cyan-500',
                              'bg-yellow-500',
                              'bg-red-500',
                            ]
                            const sceneColor = colors[sceneIndex % colors.length]
                            
                            result.push(
                              <div key={`separator-${sceneIndex}`} className="relative my-6 flex items-center py-2">
                                <div className={`flex-grow h-px ${sceneColor}`}></div>
                                <div className="px-4 text-xs font-bold text-muted-foreground bg-muted/20 rounded">
                                  {boundary.sceneNumber ? `SCENE ${boundary.sceneNumber}` : boundary.sceneName || 'Scene'}
                                </div>
                                <div className={`flex-grow h-px ${sceneColor}`}></div>
                              </div>
                            )
                          }
                        }
                        
                        // Add scene content
                        result.push(
                          <pre key={`scene-${sceneIndex}`} className="whitespace-pre-wrap">
                            {sceneContent}
                          </pre>
                        )
                      })
                      
                      return result.length > 0 ? result : <pre className="whitespace-pre-wrap">{content}</pre>
                    })()}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Pagination */}
        {fullScript && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-4 mb-6">
            <Badge variant="outline" className="px-4 py-2">
              Page {currentPage} of {totalPages}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                goToPage(currentPage - 1)
              }}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value)
                if (page && page >= 1 && page <= totalPages) {
                  goToPage(page)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const page = parseInt((e.target as HTMLInputElement).value)
                  if (page && page >= 1 && page <= totalPages) {
                    goToPage(page)
                  }
                }
              }}
              className="w-20 text-center"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                goToPage(currentPage + 1)
              }}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Audio Generation */}
        {!isEditing && fullScript && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Audio Generation - Page {currentPage}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TextToSpeech
                text={getCurrentPageText()}
                title={`${movie.name} - Page ${currentPage}`}
                projectId={id}
              />
            </CardContent>
          </Card>
        )}

        {/* Screenplay Scenes */}
        <Collapsible open={isScenesCardExpanded} onOpenChange={setIsScenesCardExpanded}>
          <Card className="mb-6">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Film className="h-5 w-5 text-purple-500" />
                        Scenes
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Break down your screenplay into individual scenes
                      </p>
                    </div>
                    {isScenesCardExpanded ? (
                      <ChevronUp className="h-5 w-5 text-foreground font-semibold" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-foreground font-semibold" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                    {screenplayScenes.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={pushAllScenesToTimeline}
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10 flex-shrink-0"
                      >
                        <Film className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Push All to Timeline</span>
                        <span className="sm:hidden">Push All</span>
                      </Button>
                    )}
                    {screenplayScenes.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateAllSceneDetails}
                        disabled={isGeneratingScenes || !aiSettingsLoaded}
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-shrink-0"
                        title="Generate full details (description, location, etc.) for all scenes"
                      >
                        {isGeneratingScenes ? (
                          <>
                            <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                            <span className="hidden sm:inline">Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Generate All Details</span>
                            <span className="sm:hidden">All Details</span>
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateScenesFromScreenplay}
                      disabled={isGeneratingScenes || !aiSettingsLoaded || !fullScript}
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 flex-shrink-0"
                    >
                      {isGeneratingScenes ? (
                        <>
                          <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                          <span className="hidden sm:inline">Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Generate Scene Titles</span>
                          <span className="sm:hidden">Scene Titles</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
            {isLoadingScenes ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading scenes...</p>
              </div>
            ) : screenplayScenes.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No scenes yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Generate Scene Titles" to automatically break down your screenplay into scenes
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortScreenplayScenes(screenplayScenes).map((scene, index) => {
                  const isExpanded = expandedScenes.has(scene.id)
                  const sceneNumber = scene.scene_number || scene.metadata?.sceneNumber || ''
                  const sceneName = scene.name || ''
                  
                  return (
                    <div key={scene.id}>
                      {/* Scene Separator - horizontal line with scene info */}
                      {index > 0 && (
                        <div className="relative my-6 flex flex-col items-center py-2">
                          {(() => {
                            // Different color for each scene
                            const colors = [
                              'bg-green-500',
                              'bg-blue-500',
                              'bg-purple-500',
                              'bg-orange-500',
                              'bg-pink-500',
                              'bg-cyan-500',
                              'bg-yellow-500',
                              'bg-red-500',
                            ]
                            const sceneColor = colors[(index - 1) % colors.length]
                            
                            return (
                              <div className="w-full flex items-center">
                                <div className={`flex-grow h-px ${sceneColor}`}></div>
                                <div className="px-4 text-sm font-bold text-muted-foreground bg-background">
                                  {sceneNumber ? `SCENE ${sceneNumber}` : sceneName || 'Scene'}
                                </div>
                                <div className={`flex-grow h-px ${sceneColor}`}></div>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                      <Collapsible
                        open={isExpanded}
                        onOpenChange={(open) => {
                          setExpandedScenes((prev) => {
                            const next = new Set(prev)
                            if (open) {
                              next.add(scene.id)
                            } else {
                              next.delete(scene.id)
                            }
                            return next
                          })
                        }}
                      >
                        <Card className="border-border">
                        <CollapsibleTrigger asChild>
                          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {editingSceneId === scene.id ? (
                                    <Input
                                      value={editingScene.scene_number || ''}
                                      onChange={(e) => setEditingScene({ ...editingScene, scene_number: e.target.value })}
                                      className="w-24 text-xs"
                                      placeholder="Scene #"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <Badge variant="outline" className="text-xs">
                                      Scene {scene.scene_number || 'N/A'}
                                    </Badge>
                                  )}
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
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <CardTitle className="text-lg">{scene.name}</CardTitle>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                                {editingSceneId === scene.id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleSaveScene()
                                      }}
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
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCancelEditScene()
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        pushSceneToTimeline(scene)
                                      }}
                                      className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                                      title="Send this scene to timeline"
                                    >
                                      <Film className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        regenerateSceneWithAI(scene)
                                      }}
                                      disabled={isRegeneratingScene === scene.id}
                                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                      title="Generate details for this scene (only fills empty fields)"
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
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleStartEditScene(scene)
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteScene(scene.id)
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="space-y-3">
                      {editingSceneId === scene.id ? (
                        <>
                          <div>
                            <Label>Description</Label>
                            <Textarea
                              value={editingScene.description || ''}
                              onChange={(e) => setEditingScene({ ...editingScene, description: e.target.value })}
                              rows={2}
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
                          <div className="pt-4 border-t mt-4">
                            <ShotListComponent
                              screenplaySceneId={scene.id}
                              projectId={id}
                            />
                          </div>
                        </>
                      )}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                    </div>
                  )
                })}
              </div>
            )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* AI Text Editor */}
        {showAITextEditor && aiEditData && (
          <AITextEditor
            isOpen={showAITextEditor}
            onClose={() => {
              setShowAITextEditor(false)
              setAiEditData(null)
            }}
            selectedText={aiEditData.selectedText}
            fullContent={aiEditData.fullContent}
            onTextReplace={handleAITextReplace}
            contentType="script"
          />
        )}

        {/* Delete Page Confirmation Dialog */}
        <AlertDialog open={showDeletePageConfirm} onOpenChange={setShowDeletePageConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Current Page?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete page {currentPage} of {totalPages}? 
                This will permanently remove this page from your screenplay. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCurrentPage}
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Page'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Entire Screenplay Confirmation Dialog */}
        <AlertDialog open={showDeleteEntireConfirm} onOpenChange={setShowDeleteEntireConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-400">Delete Entire Screenplay?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the entire screenplay? 
                This will permanently remove all {totalPages} page{totalPages !== 1 ? 's' : ''} from your screenplay. 
                <br /><br />
                <strong>This action cannot be undone.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteEntireScreenplay}
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Entire Screenplay'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Collaboration Dialog */}
        <Dialog open={showCollaborationDialog} onOpenChange={setShowCollaborationDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Start Collaboration Session</DialogTitle>
              <DialogDescription>
                Create an access code to share with collaborators. They can edit the screenplay in real-time.
              </DialogDescription>
            </DialogHeader>
            
            {!collaborationSession ? (
              <div className="space-y-4">
                <div>
                  <Label>Session Title (Optional)</Label>
                  <Input
                    value={collaborationForm.title}
                    onChange={(e) => setCollaborationForm({ ...collaborationForm, title: e.target.value })}
                    placeholder="e.g., Act 1 Collaboration"
                  />
                </div>
                <div>
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={collaborationForm.description}
                    onChange={(e) => setCollaborationForm({ ...collaborationForm, description: e.target.value })}
                    placeholder="Describe what you're working on..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Expiration Date (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={collaborationForm.expires_at}
                    onChange={(e) => setCollaborationForm({ ...collaborationForm, expires_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={collaborationForm.allow_guests}
                        onChange={(e) => setCollaborationForm({ ...collaborationForm, allow_guests: e.target.checked })}
                        className="rounded"
                      />
                      <Label className="font-normal">Allow guests (no login required)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={collaborationForm.allow_edit}
                        onChange={(e) => setCollaborationForm({ ...collaborationForm, allow_edit: e.target.checked })}
                        className="rounded"
                      />
                      <Label className="font-normal">Allow editing text</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={collaborationForm.allow_delete}
                        onChange={(e) => setCollaborationForm({ ...collaborationForm, allow_delete: e.target.checked })}
                        className="rounded"
                      />
                      <Label className="font-normal">Allow deleting text</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={collaborationForm.allow_add_scenes}
                        onChange={(e) => setCollaborationForm({ ...collaborationForm, allow_add_scenes: e.target.checked })}
                        className="rounded"
                      />
                      <Label className="font-normal">Allow adding scenes</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={collaborationForm.allow_edit_scenes}
                        onChange={(e) => setCollaborationForm({ ...collaborationForm, allow_edit_scenes: e.target.checked })}
                        className="rounded"
                      />
                      <Label className="font-normal">Allow editing scene info</Label>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-sm text-green-400 mb-2">✅ Collaboration session created!</p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-muted-foreground">Access Code</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-lg font-mono bg-muted px-3 py-2 rounded flex-1">
                          {collaborationSession.access_code}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(collaborationSession.access_code)
                            toast({
                              title: "Copied!",
                              description: "Access code copied to clipboard",
                            })
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Share URL</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-3 py-2 rounded flex-1 break-all">
                          {typeof window !== 'undefined' ? `${window.location.origin}/collaborate/${collaborationSession.access_code}` : ''}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = typeof window !== 'undefined' ? `${window.location.origin}/collaborate/${collaborationSession.access_code}` : ''
                            navigator.clipboard.writeText(url)
                            toast({
                              title: "Copied!",
                              description: "URL copied to clipboard",
                            })
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.open(`/collaborate/${collaborationSession.access_code}`, '_blank')
                  }}
                >
                  Open Collaboration Page
                </Button>
              </div>
            )}
            
            <DialogFooter>
              {collaborationSession ? (
                <Button onClick={() => {
                  setShowCollaborationDialog(false)
                  setCollaborationSession(null)
                  setCollaborationForm({
                    title: "",
                    description: "",
                    expires_at: "",
                    allow_guests: true,
                    allow_edit: true,
                    allow_delete: true,
                    allow_add_scenes: true,
                    allow_edit_scenes: true,
                  })
                }}>
                  Close
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowCollaborationDialog(false)}
                    disabled={creatingSession}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        setCreatingSession(true)
                        const expiresAt = collaborationForm.expires_at
                          ? new Date(collaborationForm.expires_at).toISOString()
                          : null

                        const response = await fetch('/api/collaboration/create', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            project_id: id,
                            title: collaborationForm.title || null,
                            description: collaborationForm.description || null,
                            expires_at: expiresAt,
                            allow_guests: collaborationForm.allow_guests,
                            allow_edit: collaborationForm.allow_edit,
                            allow_delete: collaborationForm.allow_delete,
                            allow_add_scenes: collaborationForm.allow_add_scenes,
                            allow_edit_scenes: collaborationForm.allow_edit_scenes,
                          }),
                        })

                        const result = await response.json()
                        if (!response.ok) {
                          throw new Error(result.error || 'Failed to create session')
                        }

                        setCollaborationSession(result.session)
                        toast({
                          title: "Session Created!",
                          description: "Share the access code with your collaborators",
                        })
                      } catch (error: any) {
                        console.error('Error creating collaboration session:', error)
                        toast({
                          title: "Error",
                          description: error.message || "Failed to create collaboration session",
                          variant: "destructive",
                        })
                      } finally {
                        setCreatingSession(false)
                      }
                    }}
                    disabled={creatingSession}
                  >
                    {creatingSession ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Session"
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Actions */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/timeline?movie=${id}`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            View Timeline
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/movies`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Back to Movies
          </Button>
        </div>
      </div>
    </div>
  )
}

