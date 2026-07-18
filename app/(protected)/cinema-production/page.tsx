"use client"

import { useState, useEffect, useMemo, useCallback, type ChangeEvent } from "react"
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
  Zap,
  Trash2,
  Sparkles,
  Wand2,
  Images,
  Link2,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ImageSizeBadge } from "@/components/image-size-badge"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieService, type Movie } from "@/lib/movie-service"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
import { ShotListService, type ShotList } from "@/lib/shot-list-service"
import { KlingService, ElevenLabsService } from "@/lib/ai-services"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { getSupabaseClient } from "@/lib/supabase"
import { AISettingsService } from "@/lib/ai-settings-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { ProjectVoicesService, type ProjectVoice } from "@/lib/project-voices-service"
import {
  findHedraCharacter3ModelId,
  runHedraAvatarPipeline,
} from "@/lib/hedra-avatar-client"
import {
  DEFAULT_CINEMATIC_IMAGE_HEIGHT,
  DEFAULT_CINEMATIC_IMAGE_WIDTH,
  displayModelSupportsReferenceImage,
  mapDisplayModelToService,
  migrateGPTImageDisplayLabel,
  normalizeDisplayModelToApiId,
} from "@/lib/image-model-utils"
import {
  buildLinkedAssetGroups,
  getProjectAssetSourceLabel,
  referenceUrlToFile,
} from "@/lib/project-image-linking"

const MAX_LINKED_REFERENCE_IMAGES = 5

const VIDEO_FRAME_PRESETS = [
  {
    id: "start",
    label: "Start of action",
    directive: "the very beginning of the action, subject just starting to move",
  },
  {
    id: "mid",
    label: "Mid-action",
    directive: "the peak of the action with clear subject motion",
  },
  {
    id: "end",
    label: "End of action",
    directive: "the end of the action, subject completing the movement",
  },
  {
    id: "closer",
    label: "Closer framing",
    directive: "tighter closer framing on the main subject, same moment",
  },
  {
    id: "wider",
    label: "Wider framing",
    directive: "wider establishing framing of the same scene and subjects",
  },
  {
    id: "alt-angle",
    label: "Alternate angle",
    directive: "a slightly different camera angle of the same moment and subjects",
  },
] as const

type FrameApplyTarget = "shot" | "video" | "start" | "end" | "library"

type ShotReferenceFrame = {
  id: string
  url: string
  label: string
  createdAt: number
}

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
  | "Hedra Character 3"

type SavedAudioSource = "saved" | "session-dialogue" | "session-sfx"

interface StoryboardAudioOption {
  id: string
  label: string
  url: string
  source: SavedAudioSource
}

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
  savedAudioOptionId?: string | null // asset id or session-dialogue / session-sfx
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

