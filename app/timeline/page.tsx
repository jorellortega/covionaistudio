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
  RefreshCw,
  CheckCircle,
} from "lucide-react"
import Link from "next/link"
import { TimelineService, type SceneWithMetadata, type CreateSceneData } from "@/lib/timeline-service"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context-fixed"
import { analyzeImageUrl } from "@/lib/image-utils"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { AssetService } from "@/lib/asset-service"
import { ProjectSelector } from "@/components/project-selector"

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
  const movieId = searchParams.get("movie") || searchParams.get("project")
  const [movie, setMovie] = useState<any>(null)
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [loading, setLoading] = useState(false) // Start with false so page shows immediately
  const [scenesLoading, setScenesLoading] = useState(false) // Separate loading state for scenes
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
  
  // AI Image Generation states
  const [aiPrompt, setAiPrompt] = useState("")
  const [selectedAIService, setSelectedAIService] = useState("dalle")
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState("")
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  
  // Memoized image processing to prevent repeated expensive operations
  const [processedImages, setProcessedImages] = useState<Map<string, any>>(new Map())
  
  const { toast } = useToast()
  const { user } = useAuth()

  // Optimized image processing function
  const processSceneImage = (scene: SceneWithMetadata, index: number) => {
    const cacheKey = `${scene.id}-${scene.metadata.thumbnail || 'no-thumbnail'}`
    
    if (processedImages.has(cacheKey)) {
      return processedImages.get(cacheKey)
    }
    
    const urlInfo = scene.metadata.thumbnail ? analyzeImageUrl(scene.metadata.thumbnail) : null
    const imageSrc = scene.metadata.thumbnail || null
    
    const result = {
      urlInfo,
      imageSrc,
      usingFallback: !scene.metadata.thumbnail
    }
    
    // Cache the result
    setProcessedImages(prev => new Map(prev).set(cacheKey, result))
    return result
  }

  useEffect(() => {
    if (movieId) {
      // Clear image cache when movie changes
      setProcessedImages(new Map())
      loadMovieAndScenes()
    } else {
      setLoading(false)
    }
  }, [movieId])

  // Load AI settings - with performance optimization
  useEffect(() => {
    let mounted = true
    
    const loadAISettings = async () => {
      if (!user || aiSettingsLoaded) return
      
      try {
        console.log('🎬 TIMELINE - Loading AI settings...')
        
        // Only check and repair table if it's the first time
        if (!aiSettingsLoaded) {
          console.log('🎬 TIMELINE - Checking AI settings table state...')
          await AISettingsService.checkAndRepairTable(user.id)
        }
        
        // Now try to load settings normally
        const settings = await AISettingsService.getUserSettings(user.id)
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'images'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'videos'),
          AISettingsService.getOrCreateDefaultTabSetting(user.id, 'audio')
        ])
        
        // Merge existing settings with default ones, preferring existing
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        if (mounted) {
          setAiSettings(mergedSettings)
          setAiSettingsLoaded(true)
          
          // Auto-select locked model for images tab if available
          const imagesSetting = mergedSettings.find(setting => setting.tab_type === 'images')
          if (imagesSetting?.is_locked) {
            console.log('🎬 TIMELINE - Setting locked model for images:', imagesSetting.locked_model)
            setSelectedAIService(imagesSetting.locked_model)
          }
        }
      } catch (error) {
        console.error('🎬 TIMELINE - Error loading AI settings:', error)
        // Even if there's an error, try to create basic default settings
        if (mounted && !aiSettingsLoaded) {
          try {
            const basicSettings = await Promise.all([
              AISettingsService.getOrCreateDefaultTabSetting(user.id, 'images'),
              AISettingsService.getOrCreateDefaultTabSetting(user.id, 'scripts')
            ])
            setAiSettings(basicSettings)
            setAiSettingsLoaded(true)
          } catch (fallbackError) {
            console.error('🎬 TIMELINE - Failed to create fallback AI settings:', fallbackError)
          }
        }
      }
    }

    loadAISettings()

    return () => {
      mounted = false
    }
  }, [user?.id]) // Only depend on user.id, not the entire user object

  const loadMovieAndScenes = async () => {
    if (!movieId) return

    try {
      console.log('🎬 TIMELINE - Starting to load movie and scenes...')
      
      // Load movie details first (fast)
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
      console.log('🎬 TIMELINE - Movie loaded:', movieData)
      
      // Now load scenes (slower, show loading state)
      setScenesLoading(true)

      // Check for duplicate timelines and clean them up automatically - but only if needed
      try {
        console.log('🎬 TIMELINE - Checking for duplicate timelines...')
        const cleanupResult = await TimelineService.cleanupDuplicateTimelines(movieId)
        if (cleanupResult.success && cleanupResult.message !== 'No cleanup needed') {
          console.log('🎬 TIMELINE - Auto-cleanup completed:', cleanupResult.message)
          toast({
            title: "Timeline Cleanup",
            description: cleanupResult.message,
          })
        } else {
          console.log('🎬 TIMELINE - No cleanup needed, skipping expensive operation')
        }
      } catch (cleanupError) {
        console.warn('🎬 TIMELINE - Auto-cleanup failed, continuing with normal load:', cleanupError)
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

      // Load scenes for the timeline (includes fetching associated assets for thumbnails)
      // Use the new display order method that sorts by scene number
      const scenesData = await TimelineService.getTimelineDisplayOrder(timeline.id)
      console.log('Loaded scenes with asset thumbnails:', scenesData)
      setScenes(scenesData)
    } catch (error) {
      console.error('Error loading movie and scenes:', error)
      toast({
        title: "Error",
        description: "Failed to load movie and scenes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setScenesLoading(false) // Use scenesLoading instead of loading
    }
  }

  const handleAddScene = async () => {
    console.log('handleAddScene called')
    console.log('movieId:', movieId)
    console.log('newScene.title:', newScene.title)
    console.log('currentTimeline:', currentTimeline)
    
    if (!movieId || !newScene.title.trim() || !currentTimeline) {
      console.log('Validation failed:')
      console.log('- movieId exists:', !!movieId)
      console.log('- title exists:', !!newScene.title.trim())
      console.log('- timeline exists:', !!currentTimeline)
      
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
          thumbnail: generatedImageUrl || undefined,
        }
      }

      console.log('Creating scene with data:', sceneData)
      console.log('Generated image URL to save:', generatedImageUrl)
      const createdScene = await TimelineService.createScene(sceneData)
      console.log('Scene created:', createdScene)
      
      // Add the new scene to the list
      const newSceneWithMetadata = {
        ...createdScene,
        metadata: sceneData.metadata
      }
      console.log('Adding scene to list:', newSceneWithMetadata)
      console.log('Scene metadata includes thumbnail:', newSceneWithMetadata.metadata.thumbnail)
      console.log('Full scene object:', newSceneWithMetadata)
      console.log('Scene metadata object:', newSceneWithMetadata.metadata)
      setScenes([...scenes, newSceneWithMetadata])

      // Don't refresh scenes immediately - keep the local state with thumbnail
      // await refreshScenes()

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
      
      // Reset AI image generation states
      setAiPrompt("")
      setSelectedAIService("dalle")
      setGeneratedImageUrl("")

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

    console.log('handleUpdateScene called')
    console.log('editingScene:', editingScene)
    console.log('generatedImageUrl:', generatedImageUrl)

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
          thumbnail: generatedImageUrl || editingScene.metadata?.thumbnail,
        }
      }

      await TimelineService.updateScene(editingScene.id, updates)
      
      // If scene number changed, reorder scenes to ensure proper timeline order
      if (editingScene.metadata.sceneNumber !== newScene.sceneNumber) {
        try {
          await TimelineService.reorderScenesBySceneNumber(editingScene.timeline_id)
          // After reordering, reload scenes to get the new order
          const reorderedScenes = await TimelineService.getScenesForTimeline(editingScene.timeline_id)
          setScenes(reorderedScenes)
        } catch (reorderError) {
          console.warn('Failed to reorder scenes after scene number change:', reorderError)
          // Fall back to regular refresh
          await refreshScenes()
        }
      } else {
        // Update the scene in the list
        setScenes(scenes.map(s => 
          s.id === editingScene.id 
            ? { ...s, ...updates, metadata: updates.metadata! }
            : s
        ))

        // Refresh scenes from the database to ensure consistency
        await refreshScenes()
      }

      setEditingScene(null)
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
      
      // Reset AI image generation states
      setAiPrompt("")
      setSelectedAIService("dalle")
      setGeneratedImageUrl("")

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
      
      // Refresh scenes from the database to ensure consistency and proper ordering
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
    // For existing scenes, reset the form
    resetImageForm()
    setIsImageUploadOpen(true)
  }

  const handleOpenThumbnailDialog = () => {
    // For new scene creation, don't reset the form
    // This preserves any generated image
    setSelectedSceneForUpload(null)
    setIsImageUploadOpen(true)
  }

  const handleOpenThumbnailForNewScene = () => {
    // For new scene creation, don't reset the form
    // This preserves any generated image
    setSelectedSceneForUpload(null)
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
      
      // 1. Save image to assets table (like AI Studio does)
      if (!movie?.id) {
        throw new Error('No movie/project selected')
      }
      
      const assetData = {
        project_id: movie.id,
        scene_id: selectedSceneForUpload.id,
        title: `Uploaded Image - ${selectedSceneForUpload.name || 'Scene'} - ${new Date().toLocaleDateString()}`,
        content_type: 'image' as const,
        content: '', // No text content for uploaded images
        content_url: publicUrl,
        prompt: '', // No prompt for uploaded images
        model: 'manual_upload',
        generation_settings: {},
        metadata: {
          scene_name: selectedSceneForUpload.name,
          scene_number: selectedSceneForUpload.metadata.sceneNumber,
          uploaded_at: new Date().toISOString(),
          source: 'timeline_upload',
          original_filename: file.name
        }
      }

      console.log('Saving uploaded image asset to database:', assetData)
      const savedAsset = await AssetService.createAsset(assetData)
      console.log('Uploaded image asset saved successfully:', savedAsset)

      // 2. Update the scene metadata with the new Supabase URL AND link to asset
      await TimelineService.updateScene(selectedSceneForUpload.id, {
        metadata: { 
          ...selectedSceneForUpload.metadata, 
          thumbnail: publicUrl,
          asset_id: savedAsset.id // Link to the saved asset
        }
      })

      // 3. Update local state to show the new thumbnail immediately
      setScenes(prevScenes => 
        prevScenes.map(scene => 
          scene.id === selectedSceneForUpload.id 
            ? { 
                ...scene, 
                metadata: { 
                  ...scene.metadata, 
                  thumbnail: publicUrl,
                  asset_id: savedAsset.id
                } 
              }
            : scene
        )
      )
      
      toast({
        title: "Image Uploaded",
        description: "Scene thumbnail has been saved to asset library and updated successfully!",
      })
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

  const handleImageUploadForNewScene = async (file: File) => {
    if (!movieId) return
    
    setIsUploadingImage(true)
    
    try {
      // Upload file to Supabase storage
      const { supabase } = await import('@/lib/supabase')
      
      // Create a temporary file path for new scenes
      const filePath = `${movieId}/temp/${Date.now()}_${file.name}`
      
      console.log('Uploading to temp path:', filePath)
      
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
      
      console.log('File uploaded successfully for new scene, public URL:', publicUrl)
      
      // Set the generated image URL for the new scene
      setGeneratedImageUrl(publicUrl)
      
      toast({
        title: "Image Ready",
        description: "Image is ready! Go back to the main dialog and click 'Add Scene' to create your scene.",
      })
      
      // Close the thumbnail dialog
      setIsImageUploadOpen(false)
      
    } catch (error) {
      console.error("Failed to upload image for new scene:", error)
      toast({
        title: "Upload Failed",
        description: `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleRefreshExpiredImage = async (scene: SceneWithMetadata) => {
    try {
      toast({
        title: "Refreshing Thumbnail",
        description: "Fetching latest image from asset library...",
      })
      
      // Use the new TimelineService method to refresh from assets
      const latestThumbnailUrl = await TimelineService.refreshSceneThumbnail(scene.id)
      
      if (latestThumbnailUrl) {
        // Update the scene with the latest thumbnail URL from assets
        await TimelineService.updateScene(scene.id, {
          metadata: { 
            ...scene.metadata, 
            thumbnail: latestThumbnailUrl 
          }
        })
        
        toast({
          title: "Thumbnail Refreshed",
          description: "Scene thumbnail updated with latest image from asset library!",
        })
        
        // Refresh the scenes to show the updated thumbnail
        await refreshScenes()
      } else {
        toast({
          title: "No Images Found",
          description: "No image assets found for this scene in the asset library.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to refresh scene thumbnail:", error)
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh scene thumbnail. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRefreshAllThumbnails = async () => {
    try {
      toast({
        title: "Refreshing All Thumbnails",
        description: "Syncing all scenes with latest images from asset library...",
      })
      
      // Refresh all scenes from the asset library
      const updatedScenes = await TimelineService.getScenesForTimeline(currentTimeline!.id)
      
      // Update local state
      setScenes(updatedScenes)
      
      toast({
        title: "All Thumbnails Refreshed",
        description: "All scene thumbnails have been updated from the asset library!",
      })
    } catch (error) {
      console.error("Failed to refresh all thumbnails:", error)
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh all thumbnails. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Upload generated image to Supabase storage
  const uploadGeneratedImageToStorage = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      console.log('Uploading generated image to Supabase storage...')
      
      // Use our API route to download and upload (bypasses CORS)
      const response = await fetch('/api/ai/download-and-store-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          fileName: fileName,
          userId: user!.id
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API error: ${errorData.error || response.statusText}`)
      }
      
      const result = await response.json()
      console.log('Image upload API response:', result)
      
      if (result.success && result.supabaseUrl) {
        console.log('Image uploaded successfully to Supabase:', result.supabaseUrl)
        return result.supabaseUrl
      } else {
        throw new Error('API did not return a valid Supabase URL')
      }
      
    } catch (error) {
      console.error('Error uploading image to Supabase:', error)
      throw error
    }
  }

  const generateAIImage = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a prompt to generate an image.",
        variant: "destructive",
      })
      return
    }

    // Check if user is loaded
    if (!user) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating images.",
        variant: "destructive",
      })
      return
    }

    // Use locked model if available, otherwise use selected service
    const lockedModel = getImagesTabLockedModel()
    const serviceToUse = (isImagesTabLocked() && lockedModel) ? lockedModel : selectedAIService
    
    if (!serviceToUse) {
      toast({
        title: "Error",
        description: "No AI service selected. Please choose an AI service or configure your settings.",
        variant: "destructive",
      })
      return
    }

    // Debug: Log user object and API keys
    console.log('User object:', user)
    console.log('Service to use:', serviceToUse, isImagesTabLocked() ? '(locked model)' : '(user selected)')
    console.log('OpenAI API key exists:', !!user?.openaiApiKey)
    console.log('OpenArt API key exists:', !!user?.openartApiKey)
    console.log('Leonardo API key exists:', !!user?.leonardoApiKey)

    // Check if user has the required API key for the service to use
    if (serviceToUse === "dalle" && !user?.openaiApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your OpenAI API key in settings to use DALL-E.",
        variant: "destructive",
      })
      return
    }

    if (serviceToUse === "openart" && !user?.openartApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your OpenArt API key in settings to use OpenArt.",
        variant: "destructive",
      })
      return
    }

    if (serviceToUse === "leonardo" && !user?.leonardoApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your Leonardo AI API key in settings to use Leonardo AI.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGeneratingImage(true)

      console.log(`Generating scene image using ${serviceToUse} (${isImagesTabLocked() ? 'locked model' : 'user selected'})`)

      // Get the appropriate API key based on service to use
      let apiKey = ''
      switch (serviceToUse) {
        case 'dalle':
          apiKey = user?.openaiApiKey || ''
          break
        case 'openart':
          apiKey = user?.openartApiKey || ''
          break
        case 'leonardo':
          apiKey = user?.leonardoApiKey || ''
          break
        default:
          throw new Error('Unsupported AI service')
      }

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          service: serviceToUse,
          apiKey: apiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const result = await response.json()
      console.log('AI image generated:', result)

      if (result.success && result.imageUrl) {
        setGeneratedImageUrl(result.imageUrl)
        toast({
          title: "Image Generated",
          description: "AI has generated your scene image!",
        })
      } else {
        throw new Error('No image URL received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI image:', error)
      toast({
        title: "Generation Failed",
        description: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const saveGeneratedImage = async () => {
    if (!generatedImageUrl) return

    try {
      setIsUploadingImage(true)

      // First, upload the generated image to Supabase storage
      let finalImageUrl = generatedImageUrl
      try {
        console.log('Uploading generated image to Supabase storage...')
        const fileName = `scene-image-${Date.now()}`
        finalImageUrl = await uploadGeneratedImageToStorage(generatedImageUrl, fileName)
        console.log('Image uploaded to Supabase, new URL:', finalImageUrl)
      } catch (uploadError) {
        console.error('Failed to upload image to Supabase:', uploadError)
        toast({
          title: "Image Upload Warning",
          description: "Failed to upload image to storage, but saving with original URL.",
          variant: "destructive",
        })
        // Continue with original URL if upload fails
      }

      if (selectedSceneForUpload) {
        // Updating existing scene - save to assets table AND update scene metadata
        setUploadingSceneId(selectedSceneForUpload.id)

        // 1. Save image to assets table (like AI Studio does)
        if (!movie?.id) {
          throw new Error('No movie/project selected')
        }
        
        const assetData = {
          project_id: movie.id,
          scene_id: selectedSceneForUpload.id,
          title: `Generated Image - ${selectedSceneForUpload.name || 'Scene'} - ${new Date().toLocaleDateString()}`,
          content_type: 'image' as const,
          content: '', // No text content for images
          content_url: finalImageUrl,
          prompt: aiPrompt,
          model: selectedAIService,
          generation_settings: {},
          metadata: {
            scene_name: selectedSceneForUpload.name,
            scene_number: selectedSceneForUpload.metadata.sceneNumber,
            generated_at: new Date().toISOString(),
            source: 'timeline_page'
          }
        }

        console.log('Saving image asset to database:', assetData)
        const savedAsset = await AssetService.createAsset(assetData)
        console.log('Image asset saved successfully:', savedAsset)

        // 2. Update the scene metadata with the new Supabase URL
        await TimelineService.updateScene(selectedSceneForUpload.id, {
          metadata: { 
            ...selectedSceneForUpload.metadata, 
            thumbnail: finalImageUrl,
            asset_id: savedAsset.id // Link to the saved asset
          }
        })

        // Update the local state
        console.log('Before state update - scene thumbnail:', selectedSceneForUpload.metadata.thumbnail)
        
        setScenes(prevScenes => {
          const updatedScenes = prevScenes.map(scene => 
            scene.id === selectedSceneForUpload.id 
              ? { 
                  ...scene, 
                  metadata: { 
                    ...scene.metadata, 
                    thumbnail: finalImageUrl,
                    asset_id: savedAsset.id
                  } 
                }
              : scene
          )
          
          console.log('Updated local scenes state:', updatedScenes)
          console.log('Scene with new thumbnail:', updatedScenes.find(s => s.id === selectedSceneForUpload.id))
          console.log('New thumbnail URL:', finalImageUrl)
          
          return updatedScenes
        })
        
        // Verify the state update
        setTimeout(() => {
          console.log('After state update - checking current scenes state:')
          console.log('Current scenes:', scenes)
          const updatedScene = scenes.find(s => s.id === selectedSceneForUpload.id)
          console.log('Updated scene in state:', updatedScene)
          console.log('Updated scene thumbnail:', updatedScene?.metadata.thumbnail)
        }, 0)

        toast({
          title: "Image Saved",
          description: "Generated image has been saved to the scene and asset library!",
        })

        // Reset AI states
        setGeneratedImageUrl("")
        setAiPrompt("")
        setIsImageUploadOpen(false)
        
        // Note: Local state is already updated, no need to refresh from database
        // The scene thumbnail should now be visible in the UI
      } else {
        // Creating new scene - just close the dialog and keep the image ready
        toast({
          title: "Image Ready",
          description: "Image is ready! Go back to the main dialog and click 'Add Scene' to create your scene.",
        })

        // Close the thumbnail dialog
        setIsImageUploadOpen(false)
        
        // Keep the generated image URL for the main dialog
        // Don't reset it so it can be used when creating the scene
      }
    } catch (error) {
      console.error('Failed to save generated image:', error)
      toast({
        title: "Save Failed",
        description: `Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Get current images tab AI setting
  const getImagesTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === 'images')
  }

  // Check if images tab has a locked model
  const isImagesTabLocked = () => {
    const setting = getImagesTabSetting()
    return setting?.is_locked || false
  }

  // Get the locked model for images tab
  const getImagesTabLockedModel = () => {
    const setting = getImagesTabSetting()
    return setting?.locked_model || ""
  }

  // Get or create AI setting for images tab
  const getOrCreateImagesTabSetting = async () => {
    if (!user) return null
    
    try {
      const setting = await AISettingsService.getOrCreateDefaultTabSetting(user.id, 'images')
      // Update local state if a new setting was created
      if (!aiSettings.find(s => s.tab_type === 'images')) {
        setAiSettings(prev => [...prev, setting])
      }
      return setting
    } catch (error) {
      console.error('Error getting or creating images tab setting:', error)
      return null
    }
  }

  const resetImageForm = () => {
    setAiPrompt("")
    setSelectedAIService("dalle")
    setGeneratedImageUrl("")
    setSelectedSceneForUpload(null)
  }

  const totalDuration = scenes.reduce((total, scene) => total + scene.duration_seconds, 0)

  const formatTotalDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Loading timeline...</span>
          </div>
        </main>
      </div>
    )
  }

  // Render no movie selected state
  if (!movieId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="text-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No movie selected</h3>
            <p className="text-muted-foreground mb-4">Please select a movie to view its timeline</p>
            
            {/* Project Selector for selecting a movie */}
            <div className="max-w-md mx-auto mb-6">
              <ProjectSelector 
                onProjectChange={(newProjectId) => {
                  if (newProjectId) {
                    window.location.href = `/timeline?movie=${newProjectId}`
                  }
                }}
                placeholder="Select a movie to view its timeline"
                showCreateNew={true}
              />
            </div>
            
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

  // Render movie not found state
  if (!movie) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
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

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/movies">
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                {movie.name} - Timeline
              </h1>
              <p className="text-muted-foreground">Organize and manage your film scenes</p>
            </div>
          </div>
          
          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Switch to:</span>
            <ProjectSelector 
              selectedProject={movieId}
              onProjectChange={(newProjectId) => {
                if (newProjectId && newProjectId !== movieId) {
                  window.location.href = `/timeline?movie=${newProjectId}`
                }
              }}
              placeholder="Select a different movie"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:gap-4">
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











            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "cinema" | "video")} className="w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cinema" className="text-xs">Cinema</TabsTrigger>
                <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
              </TabsList>
            </Tabs>


          </div>
        </div>

        {/* Movie Info & Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8">
          <Card className="cinema-card">
            <CardHeader className="pb-2 lg:pb-3">
              <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground">Current Movie</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm lg:text-lg font-semibold text-blue-500 truncate">{movie.name}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-2 lg:pb-3">
              <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground">Total Scenes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xl lg:text-2xl font-bold">{scenes.length}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-2 lg:pb-3">
              <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground">Total Duration</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xl lg:text-2xl font-bold">{formatTotalDuration(totalDuration)}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-2 lg:pb-3">
              <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground">Completion</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xl lg:text-2xl font-bold text-green-400">
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
            <DialogContent className="cinema-card border-border max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingScene ? `Edit Scene: ${editingScene.name}` : "Add New Scene"}
                </DialogTitle>
                <DialogDescription>
                  {editingScene ? "Update scene details" : "Create a new scene for your timeline"}
                </DialogDescription>
              </DialogHeader>
              


              <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
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

                {/* AI Image Generation Section */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">AI Scene Image Generation</h3>
                  </div>
                  
                  {!user ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Loading user profile...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* AI Service Selection - Only show if not locked */}
                      {!isImagesTabLocked() && (
                        <div>
                          <Label htmlFor="ai-service">AI Service</Label>
                          <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="cinema-card border-border">
                              <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                              <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                              <SelectItem value="leonardo">Leonardo AI</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Show locked model info if images tab is locked */}
                      {isImagesTabLocked() && (
                        <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                          <p className="text-sm text-green-600 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            AI Online
                          </p>
                        </div>
                      )}
                      
                      {/* AI Prompt */}
                      <div>
                        <Label htmlFor="ai-prompt">AI Prompt</Label>
                        <div className="flex gap-2">
                          <Input
                            id="ai-prompt"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Describe your scene (e.g., 'Sci-fi spaceship interior with neon lights')"
                            className="flex-1 bg-input border-border"
                          />
                          <Button
                            onClick={generateAIImage}
                            disabled={isGeneratingImage || !aiPrompt.trim()}
                            variant="outline"
                            size="sm"
                            className="border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10"
                          >
                            {isGeneratingImage ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Generate
                          </Button>
                        </div>
                      </div>
                      
                      {/* Generated Image Preview */}
                      {generatedImageUrl && (
                        <div className="space-y-3">
                          <Label>Generated Scene Image</Label>
                          <div className="relative">
                            <img
                              src={generatedImageUrl}
                              alt="AI generated scene image"
                              className="w-full h-48 object-cover rounded-lg border border-border"
                            />
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-green-600/90 text-white">
                                Generated ✓
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This image will be automatically saved when you create the scene.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleOpenThumbnailForNewScene}
                              variant="outline"
                              size="sm"
                              className="border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10"
                            >
                              <ImageIcon className="h-4 w-4 mr-2" />
                              Advanced Image Options
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="flex-shrink-0 bg-background border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddSceneOpen(false)
                    setEditingScene(null)
                    // Reset AI image generation states
                    setAiPrompt("")
                    setSelectedAIService("dalle")
                    setGeneratedImageUrl("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    console.log('Add/Update Scene button clicked')
                    console.log('editingScene:', editingScene)
                    console.log('newScene:', newScene)
                    console.log('generatedImageUrl:', generatedImageUrl)
                    if (editingScene) {
                      handleUpdateScene()
                    } else {
                      handleAddScene()
                    }
                  }}
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
            {/* Progressive Loading for Scenes */}
            {scenesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading scenes...</p>
                  <p className="text-sm text-muted-foreground mt-2">Page loaded, fetching scene data...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile Layout - Stacked Cards */}
                <div className="block md:hidden mt-8">
                  <div className="space-y-4">
                {scenes.map((scene, index) => (
                  <div key={scene.id} className="relative">
                    <Link href={`/timeline-scene/${scene.id}`}>
                      <Card className="cinema-card hover:neon-glow transition-all duration-300 backdrop-blur-sm group hover:border-cyan-400 cursor-pointer overflow-hidden">
                        <CardHeader className="p-0">
                          <div className="flex flex-col md:flex-row h-full min-h-[200px] md:min-h-[256px]">
                            {/* Content Section */}
                            <div className="flex-1 p-4 md:p-6 min-w-0">
                              <div className="flex items-center gap-2 md:gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-cyan-500 glow flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-bold text-black">{scene.metadata.sceneNumber || index + 1}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                      Order: {scene.order_index}
                                    </div>
                                  </div>
                                  <CardTitle className="text-base md:text-lg">{scene.name}</CardTitle>
                                </div>
                                <div className="flex flex-wrap gap-1 ml-auto">
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
                              </div>
                              <CardDescription className="text-sm mb-3">{scene.description}</CardDescription>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{scene.metadata.location || "No location"}</span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDuration(scene.duration_seconds)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Camera className="h-3 w-3" />
                                  <span className="truncate">{scene.metadata.shotType || "No shot type"}</span>
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

                              {/* Mobile Thumbnail - Only show if thumbnail exists AND is valid */}
                              {scene.metadata.thumbnail && (() => {
                                const urlInfo = analyzeImageUrl(scene.metadata.thumbnail)
                                return urlInfo && !urlInfo.isExpired
                              })() && (
                                <div className="w-full h-32 md:w-40 md:h-64 relative bg-muted/20 border-t md:border-l md:border-t-0 border-border/30 flex-shrink-0 overflow-hidden">
                                  <img
                                    key={`${scene.id}-${scene.metadata.thumbnail}`}
                                    src={scene.metadata.thumbnail}
                                    alt=""
                                    className="w-full h-full object-cover md:object-contain md:rounded-r-lg"

                                  />
                                  
                                  {/* Scene number overlay */}
                                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                    {scene.metadata.sceneNumber || index + 1}
                                  </div>
                                  
                                  {/* Image status indicator */}
                                  {(() => {
                                    const urlInfo = analyzeImageUrl(scene.metadata.thumbnail)
                                    return (
                                      <div className={`absolute bottom-2 right-2 text-white text-xs px-2 py-1 rounded max-w-32 truncate ${
                                        urlInfo?.needsRefresh 
                                          ? 'bg-orange-600/90' 
                                          : 'bg-green-600/90'
                                      }`}>
                                        {urlInfo?.needsRefresh ? '⚠️ Expired' : '✓ Has Image'}
                                      </div>
                                    )
                                  })()}
                                  
                                  {/* Action buttons */}
                                  <div className="absolute bottom-2 left-2 flex gap-1">
                                    {/* Refresh button for expired images */}
                                    {(() => {
                                      const urlInfo = analyzeImageUrl(scene.metadata.thumbnail)
                                      return urlInfo?.needsRefresh ? (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleRefreshExpiredImage(scene)
                                          }}
                                          className="h-auto px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white shadow-lg border-2 border-white text-xs font-medium"
                                          title="Refresh expired image"
                                        >
                                          <RefreshCw className="h-3 w-3" />
                                        </Button>
                                      ) : null
                                    })()}
                                    
                                    {/* Upload Image Button */}
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
                              )}
                            </div>
                          </CardHeader>
                        </Card>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

            {/* Desktop Layout - Timeline */}
            <div className="hidden md:block mt-8">
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
                                        className="text-xs h-6 px-2 bg-transparent hover:bg-cyan-500/10 hover:text-blue-500"
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

                                  {/* Desktop Thumbnail - Only show if thumbnail exists AND is valid */}
                                  {scene.metadata.thumbnail && (() => {
                                    const urlInfo = analyzeImageUrl(scene.metadata.thumbnail)
                                    return urlInfo && !urlInfo.isExpired
                                  })() && (
                                    <div className="w-40 h-64 relative bg-muted/20 border-l border-border/30 flex-shrink-0 overflow-hidden">
                                      <img
                                        key={`${scene.id}-${scene.metadata.thumbnail}`}
                                        src={scene.metadata.thumbnail}
                                        alt=""
                                        className="w-full h-full object-contain rounded-r-lg"

                                      />
                                      
                                      {/* Scene number overlay */}
                                      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                        {scene.metadata.sceneNumber || index + 1}
                                      </div>
                                      
                                      {/* Image status indicator */}
                                      {(() => {
                                        const urlInfo = analyzeImageUrl(scene.metadata.thumbnail)
                                        return (
                                          <div className={`absolute bottom-2 right-2 text-white text-xs px-2 py-1 rounded max-w-32 truncate ${
                                            urlInfo?.needsRefresh 
                                              ? 'bg-orange-600/90' 
                                              : 'bg-green-600/90'
                                          }`}>
                                            {urlInfo?.needsRefresh ? '⚠️ Expired' : '✓ Has Image'}
                                          </div>
                                        )
                                      })()}
                                      
                                      {/* Action buttons */}
                                      <div className="absolute bottom-2 left-2 flex gap-1">
                                        {/* Refresh button for expired images */}
                                        {(() => {
                                          const urlInfo = analyzeImageUrl(scene.metadata.thumbnail)
                                          return urlInfo?.needsRefresh ? (
                                            <Button
                                              size="sm"
                                              variant="secondary"
                                              onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handleRefreshExpiredImage(scene)
                                              }}
                                              className="h-auto px-2 py-2 bg-orange-600 hover:bg-orange-700 text-white shadow-lg border-2 border-white text-xs font-medium"
                                              title="Refresh expired image"
                                            >
                                              <RefreshCw className="h-3 w-3" />
                                            </Button>
                                          ) : null
                                        })()}
                                        
                                        {/* Upload Image Button */}
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleUploadImage(scene)
                                          }}
                                          className="h-auto px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-2 border-white text-xs font-medium"
                                        >
                                          <ImageIcon className="h-3 w-3 mr-1" />
                                          UPLOAD
                                        </Button>
                                      </div>
                                    </div>
                                  )}
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
                </>
              )}
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
                            {/* Video Thumbnail - Only show if thumbnail exists AND is valid */}
                            {scene.metadata.thumbnail && (() => {
                              const urlInfo = analyzeImageUrl(scene.metadata.thumbnail)
                              return urlInfo && !urlInfo.isExpired
                            })() && (
                              <div className="relative w-24 h-16 bg-muted/20 rounded border border-border/30 overflow-hidden">
                                <img
                                  key={`${scene.id}-${scene.metadata.thumbnail}`}
                                  src={scene.metadata.thumbnail}
                                  alt=""
                                  className="w-full h-full object-cover"

                                />
                                
                                {/* Image status indicator */}
                                {(() => {
                                  const urlInfo = analyzeImageUrl(scene.metadata.thumbnail)
                                  return (
                                    <div className={`absolute top-1 right-1 text-white text-xs px-1 py-0.5 rounded text-[10px] ${
                                      urlInfo?.needsRefresh 
                                        ? 'bg-orange-600/90' 
                                        : 'bg-green-600/90'
                                    }`}>
                                      {urlInfo?.needsRefresh ? '⚠️' : '✓'}
                                    </div>
                                  )
                                })()}
                                
                                {/* Upload Button */}
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
                            )}
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
        <Dialog open={isImageUploadOpen} onOpenChange={(open) => {
          setIsImageUploadOpen(open)
          if (!open) {
            // Only reset if we're not keeping an image for new scene creation
            if (!generatedImageUrl || selectedSceneForUpload) {
              resetImageForm()
            }
          }
        }}>
          <DialogContent className="cinema-card border-border max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-foreground">Scene Thumbnail</DialogTitle>
              <DialogDescription>
                {selectedSceneForUpload 
                  ? `Upload an image or generate one with AI for "${selectedSceneForUpload.name}"`
                  : "Upload an image or generate one with AI for your new scene"
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0">
              {/* AI Image Generation Section */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold">AI Image Generation</h3>
                </div>
                
                <div className="space-y-4">
                  {/* AI Service Selection - Only show if not locked */}
                  {!isImagesTabLocked() && (
                    <div>
                      <Label htmlFor="ai-service">AI Service</Label>
                      <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                          <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                          <SelectItem value="leonardo">Leonardo AI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Show locked model info if images tab is locked */}
                  {isImagesTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                      </p>
                    </div>
                  )}
                  
                  {/* AI Prompt */}
                  <div>
                    <Label htmlFor="ai-prompt">AI Prompt</Label>
                    <div className="flex gap-2">
                      <Input
                        id="ai-prompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe your scene (e.g., 'Sci-fi spaceship interior with neon lights')"
                        className="flex-1 bg-input border-border"
                      />
                      <Button
                        onClick={generateAIImage}
                        disabled={isGeneratingImage || !aiPrompt.trim()}
                        variant="outline"
                        size="sm"
                        className="border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10"
                      >
                        {isGeneratingImage ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Generate
                      </Button>
                    </div>
                  </div>
                  
                  {/* Generated Image Preview */}
                  {generatedImageUrl && (
                    <div className="space-y-3">
                      <Label>Generated Image</Label>
                      <div className="relative">
                        <img
                          src={generatedImageUrl}
                          alt="AI generated scene image"
                          className="w-full h-48 object-cover rounded-lg border border-border"
                        />
                        <Button
                          onClick={saveGeneratedImage}
                          disabled={isUploadingImage}
                          className="absolute bottom-2 right-2 bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          {isUploadingImage ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Save to Scene
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Upload Section */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold">Manual Upload</h3>
                </div>
                
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
                          if (selectedSceneForUpload) {
                            handleImageUpload(file)
                          } else {
                            handleImageUploadForNewScene(file)
                          }
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
            </div>
            
            <DialogFooter className="flex-shrink-0 bg-background border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsImageUploadOpen(false)
                  // Only reset if we're not keeping an image for new scene creation
                  if (!generatedImageUrl || selectedSceneForUpload) {
                    resetImageForm()
                  }
                }}
                disabled={isUploadingImage}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
