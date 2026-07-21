"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Header from "@/components/header"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseClient } from "@/lib/supabase"
import { KlingService } from "@/lib/ai-services"
import {
  KLING_3_UI_MODELS,
  KLING_V3_DURATIONS,
  getKlingModelConfig,
  isKlingOmniModel,
  type Kling3UiModel,
  type KlingApiMode,
} from "@/lib/kling-models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  KeyRound,
  Video,
  Download,
  ExternalLink,
  CheckCircle2,
  Save,
  Eye,
  EyeOff,
  Play,
  Film,
  Volume2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react"

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 Landscape" },
  { value: "9:16", label: "9:16 Portrait" },
  { value: "1:1", label: "1:1 Square" },
] as const

type AspectRatio = (typeof ASPECT_RATIOS)[number]["value"]

type KlingJob = {
  id: string
  uiModel: string
  prompt: string
  status: "processing" | "completed" | "failed"
  videoUrl?: string
  taskId?: string
  mode?: KlingApiMode
  duration: number
  ratio: AspectRatio
  sound: boolean
  createdAt: number
  error?: string
  pollAttempt?: number
}

function ratioToResolution(ratio: AspectRatio): string {
  if (ratio === "9:16") return "720:1280"
  if (ratio === "1:1") return "960:960"
  return "1280:720"
}

function useFilePreview(file: File | null) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return preview
}

