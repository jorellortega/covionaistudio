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
  Star,
  Upload,
  Link2,
  Sparkles,
  Trash2,
  Loader2,
  ImageIcon,
  Download,
  ExternalLink,
  CheckCircle2,
  FolderOpen,
} from "lucide-react"

function mergeCoverAssets(projectAssets: Asset[], treatmentAssets: Asset[]): Asset[] {
  const assetMap = new Map<string, Asset>()
  projectAssets.forEach((asset) => assetMap.set(asset.id, asset))
  treatmentAssets.forEach((asset) => assetMap.set(asset.id, asset))
  const merged = Array.from(assetMap.values())
  merged.sort((a, b) => {
    if (a.is_default_cover && !b.is_default_cover) return -1
    if (!a.is_default_cover && b.is_default_cover) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  return merged
}

export default function CreateCoverPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()

  const initialProjectId = searchParams.get("projectId") || ""

  const [projectId, setProjectId] = useState(initialProjectId)
  const [movie, setMovie] = useState<Movie | null>(null)
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [coverAssets, setCoverAssets] = useState<Asset[]>([])
  const [referenceAssets, setReferenceAssets] = useState<Asset[]>([])
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null)
  const [loadingCovers, setLoadingCovers] = useState(false)

  const [importUrl, setImportUrl] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([])

  const [isUploading, setIsUploading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSettingDefault, setIsSettingDefault] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [selectedAIService, setSelectedAIService] = useState("dalle")

  const selectedCover = useMemo(
    () => coverAssets.find((a) => a.id === selectedCoverId) ?? coverAssets[0] ?? null,
    [coverAssets, selectedCoverId],
  )

  const defaultCover = useMemo(
    () => coverAssets.find((a) => a.is_default_cover) ?? null,
    [coverAssets],
  )

  const importableReferences = useMemo(() => {
    const coverUrls = new Set(coverAssets.map((a) => a.content_url).filter(Boolean))
    return referenceAssets.filter(
      (a) =>
        a.content_type === "image" &&
        a.content_url &&
        !coverUrls.has(a.content_url),
    )
  }, [referenceAssets, coverAssets])

  const mapModelToService = (model: string): string => {
    const lower = model.toLowerCase()
    if (lower.includes("openart")) return "openart"
    if (lower.includes("leonardo")) return "leonardo"
    return "dalle"
  }

  const getImagesTabSetting = () => aiSettings.find((s) => s.tab_type === "images")
  const isImagesTabLocked = () => getImagesTabSetting()?.is_locked || false
  const getImagesTabLockedModel = () => getImagesTabSetting()?.locked_model || ""

  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready || !userId) return
      try {
        const settings = await AISettingsService.getSystemSettings()
        const imagesSetting = await AISettingsService.getOrCreateDefaultTabSetting("images")
        const existingImagesSetting = settings.find((s) => s.tab_type === "images")
        const finalSettings = existingImagesSetting ? settings : [...settings, imagesSetting]
        setAiSettings(finalSettings)
        setAiSettingsLoaded(true)
        const imagesTabSetting = finalSettings.find((s) => s.tab_type === "images")
        if (imagesTabSetting?.is_locked && imagesTabSetting.locked_model) {
          setSelectedAIService(mapModelToService(imagesTabSetting.locked_model))
        }
      } catch (error) {
        console.error("Error loading AI settings:", error)
      }
    }
    loadAISettings()
  }, [ready, userId])

  useEffect(() => {
    if (initialProjectId && initialProjectId !== projectId) {
      setProjectId(initialProjectId)
    }
  }, [initialProjectId, projectId])

  const loadProjectData = useCallback(async () => {
    if (!projectId || !ready) {
      setMovie(null)
      setTreatment(null)
      setCoverAssets([])
      setReferenceAssets([])
      setSelectedCoverId(null)
      return
    }

    setLoadingCovers(true)
    try {
      const movies = await MovieService.getMovies()
      const selectedMovie = movies.find((m) => m.id === projectId) ?? null
      setMovie(selectedMovie)

      const linkedTreatment = await TreatmentsService.getTreatmentByProjectId(projectId)
      setTreatment(linkedTreatment)

      let projectCovers: Asset[] = await AssetService.getCoverImageAssets(projectId)
      let treatmentCovers: Asset[] = []
      if (linkedTreatment?.id) {
        treatmentCovers = await AssetService.getCoverImageAssetsForTreatment(linkedTreatment.id)
      }

      const merged = mergeCoverAssets(projectCovers, treatmentCovers)
      setCoverAssets(merged)

      const defaultAsset = merged.find((a) => a.is_default_cover)
      setSelectedCoverId(defaultAsset?.id ?? merged[0]?.id ?? null)

      const allAssets = await AssetService.getAssetsForProject(projectId)
      setReferenceAssets(allAssets.filter((a) => a.content_type === "image" && a.content_url))
    } catch (error) {
      console.error("Error loading cover studio data:", error)
      toast({
        title: "Error",
        description: "Failed to load cover data for this project.",
        variant: "destructive",
      })
    } finally {
      setLoadingCovers(false)
    }
  }, [projectId, ready, toast])

  useEffect(() => {
    loadProjectData()
  }, [loadProjectData])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    router.replace(`/create-cover?projectId=${id}`, { scroll: false })
  }

  const syncCoverToProject = async (coverUrl: string) => {
    if (movie) {
      await MovieService.updateMovie(movie.id, { thumbnail: coverUrl })
    }
    if (treatment) {
      await TreatmentsService.updateTreatment(treatment.id, { cover_image_url: coverUrl })
    }
  }

  const createCoverAsset = async (
    contentUrl: string,
    options: {
      title?: string
      prompt?: string
      model?: string
      source: string
      originalFilename?: string
      setAsDefault?: boolean
    },
  ) => {
    if (!projectId) throw new Error("No project selected")

    const assetData = {
      project_id: projectId,
      treatment_id: treatment?.id ?? null,
      scene_id: null,
      title:
        options.title ??
        `Movie Cover - ${movie?.name || "Untitled"} - ${new Date().toLocaleDateString()}`,
      content_type: "image" as const,
      content: "",
      content_url: contentUrl,
      prompt: options.prompt ?? "",
      model: options.model ?? "manual_upload",
      generation_settings: {},
      metadata: {
        uploaded_at: new Date().toISOString(),
        source: options.source,
        movie_name: movie?.name || "Untitled",
        is_movie_cover: true,
        is_treatment_cover: !!treatment,
        original_filename: options.originalFilename,
        is_default_cover: options.setAsDefault ?? coverAssets.length === 0,
      },
    }

    const created = await AssetService.createAsset(assetData)

    if (options.setAsDefault || coverAssets.length === 0) {
      await AssetService.setDefaultCover(created.id)
      await syncCoverToProject(contentUrl)
    }

    return created
  }

  const reloadCovers = async (focusAssetId?: string) => {
    if (!projectId) return
    let projectCovers = await AssetService.getCoverImageAssets(projectId)
    let treatmentCovers: Asset[] = []
    if (treatment?.id) {
      treatmentCovers = await AssetService.getCoverImageAssetsForTreatment(treatment.id)
    }
    const merged = mergeCoverAssets(projectCovers, treatmentCovers)
    setCoverAssets(merged)
    if (focusAssetId) {
      setSelectedCoverId(focusAssetId)
    } else if (!merged.find((a) => a.id === selectedCoverId)) {
      const defaultAsset = merged.find((a) => a.is_default_cover)
      setSelectedCoverId(defaultAsset?.id ?? merged[0]?.id ?? null)
    }
    const allAssets = await AssetService.getAssetsForProject(projectId)
    setReferenceAssets(allAssets.filter((a) => a.content_type === "image" && a.content_url))
  }

  const uploadGeneratedImageToStorage = async (imageUrl: string, fileName: string): Promise<string> => {
    const response = await fetch("/api/ai/download-and-store-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, fileName, userId: user!.id }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || response.statusText)
    }
    const result = await response.json()
    if (!result.success || !result.supabaseUrl) {
      throw new Error("Failed to store image")
    }
    return result.supabaseUrl
  }

  const handleFileUpload = async (file: File) => {
    if (!projectId || !userId) return
    setIsUploading(true)
    try {
      const timestamp = Date.now()
      const fileExtension = file.name.split(".").pop() || "png"
      const safeFileName = sanitizeFilename(file.name)
      const fileName = `movie-cover-${projectId}-${timestamp}.${fileExtension}`
      const filePath = `${userId}/images/${fileName}`

      const supabase = getSupabaseClient()
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

      const created = await createCoverAsset(urlData.publicUrl, {
        prompt: `Manual upload: ${safeFileName}`,
        source: "create_cover_page_upload",
        originalFilename: file.name,
      })

      await reloadCovers(created.id)
      toast({ title: "Cover uploaded", description: "Added to your cover collection." })
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

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return
    setIsImporting(true)
    try {
      let finalUrl = importUrl.trim()
      if (!finalUrl.startsWith("http") && !finalUrl.startsWith("data:image")) {
        throw new Error("Enter a valid image URL")
      }

      if (finalUrl.startsWith("http") && !finalUrl.includes("supabase")) {
        finalUrl = await uploadGeneratedImageToStorage(finalUrl, `movie-cover-import-${Date.now()}`)
      }

      const created = await createCoverAsset(finalUrl, {
        prompt: `Imported from URL`,
        source: "create_cover_page_url_import",
      })

      setImportUrl("")
      await reloadCovers(created.id)
      toast({ title: "Cover imported", description: "Image added from URL." })
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

  const handleImportReference = async (asset: Asset) => {
    if (!asset.content_url) return
    setIsImporting(true)
    try {
      const created = await createCoverAsset(asset.content_url, {
        title: `Movie Cover (from reference) - ${movie?.name || "Untitled"}`,
        prompt: asset.prompt || `Imported reference: ${asset.title}`,
        model: asset.model || "reference_import",
        source: "create_cover_page_reference_import",
      })
      await reloadCovers(created.id)
      toast({ title: "Reference added", description: "Reference image added as a cover option." })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import reference.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const normalizeImageModel = (displayName: string | null | undefined): string => {
    if (!displayName) return "dall-e-3"
    const model = displayName.toLowerCase()
    if (model === "gpt image" || model.includes("gpt-image")) return "gpt-image-1"
    if (model.includes("dall") || model.includes("dalle")) return "dall-e-3"
    return "dall-e-3"
  }

  const handleGenerateCover = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Missing prompt", description: "Describe the cover you want.", variant: "destructive" })
      return
    }
    if (!ready || !user?.id) return

    const lockedModel = getImagesTabLockedModel()
    const serviceToUse = isImagesTabLocked() && lockedModel ? lockedModel : selectedAIService
    const normalizedModel = normalizeImageModel(lockedModel || serviceToUse)
    const normalizedService =
      serviceToUse.toLowerCase().includes("dall") || normalizedModel === "gpt-image-1"
        ? "dalle"
        : serviceToUse.toLowerCase().includes("openart")
          ? "openart"
          : serviceToUse.toLowerCase().includes("leonardo")
            ? "leonardo"
            : "dalle"

    const sanitizedPrompt = aiPrompt
      .replace(/godzilla/gi, "giant monster")
      .replace(/violence|blood|gore/gi, "action")
      .trim()

    const movieTitle = movie?.name || treatment?.title || "Movie"
    const fullPrompt = `Movie Art Cover for "${movieTitle}": ${sanitizedPrompt}. Cinematic style, dramatic lighting, no text, visual only.`

    if (fullPrompt.length > 1000) {
      toast({
        title: "Prompt too long",
        description: "Shorten your description (1000 character limit).",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const referenceUrls = selectedReferenceIds
        .map((id) => referenceAssets.find((a) => a.id === id)?.content_url)
        .filter(Boolean) as string[]

      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          service: normalizedService,
          model: normalizedModel,
          apiKey: "configured",
          userId: user.id,
          autoSaveToBucket: true,
          referenceImages: referenceUrls.length > 0 ? referenceUrls : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Generation failed")
      }

      const data = await response.json()
      let imageUrl = data.imageUrl as string
      if (imageUrl && !imageUrl.includes("supabase")) {
        imageUrl = await uploadGeneratedImageToStorage(imageUrl, `movie-cover-ai-${Date.now()}`)
      }

      const created = await createCoverAsset(imageUrl, {
        prompt: fullPrompt,
        model: normalizedModel,
        source: "create_cover_page_ai_generation",
      })

      await reloadCovers(created.id)
      toast({ title: "Cover generated", description: "AI cover added to your collection." })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate cover.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSetDefault = async (assetId: string) => {
    setIsSettingDefault(true)
    try {
      const asset = await AssetService.setDefaultCover(assetId)
      if (asset.content_url) {
        await syncCoverToProject(asset.content_url)
      }
      await reloadCovers(assetId)
      toast({ title: "Main cover set", description: "This cover is now the default for the project." })
    } catch (error) {
      toast({
        title: "Failed to set main cover",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSettingDefault(false)
    }
  }

  const handleUnsetDefault = async (assetId: string) => {
    setIsSettingDefault(true)
    try {
      await AssetService.unsetDefaultCover(assetId)
      await reloadCovers(assetId)
      toast({ title: "Main cover cleared", description: "No default cover is set." })
    } catch (error) {
      toast({
        title: "Failed to clear main cover",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSettingDefault(false)
    }
  }

  const handleDeleteCover = async (assetId: string) => {
    if (!confirm("Delete this cover from your collection?")) return
    setIsDeleting(true)
    try {
      const asset = coverAssets.find((a) => a.id === assetId)
      const wasDefault = asset?.is_default_cover
      await AssetService.deleteAsset(assetId)

      if (wasDefault) {
        const remaining = coverAssets.filter((a) => a.id !== assetId)
        if (remaining.length > 0) {
          const newDefault = await AssetService.setDefaultCover(remaining[0].id)
          if (newDefault.content_url) await syncCoverToProject(newDefault.content_url)
        } else if (treatment) {
          await TreatmentsService.updateTreatment(treatment.id, { cover_image_url: undefined })
        }
      }

      await reloadCovers()
      toast({ title: "Cover deleted", description: "Removed from your collection." })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete cover.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleReferenceSelection = (assetId: string) => {
    setSelectedReferenceIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : prev.length < 4 ? [...prev, assetId] : prev,
    )
  }

  const buildPromptFromProject = () => {
    const parts: string[] = []
    if (movie?.genre) parts.push(`${movie.genre} genre`)
    if (treatment?.logline) parts.push(treatment.logline)
    else if (treatment?.synopsis) parts.push(treatment.synopsis.slice(0, 300))
    else if (movie?.description) parts.push(movie.description.slice(0, 300))
    setAiPrompt(parts.join(". "))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Cover</h1>
          <p className="text-muted-foreground">
            Import references, generate options, and set the main cover for your movie.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Select Project</CardTitle>
            <CardDescription>Choose the movie you want to work on covers for.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectSelector
              selectedProject={projectId}
              onProjectChange={handleProjectChange}
              placeholder="Select a movie project"
            />
            {movie && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{movie.movie_status || movie.status}</Badge>
                {movie.genre && <Badge variant="secondary">{movie.genre}</Badge>}
                {treatment && (
                  <Link
                    href={`/viewmovie/${treatment.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View treatment
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {!projectId ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Select a project above to start working on covers.</p>
            </CardContent>
          </Card>
        ) : loadingCovers ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            Loading covers...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Preview */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="overflow-hidden">
                <div className="relative aspect-[2/3] max-h-[520px] bg-muted/30">
                  {selectedCover?.content_url ? (
                    <img
                      src={selectedCover.content_url}
                      alt={selectedCover.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ImageIcon className="h-16 w-16 mb-3 opacity-40" />
                      <p>No covers yet — import or generate one below.</p>
                    </div>
                  )}
                  {selectedCover?.is_default_cover && (
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-yellow-500 text-yellow-950 gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Main cover
                      </Badge>
                    </div>
                  )}
                </div>
                {selectedCover && (
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium truncate">{selectedCover.title}</p>
                    {selectedCover.prompt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedCover.prompt}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {!selectedCover.is_default_cover ? (
                        <Button
                          size="sm"
                          onClick={() => handleSetDefault(selectedCover.id)}
                          disabled={isSettingDefault}
                        >
                          {isSettingDefault ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Star className="h-4 w-4 mr-2" />
                          )}
                          Set as main
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnsetDefault(selectedCover.id)}
                          disabled={isSettingDefault}
                        >
                          Clear main
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (selectedCover.content_url) {
                            const link = document.createElement("a")
                            link.href = selectedCover.content_url
                            link.download = `cover-${selectedCover.id}.png`
                            link.click()
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCover(selectedCover.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Cover grid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your covers</CardTitle>
                  <CardDescription>
                    {coverAssets.length} option{coverAssets.length !== 1 ? "s" : ""}
                    {defaultCover ? " · main cover starred" : " · no main cover set yet"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {coverAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No covers in this project yet.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {coverAssets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => setSelectedCoverId(asset.id)}
                          className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all ${
                            selectedCoverId === asset.id
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <img
                            src={asset.content_url || ""}
                            alt={asset.title}
                            className="w-full h-full object-cover"
                          />
                          {asset.is_default_cover && (
                            <div className="absolute top-1 right-1 bg-yellow-500 rounded-full p-0.5">
                              <Star className="h-2.5 w-2.5 fill-yellow-950 text-yellow-950" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tools sidebar */}
            <div>
              <Tabs defaultValue="import">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="import">Import</TabsTrigger>
                  <TabsTrigger value="generate">Generate</TabsTrigger>
                </TabsList>

                <TabsContent value="import" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload file
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleFileUpload(file)
                        }}
                      />
                      {isUploading && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Uploading...
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Import from URL
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        disabled={isImporting}
                      />
                      <Button
                        className="w-full"
                        onClick={() => void handleImportUrl()}
                        disabled={isImporting || !importUrl.trim()}
                      >
                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Import URL
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Import from references
                      </CardTitle>
                      <CardDescription>
                        Pull images from your project assets into the cover collection.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {importableReferences.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No new reference images available. Add images in Assets or Visual Dev first.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                          {importableReferences.slice(0, 24).map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              disabled={isImporting}
                              onClick={() => void handleImportReference(asset)}
                              className="relative aspect-square rounded-md overflow-hidden border border-border hover:border-primary/60 hover:ring-2 hover:ring-primary/20 transition-all group"
                              title={asset.title}
                            >
                              <img
                                src={asset.content_url || ""}
                                alt={asset.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <CheckCircle2 className="h-5 w-5 text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="generate" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI cover generation
                      </CardTitle>
                      <CardDescription>
                        {aiSettingsLoaded && isImagesTabLocked()
                          ? `Using locked model: ${getImagesTabLockedModel()}`
                          : "Configure image models in AI Settings."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={buildPromptFromProject}>
                          Fill from project
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Describe the cover — mood, characters, setting, style..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={5}
                        disabled={isGenerating}
                      />

                      {referenceAssets.length > 0 && (
                        <>
                          <Separator />
                          <Label className="text-xs text-muted-foreground">
                            Style references (optional, up to 4)
                          </Label>
                          <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                            {referenceAssets.slice(0, 16).map((asset) => {
                              const selected = selectedReferenceIds.includes(asset.id)
                              return (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => toggleReferenceSelection(asset.id)}
                                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                                    selected ? "border-primary ring-2 ring-primary/30" : "border-border"
                                  }`}
                                >
                                  <img
                                    src={asset.content_url || ""}
                                    alt={asset.title}
                                    className="w-full h-full object-cover"
                                  />
                                  {selected && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                      <CheckCircle2 className="h-4 w-4 text-primary" />
                                    </div>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}

                      <Button
                        className="w-full"
                        onClick={() => void handleGenerateCover()}
                        disabled={isGenerating || !aiPrompt.trim()}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate cover
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
