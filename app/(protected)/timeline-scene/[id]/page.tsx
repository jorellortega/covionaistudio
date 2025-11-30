"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft,
  Play,
  Clock,
  Edit3,
  ImageIcon,
  FileText,
  MessageSquare,
  Users,
  MapPin,
  Calendar,
  Save,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  GitCompare,
  Edit,
  Copy,
  Bot,
  Upload,
  Volume2,
  Download,
  ChevronLeft,
  ChevronRight,
  Film,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  Share2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useParams } from "next/navigation"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from '@/lib/supabase'
import { useRouter } from "next/navigation"
import FileImport from "@/components/file-import"
import TextToSpeech from "@/components/text-to-speech"
import AITextEditor from "@/components/ai-text-editor"
import { useIsMobile } from "@/hooks/use-mobile"
import { Navigation } from "@/components/navigation"
import { AISettingsService } from "@/lib/ai-settings-service"
import { ShotListComponent } from "@/components/shot-list"
import { ShotListService } from "@/lib/shot-list-service"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CollaborationService, type CreateCollaborationSessionData } from "@/lib/collaboration-service"
import { CharactersService } from "@/lib/characters-service"
import { LocationsService } from "@/lib/locations-service"

export default function ScenePage() {
  const params = useParams()
  const id = params.id as string

  return <ScenePageClient id={id} />
}

