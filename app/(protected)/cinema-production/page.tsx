"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/AuthProvider"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Film, 
  Loader2, 
  Play, 
  Upload, 
  Image as ImageIcon, 
  Video,
  Camera,
  Move,
  Clock,
  X
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieService, type Movie } from "@/lib/movie-service"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
import { ShotListService, type ShotList } from "@/lib/shot-list-service"
import { KlingService } from "@/lib/ai-services"

type VideoModel = 
  | "Kling T2V" 
  | "Kling I2V" 
  | "Kling I2V Extended" 
  | "Runway Gen-4 Turbo" 
  | "Runway Gen-3A Turbo" 
  | "Runway Act-Two" 
  | "Runway Gen-4 Aleph"

interface ShotGenerationState {
  shotId: string
  model: VideoModel | ""
  prompt: string
  duration: string
  resolution: string
  uploadedFile: File | null
  startFrame: File | null
  endFrame: File | null
  filePreview: string | null
  startFramePreview: string | null
  endFramePreview: string | null
  isGenerating: boolean
  generatedVideoUrl: string | null
  generationStatus: string | null
}

export default function CinemaProductionPage() {
  const { session } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { ready, userId } = useAuthReady()
  
  const [projects, setProjects] = useState<Movie[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [selectedStoryboardId, setSelectedStoryboardId] = useState<string>("")
  const [shotLists, setShotLists] = useState<ShotList[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingShots, setLoadingShots] = useState(false)
  
  // Generation state for each shot
  const [shotGenerations, setShotGenerations] = useState<Map<string, ShotGenerationState>>(new Map())

  useEffect(() => {
    if (!session?.user) {
      router.push('/login')
      return
    }

    // Check for project ID in URL params
    const projectParam = searchParams.get("project")
    if (projectParam) {
      setSelectedProjectId(projectParam)
    }

    if (ready && userId) {
      loadProjects()
    }
  }, [session?.user, ready, userId, router, searchParams])

  useEffect(() => {
    if (selectedProjectId && ready) {
      loadStoryboards()
    }
  }, [selectedProjectId, ready])

  useEffect(() => {
    if (selectedStoryboardId && ready) {
      loadShotLists()
    }
  }, [selectedStoryboardId, ready])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const userProjects = await MovieService.getMovies()
      setProjects(userProjects)
    } catch (error) {
      console.error('Error loading projects:', error)
      toast({
        title: "Error",
        description: "Failed to load projects.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStoryboards = async () => {
    if (!selectedProjectId) return
    
    try {
      setLoadingShots(true)
      const projectStoryboards = await StoryboardsService.getStoryboardsByProject(selectedProjectId)
      setStoryboards(projectStoryboards)
      
      // If only one storyboard, auto-select it
      if (projectStoryboards.length === 1) {
        setSelectedStoryboardId(projectStoryboards[0].id)
      }
    } catch (error) {
      console.error('Error loading storyboards:', error)
      toast({
        title: "Error",
        description: "Failed to load storyboards.",
        variant: "destructive"
      })
    } finally {
      setLoadingShots(false)
    }
  }

  const loadShotLists = async () => {
    if (!selectedStoryboardId) return
    
    try {
      setLoadingShots(true)
      const shots = await ShotListService.getShotListsByStoryboard(selectedStoryboardId)
      setShotLists(shots)
      
      // Initialize generation state for each shot
      const newGenerations = new Map<string, ShotGenerationState>()
      shots.forEach(shot => {
        newGenerations.set(shot.id, {
          shotId: shot.id,
          model: "",
          prompt: "",
          duration: "5s",
          resolution: "1280x720",
          uploadedFile: null,
          startFrame: null,
          endFrame: null,
          filePreview: null,
          startFramePreview: null,
          endFramePreview: null,
          isGenerating: false,
          generatedVideoUrl: null,
          generationStatus: null
        })
      })
      setShotGenerations(newGenerations)
    } catch (error) {
      console.error('Error loading shot lists:', error)
      toast({
        title: "Error",
        description: "Failed to load shot lists.",
        variant: "destructive"
      })
    } finally {
      setLoadingShots(false)
    }
  }

  const getModelFileRequirement = (model: VideoModel): 'none' | 'image' | 'video' | 'start-end-frames' => {
    switch (model) {
      case "Kling T2V":
        return 'none'
      case "Kling I2V":
        return 'image'
      case "Kling I2V Extended":
        return 'start-end-frames'
      case "Runway Gen-4 Turbo":
      case "Runway Gen-3A Turbo":
        return 'image'
      case "Runway Act-Two":
      case "Runway Gen-4 Aleph":
        return 'video'
      default:
        return 'none'
    }
  }

  const updateShotGeneration = (shotId: string, updates: Partial<ShotGenerationState>) => {
    setShotGenerations(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(shotId) || {
        shotId,
        model: "",
        prompt: "",
        duration: "5s",
        resolution: "1280x720",
        uploadedFile: null,
        startFrame: null,
        endFrame: null,
        filePreview: null,
        startFramePreview: null,
        endFramePreview: null,
        isGenerating: false,
        generatedVideoUrl: null,
        generationStatus: null
      }
      newMap.set(shotId, { ...current, ...updates })
      return newMap
    })
  }

  const handleFileUpload = (shotId: string, file: File, type: 'file' | 'startFrame' | 'endFrame') => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const preview = e.target?.result as string
      if (type === 'file') {
        updateShotGeneration(shotId, { uploadedFile: file, filePreview: preview })
      } else if (type === 'startFrame') {
        updateShotGeneration(shotId, { startFrame: file, startFramePreview: preview })
      } else if (type === 'endFrame') {
        updateShotGeneration(shotId, { endFrame: file, endFramePreview: preview })
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveFile = (shotId: string, type: 'file' | 'startFrame' | 'endFrame') => {
    if (type === 'file') {
      updateShotGeneration(shotId, { uploadedFile: null, filePreview: null })
    } else if (type === 'startFrame') {
      updateShotGeneration(shotId, { startFrame: null, startFramePreview: null })
    } else if (type === 'endFrame') {
      updateShotGeneration(shotId, { endFrame: null, endFramePreview: null })
    }
  }

  const buildPromptFromShot = (shot: ShotList): string => {
    const parts: string[] = []
    
    if (shot.description) parts.push(shot.description)
    if (shot.action) parts.push(`Action: ${shot.action}`)
    if (shot.visual_notes) parts.push(`Visual: ${shot.visual_notes}`)
    if (shot.camera_notes) parts.push(`Camera: ${shot.camera_notes}`)
    if (shot.lighting_notes) parts.push(`Lighting: ${shot.lighting_notes}`)
    if (shot.location) parts.push(`Location: ${shot.location}`)
    if (shot.time_of_day) parts.push(`Time: ${shot.time_of_day}`)
    
    return parts.join('. ') || `Shot ${shot.shot_number}: ${shot.shot_type} ${shot.camera_angle} ${shot.movement}`
  }

  const handleGenerateVideo = async (shot: ShotList) => {
    const generation = shotGenerations.get(shot.id)
    if (!generation || !generation.model || !generation.prompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a model and enter a prompt.",
        variant: "destructive"
      })
      return
    }

    const fileRequirement = getModelFileRequirement(generation.model)
    
    // Validate file requirements
    if (fileRequirement === 'image' && !generation.uploadedFile) {
      toast({
        title: "Missing Image",
        description: `${generation.model} requires an image to be uploaded.`,
        variant: "destructive"
      })
      return
    }
    
    if (fileRequirement === 'video' && !generation.uploadedFile) {
      toast({
        title: "Missing Video",
        description: `${generation.model} requires a video to be uploaded.`,
        variant: "destructive"
      })
      return
    }
    
    if (fileRequirement === 'start-end-frames' && (!generation.startFrame || !generation.endFrame)) {
      toast({
        title: "Missing Frames",
        description: `${generation.model} requires both start and end frames.`,
        variant: "destructive"
      })
      return
    }

    updateShotGeneration(shot.id, { isGenerating: true, generationStatus: "Starting generation..." })

    try {
      // Handle Kling models
      if (generation.model.startsWith("Kling")) {
        const response = await KlingService.generateVideo({
          prompt: generation.prompt,
          duration: generation.duration,
          model: generation.model,
          file: generation.uploadedFile || undefined,
          startFrame: generation.startFrame || undefined,
          endFrame: generation.endFrame || undefined,
          resolution: generation.resolution,
        })

        if (response.success) {
          const videoUrl = response.data?.video_url || response.data?.url || response.data?.output?.[0]
          updateShotGeneration(shot.id, {
            isGenerating: false,
            generatedVideoUrl: videoUrl || null,
            generationStatus: videoUrl ? "Completed" : "Processing - check back soon"
          })
          toast({
            title: "Success",
            description: videoUrl ? "Video generated successfully!" : "Video generation started. Check back in a few minutes.",
          })
        } else {
          throw new Error(response.error || "Generation failed")
        }
      } else {
        // Handle RunwayML models
        const modelMap: Record<string, string> = {
          "Runway Gen-4 Turbo": "gen4_turbo",
          "Runway Gen-3A Turbo": "gen3a_turbo",
          "Runway Act-Two": "act_two",
          "Runway Gen-4 Aleph": "gen4_aleph"
        }
        
        const formData = new FormData()
        formData.append('prompt', generation.prompt)
        formData.append('duration', generation.duration)
        formData.append('model', modelMap[generation.model] || "gen4_turbo")
        
        const [width, height] = generation.resolution.split('x').map(v => parseInt(v) || 1024)
        formData.append('width', width.toString())
        formData.append('height', height.toString())
        
        if (generation.uploadedFile) {
          formData.append('file', generation.uploadedFile)
        }

        const response = await fetch('/api/ai/generate-video', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (response.ok && result.success) {
          const videoUrl = result.data?.video_url || result.data?.url || result.data?.output?.[0]
          updateShotGeneration(shot.id, {
            isGenerating: false,
            generatedVideoUrl: videoUrl || null,
            generationStatus: videoUrl ? "Completed" : "Processing - check back soon"
          })
          toast({
            title: "Success",
            description: videoUrl ? "Video generated successfully!" : "Video generation started. Check back in a few minutes.",
          })
        } else {
          throw new Error(result.error || "Generation failed")
        }
      }
    } catch (error) {
      console.error('Error generating video:', error)
      updateShotGeneration(shot.id, {
        isGenerating: false,
        generationStatus: "Failed"
      })
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Film className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Cinema Production</h1>
          </div>
          <p className="text-muted-foreground">
            Convert your storyboard shots into video using AI models
          </p>
        </div>

        {/* Project Selection */}
        <Card className="cinema-card mb-6">
          <CardHeader>
            <CardTitle>Select Project</CardTitle>
            <CardDescription>
              Choose a project to load its storyboards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Storyboard Selection */}
        {selectedProjectId && (
          <Card className="cinema-card mb-6">
            <CardHeader>
              <CardTitle>Select Storyboard</CardTitle>
              <CardDescription>
                Choose a storyboard to view its shot list
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingShots ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading storyboards...
                </div>
              ) : storyboards.length === 0 ? (
                <p className="text-muted-foreground">
                  No storyboards found for this project.
                </p>
              ) : (
                <Select value={selectedStoryboardId} onValueChange={setSelectedStoryboardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a storyboard..." />
                  </SelectTrigger>
                  <SelectContent>
                    {storyboards.map((storyboard) => (
                      <SelectItem key={storyboard.id} value={storyboard.id}>
                        {storyboard.title} (Scene {storyboard.scene_number}, Shot {storyboard.shot_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Shot List and Video Generation */}
        {selectedStoryboardId && (
          <div className="space-y-6">
            {loadingShots ? (
              <Card className="cinema-card">
                <CardContent className="py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading shots...
                  </div>
                </CardContent>
              </Card>
            ) : shotLists.length === 0 ? (
              <Card className="cinema-card">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No shots found for this storyboard.
                  </p>
                </CardContent>
              </Card>
            ) : (
              shotLists.map((shot) => {
                const generation = shotGenerations.get(shot.id) || {
                  shotId: shot.id,
                  model: "",
                  prompt: "",
                  duration: "5s",
                  resolution: "1280x720",
                  uploadedFile: null,
                  startFrame: null,
                  endFrame: null,
                  filePreview: null,
                  startFramePreview: null,
                  endFramePreview: null,
                  isGenerating: false,
                  generatedVideoUrl: null,
                  generationStatus: null
                }
                
                const fileRequirement = generation.model ? getModelFileRequirement(generation.model) : 'none'
                const defaultPrompt = buildPromptFromShot(shot)

                return (
                  <Card key={shot.id} className="cinema-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              Shot {shot.shot_number}
                            </Badge>
                            {shot.shot_type} - {shot.camera_angle}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {shot.description || "No description"}
                          </CardDescription>
                        </div>
                        <Badge className={
                          shot.status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          shot.status === 'shot' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }>
                          {shot.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Shot Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Camera className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium">{shot.shot_type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Camera className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Angle:</span>
                          <span className="font-medium">{shot.camera_angle}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Move className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Movement:</span>
                          <span className="font-medium">{shot.movement}</span>
                        </div>
                        {shot.duration_seconds && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="font-medium">{shot.duration_seconds}s</span>
                          </div>
                        )}
                      </div>

                      {shot.action && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Action:</p>
                          <p className="text-sm">{shot.action}</p>
                        </div>
                      )}

                      {/* Video Generation Section */}
                      <div className="border-t pt-4 space-y-4">
                        <div>
                          <Label>Video Model</Label>
                          <Select
                            value={generation.model}
                            onValueChange={(value) => {
                              updateShotGeneration(shot.id, { 
                                model: value as VideoModel,
                                // Clear files when model changes
                                uploadedFile: null,
                                startFrame: null,
                                endFrame: null,
                                filePreview: null,
                                startFramePreview: null,
                                endFramePreview: null
                              })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a video model..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Kling T2V">Kling T2V (Text-to-Video)</SelectItem>
                              <SelectItem value="Kling I2V">Kling I2V (Image-to-Video)</SelectItem>
                              <SelectItem value="Kling I2V Extended">Kling I2V Extended (Frame-to-Frame)</SelectItem>
                              <SelectItem value="Runway Gen-4 Turbo">Runway Gen-4 Turbo</SelectItem>
                              <SelectItem value="Runway Gen-3A Turbo">Runway Gen-3A Turbo</SelectItem>
                              <SelectItem value="Runway Act-Two">Runway Act-Two</SelectItem>
                              <SelectItem value="Runway Gen-4 Aleph">Runway Gen-4 Aleph</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {generation.model && (
                          <>
                            <div>
                              <Label>Prompt</Label>
                              <Textarea
                                value={generation.prompt}
                                onChange={(e) => updateShotGeneration(shot.id, { prompt: e.target.value })}
                                placeholder={defaultPrompt}
                                rows={3}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1"
                                onClick={() => updateShotGeneration(shot.id, { prompt: defaultPrompt })}
                              >
                                Use Shot Details
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Duration</Label>
                                <Select
                                  value={generation.duration}
                                  onValueChange={(value) => updateShotGeneration(shot.id, { duration: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="5s">5 seconds</SelectItem>
                                    <SelectItem value="10s">10 seconds</SelectItem>
                                    <SelectItem value="15s">15 seconds</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Resolution</Label>
                                <Select
                                  value={generation.resolution}
                                  onValueChange={(value) => updateShotGeneration(shot.id, { resolution: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
                                    <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* File Uploads Based on Model */}
                            {fileRequirement === 'image' && (
                              <div>
                                <Label>Upload Image</Label>
                                {generation.filePreview ? (
                                  <div className="relative mt-2">
                                    <img 
                                      src={generation.filePreview} 
                                      alt="Preview" 
                                      className="w-full h-48 object-cover rounded-md"
                                    />
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="absolute top-2 right-2"
                                      onClick={() => handleRemoveFile(shot.id, 'file')}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="mt-2">
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileUpload(shot.id, file, 'file')
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {fileRequirement === 'video' && (
                              <div>
                                <Label>Upload Video</Label>
                                {generation.uploadedFile ? (
                                  <div className="mt-2 flex items-center gap-2">
                                    <Video className="h-4 w-4" />
                                    <span className="text-sm">{generation.uploadedFile.name}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveFile(shot.id, 'file')}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="mt-2">
                                    <Input
                                      type="file"
                                      accept="video/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileUpload(shot.id, file, 'file')
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {fileRequirement === 'start-end-frames' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Start Frame</Label>
                                  {generation.startFramePreview ? (
                                    <div className="relative mt-2">
                                      <img 
                                        src={generation.startFramePreview} 
                                        alt="Start Frame" 
                                        className="w-full h-48 object-cover rounded-md"
                                      />
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="absolute top-2 right-2"
                                        onClick={() => handleRemoveFile(shot.id, 'startFrame')}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="mt-2">
                                      <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleFileUpload(shot.id, file, 'startFrame')
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <Label>End Frame</Label>
                                  {generation.endFramePreview ? (
                                    <div className="relative mt-2">
                                      <img 
                                        src={generation.endFramePreview} 
                                        alt="End Frame" 
                                        className="w-full h-48 object-cover rounded-md"
                                      />
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="absolute top-2 right-2"
                                        onClick={() => handleRemoveFile(shot.id, 'endFrame')}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="mt-2">
                                      <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleFileUpload(shot.id, file, 'endFrame')
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <Button
                              onClick={() => handleGenerateVideo(shot)}
                              disabled={generation.isGenerating || !generation.prompt.trim()}
                              className="w-full"
                            >
                              {generation.isGenerating ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Generate Video
                                </>
                              )}
                            </Button>

                            {generation.generationStatus && (
                              <div className="text-sm text-muted-foreground">
                                Status: {generation.generationStatus}
                              </div>
                            )}

                            {generation.generatedVideoUrl && (
                              <div className="mt-4">
                                <video 
                                  src={generation.generatedVideoUrl} 
                                  controls 
                                  className="w-full rounded-md"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

