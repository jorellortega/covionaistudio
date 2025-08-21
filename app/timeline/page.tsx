"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Play,
  Edit,
  Trash2,
  Clock,
  MapPin,
  Users,
  Camera,
  Save,
  ArrowLeft,
  Sparkles,
  FolderOpen,
  Loader2,
  ImageIcon,
} from "lucide-react"
import Link from "next/link"
import { TimelineService, type SceneWithMetadata, type CreateSceneData } from "@/lib/timeline-service"
import { useToast } from "@/hooks/use-toast"

const statusColors = {
  Planning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "In Progress": "bg-blue-500/20 text-blue-500 border-blue-500/30",
  Completed: "bg-green-500/20 text-green-400 border-green-500/30",
  "On Hold": "bg-red-500/20 text-red-400 border-red-500/30",
}

const moodColors = {
  Mysterious: "bg-purple-500/20 text-purple-400",
  Tense: "bg-red-500/20 text-red-400",
  Suspenseful: "bg-orange-500/20 text-orange-400",
  Energetic: "bg-green-500/20 text-green-400",
  Dramatic: "bg-blue-500/20 text-blue-400",
  Romantic: "bg-pink-500/20 text-pink-400",
}

export default function TimelinePage() {
  const searchParams = useSearchParams()
  const movieId = searchParams.get("movie")
  const [movie, setMovie] = useState<any>(null)
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddSceneOpen, setIsAddSceneOpen] = useState(false)
  const [editingScene, setEditingScene] = useState<SceneWithMetadata | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [viewMode, setViewMode] = useState<"cinema" | "video">("cinema")
  const [currentTimeline, setCurrentTimeline] = useState<any>(null)
  const [newScene, setNewScene] = useState({
    sceneNumber: "",
    title: "",
    description: "",
    location: "",
    duration: "",
    characters: "",
    shotType: "",
    mood: "",
    notes: "",
    status: "Planning",
  })
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null)
  const [isImageUploadOpen, setIsImageUploadOpen] = useState(false)
  const [selectedSceneForUpload, setSelectedSceneForUpload] = useState<SceneWithMetadata | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (movieId) {
      loadMovieAndScenes()
    } else {
      setLoading(false)
    }
  }, [movieId])

  const loadMovieAndScenes = async () => {
    if (!movieId) return

    try {
      setLoading(true)
      
      // Load movie details
      const movieData = await TimelineService.getMovieById(movieId)
      if (!movieData) {
        toast({
          title: "Error",
          description: "Movie not found.",
          variant: "destructive",
        })
        return
      }
      setMovie(movieData)
      console.log('Loaded movie:', movieData)

      // Check for duplicate timelines and clean them up automatically
      try {
        const cleanupResult = await TimelineService.cleanupDuplicateTimelines(movieId)
        if (cleanupResult.success && cleanupResult.message !== 'No cleanup needed') {
          console.log('Auto-cleanup completed:', cleanupResult.message)
          toast({
            title: "Timeline Cleanup",
            description: cleanupResult.message,
          })
        }
      } catch (cleanupError) {
        console.warn('Auto-cleanup failed, continuing with normal load:', cleanupError)
      }

      // Get or create timeline for the movie
      let timeline = await TimelineService.getTimelineForMovie(movieId)
      if (!timeline) {
        console.log('No timeline found, creating new one for movie:', movieId)
        timeline = await TimelineService.createTimelineForMovie(movieId, {
          name: 'Main Timeline',
          description: 'Primary timeline for movie scenes',
          duration_seconds: 0,
          fps: 24,
          resolution_width: 1920,
          resolution_height: 1080,
        })
        console.log('Created new timeline:', timeline.id)
      } else {
        console.log('Found existing timeline:', timeline.id)
      }
      
      setCurrentTimeline(timeline)

      // Load scenes for the timeline
      const scenesData = await TimelineService.getScenesForTimeline(timeline.id)
      console.log('Loaded scenes:', scenesData)
      setScenes(scenesData)
    } catch (error) {
      console.error('Error loading movie and scenes:', error)
      toast({
        title: "Error",
        description: "Failed to load movie and scenes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddScene = async () => {
    if (!movieId || !newScene.title.trim() || !currentTimeline) {
      toast({
        title: "Error",
        description: "Scene title is required and timeline must be available.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsCreating(true)
      console.log('Creating scene for movie:', movieId, 'in timeline:', currentTimeline.id)
      
      // Use the current timeline instead of fetching/creating a new one
      const timeline = currentTimeline

      // Parse duration to seconds
      const durationParts = newScene.duration.split(':').map(Number)
      const durationSeconds = durationParts.length === 2 
        ? durationParts[0] * 60 + durationParts[1]
        : 0

      // Calculate start time (after the last scene)
      const lastScene = scenes[scenes.length - 1]
      const startTimeSeconds = lastScene 
        ? lastScene.start_time_seconds + lastScene.duration_seconds
        : 0

      // Create scene data
      const sceneData: CreateSceneData = {
        timeline_id: timeline.id,
        name: newScene.title,
        description: newScene.description,
        start_time_seconds: startTimeSeconds,
        duration_seconds: durationSeconds,
        scene_type: 'video',
        content_url: '',
        metadata: {
          sceneNumber: newScene.sceneNumber,
          location: newScene.location,
          characters: newScene.characters.split(',').map(c => c.trim()).filter(Boolean),
          shotType: newScene.shotType,
          mood: newScene.mood,
          notes: newScene.notes,
          status: newScene.status,
        }
      }

      console.log('Creating scene with data:', sceneData)
      const createdScene = await TimelineService.createScene(sceneData)
      console.log('Scene created:', createdScene)
      
      // Add the new scene to the list
      const newSceneWithMetadata = {
        ...createdScene,
        metadata: sceneData.metadata
      }
      console.log('Adding scene to list:', newSceneWithMetadata)
      setScenes([...scenes, newSceneWithMetadata])

      // Refresh scenes from the database to ensure consistency
      await refreshScenes()

      setIsAddSceneOpen(false)
      setNewScene({
        sceneNumber: "",
        title: "",
        description: "",
        location: "",
        duration: "",
        characters: "",
        shotType: "",
        mood: "",
        notes: "",
        status: "Planning",
      })

      toast({
        title: "Success",
        description: "Scene created successfully!",
      })
    } catch (error) {
      console.error('Error creating scene:', error)
      toast({
        title: "Error",
        description: "Failed to create scene. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const refreshScenes = async () => {
    if (!currentTimeline) return
    
    try {
      const scenesData = await TimelineService.getScenesForTimeline(currentTimeline.id)
      console.log('Refreshed scenes:', scenesData)
      setScenes(scenesData)
    } catch (error) {
      console.error('Error refreshing scenes:', error)
    }
  }

  const handleEditScene = (scene: SceneWithMetadata) => {
    console.log('Editing scene:', scene)
    setEditingScene(scene)
    setNewScene({
      sceneNumber: scene.metadata.sceneNumber || "",
      title: scene.name,
      description: scene.description || "",
      location: scene.metadata.location || "",
      duration: formatDuration(scene.duration_seconds),
      characters: (scene.metadata.characters || []).join(", "),
      shotType: scene.metadata.shotType || "",
      mood: scene.metadata.mood || "",
      notes: scene.metadata.notes || "",
      status: scene.metadata.status || "Planning",
    })
    // Open the dialog when editing
    setIsAddSceneOpen(true)
  }

  const handleUpdateScene = async () => {
    if (!editingScene) return

    try {
      setIsCreating(true)
      
      // Parse duration to seconds
      const durationParts = newScene.duration.split(':').map(Number)
      const durationSeconds = durationParts.length === 2 
        ? durationParts[0] * 60 + durationParts[1]
        : 0

      // Update scene data
      const updates: Partial<CreateSceneData> = {
        name: newScene.title,
        description: newScene.description,
        duration_seconds: durationSeconds,
        metadata: {
          sceneNumber: newScene.sceneNumber,
          location: newScene.location,
          characters: newScene.characters.split(',').map(c => c.trim()).filter(Boolean),
          shotType: newScene.shotType,
          mood: newScene.mood,
          notes: newScene.notes,
          status: newScene.status,
        }
      }

      await TimelineService.updateScene(editingScene.id, updates)
      
      // Update the scene in the list
      setScenes(scenes.map(s => 
        s.id === editingScene.id 
          ? { ...s, ...updates, metadata: updates.metadata! }
          : s
      ))

      // Refresh scenes from the database to ensure consistency
      await refreshScenes()

      setEditingScene(null)
      setNewScene({
        sceneNumber: "",
        title: "",
        description: "",
        location: "",
        duration: "",
        characters: "",
        shotType: "",
        mood: "",
        notes: "",
        status: "Planning",
      })

      toast({
        title: "Success",
        description: "Scene updated successfully!",
      })
    } catch (error) {
      console.error('Error updating scene:', error)
      toast({
        title: "Error",
        description: "Failed to update scene. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm('Are you sure you want to delete this scene? This action cannot be undone.')) {
      return
    }

    try {
      await TimelineService.deleteScene(sceneId)
      setScenes(scenes.filter(s => s.id !== sceneId))
      
      // Refresh scenes from the database to ensure consistency
      await refreshScenes()
      
      toast({
        title: "Success",
        description: "Scene deleted successfully!",
      })
    } catch (error) {
      console.error('Error deleting scene:', error)
      toast({
        title: "Error",
        description: "Failed to delete scene. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleGenerateWithAI = (sceneId?: string) => {
    const scene = scenes.find((s) => s.id === sceneId)
    const aiPrompt = scene
      ? `Generate content for scene "${scene.name}": ${scene.description}`
      : "Generate new scene content"

    // Navigate to AI Studio with context
    window.open(`/ai-studio?project=${movieId}&prompt=${encodeURIComponent(aiPrompt)}`, "_blank")
  }

  const handleViewAssets = (sceneId?: string) => {
    const scene = scenes.find((s) => s.id === sceneId)
    const searchQuery = scene ? scene.name : movie?.name

    // Navigate to assets with context
    window.open(`/assets?project=${movie?.name}&search=${encodeURIComponent(searchQuery || "")}`, "_blank")
  }

  const handleUploadImage = (scene: SceneWithMetadata) => {
    setSelectedSceneForUpload(scene)
    setIsImageUploadOpen(true)
  }

  const handleImageUpload = async (file: File) => {
    if (!selectedSceneForUpload || !movieId) return
    
    setIsUploadingImage(true)
    setUploadingSceneId(selectedSceneForUpload.id)
    
    try {
      // Upload file to Supabase storage
      const { supabase } = await import('@/lib/supabase')
      
      // Create the file path: userId/movieId/sceneId/filename
      const filePath = `${movieId}/${selectedSceneForUpload.id}/${Date.now()}_${file.name}`
      
      console.log('Uploading to path:', filePath)
      
      const { data, error } = await supabase.storage
        .from('cinema_files')
        .upload(filePath, file)
      
      if (error) {
        throw new Error(`Upload failed: ${error.message}`)
      }
      
      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('cinema_files')
        .getPublicUrl(filePath)
      
      console.log('File uploaded successfully, public URL:', publicUrl)
      
      // Update the scene metadata with the new thumbnail URL
      await TimelineService.updateScene(selectedSceneForUpload.id, {
        metadata: { 
          ...selectedSceneForUpload.metadata, 
          thumbnail: publicUrl 
        }
      })
      
      toast({
        title: "Image Uploaded",
        description: "Scene thumbnail has been updated successfully.",
      })
      
      await refreshScenes()
    } catch (error) {
      console.error("Failed to upload image:", error)
      toast({
        title: "Upload Failed",
        description: `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsUploadingImage(false)
      setUploadingSceneId(null)
      setIsImageUploadOpen(false)
      setSelectedSceneForUpload(null)
    }
  }

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const totalDuration = scenes.reduce((total, scene) => total + scene.duration_seconds, 0)

  const formatTotalDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Loading timeline...</span>
          </div>
        </main>
      </div>
    )
  }

  if (!movieId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="text-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No movie selected</h3>
            <p className="text-muted-foreground mb-4">Please select a movie to view its timeline</p>
            <Link href="/movies">
              <Button className="gradient-button text-white">
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to Movies
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="text-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Movie not found</h3>
            <p className="text-muted-foreground mb-4">The movie you're looking for doesn't exist or you don't have access to it</p>
            <Link href="/movies">
              <Button className="gradient-button text-white">
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to Movies
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/movies">
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                {movie.name} - Timeline
              </h1>
              <p className="text-muted-foreground">Organize and manage your film scenes</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href={`/ai-studio?project=${movieId}`}>
              <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
                <Sparkles className="mr-2 h-4 w-4" />
                AI Studio
              </Button>
            </Link>

            <Link href={`/assets?project=${movie.name}`}>
              <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
                <FolderOpen className="mr-2 h-4 w-4" />
                Assets
              </Button>
            </Link>

            <Button 
              variant="outline" 
              onClick={async () => {
                try {
                  const debug = await TimelineService.debugMovieScenes(movieId!)
                  console.log('Debug info:', debug)
                  toast({
                    title: "Debug Info",
                    description: `Movie: ${debug.movie?.name}, Timeline: ${debug.timeline?.id}, Scenes: ${debug.scenes.length}`,
                  })
                } catch (error) {
                  console.error('Debug error:', error)
                  toast({
                    title: "Debug Error",
                    description: "Check console for details",
                    variant: "destructive",
                  })
                }
              }}
              className="border-border bg-transparent hover:bg-muted"
            >
              🐛 Debug
            </Button>

            <Button 
              variant="outline" 
              onClick={refreshScenes}
              className="border-border bg-transparent hover:bg-muted"
            >
              🔄 Refresh
            </Button>

            <Button 
              variant="outline" 
              onClick={async () => {
                try {
                  const result = await TimelineService.testDatabaseAccess()
                  console.log('Database access test result:', result)
                  toast({
                    title: result.success ? "Database Access OK" : "Database Access Failed",
                    description: result.success ? result.message : result.error,
                    variant: result.success ? "default" : "destructive",
                  })
                } catch (error) {
                  console.error('Database access test error:', error)
                  toast({
                    title: "Database Access Test Error",
                    description: "Check console for details",
                    variant: "destructive",
                  })
                }
              }}
              className="border-border bg-transparent hover:bg-muted"
            >
              🧪 Test DB
            </Button>

            <Button 
              variant="outline" 
              onClick={async () => {
                if (!movieId) {
                  toast({
                    title: "Error",
                    description: "No movie selected",
                    variant: "destructive",
                  })
                  return
                }
                
                try {
                  const result = await TimelineService.cleanupDuplicateTimelines(movieId)
                  console.log('Timeline cleanup result:', result)
                  
                  if (result.success) {
                    toast({
                      title: "Timeline Cleanup Complete",
                      description: result.message,
                    })
                    
                    // Refresh the page to show the consolidated timeline
                    await loadMovieAndScenes()
                  } else {
                    toast({
                      title: "Timeline Cleanup Failed",
                      description: result.error,
                      variant: "destructive",
                    })
                  }
                } catch (error) {
                  console.error('Timeline cleanup error:', error)
                  toast({
                    title: "Timeline Cleanup Error",
                    description: "Check console for details",
                    variant: "destructive",
                  })
                }
              }}
              className="border-border bg-transparent hover:bg-muted"
            >
              🧹 Cleanup
            </Button>

            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "cinema" | "video")} className="w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cinema" className="text-xs">Cinema</TabsTrigger>
                <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button className="gradient-button neon-glow text-white">
              <Save className="mr-2 h-4 w-4" />
              Save Timeline
            </Button>
          </div>
        </div>

        {/* Movie Info & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="cinema-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Movie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-blue-500">{movie.name}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Scenes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{scenes.length}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatTotalDuration(totalDuration)}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">
                {scenes.length > 0 
                  ? Math.round((scenes.filter((s) => s.metadata.status === "Completed").length / scenes.length) * 100)
                  : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add Scene Button */}
        <div className="flex justify-center mb-8">
          <Dialog 
            open={isAddSceneOpen} 
            onOpenChange={(open) => {
              console.log('Dialog open state changed:', open)
              setIsAddSceneOpen(open)
              if (!open) {
                // Reset editing state when dialog closes
                setEditingScene(null)
                setNewScene({
                  sceneNumber: "",
                  title: "",
                  description: "",
                  location: "",
                  duration: "",
                  characters: "",
                  shotType: "",
                  mood: "",
                  notes: "",
                  status: "Planning",
                })
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gradient-button neon-glow text-white">
                <Plus className="mr-2 h-5 w-5" />
                Add Scene
              </Button>
            </DialogTrigger>
            <DialogContent className="cinema-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingScene ? `Edit Scene: ${editingScene.name}` : "Add New Scene"}
                </DialogTitle>
                <DialogDescription>
                  {editingScene ? "Update scene details" : "Create a new scene for your timeline"}
                </DialogDescription>
              </DialogHeader>
              
              {/* Debug info */}
              {editingScene && (
                <div className="mb-4 p-2 bg-blue-500/10 rounded text-xs text-blue-600">
                  Debug: Editing scene {editingScene.id} - {editingScene.name}
                </div>
              )}

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sceneNumber">Scene Number</Label>
                    <Input
                      id="sceneNumber"
                      value={newScene.sceneNumber || ""}
                      onChange={(e) => setNewScene({ ...newScene, sceneNumber: e.target.value })}
                      placeholder="e.g., 1A, 2B..."
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Input
                      id="duration"
                      value={newScene.duration}
                      onChange={(e) => setNewScene({ ...newScene, duration: e.target.value })}
                      placeholder="e.g., 2:30"
                      className="bg-input border-border"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">Scene Title</Label>
                  <Input
                    id="title"
                    value={newScene.title}
                    onChange={(e) => setNewScene({ ...newScene, title: e.target.value })}
                    placeholder="Enter scene title..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newScene.description}
                    onChange={(e) => setNewScene({ ...newScene, description: e.target.value })}
                    placeholder="Describe what happens in this scene..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={newScene.location || ""}
                      onChange={(e) => setNewScene({ ...newScene, location: e.target.value })}
                      placeholder="Scene location..."
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shotType">Shot Type</Label>
                    <Select
                      value={newScene.shotType || ""}
                      onValueChange={(value) => setNewScene({ ...newScene, shotType: value })}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select shot type" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="Wide Shot">Wide Shot</SelectItem>
                        <SelectItem value="Medium Shot">Medium Shot</SelectItem>
                        <SelectItem value="Close-up">Close-up</SelectItem>
                        <SelectItem value="Extreme Close-up">Extreme Close-up</SelectItem>
                        <SelectItem value="Montage">Montage</SelectItem>
                        <SelectItem value="Tracking Shot">Tracking Shot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="mood">Mood</Label>
                    <Select value={newScene.mood || ""} onValueChange={(value) => setNewScene({ ...newScene, mood: value })}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select mood" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="Mysterious">Mysterious</SelectItem>
                        <SelectItem value="Tense">Tense</SelectItem>
                        <SelectItem value="Suspenseful">Suspenseful</SelectItem>
                        <SelectItem value="Energetic">Energetic</SelectItem>
                        <SelectItem value="Dramatic">Dramatic</SelectItem>
                        <SelectItem value="Romantic">Romantic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newScene.status || "Planning"}
                      onValueChange={(value) => setNewScene({ ...newScene, status: value })}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="Planning">Planning</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="characters">Characters</Label>
                  <Input
                    id="characters"
                    value={newScene.characters || ""}
                    onChange={(e) => setNewScene({ ...newScene, characters: e.target.value })}
                    placeholder="Character names separated by commas..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Director Notes</Label>
                  <Textarea
                    id="notes"
                    value={newScene.notes || ""}
                    onChange={(e) => setNewScene({ ...newScene, notes: e.target.value })}
                    placeholder="Additional notes and directions..."
                    className="bg-input border-border"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddSceneOpen(false)
                    setEditingScene(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingScene ? handleUpdateScene : handleAddScene}
                  disabled={isCreating}
                  className="gradient-button text-white"
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {editingScene ? "Update Scene" : "Add Scene"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Timeline */}
        <Tabs value={viewMode} className="w-full">
          <TabsContent value="cinema" className="mt-0">
            <div className="relative mt-8">
              <div className="relative w-full mx-auto">
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-cyan-500/30"></div>

                <div className="space-y-2">
                  {scenes.map((scene, index) => (
                <div key={scene.id} className="relative">
                  <div className="absolute left-1/2 -translate-x-1/2 top-4 h-4 w-4 rounded-full bg-cyan-500 glow z-10 flex items-center justify-center">
                    <span className="text-xs font-bold text-black">{scene.metadata.sceneNumber || index + 1}</span>
                  </div>

                  <div
                    className={`absolute left-1/2 top-6 h-0.5 w-1/2 bg-cyan-500/30 ${
                      index % 2 === 0 ? "-translate-x-full" : ""
                    }`}
                  />

                  <div className={`relative w-full flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <div className={`${index % 2 === 0 ? "mr-8" : "ml-8"} w-[calc(40%-3rem)]`}>
                      <Link href={`/timeline-scene/${scene.id}`}>
                        <Card className="cinema-card hover:neon-glow transition-all duration-300 backdrop-blur-sm group hover:border-cyan-400 cursor-pointer overflow-hidden">
                          <CardHeader className="p-0">
                            <div className="flex h-full min-h-[256px]">
                              {/* Content Section - Left Side */}
                              <div className="flex-1 p-6 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <CardTitle className="text-lg">{scene.name}</CardTitle>
                                  <Badge
                                    className={`text-xs ${statusColors[scene.metadata.status as keyof typeof statusColors] || statusColors.Planning}`}
                                  >
                                    {scene.metadata.status || "Planning"}
                                  </Badge>
                                  {scene.metadata.mood && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${moodColors[scene.metadata.mood as keyof typeof moodColors]}`}
                                    >
                                      {scene.metadata.mood}
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-sm mb-3">{scene.description}</CardDescription>

                                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{scene.metadata.location || "No location"}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{formatDuration(scene.duration_seconds)}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Camera className="h-3 w-3" />
                                    <span>{scene.metadata.shotType || "No shot type"}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    <span>{(scene.metadata.characters || []).length} chars</span>
                                  </div>
                                </div>

                                {(scene.metadata.characters || []).length > 0 && (
                                  <div className="mb-2">
                                    <div className="flex flex-wrap gap-1">
                                      {scene.metadata.characters!.slice(0, 3).map((character: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {character}
                                        </Badge>
                                      ))}
                                      {scene.metadata.characters!.length > 3 && (
                                        <Badge variant="secondary" className="text-xs">
                                          +{scene.metadata.characters!.length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {scene.metadata.notes && (
                                  <div className="mb-2 p-2 bg-muted/30 rounded text-xs">
                                    <p className="text-muted-foreground">Notes: {scene.metadata.notes}</p>
                                  </div>
                                )}

                                <div className="flex items-center gap-1 pt-2 border-t border-border/50">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleGenerateWithAI(scene.id)
                                    }}
                                    className="text-xs h-6 px-2 bg-transparent hover:bg-blue-500/10 hover:text-blue-500"
                                  >
                                    <Sparkles className="mr-1 h-2 w-2" />
                                    AI
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleViewAssets(scene.id)
                                    }}
                                    className="text-xs h-6 px-2 bg-transparent hover:bg-cyan-500/10 hover:text-cyan-500"
                                  >
                                    <FolderOpen className="mr-1 h-2 w-2" />
                                    Assets
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      console.log('Edit button clicked for scene:', scene)
                                      handleEditScene(scene)
                                    }}
                                    className="h-6 w-6 hover:bg-blue-500/10 hover:text-blue-500 ml-auto"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleDeleteScene(scene.id)
                                    }}
                                    className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="w-40 h-64 relative bg-muted/20 border-l border-border/30 flex-shrink-0 overflow-hidden">
                                <img
                                  src={scene.metadata.thumbnail || `/abstract-geometric-scene.png?key=jchhr&height=288&width=192&query=Scene ${scene.metadata.sceneNumber || index + 1}: ${scene.name} - ${scene.description}`}
                                  alt={`Scene ${scene.metadata.sceneNumber || index + 1} thumbnail`}
                                  className="w-full h-full object-contain rounded-r-lg"
                                />
                                {/* Scene number overlay */}
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                  {scene.metadata.sceneNumber || index + 1}
                                </div>
                                
                                {/* Upload Image Button */}
                                <div className="absolute bottom-2 left-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleUploadImage(scene)
                                    }}
                                    className="h-auto px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-2 border-white text-xs font-medium"
                                  >
                                    <ImageIcon className="h-3 w-3 mr-1" />
                                    UPLOAD
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      </Link>
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            <div className="relative mt-8">
              <div className="relative w-full mx-auto">
                <div className="space-y-4">
                  {scenes.map((scene, index) => (
                    <div key={scene.id} className="relative">
                      <Card className="cinema-card hover:neon-glow transition-all duration-300">
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-500/10">
                                <Play className="h-5 w-5 text-blue-500" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{scene.name}</CardTitle>
                                <CardDescription className="text-sm">{scene.description}</CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${statusColors[scene.metadata.status as keyof typeof statusColors] || statusColors.Planning}`}>
                                {scene.metadata.status || "Planning"}
                              </Badge>
                              {scene.metadata.mood && (
                                <Badge variant="outline" className={`text-xs ${moodColors[scene.metadata.mood as keyof typeof moodColors]}`}>
                                  {scene.metadata.mood}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{scene.metadata.location || "No location"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{formatDuration(scene.duration_seconds)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Camera className="h-4 w-4" />
                              <span>{scene.metadata.shotType || "No shot type"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>{(scene.metadata.characters || []).length} chars</span>
                            </div>
                          </div>
                          
                          {/* Scene Thumbnail with Upload */}
                          <div className="mt-4 flex items-center gap-4">
                            <div className="relative w-24 h-16 bg-muted/20 rounded border border-border/30 overflow-hidden">
                              <img
                                src={scene.metadata.thumbnail || `/abstract-geometric-scene.png?key=jchhr&height=96&width=96&query=Scene ${scene.metadata.sceneNumber || index + 1}: ${scene.name}`}
                                alt={`Scene ${scene.metadata.sceneNumber || index + 1} thumbnail`}
                                className="w-full h-full object-cover"
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleUploadImage(scene)}
                                className="absolute inset-0 h-full w-full bg-blue-600/80 hover:bg-blue-700/90 text-white flex items-center justify-center text-xs font-medium"
                              >
                                <ImageIcon className="h-3 w-3 mr-1" />
                                UPLOAD
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleGenerateWithAI(scene.id)}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                AI
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleViewAssets(scene.id)}>
                                <FolderOpen className="mr-2 h-4 w-4" />
                                Assets
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleEditScene(scene)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteScene(scene.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Empty State */}
        {scenes.length === 0 && (
          <div className="text-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scenes yet</h3>
            <p className="text-muted-foreground mb-4">Start building your movie timeline by adding your first scene</p>
            <Button onClick={() => setIsAddSceneOpen(true)} className="gradient-button text-white">
              <Plus className="mr-2 h-5 w-5" />
              Add First Scene
            </Button>
          </div>
        )}

        {/* Image Upload Dialog */}
        <Dialog open={isImageUploadOpen} onOpenChange={setIsImageUploadOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Scene Thumbnail</DialogTitle>
              <DialogDescription>
                Upload an image to replace the placeholder for "{selectedSceneForUpload?.name}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                  </div>
                  <input
                    id="image-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleImageUpload(file)
                      }
                    }}
                    disabled={isUploadingImage}
                  />
                </label>
              </div>
              
              {isUploadingImage && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading image...
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsImageUploadOpen(false)}
                disabled={isUploadingImage}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