function suggestAudioSaveName(
  type: "dialogue" | "sound-effect",
  storyboard: Storyboard,
  prompt: string,
): string {
  const shotLabel = `S${storyboard.shot_number}`
  const cleaned = prompt.trim().replace(/^["']+|["']+$/g, "")
  const snippet = cleaned.slice(0, 28).trim()
  const ellipsis = cleaned.length > 28 ? "…" : ""
  if (type === "dialogue") {
    return snippet ? `${shotLabel} ${snippet}${ellipsis}` : `${shotLabel} dialogue`
  }
  return snippet ? `${shotLabel} SFX ${snippet}${ellipsis}` : `${shotLabel} SFX`
}

function sanitizeAudioFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "audio"
}

function safeVideoPlay(video: HTMLVideoElement) {
  void video.play().catch(() => {
    /* aborted when switching clips or closing dialog */
  })
}

/** Seek slightly into the video so the browser paints a real frame (not a storyboard still). */
function showVideoFrameThumbnail(video: HTMLVideoElement, time = 0.1) {
  const seek = () => {
    try {
      const duration = video.duration
      if (Number.isFinite(duration) && duration > 0) {
        video.currentTime = Math.min(time, duration * 0.1)
      } else {
        video.currentTime = time
      }
    } catch {
      /* ignore seek errors on unsupported sources */
    }
  }
  if (video.readyState >= 1) seek()
  else video.addEventListener("loadedmetadata", seek, { once: true })
}

interface SessionAudioClip {
  id: string
  type: "dialogue" | "sound-effect"
  prompt: string
  audioUrl: string
  createdAt: number
}

function sessionAudioOptionId(clipId: string) {
  return `session-${clipId}`
}

function audioSaveNameKey(storyboardId: string, clipId: string) {
  return `${storyboardId}-${clipId}`
}

function SessionAudioClipList({
  clips,
  getSaveName,
  onSaveNameChange,
  onDownload,
  onSave,
  onRemove,
  savingClipId,
}: {
  clips: SessionAudioClip[]
  getSaveName: (clip: SessionAudioClip) => string
  onSaveNameChange: (clipId: string, name: string) => void
  onDownload: (clip: SessionAudioClip) => void
  onSave?: (clip: SessionAudioClip, saveName: string) => Promise<void>
  onRemove?: (clipId: string) => void
  savingClipId?: string | null
}) {
  if (!clips.length) return null

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">
        Generated clips ({clips.length})
      </Label>
      {[...clips].reverse().map((clip) => {
        const saveName = getSaveName(clip)
        return (
          <div key={clip.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{clip.prompt}</p>
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => onRemove(clip.id)}
                  title="Remove clip"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <audio controls src={clip.audioUrl} className="w-full" />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Save as</Label>
              <Input
                value={saveName}
                onChange={(e) => onSaveNameChange(clip.id, e.target.value)}
                placeholder="Audio name"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onDownload(clip)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              {onSave && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={savingClipId === clip.id}
                  onClick={() => void onSave(clip, saveName)}
                >
                  {savingClipId === clip.id ? (
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
        )
      })}
    </div>
  )
}

// Sound Effect Generator Component
function SoundEffectGenerator({ 
  storyboard, 
  clips,
  onGenerate, 
  isGenerating, 
  hasApiKey,
  onSaveAudio,
  userId,
  projectId,
  sceneId,
  getSaveName,
  onSaveNameChange,
  onRemoveClip,
  savingClipId,
  onPromptAssist,
  promptAssistLoading,
}: { 
  storyboard: Storyboard
  clips: SessionAudioClip[]
  onGenerate: (storyboard: Storyboard, prompt: string, duration?: number, prompt_influence?: number, looping?: boolean) => void
  isGenerating: boolean
  hasApiKey: boolean
  onSaveAudio?: (clip: SessionAudioClip, saveName: string) => Promise<void>
  userId?: string
  projectId?: string
  sceneId?: string
  getSaveName: (clip: SessionAudioClip) => string
  onSaveNameChange: (clipId: string, name: string) => void
  onRemoveClip?: (clipId: string) => void
  savingClipId?: string | null
  onPromptAssist?: () => Promise<string | null>
  promptAssistLoading?: boolean
}) {
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState<number | undefined>(undefined)
  const [promptInfluence, setPromptInfluence] = useState<number>(0.5)
  const [looping, setLooping] = useState(false)

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Describe the sound effect (e.g., 'Glass shattering on concrete', 'Thunder rumbling in the distance')"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
      />
      {onPromptAssist && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-1.5"
            disabled={promptAssistLoading || isGenerating}
            onClick={async () => {
              const assisted = await onPromptAssist()
              if (assisted?.trim()) setPrompt(assisted.trim())
            }}
            title="Build a sound-effect prompt from shot details and reference image"
          >
            {promptAssistLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Prompt Assist
          </Button>
          <p className="text-xs text-muted-foreground self-center">
            Uses shot action, notes, and image when available.
          </p>
        </div>
      )}
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
      {userId && projectId && sceneId && (
        <SessionAudioClipList
          clips={clips}
          getSaveName={getSaveName}
          onSaveNameChange={onSaveNameChange}
          onDownload={(clip) => {
            const link = document.createElement("a")
            link.href = clip.audioUrl
            link.download = `${sanitizeAudioFileName(getSaveName(clip))}.mp3`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }}
          onSave={onSaveAudio}
          onRemove={onRemoveClip}
          savingClipId={savingClipId}
        />
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
  const [viewMode, setViewMode] = useState<'sequence' | 'grid' | 'detail'>('detail')
  
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
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null)
  const [promptAssistLoadingId, setPromptAssistLoadingId] = useState<string | null>(null)
  const [audioPromptAssistLoadingId, setAudioPromptAssistLoadingId] = useState<string | null>(null)

  // Image edit + frame refs for video generation
  const [imageEditDialogOpen, setImageEditDialogOpen] = useState(false)
  const [framesDialogOpen, setFramesDialogOpen] = useState(false)
  const [imageToolsStoryboard, setImageToolsStoryboard] = useState<Storyboard | null>(null)
  const [imageEditPrompt, setImageEditPrompt] = useState("")
  const [imageEditUploading, setImageEditUploading] = useState(false)
  const [imageEditProgress, setImageEditProgress] = useState("")
  const [imageEditReferenceFile, setImageEditReferenceFile] = useState<File | null>(null)
  const [imageEditReferencePreview, setImageEditReferencePreview] = useState<string | null>(null)
  const [imageEditStyleLinkAssetIds, setImageEditStyleLinkAssetIds] = useState<string[]>([])
  const [projectImageAssets, setProjectImageAssets] = useState<Asset[]>([])
  const [projectLocations, setProjectLocations] = useState<Location[]>([])
  const [isLoadingProjectAssets, setIsLoadingProjectAssets] = useState(false)
  const [framePresetId, setFramePresetId] = useState<string>(VIDEO_FRAME_PRESETS[0].id)
  const [frameCustomDirection, setFrameCustomDirection] = useState("")
  const [frameApplyTarget, setFrameApplyTarget] = useState<FrameApplyTarget>("video")
  const [frameGenerating, setFrameGenerating] = useState(false)
  const [frameProgress, setFrameProgress] = useState("")
  const [shotReferenceFrames, setShotReferenceFrames] = useState<Map<string, ShotReferenceFrame[]>>(
    new Map(),
  )
  
  // Toggle between image and video in detail view (per storyboard)
  const [detailViewMode, setDetailViewMode] = useState<Map<string, 'image' | 'video'>>(new Map())

  // Full-size image viewer
  const [fullImageViewerOpen, setFullImageViewerOpen] = useState(false)
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null)
  const [fullImageTitle, setFullImageTitle] = useState<string>("")
  
  // Audio generation state
  const [aiSettings, setAiSettings] = useState<any[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const [sessionAudioClips, setSessionAudioClips] = useState<Map<string, SessionAudioClip[]>>(new Map())
  const [audioGenerating, setAudioGenerating] = useState<Map<string, boolean>>(new Map())
  const [savingAudioClipId, setSavingAudioClipId] = useState<string | null>(null)

  const [hedraCharacter3ModelId, setHedraCharacter3ModelId] = useState<string | null>(null)
  const [storyboardSavedAudio, setStoryboardSavedAudio] = useState<Map<string, Asset[]>>(new Map())
  const [projectCharacters, setProjectCharacters] = useState<Character[]>([])
  const [projectVoices, setProjectVoices] = useState<ProjectVoice[]>([])
  const [dialogueVoiceByStoryboard, setDialogueVoiceByStoryboard] = useState<Map<string, string>>(new Map())
  const [audioSaveNames, setAudioSaveNames] = useState<Map<string, string>>(new Map())

  const getAudioSaveNameForClip = useCallback(
    (storyboard: Storyboard, clip: SessionAudioClip) => {
      const key = audioSaveNameKey(storyboard.id, clip.id)
      return audioSaveNames.get(key) || suggestAudioSaveName(clip.type, storyboard, clip.prompt)
    },
    [audioSaveNames],
  )

  const setDefaultAudioSaveName = useCallback(
    (storyboard: Storyboard, clipId: string, type: "dialogue" | "sound-effect", prompt: string) => {
      const key = audioSaveNameKey(storyboard.id, clipId)
      setAudioSaveNames((prev) => {
        const next = new Map(prev)
        next.set(key, suggestAudioSaveName(type, storyboard, prompt))
        return next
      })
    },
    [],
  )

  const getSessionClipsForStoryboard = useCallback(
    (storyboardId: string, type?: SessionAudioClip["type"]) => {
      const clips = sessionAudioClips.get(storyboardId) || []
      return type ? clips.filter((clip) => clip.type === type) : clips
    },
    [sessionAudioClips],
  )

  const addSessionClip = useCallback((storyboardId: string, clip: SessionAudioClip) => {
    setSessionAudioClips((prev) => {
      const clips = prev.get(storyboardId) || []
      return new Map(prev).set(storyboardId, [...clips, clip])
    })
  }, [])

  const removeSessionClip = useCallback((storyboardId: string, clipId: string) => {
    setSessionAudioClips((prev) => {
      const clips = prev.get(storyboardId) || []
      const clip = clips.find((c) => c.id === clipId)
      if (clip?.audioUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(clip.audioUrl)
      }
      const remaining = clips.filter((c) => c.id !== clipId)
      const next = new Map(prev)
      if (remaining.length) next.set(storyboardId, remaining)
      else next.delete(storyboardId)
      return next
    })
    setAudioSaveNames((prev) => {
      const next = new Map(prev)
      next.delete(audioSaveNameKey(storyboardId, clipId))
      return next
    })
  }, [])

  const dialogueVoiceOptions = useMemo(() => {
    const map = new Map<string, { voice_id: string; name: string; characterName?: string }>()

    for (const character of projectCharacters) {
      if (character.elevenlabs_voice_id) {
        map.set(character.elevenlabs_voice_id, {
          voice_id: character.elevenlabs_voice_id,
          name: character.elevenlabs_voice_name || character.name,
          characterName: character.name,
        })
      }
    }

    for (const voice of projectVoices) {
      if (!map.has(voice.elevenlabs_voice_id)) {
        const linkedCharacter = voice.character_id
          ? projectCharacters.find((c) => c.id === voice.character_id)
          : null
        map.set(voice.elevenlabs_voice_id, {
          voice_id: voice.elevenlabs_voice_id,
          name: voice.name,
          characterName: linkedCharacter?.name,
        })
      }
    }

    return Array.from(map.values())
  }, [projectCharacters, projectVoices])

  const getDialogueVoiceId = useCallback(
    (storyboard: Storyboard): string => {
      const manual = dialogueVoiceByStoryboard.get(storyboard.id)
      if (manual) return manual

      if (storyboard.character_id) {
        const character = projectCharacters.find((c) => c.id === storyboard.character_id)
        if (character?.elevenlabs_voice_id) return character.elevenlabs_voice_id
      }

      return dialogueVoiceOptions[0]?.voice_id || ""
    },
    [dialogueVoiceByStoryboard, projectCharacters, dialogueVoiceOptions],
  )

  useEffect(() => {
    if (!ready) return
    void findHedraCharacter3ModelId().then(setHedraCharacter3ModelId)
  }, [ready])

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
      loadProjectVoiceData()
    } else {
      setScenes([])
      setSelectedSceneId("")
      // Clear storyboards when project changes
      setStoryboards([])
      setSelectedStoryboardId("")
      setSelectedStoryboard(null)
      setProjectCharacters([])
      setProjectVoices([])
      setDialogueVoiceByStoryboard(new Map())
    }
  }, [selectedProjectId, ready])

  // Project images + locations for Edit Image linking (same as storyboards)
  useEffect(() => {
    const loadLinkableAssets = async () => {
      if (!selectedProjectId || !ready || !userId) {
        setProjectImageAssets([])
        setProjectLocations([])
        return
      }
      setIsLoadingProjectAssets(true)
      try {
        const [assets, locs] = await Promise.all([
          AssetService.getAssetsForProject(selectedProjectId),
          LocationsService.getLocations(selectedProjectId),
        ])
        setProjectImageAssets(assets.filter((a) => a.content_type === "image" && a.content_url))
        setProjectLocations(locs)
      } catch (error) {
        console.error("Error loading project assets for image edit:", error)
        setProjectImageAssets([])
        setProjectLocations([])
      } finally {
        setIsLoadingProjectAssets(false)
      }
    }
    void loadLinkableAssets()
  }, [selectedProjectId, ready, userId])

  const linkedProjectImageGroups = useMemo(
    () => buildLinkedAssetGroups(projectImageAssets, projectLocations, projectCharacters),
    [projectImageAssets, projectLocations, projectCharacters],
  )

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
        const imagesSetting = await AISettingsService.getOrCreateDefaultTabSetting('images')
        const finalAudio = settings.find(s => s.tab_type === 'audio') || audioSetting
        const finalImages = settings.find(s => s.tab_type === 'images') || imagesSetting
        
        setAiSettings([finalAudio, finalImages])
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

  const loadProjectVoiceData = async () => {
    if (!selectedProjectId) return

    try {
      const [characters, voices] = await Promise.all([
        CharactersService.getCharacters(selectedProjectId),
        ProjectVoicesService.getVoicesForProject(selectedProjectId),
      ])
      setProjectCharacters(characters)
      setProjectVoices(voices)
    } catch (error) {
      console.error("Error loading project voices:", error)
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
      await loadSavedAudioForScene(selectedSceneId)
      
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

  const loadSavedAudioForScene = async (sceneId: string) => {
    try {
      const assets = await AssetService.getAssetsForScene(sceneId)
      const byStoryboard = new Map<string, Asset[]>()
      for (const asset of assets) {
        if (asset.content_type !== "audio" || !asset.content_url) continue
        const storyboardId = asset.metadata?.storyboard_id as string | undefined
        if (!storyboardId) continue
        const list = byStoryboard.get(storyboardId) || []
        list.push(asset)
        byStoryboard.set(storyboardId, list)
      }
      setStoryboardSavedAudio(byStoryboard)
    } catch (error) {
      console.error("Error loading saved shot audio:", error)
      setStoryboardSavedAudio(new Map())
    }
  }

  const getAudioOptionsForStoryboard = (storyboardId: string): StoryboardAudioOption[] => {
    const options: StoryboardAudioOption[] = []
    const storyboard = storyboards.find((s) => s.id === storyboardId)
    const sessionClips = [...(sessionAudioClips.get(storyboardId) || [])].reverse()
    for (const clip of sessionClips) {
      if (!clip.audioUrl) continue
      const typeLabel = clip.type === "dialogue" ? "Dialogue" : "SFX"
      const name =
        storyboard && audioSaveNames.get(audioSaveNameKey(storyboardId, clip.id))
          ? audioSaveNames.get(audioSaveNameKey(storyboardId, clip.id))!
          : storyboard
            ? suggestAudioSaveName(clip.type, storyboard, clip.prompt)
            : clip.prompt.slice(0, 32)
      options.push({
        id: sessionAudioOptionId(clip.id),
        label: `${typeLabel}: ${name}`,
        url: clip.audioUrl,
        source: clip.type === "dialogue" ? "session-dialogue" : "session-sfx",
      })
    }
    const saved = storyboardSavedAudio.get(storyboardId) || []
    for (const asset of saved) {
      if (!asset.content_url) continue
      const typeLabel =
        asset.metadata?.type === "dialogue"
          ? "Dialogue"
          : asset.metadata?.type === "sound-effect"
            ? "SFX"
            : "Audio"
      options.push({
        id: asset.id,
        label: `${typeLabel}: ${asset.title}`,
        url: asset.content_url,
        source: "saved",
      })
    }
    return options
  }

  const resolveSelectedAudioForStoryboard = (
    storyboardId: string,
    optionId: string | null | undefined,
  ): StoryboardAudioOption | null => {
    const options = getAudioOptionsForStoryboard(storyboardId)
    if (!options.length) return null
    if (optionId) {
      return options.find((o) => o.id === optionId) ?? options[0]
    }
    return options[0]
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

  const getModelFileRequirement = (
    model: VideoModel,
  ): "none" | "image" | "video" | "start-end-frames" | "hedra-avatar" => {
    switch (model) {
      case "Hedra Character 3":
        return "hedra-avatar"
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
        endFrameImageUrl: null,
        savedAudioOptionId: null,
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

    const camera = [
      storyboard.shot_type ? `${storyboard.shot_type} shot` : null,
      storyboard.camera_angle ? `${storyboard.camera_angle} angle` : null,
      storyboard.movement
        ? storyboard.movement.toLowerCase() === 'static'
          ? 'static camera'
          : `${storyboard.movement} camera movement`
        : null,
    ].filter(Boolean)
    if (camera.length) parts.push(camera.join(', '))

    if (storyboard.description?.trim()) parts.push(storyboard.description.trim())
    if (storyboard.action?.trim()) parts.push(`Action: ${storyboard.action.trim()}`)
    if (storyboard.visual_notes?.trim()) parts.push(`Visual: ${storyboard.visual_notes.trim()}`)
    if (storyboard.dialogue?.trim()) parts.push(`Dialogue: ${storyboard.dialogue.trim()}`)

    const character = storyboard.character_id
      ? projectCharacters.find((c) => c.id === storyboard.character_id)
      : null
    if (character?.name) parts.push(`Character: ${character.name}`)

    return (
      parts.join('. ') ||
      `Shot ${storyboard.shot_number}: ${storyboard.shot_type} ${storyboard.camera_angle} ${storyboard.movement}`
    )
  }

  const handlePromptAssist = async (storyboard: Storyboard) => {
    const generation = storyboardGenerations.get(storyboard.id)
    const character = storyboard.character_id
      ? projectCharacters.find((c) => c.id === storyboard.character_id)
      : null
    const imageUrl =
      generation?.filePreview ||
      generation?.startFramePreview ||
      generation?.startFrameImageUrl ||
      storyboard.image_url ||
      null

    setPromptAssistLoadingId(storyboard.id)
    try {
      const response = await fetch('/api/ai/video-prompt-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: storyboard.title,
          description: storyboard.description,
          action: storyboard.action,
          dialogue: storyboard.dialogue,
          visualNotes: storyboard.visual_notes,
          shotType: storyboard.shot_type,
          cameraAngle: storyboard.camera_angle,
          movement: storyboard.movement,
          shotNumber: storyboard.shot_number,
          sceneNumber: storyboard.scene_number,
          characterName: character?.name ?? null,
          imageUrl,
          videoModel: generation?.model || null,
          userId,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.prompt) {
        throw new Error(data.error || 'Failed to generate prompt')
      }

      updateStoryboardGeneration(storyboard.id, { prompt: data.prompt })
      toast({
        title: 'Prompt Assist ready',
        description: imageUrl
          ? 'Built a video prompt from shot details + reference image.'
          : 'Built a video prompt from shot details. Add/upload an image for stronger I2V prompts.',
      })
    } catch (error) {
      // Local fallback if API fails
      const fallback = buildPromptFromStoryboard(storyboard)
      const withImage = storyboard.image_url
        ? `${fallback}. Animate from the attached reference image — keep composition and lighting, add natural cinematic motion. No text overlays.`
        : `${fallback}. Photoreal cinematic motion, no text overlays.`
      updateStoryboardGeneration(storyboard.id, { prompt: withImage })
      toast({
        title: 'Used shot details',
        description:
          error instanceof Error
            ? `${error.message} — filled prompt from storyboard fields.`
            : 'Filled prompt from storyboard fields.',
      })
    } finally {
      setPromptAssistLoadingId(null)
    }
  }

  const buildAudioAssistPayload = (storyboard: Storyboard, kind: 'dialogue' | 'sound-effect') => {
    const generation = storyboardGenerations.get(storyboard.id)
    const character = storyboard.character_id
      ? projectCharacters.find((c) => c.id === storyboard.character_id)
      : null
    const imageUrl =
      generation?.filePreview ||
      generation?.startFramePreview ||
      generation?.startFrameImageUrl ||
      storyboard.image_url ||
      null

    return {
      kind,
      title: storyboard.title,
      description: storyboard.description,
      action: storyboard.action,
      dialogue: storyboard.dialogue,
      visualNotes: storyboard.visual_notes,
      shotType: storyboard.shot_type,
      cameraAngle: storyboard.camera_angle,
      movement: storyboard.movement,
      shotNumber: storyboard.shot_number,
      sceneNumber: storyboard.scene_number,
      characterName: character?.name ?? null,
      imageUrl,
      userId,
    }
  }

  const fetchAudioPromptAssist = async (
    storyboard: Storyboard,
    kind: 'dialogue' | 'sound-effect',
  ): Promise<string> => {
    const response = await fetch('/api/ai/audio-prompt-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildAudioAssistPayload(storyboard, kind)),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.prompt) {
      throw new Error(data.error || 'Failed to generate audio prompt')
    }
    return String(data.prompt)
  }

  const applyDialogueText = async (storyboard: Storyboard, text: string) => {
    const trimmed = text.trim()
    setStoryboards((prev) =>
      prev.map((sb) => (sb.id === storyboard.id ? { ...sb, action: trimmed || null } : sb)),
    )
    try {
      const supabase = getSupabaseClient()
      await supabase
        .from('storyboards')
        .update({ action: trimmed || null })
        .eq('id', storyboard.id)
    } catch (error) {
      console.error('Error saving assisted dialogue:', error)
    }
  }

  const handleDialoguePromptAssist = async (storyboard: Storyboard) => {
    const loadingKey = `${storyboard.id}-dialogue`
    setAudioPromptAssistLoadingId(loadingKey)
    try {
      const prompt = await fetchAudioPromptAssist(storyboard, 'dialogue')
      await applyDialogueText(storyboard, prompt)
      toast({
        title: 'Prompt Assist ready',
        description: 'Filled dialogue with tone/delivery tags for ElevenLabs TTS.',
      })
    } catch (error) {
      const fallback =
        storyboard.dialogue?.trim() ||
        storyboard.action?.trim() ||
        buildPromptFromStoryboard(storyboard)
      await applyDialogueText(storyboard, fallback)
      toast({
        title: 'Used shot details',
        description:
          error instanceof Error
            ? `${error.message} — filled dialogue from storyboard fields.`
            : 'Filled dialogue from storyboard fields.',
      })
    } finally {
      setAudioPromptAssistLoadingId(null)
    }
  }

  const handleSoundEffectPromptAssist = async (
    storyboard: Storyboard,
  ): Promise<string | null> => {
    const loadingKey = `${storyboard.id}-sound-effect`
    setAudioPromptAssistLoadingId(loadingKey)
    try {
      const prompt = await fetchAudioPromptAssist(storyboard, 'sound-effect')
      toast({
        title: 'Prompt Assist ready',
        description: storyboard.image_url
          ? 'Built a sound-effect prompt from shot details + reference image.'
          : 'Built a sound-effect prompt from shot details.',
      })
      return prompt
    } catch (error) {
      const parts = [
        storyboard.action?.trim(),
        storyboard.description?.trim(),
        storyboard.visual_notes?.trim(),
      ].filter(Boolean)
      const fallback =
        parts.join('. ') ||
        `Cinematic ambience for shot ${storyboard.shot_number}`
      toast({
        title: 'Used shot details',
        description:
          error instanceof Error
            ? `${error.message} — filled sound-effect prompt from storyboard fields.`
            : 'Filled sound-effect prompt from storyboard fields.',
      })
      return fallback
    } finally {
      setAudioPromptAssistLoadingId(null)
    }
  }

  const getLockedImageModelLabel = () => {
    const imagesSetting = aiSettings.find((s) => s.tab_type === "images")
    if (imagesSetting?.is_locked && imagesSetting.locked_model) {
      return migrateGPTImageDisplayLabel(imagesSetting.locked_model)
    }
    return null
  }

  const normalizeLockedImageModel = (
    displayName: string,
    options?: { withReferenceImage?: boolean },
  ): string => {
    const lower = displayName.toLowerCase()
    if (lower.includes("runway")) {
      return options?.withReferenceImage ? "gen4_image_turbo" : "gen4_image"
    }
    return normalizeDisplayModelToApiId(displayName)
  }

  const getLockedImageConfig = (options?: { withReferenceImage?: boolean }) => {
    const imagesSetting = aiSettings.find((s) => s.tab_type === "images")
    if (!imagesSetting?.is_locked || !imagesSetting.locked_model) {
      return null
    }
    const lockedModel = imagesSetting.locked_model
    return {
      lockedModel,
      service: mapDisplayModelToService(lockedModel),
      apiModel: normalizeLockedImageModel(lockedModel, options),
      supportsReference: displayModelSupportsReferenceImage(lockedModel),
    }
  }

  const requireLockedImageConfig = (options?: { withReferenceImage?: boolean }) => {
    const config = getLockedImageConfig(options)
    if (!config) {
      throw new Error("Please lock an image model in AI Settings first.")
    }
    return config
  }

  const requestLockedImageGeneration = async (
    prompt: string,
    config: NonNullable<ReturnType<typeof getLockedImageConfig>>,
    options?: {
      referenceFile?: File
      styleReferenceFiles?: File[]
      width?: number
      height?: number
    },
  ) => {
    const width = options?.width ?? (config.service === "runway" ? 1280 : DEFAULT_CINEMATIC_IMAGE_WIDTH)
    const height = options?.height ?? (config.service === "runway" ? 720 : DEFAULT_CINEMATIC_IMAGE_HEIGHT)

    if (config.supportsReference && options?.referenceFile) {
      const formData = new FormData()
      formData.append("prompt", prompt)
      formData.append("model", config.apiModel)
      formData.append("service", config.service)
      formData.append("width", String(width))
      formData.append("height", String(height))
      formData.append("apiKey", "configured")
      formData.append("userId", userId!)
      formData.append("file", options.referenceFile)
      for (const styleFile of options.styleReferenceFiles ?? []) {
        formData.append("styleFiles", styleFile)
      }
      if (config.service === "runway") {
        formData.append("seed", String(Math.floor(Math.random() * 2147483647)))
      }
      return fetch("/api/ai/generate-image", { method: "POST", body: formData })
    }

    return fetch("/api/ai/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        service: config.service,
        apiKey: "configured",
        userId,
        model: config.apiModel,
        width,
        height,
        autoSaveToBucket: true,
      }),
    })
  }

  const getImageGenerationErrorMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof Error)) return fallback
    if (error.message.includes("API key")) {
      return `${error.message} Add the API key for your locked image model in Settings → AI Settings.`
    }
    return error.message
  }

  const clearImageEditReference = () => {
    if (imageEditReferencePreview) URL.revokeObjectURL(imageEditReferencePreview)
    setImageEditReferenceFile(null)
    setImageEditReferencePreview(null)
  }

  const clearImageEditStyleLinks = () => {
    setImageEditStyleLinkAssetIds([])
  }

  const toggleImageEditStyleLink = (assetId: string) => {
    setImageEditStyleLinkAssetIds((prev) => {
      if (prev.includes(assetId)) return prev.filter((id) => id !== assetId)
      if (prev.length >= MAX_LINKED_REFERENCE_IMAGES) {
        toast({
          title: "Maximum references reached",
          description: `You can link up to ${MAX_LINKED_REFERENCE_IMAGES} images at a time.`,
          variant: "destructive",
        })
        return prev
      }
      return [...prev, assetId]
    })
  }

  const openImageEditDialog = (storyboard: Storyboard) => {
    setImageToolsStoryboard(storyboard)
    setImageEditPrompt("")
    clearImageEditReference()
    clearImageEditStyleLinks()
    setImageEditDialogOpen(true)
  }

  const openFramesDialog = (storyboard: Storyboard) => {
    setImageToolsStoryboard(storyboard)
    setFramePresetId(VIDEO_FRAME_PRESETS[0].id)
    setFrameCustomDirection("")
    setFrameApplyTarget("video")
    setFramesDialogOpen(true)
  }

  const addShotReferenceFrame = (storyboardId: string, frame: ShotReferenceFrame) => {
    setShotReferenceFrames((prev) => {
      const next = new Map(prev)
      const list = next.get(storyboardId) || []
      if (list.some((f) => f.url === frame.url)) return prev
      next.set(storyboardId, [frame, ...list].slice(0, 12))
      return next
    })
  }

  const applyGeneratedFrame = async (
    storyboard: Storyboard,
    imageUrl: string,
    label: string,
    target: FrameApplyTarget,
  ) => {
    addShotReferenceFrame(storyboard.id, {
      id: crypto.randomUUID(),
      url: imageUrl,
      label,
      createdAt: Date.now(),
    })

    if (target === "library") return

    if (target === "shot") {
      const updated = await StoryboardsService.updateStoryboardImage(storyboard.id, imageUrl)
      setStoryboards((prev) => prev.map((sb) => (sb.id === storyboard.id ? updated : sb)))
      return
    }

    if (target === "video") {
      const file = await referenceUrlToFile(
        imageUrl,
        `video-ref-shot-${storyboard.shot_number}.png`,
      )
      updateStoryboardGeneration(storyboard.id, {
        uploadedFile: file,
        filePreview: imageUrl,
      })
      return
    }

    if (target === "start") {
      updateStoryboardGeneration(storyboard.id, {
        startFrameImageUrl: imageUrl,
        startFramePreview: imageUrl,
        startFrame: null,
      })
      return
    }

    if (target === "end") {
      updateStoryboardGeneration(storyboard.id, {
        endFrameImageUrl: imageUrl,
        endFramePreview: imageUrl,
        endFrame: null,
      })
    }
  }

  const handleCinemaImageEdit = async () => {
    const storyboard = imageToolsStoryboard
    const direction = imageEditPrompt.trim()
    if (!storyboard || !userId) return
    if (!direction) {
      toast({
        title: "Describe your edit",
        description: 'e.g. "warmer lighting" or "add mist in the background".',
        variant: "destructive",
      })
      return
    }
    if (!imageEditReferenceFile && !storyboard.image_url) {
      toast({
        title: "Reference required",
        description: "This shot needs an image, or upload a reference to edit from.",
        variant: "destructive",
      })
      return
    }

    setImageEditUploading(true)
    setImageEditProgress("Editing image...")
    try {
      const config = requireLockedImageConfig({ withReferenceImage: true })
      let prompt = direction
      if (storyboard.title) prompt += ` Shot: ${storyboard.title}.`
      prompt = prompt.slice(0, 990)

      const styleReferenceFiles: File[] = []
      for (const assetId of imageEditStyleLinkAssetIds) {
        const styleAsset = projectImageAssets.find((a) => a.id === assetId)
        if (styleAsset?.content_url) {
          styleReferenceFiles.push(
            await referenceUrlToFile(
              styleAsset.content_url,
              `style-ref-${styleAsset.id}.png`,
            ),
          )
        }
      }

      let referenceFile: File | undefined
      if (config.supportsReference) {
        referenceFile =
          imageEditReferenceFile ??
          (await referenceUrlToFile(
            storyboard.image_url!,
            `cinema-edit-${storyboard.id}.png`,
          ))
      }

      const response = await requestLockedImageGeneration(prompt, config, {
        referenceFile,
        styleReferenceFiles: config.supportsReference ? styleReferenceFiles : undefined,
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to edit image")
      }
      const result = await response.json()
      if (!result.success || !result.imageUrl) {
        throw new Error("Failed to edit image")
      }

      const imageUrlToUse = result.bucketUrl || result.imageUrl
      const updated = await StoryboardsService.updateStoryboardImage(
        storyboard.id,
        imageUrlToUse,
      )
      setStoryboards((prev) => prev.map((sb) => (sb.id === storyboard.id ? updated : sb)))

      const file = await referenceUrlToFile(
        imageUrlToUse,
        `video-ref-shot-${storyboard.shot_number}.png`,
      )
      updateStoryboardGeneration(storyboard.id, {
        uploadedFile: file,
        filePreview: imageUrlToUse,
      })
      addShotReferenceFrame(storyboard.id, {
        id: crypto.randomUUID(),
        url: imageUrlToUse,
        label: "Edited shot",
        createdAt: Date.now(),
      })

      setImageEditDialogOpen(false)
      clearImageEditReference()
      clearImageEditStyleLinks()
      setImageEditPrompt("")
      toast({
        title: "Image edited",
        description: "The storyboard shot image was updated with your edit.",
      })
    } catch (error) {
      toast({
        title: "Edit failed",
        description: getImageGenerationErrorMessage(error, "Could not edit the image."),
        variant: "destructive",
      })
    } finally {
      setImageEditUploading(false)
      setImageEditProgress("")
    }
  }

  const handleGenerateVideoFrame = async () => {
    const storyboard = imageToolsStoryboard
    if (!storyboard || !userId) return
    if (!storyboard.image_url) {
      toast({
        title: "Shot image required",
        description: "Generate or link a storyboard image first, then make frames from it.",
        variant: "destructive",
      })
      return
    }

    const preset = VIDEO_FRAME_PRESETS.find((p) => p.id === framePresetId)
    const direction =
      frameCustomDirection.trim() ||
      preset?.directive ||
      "a useful alternate frame of this shot for video generation"

    setFrameGenerating(true)
    setFrameProgress("Generating frame...")
    try {
      const config = requireLockedImageConfig({ withReferenceImage: true })
      const actionBit = storyboard.action?.trim()
        ? ` Action happening: ${storyboard.action.trim()}.`
        : ""
      const prompt =
        `Give me ${direction} of this image. Keep the same scene, subjects, lighting, and world — only change framing/moment as requested.${actionBit} Photoreal cinematic still, no text.`.slice(
          0,
          990,
        )

      const referenceFile = await referenceUrlToFile(
        storyboard.image_url,
        `frame-ref-${storyboard.id}.png`,
      )

      const response = await requestLockedImageGeneration(prompt, config, {
        referenceFile: config.supportsReference ? referenceFile : undefined,
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to generate frame")
      }
      const result = await response.json()
      if (!result.success || !result.imageUrl) {
        throw new Error("Failed to generate frame")
      }

      const imageUrlToUse = result.bucketUrl || result.imageUrl
      const label = preset?.label || "Custom frame"
      await applyGeneratedFrame(storyboard, imageUrlToUse, label, frameApplyTarget)

      const targetLabel =
        frameApplyTarget === "shot"
          ? "updated the shot image"
          : frameApplyTarget === "video"
            ? "set as the video reference image"
            : frameApplyTarget === "start"
              ? "set as start frame"
              : frameApplyTarget === "end"
                ? "set as end frame"
                : "saved to this shot’s frame library"

      toast({
        title: "Frame ready",
        description: `${label} generated and ${targetLabel}.`,
      })
    } catch (error) {
      toast({
        title: "Frame generation failed",
        description: getImageGenerationErrorMessage(error, "Could not generate frame."),
        variant: "destructive",
      })
    } finally {
      setFrameGenerating(false)
      setFrameProgress("")
    }
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

  const switchDetailToVideo = (storyboardId: string) => {
    setDetailViewMode((prev) => {
      const next = new Map(prev)
      next.set(storyboardId, "video")
      return next
    })
  }

  /** Persist a freshly generated video so it survives refresh / Fast Refresh. */
  const autoSaveGeneratedVideo = async (
    videoUrl: string,
    storyboard: Storyboard,
    meta?: {
      model?: string | null
      prompt?: string | null
      duration?: string
      resolution?: string
    },
  ) => {
    if (!userId || !videoUrl) return

    try {
      const fileName = `${storyboard.title || "storyboard"}-shot-${storyboard.shot_number}`
      const bucketResponse = await fetch("/api/ai/download-and-store-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, fileName, userId }),
      })
      const bucketResult = await bucketResponse.json()
      const savedVideoUrl = bucketResult.supabaseUrl || videoUrl

      const dbResponse = await fetch("/api/storyboard-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboardId: storyboard.id,
          videoUrl: savedVideoUrl,
          videoName: fileName,
          generationModel: meta?.model || null,
          generationPrompt: meta?.prompt || null,
          metadata: {
            duration: meta?.duration,
            resolution: meta?.resolution,
          },
          isDefault: false,
        }),
      })

      if (dbResponse.ok) {
        await loadStoryboardVideos(storyboard.id)
        updateStoryboardGeneration(storyboard.id, {
          generatedVideoUrl: savedVideoUrl,
          generationStatus: "Saved",
        })
        console.log("✅ Auto-saved generated video to database")
      } else if (savedVideoUrl) {
        updateStoryboardGeneration(storyboard.id, {
          generatedVideoUrl: savedVideoUrl,
        })
      }
    } catch (error) {
      console.warn("Failed to auto-save generated video:", error)
    }
  }

  // Load videos for a storyboard
  const loadStoryboardVideos = async (storyboardId: string): Promise<StoryboardVideo[]> => {
    if (!userId) return []

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
        return videos as StoryboardVideo[]
      }
    } catch (error) {
      console.error('Error loading storyboard videos:', error)
    }
    return []
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
  const handleGenerateDialogue = async (storyboard: Storyboard, text: string, voiceId?: string) => {
    if (!userId || !userApiKeys.elevenlabs_api_key) {
      toast({
        title: "API Key Required",
        description: "Please configure your ElevenLabs API key in Settings.",
        variant: "destructive",
      })
      return
    }

    const resolvedVoiceId = voiceId || getDialogueVoiceId(storyboard)
    if (!resolvedVoiceId) {
      toast({
        title: "Voice Required",
        description: "Assign an ElevenLabs voice to a character or import one from Create Voice.",
        variant: "destructive",
      })
      return
    }

    const audioKey = `${storyboard.id}-dialogue`
    const clipId = crypto.randomUUID()
    setAudioGenerating((prev) => new Map(prev).set(audioKey, true))

    try {
      const response = await fetch('/api/ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: resolvedVoiceId,
          apiKey: userApiKeys.elevenlabs_api_key,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate speech`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const clip: SessionAudioClip = {
        id: clipId,
        type: "dialogue",
        prompt: text,
        audioUrl,
        createdAt: Date.now(),
      }

      addSessionClip(storyboard.id, clip)
      setDefaultAudioSaveName(storyboard, clipId, "dialogue", text)

      const generation = storyboardGenerations.get(storyboard.id)
      if (generation?.model === "Hedra Character 3") {
        updateStoryboardGeneration(storyboard.id, {
          savedAudioOptionId: sessionAudioOptionId(clipId),
        })
      }

      toast({
        title: "Dialogue Generated",
        description: "New dialogue clip added. Generate again for another take.",
      })
    } catch (error) {
      console.error('Error generating dialogue:', error)
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate dialogue.",
        variant: "destructive",
      })
    } finally {
      setAudioGenerating((prev) => new Map(prev).set(audioKey, false))
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
    const clipId = crypto.randomUUID()
    setAudioGenerating((prev) => new Map(prev).set(audioKey, true))

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
      const clip: SessionAudioClip = {
        id: clipId,
        type: "sound-effect",
        prompt,
        audioUrl,
        createdAt: Date.now(),
      }

      addSessionClip(storyboard.id, clip)
      setDefaultAudioSaveName(storyboard, clipId, "sound-effect", prompt)

      toast({
        title: "Sound Effect Generated",
        description: "New sound effect clip added.",
      })
    } catch (error) {
      console.error('Error generating sound effect:', error)
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate sound effect.",
        variant: "destructive",
      })
    } finally {
      setAudioGenerating((prev) => new Map(prev).set(audioKey, false))
    }
  }

  // Save audio to storage
  const handleSaveAudio = async (
    audioUrl: string,
    prompt: string,
    type: "dialogue" | "sound-effect" = "sound-effect",
    storyboard?: Storyboard,
    saveName?: string,
  ) => {
    if (!userId || !selectedProjectId || !selectedSceneId || !storyboard) {
      toast({
        title: "Missing Information",
        description: "Please select a project and scene.",
        variant: "destructive",
      })
      return
    }

    const displayName = saveName?.trim()
    if (!displayName) {
      toast({
        title: "Name Required",
        description: "Enter a name for this audio before saving.",
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
            fileName: sanitizeAudioFileName(displayName),
            audioTitle: displayName,
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
        
        const saveResult = await saveResponse.json()
        const newAssetId = saveResult.data?.asset?.id as string | undefined

        toast({
          title: "Audio Saved",
          description: `${type === 'dialogue' ? 'Dialogue' : 'Sound effect'} audio has been saved to storage.`,
        })
        if (selectedSceneId) {
          await loadSavedAudioForScene(selectedSceneId)
        }
        if (storyboard?.id && newAssetId) {
          updateStoryboardGeneration(storyboard.id, {
            savedAudioOptionId: newAssetId,
          })
        }
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

  const handleDeleteVideo = async (video: StoryboardVideo) => {
    if (!userId) return

    const label = video.video_name || "this video"
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return

    setDeletingVideoId(video.id)

    try {
      if (video.id === "generated-temp") {
        updateStoryboardGeneration(video.storyboard_id, {
          generatedVideoUrl: null,
          generationStatus: null,
        })
        if (selectedVideoUrl === video.video_url) {
          const remaining = (storyboardVideos.get(video.storyboard_id) || []).filter(
            (v) => v.video_url !== video.video_url,
          )
          const next = remaining.find((v) => v.is_default) || remaining[0]
          setSelectedVideoUrl(next?.video_url || null)
        }
        toast({
          title: "Video removed",
          description: "Unsaved generated video cleared from this session.",
        })
        return
      }

      const response = await fetch(`/api/storyboard-videos?videoId=${encodeURIComponent(video.id)}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete video")
      }

      const remaining = await loadStoryboardVideos(video.storyboard_id)
      if (selectedVideoUrl === video.video_url) {
        const next = remaining.find((v) => v.is_default) || remaining[0]
        setSelectedVideoUrl(next?.video_url || null)
      }

      const generation = storyboardGenerations.get(video.storyboard_id)
      if (generation?.generatedVideoUrl === video.video_url) {
        const fallback = remaining.find((v) => v.is_default) || remaining[0]
        updateStoryboardGeneration(video.storyboard_id, {
          generatedVideoUrl: fallback?.video_url || null,
        })
      }

      toast({
        title: "Video deleted",
        description: `"${label}" has been removed.`,
      })
    } catch (error) {
      console.error("Error deleting video:", error)
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete video.",
        variant: "destructive",
      })
    } finally {
      setDeletingVideoId(null)
    }
  }

  const handleGenerateHedraCharacter3 = async (storyboard: Storyboard) => {
    const generation = storyboardGenerations.get(storyboard.id)
    if (!generation?.prompt.trim()) {
      toast({
        title: "Missing prompt",
        description: "Add a performance prompt for the shot.",
        variant: "destructive",
      })
      return
    }

    if (!hedraCharacter3ModelId) {
      toast({
        title: "Hedra not ready",
        description: "Could not load Hedra Character 3 model. Set HEDRA_API_KEY and refresh.",
        variant: "destructive",
      })
      return
    }

    const imageUrl = generation.filePreview || storyboard.image_url
    if (!imageUrl) {
      toast({
        title: "Portrait required",
        description: "This shot needs a storyboard image with a visible face for lip-sync.",
        variant: "destructive",
      })
      return
    }

    const audioOption = resolveSelectedAudioForStoryboard(
      storyboard.id,
      generation.savedAudioOptionId,
    )
    if (!audioOption) {
      toast({
        title: "Audio required",
        description: "Generate and save dialogue audio for this shot, or pick a saved clip below.",
        variant: "destructive",
      })
      return
    }

    updateStoryboardGeneration(storyboard.id, {
      isGenerating: true,
      generationStatus: "Preparing Hedra Character 3…",
    })

    try {
      const downloadUrl = await runHedraAvatarPipeline({
        imageUrl,
        audioUrl: audioOption.url,
        imageFilename: `shot-${storyboard.shot_number}-portrait.png`,
        audioFilename: `shot-${storyboard.shot_number}-dialogue.mp3`,
        aiModelId: hedraCharacter3ModelId,
        textPrompt: generation.prompt,
        aspectRatio: "16:9",
        resolution: "720p",
        onStatus: (status) => {
          updateStoryboardGeneration(storyboard.id, { generationStatus: status })
        },
      })

      updateStoryboardGeneration(storyboard.id, {
        isGenerating: false,
        generatedVideoUrl: downloadUrl,
        generationStatus: "Complete",
      })
      setDetailViewMode((prev) => {
        const next = new Map(prev)
        next.set(storyboard.id, "video")
        return next
      })
      toast({
        title: "Character 3 video ready",
        description: `Lip-sync video generated for shot ${storyboard.shot_number}.`,
      })
    } catch (error) {
      console.error("Hedra Character 3 error:", error)
      updateStoryboardGeneration(storyboard.id, {
        isGenerating: false,
        generationStatus: error instanceof Error ? error.message : "Failed",
      })
      toast({
        title: "Hedra generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
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

    if (generation.model === "Hedra Character 3") {
      await handleGenerateHedraCharacter3(storyboard)
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
                        switchDetailToVideo(storyboard.id)
                        toast({
                          title: "Success",
                          description: "Video generated successfully — switched to Video view.",
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
                    switchDetailToVideo(storyboard.id)
                    
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
                      switchDetailToVideo(storyboard.id)
                      
                      // Auto-save generated video to database
                      if (videoUrl) {
                        await autoSaveGeneratedVideo(videoUrl, storyboard, {
                          model: generation.model,
                          prompt: generation.prompt,
                          duration: generation.duration,
                          resolution: generation.resolution,
                        })
                      }
                      
                      toast({
                        title: "Success",
                        description: videoUrl
                          ? "Video generated successfully — switched to Video view."
                          : "Video generation completed.",
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
          switchDetailToVideo(storyboard.id)
          if (videoUrl) {
            await autoSaveGeneratedVideo(videoUrl, storyboard, {
              model: generation.model,
              prompt: generation.prompt,
              duration: generation.duration,
              resolution: generation.resolution,
            })
          }
          
          toast({
            title: "Success",
            description: videoUrl
              ? "Video generated successfully — switched to Video view."
              : "Video generation started. Check back in a few minutes.",
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
          // Always show the Video tab — Image was often still selected after generate
          switchDetailToVideo(storyboard.id)
          if (videoUrl) {
            await autoSaveGeneratedVideo(videoUrl, storyboard, {
              model: generation.model,
              prompt: generation.prompt,
              duration: generation.duration,
              resolution: generation.resolution,
            })
          }
          toast({
            title: "Success",
            description: videoUrl
              ? "Video generated successfully — switched to Video view."
              : "Video generation started. Check back in a few minutes.",
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
                                    preload="metadata"
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
                                      showVideoFrameThumbnail(e.currentTarget)
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
                                  className="w-full rounded-md bg-muted"
                                  preload="metadata"
                                  playsInline
                                  onLoadedMetadata={(e) => showVideoFrameThumbnail(e.currentTarget)}
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
                              <div className="flex gap-2 justify-end items-center">
                                {currentViewMode === 'image' && (
                                  <span className="text-xs text-muted-foreground mr-auto">
                                    Video ready — click Video to play
                                  </span>
                                )}
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
                                <div className="space-y-2">
                                <div
                                  className="relative w-full bg-muted rounded-lg overflow-hidden border cursor-zoom-in group"
                                  onClick={() => {
                                    setFullImageUrl(storyboard.image_url!)
                                    setFullImageTitle(
                                      storyboard.title || `Shot ${storyboard.shot_number}`,
                                    )
                                    setFullImageViewerOpen(true)
                                  }}
                                  title="Click to view full image"
                                >
                                  <img
                                    src={storyboard.image_url}
                                    alt={storyboard.title || "Storyboard"}
                                    className="w-full h-auto max-h-[600px] object-contain mx-auto transition-opacity group-hover:opacity-95"
                                    onLoad={() => {
                                      console.log('🎬 Storyboard image loaded successfully:', storyboard.image_url)
                                    }}
                                    onError={(e) => {
                                      console.error('🎬 Failed to load storyboard image:', storyboard.image_url)
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                  <ImageSizeBadge src={storyboard.image_url} />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-black/20">
                                    <span className="rounded-full bg-black/60 text-white text-xs px-3 py-1.5">
                                      View full image
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    onClick={() => openImageEditDialog(storyboard)}
                                  >
                                    <Wand2 className="h-3.5 w-3.5" />
                                    Edit Image
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    onClick={() => openFramesDialog(storyboard)}
                                  >
                                    <Images className="h-3.5 w-3.5" />
                                    Make Frames
                                  </Button>
                                </div>
                                {(shotReferenceFrames.get(storyboard.id) || []).length > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">
                                      Frame library — click to use as video reference
                                    </p>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                      {(shotReferenceFrames.get(storyboard.id) || []).map((frame) => (
                                        <button
                                          key={frame.id}
                                          type="button"
                                          className="relative shrink-0 rounded border overflow-hidden hover:ring-2 hover:ring-primary"
                                          title={`${frame.label} — use for video`}
                                          onClick={() =>
                                            void applyGeneratedFrame(
                                              storyboard,
                                              frame.url,
                                              frame.label,
                                              "video",
                                            ).then(() =>
                                              toast({
                                                title: "Video reference set",
                                                description: `Using “${frame.label}” for Generate Video.`,
                                              }),
                                            )
                                          }
                                        >
                                          <img
                                            src={frame.url}
                                            alt={frame.label}
                                            className="h-16 w-24 object-cover"
                                          />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                </div>
                              ) : (
                                <div className="py-12 text-center bg-muted rounded-lg space-y-3">
                                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                  <p className="text-muted-foreground">
                                    No image available for this storyboard.
                                  </p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    onClick={() => openImageEditDialog(storyboard)}
                                  >
                                    <Wand2 className="h-3.5 w-3.5" />
                                    Edit from upload
                                  </Button>
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
                                        className="w-full rounded-md bg-muted aspect-video object-cover"
                                        key={displayVideoUrl}
                                        onLoadedMetadata={(e) => showVideoFrameThumbnail(e.currentTarget)}
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
                                    const audioOptions =
                                      newModel === "Hedra Character 3"
                                        ? getAudioOptionsForStoryboard(storyboard.id)
                                        : []
                                    
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
                                      savedAudioOptionId:
                                        newModel === "Hedra Character 3"
                                          ? audioOptions[0]?.id ?? null
                                          : null,
                                      prompt:
                                        newModel === "Hedra Character 3" && !generation.prompt.trim()
                                          ? "A person speaking to the camera with natural lip sync and subtle expressions"
                                          : generation.prompt,
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
                                    <SelectItem value="Hedra Character 3">Hedra Character 3 (Lip-sync avatar)</SelectItem>
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
                                      rows={4}
                                    />
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="gap-1.5"
                                        disabled={promptAssistLoadingId === storyboard.id}
                                        onClick={() => void handlePromptAssist(storyboard)}
                                        title="Build a video prompt from shot type, angle, movement, action, and the reference image"
                                      >
                                        {promptAssistLoadingId === storyboard.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Sparkles className="h-3.5 w-3.5" />
                                        )}
                                        Prompt Assist
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={promptAssistLoadingId === storyboard.id}
                                        onClick={() =>
                                          updateStoryboardGeneration(storyboard.id, {
                                            prompt: defaultPrompt,
                                          })
                                        }
                                      >
                                        Use Storyboard Details
                                      </Button>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Prompt Assist inserts shot type, angle, movement, action, and uses your storyboard/uploaded image when available.
                                    </p>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Duration</Label>
                                      <Select
                                        value={generation.duration}
                                        onValueChange={(value) => updateStoryboardGeneration(storyboard.id, { duration: value })}
                                        disabled={generation.model === "Hedra Character 3"}
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
                            {fileRequirement === 'hedra-avatar' && (
                              <div className="space-y-4 rounded-lg border p-3 bg-muted/20">
                                <p className="text-xs text-muted-foreground">
                                  Uses the storyboard portrait + saved or session audio. Lip-sync works best with a clear face in frame.
                                </p>
                                {storyboard.image_url ? (
                                  <div className="relative">
                                    <img
                                      src={storyboard.image_url}
                                      alt=""
                                      className="w-full max-h-48 object-contain rounded-md border bg-background"
                                    />
                                    <div className="absolute top-2 left-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded">
                                      Storyboard portrait
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-amber-600">
                                    Add a storyboard image with a visible face before generating.
                                  </p>
                                )}
                                <div>
                                  <Label>Audio for lip-sync</Label>
                                  {(() => {
                                    const audioOptions = getAudioOptionsForStoryboard(storyboard.id)
                                    if (audioOptions.length === 0) {
                                      return (
                                        <p className="text-sm text-muted-foreground mt-2">
                                          No audio yet. Generate dialogue below (you can create multiple takes), save clips to storage, then pick one here for lip-sync.
                                        </p>
                                      )
                                    }
                                    return (
                                      <div className="space-y-2">
                                      <Select
                                        value={generation.savedAudioOptionId || audioOptions[0]?.id || ""}
                                        onValueChange={(value) =>
                                          updateStoryboardGeneration(storyboard.id, {
                                            savedAudioOptionId: value,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="mt-2">
                                          <SelectValue placeholder="Select saved audio" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {audioOptions.map((option) => (
                                            <SelectItem key={option.id} value={option.id}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {(() => {
                                        const selected = resolveSelectedAudioForStoryboard(
                                          storyboard.id,
                                          generation.savedAudioOptionId,
                                        )
                                        if (!selected) return null
                                        return (
                                          <audio
                                            key={selected.id}
                                            controls
                                            src={selected.url}
                                            className="w-full h-8"
                                          />
                                        )
                                      })()}
                                      </div>
                                    )
                                  })()}
                                </div>
                                {!hedraCharacter3ModelId && (
                                  <p className="text-xs text-amber-600">
                                    Hedra API key not detected. Set HEDRA_API_KEY on the server.
                                  </p>
                                )}
                              </div>
                            )}

                            {fileRequirement === 'image' && (
                              <div className="rounded-md border bg-muted/20 px-3 py-2 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <Label className="text-sm">Image for video</Label>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {generation.filePreview
                                        ? `Override: ${generation.uploadedFile?.name || 'uploaded image'}`
                                        : storyboard.image_url
                                          ? 'Using the storyboard image shown above'
                                          : 'Upload an image to generate'}
                                    </p>
                                  </div>
                                  {generation.filePreview ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <img
                                        src={generation.filePreview}
                                        alt=""
                                        className="h-10 w-14 rounded object-cover border"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveFile(storyboard.id, 'file')}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  className="text-xs"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleFileUpload(storyboard.id, file, 'file')
                                  }}
                                />
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

                            {/* Generate early for simple models — after prompt/settings/image, before frame-to-frame extras */}
                            {(fileRequirement === 'image' ||
                              fileRequirement === 'video' ||
                              fileRequirement === 'none') &&
                              generation.model !== 'Leonardo Motion 2.0' && (
                              <>
                                <Button
                                  onClick={() => handleGenerateVideo(storyboard)}
                                  disabled={
                                    generation.isGenerating ||
                                    !generation.prompt.trim()
                                  }
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
                              </>
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

                            {(fileRequirement === 'hedra-avatar' ||
                              fileRequirement === 'start-end-frames' ||
                              generation.model === 'Leonardo Motion 2.0') && (
                              <>
                                <Button
                                  onClick={() => handleGenerateVideo(storyboard)}
                                  disabled={
                                    generation.isGenerating ||
                                    !generation.prompt.trim() ||
                                    (generation.model === "Hedra Character 3" &&
                                      (!storyboard.image_url ||
                                        getAudioOptionsForStoryboard(storyboard.id).length === 0 ||
                                        !hedraCharacter3ModelId))
                                  }
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
                                      {generation.model === "Hedra Character 3"
                                        ? "Generate Character 3 Video"
                                        : "Generate Video"}
                                    </>
                                  )}
                                </Button>

                                {generation.generationStatus && (
                                  <div className="text-sm text-muted-foreground">
                                    Status: {generation.generationStatus}
                                  </div>
                                )}
                              </>
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
                              {dialogueVoiceOptions.length > 0 ? (
                                <Select
                                  value={getDialogueVoiceId(storyboard) || undefined}
                                  onValueChange={(value) => {
                                    setDialogueVoiceByStoryboard((prev) => {
                                      const next = new Map(prev)
                                      next.set(storyboard.id, value)
                                      return next
                                    })
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select character voice" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dialogueVoiceOptions.map((voice) => (
                                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                        {voice.characterName
                                          ? `${voice.characterName} — ${voice.name}`
                                          : voice.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  No character voices for this project.{" "}
                                  <Link
                                    href={
                                      selectedProjectId
                                        ? `/create-voice?projectId=${selectedProjectId}`
                                        : "/create-voice"
                                    }
                                    className="text-primary hover:underline"
                                  >
                                    Create or import a voice
                                  </Link>{" "}
                                  and assign it on the Characters page.
                                </p>
                              )}
                              {storyboard.character_id && (() => {
                                const linkedCharacter = projectCharacters.find(
                                  (c) => c.id === storyboard.character_id,
                                )
                                if (!linkedCharacter) return null
                                if (linkedCharacter.elevenlabs_voice_name) {
                                  return (
                                    <p className="text-xs text-muted-foreground">
                                      Shot character: {linkedCharacter.name} ({linkedCharacter.elevenlabs_voice_name})
                                    </p>
                                  )
                                }
                                return (
                                  <p className="text-xs text-amber-600 dark:text-amber-500">
                                    Shot character {linkedCharacter.name} has no voice assigned yet.
                                  </p>
                                )
                              })()}
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
                                        handleGenerateDialogue(
                                          storyboard,
                                          storyboard.action,
                                          getDialogueVoiceId(storyboard),
                                        )
                                      }
                                    }}
                                    disabled={
                                      !storyboard.action?.trim() ||
                                      !getDialogueVoiceId(storyboard) ||
                                      audioGenerating.get(`${storyboard.id}-dialogue`) ||
                                      !userApiKeys.elevenlabs_api_key
                                    }
                                    size="sm"
                                  >
                                    {audioGenerating.get(`${storyboard.id}-dialogue`) ? (
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
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={
                                      audioPromptAssistLoadingId === `${storyboard.id}-dialogue` ||
                                      audioGenerating.get(`${storyboard.id}-dialogue`)
                                    }
                                    onClick={() => void handleDialoguePromptAssist(storyboard)}
                                    title="Build spoken dialogue from shot details for TTS"
                                  >
                                    {audioPromptAssistLoadingId === `${storyboard.id}-dialogue` ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-3.5 w-3.5" />
                                    )}
                                    Prompt Assist
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
                              <p className="text-xs text-muted-foreground">
                                Prompt Assist fills the spoken line plus tone tags (e.g. [tired][softly])
                                from shot action, dialogue, and the image.
                              </p>
                              <SessionAudioClipList
                                clips={getSessionClipsForStoryboard(storyboard.id, "dialogue")}
                                getSaveName={(clip) => getAudioSaveNameForClip(storyboard, clip)}
                                onSaveNameChange={(clipId, name) => {
                                  setAudioSaveNames((prev) => {
                                    const next = new Map(prev)
                                    next.set(audioSaveNameKey(storyboard.id, clipId), name)
                                    return next
                                  })
                                }}
                                onDownload={(clip) => {
                                  const link = document.createElement("a")
                                  link.href = clip.audioUrl
                                  link.download = `${sanitizeAudioFileName(getAudioSaveNameForClip(storyboard, clip))}.mp3`
                                  document.body.appendChild(link)
                                  link.click()
                                  document.body.removeChild(link)
                                }}
                                onSave={async (clip, saveName) => {
                                  setSavingAudioClipId(clip.id)
                                  try {
                                    await handleSaveAudio(clip.audioUrl, clip.prompt, "dialogue", storyboard, saveName)
                                  } finally {
                                    setSavingAudioClipId(null)
                                  }
                                }}
                                onRemove={(clipId) => removeSessionClip(storyboard.id, clipId)}
                                savingClipId={savingAudioClipId}
                              />
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
                              clips={getSessionClipsForStoryboard(storyboard.id, "sound-effect")}
                              onGenerate={handleGenerateSoundEffect}
                              isGenerating={audioGenerating.get(`${storyboard.id}-sound-effect`) || false}
                              hasApiKey={!!userApiKeys.elevenlabs_api_key}
                              getSaveName={(clip) => getAudioSaveNameForClip(storyboard, clip)}
                              onSaveNameChange={(clipId, name) => {
                                setAudioSaveNames((prev) => {
                                  const next = new Map(prev)
                                  next.set(audioSaveNameKey(storyboard.id, clipId), name)
                                  return next
                                })
                              }}
                              onRemoveClip={(clipId) => removeSessionClip(storyboard.id, clipId)}
                              onSaveAudio={async (clip, saveName) => {
                                setSavingAudioClipId(clip.id)
                                try {
                                  await handleSaveAudio(clip.audioUrl, clip.prompt, "sound-effect", storyboard, saveName)
                                } finally {
                                  setSavingAudioClipId(null)
                                }
                              }}
                              savingClipId={savingAudioClipId}
                              userId={userId || undefined}
                              projectId={selectedProjectId || undefined}
                              sceneId={selectedSceneId || undefined}
                              promptAssistLoading={
                                audioPromptAssistLoadingId === `${storyboard.id}-sound-effect`
                              }
                              onPromptAssist={() => handleSoundEffectPromptAssist(storyboard)}
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

      {/* Full Image Viewer — tall vertical lightbox for portrait shots */}
      <Dialog
        open={fullImageViewerOpen}
        onOpenChange={(open) => {
          setFullImageViewerOpen(open)
          if (!open) {
            setFullImageUrl(null)
            setFullImageTitle("")
          }
        }}
      >
        <DialogContent className="flex flex-col gap-2 p-3 sm:p-4 w-[min(92vw,28rem)] h-[92vh] max-h-[92vh] max-w-[min(92vw,28rem)] sm:max-w-[min(92vw,28rem)] overflow-hidden">
          <DialogHeader className="shrink-0 px-1 pr-8">
            <DialogTitle className="truncate text-sm sm:text-base">
              {fullImageTitle || "Storyboard image"}
            </DialogTitle>
          </DialogHeader>
          {fullImageUrl ? (
            <div className="relative flex-1 min-h-0 w-full rounded-md bg-muted/40 overflow-hidden flex items-center justify-center">
              <img
                src={fullImageUrl}
                alt={fullImageTitle || "Storyboard image"}
                className="max-h-full max-w-full h-full w-auto object-contain"
              />
              <ImageSizeBadge src={fullImageUrl} className="bottom-3 left-3 text-[11px] px-2 py-1" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Image — matches storyboards reference edit dialog */}
      <Dialog
        open={imageEditDialogOpen}
        onOpenChange={(open) => {
          if (!open && !imageEditUploading) {
            setImageEditDialogOpen(false)
            setImageToolsStoryboard(null)
            clearImageEditReference()
            clearImageEditStyleLinks()
            setImageEditPrompt("")
          }
        }}
      >
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-violet-500" />
              Edit Image
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {imageToolsStoryboard
                ? `Reference edit for Shot ${imageToolsStoryboard.shot_number}${imageToolsStoryboard.title ? ` · ${imageToolsStoryboard.title}` : ""}.`
                : "Edit this storyboard shot using a reference image."}
            </DialogDescription>
          </DialogHeader>

          {imageToolsStoryboard && (
            <div className="space-y-3">
              {imageToolsStoryboard.image_url && (
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30 max-h-40">
                  <img
                    src={imageToolsStoryboard.image_url}
                    alt={imageToolsStoryboard.title}
                    className="w-full h-full max-h-40 object-contain"
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Edit using your locked model ({getLockedImageModelLabel() || "lock one in AI Settings"}).
                {getLockedImageConfig({ withReferenceImage: true })?.supportsReference
                  ? " Describe changes below and optionally link another project image as a second reference."
                  : " Your locked model does not support reference editing — use GPT Image 2 or Runway ML."}
              </p>

              {imageEditUploading && imageEditProgress ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {imageEditProgress}
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="cinema-image-edit-prompt" className="text-xs sm:text-sm">
                  Describe your edit
                </Label>
                <Textarea
                  id="cinema-image-edit-prompt"
                  value={imageEditPrompt}
                  onChange={(e) => setImageEditPrompt(e.target.value)}
                  placeholder='e.g., warmer lighting, wider framing, add rain, closer on the character'
                  className="bg-input border-border min-h-[72px] text-xs sm:text-sm resize-none"
                  disabled={imageEditUploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cinema-image-edit-ref" className="text-xs text-muted-foreground">
                  Primary reference (optional)
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="cinema-image-edit-ref"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={imageEditUploading}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (imageEditReferencePreview) URL.revokeObjectURL(imageEditReferencePreview)
                      setImageEditReferenceFile(file)
                      setImageEditReferencePreview(URL.createObjectURL(file))
                      e.target.value = ""
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={imageEditUploading}
                    onClick={() => document.getElementById("cinema-image-edit-ref")?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Upload reference
                  </Button>
                  {imageEditReferencePreview ? (
                    <>
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-primary ring-2 ring-primary/40">
                        <img
                          src={imageEditReferencePreview}
                          alt="Uploaded reference"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={imageEditUploading}
                        onClick={clearImageEditReference}
                        title="Remove uploaded reference"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                  {!imageEditReferencePreview && imageToolsStoryboard.image_url ? (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border">
                      <img
                        src={imageToolsStoryboard.image_url}
                        alt="Current shot"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {imageEditReferenceFile
                    ? "Using your uploaded image as the primary reference."
                    : imageToolsStoryboard.image_url
                      ? "Uses the current shot image if you don't upload one."
                      : "Upload a reference or link an image to this shot first."}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs text-muted-foreground">
                    Link existing image (optional)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adds more images as references from characters, locations, or project assets.
                  Select up to {MAX_LINKED_REFERENCE_IMAGES}. Your description above is the only prompt.
                </p>
                {isLoadingProjectAssets ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading project assets…
                  </div>
                ) : linkedProjectImageGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">
                    No other images in this project yet. Generate character or location images to link here.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto rounded-lg border border-border/60 p-2">
                    {linkedProjectImageGroups.map((group) => (
                      <div key={group.label} className="space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          {group.label}
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {group.assets.map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              disabled={imageEditUploading}
                              onClick={() => toggleImageEditStyleLink(asset.id)}
                              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                imageEditStyleLinkAssetIds.includes(asset.id)
                                  ? "border-violet-500 ring-2 ring-violet-500/40"
                                  : "border-border hover:border-violet-500/50"
                              }`}
                              title={`${getProjectAssetSourceLabel(asset, projectLocations, projectCharacters)} — ${asset.title.replace(/ - AI Generated Image.*$/, "")}`}
                            >
                              <img
                                src={asset.content_url!}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {imageEditStyleLinkAssetIds.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-violet-400">
                      {imageEditStyleLinkAssetIds.length} of {MAX_LINKED_REFERENCE_IMAGES} linked as
                      additional references
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={imageEditUploading}
                      onClick={clearImageEditStyleLinks}
                    >
                      Clear all
                    </Button>
                  </div>
                ) : null}
              </div>

              <Button
                size="sm"
                onClick={() => void handleCinemaImageEdit()}
                disabled={
                  imageEditUploading ||
                  !imageEditPrompt.trim() ||
                  !getLockedImageConfig({ withReferenceImage: true })?.supportsReference ||
                  (!imageEditReferenceFile && !imageToolsStoryboard.image_url)
                }
                className="gap-2 w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white"
              >
                {imageEditUploading && imageEditPrompt.trim() ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Editing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Edit Image
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Make Frames for video references */}
      <Dialog
        open={framesDialogOpen}
        onOpenChange={(open) => {
          setFramesDialogOpen(open)
          if (!open) setImageToolsStoryboard(null)
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Make Frames</DialogTitle>
            <DialogDescription>
              Generate alternate stills from this shot for video start/end frames or as the image
              used when generating video.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {imageToolsStoryboard?.image_url ? (
              <img
                src={imageToolsStoryboard.image_url}
                alt=""
                className="w-full max-h-36 object-contain rounded-md border bg-muted"
              />
            ) : (
              <p className="text-sm text-amber-600">
                This shot needs an image before you can generate frames.
              </p>
            )}
            <div>
              <Label>Frame type</Label>
              <Select value={framePresetId} onValueChange={setFramePresetId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_FRAME_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cinema-frame-direction">Extra direction (optional)</Label>
              <Textarea
                id="cinema-frame-direction"
                value={frameCustomDirection}
                onChange={(e) => setFrameCustomDirection(e.target.value)}
                placeholder="e.g. crow wings mid-beat, further left in frame"
                rows={2}
                disabled={frameGenerating}
              />
            </div>
            <div>
              <Label>Apply generated frame to</Label>
              <Select
                value={frameApplyTarget}
                onValueChange={(v) => setFrameApplyTarget(v as FrameApplyTarget)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video reference (I2V image)</SelectItem>
                  <SelectItem value="start">Start frame (frame-to-frame)</SelectItem>
                  <SelectItem value="end">End frame (frame-to-frame)</SelectItem>
                  <SelectItem value="shot">Update shot image</SelectItem>
                  <SelectItem value="library">Frame library only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {frameGenerating && frameProgress ? (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {frameProgress}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={frameGenerating || !imageToolsStoryboard?.image_url}
              onClick={() => void handleGenerateVideoFrame()}
            >
              {frameGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Images className="h-4 w-4 mr-2" />
                  Generate Frame
                </>
              )}
            </Button>
            {imageToolsStoryboard &&
              (shotReferenceFrames.get(imageToolsStoryboard.id) || []).length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-medium">This shot’s frames</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(shotReferenceFrames.get(imageToolsStoryboard.id) || []).map((frame) => (
                      <div key={frame.id} className="rounded border overflow-hidden space-y-1">
                        <img
                          src={frame.url}
                          alt={frame.label}
                          className="w-full h-24 object-cover"
                        />
                        <div className="px-2 pb-2 space-y-1">
                          <p className="text-[11px] text-muted-foreground truncate">
                            {frame.label}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-7 text-[11px] px-2"
                              onClick={() =>
                                void applyGeneratedFrame(
                                  imageToolsStoryboard,
                                  frame.url,
                                  frame.label,
                                  "video",
                                ).then(() =>
                                  toast({
                                    title: "Video reference set",
                                    description: `Using “${frame.label}”.`,
                                  }),
                                )
                              }
                            >
                              Video
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] px-2"
                              onClick={() =>
                                void applyGeneratedFrame(
                                  imageToolsStoryboard,
                                  frame.url,
                                  frame.label,
                                  "start",
                                ).then(() =>
                                  toast({
                                    title: "Start frame set",
                                    description: `Using “${frame.label}”.`,
                                  }),
                                )
                              }
                            >
                              Start
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] px-2"
                              onClick={() =>
                                void applyGeneratedFrame(
                                  imageToolsStoryboard,
                                  frame.url,
                                  frame.label,
                                  "end",
                                ).then(() =>
                                  toast({
                                    title: "End frame set",
                                    description: `Using “${frame.label}”.`,
                                  }),
                                )
                              }
                            >
                              End
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>

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
                            className="w-full aspect-video object-cover bg-muted"
                            muted
                            preload="metadata"
                            onLoadedMetadata={(e) => showVideoFrameThumbnail(e.currentTarget)}
                            onMouseEnter={(e) => safeVideoPlay(e.currentTarget)}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause()
                              showVideoFrameThumbnail(e.currentTarget)
                            }}
                          />
                          <div className="absolute top-2 right-2 flex gap-1">
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
                          <div className="absolute bottom-2 right-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 w-8 p-0"
                              disabled={deletingVideoId === video.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleDeleteVideo(video)
                              }}
                              title="Delete video"
                            >
                              {deletingVideoId === video.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
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
                      className="w-full rounded-md bg-muted aspect-video object-cover"
                      key={selectedVideoUrl}
                      preload="metadata"
                      playsInline
                      onLoadedMetadata={(e) => showVideoFrameThumbnail(e.currentTarget)}
                      onLoadedData={(e) => {
                        safeVideoPlay(e.currentTarget)
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

