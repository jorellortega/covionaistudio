"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Header from "@/components/header"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseClient } from "@/lib/supabase"
import {
  RUNWAY_RATIOS,
  getModelsForTask,
  type RunwayTaskType,
} from "@/lib/runway-models"
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
  Sparkles,
  Upload,
  Loader2,
  ImageIcon,
  Video,
  Film,
  UserCircle,
  Maximize2,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Trash2,
  KeyRound,
} from "lucide-react"

type RunwayOutput = {
  id: string
  task: RunwayTaskType
  model: string
  prompt?: string
  url?: string
  status: "pending" | "processing" | "completed" | "failed"
  taskId?: string
  createdAt: number
  mediaType: "image" | "video"
}

type TabConfig = {
  id: RunwayTaskType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const TABS: TabConfig[] = [
  {
    id: "text_to_image",
    label: "Images",
    icon: ImageIcon,
    description: "Gen-4 Image, Turbo (reference), Gemini 2.5 Flash & Gemini 3 Pro",
  },
  {
    id: "text_to_video",
    label: "Text → Video",
    icon: Film,
    description: "Gen-4.5, Veo 3 / 3.1, Seedance 2 — prompt-only or optional keyframe",
  },
  {
    id: "image_to_video",
    label: "Image → Video",
    icon: Sparkles,
    description: "Animate stills with Gen-4 Turbo, Gen-4.5, Veo, Seedance 2",
  },
  {
    id: "video_to_video",
    label: "Video → Video",
    icon: Video,
    description: "Gen-4 Aleph & Seedance 2 — edit or restyle existing footage",
  },
  {
    id: "character_performance",
    label: "Act-Two",
    icon: UserCircle,
    description: "Character performance driven by a reference clip",
  },
  {
    id: "video_upscale",
    label: "Upscale",
    icon: Maximize2,
    description: "4× video upscale up to 4K",
  },
]

export default function RunwayMLPage() {
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<RunwayTaskType>("text_to_image")
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [outputs, setOutputs] = useState<RunwayOutput[]>([])

  const [model, setModel] = useState("")
  const [prompt, setPrompt] = useState("")
  const [ratio, setRatio] = useState("1280:720")
  const [duration, setDuration] = useState<5 | 10>(5)
  const [seed, setSeed] = useState("")
  const [characterType, setCharacterType] = useState<"image" | "video">("image")

  const [primaryFile, setPrimaryFile] = useState<File | null>(null)
  const [primaryPreview, setPrimaryPreview] = useState<string | null>(null)
  const [primaryRunwayUri, setPrimaryRunwayUri] = useState<string | null>(null)

  const [refFile, setRefFile] = useState<File | null>(null)
  const [refPreview, setRefPreview] = useState<string | null>(null)
  const [refRunwayUri, setRefRunwayUri] = useState<string | null>(null)

  const [extraRef2File, setExtraRef2File] = useState<File | null>(null)
  const [extraRef2Preview, setExtraRef2Preview] = useState<string | null>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const models = useMemo(() => getModelsForTask(activeTab), [activeTab])
  const selectedModel = useMemo(
    () => models.find((m) => m.id === model) ?? models[0],
    [models, model],
  )

  useEffect(() => {
    const first = getModelsForTask(activeTab)[0]
    if (first) setModel(first.id)
  }, [activeTab])

  useEffect(() => {
    if (!ready || !userId) return
    const checkKey = async () => {
      const supabase = getSupabaseClient()
      const { data } = await supabase.from("users").select("runway_api_key").eq("id", userId).maybeSingle()
      const userHasKey = Boolean(data?.runway_api_key?.trim()?.startsWith("key_"))
      setHasApiKey(userHasKey)
    }
    checkKey()
  }, [ready, userId])

  const clearPrimary = () => {
    setPrimaryFile(null)
    setPrimaryPreview(null)
    setPrimaryRunwayUri(null)
  }

  const clearRef = () => {
    setRefFile(null)
    setRefPreview(null)
    setRefRunwayUri(null)
  }

  const clearExtraRef2 = () => {
    setExtraRef2File(null)
    setExtraRef2Preview(null)
  }

  const uploadToRunway = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/ai/upload-to-runway", { method: "POST", body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Upload failed")
    return data.runwayUri as string
  }

  const handlePrimaryFile = (file: File | null) => {
    clearPrimary()
    if (!file) return
    setPrimaryFile(file)
    setPrimaryPreview(URL.createObjectURL(file))
  }

  const handleRefFile = (file: File | null) => {
    clearRef()
    if (!file) return
    setRefFile(file)
    setRefPreview(URL.createObjectURL(file))
  }

  const handleExtraRef2File = (file: File | null) => {
    clearExtraRef2()
    if (!file) return
    setExtraRef2File(file)
    setExtraRef2Preview(URL.createObjectURL(file))
  }

  const ensureUploaded = async () => {
    let uri = primaryRunwayUri
    if (primaryFile && !uri) {
      setIsUploading(true)
      try {
        uri = await uploadToRunway(primaryFile)
        setPrimaryRunwayUri(uri)
      } finally {
        setIsUploading(false)
      }
    }
    return uri
  }

  const ensureRefUploaded = async () => {
    let uri = refRunwayUri
    if (refFile && !uri) {
      setIsUploading(true)
      try {
        uri = await uploadToRunway(refFile)
        setRefRunwayUri(uri)
      } finally {
        setIsUploading(false)
      }
    }
    return uri
  }

  const pollTask = useCallback(
    (outputId: string, taskId: string) => {
      let attempts = 0
      const poll = async () => {
        attempts++
        try {
          const res = await fetch("/api/ai/check-video-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: taskId }),
          })
          if (res.ok) {
            const result = await res.json()
            const url = result.data?.url as string | undefined
            const status = result.data?.status as string

            if (url && (status === "completed" || status === "SUCCEEDED")) {
              setOutputs((prev) =>
                prev.map((o) =>
                  o.id === outputId ? { ...o, status: "completed", url } : o,
                ),
              )
              toast({ title: "Generation complete" })
              return
            }
            if (status === "failed" || status === "FAILED") {
              setOutputs((prev) => prev.map((o) => (o.id === outputId ? { ...o, status: "failed" } : o)))
              toast({ title: "Generation failed", variant: "destructive" })
              return
            }
            setOutputs((prev) =>
              prev.map((o) => (o.id === outputId ? { ...o, status: "processing" } : o)),
            )
          }
          if (attempts < 120) setTimeout(poll, 5000)
          else {
            setOutputs((prev) => prev.map((o) => (o.id === outputId ? { ...o, status: "failed" } : o)))
            toast({ title: "Timed out", description: "Job may still finish on Runway.", variant: "destructive" })
          }
        } catch {
          if (attempts < 120) setTimeout(poll, 5000)
        }
      }
      poll()
    },
    [toast],
  )

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" })
      return
    }

    const modelDef = selectedModel
    if (!modelDef) return

    if (activeTab !== "video_upscale" && activeTab !== "character_performance" && !prompt.trim() && activeTab !== "text_to_video") {
      if (activeTab === "text_to_image" || activeTab === "image_to_video" || activeTab === "video_to_video") {
        toast({ title: "Enter a prompt", variant: "destructive" })
        return
      }
    }

    if (modelDef.requiresImage && activeTab !== "character_performance" && !primaryFile && !primaryRunwayUri) {
      toast({ title: "Upload required", description: "This model needs an image upload.", variant: "destructive" })
      return
    }

    if (modelDef.requiresVideo && !primaryFile && !primaryRunwayUri) {
      toast({ title: "Upload required", description: "This model needs a video upload.", variant: "destructive" })
      return
    }

    if (modelDef.requiresReferenceVideo && !refFile && !refRunwayUri) {
      toast({ title: "Reference video required", description: "Act-Two needs a performance reference clip.", variant: "destructive" })
      return
    }

    setIsGenerating(true)
    const outputId = `runway-${Date.now()}`
    const mediaType: "image" | "video" =
      activeTab === "text_to_image" ? "image" : activeTab === "video_upscale" ? "video" : "video"

    setOutputs((prev) => [
      {
        id: outputId,
        task: activeTab,
        model: modelDef.id,
        prompt: prompt.trim() || undefined,
        status: "pending",
        createdAt: Date.now(),
        mediaType,
      },
      ...prev,
    ])

    try {
      let runwayUri: string | null = null
      let referenceVideoUri: string | null = null

      if (modelDef.requiresVideo || modelDef.requiresImage || activeTab === "image_to_video" || activeTab === "video_to_video" || activeTab === "video_upscale" || activeTab === "character_performance" || (activeTab === "text_to_video" && primaryFile)) {
        runwayUri = await ensureUploaded()
      }

      if (modelDef.requiresReferenceVideo || activeTab === "character_performance") {
        referenceVideoUri = await ensureRefUploaded()
      }

      const useFormData =
        activeTab === "text_to_image" &&
        modelDef.id === "gen4_image_turbo" &&
        Boolean(primaryFile)

      let res: Response
      if (useFormData) {
        const fd = new FormData()
        fd.append("task", activeTab)
        fd.append("model", modelDef.id)
        fd.append("promptText", prompt.trim())
        fd.append("ratio", ratio)
        fd.append("file", primaryFile!)
        if (refFile) fd.append("styleFile", refFile)
        if (extraRef2File) fd.append("styleFile2", extraRef2File)
        if (seed) fd.append("seed", seed)
        res = await fetch("/api/ai/runway", { method: "POST", body: fd })
      } else {
        res = await fetch("/api/ai/runway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: activeTab,
            model: modelDef.id,
            promptText: prompt.trim() || undefined,
            ratio,
            duration,
            runwayUri,
            referenceVideoUri,
            characterType,
            seed: seed ? parseInt(seed, 10) : undefined,
            referenceImages:
              activeTab === "text_to_image" && modelDef.id === "gen4_image_turbo" && runwayUri
                ? [{ uri: runwayUri, tag: "reference" }]
                : undefined,
          }),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Runway request failed")

      const taskId = data.taskId as string
      setOutputs((prev) =>
        prev.map((o) => (o.id === outputId ? { ...o, taskId, status: "processing" } : o)),
      )
      pollTask(outputId, taskId)
      toast({ title: "Job started", description: `Runway task ${taskId.slice(0, 8)}…` })
    } catch (error) {
      setOutputs((prev) => prev.map((o) => (o.id === outputId ? { ...o, status: "failed" } : o)))
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const renderModelSelect = () => (
    <div className="space-y-2">
      <Label>Model</Label>
      <Select value={model} onValueChange={setModel}>
        <SelectTrigger>
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex items-center gap-2">
                {m.label}
                {m.isNew && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    New
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedModel && (
        <p className="text-xs text-muted-foreground">
          {selectedModel.description} · {selectedModel.creditsHint}
        </p>
      )}
    </div>
  )

  const renderUpload = (
    label: string,
    accept: string,
    preview: string | null,
    file: File | null,
    onChange: (f: File | null) => void,
    onClear: () => void,
    hint?: string,
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {preview ? (
        <div className="relative rounded-lg border overflow-hidden bg-muted/30">
          {accept.includes("video") ? (
            <video src={preview} controls className="w-full max-h-48 object-contain" />
          ) : (
            <img src={preview} alt="Preview" className="w-full max-h-48 object-contain" />
          )}
          <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2" onClick={onClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 cursor-pointer hover:bg-muted/40 transition-colors">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Click to upload</span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      {file && <p className="text-xs text-muted-foreground truncate">{file.name}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )

  const renderCommonControls = (showDuration: boolean, showSeed = false) => (
    <>
      <div className="space-y-2">
        <Label>Aspect ratio</Label>
        <Select value={ratio} onValueChange={setRatio}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RUNWAY_RATIOS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showDuration && (
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v, 10) as 5 | 10)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 seconds</SelectItem>
              <SelectItem value="10">10 seconds</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {showSeed && (
        <div className="space-y-2">
          <Label>Seed (optional)</Label>
          <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Random if empty" type="number" />
        </div>
      )}
    </>
  )

  const renderTabPanel = (task: RunwayTaskType, showDuration: boolean, showSeed = false) => {
    const modelDef = models.find((m) => m.id === model)
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {renderModelSelect()}
          {(task !== "video_upscale") && (
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  task === "text_to_image" && model === "gen4_image_turbo"
                    ? "Describe the shot — use @reference, @linked, @extra for up to 3 reference images"
                    : task === "character_performance"
                      ? "Optional style notes for the performance"
                      : "Describe what you want to generate or how to transform the input"
                }
                rows={4}
              />
            </div>
          )}
          {renderCommonControls(showDuration, showSeed)}
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isGenerating || isUploading}
          >
            {isGenerating || isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUploading ? "Uploading…" : "Starting…"}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
        <div className="space-y-4">
          {(task === "text_to_image" && modelDef?.requiresImage) ||
          task === "image_to_video" ||
          (task === "text_to_video") ? (
            renderUpload(
              task === "text_to_image"
                ? "Reference image (required for Turbo)"
                : task === "text_to_video"
                  ? "Optional keyframe image"
                  : "Source image",
              "image/*",
              primaryPreview,
              primaryFile,
              handlePrimaryFile,
              clearPrimary,
              task === "text_to_image" && model === "gen4_image_turbo"
                ? "Primary reference (@reference). Add up to 2 more below (@linked, @extra)."
                : undefined,
            )
          ) : null}
          {task === "text_to_image" && model === "gen4_image_turbo" && (
            <>
              {renderUpload(
                "Additional reference 2 (@linked)",
                "image/*",
                refPreview,
                refFile,
                handleRefFile,
                clearRef,
                "Optional second reference for characters, style, etc.",
              )}
              {renderUpload(
                "Additional reference 3 (@extra)",
                "image/*",
                extraRef2Preview,
                extraRef2File,
                handleExtraRef2File,
                clearExtraRef2,
                "Optional third reference. Runway supports up to 3 total.",
              )}
            </>
          )}
          {(task === "video_to_video" || task === "video_upscale") &&
            renderUpload(
              "Source video",
              "video/*",
              primaryPreview,
              primaryFile,
              handlePrimaryFile,
              clearPrimary,
              "Max ~50MB. Shorter clips process faster.",
            )}
          {task === "character_performance" && (
            <>
              <div className="space-y-2">
                <Label>Character type</Label>
                <Select value={characterType} onValueChange={(v) => setCharacterType(v as "image" | "video")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image character</SelectItem>
                    <SelectItem value="video">Video character</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renderUpload(
                "Character (image or video)",
                "image/*,video/*",
                primaryPreview,
                primaryFile,
                handlePrimaryFile,
                clearPrimary,
              )}
              {renderUpload(
                "Reference performance video",
                "video/*",
                refPreview,
                refFile,
                handleRefFile,
                clearRef,
                "The motion/expression to transfer onto the character.",
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-6xl py-8 px-4 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Film className="h-8 w-8 text-primary" />
              Runway ML Studio
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Full Runway API hub — images, text-to-video, image-to-video, Aleph edits, Act-Two character
              performance, and 4× upscale. Includes Gen-4.5, Veo 3.1, Gemini 3 Pro, and Seedance 2.
            </p>
          </div>
          <Card className="shrink-0 w-full sm:w-auto">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              {hasApiKey === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : hasApiKey ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <div className="text-sm">
                <p className="font-medium flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  {hasApiKey ? "Your Runway key set" : "Using server key or add yours"}
                </p>
                <Link href="/settings-ai" className="text-primary text-xs hover:underline">
                  Settings → AI API keys
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RunwayTaskType)}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs sm:text-sm">
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <tab.icon className="h-5 w-5" />
                    {tab.label}
                  </CardTitle>
                  <CardDescription>{tab.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderTabPanel(
                    tab.id,
                    tab.id === "text_to_video" ||
                      tab.id === "image_to_video" ||
                      tab.id === "character_performance",
                    tab.id === "text_to_image",
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <Separator />

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Session outputs</h2>
            {outputs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setOutputs([])}>
                Clear all
              </Button>
            )}
          </div>
          {outputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Generations appear here while they process and when complete.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {outputs.map((out) => (
                <Card key={out.id} className="overflow-hidden">
                  <div className="aspect-video bg-muted/40 flex items-center justify-center relative">
                    {out.status === "completed" && out.url ? (
                      out.mediaType === "image" ? (
                        <img src={out.url} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <video src={out.url} controls className="w-full h-full object-contain" />
                      )
                    ) : out.status === "failed" ? (
                      <div className="text-destructive text-sm flex flex-col items-center gap-2">
                        <AlertCircle className="h-8 w-8" />
                        Failed
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        {out.status === "pending" ? "Starting…" : "Processing…"}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{out.model}</Badge>
                      <Badge variant="secondary">{out.task.replace(/_/g, " ")}</Badge>
                    </div>
                    {out.prompt && <p className="text-xs text-muted-foreground line-clamp-2">{out.prompt}</p>}
                    {out.url && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild className="flex-1">
                          <a href={out.url} download target="_blank" rel="noreferrer">
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Download
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={out.url} target="_blank" rel="noreferrer">
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

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Also available in Cinema Platform</CardTitle>
            <CardDescription>
              Runway is wired into other workflows — same API key, specialized UIs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/locations">Locations (angle shots · Gen-4 Turbo)</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/create-titles">Create Titles (reference stylize + video)</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/ai-studio">AI Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
