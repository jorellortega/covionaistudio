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
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useParams } from "next/navigation"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function ScenePage() {
  const params = useParams()
  const id = params.id as string

  return <ScenePageClient id={id} />
}

function ScenePageClient({ id }: { id: string }) {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()

  // State variables
  const [activeTab, setActiveTab] = useState("overview")
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

  // Effect to fetch scene data
  useEffect(() => {
    const fetchSceneData = async () => {
      if (!id || !user?.id) return
      
      try {
        setLoading(true)
        const scene = await TimelineService.getSceneById(id)
        setScene(scene)
      } catch (error) {
        console.error('Error fetching scene:', error)
        toast({
          title: "Error",
          description: "Failed to load scene data.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSceneData()
  }, [id, user?.id, toast])

  // Effect to fetch assets
  useEffect(() => {
    const fetchAssets = async () => {
      if (!id || !user?.id) return
      
      try {
        setAssetsLoading(true)
        console.log('Fetching assets for scene:', id)
        console.log('Current user:', user.id)
        
        // First, let's check the database schema
        const { data: schemaCheck, error: schemaError } = await supabase
          .from('assets')
          .select('*')
          .limit(1)
        
        if (schemaError) {
          console.error('Schema check error:', schemaError)
        } else {
          console.log('Database schema check - Sample asset:', schemaCheck?.[0])
          console.log('Available columns:', schemaCheck?.[0] ? Object.keys(schemaCheck[0]) : 'No data')
        }
        
        // First, let's check if there are any assets at all for this user
        const { data: allAssets, error: allAssetsError } = await supabase
          .from('assets')
          .select('*')
          .eq('user_id', user.id)
        
        if (allAssetsError) {
          console.error('Error fetching all assets:', allAssetsError)
        } else {
          console.log('All assets for user:', allAssets)
          allAssets?.forEach((asset, index) => {
            console.log(`Asset ${index + 1}:`, {
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
        const fetchedAssets = await AssetService.getAssetsForScene(id)
        console.log('Fetched assets for scene:', fetchedAssets)
        
        // Also check manually for assets linked to this scene
        const { data: manualSceneAssets, error: manualError } = await supabase
          .from('assets')
          .select('*')
          .eq('user_id', user.id)
          .eq('scene_id', id)
        
        if (manualError) {
          console.error('Manual scene assets fetch error:', manualError)
        } else {
          console.log('Manual scene assets fetch:', manualSceneAssets)
        }
        
        setAssets(fetchedAssets)
      } catch (error) {
        console.error('Error fetching assets:', error)
        toast({
          title: "Error fetching assets",
          description: "Failed to load scene assets.",
          variant: "destructive",
        })
      } finally {
        setAssetsLoading(false)
      }
    }
    fetchAssets()
  }, [id, toast, user])

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
      console.error('Error refreshing assets:', error)
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

  if (loading || !scene) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading scene data...</p>
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

        {/* Debug Info - Remove this after fixing */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="bg-card border-red-500/20 mb-6">
            <CardHeader>
              <CardTitle className="text-red-500">Debug Info (Development Only)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Scene ID:</strong> {id}</div>
                <div><strong>User ID:</strong> {user?.id}</div>
                <div><strong>Assets Count:</strong> {assets.length}</div>
                <div><strong>Assets Loading:</strong> {assetsLoading ? 'Yes' : 'No'}</div>
                <div><strong>All Assets in DB:</strong> Check console for details</div>
                <div><strong>Database Schema Check:</strong> Running...</div>
              </div>
              
              {/* Test Database Button */}
              <Button
                onClick={async () => {
                  try {
                    console.log('=== MANUAL DATABASE TEST ===')
                    
                    // Test 1: Basic query
                    const { data: test1, error: error1 } = await supabase
                      .from('assets')
                      .select('count')
                      .eq('user_id', user?.id)
                    
                    console.log('Test 1 - Count query:', { data: test1, error: error1 })
                    
                    // Test 2: Get one asset
                    const { data: test2, error: error2 } = await supabase
                      .from('assets')
                      .select('*')
                      .eq('user_id', user?.id)
                      .limit(1)
                    
                    console.log('Test 2 - Get one asset:', { data: test2, error: error2 })
                    
                    // Test 3: Check schema
                    if (test2?.[0]) {
                      console.log('Available columns:', Object.keys(test2[0]))
                      console.log('Sample asset data:', test2[0])
                    }
                    
                    // Test 4: Scene-specific query
                    const { data: test3, error: error3 } = await supabase
                      .from('assets')
                      .select('*')
                      .eq('user_id', user?.id)
                      .eq('scene_id', id)
                    
                    console.log('Test 3 - Scene assets:', { data: test3, error: error3 })
                    
                    toast({
                      title: "Database Test Complete",
                      description: "Check console for results",
                    })
                  } catch (error) {
                    console.error('Database test error:', error)
                    toast({
                      title: "Database Test Failed",
                      description: "Check console for error",
                      variant: "destructive",
                    })
                  }
                }}
                className="mt-4 bg-blue-500 hover:bg-blue-600"
                size="sm"
              >
                🔍 Test Database Connection
              </Button>
            </CardContent>
          </Card>
        )}

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
                        console.error('Error linking assets:', error)
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
                    console.error('Error linking assets:', error)
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
              value="overview"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger value="media" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Media
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Notes
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Versions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-primary/20">
                <CardHeader>
                  <CardTitle className="text-primary">Scene Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="text-foreground font-medium">{scene.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-foreground">{scene.description}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Scene Type</Label>
                    <p className="text-foreground">{scene.scene_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Start Time</Label>
                    <p className="text-foreground font-mono">{scene.start_time_seconds}s</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-primary/20">
                <CardHeader>
                  <CardTitle className="text-primary">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Scripts:</span>
                    <span className="text-foreground font-medium">
                      {assets.filter(a => a.content_type === 'script').length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Images:</span>
                    <span className="text-foreground font-medium">
                      {assets.filter(a => a.content_type === 'image').length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Videos:</span>
                    <span className="text-foreground font-medium">
                      {assets.filter(a => a.content_type === 'video').length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Audio:</span>
                    <span className="text-foreground font-medium">
                      {assets.filter(a => a.content_type === 'audio').length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="text-foreground font-medium">{scene.duration_seconds}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Timeline:</span>
                    <span className="text-foreground font-medium">{scene.timeline_id}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-primary">Scene Media</h3>
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                onClick={startAddMedia}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Media
              </Button>
            </div>

            {scene.media && scene.media.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scene.media.map((media) => (
                  <Card key={media.id} className="bg-card border-primary/20">
                    <CardContent className="p-4">
                      <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h4 className="font-medium text-foreground mb-1">{media.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{media.size}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-primary/30 text-primary bg-transparent">
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive bg-transparent"
                        >
                          Delete
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
                  <p className="text-muted-foreground">No media files added to this scene yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-6">
            <Card className="bg-card border-primary/20">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Note Type</Label>
                    <Select value={newNoteType} onValueChange={setNewNoteType}>
                      <SelectTrigger className="bg-card border-primary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-primary/30">
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Director">Director</SelectItem>
                        <SelectItem value="Script">Script</SelectItem>
                        <SelectItem value="Technical">Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Note Content</Label>
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add your note here..."
                      className="bg-card border-primary/30 text-foreground"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddNote}
                      className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Note
                    </Button>
                    <Button variant="outline" onClick={() => setNewNote("")} className="border-muted/30">
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {scene.notes && scene.notes.length > 0 ? (
              <div className="space-y-4">
                {scene.notes.map((note) => (
                  <Card key={note.id} className="bg-card border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge className="bg-primary/20 text-primary border-primary/30">{note.type}</Badge>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-foreground mb-2">{note.content}</p>
                      <p className="text-sm text-muted-foreground">
                        By {note.author} • {new Date(note.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No notes added to this scene yet</p>
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
                                          <Badge variant="outline" className="text-lg px-3 py-1 border-blue-500 text-blue-400 bg-blue-500/10">
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
                                    <div className="bg-muted/50 p-4 rounded-lg border border-border">
                                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                                        {latestVersion.content?.substring(0, 300)}
                                        {latestVersion.content && latestVersion.content.length > 300 && '...'}
                                      </pre>
                                    </div>
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
                          <div className="bg-muted/50 p-4 rounded-lg border border-border max-h-96 overflow-y-auto">
                            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                              {version.content}
                            </pre>
                          </div>
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
                        console.error('Error updating version:', error)
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
