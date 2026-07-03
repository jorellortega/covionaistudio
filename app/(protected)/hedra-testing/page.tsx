"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Header from "@/components/header"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  ImageIcon,
  Video,
  Mic,
  UserCircle,
  KeyRound,
  RefreshCw,
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  List,
  Sparkles,
  Film,
} from "lucide-react"
import { MovieService, type Movie } from "@/lib/movie-service"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { AssetService } from "@/lib/asset-service"
import { StoryboardsService } from "@/lib/storyboards-service"
import { referenceUrlToFile } from "@/lib/project-image-linking"

type HedraModel = {
  id: string
  name?: string
  type?: string
  [key: string]: unknown
}

type HedraVoice = {
  id: string
  name?: string
  [key: string]: unknown
}

type SessionJob = {
  id: string
  generationId: string
  label: string
  kind: "image" | "video" | "audio"
  status: string
  downloadUrl?: string
  raw?: unknown
  createdAt: number
}

const ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const
const IMAGE_RESOLUTIONS = ["540p", "720p", "1080p", "1440p (2K QHD)", "2160p (4K UHD)"]
const VIDEO_RESOLUTIONS = ["540p", "720p"]

type SceneImageOption = {
  id: string
  url: string
  label: string
  source: "scene" | "asset" | "storyboard"
}

function isCharacter3Model(model: HedraModel | undefined): boolean {
  if (!model) return false
  const name = String(model.name || "").toLowerCase()
  return (
    name.includes("character 3") ||
    name.includes("character-3") ||
    name.includes("hedra avatar") ||
    name.includes("omnia") ||
    (name.includes("avatar") && !name.includes("image"))
  )
}

const AVATAR_PERFORMANCE_PROMPT =
  "A person speaking to the camera with natural lip sync and subtle facial expressions"

async function waitForHedraAsset(
  generationId: string,
  apiKey: string,
  label: string,
): Promise<string> {
  const maxAttempts = 90
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 3000))
    const res = await fetch(
      `/api/ai/hedra?action=status&generationId=${encodeURIComponent(generationId)}${apiKeyQuery(apiKey)}`,
    )
    const data = await res.json()
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `Failed to poll ${label}`)
    }

    const statusObj = data.status as {
      status?: string
      asset_id?: string
      error_message?: string
    }
    if (statusObj.status === "complete" && statusObj.asset_id) {
      return statusObj.asset_id
    }
    if (statusObj.status === "error") {
      throw new Error(statusObj.error_message || `${label} failed`)
    }
  }
  throw new Error(`Timed out waiting for ${label}`)
}

function apiKeyQuery(apiKey: string) {
  return apiKey.trim() ? `&apiKey=${encodeURIComponent(apiKey.trim())}` : ""
}

