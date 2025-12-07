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
  X,
  Grid3x3,
  List,
  LayoutGrid,
  Download,
  Save,
  Square,
  Star,
  MoreVertical,
  Volume2,
  Music,
  Zap
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieService, type Movie } from "@/lib/movie-service"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
import { ShotListService, type ShotList } from "@/lib/shot-list-service"
import { KlingService, ElevenLabsService } from "@/lib/ai-services"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { getSupabaseClient } from "@/lib/supabase"
import { AISettingsService } from "@/lib/ai-settings-service"

type VideoModel = 
  | "Kling T2V" 
  | "Kling I2V" 
  | "Kling I2V Extended" 
  | "Runway Gen-4 Turbo" 
  | "Runway Gen-3A Turbo" 
  | "Runway Act-Two" 
  | "Runway Gen-4 Aleph"
  | "Leonardo Motion 2.0"
  | "Kling 2.1 Pro (Frame-to-Frame)"
  | "Veo 3.1 (Frame-to-Frame)"
  | "Veo 3.1 Fast (Frame-to-Frame)"

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
  motionControl?: string // For Leonardo Motion 2.0
  motionStrength?: number // For Leonardo Motion 2.0
  videoModelType?: 'KLING2_1' | 'VEO3_1' | 'VEO3_1FAST' // For Kling/Veo frame-to-frame
  videoDuration?: number // Duration in seconds for Kling/Veo (4/6/8 for Veo, 5/10 for Kling)
  startFrameImageUrl?: string | null // URL to storyboard image for start frame
  endFrameImageUrl?: string | null // URL to storyboard image for end frame
}

