"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  Package,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Star,
  Search,
  Save,
  Wand2,
  X,
  Link2,
} from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieService } from "@/lib/movie-service"
import {
  StoryObjectsService,
  STORY_OBJECT_CATEGORIES,
  type StoryObject,
  type StoryObjectCategory,
} from "@/lib/story-objects-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import {
  DEFAULT_CINEMATIC_IMAGE_HEIGHT,
  DEFAULT_CINEMATIC_IMAGE_WIDTH,
  displayModelSupportsReferenceImage,
  mapDisplayModelToService,
  migrateGPTImageDisplayLabel,
  normalizeDisplayModelToApiId,
} from "@/lib/image-model-utils"
import { CharactersService, type Character } from "@/lib/characters-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import {
  buildLinkedAssetGroups,
  getProjectAssetSourceLabel,
  referenceUrlToFile,
} from "@/lib/project-image-linking"
import { getSupabaseClient } from "@/lib/supabase"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel"
import { ImageSizeBadge } from "@/components/image-size-badge"

function categoryLabel(category: StoryObjectCategory): string {
  return STORY_OBJECT_CATEGORIES.find((item) => item.value === category)?.label ?? category
}

const MAX_LINKED_REFERENCE_IMAGES = 5

function normalizeLockedImageModel(
  displayName: string,
  options?: { withReferenceImage?: boolean },
): string {
  const lower = displayName.toLowerCase()
  if (lower.includes("runway")) {
    return options?.withReferenceImage ? "gen4_image_turbo" : "gen4_image"
  }
  return normalizeDisplayModelToApiId(displayName)
}

function lockedModelSupportsReferenceImage(model: string): boolean {
  return displayModelSupportsReferenceImage(model)
}

function buildObjectEditPrompt(userDirection: string, object: StoryObject): string {
  let prompt = userDirection.trim()
  if (object.name) {
    prompt += ` Object: ${object.name}.`
  }
  prompt +=
    " Edit the attached reference image only. Keep the same composition, subject, framing, and environment — change only what is described above. Do not add new elements."
  return prompt.slice(0, 990)
}