export default function HedraTestingPage() {
  const { ready, userId } = useAuthReady()
  const { toast } = useToast()

  const [apiKey, setApiKey] = useState("")
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null)

  const [models, setModels] = useState<HedraModel[]>([])
  const [voices, setVoices] = useState<HedraVoice[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)

  const [activeTab, setActiveTab] = useState("models")
  const [prompt, setPrompt] = useState("A cinematic portrait in golden hour light")
  const [aspectRatio, setAspectRatio] = useState<string>("16:9")
  const [resolution, setResolution] = useState("1080p")
  const [durationSec, setDurationSec] = useState("5")
  const [enhancePrompt, setEnhancePrompt] = useState(false)

  const [imageModelId, setImageModelId] = useState("")
  const [videoModelId, setVideoModelId] = useState("")
  const [avatarModelId, setAvatarModelId] = useState("")

  const [voiceId, setVoiceId] = useState("")
  const [ttsText, setTtsText] = useState("Hello from Hedra text-to-speech on Cinema Platform.")

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageAssetId, setImageAssetId] = useState<string | null>(null)

  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioAssetId, setAudioAssetId] = useState<string | null>(null)
  const [character3AudioMode, setCharacter3AudioMode] = useState<"tts" | "import">("tts")
  const [dialogueText, setDialogueText] = useState("Another day.")

  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobs, setJobs] = useState<SessionJob[]>([])

  const [projects, setProjects] = useState<Movie[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState("")
  const [sceneImageOptions, setSceneImageOptions] = useState<SceneImageOption[]>([])
  const [selectedSceneImageId, setSelectedSceneImageId] = useState<string | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingScenes, setLoadingScenes] = useState(false)
  const [loadingSceneImages, setLoadingSceneImages] = useState(false)

  const imageModels = useMemo(
    () => models.filter((m) => String(m.type || "").toLowerCase().includes("image")),
    [models],
  )
  const videoModels = useMemo(
    () => models.filter((m) => String(m.type || "").toLowerCase().includes("video")),
    [models],
  )
  const selectedVideoModel = useMemo(
    () => videoModels.find((m) => m.id === videoModelId),
    [videoModels, videoModelId],
  )
  const isCharacter3Selected = isCharacter3Model(selectedVideoModel)

  useEffect(() => {
    if (isCharacter3Selected && !VIDEO_RESOLUTIONS.includes(resolution)) {
      setResolution("720p")
    }
  }, [isCharacter3Selected, resolution])

  useEffect(() => {
    if (!ready || !userId) return
    const loadProjects = async () => {
      setLoadingProjects(true)
      try {
        const movies = await MovieService.getMovies()
        setProjects(movies)
      } catch (error) {
        console.error("Failed to load projects:", error)
      } finally {
        setLoadingProjects(false)
      }
    }
    void loadProjects()
  }, [ready, userId])

  useEffect(() => {
    if (!selectedProjectId || !ready) {
      setScenes([])
      setSelectedSceneId("")
      return
    }

    const loadScenes = async () => {
      setLoadingScenes(true)
      try {
        const projectScenes = await TimelineService.getMovieScenes(selectedProjectId)
        setScenes(projectScenes)
        setSelectedSceneId("")
        setSceneImageOptions([])
        setSelectedSceneImageId(null)
      } catch (error) {
        toast({
          title: "Failed to load scenes",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        })
      } finally {
        setLoadingScenes(false)
      }
    }
    void loadScenes()
  }, [selectedProjectId, ready, toast])

  useEffect(() => {
    if (!selectedSceneId || !ready) {
      setSceneImageOptions([])
      setSelectedSceneImageId(null)
      return
    }

    const loadSceneImages = async () => {
      setLoadingSceneImages(true)
      try {
        const options: SceneImageOption[] = []
        const seen = new Set<string>()

        const add = (option: SceneImageOption) => {
          if (!option.url || seen.has(option.url)) return
          seen.add(option.url)
          options.push(option)
        }

        const scene = scenes.find((s) => s.id === selectedSceneId)
        if (scene?.metadata?.thumbnail) {
          add({
            id: `scene-thumb-${scene.id}`,
            url: scene.metadata.thumbnail,
            label: scene.name || "Scene thumbnail",
            source: "scene",
          })
        }

        const assets = await AssetService.getAssetsForScene(selectedSceneId)
        for (const asset of assets) {
          if (asset.content_type === "image" && asset.content_url) {
            add({
              id: asset.id,
              url: asset.content_url,
              label: asset.title || "Scene image",
              source: "asset",
            })
          }
        }

        const storyboards = await StoryboardsService.getStoryboardsByScene(selectedSceneId)
        for (const sb of storyboards) {
          if (sb.image_url) {
            add({
              id: sb.id,
              url: sb.image_url,
              label: sb.title || `Shot ${sb.shot_number ?? ""}`.trim(),
              source: "storyboard",
            })
          }
        }

        setSceneImageOptions(
          options.sort((a, b) => {
            const order = { storyboard: 0, asset: 1, scene: 2 }
            return order[a.source] - order[b.source]
          }),
        )
        setSelectedSceneImageId(null)
      } catch (error) {
        toast({
          title: "Failed to load scene images",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        })
      } finally {
        setLoadingSceneImages(false)
      }
    }

    void loadSceneImages()
  }, [selectedSceneId, scenes, ready, toast])

  useEffect(() => {
    if (!ready) return
    fetch("/api/ai/hedra?action=models")
      .then((r) => r.json())
      .then((data) => setHasServerKey(!data.error?.includes("No Hedra API key")))
      .catch(() => setHasServerKey(false))
  }, [ready])

  const loadCatalog = useCallback(async () => {
    if (!apiKey.trim() && hasServerKey === false) {
      toast({
        title: "API key required",
        description: "Enter your Hedra API key or set HEDRA_API_KEY on the server.",
        variant: "destructive",
      })
      return
    }

    setIsLoadingCatalog(true)
    try {
      const [modelsRes, voicesRes] = await Promise.all([
        fetch(`/api/ai/hedra?action=models${apiKeyQuery(apiKey)}`),
        fetch(`/api/ai/hedra?action=voices${apiKeyQuery(apiKey)}`),
      ])
      const modelsData = await modelsRes.json()
      const voicesData = await voicesRes.json()

      if (!modelsRes.ok) throw new Error(modelsData.error || "Failed to load models")
      if (!voicesRes.ok) throw new Error(voicesData.error || "Failed to load voices")

      const modelList = Array.isArray(modelsData.models) ? modelsData.models : []
      const voiceList = Array.isArray(voicesData.voices) ? voicesData.voices : []

      setModels(modelList)
      setVoices(voiceList)

      const firstImage = modelList.find((m: HedraModel) =>
        String(m.type || "").toLowerCase().includes("image"),
      )
      const firstVideo = modelList.find((m: HedraModel) =>
        String(m.type || "").toLowerCase().includes("video"),
      )
      if (firstImage?.id) setImageModelId(firstImage.id)
      if (firstVideo?.id) {
        setVideoModelId(firstVideo.id)
        setAvatarModelId(firstVideo.id)
      }
      const character3 = modelList.find((m: HedraModel) => isCharacter3Model(m))
      if (character3?.id) setVideoModelId(character3.id)
      if (voiceList[0]?.id) setVoiceId(voiceList[0].id)

      toast({ title: "Catalog loaded", description: `${modelList.length} models, ${voiceList.length} voices` })
    } catch (error) {
      toast({
        title: "Failed to load Hedra catalog",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [apiKey, hasServerKey, toast])

  const pollGeneration = useCallback(
    async (generationId: string, jobId: string) => {
      const maxAttempts = 120
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, 4000))
        const res = await fetch(
          `/api/ai/hedra?action=status&generationId=${encodeURIComponent(generationId)}${apiKeyQuery(apiKey)}`,
        )
        const data = await res.json()
        if (!res.ok) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId ? { ...j, status: "error", raw: data } : j,
            ),
          )
          return
        }

        const status = (data.status as { status?: string })?.status || "unknown"
        const downloadUrl =
          (data.status as { download_url?: string })?.download_url ||
          (data.status as { url?: string })?.url

        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status, downloadUrl: downloadUrl || j.downloadUrl, raw: data.status }
              : j,
          ),
        )

        if (status === "complete" || status === "error") return
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "timeout" } : j)),
      )
    },
    [apiKey],
  )

  const startGeneration = async (
    payload: Record<string, unknown>,
    label: string,
    kind: SessionJob["kind"],
  ) => {
    setIsGenerating(true)
    try {
      const res = await fetch("/api/ai/hedra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", apiKey: apiKey.trim() || undefined, payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")

      const generationId = (data.generation as { id?: string })?.id
      if (!generationId) throw new Error("No generation id returned")

      const jobId = crypto.randomUUID()
      setJobs((prev) => [
        {
          id: jobId,
          generationId,
          label,
          kind,
          status: "processing",
          createdAt: Date.now(),
          raw: data.generation,
        },
        ...prev,
      ])

      toast({ title: "Generation started", description: `Job ${generationId.slice(0, 8)}…` })
      void pollGeneration(generationId, jobId)
    } catch (error) {
      toast({
        title: "Hedra generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const uploadAsset = async (file: File, assetType: "image" | "audio") => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("action", "upload")
      formData.append("assetType", assetType)
      formData.append("file", file)
      if (apiKey.trim()) formData.append("apiKey", apiKey.trim())

      const res = await fetch("/api/ai/hedra", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      return data.assetId as string
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageFile = (file: File | null) => {
    setImageFile(file)
    setImageAssetId(null)
    setSelectedSceneImageId(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  const selectSceneImage = async (option: SceneImageOption) => {
    setIsUploading(true)
    try {
      const safeName = option.label.replace(/[^\w.\-() ]/g, "_") || "scene-image.png"
      const file = await referenceUrlToFile(option.url, safeName.endsWith(".png") ? safeName : `${safeName}.png`)
      setSelectedSceneImageId(option.id)
      setImageFile(file)
      setImageAssetId(null)
      if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview)
      setImagePreview(option.url)
      toast({ title: "Image selected", description: option.label })
    } catch (error) {
      toast({
        title: "Could not load image",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const ensureImageAsset = async () => {
    if (imageAssetId) return imageAssetId
    if (!imageFile) throw new Error("Upload a start image first")
    const id = await uploadAsset(imageFile, "image")
    setImageAssetId(id)
    return id
  }

  const ensureAudioAsset = async () => {
    if (audioAssetId) return audioAssetId
    if (!audioFile) throw new Error("Upload an audio file first")
    const id = await uploadAsset(audioFile, "audio")
    setAudioAssetId(id)
    return id
  }

  const ensureDialogueAudioAsset = async (
    spokenText: string,
    mode: "tts" | "import" = character3AudioMode,
  ): Promise<string> => {
    if (mode === "import") {
      return ensureAudioAsset()
    }

    if (!voiceId) {
      throw new Error("Select a Hedra voice for dialogue")
    }

    toast({ title: "Generating speech…", description: "Creating audio before lip-sync video." })

    const ttsRes = await fetch("/api/ai/hedra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate",
        apiKey: apiKey.trim() || undefined,
        payload: {
          type: "text_to_speech",
          voice_id: voiceId,
          text: spokenText,
          stability: 0.5,
          speed: 1,
          language: "English",
        },
      }),
    })
    const ttsData = await ttsRes.json()
    if (!ttsRes.ok) {
      throw new Error(ttsData.error || "Speech generation failed")
    }

    const ttsGenerationId = (ttsData.generation as { id?: string })?.id
    if (!ttsGenerationId) {
      throw new Error("No speech generation id returned")
    }

    return waitForHedraAsset(ttsGenerationId, apiKey, "speech")
  }

  const buildAvatarVideoPayload = async (
    modelId: string,
    options?: { spokenText?: string; audioMode?: "tts" | "import" },
  ): Promise<Record<string, unknown>> => {
    const audioMode = options?.audioMode ?? character3AudioMode
    const startKeyframeId = await ensureImageAsset()
    const performancePrompt = prompt.trim() || AVATAR_PERFORMANCE_PROMPT

    const spokenText = options?.spokenText ?? dialogueText.trim()
    const audioId =
      audioMode === "import"
        ? await ensureAudioAsset()
        : await ensureDialogueAudioAsset(spokenText, "tts")

    return {
      type: "video",
      ai_model_id: modelId,
      start_keyframe_id: startKeyframeId,
      audio_id: audioId,
      generated_video_inputs: {
        text_prompt: performancePrompt,
        aspect_ratio: aspectRatio,
        resolution: VIDEO_RESOLUTIONS.includes(resolution) ? resolution : "720p",
      },
    }
  }

  const generateImage = () => {
    if (!imageModelId) {
      toast({ title: "Select a model", description: "Load models first.", variant: "destructive" })
      return
    }
    void startGeneration(
      {
        type: "image",
        text_prompt: prompt,
        ai_model_id: imageModelId,
        aspect_ratio: aspectRatio,
        resolution,
        enhance_prompt: enhancePrompt,
      },
      prompt,
      "image",
    )
  }

  const generateVideo = async (mode: "text" | "image") => {
    if (!videoModelId) {
      toast({ title: "Select a model", description: "Load models first.", variant: "destructive" })
      return
    }

    try {
      if (isCharacter3Selected) {
        if (mode !== "image") {
          toast({
            title: "Character 3 needs a portrait",
            description: "Pick a face-forward image, then add dialogue or import audio.",
            variant: "destructive",
          })
          return
        }

        const spokenText = dialogueText.trim()
        if (character3AudioMode === "tts" && !spokenText) {
          toast({
            title: "Add dialogue",
            description: "Enter what the character should say in the Dialogue field.",
            variant: "destructive",
          })
          return
        }
        if (character3AudioMode === "tts" && !voiceId) {
          toast({
            title: "Select a Hedra voice",
            description: "Load models & voices, then pick a voice.",
            variant: "destructive",
          })
          return
        }
        if (character3AudioMode === "import" && !audioFile) {
          toast({
            title: "Import audio",
            description: "Upload an audio clip for lip-sync.",
            variant: "destructive",
          })
          return
        }

        const payload = await buildAvatarVideoPayload(videoModelId, { spokenText })
        console.log("🎭 Hedra Character 3 payload:", payload)
        await startGeneration(payload, spokenText || "Avatar video", "video")
        return
      }

      const payload: Record<string, unknown> = {
        type: "video",
        ai_model_id: videoModelId,
        generated_video_inputs: {
          text_prompt: prompt,
          aspect_ratio: aspectRatio,
          resolution: VIDEO_RESOLUTIONS.includes(resolution) ? resolution : "720p",
          duration_ms: Math.round(parseFloat(durationSec || "5") * 1000),
        },
      }

      if (mode === "image") {
        payload.start_keyframe_id = await ensureImageAsset()
      }

      await startGeneration(payload, prompt, "video")
    } catch (error) {
      toast({
        title: "Video setup failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const generateTts = () => {
    if (!voiceId) {
      toast({ title: "Select a voice", description: "Load voices first.", variant: "destructive" })
      return
    }
    void startGeneration(
      {
        type: "text_to_speech",
        voice_id: voiceId,
        text: ttsText,
        stability: 0.5,
        speed: 1,
        language: "English",
      },
      ttsText,
      "audio",
    )
  }

  const generateAvatar = async (useTts: boolean) => {
    if (!avatarModelId) {
      toast({ title: "Select a model", description: "Load models first.", variant: "destructive" })
      return
    }

    try {
      const spokenText = useTts ? ttsText.trim() : undefined
      if (useTts && !voiceId) {
        toast({ title: "Select a voice", variant: "destructive" })
        return
      }
      if (useTts && !spokenText) {
        toast({ title: "Add dialogue text", variant: "destructive" })
        return
      }
      if (!useTts && !audioFile) {
        toast({ title: "Upload audio", variant: "destructive" })
        return
      }

      const payload = await buildAvatarVideoPayload(avatarModelId, {
        spokenText,
        audioMode: useTts ? "tts" : "import",
      })

      console.log("🎭 Hedra avatar payload:", payload)
      await startGeneration(payload, useTts ? ttsText : "Avatar video", "video")
    } catch (error) {
      toast({
        title: "Avatar setup failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Hedra Testing</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Test Hedra image, video, audio, and avatar generation via{" "}
              <a
                href="https://hedra.com/docs"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                Hedra API
              </a>
              .
            </p>
          </div>
          <Badge variant={hasServerKey ? "default" : "secondary"} className="w-fit">
            {hasServerKey === null ? "Checking key…" : hasServerKey ? "Server key available" : "No server key"}
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              API key
            </CardTitle>
            <CardDescription>
              Get a key from{" "}
              <a href="https://hedra.com/api-profile" target="_blank" rel="noreferrer" className="underline">
                hedra.com/api-profile
              </a>
              . Override here or set <code className="text-xs">HEDRA_API_KEY</code> in your environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input
              type="password"
              placeholder="Hedra API key (optional if server env is set)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => void loadCatalog()} disabled={isLoadingCatalog}>
              {isLoadingCatalog ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Load models &amp; voices
            </Button>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="models">
              <List className="h-4 w-4 mr-1 hidden sm:inline" />
              Models
            </TabsTrigger>
            <TabsTrigger value="image">
              <ImageIcon className="h-4 w-4 mr-1 hidden sm:inline" />
              Image
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="h-4 w-4 mr-1 hidden sm:inline" />
              Video
            </TabsTrigger>
            <TabsTrigger value="audio">
              <Mic className="h-4 w-4 mr-1 hidden sm:inline" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="avatar">
              <UserCircle className="h-4 w-4 mr-1 hidden sm:inline" />
              Avatar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Available models</CardTitle>
                <CardDescription>From <code>GET /models</code> — filter by type for each tab.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {models.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Load the catalog to see Hedra models.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {models.map((m) => (
                      <div key={m.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{m.name || m.id}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{m.id}</p>
                        {m.type && <Badge variant="outline" className="mt-2">{String(m.type)}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
                {voices.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-sm font-medium">{voices.length} voices loaded</p>
                    <p className="text-xs text-muted-foreground">Use the Audio or Avatar tab to pick a voice.</p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="image" className="mt-4 space-y-4">
            <GenForm
              prompt={prompt}
              setPrompt={setPrompt}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              resolutions={IMAGE_RESOLUTIONS}
              modelId={imageModelId}
              setModelId={setImageModelId}
              models={imageModels}
              enhancePrompt={enhancePrompt}
              setEnhancePrompt={setEnhancePrompt}
              onGenerate={generateImage}
              isGenerating={isGenerating}
              generateLabel="Generate image"
            />
          </TabsContent>

          <TabsContent value="video" className="mt-4 space-y-4">
            <GenForm
              prompt={prompt}
              setPrompt={setPrompt}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              resolutions={VIDEO_RESOLUTIONS}
              modelId={videoModelId}
              setModelId={setVideoModelId}
              models={videoModels}
              durationSec={durationSec}
              setDurationSec={setDurationSec}
              onGenerate={() => void generateVideo("text")}
              isGenerating={isGenerating}
              generateLabel="Text → video"
              showGenerateButton={!isCharacter3Selected}
              promptLabel={isCharacter3Selected ? "Performance prompt" : "Prompt"}
              promptHint={
                isCharacter3Selected
                  ? "Describes how the character moves or performs — not the spoken words."
                  : undefined
              }
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isCharacter3Selected ? "Character 3 — start image" : "Image → video"}
                </CardTitle>
                <CardDescription>
                  {isCharacter3Selected
                    ? "Character 3 requires a portrait plus audio — import a clip or generate speech with a Hedra voice."
                    : "Upload a start frame, then animate with a prompt."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCharacter3Selected && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 space-y-1">
                    <p className="font-medium text-amber-100">Lip-sync needs a clear face</p>
                    <p>
                      Use a storyboard shot where the character&apos;s face is visible. Wide scenes (caves, landscapes)
                      may animate but won&apos;t lip-sync. Put spoken words in <strong>Dialogue</strong>, not the performance prompt.
                    </p>
                  </div>
                )}
                {isCharacter3Selected && (
                  <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Film className="h-4 w-4" />
                      Pick from project
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Project</Label>
                        <Select
                          value={selectedProjectId}
                          onValueChange={(id) => {
                            setSelectedProjectId(id)
                            handleImageFile(null)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={loadingProjects ? "Loading…" : "Select project"} />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Scene</Label>
                        <Select
                          value={selectedSceneId}
                          onValueChange={(id) => {
                            setSelectedSceneId(id)
                            handleImageFile(null)
                          }}
                          disabled={!selectedProjectId || loadingScenes}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={loadingScenes ? "Loading…" : "Select scene"} />
                          </SelectTrigger>
                          <SelectContent>
                            {scenes.map((scene) => (
                              <SelectItem key={scene.id} value={scene.id}>
                                {scene.name || `Scene ${scene.order_index ?? ""}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {selectedSceneId && (
                      <div className="space-y-2">
                        <Label>Scene images</Label>
                        {loadingSceneImages ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading images…
                          </p>
                        ) : sceneImageOptions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No images for this scene yet — add scene assets or storyboard shots.
                          </p>
                        ) : (
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {sceneImageOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                disabled={isUploading}
                                onClick={() => void selectSceneImage(option)}
                                className={`relative h-20 w-20 shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                                  selectedSceneImageId === option.id
                                    ? "border-primary"
                                    : "border-transparent hover:border-primary/50"
                                }`}
                                title={option.label}
                              >
                                <img src={option.url} alt="" className="w-full h-full object-cover" />
                                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white px-1 py-0.5 truncate">
                                  {option.source === "storyboard" ? "shot · best" : option.source}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <Separator />
                  </div>
                )}
                {isCharacter3Selected && (
                  <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Mic className="h-4 w-4" />
                      Audio (required)
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Character 3 lip-syncs to audio. Import your own file or use Hedra text-to-speech.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={character3AudioMode === "tts" ? "default" : "outline"}
                        onClick={() => setCharacter3AudioMode("tts")}
                      >
                        Hedra voice (TTS)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={character3AudioMode === "import" ? "default" : "outline"}
                        onClick={() => setCharacter3AudioMode("import")}
                      >
                        Import audio file
                      </Button>
                    </div>
                    {character3AudioMode === "tts" ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Voice</Label>
                          <Select value={voiceId} onValueChange={setVoiceId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Load voices first" />
                            </SelectTrigger>
                            <SelectContent>
                              {voices.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name || v.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Dialogue</Label>
                          <Textarea
                            value={dialogueText}
                            onChange={(e) => setDialogueText(e.target.value)}
                            rows={2}
                            placeholder="What the character says…"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Audio file</Label>
                        <Input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => {
                            setAudioFile(e.target.files?.[0] || null)
                            setAudioAssetId(null)
                          }}
                        />
                        {audioFile && (
                          <p className="text-xs text-muted-foreground">{audioFile.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Video length follows the audio clip.
                        </p>
                      </div>
                    )}
                    <Separator />
                  </div>
                )}
                <AssetUpload
                  accept="image/*"
                  preview={imagePreview}
                  assetId={imageAssetId}
                  file={imageFile}
                  onFile={handleImageFile}
                  isUploading={isUploading}
                />
                <Button
                  onClick={() => void generateVideo("image")}
                  disabled={
                    isGenerating ||
                    isUploading ||
                    !imageFile ||
                    (isCharacter3Selected &&
                      character3AudioMode === "tts"
                      ? !voiceId || !dialogueText.trim()
                      : isCharacter3Selected && character3AudioMode === "import"
                        ? !audioFile
                        : false)
                  }
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Video className="h-4 w-4 mr-2" />}
                  {isCharacter3Selected ? "Generate with Character 3" : "Image → video"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audio" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Text to speech</CardTitle>
                <CardDescription>Uses <code>type: text_to_speech</code> with a voice from Hedra.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger><SelectValue placeholder="Load voices first" /></SelectTrigger>
                    <SelectContent>
                      {voices.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name || v.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Text</Label>
                  <Textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} rows={3} />
                </div>
                <Button onClick={generateTts} disabled={isGenerating || !voiceId}>
                  {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mic className="h-4 w-4 mr-2" />}
                  Generate speech
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="avatar" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Avatar video</CardTitle>
                <CardDescription>
                  Portrait image + audio (file or TTS). Try Hedra Avatar or Omnia model IDs from the catalog.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Video model</Label>
                  <Select value={avatarModelId} onValueChange={setAvatarModelId}>
                    <SelectTrigger><SelectValue placeholder="Load models first" /></SelectTrigger>
                    <SelectContent>
                      {videoModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name || m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <AssetUpload
                  label="Portrait image"
                  accept="image/*"
                  preview={imagePreview}
                  assetId={imageAssetId}
                  file={imageFile}
                  onFile={handleImageFile}
                  isUploading={isUploading}
                />
                <Separator />
                <div className="space-y-2">
                  <Label>Voice (for TTS path)</Label>
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger><SelectValue placeholder="Load voices first" /></SelectTrigger>
                    <SelectContent>
                      {voices.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name || v.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} rows={2} />
                  <Button
                    onClick={() => void generateAvatar(true)}
                    disabled={isGenerating || isUploading || !imageFile || !voiceId}
                  >
                    Avatar with TTS
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Or upload audio</Label>
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      setAudioFile(e.target.files?.[0] || null)
                      setAudioAssetId(null)
                    }}
                  />
                  {audioAssetId && (
                    <p className="text-xs text-muted-foreground font-mono">Audio asset: {audioAssetId}</p>
                  )}
                  <Button
                    onClick={() => void generateAvatar(false)}
                    disabled={isGenerating || isUploading || !imageFile || !audioFile}
                  >
                    Avatar with audio file
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Session jobs</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Generations appear here while they process.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {jobs.map((job) => (
                <Card key={job.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{job.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{job.generationId}</p>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                    {job.downloadUrl && (
                      <div className="rounded-lg border overflow-hidden bg-muted/30">
                        {job.kind === "image" ? (
                          <img src={job.downloadUrl} alt="" className="w-full max-h-48 object-contain" />
                        ) : job.kind === "video" ? (
                          <video src={job.downloadUrl} controls className="w-full max-h-48" />
                        ) : (
                          <audio src={job.downloadUrl} controls className="w-full" />
                        )}
                      </div>
                    )}
                    {job.downloadUrl && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild className="flex-1">
                          <a href={job.downloadUrl} download target="_blank" rel="noreferrer">
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Download
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={job.downloadUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground pb-8">
          Docs:{" "}
          <Link href="https://hedra.com/docs/pages/developer/guides/generate-image" className="underline" target="_blank">
            Image
          </Link>
          {" · "}
          <Link href="https://hedra.com/docs/pages/developer/guides/generate-video" className="underline" target="_blank">
            Video
          </Link>
          {" · "}
          <Link href="https://hedra.com/docs/pages/developer/guides/generate-avatar-video" className="underline" target="_blank">
            Avatar
          </Link>
          {" · "}
          <Link href="https://hedra.com/docs/pages/developer/guides/generate-audio" className="underline" target="_blank">
            Audio
          </Link>
        </p>
      </div>
    </>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <Badge className="shrink-0">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Complete
      </Badge>
    )
  }
  if (status === "error" || status === "timeout") {
    return (
      <Badge variant="destructive" className="shrink-0">
        <AlertCircle className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="shrink-0">
      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      {status}
    </Badge>
  )
}

function AssetUpload({
  label = "Start image",
  accept,
  preview,
  assetId,
  file,
  onFile,
  isUploading,
}: {
  label?: string
  accept: string
  preview: string | null
  assetId: string | null
  file: File | null
  onFile: (file: File | null) => void
  isUploading: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="file"
        accept={accept}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      {preview && (
        <img src={preview} alt="" className="h-24 w-24 object-cover rounded-md border" />
      )}
      {file && !assetId && (
        <p className="text-xs text-muted-foreground">File selected — uploaded when you generate.</p>
      )}
      {assetId && <p className="text-xs text-muted-foreground font-mono">Asset: {assetId}</p>}
      {isUploading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
        </p>
      )}
    </div>
  )
}

function GenForm({
  prompt,
  setPrompt,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  resolutions,
  modelId,
  setModelId,
  models,
  durationSec,
  setDurationSec,
  enhancePrompt,
  setEnhancePrompt,
  onGenerate,
  isGenerating,
  generateLabel,
  showGenerateButton = true,
  promptLabel = "Prompt",
  promptHint,
}: {
  prompt: string
  setPrompt: (v: string) => void
  aspectRatio: string
  setAspectRatio: (v: string) => void
  resolution: string
  setResolution: (v: string) => void
  resolutions: string[]
  modelId: string
  setModelId: (v: string) => void
  models: HedraModel[]
  durationSec?: string
  setDurationSec?: (v: string) => void
  enhancePrompt?: boolean
  setEnhancePrompt?: (v: boolean) => void
  onGenerate: () => void
  isGenerating: boolean
  generateLabel: string
  showGenerateButton?: boolean
  promptLabel?: string
  promptHint?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger><SelectValue placeholder="Load models first" /></SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name || m.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{promptLabel}</Label>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          {promptHint && <p className="text-xs text-muted-foreground">{promptHint}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Resolution</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {resolutions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {durationSec !== undefined && setDurationSec && (
          <div className="space-y-2">
            <Label>Duration (seconds)</Label>
            <Input value={durationSec} onChange={(e) => setDurationSec(e.target.value)} type="number" min={1} step={0.5} />
          </div>
        )}
        {setEnhancePrompt !== undefined && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enhancePrompt}
              onChange={(e) => setEnhancePrompt(e.target.checked)}
            />
            Enhance prompt
          </label>
        )}
        <Button onClick={onGenerate} disabled={isGenerating || !modelId || !showGenerateButton}>
          {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {generateLabel}
        </Button>
        {!showGenerateButton && (
          <p className="text-xs text-muted-foreground">
            Text → video is not used for Character 3. Use the portrait + audio section below.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
