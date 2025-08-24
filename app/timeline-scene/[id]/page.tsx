"use client"
import { useState, useEffect } from "react"
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
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useParams } from "next/navigation"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { useAuth } from "@/lib/auth-context-fixed"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import FileImport from "@/components/file-import"
import TextToSpeech from "@/components/text-to-speech"
import AITextEditor from "@/components/ai-text-editor"
import { useIsMobile } from "@/hooks/use-mobile"
import { Navigation } from "@/components/navigation"

export default function ScenePage() {
  const params = useParams()
  const id = params.id as string

  return <ScenePageClient id={id} />
}

function ScenePageClient({ id }: { id: string }) {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const isMobile = useIsMobile()
  console.log('🎬 DEBUG - isMobile value:', isMobile)



  // State variables
  const [activeTab, setActiveTab] = useState("scripts")
  const [newNote, setNewNote] = useState("")
  const [newNoteType, setNewNoteType] = useState("General")
  const [isEditing, setIsEditing] = useState(false)
  const [showMediaUpload, setShowMediaUpload] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scene, setScene] = useState<SceneWithMetadata | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [showVersionCompare, setShowVersionCompare] = useState(false)
  const [compareVersions, setCompareVersions] = useState<Asset[]>([])
  const [showVersionEdit, setShowVersionEdit] = useState(false)
  const [editingVersion, setEditingVersion] = useState<Asset | null>(null)
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

  const [selectedVersions, setSelectedVersions] = useState<Record<string, Asset>>({})
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null)

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
    let mounted = true
    
    const fetchSceneData = async () => {

      
      if (!id || !user?.id) {

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
        
        if (scene && mounted) {

          setScene(scene)
          
          // Get project ID through timeline
          try {
            const { data: timeline, error } = await supabase
              .from('timelines')
              .select('project_id')
              .eq('id', scene.timeline_id)
              .single()
            
            if (timeline && !error && mounted) {
              setProjectId(timeline.project_id)
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

    return () => {
      mounted = false
    }
  }, [id, user?.id])

  // Cleanup function for inline editing
  useEffect(() => {
    return () => {
      // Clear editing states
      setInlineEditing(null)
      setSavingStatus(null)
    }
  }, [])

  // Effect to fetch assets
  useEffect(() => {
    let mounted = true
    
    const fetchAssets = async () => {

      
      if (!id || !user?.id) {

        return
      }
      
      try {
        setAssetsLoading(true)
        
        // Single, efficient query for scene assets
        const { data: sceneAssets, error } = await supabase
          .from('assets')
          .select('*')
          .eq('scene_id', id)
          .eq('user_id', user.id)
        
        if (error) {

          if (mounted) {
            setAssets([])
          }
        } else {

          if (mounted) {
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
  }, [id, user?.id])

  // Effect to set initial active script
  useEffect(() => {
    const scriptAssets = assets.filter(a => a.content_type === 'script')
    if (scriptAssets.length > 0 && !activeScriptId) {
      // Set the latest version as the initial active script
      const latestScript = scriptAssets.find(a => a.is_latest_version) || scriptAssets[0]
      setActiveScriptId(latestScript.id)
    }
  }, [assets, activeScriptId])

  // Function to refresh assets
  const refreshAssets = async () => {
    try {
      setAssetsLoading(true)
      const { data: sceneAssets, error } = await supabase
        .from('assets')
        .select('*')
        .eq('scene_id', id)
        .eq('user_id', user?.id)
      
      if (error) {

      } else {
        setAssets(sceneAssets || [])
      }
    } catch (error) {

    } finally {
      setAssetsLoading(false)
    }
  }

  // Mock scene data - replace with actual data fetching
  const [editForm, setEditForm] = useState({
    name: scene?.name || "",
    description: scene?.description || "",
    start_time_seconds: scene?.start_time_seconds || 0,
    duration_seconds: scene?.duration_seconds || 0,
    scene_type: scene?.scene_type || "video",
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
        // For now, just update local state since we don't have updateScene method yet
        setScene((prev) => prev ? { ...prev, ...editForm } : null)
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
      duration_seconds: scene?.duration_seconds || 0,
      scene_type: scene?.scene_type || "video",
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

  // Simple loading state
  if (loading || authLoading) {
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

  // Enhanced text selection handler
  const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    e.preventDefault()
    
    const target = e.target as HTMLTextAreaElement
    const selection = target.value.substring(target.selectionStart, target.selectionEnd)
    
    if (selection.length > 0) {
      // Store selection for context menu actions
      setInlineEditing(prev => prev ? { ...prev, selection } : null)
    } else {
      // Clear selection
      setInlineEditing(prev => prev ? { ...prev, selection: undefined } : null)
    }
  }

  // AI text editing handler
  const handleAITextEdit = (selectedText: string, fullContent: string, assetId: string) => {
    setAiEditData({
      selectedText,
      fullContent,
      assetId,
      field: 'content'
    })
    setShowAITextEditor(true)
  }

  // Handle AI text replacement
  const handleAITextReplace = (newText: string) => {
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
          .eq('user_id', user?.id)
        
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
      // For version names, create shorter, descriptive names
      if (originalName.includes('v3')) return isMobile ? 'V3' : 'Version 3'
      if (originalName.includes('v2')) return isMobile ? 'V2' : 'Version 2'
      if (originalName.includes('v1')) return isMobile ? 'V1' : 'Version 1'
      if (originalName.includes('Final')) return isMobile ? 'Final' : 'Final Version'
      if (originalName.includes('Draft')) return isMobile ? 'Draft' : 'Draft'
      if (originalName.includes('Scene_1')) return isMobile ? 'S1' : 'Scene 1'
      if (originalName.includes('Scene_2')) return isMobile ? 'S2' : 'Scene 2'
      if (originalName.includes('Copy')) return isMobile ? 'Copy' : 'Copy'
      if (originalName.includes('Edited')) return isMobile ? 'Edited' : 'Edited'
      if (originalName.includes('Revised')) return isMobile ? 'Revised' : 'Revised'
      
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
    
    // Always prioritize the version number for display formatting
    if (script.version !== undefined && script.version !== null) {
      const result = isMobile ? `V${script.version}` : `Version ${script.version}`
      console.log('🎬 DEBUG - Using version number, result:', result)
      return result
    }
    
    // If no version number, check if version_name exists and is meaningful
    if (script.version_name && script.version_name.trim()) {
      // Only use version_name if it's not just a number
      const isJustNumber = /^\d+$/.test(script.version_name.trim())
      if (!isJustNumber) {
        const cleanName = generateCleanName(script.version_name, 'version_name', isMobile)
        console.log('🎬 DEBUG - Using meaningful version_name, result:', cleanName)
        return cleanName
      }
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href={getTimelineUrl()}>
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to Timeline</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">
                Scene: {scene.name}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">{scene.description}</p>
            </div>
          </div>
          
          {/* Breadcrumb Navigation - Hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href={getTimelineUrl()} className="hover:text-primary transition-colors">
              Timeline
            </Link>
            <span>/</span>
            <span className="text-primary font-medium">Scene: {scene.name}</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mb-4 sm:mb-6">
          {/* Create New Script Version */}
          {assets.filter(a => a.content_type === 'script').length > 0 && (
            <Button
              variant="outline"
              size="sm"
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
              Duplicate Script
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("import")}
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 bg-transparent"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Files
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={startEditing}
            className="border-primary/30 text-primary hover:bg-primary/10 bg-transparent"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Scene
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
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

        </div>



        {/* Unlinked Assets Section */}
        {assets.length === 0 && (
          <Card className="bg-card border-orange-500/20 mb-6">
            <CardHeader>
              <CardTitle className="text-orange-500">Link Existing Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                You have assets that aren't linked to this scene. Would you like to link them?
              </p>
              <Button
                onClick={async () => {
                  try {
                    // Get all assets for the user
                    const { data: allAssets } = await supabase
                      .from('assets')
                      .select('*')
                      .eq('user_id', user?.id)
                      .is('scene_id', null)
                    
                    if (allAssets && allAssets.length > 0) {
                      // Link them to this scene
                      const { error } = await supabase
                        .from('assets')
                        .update({ scene_id: id })
                        .eq('user_id', user?.id)
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
                      }
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
        )}

        {/* Scene Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Duration</span>
              </div>
              <p className="text-2xl font-bold text-primary">{scene.duration_seconds}s</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Type</span>
              </div>
              <Badge className="text-sm">{scene.scene_type}</Badge>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Start Time</span>
              </div>
              <p className="text-2xl font-bold text-primary">{scene.start_time_seconds}s</p>
            </CardContent>
          </Card>
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
                  size="sm"
                  className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                  onClick={() => router.push('/ai-studio')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Script
                </Button>
              </div>
            </div>



            {assets.filter(a => a.content_type === 'script').length > 0 ? (
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
                               <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                                 {(() => {
                                   const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                   return getCleanVersionName(activeScript, isMobile)
                                 })()}
                               </Badge>
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
                                         
                                         // Delete only this specific version
                                         const { error: deleteError } = await supabase
                                           .from('assets')
                                           .delete()
                                           .eq('id', activeScript.id)
                                           .eq('user_id', user?.id)
                                         
                                         if (deleteError) {
                                           throw new Error(`Failed to delete: ${deleteError.message}`)
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
                         
                         {/* Text to Speech Component */}
                         <div data-tts-component>
                           <TextToSpeech 
                             text={(() => {
                               const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                               return activeScript.content || ''
                             })()}
                             title={(() => {
                               const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                               return generateCleanName(activeScript.title, 'title') || 'Script'
                             })()}
                             className="mt-4"
                             projectId={projectId}
                             sceneId={id}
                           />
                         </div>
                       </CardContent>
                     </Card>
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
                                 <AlertDialogContent className="bg-background border-red-500/20">
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
                          
                          {/* Text to Speech Component */}
                          <div data-tts-component>
                            <TextToSpeech 
                              text={selectedVersion.content || ''}
                              title={generateCleanName(selectedVersion.title, 'title') || 'Script'}
                              className="mt-4"
                              projectId={projectId}
                              sceneId={id}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                })()}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No scripts generated for this scene yet</p>
                  <div className="space-y-3">
                    <Button
                      onClick={() => router.push('/ai-studio')}
                      className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Generate Your First Script
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      💡 Once you have a script, you can create new versions to track changes and experiment with variations
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                          />
                        ) : (
                          <Play className="h-8 w-8 text-muted-foreground" />
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
          <DialogContent className="bg-background border-primary/20 max-w-2xl">
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
                <Label className="text-muted-foreground">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="bg-card border-primary/30 text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <Input
                    value={editForm.duration_seconds}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, duration_seconds: parseInt(e.target.value, 10) || 0 }))}
                    className="bg-card border-primary/30 text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Select
                    value={editForm.scene_type}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, scene_type: value }))}
                  >
                    <SelectTrigger className="bg-card border-primary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-primary/30">
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
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

        </div>
      </div>
    </div>
  )
}