export default function KlingAiTestPage() {
  const { ready, userId } = useAuthReady()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("generate")

  const [accessKey, setAccessKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [showAccessKey, setShowAccessKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [isSavingKeys, setIsSavingKeys] = useState(false)
  const [isTestingKeys, setIsTestingKeys] = useState(false)
  const [serverReady, setServerReady] = useState<boolean | null>(null)

  const [uiModel, setUiModel] = useState<Kling3UiModel>("Kling 3.0 T2V")
  const [prompt, setPrompt] = useState(
    "Cinematic aerial shot over misty pine forest at dawn, slow push-in, golden light through fog",
  )
  const [duration, setDuration] = useState<number>(8)
  const [ratio, setRatio] = useState<AspectRatio>("16:9")
  const [nativeAudio, setNativeAudio] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [startFrame, setStartFrame] = useState<File | null>(null)
  const [endFrame, setEndFrame] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobs, setJobs] = useState<KlingJob[]>([])

  const imagePreview = useFilePreview(imageFile)
  const startPreview = useFilePreview(startFrame)
  const endPreview = useFilePreview(endFrame)

  const modelConfig = useMemo(() => getKlingModelConfig(uiModel), [uiModel])

  const loadKeys = useCallback(async () => {
    if (!userId) return
    try {
      const { data, error } = await getSupabaseClient()
        .from("users")
        .select("kling_api_key, kling_secret_key")
        .eq("id", userId)
        .maybeSingle()
      if (error) throw error
      if (data?.kling_api_key) setAccessKey(data.kling_api_key)
      if (data?.kling_secret_key) setSecretKey(data.kling_secret_key)
    } catch (error) {
      console.error("Failed to load Kling keys:", error)
    }
  }, [userId])

  useEffect(() => {
    if (ready && userId) void loadKeys()
  }, [ready, userId, loadKeys])

  const saveKeys = async () => {
    if (!userId) return
    setIsSavingKeys(true)
    try {
      const { error } = await getSupabaseClient()
        .from("users")
        .update({
          kling_api_key: accessKey.trim() || null,
          kling_secret_key: secretKey.trim() || null,
        })
        .eq("id", userId)
      if (error) throw error
      toast({ title: "Keys saved", description: "Kling access + secret keys saved to your profile." })
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save keys",
        variant: "destructive",
      })
    } finally {
      setIsSavingKeys(false)
    }
  }

  const testServerConnection = async () => {
    setIsTestingKeys(true)
    setServerReady(null)
    try {
      const result = await KlingService.testApiConnection("")
      if (result.success) {
        setServerReady(true)
        toast({
          title: "Server connection OK",
          description: "Kling API accepted a test request via /api/kling/generate.",
        })
      } else {
        setServerReady(false)
        toast({
          title: "Connection failed",
          description: result.error || `HTTP ${result.status ?? "error"}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      setServerReady(false)
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsTestingKeys(false)
    }
  }

  const updateJob = (id: string, patch: Partial<KlingJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }

  const pollJob = async (jobId: string, taskId: string, mode: KlingApiMode) => {
    try {
      const { url } = await KlingService.pollTaskUntilComplete(taskId, mode, {
        maxAttempts: 120,
        intervalMs: 5000,
        onProgress: (attempt) => {
          updateJob(jobId, { pollAttempt: attempt, status: "processing" })
        },
      })
      updateJob(jobId, { status: "completed", videoUrl: url })
      toast({ title: "Video ready", description: "Kling generation completed." })
    } catch (error) {
      updateJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Polling failed",
      })
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Enter a prompt", variant: "destructive" })
      return
    }
    if (!modelConfig) {
      toast({ title: "Invalid model", variant: "destructive" })
      return
    }
    if (modelConfig.needsStartEnd && (!startFrame || !endFrame)) {
      toast({
        title: "Start and end frames required",
        description: `${uiModel} needs both a first and last frame image.`,
        variant: "destructive",
      })
      return
    }
    if (modelConfig.needsImage && !modelConfig.needsStartEnd && !imageFile) {
      toast({
        title: "Image required",
        description: `${uiModel} needs a reference image.`,
        variant: "destructive",
      })
      return
    }

    const jobId = crypto.randomUUID()
    const job: KlingJob = {
      id: jobId,
      uiModel,
      prompt: prompt.trim(),
      status: "processing",
      duration,
      ratio,
      sound: nativeAudio,
      createdAt: Date.now(),
      mode: modelConfig.apiMode,
    }
    setJobs((prev) => [job, ...prev])
    setIsGenerating(true)

    try {
      const response = await KlingService.generateVideo({
        prompt: prompt.trim(),
        model: uiModel,
        duration: String(duration),
        resolution: ratioToResolution(ratio),
        klingNativeAudio: nativeAudio,
        file: imageFile || undefined,
        startFrame: startFrame || undefined,
        endFrame: endFrame || undefined,
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || "Generation failed")
      }

      const url = (response.data.url || response.data.video_url) as string | undefined
      const taskId = response.data.taskId as string | undefined
      const mode = (response.data.mode || modelConfig.apiMode) as KlingApiMode

      if (url) {
        updateJob(jobId, { status: "completed", videoUrl: url, taskId, mode })
        toast({ title: "Video ready", description: "Completed during server poll." })
        return
      }

      if (taskId) {
        updateJob(jobId, { taskId, mode })
        toast({
          title: "Job submitted",
          description: `Task ${taskId.slice(0, 12)}… — polling for result.`,
        })
        void pollJob(jobId, taskId, mode)
        return
      }

      throw new Error("No video URL or task ID returned")
    } catch (error) {
      updateJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Generation failed",
      })
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-5xl px-6 py-12 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kling AI Test</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Test Kling 3.0 and Omni video generation — text-to-video, image-to-video, start/end frames, native
              audio, and up to 15s clips. Uses the same{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/kling</code> routes as Cinema Production.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/setup-ai">
              <KeyRound className="h-4 w-4 mr-2" />
              Setup AI
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Supported models</CardTitle>
            <CardDescription>Kling 3.0 (Singapore API) — all modes available in Cinema Production</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {KLING_3_UI_MODELS.map((model) => {
                const cfg = getKlingModelConfig(model)
                return (
                  <Badge key={model} variant={model === uiModel ? "default" : "secondary"} className="text-xs">
                    {model}
                    {cfg?.needsStartEnd ? " · frames" : cfg?.needsImage ? " · image" : " · text"}
                    {isKlingOmniModel(model) ? " · omni" : ""}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="install">Install &amp; Keys</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="results">
              Results
              {jobs.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                  {jobs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="install" className="space-y-4 mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Server credentials:</strong> <code>/api/kling/generate</code> signs requests with{" "}
                <code>KLING_ACCESS_KEY</code> + <code>KLING_SECRET_KEY</code> from your server{" "}
                <code>.env</code>. Save profile keys below for reference — they are used by some legacy routes but
                generation on this page goes through the server env pair (same as Cinema Production).
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-5 w-5" />
                  API keys
                </CardTitle>
                <CardDescription>
                  Get keys from{" "}
                  <a
                    href="https://klingai.com/global/dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    klingai.com/global/dev
                  </a>{" "}
                  — you need both Access Key and Secret Key.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Access Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showAccessKey ? "text" : "password"}
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value)}
                      placeholder="ak_…"
                      className="font-mono text-sm"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowAccessKey((v) => !v)}>
                      {showAccessKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showSecretKey ? "text" : "password"}
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="sk_…"
                      className="font-mono text-sm"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowSecretKey((v) => !v)}>
                      {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void saveKeys()} disabled={isSavingKeys || !userId}>
                    {isSavingKeys ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save to profile
                  </Button>
                  <Button variant="outline" onClick={() => void testServerConnection()} disabled={isTestingKeys}>
                    {isTestingKeys ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Test server connection
                  </Button>
                </div>
                {serverReady === true && (
                  <p className="text-sm text-green-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Server can reach Kling API
                  </p>
                )}
                {serverReady === false && (
                  <p className="text-sm text-destructive">
                    Server test failed — confirm <code>KLING_ACCESS_KEY</code> and <code>KLING_SECRET_KEY</code> are in{" "}
                    <code>.env</code> and restart the dev server.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">API endpoints used</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1 font-mono">
                <p>POST https://api-singapore.klingai.com/v1/videos/text2video</p>
                <p>POST https://api-singapore.klingai.com/v1/videos/image2video</p>
                <p>POST https://api-singapore.klingai.com/v1/videos/omni-video</p>
                <p className="text-xs pt-2 font-sans">
                  Models: <code>kling-v3</code> (standard) · <code>kling-v3-omni</code> (Omni) · mode: pro · duration
                  3–15s
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generate" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate video
                </CardTitle>
                <CardDescription>
                  Pick a model — the form adapts for text, image, or start/end frame inputs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={uiModel} onValueChange={(v) => setUiModel(v as Kling3UiModel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KLING_3_UI_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {modelConfig && (
                    <p className="text-xs text-muted-foreground">
                      API: {modelConfig.apiMode} · {modelConfig.modelName}
                      {modelConfig.needsStartEnd
                        ? " · requires start + end frame images"
                        : modelConfig.needsImage
                          ? " · requires one reference image"
                          : " · text prompt only"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="Describe the motion, camera, and scene…"
                  />
                </div>

                {modelConfig?.needsImage && !modelConfig.needsStartEnd && (
                  <div className="space-y-2">
                    <Label>Reference image</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                    {imagePreview && (
                      <img src={imagePreview} alt="Reference" className="h-32 w-auto rounded-md border object-cover" />
                    )}
                  </div>
                )}

                {modelConfig?.needsStartEnd && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start frame</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setStartFrame(e.target.files?.[0] || null)}
                      />
                      {startPreview && (
                        <img src={startPreview} alt="Start" className="h-28 w-full rounded-md border object-cover" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>End frame</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setEndFrame(e.target.files?.[0] || null)}
                      />
                      {endPreview && (
                        <img src={endPreview} alt="End" className="h-28 w-full rounded-md border object-cover" />
                      )}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v, 10))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KLING_V3_DURATIONS.map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d}s
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Aspect ratio</Label>
                    <Select value={ratio} onValueChange={(v) => setRatio(v as AspectRatio)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Native audio</Label>
                    <Button
                      type="button"
                      variant={nativeAudio ? "default" : "outline"}
                      className="w-full justify-start gap-2"
                      onClick={() => setNativeAudio((v) => !v)}
                    >
                      <Volume2 className="h-4 w-4" />
                      {nativeAudio ? "Sound on" : "Sound off"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <Button className="w-full" onClick={() => void handleGenerate()} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Generate with {uiModel}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-4 mt-4">
            {jobs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Film className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No generations yet. Run a test from the Generate tab.</p>
                </CardContent>
              </Card>
            ) : (
              jobs.map((job) => (
                <Card key={job.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <CardTitle className="text-sm font-medium line-clamp-1">{job.prompt}</CardTitle>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {job.uiModel}
                        </Badge>
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "default"
                              : job.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {job.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          <Clock className="h-3 w-3 mr-0.5" />
                          {job.duration}s
                        </Badge>
                        {job.sound && (
                          <Badge variant="outline" className="text-[10px]">
                            <Volume2 className="h-3 w-3 mr-0.5" />
                            audio
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      {new Date(job.createdAt).toLocaleString()}
                      {job.taskId ? ` · task ${job.taskId.slice(0, 16)}…` : ""}
                      {job.pollAttempt ? ` · poll ${job.pollAttempt}/120` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {job.status === "processing" && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating — Kling jobs often take 2–10 minutes.
                      </div>
                    )}
                    {job.status === "failed" && job.error && (
                      <p className="text-sm text-destructive">{job.error}</p>
                    )}
                    {job.status === "completed" && job.videoUrl && (
                      <>
                        <video src={job.videoUrl} controls className="w-full max-w-lg rounded-lg border" />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <a href={job.videoUrl} download={`kling-${job.id}.mp4`}>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={job.videoUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open
                            </a>
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
