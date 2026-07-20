"use client"

import { useEffect, useState } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  Image as ImageIcon,
  Wand2,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  Sparkles,
  Eraser,
  Maximize2,
  User,
  Music,
  Save,
  ExternalLink,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"

type AspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "21:9"
  | "9:21"
  | "2:3"
  | "3:2"
  | "4:5"
  | "5:4"

type OutputFormat = "png" | "jpeg" | "webp"
type StylePreset =
  | "none"
  | "3d-model"
  | "analog-film"
  | "anime"
  | "cinematic"
  | "comic-book"
  | "digital-art"
  | "enhance"
  | "fantasy-art"
  | "isometric"
  | "line-art"
  | "low-poly"
  | "modeling-compound"
  | "neon-punk"
  | "origami"
  | "photographic"
  | "pixel-art"
  | "tile-texture"

type SdModel = "sd3.5-large" | "sd3.5-large-turbo" | "sd3.5-medium" | "sd3.5-flash"
type AudioOutputFormat = "mp3" | "wav"
type AudioFamily = "2.5" | "3.0"
type AudioMode = "text-to-audio" | "audio-to-audio" | "inpaint"

interface GenerationResult {
  id: string
  endpoint: string
  prompt: string
  kind: "image" | "audio"
  status: "pending" | "processing" | "completed" | "failed"
  imageUrl?: string
  audioUrl?: string
  savedUrl?: string
  savedAssetId?: string
  saving?: boolean
  error?: string
  seed?: string | number
  createdAt: string
  creditsHint?: string
}

const ASPECT_RATIOS: AspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "21:9",
  "9:21",
  "2:3",
  "3:2",
  "4:5",
  "5:4",
]

const STYLE_PRESETS: StylePreset[] = [
  "none",
  "3d-model",
  "analog-film",
  "anime",
  "cinematic",
  "comic-book",
  "digital-art",
  "enhance",
  "fantasy-art",
  "isometric",
  "line-art",
  "low-poly",
  "modeling-compound",
  "neon-punk",
  "origami",
  "photographic",
  "pixel-art",
  "tile-texture",
]

