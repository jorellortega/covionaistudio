"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Header from "@/components/header"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseClient } from "@/lib/supabase"
import type { MireloEndpoint, MireloVersion } from "@/lib/mirelo-config"
import { V16_ONLY_ENDPOINTS } from "@/lib/mirelo-config"
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
  KeyRound,
  Music,
  Video,
  Download,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Save,
  Eye,
  EyeOff,
  ArrowRight,
  Scissors,
  List,
  CreditCard,
} from "lucide-react"

type PreflightResult = { credits: number; estimated_ms: number }
type AccountInfo = { id: string; email: string; credits_available: number; overage_enabled: boolean }
type RequestMode = "sync" | "async"

type GenerationResult = {
  id: string
  label: string
  endpoint: string
  resultUrls: string[]
  outputType?: "audio" | "video"
  createdAt: number
}

type AsyncJob = {
  id: string
  jobId: string
  endpoint: MireloEndpoint
  version: MireloVersion
  label: string
  status: string
  progressPercent?: number
  resultUrls?: string[]
  error?: string
  createdAt: number
}

function apiKeyQuery(apiKey: string) {
  return apiKey.trim() ? `&apiKey=${encodeURIComponent(apiKey.trim())}` : ""
}

async function uploadFileToSupabase(file: File, folder: string): Promise<string> {
  const { data: { user } } = await getSupabaseClient().auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^\w.\-() ]/g, "_")
  const filePath = `${user.id}/mirelo-test/${folder}/${timestamp}_${safeName}`

  const { error } = await getSupabaseClient().storage
    .from("cinema_files")
    .upload(filePath, file, { cacheControl: "3600", upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: urlData } = getSupabaseClient().storage.from("cinema_files").getPublicUrl(filePath)
  return urlData.publicUrl
}