interface StoryboardVideo {
  id: string
  storyboard_id: string
  user_id: string
  video_url: string
  video_name: string | null
  is_default: boolean
  generation_model: string | null
  generation_prompt: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Sound Effect Generator Component
function SoundEffectGenerator({ 
  storyboard, 
  onGenerate, 
  isGenerating, 
  audioUrl,
  hasApiKey,
  onSaveAudio,
  userId,
  projectId,
  sceneId
}: { 
  storyboard: Storyboard
  onGenerate: (storyboard: Storyboard, prompt: string, duration?: number, prompt_influence?: number, looping?: boolean) => void
  isGenerating: boolean
  audioUrl: string | null
  hasApiKey: boolean
  onSaveAudio?: (audioUrl: string, prompt: string) => Promise<void>
  userId?: string
  projectId?: string
  sceneId?: string
}) {
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState<number | undefined>(undefined)
  const [promptInfluence, setPromptInfluence] = useState<number>(0.5)
  const [looping, setLooping] = useState(false)
  const [savingAudio, setSavingAudio] = useState(false)

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Describe the sound effect (e.g., 'Glass shattering on concrete', 'Thunder rumbling in the distance')"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Duration (seconds, optional)</Label>
          <Input
            type="number"
            min="0.1"
            max="30"
            step="0.1"
            value={duration || ''}
            onChange={(e) => setDuration(e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="Auto"
          />
        </div>
        <div>
          <Label className="text-xs">Prompt Influence: {promptInfluence}</Label>
          <Input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={promptInfluence}
            onChange={(e) => setPromptInfluence(parseFloat(e.target.value))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`looping-${storyboard.id}`}
          checked={looping}
          onChange={(e) => setLooping(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor={`looping-${storyboard.id}`} className="text-sm cursor-pointer">
          Enable looping (for seamless repeating sounds)
        </Label>
      </div>
      <Button
        onClick={() => onGenerate(storyboard, prompt, duration, promptInfluence, looping)}
        disabled={!prompt.trim() || isGenerating || !hasApiKey}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-2" />
            Generate Sound Effect
          </>
        )}
      </Button>
      {audioUrl && (
        <div className="space-y-2">
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                const link = document.createElement('a')
                link.href = audioUrl
                link.download = `sound_effect_shot_${storyboard.shot_number}_${Date.now()}.mp3`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {onSaveAudio && userId && projectId && sceneId && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={savingAudio}
                onClick={async () => {
                  setSavingAudio(true)
                  try {
                    await onSaveAudio(audioUrl, prompt)
                  } finally {
                    setSavingAudio(false)
                  }
                }}
              >
                {savingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save to Storage
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CinemaProductionPage() {
  const { session } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { ready, userId } = useAuthReady()
  
  const [projects, setProjects] = useState<Movie[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string>("")
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [selectedStoryboardId, setSelectedStoryboardId] = useState<string>("")
  const [selectedStoryboard, setSelectedStoryboard] = useState<Storyboard | null>(null)
  const [shotLists, setShotLists] = useState<ShotList[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingScenes, setLoadingScenes] = useState(false)
  const [loadingStoryboards, setLoadingStoryboards] = useState(false)
  const [loadingShots, setLoadingShots] = useState(false)
  const [viewMode, setViewMode] = useState<'sequence' | 'grid' | 'detail'>('sequence')
  
  // Leonardo API key and motion control
  const [leonardoApiKey, setLeonardoApiKey] = useState<string>("")
  const [motionControlElements, setMotionControlElements] = useState<any[]>([])
  const [isPlayingSequence, setIsPlayingSequence] = useState(false)
  
  // Generation state for each storyboard
  const [storyboardGenerations, setStoryboardGenerations] = useState<Map<string, ShotGenerationState>>(new Map())
  
  // Videos for each storyboard
  const [storyboardVideos, setStoryboardVideos] = useState<Map<string, StoryboardVideo[]>>(new Map())
  
  // Video selector dialog state
  const [videoSelectorOpen, setVideoSelectorOpen] = useState(false)
  const [selectedStoryboardForVideos, setSelectedStoryboardForVideos] = useState<string | null>(null)
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)
  
  // Toggle between image and video in detail view (per storyboard)
  const [detailViewMode, setDetailViewMode] = useState<Map<string, 'image' | 'video'>>(new Map())
  
  // Audio generation state
  const [aiSettings, setAiSettings] = useState<any[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const [audioGenerations, setAudioGenerations] = useState<Map<string, {
    type: 'dialogue' | 'sound-effect'
    prompt: string
    audioUrl: string | null
    isGenerating: boolean
    duration?: number
    prompt_influence?: number
    looping?: boolean
  }>>(new Map())

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
      loadLeonardoApiKey()
    }
  }, [session?.user, ready, userId, router, searchParams])

  useEffect(() => {
    if (selectedProjectId && ready) {
      loadScenes()
    } else {
      setScenes([])
      setSelectedSceneId("")
      // Clear storyboards when project changes
      setStoryboards([])
      setSelectedStoryboardId("")
      setSelectedStoryboard(null)
    }
  }, [selectedProjectId, ready])

  useEffect(() => {
    if (selectedSceneId && ready) {
      loadStoryboards()
    } else {
      setStoryboards([])
      setSelectedStoryboardId("")
      setSelectedStoryboard(null)
    }
  }, [selectedSceneId, ready])

  useEffect(() => {
    if (selectedStoryboardId && ready) {
      // Find and set the selected storyboard object
      const storyboard = storyboards.find(s => s.id === selectedStoryboardId)
      if (storyboard) {
        setSelectedStoryboard(storyboard)
        console.log('🎬 Set selected storyboard:', storyboard)
        console.log('🎬 Storyboard image_url:', storyboard.image_url)
      }
    } else {
      setSelectedStoryboard(null)
    }
  }, [selectedStoryboardId, storyboards])

  // Load videos for all storyboards when they change
  useEffect(() => {
    if (storyboards.length > 0 && userId) {
      storyboards.forEach(storyboard => {
        loadStoryboardVideos(storyboard.id)
      })
    }
  }, [storyboards, userId])

  // Update selected video when dialog opens (only on initial open, not on every render)
  useEffect(() => {
    if (videoSelectorOpen && selectedStoryboardForVideos) {
      const videos = storyboardVideos.get(selectedStoryboardForVideos) || []
      const storyboard = storyboards.find(s => s.id === selectedStoryboardForVideos)
      const generation = storyboardGenerations.get(selectedStoryboardForVideos)
      
      // Include current generated video if it exists and isn't in database
      const allVideos = [...videos]
      if (generation?.generatedVideoUrl && !videos.some(v => v.video_url === generation.generatedVideoUrl)) {
        allVideos.unshift({
          id: 'generated-temp',
          storyboard_id: selectedStoryboardForVideos,
          user_id: userId || '',
          video_url: generation.generatedVideoUrl,
          video_name: `${storyboard?.title || 'storyboard'}-shot-${storyboard?.shot_number} (Generated)`,
          is_default: false,
          generation_model: generation.model || null,
          generation_prompt: generation.prompt || null,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      
      const defaultVideo = allVideos.find(v => v.is_default) || allVideos[0]
      // Only set initial value if selectedVideoUrl is null or doesn't match any video
      if (!selectedVideoUrl || !allVideos.some(v => v.video_url === selectedVideoUrl)) {
        setSelectedVideoUrl(defaultVideo?.video_url || null)
      }
    } else if (!videoSelectorOpen) {
      // Reset when dialog closes
      setSelectedVideoUrl(null)
    }
  }, [videoSelectorOpen, selectedStoryboardForVideos])

  // Load AI settings for audio
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready || !userId || aiSettingsLoaded) return
      
      try {
        const settings = await AISettingsService.getSystemSettings()
        const audioSetting = await AISettingsService.getOrCreateDefaultTabSetting('audio')
        const finalSetting = settings.find(s => s.tab_type === 'audio') || audioSetting
        
        setAiSettings([finalSetting])
        setAiSettingsLoaded(true)
        
        // Load user API keys from users table
        const supabase = getSupabaseClient()
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('elevenlabs_api_key, openai_api_key, anthropic_api_key')
          .eq('id', userId)
          .maybeSingle()
        
        if (!userError && userData) {
          setUserApiKeys({
            elevenlabs_api_key: userData.elevenlabs_api_key || null,
            openai_api_key: userData.openai_api_key || null,
            anthropic_api_key: userData.anthropic_api_key || null,
          })
          console.log('✅ Loaded user API keys:', {
            hasElevenLabs: !!userData.elevenlabs_api_key,
            hasOpenAI: !!userData.openai_api_key,
            hasAnthropic: !!userData.anthropic_api_key,
          })
        } else {
          console.warn('⚠️ Could not load user API keys:', userError?.message)
          // Try system-wide key as fallback
          try {
            const response = await fetch('/api/ai/get-system-api-key?type=elevenlabs_api_key')
            if (response.ok) {
              const systemKey = await response.json()
              if (systemKey?.key) {
                setUserApiKeys({ elevenlabs_api_key: systemKey.key })
                console.log('✅ Using system-wide ElevenLabs API key')
              }
            }
          } catch (error) {
            console.error('Error fetching system API key:', error)
          }
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
        setAiSettingsLoaded(true) // Set to true even on error to prevent blocking
      }
    }
    
    loadAISettings()
  }, [ready, userId, aiSettingsLoaded])

  // Load Leonardo API key
  const loadLeonardoApiKey = async () => {
    if (!userId) return
    
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('leonardo_api_key')
        .eq('id', userId)
        .single()
      
      if (!error && data?.leonardo_api_key) {
        setLeonardoApiKey(data.leonardo_api_key)
        console.log('✅ Leonardo API key loaded')
      } else {
        console.log('⚠️ No Leonardo API key found')
      }
    } catch (error) {
      console.error('Error loading Leonardo API key:', error)
    }
  }

  // Fetch motion control elements when API key is loaded
  useEffect(() => {
    if (leonardoApiKey) {
      fetchMotionControlElements()
    }
  }, [leonardoApiKey])

  const fetchMotionControlElements = async () => {
    if (!leonardoApiKey) {
      console.log('⚠️ [LEONARDO] No API key available for fetching motion control elements')
      return
    }
    
    try {
      const endpoints = [
        'https://cloud.leonardo.ai/api/rest/v1/elements',
        'https://cloud.leonardo.ai/api/rest/v1/motion-control-elements',
        'https://cloud.leonardo.ai/api/rest/v1/generation-elements',
      ]
      
      for (const endpoint of endpoints) {
        try {
          console.log('📋 [LEONARDO] Trying endpoint:', endpoint)
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${leonardoApiKey}`,
              'Content-Type': 'application/json'
            }
          })
          
          console.log('📋 [LEONARDO] Response status:', response.status, response.statusText)
          
          if (response.ok) {
            const result = await response.json()
            console.log('📋 [LEONARDO] Raw response from', endpoint, ':', result)
            console.log('📋 [LEONARDO] Response type:', typeof result)
            console.log('📋 [LEONARDO] Is array:', Array.isArray(result))
            console.log('📋 [LEONARDO] Has elements:', !!result.elements)
            console.log('📋 [LEONARDO] Has data:', !!result.data)
            console.log('📋 [LEONARDO] Keys:', Object.keys(result))
            
            // Try different response structures
            let elements: any[] = []
            
            if (Array.isArray(result)) {
              elements = result
            } else if (result.elements && Array.isArray(result.elements)) {
              elements = result.elements
            } else if (result.data && Array.isArray(result.data)) {
              elements = result.data
            } else if (result.motionControlElements && Array.isArray(result.motionControlElements)) {
              elements = result.motionControlElements
            } else if (result.results && Array.isArray(result.results)) {
              elements = result.results
            } else {
              // Try to find any array in the response
              for (const key of Object.keys(result)) {
                if (Array.isArray(result[key])) {
                  elements = result[key]
                  console.log('📋 [LEONARDO] Found array in key:', key)
                  break
                }
              }
            }
            
            // Filter for motion control elements (they might be mixed with other element types)
            // Motion control elements typically have names like "DOLLY_OUT", "PAN_DOWN", etc.
            const motionElements = elements.filter((el: any) => {
              const name = (el.name || el.title || el.title || '').toUpperCase()
              const motionKeywords = ['DOLLY', 'PAN', 'TILT', 'ZOOM', 'CRANE', 'TRACK', 'PUSH', 'ROTATE', 'ORBIT', 'ROLL', 'FADE', 'BULLET', 'CRASH', 'EYES', 'DISINTEGRATION', 'EXPLOSION', 'DUTCH']
              return motionKeywords.some(keyword => name.includes(keyword))
            })
            
            if (motionElements.length > 0) {
              console.log('✅ [LEONARDO] Found', motionElements.length, 'motion control elements from', endpoint)
              setMotionControlElements(motionElements)
              
              // Log all available motion control elements for debugging
              console.log('📋 [LEONARDO] Available motion control elements:', motionElements.map((el: any) => ({
                name: el.name || el.title,
                uuid: el.akUUID || el.id || el.uuid,
                type: el.type
              })))
              return
            } else if (elements.length > 0) {
              // If we got elements but none match motion keywords, use all of them
              console.log('⚠️ [LEONARDO] Found', elements.length, 'elements but none match motion keywords, using all')
              setMotionControlElements(elements)
              console.log('📋 [LEONARDO] All elements:', elements.map((el: any) => ({
                name: el.name || el.title,
                uuid: el.akUUID || el.id || el.uuid
              })))
              return
            } else {
              console.log('⚠️ [LEONARDO] No elements found in response from', endpoint)
            }
          } else {
            const errorText = await response.text().catch(() => 'Unable to read error')
            console.log('⚠️ [LEONARDO] Endpoint', endpoint, 'returned error:', response.status, errorText)
          }
        } catch (err) {
          console.error('❌ [LEONARDO] Error fetching from', endpoint, ':', err)
          continue
        }
      }
      
      console.log('ℹ️ [LEONARDO] Could not fetch motion control elements from any API endpoint - will use hardcoded UUIDs (may be incorrect)')
    } catch (error) {
      console.error('❌ [LEONARDO] Error fetching motion control elements:', error)
    }
  }

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

  const loadScenes = async () => {
    if (!selectedProjectId) return
    
    try {
      setLoadingScenes(true)
      console.log('🎬 Loading scenes for project:', selectedProjectId)
      const projectScenes = await TimelineService.getMovieScenes(selectedProjectId)
      console.log('🎬 Loaded scenes:', projectScenes.length, projectScenes)
      setScenes(projectScenes)
      
      // If only one scene, auto-select it
      if (projectScenes.length === 1) {
        setSelectedSceneId(projectScenes[0].id)
      }
    } catch (error) {
      console.error('Error loading scenes:', error)
      toast({
        title: "Error",
        description: "Failed to load scenes.",
        variant: "destructive"
      })
    } finally {
      setLoadingScenes(false)
    }
  }

  const loadStoryboards = async () => {
    if (!selectedSceneId || !userId) return
    
    try {
      setLoadingStoryboards(true)
      console.log('🎬 Loading storyboards for scene:', selectedSceneId)
      const sceneStoryboards = await StoryboardsService.getStoryboardsByScene(selectedSceneId)
      console.log('🎬 Loaded storyboards:', sceneStoryboards.length, sceneStoryboards)
      setStoryboards(sceneStoryboards)
      
      // Check for saved videos in the bucket for each storyboard
      // Only check bucket if we have a selected project to filter by
      if (selectedProjectId) {
        try {
          const supabase = getSupabaseClient()
          
          // Check bucket directly for saved videos - filter by project ID
          const videoPath = `${selectedProjectId}/videos/`
          const { data: videoFiles, error: bucketError } = await supabase.storage
            .from('cinema_files')
            .list(videoPath, {
              limit: 100,
              sortBy: { column: 'created_at', order: 'desc' }
            })
          
          if (!bucketError && videoFiles && videoFiles.length > 0) {
            console.log('🎬 Found', videoFiles.length, 'saved videos in bucket for project:', selectedProjectId)
            
            // Try to match videos to storyboards by filename pattern
            // Filename format: {timestamp}-{storyboard-title}-shot-{shot_number}.mp4
            videoFiles.forEach(file => {
              const fileName = file.name
              // Try to extract storyboard info from filename
              // Look for storyboards that might match this video
              sceneStoryboards.forEach(storyboard => {
                const titleMatch = fileName.toLowerCase().includes(storyboard.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || '')
                const shotMatch = fileName.includes(`shot-${storyboard.shot_number}`) || fileName.includes(`shot${storyboard.shot_number}`)
                
                if (titleMatch || shotMatch) {
                  const videoUrl = supabase.storage
                    .from('cinema_files')
                    .getPublicUrl(`${videoPath}${fileName}`).data.publicUrl
                  
                  const currentGen = storyboardGenerations.get(storyboard.id)
                  if (!currentGen?.generatedVideoUrl || !currentGen.generatedVideoUrl.includes('cinema_files')) {
                    // Only update if we don't already have a bucket URL
                    updateStoryboardGeneration(storyboard.id, {
                      generatedVideoUrl: videoUrl,
                      generationStatus: "Saved"
                    })
                    console.log(`✅ Loaded saved video for storyboard ${storyboard.id} from bucket:`, videoUrl?.substring(0, 50) + '...')
                  }
                }
              })
            })
          } else if (bucketError) {
            console.log('⚠️ Could not check bucket for saved videos (non-critical):', bucketError.message)
          }
        } catch (error) {
          console.error('Error loading saved videos from bucket:', error)
          // Don't fail the whole load if bucket check fails
        }
      }
      
      // Clear storyboard selection when scene changes
      setSelectedStoryboardId("")
      setSelectedStoryboard(null)
    } catch (error) {
      console.error('Error loading storyboards:', error)
      toast({
        title: "Error",
        description: "Failed to load storyboards.",
        variant: "destructive"
      })
    } finally {
      setLoadingStoryboards(false)
    }
  }

  // Get filtered storyboards based on selection
  const getDisplayedStoryboards = (): Storyboard[] => {
    if (selectedStoryboardId) {
      // If a specific storyboard is selected, show only that one
      const storyboard = storyboards.find(s => s.id === selectedStoryboardId)
      return storyboard ? [storyboard] : []
    }
    // Otherwise show all storyboards for the scene
    // Filter by selected project to ensure we only show storyboards from the current project
    let filtered = storyboards
    if (selectedProjectId) {
      filtered = storyboards.filter(sb => sb.project_id === selectedProjectId)
    }
    return filtered
  }

  const getModelFileRequirement = (model: VideoModel): 'none' | 'image' | 'video' | 'start-end-frames' => {
    switch (model) {
      case "Kling T2V":
        return 'none'
      case "Kling I2V":
        return 'image'
      case "Kling I2V Extended":
        return 'start-end-frames'
      case "Kling 2.1 Pro (Frame-to-Frame)":
      case "Veo 3.1 (Frame-to-Frame)":
      case "Veo 3.1 Fast (Frame-to-Frame)":
        return 'start-end-frames'
      case "Runway Gen-4 Turbo":
      case "Runway Gen-3A Turbo":
        return 'image'
      case "Runway Act-Two":
      case "Runway Gen-4 Aleph":
        return 'video'
      case "Leonardo Motion 2.0":
        return 'image'
      default:
        return 'none'
    }
  }

  const updateStoryboardGeneration = (storyboardId: string, updates: Partial<ShotGenerationState>) => {
    setStoryboardGenerations(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(storyboardId) || {
        shotId: storyboardId,
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
        generationStatus: null,
        motionControl: "",
        motionStrength: 2,
        videoModelType: undefined,
        videoDuration: undefined,
        startFrameImageUrl: null,
        endFrameImageUrl: null
      }
      newMap.set(storyboardId, { ...current, ...updates })
      return newMap
    })
  }

  const handleFileUpload = (storyboardId: string, file: File, type: 'file' | 'startFrame' | 'endFrame') => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const preview = e.target?.result as string
      if (type === 'file') {
        updateStoryboardGeneration(storyboardId, { uploadedFile: file, filePreview: preview })
      } else if (type === 'startFrame') {
        updateStoryboardGeneration(storyboardId, { startFrame: file, startFramePreview: preview })
      } else if (type === 'endFrame') {
        updateStoryboardGeneration(storyboardId, { endFrame: file, endFramePreview: preview })
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveFile = (storyboardId: string, type: 'file' | 'startFrame' | 'endFrame') => {
    if (type === 'file') {
      updateStoryboardGeneration(storyboardId, { uploadedFile: null, filePreview: null })
    } else if (type === 'startFrame') {
      updateStoryboardGeneration(storyboardId, { startFrame: null, startFramePreview: null })
    } else if (type === 'endFrame') {
      updateStoryboardGeneration(storyboardId, { endFrame: null, endFramePreview: null })
    }
  }

  const buildPromptFromStoryboard = (storyboard: Storyboard): string => {
    const parts: string[] = []
    
    if (storyboard.description) parts.push(storyboard.description)
    if (storyboard.action) parts.push(`Action: ${storyboard.action}`)
    if (storyboard.visual_notes) parts.push(`Visual: ${storyboard.visual_notes}`)
    if (storyboard.dialogue) parts.push(`Dialogue: ${storyboard.dialogue}`)
    
    return parts.join('. ') || `Shot ${storyboard.shot_number}: ${storyboard.shot_type} ${storyboard.camera_angle} ${storyboard.movement}`
  }

  const handleDownloadVideo = async (videoUrl: string, storyboard: Storyboard) => {
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${storyboard.title || 'storyboard'}-shot-${storyboard.shot_number}-${Date.now()}.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({
        title: "Download Started",
        description: "Video download has started.",
      })
    } catch (error) {
      console.error('Error downloading video:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download video. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSaveVideo = async (videoUrl: string, storyboard: Storyboard) => {
    if (!userId) {
      toast({
        title: "Error",
        description: "You must be logged in to save videos.",
        variant: "destructive"
      })
      return
    }

    try {
      const generation = storyboardGenerations.get(storyboard.id)
      updateStoryboardGeneration(storyboard.id, { generationStatus: "Saving video..." })
      
      const fileName = `${storyboard.title || 'storyboard'}-shot-${storyboard.shot_number}`
      
      // First, save to bucket
      const bucketResponse = await fetch('/api/ai/download-and-store-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl,
          fileName,
          userId,
        }),
      })

      const bucketResult = await bucketResponse.json()

      if (!bucketResponse.ok || !bucketResult.success) {
        throw new Error(bucketResult.error || "Failed to save video to bucket")
      }

      const savedVideoUrl = bucketResult.supabaseUrl || videoUrl

      // Then, save to database
      const dbResponse = await fetch('/api/storyboard-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storyboardId: storyboard.id,
          videoUrl: savedVideoUrl,
          videoName: fileName,
          generationModel: generation?.model || null,
          generationPrompt: generation?.prompt || null,
          metadata: {
            duration: generation?.duration,
            resolution: generation?.resolution,
          },
          isDefault: false, // New videos are not default by default
        }),
      })

      const dbResult = await dbResponse.json()

      if (!dbResponse.ok || !dbResult.success) {
        console.warn('Failed to save video to database, but bucket save succeeded:', dbResult.error)
        // Still update UI with bucket URL
        if (savedVideoUrl) {
          updateStoryboardGeneration(storyboard.id, { 
            generationStatus: "Saved",
            generatedVideoUrl: savedVideoUrl
          })
        }
        toast({
          title: "Video Saved to Storage",
          description: "Video saved to bucket but not registered in database.",
        })
        return
      }

      // Reload videos for this storyboard
      await loadStoryboardVideos(storyboard.id)

      // Update the generatedVideoUrl to use the saved bucket URL
      if (savedVideoUrl) {
        updateStoryboardGeneration(storyboard.id, { 
          generationStatus: "Saved",
          generatedVideoUrl: savedVideoUrl
        })
        console.log('✅ Video saved and URL updated to bucket:', savedVideoUrl)
      } else {
        updateStoryboardGeneration(storyboard.id, { generationStatus: "Saved" })
      }
      
      toast({
        title: "Video Saved",
        description: "Video has been saved to your storage.",
      })
    } catch (error) {
      console.error('Error saving video:', error)
      updateStoryboardGeneration(storyboard.id, { generationStatus: "Save failed" })
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save video. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Load videos for a storyboard
  const loadStoryboardVideos = async (storyboardId: string) => {
    if (!userId) return

    try {
      const response = await fetch(`/api/storyboard-videos?storyboardId=${storyboardId}`)
      const result = await response.json()

      if (response.ok && result.success) {
        const videos = result.data || []
        console.log(`📹 Loaded ${videos.length} videos for storyboard ${storyboardId}:`, videos.map(v => ({ id: v.id, name: v.video_name, isDefault: v.is_default })))
        setStoryboardVideos(prev => {
          const newMap = new Map(prev)
          newMap.set(storyboardId, videos)
          return newMap
        })

        // Update generatedVideoUrl to default video if available
        const defaultVideo = videos.find((v: StoryboardVideo) => v.is_default)
        if (defaultVideo) {
          const generation = storyboardGenerations.get(storyboardId)
          if (!generation?.generatedVideoUrl || !generation.generatedVideoUrl.includes('cinema_files')) {
            updateStoryboardGeneration(storyboardId, {
              generatedVideoUrl: defaultVideo.video_url
            })
          }
        }
      }
    } catch (error) {
      console.error('Error loading storyboard videos:', error)
    }
  }

  // Set video as default
  const handleSetDefaultVideo = async (videoId: string, storyboardId: string) => {
    if (!userId) return

    try {
      const response = await fetch('/api/storyboard-videos', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          isDefault: true,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        await loadStoryboardVideos(storyboardId)
        toast({
          title: "Default Video Set",
          description: "This video is now the default for this storyboard.",
        })
      } else {
        throw new Error(result.error || "Failed to set default video")
      }
    } catch (error) {
      console.error('Error setting default video:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set default video.",
        variant: "destructive",
      })
    }
  }

  // Generate dialogue audio (text-to-speech)
  const handleGenerateDialogue = async (storyboard: Storyboard, text: string) => {
    if (!userId || !userApiKeys.elevenlabs_api_key) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key in Settings.",
        variant: "destructive",
      })
      return
    }

    const audioKey = `${storyboard.id}-dialogue`
    setAudioGenerations(prev => {
      const newMap = new Map(prev)
      newMap.set(audioKey, {
        type: 'dialogue',
        prompt: text,
        audioUrl: null,
        isGenerating: true,
      })
      return newMap
    })

    try {
      const response = await fetch('/api/ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: "21m00Tcm4TlvDq8ikWAM", // Default voice
          apiKey: userApiKeys.elevenlabs_api_key,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate speech`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      setAudioGenerations(prev => {
        const newMap = new Map(prev)
        newMap.set(audioKey, {
          type: 'dialogue',
          prompt: text,
          audioUrl,
          isGenerating: false,
        })
        return newMap
      })

      toast({
        title: "Dialogue Generated",
        description: "Audio has been generated successfully!",
      })
    } catch (error) {
      console.error('Error generating dialogue:', error)
      setAudioGenerations(prev => {
        const newMap = new Map(prev)
        newMap.set(audioKey, {
          type: 'dialogue',
          prompt: text,
          audioUrl: null,
          isGenerating: false,
        })
        return newMap
      })
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate dialogue.",
        variant: "destructive",
      })
    }
  }

  // Generate sound effect
  const handleGenerateSoundEffect = async (
    storyboard: Storyboard,
    prompt: string,
    duration?: number,
    prompt_influence?: number,
    looping?: boolean
  ) => {
    if (!userId || !userApiKeys.elevenlabs_api_key) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key in Settings.",
        variant: "destructive",
      })
      return
    }

    const audioKey = `${storyboard.id}-sound-effect`
    setAudioGenerations(prev => {
      const newMap = new Map(prev)
      newMap.set(audioKey, {
        type: 'sound-effect',
        prompt,
        audioUrl: null,
        isGenerating: true,
        duration,
        prompt_influence,
        looping,
      })
      return newMap
    })

    try {
      const response = await fetch('/api/ai/sound-effects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: prompt.trim(),
          duration,
          prompt_influence,
          looping,
          apiKey: userApiKeys.elevenlabs_api_key,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('🔊 Sound effects API error:', {
          status: response.status,
          error: errorText,
          prompt: prompt.substring(0, 50)
        })
        
        // If 404, provide helpful error message
        if (response.status === 404) {
          throw new Error(`Sound Effects API not available. This feature may require a specific ElevenLabs subscription tier. Please check your ElevenLabs account or use dialogue generation instead.`)
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      setAudioGenerations(prev => {
        const newMap = new Map(prev)
        newMap.set(audioKey, {
          type: 'sound-effect',
          prompt,
          audioUrl,
          isGenerating: false,
          duration,
          prompt_influence,
          looping,
        })
        return newMap
      })

      toast({
        title: "Sound Effect Generated",
        description: "Audio has been generated successfully!",
      })
    } catch (error) {
      console.error('Error generating sound effect:', error)
      setAudioGenerations(prev => {
        const newMap = new Map(prev)
        newMap.set(audioKey, {
          type: 'sound-effect',
          prompt,
          audioUrl: null,
          isGenerating: false,
          duration,
          prompt_influence,
          looping,
        })
        return newMap
      })
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate sound effect.",
        variant: "destructive",
      })
    }
  }

  // Save audio to storage
  const handleSaveAudio = async (audioUrl: string, prompt: string, type: 'dialogue' | 'sound-effect' = 'sound-effect', storyboard?: Storyboard) => {
    if (!userId || !selectedProjectId || !selectedSceneId || !storyboard) {
      toast({
        title: "Missing Information",
        description: "Please select a project and scene.",
        variant: "destructive",
      })
      return
    }

    try {
      // Convert blob URL to blob
      const response = await fetch(audioUrl)
      const audioBlob = await response.blob()
      
      // Convert blob to base64 for API
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Audio = reader.result as string
        const audioBlobForApi = base64Audio.split(',')[1] // Remove data:audio/mpeg;base64, prefix
        
        const saveResponse = await fetch('/api/ai/save-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audioBlob: audioBlobForApi,
            fileName: `${type}_shot_${storyboard.shot_number}_${Date.now()}`,
            audioTitle: `${type === 'dialogue' ? 'Dialogue' : 'Sound Effect'} - Shot ${storyboard.shot_number}: ${storyboard.title || 'Untitled'}`,
            projectId: selectedProjectId,
            sceneId: selectedSceneId,
            userId: userId,
            metadata: {
              storyboard_id: storyboard.id,
              shot_number: storyboard.shot_number,
              type: type,
              prompt: prompt
            }
          })
        })
        
        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to save audio')
        }
        