const CREDITS: Record<string, string> = {
  ultra: "8 credits",
  core: "3 credits",
  sd3: "2.5–6.5 credits (by model)",
  "upscale-fast": "2 credits",
  "upscale-conservative": "40 credits",
  "upscale-creative": "60 credits (async)",
  "remove-background": "5 credits",
  "search-and-replace": "5 credits",
  "search-and-recolor": "5 credits",
  outpaint: "4 credits",
  inpaint: "5 credits",
  erase: "5 credits",
  "control-sketch": "5 credits",
  "control-structure": "5 credits",
  "control-style": "5 credits",
  "audio-2-text": "20 credits",
  "audio-2-audio": "20 credits",
  "audio-2-inpaint": "20 credits",
  "audio-3-text": "26 credits (async)",
  "audio-3-audio": "26 credits (async)",
  "audio-3-inpaint": "26 credits (async)",
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function StabilityAiTestPage() {
  const { userId, ready } = useAuthReady()
  const { toast } = useToast()

  const [apiKey, setApiKey] = useState("")
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("generate")
  const [results, setResults] = useState<GenerationResult[]>([])

  // Generate
  const [endpoint, setEndpoint] = useState<"ultra" | "core" | "sd3">("core")
  const [prompt, setPrompt] = useState(
    "Lighthouse on a cliff overlooking the ocean, cinematic lighting, photorealistic"
  )
  const [negativePrompt, setNegativePrompt] = useState("blurry, low quality, distorted")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1")
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png")
  const [stylePreset, setStylePreset] = useState<StylePreset>("cinematic")
  const [seed, setSeed] = useState("0")
  const [sdModel, setSdModel] = useState<SdModel>("sd3.5-large")
  const [cfgScale, setCfgScale] = useState("4")
  const [strength, setStrength] = useState("0.7")
  const [initImage, setInitImage] = useState<File | null>(null)
  const [initPreview, setInitPreview] = useState<string | null>(null)

  // Upscale / Edit
  const [toolImage, setToolImage] = useState<File | null>(null)
  const [toolPreview, setToolPreview] = useState<string | null>(null)
  const [upscaleMode, setUpscaleMode] = useState<"upscale-fast" | "upscale-conservative" | "upscale-creative">(
    "upscale-fast"
  )
  const [editMode, setEditMode] = useState<
    "remove-background" | "search-and-replace" | "search-and-recolor" | "outpaint"
  >("remove-background")
  const [editPrompt, setEditPrompt] = useState("")
  const [searchPrompt, setSearchPrompt] = useState("")
  const [selectPrompt, setSelectPrompt] = useState("")
  const [outpaintLeft, setOutpaintLeft] = useState("0")
  const [outpaintRight, setOutpaintRight] = useState("200")
  const [outpaintUp, setOutpaintUp] = useState("0")
  const [outpaintDown, setOutpaintDown] = useState("200")
  const [creativity, setCreativity] = useState("0.35")

  // Audio
  const [audioFamily, setAudioFamily] = useState<AudioFamily>("2.5")
  const [audioMode, setAudioMode] = useState<AudioMode>("text-to-audio")
  const [audioPrompt, setAudioPrompt] = useState(
    "A cinematic orchestral piece with sweeping strings and dramatic brass, building tension"
  )
  const [audioDuration, setAudioDuration] = useState("30")
  const [audioSteps, setAudioSteps] = useState("8")
  const [audioCfg, setAudioCfg] = useState("1")
  const [audioStrength, setAudioStrength] = useState("0.5")
  const [audioOutputFormat, setAudioOutputFormat] = useState<AudioOutputFormat>("mp3")
  const [audioMaskStart, setAudioMaskStart] = useState("10")
  const [audioMaskEnd, setAudioMaskEnd] = useState("20")
  const [audioInputFile, setAudioInputFile] = useState<File | null>(null)
  const [audioInputPreview, setAudioInputPreview] = useState<string | null>(null)

  // Account
  const [accountInfo, setAccountInfo] = useState<any>(null)
  const [checkingAccount, setCheckingAccount] = useState(false)

  useEffect(() => {
    const loadApiKey = async () => {
      if (!ready || !userId) return
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from("users")
          .select("stability_api_key")
          .eq("id", userId)
          .single()

        if (!error && data?.stability_api_key) {
          setApiKey(data.stability_api_key)
          setApiKeyLoaded(true)
        }
      } catch (error) {
        console.error("Error loading Stability API key:", error)
      }
    }
    loadApiKey()
  }, [ready, userId])

  const saveApiKey = async () => {
    if (!ready || !userId || !apiKey.trim()) return
    setSavingKey(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from("users")
        .update({ stability_api_key: apiKey.trim() })
        .eq("id", userId)

      if (error) throw error
      setApiKeyLoaded(true)
      toast({ title: "Saved", description: "Stability AI API key saved to your account" })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save API key. Run migration 084 if the column is missing.",
        variant: "destructive",
      })
    } finally {
      setSavingKey(false)
    }
  }

  const onFileChange = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    setFile(file)
    if (!file) {
      setPreview(null)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => setPreview((e.target?.result as string) || null)
    reader.readAsDataURL(file)
  }

  const addResult = (partial: Omit<GenerationResult, "id" | "createdAt" | "status"> & { status?: GenerationResult["status"] }) => {
    const item: GenerationResult = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: partial.status || "processing",
      kind: partial.kind || "image",
      ...partial,
    }
    setResults((prev) => [item, ...prev])
    return item.id
  }

  const updateResult = (id: string, patch: Partial<GenerationResult>) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const isAudioEndpoint = (endpointKey: string) => endpointKey.startsWith("audio-")

  const pollAsyncResult = async (
    generationId: string,
    resultId: string,
    kind: "image" | "audio" = "image",
    outputFmt?: string
  ) => {
    const maxAttempts = 36
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(10000)
      const response = await fetch("/api/stability/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          id: generationId,
          kind,
          outputFormat: outputFmt,
        }),
      })

      if (response.status === 202) {
        updateResult(resultId, { status: "processing" })
        continue
      }

      const data = await response.json()
      if (!response.ok) {
        updateResult(resultId, {
          status: "failed",
          error: data.error || "Async generation failed",
        })
        return
      }

      updateResult(resultId, {
        status: "completed",
        kind,
        imageUrl: data.image,
        audioUrl: data.audio,
        seed: data.seed,
      })
      return
    }

    updateResult(resultId, {
      status: "failed",
      error: "Timed out waiting for async result",
    })
  }

  const callStability = async (endpointKey: string, fields: Record<string, string | File | null | undefined>, labelPrompt: string) => {
    if (!apiKey.trim()) {
      toast({
        title: "API key required",
        description: "Enter and save your Stability AI API key first",
        variant: "destructive",
      })
      return
    }

    const kind: "image" | "audio" = isAudioEndpoint(endpointKey) ? "audio" : "image"

    const resultId = addResult({
      endpoint: endpointKey,
      prompt: labelPrompt,
      kind,
      status: "processing",
      creditsHint: CREDITS[endpointKey],
    })

    setLoading(true)
    try {
      const form = new FormData()
      form.append("apiKey", apiKey.trim())
      form.append("endpoint", endpointKey)

      for (const [key, value] of Object.entries(fields)) {
        if (value == null || value === "") continue
        if (typeof value === "string") form.append(key, value)
        else form.append(key, value)
      }

      const response = await fetch("/api/stability/generate", {
        method: "POST",
        body: form,
      })
      const data = await response.json()

      if (!response.ok) {
        updateResult(resultId, {
          status: "failed",
          error: data.error || `Request failed (${response.status})`,
        })
        toast({
          title: "Generation failed",
          description: data.error || `HTTP ${response.status}`,
          variant: "destructive",
        })
        return
      }

      if (data.async && data.id) {
        updateResult(resultId, { status: "processing" })
        toast({
          title: "Started",
          description: "Async job started — polling every 10s",
        })
        await pollAsyncResult(
          data.id,
          resultId,
          kind,
          String(fields.output_format || (kind === "audio" ? "mp3" : "png"))
        )
        return
      }

      updateResult(resultId, {
        status: "completed",
        kind,
        imageUrl: data.image,
        audioUrl: data.audio,
        seed: data.seed,
      })
      toast({ title: "Success", description: `${endpointKey} completed` })
    } catch (error: any) {
      updateResult(resultId, {
        status: "failed",
        error: error?.message || "Unexpected error",
      })
      toast({
        title: "Error",
        description: error?.message || "Unexpected error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Prompt required", variant: "destructive" })
      return
    }

    const fields: Record<string, string | File | null | undefined> = {
      prompt: prompt.trim(),
      output_format: outputFormat,
      aspect_ratio: aspectRatio,
      negative_prompt: negativePrompt.trim() || undefined,
      seed: seed && seed !== "0" ? seed : undefined,
      style_preset: stylePreset !== "none" ? stylePreset : undefined,
    }

    if (endpoint === "sd3") {
      fields.model = sdModel
      fields.cfg_scale = cfgScale
      if (initImage) {
        fields.mode = "image-to-image"
        fields.image = initImage
        fields.strength = strength
        delete fields.aspect_ratio
      } else {
        fields.mode = "text-to-image"
      }
    } else if (endpoint === "ultra" && initImage) {
      fields.image = initImage
      fields.strength = strength
    }

    await callStability(endpoint, fields, prompt.trim())
  }

  const handleUpscale = async () => {
    if (!toolImage) {
      toast({ title: "Image required", description: "Upload an image to upscale", variant: "destructive" })
      return
    }

    const fields: Record<string, string | File | null | undefined> = {
      image: toolImage,
      output_format: outputFormat,
    }

    if (upscaleMode !== "upscale-fast") {
      fields.prompt = editPrompt.trim() || prompt.trim() || "enhance details"
      fields.creativity = creativity
      if (negativePrompt.trim()) fields.negative_prompt = negativePrompt.trim()
    }

    await callStability(upscaleMode, fields, `Upscale (${upscaleMode})`)
  }

  const handleEdit = async () => {
    if (!toolImage) {
      toast({ title: "Image required", description: "Upload an image to edit", variant: "destructive" })
      return
    }

    const fields: Record<string, string | File | null | undefined> = {
      image: toolImage,
      output_format: outputFormat === "jpeg" && editMode === "remove-background" ? "png" : outputFormat,
    }

    if (editMode === "remove-background") {
      await callStability(editMode, fields, "Remove background")
      return
    }

    if (editMode === "search-and-replace") {
      if (!editPrompt.trim() || !searchPrompt.trim()) {
        toast({ title: "prompt and search_prompt required", variant: "destructive" })
        return
      }
      fields.prompt = editPrompt.trim()
      fields.search_prompt = searchPrompt.trim()
      await callStability(editMode, fields, `Replace: ${searchPrompt}`)
      return
    }

    if (editMode === "search-and-recolor") {
      if (!editPrompt.trim() || !selectPrompt.trim()) {
        toast({ title: "prompt and select_prompt required", variant: "destructive" })
        return
      }
      fields.prompt = editPrompt.trim()
      fields.select_prompt = selectPrompt.trim()
      await callStability(editMode, fields, `Recolor: ${selectPrompt}`)
      return
    }

    // outpaint
    fields.left = outpaintLeft
    fields.right = outpaintRight
    fields.up = outpaintUp
    fields.down = outpaintDown
    fields.creativity = creativity
    if (editPrompt.trim()) fields.prompt = editPrompt.trim()
    await callStability("outpaint", fields, "Outpaint")
  }

  const audioEndpointKey = () => {
    const prefix = audioFamily === "3.0" ? "audio-3" : "audio-2"
    if (audioMode === "text-to-audio") return `${prefix}-text`
    if (audioMode === "audio-to-audio") return `${prefix}-audio`
    return `${prefix}-inpaint`
  }

  const handleAudioGenerate = async () => {
    if (!audioPrompt.trim()) {
      toast({ title: "Prompt required", variant: "destructive" })
      return
    }

    if (audioMode !== "text-to-audio" && !audioInputFile) {
      toast({
        title: "Audio file required",
        description: "Upload an mp3 or wav for audio-to-audio / inpaint",
        variant: "destructive",
      })
      return
    }

    const endpointKey = audioEndpointKey()
    const fields: Record<string, string | File | null | undefined> = {
      prompt: audioPrompt.trim(),
      output_format: audioOutputFormat,
      duration: audioDuration,
      steps: audioSteps,
      seed: seed && seed !== "0" ? seed : undefined,
      cfg_scale: audioCfg,
    }

    if (audioFamily === "2.5") {
      fields.model = "stable-audio-2.5"
    } else {
      fields.model = "stable-audio-3"
    }

    if (audioMode !== "text-to-audio") {
      fields.audio = audioInputFile
      if (audioMode === "audio-to-audio") {
        fields.strength = audioStrength
      }
      if (audioMode === "inpaint") {
        fields.mask_start = audioMaskStart
        fields.mask_end = audioMaskEnd
      }
    }

    await callStability(endpointKey, fields, audioPrompt.trim())
  }

  const saveAudioToBucket = async (result: GenerationResult) => {
    if (!result.audioUrl) {
      toast({ title: "No audio to save", variant: "destructive" })
      return
    }
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Sign in to save audio to your cinema_files bucket",
        variant: "destructive",
      })
      return
    }

    updateResult(result.id, { saving: true })
    try {
      const response = await fetch("/api/stability/save-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBlob: result.audioUrl,
          fileName: `stability_${result.endpoint}`,
          audioTitle: `Stability — ${result.endpoint}`,
          userId,
          prompt: result.prompt,
          endpoint: result.endpoint,
          seed: result.seed,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save audio")
      }

      updateResult(result.id, {
        saving: false,
        savedUrl: data.data.publicUrl,
        savedAssetId: data.data.asset?.id,
        // Prefer the bucket URL for playback going forward
        audioUrl: data.data.publicUrl || result.audioUrl,
      })

      toast({
        title: "Saved to bucket",
        description: data.warning || "Audio uploaded to cinema_files",
      })
    } catch (error: any) {
      updateResult(result.id, { saving: false })
      toast({
        title: "Save failed",
        description: error?.message || "Could not save audio to bucket",
        variant: "destructive",
      })
    }
  }

  const checkAccount = async () => {
    if (!apiKey.trim()) {
      toast({ title: "API key required", variant: "destructive" })
      return
    }
    setCheckingAccount(true)
    try {
      const response = await fetch("/api/stability/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast({
          title: "Account check failed",
          description: data.error || `HTTP ${response.status}`,
          variant: "destructive",
        })
        setAccountInfo(null)
        return
      }
      setAccountInfo(data)
      toast({
        title: "Connected",
        description:
          data.balance?.credits != null
            ? `Balance: ${Number(data.balance.credits).toFixed(2)} credits`
            : "Account verified",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to check account",
        variant: "destructive",
      })
    } finally {
      setCheckingAccount(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Stability AI Test</h1>
          <p className="text-muted-foreground">
            Test Stable Image, Stable Audio 2.5/3.0, upscale, and edit. Key is stored on your account.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Also configure under{" "}
            <Link href="/setup-ai" className="underline underline-offset-2">
              Setup AI
            </Link>
            . Docs:{" "}
            <a
              href="https://platform.stability.ai/docs/api-reference"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Stability Platform API
            </a>
          </p>
        </div>

        <Card className="cinema-card mb-6">
          <CardHeader>
            <CardTitle>API Key</CardTitle>
            <CardDescription>
              {apiKeyLoaded
                ? "API key loaded from your account"
                : "Paste your Stability API key (Bearer sk-…)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="password"
                placeholder="sk-…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1"
              />
              <Button onClick={saveApiKey} disabled={!apiKey.trim() || savingKey || !userId}>
                {savingKey ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save to Account
              </Button>
              <Button variant="outline" onClick={checkAccount} disabled={!apiKey.trim() || checkingAccount}>
                {checkingAccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <User className="h-4 w-4 mr-2" />}
                Check Account
              </Button>
            </div>
            {accountInfo && (
              <div className="rounded-md border border-border p-3 text-sm space-y-1">
                {accountInfo.account?.email && <p>Email: {accountInfo.account.email}</p>}
                {accountInfo.account?.id && <p>User ID: {accountInfo.account.id}</p>}
                {accountInfo.balance?.credits != null && (
                  <p>
                    Credits:{" "}
                    <Badge variant="outline">{Number(accountInfo.balance.credits).toFixed(2)}</Badge>
                  </p>
                )}
                {accountInfo.accountError && (
                  <p className="text-destructive">Account error: {JSON.stringify(accountInfo.accountError)}</p>
                )}
                {accountInfo.balanceError && (
                  <p className="text-destructive">Balance error: {JSON.stringify(accountInfo.balanceError)}</p>
                )}
              </div>
            )}
            {!userId && ready && (
              <p className="text-sm text-amber-600">Sign in to save the key to your account.</p>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="generate">
              <Sparkles className="h-4 w-4 mr-2" />
              Image
            </TabsTrigger>
            <TabsTrigger value="audio">
              <Music className="h-4 w-4 mr-2" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="upscale">
              <Maximize2 className="h-4 w-4 mr-2" />
              Upscale
            </TabsTrigger>
            <TabsTrigger value="edit">
              <Eraser className="h-4 w-4 mr-2" />
              Edit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Text-to-Image</CardTitle>
                <CardDescription>
                  Ultra (8 cr) · Core (3 cr) · SD 3.5 (2.5–6.5 cr). Optional image for Ultra / SD3 img2img.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Model</Label>
                    <Select value={endpoint} onValueChange={(v) => setEndpoint(v as typeof endpoint)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">Stable Image Core</SelectItem>
                        <SelectItem value="ultra">Stable Image Ultra</SelectItem>
                        <SelectItem value="sd3">Stable Diffusion 3.5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {endpoint === "sd3" && (
                    <div>
                      <Label>SD 3.5 variant</Label>
                      <Select value={sdModel} onValueChange={(v) => setSdModel(v as SdModel)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sd3.5-large">Large (6.5 cr)</SelectItem>
                          <SelectItem value="sd3.5-large-turbo">Large Turbo (4 cr)</SelectItem>
                          <SelectItem value="sd3.5-medium">Medium (3.5 cr)</SelectItem>
                          <SelectItem value="sd3.5-flash">Flash (2.5 cr)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Aspect ratio</Label>
                    <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Output format</Label>
                    <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="jpeg">JPEG</SelectItem>
                        <SelectItem value="webp">WebP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Style preset</Label>
                    <Select value={stylePreset} onValueChange={(v) => setStylePreset(v as StylePreset)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_PRESETS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Seed (0 = random)</Label>
                    <Input value={seed} onChange={(e) => setSeed(e.target.value)} />
                  </div>
                  {endpoint === "sd3" && (
                    <div>
                      <Label>CFG scale</Label>
                      <Input value={cfgScale} onChange={(e) => setCfgScale(e.target.value)} />
                    </div>
                  )}
                </div>

                <div>
                  <Label>Prompt</Label>
                  <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                </div>
                <div>
                  <Label>Negative prompt</Label>
                  <Textarea rows={2} value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Optional init image (Ultra / SD3 img2img)</Label>
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        onFileChange(e.target.files?.[0] || null, setInitImage, setInitPreview)
                      }
                    />
                    {initPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={initPreview} alt="Init" className="mt-2 max-h-40 rounded border" />
                    )}
                  </div>
                  {(endpoint === "ultra" || endpoint === "sd3") && initImage && (
                    <div>
                      <Label>Strength (0–1)</Label>
                      <Input value={strength} onChange={(e) => setStrength(e.target.value)} />
                    </div>
                  )}
                </div>

                <Button onClick={handleGenerate} disabled={loading || !apiKey.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  Generate ({CREDITS[endpoint]})
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audio" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Stable Audio</CardTitle>
                <CardDescription>
                  2.5 (20 cr, sync) · 3.0 (26 cr, async). Text-to-audio, audio-to-audio, and inpaint.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Model family</Label>
                    <Select value={audioFamily} onValueChange={(v) => setAudioFamily(v as AudioFamily)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2.5">Stable Audio 2.5 (sync, 20 cr)</SelectItem>
                        <SelectItem value="3.0">Stable Audio 3.0 (async, 26 cr)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Select value={audioMode} onValueChange={(v) => setAudioMode(v as AudioMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text-to-audio">Text to audio</SelectItem>
                        <SelectItem value="audio-to-audio">Audio to audio</SelectItem>
                        <SelectItem value="inpaint">Inpaint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duration (seconds)</Label>
                    <Input
                      value={audioDuration}
                      onChange={(e) => setAudioDuration(e.target.value)}
                      placeholder={audioFamily === "3.0" ? "1–380" : "1–190"}
                    />
                  </div>
                  <div>
                    <Label>Steps</Label>
                    <Input
                      value={audioSteps}
                      onChange={(e) => setAudioSteps(e.target.value)}
                      placeholder={audioFamily === "2.5" ? "4–8 for 2.5" : "4–8"}
                    />
                  </div>
                  <div>
                    <Label>CFG scale</Label>
                    <Input value={audioCfg} onChange={(e) => setAudioCfg(e.target.value)} />
                  </div>
                  <div>
                    <Label>Output format</Label>
                    <Select
                      value={audioOutputFormat}
                      onValueChange={(v) => setAudioOutputFormat(v as AudioOutputFormat)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp3">MP3</SelectItem>
                        <SelectItem value="wav">WAV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Seed (0 = random)</Label>
                    <Input value={seed} onChange={(e) => setSeed(e.target.value)} />
                  </div>
                  {audioMode === "audio-to-audio" && (
                    <div>
                      <Label>Strength (0–1)</Label>
                      <Input value={audioStrength} onChange={(e) => setAudioStrength(e.target.value)} />
                    </div>
                  )}
                </div>

                <div>
                  <Label>Prompt</Label>
                  <Textarea rows={3} value={audioPrompt} onChange={(e) => setAudioPrompt(e.target.value)} />
                </div>

                {audioMode !== "text-to-audio" && (
                  <div>
                    <Label>Input audio (mp3 / wav, 6s+)</Label>
                    <Input
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
                      onChange={(e) =>
                        onFileChange(e.target.files?.[0] || null, setAudioInputFile, setAudioInputPreview)
                      }
                    />
                    {audioInputPreview && (
                      <audio controls src={audioInputPreview} className="mt-2 w-full" />
                    )}
                  </div>
                )}

                {audioMode === "inpaint" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Mask start (sec)</Label>
                      <Input value={audioMaskStart} onChange={(e) => setAudioMaskStart(e.target.value)} />
                    </div>
                    <div>
                      <Label>Mask end (sec)</Label>
                      <Input value={audioMaskEnd} onChange={(e) => setAudioMaskEnd(e.target.value)} />
                    </div>
                  </div>
                )}

                <Button onClick={handleAudioGenerate} disabled={loading || !apiKey.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Music className="h-4 w-4 mr-2" />}
                  Generate audio ({CREDITS[audioEndpointKey()]})
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upscale" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Upscale</CardTitle>
                <CardDescription>
                  Fast (2 cr, 4×) · Conservative (40 cr) · Creative async (60 cr)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Mode</Label>
                  <Select value={upscaleMode} onValueChange={(v) => setUpscaleMode(v as typeof upscaleMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upscale-fast">Fast</SelectItem>
                      <SelectItem value="upscale-conservative">Conservative</SelectItem>
                      <SelectItem value="upscale-creative">Creative (async)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Image</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      onFileChange(e.target.files?.[0] || null, setToolImage, setToolPreview)
                    }
                  />
                  {toolPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={toolPreview} alt="Source" className="mt-2 max-h-48 rounded border" />
                  )}
                </div>
                {upscaleMode !== "upscale-fast" && (
                  <>
                    <div>
                      <Label>Prompt</Label>
                      <Textarea
                        rows={2}
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Describe the image"
                      />
                    </div>
                    <div>
                      <Label>Creativity</Label>
                      <Input value={creativity} onChange={(e) => setCreativity(e.target.value)} />
                    </div>
                  </>
                )}
                <Button onClick={handleUpscale} disabled={loading || !apiKey.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
                  Upscale ({CREDITS[upscaleMode]})
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edit" className="space-y-6">
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle>Edit</CardTitle>
                <CardDescription>
                  Remove background, search & replace/recolor, outpaint
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Mode</Label>
                  <Select value={editMode} onValueChange={(v) => setEditMode(v as typeof editMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remove-background">Remove background</SelectItem>
                      <SelectItem value="search-and-replace">Search and replace</SelectItem>
                      <SelectItem value="search-and-recolor">Search and recolor</SelectItem>
                      <SelectItem value="outpaint">Outpaint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Image</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      onFileChange(e.target.files?.[0] || null, setToolImage, setToolPreview)
                    }
                  />
                  {toolPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={toolPreview} alt="Source" className="mt-2 max-h-48 rounded border" />
                  )}
                </div>

                {(editMode === "search-and-replace" ||
                  editMode === "search-and-recolor" ||
                  editMode === "outpaint") && (
                  <div>
                    <Label>Prompt</Label>
                    <Textarea rows={2} value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} />
                  </div>
                )}
                {editMode === "search-and-replace" && (
                  <div>
                    <Label>Search prompt (what to replace)</Label>
                    <Input value={searchPrompt} onChange={(e) => setSearchPrompt(e.target.value)} />
                  </div>
                )}
                {editMode === "search-and-recolor" && (
                  <div>
                    <Label>Select prompt (what to recolor)</Label>
                    <Input value={selectPrompt} onChange={(e) => setSelectPrompt(e.target.value)} />
                  </div>
                )}
                {editMode === "outpaint" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label>Left</Label>
                      <Input value={outpaintLeft} onChange={(e) => setOutpaintLeft(e.target.value)} />
                    </div>
                    <div>
                      <Label>Right</Label>
                      <Input value={outpaintRight} onChange={(e) => setOutpaintRight(e.target.value)} />
                    </div>
                    <div>
                      <Label>Up</Label>
                      <Input value={outpaintUp} onChange={(e) => setOutpaintUp(e.target.value)} />
                    </div>
                    <div>
                      <Label>Down</Label>
                      <Input value={outpaintDown} onChange={(e) => setOutpaintDown(e.target.value)} />
                    </div>
                    <div>
                      <Label>Creativity</Label>
                      <Input value={creativity} onChange={(e) => setCreativity(e.target.value)} />
                    </div>
                  </div>
                )}

                <Button onClick={handleEdit} disabled={loading || !apiKey.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eraser className="h-4 w-4 mr-2" />}
                  Run edit ({CREDITS[editMode === "outpaint" ? "outpaint" : editMode]})
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="cinema-card mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Results</CardTitle>
              <CardDescription>Latest generations from this session</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setResults([])} disabled={results.length === 0}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.status === "completed" && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                        {r.status === "failed" && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        {(r.status === "processing" || r.status === "pending") && (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{r.endpoint}</span>
                      </div>
                      {r.creditsHint && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {r.creditsHint}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.prompt}</p>
                    {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                    {r.audioUrl && (
                      <div className="space-y-2">
                        <audio key={r.audioUrl} controls preload="metadata" src={r.audioUrl} className="w-full" />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const a = document.createElement("a")
                              a.href = r.audioUrl!
                              const ext = r.audioUrl!.includes("audio/wav") || r.audioUrl!.endsWith(".wav") ? "wav" : "mp3"
                              a.download = `stability-${r.endpoint}-${Date.now()}.${ext}`
                              a.click()
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveAudioToBucket(r)}
                            disabled={!!r.saving || !!r.savedUrl || !userId}
                          >
                            {r.saving ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Save className="h-4 w-4 mr-1" />
                            )}
                            {r.savedUrl ? "Saved" : "Save to bucket"}
                          </Button>
                          {r.savedUrl && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={r.savedUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Open
                              </a>
                            </Button>
                          )}
                          {r.seed != null && (
                            <Badge variant="secondary" className="text-xs">
                              seed {r.seed}
                            </Badge>
                          )}
                        </div>
                        {r.savedUrl && (
                          <p className="text-xs text-muted-foreground break-all">
                            Bucket: {r.savedUrl}
                          </p>
                        )}
                      </div>
                    )}
                    {r.imageUrl && (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.imageUrl} alt={r.prompt} className="w-full rounded border" />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const a = document.createElement("a")
                              a.href = r.imageUrl!
                              a.download = `stability-${r.endpoint}-${Date.now()}.png`
                              a.click()
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          {r.seed != null && (
                            <Badge variant="secondary" className="text-xs">
                              seed {r.seed}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {!r.imageUrl && !r.audioUrl && r.status !== "failed" && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                        {r.kind === "audio" ? <Music className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                        Waiting…
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