function ScenePageClient({ id }: { id: string }) {
  const { toast } = useToast()
  const { user, userId, ready } = useAuthReady()
  const router = useRouter()
  const isMobile = false // FORCE DESKTOP VIEW
  console.log('🎬 DEBUG - isMobile value:', isMobile)



  // State variables
  const [activeTab, setActiveTab] = useState("scripts")
  const [newNote, setNewNote] = useState("")
  const [newNoteType, setNewNoteType] = useState("General")
  const [isEditing, setIsEditing] = useState(false)
  const [showMediaUpload, setShowMediaUpload] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scene, setScene] = useState<SceneWithMetadata | null>(null)
  const [allScenes, setAllScenes] = useState<SceneWithMetadata[]>([])
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(-1)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [showVersionCompare, setShowVersionCompare] = useState(false)
  const [compareVersions, setCompareVersions] = useState<Asset[]>([])
  const [showVersionEdit, setShowVersionEdit] = useState(false)
  const [editingVersion, setEditingVersion] = useState<Asset | null>(null)
  const [showAIImageDialog, setShowAIImageDialog] = useState(false)
  const [selectedScriptForAI, setSelectedScriptForAI] = useState<string>('')
  const [aiImageLoading, setAiImageLoading] = useState(false)
  
  // Helper function to sanitize prompts for DALL-E
  const sanitizePromptForDALLE = (scriptContent: string): string => {
    try {
      // Remove potentially problematic content
      let sanitized = scriptContent
        .replace(/Scene \d+[:\-–]/gi, '') // Remove scene numbers
        .replace(/Written by.*?\n/gi, '') // Remove author credits
        .replace(/INT\.|EXT\./gi, '') // Remove scene direction abbreviations
        .replace(/DAY|NIGHT/gi, '') // Remove time indicators
        .replace(/[^\w\s,\.!?\-–—]/g, ' ') // Remove special characters except basic punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
      
      // Focus on visual elements and action, remove dialogue
      const lines = sanitized.split('\n')
      const visualLines = lines.filter(line => {
        const trimmed = line.trim()
        // Keep lines that describe action, setting, or visual elements
        // Remove lines that are mostly dialogue or character names
        return trimmed.length > 0 && 
               !trimmed.startsWith('(') && 
               !trimmed.endsWith(')') &&
               !trimmed.includes(':') &&
               trimmed.length > 10
      })
      
      // Take first 3-5 visual lines and combine them
      const selectedLines = visualLines.slice(0, 5)
      let result = selectedLines.join('. ')
      
      // Limit to reasonable length for DALL-E
      if (result.length > 500) {
        result = result.substring(0, 500).replace(/\.[^.]*$/, '') + '.'
      }
      
      // Add cinematic context if it's too short
      if (result.length < 50) {
        result = `A cinematic movie scene showing ${result}`
      }
      
      return result
    } catch (error) {
      console.error('Error sanitizing prompt:', error)
      // Fallback to a simple description
      return `A cinematic movie scene from the story`
    }
  }
  
  const [versionEditForm, setVersionEditForm] = useState({
    title: '',
    version_name: '',
    content: '',
    selection: ''
  } as {
    title: string;
    version_name: string;
    content: string;
    selection?: string;
  })
  const [projectId, setProjectId] = useState<string>("")
  
  // Collaboration states
  const [showCreateCollaborationDialog, setShowCreateCollaborationDialog] = useState(false)
  const [newCollaborationTitle, setNewCollaborationTitle] = useState("")
  const [newCollaborationDescription, setNewCollaborationDescription] = useState("")
  const [newCollaborationExpiresAt, setNewCollaborationExpiresAt] = useState<string>("")
  const [newCollaborationAllowGuests, setNewCollaborationAllowGuests] = useState(true)
  const [newCollaborationAllowEdit, setNewCollaborationAllowEdit] = useState(true)
  const [newCollaborationAllowDelete, setNewCollaborationAllowDelete] = useState(false)
  const [newCollaborationAllowAddScenes, setNewCollaborationAllowAddScenes] = useState(true)
  const [newCollaborationAllowEditScenes, setNewCollaborationAllowEditScenes] = useState(true)
  const [creatingCollaboration, setCreatingCollaboration] = useState(false)
  const [createdCollaborationCode, setCreatedCollaborationCode] = useState<string | null>(null)
  
  // Enhanced text editing states
  const [inlineEditing, setInlineEditing] = useState<{
    assetId: string;
    field: 'title' | 'content' | 'version_name';
    value: string;
    selection?: string;
  } | null>(null)
  const [savingStatus, setSavingStatus] = useState<{
    assetId: string;
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string;
  } | null>(null)

  // AI text editing states
  const [showAITextEditor, setShowAITextEditor] = useState(false)
  const [aiEditData, setAiEditData] = useState<{
    selectedText: string;
    fullContent: string;
    assetId: string;
    field: 'content';
  } | null>(null)
  
  // Text selection and toolbar states for screenplay editing
  const [selectedText, setSelectedText] = useState<string>("")
  const [selectionStart, setSelectionStart] = useState<number>(0)
  const [selectionEnd, setSelectionEnd] = useState<number>(0)
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null)

  const [selectedVersions, setSelectedVersions] = useState<Record<string, Asset>>({})
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null)
  const [treatmentId, setTreatmentId] = useState<string | null>(null)
  const [screenplayContent, setScreenplayContent] = useState<string | null>(null)
  const [isGeneratingScreenplay, setIsGeneratingScreenplay] = useState(false)
  
  // Pagination states for screenplay
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pages, setPages] = useState<string[]>([])
  const [isEditingScreenplay, setIsEditingScreenplay] = useState(false)
  const [editedPages, setEditedPages] = useState<Map<number, string>>(new Map())
  const [savingScreenplay, setSavingScreenplay] = useState(false)
  const screenplayTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [isGeneratingShotList, setIsGeneratingShotList] = useState(false)
  const [shotListRefreshKey, setShotListRefreshKey] = useState(0)
  const [isShotListExpanded, setIsShotListExpanded] = useState(false)
  
  // Text enhancer states
  const [textEnhancerSettings, setTextEnhancerSettings] = useState<{model: string; prefix: string}>({
    model: 'gpt-4o-mini',
    prefix: ''
  })
  const [userApiKeys, setUserApiKeys] = useState<{openai_api_key?: string; anthropic_api_key?: string}>({})
  const [isEnhancingText, setIsEnhancingText] = useState(false)
  
  // Characters and locations for screenplay toolbar
  const [characters, setCharacters] = useState<Array<{id: string; name: string}>>([])
  const [locations, setLocations] = useState<Array<{id: string; name: string; type?: string | null}>>([])
  const [loadingCharacters, setLoadingCharacters] = useState(false)
  const [loadingLocations, setLoadingLocations] = useState(false)
  
  // Screenplay page number calculation (standard: ~55 lines per page)
  const LINES_PER_PAGE = 55

  // Helper function to get timeline navigation URL
  // Note: projectId is actually the movie ID from the projects table
  const getTimelineUrl = () => {
    if (projectId) {
      return `/timeline?movie=${projectId}`
    }
    // Fallback: try to get project ID from scene data
    if (scene?.timeline_id) {
      // We'll use the timeline ID as a fallback
      return `/timeline?timeline=${scene.timeline_id}`
    }
    return "/timeline"
  }

  // Effect to fetch scene data
  useEffect(() => {
    if (!ready) return
    
    let mounted = true
    
    const fetchSceneData = async () => {

      
      if (!id || !userId) {

        return
      }

      // Validate scene ID format
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {

        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        
        // Fetch scene data directly
        const scene = await TimelineService.getSceneById(id)
        
        console.log('🎬 SCENE FETCH - Scene ID from params:', id)
        console.log('🎬 SCENE FETCH - Scene data:', scene)
        
        if (scene && mounted) {

          setScene(scene)
          
          // Fetch all scenes for navigation if we have timeline_id
          if (scene.timeline_id) {
            try {
              const scenes = await TimelineService.getScenesForTimeline(scene.timeline_id)
              if (mounted) {
                setAllScenes(scenes)
                // Find current scene index
                const index = scenes.findIndex(s => s.id === id)
                setCurrentSceneIndex(index)
              }
            } catch (scenesError) {
              console.error('Error fetching scenes for navigation:', scenesError)
            }
          }
          
          // Get project ID through timeline
          try {
            const { data: timeline, error } = await getSupabaseClient()
              .from('timelines')
              .select('project_id')
              .eq('id', scene.timeline_id)
              .single()
            
            if (timeline && !error && mounted) {
              setProjectId(timeline.project_id)
              
              // Fetch treatment for this project
              try {
                const { data: treatment, error: treatmentError } = await getSupabaseClient()
                  .from('treatments')
                  .select('id')
                  .eq('project_id', timeline.project_id)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle()
                
                if (treatment && !treatmentError && mounted) {
                  setTreatmentId(treatment.id)
                }
              } catch (treatmentError) {
                console.error('Error fetching treatment:', treatmentError)
              }
              
              // Load screenplay content if it exists
              if (scene.screenplay_content && mounted) {
                setScreenplayContent(scene.screenplay_content)
              }
            }
          } catch (timelineError) {

          }
        } else if (mounted) {

          setLoading(false)
        }
      } catch (error) {

        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to load scene data.",
            variant: "destructive",
          })
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchSceneData()
    fetchTextEnhancerSettings()
    fetchUserApiKeys()

    return () => {
      mounted = false
    }
  }, [id, userId, ready])

  // Update current scene index when id or allScenes changes
  useEffect(() => {
    if (id && allScenes.length > 0) {
      const index = allScenes.findIndex(s => s.id === id)
      setCurrentSceneIndex(index)
    }
  }, [id, allScenes])

  // Load characters and locations when projectId is available
  useEffect(() => {
    if (!projectId || !ready) return
    
    const loadData = async () => {
      try {
        setLoadingCharacters(true)
        const chars = await CharactersService.getCharacters(projectId)
        setCharacters(chars.map(c => ({ id: c.id, name: c.name })))
      } catch (error) {
        console.error('Error loading characters:', error)
        setCharacters([])
      } finally {
        setLoadingCharacters(false)
      }
      
      try {
        setLoadingLocations(true)
        const locs = await LocationsService.getLocations(projectId)
        setLocations(locs.map(l => ({ id: l.id, name: l.name, type: l.type })))
      } catch (error) {
        console.error('Error loading locations:', error)
        setLocations([])
      } finally {
        setLoadingLocations(false)
      }
    }
    
    loadData()
  }, [projectId, ready])

  // Calculate pages from screenplay content
  useEffect(() => {
    const content = screenplayContent || scene?.screenplay_content
    if (!content) {
      setPages([])
      setTotalPages(1)
      setCurrentPage(1)
      return
    }

    const lines = content.split('\n')
    const pageCount = Math.ceil(lines.length / LINES_PER_PAGE)
    setTotalPages(pageCount)

    // Split screenplay into pages
    const pageArray: string[] = []
    for (let i = 0; i < pageCount; i++) {
      const startLine = i * LINES_PER_PAGE
      const endLine = Math.min(startLine + LINES_PER_PAGE, lines.length)
      const pageContent = lines.slice(startLine, endLine).join('\n')
      pageArray.push(pageContent)
    }

    setPages(pageArray)
    // Reset to page 1 when content changes
    setCurrentPage(1)
  }, [screenplayContent, scene?.screenplay_content])

  // Go to specific page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      // If editing, save current page edits before switching
      if (isEditingScreenplay && screenplayTextareaRef.current) {
        saveCurrentPageEdit(screenplayTextareaRef.current.value)
      }
      setCurrentPage(page)
    }
  }

  // Get current page content
  const getCurrentPageContent = () => {
    if (isEditingScreenplay) {
      return getCurrentPageEditContent()
    }
    const content = screenplayContent || scene?.screenplay_content
    if (!content) return ''
    if (pages.length > 0) {
      return pages[currentPage - 1] || ''
    }
    return content
  }

  // Get current page edit content
  const getCurrentPageEditContent = () => {
    if (!isEditingScreenplay) return ""
    return editedPages.get(currentPage) || pages[currentPage - 1] || ""
  }

  // Save current page edit
  const saveCurrentPageEdit = (content: string) => {
    if (!isEditingScreenplay) return
    setEditedPages(prev => {
      const newMap = new Map(prev)
      newMap.set(currentPage, content)
      return newMap
    })
  }

  // Insert text at cursor position in textarea
  const insertTextAtCursor = (text: string) => {
    const textarea = screenplayTextareaRef.current
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

  // Insert dialogue (with proper 10-space indentation)
  const insertDialogue = () => {
    insertTextAtCursor('\n          ') // Newline + 10 spaces for dialogue indentation (industry standard)
  }

  // Handle Enter key to maintain dialogue formatting
  const handleScreenplayKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget
      const cursorPos = textarea.selectionStart
      const content = getCurrentPageEditContent()
      
      // Find the start of the current line
      let lineStart = cursorPos
      while (lineStart > 0 && content[lineStart - 1] !== '\n') {
        lineStart--
      }
      
      // Get the current line
      const lineEnd = content.indexOf('\n', cursorPos)
      const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd)
      
      // Check if current line is dialogue (has 8-12 spaces of indentation, which is dialogue range)
      const leadingSpaces = currentLine.match(/^ */)?.[0].length || 0
      const trimmedLine = currentLine.trim()
      
      // Check if it's dialogue: has 8-12 spaces AND doesn't look like a character name, scene heading, or parenthetical
      const isDialogue = leadingSpaces >= 8 && leadingSpaces <= 12 &&
                        !trimmedLine.match(/^[A-Z][A-Z0-9\s#'-]+$/) && // Not a character name
                        !trimmedLine.match(/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i) && // Not a scene heading
                        !trimmedLine.startsWith('(') // Not a parenthetical
      
      if (isDialogue) {
        // Prevent default Enter behavior
        e.preventDefault()
        
        // Insert newline with 10 spaces for dialogue continuation
        const beforeCursor = content.substring(0, cursorPos)
        const afterCursor = content.substring(cursorPos)
        const newContent = beforeCursor + '\n          ' + afterCursor
        
        // Update content
        saveCurrentPageEdit(newContent)
        
        // Update textarea and set cursor position
        setTimeout(() => {
          const newCursorPos = cursorPos + 11 // newline + 10 spaces
          textarea.value = newContent
          textarea.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
      }
    }
  }

  // Convert selected text to screenplay format
  const convertToScreenplayFormat = (formatType: 'character' | 'dialogue' | 'action' | 'parenthetical' | 'scene-heading') => {
    console.log('🎬 CONVERT FORMAT - Starting conversion:', formatType)
    
    if (!isEditingScreenplay || !selectedText || !screenplayTextareaRef.current) {
      toast({
        title: "No Selection",
        description: "Please select text to convert.",
        variant: "destructive",
      })
      return
    }

    const textarea = screenplayTextareaRef.current
    const currentPageContent = getCurrentPageEditContent()
    console.log('🎬 CONVERT FORMAT - Current page content length:', currentPageContent.length)
    console.log('🎬 CONVERT FORMAT - Selected text:', JSON.stringify(selectedText))
    console.log('🎬 CONVERT FORMAT - Selected text length:', selectedText.length)
    
    // Validate selection positions
    let start = selectionStart
    let end = selectionEnd
    console.log('🎬 CONVERT FORMAT - Initial selection:', { start, end, fromState: true })
    
    if (start < 0 || end > currentPageContent.length || start > end) {
      start = textarea.selectionStart
      end = textarea.selectionEnd
      console.log('🎬 CONVERT FORMAT - Using textarea selection:', { start, end })
    }

    let selectedTextContent = currentPageContent.substring(start, end)
    console.log('🎬 CONVERT FORMAT - Selected text content (raw):', JSON.stringify(selectedTextContent))
    console.log('🎬 CONVERT FORMAT - Selected text content length:', selectedTextContent.length)
    
    // For dialogue, remove ALL quotes from the entire selection BEFORE splitting into lines
    if (formatType === 'dialogue') {
      // AGGRESSIVE: Remove ALL quotes (both single and double, escaped or not) from anywhere
      // First, remove escaped quotes
      selectedTextContent = selectedTextContent.replace(/\\"/g, '')
      selectedTextContent = selectedTextContent.replace(/\\'/g, '')
      // Remove ALL quotes from anywhere in the selection (not just edges)
      selectedTextContent = selectedTextContent.replace(/["']/g, '')
      // Trim whitespace
      selectedTextContent = selectedTextContent.trim()
      console.log('🎬 CONVERT FORMAT - Removed ALL quotes from selection')
      console.log('🎬 CONVERT FORMAT - After quote removal:', JSON.stringify(selectedTextContent))
    }
    
    let lines = selectedTextContent.split('\n')
    console.log('🎬 CONVERT FORMAT - Split into lines:', lines.length)
    console.log('🎬 CONVERT FORMAT - Lines:', lines.map((l, i) => `[${i}]: "${l}" (${l.length} chars, ${l.match(/^ */)?.[0].length || 0} leading spaces)`))
    
    const LINE_WIDTH = 80
    
    // For dialogue, automatically include continuation lines that start at hard left
    if (formatType === 'dialogue') {
      console.log('🎬 CONVERT FORMAT - Checking for continuation lines...')
      // Check if there are continuation lines after the selection
      const contentAfterSelection = currentPageContent.substring(end)
      console.log('🎬 CONVERT FORMAT - Content after selection:', JSON.stringify(contentAfterSelection.substring(0, 200)))
      
      const continuationLines: string[] = []
      let searchPos = 0
      
      // Look for continuation lines (lines that start at hard left or minimal indent)
      while (true) {
        const nextLineMatch = contentAfterSelection.substring(searchPos).match(/^\n([^\n]*)/)
        if (!nextLineMatch) {
          console.log('🎬 CONVERT FORMAT - No more lines found at position', searchPos)
          break
        }
        
        const nextLine = nextLineMatch[1]
        const nextLineTrimmed = nextLine.trim()
        const nextLineLeadingSpaces = nextLine.match(/^ */)?.[0].length || 0
        
        console.log('🎬 CONVERT FORMAT - Checking next line:', {
          line: JSON.stringify(nextLine),
          trimmed: JSON.stringify(nextLineTrimmed),
          leadingSpaces: nextLineLeadingSpaces
        })
        
        // Stop if we hit an empty line, scene heading, character name, or parenthetical
        if (!nextLineTrimmed) {
          console.log('🎬 CONVERT FORMAT - Empty line, stopping')
          break
        }
        if (nextLineTrimmed.match(/^(INT\.|EXT\.|FADE|CUT|DISSOLVE)/i)) {
          console.log('🎬 CONVERT FORMAT - Scene heading/transition, stopping')
          break
        }
        if (nextLineTrimmed.match(/^[A-Z][A-Z0-9\s#'-]+$/) && nextLineTrimmed.length < 50) {
          console.log('🎬 CONVERT FORMAT - Character name, stopping')
          break
        }
        if (nextLineTrimmed.startsWith('(')) {
          console.log('🎬 CONVERT FORMAT - Parenthetical, stopping')
          break
        }
        
        // If it looks like a continuation line - any line that's not a character name, 
        // scene heading, or parenthetical could be dialogue continuation
        // Include it regardless of current indentation - we'll format it to 10 spaces
        // Only exclude if it has excessive indentation (more than 20 spaces, likely parenthetical or misformatted)
        if (nextLineLeadingSpaces <= 20) {
          console.log('🎬 CONVERT FORMAT - Found continuation line, adding it')
          continuationLines.push(nextLine)
          searchPos += nextLineMatch[0].length
        } else {
          console.log('🎬 CONVERT FORMAT - Line has excessive indent, stopping')
          break
        }
      }
      
      console.log('🎬 CONVERT FORMAT - Found continuation lines:', continuationLines.length)
      if (continuationLines.length > 0) {
        console.log('🎬 CONVERT FORMAT - Continuation lines:', continuationLines.map((l, i) => `[${i}]: "${l}"`))
        lines = [...lines, ...continuationLines]
        console.log('🎬 CONVERT FORMAT - Total lines after adding continuations:', lines.length)
      }
    }
    
    let formattedText = ''
    
    switch (formatType) {
      case 'character': {
        // Character names: CENTERED, all caps
        formattedText = lines.map(line => {
          const trimmed = line.trim()
          if (!trimmed) return ''
          const name = trimmed.toUpperCase()
          const nameLength = name.length
          const leftPadding = Math.max(0, Math.floor((LINE_WIDTH - nameLength) / 2))
          return ' '.repeat(leftPadding) + name
        }).join('\n')
        break
      }
      
      case 'dialogue': {
        console.log('🎬 CONVERT FORMAT - Formatting as dialogue, processing', lines.length, 'lines')
        // Dialogue: 10 spaces indent for ALL lines (including continuation lines)
        // Every line in the selection should get exactly 10 spaces, regardless of current formatting
        const DIALOGUE_INDENT = 10
        const LINE_WIDTH = 80
        // Dialogue should be narrower - typically 45-50 characters wide (not full width to column 80)
        // This creates proper margins on both sides: 10 spaces left, ~20-25 spaces right margin
        const MAX_DIALOGUE_WIDTH = 50 // Standard screenplay dialogue width (not 70!)
        
        // First, combine all lines into one continuous text, removing all formatting
        // This ensures we handle dialogue that's already split across multiple lines
        let combinedText = lines.map(line => {
          // Remove ALL leading and trailing whitespace and quotes from each line
          let cleaned = line
          // Remove escaped quotes
          cleaned = cleaned.replace(/\\"/g, '')
          cleaned = cleaned.replace(/\\'/g, '')
          // Remove ALL quotes
          cleaned = cleaned.replace(/["']/g, '')
          // Trim whitespace
          return cleaned.trim()
        }).filter(line => line.length > 0).join(' ') // Join with spaces to create continuous text
        
        console.log('🎬 CONVERT FORMAT - Combined text after cleaning:', JSON.stringify(combinedText))
        
        // If no text after cleaning, return empty
        if (!combinedText) {
          formattedText = ''
          break
        }
        
        // Now split the combined text into properly formatted dialogue lines
        // Each line should be EXACTLY max 70 characters (80 - 10 spaces) to ensure right margin alignment
        const words = combinedText.split(/\s+/)
        const formattedLines: string[] = []
        let currentLine = ''
        
        words.forEach((word, wordIndex) => {
          // Calculate what the line would be with this word
          const testLine = currentLine ? `${currentLine} ${word}` : word
          
          // STRICT: Only add word if the resulting line is <= 70 characters
          // If a single word is longer than 70 chars, we still add it (can't break words)
          if (testLine.length <= MAX_DIALOGUE_WIDTH) {
            // Word fits on current line
            currentLine = testLine
          } else {
            // Word doesn't fit - save current line (if any) and start new line with this word
            if (currentLine) {
              // Ensure current line doesn't exceed limit (shouldn't happen, but safety check)
              const lineToAdd = currentLine.length <= MAX_DIALOGUE_WIDTH 
                ? currentLine 
                : currentLine.substring(0, MAX_DIALOGUE_WIDTH)
              formattedLines.push(' '.repeat(DIALOGUE_INDENT) + lineToAdd)
            }
            // Start new line with this word (even if word is longer than 70 chars)
            currentLine = word
          }
          
          // If this is the last word, add the current line with 10 spaces
          if (wordIndex === words.length - 1 && currentLine) {
            // Ensure line doesn't exceed limit
            const lineToAdd = currentLine.length <= MAX_DIALOGUE_WIDTH 
              ? currentLine 
              : currentLine.substring(0, MAX_DIALOGUE_WIDTH)
            formattedLines.push(' '.repeat(DIALOGUE_INDENT) + lineToAdd)
          }
        })
        
        // Log each formatted line for debugging
        formattedLines.forEach((line, idx) => {
          const textOnly = line.substring(DIALOGUE_INDENT)
          console.log(`🎬 CONVERT FORMAT - Line ${idx}: length=${textOnly.length}, text="${textOnly.substring(0, 50)}${textOnly.length > 50 ? '...' : ''}"`)
        })
        
        formattedText = formattedLines.join('\n')
        
        console.log('🎬 CONVERT FORMAT - Final formatted text:', JSON.stringify(formattedText))
        console.log('🎬 CONVERT FORMAT - Total formatted lines:', formattedLines.length)
        console.log('🎬 CONVERT FORMAT - Formatted text length:', formattedText.length)
        break
      }
      
      case 'action': {
        // Action lines: Left-aligned, no indent
        formattedText = lines.map(line => line.trim()).join('\n')
        break
      }
      
      case 'parenthetical': {
        // Parentheticals: 15 spaces indent, wrapped in parentheses
        formattedText = lines.map(line => {
          const trimmed = line.trim()
          if (!trimmed) return ''
          let content = trimmed
          // Remove existing parentheses if present
          content = content.replace(/^\(+/, '').replace(/\)+$/, '').trim()
          // Ensure it has parentheses
          if (!content.startsWith('(')) content = '(' + content
          if (!content.endsWith(')')) content = content + ')'
          return ' '.repeat(15) + content
        }).join('\n')
        break
      }
      
      case 'scene-heading': {
        // Scene headings: Left-aligned, all caps
        formattedText = lines.map(line => {
          const trimmed = line.trim()
          if (!trimmed) return ''
          return trimmed.toUpperCase()
        }).join('\n')
        break
      }
    }

    // Replace the selected text with formatted version
    // If we included continuation lines for dialogue, extend the end position
    let newEnd = end
    if (formatType === 'dialogue' && lines.length > selectedTextContent.split('\n').length) {
      // We added continuation lines, find where they end in the original content
      const contentAfterSelection = currentPageContent.substring(end)
      let continuationLength = 0
      let searchPos = 0
      const addedLines = lines.length - selectedTextContent.split('\n').length
      
      for (let i = 0; i < addedLines; i++) {
        const nextLineMatch = contentAfterSelection.substring(searchPos).match(/^\n([^\n]*)/)
        if (nextLineMatch) {
          continuationLength += nextLineMatch[0].length
          searchPos += nextLineMatch[0].length
        } else {
          break
        }
      }
      
      newEnd = end + continuationLength
    }
    
    const newValue = currentPageContent.substring(0, start) + formattedText + currentPageContent.substring(newEnd)
    
    // Update the textarea immediately to show the change
    if (textarea) {
      textarea.value = newValue
    }
    
    saveCurrentPageEdit(newValue, start + formattedText.length) // Pass cursor position
    
    // Update textarea and set cursor position
    setTimeout(() => {
      const newCursorPos = start + formattedText.length
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 50)
    
    // Clear selection
    setSelectedText("")
    setToolbarPosition(null)
    
    toast({
      title: "Format Applied",
      description: `Text converted to ${formatType.replace('-', ' ')} format.`,
    })
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
    
    // Verify the result
    const leftSpacesCount = result.match(/^ */)?.[0].length || 0
    const rightSpacesCount = result.match(/ *$/)?.[0].length || 0
    
    // Create a visual representation for debugging
    const visualRep = '·'.repeat(leftSpacesCount) + trimmed + '·'.repeat(rightSpacesCount)
    
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
    const textarea = screenplayTextareaRef.current
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

  // Handle screenplay editing
  const handleEditScreenplay = () => {
    // Initialize editedPages with current pages
    const initialPages = new Map<number, string>()
    if (pages.length > 0) {
      pages.forEach((pageContent, index) => {
        initialPages.set(index + 1, pageContent)
      })
    } else {
      // If no screenplay exists, start with one empty page
      initialPages.set(1, "")
      setTotalPages(1)
      setCurrentPage(1)
    }
    setEditedPages(initialPages)
    setIsEditingScreenplay(true)
  }

  const handleCancelEditScreenplay = () => {
    setIsEditingScreenplay(false)
    setEditedPages(new Map())
  }

  // Combine edited pages into full screenplay
  const combineEditedPages = (): string => {
    if (!isEditingScreenplay) {
      return screenplayContent || scene?.screenplay_content || ''
    }
    
    // Get the maximum page number
    const maxPage = Math.max(
      totalPages,
      editedPages.size > 0 ? Math.max(...Array.from(editedPages.keys())) : 1
    )
    
    const combinedPages: string[] = []
    for (let i = 1; i <= maxPage; i++) {
      // For the current page, check textarea first to get latest unsaved content
      if (i === currentPage && screenplayTextareaRef.current) {
        const textareaContent = screenplayTextareaRef.current.value
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
        combinedPages.push("")
      }
    }
    
    // Join pages with newline
    return combinedPages.join('\n')
  }

  // Save screenplay
  const handleSaveScreenplay = async () => {
    if (!id || !userId) {
      toast({
        title: "Error",
        description: "Scene ID or user ID missing",
        variant: "destructive",
      })
      return
    }

    try {
      setSavingScreenplay(true)

      // Save current page content to state
      if (isEditingScreenplay && screenplayTextareaRef.current) {
        saveCurrentPageEdit(screenplayTextareaRef.current.value)
      }

      // Combine all edited pages into full screenplay
      const combinedContent = combineEditedPages()

      // Update scene's screenplay_content in database
      const { error: updateError } = await getSupabaseClient()
        .from('scenes')
        .update({ screenplay_content: combinedContent })
        .eq('id', id)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(updateError.message || 'Failed to save screenplay')
      }

      // Update local state
      setScreenplayContent(combinedContent)
      setIsEditingScreenplay(false)
      setEditedPages(new Map())

      // Refresh scene data
      const updatedScene = await TimelineService.getSceneById(id)
      if (updatedScene) {
        setScene(updatedScene)
      }

      toast({
        title: "Screenplay Saved!",
        description: "Your changes have been saved successfully.",
      })
    } catch (error) {
      console.error('Error saving screenplay:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save screenplay",
        variant: "destructive",
      })
    } finally {
      setSavingScreenplay(false)
    }
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
    if (!isEditingScreenplay) {
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
            max_tokens: 4000,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
          }),
        })

        if (!anthropicResponse.ok) {
          const errorData = await anthropicResponse.json()
          throw new Error(errorData.error?.message || 'Failed to enhance text')
        }

        const data = await anthropicResponse.json()
        response = data.content[0].text
      } else {
        // Use OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
            temperature: 0.7,
          }),
        })

        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json()
          throw new Error(errorData.error?.message || 'Failed to enhance text')
        }

        const data = await openaiResponse.json()
        response = data.choices[0].message.content
      }

      // Update the current page with enhanced version
      if (screenplayTextareaRef.current) {
        screenplayTextareaRef.current.value = response
        saveCurrentPageEdit(response)
      }
      
      toast({
        title: "Text Enhanced",
        description: "Successfully enhanced the current page",
      })
      
    } catch (error) {
      console.error('Error enhancing text:', error)
      toast({
        title: "Enhancement Failed",
        description: error instanceof Error ? error.message : 'Failed to enhance text',
        variant: "destructive",
      })
    } finally {
      setIsEnhancingText(false)
    }
  }

  // Delete screenplay
  const handleDeleteScreenplay = async () => {
    if (!id || !userId) {
      toast({
        title: "Error",
        description: "Scene ID or user ID missing",
        variant: "destructive",
      })
      return
    }

    try {
      setSavingScreenplay(true)

      // Delete screenplay_content from scene in database
      const { error: updateError } = await getSupabaseClient()
        .from('scenes')
        .update({ screenplay_content: null })
        .eq('id', id)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(updateError.message || 'Failed to delete screenplay')
      }

      // Update local state
      setScreenplayContent(null)
      setIsEditingScreenplay(false)
      setEditedPages(new Map())
      setPages([])
      setTotalPages(1)
      setCurrentPage(1)

      // Refresh scene data
      const updatedScene = await TimelineService.getSceneById(id)
      if (updatedScene) {
        setScene(updatedScene)
      }

      toast({
        title: "Screenplay Deleted!",
        description: "The screenplay has been removed from this scene.",
      })
    } catch (error) {
      console.error('Error deleting screenplay:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete screenplay",
        variant: "destructive",
      })
    } finally {
      setSavingScreenplay(false)
    }
  }

  // Cleanup function for inline editing
  useEffect(() => {
    return () => {
      // Clear editing states
      setInlineEditing(null)
      setSavingStatus(null)
    }
  }, [])

  // Handle creating collaboration session
  const handleCreateCollaborationSession = async () => {
    if (!userId || !projectId) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create a collaboration session.",
        variant: "destructive",
      })
      return
    }

    setCreatingCollaboration(true)
    try {
      const expiresAt = newCollaborationExpiresAt
        ? new Date(newCollaborationExpiresAt).toISOString()
        : null

      const response = await fetch('/api/collaboration/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          title: newCollaborationTitle || null,
          description: newCollaborationDescription || null,
          expires_at: expiresAt,
          allow_guests: newCollaborationAllowGuests,
          allow_edit: newCollaborationAllowEdit,
          allow_delete: newCollaborationAllowDelete,
          allow_add_scenes: newCollaborationAllowAddScenes,
          allow_edit_scenes: newCollaborationAllowEditScenes,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create collaboration session')
      }

      setCreatedCollaborationCode(result.session.access_code)
      toast({
        title: "Collaboration Session Created!",
        description: `Share this code: ${result.session.access_code}`,
      })
    } catch (error: any) {
      console.error('Error creating collaboration session:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create collaboration session",
        variant: "destructive",
      })
    } finally {
      setCreatingCollaboration(false)
    }
  }

  // Effect to fetch assets
  useEffect(() => {
    if (!ready) return
    
    let mounted = true
    
    const fetchAssets = async () => {

      
      if (!id || !userId) {

        return
      }
      
      try {
        setAssetsLoading(true)
        
        // Single, efficient query for scene assets
        const { data: sceneAssets, error } = await getSupabaseClient()
          .from('assets')
          .select('*')
          .eq('scene_id', id)
          .eq('user_id', userId)
        
        console.log('🔍 ASSET FETCH - Scene ID being queried:', id)
        console.log('🔍 ASSET FETCH - User ID:', userId)
        console.log('🔍 ASSET FETCH - Raw sceneAssets:', sceneAssets)
        console.log('🔍 ASSET FETCH - Error if any:', error)
        
        if (error) {
          console.error('🔍 ASSET FETCH - Supabase error:', error)
          if (mounted) {
            setAssets([])
          }
        } else {
          console.log('🔍 ASSET FETCH - Assets found:', sceneAssets?.length || 0)
          console.log('🔍 ASSET FETCH - Asset types:', sceneAssets?.map(a => ({ id: a.id, type: a.content_type, title: a.title })))
          
          if (mounted) {
            console.log('🔍 ASSET FETCH - Setting assets in state:', sceneAssets?.length || 0)
            setAssets(sceneAssets || [])
          }
        }
        
      } catch (error) {

        if (mounted) {
          setAssets([])
        }
      } finally {
        if (mounted) {
          setAssetsLoading(false)
        }
      }
    }

    fetchAssets()

    return () => {
      mounted = false
    }
  }, [id, userId, ready])

  // Effect to set initial active script
  useEffect(() => {
    const scriptAssets = assets.filter(a => a.content_type === 'script')
    if (scriptAssets.length > 0 && !activeScriptId) {
      // Set the latest version as the initial active script
      const latestScript = scriptAssets.find(a => a.is_latest_version) || scriptAssets[0]
      setActiveScriptId(latestScript.id)
    }
  }, [assets, activeScriptId])



  // Update toolbar position on scroll (same as screenplay page)
  useEffect(() => {
    if (!isEditingScreenplay || !selectedText || !toolbarPosition) return
    
    const handleScroll = () => {
      const textarea = document.querySelector('textarea[data-screenplay-editor]') as HTMLTextAreaElement
      if (textarea) {
        updateToolbarPosition(textarea)
      }
    }
    
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isEditingScreenplay, selectedText, toolbarPosition])

  // Debug container dimensions when textarea is rendered or window resizes
  useEffect(() => {
    if (!isEditingScreenplay) return
    
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
  }, [isEditingScreenplay, currentPage])

  // Clear selection when clicking outside (for screenplay editing)
  useEffect(() => {
    if (!isEditingScreenplay) {
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
  }, [isEditingScreenplay])

  // Function to refresh assets
  const refreshAssets = async () => {
    try {
      setAssetsLoading(true)
      console.log('🔄 REFRESH ASSETS - Refreshing assets for scene:', id)
      
      const { data: sceneAssets, error } = await getSupabaseClient()
        .from('assets')
        .select('*')
        .eq('scene_id', id)
        .eq('user_id', userId)
      
      console.log('🔄 REFRESH ASSETS - Assets found:', sceneAssets?.length || 0)
      console.log('🔄 REFRESH ASSETS - Asset types:', sceneAssets?.map(a => ({ id: a.id, type: a.content_type, title: a.title })))
      
      if (error) {
        console.error('🔄 REFRESH ASSETS - Error:', error)
      } else {
        setAssets(sceneAssets || [])
      }
    } catch (error) {
      console.error('🔄 REFRESH ASSETS - Exception:', error)
    } finally {
      setAssetsLoading(false)
    }
  }

  // Mock scene data - replace with actual data fetching
  const [editForm, setEditForm] = useState({
    name: scene?.name || "",
    description: scene?.description || "",
    start_time_seconds: scene?.start_time_seconds || 0,
    duration_seconds: scene?.duration_seconds || undefined,
    scene_type: scene?.scene_type || undefined,
    sceneNumber: scene?.metadata?.sceneNumber || "",
  })

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Script Complete":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "Draft":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "Outline":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "Concept":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30"
    }
  }




  // Version selection functions
  const selectVersion = (assetId: string, version: Asset) => {
    setSelectedVersions(prev => ({
      ...prev,
      [assetId]: version
    }))
  }

  const getSelectedVersion = (assetId: string) => {
    return selectedVersions[assetId] || null
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return

    const note = {
      id: Date.now().toString(),
      type: newNoteType,
      content: newNote,
      created_at: new Date().toISOString(),
      author: user?.name || "Current User",
    }

    if (scene) {
      try {
        // For now, just add to local state since we don't have addNoteToScene method yet
        setScene((prev) => prev ? { ...prev, notes: [...(prev.notes || []), note] } : null)
        toast({
          title: "Note Added",
          description: "Your note has been saved successfully.",
        })
      } catch (error) {
        toast({
          title: "Error saving note",
          description: error instanceof Error ? error.message : "Failed to save note.",
          variant: "destructive",
        })
      }
    }

    setNewNote("")
  }

  const handleSaveScene = async () => {
    setLoading(true)
    if (scene) {
      try {
        // Update scene using TimelineService
        const sceneUpdate: any = {
          name: editForm.name,
          description: editForm.description,
          start_time_seconds: editForm.start_time_seconds,
          metadata: {
            ...scene.metadata,
            sceneNumber: editForm.sceneNumber,
          }
        }
        
        // Only include optional fields if they have values
        if (editForm.duration_seconds !== undefined) {
          sceneUpdate.duration_seconds = editForm.duration_seconds
        }
        if (editForm.scene_type !== undefined) {
          sceneUpdate.scene_type = editForm.scene_type
        }
        
        const updatedScene = await TimelineService.updateScene(scene.id, sceneUpdate)
        setScene(updatedScene)
        
        // Also update in allScenes array
        setAllScenes(prev => prev.map(s => s.id === scene.id ? updatedScene : s))
        
        setIsEditing(false)
        toast({
          title: "Scene Updated",
          description: "Scene details have been saved successfully.",
        })
      } catch (error) {
        toast({
          title: "Error saving scene",
          description: error instanceof Error ? error.message : "Failed to save scene.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
  }

  const startEditing = () => {
    setEditForm({
      name: scene?.name || "",
      description: scene?.description || "",
      start_time_seconds: scene?.start_time_seconds || 0,
      duration_seconds: scene?.duration_seconds || undefined,
      scene_type: scene?.scene_type || undefined,
      sceneNumber: scene?.metadata?.sceneNumber || "",
    })
    setIsEditing(true)
  }

  const startAddMedia = () => {
    setShowMediaUpload(true)
  }

  const handleMediaUploadComplete = (mediaData: any) => {
    if (scene) {
      // For now, just add to local state since we don't have addMediaToScene method yet
      setScene((prev) => prev ? { ...prev, media: [...(prev.media || []), mediaData] } : null)
      setShowMediaUpload(false)
      toast({
        title: "Media Uploaded",
        description: "Your media has been added to the scene.",
      })
    }
  }

  const handleMediaUploadError = (error: string) => {
    toast({
      title: "Upload Failed",
      description: error,
      variant: "destructive",
    })
  }

  const generateScreenplay = async () => {
    if (!id || !userId) {
      toast({
        title: "Error",
        description: "Scene ID or user ID missing",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGeneratingScreenplay(true)

      // Get AI settings
      const aiSettings = await AISettingsService.getUserSettings(userId!)
      const scriptsSetting = aiSettings.find(s => s.tab_type === 'scripts')
      const lockedModel = scriptsSetting?.locked_model || 'ChatGPT'
      
      // Normalize service name for API
      const normalizedService = lockedModel.toLowerCase().includes('gpt') || lockedModel.toLowerCase().includes('openai') || lockedModel.toLowerCase().includes('chatgpt')
        ? 'openai'
        : lockedModel.toLowerCase().includes('claude') || lockedModel.toLowerCase().includes('anthropic')
        ? 'anthropic'
        : 'openai'
      
      // Get model - use selected_model if available, otherwise default based on service
      const modelToUse = scriptsSetting?.selected_model || 
        (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

      const response = await fetch('/api/scenes/generate-screenplay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sceneId: id,
          treatmentId: treatmentId,
          service: normalizedService,
          model: modelToUse,
          userId: userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate screenplay')
      }

      const result = await response.json()

      if (result.success && result.screenplay) {
        setScreenplayContent(result.screenplay)
        
        // Refresh scene data to get updated screenplay_content
        const updatedScene = await TimelineService.getSceneById(id)
        if (updatedScene) {
          setScene(updatedScene)
        }

        toast({
          title: "Screenplay Generated!",
          description: "The screenplay has been generated and saved to this scene.",
        })
      } else {
        throw new Error('No screenplay content returned')
      }
    } catch (error) {
      console.error('Error generating screenplay:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate screenplay",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingScreenplay(false)
    }
  }

  const generateShotListFromPage = async () => {
    if (!id || !userId) {
      toast({
        title: "Error",
        description: "Scene ID or user ID missing",
        variant: "destructive",
      })
      return
    }

    const pageContent = getCurrentPageContent()
    if (!pageContent || pageContent.trim().length === 0) {
      toast({
        title: "Error",
        description: "No screenplay content on this page to generate shot list from.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGeneratingShotList(true)

      // Get AI settings
      const aiSettings = await AISettingsService.getUserSettings(userId!)
      const scriptsSetting = aiSettings.find(s => s.tab_type === 'scripts')
      const lockedModel = scriptsSetting?.locked_model || 'ChatGPT'
      
      // Normalize service name for API
      const normalizedService = lockedModel.toLowerCase().includes('gpt') || lockedModel.toLowerCase().includes('openai') || lockedModel.toLowerCase().includes('chatgpt')
        ? 'openai'
        : lockedModel.toLowerCase().includes('claude') || lockedModel.toLowerCase().includes('anthropic')
        ? 'anthropic'
        : 'openai'
      
      // Get model - use selected_model if available, otherwise default based on service
      const modelToUse = scriptsSetting?.selected_model || 
        (normalizedService === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022')

      const response = await fetch('/api/scenes/generate-shot-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sceneId: id,
          screenplayContent: pageContent,
          pageNumber: currentPage,
          service: normalizedService,
          model: modelToUse,
          userId: userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate shot list')
      }

      const result = await response.json()

      console.log('🎬 Shot List Generation - API Response:', {
        success: result.success,
        shotsCount: result.shots?.length || 0,
        count: result.count
      })

      if (result.success && result.shots && result.shots.length > 0) {
        console.log('🎬 Shot List Generation - Saving shots to database...')
        
        // Save all generated shots
        const savedShots = await ShotListService.bulkCreateShotLists(
          result.shots.map((shot: any) => ({
            ...shot,
            scene_id: id,
            project_id: projectId,
          }))
        )

        console.log('🎬 Shot List Generation - Saved shots:', savedShots.length)

        // Trigger refresh of shot list component
        setShotListRefreshKey(prev => prev + 1)
        console.log('🎬 Shot List Generation - Refreshed shot list component')

        // Expand the shot list card to show the newly generated shots
        setIsShotListExpanded(true)

        toast({
          title: "Shot List Generated!",
          description: `Successfully created ${savedShots.length} shots from page ${currentPage}.`,
          duration: 5000,
        })
      } else {
        console.error('🎬 Shot List Generation - No shots in response:', result)
        throw new Error(result.error || 'No shots returned from AI')
      }
    } catch (error) {
      console.error('Error generating shot list:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate shot list.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingShotList(false)
    }
  }

  // Simple loading state
  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-lg">Loading scene...</span>
            <div className="text-sm text-muted-foreground text-center">
              <p>Loading scene data and assets...</p>
            </div>
            <Button 
              onClick={() => {
                console.log('🎬 TIMELINE-SCENE - Manual retry clicked')
                window.location.reload()
              }}
              variant="outline"
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Loading
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Error state if scene not found
  if (!scene) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Scene Not Found</h1>
              <p className="text-muted-foreground mb-6">
                The scene you're looking for doesn't exist or you don't have access to it.
              </p>
              <div className="space-x-4">
                <Button asChild>
                  <Link href={getTimelineUrl()}>
                    Back to Timeline
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Assets loading indicator
  if (assetsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-lg">Loading scene assets...</span>
            <div className="text-sm text-muted-foreground text-center">
              <p>Loading scene content and media...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Group assets by content type for the Versions tab
  const assetsByType = {
    script: assets.filter(a => a.content_type === 'script'),
    image: assets.filter(a => a.content_type === 'image'),
    video: assets.filter(a => a.content_type === 'video'),
    audio: assets.filter(a => a.content_type === 'audio'),
  };

  // Enhanced inline text editing functions
  const startInlineEditing = (assetId: string, field: 'title' | 'content' | 'version_name', currentValue: string) => {
    setInlineEditing({
      assetId,
      field,
      value: currentValue
    })
  }

  const cancelInlineEditing = () => {
    setInlineEditing(null)
    setSavingStatus(null)
  }

  const handleInlineEditChange = (value: string) => {
    if (!inlineEditing) return
    
    setInlineEditing(prev => prev ? { ...prev, value } : null)
  }

  // Enhanced text selection handler with mobile support
  const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    e.preventDefault()
    
    const target = e.target as HTMLTextAreaElement
    let selection = ''
    
    // Handle mobile vs desktop text selection
    if (isMobile) {
      // On mobile, try to get selection from multiple sources
      try {
        // Try the standard way first
        if (target.selectionStart !== undefined && target.selectionEnd !== undefined) {
          selection = target.value.substring(target.selectionStart, target.selectionEnd)
        }
        
        // Fallback for mobile: check if there's any selected text
        if (!selection && window.getSelection) {
          const windowSelection = window.getSelection()
          if (windowSelection && windowSelection.toString().length > 0) {
            selection = windowSelection.toString()
          }
        }
      } catch (error) {
        console.log('🎬 Mobile text selection fallback:', error)
      }
    } else {
      // Desktop: use standard selection properties
      selection = target.value.substring(target.selectionStart, target.selectionEnd)
    }
    
    if (selection.length > 0) {
      // Store selection for context menu actions
      setInlineEditing(prev => prev ? { ...prev, selection } : null)
    } else {
      // Clear selection
      setInlineEditing(prev => prev ? { ...prev, selection: undefined } : null)
    }
  }

  // AI text editing handler for inline editing (assets/descriptions)
  const handleAITextEdit = (selectedText: string, fullContent: string, assetId: string) => {
    setAiEditData({
      selectedText,
      fullContent,
      assetId,
      field: 'content'
    })
    setShowAITextEditor(true)
  }

  // Handle AI text replacement for inline editing
  const handleAITextReplaceInline = (newText: string) => {
    if (!aiEditData || !inlineEditing) return
    
    // Replace the selected text with the new AI-generated text
    const target = document.querySelector('textarea') as HTMLTextAreaElement
    if (target) {
      const start = target.selectionStart
      const end = target.selectionEnd
      const currentValue = target.value
      const newValue = currentValue.substring(0, start) + newText + currentValue.substring(end)
      
      // Update the inline editing value
      handleInlineEditChange(newValue)
      
      // Clear the AI edit data
      setAiEditData(null)
      setShowAITextEditor(false)
    }
  }

  // Handle AI text replacement for screenplay editing
  const handleAITextReplaceScreenplay = (newText: string) => {
    if (!aiEditData || !isEditingScreenplay) return
    
    // Get current textarea and its selection to ensure we use the latest positions
    const textarea = screenplayTextareaRef.current as HTMLTextAreaElement
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

  // Handle AI text replacement (routes to appropriate handler)
  const handleAITextReplace = (newText: string) => {
    if (isEditingScreenplay) {
      handleAITextReplaceScreenplay(newText)
    } else if (inlineEditing) {
      handleAITextReplaceInline(newText)
    }
  }

  // Debug function to log container and textarea dimensions
  const debugContainerDimensions = () => {
    const textarea = screenplayTextareaRef.current
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
    
    // For fixed positioning, use viewport coordinates directly (no scroll offset needed)
    // Position toolbar above the textarea, aligned to the left
    setToolbarPosition({
      top: rect.top - 50,
      left: rect.left + 10
    })
  }

  // Handle text selection for AI editing
  const handleScreenplayTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (!isEditingScreenplay) return
    
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

  // Handle AI edit button click from toolbar for screenplay
  const handleAITextEditScreenplay = () => {
    if (!isEditingScreenplay || !selectedText || selectedText.length === 0) {
      toast({
        title: "No Text Selected",
        description: "Please select some text to edit with AI.",
        variant: "destructive",
      })
      return
    }
    
    const currentPageContent = getCurrentPageEditContent()
    setAiEditData({
      selectedText: selectedText,
      fullContent: currentPageContent,
      assetId: id, // Use scene ID as asset ID
      field: 'content'
    })
    setShowAITextEditor(true)
  }

  // Recursive delete function that handles complex circular references
  const deleteAssetWithVersioning = async (assetId: string) => {
    console.log('🎬 TIMELINE-SCENE - Recursive delete for asset:', assetId)
    
    try {
      // Step 1: Get the asset and its relationships
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single()
      
      if (assetError) {
        throw new Error(`Asset not found: ${assetError.message}`)
      }
      
      console.log('🎬 TIMELINE-SCENE - Asset to delete:', asset)
      
      // Step 2: Find ALL assets that reference this asset (direct and indirect)
      const assetsToDelete = new Set<string>()
      const processedAssets = new Set<string>()
      
      // Recursive function to find all related assets
      const findRelatedAssets = async (currentAssetId: string) => {
        if (processedAssets.has(currentAssetId)) return
        processedAssets.add(currentAssetId)
        
        // Add current asset to deletion list
        assetsToDelete.add(currentAssetId)
        
        // Find assets that reference this asset as parent
        const { data: children, error: childError } = await supabase
          .from('assets')
          .select('id, parent_asset_id')
          .eq('parent_asset_id', currentAssetId)
        
        if (childError) {
          console.error('🎬 TIMELINE-SCENE - Error finding children:', childError)
          return
        }
        
        // Recursively find children of children
        if (children) {
          for (const child of children) {
            await findRelatedAssets(child.id)
          }
        }
      }
      
      // Start the recursive search
      await findRelatedAssets(assetId)
      
      console.log('🎬 TIMELINE-SCENE - Assets to delete (including related):', Array.from(assetsToDelete))
      
      // Step 3: Delete all related assets in the correct order
      // We need to delete from leaves to root (children before parents)
      const assetsArray = Array.from(assetsToDelete)
      
      // Sort assets so children are deleted before parents
      // This is a simple approach - in a more complex scenario, you might need topological sorting
      for (let i = 0; i < assetsArray.length; i++) {
        const currentAssetId = assetsArray[i]
        
        // Check if this asset has any remaining children that haven't been deleted yet
        const { data: remainingChildren, error: checkError } = await supabase
          .from('assets')
          .select('id')
          .eq('parent_asset_id', currentAssetId)
          .in('id', assetsArray) // Only check assets in our deletion list
        
        if (checkError) {
          console.error('🎬 TIMELINE-SCENE - Error checking remaining children:', checkError)
          continue
        }
        
        // If this asset still has children in our deletion list, skip it for now
        if (remainingChildren && remainingChildren.length > 0) {
          // Move this asset to the end of the list to process later
          assetsArray.push(assetsArray.splice(i, 1)[0])
          i-- // Re-process this index
          continue
        }
        
        // Safe to delete this asset
        console.log('🎬 TIMELINE-SCENE - Deleting asset:', currentAssetId)
        const { error: deleteError } = await supabase
          .from('assets')
          .delete()
          .eq('id', currentAssetId)
          .eq('user_id', session?.user?.id)
        
        if (deleteError) {
          console.error('🎬 TIMELINE-SCENE - Failed to delete asset:', currentAssetId, deleteError)
          throw new Error(`Failed to delete asset ${currentAssetId}: ${deleteError.message}`)
        }
        
        console.log('🎬 TIMELINE-SCENE - Successfully deleted asset:', currentAssetId)
      }
      
      console.log('🎬 TIMELINE-SCENE - All related assets deleted successfully!')
      return { success: true, error: null }
      
    } catch (error) {
      console.error('🎬 TIMELINE-SCENE - Recursive delete error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Test delete function to debug issues
  const testDeleteAsset = async (assetId: string) => {
    console.log('🎬 TIMELINE-SCENE - Testing smart delete for asset:', assetId)
    
    const result = await deleteAssetWithVersioning(assetId)
    
    if (result.success) {
      console.log('🎬 TIMELINE-SCENE - Smart delete test passed!')
    } else {
      console.error('🎬 TIMELINE-SCENE - Smart delete test failed:', result.error)
    }
    
    return result
  }

  // Helper function to generate shorter, cleaner names
  const generateCleanName = (originalName: string, type: 'title' | 'version_name', isMobile: boolean = false) => {
    if (type === 'title') {
      // For titles, remove "Extracted from" and file extensions, keep meaningful parts
      return originalName
        .replace(/^Extracted from /i, '')
        .replace(/\.(docx|doc|txt|pdf)$/i, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    } else {
      // For version names, respect the exact input unless it's a pattern that needs formatting
      if (originalName.includes('v3')) return isMobile ? 'V3' : 'Version 3'
      if (originalName.includes('v2')) return isMobile ? 'V2' : 'Version 2'
      if (originalName.includes('v1')) return isMobile ? 'V1' : 'Version 1'
      if (originalName.includes('Scene_1')) return isMobile ? 'S1' : 'Scene 1'
      if (originalName.includes('Scene_2')) return isMobile ? 'S2' : 'Scene 2'
      
      // For simple names like "Final", "Draft", etc., return them exactly as entered
      if (['Final', 'Draft', 'Copy', 'Edited', 'Revised'].includes(originalName.trim())) {
        return originalName.trim()
      }
      
      // Try to extract version number from the name
      const versionMatch = originalName.match(/version\s*(\d+)/i)
      if (versionMatch) {
        return isMobile ? `V${versionMatch[1]}` : `Version ${versionMatch[1]}`
      }
      
      // If no specific pattern found, return the original name (but cleaned up)
      return originalName
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }

  // Helper function to get clean version name for display
  const getCleanVersionName = (script: any, isMobile: boolean = false) => {
    console.log('🎬 DEBUG - getCleanVersionName called with:', { script, isMobile })
    console.log('🎬 DEBUG - script.version:', script.version, 'type:', typeof script.version)
    console.log('🎬 DEBUG - script.version_name:', script.version_name)
    
    // First priority: Check if version_name exists and is meaningful (not just a number)
    if (script.version_name && script.version_name.trim()) {
      const isJustNumber = /^\d+$/.test(script.version_name.trim())
      if (!isJustNumber) {
        const cleanName = generateCleanName(script.version_name, 'version_name', isMobile)
        // Add the version number to show both name and number
        if (script.version !== undefined && script.version !== null) {
          const result = `${cleanName} • Version ${script.version}`
          console.log('🎬 DEBUG - Using meaningful version_name with number, result:', result)
          return result
        }
        console.log('🎬 DEBUG - Using meaningful version_name, result:', cleanName)
        return cleanName
      }
    }
    
    // Second priority: Use version number for display formatting
    if (script.version !== undefined && script.version !== null) {
      const result = isMobile ? `V${script.version}` : `Version ${script.version}`
      console.log('🎬 DEBUG - Using version number, result:', result)
      return result
    }
    
    // Fallback
    const fallback = isMobile ? 'V1' : 'Version 1'
    console.log('🎬 DEBUG - Using fallback, result:', fallback)
    return fallback
  }

  const saveInlineEdit = async () => {
    if (!inlineEditing) return
    
    const { assetId, field, value } = inlineEditing
    const asset = assets.find(a => a.id === assetId)
    
    if (!asset) return
    
    try {
      setSavingStatus({ assetId, status: 'saving' })
      
      // Create a new version with the edited content
      const newAssetData = {
        project_id: asset.project_id,
        scene_id: asset.scene_id,
        title: field === 'title' ? value : asset.title,
        content_type: asset.content_type,
        content: field === 'content' ? value : asset.content,
        content_url: asset.content_url,
        prompt: asset.prompt,
        model: asset.model,
        version_name: field === 'version_name' ? value : `${asset.version_name || `Version ${asset.version}`} (Edited)`,
        generation_settings: asset.generation_settings,
        metadata: {
          ...asset.metadata,
          edited_from_version: asset.version,
          edited_at: new Date().toISOString(),
          edited_field: field,
          original_value: field === 'title' ? asset.title : 
                         field === 'version_name' ? asset.version_name : 
                         asset.content
        }
      }
      
      // Save as new version
      await AssetService.createAsset(newAssetData)
      
      // Refresh assets
      refreshAssets()
      
      // Show success status
      setSavingStatus({ assetId, status: 'saved', message: 'Changes saved!' })
      
      // Clear inline editing
      setInlineEditing(null)
      
      // Clear success status after 3 seconds
      setTimeout(() => {
        setSavingStatus(null)
      }, 3000)
      
      toast({
        title: "Changes Saved!",
        description: `New version created with your edits.`,
      })
      
    } catch (error) {
      console.error('🎬 TIMELINE-SCENE - Error saving inline edit:', error)
      setSavingStatus({ 
        assetId, 
        status: 'error', 
        message: 'Failed to save changes' 
      })
      
      toast({
        title: "Save Failed",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      })
    }
  }

  const saveInlineEditImmediately = () => {
    saveInlineEdit()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Bar */}
      <div className="border-b border-border/40 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <Navigation />
        </div>
      </div>
      
      <div className="p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {/* Top Row: Back Button and Title */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Link href={getTimelineUrl()}>
                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 shrink-0">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back to Timeline</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-1">
                  Scene: {scene.name}
                </h1>
                {scene.description && (
                  <p className="text-sm sm:text-base text-muted-foreground line-clamp-2">
                    {scene.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Second Row: Scene Navigation and Action Buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Scene Navigation */}
            {allScenes.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentSceneIndex > 0) {
                      const prevScene = allScenes[currentSceneIndex - 1]
                      router.push(`/timeline-scene/${prevScene.id}`)
                    }
                  }}
                  disabled={currentSceneIndex <= 0}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Previous</span>
                </Button>
                
                <Select
                  value={id}
                  onValueChange={(value) => {
                    router.push(`/timeline-scene/${value}`)
                  }}
                >
                  <SelectTrigger className="w-[200px] sm:w-[250px] border-primary/30">
                    <SelectValue>
                      {scene ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{scene.name}</span>
                          {scene.metadata?.sceneNumber && (
                            <Badge variant="outline" className="text-xs">
                              {scene.metadata.sceneNumber}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        'Select Scene'
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allScenes.map((s) => (
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
                          {s.id === id && (
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
                      router.push(`/timeline-scene/${nextScene.id}`)
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
            
            {/* Action Buttons - Grouped together */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2">
              {/* Start Collaboration Button */}
              {projectId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewCollaborationTitle(scene.name ? `${scene.name} Collaboration` : '')
                    setNewCollaborationDescription('')
                    setNewCollaborationExpiresAt('')
                    setShowCreateCollaborationDialog(true)
                  }}
                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                >
                  <Users className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Start Collaboration</span>
                  <span className="sm:hidden">Collaborate</span>
                </Button>
              )}
              
              {/* Screenplay Button - Only show if projectId is available */}
              {projectId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10 bg-transparent"
                  asChild
                >
                  <Link href={`/screenplay/${projectId}`}>
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">View Screenplay</span>
                    <span className="sm:hidden">Screenplay</span>
                  </Link>
                </Button>
              )}
          
              {/* Treatment Button */}
              <Button
                variant="outline"
                size="sm"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 bg-transparent"
                asChild
              >
                <Link href="/treatments/e8263848-ee4a-485d-bf55-8519a99609cb">
                  <Film className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">View Movie</span>
                  <span className="sm:hidden">Movie</span>
                </Link>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("import")}
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 bg-transparent"
              >
                <Upload className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Import Files</span>
                <span className="sm:hidden">Import</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                className="border-primary/30 text-primary hover:bg-primary/10 bg-transparent"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Edit Scene</span>
                <span className="sm:hidden">Edit</span>
              </Button>
              
              {/* AI Image Generation Button */}
              {assets.filter(a => a.content_type === 'script').length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAIImageDialog(true)}
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10 bg-transparent"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Generate AI Image</span>
                  <span className="sm:hidden">AI Image</span>
                </Button>
              )}
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Delete</span>
                    <span className="sm:hidden">Delete</span>
                  </Button>
                </AlertDialogTrigger>
            <AlertDialogContent className="bg-background border-destructive/20">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">Delete Scene</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  This action cannot be undone. This will permanently delete the scene and all associated media.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
              
              {/* Scene Mood Board Button */}
              <Button
                variant="outline"
                size="sm"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                onClick={() => {
                  const params = new URLSearchParams({
                    scope: 'scene',
                    targetId: id,
                  })
                  if (projectId) {
                    params.set('projectId', projectId)
                  }
                  router.push(`/mood-boards?${params.toString()}`)
                }}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Scene Mood Board</span>
                <span className="sm:hidden">Mood Board</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="bg-card border-primary/20 flex-wrap">
            <TabsTrigger
              value="scripts"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Scripts ({assets.filter(a => a.content_type === 'script').length})
            </TabsTrigger>
            <TabsTrigger 
              value="images" 
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Images ({assets.filter(a => a.content_type === 'image').length})
            </TabsTrigger>
            <TabsTrigger 
              value="video" 
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Video ({assets.filter(a => a.content_type === 'video').length})
            </TabsTrigger>
            <TabsTrigger
              value="audio"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Audio ({assets.filter(a => a.content_type === 'audio').length})
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Import Files
            </TabsTrigger>
            <TabsTrigger
              value="shot-list"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Shot List
            </TabsTrigger>
            <TabsTrigger
              value="link-assets"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500"
            >
              Link Assets
            </TabsTrigger>
          </TabsList>

          {/* Scripts Tab */}
          <TabsContent value="scripts" className="space-y-6">

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-primary">Scene Scripts</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Read scripts aloud with speech synthesis • Toggle between versions • Generate new content
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Create New Version from Current Script */}
                {assets.filter(a => a.content_type === 'script').length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 bg-transparent"
                    onClick={async () => {
                      const scriptAssets = assets.filter(a => a.content_type === 'script')
                      const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                      
                      try {
                        setLoading(true)
                        
                        // Create a new version by duplicating the current script
                        const newAssetData = {
                          project_id: activeScript.project_id,
                          scene_id: activeScript.scene_id,
                          title: `${activeScript.title} (Copy)`,
                          content_type: activeScript.content_type,
                          content: activeScript.content,
                          content_url: activeScript.content_url,
                          prompt: activeScript.prompt,
                          model: activeScript.model,
                          version_name: `Version ${(activeScript.version || 0) + 1}`,
                          generation_settings: activeScript.generation_settings,
                          metadata: {
                            ...activeScript.metadata,
                            duplicated_from_version: activeScript.version,
                            duplicated_at: new Date().toISOString(),
                            duplicated_from_asset_id: activeScript.id,
                            is_duplicate: true
                          }
                        }
                        
                        // Save as new version
                        await AssetService.createAsset(newAssetData)
                        
                        // Refresh assets
                        refreshAssets()
                        
                        toast({
                          title: "New Version Created!",
                          description: `A copy of "${activeScript.title}" has been created as a new version.`,
                        })
                        
                      } catch (error) {
                        console.error('🎬 TIMELINE-SCENE - Error creating new version:', error)
                        toast({
                          title: "Error",
                          description: "Failed to create new version. Please try again.",
                          variant: "destructive",
                        })
                      } finally {
                        setLoading(false)
                      }
                    }}
                    disabled={loading}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate Current Script
                  </Button>
                )}

                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 hover:from-purple-700 hover:via-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all duration-300 border-0"
                  onClick={generateScreenplay}
                  disabled={isGeneratingScreenplay || !treatmentId}
                  title={!treatmentId ? "Treatment not found for this project" : "Generate screenplay from scene description and treatment"}
                >
                  {isGeneratingScreenplay ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating Screenplay...
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 mr-2" />
                      Generate Screenplay
                    </>
                  )}
                </Button>
              </div>
            </div>



            {assets.filter(a => a.content_type === 'script').length > 0 && (
              <div className="space-y-4">
                            {(() => {
              // Group scripts by parent to show version history
              const scriptAssets = assets.filter(a => a.content_type === 'script')
              console.log('🎬 TIMELINE-SCENE - Script assets found:', scriptAssets)
              
              // FORCE VERSION TABS TO SHOW - TEST
              if (scriptAssets.length > 0) {
                return (
                  <div className="space-y-4">
                                         {/* FORCED VERSION TABS - TEST */}
                     <div className="border-b border-green-400/30 mb-4">
                       <div className="flex flex-wrap gap-1">
                         {scriptAssets.map((script) => (
                           <div key={script.id} className="relative group">
                             {inlineEditing?.assetId === script.id && inlineEditing.field === 'version_name' ? (
                               <div className="flex items-center gap-1">
                                 <Input
                                   value={inlineEditing.value}
                                   onChange={(e) => handleInlineEditChange(e.target.value)}
                                   className="px-3 py-2 text-sm font-medium bg-background border-green-400/30 focus:border-green-400 min-w-[120px]"
                                   autoFocus
                                 />
                                 <div className="flex gap-1">
                                   <Button
                                     size="sm"
                                     variant="outline"
                                     onClick={saveInlineEditImmediately}
                                     className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                   >
                                     <Save className="h-3 w-3" />
                                   </Button>
                                   <Button
                                     size="sm"
                                     variant="outline"
                                     onClick={cancelInlineEditing}
                                     className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                   >
                                     ×
                                   </Button>
                                 </div>
                               </div>
                             ) : (
                               <div
                                 onClick={() => {
                                   console.log('🎬 TIMELINE-SCENE - Clicking version:', script.version, 'ID:', script.id)
                                   setActiveScriptId(script.id)
                                 }}
                                 className={`px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 cursor-pointer ${
                                   activeScriptId === script.id
                                     ? 'text-green-400 border-green-400 bg-green-500/10'
                                     : 'text-green-400/60 border-transparent hover:text-green-400 hover:border-green-400/40'
                                 }`}
                               >
                                 <div className="flex items-center gap-2">
                                   <span>{getCleanVersionName(script, isMobile)}</span>
                                   {script.is_latest_version && (
                                     <span className="text-xs text-green-300">★</span>
                                   )}
                                   <Button
                                     size="sm"
                                     variant="ghost"
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       startInlineEditing(script.id, 'version_name', getCleanVersionName(script, isMobile))
                                     }}
                                     className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity p-0 hover:bg-green-500/10"
                                   >
                                     <Edit className="h-3 w-3" />
                                   </Button>
                                 </div>
                               </div>
                             )}
                           </div>
                         ))}
                       </div>
                       
                       {/* Quick Rename Suggestions */}
                       <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-muted-foreground">
                         <span>💡 Quick rename suggestions:</span>
                         <div className="flex flex-wrap gap-1">
                           {scriptAssets.map((script) => (
                             <Button
                               key={script.id}
                               size="sm"
                               variant="ghost"
                               onClick={() => {
                                 const cleanName = generateCleanName(getCleanVersionName(script, isMobile), 'version_name', isMobile)
                                 startInlineEditing(script.id, 'version_name', cleanName)
                               }}
                               className="h-6 px-2 text-xs hover:bg-green-500/10 hover:text-green-400"
                             >
                               {generateCleanName(getCleanVersionName(script, isMobile), 'version_name', isMobile)}
                             </Button>
                           ))}
                         </div>
                       </div>
                     </div>
                     
                     {/* Script Content Display */}
                     <Card className="bg-card border-primary/20">
                       <CardHeader>
                         <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                           <div className="flex-1">
                             <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                               <h4 className="text-xl font-bold text-primary">{(() => {
                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                 
                                 // Check if this title is being edited inline
                                 if (inlineEditing?.assetId === activeScript.id && inlineEditing.field === 'title') {
                                   return (
                                     <div className="flex items-center gap-2">
                                       <Input
                                         value={inlineEditing.value}
                                         onChange={(e) => handleInlineEditChange(e.target.value)}
                                         className="text-xl font-bold text-primary bg-background border-primary/30 focus:border-primary"
                                         autoFocus
                                       />
                                       <div className="flex gap-1">
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={saveInlineEditImmediately}
                                           className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                         >
                                           <Save className="h-3 w-3" />
                                         </Button>
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={cancelInlineEditing}
                                           className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                         >
                                           ×
                                         </Button>
                                       </div>
                                       {savingStatus?.assetId === activeScript.id && (
                                         <span className="text-xs text-muted-foreground">
                                           {savingStatus.status === 'saving' && 'Saving...'}
                                           {savingStatus.status === 'saved' && '✓ Saved!'}
                                           {savingStatus.status === 'error' && '✗ Error'}
                                         </span>
                                       )}
                                     </div>
                                   )
                                 }
                                 
                                 return (
                                                                    <div className="flex items-center gap-2 group">
                                   <span>{generateCleanName(activeScript.title, 'title')}</span>
                                   <Button
                                     size="sm"
                                     variant="ghost"
                                     onClick={() => startInlineEditing(activeScript.id, 'title', activeScript.title)}
                                     className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                   >
                                     <Edit className="h-3 w-3" />
                                   </Button>
                                 </div>
                                 )
                               })()}</h4>
                               {(() => {
                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                 
                                 // Check if we're editing this specific script's version
                                 if (inlineEditing?.assetId === activeScript.id && inlineEditing.field === 'version_name') {
                                   return (
                                     <div className="flex items-center gap-2">
                                       <input
                                         type="text"
                                         value={inlineEditing.value}
                                         onChange={(e) => handleInlineEditChange(e.target.value)}
                                         placeholder="Version name (e.g., Final, Draft)"
                                         className="px-2 py-1 text-sm bg-background border border-green-500/30 text-green-400 rounded"
                                         autoFocus
                                       />
                                       <span className="text-green-400">•</span>
                                                                                <input
                                           type="number"
                                           value={activeScript.version || 1}
                                           onChange={(e) => {
                                             const newVersion = parseInt(e.target.value) || 1
                                             // Update the script's version directly in assets
                                             setAssets(prev => prev.map((s: any) => 
                                               s.id === activeScript.id ? { ...s, version: newVersion } : s
                                             ))
                                           }}
                                           min="1"
                                           className="px-2 py-1 text-sm bg-background border border-green-500/30 text-green-400 rounded w-16"
                                         />
                                       <div className="flex gap-1">
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={async () => {
                                             // Update the existing asset instead of creating a new version
                                             try {
                                               const { error } = await supabase
                                                 .from('assets')
                                                 .update({ 
                                                   version_name: inlineEditing.value,
                                                   version: activeScript.version 
                                                 })
                                                 .eq('id', activeScript.id)
                                               
                                               if (error) throw error
                                               
                                               // Refresh assets to show the updated name
                                               refreshAssets()
                                               
                                               // Clear inline editing
                                               setInlineEditing(null)
                                               
                                               toast({
                                                 title: "Version Updated!",
                                                 description: "Version name has been updated.",
                                               })
                                             } catch (error) {
                                               console.error('Error updating version:', error)
                                               toast({
                                                 title: "Update Failed",
                                                 description: "Could not update version name.",
                                                 variant: "destructive",
                                               })
                                             }
                                           }}
                                           className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                         >
                                           <Save className="h-3 w-3" />
                                         </Button>
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={cancelInlineEditing}
                                           className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                         >
                                           ×
                                         </Button>
                                       </div>
                                     </div>
                                   )
                                 }
                                 
                                 return (
                                   <Badge 
                                     variant="outline" 
                                     className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10 cursor-pointer hover:bg-green-500/20 transition-colors"
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       startInlineEditing(activeScript.id, 'version_name', activeScript.version_name || '')
                                     }}
                                   >
                                     {getCleanVersionName(activeScript, isMobile)}
                                   </Badge>
                                 )
                               })()}
                               {(() => {
                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                 return activeScript.is_latest_version && (
                                   <Badge className="bg-green-500 text-white px-3 py-1 text-sm">
                                     LATEST
                                   </Badge>
                                 )
                               })()}
                             </div>
                             <p className="text-sm text-muted-foreground mb-3">
                               Generated with {(() => {
                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                 return activeScript.model
                               })()} • {(() => {
                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                 return new Date(activeScript.created_at).toLocaleDateString()
                               })()}
                             </p>
                           </div>
                           <div className="flex flex-wrap gap-2">

                             
                             {/* Quick Edit Button */}
                             <Button
                               variant="outline"
                               size="sm"
                               className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                               onClick={() => {
                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                 startInlineEditing(activeScript.id, 'content', activeScript.content || '')
                               }}
                               disabled={inlineEditing !== null}
                             >
                               <Edit className="h-4 w-4 mr-2" />
                               Quick Edit
                             </Button>
                             
                             {/* Delete Version Button */}
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                   disabled={inlineEditing !== null}
                                 >
                                   <Trash2 className="h-4 w-4 mr-2" />
                                   Delete Version
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent className="bg-background border-red-500/20 max-w-md">
                                 <AlertDialogHeader>
                                   <AlertDialogTitle className="text-red-400">Delete This Version Only</AlertDialogTitle>
                                   <AlertDialogDescription className="text-muted-foreground">
                                     This will delete only the current version you're viewing. Other versions will remain untouched.
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter className="flex gap-2">
                                   <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                                   <Button
                                     className="bg-red-500 hover:bg-red-600"
                                     onClick={async () => {
                                       const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                       
                                       try {
                                         setLoading(true)
                                         
                                         // Use the new delete-asset API endpoint to handle foreign key constraints
                                         const response = await fetch('/api/ai/delete-asset', {
                                           method: 'POST',
                                           headers: {
                                             'Content-Type': 'application/json',
                                           },
                                           body: JSON.stringify({
                                             assetId: activeScript.id,
                                             userId: user?.id
                                           })
                                         })
                                         
                                         const result = await response.json()
                                         
                                         if (!response.ok) {
                                           throw new Error(result.error || 'Failed to delete asset')
                                         }
                                         
                                         // Refresh assets
                                         refreshAssets()
                                         
                                         toast({
                                           title: "Version Deleted!",
                                           description: `"${activeScript.title}" has been removed. Other versions are unaffected.`,
                                         })
                                         
                                       } catch (error) {
                                         console.error('🎬 TIMELINE-SCENE - Error deleting version:', error)
                                         toast({
                                           title: "Delete Failed",
                                           description: error instanceof Error ? error.message : "Failed to delete version. Please try again.",
                                           variant: "destructive",
                                         })
                                       } finally {
                                         setLoading(false)
                                       }
                                     }}
                                     disabled={loading}
                                   >
                                     <Trash2 className="h-4 w-4 mr-2" />
                                     Delete This Version Only
                                   </Button>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                             
                             {/* Create New Version Button */}
                             <Button
                               variant="outline"
                               size="sm"
                               className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                               onClick={async () => {
                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                 
                                 try {
                                   setLoading(true)
                                   
                                   // Create a new version by duplicating the current script
                                   const newAssetData = {
                                     project_id: activeScript.project_id,
                                     scene_id: activeScript.scene_id,
                                     title: `${activeScript.title} (Copy)`,
                                     content_type: activeScript.content_type,
                                     content: activeScript.content,
                                     content_url: activeScript.content_url,
                                     prompt: activeScript.prompt,
                                     model: activeScript.model,
                                     version_name: `Version ${(activeScript.version || 0) + 1}`,
                                     generation_settings: activeScript.generation_settings,
                                     metadata: {
                                       ...activeScript.metadata,
                                       duplicated_from_version: activeScript.version,
                                       duplicated_at: new Date().toISOString(),
                                       duplicated_from_asset_id: activeScript.id,
                                       is_duplicate: true
                                     }
                                   }
                                   
                                   // Save as new version
                                   await AssetService.createAsset(newAssetData)
                                   
                                   // Refresh assets
                                   refreshAssets()
                                   
                                   toast({
                                     title: "New Version Created!",
                                     description: `A copy of "${activeScript.title}" has been created as a new version.`,
                                   })
                                   
                                 } catch (error) {
                                   console.error('🎬 TIMELINE-SCENE - Error creating new version:', error)
                                   toast({
                                     title: "Error",
                                     description: "Failed to create new version. Please try again.",
                                     variant: "destructive",
                                   })
                                 } finally {
                                   setLoading(false)
                                 }
                               }}
                               disabled={loading}
                             >
                               <Copy className="h-4 w-4 mr-2" />
                               Create New Version
                             </Button>
                           </div>
                         </div>
                       </CardHeader>
                       <CardContent>
                         <div className="bg-muted/20 p-4 rounded-lg border border-border mb-4">
                           {(() => {
                             const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                             
                             // Check if this content is being edited inline
                             if (inlineEditing?.assetId === activeScript.id && inlineEditing.field === 'content') {
                               return (
                                 <div className="space-y-3">
                                   <div className="flex items-center justify-between">
                                     <Label className="text-sm font-medium text-muted-foreground">
                                       Editing Script Content
                                     </Label>
                                     <div className="text-xs text-blue-400">
                                       💡 Select text for copy/clear/paste actions • Click Save when ready
                                     </div>
                                     <div className="flex gap-2">
                                       <Button
                                         size="sm"
                                         variant="outline"
                                         onClick={saveInlineEditImmediately}
                                         className="h-8 px-3 text-sm border-green-500/30 text-green-400 hover:bg-green-500/10"
                                       >
                                         <Save className="h-4 w-4 mr-1" />
                                         Save
                                       </Button>
                                       <Button
                                         size="sm"
                                         variant="outline"
                                         onClick={cancelInlineEditing}
                                         className="h-8 px-3 text-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
                                       >
                                         Cancel
                                       </Button>
                                     </div>
                                   </div>
                                   <Textarea
                                     value={inlineEditing.value}
                                     onChange={(e) => handleInlineEditChange(e.target.value)}
                                     placeholder="Edit your script content here..."
                                     className="w-full h-96 p-4 border border-primary/30 focus:border-primary bg-background text-foreground resize-none font-mono text-sm leading-relaxed"
                                     autoFocus
                                     onSelect={handleTextSelection}
                                     onMouseDown={(e) => e.stopPropagation()}
                                     onMouseUp={(e) => e.stopPropagation()}
                                     onClick={(e) => e.stopPropagation()}
                                     onFocus={(e) => e.stopPropagation()}
                                     onTouchStart={(e) => e.stopPropagation()}
                                     onTouchEnd={(e) => e.stopPropagation()}
                                     onTouchMove={(e) => e.stopPropagation()}
                                     onKeyDown={(e) => {
                                       // Handle keyboard shortcuts
                                       if (e.ctrlKey || e.metaKey) {
                                         if (e.key === 'Enter') {
                                           // Ctrl/Cmd + Enter to save
                                           e.preventDefault()
                                           saveInlineEditImmediately()
                                         }
                                       }
                                       
                                       // Ctrl/Cmd + Shift + A for AI edit
                                       if (e.ctrlKey || e.metaKey) {
                                         if (e.shiftKey && e.key === 'A') {
                                           e.preventDefault()
                                           if (inlineEditing?.selection && inlineEditing.assetId) {
                                             const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                             handleAITextEdit(
                                               inlineEditing.selection,
                                               activeScript.content || '',
                                               inlineEditing.assetId
                                             )
                                           }
                                         }
                                       }
                                     }}
                                   />
                                   
                                   {/* Text Selection Actions */}
                                   {inlineEditing?.selection && (
                                     <div className="space-y-3">
                                       {/* Selection Info */}
                                       <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
                                         <span className="text-xs text-muted-foreground">
                                           Selected: {inlineEditing.selection.length} characters
                                         </span>
                                         <span className="text-xs text-blue-400">
                                           💡 Use Ctrl/Cmd + Shift + A for quick AI editing
                                         </span>
                                       </div>
                                       
                                       {/* Quick Action Buttons */}
                                       <div className="flex gap-1">
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={(e) => {
                                             e.preventDefault()
                                             e.stopPropagation()
                                             navigator.clipboard.writeText(inlineEditing.selection || '')
                                             toast({
                                               title: "Copied!",
                                               description: "Selected text copied to clipboard",
                                             })
                                           }}
                                           className="h-6 px-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                         >
                                           <Copy className="h-3 w-3 mr-1" />
                                           Copy
                                         </Button>
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={(e) => {
                                             e.preventDefault()
                                             e.stopPropagation()
                                             const target = document.querySelector('textarea') as HTMLTextAreaElement
                                             if (target) {
                                               const start = target.selectionStart
                                               const end = target.selectionEnd
                                               const newValue = target.value.substring(0, start) + target.value.substring(end)
                                               handleInlineEditChange(newValue)
                                               // Clear selection
                                               setInlineEditing(prev => prev ? { ...prev, selection: undefined } : null)
                                               toast({
                                                 title: "Cleared!",
                                                 description: "Selected text has been removed",
                                               })
                                             }
                                           }}
                                           className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                         >
                                           <Trash2 className="h-3 w-3 mr-1" />
                                           Clear
                                         </Button>
                                         <Button
                                           size="sm"
                                           variant="outline"
                                           onClick={async (e) => {
                                             e.preventDefault()
                                             e.stopPropagation()
                                             try {
                                               const clipboardText = await navigator.clipboard.readText()
                                               if (clipboardText) {
                                                 const target = document.querySelector('textarea') as HTMLTextAreaElement
                                                 if (target) {
                                                   const start = target.selectionStart
                                                   const end = target.selectionEnd
                                                   const newValue = target.value.substring(0, start) + clipboardText + target.value.substring(end)
                                                   handleInlineEditChange(newValue)
                                                   toast({
                                                     title: "Pasted!",
                                                     description: "Clipboard content pasted",
                                                   })
                                                 }
                                               }
                                             } catch (error) {
                                               toast({
                                                 title: "Paste Failed",
                                                 description: "Could not access clipboard. Try using Ctrl+V instead.",
                                                 variant: "destructive",
                                               })
                                             }
                                           }}
                                           className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                         >
                                           <Upload className="h-3 w-3 mr-1" />
                                           Paste
                                         </Button>
                                       </div>
                                       
                                       {/* AI Edit Section */}
                                       <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                         <div className="flex items-center justify-between mb-2">
                                           <span className="text-xs font-medium text-purple-400">
                                             🤖 AI-Powered Text Editing
                                           </span>
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={(e) => {
                                               e.preventDefault()
                                               e.stopPropagation()
                                               if (inlineEditing?.selection && inlineEditing.assetId) {
                                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                                 handleAITextEdit(
                                                   inlineEditing.selection,
                                                   activeScript.content || '',
                                                   inlineEditing.assetId
                                                 )
                                               }
                                             }}
                                             className="h-7 px-3 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 bg-purple-500/5"
                                           >
                                             <Bot className="h-3 w-3 mr-1" />
                                             Edit with AI
                                           </Button>
                                         </div>
                                         <p className="text-xs text-muted-foreground">
                                           Use AI to rewrite, improve, or modify your selected text while maintaining context with the rest of your scene.
                                         </p>
                                       </div>
                                     </div>
                                   )}
                                   {savingStatus?.assetId === activeScript.id && (
                                     <div className="flex items-center gap-2 text-sm">
                                       <span className={`${
                                         savingStatus.status === 'saving' ? 'text-blue-400' :
                                         savingStatus.status === 'saved' ? 'text-green-400' :
                                         'text-red-400'
                                       }`}>
                                         {savingStatus.status === 'saving' && '⏳ Saving...'}
                                         {savingStatus.status === 'saved' && '✓ Saved successfully!'}
                                         {savingStatus.status === 'error' && '✗ Failed to save'}
                                       </span>
                                       {savingStatus.message && (
                                         <span className="text-muted-foreground">- {savingStatus.message}</span>
                                       )}
                                     </div>
                                   )}
                                   <div className="text-xs text-muted-foreground">
                                     💡 Click Save when you're ready to save your changes
                                   </div>
                                 </div>
                               )
                             }
                             
                             return (
                               <div className="group relative">
                                 <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                                   {activeScript.content || 'No content available'}
                                 </pre>
                                 <Button
                                   size="sm"
                                   variant="ghost"
                                   onClick={() => startInlineEditing(activeScript.id, 'content', activeScript.content || '')}
                                   className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                 >
                                   <Edit className="h-4 w-4 mr-1" />
                                   Edit
                                 </Button>
                               </div>
                             )
                           })()}
                         </div>
                         
                       </CardContent>
                     </Card>
                     
                     {/* Text to Speech Card - Separated */}
                     <div className="w-full">
                       <TextToSpeech 
                         text={(() => {
                           const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                           return activeScript.content || ''
                         })()}
                         title={(() => {
                           const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                           return generateCleanName(activeScript.title, 'title') || 'Script'
                         })()}
                         className="w-full"
                         projectId={projectId}
                         sceneId={id}
                       />
                     </div>
                  </div>
                )
              }
              
              const groupedScripts = scriptAssets.reduce((acc, script) => {
                const parentId = script.parent_asset_id || script.id
                if (!acc[parentId]) {
                  acc[parentId] = []
                }
                acc[parentId].push(script)
                return acc
              }, {} as Record<string, typeof scriptAssets>)
              
              console.log('🎬 TIMELINE-SCENE - Grouped scripts:', groupedScripts)

              return Object.entries(groupedScripts).map(([parentId, versions]) => {
                    // Sort versions by version number
                    const sortedVersions = versions.sort((a, b) => a.version - b.version)
                    const latestVersion = sortedVersions[sortedVersions.length - 1]
                    const selectedVersion = getSelectedVersion(parentId) || latestVersion
                    
                    return (
                      <Card key={parentId} className="bg-card border-primary/20">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-xl font-bold text-primary">{generateCleanName(selectedVersion.title, 'title')}</h4>
                                <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                                  {getCleanVersionName(selectedVersion, isMobile)}
                                </Badge>
                                {selectedVersion.is_latest_version && (
                                  <Badge className="bg-green-500 text-white px-3 py-1 text-sm">
                                    LATEST
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                Generated with {selectedVersion.model} • {new Date(selectedVersion.created_at).toLocaleDateString()}
                              </p>
                              
                               {/* Version Tabs */}
                               <div className="mb-4">
                                 <div className="flex space-x-1 border-b border-green-400/30">
                                   {sortedVersions.map((version) => (
                                     <button
                                       key={version.id}
                                       onClick={() => selectVersion(parentId, version)}
                                       className={`px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 ${
                                         selectedVersion.id === version.id
                                           ? 'text-green-400 border-green-400 bg-green-500/10'
                                           : 'text-green-400/60 border-transparent hover:text-green-400 hover:border-green-400/40'
                                       }`}
                                     >
                                       {getCleanVersionName(version, isMobile)}
                                       {version.is_latest_version && (
                                         <span className="ml-1 text-xs text-green-300">★</span>
                                       )}
                                     </button>
                                   ))}
                                 </div>
                               </div>
                            </div>
                            <div className="flex gap-2">
                              {/* Quick Text to Speech Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => {
                                  // Scroll to the text-to-speech component
                                  const ttsElement = document.querySelector('[data-tts-component]')
                                  if (ttsElement) {
                                    ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }
                                }}
                              >
                                <Volume2 className="h-4 w-4 mr-2" />
                                Listen to Script
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => {
                                  // Navigate to AI Studio with script data
                                  const scriptData = {
                                    title: selectedVersion.title,
                                    content: selectedVersion.content,
                                    prompt: selectedVersion.prompt,
                                    model: selectedVersion.model,
                                    version_name: selectedVersion.version_name,
                                    version: selectedVersion.version,
                                    asset_id: selectedVersion.id,
                                    project_id: selectedVersion.project_id,
                                    scene_id: selectedVersion.scene_id,
                                    content_type: selectedVersion.content_type,
                                    generation_settings: selectedVersion.generation_settings,
                                    metadata: selectedVersion.metadata
                                  }
                                  
                                  // Store in sessionStorage for AI Studio to pick up
                                  sessionStorage.setItem('continueScriptData', JSON.stringify(scriptData))
                                  
                                  // Navigate to AI Studio
                                  router.push('/ai-studio')
                                  
                                  toast({
                                    title: "Script Loaded in AI Studio",
                                    description: "Your script is ready for editing and continuation.",
                                  })
                                }}
                              >
                                <Bot className="h-4 w-4 mr-2" />
                                Continue in AI Studio
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                                onClick={() => {
                                  // Open version editing modal
                                  setEditingVersion(selectedVersion)
                                  setVersionEditForm({
                                    title: selectedVersion.title,
                                    version_name: selectedVersion.version_name || `Version ${selectedVersion.version}`,
                                    content: selectedVersion.content || '',
                                    selection: ''
                                  })
                                  setShowVersionEdit(true)
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              
                              {/* Create New Version Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                onClick={async () => {
                                  try {
                                    setLoading(true)
                                    
                                    // Create a new version by duplicating the current script
                                    const newAssetData = {
                                      project_id: selectedVersion.project_id,
                                      scene_id: selectedVersion.scene_id,
                                      title: `${selectedVersion.title} (Copy)`,
                                      content_type: selectedVersion.content_type,
                                      content: selectedVersion.content,
                                      content_url: selectedVersion.content_url,
                                      prompt: selectedVersion.prompt,
                                      model: selectedVersion.model,
                                      version_name: `Version ${(selectedVersion.version || 0) + 1}`,
                                      generation_settings: selectedVersion.generation_settings,
                                      metadata: {
                                        ...selectedVersion.metadata,
                                        duplicated_from_version: selectedVersion.version,
                                        duplicated_at: new Date().toISOString(),
                                        duplicated_from_asset_id: selectedVersion.id,
                                        is_duplicate: true
                                       }
                                     }
                                     
                                     // Save as new version
                                     await AssetService.createAsset(newAssetData)
                                     
                                     // Refresh assets
                                     refreshAssets()
                                     
                                     toast({
                                       title: "New Version Created!",
                                       description: `A copy of "${selectedVersion.title}" has been created as a new version.`,
                                     })
                                     
                                   } catch (error) {
                                     console.error('🎬 TIMELINE-SCENE - Error creating new version:', error)
                                     toast({
                                       title: "Error",
                                       description: "Failed to create new version. Please try again.",
                                       variant: "destructive",
                                     })
                                   } finally {
                                     setLoading(false)
                                   }
                                 }}
                                 disabled={loading}
                               >
                                 <Copy className="h-4 w-4 mr-2" />
                                 Create New Version
                               </Button>
                               
                               {/* Delete Version Button */}
                               <AlertDialog>
                                 <AlertDialogTrigger asChild>
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                   >
                                     <Trash2 className="h-4 w-4 mr-2" />
                                     Delete Version
                                   </Button>
                                 </AlertDialogTrigger>
                                 <AlertDialogContent className="bg-background border-red-500/20 max-w-md">
                                   <AlertDialogHeader>
                                     <AlertDialogTitle className="text-red-400">Delete Script Version</AlertDialogTitle>
                                     <AlertDialogDescription className="text-muted-foreground">
                                       Are you sure you want to delete "{selectedVersion.title}" version {selectedVersion.version_name || `v${selectedVersion.version}`}?
                                       <br /><br />
                                       <strong>This action cannot be undone.</strong> The version will be permanently removed.
                                     </AlertDialogDescription>
                                   </AlertDialogHeader>
                                   <AlertDialogFooter>
                                     <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                                     <AlertDialogAction 
                                       className="bg-red-500 hover:bg-red-600"
                                       onClick={async () => {
                                         try {
                                           setLoading(true)
                                           
                                           const result = await deleteAssetWithVersioning(selectedVersion.id)
                                           
                                           if (result.success) {
                                             // Refresh assets
                                             refreshAssets()
                                             
                                             toast({
                                               title: "Version Deleted!",
                                               description: `"${selectedVersion.title}" version ${selectedVersion.version_name || `v${selectedVersion.version}`} has been permanently removed.`,
                                             })
                                           } else {
                                             toast({
                                               title: "Delete Failed",
                                               description: result.error || "Failed to delete version. Please try again.",
                                               variant: "destructive",
                                             })
                                           }
                                         } catch (error) {
                                           console.error('🎬 TIMELINE-SCENE - Error deleting version:', error)
                                           toast({
                                             title: "Delete Failed",
                                             description: error instanceof Error ? error.message : "Failed to delete version. Please try again.",
                                             variant: "destructive",
                                           })
                                         } finally {
                                           setLoading(false)
                                         }
                                       }}
                                     >
                                       Delete Version
                                     </AlertDialogAction>
                                   </AlertDialogFooter>
                                 </AlertDialogContent>
                               </AlertDialog>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-muted/20 p-4 rounded-lg border border-border mb-4">
                            {(() => {
                              // Check if this content is being edited inline
                              if (inlineEditing?.assetId === selectedVersion.id && inlineEditing.field === 'content') {
                                return (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm font-medium text-muted-foreground">
                                        Editing Script Content
                                      </Label>
                                      <div className="text-xs text-blue-400">
                                        💡 Select text for copy/clear/paste actions • Click Save when ready
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={saveInlineEditImmediately}
                                          className="h-8 px-3 text-sm border-green-500/30 text-green-400 hover:bg-green-500/10"
                                        >
                                          <Save className="h-4 w-4 mr-1" />
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={cancelInlineEditing}
                                          className="h-8 px-3 text-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                    <Textarea
                                      value={inlineEditing.value}
                                      onChange={(e) => handleInlineEditChange(e.target.value)}
                                      placeholder="Edit your script content here..."
                                      className="w-full h-96 p-4 border border-primary/30 focus:border-primary bg-background text-foreground resize-none font-mono text-sm leading-relaxed"
                                      autoFocus
                                      onSelect={handleTextSelection}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onMouseUp={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                      onFocus={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => {
                                        // Handle keyboard shortcuts if needed
                                        if (e.ctrlKey || e.metaKey) {
                                          // Keyboard shortcuts can be added here
                                        }
                                      }}
                                    />
                                    
                                    {/* Text Selection Actions */}
                                    {inlineEditing?.selection && (
                                      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
                                        <span className="text-xs text-muted-foreground">
                                          Selected: {inlineEditing.selection.length} characters
                                        </span>
                                        <div className="flex gap-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              navigator.clipboard.writeText(inlineEditing.selection || '')
                                              toast({
                                                title: "Copied!",
                                                description: "Selected text copied to clipboard",
                                              })
                                            }}
                                            className="h-6 px-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                          >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              const target = document.querySelector('textarea') as HTMLTextAreaElement
                                              if (target) {
                                                const start = target.selectionStart
                                                const end = target.selectionEnd
                                                const newValue = target.value.substring(0, start) + target.value.substring(end)
                                                handleInlineEditChange(newValue)
                                                // Clear selection
                                                setInlineEditing(prev => prev ? { ...prev, selection: undefined } : null)
                                                toast({
                                                  title: "Cleared!",
                                                  description: "Selected text has been removed",
                                                })
                                              }
                                            }}
                                            className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                          >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Clear
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                              try {
                                                const clipboardText = await navigator.clipboard.readText()
                                                if (clipboardText) {
                                                  const target = document.querySelector('textarea') as HTMLTextAreaElement
                                                  if (target) {
                                                    const start = target.selectionStart
                                                    const end = target.selectionEnd
                                                    const newValue = target.value.substring(0, start) + clipboardText + target.value.substring(end)
                                                    handleInlineEditChange(newValue)
                                                    toast({
                                                      title: "Pasted!",
                                                      description: "Clipboard content pasted",
                                                    })
                                                  }
                                                }
                                              } catch (error) {
                                                toast({
                                                  title: "Paste Failed",
                                                  description: "Could not access clipboard. Try using Ctrl+V instead.",
                                                  variant: "destructive",
                                                })
                                              }
                                            }}
                                            className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                          >
                                            <Upload className="h-3 w-3 mr-1" />
                                            Paste
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    {savingStatus?.assetId === selectedVersion.id && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className={`${
                                          savingStatus.status === 'saving' ? 'text-blue-400' :
                                          savingStatus.status === 'saved' ? 'text-green-400' :
                                          'text-red-400'
                                        }`}>
                                          {savingStatus.status === 'saving' && '⏳ Saving...'}
                                          {savingStatus.status === 'saved' && '✓ Saved successfully!'}
                                          {savingStatus.status === 'error' && '✗ Failed to save'}
                                        </span>
                                        {savingStatus.message && (
                                          <span className="text-muted-foreground">- {savingStatus.message}</span>
                                        )}
                                      </div>
                                    )}
                                                                         <div className="text-xs text-muted-foreground">
                                       💡 Click Save when you're ready to save your changes
                                     </div>
                                  </div>
                                )
                              }
                              
                              return (
                                <div className="group relative">
                                  <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                                    {selectedVersion.content || 'No content available'}
                                  </pre>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startInlineEditing(selectedVersion.id, 'content', selectedVersion.content || '')}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                </div>
                              )
                            })()}
                          </div>
                          
                        </CardContent>
                      </Card>
                      
                    )
                  })
                })()}
                

              </div>
            )}
            {/* Screenplay Section */}
            {!screenplayContent && !scene?.screenplay_content && !isEditingScreenplay && (
              <Card className="bg-card border-purple-500/20">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Screenplay Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create a blank page to start writing manually, or generate a screenplay using AI.
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50"
                      onClick={() => {
                        // Create a blank page and enter edit mode
                        // Use a single newline so it's not empty (falsy) but appears blank
                        const blankContent = "\n"
                        setScreenplayContent(blankContent)
                        setEditedPages(new Map([[1, ""]]))
                        setTotalPages(1)
                        setCurrentPage(1)
                        setIsEditingScreenplay(true)
                        toast({
                          title: "Blank Page Created",
                          description: "You can now start writing your screenplay manually.",
                        })
                      }}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Create Blank Page
                    </Button>
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 hover:from-purple-700 hover:via-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all duration-300 border-0"
                      onClick={generateScreenplay}
                      disabled={isGeneratingScreenplay || !treatmentId}
                      title={!treatmentId ? "Treatment not found for this project" : "Generate screenplay from scene description and treatment"}
                    >
                      {isGeneratingScreenplay ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Generating Screenplay...
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5 mr-2" />
                          Generate Screenplay
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {(screenplayContent || scene?.screenplay_content || isEditingScreenplay) && (
              <>
                {/* Fix Formatting Button */}
                <div className="mt-6 mb-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    onClick={async () => {
                      try {
                        const content = screenplayContent || scene?.screenplay_content
                        if (!content) {
                          toast({
                            title: "Error",
                            description: "No screenplay content to format.",
                            variant: "destructive",
                          })
                          return
                        }

                        setLoading(true)
                        
                        console.log('🎬 FIX FORMAT - Starting formatting fix')
                        console.log('🎬 FIX FORMAT - Content length:', content.length)
                        
                        const response = await fetch('/api/scenes/fix-screenplay-format', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            screenplay: content,
                            sceneId: id,
                            userId: userId,
                          }),
                        })
                        
                        console.log('🎬 FIX FORMAT - Response status:', response.status)

                        if (!response.ok) {
                          const errorData = await response.json()
                          throw new Error(errorData.error || 'Failed to fix formatting')
                        }

                        const result = await response.json()
                        
                        if (result.success && result.screenplay) {
                          console.log('🎬 FIX FORMAT - Formatting successful')
                          console.log('🎬 FIX FORMAT - Formatted content length:', result.screenplay.length)
                          
                          // Update the screenplay content - this will trigger page recalculation via useEffect
                          // Only update screenplayContent, don't update scene directly to avoid double updates
                          setScreenplayContent(result.screenplay)
                          
                          // Also update scene to keep in sync
                          if (scene) {
                            setScene({
                              ...scene,
                              screenplay_content: result.screenplay
                            })
                          }
                          
                          // Wait a moment for state to update before showing success
                          await new Promise(resolve => setTimeout(resolve, 100))
                          
                          toast({
                            title: "Formatting Fixed!",
                            description: "The screenplay has been reformatted with proper spacing.",
                          })
                        } else {
                          console.error('🎬 FIX FORMAT - No formatted screenplay in result:', result)
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
                    disabled={loading || isEditingScreenplay}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Fix Formatting
                  </Button>
                </div>
                <Card className="bg-card border-purple-500/20">
                  <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-purple-400">Screenplay Script</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Professional screenplay format generated from scene description and treatment
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {totalPages > 1 && !isEditingScreenplay && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="px-3 py-1">
                            Page {currentPage} of {totalPages}
                          </Badge>
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
                      {!isEditingScreenplay ? (
                        <>
                          <Button
                            variant="outline"
                            size="lg"
                            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            onClick={handleEditScreenplay}
                          >
                            <Edit3 className="h-5 w-5 mr-2" />
                            Edit Screenplay
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="lg"
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                disabled={savingScreenplay}
                              >
                                <Trash2 className="h-5 w-5 mr-2" />
                                Delete Screenplay
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-background border-red-500/20 max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-red-400">Delete Screenplay</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                  Are you sure you want to delete the screenplay for this scene?
                                  <br /><br />
                                  <strong>This action cannot be undone.</strong> The screenplay content will be permanently removed from this scene.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={handleDeleteScreenplay}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            size="lg"
                            className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 hover:from-purple-700 hover:via-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all duration-300 border-0"
                            onClick={generateScreenplay}
                            disabled={isGeneratingScreenplay || !treatmentId}
                          >
                            {isGeneratingScreenplay ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Regenerating...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-5 w-5 mr-2" />
                                Regenerate Screenplay
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="px-3 py-1 text-blue-400 border-blue-500/30">
                          Editing Mode
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditingScreenplay ? (
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEditScreenplay}
                            disabled={savingScreenplay}
                            className="h-8 px-3 text-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            Cancel
                          </Button>
                        </div>
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
                            ref={screenplayTextareaRef}
                            data-screenplay-editor
                            value={getCurrentPageEditContent()}
                            onChange={(e) => saveCurrentPageEdit(e.target.value)}
                            onSelect={handleScreenplayTextSelection}
                            onKeyDown={handleScreenplayKeyDown}
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
                            className="fixed z-50 bg-background border border-border rounded-lg shadow-lg p-2"
                            style={{
                              top: `${toolbarPosition.top}px`,
                              left: `${toolbarPosition.left}px`,
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {selectedText.length} chars
                              </Badge>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={handleAITextEditScreenplay}
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
                                  const textarea = screenplayTextareaRef.current
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
                            <div className="border-t border-border pt-2 mt-2">
                              <div className="text-xs text-muted-foreground mb-1">Convert to:</div>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => convertToScreenplayFormat('character')}
                                  className="h-7 px-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                >
                                  <Users className="h-3 w-3 mr-1" />
                                  Character
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => convertToScreenplayFormat('dialogue')}
                                  className="h-7 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                >
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Dialogue
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => convertToScreenplayFormat('action')}
                                  className="h-7 px-2 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  Action
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => convertToScreenplayFormat('parenthetical')}
                                  className="h-7 px-2 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                                >
                                  <Type className="h-3 w-3 mr-1" />
                                  (Wryly)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => convertToScreenplayFormat('scene-heading')}
                                  className="h-7 px-2 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                                >
                                  <MapPin className="h-3 w-3 mr-1" />
                                  Scene
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-end">
                        <Button
                          onClick={handleSaveScreenplay}
                          disabled={savingScreenplay}
                          className="bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 hover:from-purple-700 hover:via-purple-600 hover:to-pink-600 text-white font-semibold"
                        >
                          {savingScreenplay ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Screenplay
                            </>
                          )}
                        </Button>
                      </div>
                      {/* Audio Generation for Current Page (Editing Mode) */}
                      {getCurrentPageEditContent() && getCurrentPageEditContent().trim() && (
                        <div className="mt-4">
                          <TextToSpeech 
                            text={getCurrentPageEditContent()}
                            title={`Scene Page ${currentPage} Audio`}
                            className="w-full"
                            projectId={projectId}
                            sceneId={id}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="px-3 py-1">
                            Page {currentPage} of {totalPages}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                            onClick={() => router.push(`/storyboards/${id}`)}
                          >
                            <Film className="h-4 w-4 mr-2" />
                            View Storyboards
                          </Button>
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90"
                            onClick={generateShotListFromPage}
                            disabled={isGeneratingShotList || !getCurrentPageContent()}
                          >
                            {isGeneratingShotList ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating Shot List...
                              </>
                            ) : (
                              <>
                                <Film className="h-4 w-4 mr-2" />
                                Generate Shot List from This Page
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 relative w-full">
                        <div className="relative w-full">
                          {/* Visual ruler for 80-character line width with center marker - same as edit mode */}
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
                          <pre 
                            className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed pt-8"
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
                              overflowX: 'hidden',
                              minHeight: '600px',
                              backgroundColor: 'transparent'
                            }}
                          >
                            {getCurrentPageContent()}
                          </pre>
                        </div>
                      </div>
                      {/* Audio Generation for Current Page */}
                      {getCurrentPageContent() && getCurrentPageContent().trim() && (
                        <div className="mt-4">
                          <TextToSpeech 
                            text={getCurrentPageContent()}
                            title={`Scene Page ${currentPage} Audio`}
                            className="w-full"
                            projectId={projectId}
                            sceneId={id}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                {/* Bottom Pagination */}
                {totalPages > 1 && !isEditingScreenplay && (
                  <div className="flex items-center justify-center gap-4 py-4 border-t border-purple-500/20">
                    <Badge variant="outline" className="px-4 py-2">
                      Page {currentPage} of {totalPages}
                    </Badge>
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
              </Card>
              </>
            )}

            {/* Shot List Card - Separate from Screenplay Card */}
            {!isEditingScreenplay && screenplayContent && (
              <Collapsible open={isShotListExpanded} onOpenChange={setIsShotListExpanded} className="mt-6">
                <Card className="bg-card border-primary/20">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Film className="h-5 w-5 text-blue-400" />
                          <CardTitle>Shot List</CardTitle>
                        </div>
                        {isShotListExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Shots generated from this scene's screenplay. Use "Generate Shot List from This Page" above to create shots for the current page.
                      </p>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <ShotListComponent
                        key={`shot-list-${shotListRefreshKey}`}
                        sceneId={id}
                        projectId={projectId}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-primary">Scene Images</h3>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                onClick={() => router.push('/ai-studio')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Image
              </Button>
            </div>

            {assets.filter(a => a.content_type === 'image').length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.filter(a => a.content_type === 'image').map((image) => (
                  <Card key={image.id} className="bg-card border-primary/20">
                    <CardContent className="p-4">
                      <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {image.content_url ? (
                          <img 
                            src={image.content_url} 
                            alt={generateCleanName(image.title, 'title')}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <h4 className="font-medium text-foreground mb-1">{generateCleanName(image.title, 'title')}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Generated with {image.model} • {new Date(image.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => window.open(image.content_url, '_blank')}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={() => {
                            // Navigate to AI Studio to generate variations
                            const imageData = {
                              title: image.title,
                              prompt: image.prompt,
                              model: image.model,
                              asset_id: image.id,
                              project_id: image.project_id,
                              scene_id: image.scene_id,
                              content_type: image.content_type,
                              generation_settings: image.generation_settings,
                              metadata: image.metadata
                            }
                            
                            sessionStorage.setItem('continueImageData', JSON.stringify(imageData))
                            router.push('/ai-studio')
                            
                            toast({
                              title: "Image Loaded in AI Studio",
                              description: "Ready to generate variations or new images.",
                            })
                          }}
                        >
                          <Bot className="h-4 w-4 mr-2" />
                          Generate Variation
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-background border-red-500/20 max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-red-400">Delete Image</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                Are you sure you want to delete "{generateCleanName(image.title, 'title')}"?
                                <br /><br />
                                <strong>This action cannot be undone.</strong> The image will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex gap-2">
                              <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                              <Button
                                className="bg-red-500 hover:bg-red-600"
                                onClick={async () => {
                                  try {
                                    setLoading(true)
                                    
                                    // Use the new delete-asset API endpoint to handle foreign key constraints
                                    const response = await fetch('/api/ai/delete-asset', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        assetId: image.id,
                                        userId: user?.id
                                      })
                                    })
                                    
                                    const result = await response.json()
                                    
                                    if (!response.ok) {
                                      throw new Error(result.error || 'Failed to delete asset')
                                    }
                                    
                                    // Refresh assets
                                    refreshAssets()
                                    
                                    toast({
                                      title: "Image Deleted!",
                                      description: `"${generateCleanName(image.title, 'title')}" has been permanently removed.`,
                                    })
                                  } catch (error) {
                                    console.error('🎬 TIMELINE-SCENE - Error deleting image:', error)
                                    toast({
                                      title: "Delete Failed",
                                      description: error instanceof Error ? error.message : "Failed to delete image. Please try again.",
                                      variant: "destructive",
                                    })
                                  } finally {
                                    setLoading(false)
                                  }
                                }}
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Image
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No images generated for this scene yet</p>
                  <Button
                    onClick={() => router.push('/ai-studio')}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Generate Your First Image
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Video Tab */}
          <TabsContent value="video" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-primary">Scene Videos</h3>
              <Button
                size="sm"
                className="bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90"
                onClick={() => router.push('/ai-studio')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Video
              </Button>
            </div>

            {assets.filter(a => a.content_type === 'video').length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.filter(a => a.content_type === 'video').map((video) => (
                  <Card key={video.id} className="bg-card border-primary/20">
                    <CardContent className="p-4">
                      <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {video.content_url ? (
                          <video 
                            src={video.content_url} 
                            className="w-full h-full object-cover"
                            controls
                            preload="metadata"
                            onError={(e) => {
                              console.error('🎬 Video playback error:', e)
                              console.error('🎬 Video URL:', video.content_url)
                            }}
                            onLoadStart={() => console.log('🎬 Video loading started:', video.title)}
                            onCanPlay={() => console.log('🎬 Video can play:', video.title)}
                          />
                        ) : (
                          <div className="text-center">
                            <Play className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Video Preview</p>
                          </div>
                        )}
                      </div>
                      <h4 className="font-medium text-foreground mb-1">{video.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Generated with {video.model} • {new Date(video.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => window.open(video.content_url, '_blank')}
                        >
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                          onClick={() => {
                            const link = document.createElement('a')
                            link.href = video.content_url
                            link.download = `${video.title}.mp4`
                            link.target = '_blank'
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={() => {
                            // Navigate to AI Studio to generate variations
                            const videoData = {
                              title: video.title,
                              prompt: video.prompt,
                              model: video.model,
                              asset_id: video.id,
                              project_id: video.project_id,
                              scene_id: video.scene_id,
                              content_type: video.content_type,
                              generation_settings: video.generation_settings,
                              metadata: video.metadata
                            }
                            
                            sessionStorage.setItem('continueVideoData', JSON.stringify(videoData))
                            router.push('/ai-studio')
                            
                            toast({
                              title: "Video Loaded in AI Studio",
                              description: "Ready to generate variations or new videos.",
                            })
                          }}
                        >
                          <Bot className="h-4 w-4 mr-2" />
                          Generate Variation
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-background border-red-500/20 max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-red-400">Delete Video</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                Are you sure you want to delete "{video.title}"?
                                <br /><br />
                                <strong>This action cannot be undone.</strong> The video will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex gap-2">
                              <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                              <Button
                                className="bg-red-500 hover:bg-red-600"
                                onClick={async () => {
                                  try {
                                    setLoading(true)
                                    
                                    // Simple delete - only delete this specific video
                                    const { error: deleteError } = await supabase
                                      .from('assets')
                                      .delete()
                                      .eq('id', video.id)
                                      .eq('user_id', session?.user?.id)
                                    
                                    if (deleteError) {
                                      throw new Error(`Failed to delete: ${deleteError.message}`)
                                    }
                                    
                                    // Refresh assets
                                    refreshAssets()
                                    
                                    toast({
                                      title: "Video Deleted!",
                                      description: `"${video.title}" has been permanently removed.`,
                                    })
                                  } catch (error) {
                                    console.error('🎬 TIMELINE-SCENE - Error deleting video:', error)
                                    toast({
                                      title: "Delete Failed",
                                      description: error instanceof Error ? error.message : "Failed to delete video. Please try again.",
                                      variant: "destructive",
                                    })
                                  } finally {
                                    setLoading(false)
                                  }
                                }}
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Video
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <Play className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No videos generated for this scene yet</p>
                  <Button
                    onClick={() => router.push('/ai-studio')}
                    className="bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90"
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Generate Your First Video
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Audio Tab */}
          <TabsContent value="audio" className="space-y-6">
            {(() => {
              console.log('🎵 AUDIO-TAB - Assets array:', assets)
              console.log('🎵 AUDIO-TAB - Audio assets:', assets.filter(a => a.content_type === 'audio'))
              return null
            })()}
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-primary">Scene Audio</h3>
              <Button
                size="sm"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90"
                onClick={() => router.push('/ai-studio')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Audio
              </Button>
            </div>

            {assets.filter(a => a.content_type === 'audio').length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.filter(a => a.content_type === 'audio').map((audio) => (
                  <Card key={audio.id} className="bg-card border-primary/20">
                    <CardContent className="p-4">
                      <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {audio.content_url ? (
                          <audio 
                            src={audio.content_url} 
                            className="w-full"
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <MessageSquare className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <h4 className="font-medium text-foreground mb-1">{audio.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Generated with {audio.model} • {new Date(audio.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => window.open(audio.content_url, '_blank')}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={() => {
                            // Navigate to AI Studio to generate variations
                            const audioData = {
                              title: audio.title,
                              prompt: audio.prompt,
                              model: audio.model,
                              asset_id: audio.id,
                              project_id: audio.project_id,
                              scene_id: audio.scene_id,
                              content_type: audio.content_type,
                              generation_settings: audio.generation_settings,
                              metadata: audio.metadata
                            }
                            
                            sessionStorage.setItem('continueAudioData', JSON.stringify(audioData))
                            router.push('/ai-studio')
                            
                            toast({
                              title: "Audio Loaded in AI Studio",
                              description: "Ready to generate variations or new audio.",
                            })
                          }}
                        >
                          <Bot className="h-4 w-4 mr-2" />
                          Generate Variation
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-background border-red-500/20 max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-red-400">Delete Audio</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                Are you sure you want to delete "{audio.title}"?
                                <br /><br />
                                <strong>This action cannot be undone.</strong> The audio will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex gap-2">
                              <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                              <Button
                                className="bg-red-500 hover:bg-red-600"
                                onClick={async () => {
                                  try {
                                    setLoading(true)
                                    
                                    // Simple delete - only delete this specific audio
                                    const { error: deleteError } = await supabase
                                      .from('assets')
                                      .delete()
                                      .eq('id', audio.id)
                                      .eq('user_id', session?.user?.id)
                                    
                                    if (deleteError) {
                                      throw new Error(`Failed to delete: ${deleteError.message}`)
                                    }
                                    
                                    // Refresh assets
                                    refreshAssets()
                                    
                                    toast({
                                      title: "Audio Deleted!",
                                      description: `"${audio.title}" has been permanently removed.`,
                                    })
                                  } catch (error) {
                                    console.error('🎬 TIMELINE-SCENE - Error deleting audio:', error)
                                    toast({
                                      title: "Delete Failed",
                                      description: error instanceof Error ? error.message : "Failed to delete audio. Please try again.",
                                      variant: "destructive",
                                    })
                                  } finally {
                                    setLoading(false)
                                  }
                                }}
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Audio
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No audio generated for this scene yet</p>
                  <Button
                    onClick={() => router.push('/ai-studio')}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90"
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Generate Your First Audio
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Import Files Tab */}
          <TabsContent value="import" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-primary">Import Documents</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Import PDF, Word, and text files into your scene as assets
                </p>
              </div>
            </div>

            {projectId ? (
              <FileImport
                projectId={projectId}
                sceneId={id}
                onFileImported={(assetId) => {
                  // Refresh assets after import
                  refreshAssets()
                  toast({
                    title: "File Imported",
                    description: "Your file has been imported and saved as a scene asset!",
                  })
                }}
              />
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Loading project information...</p>
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-32 mx-auto mb-2"></div>
                    <div className="h-3 bg-muted rounded w-48 mx-auto"></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Shot List Tab */}
          <TabsContent value="shot-list" className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <ShotListComponent
                  key={shotListRefreshKey}
                  sceneId={id}
                  projectId={projectId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Link Assets Tab Content */}
          <TabsContent value="link-assets" className="space-y-6">
            <Card className="bg-card border-orange-500/20">
              <CardHeader>
                <CardTitle className="text-orange-500">
                  Link Existing Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  You have assets that aren't linked to this scene. Would you like to link them?
                </p>
                <Button
                  onClick={async () => {
                    if (!userId) {
                      toast({
                        title: "Error",
                        description: "You must be logged in to link assets.",
                        variant: "destructive",
                      })
                      return
                    }

                    try {
                      const supabase = getSupabaseClient()
                      
                      // Get all assets for the user
                      const { data: allAssets } = await supabase
                        .from('assets')
                        .select('*')
                        .eq('user_id', userId)
                        .is('scene_id', null)
                      
                      if (allAssets && allAssets.length > 0) {
                        // Link them to this scene
                        const { error } = await supabase
                          .from('assets')
                          .update({ scene_id: id })
                          .eq('user_id', userId)
                          .is('scene_id', null)
                          .eq('project_id', allAssets[0].project_id) // Only link assets from same project
                        
                        if (error) {
                          console.error('🎬 TIMELINE-SCENE - Error linking assets:', error)
                          toast({
                            title: "Error",
                            description: "Failed to link assets to scene.",
                            variant: "destructive",
                          })
                        } else {
                          toast({
                            title: "Assets Linked!",
                            description: `${allAssets.length} assets have been linked to this scene.`,
                          })
                          // Refresh the assets
                          refreshAssets()
                          // Switch to a different tab after linking
                          setActiveTab("scripts")
                        }
                      } else {
                        toast({
                          title: "No Assets Found",
                          description: "There are no unlinked assets to link to this scene.",
                        })
                      }
                    } catch (error) {
                      console.error('🎬 TIMELINE-SCENE - Error linking assets:', error)
                      toast({
                        title: "Error",
                        description: "Failed to link assets to scene.",
                        variant: "destructive",
                      })
                    }
                  }}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Link Existing Assets to Scene
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Versions Tab Content */}
          <TabsContent value="versions" className="space-y-6">
            {/* Version Management Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-400">Version Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage different versions of your scene content with clear labeling
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={refreshAssets}
                  variant="outline"
                  size="sm"
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  onClick={() => router.push('/ai-studio')}
                  className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate New Content
                </Button>
              </div>
            </div>

            {/* Content Type Tabs */}
            <Tabs defaultValue="script" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
                <TabsTrigger value="script" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                  Scripts ({assetsByType.script?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="image" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                  Images ({assetsByType.image?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="video" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                  Videos ({assetsByType.video?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="audio" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                  Audio ({assetsByType.audio?.length || 0})
                </TabsTrigger>
              </TabsList>

              {Object.entries(assetsByType).map(([type, typeAssets]) => (
                <TabsContent key={type} value={type} className="space-y-4">
                  {typeAssets && typeAssets.length > 0 ? (
                    <div className="grid gap-4">
                      {/* Group assets by parent to show version history */}
                      {(() => {
                        const groupedAssets = typeAssets.reduce((acc, asset) => {
                          const parentId = asset.parent_asset_id || asset.id;
                          if (!acc[parentId]) {
                            acc[parentId] = [];
                          }
                          acc[parentId].push(asset);
                          return acc;
                        }, {} as Record<string, typeof typeAssets>);

                        return Object.entries(groupedAssets).map(([parentId, versions]) => {
                          // Sort versions by version number
                          const sortedVersions = versions.sort((a, b) => a.version - b.version);
                          const latestVersion = sortedVersions[sortedVersions.length - 1];
                          
                          return (
                            <Card key={parentId} className="bg-card border-2 border-green-500/30 hover:border-green-500/50 transition-colors">
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h4 className="text-xl font-bold text-green-400">{generateCleanName(latestVersion.title, 'title')}</h4>
                                      {/* BIG VERSION LABEL */}
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                                          {getCleanVersionName(latestVersion, isMobile)}
                                        </Badge>
                                        {latestVersion.metadata?.version_label && (
                                          <Badge variant="outline" className="px-2 py-1 border-blue-500 text-blue-400 bg-blue-500/10">
                                            {latestVersion.metadata.version_label}
                                          </Badge>
                                        )}
                                        {latestVersion.is_latest_version && (
                                          <Badge className="bg-green-500 text-white px-3 py-1 text-sm">
                                            LATEST
                                          </Badge>
                                        )}
                                        <Badge variant="secondary" className="capitalize">
                                          {latestVersion.content_type}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    {/* Version History Bar */}
                                    {versions.length > 1 && (
                                      <div className="flex items-center gap-2 mb-3">
                                        <span className="text-sm text-muted-foreground">Version History:</span>
                                        <div className="flex gap-1">
                                          {sortedVersions.map((version, idx) => (
                                            <div
                                              key={version.id}
                                              className={`w-8 h-2 rounded-full cursor-pointer transition-all ${
                                                version.is_latest_version 
                                                  ? 'bg-green-500' 
                                                  : version.id === latestVersion.id
                                                  ? 'bg-green-300'
                                                  : 'bg-gray-400 hover:bg-gray-300'
                                              }`}
                                              title={`${getCleanVersionName(version, isMobile)} - ${new Date(version.created_at).toLocaleDateString()}`}
                                            />
                                          ))}
                                        </div>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          {versions.length} version{versions.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Version Actions */}
                                  <div className="flex gap-2">
                                    {/* Quick Text to Speech Button */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                      onClick={() => {
                                        // Scroll to the text-to-speech component
                                        const ttsElement = document.querySelector('[data-tts-component]')
                                        if (ttsElement) {
                                          ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                        }
                                      }}
                                    >
                                      <Volume2 className="h-4 w-4 mr-2" />
                                      Listen to Script
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                      onClick={() => {
                                        // Get all versions of this asset for comparison
                                        const allVersions = typeAssets.filter(asset => 
                                          asset.parent_asset_id === parentId || asset.id === parentId
                                        ).sort((a, b) => a.version - b.version);
                                        
                                        if (allVersions.length > 1) {
                                          setCompareVersions(allVersions);
                                          setShowVersionCompare(true);
                                        } else {
                                          toast({
                                            title: "No Versions to Compare",
                                            description: "This asset only has one version.",
                                          });
                                        }
                                      }}
                                    >
                                      <GitCompare className="h-4 w-4 mr-2" />
                                      Compare
                                    </Button>
                                    
                                    {/* Continue in AI Studio Button */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                      onClick={() => {
                                        // Navigate to AI Studio with script data
                                        const scriptData = {
                                          title: latestVersion.title,
                                          content: latestVersion.content,
                                          prompt: latestVersion.prompt,
                                          model: latestVersion.model,
                                          version_name: latestVersion.version_name,
                                          version: latestVersion.version,
                                          asset_id: latestVersion.id,
                                          project_id: latestVersion.project_id,
                                          scene_id: latestVersion.scene_id,
                                          content_type: latestVersion.content_type,
                                          generation_settings: latestVersion.generation_settings,
                                          metadata: latestVersion.metadata
                                        }
                                        
                                        // Store in sessionStorage for AI Studio to pick up
                                        sessionStorage.setItem('continueScriptData', JSON.stringify(scriptData))
                                        
                                        // Navigate to AI Studio
                                        router.push('/ai-studio')
                                        
                                        toast({
                                          title: "Script Loaded in AI Studio",
                                          description: "Your script is ready for editing and continuation.",
                                        })
                                      }}
                                    >
                                      <Bot className="h-4 w-4 mr-2" />
                                      Continue in AI Studio
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                                      onClick={() => {
                                        // Open version editing modal
                                        setEditingVersion(latestVersion)
                                        setVersionEditForm({
                                          title: latestVersion.title,
                                          version_name: latestVersion.version_name || `Version ${latestVersion.version}`,
                                          content: latestVersion.content || '',
                                          selection: ''
                                        })
                                        setShowVersionEdit(true)
                                      }}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </Button>
                                    
                                    {/* Delete Version Button */}
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="bg-background border-red-500/20">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="text-red-400">Delete Asset Version</AlertDialogTitle>
                                          <AlertDialogDescription className="text-muted-foreground">
                                            Are you sure you want to delete "{latestVersion.title}" version {latestVersion.version_name || `v${latestVersion.version}`}?
                                            <br /><br />
                                            <strong>This action cannot be undone.</strong> The version will be permanently removed.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                                          <AlertDialogAction 
                                            className="bg-red-500 hover:bg-red-600"
                                            onClick={async () => {
                                              try {
                                                setLoading(true)
                                                
                                                const result = await deleteAssetWithVersioning(latestVersion.id)
                                                
                                                if (result.success) {
                                                  // Refresh assets
                                                  refreshAssets()
                                                  
                                                  toast({
                                                    title: "Version Deleted!",
                                                    description: `"${latestVersion.title}" version ${latestVersion.version_name || `v${latestVersion.version}`} has been permanently removed.`,
                                                  })
                                                } else {
                                                  toast({
                                                    title: "Delete Failed",
                                                    description: result.error || "Failed to delete version. Please try again.",
                                                    variant: "destructive",
                                                  })
                                                }
                                              } catch (error) {
                                                console.error('🎬 TIMELINE-SCENE - Error deleting version:', error)
                                                toast({
                                                  title: "Delete Failed",
                                                  description: error instanceof Error ? error.message : "Failed to delete version. Please try again.",
                                                  variant: "destructive",
                                                })
                                              } finally {
                                                setLoading(false)
                                              }
                                            }}
                                          >
                                            Delete Version
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                    
                                    {/* Create New Version Button */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                      onClick={async () => {
                                        try {
                                          setLoading(true)
                                          
                                          // Create a new version by duplicating the current script
                                          const newAssetData = {
                                            project_id: latestVersion.project_id,
                                            scene_id: latestVersion.scene_id,
                                            title: `${latestVersion.title} (Copy)`,
                                            content_type: latestVersion.content_type,
                                            content: latestVersion.content,
                                            content_url: latestVersion.content_url,
                                            prompt: latestVersion.prompt,
                                            model: latestVersion.model,
                                            version_name: `Version ${(latestVersion.version || 0) + 1}`,
                                            generation_settings: latestVersion.generation_settings,
                                            metadata: {
                                              ...latestVersion.metadata,
                                              duplicated_from_version: latestVersion.version,
                                              duplicated_at: new Date().toISOString(),
                                              duplicated_from_asset_id: latestVersion.id,
                                              is_duplicate: true
                                            }
                                          }
                                          
                                          // Save as new version
                                          await AssetService.createAsset(newAssetData)
                                          
                                          // Refresh assets
                                          refreshAssets()
                                          
                                          toast({
                                            title: "New Version Created!",
                                            description: `A copy of "${latestVersion.title}" has been created as a new version.`,
                                          })
                                          
                                        } catch (error) {
                                          console.error('🎬 TIMELINE-SCENE - Error creating new version:', error)
                                          toast({
                                            title: "Error",
                                            description: "Failed to create new version. Please try again.",
                                            variant: "destructive",
                                          })
                                        } finally {
                                          setLoading(false)
                                        }
                                      }}
                                      disabled={loading}
                                    >
                                      <Copy className="h-4 w-4 mr-2" />
                                      Create New Version
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              
                              <CardContent>
                                {/* Content Preview */}
                                <div className="mb-4">
                                  {latestVersion.content_type === 'script' && (
                                    <>
                                      <div className="bg-muted/50 p-4 rounded-lg border border-border max-h-96 overflow-y-auto mb-4">
                                        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                                          {latestVersion.content?.substring(0, 300)}
                                          {latestVersion.content && latestVersion.content.length > 300 && '...'}
                                        </pre>
                                      </div>
                                      
                                      {/* Text to Speech Component for Scripts */}
                                      <div data-tts-component>
                                        <TextToSpeech 
                                          text={latestVersion.content || ''}
                                          title={generateCleanName(latestVersion.title, 'title') || 'Script'}
                                          className="mt-4"
                                          projectId={projectId}
                                          sceneId={id}
                                        />
                                      </div>
                                    </>
                                  )}
                                  {latestVersion.content_type === 'image' && latestVersion.content_url && (
                                    <div className="flex justify-center">
                                      <img
                                        src={latestVersion.content_url}
                                        alt={generateCleanName(latestVersion.title, 'title')}
                                        className="max-w-full h-48 object-cover rounded-lg border border-border"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Generation Details */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Prompt:</span>
                                    <p className="text-foreground font-medium">{latestVersion.prompt}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Model:</span>
                                    <p className="text-foreground font-medium">{latestVersion.model}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Generated:</span>
                                    <p className="text-foreground font-medium">
                                      {new Date(latestVersion.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Last Updated:</span>
                                    <p className="text-foreground font-medium">
                                      {new Date(latestVersion.updated_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                                    onClick={() => {
                                      if (latestVersion.content) {
                                        navigator.clipboard.writeText(latestVersion.content);
                                        toast({
                                          title: "Copied!",
                                          description: "Script copied to clipboard",
                                        });
                                      }
                                    }}
                                  >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy {latestVersion.content_type === 'script' ? 'Script' : 'Content'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => {
                                      // TODO: Implement content editing
                                      toast({
                                        title: "Edit Content",
                                        description: "Edit the content of this version",
                                      });
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                        No {type}s Generated Yet
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Generate your first {type} for this scene to get started.
                      </p>
                      <Button
                        onClick={() => router.push('/ai-studio')}
                        className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Generate {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Edit Scene Dialog */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="bg-background border-primary/20 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-primary">Edit Scene</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="bg-card border-primary/30 text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Scene Number</Label>
                <Input
                  value={editForm.sceneNumber}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, sceneNumber: e.target.value }))}
                  className="bg-card border-primary/30 text-foreground"
                  placeholder="e.g., 1, 2, 3A"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="bg-card border-primary/30 text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Duration (optional)</Label>
                  <Input
                    type="number"
                    value={editForm.duration_seconds ?? ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, duration_seconds: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                    className="bg-card border-primary/30 text-foreground"
                    placeholder="Enter duration in seconds"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Status (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={editForm.scene_type || undefined}
                      onValueChange={(value) => setEditForm((prev) => ({ ...prev, scene_type: value }))}
                    >
                      <SelectTrigger className="bg-card border-primary/30 flex-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-primary/30">
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                      </SelectContent>
                    </Select>
                    {editForm.scene_type && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditForm((prev) => ({ ...prev, scene_type: undefined }))}
                        className="h-10 px-2"
                        title="Clear status"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveScene}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="border-muted/30">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Media Upload Dialog */}
        {showMediaUpload && (
          <Dialog open={showMediaUpload} onOpenChange={setShowMediaUpload}>
            <DialogContent className="bg-background border-primary/20 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-primary">Upload Media</DialogTitle>
              </DialogHeader>
              <div className="p-4 text-center text-muted-foreground">
                Media upload component will be integrated here
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Version Comparison Modal */}
        <Dialog open={showVersionCompare} onOpenChange={setShowVersionCompare}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-green-400">Version Comparison</DialogTitle>
              <DialogDescription>
                Compare different versions of your content side by side
              </DialogDescription>
            </DialogHeader>
            
            {compareVersions.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {compareVersions.map((version, index) => (
                    <Card key={version.id} className="bg-card border-2 border-green-500/30">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                              {getCleanVersionName(version)}
                            </Badge>
                            {version.metadata?.version_label && (
                              <Badge variant="outline" className="px-2 py-1 border-blue-500 text-blue-400 bg-blue-500/10">
                                {version.metadata.version_label}
                              </Badge>
                            )}
                            {version.is_latest_version && (
                              <Badge className="bg-green-500 text-white px-2 py-1 text-xs">
                                LATEST
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(version.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-lg font-semibold text-green-400">{generateCleanName(version.title, 'title')}</h4>
                      </CardHeader>
                      
                      <CardContent>
                        {version.content_type === 'script' && (
                          <>
                            <div className="bg-muted/50 p-4 rounded-lg border border-border max-h-96 overflow-y-auto mb-4">
                              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                                {version.content}
                              </pre>
                            </div>
                            
                            {/* Text to Speech Component for Scripts in Comparison */}
                            <div data-tts-component>
                              <TextToSpeech 
                                text={version.content || ''}
                                title={generateCleanName(version.title, 'title') || 'Script'}
                                className="mt-4"
                                projectId={projectId}
                                sceneId={id}
                              />
                            </div>
                          </>
                        )}
                        {version.content_type === 'image' && version.content_url && (
                          <div className="flex justify-center">
                            <img
                              src={version.content_url}
                              alt={generateCleanName(version.title, 'title')}
                              className="max-w-full h-64 object-cover rounded-lg border border-border"
                            />
                          </div>
                        )}
                        
                        <div className="mt-4 space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Prompt:</span>
                            <p className="text-foreground font-medium">{version.prompt}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Model:</span>
                            <p className="text-foreground font-medium">{version.model}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button
                onClick={() => setShowVersionCompare(false)}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
              >
                Close Comparison
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Version Editing Modal */}
        <Dialog open={showVersionEdit} onOpenChange={setShowVersionEdit}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-green-400">Edit Version</DialogTitle>
              <DialogDescription>
                Edit the title, version name, and content of this version
              </DialogDescription>
            </DialogHeader>
            
            {editingVersion && (
              <div className="space-y-6">
                {/* Version Info Header */}
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                      {getCleanVersionName(editingVersion)}
                    </Badge>
                    <Badge className="bg-green-500 text-white px-2 py-1 text-sm">
                      {editingVersion.content_type.toUpperCase()}
                    </Badge>
                    {editingVersion.is_latest_version && (
                      <Badge className="bg-blue-500 text-white px-2 py-1 text-sm">
                        LATEST VERSION
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(editingVersion.created_at).toLocaleDateString()} | 
                    Last Updated: {new Date(editingVersion.updated_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Edit Form */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-title" className="text-sm font-medium">
                      Title
                    </Label>
                    <Input
                      id="edit-title"
                      value={versionEditForm.title}
                      onChange={(e) => setVersionEditForm(prev => ({
                        ...prev,
                        title: e.target.value
                      }))}
                      placeholder="Enter version title"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-version-name" className="text-sm font-medium">
                      Version Name/Label
                    </Label>
                    <Input
                      id="edit-version-name"
                      value={versionEditForm.version_name}
                      onChange={(e) => setVersionEditForm(prev => ({
                        ...prev,
                        version_name: e.target.value
                      }))}
                      placeholder="e.g., 'First Draft', 'Final Version', 'Director Notes'"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will be displayed prominently as the main version identifier
                    </p>
                  </div>

                  {editingVersion.content_type === 'script' && (
                    <>
                      <div>
                        <Label htmlFor="edit-content" className="text-sm font-medium">
                          Script Content
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          💡 <strong>Pro tip:</strong> Select text to see copy, clear, and paste actions
                        </p>
                        <textarea
                          id="edit-content"
                          value={versionEditForm.content}
                          onChange={(e) => setVersionEditForm(prev => ({
                            ...prev,
                            content: e.target.value
                          }))}
                          placeholder="Edit your script content here..."
                          className="mt-1 w-full h-64 p-3 border border-border rounded-md bg-background text-foreground resize-none font-mono text-sm"
                          onSelect={(e) => {
                            e.stopPropagation()
                            const target = e.target as HTMLTextAreaElement
                            const selection = target.value.substring(target.selectionStart, target.selectionEnd)
                            if (selection.length > 0) {
                              // Store selection for context menu actions
                              setVersionEditForm(prev => ({ ...prev, selection }))
                            }
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                        />
                        
                        {/* Text Selection Actions for Version Edit Modal */}
                        {versionEditForm.selection && (
                          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border mt-2">
                            <span className="text-xs text-muted-foreground">
                              Selected: {versionEditForm.selection.length} characters
                            </span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(versionEditForm.selection || '')
                                  toast({
                                    title: "Copied!",
                                    description: "Selected text copied to clipboard",
                                  })
                                }}
                                className="h-6 px-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const target = document.getElementById('edit-content') as HTMLTextAreaElement
                                  if (target) {
                                    const start = target.selectionStart
                                    const end = target.selectionEnd
                                    const newValue = target.value.substring(0, start) + target.value.substring(end)
                                    setVersionEditForm(prev => ({ 
                                      ...prev, 
                                      content: newValue,
                                      selection: undefined 
                                    }))
                                    toast({
                                      title: "Cleared!",
                                      description: "Selected text has been removed",
                                    })
                                  }
                                }}
                                className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    const clipboardText = await navigator.clipboard.readText()
                                    if (clipboardText) {
                                      const target = document.getElementById('edit-content') as HTMLTextAreaElement
                                      if (target) {
                                        const start = target.selectionStart
                                        const end = target.selectionEnd
                                        const newValue = target.value.substring(0, start) + clipboardText + target.value.substring(end)
                                        setVersionEditForm(prev => ({ 
                                          ...prev, 
                                          content: newValue 
                                        }))
                                        toast({
                                          title: "Pasted!",
                                          description: "Clipboard content pasted",
                                        })
                                      }
                                    }
                                  } catch (error) {
                                    toast({
                                      title: "Paste Failed",
                                      description: "Could not access clipboard. Try using Ctrl+V instead.",
                                      variant: "destructive",
                                    })
                                  }
                                }}
                                className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Paste
                              </Button>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Make changes to your script content. This will create a new version.
                        </p>
                      </div>
                      
                      {/* Text to Speech Component for Script Editing */}
                      <div data-tts-component>
                        <TextToSpeech 
                          text={versionEditForm.content || ''}
                                                          title={generateCleanName(editingVersion.title, 'title') || 'Script'}
                          className="mt-4"
                          projectId={projectId}
                          sceneId={id}
                        />
                      </div>
                    </>
                  )}

                  {editingVersion.content_type === 'image' && (
                    <div className="text-center p-8 bg-muted/20 rounded-lg border border-border">
                      <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Image content cannot be edited directly. 
                        Generate a new version with different prompts instead.
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => setShowVersionEdit(false)}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    onClick={async () => {
                      try {
                        if (!editingVersion) return
                        
                        // Create a new version with the edited content
                        const newAssetData = {
                          project_id: editingVersion.project_id,
                          scene_id: editingVersion.scene_id,
                          title: versionEditForm.title,
                          content_type: editingVersion.content_type,
                          content: versionEditForm.content,
                          content_url: editingVersion.content_url,
                          prompt: editingVersion.prompt,
                          model: editingVersion.model,
                          version_name: versionEditForm.version_name,
                          generation_settings: editingVersion.generation_settings,
                          metadata: {
                            ...editingVersion.metadata,
                            edited_from_version: editingVersion.version,
                            edited_at: new Date().toISOString(),
                            original_title: editingVersion.title,
                            original_version_name: editingVersion.version_name
                          }
                        }
                        
                        // Save as new version
                        const newAsset = await AssetService.createAsset(newAssetData)
                        
                        toast({
                          title: "Version Updated!",
                          description: `New version "${versionEditForm.version_name}" has been created.`,
                        })
                        
                        // Refresh assets and close modal
                        refreshAssets()
                        setShowVersionEdit(false)
                        setEditingVersion(null)
                        
                      } catch (error) {
                        console.error('🎬 TIMELINE-SCENE - Error updating version:', error)
                        toast({
                          title: "Update Failed",
                          description: "Failed to create new version. Please try again.",
                          variant: "destructive",
                        })
                      }
                    }}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                    disabled={!versionEditForm.title.trim() || !versionEditForm.version_name.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as New Version
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
            sceneContext={scene?.description}
            onTextReplace={handleAITextReplace}
            contentType="script"
          />
        )}

        {/* AI Image Generation Dialog */}
        <Dialog open={showAIImageDialog} onOpenChange={setShowAIImageDialog}>
          <DialogContent className="bg-background border-green-500/20 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-green-400 flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Generate AI Image from Script
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Select a script and generate an AI image for this scene. The image will be saved as an asset.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Script Selection */}
              <div>
                <Label htmlFor="script-select" className="text-sm font-medium">
                  Select Script to Use
                </Label>
                <Select 
                  value={selectedScriptForAI} 
                  onValueChange={setSelectedScriptForAI}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a script..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assets
                      .filter(a => a.content_type === 'script')
                      .map((script) => (
                        <SelectItem key={script.id} value={script.id}>
                          {script.title} - {script.version_name || `v${script.version}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedScriptForAI && (
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-2">Script Preview:</p>
                    <p className="text-sm text-foreground">
                      {assets.find(a => a.id === selectedScriptForAI)?.content?.substring(0, 200)}...
                    </p>
                  </div>
                )}
              </div>

              {/* AI Service Selection */}
              <div>
                <Label className="text-sm font-medium">AI Service</Label>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    onClick={async () => {
                      if (!selectedScriptForAI) {
                        toast({
                          title: "No Script Selected",
                          description: "Please select a script first.",
                          variant: "destructive",
                        })
                        return
                      }
                      
                      try {
                        setAiImageLoading(true)
                        const selectedScript = assets.find(a => a.id === selectedScriptForAI)
                        if (!selectedScript) return
                        
                        // Create sanitized prompt
                        const sanitizedPrompt = sanitizePromptForDALLE(selectedScript.content || '')
                        const finalPrompt = `Create a cinematic movie scene image: ${sanitizedPrompt}`
                        
                        // Get AI settings for images
                        const aiSettings = await AISettingsService.getUserSettings(userId!)
                        const imagesSetting = aiSettings.find(s => s.tab_type === 'images')
                        
                        if (!imagesSetting?.locked_model) {
                          toast({
                            title: "No AI Model Selected",
                            description: "Please set a locked AI model for images in your AI settings.",
                            variant: "destructive",
                          })
                          return
                        }
                        
                        // For now, use a placeholder API key since these aren't stored in user object
                        const apiKey = 'configured'
                        const service = imagesSetting.locked_model
                        
                        // Generate image
                        const response = await fetch('/api/ai/generate-scene-image', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            prompt: finalPrompt,
                            service: service,
                            apiKey: apiKey,
                            userId: user?.id, // Add userId for bucket storage
                            autoSaveToBucket: true, // Enable automatic bucket storage
                          })
                        })
                        
                        if (!response.ok) {
                          throw new Error(`API error: ${response.status}`)
                        }
                        
                        const result = await response.json()
                        
                        if (result.success) {
                          // Save generated image as asset
                          const newAssetData = {
                            project_id: assets.find(a => a.id === selectedScriptForAI)?.project_id || '',
                            scene_id: scene?.id || '',
                            title: `AI Generated Image - ${selectedScript.title}`,
                            content_type: 'image' as const,
                            content: finalPrompt,
                            content_url: result.imageUrl,
                            prompt: finalPrompt,
                            model: service,
                            version_name: `AI Generated from ${selectedScript.title}`,
                            metadata: {
                              generatedFromScript: selectedScript.id,
                              aiService: service,
                              generatedAt: new Date().toISOString()
                            }
                          }
                          
                          await AssetService.createAsset(newAssetData)
                          
                          // Update scene thumbnail - check if this property exists in the service
                          if (scene) {
                            try {
                              await TimelineService.updateScene(scene.id, {
                                thumbnail_url: result.imageUrl
                              } as any)
                            } catch (error) {
                              console.log('Scene thumbnail update not supported, continuing...')
                            }
                          }
                          
                          toast({
                            title: "Image Generated!",
                            description: `AI image has been created and saved to your scene.`,
                          })
                          
                          // Refresh assets and close dialog
                          refreshAssets()
                          setShowAIImageDialog(false)
                          setSelectedScriptForAI('')
                          
                        } else {
                          throw new Error(result.error || 'Failed to generate image')
                        }
                        
                      } catch (error) {
                        console.error('AI image generation failed:', error)
                        toast({
                          title: "Generation Failed",
                          description: error instanceof Error ? error.message : "Failed to generate image",
                          variant: "destructive",
                        })
                      } finally {
                        setAiImageLoading(false)
                      }
                    }}
                    disabled={aiImageLoading || !selectedScriptForAI}
                  >
                    {aiImageLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bot className="h-4 w-4 mr-2" />
                    )}
                    Generate Image
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAIImageDialog(false)
                  setSelectedScriptForAI('')
                }}
                className="border-border"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Collaboration Dialog */}
      <Dialog open={showCreateCollaborationDialog} onOpenChange={setShowCreateCollaborationDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Start New Collaboration Session</DialogTitle>
            <DialogDescription>
              Create an access code for others to view and edit this project.
            </DialogDescription>
          </DialogHeader>
          {!createdCollaborationCode ? (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="collab-title" className="text-right">
                  Title
                </Label>
                <Input
                  id="collab-title"
                  value={newCollaborationTitle}
                  onChange={(e) => setNewCollaborationTitle(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., Scene Review"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="collab-description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="collab-description"
                  value={newCollaborationDescription}
                  onChange={(e) => setNewCollaborationDescription(e.target.value)}
                  className="col-span-3 min-h-[80px]"
                  placeholder="Brief description of this session"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="collab-expires" className="text-right">
                  Expires At
                </Label>
                <Input
                  id="collab-expires"
                  type="datetime-local"
                  value={newCollaborationExpiresAt}
                  onChange={(e) => setNewCollaborationExpiresAt(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Permissions</Label>
                <div className="col-span-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allow-guests"
                      checked={newCollaborationAllowGuests}
                      onChange={(e) => setNewCollaborationAllowGuests(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="allow-guests" className="font-normal">
                      Allow Guest Access (no login required)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allow-edit"
                      checked={newCollaborationAllowEdit}
                      onChange={(e) => setNewCollaborationAllowEdit(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="allow-edit" className="font-normal">
                      Allow Text Editing
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allow-add-scenes"
                      checked={newCollaborationAllowAddScenes}
                      onChange={(e) => setNewCollaborationAllowAddScenes(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="allow-add-scenes" className="font-normal">
                      Allow Adding New Scenes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allow-edit-scenes"
                      checked={newCollaborationAllowEditScenes}
                      onChange={(e) => setNewCollaborationAllowEditScenes(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="allow-edit-scenes" className="font-normal">
                      Allow Editing Scene Titles/Info
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allow-delete"
                      checked={newCollaborationAllowDelete}
                      onChange={(e) => setNewCollaborationAllowDelete(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="allow-delete" className="font-normal">
                      Allow Deleting Scenes
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <p className="text-sm text-muted-foreground">
                Your collaboration session has been created! Share this access code or the direct link with your collaborators.
              </p>
              <div className="flex items-center space-x-2">
                <Input readOnly value={createdCollaborationCode} className="flex-1 font-mono text-sm" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(createdCollaborationCode || '')
                    toast({ title: "Copied!", description: "Access code copied to clipboard." })
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy Code
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/collaborate/${createdCollaborationCode}`} className="flex-1 font-mono text-sm" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/collaborate/${createdCollaborationCode}`
                    navigator.clipboard.writeText(url)
                    toast({ title: "Copied!", description: "Collaboration link copied to clipboard." })
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy Link
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            {!createdCollaborationCode ? (
              <Button onClick={handleCreateCollaborationSession} disabled={creatingCollaboration || !projectId}>
                {creatingCollaboration ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                  </>
                ) : (
                  'Create Session'
                )}
              </Button>
            ) : (
              <Button onClick={() => {
                setShowCreateCollaborationDialog(false)
                setCreatedCollaborationCode(null)
                setNewCollaborationTitle("")
                setNewCollaborationDescription("")
                setNewCollaborationExpiresAt("")
              }}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </div>
      </div>
    </div>
    

  )
}
