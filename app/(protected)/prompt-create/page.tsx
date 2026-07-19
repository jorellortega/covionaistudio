"use client"

import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { SavedPromptsService, type SavedPrompt } from "@/lib/saved-prompts-service"
import { getSupabaseClient } from "@/lib/supabase"
import { sanitizeFilename } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Loader2,
  Sparkles,
  Upload,
  Save,
  X,
  Trash2,
  Edit,
  Plus,
  Image as ImageIcon,
  List,
} from "lucide-react"

const PROMPT_TYPES = [
  "style",
  "character",
  "environment",
  "prop",
  "color",
  "lighting",
  "prompt",
] as const

type PromptType = (typeof PROMPT_TYPES)[number]

function parseTags(str: string): string[] {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function PromptCreatePage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userId, ready } = useAuthReady()

  const initialProject = searchParams.get("movie") || searchParams.get("project") || ""
  const initialEditId = searchParams.get("edit") || null

  const [projectId, setProjectId] = useState(initialProject)
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(initialEditId)
  const [title, setTitle] = useState("")
  const [prompt, setPrompt] = useState("")
  const [type, setType] = useState<PromptType | "">("style")
  const [style, setStyle] = useState("")
  const [model, setModel] = useState("")
  const [tags, setTags] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const clearForm = useCallback(() => {
    setEditingId(null)
    setTitle("")
    setPrompt("")
    setType("style")
    setStyle("")
    setModel("")
    setTags("")
    setImageUrl(null)
    setImagePreview(null)
    const url = new URL(window.location.href)
    url.searchParams.delete("edit")
    router.replace(url.pathname + url.search)
  }, [router])

  const loadPromptIntoForm = useCallback((item: SavedPrompt) => {
    setEditingId(item.id)
    setTitle(item.title || "")
    setPrompt(item.prompt || "")
    setType((item.type as PromptType) || "style")
    setStyle(item.style || "")
    setModel(item.model || "")
    setTags((item.tags || []).join(", "))
    setImageUrl(item.image_url || null)
    setImagePreview(item.image_url || null)
    const url = new URL(window.location.href)
    url.searchParams.set("edit", item.id)
    router.replace(url.pathname + url.search)
  }, [router])

  const loadPrompts = useCallback(async () => {
    if (!userId || !ready) return
    setIsLoadingPrompts(true)
    try {
      const loaded = await SavedPromptsService.getSavedPrompts(userId, projectId || null)
      setPrompts(loaded)
      return loaded
    } catch (error) {
      console.error("Failed to load prompts:", error)
      toast({
        title: "Error",
        description: "Failed to load prompts.",
        variant: "destructive",
      })
      return [] as SavedPrompt[]
    } finally {
      setIsLoadingPrompts(false)
    }
  }, [userId, ready, projectId, toast])

  useEffect(() => {
    if (!ready || !userId) return
    void loadPrompts().then((loaded) => {
      if (!initialEditId) return
      const match = loaded.find((p) => p.id === initialEditId)
      if (match) loadPromptIntoForm(match)
    })
    // Only re-load when project/user changes; edit param handled on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, projectId])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    clearForm()
    const url = new URL(window.location.href)
    if (id) url.searchParams.set("movie", id)
    else url.searchParams.delete("movie")
    url.searchParams.delete("edit")
    router.replace(url.pathname + url.search)
  }

  const uploadImageFile = async (file: File): Promise<string> => {
    if (!userId) throw new Error("Not signed in")
    const supabase = getSupabaseClient()
    const ext = file.name.split(".").pop() || "png"
    const safeName = sanitizeFilename(file.name.replace(/\.[^.]+$/, "")) || "prompt-ref"
    const filePath = `${userId}/prompt-refs/${Date.now()}-${safeName}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("cinema_files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/png",
      })

    if (uploadError) throw new Error(uploadError.message)

    const { data: urlData } = supabase.storage.from("cinema_files").getPublicUrl(filePath)
    if (!urlData?.publicUrl) throw new Error("Failed to get public URL")
    return urlData.publicUrl
  }

  const analyzeImage = async (source: string) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch("/api/ai/analyze-image-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: source }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to analyze image")
      }
      const analysis = result.analysis
      if (analysis.title) setTitle(analysis.title)
      if (analysis.prompt) setPrompt(analysis.prompt)
      if (analysis.type && PROMPT_TYPES.includes(analysis.type)) {
        setType(analysis.type as PromptType)
      }
      if (analysis.style) setStyle(analysis.style)
      if (analysis.tags) setTags(analysis.tags)
      toast({
        title: "Image analyzed",
        description: "Prompt fields filled from the image. Review and save.",
      })
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Could not analyze image.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file.",
        variant: "destructive",
      })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB.",
        variant: "destructive",
      })
      return
    }

    const localPreview = URL.createObjectURL(file)
    setImagePreview(localPreview)
    setIsUploading(true)

    try {
      const publicUrl = await uploadImageFile(file)
      setImageUrl(publicUrl)
      setImagePreview(publicUrl)
      URL.revokeObjectURL(localPreview)
      await analyzeImage(publicUrl)
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload image.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const clearImage = () => {
    setImageUrl(null)
    setImagePreview(null)
  }

  const savePrompt = async () => {
    if (!userId) return
    const titleValue = title.trim()
    if (!titleValue) {
      toast({
        title: "Title required",
        description: "Please enter a prompt title.",
        variant: "destructive",
      })
      return
    }
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter the prompt text.",
        variant: "destructive",
      })
      return
    }
    if (!type) {
      toast({
        title: "Type required",
        description: "Please select a prompt type.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const promptData = {
        project_id: projectId || null,
        title: titleValue,
        prompt: prompt.trim(),
        type: type as SavedPrompt["type"],
        style: style.trim() || undefined,
        model: model.trim() || undefined,
        tags: tags ? parseTags(tags) : [],
        image_url: imageUrl || null,
      }

      if (editingId) {
        const updated = await SavedPromptsService.updateSavedPrompt(editingId, promptData)
        setPrompts((prev) => prev.map((p) => (p.id === editingId ? updated : p)))
        toast({
          title: "Prompt updated",
          description: `"${updated.title}" saved.`,
        })
      } else {
        const created = await SavedPromptsService.createSavedPrompt(userId, promptData)
        setPrompts((prev) => [created, ...prev])
        toast({
          title: "Prompt created",
          description: `"${created.title}" added.`,
        })
        setEditingId(created.id)
        const url = new URL(window.location.href)
        url.searchParams.set("edit", created.id)
        router.replace(url.pathname + url.search)
      }
    } catch (error) {
      console.error("Save prompt failed:", error)
      toast({
        title: "Error",
        description: editingId ? "Failed to update prompt." : "Failed to create prompt.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const deletePrompt = async (id: string) => {
    if (!confirm("Delete this prompt? This cannot be undone.")) return
    try {
      await SavedPromptsService.deleteSavedPrompt(id)
      setPrompts((prev) => prev.filter((p) => p.id !== id))
      if (editingId === id) clearForm()
      toast({ title: "Deleted", description: "Prompt removed." })
    } catch (error) {
      console.error("Delete prompt failed:", error)
      toast({
        title: "Error",
        description: "Failed to delete prompt.",
        variant: "destructive",
      })
    }
  }

  const busy = isUploading || isAnalyzing || isSaving

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-400 bg-clip-text text-transparent">
              Create Prompt
            </h1>
            <p className="text-muted-foreground">
              Upload a reference image, extract or write a style prompt, then save it for Cinema Production Stylize.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild className="gap-2">
              <Link href={projectId ? `/prompts-list?movie=${projectId}` : "/prompts-list"}>
                <List className="h-4 w-4" />
                All prompts
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={clearForm} className="gap-2">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie (or leave blank for universal prompts)"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="cinema-card lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                {editingId ? "Edit Prompt" : "New Prompt"}
              </CardTitle>
              <CardDescription>
                {projectId
                  ? "Saved for this project (and available as a universal-style pick in Stylize)."
                  : "Universal prompt — available across projects."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Reference image</Label>
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    id="prompt-create-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => void handleImageUpload(e)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={busy}
                    onClick={() => document.getElementById("prompt-create-image")?.click()}
                  >
                    {isUploading || isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isUploading ? "Uploading…" : "Analyzing…"}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload & analyze
                      </>
                    )}
                  </Button>
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Reference"
                        className="h-28 w-40 object-cover rounded-lg border border-border"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground"
                        disabled={busy}
                        onClick={clearImage}
                        title="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-28 w-40 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Uploads to storage, runs vision analysis to fill title/type/prompt, and keeps the image with the saved prompt.
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt-title">Title *</Label>
                  <Input
                    id="prompt-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-input border-border"
                    placeholder="e.g., JOR film look"
                    disabled={busy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt-type">Type *</Label>
                  <Select
                    value={type || undefined}
                    onValueChange={(value) => setType(value as PromptType)}
                    disabled={busy}
                  >
                    <SelectTrigger id="prompt-type" className="bg-input border-border">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMPT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-text">Prompt *</Label>
                <Textarea
                  id="prompt-text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="bg-input border-border min-h-[160px]"
                  placeholder="Describe the look, grade, texture, lighting…"
                  disabled={busy}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt-style">Style note</Label>
                  <Input
                    id="prompt-style"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="bg-input border-border"
                    placeholder="e.g., cinematic, painterly"
                    disabled={busy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt-model">Preferred model</Label>
                  <Input
                    id="prompt-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="bg-input border-border"
                    placeholder="Optional"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-tags">Tags</Label>
                <Input
                  id="prompt-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="bg-input border-border"
                  placeholder="comma, separated, tags"
                  disabled={busy}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => void savePrompt()}
                  disabled={busy}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {editingId ? "Update prompt" : "Save prompt"}
                    </>
                  )}
                </Button>
                {editingId ? (
                  <Button type="button" variant="outline" onClick={clearForm} disabled={busy}>
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="cinema-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Your prompts</CardTitle>
              <CardDescription>
                {projectId ? "This project + universal" : "Universal only"} — click to edit
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPrompts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : prompts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">
                  No prompts yet. Upload an image or write one and save.
                </p>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                  {prompts.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-2.5 transition-colors ${
                        editingId === item.id
                          ? "border-amber-500/60 bg-amber-500/5"
                          : "border-border hover:border-amber-500/40"
                      }`}
                    >
                      <div className="flex gap-2">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="h-12 w-12 rounded object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded border border-dashed border-border flex items-center justify-center shrink-0">
                            <ImageIcon className="h-4 w-4 text-muted-foreground opacity-50" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <Badge variant="secondary" className="text-[10px]">
                              {item.type}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                            {item.prompt}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => loadPromptIntoForm(item)}
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => void deletePrompt(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
