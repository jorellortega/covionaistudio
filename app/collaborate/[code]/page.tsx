"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Edit3,
  Save,
  Trash2,
  Plus,
  Loader2,
  Bot,
  Users,
  Clock,
  Copy,
  CheckCircle,
  AlertCircle,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  FileText as FileTextIcon,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CollaborationService, type CollaborationSession } from "@/lib/collaboration-service"
import { type SceneWithMetadata } from "@/lib/timeline-service"
import { getSupabaseClient } from "@/lib/supabase"
import AITextEditor from "@/components/ai-text-editor"
import { Switch } from "@/components/ui/switch"
import { CharactersService, type Character } from "@/lib/characters-service"
import { createClient } from "@supabase/supabase-js"
import { Database } from "@/lib/supabase"
import { useAuthReady } from "@/components/auth-hooks"
import { Wand2 } from "lucide-react"

export default function CollaboratePage() {
  const params = useParams()
  const code = params.code as string

  return <CollaboratePageClient code={code} />
}

function CollaboratePageClient({ code }: { code: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<CollaborationSession | null>(null)
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [selectedScene, setSelectedScene] = useState<SceneWithMetadata | null>(null)
  const [sceneContent, setSceneContent] = useState<string>("")
  const [characters, setCharacters] = useState<Character[]>([])
  const [loadingCharacters, setLoadingCharacters] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [showCharacterDialog, setShowCharacterDialog] = useState(false)
  const [characterForm, setCharacterForm] = useState({
    name: "",
    description: "",
    archetype: "",
  })
  const [projectThumbnail, setProjectThumbnail] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true) // Show by default, will adjust for mobile
  const [enablePolling, setEnablePolling] = useState(() => {
    // Load from localStorage, default to true for live collaboration
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('collab-polling-enabled')
      return saved !== null ? saved === 'true' : true // Default to true
    }
    return true // Default to true for live collaboration
  })
  const [pollingAutoEnabled, setPollingAutoEnabled] = useState(false) // Track if polling was auto-enabled
  const [lastSavedContent, setLastSavedContent] = useState<string>("") // Track last saved content
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false) // Track if there are unsaved changes
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Ref for auto-save timeout
  const lastRemoteContentRef = useRef<string>("") // Track last remote content to avoid unnecessary updates
  
  // AI editing states
  const [showAITextEditor, setShowAITextEditor] = useState(false)
  const [aiEditData, setAiEditData] = useState<{
    selectedText: string
    fullContent: string
  } | null>(null)
  const [selectedText, setSelectedText] = useState<string>("")
  const [selectionStart, setSelectionStart] = useState<number>(0)
  const [selectionEnd, setSelectionEnd] = useState<number>(0)
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null)
  
  // Text enhancer states
  const [textEnhancerSettings, setTextEnhancerSettings] = useState<{
    model: string
    prefix: string
  }>({ model: 'gpt-4o-mini', prefix: '' })
  const [isEnhancingText, setIsEnhancingText] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const { user, userId, ready } = useAuthReady()
  
  // Scene editing states
  const [showSceneDialog, setShowSceneDialog] = useState(false)
  const [editingScene, setEditingScene] = useState<SceneWithMetadata | null>(null)
  const [sceneForm, setSceneForm] = useState({
    name: "",
    description: "",
    sceneNumber: "",
    location: "",
  })
  
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch user API keys
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

  // Enhance selected text
  const enhanceSelectedText = async () => {
    if (!selectedText.trim()) {
      toast({
        title: "Error",
        description: "Please select some text to enhance",
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
      const fullPrompt = `${prefix}\n\n${selectedText}`

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
          const errorText = await anthropicResponse.text()
          throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`)
        }

        const result = await anthropicResponse.json()
        response = result.content?.[0]?.text || ''
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
            max_tokens: 4000,
            temperature: 0.7,
          }),
        })

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
        }

        const result = await openaiResponse.json()
        response = result.choices?.[0]?.message?.content || ''
      }

      if (response) {
        // Replace selected text with enhanced version
        const newContent =
          sceneContent.substring(0, selectionStart) + response.trim() + sceneContent.substring(selectionEnd)
        
        setSceneContent(newContent)
        setSelectedText("")
        setToolbarPosition(null)
        setSelectionStart(0)
        setSelectionEnd(0)
        setHasUnsavedChanges(true)
        
        // Auto-save after enhancement
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current)
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
          saveSceneContent(true) // Silent save
        }, 500)
        
        // Focus back on textarea and set cursor position after the enhanced text
        setTimeout(() => {
          if (contentTextareaRef.current) {
            contentTextareaRef.current.focus()
            const newPosition = selectionStart + response.trim().length
            contentTextareaRef.current.setSelectionRange(newPosition, newPosition)
          }
        }, 0)
        
        toast({
          title: "Text Enhanced",
          description: "Selected text has been enhanced",
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

  // Fetch API keys and settings when ready
  useEffect(() => {
    if (ready && userId) {
      fetchUserApiKeys()
      fetchTextEnhancerSettings()
    }
  }, [ready, userId])

  // Load session and validate access
  useEffect(() => {
    const loadSession = async () => {
      try {
        console.log('🔐 [COLLAB] Loading session for code:', code)
        setLoading(true)
        const validation = await CollaborationService.validateAccessCode(code)
        
        console.log('🔐 [COLLAB] Validation result:', validation)
        
        if (!validation.valid || !validation.session) {
          console.error('❌ [COLLAB] Invalid access code:', validation.reason)
          toast({
            title: "Invalid Access Code",
            description: validation.reason || "This access code is invalid or has expired.",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        console.log('✅ [COLLAB] Session loaded:', validation.session.id, 'Project:', validation.session.project_id)
        setSession(validation.session)
      } catch (error: any) {
        console.error("❌ [COLLAB] Error loading session:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to load collaboration session",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [code, router, toast])

  // Load project thumbnail
  const loadProjectThumbnail = async () => {
    if (!session) return
    
    try {
      const response = await fetch(
        `/api/collaboration/project?access_code=${encodeURIComponent(session.access_code)}`
      )
      const result = await response.json()
      
      if (response.ok && result.project?.thumbnail) {
        setProjectThumbnail(result.project.thumbnail)
      }
    } catch (error) {
      console.error('Error loading project thumbnail:', error)
    }
  }

  // Load scenes when session is available
  useEffect(() => {
    if (session) {
      console.log('📋 [COLLAB] Session available, loading scenes for project:', session.project_id)
      loadScenes()
      loadCharacters()
      loadProjectThumbnail()
    } else {
      console.log('⏳ [COLLAB] Waiting for session...')
    }
  }, [session])

  // Load characters
  const loadCharacters = async () => {
    if (!session) {
      console.log('⚠️ [COLLAB] Cannot load characters: no session')
      return
    }
    
    try {
      setLoadingCharacters(true)
      console.log('👥 [COLLAB] Loading characters for project:', session.project_id)
      
      // Use API route for guest access
      const response = await fetch(
        `/api/collaboration/characters?access_code=${encodeURIComponent(session.access_code)}`
      )
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to load characters")
      }
      
      const chars = result.characters || []
      setCharacters(chars)
      console.log('✅ [COLLAB] Loaded characters:', chars.length)
    } catch (error: any) {
      console.error("❌ [COLLAB] Error loading characters:", error)
      // Silently fail - characters are optional
      setCharacters([])
    } finally {
      setLoadingCharacters(false)
    }
  }

  // Load scene content when scene is selected
  useEffect(() => {
    if (selectedSceneId && session) {
      console.log('📄 [COLLAB] Scene selected, loading content:', selectedSceneId)
      loadSceneContent(selectedSceneId)
    } else {
      if (!selectedSceneId) console.log('⏳ [COLLAB] No scene selected yet')
      if (!session) console.log('⏳ [COLLAB] No session available for loading content')
    }
  }, [selectedSceneId, session])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && contentTextareaRef.current) {
      // Small delay to ensure the textarea is rendered
      setTimeout(() => {
        contentTextareaRef.current?.focus()
      }, 100)
    }
  }, [isEditing])

  // Keep polling enabled when entering edit mode
  useEffect(() => {
    if (isEditing && !enablePolling) {
      setEnablePolling(true)
      setPollingAutoEnabled(true)
    }
  }, [isEditing, enablePolling])
  
  // Cleanup auto-save timeout on unmount or when leaving edit mode
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])
  
  // Save pending changes when exiting edit mode
  useEffect(() => {
    if (!isEditing && hasUnsavedChanges) {
      // Clear auto-save timeout and save immediately
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
        autoSaveTimeoutRef.current = null
      }
      saveSceneContent(true) // Silent save
    }
  }, [isEditing, hasUnsavedChanges])

  // Load scenes
  const loadScenes = async () => {
    if (!session) {
      console.log('⚠️ [COLLAB] Cannot load scenes: no session')
      return
    }
    
    try {
      console.log('📋 [COLLAB] Fetching scenes with access code:', session.access_code)
      const response = await fetch(
        `/api/collaboration/scenes?access_code=${encodeURIComponent(session.access_code)}`
      )
      const result = await response.json()
      
      console.log('📋 [COLLAB] Scenes API response:', { ok: response.ok, scenesCount: result.scenes?.length || 0 })
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to load scenes")
      }

      const scenesData = result.scenes || []
      console.log('✅ [COLLAB] Loaded', scenesData.length, 'scenes:', scenesData.map((s: any) => ({ id: s.id, name: s.name })))
      setScenes(scenesData as SceneWithMetadata[])
      
      // Select first scene if available
      if (scenesData.length > 0 && !selectedSceneId) {
        const firstScene = scenesData[0]
        console.log('🎬 [COLLAB] Auto-selecting first scene:', firstScene.id, firstScene.name)
        setSelectedSceneId(firstScene.id)
        setSelectedScene(firstScene as SceneWithMetadata)
        await loadSceneContent(firstScene.id)
      } else if (scenesData.length === 0) {
        console.log('⚠️ [COLLAB] No scenes found for this project')
      }
    } catch (error: any) {
      console.error("❌ [COLLAB] Error loading scenes:", error)
      toast({
        title: "Error",
        description: "Failed to load scenes",
        variant: "destructive",
      })
    }
  }

  // Load scene content with smart conflict resolution
  const loadSceneContent = async (sceneId: string, skipUpdateIfEditing = false) => {
    if (!session) {
      console.log('⚠️ [COLLAB] Cannot load scene content: no session')
      return
    }
    
    try {
      console.log('📄 [COLLAB] Fetching scene content for:', sceneId)
      console.log('📄 [COLLAB] Using access code:', session.access_code)
      
      const url = `/api/collaboration/scenes/${sceneId}?access_code=${encodeURIComponent(session.access_code)}`
      console.log('📄 [COLLAB] Fetch URL:', url)
      
      const response = await fetch(url)
      const result = await response.json()
      
      console.log('📄 [COLLAB] Scene content API response:', {
        ok: response.ok,
        status: response.status,
        hasScene: !!result.scene,
        contentLength: result.scene?.screenplay_content?.length || 0
      })
      
      if (!response.ok) {
        console.error('❌ [COLLAB] Scene content API error:', result.error)
        throw new Error(result.error || "Failed to load scene content")
      }

      const remoteContent = result.scene?.screenplay_content || ""
      
      // Skip update if we're currently editing and have unsaved changes
      // Only update if the remote content is different from what we last saw
      if (skipUpdateIfEditing && isEditing && hasUnsavedChanges) {
        // Check if remote content matches our last saved content
        // If remote is different, it means someone else made changes
        if (remoteContent !== lastSavedContent && remoteContent !== lastRemoteContentRef.current) {
          console.log('🔄 [COLLAB] Remote changes detected while editing - will merge after save')
          // Store the remote content to merge later
          lastRemoteContentRef.current = remoteContent
        }
        return // Don't overwrite local edits
      }
      
      // Only update if content actually changed
      if (remoteContent !== sceneContent && remoteContent !== lastRemoteContentRef.current) {
        console.log('✅ [COLLAB] Updating scene content from remote:', {
          sceneId,
          sceneName: result.scene?.name,
          contentLength: remoteContent.length,
          hasContent: remoteContent.length > 0,
          preview: remoteContent.substring(0, 100) + (remoteContent.length > 100 ? '...' : '')
        })
        setSceneContent(remoteContent)
        setLastSavedContent(remoteContent)
        lastRemoteContentRef.current = remoteContent
      } else if (!skipUpdateIfEditing && remoteContent === sceneContent) {
        // On initial load (not polling), ensure lastSavedContent is set even if content matches
        setLastSavedContent(remoteContent)
        lastRemoteContentRef.current = remoteContent
        console.log('✅ [COLLAB] Scene content loaded (unchanged)')
      } else {
        console.log('⏭️ [COLLAB] Scene content unchanged, skipping update')
      }
    } catch (error: any) {
      console.error("❌ [COLLAB] Error loading scene content:", error)
      // Don't clear content on error - keep existing content
    }
  }

  // Save polling preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('collab-polling-enabled', String(enablePolling))
    }
  }, [enablePolling])

  // Setup real-time polling (always active for live collaboration)
  useEffect(() => {
    if (!selectedSceneId || !session || !enablePolling) {
      console.log('⏸️ [COLLAB] Polling paused:', { 
        selectedSceneId: !!selectedSceneId, 
        session: !!session, 
        enablePolling 
      })
      return
    }

    console.log('🔄 [COLLAB] Starting live polling for scene:', selectedSceneId, 'isEditing:', isEditing)
    const pollInterval = setInterval(async () => {
      try {
        // Skip update if editing and has unsaved changes (smart conflict resolution)
        await loadSceneContent(selectedSceneId, true) // Pass true to skip update if editing
      } catch (error) {
        console.error('❌ [COLLAB] Polling error (silent):', error)
        // Silently fail polling
      }
    }, 1000) // Poll every 1 second for more real-time feel

    return () => {
      console.log('🛑 [COLLAB] Stopping live polling')
      clearInterval(pollInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneId, session?.access_code, enablePolling, isEditing, hasUnsavedChanges])

  // Note: Secondary slow polling removed since live polling is now enabled by default

  // Handle scene selection
  const handleSceneSelect = async (sceneId: string) => {
    console.log('🎬 [COLLAB] Scene selection changed to:', sceneId)
    const scene = scenes.find((s) => s.id === sceneId)
    console.log('🎬 [COLLAB] Found scene:', scene ? { id: scene.id, name: scene.name } : 'NOT FOUND')
    
    setSelectedSceneId(sceneId)
    setSelectedScene(scene || null)
    setIsEditing(false)
    await loadSceneContent(sceneId)
  }

  // Update toolbar position based on textarea position
  const updateToolbarPosition = (textarea: HTMLTextAreaElement) => {
    const rect = textarea.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft
    
    // Position toolbar above the textarea, aligned to the left
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

  // Handle AI text edit
  const handleAITextEdit = () => {
    if (!selectedText) return
    
    setAiEditData({
      selectedText,
      fullContent: sceneContent,
    })
    setShowAITextEditor(true)
  }

  // Export scene to Word document
  const exportToWord = async () => {
    if (!selectedScene || !sceneContent) {
      toast({
        title: "Error",
        description: "No scene content to export",
        variant: "destructive",
      })
      return
    }

    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: selectedScene.name,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: sceneContent,
            }),
          ],
        }],
      })

      const blob = await Packer.toBlob(doc)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedScene.name.replace(/[^a-z0-9]/gi, '_')}.docx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Exported!",
        description: "Scene exported as Word document",
      })
    } catch (error: any) {
      console.error("Error exporting to Word:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to export to Word",
        variant: "destructive",
      })
    }
  }

  // Export scene to PDF
  const exportToPDF = async () => {
    if (!selectedScene || !sceneContent) {
      toast({
        title: "Error",
        description: "No scene content to export",
        variant: "destructive",
      })
      return
    }

    try {
      const { jsPDF } = await import('jspdf')
      
      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const maxWidth = pageWidth - 2 * margin
      
      // Add title
      pdf.setFontSize(16)
      pdf.text(selectedScene.name, margin, margin)
      
      // Add content
      pdf.setFontSize(10)
      const lines = pdf.splitTextToSize(sceneContent, maxWidth)
      let y = margin + 10
      
      lines.forEach((line: string) => {
        if (y > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }
        pdf.text(line, margin, y)
        y += 7
      })

      pdf.save(`${selectedScene.name.replace(/[^a-z0-9]/gi, '_')}.pdf`)

      toast({
        title: "Exported!",
        description: "Scene exported as PDF",
      })
    } catch (error: any) {
      console.error("Error exporting to PDF:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to export to PDF",
        variant: "destructive",
      })
    }
  }

  // Handle AI text replace
  const handleAITextReplace = (newText: string) => {
    if (!contentTextareaRef.current) return

    const newContent =
      sceneContent.substring(0, selectionStart) + newText + sceneContent.substring(selectionEnd)
    
    setSceneContent(newContent)
    setSelectedText("")
    setToolbarPosition(null)
    setSelectionStart(0)
    setSelectionEnd(0)
    
    // Focus back on textarea
    setTimeout(() => {
      if (contentTextareaRef.current) {
        contentTextareaRef.current.focus()
        // Set cursor position after the inserted text
        const newPosition = selectionStart + newText.length
        contentTextareaRef.current.setSelectionRange(newPosition, newPosition)
      }
    }, 0)
  }

  // Save scene content (called by auto-save and manual save)
  const saveSceneContent = async (silent = false) => {
    if (!selectedSceneId || !session) {
      console.log('⚠️ [COLLAB] Cannot save: missing sceneId or session')
      return
    }

    // Don't save if content hasn't changed
    if (sceneContent === lastSavedContent && !silent) {
      console.log('⏭️ [COLLAB] Content unchanged, skipping save')
      return
    }

    try {
      console.log('💾 [COLLAB] Saving scene content:', {
        sceneId: selectedSceneId,
        contentLength: sceneContent.length,
        silent
      })
      
      if (!silent) {
        setSaving(true)
      }
      
      const response = await fetch(
        `/api/collaboration/scenes/${selectedSceneId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_code: session.access_code,
            screenplay_content: sceneContent,
          }),
        }
      )

      const result = await response.json()
      
      console.log('💾 [COLLAB] Save response:', { ok: response.ok, status: response.status })
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to save scene content")
      }

      console.log('✅ [COLLAB] Scene content saved successfully')
      setLastSavedContent(sceneContent)
      setHasUnsavedChanges(false)
      lastRemoteContentRef.current = sceneContent // Update remote content ref
      
      // Check if there were remote changes to merge
      if (lastRemoteContentRef.current !== sceneContent && lastRemoteContentRef.current !== lastSavedContent) {
        // Merge remote changes - for now, just reload after a brief delay
        setTimeout(() => {
          loadSceneContent(selectedSceneId, false)
        }, 500)
      }
      
      if (!silent) {
        setIsEditing(false)
        toast({
          title: "Saved!",
          description: "Scene content has been saved",
        })
      }
    } catch (error: any) {
      console.error("❌ [COLLAB] Error saving scene content:", error)
      if (!silent) {
        toast({
          title: "Error",
          description: error.message || "Failed to save scene content",
          variant: "destructive",
        })
      }
    } finally {
      if (!silent) {
        setSaving(false)
      }
    }
  }

  // Delete scene content
  const deleteSceneContent = async () => {
    if (!selectedSceneId || !session?.allow_delete) return

    try {
      setSaving(true)
      
      const response = await fetch(
        `/api/collaboration/scenes/${selectedSceneId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_code: session.access_code,
            screenplay_content: "",
          }),
        }
      )

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete scene content")
      }

      setSceneContent("")
      setIsEditing(false)
      toast({
        title: "Deleted!",
        description: "Scene content has been deleted",
      })
    } catch (error: any) {
      console.error("Error deleting scene content:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete scene content",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Add new scene
  const handleAddScene = () => {
    setEditingScene(null)
    setSceneForm({
      name: "",
      description: "",
      sceneNumber: "",
      location: "",
    })
    setShowSceneDialog(true)
  }

  // Edit scene
  const handleEditScene = (scene: SceneWithMetadata) => {
    if (!session?.allow_edit_scenes) return
    
    setEditingScene(scene)
    setSceneForm({
      name: scene.name,
      description: scene.description || "",
      sceneNumber: scene.metadata?.sceneNumber || "",
      location: scene.metadata?.location || "",
    })
    setShowSceneDialog(true)
  }

  // Save scene
  const saveScene = async () => {
    if (!session) return

    try {
      setSaving(true)
      
      if (editingScene) {
        // Update existing scene
        const response = await fetch(
          `/api/collaboration/scenes/${editingScene.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              access_code: session.access_code,
              name: sceneForm.name,
              description: sceneForm.description,
              metadata: {
                ...editingScene.metadata,
                sceneNumber: sceneForm.sceneNumber,
                location: sceneForm.location,
              },
            }),
          }
        )

        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || "Failed to update scene")
        }
      } else {
        // Create new scene
        const response = await fetch("/api/collaboration/scenes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_code: session.access_code,
            name: sceneForm.name,
            description: sceneForm.description,
            scene_number: sceneForm.sceneNumber,
            location: sceneForm.location,
          }),
        })

        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || "Failed to create scene")
        }
        
        // Reload scenes and select new scene
        await loadScenes()
        if (result.scene) {
          await handleSceneSelect(result.scene.id)
        }
      }

      setShowSceneDialog(false)
      await loadScenes()
      toast({
        title: "Scene Saved!",
        description: editingScene ? "Scene updated successfully" : "Scene created successfully",
      })
    } catch (error: any) {
      console.error("Error saving scene:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save scene",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete scene - Note: This requires authentication, so we'll disable it for guests
  // In a full implementation, you'd add a DELETE endpoint for collaboration
  const handleDeleteScene = async (sceneId: string) => {
    if (!session?.allow_delete) return

    toast({
      title: "Not Available",
      description: "Scene deletion requires authentication. Please contact the session owner.",
      variant: "default",
    })
  }

  // Get current scene index
  const currentSceneIndex = selectedSceneId
    ? scenes.findIndex((s) => s.id === selectedSceneId)
    : -1

  // Handle window resize - auto-hide sidebar on mobile, show on desktop
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        // On desktop (md and up), show sidebar by default
        // On mobile, hide it
        if (window.innerWidth >= 768) {
          setShowSidebar(true)
        } else {
          setShowSidebar(false)
        }
      }
    }
    
    // Set initial state based on screen size
    if (typeof window !== 'undefined') {
      handleResize()
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Debug: Log current state
  useEffect(() => {
    console.log('📊 [COLLAB] Current state:', {
      loading,
      hasSession: !!session,
      sessionId: session?.id,
      scenesCount: scenes.length,
      selectedSceneId,
      selectedSceneName: selectedScene?.name,
      sceneContentLength: sceneContent.length,
      isEditing,
      saving
    })
  }, [loading, session, scenes.length, selectedSceneId, selectedScene, sceneContent.length, isEditing, saving])

  if (loading) {
    console.log('⏳ [COLLAB] Rendering loading state')
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-lg">Loading collaboration session...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    console.log('❌ [COLLAB] Rendering invalid session state')
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Access Code</h1>
          <p className="text-muted-foreground mb-6">
            This access code is invalid or has expired.
          </p>
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    )
  }

  console.log('✅ [COLLAB] Rendering collaboration page')

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar - Mobile: Full screen overlay, Desktop: Sidebar */}
      {showSidebar && (
        <>
          {/* Mobile overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
          {/* Sidebar */}
          <div className="fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-80 border-r border-border bg-muted/20 p-4 overflow-y-auto md:block">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <Link href="/">
                <h2 className="text-lg font-semibold hover:text-primary transition-colors cursor-pointer">
                  Ai Cinema Studio
                </h2>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Project Cover Thumbnail */}
            {projectThumbnail && (
              <div className="mb-4 rounded-lg overflow-hidden border border-border">
                <img
                  src={projectThumbnail}
                  alt="Project cover"
                  className="w-full h-auto object-cover"
                  onError={(e) => {
                    // Hide image if it fails to load
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* Scenes List */}
            {scenes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Scenes ({scenes.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[400px] overflow-y-auto">
                    <div className="space-y-1 p-2">
                      {scenes.map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => handleSceneSelect(scene.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors border ${
                            selectedSceneId === scene.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 hover:bg-muted border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate font-medium">{scene.name}</span>
                            </div>
                            {scene.metadata?.sceneNumber && (
                              <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                                {scene.metadata.sceneNumber}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Characters List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Characters {loadingCharacters ? "(Loading...)" : `(${characters.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingCharacters ? (
                  <div className="p-4 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : characters.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    <div className="space-y-1 p-2">
                      {characters.map((character) => (
                        <button
                          key={character.id}
                          onClick={() => {
                            setSelectedCharacter(character)
                            setCharacterForm({
                              name: character.name || "",
                              description: character.description || "",
                              archetype: character.archetype || "",
                            })
                            setShowCharacterDialog(true)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors border ${
                            selectedCharacter?.id === character.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 hover:bg-muted border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate font-medium">{character.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No characters found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-border p-3 md:p-4 bg-background/95 backdrop-blur">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3 md:mb-4">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              {!showSidebar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSidebar(true)}
                  className="flex-shrink-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              <h1 className="text-lg md:text-2xl font-bold truncate">
                {session.title || "Collaborative Editing"}
              </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = window.location.href
                  navigator.clipboard.writeText(url)
                  toast({
                    title: "Copied!",
                    description: "Page URL copied to clipboard",
                  })
                }}
                title="Copy page URL"
                className="flex-shrink-0"
              >
                <Copy className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Copy Link</span>
              </Button>
              <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-md border border-border bg-muted/30 flex-shrink-0">
                <RefreshCw className={`h-4 w-4 ${enablePolling ? 'text-green-500' : 'text-muted-foreground'}`} />
                <Label htmlFor="polling-toggle" className="text-xs md:text-sm font-normal cursor-pointer hidden md:block">
                  Live Updates
                </Label>
                <Switch
                  id="polling-toggle"
                  checked={enablePolling}
                  onCheckedChange={(checked) => {
                    setEnablePolling(checked)
                    setPollingAutoEnabled(false)
                  }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/")}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Exit</span>
              </Button>
            </div>
          </div>

          {/* Scene Selector */}
          {scenes.length > 0 && (
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedSceneId) {
                      loadSceneContent(selectedSceneId)
                    }
                  }}
                  title="Refresh current scene"
                  className="flex-shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentSceneIndex > 0) {
                      handleSceneSelect(scenes[currentSceneIndex - 1].id)
                    }
                  }}
                  disabled={currentSceneIndex <= 0}
                  className="flex-shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden md:inline ml-1">Previous</span>
                </Button>
                
                <Select
                  value={selectedSceneId || ""}
                  onValueChange={handleSceneSelect}
                >
                  <SelectTrigger className="flex-1 min-w-0 md:w-[300px]">
                    <SelectValue>
                      {selectedScene ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{selectedScene.name}</span>
                          {selectedScene.metadata?.sceneNumber && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {selectedScene.metadata.sceneNumber}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        "Select Scene"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {scenes.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{scene.name}</span>
                            {scene.metadata?.sceneNumber && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {scene.metadata.sceneNumber}
                              </Badge>
                            )}
                          </div>
                          {scene.id === selectedSceneId && (
                            <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
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
                    if (currentSceneIndex >= 0 && currentSceneIndex < scenes.length - 1) {
                      handleSceneSelect(scenes[currentSceneIndex + 1].id)
                    }
                  }}
                  disabled={currentSceneIndex < 0 || currentSceneIndex >= scenes.length - 1}
                  className="flex-shrink-0"
                >
                  <span className="hidden md:inline mr-1">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 md:ml-auto">
                {session.allow_edit_scenes && selectedScene && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditScene(selectedScene)}
                    className="flex-1 md:flex-initial"
                  >
                    <Edit3 className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Edit Scene</span>
                  </Button>
                )}
                {session.allow_add_scenes && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddScene}
                    className="flex-1 md:flex-initial"
                  >
                    <Plus className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Add Scene</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Script Content Card */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          {selectedScene ? (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{selectedScene.name}</span>
                    {selectedScene.metadata?.sceneNumber && (
                      <Badge variant="outline" className="flex-shrink-0">
                        Scene {selectedScene.metadata.sceneNumber}
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {session.allow_edit && !isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true)
                          // Automatically enable live updates when editing
                          if (!enablePolling) {
                            setEnablePolling(true)
                            setPollingAutoEnabled(true) // Mark as auto-enabled
                          }
                        }}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        {sceneContent ? "Edit Content" : "Add Content"}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!sceneContent.trim()}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={exportToWord}>
                          <FileTextIcon className="h-4 w-4 mr-2" />
                          Export as Word (.docx)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDF}>
                          <FileTextIcon className="h-4 w-4 mr-2" />
                          Export as PDF (.pdf)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {session.allow_delete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deleteSceneContent}
                        disabled={saving || !sceneContent.trim()}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4 relative">
                    <Textarea
                      ref={contentTextareaRef}
                      data-screenplay-editor
                      value={sceneContent}
                      onChange={(e) => {
                        const newContent = e.target.value
                        setSceneContent(newContent)
                        setHasUnsavedChanges(true)
                        
                        // Clear existing timeout
                        if (autoSaveTimeoutRef.current) {
                          clearTimeout(autoSaveTimeoutRef.current)
                        }
                        
                        // Auto-save after 1.5 seconds of inactivity
                        autoSaveTimeoutRef.current = setTimeout(() => {
                          console.log('💾 [COLLAB] Auto-saving after typing pause...')
                          saveSceneContent(true) // Silent save
                        }, 1500)
                      }}
                      onSelect={handleTextSelection}
                      className="min-h-[400px] md:min-h-[600px] font-mono text-sm leading-relaxed resize-none w-full"
                      placeholder="Enter your screenplay content here..."
                    />
                    
                    {/* Floating Selection Toolbar */}
                    {selectedText && toolbarPosition && (
                      <div
                        data-selection-toolbar
                        className="fixed z-50 flex items-center gap-1 md:gap-2 p-2 bg-background border border-border rounded-lg shadow-lg max-w-[calc(100vw-2rem)]"
                        style={{
                          top: `${toolbarPosition.top}px`,
                          left: typeof window !== 'undefined' 
                            ? `${Math.min(toolbarPosition.left, window.innerWidth - 200)}px`
                            : `${toolbarPosition.left}px`,
                        }}
                      >
                        <Badge variant="outline" className="text-xs">
                          {selectedText.length} chars
                        </Badge>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={enhanceSelectedText}
                          disabled={isEnhancingText}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          {isEnhancingText ? (
                            <>
                              <Loader2 className="h-3 w-3 md:mr-1 animate-spin" />
                              <span className="hidden md:inline">Enhancing...</span>
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3 w-3 md:mr-1" />
                              <span className="hidden md:inline">Enhance</span>
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={handleAITextEdit}
                          className="bg-purple-500 hover:bg-purple-600 text-white"
                        >
                          <Bot className="h-3 w-3 md:mr-1" />
                          <span className="hidden md:inline">AI Edit</span>
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
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {hasUnsavedChanges ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Autosaving...
                          </p>
                        ) : (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            All changes saved
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground hidden md:block">
                          💡 Tip: Select text to see the AI edit and enhance buttons in the floating toolbar.
                        </p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false)
                            loadSceneContent(selectedScene.id)
                          }}
                          disabled={saving}
                          className="flex-1 md:flex-initial"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sceneContent ? (
                      <div className="bg-muted/20 p-3 md:p-6 rounded-lg border overflow-x-auto">
                        <pre className="font-mono text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {sceneContent}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">No Content</h3>
                        <p className="text-muted-foreground mb-4">
                          This scene doesn't have any content yet.
                        </p>
                      </div>
                    )}
                    
                    {session.allow_edit && (
                      <Button
                        onClick={() => {
                          setIsEditing(true)
                          // Automatically enable live updates when editing
                          if (!enablePolling) {
                            setEnablePolling(true)
                            setPollingAutoEnabled(true) // Mark as auto-enabled
                          }
                        }}
                        className="w-full"
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        {sceneContent ? "Edit Content" : "Add Content"}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Scene Selected</h3>
              <p className="text-muted-foreground mb-4">
                {scenes.length === 0
                  ? "No scenes available. Add a scene to get started."
                  : "Select a scene from the dropdown above."}
              </p>
              {session.allow_add_scenes && scenes.length === 0 && (
                <Button onClick={handleAddScene}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Scene
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

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

      {/* Character Dialog */}
      <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] md:max-h-[80vh] overflow-y-auto w-[95vw] md:w-full">
          <DialogHeader>
            <DialogTitle>Character Details</DialogTitle>
            <DialogDescription>
              View and edit character information
            </DialogDescription>
          </DialogHeader>
          {selectedCharacter && (
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={characterForm.name}
                  onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
                  placeholder="Character name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={characterForm.description}
                  onChange={(e) => setCharacterForm({ ...characterForm, description: e.target.value })}
                  placeholder="Character description"
                  rows={4}
                />
              </div>
              <div>
                <Label>Archetype</Label>
                <Input
                  value={characterForm.archetype}
                  onChange={(e) => setCharacterForm({ ...characterForm, archetype: e.target.value })}
                  placeholder="Character archetype"
                />
              </div>
              
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!selectedCharacter || !session) return
                    if (!confirm("Are you sure you want to delete this character?")) return
                    
                    try {
                      const response = await fetch(
                        `/api/collaboration/characters/${selectedCharacter.id}`,
                        {
                          method: "DELETE",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            access_code: session.access_code,
                          }),
                        }
                      )
                      
                      const result = await response.json()
                      if (!response.ok) {
                        throw new Error(result.error || "Failed to delete character")
                      }
                      
                      toast({
                        title: "Deleted!",
                        description: "Character has been deleted",
                      })
                      
                      setShowCharacterDialog(false)
                      setSelectedCharacter(null)
                      loadCharacters()
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to delete character",
                        variant: "destructive",
                      })
                    }
                  }}
                  disabled={!session?.allow_edit}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCharacterDialog(false)
                      setSelectedCharacter(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!selectedCharacter || !session) return
                      
                      try {
                        setSaving(true)
                        const response = await fetch(
                          `/api/collaboration/characters/${selectedCharacter.id}`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              access_code: session.access_code,
                              name: characterForm.name,
                              description: characterForm.description,
                              archetype: characterForm.archetype,
                            }),
                          }
                        )
                        
                        const result = await response.json()
                        if (!response.ok) {
                          throw new Error(result.error || "Failed to save character")
                        }
                        
                        toast({
                          title: "Saved!",
                          description: "Character has been updated",
                        })
                        
                        setShowCharacterDialog(false)
                        setSelectedCharacter(null)
                        loadCharacters()
                      } catch (error: any) {
                        toast({
                          title: "Error",
                          description: error.message || "Failed to save character",
                          variant: "destructive",
                        })
                      } finally {
                        setSaving(false)
                      }
                    }}
                    disabled={saving || !session?.allow_edit || !characterForm.name.trim()}
                  >
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
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Scene Dialog */}
      <Dialog open={showSceneDialog} onOpenChange={setShowSceneDialog}>
        <DialogContent className="w-[95vw] md:w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingScene ? "Edit Scene" : "Add New Scene"}
            </DialogTitle>
            <DialogDescription>
              {editingScene
                ? "Update scene information"
                : "Create a new scene for collaboration"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Scene Name *</Label>
              <Input
                value={sceneForm.name}
                onChange={(e) =>
                  setSceneForm({ ...sceneForm, name: e.target.value })
                }
                placeholder="Enter scene name"
              />
            </div>
            <div>
              <Label>Scene Number</Label>
              <Input
                value={sceneForm.sceneNumber}
                onChange={(e) =>
                  setSceneForm({ ...sceneForm, sceneNumber: e.target.value })
                }
                placeholder="e.g., 1, 2A, 3B"
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={sceneForm.location}
                onChange={(e) =>
                  setSceneForm({ ...sceneForm, location: e.target.value })
                }
                placeholder="e.g., INT. OFFICE - DAY"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={sceneForm.description}
                onChange={(e) =>
                  setSceneForm({ ...sceneForm, description: e.target.value })
                }
                placeholder="Enter scene description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSceneDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={saveScene} disabled={saving || !sceneForm.name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

