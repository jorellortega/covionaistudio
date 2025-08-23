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

export default function ScenePage() {
  const params = useParams()
  const id = params.id as string

  return <ScenePageClient id={id} />
}

function ScenePageClient({ id }: { id: string }) {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  // Debug logging for authentication state
  useEffect(() => {
    console.log('🎬 TIMELINE-SCENE - Auth State Change:', {
      userId: user?.id,
      userEmail: user?.email,
      authLoading,
      sceneId: id,
      timestamp: new Date().toISOString()
    })
  }, [user, authLoading, id])

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
    content: ''
  })
  const [projectId, setProjectId] = useState<string>("")
  
  const [selectedVersions, setSelectedVersions] = useState<Record<string, Asset>>({})
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null)

  // Effect to fetch scene data
  useEffect(() => {
    let mounted = true
    
    const fetchSceneData = async () => {
      console.log('🎬 TIMELINE-SCENE - Starting scene data fetch:', { 
        sceneId: id, 
        userId: user?.id, 
        timestamp: new Date().toISOString() 
      })
      
      if (!id || !user?.id) {
        console.log('🎬 TIMELINE-SCENE - Missing required data for fetch:', { hasId: !!id, hasUserId: !!user?.id })
        return
      }

      // Validate scene ID format
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error('🎬 TIMELINE-SCENE - Invalid scene ID format:', id)
        setLoading(false)
        return
      }
      
      try {
        console.log('🎬 TIMELINE-SCENE - Setting loading state to true')
        setLoading(true)
        
        console.log('🎬 TIMELINE-SCENE - Calling TimelineService.getSceneById...')
        const startTime = Date.now()
        
        // First check if scene exists in database
        console.log('🎬 TIMELINE-SCENE - Checking if scene exists in database...')
        const { data: sceneCheck, error: sceneCheckError } = await supabase
          .from('scenes')
          .select('id, name, user_id, project_id')
          .eq('id', id)
          .single()
        
        if (sceneCheckError) {
          console.error('🎬 TIMELINE-SCENE - Scene check error:', sceneCheckError)
          if (sceneCheckError.code === 'PGRST116') {
            console.error('🎬 TIMELINE-SCENE - Scene not found in database')
            setLoading(false)
            return
          }
        } else {
          console.log('🎬 TIMELINE-SCENE - Scene found in database:', sceneCheck)
          
          // Check if user has access to this scene
          if (sceneCheck.user_id !== user.id) {
            console.error('🎬 TIMELINE-SCENE - User does not have access to this scene')
            setLoading(false)
            return
          }
          
          // Check what other scenes exist for this user
          const { data: userScenes, error: userScenesError } = await supabase
            .from('scenes')
            .select('id, name, project_id')
            .eq('user_id', user.id)
          
          if (userScenesError) {
            console.error('🎬 TIMELINE-SCENE - Error fetching user scenes:', userScenesError)
          } else {
            console.log('🎬 TIMELINE-SCENE - All user scenes:', userScenes)
          }
        }
        
        const scene = await TimelineService.getSceneById(id)
        const fetchTime = Date.now() - startTime
        console.log('🎬 TIMELINE-SCENE - Scene fetched successfully:', { 
          sceneId: scene?.id, 
          sceneName: scene?.name, 
          fetchTimeMs: fetchTime,
          sceneData: scene,
          sceneType: typeof scene,
          isNull: scene === null,
          isUndefined: scene === undefined
        })
        
        if (scene && mounted) {
          console.log('🎬 TIMELINE-SCENE - Scene is valid, setting state')
          setScene(scene)
          
          // Get project ID through timeline
          try {
            console.log('🎬 TIMELINE-SCENE - Fetching timeline for project ID...')
            const timelineStartTime = Date.now()
            const { data: timeline, error } = await supabase
              .from('timelines')
              .select('project_id')
              .eq('id', scene.timeline_id)
              .single()
            
            const timelineFetchTime = Date.now() - timelineStartTime
            console.log('🎬 TIMELINE-SCENE - Timeline fetch result:', { 
              timeline, 
              error, 
              fetchTimeMs: timelineFetchTime 
            })
            
            if (timeline && !error && mounted) {
              console.log('🎬 TIMELINE-SCENE - Setting project ID:', timeline.project_id)
              setProjectId(timeline.project_id)
            }
          } catch (timelineError) {
            console.error('🎬 TIMELINE-SCENE - Error fetching timeline:', timelineError)
          }
        } else if (mounted) {
          console.error('🎬 TIMELINE-SCENE - Scene is null/undefined, this will cause infinite loading')
          // Set loading to false to prevent infinite loading
          setLoading(false)
        }
      } catch (error) {
        console.error('🎬 TIMELINE-SCENE - Error fetching scene:', error)
        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to load scene data.",
            variant: "destructive",
          })
        }
      } finally {
        if (mounted) {
          console.log('🎬 TIMELINE-SCENE - Setting loading state to false')
          setLoading(false)
        }
      }
    }

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('🎬 TIMELINE-SCENE - Safety timeout triggered, forcing loading to false')
        setLoading(false)
      }
    }, 10000) // 10 second timeout

    fetchSceneData()

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
    }
  }, [id, user?.id]) // Removed toast dependency to prevent infinite loops

  // Effect to fetch assets
  useEffect(() => {
    let mounted = true
    
    const fetchAssets = async () => {
      console.log('🎬 TIMELINE-SCENE - Starting assets fetch:', { 
        sceneId: id, 
        userId: user?.id, 
        timestamp: new Date().toISOString() 
      })
      
      if (!id || !user?.id) {
        console.log('🎬 TIMELINE-SCENE - Missing required data for assets fetch:', { hasId: !!id, hasUserId: !!user?.id })
        return
      }
      
      try {
        console.log('🎬 TIMELINE-SCENE - Setting assets loading state to true')
        setAssetsLoading(true)
        
        console.log('🎬 TIMELINE-SCENE - Fetching assets for scene:', id)
        console.log('🎬 TIMELINE-SCENE - Current user:', user.id)
        
        // First, let's check the database schema and see what assets exist
        console.log('🎬 TIMELINE-SCENE - Checking database schema and assets...')
        const schemaStartTime = Date.now()
        
        // Check if assets table has any data at all
        const { data: allAssetsGlobal, error: allAssetsGlobalError } = await supabase
          .from('assets')
          .select('*')
        
        const schemaCheckTime = Date.now() - schemaStartTime
        if (allAssetsGlobalError) {
          console.error('🎬 TIMELINE-SCENE - Assets table error:', allAssetsGlobalError)
        } else {
          console.log('🎬 TIMELINE-SCENE - Assets table check completed:', { 
            totalAssets: allAssetsGlobal?.length || 0,
            sampleAsset: allAssetsGlobal?.[0], 
            availableColumns: allAssetsGlobal?.[0] ? Object.keys(allAssetsGlobal?.[0]) : 'No data',
            checkTimeMs: schemaCheckTime,
            sceneIds: allAssetsGlobal?.map(a => a.scene_id).filter(Boolean),
            userIds: allAssetsGlobal?.map(a => a.user_id).filter(Boolean)
          })
        }
        
        // First, let's check if there are any assets at all for this user
        console.log('🎬 TIMELINE-SCENE - Fetching all assets for user...')
        const allAssetsStartTime = Date.now()
        const { data: allUserAssets, error: allUserAssetsError } = await supabase
          .from('assets')
          .select('*')
          .eq('user_id', user.id)
        
        const allAssetsTime = Date.now() - allAssetsStartTime
        if (allUserAssetsError) {
          console.error('🎬 TIMELINE-SCENE - Error fetching all assets:', allUserAssetsError)
        } else {
          console.log('🎬 TIMELINE-SCENE - All assets for user fetched:', { 
            count: allUserAssets?.length, 
            fetchTimeMs: allAssetsTime 
          })
          allUserAssets?.forEach((asset, index) => {
            console.log(`🎬 TIMELINE-SCENE - Asset ${index + 1}:`, {
              id: asset.id,
              title: asset.title,
              content_type: asset.content_type,
              project_id: asset.project_id,
              scene_id: asset.scene_id,
              user_id: asset.user_id,
              version_name: asset.version_name, // Check if this column exists
              version: asset.version
            })
          })
        }
        
        // Now fetch assets for this specific scene
        console.log('🎬 TIMELINE-SCENE - Fetching assets for specific scene...')
        const sceneAssetsStartTime = Date.now()
        const fetchedAssets = await AssetService.getAssetsForScene(id)
        const sceneAssetsTime = Date.now() - sceneAssetsStartTime
        console.log('🎬 TIMELINE-SCENE - Scene assets fetched:', { 
          count: fetchedAssets.length, 
          fetchTimeMs: sceneAssetsTime 
        })
        
        // Also check manually for assets linked to this scene
        console.log('🎬 TIMELINE-SCENE - Manual scene assets fetch...')
        const manualStartTime = Date.now()
        
        // Try different query approaches to debug the issue
        console.log('🎬 TIMELINE-SCENE - Trying different query approaches...')
        
        // Approach 1: Just by scene_id
        const { data: sceneAssetsOnly, error: sceneAssetsOnlyError } = await supabase
          .from('assets')
          .select('*')
          .eq('scene_id', id)
        
        console.log('🎬 TIMELINE-SCENE - Assets by scene_id only:', { 
          count: sceneAssetsOnly?.length, 
          error: sceneAssetsOnlyError,
          sceneId: id
        })
        
        // Approach 2: By user_id and scene_id
        const { data: manualSceneAssets, error: manualError } = await supabase
          .from('assets')
          .select('*')
          .eq('user_id', user.id)
          .eq('scene_id', id)
        
        const manualTime = Date.now() - manualStartTime
        if (manualError) {
          console.error('🎬 TIMELINE-SCENE - Manual scene assets fetch error:', manualError)
        } else {
          console.log('🎬 TIMELINE-SCENE - Manual scene assets fetch completed:', { 
            count: manualSceneAssets?.length, 
            fetchTimeMs: manualTime 
          })
        }
        
        // Approach 3: Check if there are any assets with null scene_id
        const { data: nullSceneAssets, error: nullSceneError } = await supabase
          .from('assets')
          .select('*')
          .eq('user_id', user.id)
          .is('scene_id', null)
        
        console.log('🎬 TIMELINE-SCENE - Assets with null scene_id:', { 
          count: nullSceneAssets?.length, 
          error: nullSceneError 
        })
        
        if (mounted) {
          console.log('🎬 TIMELINE-SCENE - Setting assets state...')
          setAssets(fetchedAssets)
        }
      } catch (error) {
        console.error('🎬 TIMELINE-SCENE - Error fetching assets:', error)
        if (mounted) {
          toast({
            title: "Error fetching assets",
            description: "Failed to load scene assets.",
            variant: "destructive",
          })
        }
      } finally {
        if (mounted) {
          console.log('🎬 TIMELINE-SCENE - Setting assets loading state to false')
          setAssetsLoading(false)
        }
      }
    }

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (mounted && assetsLoading) {
        console.warn('🎬 TIMELINE-SCENE - Assets safety timeout triggered, forcing loading to false')
        setAssetsLoading(false)
      }
    }, 10000) // 10 second timeout

    fetchAssets()

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
    }
  }, [id, user?.id]) // Removed toast dependency to prevent infinite loops

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
    if (!id) return
    
    try {
      setAssetsLoading(true)
      const fetchedAssets = await AssetService.getAssetsForScene(id)
      setAssets(fetchedAssets)
      toast({
        title: "Assets Refreshed",
        description: "Scene assets have been updated.",
      })
    } catch (error) {
      console.error('🎬 TIMELINE-SCENE - Error refreshing assets:', error)
      toast({
        title: "Error refreshing assets",
        description: "Failed to refresh scene assets.",
        variant: "destructive",
      })
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

  if (loading) {
    console.log('🎬 TIMELINE-SCENE - Showing loading state:', { loading, hasScene: !!scene, userId: user?.id, sceneId: id })
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">Loading scene data...</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Debug Info:</p>
            <p>• Loading: {loading.toString()}</p>
            <p>• Has Scene: {!!scene ? 'Yes' : 'No'}</p>
            <p>• User ID: {user?.id || 'None'}</p>
            <p>• Scene ID: {id}</p>
            <p>• Auth Loading: {authLoading.toString()}</p>
            <p>• Assets Loading: {assetsLoading.toString()}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!scene) {
    console.log('🎬 TIMELINE-SCENE - Scene not found, showing error state')
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-destructive mb-4">
            <h1 className="text-2xl font-bold mb-2">Scene Not Found</h1>
            <p className="text-muted-foreground">The scene you're looking for doesn't exist or you don't have access to it.</p>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 mb-4">
            <p>Debug Info:</p>
            <p>• Scene ID: {id}</p>
            <p>• User ID: {user?.id || 'None'}</p>
            <p>• Loading: {loading.toString()}</p>
            <p>• Auth Loading: {authLoading.toString()}</p>
          </div>
          <Button asChild>
            <Link href="/timeline">Back to Timeline</Link>
          </Button>
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

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/timeline">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Timeline
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-primary">
                Scene: {scene.name}
              </h1>
              <p className="text-muted-foreground mt-1">{scene.description}</p>
            </div>
          </div>
          <div className="flex gap-3">
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
        </div>

        {/* Debug Info Panel */}
        <div className="mb-6 p-4 bg-muted/20 border border-border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Debug Information</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log('🎬 TIMELINE-SCENE - Debug panel refresh clicked')
                console.log('🎬 TIMELINE-SCENE - Current state:', {
                  user: user ? { id: user.id, email: user.email } : null,
                  scene: scene ? { id: scene.id, name: scene.name } : null,
                  assets: assets.length,
                  loading,
                  assetsLoading,
                  authLoading,
                  projectId
                })
              }}
              className="text-xs"
            >
              Refresh Debug
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground">User ID:</p>
              <p className="font-mono">{user?.id || 'None'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Scene ID:</p>
              <p className="font-mono">{id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Project ID:</p>
              <p className="font-mono">{projectId || 'None'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Assets Count:</p>
              <p className="font-mono">{assets.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Loading:</p>
              <p className="font-mono">{loading.toString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Assets Loading:</p>
              <p className="font-mono">{assetsLoading.toString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Auth Loading:</p>
              <p className="font-mono">{authLoading.toString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Timestamp:</p>
              <p className="font-mono">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border-primary/20">
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

            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-primary">Scene Scripts</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Read scripts aloud with speech synthesis • Toggle between versions • Generate new content
                </p>
              </div>
              <div className="flex gap-2">

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
                       <div className="flex space-x-1">
                         {scriptAssets.map((script) => (
                           <button
                             key={script.id}
                             onClick={() => {
                               console.log('🎬 TIMELINE-SCENE - Clicking version:', script.version, 'ID:', script.id)
                               setActiveScriptId(script.id)
                             }}
                             className={`px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 ${
                               activeScriptId === script.id
                                 ? 'text-green-400 border-green-400 bg-green-500/10'
                                 : 'text-green-400/60 border-transparent hover:text-green-400 hover:border-green-400/40'
                             }`}
                           >
                             {script.version_name || `Version ${script.version}`}
                             {script.is_latest_version && (
                               <span className="ml-1 text-xs text-green-300">★</span>
                             )}
                           </button>
                         ))}
                       </div>
                     </div>
                    
                                         {/* Original content */}
                     <Card className="bg-card border-primary/20">
                       <CardHeader>
                         <div className="flex items-start justify-between">
                           <div className="flex-1">
                             <div className="flex items-center gap-3 mb-2">
                               <h4 className="text-xl font-bold text-primary">{(() => {
                                 const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                 return activeScript.title
                               })()}</h4>
                               <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                                 {(() => {
                                   const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                                   return activeScript.version_name || `v${activeScript.version}`
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
                           </div>
                         </div>
                       </CardHeader>
                       <CardContent>
                         <div className="bg-muted/20 p-4 rounded-lg border border-border mb-4">
                           <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                             {(() => {
                               const activeScript = scriptAssets.find(s => s.id === activeScriptId) || scriptAssets[0]
                               return activeScript.content || 'No content available'
                             })()}
                           </pre>
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
                               return activeScript.title || 'Script'
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
                                <h4 className="text-xl font-bold text-primary">{selectedVersion.title}</h4>
                                <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                                  {selectedVersion.version_name || `v${selectedVersion.version}`}
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
                                       {version.version_name || `Version ${version.version}`}
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
                                    content: selectedVersion.content || ''
                                  })
                                  setShowVersionEdit(true)
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-muted/20 p-4 rounded-lg border border-border mb-4">
                            <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                              {selectedVersion.content || 'No content available'}
                            </pre>
                          </div>
                          
                          {/* Text to Speech Component */}
                          <div data-tts-component>
                            <TextToSpeech 
                              text={selectedVersion.content || ''}
                              title={selectedVersion.title || 'Script'}
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
                  <Button
                    onClick={() => router.push('/ai-studio')}
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Generate Your First Script
                  </Button>
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
                            alt={image.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <h4 className="font-medium text-foreground mb-1">{image.title}</h4>
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
                                      <h4 className="text-xl font-bold text-green-400">{latestVersion.title}</h4>
                                      {/* BIG VERSION LABEL */}
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                                          {latestVersion.version_name || `v${latestVersion.version}`}
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
                                              title={`Version ${version.version} - ${new Date(version.created_at).toLocaleDateString()}`}
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
                                          content: latestVersion.content || ''
                                        })
                                        setShowVersionEdit(true)
                                      }}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
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
                                          title={latestVersion.title || 'Script'}
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
                                        alt={latestVersion.title}
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
                              {version.version_name || `v${version.version}`}
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
                        <h4 className="text-lg font-semibold text-green-400">{version.title}</h4>
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
                                title={version.title || 'Script'}
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
                              alt={version.title}
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
                      {editingVersion.version_name || `v${editingVersion.version}`}
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
                        <textarea
                          id="edit-content"
                          value={versionEditForm.content}
                          onChange={(e) => setVersionEditForm(prev => ({
                            ...prev,
                            content: e.target.value
                          }))}
                          placeholder="Edit your script content here..."
                          className="mt-1 w-full h-64 p-3 border border-border rounded-md bg-background text-foreground resize-none font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Make changes to your script content. This will create a new version.
                        </p>
                      </div>
                      
                      {/* Text to Speech Component for Script Editing */}
                      <div data-tts-component>
                        <TextToSpeech 
                          text={versionEditForm.content || ''}
                          title={editingVersion.title || 'Script'}
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





      </div>
    </div>
  )
}