        toast({
          title: "Audio Saved",
          description: `${type === 'dialogue' ? 'Dialogue' : 'Sound effect'} audio has been saved to storage.`,
        })
      }
      reader.readAsDataURL(audioBlob)
    } catch (error) {
      console.error('Error saving audio:', error)
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save audio.",
        variant: "destructive",
      })
    }
  }

  // Unset default video
  const handleUnsetDefaultVideo = async (videoId: string, storyboardId: string) => {
    if (!userId) return

    try {
      const response = await fetch('/api/storyboard-videos', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          isDefault: false,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        await loadStoryboardVideos(storyboardId)
        toast({
          title: "Default Removed",
          description: "Default video has been removed.",
        })
      } else {
        throw new Error(result.error || "Failed to remove default video")
      }
    } catch (error) {
      console.error('Error removing default video:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove default video.",
        variant: "destructive",
      })
    }
  }

  const handleGenerateVideo = async (storyboard: Storyboard) => {
    const generation = storyboardGenerations.get(storyboard.id)
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
    // For image models, check if we have uploadedFile OR storyboard image_url
    if (fileRequirement === 'image' && !generation.uploadedFile && !storyboard.image_url) {
      toast({
        title: "Missing Image",
        description: `${generation.model} requires an image. Please upload an image or use the storyboard image.`,
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
    
    if (fileRequirement === 'start-end-frames') {
      // For Kling/Veo frame-to-frame, start frame is required, end frame is optional
      const isKlingVeoFrameToFrame = generation.model === "Kling 2.1 Pro (Frame-to-Frame)" || 
                                     generation.model === "Veo 3.1 (Frame-to-Frame)" || 
                                     generation.model === "Veo 3.1 Fast (Frame-to-Frame)"
      
      if (isKlingVeoFrameToFrame) {
        // Start frame required (can be from file or image URL)
        if (!generation.startFrame && !generation.startFrameImageUrl && !storyboard.image_url) {
          toast({
            title: "Missing Start Frame",
            description: `${generation.model} requires at least a start frame. End frame is optional.`,
            variant: "destructive"
          })
          return
        }
      } else {
        // For other models, both frames required
        if (!generation.startFrame || !generation.endFrame) {
          toast({
            title: "Missing Frames",
            description: `${generation.model} requires both start and end frames.`,
            variant: "destructive"
          })
          return
        }
      }
    }

    updateStoryboardGeneration(storyboard.id, { isGenerating: true, generationStatus: "Starting generation..." })

    try {
      // Handle Leonardo Motion 2.0
      if (generation.model === "Leonardo Motion 2.0") {
        // Get API key - try state first, then fetch from database if needed
        let apiKeyToUse = leonardoApiKey
        if (!apiKeyToUse && userId) {
          console.log('⚠️ Leonardo API key not in state, fetching from database...')
          try {
            const supabase = getSupabaseClient()
            const { data, error } = await supabase
              .from('users')
              .select('leonardo_api_key')
              .eq('id', userId)
              .single()
            
            if (!error && data?.leonardo_api_key) {
              apiKeyToUse = data.leonardo_api_key
              setLeonardoApiKey(apiKeyToUse) // Update state for future use
              console.log('✅ Leonardo API key loaded from database')
            } else {
              console.error('❌ Leonardo API key not found in database')
              toast({
                title: "API Key Required",
                description: "Please set your Leonardo API key in settings.",
                variant: "destructive"
              })
              updateStoryboardGeneration(storyboard.id, {
                isGenerating: false,
                generationStatus: "Failed - API key required"
              })
              return
            }
          } catch (error) {
            console.error('❌ Error fetching Leonardo API key:', error)
            toast({
              title: "API Key Error",
              description: "Failed to load Leonardo API key. Please refresh the page.",
              variant: "destructive"
            })
            updateStoryboardGeneration(storyboard.id, {
              isGenerating: false,
              generationStatus: "Failed - API key error"
            })
            return
          }
        }
        
        if (!apiKeyToUse) {
          toast({
            title: "API Key Required",
            description: "Please set your Leonardo API key in settings.",
            variant: "destructive"
          })
          updateStoryboardGeneration(storyboard.id, {
            isGenerating: false,
            generationStatus: "Failed - API key required"
          })
          return
        }

        // Use uploaded file or storyboard image_url
        let imageToUse: File | string | null = generation.uploadedFile || storyboard.image_url || null
        
        if (!imageToUse) {
          toast({
            title: "Image Required",
            description: "Leonardo Motion 2.0 requires an image. Please upload an image or use a storyboard with an image.",
            variant: "destructive"
          })
          updateStoryboardGeneration(storyboard.id, {
            isGenerating: false,
            generationStatus: "Failed - Image required"
          })
          return
        }

        updateStoryboardGeneration(storyboard.id, { generationStatus: "Uploading image..." })

        // Step 1: Upload image to Leonardo
        let imageId: string
        
        if (typeof imageToUse === 'string') {
          // Storyboard image_url - download and upload to Leonardo
          console.log('📸 [LEONARDO] Using storyboard image_url:', imageToUse)
          const imageResponse = await fetch(imageToUse)
          if (!imageResponse.ok) {
            throw new Error('Failed to download storyboard image')
          }
          const imageBlob = await imageResponse.blob()
          
          // Extract extension from URL
          const urlPath = new URL(imageToUse).pathname
          const urlExtension = urlPath.split('.').pop()?.toLowerCase() || 'png'
          const validExtensions = ['png', 'jpg', 'jpeg', 'webp']
          const fileExtension = validExtensions.includes(urlExtension) ? urlExtension : 'png'
          
          const imageFile = new File([imageBlob], `storyboard-image.${fileExtension}`, { type: imageBlob.type || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}` })
          
          console.log('📸 [LEONARDO] File extension:', fileExtension)
          
          const imageFormData = new FormData()
          imageFormData.append('file', imageFile)
          imageFormData.append('extension', fileExtension)
          
          const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKeyToUse}`,
            },
            body: imageFormData
          })

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text()
            throw new Error(`Failed to upload image to Leonardo: ${errorText}`)
          }

          const uploadResult = await uploadResponse.json()
          console.log('📸 [LEONARDO] Upload response:', uploadResult)
          
          imageId = uploadResult.uploadInitImage?.id || uploadResult.id || uploadResult.initImageId || uploadResult.imageId
          if (!imageId) {
            throw new Error('Failed to get image ID from Leonardo')
          }
          console.log('✅ [LEONARDO] Storyboard image uploaded, imageId:', imageId)
          
          // If we have S3 upload fields, upload the file to S3
          if (uploadResult.uploadInitImage?.fields && uploadResult.uploadInitImage?.url) {
            console.log('📸 [LEONARDO] Uploading file to S3...')
            try {
              const s3Fields = JSON.parse(uploadResult.uploadInitImage.fields)
              const s3FormData = new FormData()
              
              // Add all S3 fields
              Object.keys(s3Fields).forEach(key => {
                s3FormData.append(key, s3Fields[key])
              })
              
              // Add the file last (S3 requirement)
              s3FormData.append('file', imageFile)
              
              // Upload through our API route to avoid CORS issues
              const s3Response = await fetch('/api/leonardo/upload-s3', {
                method: 'POST',
                headers: {
                  'x-s3-url': uploadResult.uploadInitImage.url,
                },
                body: s3FormData
              })
              
              if (!s3Response.ok) {
                const errorData = await s3Response.json()
                console.error('📸 [LEONARDO] S3 upload failed:', s3Response.status, errorData)
                throw new Error(`Failed to upload file to S3: ${s3Response.status}`)
              }
              
              console.log('✅ [LEONARDO] File uploaded to S3 successfully')
              // Wait for S3 to process and image to be available
              console.log('⏳ [LEONARDO] Waiting for image to be processed (5 seconds)...')
              await new Promise(resolve => setTimeout(resolve, 5000))
            } catch (s3Error) {
              console.error('📸 [LEONARDO] S3 upload error:', s3Error)
              // Continue anyway - the image ID might still work
              console.log('⏳ [LEONARDO] Waiting for image processing (3 seconds)...')
              await new Promise(resolve => setTimeout(resolve, 3000))
            }
          } else {
            // Delay to allow API to process the uploaded image
            console.log('⏳ [LEONARDO] Waiting for image processing (3 seconds)...')
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        } else {
          // Uploaded file
          console.log('📸 [LEONARDO] Using uploaded file')
          
          // Extract file extension from filename
          const fileName = imageToUse.name
          const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
          console.log('📸 [LEONARDO] File extension:', fileExtension)
          
          const imageFormData = new FormData()
          imageFormData.append('file', imageToUse)
          imageFormData.append('extension', fileExtension)

          const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKeyToUse}`,
            },
            body: imageFormData
          })

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text()
            throw new Error(`Failed to upload image to Leonardo: ${errorText}`)
          }

          const uploadResult = await uploadResponse.json()
          console.log('📸 [LEONARDO] Upload response:', uploadResult)
          
          imageId = uploadResult.uploadInitImage?.id || uploadResult.id || uploadResult.initImageId || uploadResult.imageId
          if (!imageId) {
            throw new Error('Failed to get image ID from Leonardo')
          }
          console.log('✅ [LEONARDO] Uploaded file, imageId:', imageId)
          
          // If we have S3 upload fields, upload the file to S3
          if (uploadResult.uploadInitImage?.fields && uploadResult.uploadInitImage?.url) {
            console.log('📸 [LEONARDO] Uploading file to S3...')
            try {
              const s3Fields = JSON.parse(uploadResult.uploadInitImage.fields)
              const s3FormData = new FormData()
              
              // Add all S3 fields
              Object.keys(s3Fields).forEach(key => {
                s3FormData.append(key, s3Fields[key])
              })
              
              // Add the file last (S3 requirement)
              s3FormData.append('file', imageToUse)
              
              // Upload through our API route to avoid CORS issues
              const s3Response = await fetch('/api/leonardo/upload-s3', {
                method: 'POST',
                headers: {
                  'x-s3-url': uploadResult.uploadInitImage.url,
                },
                body: s3FormData
              })
              
              if (!s3Response.ok) {
                const errorData = await s3Response.json()
                console.error('📸 [LEONARDO] S3 upload failed:', s3Response.status, errorData)
                throw new Error(`Failed to upload file to S3: ${s3Response.status}`)
              }
              
              console.log('✅ [LEONARDO] File uploaded to S3 successfully')
              // Wait for S3 to process and image to be available
              console.log('⏳ [LEONARDO] Waiting for image to be processed (5 seconds)...')
              await new Promise(resolve => setTimeout(resolve, 5000))
            } catch (s3Error) {
              console.error('📸 [LEONARDO] S3 upload error:', s3Error)
              // Continue anyway - the image ID might still work
              console.log('⏳ [LEONARDO] Waiting for image processing (3 seconds)...')
              await new Promise(resolve => setTimeout(resolve, 3000))
            }
          } else {
            // Delay to allow API to process the uploaded image
            console.log('⏳ [LEONARDO] Waiting for image processing (3 seconds)...')
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }

        updateStoryboardGeneration(storyboard.id, { generationStatus: "Generating video..." })

        // Step 2: Generate video with Motion 2.0
        // Use image-to-video endpoint if motion control is selected, otherwise use motion-svd
        const useImageToVideo = !!generation.motionControl
        let endpoint: string
        let requestBody: any

        if (useImageToVideo) {
          // Image-to-video endpoint supports motion control
          endpoint = 'https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video'
          requestBody = {
            imageId: imageId,
            imageType: "UPLOADED",
          }

          if (generation.prompt.trim()) {
            requestBody.prompt = generation.prompt.trim()
          }

          // Add motion control if selected
          if (generation.motionControl) {
            let motionControlUUID: string | null = null

            // Try to find UUID from fetched motion control elements
            if (motionControlElements.length > 0) {
              console.log('🔍 [LEONARDO] Searching for motion control:', generation.motionControl)
              console.log('🔍 [LEONARDO] Available elements:', motionControlElements.length)
              
              // Try exact match first
              let element = motionControlElements.find((el: any) => {
                const name = (el.name || el.title || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')
                return name === generation.motionControl
              })
              
              // If no exact match, try partial match
              if (!element) {
                element = motionControlElements.find((el: any) => {
                  const name = (el.name || el.title || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')
                  const controlName = generation.motionControl?.toUpperCase().replace(/[^A-Z0-9]/g, '_') || ''
                  return name.includes(controlName) || controlName.includes(name.replace('_', ''))
                })
              }
              
              if (element) {
                motionControlUUID = element.akUUID || element.id || element.uuid
                console.log('✅ [LEONARDO] Found motion control UUID from API:', motionControlUUID, 'for:', element.name || element.title)
              } else {
                console.warn('⚠️ [LEONARDO] Motion control element not found in API response:', generation.motionControl)
                console.warn('⚠️ [LEONARDO] Available element names:', motionControlElements.map((el: any) => el.name || el.title))
              }
            } else {
              console.warn('⚠️ [LEONARDO] No motion control elements fetched from API')
            }

            // Fallback to hardcoded UUIDs (only if API fetch failed)
            // Note: These UUIDs may be incorrect - prefer using API-fetched elements
            if (!motionControlUUID) {
              console.warn('⚠️ [LEONARDO] Motion control UUID not found from API, using fallback (may be incorrect)')
              console.warn('⚠️ [LEONARDO] Motion control:', generation.motionControl)
              console.warn('⚠️ [LEONARDO] Available motion control elements:', motionControlElements.length)
              
              // Only use hardcoded UUIDs as last resort - these are likely incorrect
              // The API should provide the correct UUIDs
              const motionControlUUIDs: Record<string, string> = {
                'DOLLY_OUT': '74bea0cc-9942-4d45-9977-28c25078bfd4', // May need verification
                'DOLLY_IN': 'ece8c6a9-3deb-430e-8c93-4d5061b6adbf',
                'TILT_UP': '6ad6de1f-bd15-4d0b-ae0e-81d1a4c6c085',
                'ORBIT_LEFT': '74bea0cc-9942-4d45-9977-28c25078bfd4', // May need verification
                // Note: Most other UUIDs are missing - need to fetch from API
                // See: https://docs.leonardo.ai/docs/generate-with-motion-20-using-generated-images
              }
              motionControlUUID = motionControlUUIDs[generation.motionControl] || null
              
              if (!motionControlUUID) {
                console.error('❌ [LEONARDO] No UUID found for motion control:', generation.motionControl)
                console.error('❌ [LEONARDO] Motion control will not be applied')
                console.error('❌ [LEONARDO] Please ensure motion control elements are fetched from API')
              }
            }

            if (motionControlUUID) {
              if (!requestBody.elements) {
                requestBody.elements = []
              }
              requestBody.elements.push({
                akUUID: motionControlUUID,
                weight: 1
              })
            }
          }
        } else {
          // Motion SVD endpoint (Motion 2.0 default)
          endpoint = 'https://cloud.leonardo.ai/api/rest/v1/generations-motion-svd'
          requestBody = {
            imageId: imageId,
            motionStrength: generation.motionStrength || 2,
            isInitImage: true,
          }
        }

        console.log('🎬 [LEONARDO] Generating video with endpoint:', endpoint)
        console.log('🎬 [LEONARDO] Request body:', JSON.stringify(requestBody, null, 2))
        
        const videoResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeyToUse}`,
          },
          body: JSON.stringify(requestBody)
        })

        if (!videoResponse.ok) {
          const errorText = await videoResponse.text()
          console.error('❌ [LEONARDO] Video generation failed:', errorText)
          
          // If image-to-video failed with metadata error, try motion-svd instead
          if (useImageToVideo && errorText.includes('metadata')) {
            console.log('⚠️ [LEONARDO] Image-to-video failed, falling back to motion-svd...')
            endpoint = 'https://cloud.leonardo.ai/api/rest/v1/generations-motion-svd'
            requestBody = {
              imageId: imageId,
              motionStrength: generation.motionStrength || 2,
              isInitImage: true,
            }
            
            if (generation.prompt.trim()) {
              console.log('⚠️ [LEONARDO] Note: motion-svd does not accept prompt, but motion control will not be applied')
            }
            
            const retryResponse = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeyToUse}`,
              },
              body: JSON.stringify(requestBody)
            })
            
            if (!retryResponse.ok) {
              const retryErrorText = await retryResponse.text()
              throw new Error(`Leonardo API error (motion-svd fallback): ${retryErrorText}`)
            }
            
            const retryResult = await retryResponse.json()
            const generationId = retryResult.sdGenerationJob?.generationId || retryResult.generationId
            if (!generationId) {
              throw new Error('Failed to get generation ID from Leonardo (motion-svd fallback)')
            }
            
            // Use the same polling logic as below
            updateStoryboardGeneration(storyboard.id, { generationStatus: "Polling for video..." })
            
            const pollForVideoFallback = async () => {
              let attempts = 0
              const maxAttempts = 60
              
              const poll = async () => {
                try {
                  attempts++
                  const statusResponse = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
                    headers: {
                      'Authorization': `Bearer ${apiKeyToUse}`,
                      'Content-Type': 'application/json'
                    }
                  })

                  if (statusResponse.ok) {
                    const statusResult = await statusResponse.json()
                    const generation = statusResult.generations_by_pk || statusResult
                    const jobStatus = generation.status || statusResult.status
                    const generatedImage = generation.generated_images?.[0] || statusResult.generated_images?.[0]
                    const videoUrl = generatedImage?.motionMP4URL || statusResult.motionSvdGenerationJob?.motionMP4URL
                    
                    if (jobStatus === 'COMPLETE' || jobStatus === 'complete' || jobStatus === 'COMPLETED') {
                      if (videoUrl) {
                        updateStoryboardGeneration(storyboard.id, {
                          isGenerating: false,
                          generatedVideoUrl: videoUrl,
                          generationStatus: "Completed"
                        })
                        toast({
                          title: "Success",
                          description: "Video generated successfully!",
                        })
                        return
                      }
                    } else if (jobStatus === 'FAILED' || jobStatus === 'failed') {
                      updateStoryboardGeneration(storyboard.id, {
                        isGenerating: false,
                        generationStatus: "Failed"
                      })
                      toast({
                        title: "Generation Failed",
                        description: "Video generation failed. Please try again.",
                        variant: "destructive"
                      })
                      return
                    }
                  }
                  
                  if (attempts < maxAttempts) {
                    setTimeout(poll, 5000)
                  } else {
                    updateStoryboardGeneration(storyboard.id, {
                      isGenerating: false,
                      generationStatus: "Processing - check back soon"
                    })
                    toast({
                      title: "Generation Started",
                      description: "Video generation is in progress. Check back in a few minutes.",
                    })
                  }
                } catch (error) {
                  console.error('❌ [LEONARDO] Error polling:', error)
                  if (attempts < maxAttempts) {
                    setTimeout(poll, 5000)
                  }
                }
              }
              
              setTimeout(poll, 5000)
            }
            
            pollForVideoFallback()
            return
          }
          
          throw new Error(`Leonardo API error: ${errorText}`)
        }

        const videoResult = await videoResponse.json()
        console.log('🎬 [LEONARDO] Video generation response:', videoResult)
        
        // Extract generation ID - check multiple possible response structures
        const generationId = videoResult.imageToVideoGenerationJob?.id ||
                             videoResult.imageToVideoGenerationJob?.generationId ||
                             videoResult.motionVideoGenerationJob?.generationId ||
                             videoResult.motionSvdGenerationJob?.generationId ||
                             videoResult.sdGenerationJob?.generationId ||
                             videoResult.generationId ||
                             videoResult.id ||
                             videoResult.jobId

        console.log('🎬 [LEONARDO] Extracted generation ID:', generationId)
        console.log('🎬 [LEONARDO] Response structure:', {
          hasImageToVideoJob: !!videoResult.imageToVideoGenerationJob,
          hasMotionVideoJob: !!videoResult.motionVideoGenerationJob,
          hasMotionSvdJob: !!videoResult.motionSvdGenerationJob,
          hasSdGenerationJob: !!videoResult.sdGenerationJob,
          hasGenerationId: !!videoResult.generationId,
          hasId: !!videoResult.id,
          hasJobId: !!videoResult.jobId,
        })

        if (!generationId) {
          console.error('❌ [LEONARDO] No generation ID found in response')
          console.error('❌ [LEONARDO] Full response:', videoResult)
          throw new Error('Failed to get generation ID from Leonardo. Check console for full response.')
        }

        updateStoryboardGeneration(storyboard.id, { generationStatus: "Polling for video..." })

        // Step 3: Poll for video result (using same logic as test-leonardo)
        const pollForVideo = async () => {
          let attempts = 0
          const maxAttempts = 60 // 5 minutes max
          
          const poll = async () => {
            try {
              attempts++
              console.log(`🔄 [LEONARDO] Polling attempt ${attempts}/${maxAttempts} for generation: ${generationId}`)
              
              const endpoint = useImageToVideo 
                ? `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`
                : `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`
              
              const statusResponse = await fetch(endpoint, {
                headers: {
                  'Authorization': `Bearer ${apiKeyToUse}`,
                  'Content-Type': 'application/json'
                }
              })

              if (statusResponse.ok) {
                const statusResult = await statusResponse.json()
                console.log('📊 [LEONARDO] Polling response:', statusResult)
                
                // Handle different response structures
                const generation = statusResult.generations_by_pk || statusResult
                const jobStatus = generation.status || statusResult.status
                
                let videoUrl: string | null = null
                
                if (useImageToVideo) {
                  // Image-to-video response structure
                  videoUrl = generation.generated_images?.[0]?.motionMP4URL ||
                            generation.generated_images?.[0]?.url ||
                            statusResult.motionVideoGenerationJob?.videoURL ||
                            statusResult.imageToVideoGenerationJob?.videoURL
                } else {
                  // Motion SVD response structure
                  const generatedImage = generation.generated_images?.[0] || statusResult.generated_images?.[0]
                  videoUrl = generatedImage?.motionMP4URL ||
                            statusResult.motionSvdGenerationJob?.motionMP4URL ||
                            generation.videoUrl ||
                            statusResult.videoUrl
                }
                
                console.log('📊 [LEONARDO] Job status:', jobStatus)
                console.log('📊 [LEONARDO] Video URL found:', !!videoUrl, videoUrl)
                
                if (jobStatus === 'COMPLETE' || jobStatus === 'complete' || jobStatus === 'COMPLETED' || jobStatus === 'succeeded') {
                  if (videoUrl) {
                    updateStoryboardGeneration(storyboard.id, {
                      isGenerating: false,
                      generatedVideoUrl: videoUrl,
                      generationStatus: "Completed"
                    })
                    
                    // Auto-save generated video to database
                    try {
                      const generation = storyboardGenerations.get(storyboard.id)
                      if (generation && userId) {
                        console.log('💾 [AUTO-SAVE] Starting auto-save for video:', videoUrl?.substring(0, 50))
                        const fileName = `${storyboard.title || 'storyboard'}-shot-${storyboard.shot_number}`
                        
                        // First save to bucket
                        console.log('💾 [AUTO-SAVE] Saving to bucket...')
                        const bucketResponse = await fetch('/api/ai/download-and-store-video', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            videoUrl,
                            fileName,
                            userId,
                          }),
                        })
                        
                        const bucketResult = await bucketResponse.json()
                        console.log('💾 [AUTO-SAVE] Bucket response:', bucketResponse.ok, bucketResult.success)
                        
                        if (!bucketResponse.ok || !bucketResult.success) {
                          console.warn('💾 [AUTO-SAVE] Bucket save failed, using original URL')
                        }
                        
                        const savedVideoUrl = bucketResult.supabaseUrl || videoUrl
                        
                        // Then save to database
                        console.log('💾 [AUTO-SAVE] Saving to database...')
                        const dbResponse = await fetch('/api/storyboard-videos', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            storyboardId: storyboard.id,
                            videoUrl: savedVideoUrl,
                            videoName: fileName,
                            generationModel: generation.model || null,
                            generationPrompt: generation.prompt || null,
                            metadata: {
                              duration: generation.duration,
                              resolution: generation.resolution,
                            },
                            isDefault: false, // New videos are not default by default
                          }),
                        })
                        
                        const dbResult = await dbResponse.json()
                        console.log('💾 [AUTO-SAVE] Database response:', dbResponse.ok, dbResponse.status, dbResult)
                        
                        if (dbResponse.ok && dbResult.success) {
                          await loadStoryboardVideos(storyboard.id)
                          console.log('✅ Auto-saved generated video to database')
                        } else {
                          console.error('❌ [AUTO-SAVE] Database save failed:', dbResult.error || 'Unknown error')
                          // Check if it's a table doesn't exist error
                          if (dbResult.error?.includes('relation') || dbResult.error?.includes('does not exist')) {
                            console.error('❌ [AUTO-SAVE] Table might not exist - please run migration 072_add_storyboard_videos_table.sql')
                          }
                        }
                      } else {
                        console.warn('💾 [AUTO-SAVE] Skipping - missing generation or userId')
                      }
                    } catch (error) {
                      console.error('❌ [AUTO-SAVE] Failed to auto-save video to database:', error)
                      // Don't fail the generation if auto-save fails
                    }
                    
                    toast({
                      title: "Success",
                      description: "Video generated successfully!",
                    })
                    return // Stop polling
                  }
                } else if (jobStatus === 'FAILED' || jobStatus === 'failed' || jobStatus === 'error') {
                  updateStoryboardGeneration(storyboard.id, {
                    isGenerating: false,
                    generationStatus: "Failed"
                  })
                  toast({
                    title: "Generation Failed",
                    description: "Video generation failed. Please try again.",
                    variant: "destructive"
                  })
                  return // Stop polling
                }
              } else {
                console.warn(`⚠️ [LEONARDO] Polling response not OK: ${statusResponse.status}`)
              }
              
              // Continue polling if not completed
              if (attempts < maxAttempts) {
                setTimeout(poll, 5000) // Poll every 5 seconds
              } else {
                updateStoryboardGeneration(storyboard.id, {
                  isGenerating: false,
                  generationStatus: "Processing - check back soon"
                })
                toast({
                  title: "Generation Started",
                  description: "Video generation is in progress. Check back in a few minutes.",
                })
              }
            } catch (error) {
              console.error('❌ [LEONARDO] Error polling:', error)
              if (attempts < maxAttempts) {
                setTimeout(poll, 5000)
              } else {
                updateStoryboardGeneration(storyboard.id, {
                  isGenerating: false,
                  generationStatus: "Error polling"
                })
                toast({
                  title: "Polling Error",
                  description: "Error checking video status. Please refresh and check manually.",
                  variant: "destructive"
                })
              }
            }
          }
          
          setTimeout(poll, 5000) // Start polling after 5 seconds
        }
        
        pollForVideo()
      } else if (generation.model === "Kling 2.1 Pro (Frame-to-Frame)" || 
                 generation.model === "Veo 3.1 (Frame-to-Frame)" || 
                 generation.model === "Veo 3.1 Fast (Frame-to-Frame)") {
        // Handle Kling/Veo frame-to-frame via Leonardo API
        if (!leonardoApiKey && userId) {
          try {
            const supabase = getSupabaseClient()
            const { data, error } = await supabase
              .from('users')
              .select('leonardo_api_key')
              .eq('id', userId)
              .single()
            
            if (!error && data?.leonardo_api_key) {
              setLeonardoApiKey(data.leonardo_api_key)
            } else {
              throw new Error("Leonardo API key required for Kling/Veo models")
            }
          } catch (error) {
            toast({
              title: "API Key Required",
              description: "Please set your Leonardo API key in settings.",
              variant: "destructive"
            })
            updateStoryboardGeneration(storyboard.id, {
              isGenerating: false,
              generationStatus: "Failed - API key required"
            })
            return
          }
        }

        const apiKeyToUse = leonardoApiKey
        if (!apiKeyToUse) {
          toast({
            title: "API Key Required",
            description: "Please set your Leonardo API key in settings.",
            variant: "destructive"
          })
          updateStoryboardGeneration(storyboard.id, {
            isGenerating: false,
            generationStatus: "Failed - API key required"
          })
          return
        }

        // Get start frame - from uploaded file, image URL, or storyboard image
        let startFrameFile: File | null = generation.startFrame
        let startFrameUrl: string | null = generation.startFrameImageUrl

        if (!startFrameFile && !startFrameUrl) {
          // Try to use storyboard image as start frame
          if (storyboard.image_url) {
            startFrameUrl = storyboard.image_url
          }
        }

        if (!startFrameFile && !startFrameUrl) {
          toast({
            title: "Start Frame Required",
            description: "Please upload a start frame or select one from a storyboard.",
            variant: "destructive"
          })
          updateStoryboardGeneration(storyboard.id, {
            isGenerating: false,
            generationStatus: "Failed - Start frame required"
          })
          return
        }

        try {
          updateStoryboardGeneration(storyboard.id, { generationStatus: "Uploading start frame..." })
          
          // Upload start frame
          let startImageId: string | null = null
          
          if (startFrameFile) {
            const fileName = startFrameFile.name
            const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
            const formData = new FormData()
            formData.append('file', startFrameFile)
            formData.append('extension', fileExtension)
            
            const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKeyToUse}`,
              },
              body: formData
            })
            
            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text()
              throw new Error(`Failed to upload start frame: ${uploadResponse.status} - ${errorText}`)
            }
            
            const uploadData = await uploadResponse.json()
            startImageId = uploadData.uploadInitImage?.id || uploadData.id || uploadData.initImageId || uploadData.imageId
            
            if (!startImageId) {
              throw new Error('No image ID returned from start frame upload')
            }
            
            // Handle S3 upload if needed
            if (uploadData.uploadInitImage?.fields && uploadData.uploadInitImage?.url) {
              const s3Fields = JSON.parse(uploadData.uploadInitImage.fields)
              const s3FormData = new FormData()
              Object.keys(s3Fields).forEach(key => {
                s3FormData.append(key, s3Fields[key])
              })
              s3FormData.append('file', startFrameFile)
              
              const s3Response = await fetch('/api/leonardo/upload-s3', {
                method: 'POST',
                headers: {
                  'x-s3-url': uploadData.uploadInitImage.url,
                },
                body: s3FormData
              })
              
              if (!s3Response.ok) {
                console.warn('S3 upload failed, continuing anyway')
              }
              
              await new Promise(resolve => setTimeout(resolve, 5000))
            } else {
              await new Promise(resolve => setTimeout(resolve, 5000))
            }
          } else if (startFrameUrl) {
            // For URL-based images, we need to fetch and upload
            updateStoryboardGeneration(storyboard.id, { generationStatus: "Loading start frame from URL..." })
            const imageResponse = await fetch(startFrameUrl)
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob()
              const file = new File([imageBlob], 'start-frame.jpg', { type: imageBlob.type || 'image/jpeg' })
              
              const fileName = file.name
              const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
              const formData = new FormData()
              formData.append('file', file)
              formData.append('extension', fileExtension)
              
              const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKeyToUse}`,
                },
                body: formData
              })
              
              if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text()
                throw new Error(`Failed to upload start frame: ${uploadResponse.status} - ${errorText}`)
              }
              
              const uploadData = await uploadResponse.json()
              startImageId = uploadData.uploadInitImage?.id || uploadData.id || uploadData.initImageId || uploadData.imageId
              
              if (!startImageId) {
                throw new Error('No image ID returned from start frame upload')
              }
              
              if (uploadData.uploadInitImage?.fields && uploadData.uploadInitImage?.url) {
                const s3Fields = JSON.parse(uploadData.uploadInitImage.fields)
                const s3FormData = new FormData()
                Object.keys(s3Fields).forEach(key => {
                  s3FormData.append(key, s3Fields[key])
                })
                s3FormData.append('file', file)
                
                const s3Response = await fetch('/api/leonardo/upload-s3', {
                  method: 'POST',
                  headers: {
                    'x-s3-url': uploadData.uploadInitImage.url,
                  },
                  body: s3FormData
                })
                
                if (!s3Response.ok) {
                  console.warn('S3 upload failed, continuing anyway')
                }
                
                await new Promise(resolve => setTimeout(resolve, 5000))
              } else {
                await new Promise(resolve => setTimeout(resolve, 5000))
              }
            } else {
              throw new Error('Failed to load start frame from URL')
            }
          }

          // Upload end frame if provided
          let endImageId: string | null = null
          let endFrameFile: File | null = generation.endFrame
          let endFrameUrl: string | null = generation.endFrameImageUrl

          if (endFrameFile || endFrameUrl) {
            updateStoryboardGeneration(storyboard.id, { generationStatus: "Uploading end frame..." })
            
            if (endFrameFile) {
              const fileName = endFrameFile.name
              const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
              const formData = new FormData()
              formData.append('file', endFrameFile)
              formData.append('extension', fileExtension)
              
              const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKeyToUse}`,
                },
                body: formData
              })
              
              if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text()
                throw new Error(`Failed to upload end frame: ${uploadResponse.status} - ${errorText}`)
              }
              
              const uploadData = await uploadResponse.json()
              endImageId = uploadData.uploadInitImage?.id || uploadData.id || uploadData.initImageId || uploadData.imageId
              
              if (!endImageId) {
                throw new Error('No image ID returned from end frame upload')
              }
              
              if (uploadData.uploadInitImage?.fields && uploadData.uploadInitImage?.url) {
                const s3Fields = JSON.parse(uploadData.uploadInitImage.fields)
                const s3FormData = new FormData()
                Object.keys(s3Fields).forEach(key => {
                  s3FormData.append(key, s3Fields[key])
                })
                s3FormData.append('file', endFrameFile)
                
                const s3Response = await fetch('/api/leonardo/upload-s3', {
                  method: 'POST',
                  headers: {
                    'x-s3-url': uploadData.uploadInitImage.url,
                  },
                  body: s3FormData
                })
                
                if (!s3Response.ok) {
                  console.warn('S3 upload failed, continuing anyway')
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000))
              } else {
                await new Promise(resolve => setTimeout(resolve, 2000))
              }
            } else if (endFrameUrl) {
              updateStoryboardGeneration(storyboard.id, { generationStatus: "Loading end frame from URL..." })
              const imageResponse = await fetch(endFrameUrl)
              if (imageResponse.ok) {
                const imageBlob = await imageResponse.blob()
                const file = new File([imageBlob], 'end-frame.jpg', { type: imageBlob.type || 'image/jpeg' })
                
                const fileName = file.name
                const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png'
                const formData = new FormData()
                formData.append('file', file)
                formData.append('extension', fileExtension)
                
                const uploadResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKeyToUse}`,
                  },
                  body: formData
                })
                
                if (!uploadResponse.ok) {
                  const errorText = await uploadResponse.text()
                  throw new Error(`Failed to upload end frame: ${uploadResponse.status} - ${errorText}`)
                }
                
                const uploadData = await uploadResponse.json()
                endImageId = uploadData.uploadInitImage?.id || uploadData.id || uploadData.initImageId || uploadData.imageId
                
                if (!endImageId) {
                  throw new Error('No image ID returned from end frame upload')
                }
                
                if (uploadData.uploadInitImage?.fields && uploadData.uploadInitImage?.url) {
                  const s3Fields = JSON.parse(uploadData.uploadInitImage.fields)
                  const s3FormData = new FormData()
                  Object.keys(s3Fields).forEach(key => {
                    s3FormData.append(key, s3Fields[key])
                  })
                  s3FormData.append('file', file)
                  
                  const s3Response = await fetch('/api/leonardo/upload-s3', {
                    method: 'POST',
                    headers: {
                      'x-s3-url': uploadData.uploadInitImage.url,
                    },
                    body: s3FormData
                  })
                  
                  if (!s3Response.ok) {
                    console.warn('S3 upload failed, continuing anyway')
                  }
                  
                  await new Promise(resolve => setTimeout(resolve, 2000))
                } else {
                  await new Promise(resolve => setTimeout(resolve, 2000))
                }
              } else {
                throw new Error('Failed to load end frame from URL')
              }
            }
          }

          // Generate video using Leonardo image-to-video endpoint
          updateStoryboardGeneration(storyboard.id, { generationStatus: "Generating video..." })
          
          const validDurations = generation.videoModelType === 'KLING2_1' ? [5, 10] : [4, 6, 8]
          const duration = generation.videoDuration || (generation.videoModelType === 'KLING2_1' ? 5 : 8)
          
          if (!validDurations.includes(duration)) {
            throw new Error(`Duration must be ${validDurations.join(', ')} seconds for ${generation.videoModelType}`)
          }

          const requestBody: any = {
            prompt: generation.prompt.trim() || "Smooth transition between frames",
            imageId: startImageId,
            imageType: "UPLOADED",
            model: generation.videoModelType,
            resolution: "RESOLUTION_1080",
            height: 1080,
            width: 1920,
            duration: duration,
          }

          if (endImageId) {
            requestBody.endFrameImage = {
              id: endImageId,
              type: "UPLOADED"
            }
          }

          const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKeyToUse}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Video generation failed: ${response.status} - ${errorText}`)
          }

          const result = await response.json()
          console.log('🎬 [KLING/VEO] Response data:', JSON.stringify(result, null, 2))
          
          // Handle different response structures (same as test-leonardo)
          const generationId = result.motionVideoGenerationJob?.generationId ||
                              result.motionSvdGenerationJob?.id || 
                              result.motionSvdGenerationJob?.generationId ||
                              result.generationId || 
                              result.id ||
                              result.imageToVideoGenerationJob?.id ||
                              result.imageToVideoGenerationJob?.generationId ||
                              result.jobId ||
                              result.sdGenerationJob?.generationId ||
                              result.textToVideoGenerationJob?.id ||
                              result.textToVideoGenerationJob?.generationId

          console.log('🎬 [KLING/VEO] Extracted generation ID:', generationId)
          console.log('🎬 [KLING/VEO] Full result structure:', {
            hasMotionVideoJob: !!result.motionVideoGenerationJob,
            motionVideoJobGenerationId: result.motionVideoGenerationJob?.generationId,
            hasMotionSvdJob: !!result.motionSvdGenerationJob,
            hasImageToVideoJob: !!result.imageToVideoGenerationJob,
            hasGenerationId: !!result.generationId,
            hasId: !!result.id,
            hasJobId: !!result.jobId,
            hasSdGenerationJob: !!result.sdGenerationJob,
          })

          if (!generationId) {
            console.error('🎬 [KLING/VEO] No generation ID found in response')
            console.error('🎬 [KLING/VEO] Full response:', result)
            throw new Error('No generation ID returned. Check console for full response.')
          }

          // Poll for video
          updateStoryboardGeneration(storyboard.id, { generationStatus: "Processing video..." })
          
          const pollForVideo = async () => {
              let attempts = 0
              const maxAttempts = 60 // 5 minutes max
              
              const poll = async () => {
                attempts++
                try {
                  // Try multiple endpoints like test-leonardo does
                  let statusResponse: Response | null = null
                  let statusData: any = null
                  
                  const endpoints = [
                    `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
                    `https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video/${generationId}`,
                    `https://cloud.leonardo.ai/api/rest/v1/motion-video/${generationId}`,
                  ]
                  
                  for (const endpoint of endpoints) {
                    try {
                      statusResponse = await fetch(endpoint, {
                        headers: {
                          'Authorization': `Bearer ${apiKeyToUse}`,
                        },
                      })
                      
                      if (statusResponse.ok) {
                        statusData = await statusResponse.json()
                        break
                      }
                    } catch (e) {
                      console.warn(`Failed to fetch from ${endpoint}:`, e)
                      continue
                    }
                  }
                  
                  if (statusResponse?.ok && statusData) {
                    console.log('🎬 [KLING/VEO POLLING] Status response:', JSON.stringify(statusData, null, 2))
                    
                    // Check multiple possible locations for status (same as test-leonardo)
                    const jobStatus = statusData.generations_by_pk?.status ||
                                    statusData.motionVideoGenerationJob?.status ||
                                    statusData.imageToVideoGenerationJob?.status ||
                                    statusData.motionSvdGenerationJob?.status ||
                                    statusData.generation?.status ||
                                    statusData.status
                    
                    console.log('🎬 [KLING/VEO POLLING] Job status:', jobStatus)
                    
                    if (jobStatus === 'COMPLETE' || jobStatus === 'complete' || jobStatus === 'COMPLETED' || jobStatus === 'succeeded') {
                      // Check multiple possible locations for video URL (same as test-leonardo)
                      const videoUrl = statusData.generations_by_pk?.generated_images?.[0]?.motionMP4URL ||
                                     statusData.generations_by_pk?.generated_images?.[0]?.url ||
                                     statusData.motionVideoGenerationJob?.videoURL ||
                                     statusData.motionVideoGenerationJob?.url ||
                                     statusData.imageToVideoGenerationJob?.videoURL ||
                                     statusData.imageToVideoGenerationJob?.videoUrl ||
                                     statusData.generations_by_pk?.generated_videos?.[0]?.url ||
                                     statusData.generated_videos?.[0]?.url ||
                                     statusData.generation?.videoURL ||
                                     statusData.videoUrl ||
                                     statusData.url ||
                                     statusData.motionSvdGenerationJob?.motionMP4URL
                      
                      console.log('🎬 [KLING/VEO POLLING] Video URL found:', !!videoUrl, videoUrl)
                      
                      updateStoryboardGeneration(storyboard.id, {
                        isGenerating: false,
                        generatedVideoUrl: videoUrl || null,
                        generationStatus: videoUrl ? "Completed" : "Processing - check back soon"
                      })
                      
                      // Auto-save generated video to database
                      if (videoUrl && userId) {
                        try {
                          const generation = storyboardGenerations.get(storyboard.id)
                          if (generation) {
                            const fileName = `${storyboard.title || 'storyboard'}-shot-${storyboard.shot_number}`
                            
                            // First save to bucket
                            const bucketResponse = await fetch('/api/ai/download-and-store-video', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                videoUrl,
                                fileName,
                                userId,
                              }),
                            })
                            
                            const bucketResult = await bucketResponse.json()
                            const savedVideoUrl = bucketResult.supabaseUrl || videoUrl
                            
                            // Then save to database
                            const dbResponse = await fetch('/api/storyboard-videos', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                storyboardId: storyboard.id,
                                videoUrl: savedVideoUrl,
                                videoName: fileName,
                                generationModel: generation.model || null,
                                generationPrompt: generation.prompt || null,
                                metadata: {
                                  duration: generation.duration,
                                  resolution: generation.resolution,
                                },
                                isDefault: false,
                              }),
                            })
                            
                            if (dbResponse.ok) {
                              await loadStoryboardVideos(storyboard.id)
                              console.log('✅ Auto-saved Kling/Veo video to database')
                            }
                          }
                        } catch (error) {
                          console.warn('Failed to auto-save Kling/Veo video to database:', error)
                        }
                      }
                      
                      toast({
                        title: "Success",
                        description: videoUrl ? "Video generated successfully!" : "Video generation completed.",
                      })
                      return
                    } else if (jobStatus === 'FAILED' || jobStatus === 'failed' || jobStatus === 'error') {
                      updateStoryboardGeneration(storyboard.id, {
                        isGenerating: false,
                        generationStatus: "Failed"
                      })
                      toast({
                        title: "Generation Failed",
                        description: "Video generation failed. Please try again.",
                        variant: "destructive"
                      })
                      return
                    }
                  }
                  
                  if (attempts < maxAttempts) {
                    setTimeout(poll, 5000)
                  } else {
                    updateStoryboardGeneration(storyboard.id, {
                      isGenerating: false,
                      generationStatus: "Processing - check back soon"
                    })
                    toast({
                      title: "Generation Started",
                      description: "Video generation is in progress. Check back in a few minutes.",
                    })
                  }
                } catch (error) {
                  console.error('Error polling:', error)
                  if (attempts < maxAttempts) {
                    setTimeout(poll, 5000)
                  } else {
                    updateStoryboardGeneration(storyboard.id, {
                      isGenerating: false,
                      generationStatus: "Error polling"
                    })
                  }
                }
              }
              
              setTimeout(poll, 5000)
            }
            
            pollForVideo()
        } catch (error) {
          console.error('Error generating Kling/Veo video:', error)
          updateStoryboardGeneration(storyboard.id, {
            isGenerating: false,
            generationStatus: "Failed"
          })
          toast({
            title: "Generation Failed",
            description: error instanceof Error ? error.message : "Unknown error occurred",
            variant: "destructive"
          })
        }
      } else if (generation.model.startsWith("Kling")) {
        // Handle Kling models
        // Convert storyboard image_url to File if no uploaded file
        let imageFile: File | undefined = generation.uploadedFile || undefined
        
        if (!imageFile && storyboard.image_url && (generation.model === "Kling I2V" || generation.model === "Kling I2V Extended")) {
          try {
            updateStoryboardGeneration(storyboard.id, { generationStatus: "Loading storyboard image..." })
            const imageResponse = await fetch(storyboard.image_url)
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob()
              imageFile = new File([imageBlob], 'storyboard-image.jpg', { type: imageBlob.type || 'image/jpeg' })
              console.log('✅ [KLING] Using storyboard image_url')
            }
          } catch (error) {
            console.error('Error loading storyboard image:', error)
          }
        }
        
        const response = await KlingService.generateVideo({
          prompt: generation.prompt,
          duration: generation.duration,
          model: generation.model,
          file: imageFile,
          startFrame: generation.startFrame || undefined,
          endFrame: generation.endFrame || undefined,
          resolution: generation.resolution,
        })

        if (response.success) {
          const videoUrl = response.data?.video_url || response.data?.url || response.data?.output?.[0]
          updateStoryboardGeneration(storyboard.id, {
            isGenerating: false,
            generatedVideoUrl: videoUrl || null,
            generationStatus: videoUrl ? "Completed" : "Processing - check back soon"
          })
          
          // Auto-save generated video to database
          if (videoUrl && userId) {
            try {
              const generation = storyboardGenerations.get(storyboard.id)
              if (generation) {
                const fileName = `${storyboard.title || 'storyboard'}-shot-${storyboard.shot_number}`
                
                // First save to bucket
                const bucketResponse = await fetch('/api/ai/download-and-store-video', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    videoUrl,
                    fileName,
                    userId,
                  }),
                })
                
                const bucketResult = await bucketResponse.json()
                const savedVideoUrl = bucketResult.supabaseUrl || videoUrl
                
                // Then save to database
                const dbResponse = await fetch('/api/storyboard-videos', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    storyboardId: storyboard.id,
                    videoUrl: savedVideoUrl,
                    videoName: fileName,
                    generationModel: generation.model || null,
                    generationPrompt: generation.prompt || null,
                    metadata: {
                      duration: generation.duration,
                      resolution: generation.resolution,
                    },
                    isDefault: false,
                  }),
                })
                
                if (dbResponse.ok) {
                  await loadStoryboardVideos(storyboard.id)
                  console.log('✅ Auto-saved Kling video to database')
                }
              }
            } catch (error) {
              console.warn('Failed to auto-save Kling video to database:', error)
            }
          }
          
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
        
        // Use uploaded file or convert storyboard image_url to File
        let imageFile: File | null = generation.uploadedFile || null
        
        if (!imageFile && storyboard.image_url) {
          try {
            updateStoryboardGeneration(storyboard.id, { generationStatus: "Loading storyboard image..." })
            const imageResponse = await fetch(storyboard.image_url)
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob()
              imageFile = new File([imageBlob], 'storyboard-image.jpg', { type: imageBlob.type || 'image/jpeg' })
              console.log('✅ [RUNWAY] Using storyboard image_url')
            }
          } catch (error) {
            console.error('Error loading storyboard image:', error)
          }
        }
        
        if (imageFile) {
          formData.append('file', imageFile)
        }

        const response = await fetch('/api/ai/generate-video', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (response.ok && result.success) {
          const videoUrl = result.data?.video_url || result.data?.url || result.data?.output?.[0]
          updateStoryboardGeneration(storyboard.id, {
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
      updateStoryboardGeneration(storyboard.id, {
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

        {/* Scene Selection */}
        {selectedProjectId && (
          <Card className="cinema-card mb-6">
            <CardHeader>
              <CardTitle>Select Scene</CardTitle>
              <CardDescription>
                Choose a scene to view its storyboard shots
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingScenes ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading scenes...
                </div>
              ) : scenes.length === 0 ? (
                <p className="text-muted-foreground">
                  No scenes found for this project.
                </p>
              ) : (
                <Select value={selectedSceneId} onValueChange={setSelectedSceneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a scene..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scenes.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        {scene.name || `Scene ${scene.order_index || 'Unknown'}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Storyboard Selection (Optional) */}
        {selectedSceneId && (
          <Card className="cinema-card mb-6">
            <CardHeader>
              <CardTitle>Filter Storyboard (Optional)</CardTitle>
              <CardDescription>
                Optionally filter to a specific storyboard, or leave blank to see all storyboards for this scene
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStoryboards ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading storyboards...
                </div>
              ) : storyboards.length === 0 ? (
                <p className="text-muted-foreground">
                  No storyboards found for this scene.
                </p>
              ) : (
                <Select 
                  value={selectedStoryboardId || "all"} 
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSelectedStoryboardId("")
                      setSelectedStoryboard(null)
                    } else {
                      setSelectedStoryboardId(value)
                      const storyboard = storyboards.find(s => s.id === value)
                      setSelectedStoryboard(storyboard || null)
                      console.log('🎬 Selected storyboard:', storyboard)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All storyboards..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Storyboards ({storyboards.length})</SelectItem>
                    {storyboards.map((storyboard) => (
                      <SelectItem key={storyboard.id} value={storyboard.id}>
                        {storyboard.title} - Shot {storyboard.shot_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        )}

        {/* Storyboard Shots Display */}
        {selectedSceneId && (
          <div className="space-y-6">
            {/* View Mode Selector */}
            {!loadingStoryboards && getDisplayedStoryboards().length > 0 && (
              <Card className="cinema-card">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">View:</span>
                      <div className="flex gap-1">
                        <Button
                          variant={viewMode === 'sequence' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('sequence')}
                          className="h-8"
                        >
                          <LayoutGrid className="h-4 w-4 mr-1" />
                          Sequence
                        </Button>
                        <Button
                          variant={viewMode === 'grid' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('grid')}
                          className="h-8"
                        >
                          <Grid3x3 className="h-4 w-4 mr-1" />
                          Grid
                        </Button>
                        <Button
                          variant={viewMode === 'detail' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('detail')}
                          className="h-8"
                        >
                          <List className="h-4 w-4 mr-1" />
                          Detail
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getDisplayedStoryboards().length} {getDisplayedStoryboards().length === 1 ? 'storyboard' : 'storyboards'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingStoryboards ? (
              <Card className="cinema-card">
                <CardContent className="py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading storyboards...
                  </div>
                </CardContent>
              </Card>
            ) : getDisplayedStoryboards().length === 0 ? (
              <Card className="cinema-card">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    {selectedStoryboardId 
                      ? "No storyboard found with the selected filter."
                      : "No storyboards found for this scene."}
                  </p>
                </CardContent>
              </Card>
            ) : viewMode === 'sequence' ? (
              // Sequence View - Timeline style (DaVinci Resolve like)
              <div className="space-y-2">
                {/* Timeline Ruler */}
                <div className="bg-muted/50 border-b border-border h-8 flex items-center px-4 text-xs text-muted-foreground font-mono">
                  <div className="flex items-center gap-8 min-w-max">
                    {getDisplayedStoryboards().map((_, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <div className="h-2 w-px bg-border"></div>
                        <span className="mt-1">{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline Track */}
                <div className="bg-muted/30 border border-border rounded overflow-hidden">
                  <div className="overflow-x-auto">
                    <div id="storyboard-timeline" className="flex h-[200px] min-w-max">
                      {getDisplayedStoryboards().map((storyboard, index) => {
                        const generation = storyboardGenerations.get(storyboard.id) || {
                          shotId: storyboard.id,
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
                          generationStatus: null,
                          motionControl: "",
                          motionStrength: 2
                        }
                        const hasVideo = !!generation.generatedVideoUrl
                        const clipWidth = hasVideo ? 240 : 180
                        
                        return (
                          <div
                            key={storyboard.id}
                            id={`storyboard-${storyboard.id}`}
                            className="relative flex-shrink-0 border-r border-border last:border-r-0 group cursor-pointer hover:bg-muted/50 transition-colors"
                            style={{ width: `${clipWidth}px` }}
                            onClick={() => {
                              setViewMode('detail')
                              setTimeout(() => {
                                document.getElementById(`storyboard-${storyboard.id}`)?.scrollIntoView({ behavior: 'smooth' })
                              }, 100)
                            }}
                          >
                            {/* Clip Header */}
                            <div className="absolute top-0 left-0 right-0 h-6 bg-primary/10 border-b border-border flex items-center justify-between px-2 z-10">
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="font-mono text-[10px] h-4 px-1">
                                  {storyboard.shot_number}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                  {storyboard.title}
                                </span>
                              </div>
                              {storyboard.status && (
                                <div className={`h-2 w-2 rounded-full ${
                                  storyboard.status === 'approved' ? 'bg-green-500' :
                                  storyboard.status === 'completed' ? 'bg-blue-500' :
                                  'bg-gray-500'
                                }`}></div>
                              )}
                            </div>

                            {/* Clip Content */}
                            <div className="pt-6 h-full bg-background relative group">
                              {hasVideo ? (
                                <>
                                  <video
                                    id={`video-${storyboard.id}`}
                                    data-storyboard-id={storyboard.id}
                                    src={generation.generatedVideoUrl!}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    preload="auto"
                                    onEnded={(e) => {
                                      if (!isPlayingSequence) return // Only chain if sequence is playing
                                      
                                      // When video ends, play the next one in sequence
                                      const storyboards = getDisplayedStoryboards()
                                      const currentIndex = storyboards.findIndex(sb => sb.id === storyboard.id)
                                      
                                      // Find the next storyboard with a video
                                      let foundNext = false
                                      for (let i = 1; i <= storyboards.length; i++) {
                                        const nextIndex = (currentIndex + i) % storyboards.length
                                        const nextStoryboard = storyboards[nextIndex]
                                        const nextGen = storyboardGenerations.get(nextStoryboard.id)
                                        
                                        if (nextGen?.generatedVideoUrl) {
                                          const nextVideo = document.getElementById(`video-${nextStoryboard.id}`) as HTMLVideoElement
                                          if (nextVideo) {
                                            console.log(`⏭️ Video ${storyboard.id} ended, playing next: ${nextStoryboard.id}`)
                                            nextVideo.currentTime = 0
                                            nextVideo.play().then(() => {
                                              console.log(`✅ Next video started: ${nextStoryboard.id}`)
                                            }).catch((err) => {
                                              console.error(`❌ Failed to play next video: ${nextStoryboard.id}`, err)
                                              setIsPlayingSequence(false)
                                            })
                                            foundNext = true
                                            break
                                          }
                                        }
                                      }
                                      
                                      if (!foundNext) {
                                        console.log('⚠️ No more videos in sequence, looping back to start')
                                        // Loop back to first video
                                        const firstWithVideo = storyboards.find(sb => {
                                          const gen = storyboardGenerations.get(sb.id)
                                          return !!gen?.generatedVideoUrl
                                        })
                                        
                                        if (firstWithVideo) {
                                          const firstVideo = document.getElementById(`video-${firstWithVideo.id}`) as HTMLVideoElement
                                          if (firstVideo) {
                                            firstVideo.currentTime = 0
                                            firstVideo.play().catch(() => {
                                              setIsPlayingSequence(false)
                                            })
                                          }
                                        } else {
                                          setIsPlayingSequence(false)
                                        }
                                      }
                                    }}
                                    onLoadedMetadata={(e) => {
                                      console.log(`📹 Video loaded: ${storyboard.id}`, e.currentTarget.duration)
                                    }}
                                  />
                                  {/* Action buttons overlay */}
                                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-7 px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDownloadVideo(generation.generatedVideoUrl!, storyboard)
                                      }}
                                      title="Download video"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-7 px-2"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleSaveVideo(generation.generatedVideoUrl!, storyboard)
                                      }}
                                      title="Save to storage"
                                    >
                                      <Save className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              ) : storyboard.image_url ? (
                                <div className="relative w-full h-full bg-muted">
                                  <img
                                    src={storyboard.image_url}
                                    alt={storyboard.title || "Storyboard"}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                  {/* Overlay for generate button */}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setViewMode('detail')
                                        setTimeout(() => {
                                          document.getElementById(`storyboard-${storyboard.id}`)?.scrollIntoView({ behavior: 'smooth' })
                                        }, 100)
                                      }}
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      Generate
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Clip Footer with Duration */}
                            <div className="absolute bottom-0 left-0 right-0 h-5 bg-primary/5 border-t border-border flex items-center justify-between px-2 text-[10px] text-muted-foreground">
                              <span className="truncate">{storyboard.shot_type}</span>
                              {hasVideo && (
                                <span className="font-mono">{generation.duration}</span>
                              )}
                            </div>

                            {/* Clip Resize Handle (visual only) */}
                            <div className="absolute top-0 right-0 w-1 h-full bg-transparent group-hover:bg-primary/20 cursor-ew-resize"></div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Timeline Controls */}
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border border-border rounded text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {getDisplayedStoryboards().length} {getDisplayedStoryboards().length === 1 ? 'clip' : 'clips'}
                    </span>
                    <span className="text-muted-foreground">
                      Total Duration: {getDisplayedStoryboards().reduce((acc, sb) => {
                        const gen = storyboardGenerations.get(sb.id)
                        if (gen?.generatedVideoUrl) {
                          const duration = gen.duration || '5s'
                          const seconds = parseInt(duration) || 5
                          return acc + seconds
                        }
                        return acc
                      }, 0)}s
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={isPlayingSequence ? "destructive" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isPlayingSequence) {
                        // Stop all videos
                        console.log('⏹️ Stop button clicked')
                        const storyboards = getDisplayedStoryboards()
                        storyboards.forEach(sb => {
                          const video = document.getElementById(`video-${sb.id}`) as HTMLVideoElement
                          if (video) {
                            video.pause()
                            video.currentTime = 0
                            console.log(`⏹️ Stopped video: ${sb.id}`)
                          }
                        })
                        setIsPlayingSequence(false)
                        console.log('⏹️ Stopped all videos')
                        return
                      }
                      
                      // Play all videos in sequence - start with the first one
                      const storyboards = getDisplayedStoryboards()
                      console.log('▶️ Play All clicked - storyboards:', storyboards.length)
                      
                      // Wait a bit for DOM to be ready
                      setTimeout(() => {
                        const videosWithUrl = storyboards
                          .map(sb => {
                            const gen = storyboardGenerations.get(sb.id)
                            const hasUrl = !!gen?.generatedVideoUrl
                            return { storyboard: sb, generation: gen, hasUrl, videoUrl: gen?.generatedVideoUrl }
                          })
                          .filter(item => item.hasUrl)
                          .map(item => {
                            const video = document.getElementById(`video-${item.storyboard.id}`) as HTMLVideoElement
                            if (!video) {
                              console.warn(`⚠️ Video element not found: video-${item.storyboard.id}`)
                            }
                            return { video, storyboard: item.storyboard, videoUrl: item.videoUrl }
                          })
                          .filter(item => item.video !== null)
                        
                        console.log(`▶️ Found ${videosWithUrl.length} videos to play`)
                        videosWithUrl.forEach((item, idx) => {
                          console.log(`  ${idx + 1}. Video ${item.storyboard.id}:`, item.videoUrl?.substring(0, 50) + '...')
                        })
                        
                        if (videosWithUrl.length > 0) {
                          setIsPlayingSequence(true)
                          // Start playing the first video
                          const firstVideo = videosWithUrl[0].video
                          console.log('▶️ Starting playback of first video:', firstVideo.id)
                          firstVideo.currentTime = 0
                          firstVideo.play().then(() => {
                            console.log('✅ First video started playing')
                          }).catch((err) => {
                            console.error('❌ Failed to play first video:', err)
                            setIsPlayingSequence(false)
                          })
                        } else {
                          console.log('⚠️ No videos available to play')
                          const storyboardsWithVideos = storyboards.filter(sb => {
                            const gen = storyboardGenerations.get(sb.id)
                            return !!gen?.generatedVideoUrl
                          })
                          console.log('  - Storyboards with videos:', storyboardsWithVideos.length)
                          storyboardsWithVideos.forEach(sb => {
                            const gen = storyboardGenerations.get(sb.id)
                            console.log(`    - ${sb.id}: ${gen?.generatedVideoUrl?.substring(0, 50)}...`)
                          })
                        }
                      }, 100)
                    }}
                  >
                    {isPlayingSequence ? (
                      <>
                        <Square className="h-3 w-3 mr-1" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        Play All
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid View - Responsive grid
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getDisplayedStoryboards().map((storyboard) => {
                  const generation = storyboardGenerations.get(storyboard.id) || {
                    shotId: storyboard.id,
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
                    generationStatus: null,
                    motionControl: "",
                    motionStrength: 2,
                    videoModelType: undefined,
                    videoDuration: undefined,
                    startFrameImageUrl: null,
                    endFrameImageUrl: null
                  }
                  return (
                    <Card key={storyboard.id} id={`storyboard-${storyboard.id}`} className="cinema-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="font-mono text-xs">
                            Shot {storyboard.shot_number}
                          </Badge>
                          <Badge className={
                            storyboard.status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            storyboard.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                            'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }>
                            {storyboard.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-base mt-2">{storyboard.title}</CardTitle>
                        {storyboard.description && (
                          <CardDescription className="line-clamp-2">{storyboard.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Storyboard Image */}
                        {storyboard.image_url ? (
                          <div className="relative w-full bg-muted rounded-lg overflow-hidden border aspect-video">
                            <img
                              src={storyboard.image_url}
                              alt={storyboard.title || "Storyboard"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        ) : (
                          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                            <ImageIcon className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        
                        {/* Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Camera className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{storyboard.shot_type}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Move className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{storyboard.movement}</span>
                          </div>
                        </div>

                        {/* Video or Generate Button */}
                        {(() => {
                          const videos = storyboardVideos.get(storyboard.id) || []
                          // Prioritize: 1) default/starred video, 2) any saved video, 3) generated video
                          const defaultVideo = videos.find(v => v.is_default)
                          const displayVideoUrl = defaultVideo?.video_url || (videos.length > 0 ? videos[0]?.video_url : null) || generation.generatedVideoUrl
                          // Check if there are multiple videos (in DB or currently generated)
                          const generatedVideoInDb = generation.generatedVideoUrl && videos.some(v => v.video_url === generation.generatedVideoUrl)
                          const totalVideoCount = videos.length + (generation.generatedVideoUrl && !generatedVideoInDb ? 1 : 0)
                          const hasMultipleVideos = totalVideoCount > 1
                          
                          return displayVideoUrl ? (
                            <div className="space-y-2">
                              <div className="relative">
                                <video 
                                  src={displayVideoUrl} 
                                  controls 
                                  className="w-full rounded-md"
                                  preload="metadata"
                                  playsInline
                                />
                                {hasMultipleVideos && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="absolute top-2 right-2"
                                    onClick={() => {
                                      setSelectedStoryboardForVideos(storyboard.id)
                                      setVideoSelectorOpen(true)
                                    }}
                                  >
                                    <MoreVertical className="h-3 w-3 mr-1" />
                                    {totalVideoCount} Videos
                                  </Button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => handleDownloadVideo(displayVideoUrl, storyboard)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => handleSaveVideo(displayVideoUrl, storyboard)}
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setViewMode('detail')
                              setTimeout(() => {
                                document.getElementById(`storyboard-${storyboard.id}`)?.scrollIntoView({ behavior: 'smooth' })
                              }, 100)
                            }}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Generate Video
                          </Button>
                          )
                        })()}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              // Detail View - Full cards with all options
              getDisplayedStoryboards().map((storyboard) => {
                return (
                  <Card key={storyboard.id} id={`storyboard-${storyboard.id}`} className="cinema-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              Shot {storyboard.shot_number}
                            </Badge>
                            {storyboard.title}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {storyboard.description || "No description"}
                          </CardDescription>
                        </div>
                        <Badge className={
                          storyboard.status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          storyboard.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }>
                          {storyboard.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Toggle between Image and Video */}
                      {(() => {
                        const videos = storyboardVideos.get(storyboard.id) || []
                        const generation = storyboardGenerations.get(storyboard.id) || {
                          shotId: storyboard.id,
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
                          generationStatus: null,
                          motionControl: "",
                          motionStrength: 2,
                          videoModelType: undefined,
                          videoDuration: undefined,
                          startFrameImageUrl: null,
                          endFrameImageUrl: null
                        }
                        
                        const defaultVideo = videos.find(v => v.is_default)
                        const hasVideo = defaultVideo?.video_url || (videos.length > 0 ? videos[0]?.video_url : null) || generation.generatedVideoUrl
                        const currentViewMode = detailViewMode.get(storyboard.id) || (hasVideo ? 'video' : 'image')
                        
                        return (
                          <>
                            {/* Toggle Button */}
                            {storyboard.image_url && hasVideo && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant={currentViewMode === 'image' ? 'default' : 'outline'}
                                  onClick={() => setDetailViewMode(prev => {
                                    const newMap = new Map(prev)
                                    newMap.set(storyboard.id, 'image')
                                    return newMap
                                  })}
                                >
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  Image
                                </Button>
                                <Button
                                  size="sm"
                                  variant={currentViewMode === 'video' ? 'default' : 'outline'}
                                  onClick={() => setDetailViewMode(prev => {
                                    const newMap = new Map(prev)
                                    newMap.set(storyboard.id, 'video')
                                    return newMap
                                  })}
                                >
                                  <Video className="h-4 w-4 mr-2" />
                                  Video
                                </Button>
                              </div>
                            )}
                            
                            {/* Display Image or Video based on toggle */}
                            {currentViewMode === 'image' ? (
                              storyboard.image_url ? (
                                <div className="relative w-full bg-muted rounded-lg overflow-hidden border">
                                  <img
                                    src={storyboard.image_url}
                                    alt={storyboard.title || "Storyboard"}
                                    className="w-full h-auto max-h-[600px] object-contain mx-auto"
                                    onLoad={() => {
                                      console.log('🎬 Storyboard image loaded successfully:', storyboard.image_url)
                                    }}
                                    onError={(e) => {
                                      console.error('🎬 Failed to load storyboard image:', storyboard.image_url)
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="py-12 text-center bg-muted rounded-lg">
                                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                  <p className="text-muted-foreground">
                                    No image available for this storyboard.
                                  </p>
                                </div>
                              )
                            ) : (
                              // Video view
                              (() => {
                                const videos = storyboardVideos.get(storyboard.id) || []
                                const generation = storyboardGenerations.get(storyboard.id) || {
                                  shotId: storyboard.id,
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
                                  generationStatus: null,
                                  motionControl: "",
                                  motionStrength: 2,
                                  videoModelType: undefined,
                                  videoDuration: undefined,
                                  startFrameImageUrl: null,
                                  endFrameImageUrl: null
                                }
                                
                                const defaultVideo = videos.find(v => v.is_default)
                                const displayVideoUrl = defaultVideo?.video_url || (videos.length > 0 ? videos[0]?.video_url : null) || generation.generatedVideoUrl
                                const hasMultipleVideos = videos.length > 1 || (generation.generatedVideoUrl && !videos.some(v => v.video_url === generation.generatedVideoUrl))
                                
                                return displayVideoUrl ? (
                                  <div className="space-y-2">
                                    <div className="relative">
                                      <video 
                                        src={displayVideoUrl} 
                                        controls 
                                        preload="metadata"
                                        playsInline
                                        className="w-full rounded-md"
                                        key={displayVideoUrl}
                                      />
                                      {hasMultipleVideos && (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="absolute top-2 right-2"
                                          onClick={() => {
                                            setSelectedStoryboardForVideos(storyboard.id)
                                            setVideoSelectorOpen(true)
                                          }}
                                        >
                                          <MoreVertical className="h-4 w-4 mr-1" />
                                          {videos.length} Videos
                                        </Button>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => handleDownloadVideo(displayVideoUrl, storyboard)}
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download Video
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => handleSaveVideo(displayVideoUrl, storyboard)}
                                      >
                                        <Save className="h-4 w-4 mr-2" />
                                        Save to Storage
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="py-12 text-center bg-muted rounded-lg">
                                    <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <p className="text-muted-foreground">
                                      No video available for this storyboard.
                                    </p>
                                  </div>
                                )
                              })()
                            )}
                          </>
                        )
                      })()}

                      {/* Storyboard Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Camera className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium">{storyboard.shot_type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Camera className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Angle:</span>
                          <span className="font-medium">{storyboard.camera_angle}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Move className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Movement:</span>
                          <span className="font-medium">{storyboard.movement}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Film className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Scene:</span>
                          <span className="font-medium">{storyboard.scene_number}</span>
                        </div>
                      </div>

                      {storyboard.action && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Action:</p>
                          <p className="text-sm">{storyboard.action}</p>
                        </div>
                      )}

                      {storyboard.visual_notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Visual Notes:</p>
                          <p className="text-sm">{storyboard.visual_notes}</p>
                        </div>
                      )}

                      {/* Video Generation Section */}
                      <div className="border-t pt-4 space-y-4">
                        {(() => {
                          const generation = storyboardGenerations.get(storyboard.id) || {
                            shotId: storyboard.id,
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
                            generationStatus: null,
                            motionControl: "",
                            motionStrength: 2,
                            videoModelType: undefined,
                            videoDuration: undefined,
                            startFrameImageUrl: null,
                            endFrameImageUrl: null
                          }
                          const defaultPrompt = buildPromptFromStoryboard(storyboard)
                          const fileRequirement = generation.model ? getModelFileRequirement(generation.model) : 'none'

                          return (
                            <>
                              <div>
                                <Label>Video Model</Label>
                                <Select
                                  value={generation.model}
                                  onValueChange={(value) => {
                                    const newModel = value as VideoModel
                                    const isKlingVeo = newModel === "Kling 2.1 Pro (Frame-to-Frame)" || 
                                                     newModel === "Veo 3.1 (Frame-to-Frame)" || 
                                                     newModel === "Veo 3.1 Fast (Frame-to-Frame)"
                                    const isVeo = newModel === "Veo 3.1 (Frame-to-Frame)" || newModel === "Veo 3.1 Fast (Frame-to-Frame)"
                                    
                                    updateStoryboardGeneration(storyboard.id, { 
                                      model: newModel,
                                      // Clear files when model changes
                                      uploadedFile: null,
                                      startFrame: null,
                                      endFrame: null,
                                      filePreview: null,
                                      startFramePreview: null,
                                      endFramePreview: null,
                                      startFrameImageUrl: null,
                                      endFrameImageUrl: null,
                                      // Set videoModelType and duration for Kling/Veo
                                      videoModelType: isKlingVeo ? (isVeo ? (newModel === "Veo 3.1 Fast (Frame-to-Frame)" ? 'VEO3_1FAST' : 'VEO3_1') : 'KLING2_1') : undefined,
                                      videoDuration: isKlingVeo ? (isVeo ? 8 : 5) : undefined,
                                      // Clear motion control when switching away from Leonardo
                                      motionControl: value === "Leonardo Motion 2.0" ? (storyboardGenerations.get(storyboard.id)?.motionControl || "") : "",
                                      motionStrength: value === "Leonardo Motion 2.0" ? (storyboardGenerations.get(storyboard.id)?.motionStrength || 2) : 2
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
                                    <SelectItem value="Kling 2.1 Pro (Frame-to-Frame)">Kling 2.1 Pro (Frame-to-Frame via Leonardo)</SelectItem>
                                    <SelectItem value="Veo 3.1 (Frame-to-Frame)">Veo 3.1 (Frame-to-Frame via Leonardo)</SelectItem>
                                    <SelectItem value="Veo 3.1 Fast (Frame-to-Frame)">Veo 3.1 Fast (Frame-to-Frame via Leonardo)</SelectItem>
                                    <SelectItem value="Runway Gen-4 Turbo">Runway Gen-4 Turbo</SelectItem>
                                    <SelectItem value="Runway Gen-3A Turbo">Runway Gen-3A Turbo</SelectItem>
                                    <SelectItem value="Runway Act-Two">Runway Act-Two</SelectItem>
                                    <SelectItem value="Runway Gen-4 Aleph">Runway Gen-4 Aleph</SelectItem>
                                    <SelectItem value="Leonardo Motion 2.0">Leonardo Motion 2.0 (with Motion Control)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {generation.model && (
                                <>
                                  <div>
                                    <Label>Prompt</Label>
                                    <Textarea
                                      value={generation.prompt}
                                      onChange={(e) => updateStoryboardGeneration(storyboard.id, { prompt: e.target.value })}
                                      placeholder={defaultPrompt}
                                      rows={3}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-1"
                                      onClick={() => updateStoryboardGeneration(storyboard.id, { prompt: defaultPrompt })}
                                    >
                                      Use Storyboard Details
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Duration</Label>
                                      <Select
                                        value={generation.duration}
                                        onValueChange={(value) => updateStoryboardGeneration(storyboard.id, { duration: value })}
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
                                        onValueChange={(value) => updateStoryboardGeneration(storyboard.id, { resolution: value })}
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
                                <Label>Image Source</Label>
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
                                      onClick={() => handleRemoveFile(storyboard.id, 'file')}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      Using uploaded image
                                    </div>
                                  </div>
                                ) : storyboard.image_url ? (
                                  <div className="mt-2 space-y-2">
                                    <div className="relative">
                                      <img 
                                        src={storyboard.image_url} 
                                        alt="Storyboard" 
                                        className="w-full h-48 object-cover rounded-md border"
                                      />
                                      <div className="absolute top-2 left-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded">
                                        Using Storyboard Image
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Using storyboard image. You can upload a different image if needed.
                                    </div>
                                    <div className="mt-2">
                                      <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleFileUpload(storyboard.id, file, 'file')
                                        }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-2">
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileUpload(storyboard.id, file, 'file')
                                      }}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Upload an image or use a storyboard that has an image
                                    </p>
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
                                      onClick={() => handleRemoveFile(storyboard.id, 'file')}
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
                                        if (file) handleFileUpload(storyboard.id, file, 'file')
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {fileRequirement === 'start-end-frames' && (
                              <>
                                {/* Model Type and Duration for Kling/Veo */}
                                {(generation.model === "Kling 2.1 Pro (Frame-to-Frame)" || 
                                  generation.model === "Veo 3.1 (Frame-to-Frame)" || 
                                  generation.model === "Veo 3.1 Fast (Frame-to-Frame)") && (
                                  <>
                                    <div>
                                      <Label>Duration (seconds)</Label>
                                      <Select 
                                        value={generation.videoDuration?.toString() || (generation.videoModelType === 'KLING2_1' ? '5' : '8')} 
                                        onValueChange={(v) => updateStoryboardGeneration(storyboard.id, { videoDuration: parseInt(v) })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(generation.videoModelType === 'VEO3_1' || generation.videoModelType === 'VEO3_1FAST') ? (
                                            <>
                                              <SelectItem value="4">4 seconds</SelectItem>
                                              <SelectItem value="6">6 seconds</SelectItem>
                                              <SelectItem value="8">8 seconds</SelectItem>
                                            </>
                                          ) : (
                                            <>
                                              <SelectItem value="5">5 seconds</SelectItem>
                                              <SelectItem value="10">10 seconds</SelectItem>
                                            </>
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {generation.videoModelType === 'VEO3_1' || generation.videoModelType === 'VEO3_1FAST' 
                                          ? 'Veo 3.1 supports 4, 6, or 8 seconds with end frames'
                                          : 'Kling 2.1 Pro supports 5 or 10 seconds'}
                                      </p>
                                    </div>
                                  </>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Start Frame (Required)</Label>
                                    {generation.startFramePreview || generation.startFrameImageUrl ? (
                                      <div className="relative mt-2">
                                        <img 
                                          src={generation.startFramePreview || generation.startFrameImageUrl || ''} 
                                          alt="Start Frame" 
                                          className="w-full h-48 object-cover rounded-md"
                                        />
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2"
                                          onClick={() => updateStoryboardGeneration(storyboard.id, { 
                                            startFrame: null, 
                                            startFramePreview: null,
                                            startFrameImageUrl: null
                                          })}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                        {generation.startFrameImageUrl && (
                                          <div className="absolute top-2 left-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded">
                                            From Storyboard
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="mt-2 space-y-2">
                                        <Input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) handleFileUpload(storyboard.id, file, 'startFrame')
                                          }}
                                        />
                                        {/* Link to storyboard images */}
                                        {storyboards.length > 0 && (
                                          <Select
                                            value=""
                                            onValueChange={(storyboardId) => {
                                              const selectedStoryboard = storyboards.find(s => s.id === storyboardId)
                                              if (selectedStoryboard?.image_url) {
                                                updateStoryboardGeneration(storyboard.id, { 
                                                  startFrameImageUrl: selectedStoryboard.image_url,
                                                  startFramePreview: selectedStoryboard.image_url
                                                })
                                              }
                                            }}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Or select from storyboard images..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {/* Show current shot first with special label */}
                                              {storyboard.image_url && (
                                                <SelectItem key={storyboard.id} value={storyboard.id}>
                                                  This shot (Shot {storyboard.shot_number}: {storyboard.title || 'Untitled'})
                                                </SelectItem>
                                              )}
                                              {/* Then show other storyboards */}
                                              {storyboards
                                                .filter(s => s.image_url && s.id !== storyboard.id)
                                                .map((sb) => (
                                                  <SelectItem key={sb.id} value={sb.id}>
                                                    Shot {sb.shot_number}: {sb.title || 'Untitled'}
                                                  </SelectItem>
                                                ))}
                                            </SelectContent>
                                          </Select>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <Label>End Frame (Optional)</Label>
                                    {generation.endFramePreview || generation.endFrameImageUrl ? (
                                      <div className="relative mt-2">
                                        <img 
                                          src={generation.endFramePreview || generation.endFrameImageUrl || ''} 
                                          alt="End Frame" 
                                          className="w-full h-48 object-cover rounded-md"
                                        />
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="absolute top-2 right-2"
                                          onClick={() => updateStoryboardGeneration(storyboard.id, { 
                                            endFrame: null, 
                                            endFramePreview: null,
                                            endFrameImageUrl: null
                                          })}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                        {generation.endFrameImageUrl && (
                                          <div className="absolute top-2 left-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded">
                                            From Storyboard
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="mt-2 space-y-2">
                                        <Input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) handleFileUpload(storyboard.id, file, 'endFrame')
                                          }}
                                        />
                                        {/* Link to storyboard images */}
                                        {storyboards.length > 0 && (
                                          <Select
                                            value=""
                                            onValueChange={(storyboardId) => {
                                              const selectedStoryboard = storyboards.find(s => s.id === storyboardId)
                                              if (selectedStoryboard?.image_url) {
                                                updateStoryboardGeneration(storyboard.id, { 
                                                  endFrameImageUrl: selectedStoryboard.image_url,
                                                  endFramePreview: selectedStoryboard.image_url
                                                })
                                              }
                                            }}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Or select from storyboard images..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {/* Show current shot first with special label */}
                                              {storyboard.image_url && (
                                                <SelectItem key={storyboard.id} value={storyboard.id}>
                                                  This shot (Shot {storyboard.shot_number}: {storyboard.title || 'Untitled'})
                                                </SelectItem>
                                              )}
                                              {/* Then show other storyboards */}
                                              {storyboards
                                                .filter(s => s.image_url && s.id !== storyboard.id)
                                                .map((sb) => (
                                                  <SelectItem key={sb.id} value={sb.id}>
                                                    Shot {sb.shot_number}: {sb.title || 'Untitled'}
                                                  </SelectItem>
                                                ))}
                                            </SelectContent>
                                          </Select>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Motion Control for Leonardo Motion 2.0 */}
                            {generation.model === "Leonardo Motion 2.0" && (
                              <>
                                <div>
                                  <Label>Motion Control (Optional)</Label>
                                  <Select 
                                    value={generation.motionControl || "none"} 
                                    onValueChange={(value) => updateStoryboardGeneration(storyboard.id, { 
                                      motionControl: value === "none" ? "" : value 
                                    })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select motion control (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      <SelectItem value="BULLET_TIME">Bullet Time</SelectItem>
                                      <SelectItem value="CRANE_DOWN">Crane Down</SelectItem>
                                      <SelectItem value="CRANE_UP">Crane Up</SelectItem>
                                      <SelectItem value="CRASH_ZOOM_IN">Crash Zoom In</SelectItem>
                                      <SelectItem value="CRASH_ZOOM_OUT">Crash Zoom Out</SelectItem>
                                      <SelectItem value="DOLLY_IN">Dolly In</SelectItem>
                                      <SelectItem value="DOLLY_OUT">Dolly Out</SelectItem>
                                      <SelectItem value="DOLLY_LEFT">Dolly Left</SelectItem>
                                      <SelectItem value="DOLLY_RIGHT">Dolly Right</SelectItem>
                                      <SelectItem value="PAN_LEFT">Pan Left</SelectItem>
                                      <SelectItem value="PAN_RIGHT">Pan Right</SelectItem>
                                      <SelectItem value="PAN_UP">Pan Up</SelectItem>
                                      <SelectItem value="PAN_DOWN">Pan Down</SelectItem>
                                      <SelectItem value="TILT_UP">Tilt Up</SelectItem>
                                      <SelectItem value="TILT_DOWN">Tilt Down</SelectItem>
                                      <SelectItem value="ZOOM_IN">Zoom In</SelectItem>
                                      <SelectItem value="ZOOM_OUT">Zoom Out</SelectItem>
                                      <SelectItem value="PUSH_IN">Push In</SelectItem>
                                      <SelectItem value="PUSH_OUT">Push Out</SelectItem>
                                      <SelectItem value="TRACK_IN">Track In</SelectItem>
                                      <SelectItem value="TRACK_OUT">Track Out</SelectItem>
                                      <SelectItem value="TRACK_LEFT">Track Left</SelectItem>
                                      <SelectItem value="TRACK_RIGHT">Track Right</SelectItem>
                                      <SelectItem value="ROTATE_CLOCKWISE">Rotate Clockwise</SelectItem>
                                      <SelectItem value="ROTATE_COUNTER_CLOCKWISE">Rotate Counter Clockwise</SelectItem>
                                      <SelectItem value="ROLL">Roll</SelectItem>
                                      <SelectItem value="FADE_IN">Fade In</SelectItem>
                                      <SelectItem value="FADE_OUT">Fade Out</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Select a cinematic motion control effect (optional). Motion 2.0 supports advanced camera movements.
                                  </p>
                                </div>

                                {!generation.motionControl && (
                                  <div>
                                    <Label>Motion Strength: {generation.motionStrength || 2}</Label>
                                    <Input
                                      type="range"
                                      min="1"
                                      max="10"
                                      value={generation.motionStrength || 2}
                                      onChange={(e) => updateStoryboardGeneration(storyboard.id, { 
                                        motionStrength: parseInt(e.target.value) 
                                      })}
                                      className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Controls the intensity of motion (1 = subtle, 10 = dramatic). Only used when motion control is not selected.
                                    </p>
                                  </div>
                                )}
                              </>
                            )}

                            <Button
                              onClick={() => handleGenerateVideo(storyboard)}
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

                            {(() => {
                              const videos = storyboardVideos.get(storyboard.id) || []
                              // Include current generated video if it exists and isn't already in the database
                              const hasGeneratedVideo = !!generation.generatedVideoUrl
                              const generatedVideoInDb = hasGeneratedVideo && videos.some(v => v.video_url === generation.generatedVideoUrl)
                              const totalVideoCount = videos.length + (hasGeneratedVideo && !generatedVideoInDb ? 1 : 0)
                              // Always show button if there are 2+ videos in database (persistent across refreshes)
                              const hasMultipleVideos = videos.length > 1
                              
                              console.log(`📹 Storyboard ${storyboard.id} videos:`, {
                                dbVideos: videos.length,
                                hasGenerated: hasGeneratedVideo,
                                generatedInDb: generatedVideoInDb,
                                totalCount: totalVideoCount,
                                hasMultiple: hasMultipleVideos,
                                willShowButton: hasMultipleVideos
                              })
                              
                              // Prioritize: 1) default/starred video, 2) any saved video, 3) generated video
                              const defaultVideo = videos.find(v => v.is_default)
                              const displayVideoUrl = defaultVideo?.video_url || (videos.length > 0 ? videos[0]?.video_url : null) || generation.generatedVideoUrl

                              console.log(`📹 Storyboard ${storyboard.id} videos:`, {
                                dbVideos: videos.length,
                                hasGenerated: hasGeneratedVideo,
                                generatedInDb: generatedVideoInDb,
                                totalCount: totalVideoCount,
                                hasMultiple: hasMultipleVideos,
                                willShowButton: hasMultipleVideos,
                                displayVideoUrl: displayVideoUrl ? 'exists' : 'null',
                                defaultVideoUrl: defaultVideo?.video_url ? 'exists' : 'null',
                                generatedVideoUrl: generation.generatedVideoUrl ? 'exists' : 'null',
                                defaultVideo: defaultVideo ? { id: defaultVideo.id, url: defaultVideo.video_url?.substring(0, 50) } : 'null'
                              })

                              // Video is now displayed in the toggle section above, so we don't need to show it here
                              // This section is only for the generation form
                              return null
                            })()}
                          </>
                        )}
                            </>
                          )
                        })()}

                        {/* Audio Generation Section */}
                        <div className="mt-6 pt-6 border-t">
                          <div className="flex items-center gap-2 mb-4">
                            <Volume2 className="h-5 w-5" />
                            <h3 className="text-lg font-semibold">Audio Generation</h3>
                          </div>

                          {/* Dialogue Generation */}
                          <div className="mb-4">
                            <Label className="flex items-center gap-2 mb-2">
                              <Music className="h-4 w-4" />
                              Dialogue (Text-to-Speech)
                            </Label>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Textarea
                                  value={storyboard.action || ''}
                                  onChange={(e) => {
                                    // Update storyboard action in real-time
                                    const updatedStoryboards = storyboards.map(sb => 
                                      sb.id === storyboard.id 
                                        ? { ...sb, action: e.target.value }
                                        : sb
                                    )
                                    setStoryboards(updatedStoryboards)
                                  }}
                                  onBlur={async (e) => {
                                    // Save to database when user finishes editing
                                    const newValue = e.target.value.trim()
                                    if (newValue !== (storyboard.action || '')) {
                                      try {
                                        const supabase = getSupabaseClient()
                                        const { error } = await supabase
                                          .from('storyboards')
                                          .update({ action: newValue || null })
                                          .eq('id', storyboard.id)
                                        
                                        if (error) {
                                          console.error('Error saving dialogue:', error)
                                        }
                                      } catch (error) {
                                        console.error('Error saving dialogue:', error)
                                      }
                                    }
                                  }}
                                  placeholder="Enter dialogue text to generate speech..."
                                  className="flex-1"
                                  rows={3}
                                />
                                <div className="flex flex-col gap-2">
                                  <Button
                                    onClick={() => {
                                      if (storyboard.action) {
                                        handleGenerateDialogue(storyboard, storyboard.action)
                                      }
                                    }}
                                    disabled={!storyboard.action?.trim() || audioGenerations.get(`${storyboard.id}-dialogue`)?.isGenerating || !userApiKeys.elevenlabs_api_key}
                                    size="sm"
                                  >
                                    {audioGenerations.get(`${storyboard.id}-dialogue`)?.isGenerating ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="h-4 w-4 mr-2" />
                                        Generate
                                      </>
                                    )}
                                  </Button>
                                  {storyboard.action && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        // Clear the action text
                                        try {
                                          const supabase = getSupabaseClient()
                                          const { error } = await supabase
                                            .from('storyboards')
                                            .update({ action: null })
                                            .eq('id', storyboard.id)
                                          
                                          if (!error) {
                                            const updatedStoryboards = storyboards.map(sb => 
                                              sb.id === storyboard.id 
                                                ? { ...sb, action: null }
                                                : sb
                                            )
                                            setStoryboards(updatedStoryboards)
                                            toast({
                                              title: "Dialogue Cleared",
                                              description: "The dialogue text has been removed.",
                                            })
                                          }
                                        } catch (error) {
                                          console.error('Error clearing dialogue:', error)
                                        }
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {audioGenerations.get(`${storyboard.id}-dialogue`)?.audioUrl && (
                                <div className="space-y-2">
                                  <audio controls src={audioGenerations.get(`${storyboard.id}-dialogue`)?.audioUrl || ''} className="w-full" />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1"
                                      onClick={() => {
                                        const audioUrl = audioGenerations.get(`${storyboard.id}-dialogue`)?.audioUrl
                                        if (audioUrl) {
                                          const link = document.createElement('a')
                                          link.href = audioUrl
                                          link.download = `dialogue_shot_${storyboard.shot_number}_${Date.now()}.mp3`
                                          document.body.appendChild(link)
                                          link.click()
                                          document.body.removeChild(link)
                                        }
                                      }}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1"
                                      onClick={async () => {
                                        const audioUrl = audioGenerations.get(`${storyboard.id}-dialogue`)?.audioUrl
                                        const prompt = storyboard.action || ''
                                        if (audioUrl) {
                                          await handleSaveAudio(audioUrl, prompt, 'dialogue', storyboard)
                                        }
                                      }}
                                    >
                                      <Save className="h-4 w-4 mr-2" />
                                      Save to Storage
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Sound Effects Generation */}
                          <div>
                            <Label className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4" />
                              Sound Effects
                            </Label>
                            <SoundEffectGenerator
                              storyboard={storyboard}
                              onGenerate={handleGenerateSoundEffect}
                              isGenerating={audioGenerations.get(`${storyboard.id}-sound-effect`)?.isGenerating || false}
                              audioUrl={audioGenerations.get(`${storyboard.id}-sound-effect`)?.audioUrl || null}
                              hasApiKey={!!userApiKeys.elevenlabs_api_key}
                              onSaveAudio={async (audioUrl, prompt) => {
                                await handleSaveAudio(audioUrl, prompt, 'sound-effect', storyboard)
                              }}
                              userId={userId || undefined}
                              projectId={selectedProjectId || undefined}
                              sceneId={selectedSceneId || undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Video Selector Dialog */}
      <Dialog open={videoSelectorOpen} onOpenChange={setVideoSelectorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Video</DialogTitle>
            <DialogDescription>
              Choose a video to play or set as default
            </DialogDescription>
          </DialogHeader>
          {selectedStoryboardForVideos && (() => {
            const videos = storyboardVideos.get(selectedStoryboardForVideos) || []
            const storyboard = storyboards.find(s => s.id === selectedStoryboardForVideos)
            const generation = storyboardGenerations.get(selectedStoryboardForVideos)
            
            // Include current generated video if it exists and isn't in database
            const allVideos = [...videos]
            if (generation?.generatedVideoUrl && !videos.some(v => v.video_url === generation.generatedVideoUrl)) {
              // Add generated video as a temporary entry
              allVideos.unshift({
                id: 'generated-temp',
                storyboard_id: selectedStoryboardForVideos,
                user_id: userId || '',
                video_url: generation.generatedVideoUrl,
                video_name: `${storyboard?.title || 'storyboard'}-shot-${storyboard?.shot_number} (Generated)`,
                is_default: false,
                generation_model: generation.model || null,
                generation_prompt: generation.prompt || null,
                metadata: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            }

            return (
              <div className="space-y-4 mt-4">
                {allVideos.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No videos saved for this storyboard.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {allVideos.map((video) => (
                      <div
                        key={video.id}
                        className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                          selectedVideoUrl === video.video_url
                            ? 'border-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedVideoUrl(video.video_url)}
                      >
                        <div className="relative">
                          <video
                            src={video.video_url}
                            className="w-full aspect-video object-cover"
                            muted
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause()
                              e.currentTarget.currentTime = 0
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            {video.id !== 'generated-temp' ? (
                              <Button
                                size="sm"
                                variant={video.is_default ? "default" : "secondary"}
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (video.is_default) {
                                    handleUnsetDefaultVideo(video.id, video.storyboard_id)
                                  } else {
                                    handleSetDefaultVideo(video.id, video.storyboard_id)
                                  }
                                }}
                                title={video.is_default ? "Remove as default" : "Set as default"}
                              >
                                <Star className={`h-4 w-4 ${video.is_default ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                          {video.is_default && (
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                              Default
                            </div>
                          )}
                        </div>
                        <div className="bg-muted p-2">
                          <div className="truncate text-sm font-medium">{video.video_name || 'Video'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedVideoUrl && (
                  <div className="mt-4">
                    <video
                      src={selectedVideoUrl}
                      controls
                      className="w-full rounded-md"
                      key={selectedVideoUrl}
                      autoPlay
                      onLoadedData={(e) => {
                        // Ensure video plays when loaded
                        e.currentTarget.play().catch(() => {
                          // Autoplay might be blocked, that's okay
                        })
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

