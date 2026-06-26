"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { AssetService, type Asset } from "@/lib/asset-service"
import { MovieService, type Movie } from "@/lib/movie-service"
import { TreatmentsService, type Treatment } from "@/lib/treatments-service"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { getSupabaseClient } from "@/lib/supabase"
import { sanitizeFilename } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Type,
  Loader2,
  Sparkles,
  Upload,
  Link2,
  FolderOpen,
  ImageIcon,
  Video,
  Play,
  Download,
  Trash2,
  Star,
  ExternalLink,
  CheckCircle2,
  Wand2,
} from "lucide-react"

type TitleFrame = {
  id: string
  url: string
  assetId?: string
  prompt?: string
  createdAt: string
}

type TitleVideo = {
  id: string
  url?: string
  assetId?: string
  prompt?: string
  model?: string
  createdAt: string
  status: "processing" | "completed" | "failed"
  jobId?: string
}

type TextTitleVariation = {
  id: string
  url: string
  prompt: string
  model: string
}

const VIDEO_GENERATORS = [
  { id: "kling_i2v", label: "Kling Image-to-Video", needsImage: true },
  { id: "runway_gen4_turbo", label: "Runway Gen-4 Turbo", needsImage: true },
  { id: "kling_t2v", label: "Kling Text-to-Video", needsImage: false },
] as const

type VideoGeneratorId = (typeof VIDEO_GENERATORS)[number]["id"]

type TextTitleStyleId = "cinematic" | "scifi" | "epic" | "minimal" | "horror" | "retro"

const TITLE_TEXT_STYLES: {
  id: TextTitleStyleId
  label: string
  description: string
  aiPrompt: string
}[] = [
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Classic white on black",
    aiPrompt: "classic cinematic white serif movie title typography on pure black, soft vignette, subtle film grain, letterbox feel",
  },
  {
    id: "scifi",
    label: "Sci-Fi VFX",
    description: "Neon glow, futuristic",
    aiPrompt: "futuristic sci-fi neon cyan and blue glowing title typography, holographic particles on letters, pure black background, no scenery",
  },
  {
    id: "epic",
    label: "Epic",
    description: "Gold metallic letters",
    aiPrompt: "epic gold metallic 3D movie title letters, lens flare, dramatic scale, black background, typography only",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Clean modern sans",
    aiPrompt: "minimal elegant white sans-serif movie title on pure black, generous letter spacing, no scenery",
  },
  {
    id: "horror",
    label: "Horror",
    description: "Ominous red glow",
    aiPrompt: "horror genre distressed red glowing title text, dark smoke wisps, pure black background, typography only",
  },
  {
    id: "retro",
    label: "Retro 80s",
    description: "Synthwave gradient",
    aiPrompt: "1980s synthwave pink and purple gradient movie title typography, retro neon VFX, black background, text only",
  },
]

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : [text]
}

