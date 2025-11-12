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

// Screenplay page number calculation (standard: ~55 lines per page)
const LINES_PER_PAGE = 55

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
  const [editedContent, setEditedContent] = useState<string>("")
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
          setActiveScriptAsset(latestProjectScript)
          setFullScript(latestProjectScript.content || "")
          setScriptAssets([latestProjectScript])
        } else if (sceneScripts.length > 0) {
          // If no project-level script, fetch and combine scene scripts
          await fetchScriptsFromScenes()
        } else {
          // No scripts found at all
          setFullScript("")
          setScriptAssets([])
          setActiveScriptAsset(null)
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
      // Get timeline for this project
      const { data: timeline, error: timelineError } = await getSupabaseClient()
        .from('timelines')
        .select('id')
        .eq('project_id', id)
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

      // Get scripts for each scene
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
        // Combine scripts in scene order
        const combinedScript = scenes
          .map(scene => {
            const sceneScript = sceneScripts.find(s => s.scene_id === scene.id)
            if (!sceneScript) return null
            
            const sceneNumber = scene.metadata?.sceneNumber || scene.name
            const content = sceneScript.content || ""
            return `\n\n=== SCENE ${sceneNumber}: ${scene.name} ===\n\n${content}`
          })
          .filter(Boolean)
          .join("\n\n")
        
        setFullScript(combinedScript)
        setScriptAssets(sceneScripts)
        
        // Use the first scene script as the active script, but store combined content
        if (sceneScripts.length > 0) {
          const firstScript = sceneScripts[0]
          setActiveScriptAsset({
            ...firstScript,
            title: `${movie?.name || 'Screenplay'} - Full Script`,
            content: combinedScript,
          } as Asset)
        }
      }
    } catch (error) {
      console.error('Error fetching scripts from scenes:', error)
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
    setEditedContent(fullScript || "")
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent("")
  }

  const handleSave = async () => {
    if (!userId) return

    try {
      setSaving(true)

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
          content: editedContent,
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
          content: editedContent,
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
      setAiEditData({
        selectedText: selectedText,
        fullContent: editedContent || fullScript,
        assetId: activeScriptAsset.id,
        field: 'content'
      })
      setShowAITextEditor(true)
    }
  }


  // Handle AI text replacement
  const handleAITextReplace = (newText: string) => {
    if (!aiEditData) return
    
    // Get current textarea and its selection to ensure we use the latest positions
    const textarea = document.querySelector('textarea[data-screenplay-editor]') as HTMLTextAreaElement
    if (!textarea) {
      // Fallback to stored selection positions
      const currentValue = editedContent || fullScript
      const newValue = currentValue.substring(0, selectionStart) + newText + currentValue.substring(selectionEnd)
      setEditedContent(newValue)
    } else {
      // Use current textarea selection positions (in case content changed)
      // Try to use stored positions first, but validate them
      const currentValue = editedContent || fullScript
      let start = selectionStart
      let end = selectionEnd
      
      // Validate that stored positions are still valid
      if (start < 0 || end > currentValue.length || start > end) {
        // Fallback to textarea's current selection
        start = textarea.selectionStart
        end = textarea.selectionEnd
      }
      
      // Replace the selected text
      const newValue = currentValue.substring(0, start) + newText + currentValue.substring(end)
      setEditedContent(newValue)
      
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

  // Get current page content
  const getCurrentPageContent = () => {
    if (isEditing) {
      return editedContent
    }
    return pages[currentPage - 1] || fullScript
  }

  // Get current page text for audio generation
  const getCurrentPageText = () => {
    if (isEditing) {
      const lines = editedContent.split('\n')
      const startLine = (currentPage - 1) * LINES_PER_PAGE
      const endLine = Math.min(startLine + LINES_PER_PAGE, lines.length)
      return lines.slice(startLine, endLine).join('\n')
    }
    return pages[currentPage - 1] || ""
  }

  // Navigate to page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      // Scroll to top of script content when page changes
      setTimeout(() => {
        const scriptCard = document.querySelector('[data-script-content]')
        if (scriptCard) {
          scriptCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
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
                  {fullScript && fullScript.trim().length > 0 && (
                    <Button onClick={exportToPDF} variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
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
                  {!isEditing && totalPages > 1 && (
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
                <div className="space-y-2 relative">
                  <Textarea
                    ref={textareaRef}
                    data-screenplay-editor
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    onSelect={handleTextSelection}
                    className="min-h-[600px] font-mono text-sm leading-relaxed"
                    placeholder="Enter your screenplay here..."
                  />
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
                  <p className="text-xs text-muted-foreground">
                    💡 Tip: Select text to see the AI edit button in the floating toolbar.
                  </p>
                </div>
              ) : (
                <div className="bg-muted/20 p-6 rounded-lg border">
                  <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
                    {getCurrentPageContent()}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Pagination */}
        {!isEditing && fullScript && totalPages > 1 && (
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