export default function ObjectsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { userId, ready } = useAuthReady()
  const { toast } = useToast()

  const [projectId, setProjectId] = useState(initialProject)
  const [objects, setObjects] = useState<StoryObject[]>([])
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [objectAssets, setObjectAssets] = useState<Asset[]>([])
  const [filter, setFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null)
  const [imagePrompt, setImagePrompt] = useState("")
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [projectImageAssets, setProjectImageAssets] = useState<Asset[]>([])
  const [projectCharacters, setProjectCharacters] = useState<Character[]>([])
  const [projectLocations, setProjectLocations] = useState<Location[]>([])
  const [isLoadingProjectAssets, setIsLoadingProjectAssets] = useState(false)
  const [referenceEditDialogOpen, setReferenceEditDialogOpen] = useState(false)
  const [referenceEditAsset, setReferenceEditAsset] = useState<Asset | null>(null)
  const [inlineCustomShotPrompt, setInlineCustomShotPrompt] = useState("")
  const [inlineShotReferenceFile, setInlineShotReferenceFile] = useState<File | null>(null)
  const [inlineShotReferencePreview, setInlineShotReferencePreview] = useState<string | null>(null)
  const [inlineStyleLinkAssetIds, setInlineStyleLinkAssetIds] = useState<string[]>([])
  const [isGeneratingShot, setIsGeneratingShot] = useState(false)
  const [shotGenerationProgress, setShotGenerationProgress] = useState("")

  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState<StoryObjectCategory>("prop")
  const [formDescription, setFormDescription] = useState("")
  const [formVisualDescription, setFormVisualDescription] = useState("")
  const [formMaterial, setFormMaterial] = useState("")
  const [formColor, setFormColor] = useState("")
  const [formEra, setFormEra] = useState("")
  const [formNotes, setFormNotes] = useState("")

  const selectedObject = objects.find((item) => item.id === selectedObjectId) ?? null
  const imageAssets = useMemo(
    () => objectAssets.filter((asset) => asset.content_type === "image" && asset.content_url),
    [objectAssets],
  )

  const filteredObjects = useMemo(() => {
    return objects.filter((item) => {
      const matchesSearch =
        !filter.trim() ||
        item.name.toLowerCase().includes(filter.toLowerCase()) ||
        item.description?.toLowerCase().includes(filter.toLowerCase())
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [objects, filter, categoryFilter])

  const linkableProjectAssets = useMemo(
    () =>
      projectImageAssets.filter(
        (asset) => !asset.story_object_id || asset.story_object_id !== selectedObjectId,
      ),
    [projectImageAssets, selectedObjectId],
  )

  const linkedAssetGroups = useMemo(() => {
    const groups: { label: string; assets: Asset[] }[] = []
    if (imageAssets.length > 0) {
      groups.push({ label: "This object", assets: imageAssets })
    }
    if (linkableProjectAssets.length > 0) {
      groups.push(
        ...buildLinkedAssetGroups(
          linkableProjectAssets,
          projectLocations,
          projectCharacters,
          objects,
        ),
      )
    }
    return groups
  }, [imageAssets, linkableProjectAssets, projectLocations, projectCharacters, objects])

  const findStyleLinkAsset = (assetId: string) =>
    objectAssets.find((asset) => asset.id === assetId) ??
    projectImageAssets.find((asset) => asset.id === assetId)

  const getImagesTabSetting = () => aiSettings.find((setting) => setting.tab_type === "images")

  const getLockedImageModelLabel = () => {
    const setting = getImagesTabSetting()
    if (setting?.is_locked && setting.locked_model) {
      return migrateGPTImageDisplayLabel(setting.locked_model)
    }
    return "Not locked"
  }

  const getLockedImageConfig = (options?: { withReferenceImage?: boolean }) => {
    const setting = getImagesTabSetting()
    if (!setting?.is_locked || !setting.locked_model) {
      return null
    }
    const lockedModel = setting.locked_model
    return {
      lockedModel,
      service: mapDisplayModelToService(lockedModel),
      apiModel: normalizeLockedImageModel(lockedModel, options),
      supportsReference: lockedModelSupportsReferenceImage(lockedModel),
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
    config: ReturnType<typeof requireLockedImageConfig>,
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

      return fetch("/api/ai/generate-image", {
        method: "POST",
        body: formData,
      })
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

  useEffect(() => {
    if (!carouselApi) return
    const onSelect = () => setCurrentImageIndex(carouselApi.selectedScrollSnap())
    onSelect()
    carouselApi.on("select", onSelect)
    return () => {
      carouselApi.off("select", onSelect)
    }
  }, [carouselApi])

  useEffect(() => {
    if (!ready) return
    AISettingsService.getSystemSettings()
      .then(setAiSettings)
      .catch((error) => console.error("Failed to load AI settings:", error))
  }, [ready])

  useEffect(() => {
    const load = async () => {
      if (!projectId) {
        setObjects([])
        return
      }
      setIsLoading(true)
      try {
        const movie = await MovieService.getMovieById(projectId)
        if (!movie) {
          toast({
            title: "Access denied",
            description: "You don't have access to this project.",
            variant: "destructive",
          })
          router.push("/movies")
          return
        }
        const rows = await StoryObjectsService.getStoryObjects(projectId)
        setObjects(rows)
      } catch (error) {
        console.error("Failed to load objects:", error)
        toast({
          title: "Error",
          description: "Failed to load objects.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [projectId, router, toast])

  useEffect(() => {
    if (objects.length > 0 && !selectedObjectId) {
      setSelectedObjectId(objects[0].id)
    }
  }, [objects, selectedObjectId])

  useEffect(() => {
    const loadAssets = async () => {
      if (!selectedObjectId) {
        setObjectAssets([])
        return
      }
      setIsLoadingAssets(true)
      try {
        const assets = await AssetService.getAssetsForStoryObject(selectedObjectId)
        setObjectAssets(assets)
      } catch (error) {
        console.error("Failed to load object assets:", error)
        setObjectAssets([])
      } finally {
        setIsLoadingAssets(false)
      }
    }
    loadAssets()
  }, [selectedObjectId])

  useEffect(() => {
    if (!selectedObject) {
      setImagePrompt("")
      return
    }
    setImagePrompt(
      selectedObject.visual_description?.trim() ||
        selectedObject.description?.trim() ||
        `Cinematic product shot of ${selectedObject.name}, ${categoryLabel(selectedObject.category).toLowerCase()}, studio lighting, high detail, no text`,
    )
  }, [selectedObject?.id])

  useEffect(() => {
    const loadProjectAssets = async () => {
      if (!projectId) {
        setProjectImageAssets([])
        setProjectCharacters([])
        setProjectLocations([])
        return
      }
      setIsLoadingProjectAssets(true)
      try {
        const [assets, characters, locations] = await Promise.all([
          AssetService.getAssetsForProject(projectId),
          CharactersService.getCharacters(projectId),
          LocationsService.getLocations(projectId),
        ])
        setProjectImageAssets(
          assets.filter((asset) => asset.content_type === "image" && asset.content_url),
        )
        setProjectCharacters(characters)
        setProjectLocations(locations)
      } catch (error) {
        console.error("Failed to load project assets:", error)
        setProjectImageAssets([])
        setProjectCharacters([])
        setProjectLocations([])
      } finally {
        setIsLoadingProjectAssets(false)
      }
    }
    loadProjectAssets()
  }, [projectId])

  const clearForm = () => {
    setEditingObjectId(null)
    setFormName("")
    setFormCategory("prop")
    setFormDescription("")
    setFormVisualDescription("")
    setFormMaterial("")
    setFormColor("")
    setFormEra("")
    setFormNotes("")
  }

  const openCreateDialog = () => {
    clearForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (object: StoryObject) => {
    setEditingObjectId(object.id)
    setFormName(object.name)
    setFormCategory(object.category)
    setFormDescription(object.description || "")
    setFormVisualDescription(object.visual_description || "")
    setFormMaterial(object.material || "")
    setFormColor(object.color || "")
    setFormEra(object.era || "")
    setFormNotes(object.notes || "")
    setIsDialogOpen(true)
  }

  const saveObject = async () => {
    if (!projectId || !formName.trim()) {
      toast({
        title: "Name required",
        description: "Enter a name for this object.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        category: formCategory,
        description: formDescription.trim() || null,
        visual_description: formVisualDescription.trim() || null,
        material: formMaterial.trim() || null,
        color: formColor.trim() || null,
        era: formEra.trim() || null,
        notes: formNotes.trim() || null,
      }

      if (editingObjectId) {
        const updated = await StoryObjectsService.updateStoryObject(editingObjectId, payload)
        setObjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        toast({ title: "Object updated", description: `"${updated.name}" saved.` })
      } else {
        const created = await StoryObjectsService.createStoryObject({
          project_id: projectId,
          ...payload,
        })
        setObjects((prev) => [created, ...prev])
        setSelectedObjectId(created.id)
        toast({ title: "Object created", description: `"${created.name}" added.` })
      }

      setIsDialogOpen(false)
      clearForm()
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save object.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const deleteObject = async (id: string) => {
    if (!confirm("Delete this object? This cannot be undone.")) return
    try {
      await StoryObjectsService.deleteStoryObject(id)
      setObjects((prev) => prev.filter((item) => item.id !== id))
      if (selectedObjectId === id) {
        setSelectedObjectId(null)
      }
      toast({ title: "Deleted", description: "Object removed." })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete object.",
        variant: "destructive",
      })
    }
  }

  const handleSetThumbnail = async (asset: Asset) => {
    if (!selectedObject || !asset.content_url) return
    try {
      const updated = await StoryObjectsService.updateStoryObject(selectedObject.id, {
        image_url: asset.content_url,
      })
      setObjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast({ title: "Thumbnail updated" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set thumbnail.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Delete this image?")) return
    try {
      await AssetService.deleteAsset(assetId)
      if (selectedObjectId) {
        const assets = await AssetService.getAssetsForStoryObject(selectedObjectId)
        setObjectAssets(assets)
      }
      toast({ title: "Image deleted" })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete image.",
        variant: "destructive",
      })
    }
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedObject || !projectId) return

    setIsUploading(true)
    try {
      const filePath = `${projectId}/objects/${selectedObject.id}/${Date.now()}_${file.name}`
      const { error } = await getSupabaseClient().storage
        .from("cinema_files")
        .upload(filePath, file)

      if (error) throw new Error(error.message)

      const { data: { publicUrl } } = getSupabaseClient().storage
        .from("cinema_files")
        .getPublicUrl(filePath)

      const savedAsset = await AssetService.createAsset({
        project_id: projectId,
        story_object_id: selectedObject.id,
        title: `${selectedObject.name} - ${file.name}`,
        content_type: "image",
        content_url: publicUrl,
        model: "manual_upload",
        metadata: {
          source: "object_upload",
          story_object_name: selectedObject.name,
        },
      })

      setObjectAssets((prev) => [savedAsset, ...prev])
      toast({ title: "Image uploaded" })
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload image.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  const saveGeneratedObjectShot = async (
    imageUrl: string,
    object: StoryObject,
    shotLabel: string,
    prompt: string,
    referenceAsset: Asset,
    model: string,
    service: string,
    styleAssetIds?: string[],
  ) => {
    const now = new Date()
    const dateStr = now.toLocaleDateString()
    const timeStr = now.toLocaleTimeString()
    const savedAsset = await AssetService.createAsset({
      project_id: projectId,
      story_object_id: object.id,
      title: `${object.name} - ${shotLabel} (${dateStr} ${timeStr})`,
      content_type: "image",
      content_url: imageUrl,
      prompt,
      model,
      generation_settings: {
        service,
        story_object_id: object.id,
        story_object_name: object.name,
        shot_label: shotLabel,
        reference_asset_id: referenceAsset.id,
        style_asset_id: styleAssetIds?.[0],
        style_asset_ids: styleAssetIds,
      },
      metadata: {
        story_object_name: object.name,
        generated_at: now.toISOString(),
        source: "object_image_edit",
        service,
        shot_label: shotLabel,
        reference_asset_id: referenceAsset.id,
        style_asset_id: styleAssetIds?.[0],
        style_asset_ids: styleAssetIds,
      },
    })
    setObjectAssets((prev) => [savedAsset, ...prev])
    setTimeout(() => carouselApi?.scrollTo(0), 100)
    return savedAsset
  }

  const generateObjectShotFromReference = async (
    referenceAsset: Asset,
    shotLabel: string,
    options?: {
      promptOverride?: string
      referenceFile?: File
      styleReferenceFiles?: File[]
      styleAssetIds?: string[]
    },
  ) => {
    if (!selectedObjectId || !userId || !ready || !referenceAsset.content_url || !selectedObject) {
      throw new Error("Select an object and reference image first.")
    }

    const config = requireLockedImageConfig({ withReferenceImage: true })
    const prompt = options?.promptOverride ?? buildObjectEditPrompt(shotLabel, selectedObject)

    const response = await requestLockedImageGeneration(prompt, config, {
      referenceFile: config.supportsReference
        ? options?.referenceFile ??
          (await referenceUrlToFile(
            referenceAsset.content_url,
            `object-ref-${referenceAsset.id}.png`,
          ))
        : undefined,
      styleReferenceFiles: config.supportsReference ? options?.styleReferenceFiles : undefined,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to edit image from reference")
    }

    const result = await response.json()
    if (!result.success || !result.imageUrl) {
      throw new Error("Failed to edit image from reference")
    }

    const imageUrlToUse = result.bucketUrl || result.imageUrl
    await saveGeneratedObjectShot(
      imageUrlToUse,
      selectedObject,
      shotLabel,
      prompt,
      referenceAsset,
      config.apiModel,
      config.service,
      options?.styleAssetIds,
    )
  }

  const clearInlineShotReference = () => {
    if (inlineShotReferencePreview) {
      URL.revokeObjectURL(inlineShotReferencePreview)
    }
    setInlineShotReferenceFile(null)
    setInlineShotReferencePreview(null)
  }

  const handleInlineShotReferenceSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (inlineShotReferencePreview) {
      URL.revokeObjectURL(inlineShotReferencePreview)
    }
    setInlineShotReferenceFile(file)
    setInlineShotReferencePreview(URL.createObjectURL(file))
    event.target.value = ""
  }

  const clearInlineStyleLink = () => {
    setInlineStyleLinkAssetIds([])
  }

  const toggleInlineStyleLinkAsset = (assetId: string) => {
    setInlineStyleLinkAssetIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId)
      }
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

  const clearInlineReferenceEditState = () => {
    setInlineCustomShotPrompt("")
    clearInlineShotReference()
    clearInlineStyleLink()
  }

  const openReferenceEditDialog = (asset?: Asset) => {
    const targetAsset = asset ?? imageAssets[currentImageIndex] ?? imageAssets[0]
    if (!targetAsset?.content_url) {
      toast({
        title: "No image",
        description: "Upload or generate an object image first.",
        variant: "destructive",
      })
      return
    }

    setReferenceEditAsset(targetAsset)
    clearInlineReferenceEditState()
    const assetIndex = imageAssets.findIndex((item) => item.id === targetAsset.id)
    if (assetIndex >= 0) {
      carouselApi?.scrollTo(assetIndex)
    }
    setReferenceEditDialogOpen(true)
  }

  const closeReferenceEditDialog = () => {
    setReferenceEditDialogOpen(false)
    setReferenceEditAsset(null)
    clearInlineReferenceEditState()
  }

  const renderObjectReferenceEdit = (
    referenceAsset: Asset,
    idPrefix: string,
    inDialog = false,
  ) => {
    const lockedModel = getLockedImageModelLabel()
    const lockedConfig = getLockedImageConfig({ withReferenceImage: true })

    return (
      <div
        className={
          inDialog
            ? "space-y-3 min-w-0 w-full overflow-hidden"
            : "border border-violet-500/20 rounded-lg p-4 bg-violet-500/5 space-y-3"
        }
      >
        {!inDialog && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-violet-500" />
                Reference Image Edit
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Edit the selected object image using your locked model ({lockedModel})
                {lockedConfig?.supportsReference
                  ? " and optional project references."
                  : ". Your locked model does not support reference editing — use GPT Image 2 or Runway ML."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-violet-500/30 text-violet-600 hover:bg-violet-500/10 shrink-0"
              onClick={() => openReferenceEditDialog(referenceAsset)}
              disabled={!lockedConfig?.supportsReference}
            >
              <Wand2 className="h-4 w-4" />
              Edit Image
            </Button>
          </div>
        )}

        {inDialog && (
          <p className="text-xs text-muted-foreground break-words">
            Edit using your locked model ({lockedModel}).
            {lockedConfig?.supportsReference
              ? " The selected image is used as the primary reference unless you upload another."
              : " Your locked model does not support reference editing — use GPT Image 2 or Runway ML."}
          </p>
        )}

        {isGeneratingShot && shotGenerationProgress ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {shotGenerationProgress}
            {inDialog ? (
              <span className="text-muted-foreground/80">
                — you can close this window and keep working
              </span>
            ) : null}
          </p>
        ) : null}

        {inDialog ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-inline-edit`} className="text-xs sm:text-sm">
              Describe your edit
            </Label>
            <Textarea
              id={`${idPrefix}-inline-edit`}
              value={inlineCustomShotPrompt}
              onChange={(e) => setInlineCustomShotPrompt(e.target.value)}
              placeholder='e.g., add rust on the bumper, change to matte black paint, closer detail on the handle'
              className="bg-input border-border min-h-[72px] text-xs sm:text-sm resize-none"
              disabled={isGeneratingShot}
            />
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-ref-upload`} className="text-xs text-muted-foreground">
                Primary reference (optional)
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={`${idPrefix}-ref-upload`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInlineShotReferenceSelect}
                  disabled={isGeneratingShot}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isGeneratingShot}
                  onClick={() => document.getElementById(`${idPrefix}-ref-upload`)?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload reference
                </Button>
                {inlineShotReferencePreview && (
                  <>
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-primary ring-2 ring-primary/40">
                      <img
                        src={inlineShotReferencePreview}
                        alt="Uploaded reference"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isGeneratingShot}
                      onClick={clearInlineShotReference}
                      title="Remove uploaded reference"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {!inlineShotReferencePreview && referenceAsset.content_url && (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border">
                    <img
                      src={referenceAsset.content_url}
                      alt="Current object image"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground break-words">
                {inlineShotReferenceFile
                  ? "Using your uploaded image as the primary reference."
                  : "Uses the selected object image if you don't upload one."}
              </p>
            </div>

            {(linkedAssetGroups.length > 0 || isLoadingProjectAssets) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs text-muted-foreground">
                    Link existing image (optional)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adds more images from your project as references — this object, other objects, locations, characters, and covers. Select up to {MAX_LINKED_REFERENCE_IMAGES}. Your description above is the only prompt.
                </p>
                {isLoadingProjectAssets ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading project assets…
                  </div>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto rounded-lg border border-border/60 p-2">
                    {linkedAssetGroups.map((group) => (
                      <div key={group.label} className="space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          {group.label}
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {group.assets.map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              disabled={isGeneratingShot}
                              onClick={() => toggleInlineStyleLinkAsset(asset.id)}
                              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                inlineStyleLinkAssetIds.includes(asset.id)
                                  ? "border-violet-500 ring-2 ring-violet-500/40"
                                  : "border-border hover:border-violet-500/50"
                              }`}
                              title={`${getProjectAssetSourceLabel(asset, projectLocations, projectCharacters, objects)} — ${asset.title.replace(/ - AI Generated Image.*$/, "")}`}
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
                {inlineStyleLinkAssetIds.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-violet-400">
                      {inlineStyleLinkAssetIds.length} of {MAX_LINKED_REFERENCE_IMAGES} linked as additional references
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isGeneratingShot}
                      onClick={clearInlineStyleLink}
                    >
                      Clear all
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Button
                size="sm"
                onClick={handleGenerateInlineCustomShot}
                disabled={
                  isGeneratingShot ||
                  !inlineCustomShotPrompt.trim() ||
                  !lockedConfig?.supportsReference
                }
                className="gap-2 w-full sm:w-auto"
              >
                {isGeneratingShot && inlineCustomShotPrompt.trim() ? (
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
          </div>
        ) : null}
      </div>
    )
  }

  const handleGenerateInlineCustomShot = async () => {
    const direction = inlineCustomShotPrompt.trim()
    if (!direction) {
      toast({
        title: "Description required",
        description: 'Enter what you want, e.g. "add rust" or "change to red paint".',
        variant: "destructive",
      })
      return
    }

    const referenceAsset =
      referenceEditAsset ?? (imageAssets[currentImageIndex] || imageAssets[0])
    if (!referenceAsset || !selectedObject) return

    const lockedConfig = getLockedImageConfig({ withReferenceImage: true })
    if (!lockedConfig?.supportsReference) {
      toast({
        title: "Model not supported",
        description:
          "Your locked image model does not support reference editing. Lock GPT Image 2 or Runway ML in AI Settings.",
        variant: "destructive",
      })
      return
    }

    const shotLabel =
      direction.length > 48 ? `${direction.slice(0, 45).trim()}...` : direction

    let styleReferenceFiles: File[] = []
    for (const assetId of inlineStyleLinkAssetIds) {
      const styleAsset = findStyleLinkAsset(assetId)
      if (styleAsset?.content_url) {
        styleReferenceFiles.push(
          await referenceUrlToFile(
            styleAsset.content_url,
            `style-ref-${styleAsset.id}.png`,
          ),
        )
      }
    }

    setIsGeneratingShot(true)
    setShotGenerationProgress("Editing image...")
    try {
      await generateObjectShotFromReference(referenceAsset, shotLabel, {
        promptOverride: buildObjectEditPrompt(direction, selectedObject),
        referenceFile: inlineShotReferenceFile ?? undefined,
        styleReferenceFiles,
        styleAssetIds: inlineStyleLinkAssetIds,
      })
      clearInlineReferenceEditState()
      if (referenceEditDialogOpen) {
        closeReferenceEditDialog()
      }
      toast({
        title: "Image edited",
        description: "Your edited object image was added to assets.",
      })
    } catch (error) {
      toast({
        title: "Edit failed",
        description: getImageGenerationErrorMessage(
          error,
          "Could not edit the object image.",
        ),
        variant: "destructive",
      })
    } finally {
      setIsGeneratingShot(false)
      setShotGenerationProgress("")
    }
  }

  const handleGenerateImage = async () => {
    if (!selectedObject || !projectId || !userId || !imagePrompt.trim()) return

    const imagesSetting = aiSettings.find((setting) => setting.tab_type === "images")
    if (!imagesSetting?.is_locked || !imagesSetting.locked_model) {
      toast({
        title: "AI not available",
        description: "Lock an image model in AI Settings first.",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingImage(true)
    try {
      const displayModel = migrateGPTImageDisplayLabel(imagesSetting.locked_model)
      const finalPrompt = `${imagePrompt.trim()}. Cinematic object photography, professional product shot, high detail, no text, no watermark`

      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt.slice(0, 990),
          service: mapDisplayModelToService(displayModel),
          apiKey: "configured",
          userId,
          model: normalizeDisplayModelToApiId(displayModel),
          width: DEFAULT_CINEMATIC_IMAGE_WIDTH,
          height: DEFAULT_CINEMATIC_IMAGE_HEIGHT,
          autoSaveToBucket: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to generate image")
      }

      const result = await response.json()
      if (!result.success || !result.imageUrl) {
        throw new Error("Failed to generate image")
      }

      const imageUrl = result.bucketUrl || result.imageUrl
      const now = new Date()
      const savedAsset = await AssetService.createAsset({
        project_id: projectId,
        story_object_id: selectedObject.id,
        title: `${selectedObject.name} - AI Image (${now.toLocaleDateString()} ${now.toLocaleTimeString()})`,
        content_type: "image",
        content_url: imageUrl,
        prompt: imagePrompt.trim(),
        model: displayModel,
        metadata: {
          source: "object_ai_generation",
          story_object_name: selectedObject.name,
        },
      })

      setObjectAssets((prev) => [savedAsset, ...prev])
      setTimeout(() => carouselApi?.scrollTo(0), 100)
      toast({ title: "Image generated", description: "Added to object assets." })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate image.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-7 w-7 text-primary" />
                Objects
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Cars, props, weapons, and other story items — separate from characters and locations.
              </p>
            </div>
            <ProjectSelector
              selectedProjectId={projectId}
              onProjectChange={(id) => {
                setProjectId(id)
                setSelectedObjectId(null)
                router.replace(`/objects?movie=${id}`)
              }}
            />
          </div>
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a project to manage objects.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <Card className="cinema-card h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Object List</CardTitle>
                  <Button size="sm" onClick={openCreateDialog} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Search objects..."
                      className="pl-8"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {STORY_OBJECT_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredObjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No objects yet. Add a car, prop, or item to get started.
                  </p>
                ) : (
                  filteredObjects.map((object) => (
                    <button
                      key={object.id}
                      type="button"
                      onClick={() => setSelectedObjectId(object.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedObjectId === object.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                          {object.image_url ? (
                            <img src={object.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{object.name}</p>
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            {categoryLabel(object.category)}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="cinema-card">
              {!selectedObject ? (
                <CardContent className="py-16 text-center text-muted-foreground">
                  Select an object or create one to view details and images.
                </CardContent>
              ) : (
                <>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 flex-wrap">
                          {selectedObject.name}
                          <Badge>{categoryLabel(selectedObject.category)}</Badge>
                        </CardTitle>
                        {selectedObject.description && (
                          <p className="text-sm text-muted-foreground mt-2">{selectedObject.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedObject)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteObject(selectedObject.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {selectedObject.visual_description && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Visual</p>
                          <p>{selectedObject.visual_description}</p>
                        </div>
                      )}
                      {selectedObject.material && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Material</p>
                          <p>{selectedObject.material}</p>
                        </div>
                      )}
                      {selectedObject.color && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Color</p>
                          <p>{selectedObject.color}</p>
                        </div>
                      )}
                      {selectedObject.era && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Era</p>
                          <p>{selectedObject.era}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 border-t border-border pt-4">
                      <Label className="text-xs text-muted-foreground">Images ({imageAssets.length})</Label>
                      {isLoadingAssets ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading images...
                        </div>
                      ) : imageAssets.length > 0 ? (
                        <div className="space-y-3">
                          <Carousel className="w-full" setApi={setCarouselApi}>
                            <CarouselContent>
                              {imageAssets.map((asset, index) => (
                                <CarouselItem key={asset.id}>
                                  <div className="relative group aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                                    <img
                                      src={asset.content_url!}
                                      alt={asset.title}
                                      className="w-full h-full object-cover object-center pointer-events-none"
                                    />
                                    <ImageSizeBadge src={asset.content_url!} />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 pointer-events-none">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openReferenceEditDialog(asset)
                                        }}
                                        className="h-8 pointer-events-auto hover:text-violet-500"
                                        title="Edit image from reference"
                                      >
                                        <Wand2 className="h-3 w-3 mr-1" />
                                        Edit Image
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleSetThumbnail(asset)
                                        }}
                                        className="h-8 bg-blue-500 hover:bg-blue-600 pointer-events-auto"
                                        title="Set as main thumbnail"
                                      >
                                        <Star className="h-3 w-3 mr-1" />
                                        Thumbnail
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteAsset(asset.id)
                                        }}
                                        className="h-8 pointer-events-auto"
                                      >
                                        <Trash2 className="h-3 w-3 text-white" />
                                      </Button>
                                    </div>
                                    <div className="absolute top-2 left-2 flex items-center gap-2">
                                      <div className="bg-black/70 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
                                        {index + 1} / {imageAssets.length}
                                      </div>
                                      {selectedObject.image_url === asset.content_url && (
                                        <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs backdrop-blur-sm flex items-center gap-1">
                                          <Star className="h-3 w-3 fill-current" />
                                          Thumbnail
                                        </div>
                                      )}
                                    </div>
                                    <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs backdrop-blur-sm max-w-[80%] truncate">
                                      {asset.title.replace(/ - AI Generated Image.*$/, "")}
                                    </div>
                                  </div>
                                </CarouselItem>
                              ))}
                            </CarouselContent>
                            {imageAssets.length > 1 && (
                              <>
                                <CarouselPrevious className="left-2 z-10" />
                                <CarouselNext className="right-2 z-10" />
                              </>
                            )}
                          </Carousel>

                          {imageAssets.length > 1 && (
                            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
                              {imageAssets.map((asset, index) => (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => carouselApi?.scrollTo(index)}
                                  className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                    index === currentImageIndex
                                      ? "border-primary ring-2 ring-primary/50"
                                      : "border-border hover:border-primary/50"
                                  }`}
                                  title="Click to navigate to this image"
                                >
                                  <img
                                    src={asset.content_url!}
                                    alt={asset.title}
                                    className="w-full h-full object-cover"
                                  />
                                  {index === currentImageIndex && (
                                    <div className="absolute inset-0 bg-primary/20" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}

                          {isGeneratingShot && shotGenerationProgress ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {shotGenerationProgress}
                            </p>
                          ) : null}

                          {renderObjectReferenceEdit(
                            imageAssets[currentImageIndex] || imageAssets[0],
                            "object-inline-edit",
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                          No images yet. Upload or generate one below.
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 border-t border-border pt-4">
                      <Label htmlFor="object-image-prompt">Image prompt</Label>
                      <Textarea
                        id="object-image-prompt"
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        className="min-h-[80px]"
                        placeholder="Describe the object image you want..."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleGenerateImage}
                          disabled={isGeneratingImage || !imagePrompt.trim()}
                          className="gap-2"
                        >
                          {isGeneratingImage ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          Generate Image
                        </Button>
                        <input
                          id="object-image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button
                          variant="outline"
                          disabled={isUploading}
                          onClick={() => document.getElementById("object-image-upload")?.click()}
                          className="gap-2"
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Upload Image
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingObjectId ? "Edit Object" : "New Object"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="object-name">Name</Label>
              <Input
                id="object-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder='e.g. 1972 Ford Bronco, Detective revolver'
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={(value) => setFormCategory(value as StoryObjectCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORY_OBJECT_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-description">Description</Label>
              <Textarea
                id="object-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What is this object and how does it appear in the story?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-visual">Visual description</Label>
              <Textarea
                id="object-visual"
                value={formVisualDescription}
                onChange={(e) => setFormVisualDescription(e.target.value)}
                placeholder="Appearance details for image generation"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="object-material">Material</Label>
                <Input id="object-material" value={formMaterial} onChange={(e) => setFormMaterial(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="object-color">Color</Label>
                <Input id="object-color" value={formColor} onChange={(e) => setFormColor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-era">Era / period</Label>
              <Input id="object-era" value={formEra} onChange={(e) => setFormEra(e.target.value)} placeholder="e.g. 1970s, modern" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-notes">Notes</Label>
              <Textarea id="object-notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveObject} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={referenceEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeReferenceEditDialog()
        }}
      >
        <DialogContent className="cinema-card border-border w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader className="pb-2 min-w-0">
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 min-w-0 pr-8 break-words">
              <Wand2 className="h-5 w-5 text-violet-500" />
              Edit Image
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              {referenceEditAsset
                ? `Reference edit for ${(referenceEditAsset.title || "object image").replace(/ - AI Generated Image.*$/, "")}.`
                : "Edit this object image from a reference."}
            </DialogDescription>
          </DialogHeader>

          {referenceEditAsset?.content_url && (
            <div className="min-w-0 w-full overflow-hidden space-y-4">
              <div className="rounded-lg overflow-hidden border border-border bg-muted/30 max-h-40">
                <img
                  src={referenceEditAsset.content_url}
                  alt={referenceEditAsset.title}
                  className="w-full h-full max-h-40 object-contain"
                />
              </div>
              {renderObjectReferenceEdit(
                referenceEditAsset,
                "object-reference-edit-dialog",
                true,
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