function renderTitleTextToCanvas(options: {
  mainTitle: string
  subtitle: string
  tagline: string
  styleId: TextTitleStyleId
  width?: number
  height?: number
}): HTMLCanvasElement {
  const { mainTitle, subtitle, tagline, styleId } = options
  const width = options.width ?? 1920
  const height = options.height ?? 1080
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, "#050505")
  bg.addColorStop(1, "#000000")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  if (styleId === "scifi" || styleId === "retro") {
    ctx.strokeStyle = styleId === "retro" ? "rgba(236, 72, 153, 0.15)" : "rgba(34, 211, 238, 0.08)"
    ctx.lineWidth = 1
    for (let y = height * 0.35; y < height; y += 28) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const title = mainTitle.trim() || "UNTITLED"
  const titleSize = Math.min(120, Math.max(48, Math.floor((width / title.length) * 1.8)))
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  const drawTitleLine = (text: string, y: number, size: number) => {
    ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`
    if (styleId === "minimal") {
      ctx.font = `300 ${size}px Helvetica, Arial, sans-serif`
    }

    if (styleId === "scifi") {
      ctx.shadowColor = "rgba(34, 211, 238, 0.9)"
      ctx.shadowBlur = size * 0.35
      ctx.fillStyle = "#a5f3fc"
    } else if (styleId === "epic") {
      const grad = ctx.createLinearGradient(width * 0.3, y - size, width * 0.7, y + size)
      grad.addColorStop(0, "#fde68a")
      grad.addColorStop(0.5, "#fbbf24")
      grad.addColorStop(1, "#b45309")
      ctx.fillStyle = grad
      ctx.shadowColor = "rgba(251, 191, 36, 0.6)"
      ctx.shadowBlur = size * 0.2
    } else if (styleId === "horror") {
      ctx.shadowColor = "rgba(220, 38, 38, 0.85)"
      ctx.shadowBlur = size * 0.4
      ctx.fillStyle = "#fecaca"
    } else if (styleId === "retro") {
      const grad = ctx.createLinearGradient(0, y - size, 0, y + size)
      grad.addColorStop(0, "#f472b6")
      grad.addColorStop(1, "#818cf8")
      ctx.fillStyle = grad
      ctx.shadowColor = "rgba(244, 114, 182, 0.7)"
      ctx.shadowBlur = size * 0.25
    } else if (styleId === "minimal") {
      ctx.fillStyle = "#f8fafc"
      ctx.shadowBlur = 0
    } else {
      ctx.fillStyle = "#ffffff"
      ctx.shadowColor = "rgba(0,0,0,0.8)"
      ctx.shadowBlur = size * 0.15
    }

    const lines = wrapCanvasText(ctx, text.toUpperCase(), width * 0.85)
    const lineHeight = size * 1.15
    const startY = y - ((lines.length - 1) * lineHeight) / 2
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * lineHeight)
    })
    ctx.shadowBlur = 0
  }

  drawTitleLine(title, height * 0.46, titleSize)

  if (subtitle.trim()) {
    ctx.font = `400 ${Math.floor(titleSize * 0.28)}px Helvetica, Arial, sans-serif`
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.fillText(subtitle.trim(), width / 2, height * 0.58)
  }

  if (tagline.trim()) {
    ctx.font = `italic 400 ${Math.floor(titleSize * 0.22)}px Georgia, serif`
    ctx.fillStyle = "rgba(255,255,255,0.45)"
    ctx.fillText(tagline.trim(), width / 2, height * 0.68)
  }

  if (styleId === "cinematic") {
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.fillRect(0, 0, width, height * 0.08)
    ctx.fillRect(0, height * 0.92, width, height * 0.08)
  }

  return canvas
}

function getTextTitlePreviewStyle(styleId: TextTitleStyleId) {
  switch (styleId) {
    case "scifi":
      return {
        title: "text-3xl md:text-5xl font-bold tracking-[0.2em] uppercase text-cyan-300 drop-shadow-[0_0_25px_rgba(34,211,238,0.85)]",
        subtitle: "text-sm md:text-base text-cyan-100/70 tracking-widest uppercase",
        tagline: "text-xs md:text-sm text-cyan-200/40 italic",
        bg: "bg-black bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:100%_28px]",
      }
    case "epic":
      return {
        title: "text-3xl md:text-5xl font-bold uppercase bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]",
        subtitle: "text-sm md:text-base text-amber-100/70 tracking-wide",
        tagline: "text-xs md:text-sm text-amber-200/40 italic",
        bg: "bg-black",
      }
    case "minimal":
      return {
        title: "text-3xl md:text-5xl font-light tracking-[0.35em] uppercase text-white",
        subtitle: "text-sm text-white/60 tracking-[0.2em] uppercase",
        tagline: "text-xs text-white/40 italic tracking-wide",
        bg: "bg-black",
      }
    case "horror":
      return {
        title: "text-3xl md:text-5xl font-bold uppercase text-red-200 drop-shadow-[0_0_30px_rgba(220,38,38,0.9)]",
        subtitle: "text-sm text-red-100/60 tracking-wide",
        tagline: "text-xs text-red-200/35 italic",
        bg: "bg-black",
      }
    case "retro":
      return {
        title: "text-3xl md:text-5xl font-bold uppercase bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(244,114,182,0.6)]",
        subtitle: "text-sm text-pink-200/70 tracking-widest uppercase",
        tagline: "text-xs text-violet-200/40 italic",
        bg: "bg-black bg-[linear-gradient(rgba(236,72,153,0.06)_1px,transparent_1px)] bg-[size:100%_24px]",
      }
    default:
      return {
        title: "text-3xl md:text-5xl font-bold uppercase text-white drop-shadow-lg tracking-wide",
        subtitle: "text-sm text-white/75 tracking-wide",
        tagline: "text-xs text-white/45 italic",
        bg: "bg-black",
      }
  }
}

const RATIO_MAP: Record<string, string> = {
  "1280:720": "16:9",
  "1920:1080": "16:9",
  "1080:1920": "9:16",
  "720:1280": "9:16",
}

async function urlToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Could not load image for video generation")
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || "image/png" })
}

function parseAssetsToFrames(assets: Asset[]): TitleFrame[] {
  return assets
    .filter((a) => a.content_type === "image" && a.content_url && a.metadata?.is_title_frame)
    .map((a) => ({
      id: a.id,
      url: a.content_url!,
      assetId: a.id,
      prompt: a.prompt || undefined,
      createdAt: a.created_at,
    }))
}

function parseAssetsToVideos(assets: Asset[]): TitleVideo[] {
  return assets
    .filter((a) => a.content_type === "video" && a.metadata?.is_title_video)
    .map((a) => ({
      id: a.id,
      url: a.content_url || undefined,
      assetId: a.id,
      prompt: a.prompt || undefined,
      model: a.model || undefined,
      createdAt: a.created_at,
      status: "completed" as const,
    }))
}

export default function CreateTitlesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()

  const initialProjectId = searchParams.get("projectId") || ""

  const [projectId, setProjectId] = useState(initialProjectId)
  const [movie, setMovie] = useState<Movie | null>(null)
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [loading, setLoading] = useState(false)

  const [mainTitle, setMainTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [tagline, setTagline] = useState("")

  const [titleFrames, setTitleFrames] = useState<TitleFrame[]>([])
  const [titleVideos, setTitleVideos] = useState<TitleVideo[]>([])
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [referenceAssets, setReferenceAssets] = useState<Asset[]>([])
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])

  const [imagePrompt, setImagePrompt] = useState("")
  const [importUrl, setImportUrl] = useState("")
  const [videoMotionPrompt, setVideoMotionPrompt] = useState(
    "Cinematic movie title reveal, slow dramatic push-in, subtle light rays and film grain, professional intro sequence",
  )
  const [videoGenerator, setVideoGenerator] = useState<VideoGeneratorId>("kling_i2v")
  const [videoDuration, setVideoDuration] = useState("5")
  const [videoRatio, setVideoRatio] = useState("1280:720")

  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [textTitleStyle, setTextTitleStyle] = useState<TextTitleStyleId>("cinematic")
  const [isSavingTextTitle, setIsSavingTextTitle] = useState(false)
  const [isGeneratingTextTitle, setIsGeneratingTextTitle] = useState(false)
  const [previewTextOnly, setPreviewTextOnly] = useState(true)
  const [textTitleReferenceUrl, setTextTitleReferenceUrl] = useState<string | null>(null)
  const [textTitleRefImportUrl, setTextTitleRefImportUrl] = useState("")
  const [textTitleStylizePrompt, setTextTitleStylizePrompt] = useState("")
  const [textTitleVariationCount, setTextTitleVariationCount] = useState("4")
  const [textTitleVariations, setTextTitleVariations] = useState<TextTitleVariation[]>([])
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null)
  const [isGeneratingTextTitleVariations, setIsGeneratingTextTitleVariations] = useState(false)
  const [isUploadingTextRef, setIsUploadingTextRef] = useState(false)
  const [variationProgress, setVariationProgress] = useState("")

  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [selectedAIService, setSelectedAIService] = useState("dalle")

  const selectedFrame = useMemo(
    () => titleFrames.find((f) => f.id === selectedFrameId) ?? titleFrames[0] ?? null,
    [titleFrames, selectedFrameId],
  )

  const selectedVariation = useMemo(
    () => textTitleVariations.find((v) => v.id === selectedVariationId) ?? null,
    [textTitleVariations, selectedVariationId],
  )

  const previewFrameUrl = selectedVariation?.url ?? selectedFrame?.url ?? null

  const referenceImages = useMemo(() => {
    const urls: string[] = []
    if (treatment?.cover_image_url) urls.push(treatment.cover_image_url)
    for (const a of referenceAssets) {
      if (a.content_url && !urls.includes(a.content_url)) urls.push(a.content_url)
    }
    return urls.slice(0, 20)
  }, [treatment, referenceAssets])

  const getImagesTabSetting = () => aiSettings.find((s) => s.tab_type === "images")
  const isImagesTabLocked = () => getImagesTabSetting()?.is_locked || false
  const getImagesTabLockedModel = () => getImagesTabSetting()?.locked_model || ""

  const mapModelToService = (model: string): string => {
    const lower = model.toLowerCase()
    if (lower.includes("openart")) return "openart"
    if (lower.includes("leonardo")) return "leonardo"
    return "dalle"
  }

  useEffect(() => {
    if (initialProjectId && initialProjectId !== projectId) setProjectId(initialProjectId)
  }, [initialProjectId, projectId])

  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready || !userId) return
      try {
        const settings = await AISettingsService.getSystemSettings()
        const imagesSetting = await AISettingsService.getOrCreateDefaultTabSetting("images")
        const existing = settings.find((s) => s.tab_type === "images")
        const finalSettings = existing ? settings : [...settings, imagesSetting]
        setAiSettings(finalSettings)
        const tab = finalSettings.find((s) => s.tab_type === "images")
        if (tab?.is_locked && tab.locked_model) {
          setSelectedAIService(mapModelToService(tab.locked_model))
        }
      } catch (e) {
        console.error(e)
      }
    }
    loadAISettings()
  }, [ready, userId])

  const loadProjectData = useCallback(async () => {
    if (!projectId || !ready) {
      setMovie(null)
      setTreatment(null)
      setTitleFrames([])
      setTitleVideos([])
      setReferenceAssets([])
      return
    }

    setLoading(true)
    try {
      const movies = await MovieService.getMovies()
      const m = movies.find((x) => x.id === projectId) ?? null
      setMovie(m)

      const t = await TreatmentsService.getTreatmentByProjectId(projectId)
      setTreatment(t)

      setMainTitle(m?.name || t?.title || "")
      setSubtitle(t?.genre ? `${t.genre} · Feature Film` : "")
      setTagline(t?.logline || t?.synopsis?.slice(0, 120) || m?.description?.slice(0, 120) || "")

      const genre = (m?.genre || t?.genre || "").toLowerCase()
      if (genre.includes("sci")) setTextTitleStyle("scifi")
      else if (genre.includes("horror") || genre.includes("thriller")) setTextTitleStyle("horror")
      else if (genre.includes("action") || genre.includes("fantasy")) setTextTitleStyle("epic")

      const assets = await AssetService.getAssetsForProject(projectId)
      setReferenceAssets(assets.filter((a) => a.content_type === "image" && a.content_url))

      const frames = parseAssetsToFrames(assets)
      const videos = parseAssetsToVideos(assets)
      setTitleFrames(frames)
      setTitleVideos(videos)
      setSelectedFrameId(frames[0]?.id ?? null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load project data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, ready, toast])

  useEffect(() => {
    loadProjectData()
  }, [loadProjectData])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    router.replace(`/create-titles?projectId=${id}`, { scroll: false })
  }

  const buildImagePrompt = () => {
    const parts = [
      `Professional cinematic movie title card for "${mainTitle}"`,
      subtitle ? `Subtitle: ${subtitle}` : "",
      tagline ? `Mood: ${tagline}` : "",
      treatment?.genre ? `${treatment.genre} genre` : "",
      "Typography-focused title design, dramatic lighting, no watermark, high quality film poster title screen aesthetic",
    ]
    return parts.filter(Boolean).join(". ")
  }

  const buildTextTitleStylizePrompt = () => {
    const style = TITLE_TEXT_STYLES.find((s) => s.id === textTitleStyle)
    const custom = textTitleStylizePrompt.trim()
    const parts = [
      textTitleReferenceUrl
        ? `@reference Movie title card — typography and text VFX only. Main title: "${mainTitle || "Untitled"}"`
        : `Movie title card — typography and text VFX ONLY on a pure black background. No scenery, no characters.`,
      subtitle.trim() ? `Subtitle: "${subtitle.trim()}"` : "",
      tagline.trim() ? `Mood: ${tagline.trim()}` : "",
      treatment?.genre ? `${treatment.genre} film aesthetic` : "",
      style?.aiPrompt || "",
      custom ||
        (textTitleReferenceUrl
          ? "Stylize the title typography to match the reference image color palette, lighting, mood, and visual aesthetic. Text only on dark background."
          : "Professional Hollywood opening title sequence look, high resolution, centered composition"),
    ]
    return parts.filter(Boolean).join(". ").slice(0, 990)
  }

  const buildTextTitleAiPrompt = () => buildTextTitleStylizePrompt()

  const fillTextTitleStylizePrompt = () => {
    const styleLabel = TITLE_TEXT_STYLES.find((s) => s.id === textTitleStyle)?.label || textTitleStyle
    setTextTitleStylizePrompt(
      textTitleReferenceUrl
        ? `${styleLabel} movie title typography matching the reference image colors and mood — glowing text for "${mainTitle || "Untitled"}"`
        : `${styleLabel} cinematic title typography with dramatic VFX on the letters for "${mainTitle || "Untitled"}"`,
    )
  }

  const uploadTextTitleReferenceFile = async (file: File) => {
    if (!userId || !projectId) return
    setIsUploadingTextRef(true)
    try {
      const ext = file.name.split(".").pop() || "png"
      const filePath = `${userId}/images/title-ref-${projectId}-${Date.now()}.${ext}`
      const supabase = getSupabaseClient()
      const { error } = await supabase.storage.from("cinema_files").upload(filePath, file, {
        contentType: file.type || "image/png",
        upsert: false,
      })
      if (error) throw new Error(error.message)
      const { data: urlData } = supabase.storage.from("cinema_files").getPublicUrl(filePath)
      if (!urlData?.publicUrl) throw new Error("Upload failed")
      setTextTitleReferenceUrl(urlData.publicUrl)
      toast({ title: "Reference added", description: "Style will match this image when generating." })
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload reference.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingTextRef(false)
    }
  }

  const importTextTitleReferenceUrl = async () => {
    const url = textTitleRefImportUrl.trim()
    if (!url.startsWith("http") && !url.startsWith("data:image")) {
      toast({ title: "Invalid URL", variant: "destructive" })
      return
    }
    setIsUploadingTextRef(true)
    try {
      let finalUrl = url
      if (url.startsWith("http") && !url.includes("supabase") && user?.id) {
        finalUrl = await uploadGeneratedImageToStorage(url, `title-ref-import-${Date.now()}`)
      }
      setTextTitleReferenceUrl(finalUrl)
      setTextTitleRefImportUrl("")
      toast({ title: "Reference added" })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import reference URL.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingTextRef(false)
    }
  }

  const generateTextTitleImage = async (prompt: string): Promise<{ url: string; model: string }> => {
    if (!user?.id) throw new Error("Not signed in")

    if (textTitleReferenceUrl) {
      const referenceFile = await urlToFile(textTitleReferenceUrl, `title-style-ref-${Date.now()}.png`)
      const formData = new FormData()
      formData.append("prompt", prompt)
      formData.append("model", "gen4_image_turbo")
      formData.append("service", "runway")
      formData.append("width", "1280")
      formData.append("height", "720")
      formData.append("apiKey", "configured")
      formData.append("userId", user.id)
      formData.append("file", referenceFile)
      formData.append("seed", String(Math.floor(Math.random() * 2147483647)))

      const response = await fetch("/api/ai/generate-image", { method: "POST", body: formData })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Runway generation failed")
      }
      const data = await response.json()
      if (!data.success || !data.imageUrl) throw new Error("Generation failed")
      return { url: data.bucketUrl || data.imageUrl, model: "gen4_image_turbo" }
    }

    const lockedModel = getImagesTabLockedModel()
    const serviceToUse = isImagesTabLocked() && lockedModel ? lockedModel : selectedAIService
    const normalizedModel = lockedModel?.toLowerCase().includes("gpt") ? "gpt-image-1" : "dall-e-3"
    const normalizedService = serviceToUse.toLowerCase().includes("openart")
      ? "openart"
      : serviceToUse.toLowerCase().includes("leonardo")
        ? "leonardo"
        : "dalle"

    const response = await fetch("/api/ai/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        service: normalizedService,
        model: normalizedModel,
        apiKey: "configured",
        userId: user.id,
        autoSaveToBucket: true,
      }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || "Generation failed")
    }
    const data = await response.json()
    let imageUrl = data.imageUrl as string
    if (imageUrl && !imageUrl.includes("supabase")) {
      imageUrl = await uploadGeneratedImageToStorage(imageUrl, `title-text-vfx-${Date.now()}`)
    }
    return { url: imageUrl, model: normalizedModel }
  }

  const uploadCanvasBlob = async (canvas: HTMLCanvasElement, label: string): Promise<string> => {
    if (!userId || !projectId) throw new Error("Not signed in")
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not export title image"))), "image/png")
    })
    const filePath = `${userId}/images/title-text-${projectId}-${Date.now()}.png`
    const supabase = getSupabaseClient()
    const { error } = await supabase.storage.from("cinema_files").upload(filePath, blob, {
      contentType: "image/png",
      upsert: false,
    })
    if (error) throw new Error(error.message)
    const { data: urlData } = supabase.storage.from("cinema_files").getPublicUrl(filePath)
    if (!urlData?.publicUrl) throw new Error("Upload failed")
    return urlData.publicUrl
  }

  const handleSaveTextTitleFrame = async () => {
    if (!mainTitle.trim()) {
      toast({ title: "Enter a main title", variant: "destructive" })
      return
    }
    setIsSavingTextTitle(true)
    try {
      const canvas = renderTitleTextToCanvas({
        mainTitle,
        subtitle,
        tagline,
        styleId: textTitleStyle,
      })
      const url = await uploadCanvasBlob(canvas, textTitleStyle)
      const styleLabel = TITLE_TEXT_STYLES.find((s) => s.id === textTitleStyle)?.label || textTitleStyle
      await saveTitleFrameAsset(url, `Text title (${styleLabel}): ${mainTitle}`, "create_titles_text")
      setPreviewTextOnly(false)
      toast({
        title: "Title frame saved",
        description: "Open the Video tab to animate this title into an intro clip.",
      })
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save title frame.",
        variant: "destructive",
      })
    } finally {
      setIsSavingTextTitle(false)
    }
  }

  const handleGenerateTextTitleVfx = async () => {
    if (!mainTitle.trim() || !user?.id) {
      toast({ title: "Enter a main title", variant: "destructive" })
      return
    }

    setIsGeneratingTextTitle(true)
    try {
      const prompt = buildTextTitleStylizePrompt()
      const { url, model } = await generateTextTitleImage(prompt)
      await saveTitleFrameAsset(url, prompt, "create_titles_text_ai")
      setPreviewTextOnly(false)
      setSelectedVariationId(null)
      toast({
        title: "AI title VFX generated",
        description: textTitleReferenceUrl
          ? "Styled from your reference — saved as a title frame."
          : "Saved as a title frame. Use the Video tab to animate it.",
      })
    } catch (error) {
      toast({
        title: "AI title generation failed",
        description:
          error instanceof Error
            ? error.message.includes("Runway") || error.message.includes("API key")
              ? `${error.message} Add a Runway ML API key for reference-based styling.`
              : error.message
            : "Could not generate title VFX.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingTextTitle(false)
    }
  }

  const handleGenerateTextTitleVariations = async () => {
    if (!mainTitle.trim() || !user?.id) {
      toast({ title: "Enter a main title", variant: "destructive" })
      return
    }

    const count = Math.min(6, Math.max(2, parseInt(textTitleVariationCount, 10) || 4))
    setIsGeneratingTextTitleVariations(true)
    setTextTitleVariations([])
    setSelectedVariationId(null)

    const generated: TextTitleVariation[] = []
    try {
      for (let i = 0; i < count; i++) {
        setVariationProgress(`Generating option ${i + 1} of ${count}…`)
        const prompt = buildTextTitleStylizePrompt()
        const { url, model } = await generateTextTitleImage(prompt)
        const variation: TextTitleVariation = {
          id: `var-${Date.now()}-${i}`,
          url,
          prompt,
          model,
        }
        generated.push(variation)
        setTextTitleVariations([...generated])
      }
      if (generated[0]) {
        setSelectedVariationId(generated[0].id)
        setPreviewTextOnly(false)
      }
      toast({
        title: `${count} title options ready`,
        description: "Pick your favorite below, then save it as a title frame.",
      })
    } catch (error) {
      if (generated.length > 0) {
        setTextTitleVariations(generated)
        setSelectedVariationId(generated[0].id)
        setPreviewTextOnly(false)
      }
      toast({
        title: generated.length > 0 ? "Partial generation" : "Generation failed",
        description:
          error instanceof Error
            ? generated.length > 0
              ? `${generated.length} options created before an error: ${error.message}`
              : error.message
            : "Could not generate title options.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingTextTitleVariations(false)
      setVariationProgress("")
    }
  }

  const handleSaveSelectedVariation = async () => {
    const variation = textTitleVariations.find((v) => v.id === selectedVariationId)
    if (!variation) {
      toast({ title: "Select an option first", variant: "destructive" })
      return
    }
    try {
      await saveTitleFrameAsset(variation.url, variation.prompt, "create_titles_text_ai")
      setPreviewTextOnly(false)
      toast({
        title: "Title frame saved",
        description: "Open the Video tab to animate this into an intro clip.",
      })
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save title frame.",
        variant: "destructive",
      })
    }
  }

  const textPreviewStyle = getTextTitlePreviewStyle(textTitleStyle)

  const uploadGeneratedImageToStorage = async (imageUrl: string, fileName: string): Promise<string> => {
    const response = await fetch("/api/ai/download-and-store-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, fileName, userId: user!.id }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || "Failed to store image")
    }
    const result = await response.json()
    if (!result.success || !result.supabaseUrl) throw new Error("Failed to store image")
    return result.supabaseUrl
  }

  const saveTitleFrameAsset = async (contentUrl: string, prompt: string, source: string) => {
    if (!projectId) throw new Error("No project")
    const created = await AssetService.createAsset({
      project_id: projectId,
      treatment_id: treatment?.id ?? null,
      scene_id: null,
      title: `Title Frame - ${mainTitle || "Untitled"} - ${new Date().toLocaleDateString()}`,
      content_type: "image",
      content: "",
      content_url: contentUrl,
      prompt,
      model: selectedAIService,
      metadata: {
        source,
        is_title_frame: true,
        movie_title: mainTitle,
        subtitle,
        tagline,
      },
    })
    const frame: TitleFrame = {
      id: created.id,
      url: contentUrl,
      assetId: created.id,
      prompt,
      createdAt: created.created_at,
    }
    setTitleFrames((prev) => [frame, ...prev])
    setSelectedFrameId(frame.id)
    return frame
  }

  const saveTitleVideoAsset = async (contentUrl: string, prompt: string, model: string) => {
    if (!projectId || !userId) throw new Error("No project")
    const created = await AssetService.createAsset({
      project_id: projectId,
      treatment_id: treatment?.id ?? null,
      scene_id: null,
      title: `Title Intro Video - ${mainTitle || "Untitled"} - ${new Date().toLocaleDateString()}`,
      content_type: "video",
      content: "",
      content_url: contentUrl,
      prompt,
      model,
      metadata: {
        source: "create_titles_page",
        is_title_video: true,
        movie_title: mainTitle,
        frame_asset_id: selectedFrame?.assetId,
      },
    })
    const video: TitleVideo = {
      id: created.id,
      url: contentUrl,
      assetId: created.id,
      prompt,
      model,
      createdAt: created.created_at,
      status: "completed",
    }
    setTitleVideos((prev) => [video, ...prev])
    return video
  }

  const handleGenerateImages = async () => {
    const prompt = imagePrompt.trim() || buildImagePrompt()
    if (!prompt || !user?.id) return

    const lockedModel = getImagesTabLockedModel()
    const serviceToUse = isImagesTabLocked() && lockedModel ? lockedModel : selectedAIService
    const normalizedModel =
      lockedModel?.toLowerCase().includes("gpt") ? "gpt-image-1" : "dall-e-3"
    const normalizedService = serviceToUse.toLowerCase().includes("openart")
      ? "openart"
      : serviceToUse.toLowerCase().includes("leonardo")
        ? "leonardo"
        : "dalle"

    const referenceUrls = selectedReferenceIds
      .map((id) => referenceAssets.find((a) => a.id === id)?.content_url)
      .filter(Boolean) as string[]

    setIsGeneratingImage(true)
    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.slice(0, 990),
          service: normalizedService,
          model: normalizedModel,
          apiKey: "configured",
          userId: user.id,
          autoSaveToBucket: true,
          referenceImages: referenceUrls.length > 0 ? referenceUrls : undefined,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Generation failed")
      }
      const data = await response.json()
      let imageUrl = data.imageUrl as string
      if (imageUrl && !imageUrl.includes("supabase")) {
        imageUrl = await uploadGeneratedImageToStorage(imageUrl, `title-frame-${Date.now()}`)
      }
      await saveTitleFrameAsset(imageUrl, prompt, "create_titles_ai")
      toast({ title: "Title frame generated", description: "Added to your title variations." })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate title frame.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return
    setIsImporting(true)
    try {
      let url = importUrl.trim()
      if (!url.startsWith("http") && !url.startsWith("data:image")) {
        throw new Error("Enter a valid image URL")
      }
      if (url.startsWith("http") && !url.includes("supabase")) {
        url = await uploadGeneratedImageToStorage(url, `title-import-${Date.now()}`)
      }
      await saveTitleFrameAsset(url, "Imported reference", "create_titles_url_import")
      setImportUrl("")
      toast({ title: "Reference imported", description: "Added as a title frame option." })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import image.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!projectId || !userId) return
    setIsUploading(true)
    try {
      const ext = file.name.split(".").pop() || "png"
      const filePath = `${userId}/images/title-${projectId}-${Date.now()}.${ext}`
      const supabase = getSupabaseClient()
      const { error } = await supabase.storage.from("cinema_files").upload(filePath, file, {
        contentType: file.type || "image/png",
        upsert: false,
      })
      if (error) throw new Error(error.message)
      const { data: urlData } = supabase.storage.from("cinema_files").getPublicUrl(filePath)
      if (!urlData?.publicUrl) throw new Error("Upload failed")
      await saveTitleFrameAsset(urlData.publicUrl, `Upload: ${sanitizeFilename(file.name)}`, "create_titles_upload")
      toast({ title: "Uploaded", description: "Reference added to title frames." })
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload file.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const pollRunwayJob = (jobId: string, placeholderId: string) => {
    let attempts = 0
    const poll = async () => {
      attempts++
      try {
        const res = await fetch("/api/ai/check-video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        })
        if (res.ok) {
          const result = await res.json()
          const url = result.data?.url
          const status = result.data?.status
          if (url && (status === "completed" || status === "SUCCEEDED")) {
            const stored = await fetch("/api/ai/download-and-store-video", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                videoUrl: url,
                fileName: `title-intro-${Date.now()}`,
                userId: user!.id,
              }),
            })
            const storedData = await stored.json()
            const finalUrl = storedData.supabaseUrl || url
            await saveTitleVideoAsset(finalUrl, videoMotionPrompt, "runway_gen4_turbo")
            setTitleVideos((prev) => prev.filter((v) => v.id !== placeholderId))
            toast({ title: "Title video ready", description: "Intro video saved to your project." })
            setIsGeneratingVideo(false)
            return
          }
          if (status === "failed" || status === "FAILED") {
            setTitleVideos((prev) =>
              prev.map((v) => (v.id === placeholderId ? { ...v, status: "failed" } : v)),
            )
            toast({ title: "Video failed", variant: "destructive" })
            setIsGeneratingVideo(false)
            return
          }
        }
        if (attempts < 90) setTimeout(poll, 3000)
        else {
          toast({ title: "Video timed out", description: "Check back later or try again.", variant: "destructive" })
          setIsGeneratingVideo(false)
        }
      } catch {
        if (attempts < 90) setTimeout(poll, 3000)
        else setIsGeneratingVideo(false)
      }
    }
    poll()
  }

  const handleGenerateVideo = async () => {
    const gen = VIDEO_GENERATORS.find((g) => g.id === videoGenerator)!
    if (gen.needsImage && !selectedFrame?.url) {
      toast({ title: "Select a title frame", description: "Pick or generate a title image first.", variant: "destructive" })
      return
    }

    const motionPrompt = [
      videoMotionPrompt,
      mainTitle ? `Movie title: "${mainTitle}"` : "",
      tagline ? `Mood: ${tagline}` : "",
    ]
      .filter(Boolean)
      .join(". ")

    setIsGeneratingVideo(true)
    const placeholderId = `pending-${Date.now()}`
    setTitleVideos((prev) => [
      {
        id: placeholderId,
        prompt: motionPrompt,
        model: videoGenerator,
        createdAt: new Date().toISOString(),
        status: "processing",
      },
      ...prev,
    ])

    try {
      if (videoGenerator === "kling_i2v" || videoGenerator === "kling_t2v") {
        const formData = new FormData()
        formData.append("prompt", motionPrompt)
        formData.append("model", videoGenerator === "kling_i2v" ? "kling_i2v" : "kling_t2v")
        formData.append("duration", videoDuration)
        formData.append("ratio", RATIO_MAP[videoRatio] || "16:9")
        if (videoGenerator === "kling_i2v" && selectedFrame?.url) {
          const file = await urlToFile(selectedFrame.url, "title-frame.png")
          formData.append("file", file)
        }

        const res = await fetch("/api/kling/generate", { method: "POST", body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Kling generation failed")

        const videoUrl = data.data?.url
        if (!videoUrl) throw new Error("No video URL returned")

        const stored = await fetch("/api/ai/download-and-store-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl,
            fileName: `title-intro-kling-${Date.now()}`,
            userId: user!.id,
          }),
        })
        const storedData = await stored.json()
        await saveTitleVideoAsset(storedData.supabaseUrl || videoUrl, motionPrompt, videoGenerator)
        setTitleVideos((prev) => prev.filter((v) => v.id !== placeholderId))
        toast({ title: "Title video created", description: "Intro video saved to your project." })
        setIsGeneratingVideo(false)
        return
      }

      if (videoGenerator === "runway_gen4_turbo") {
        const imageFile = await urlToFile(selectedFrame!.url, "title-frame.png")
        const uploadForm = new FormData()
        uploadForm.append("file", imageFile)
        const uploadRes = await fetch("/api/ai/upload-to-runway", { method: "POST", body: uploadForm })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok || !uploadData.runwayUri) {
          throw new Error(uploadData.error || "Failed to upload frame to Runway")
        }

        const [w, h] = videoRatio.split(":").map(Number)
        const videoRes = await fetch("/api/ai/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: motionPrompt,
            duration: `${videoDuration}s`,
            width: w || 1280,
            height: h || 720,
            model: "gen4_turbo",
            runwayUri: uploadData.runwayUri,
            fileType: uploadData.fileType || "image",
          }),
        })
        const videoData = await videoRes.json()
        if (!videoRes.ok || !videoData.success) {
          throw new Error(videoData.error || "Runway generation failed")
        }

        if (videoData.data?.jobId) {
          setTitleVideos((prev) =>
            prev.map((v) =>
              v.id === placeholderId ? { ...v, jobId: videoData.data.jobId, status: "processing" } : v,
            ),
          )
          pollRunwayJob(videoData.data.jobId, placeholderId)
          toast({ title: "Video rendering", description: "Runway is generating your title intro…" })
          return
        }

        const directUrl = videoData.data?.url || videoData.data?.output?.url
        if (directUrl) {
          const stored = await fetch("/api/ai/download-and-store-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl: directUrl,
              fileName: `title-intro-runway-${Date.now()}`,
              userId: user!.id,
            }),
          })
          const storedData = await stored.json()
          await saveTitleVideoAsset(storedData.supabaseUrl || directUrl, motionPrompt, "runway_gen4_turbo")
          setTitleVideos((prev) => prev.filter((v) => v.id !== placeholderId))
          toast({ title: "Title video created", description: "Intro video saved to your project." })
        }
        setIsGeneratingVideo(false)
      }
    } catch (error) {
      setTitleVideos((prev) => prev.filter((v) => v.id !== placeholderId))
      toast({
        title: "Video generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
      setIsGeneratingVideo(false)
    }
  }

  const toggleReference = (id: string) => {
    setSelectedReferenceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev,
    )
  }

  const deleteFrame = async (frame: TitleFrame) => {
    if (!confirm("Remove this title frame?")) return
    try {
      if (frame.assetId) await AssetService.deleteAsset(frame.assetId)
      setTitleFrames((prev) => prev.filter((f) => f.id !== frame.id))
      if (selectedFrameId === frame.id) setSelectedFrameId(titleFrames[0]?.id ?? null)
    } catch {
      toast({ title: "Delete failed", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Type className="h-8 w-8" />
            Create Titles
          </h1>
          <p className="text-muted-foreground">
            Style text-only movie title cards, save them as frames, then animate into an intro video.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Project</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectSelector selectedProject={projectId} onProjectChange={handleProjectChange} />
            {movie && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{movie.genre || treatment?.genre || "Film"}</Badge>
                {treatment && (
                  <Link href={`/viewmovie/${treatment.id}`} className="text-primary underline inline-flex items-center gap-1">
                    View treatment <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {!projectId ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Type className="h-12 w-12 mx-auto mb-4 opacity-40" />
              Select a project to start building title intros.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Title copy</CardTitle>
                  <CardDescription>Used in prompts and on-screen typography.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Main title</Label>
                    <Input className="mt-1 text-lg font-semibold" value={mainTitle} onChange={(e) => setMainTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label>Subtitle / credit line</Label>
                    <Input className="mt-1" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="A Film by…" />
                  </div>
                  <div>
                    <Label>Tagline / mood</Label>
                    <Input className="mt-1" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Logline or tone" />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setImagePrompt(buildImagePrompt())}>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Fill image prompt from project
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg">Preview</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={previewTextOnly ? "default" : "outline"}
                      onClick={() => setPreviewTextOnly(true)}
                    >
                      Text
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!previewTextOnly && previewFrameUrl ? "default" : "outline"}
                      onClick={() => {
                        if (previewFrameUrl) setPreviewTextOnly(false)
                      }}
                      disabled={!previewFrameUrl}
                    >
                      Frame
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`relative aspect-video rounded-lg overflow-hidden border ${previewTextOnly ? textPreviewStyle.bg : "bg-black"}`}>
                    {!previewTextOnly && previewFrameUrl ? (
                      <img src={previewFrameUrl} alt="Title frame" className="w-full h-full object-contain bg-black" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                        <p className={textPreviewStyle.title}>{mainTitle || "YOUR TITLE"}</p>
                        {subtitle && <p className={`${textPreviewStyle.subtitle} mt-3`}>{subtitle}</p>}
                        {tagline && <p className={`${textPreviewStyle.tagline} mt-4 max-w-lg`}>{tagline}</p>}
                        {!mainTitle && (
                          <p className="text-xs text-muted-foreground mt-6">Enter title copy above to preview</p>
                        )}
                      </div>
                    )}
                  </div>
                  {titleFrames.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-4">
                      {titleFrames.map((frame) => (
                        <button
                          key={frame.id}
                          type="button"
                          onClick={() => {
                            setSelectedFrameId(frame.id)
                            setSelectedVariationId(null)
                            setPreviewTextOnly(false)
                          }}
                          className={`relative aspect-video rounded-md overflow-hidden border-2 ${
                            selectedFrameId === frame.id && !selectedVariationId && !previewTextOnly
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border"
                          }`}
                        >
                          <img src={frame.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {titleVideos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Title videos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {titleVideos.map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{v.model || "Video"}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.status === "processing" ? "Rendering…" : new Date(v.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {v.status === "completed" && v.url && (
                            <>
                              <Button size="sm" variant="outline" asChild>
                                <a href={v.url} target="_blank" rel="noreferrer">
                                  <Play className="h-3 w-3" />
                                </a>
                              </Button>
                              <Button size="sm" variant="outline" asChild>
                                <a href={v.url} download>
                                  <Download className="h-3 w-3" />
                                </a>
                              </Button>
                            </>
                          )}
                          {v.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Tabs defaultValue="text">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="text">Text Title</TabsTrigger>
                  <TabsTrigger value="generate">AI Frames</TabsTrigger>
                  <TabsTrigger value="import">Import</TabsTrigger>
                  <TabsTrigger value="video">Video</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        Text-only title card
                      </CardTitle>
                      <CardDescription>
                        Movie-style typography on black — pick a look, save it, then animate in the Video tab.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        {TITLE_TEXT_STYLES.map((style) => (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => setTextTitleStyle(style.id)}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              textTitleStyle === style.id
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <p className="text-sm font-medium">{style.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{style.description}</p>
                          </button>
                        ))}
                      </div>
                      <Separator />

                      <div className="space-y-3">
                        <Label className="text-sm">Style reference (optional)</Label>
                        <p className="text-xs text-muted-foreground">
                          Add an image to match its colors, mood, and aesthetic. Uses Runway Gen-4 Image Turbo when a reference is set.
                        </p>
                        {textTitleReferenceUrl ? (
                          <div className="relative aspect-video rounded-lg overflow-hidden border bg-black">
                            <img src={textTitleReferenceUrl} alt="Style reference" className="w-full h-full object-cover" />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="absolute top-2 right-2"
                              onClick={() => setTextTitleReferenceUrl(null)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingTextRef}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) void uploadTextTitleReferenceFile(f)
                              }}
                            />
                            <div className="flex gap-2">
                              <Input
                                type="url"
                                placeholder="Or paste image URL…"
                                value={textTitleRefImportUrl}
                                onChange={(e) => setTextTitleRefImportUrl(e.target.value)}
                                disabled={isUploadingTextRef}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isUploadingTextRef || !textTitleRefImportUrl.trim()}
                                onClick={() => void importTextTitleReferenceUrl()}
                              >
                                {isUploadingTextRef ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                              </Button>
                            </div>
                            {referenceAssets.length > 0 && (
                              <div className="grid grid-cols-4 gap-2 max-h-24 overflow-y-auto">
                                {referenceAssets.slice(0, 12).map((asset) => (
                                  <button
                                    key={asset.id}
                                    type="button"
                                    onClick={() => asset.content_url && setTextTitleReferenceUrl(asset.content_url)}
                                    className="aspect-square rounded border overflow-hidden hover:border-primary/60"
                                  >
                                    <img src={asset.content_url || ""} alt="" className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="text-title-stylize-prompt">Describe the title look</Label>
                          <Button type="button" variant="ghost" size="sm" onClick={fillTextTitleStylizePrompt}>
                            <Wand2 className="h-3 w-3 mr-1" />
                            Fill
                          </Button>
                        </div>
                        <Textarea
                          id="text-title-stylize-prompt"
                          rows={3}
                          value={textTitleStylizePrompt}
                          onChange={(e) => setTextTitleStylizePrompt(e.target.value)}
                          placeholder='e.g., neon cyan glow like the reference, distressed metal letters, slow-burn horror red mist behind text…'
                          disabled={isGeneratingTextTitleVariations || isGeneratingTextTitle}
                        />
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Options to generate</Label>
                            <Select value={textTitleVariationCount} onValueChange={setTextTitleVariationCount}>
                              <SelectTrigger className="bg-input border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2">2 options</SelectItem>
                                <SelectItem value="4">4 options</SelectItem>
                                <SelectItem value="6">6 options</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            className="flex-1"
                            onClick={() => void handleGenerateTextTitleVariations()}
                            disabled={isGeneratingTextTitleVariations || !mainTitle.trim()}
                          >
                            {isGeneratingTextTitleVariations ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Generate options
                          </Button>
                        </div>
                        {variationProgress && (
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {variationProgress}
                          </p>
                        )}
                      </div>

                      {textTitleVariations.length > 0 && (
                        <div className="space-y-2">
                          <Label>Pick an option</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {textTitleVariations.map((v, i) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  setSelectedVariationId(v.id)
                                  setPreviewTextOnly(false)
                                }}
                                className={`relative aspect-video rounded-lg overflow-hidden border-2 ${
                                  selectedVariationId === v.id
                                    ? "border-primary ring-2 ring-primary/30"
                                    : "border-border hover:border-primary/40"
                                }`}
                              >
                                <img src={v.url} alt={`Option ${i + 1}`} className="w-full h-full object-cover" />
                                <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                  {i + 1}
                                </span>
                              </button>
                            ))}
                          </div>
                          <Button
                            className="w-full"
                            variant="secondary"
                            onClick={() => void handleSaveSelectedVariation()}
                            disabled={!selectedVariationId}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Save selected as title frame
                          </Button>
                        </div>
                      )}

                      <Separator />
                      <div className="flex flex-col gap-2">
                        <Button
                          className="w-full"
                          onClick={() => void handleSaveTextTitleFrame()}
                          disabled={isSavingTextTitle || !mainTitle.trim()}
                        >
                          {isSavingTextTitle ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Save as title frame
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => void handleGenerateTextTitleVfx()}
                          disabled={isGeneratingTextTitle || !mainTitle.trim()}
                        >
                          {isGeneratingTextTitle ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Generate AI VFX title
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Save is instant (free). Generate options uses{" "}
                          {textTitleReferenceUrl
                            ? "Runway Gen-4 Image Turbo (reference)"
                            : `your locked image model (${getImagesTabLockedModel() || "DALL-E 3"})`}
                          .
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="generate" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Generate title frames
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        rows={4}
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        placeholder="Describe the title card look…"
                        disabled={isGeneratingImage}
                      />
                      {referenceImages.length > 0 && (
                        <>
                          <Label className="text-xs text-muted-foreground">Style references (up to 4)</Label>
                          <div className="grid grid-cols-4 gap-2 max-h-28 overflow-y-auto">
                            {referenceAssets.slice(0, 12).map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={() => toggleReference(asset.id)}
                                className={`aspect-square rounded border-2 overflow-hidden ${
                                  selectedReferenceIds.includes(asset.id) ? "border-primary" : "border-border"
                                }`}
                              >
                                <img src={asset.content_url || ""} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <Button className="w-full" onClick={() => void handleGenerateImages()} disabled={isGeneratingImage}>
                        {isGeneratingImage ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Generate variation
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="import" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload reference
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void handleFileUpload(f)
                        }}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Import URL
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        type="url"
                        placeholder="https://…"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                      />
                      <Button className="w-full" onClick={() => void handleImportUrl()} disabled={isImporting}>
                        Import
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        From project assets
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                        {referenceAssets.slice(0, 15).map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            disabled={isImporting}
                            onClick={async () => {
                              if (!asset.content_url) return
                              setIsImporting(true)
                              try {
                                await saveTitleFrameAsset(asset.content_url, `From asset: ${asset.title}`, "create_titles_asset_ref")
                                toast({ title: "Added from assets" })
                              } finally {
                                setIsImporting(false)
                              }
                            }}
                            className="aspect-video rounded overflow-hidden border hover:border-primary/60"
                          >
                            <img src={asset.content_url || ""} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="video" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Animate title intro
                      </CardTitle>
                      <CardDescription>
                        Turn your saved title frame into a cinematic intro clip (slow reveal, light rays, etc.).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Video generator</Label>
                        <Select value={videoGenerator} onValueChange={(v) => setVideoGenerator(v as VideoGeneratorId)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VIDEO_GENERATORS.map((g) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Duration</Label>
                          <Select value={videoDuration} onValueChange={setVideoDuration}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 sec</SelectItem>
                              <SelectItem value="10">10 sec</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Aspect ratio</Label>
                          <Select value={videoRatio} onValueChange={setVideoRatio}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1280:720">16:9</SelectItem>
                              <SelectItem value="1080:1920">9:16</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Motion / animation prompt</Label>
                        <Textarea
                          className="mt-1"
                          rows={3}
                          value={videoMotionPrompt}
                          onChange={(e) => setVideoMotionPrompt(e.target.value)}
                        />
                      </div>
                      {!selectedFrame && videoGenerator !== "kling_t2v" && (
                        <p className="text-xs text-amber-600">Select a title frame above before generating video.</p>
                      )}
                      <Button
                        className="w-full"
                        onClick={() => void handleGenerateVideo()}
                        disabled={isGeneratingVideo}
                      >
                        {isGeneratingVideo ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Video className="h-4 w-4 mr-2" />
                        )}
                        Create title video
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {selectedFrame && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => void deleteFrame(selectedFrame)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete frame
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
