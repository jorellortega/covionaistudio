"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Header from "@/components/header"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import type { HeyGenLook } from "@/lib/heygen-config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  Upload,
  UserCircle,
  Video,
  KeyRound,
  RefreshCw,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ScanFace,
  Link2,
} from "lucide-react"

type HeyGenVoice = {
  voice_id: string
  name?: string
  language?: string
  gender?: string
}

type GeneratedVideo = {
  id: string
  videoId: string
  title: string
  status: string
  videoUrl?: string
  createdAt: number
}

function apiKeyQuery(apiKey: string) {
  return apiKey.trim() ? `&apiKey=${encodeURIComponent(apiKey.trim())}` : ""
}

function statusBadgeVariant(status?: string | null) {
  if (!status) return "secondary" as const
  if (status === "completed") return "default" as const
  if (status === "failed") return "destructive" as const
  return "secondary" as const
}

export default function TwinPage() {
  const { ready } = useAuthReady()
  const { toast } = useToast()

  const [apiKey, setApiKey] = useState("")
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState("create")

  const [twinName, setTwinName] = useState("")
  const [trainingUrl, setTrainingUrl] = useState("")
  const [trainingFile, setTrainingFile] = useState<File | null>(null)
  const [trainingPreview, setTrainingPreview] = useState<string | null>(null)
  const [isCreatingTwin, setIsCreatingTwin] = useState(false)

  const [looks, setLooks] = useState<HeyGenLook[]>([])
  const [isLoadingLooks, setIsLoadingLooks] = useState(false)
  const [consentUrls, setConsentUrls] = useState<Record<string, string>>({})

  const [voices, setVoices] = useState<HeyGenVoice[]>([])
  const [selectedLookId, setSelectedLookId] = useState("")
  const [selectedVoiceId, setSelectedVoiceId] = useState("")
  const [videoTitle, setVideoTitle] = useState("Digital Twin Video")
  const [script, setScript] = useState(
    "Hello! This is my HeyGen digital twin speaking from Cinema Platform.",
  )
  const [engine, setEngine] = useState<"avatar_iv" | "avatar_v">("avatar_iv")
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([])

  useEffect(() => {
    if (!ready) return
    fetch("/api/heygen?action=key-check")
      .then((r) => r.json())
      .then((data) => setHasServerKey(!data.error?.includes("No HeyGen API key")))
      .catch(() => setHasServerKey(false))
  }, [ready])

  const loadLooks = useCallback(async () => {
    if (!apiKey.trim() && hasServerKey === false) {
      toast({
        title: "API key required",
        description: "Enter your HeyGen API key or set HEYGEN_API_KEY on the server.",
        variant: "destructive",
      })
      return
    }

    setIsLoadingLooks(true)
    try {
      const res = await fetch(
        `/api/heygen?action=looks&avatar_type=digital_twin&ownership=private&limit=50${apiKeyQuery(apiKey)}`,
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load digital twins")

      const list = Array.isArray(data.data) ? (data.data as HeyGenLook[]) : []
      setLooks(list)
      if (!selectedLookId && list[0]?.id) {
        setSelectedLookId(list[0].id)
        if (list[0].default_voice_id) setSelectedVoiceId(list[0].default_voice_id)
      }
    } catch (error) {
      toast({
        title: "Failed to load twins",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsLoadingLooks(false)
    }
  }, [apiKey, hasServerKey, selectedLookId, toast])

  const loadVoices = useCallback(async () => {
    if (!apiKey.trim() && hasServerKey === false) return

    try {
      const res = await fetch(`/api/heygen?action=voices&limit=50${apiKeyQuery(apiKey)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load voices")

      const list = Array.isArray(data.data)
        ? (data.data as Array<{ voice_id?: string; id?: string; name?: string; language?: string; gender?: string }>).map(
            (v) => ({
              voice_id: v.voice_id || v.id || "",
              name: v.name,
              language: v.language,
              gender: v.gender,
            }),
          ).filter((v) => v.voice_id)
        : []

      setVoices(list)
      if (!selectedVoiceId && list[0]?.voice_id) {
        setSelectedVoiceId(list[0].voice_id)
      }
    } catch (error) {
      toast({
        title: "Failed to load voices",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }, [apiKey, hasServerKey, selectedVoiceId, toast])

  useEffect(() => {
    if (!ready || hasServerKey === null) return
    if (!apiKey.trim() && !hasServerKey) return
    void loadLooks()
    void loadVoices()
  }, [ready, hasServerKey, apiKey, loadLooks, loadVoices])

  const selectedLook = useMemo(
    () => looks.find((l) => l.id === selectedLookId) ?? null,
    [looks, selectedLookId],
  )

  const completedLooks = useMemo(
    () => looks.filter((l) => !l.status || l.status === "completed"),
    [looks],
  )

  const handleTrainingFile = (file: File | null) => {
    setTrainingFile(file)
    if (trainingPreview) URL.revokeObjectURL(trainingPreview)
    setTrainingPreview(file ? URL.createObjectURL(file) : null)
  }

  const uploadTrainingFile = async (file: File): Promise<string> => {
    const form = new FormData()
    form.append("action", "upload")
    form.append("file", file)
    if (apiKey.trim()) form.append("apiKey", apiKey.trim())

    const res = await fetch("/api/heygen", { method: "POST", body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Upload failed")

    const assetId = data.data?.asset_id as string | undefined
    if (!assetId) throw new Error("Upload succeeded but no asset_id returned")
    return assetId
  }

  const handleCreateTwin = async () => {
    if (!twinName.trim()) {
      toast({ title: "Name required", description: "Give your digital twin a name.", variant: "destructive" })
      return
    }
    if (!trainingUrl.trim() && !trainingFile) {
      toast({
        title: "Training video required",
        description: "Upload footage or paste a public video URL.",
        variant: "destructive",
      })
      return
    }

    setIsCreatingTwin(true)
    try {
      let filePayload: Record<string, string>
      if (trainingFile) {
        const assetId = await uploadTrainingFile(trainingFile)
        filePayload = { type: "asset_id", asset_id: assetId }
      } else {
        filePayload = { type: "url", url: trainingUrl.trim() }
      }

      const res = await fetch("/api/heygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-twin",
          apiKey: apiKey.trim() || undefined,
          name: twinName.trim(),
          file: filePayload,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create digital twin")

      const groupId = data.data?.avatar_group?.id as string | undefined
      const lookId = data.data?.avatar_item?.id as string | undefined
      const consentStatus = data.data?.avatar_group?.consent_status as string | null | undefined

      toast({
        title: "Digital twin submitted",
        description: lookId
          ? `Training started for look ${lookId}.`
          : "HeyGen is processing your footage.",
      })

      if (groupId && consentStatus !== "completed") {
        toast({
          title: "Consent may be required",
          description: "Open the My Twins tab to start the consent flow when training finishes.",
        })
      }

      setTwinName("")
      setTrainingUrl("")
      handleTrainingFile(null)
      setActiveTab("twins")
      await loadLooks()
    } catch (error) {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Could not create digital twin",
        variant: "destructive",
      })
    } finally {
      setIsCreatingTwin(false)
    }
  }

  const handleRequestConsent = async (groupId: string) => {
    try {
      const res = await fetch("/api/heygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "consent",
          apiKey: apiKey.trim() || undefined,
          groupId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start consent")

      const url =
        (data.data?.url as string | undefined) ||
        (data.data?.consent_url as string | undefined)

      if (url) {
        setConsentUrls((prev) => ({ ...prev, [groupId]: url }))
        window.open(url, "_blank", "noopener,noreferrer")
        toast({
          title: "Consent link opened",
          description: "Complete consent in the new tab, then refresh your twins.",
        })
      } else {
        toast({
          title: "Consent initiated",
          description: "Check your HeyGen dashboard for consent status.",
        })
      }
    } catch (error) {
      toast({
        title: "Consent failed",
        description: error instanceof Error ? error.message : "Could not start consent",
        variant: "destructive",
      })
    }
  }

  const pollVideoStatus = async (entry: GeneratedVideo) => {
    const maxAttempts = 120
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const res = await fetch(
        `/api/heygen?action=video&videoId=${encodeURIComponent(entry.videoId)}${apiKeyQuery(apiKey)}`,
      )
      const data = await res.json()
      if (!res.ok) continue

      const video = data.data as {
        status?: string
        video_url?: string
        error?: { message?: string }
      }
      const status = video?.status || "processing"
      const videoUrl = video?.video_url

      setGeneratedVideos((prev) =>
        prev.map((v) =>
          v.id === entry.id
            ? {
                ...v,
                status,
                videoUrl: videoUrl || v.videoUrl,
              }
            : v,
        ),
      )

      if (status === "completed" && videoUrl) return
      if (status === "failed") {
        throw new Error(video?.error?.message || "Video generation failed")
      }
    }
    throw new Error("Timed out waiting for video")
  }

  const handleGenerateVideo = async () => {
    if (!selectedLookId) {
      toast({ title: "Select a twin", description: "Choose a completed digital twin look.", variant: "destructive" })
      return
    }
    if (!selectedVoiceId) {
      toast({ title: "Select a voice", variant: "destructive" })
      return
    }
    if (!script.trim()) {
      toast({ title: "Script required", variant: "destructive" })
      return
    }

    setIsGeneratingVideo(true)
    try {
      const res = await fetch("/api/heygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-video",
          apiKey: apiKey.trim() || undefined,
          payload: {
            avatar_id: selectedLookId,
            voice_id: selectedVoiceId,
            script: script.trim(),
            title: videoTitle.trim() || "Digital Twin Video",
            resolution: "1080p",
            aspect_ratio: "auto",
            engine: { type: engine },
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start video")

      const videoId = (data.data?.video_id || data.data?.id) as string | undefined
      if (!videoId) throw new Error("No video id returned")

      const entry: GeneratedVideo = {
        id: `${Date.now()}`,
        videoId,
        title: videoTitle.trim() || "Digital Twin Video",
        status: "processing",
        createdAt: Date.now(),
      }
      setGeneratedVideos((prev) => [entry, ...prev])

      toast({ title: "Video rendering", description: "HeyGen is generating your video…" })
      await pollVideoStatus(entry)
      toast({ title: "Video ready", description: "Your digital twin video is complete." })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate video",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ScanFace className="h-8 w-8 text-primary" />
              Digital Twin
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Create HeyGen digital twins from training footage, manage consent, and generate lip-synced avatar videos.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            Powered by HeyGen
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              API Key
            </CardTitle>
            <CardDescription>
              Add your key in{" "}
              <Link href="/setup-ai" className="text-primary underline-offset-4 hover:underline">
                Setup AI
              </Link>
              , set <code className="text-xs">HEYGEN_API_KEY</code> on the server, or override below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input
              type="password"
              placeholder={hasServerKey ? "Server key detected — override optional" : "HeyGen API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="sm:max-w-md"
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {hasServerKey === null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasServerKey || apiKey.trim() ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Ready
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  No key detected
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Create Twin</TabsTrigger>
            <TabsTrigger value="twins">My Twins</TabsTrigger>
            <TabsTrigger value="video">Generate Video</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Digital Twin</CardTitle>
                <CardDescription>
                  Upload 15s–10min training footage of one person speaking to camera. HeyGen trains a reusable digital twin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Twin name</Label>
                  <Input
                    value={twinName}
                    onChange={(e) => setTwinName(e.target.value)}
                    placeholder="e.g. Director — Studio A"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Training video</Label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="twin-training-upload"
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleTrainingFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("twin-training-upload")?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload video
                    </Button>
                    {trainingFile && (
                      <Badge variant="secondary">{trainingFile.name}</Badge>
                    )}
                  </div>
                  {trainingPreview && (
                    <video src={trainingPreview} controls className="w-full max-w-md rounded-lg border" />
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    Or paste a public URL
                  </div>
                  <Input
                    value={trainingUrl}
                    onChange={(e) => setTrainingUrl(e.target.value)}
                    placeholder="https://example.com/training-footage.mp4"
                    disabled={!!trainingFile}
                  />
                </div>

                <Button onClick={() => void handleCreateTwin()} disabled={isCreatingTwin}>
                  {isCreatingTwin ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <UserCircle className="h-4 w-4 mr-2" />
                      Create Digital Twin
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="twins" className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Your private HeyGen digital twin looks. Consent is required before video generation.
              </p>
              <Button variant="outline" size="sm" onClick={() => void loadLooks()} disabled={isLoadingLooks}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingLooks ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {isLoadingLooks ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading digital twins…
              </div>
            ) : looks.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No digital twins yet. Create one from the Create Twin tab.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {looks.map((look) => (
                  <Card key={look.id}>
                    <CardContent className="pt-5 space-y-3">
                      <div className="aspect-video rounded-md bg-muted overflow-hidden border">
                        {look.preview_image_url ? (
                          <img
                            src={look.preview_image_url}
                            alt={look.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <UserCircle className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium truncate">{look.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{look.id}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusBadgeVariant(look.status)}>
                          {look.status || "unknown"}
                        </Badge>
                        <Badge variant="outline">{look.avatar_type}</Badge>
                      </div>
                      {look.group_id && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => void handleRequestConsent(look.group_id!)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-2" />
                          {consentUrls[look.group_id] ? "Reopen consent" : "Start consent"}
                        </Button>
                      )}
                      {look.status === "completed" && (
                        <Button
                          type="button"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setSelectedLookId(look.id)
                            if (look.default_voice_id) setSelectedVoiceId(look.default_voice_id)
                            setActiveTab("video")
                          }}
                        >
                          <Video className="h-3.5 w-3.5 mr-2" />
                          Generate video
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="video" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Video settings</CardTitle>
                  <CardDescription>
                    Pick a completed twin look, voice, and script. HeyGen renders a lip-synced talking-head video.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Digital twin look</Label>
                    <Select value={selectedLookId} onValueChange={setSelectedLookId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a twin" />
                      </SelectTrigger>
                      <SelectContent>
                        {completedLooks.map((look) => (
                          <SelectItem key={look.id} value={look.id}>
                            {look.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {completedLooks.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No completed twins yet. Wait for training to finish on the My Twins tab.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {voices.map((voice) => (
                          <SelectItem key={voice.voice_id} value={voice.voice_id}>
                            {voice.name || voice.voice_id}
                            {voice.language ? ` · ${voice.language}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Engine</Label>
                    <Select value={engine} onValueChange={(v) => setEngine(v as "avatar_iv" | "avatar_v")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="avatar_iv">Avatar IV (default)</SelectItem>
                        <SelectItem value="avatar_v">Avatar V (highest fidelity)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Script</Label>
                    <Textarea
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      rows={6}
                      placeholder="What should your digital twin say?"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => void handleGenerateVideo()}
                    disabled={isGeneratingVideo || completedLooks.length === 0}
                  >
                    {isGeneratingVideo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Rendering…
                      </>
                    ) : (
                      <>
                        <Video className="h-4 w-4 mr-2" />
                        Generate Video
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>
                    {selectedLook?.preview_image_url
                      ? "Selected twin look"
                      : "Select a twin to preview"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedLook?.preview_image_url ? (
                    <img
                      src={selectedLook.preview_image_url}
                      alt={selectedLook.name}
                      className="w-full rounded-lg border aspect-video object-cover"
                    />
                  ) : (
                    <div className="aspect-video rounded-lg border bg-muted flex items-center justify-center">
                      <UserCircle className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {generatedVideos.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">Recent renders</h2>
                  <div className="space-y-3">
                    {generatedVideos.map((video) => (
                      <Card key={video.id}>
                        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                          <div>
                            <p className="font-medium">{video.title}</p>
                            <p className="text-xs text-muted-foreground font-mono">{video.videoId}</p>
                            <Badge variant={statusBadgeVariant(video.status)} className="mt-2">
                              {video.status}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            {video.videoUrl && (
                              <>
                                <Button asChild variant="outline" size="sm">
                                  <a href={video.videoUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open
                                  </a>
                                </Button>
                                <Button asChild variant="outline" size="sm">
                                  <a href={video.videoUrl} download>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </a>
                                </Button>
                              </>
                            )}
                            {video.status === "processing" && (
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            )}
                          </div>
                          {video.videoUrl && (
                            <video
                              src={video.videoUrl}
                              controls
                              className="w-full sm:max-w-xs rounded-md border"
                            />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