export default function MireloAiTestPage() {
  const { ready, userId } = useAuthReady()
  const { toast } = useToast()

  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [isCheckingKey, setIsCheckingKey] = useState(false)
  const [activeTab, setActiveTab] = useState("install")

  const [modelVersion, setModelVersion] = useState<MireloVersion>("v1.6")
  const [requestMode, setRequestMode] = useState<RequestMode>("sync")

  const [textPrompt, setTextPrompt] = useState("Heavy rain on a metal roof with distant thunder")
  const [textDurationSec, setTextDurationSec] = useState("8")
  const [textLoop, setTextLoop] = useState(false)
  const [textSamples, setTextSamples] = useState("1")

  const [videoUrl, setVideoUrl] = useState("")
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [videoDurationSec, setVideoDurationSec] = useState("5")
  const [videoStartOffsetSec, setVideoStartOffsetSec] = useState("0")
  const [videoOutput, setVideoOutput] = useState<"audio" | "video">("audio")
  const [videoSamples, setVideoSamples] = useState("1")

  const [extendWithVideo, setExtendWithVideo] = useState(false)
  const [extendAudioUrl, setExtendAudioUrl] = useState("")
  const [extendAudioFile, setExtendAudioFile] = useState<File | null>(null)
  const [extendVideoUrl, setExtendVideoUrl] = useState("")
  const [extendVideoFile, setExtendVideoFile] = useState<File | null>(null)
  const [extendAppendSec, setExtendAppendSec] = useState("5")
  const [extendPrompt, setExtendPrompt] = useState("Continue the rolling thunder fading into silence")
  const [extendLoop, setExtendLoop] = useState(false)
  const [extendSamples, setExtendSamples] = useState("1")

  const [inpaintWithVideo, setInpaintWithVideo] = useState(false)
  const [inpaintAudioUrl, setInpaintAudioUrl] = useState("")
  const [inpaintAudioFile, setInpaintAudioFile] = useState<File | null>(null)
  const [inpaintVideoUrl, setInpaintVideoUrl] = useState("")
  const [inpaintVideoFile, setInpaintVideoFile] = useState<File | null>(null)
  const [inpaintStartSec, setInpaintStartSec] = useState("2")
  const [inpaintEndSec, setInpaintEndSec] = useState("4")
  const [inpaintPrompt, setInpaintPrompt] = useState("A door slamming shut")
  const [inpaintSamples, setInpaintSamples] = useState("1")

  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [isPreflighting, setIsPreflighting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [results, setResults] = useState<GenerationResult[]>([])
  const [jobs, setJobs] = useState<AsyncJob[]>([])

  const loadSavedKey = useCallback(async () => {
    if (!userId) return
    try {
      const { data, error } = await getSupabaseClient()
        .from("users")
        .select("mirelo_api_key")
        .eq("id", userId)
        .single()
      if (error) throw error
      if (data?.mirelo_api_key) setApiKey(data.mirelo_api_key)
    } catch (error) {
      console.error("Failed to load Mirelo API key:", error)
    }
  }, [userId])

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/mirelo?action=me${apiKeyQuery(apiKey)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load account")
      setAccount(data.account as AccountInfo)
    } catch {
      setAccount(null)
    }
  }, [apiKey])

  useEffect(() => {
    if (!ready) return
    void loadSavedKey()
    fetch("/api/mirelo?action=key-check")
      .then((r) => r.json())
      .then((data) => setHasServerKey(!data.error?.includes("No Mirelo API key")))
      .catch(() => setHasServerKey(false))
  }, [ready, loadSavedKey])

  useEffect(() => {
    if (!ready || (!apiKey.trim() && !hasServerKey)) return
    void loadAccount()
  }, [ready, apiKey, hasServerKey, loadAccount])

  const saveApiKey = async () => {
    if (!userId) return
    setIsSavingKey(true)
    try {
      const { error } = await getSupabaseClient()
        .from("users")
        .update({ mirelo_api_key: apiKey.trim() || null })
        .eq("id", userId)
      if (error) throw error
      setHasServerKey(!!apiKey.trim())
      toast({ title: "API key saved" })
      void loadAccount()
    } catch (error) {
      toast({
        title: "Failed to save key",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsSavingKey(false)
    }
  }

  const checkApiKey = async () => {
    if (!apiKey.trim() && hasServerKey === false) {
      toast({ title: "API key required", variant: "destructive" })
      return
    }
    setIsCheckingKey(true)
    try {
      const res = await fetch(`/api/mirelo?action=key-check${apiKeyQuery(apiKey)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Key check failed")
      setHasServerKey(true)
      void loadAccount()
      toast({ title: "Mirelo connected" })
    } catch (error) {
      toast({
        title: "Key check failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsCheckingKey(false)
    }
  }

  const resolveMediaUrl = async (url: string, file: File | null, folder: string): Promise<string> => {
    if (url.trim()) return url.trim()
    if (!file) throw new Error("Provide a URL or upload a file")
    setIsUploading(true)
    try {
      return await uploadFileToSupabase(file, folder)
    } finally {
      setIsUploading(false)
    }
  }

  const runPreflight = async (
    endpoint: MireloEndpoint,
    extraParams?: Record<string, string>,
  ) => {
    setIsPreflighting(true)
    setPreflight(null)
    try {
      const version = V16_ONLY_ENDPOINTS.has(endpoint) ? "v1.6" : modelVersion
      const params = new URLSearchParams({
        action: "preflight",
        endpoint,
        version,
        num_samples: "1",
        ...extraParams,
      })
      const res = await fetch(`/api/mirelo?${params.toString()}${apiKeyQuery(apiKey)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Preflight failed")
      setPreflight(data.preflight as PreflightResult)
    } catch (error) {
      toast({
        title: "Preflight failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsPreflighting(false)
    }
  }

  const handleGenerationResponse = (
    data: Record<string, unknown>,
    label: string,
    endpoint: string,
    outputType?: "audio" | "video",
  ) => {
    if (requestMode === "async" && typeof data.job_id === "string") {
      const job: AsyncJob = {
        id: crypto.randomUUID(),
        jobId: data.job_id,
        endpoint: endpoint as MireloEndpoint,
        version: V16_ONLY_ENDPOINTS.has(endpoint as MireloEndpoint) ? "v1.6" : modelVersion,
        label,
        status: "processing",
        createdAt: Date.now(),
      }
      setJobs((prev) => [job, ...prev])
      toast({ title: "Job submitted", description: `Job ${data.job_id.slice(0, 8)}…` })
      void pollJob(job.id, data.job_id, endpoint as MireloEndpoint, job.version)
      return
    }

    const urls = Array.isArray(data.result_urls) ? (data.result_urls as string[]) : []
    setResults((prev) => [
      { id: crypto.randomUUID(), label, endpoint, resultUrls: urls, outputType, createdAt: Date.now() },
      ...prev,
    ])
    toast({ title: "Done", description: `${urls.length} file(s) ready.` })
  }

  const pollJob = async (localId: string, jobId: string, endpoint: MireloEndpoint, version: MireloVersion) => {
    const maxAttempts = 120
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const params = new URLSearchParams({
          action: "job-status",
          endpoint,
          version,
          jobId,
        })
        const res = await fetch(`/api/mirelo?${params.toString()}${apiKeyQuery(apiKey)}`)
        const data = await res.json()
        if (!res.ok) continue

        const job = data.job as {
          status?: string
          progress_percent?: number
          result?: { result_urls?: string[] }
          error?: { message?: string }
        }

        setJobs((prev) =>
          prev.map((j) =>
            j.id === localId
              ? {
                  ...j,
                  status: job.status || "processing",
                  progressPercent: job.progress_percent,
                  resultUrls: job.result?.result_urls,
                  error: job.error?.message,
                }
              : j,
          ),
        )

        if (job.status === "succeeded") {
          const urls = job.result?.result_urls || []
          setResults((prev) => [
            {
              id: crypto.randomUUID(),
              label: `Async: ${endpoint}`,
              endpoint,
              resultUrls: urls,
              createdAt: Date.now(),
            },
            ...prev,
          ])
          return
        }
        if (job.status === "errored") return
      } catch {
        /* retry */
      }
    }
    setJobs((prev) => prev.map((j) => (j.id === localId ? { ...j, status: "timeout" } : j)))
  }

  const postAction = async (action: string, body: Record<string, unknown>) => {
    setIsGenerating(true)
    try {
      const res = await fetch("/api/mirelo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, action, mode: requestMode, apiKey: apiKey.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      return data as Record<string, unknown>
    } finally {
      setIsGenerating(false)
    }
  }

  const generateTextToSfx = async () => {
    if (!textPrompt.trim()) {
      toast({ title: "Enter a prompt", variant: "destructive" })
      return
    }
    try {
      const data = await postAction("text-to-sfx", {
        version: modelVersion,
        prompt: textPrompt.trim(),
        duration_ms: Math.round(parseFloat(textDurationSec || "8") * 1000),
        loop: textLoop,
        num_samples: parseInt(textSamples, 10) || 1,
      })
      handleGenerationResponse(data, textPrompt.slice(0, 60), "text-to-sfx")
    } catch (error) {
      toast({
        title: "Text-to-SFX failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const generateVideoToSfx = async () => {
    try {
      const resolvedUrl = await resolveMediaUrl(videoUrl, videoFile, "video")
      if (!videoUrl.trim() && videoFile) setVideoUrl(resolvedUrl)
      const data = await postAction("video-to-sfx", {
        version: modelVersion,
        video_url: resolvedUrl,
        duration_ms: Math.round(parseFloat(videoDurationSec || "5") * 1000),
        start_offset_ms: Math.round(parseFloat(videoStartOffsetSec || "0") * 1000),
        output: videoOutput,
        num_samples: parseInt(videoSamples, 10) || 1,
      })
      handleGenerationResponse(data, `Video → SFX (${videoOutput})`, "video-to-sfx", videoOutput)
    } catch (error) {
      toast({
        title: "Video-to-SFX failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const generateExtend = async () => {
    try {
      const audioUrl = await resolveMediaUrl(extendAudioUrl, extendAudioFile, "audio")
      const body: Record<string, unknown> = {
        audio_url: audioUrl,
        append_duration_ms: Math.round(parseFloat(extendAppendSec || "5") * 1000),
        num_samples: parseInt(extendSamples, 10) || 1,
        loop: extendLoop,
      }
      if (extendPrompt.trim()) body.prompt = extendPrompt.trim()

      if (extendWithVideo) {
        const videoResolved = await resolveMediaUrl(extendVideoUrl, extendVideoFile, "video")
        body.video_url = videoResolved
      }

      const action = extendWithVideo ? "extend-audio-with-video" : "extend-audio"
      const data = await postAction(action, body)
      handleGenerationResponse(data, extendWithVideo ? "Extend (with video)" : "Extend audio", action)
    } catch (error) {
      toast({
        title: "Extend failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const generateInpaint = async () => {
    try {
      const audioUrl = await resolveMediaUrl(inpaintAudioUrl, inpaintAudioFile, "audio")
      const body: Record<string, unknown> = {
        audio_url: audioUrl,
        start_ms: Math.round(parseFloat(inpaintStartSec || "2") * 1000),
        end_ms: Math.round(parseFloat(inpaintEndSec || "4") * 1000),
        num_samples: parseInt(inpaintSamples, 10) || 1,
      }
      if (inpaintPrompt.trim()) body.prompt = inpaintPrompt.trim()

      if (inpaintWithVideo) {
        const videoResolved = await resolveMediaUrl(inpaintVideoUrl, inpaintVideoFile, "video")
        body.video_url = videoResolved
      }

      const action = inpaintWithVideo ? "inpaint-audio-with-video" : "inpaint-audio"
      const data = await postAction(action, body)
      handleGenerationResponse(data, inpaintWithVideo ? "Inpaint (with video)" : "Inpaint audio", action)
    } catch (error) {
      toast({
        title: "Inpaint failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mirelo AI Test</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Full Mirelo SFX API — text/video generation, extend, inpaint, sync &amp; async.{" "}
              <a href="https://mirelo.ai/api-docs" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                API docs
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {account && (
              <Badge variant="outline" className="gap-1">
                <CreditCard className="h-3 w-3" />
                {account.credits_available.toLocaleString()} credits
              </Badge>
            )}
            <Badge variant={hasServerKey ? "default" : "secondary"}>
              {hasServerKey === null ? "Checking…" : hasServerKey ? "Key OK" : "No key"}
            </Badge>
          </div>
        </div>

        <GlobalOptions
          modelVersion={modelVersion}
          setModelVersion={setModelVersion}
          requestMode={requestMode}
          setRequestMode={setRequestMode}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full h-auto flex-wrap gap-1">
            <TabsTrigger value="install"><KeyRound className="h-4 w-4 mr-1" />Install</TabsTrigger>
            <TabsTrigger value="text"><Music className="h-4 w-4 mr-1" />Text</TabsTrigger>
            <TabsTrigger value="video"><Video className="h-4 w-4 mr-1" />Video</TabsTrigger>
            <TabsTrigger value="extend"><ArrowRight className="h-4 w-4 mr-1" />Extend</TabsTrigger>
            <TabsTrigger value="inpaint"><Scissors className="h-4 w-4 mr-1" />Inpaint</TabsTrigger>
            <TabsTrigger value="jobs"><List className="h-4 w-4 mr-1" />Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="install" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Mirelo API key</CardTitle>
                <CardDescription>
                  Get a key from <a href="https://mirelo.ai" target="_blank" rel="noreferrer" className="underline">mirelo.ai</a>
                  {" "}or save in <Link href="/setup-ai" className="underline">Setup AI</Link>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <KeyInput apiKey={apiKey} setApiKey={setApiKey} showKey={showKey} setShowKey={setShowKey} />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void saveApiKey()} disabled={isSavingKey || !userId}>
                    {isSavingKey ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save key
                  </Button>
                  <Button variant="outline" onClick={() => void checkApiKey()} disabled={isCheckingKey}>
                    {isCheckingKey ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Test connection
                  </Button>
                  <Button variant="outline" onClick={() => void loadAccount()}>
                    Refresh credits
                  </Button>
                </div>
                {account && (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                    <p><strong>Email:</strong> {account.email}</p>
                    <p><strong>Credits:</strong> {account.credits_available.toLocaleString()}</p>
                    <p><strong>Overage:</strong> {account.overage_enabled ? "Enabled" : "Disabled"}</p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Available endpoints</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Text → SFX &amp; Video → SFX (v1.5 &amp; v1.6)</li>
                    <li>Extend Audio — audio only or with video (v1.6)</li>
                    <li>Inpaint Audio — audio only or with video (v1.6)</li>
                    <li>Sync (wait up to 60s) or Async (submit job + poll)</li>
                    <li>Preflight cost estimates before generating</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="text" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Text → SFX</CardTitle>
                <CardDescription>
                  <code>POST /v2/text-to-sfx/{modelVersion}/sync</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <Textarea value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <NumField label="Duration (s)" value={textDurationSec} onChange={setTextDurationSec} min={1} max={600} step={0.5} />
                  <SamplesField value={textSamples} onChange={setTextSamples} />
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm pb-2">
                      <input type="checkbox" checked={textLoop} onChange={(e) => setTextLoop(e.target.checked)} />
                      Seamless loop
                    </label>
                  </div>
                </div>
                {preflight && activeTab === "text" && <PreflightBadge preflight={preflight} />}
                <ActionButtons
                  isPreflighting={isPreflighting}
                  isGenerating={isGenerating || isUploading}
                  onPreflight={() =>
                    void runPreflight("text-to-sfx", {
                      duration_ms: String(Math.round(parseFloat(textDurationSec || "8") * 1000)),
                      num_samples: textSamples,
                    })
                  }
                  onGenerate={() => void generateTextToSfx()}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="video" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Video → SFX</CardTitle>
                <CardDescription>
                  <code>POST /v2/video-to-sfx/{modelVersion}/sync</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MediaInput
                  label="Video URL"
                  url={videoUrl}
                  onUrlChange={(v) => { setVideoUrl(v); setVideoFile(null) }}
                  file={videoFile}
                  onFileChange={(f) => {
                    setVideoFile(f)
                    setVideoUrl("")
                    if (videoPreview) URL.revokeObjectURL(videoPreview)
                    setVideoPreview(f ? URL.createObjectURL(f) : null)
                  }}
                  accept="video/*"
                  preview={videoPreview}
                  previewType="video"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <NumField label="Duration (s)" value={videoDurationSec} onChange={setVideoDurationSec} min={1} max={600} />
                  <NumField label="Start offset (s)" value={videoStartOffsetSec} onChange={setVideoStartOffsetSec} min={0} />
                  <div className="space-y-2">
                    <Label>Output</Label>
                    <Select value={videoOutput} onValueChange={(v) => setVideoOutput(v as "audio" | "video")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="audio">Audio only</SelectItem>
                        <SelectItem value="video">Video + SFX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <SamplesField value={videoSamples} onChange={setVideoSamples} />
                </div>
                {preflight && activeTab === "video" && <PreflightBadge preflight={preflight} />}
                <ActionButtons
                  isPreflighting={isPreflighting}
                  isGenerating={isGenerating || isUploading}
                  generateDisabled={!videoUrl.trim() && !videoFile}
                  onPreflight={() =>
                    void runPreflight("video-to-sfx", {
                      duration_ms: String(Math.round(parseFloat(videoDurationSec || "5") * 1000)),
                      num_samples: videoSamples,
                    })
                  }
                  onGenerate={() => void generateVideoToSfx()}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="extend" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Extend Audio</CardTitle>
                <CardDescription>
                  Extend an existing clip — v1.6 only. Optionally condition on matching video.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button size="sm" variant={!extendWithVideo ? "default" : "outline"} onClick={() => setExtendWithVideo(false)}>
                    Audio only
                  </Button>
                  <Button size="sm" variant={extendWithVideo ? "default" : "outline"} onClick={() => setExtendWithVideo(true)}>
                    With video
                  </Button>
                </div>
                <MediaInput
                  label="Audio prefix (3–59s)"
                  url={extendAudioUrl}
                  onUrlChange={setExtendAudioUrl}
                  file={extendAudioFile}
                  onFileChange={setExtendAudioFile}
                  accept="audio/*"
                />
                {extendWithVideo && (
                  <MediaInput
                    label="Matching video"
                    url={extendVideoUrl}
                    onUrlChange={setExtendVideoUrl}
                    file={extendVideoFile}
                    onFileChange={setExtendVideoFile}
                    accept="video/*"
                  />
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NumField label="Append duration (s)" value={extendAppendSec} onChange={setExtendAppendSec} min={1} max={57} />
                  <SamplesField value={extendSamples} onChange={setExtendSamples} />
                  {!extendWithVideo && (
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm pb-2">
                        <input type="checkbox" checked={extendLoop} onChange={(e) => setExtendLoop(e.target.checked)} />
                        Seamless loop
                      </label>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Prompt (optional)</Label>
                  <Input value={extendPrompt} onChange={(e) => setExtendPrompt(e.target.value)} />
                </div>
                {preflight && activeTab === "extend" && <PreflightBadge preflight={preflight} />}
                <ActionButtons
                  isPreflighting={isPreflighting}
                  isGenerating={isGenerating || isUploading}
                  generateDisabled={!extendAudioUrl.trim() && !extendAudioFile}
                  onPreflight={() =>
                    void runPreflight(extendWithVideo ? "extend-audio-with-video" : "extend-audio", {
                      append_duration_ms: String(Math.round(parseFloat(extendAppendSec || "5") * 1000)),
                      num_samples: extendSamples,
                    })
                  }
                  onGenerate={() => void generateExtend()}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inpaint" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inpaint Audio</CardTitle>
                <CardDescription>
                  Replace a segment (1–8s gap) inside an audio clip — v1.6 only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button size="sm" variant={!inpaintWithVideo ? "default" : "outline"} onClick={() => setInpaintWithVideo(false)}>
                    Audio only
                  </Button>
                  <Button size="sm" variant={inpaintWithVideo ? "default" : "outline"} onClick={() => setInpaintWithVideo(true)}>
                    With video
                  </Button>
                </div>
                <MediaInput
                  label="Source audio (≤10s)"
                  url={inpaintAudioUrl}
                  onUrlChange={setInpaintAudioUrl}
                  file={inpaintAudioFile}
                  onFileChange={setInpaintAudioFile}
                  accept="audio/*"
                />
                {inpaintWithVideo && (
                  <MediaInput
                    label="Matching video"
                    url={inpaintVideoUrl}
                    onUrlChange={setInpaintVideoUrl}
                    file={inpaintVideoFile}
                    onFileChange={setInpaintVideoFile}
                    accept="video/*"
                  />
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <NumField label="Gap start (s)" value={inpaintStartSec} onChange={setInpaintStartSec} min={1} max={9} step={0.1} />
                  <NumField label="Gap end (s)" value={inpaintEndSec} onChange={setInpaintEndSec} min={2} max={10} step={0.1} />
                  <SamplesField value={inpaintSamples} onChange={setInpaintSamples} />
                </div>
                <div className="space-y-2">
                  <Label>Prompt (optional)</Label>
                  <Input value={inpaintPrompt} onChange={(e) => setInpaintPrompt(e.target.value)} />
                </div>
                <ActionButtons
                  isPreflighting={isPreflighting}
                  isGenerating={isGenerating || isUploading}
                  generateDisabled={!inpaintAudioUrl.trim() && !inpaintAudioFile}
                  showPreflight={false}
                  onPreflight={() => {}}
                  onGenerate={() => void generateInpaint()}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Async jobs</CardTitle>
                <CardDescription>
                  Jobs submitted in async mode appear here. Switch request mode to Async before generating.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No async jobs yet.</p>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <div key={job.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{job.label}</p>
                            <p className="text-xs text-muted-foreground font-mono">{job.jobId}</p>
                          </div>
                          <Badge variant={job.status === "succeeded" ? "default" : job.status === "errored" ? "destructive" : "secondary"}>
                            {job.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            {job.status}
                            {job.progressPercent != null && job.status === "processing" ? ` ${job.progressPercent}%` : ""}
                          </Badge>
                        </div>
                        {job.error && <p className="text-xs text-destructive">{job.error}</p>}
                        {job.resultUrls?.map((url) => (
                          <audio key={url} src={url} controls className="w-full" />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {results.length > 0 && (
          <>
            <Separator />
            <ResultsSection results={results} />
          </>
        )}
      </div>
    </>
  )
}

function GlobalOptions({
  modelVersion,
  setModelVersion,
  requestMode,
  setRequestMode,
}: {
  modelVersion: MireloVersion
  setModelVersion: (v: MireloVersion) => void
  requestMode: RequestMode
  setRequestMode: (m: RequestMode) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground shrink-0">Model</Label>
        <div className="flex gap-1">
          {(["v1.5", "v1.6"] as const).map((v) => (
            <Button key={v} size="sm" variant={modelVersion === v ? "default" : "outline"} onClick={() => setModelVersion(v)}>
              {v}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground shrink-0">Request</Label>
        <div className="flex gap-1">
          <Button size="sm" variant={requestMode === "sync" ? "default" : "outline"} onClick={() => setRequestMode("sync")}>
            Sync
          </Button>
          <Button size="sm" variant={requestMode === "async" ? "default" : "outline"} onClick={() => setRequestMode("async")}>
            Async
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Extend &amp; Inpaint always use v1.6. Async submits a job and polls — recommended for longer clips.
      </p>
    </div>
  )
}

function KeyInput({
  apiKey,
  setApiKey,
  showKey,
  setShowKey,
}: {
  apiKey: string
  setApiKey: (v: string) => void
  showKey: boolean
  setShowKey: (v: boolean) => void
}) {
  return (
    <div className="relative flex-1">
      <Input
        type={showKey ? "text" : "password"}
        placeholder="sk-…"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        onClick={() => setShowKey(!showKey)}
      >
        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} min={min} max={max} step={step} />
    </div>
  )
}

function SamplesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Samples</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {["1", "2", "3", "4"].map((n) => (
            <SelectItem key={n} value={n}>{n}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function MediaInput({
  label,
  url,
  onUrlChange,
  file,
  onFileChange,
  accept,
  preview,
  previewType = "none",
}: {
  label: string
  url: string
  onUrlChange: (v: string) => void
  file: File | null
  onFileChange: (f: File | null) => void
  accept: string
  preview?: string | null
  previewType?: "video" | "none"
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={url} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://…" />
      <Input type="file" accept={accept} onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
      {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
      {preview && previewType === "video" && (
        <video src={preview} controls className="w-full max-h-40 rounded-md border" />
      )}
      <p className="text-xs text-muted-foreground">Public URL or upload to Supabase (must be reachable by Mirelo).</p>
    </div>
  )
}

function ActionButtons({
  isPreflighting,
  isGenerating,
  generateDisabled,
  showPreflight = true,
  onPreflight,
  onGenerate,
}: {
  isPreflighting: boolean
  isGenerating: boolean
  generateDisabled?: boolean
  showPreflight?: boolean
  onPreflight: () => void
  onGenerate: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {showPreflight && (
        <Button variant="outline" onClick={onPreflight} disabled={isPreflighting}>
          {isPreflighting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Preflight
        </Button>
      )}
      <Button onClick={onGenerate} disabled={isGenerating || generateDisabled}>
        {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Generate
      </Button>
    </div>
  )
}

function PreflightBadge({ preflight }: { preflight: PreflightResult }) {
  return (
    <div className="flex items-center gap-2 text-sm rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
      <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
      <span>
        ~<strong>{preflight.credits}</strong> credits · ~{(preflight.estimated_ms / 1000).toFixed(1)}s
      </span>
    </div>
  )
}

function ResultsSection({ results }: { results: GenerationResult[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Results</h2>
      <div className="grid gap-4">
        {results.map((result) => (
          <Card key={result.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{result.label}</p>
                <Badge variant="outline">{result.endpoint}</Badge>
              </div>
              {result.resultUrls.map((url, i) => (
                <div key={url} className="space-y-2">
                  {result.outputType === "video" || url.endsWith(".mp4") ? (
                    <video src={url} controls className="w-full max-h-64 rounded-md border" />
                  ) : (
                    <audio src={url} controls className="w-full" />
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild className="flex-1">
                      <a href={url} download target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download {result.resultUrls.length > 1 ? `#${i + 1}` : ""}
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
