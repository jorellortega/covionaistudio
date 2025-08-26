"use client"

import { useState, useEffect } from "react"
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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Filter, Image as ImageIcon, FileText, Sparkles, Edit, Trash2, Eye, Download, CheckCircle, ArrowLeft, Film, Clock, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StoryboardsService, Storyboard, CreateStoryboardData } from "@/lib/storyboards-service"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"

interface SceneInfo {
  id: string
  name: string
  description?: string
  start_time_seconds: number
  duration_seconds: number
  timeline_name: string
  project_name: string
  project_id: string
  scene_number?: string
  metadata?: any
}

export default function SceneStoryboardsPage() {
  const params = useParams()
  const router = useRouter()
  const sceneId = params.sceneId as string
  
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null)
  const [isLoadingStoryboards, setIsLoadingStoryboards] = useState(true)
  const [isLoadingScene, setIsLoadingScene] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingStoryboard, setEditingStoryboard] = useState<Storyboard | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateStoryboardData>({
    title: "",
    description: "",
    scene_number: 1,
    shot_number: 1,
    shot_type: "wide",
    camera_angle: "eye-level",
    movement: "static",
    dialogue: "",
    action: "",
    visual_notes: "",
    image_url: "",
    project_id: "",
    scene_id: sceneId
  })

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingText, setIsGeneratingText] = useState(false)
  const [selectedAIService, setSelectedAIService] = useState("dalle")
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  
  // Script state
  const [sceneScript, setSceneScript] = useState<string>("")
  const [isLoadingScript, setIsLoadingScript] = useState(false)
  
  // Text selection state
  const [selectedText, setSelectedText] = useState("")
  const [selectionStart, setSelectionStart] = useState(0)
  const [selectionEnd, setSelectionEnd] = useState(0)
  const [showSelectionActions, setShowSelectionActions] = useState(false)

  useEffect(() => {
    if (ready && userId && sceneId) {
      fetchSceneInfo()
      fetchStoryboards()
      fetchSceneScript()
    }
  }, [ready, userId, sceneId])

  // Hide selection actions when clicking outside and handle global selection changes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSelectionActions) {
        setShowSelectionActions(false)
        setSelectedText("")
      }
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().length > 0) {
        const text = selection.toString().trim()
        if (text.length > 0) {
          console.log("🎬 Global selection change detected:", text)
          setSelectedText(text)
          setShowSelectionActions(true)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('selectionchange', handleSelectionChange)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [showSelectionActions])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready || !userId) return
      
      try {
        const settings = await AISettingsService.getUserSettings(userId)
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'images'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'videos'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'audio')
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
          console.log('Setting locked model for images:', imagesSetting.locked_model)
          setSelectedAIService(imagesSetting.locked_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  const fetchSceneInfo = async () => {
    try {
      // Fetch the actual scene data
      const scene = await TimelineService.getSceneById(sceneId)
      
      if (!scene) {
        toast({
          title: "Scene Not Found",
          description: "The requested scene could not be found.",
          variant: "destructive"
        })
        router.push('/movies')
        return
      }

      console.log("🎬 Scene found:", scene)
      console.log("🎬 Scene timeline_id:", scene.timeline_id)
      console.log("🎬 Scene metadata:", scene.metadata)
      console.log("🎬 Scene order_index:", scene.order_index)

      // Get the timeline and project information
      let timelineName = "Unknown Timeline"
      let projectName = "Unknown Project"
      let projectId = ""
      
      try {
        // First try to get timeline directly by ID
        console.log("🎬 Looking for timeline with ID:", scene.timeline_id)
        
        // Query the timeline directly by ID
        console.log("🎬 Querying timelines table for ID:", scene.timeline_id)
        const { data: timeline, error: timelineError } = await getSupabaseClient()
          .from('timelines')
          .select('*')
          .eq('id', scene.timeline_id)
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
          
          // Alternative: try to get project directly from scene's timeline_id
          // This might be a direct project reference
          try {
            const directProject = await TimelineService.getMovieById(scene.timeline_id)
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
      } catch (error) {
        console.warn("Could not fetch timeline/project info:", error)
      }

      setSceneInfo({
        id: scene.id,
        name: scene.name,
        description: scene.description,
        start_time_seconds: scene.start_time_seconds,
        duration_seconds: scene.duration_seconds,
        timeline_name: timelineName,
        project_name: projectName,
        project_id: projectId,
        scene_number: scene.metadata?.sceneNumber,
        metadata: scene.metadata
      })
    } catch (error) {
      console.error("Error fetching scene info:", error)
      toast({
        title: "Error",
        description: "Failed to fetch scene information.",
        variant: "destructive"
      })
    } finally {
      setIsLoadingScene(false)
    }
  }

  const handleTextSelection = () => {
    // Add a small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection()
      console.log("🎬 Text selection event triggered")
      console.log("🎬 Selection:", selection?.toString())
      
      if (selection && selection.toString().length > 0) {
        const text = selection.toString().trim()
        console.log("🎬 Selected text:", text)
        
        if (text.length > 0) {
          setSelectedText(text)
          setShowSelectionActions(true)
          console.log("🎬 Showing selection actions")
        }
      } else {
        console.log("🎬 No text selected, hiding actions")
        setShowSelectionActions(false)
        setSelectedText("")
      }
    }, 100)
  }

  const handleCreateShotFromSelection = () => {
    console.log("🎬 handleCreateShotFromSelection called")
    console.log("🎬 selectedText:", selectedText)
    console.log("🎬 showCreateForm before:", showCreateForm)
    
    if (selectedText) {
      console.log("🎬 Setting form data with selected text")
      
      // Pre-fill the storyboard form with the selected text
      setFormData(prev => {
        console.log("🎬 Previous form data:", prev)
        const newData = {
          ...prev,
          title: `Shot from Script`,
          description: selectedText,
          shot_number: getNextShotNumber()
        }
        console.log("🎬 New form data:", newData)
        return newData
      })
      
      // Show the create form
      setShowCreateForm(true)
      console.log("🎬 showCreateForm set to true")
      
      // Clear selection
      setShowSelectionActions(false)
      setSelectedText("")
      window.getSelection()?.removeAllRanges()
      
      // Force a re-render
      setTimeout(() => {
        console.log("🎬 showCreateForm after timeout:", showCreateForm)
      }, 100)
    } else {
      console.log("🎬 No selected text found!")
    }
  }

  const handleHighlightSelection = () => {
    if (selectedText) {
      // You could save highlights to a separate table or add them to the script
      toast({
        title: "Text Highlighted",
        description: `Highlighted: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`,
      })
      
      // Clear selection
      setShowSelectionActions(false)
      setSelectedText("")
      window.getSelection()?.removeAllRanges()
    }
  }

  const handleAddNoteToSelection = () => {
    if (selectedText) {
      // You could open a note dialog or add to a notes table
      toast({
        title: "Add Note",
        description: `Add note to: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`,
      })
      
      // Clear selection
      setShowSelectionActions(false)
      setSelectedText("")
      window.getSelection()?.removeAllRanges()
    }
  }

  const fetchSceneScript = async () => {
    try {
      setIsLoadingScript(true)
      console.log("🎬 Fetching script for scene:", sceneId)
      
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
    try {
      console.log("🎬 Fetching storyboards for scene:", sceneId)
      
      // First, let's check if there are any storyboards at all
      const { data: allStoryboards, error: allError } = await getSupabaseClient()
        .from('storyboards')
        .select('*')
        .eq('user_id', userId)
      
      console.log("🎬 All storyboards for user:", allStoryboards)
      console.log("🎬 All storyboards error:", allError)
      
      // Now try to get storyboards for this specific scene
      const data = await StoryboardsService.getStoryboardsByScene(sceneId)
      console.log("🎬 Storyboards fetched for scene:", data)
      setStoryboards(data)
    } catch (error) {
      console.error("Error fetching storyboards:", error)
      toast({
        title: "Error",
        description: "Failed to fetch storyboards",
        variant: "destructive"
      })
    } finally {
      setIsLoadingStoryboards(false)
    }
  }

  // Function to get next shot number for this scene
  const getNextShotNumber = () => {
    if (storyboards.length === 0) return 1
    return Math.max(...storyboards.map(sb => sb.shot_number || 1)) + 1
  }

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

      const newStoryboard = await StoryboardsService.createStoryboard(cleanFormData)
      setStoryboards(prev => [newStoryboard, ...prev])
      setShowCreateForm(false)
      resetForm()
      
      toast({
        title: "Success",
        description: "Storyboard created successfully"
      })
    } catch (error) {
      console.error("Error creating storyboard:", error)
      toast({
        title: "Error",
        description: "Failed to create storyboard",
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

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      scene_number: 1,
      shot_number: getNextShotNumber(),
      shot_type: "wide",
      camera_angle: "eye-level",
      movement: "static",
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

  const filteredStoryboards = storyboards.filter(storyboard => {
    const matchesSearch = storyboard.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         storyboard.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === "all" || 
                         (filterStatus === "ai" && storyboard.ai_generated) ||
                         (filterStatus === "manual" && !storyboard.ai_generated)
    
    return matchesSearch && matchesFilter
  })

  if (isLoadingScene || isLoadingStoryboards) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!sceneInfo) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Scene Not Found</h1>
            <p className="text-muted-foreground mb-4">The scene you're looking for doesn't exist.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link href="/movies" className="hover:text-foreground">Movies</Link>
            <span>/</span>
            <Link href={`/timeline?movie=${sceneInfo.project_id}`} className="hover:text-foreground">
              {sceneInfo.project_name}
            </Link>
            <span>/</span>
            <Link href={`/timeline?movie=${sceneInfo.project_id}`} className="hover:text-foreground">
              {sceneInfo.timeline_name}
            </Link>
            <span>/</span>
            <span className="text-foreground">
              {sceneInfo.scene_number ? `Scene ${sceneInfo.scene_number}: ` : ''}{sceneInfo.name}
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
            <div>
              <div className="flex items-center gap-3 mb-2">
                {sceneInfo.scene_number && (
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    Scene {sceneInfo.scene_number}
                  </Badge>
                )}
                <h1 className="text-4xl font-bold">{sceneInfo.name}</h1>
              </div>
              <p className="text-muted-foreground text-lg">{sceneInfo.description}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Film className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{sceneInfo.project_name}</div>
                <div className="text-xs text-muted-foreground">Project</div>
              </div>
            </div>
            {sceneInfo.scene_number && (
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
                <div className="text-sm font-medium">{sceneInfo.start_time_seconds}s</div>
                <div className="text-xs text-muted-foreground">Start Time</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{sceneInfo.duration_seconds}s</div>
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
          
          {sceneScript ? (
            <Card className="bg-muted/20 border-border/50">
              <CardContent className="p-6">
                <div className="bg-background/50 rounded-lg p-4 border border-border/30 relative">
                  <pre 
                    className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed select-text cursor-text"
                    onMouseUp={handleTextSelection}
                    onKeyUp={handleTextSelection}
                    onSelect={handleTextSelection}
                    onMouseDown={() => setShowSelectionActions(false)}
                  >
                    {sceneScript}
                  </pre>
                  
                  {/* Selection Action Buttons */}
                  {console.log("🎬 Rendering selection actions:", { showSelectionActions, selectedText: selectedText?.length, selectedTextValue: selectedText })}
                  {showSelectionActions && selectedText && (
                    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-background border border-border rounded-lg shadow-lg p-2 z-50">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                          {selectedText.length} chars selected
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log("🎬 Create Shot button clicked!")
                            console.log("🎬 Selected text:", selectedText)
                            handleCreateShotFromSelection()
                          }}
                          className="text-xs h-7 px-2"
                        >
                          <Film className="h-3 w-3 mr-1" />
                          Create Shot
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log("🎬 Test button clicked!")
                            alert("Test button works! Selected text: " + selectedText)
                          }}
                          className="text-xs h-7 px-2"
                        >
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log("🎬 Highlight button clicked!")
                            // Create a highlight by adding a note to the storyboard
                            setFormData(prev => ({
                              ...prev,
                              title: `Highlight: ${selectedText.substring(0, 30)}...`,
                              description: `HIGHLIGHTED TEXT:\n${selectedText}`,
                              shot_number: getNextShotNumber()
                            }))
                            setShowCreateForm(true)
                            setShowSelectionActions(false)
                          }}
                          className="text-xs h-7 px-2"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Highlight
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log("🎬 Add Note button clicked!")
                            // Add a note by creating a storyboard with the selected text
                            setFormData(prev => ({
                              ...prev,
                              title: `Note: ${selectedText.substring(0, 30)}...`,
                              description: `NOTE:\n${selectedText}`,
                              shot_number: getNextShotNumber()
                            }))
                            setShowCreateForm(true)
                            setShowSelectionActions(false)
                          }}
                          className="text-xs h-7 px-2"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Add Note
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowSelectionActions(false)
                            setSelectedText("")
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

          {/* Sequence Overview */}
          {filteredStoryboards.length > 0 && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  {sceneInfo.scene_number ? `Scene ${sceneInfo.scene_number} - ` : ''}Shot Sequence:
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
                Create New Storyboard for {sceneInfo.name}
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
                  <div className="flex gap-2">
                    <Input
                      id="shot_number"
                      type="number"
                      value={formData.shot_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, shot_number: parseInt(e.target.value) || 1 }))}
                      min="1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextShot = getNextShotNumber()
                        setFormData(prev => ({ ...prev, shot_number: nextShot }))
                      }}
                      title="Auto-fill next shot number"
                    >
                      Next
                    </Button>
                  </div>
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
                Update the storyboard details below.
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
                  <div className="flex gap-2">
                    <Input
                      id="edit-shot_number"
                      type="number"
                      value={formData.shot_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, shot_number: parseInt(e.target.value) || 1 }))}
                      min="1"
                    />
                  </div>
                </div>
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
                    className={storyboard.ai_generated ? "bg-purple-500/20 text-purple-500 border-purple-500/30" : "bg-blue-500/20 text-blue-500 border-blue-500/30"}
                  >
                    {storyboard.ai_generated ? "AI Generated" : "Manual"}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    Shot {storyboard.shot_number || 1}
                  </span>
                  {sceneInfo.scene_number && (
                    <span className="bg-blue-500/20 text-blue-500 px-2 py-1 rounded text-xs font-mono border border-blue-500/30">
                      Scene {sceneInfo.scene_number}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {storyboard.image_url && (
                  <div className="relative h-48 bg-muted rounded-lg overflow-hidden">
                    <img
                      src={storyboard.image_url}
                      alt={storyboard.title}
                      className="w-full h-full object-cover"
                    />
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
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Updated {new Date(storyboard.updated_at).toLocaleDateString()}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="h-4 w-4" />
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
                          dialogue: storyboard.dialogue || "",
                          action: storyboard.action || "",
                          visual_notes: storyboard.visual_notes || "",
                          image_url: storyboard.image_url || "",
                          project_id: storyboard.project_id || "",
                          scene_id: sceneId
                        })
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
    </div>
  )
}
