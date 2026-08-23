"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  RefreshCw,
  Image as ImageIcon,
  LayoutGrid,
  Upload,
  X,
  Download,
  Save,
  Star,
  Trash2,
  Wand2,
  Images,
  Eye,
  Link2,
  Pencil,
  Plus,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AssetService, type Asset } from "@/lib/asset-service"
import { AISettingsService } from "@/lib/ai-settings-service"
import {
  DEFAULT_CINEMATIC_IMAGE_HEIGHT,
  DEFAULT_CINEMATIC_IMAGE_WIDTH,
  displayModelSupportsReferenceImage,
  mapDisplayModelToService,
  migrateGPTImageDisplayLabel,
  normalizeDisplayModelToApiId,
} from "@/lib/image-model-utils"
import {
  OBJECT_ANGLES,
  OBJECT_REFERENCE_COLLAGE_ANGLE_ID,
  OBJECT_TURNAROUND_ANGLE_IDS,
  buildObjectAngleEditPrompt,
  createCustomObjectAngle,
  type ObjectAngle,
} from "@/lib/object-angles"
import {
  buildCollageSourceItems,
  isAngleCollageReferenceAsset,
  SINGLE_ANGLE_SHOT_INSTRUCTION,
} from "@/lib/angle-shot-prompt"
import { buildAvatarCollageBlob } from "@/lib/avatar-collage"
import { referenceUrlToFile } from "@/lib/project-image-linking"
import { StorageService } from "@/lib/storage-service"
import type { StoryObject } from "@/lib/story-objects-service"
import {
  SavedPromptsService,
  formatSavedPromptOptionLabel,
  type SavedPrompt,
} from "@/lib/saved-prompts-service"
import { cn } from "@/lib/utils"
import { StorageThumbImg } from "@/components/storage-thumb-img"

/** Resized previews in Edit Image — full URL is used for popup + AI reference. */
const EDIT_PREVIEW_THUMB_WIDTH = 480
const EDIT_SMALL_THUMB_WIDTH = 128
const EDIT_THUMB_QUALITY = 65

const MAX_LINKED_REFERENCE_IMAGES = 5

interface ObjectAngleImage {
  id: string
  imageUrl: string
  prompt: string
  source: "from_reference" | "existing" | "generated" | "collage"
  assetId?: string
  saved: boolean
}

interface AngleGallery {
  images: ObjectAngleImage[]
  selectedIndex: number
}

type AngleGalleries = Record<string, AngleGallery>

interface SourceReference {
  imageUrl: string
  previewUrl: string
  file?: File
  assetId?: string
  title: string
}

interface ObjectAngleStudioProps {
  projectId: string
  userId: string
  ready: boolean
  object: StoryObject
  imageAssets: Asset[]
  objectAssets: Asset[]
  onObjectAssetsChange: (assets: Asset[]) => void
  primaryReferenceAsset?: Asset | null
  pickableImageGroups?: { label: string; assets: Asset[] }[]
  onSetThumbnail?: (imageUrl: string) => Promise<void>
  thumbnailUrl?: string | null
}

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

function createAngleImage(image: Omit<ObjectAngleImage, "id">): ObjectAngleImage {
  return {
    ...image,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

function isObjectAngleAsset(asset: Asset, objectId: string): boolean {
  return (
    asset.story_object_id === objectId &&
    asset.metadata?.type === "object_angle" &&
    typeof asset.metadata?.object_angle === "string" &&
    asset.metadata.object_angle !== OBJECT_REFERENCE_COLLAGE_ANGLE_ID &&
    Boolean(asset.content_url)
  )
}

function buildGalleriesFromObjectAssets(assets: Asset[], objectId: string): AngleGalleries {
  const galleries: AngleGalleries = {}
  const angleAssets = assets
    .filter((asset) => isObjectAngleAsset(asset, objectId))
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

  for (const asset of angleAssets) {
    const angleId = asset.metadata!.object_angle as string
    const gallery = galleries[angleId] ?? { images: [], selectedIndex: 0 }
    gallery.images.push({
      id: asset.id,
      imageUrl: asset.content_url!,
      prompt: asset.prompt || (asset.metadata?.object_angle_label as string) || "",
      source:
        (asset.metadata?.object_angle_source as ObjectAngleImage["source"]) || "generated",
      assetId: asset.id,
      saved: true,
    })
    galleries[angleId] = gallery
  }

  for (const angleId of Object.keys(galleries)) {
    const gallery = galleries[angleId]
    if (gallery.images.length > 0) {
      gallery.selectedIndex = gallery.images.length - 1
    }
  }

  return galleries
}

function getGalleryStorageKey(projectId: string, userId: string, objectId: string) {
  return `object-angle-galleries-${projectId}-${userId}-${objectId}`
}

function loadCachedGalleries(
  projectId: string,
  userId: string,
  objectId: string,
): AngleGalleries {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(getGalleryStorageKey(projectId, userId, objectId))
    if (!raw) return {}
    return JSON.parse(raw) as AngleGalleries
  } catch {
    return {}
  }
}

function saveCachedGalleries(
  projectId: string,
  userId: string,
  objectId: string,
  galleries: AngleGalleries,
) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      getGalleryStorageKey(projectId, userId, objectId),
      JSON.stringify(galleries),
    )
  } catch {
    // ignore quota errors
  }
}

export function ObjectAngleStudio({
  projectId,
  userId,
  ready,
  object,
  imageAssets,
  objectAssets,
  onObjectAssetsChange,
  primaryReferenceAsset,
  pickableImageGroups = [],
  onSetThumbnail,
  thumbnailUrl,
}: ObjectAngleStudioProps) {
  const { toast } = useToast()
  const hydrationKeyRef = useRef<string | null>(null)
  const syncedPrimaryAssetIdRef = useRef<string | null>(null)

  const [selectedAngles, setSelectedAngles] = useState<string[]>([
    ...OBJECT_TURNAROUND_ANGLE_IDS,
  ])
  const [objectShots, setObjectShots] = useState<ObjectAngle[]>([...OBJECT_ANGLES])
  const [shotDialogOpen, setShotDialogOpen] = useState(false)
  const [editingShotId, setEditingShotId] = useState<string | null>(null)
  const [shotFormLabel, setShotFormLabel] = useState("")
  const [shotFormPrompt, setShotFormPrompt] = useState("")
  const [angleGalleries, setAngleGalleries] = useState<AngleGalleries>({})
  const [sourceReference, setSourceReference] = useState<SourceReference | null>(null)
  const [generatingAngleIds, setGeneratingAngleIds] = useState<Set<string>>(() => new Set())
  const [generatingProgressByAngleId, setGeneratingProgressByAngleId] = useState<
    Map<string, string>
  >(() => new Map())
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [collagePreviewUrl, setCollagePreviewUrl] = useState<string | null>(null)
  const [collagePreviewBlob, setCollagePreviewBlob] = useState<Blob | null>(null)
  const [isBuildingCollage, setIsBuildingCollage] = useState(false)
  const [isSavingCollage, setIsSavingCollage] = useState(false)
  const [isDeletingCollage, setIsDeletingCollage] = useState(false)
  const [settingThumbnailUrl, setSettingThumbnailUrl] = useState<string | null>(null)
  const [pickDialogAngleId, setPickDialogAngleId] = useState<string | null>(null)
  const [sourcePickDialogOpen, setSourcePickDialogOpen] = useState(false)
  const [imageEditDialogOpen, setImageEditDialogOpen] = useState(false)
  const [imageEditAngleId, setImageEditAngleId] = useState<string | null>(null)
  const [imageEditPrompt, setImageEditPrompt] = useState("")
  const [imageEditReferenceFile, setImageEditReferenceFile] = useState<File | null>(null)
  const [imageEditReferencePreview, setImageEditReferencePreview] = useState<string | null>(null)
  const [imageEditStyleLinkAssetIds, setImageEditStyleLinkAssetIds] = useState<string[]>([])
  const [viewImageDialog, setViewImageDialog] = useState<{
    url: string
    label: string
  } | null>(null)
  const [lockedImageModelLabel, setLockedImageModelLabel] = useState("Not locked")
  const [supportsReferenceEdit, setSupportsReferenceEdit] = useState(false)
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  const [isLoadingSavedPrompts, setIsLoadingSavedPrompts] = useState(false)
  const [selectedEditPromptId, setSelectedEditPromptId] = useState("")

  const savedCollageAsset = useMemo(
    () =>
      objectAssets.find(
        (asset) =>
          asset.story_object_id === object.id &&
          asset.metadata?.type === "object_angle" &&
          asset.metadata?.object_angle === OBJECT_REFERENCE_COLLAGE_ANGLE_ID &&
          asset.content_url,
      ) ?? null,
    [objectAssets, object.id],
  )

  const collageDisplayUrl = collagePreviewUrl || savedCollageAsset?.content_url || null

  const totalImageCount = useMemo(
    () => Object.values(angleGalleries).reduce((sum, gallery) => sum + gallery.images.length, 0),
    [angleGalleries],
  )

  const collageSourceItems = useMemo(
    () =>
      buildCollageSourceItems({
        shots: objectShots,
        angleGalleries,
        assets: objectAssets,
        entityId: object.id,
        isAngleAsset: isObjectAngleAsset,
        readAngleId: (asset) =>
          typeof asset.metadata?.object_angle === "string"
            ? asset.metadata.object_angle
            : undefined,
      }),
    [objectShots, angleGalleries, objectAssets, object.id],
  )

  const savedAngleAssetCount = useMemo(
    () => objectAssets.filter((asset) => isObjectAngleAsset(asset, object.id)).length,
    [objectAssets, object.id],
  )

  const hasAnyImages = totalImageCount > 0 || savedAngleAssetCount > 0
  const showCollageSection = collageSourceItems.length > 0 || Boolean(savedCollageAsset)

  const allPickableAssets = useMemo(
    () => pickableImageGroups.flatMap((group) => group.assets),
    [pickableImageGroups],
  )

  const referencePickerAssets = useMemo(
    () => imageAssets.filter((asset) => !isAngleCollageReferenceAsset(asset)),
    [imageAssets],
  )

  const pickDialogAngle = useMemo(
    () => objectShots.find((angle) => angle.id === pickDialogAngleId) ?? null,
    [pickDialogAngleId, objectShots],
  )

  const imageEditAngle = useMemo(
    () => objectShots.find((angle) => angle.id === imageEditAngleId) ?? null,
    [imageEditAngleId, objectShots],
  )

  const imageEditCurrentImage = useMemo(() => {
    if (!imageEditAngleId) return null
    const gallery = angleGalleries[imageEditAngleId]
    if (!gallery) return null
    return gallery.images[gallery.selectedIndex] ?? null
  }, [imageEditAngleId, angleGalleries])

  const startAngleJob = (angleId: string, progress: string) => {
    setGeneratingAngleIds((prev) => new Set(prev).add(angleId))
    setGeneratingProgressByAngleId((prev) => new Map(prev).set(angleId, progress))
  }

  const setAngleJobProgress = (angleId: string, progress: string) => {
    setGeneratingProgressByAngleId((prev) => new Map(prev).set(angleId, progress))
  }

  const finishAngleJob = (angleId: string) => {
    setGeneratingAngleIds((prev) => {
      const next = new Set(prev)
      next.delete(angleId)
      return next
    })
    setGeneratingProgressByAngleId((prev) => {
      const next = new Map(prev)
      next.delete(angleId)
      return next
    })
  }

  const isAngleGenerating = (angleId: string) => generatingAngleIds.has(angleId)

  const angleGenerationProgress = (angleId: string) =>
    generatingProgressByAngleId.get(angleId)

  useEffect(() => {
    if (!ready) return
    AISettingsService.getOrCreateDefaultTabSetting("images")
      .then((setting) => {
        if (setting?.is_locked && setting.locked_model) {
          const label = migrateGPTImageDisplayLabel(setting.locked_model)
          setLockedImageModelLabel(label)
          setSupportsReferenceEdit(displayModelSupportsReferenceImage(label))
        } else {
          setLockedImageModelLabel("Not locked")
          setSupportsReferenceEdit(false)
        }
      })
      .catch(() => {
        setLockedImageModelLabel("Not locked")
        setSupportsReferenceEdit(false)
      })
  }, [ready])

  useEffect(() => {
    if (!ready || !userId) {
      setSavedPrompts([])
      return
    }
    setIsLoadingSavedPrompts(true)
    SavedPromptsService.getSavedPrompts(userId, projectId || null)
      .then(setSavedPrompts)
      .catch(() => setSavedPrompts([]))
      .finally(() => setIsLoadingSavedPrompts(false))
  }, [ready, userId, projectId])

  const hasSavedPromptOptions =
    savedPrompts.length > 0 || Boolean(object.visual_description?.trim())

  const handleSavedPromptSelect = (value: string) => {
    if (value === "__none__") {
      setSelectedEditPromptId("")
      return
    }

    if (value === "__object_visual__") {
      const visual = object.visual_description?.trim()
      if (!visual) return
      setSelectedEditPromptId(value)
      setImageEditPrompt(visual)
      toast({ title: "Prompt applied", description: "Loaded object visual description." })
      return
    }

    const saved = savedPrompts.find((p) => p.id === value)
    if (!saved) return
    setSelectedEditPromptId(value)
    setImageEditPrompt(saved.prompt.trim())
    toast({ title: "Prompt applied", description: "Loaded into edit field." })
  }

  const hydrateGalleries = useCallback(() => {
    const assetsSignature = objectAssets
      .map((asset) => asset.id)
      .sort()
      .join(",")
    const hydrationKey = `${projectId}:${userId}:${object.id}:${assetsSignature}`
    if (hydrationKeyRef.current === hydrationKey) return

    const fromAssets = buildGalleriesFromObjectAssets(objectAssets, object.id)
    const cached = loadCachedGalleries(projectId, userId, object.id)
    const merged: AngleGalleries = { ...cached }

    for (const [angleId, assetGallery] of Object.entries(fromAssets)) {
      const cachedGallery = merged[angleId]
      if (!cachedGallery) {
        merged[angleId] = assetGallery
        continue
      }
      const seen = new Set(cachedGallery.images.map((img) => img.imageUrl))
      const combined = [...cachedGallery.images]
      for (const img of assetGallery.images) {
        if (!seen.has(img.imageUrl)) {
          combined.push(img)
          seen.add(img.imageUrl)
        }
      }
      merged[angleId] = {
        images: combined,
        selectedIndex: Math.min(
          cachedGallery.selectedIndex,
          Math.max(0, combined.length - 1),
        ),
      }
    }

    setAngleGalleries(merged)
    hydrationKeyRef.current = hydrationKey
  }, [object.id, objectAssets, projectId, userId])

  useEffect(() => {
    if (!ready || !userId) return
    hydrateGalleries()
  }, [ready, userId, hydrateGalleries])

  useEffect(() => {
    if (!ready || !userId) return
    const hasSavedAngles = objectAssets.some((asset) =>
      isObjectAngleAsset(asset, object.id),
    )
    if (!hasSavedAngles || Object.keys(angleGalleries).length > 0) return
    hydrationKeyRef.current = null
    hydrateGalleries()
  }, [ready, userId, objectAssets, object.id, angleGalleries, hydrateGalleries])

  useEffect(() => {
    if (!userId) return
    if (Object.keys(angleGalleries).length === 0) return
    saveCachedGalleries(projectId, userId, object.id, angleGalleries)
  }, [angleGalleries, userId, projectId, object.id])

  useEffect(() => {
    return () => {
      if (collagePreviewUrl) URL.revokeObjectURL(collagePreviewUrl)
    }
  }, [collagePreviewUrl])

  useEffect(() => {
    hydrationKeyRef.current = null
    syncedPrimaryAssetIdRef.current = null
    setSourceReference(null)
    setCollagePreviewUrl(null)
    setCollagePreviewBlob(null)
    setObjectShots([...OBJECT_ANGLES])
    setSelectedAngles([...OBJECT_TURNAROUND_ANGLE_IDS])
  }, [object.id])

  useEffect(() => {
    if (!primaryReferenceAsset?.content_url) return
    if (isAngleCollageReferenceAsset(primaryReferenceAsset)) return
    if (syncedPrimaryAssetIdRef.current === primaryReferenceAsset.id) return
    syncedPrimaryAssetIdRef.current = primaryReferenceAsset.id
    setSourceReference({
      imageUrl: primaryReferenceAsset.content_url,
      previewUrl: primaryReferenceAsset.content_url,
      assetId: primaryReferenceAsset.id,
      title: primaryReferenceAsset.title,
    })
  }, [
    primaryReferenceAsset?.id,
    primaryReferenceAsset?.content_url,
    primaryReferenceAsset?.title,
  ])

  const getLockedImageConfig = async () => {
    const imagesSetting = await AISettingsService.getOrCreateDefaultTabSetting("images")
    if (!imagesSetting?.is_locked || !imagesSetting.locked_model) {
      throw new Error("Please lock an image model in AI Settings first.")
    }
    const lockedModel = migrateGPTImageDisplayLabel(imagesSetting.locked_model)
    return {
      lockedModel,
      service: mapDisplayModelToService(lockedModel),
      apiModel: normalizeLockedImageModel(lockedModel, { withReferenceImage: true }),
      supportsReference: displayModelSupportsReferenceImage(lockedModel),
    }
  }

  const requestImageGeneration = async (
    prompt: string,
    config: Awaited<ReturnType<typeof getLockedImageConfig>>,
    referenceFile: File,
  ) => {
    const formData = new FormData()
    formData.append("prompt", prompt)
    formData.append("model", config.apiModel)
    formData.append("service", config.service)
    formData.append("width", String(config.service === "runway" ? 1280 : DEFAULT_CINEMATIC_IMAGE_WIDTH))
    formData.append("height", String(config.service === "runway" ? 720 : DEFAULT_CINEMATIC_IMAGE_HEIGHT))
    formData.append("apiKey", "configured")
    formData.append("userId", userId)
    formData.append("autoSaveToBucket", "true")
    formData.append("file", referenceFile)
    if (config.service === "runway") {
      formData.append("seed", String(Math.floor(Math.random() * 2147483647)))
    }

    return fetch("/api/ai/generate-image", { method: "POST", body: formData })
  }

  const addImageToAngle = (
    angleId: string,
    image: Omit<ObjectAngleImage, "id">,
    options?: { selectNew?: boolean },
  ) => {
    setAngleGalleries((prev) => {
      const gallery = prev[angleId] ?? { images: [], selectedIndex: 0 }
      const newImage = createAngleImage(image)
      const nextImages = [...gallery.images, newImage]
      return {
        ...prev,
        [angleId]: {
          images: nextImages,
          selectedIndex: options?.selectNew
            ? nextImages.length - 1
            : gallery.images.length > 0
              ? gallery.selectedIndex
              : 0,
        },
      }
    })
  }

  const selectAngleImage = (angleId: string, index: number) => {
    setAngleGalleries((prev) => {
      const gallery = prev[angleId]
      if (!gallery || index < 0 || index >= gallery.images.length) return prev
      return { ...prev, [angleId]: { ...gallery, selectedIndex: index } }
    })
  }

  const persistAngleImage = async (
    angle: ObjectAngle,
    image: Omit<ObjectAngleImage, "id" | "saved">,
  ): Promise<ObjectAngleImage> => {
    const now = new Date()
    const savedAsset = await AssetService.createAsset({
      project_id: projectId,
      story_object_id: object.id,
      title: `${object.name} - ${angle.label} (${now.toLocaleDateString()} ${now.toLocaleTimeString()})`,
      content_type: "image",
      content_url: image.imageUrl,
      prompt: image.prompt,
      metadata: {
        type: "object_angle",
        object_angle: angle.id,
        object_angle_label: angle.label,
        object_angle_source: image.source,
        story_object_name: object.name,
      },
    })

    onObjectAssetsChange([savedAsset, ...objectAssets.filter((a) => a.id !== savedAsset.id)])

    return {
      id: savedAsset.id,
      imageUrl: image.imageUrl,
      prompt: image.prompt,
      source: image.source,
      assetId: savedAsset.id,
      saved: true,
    }
  }

  const generateAngle = async (angle: ObjectAngle, onProgress?: (msg: string) => void) => {
    if (!sourceReference) {
      throw new Error("Pick or upload a reference image first.")
    }

    onProgress?.("Preparing reference…")
    const config = await getLockedImageConfig()
    if (!config.supportsReference) {
      throw new Error(
        "Your locked image model does not support reference editing. Lock GPT Image 2 or Runway in AI Settings.",
      )
    }

    const prompt = buildObjectAngleEditPrompt(angle, object)
    const referenceFile =
      sourceReference.file ??
      (await referenceUrlToFile(
        sourceReference.imageUrl,
        `object-angle-ref-${sourceReference.assetId || "upload"}.png`,
      ))

    onProgress?.("Calling image model…")
    const response = await requestImageGeneration(prompt, config, referenceFile)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to generate ${angle.label}`)
    }

    const result = await response.json()
    const imageUrl = result.bucketUrl || result.imageUrl
    if (!imageUrl) throw new Error("No image returned")

    return { imageUrl, prompt, source: "from_reference" as const }
  }

  const handlePickExistingImage = (angle: ObjectAngle, asset: Asset) => {
    if (!asset.content_url) return
    addImageToAngle(
      angle.id,
      {
        imageUrl: asset.content_url,
        prompt: asset.prompt || `Existing image: ${asset.title}`,
        source: "existing",
        assetId: asset.id,
        saved: true,
      },
      { selectNew: true },
    )
    setPickDialogAngleId(null)
    toast({ title: "Image added", description: angle.label })
  }

  const openPickDialog = (angleId: string) => {
    if (!projectId) {
      toast({
        title: "Select a project",
        description: "Link a movie project to browse existing images.",
        variant: "destructive",
      })
      return
    }
    if (allPickableAssets.length === 0 && imageAssets.length === 0) {
      toast({
        title: "No images found",
        description: "Add images to this object or project first.",
        variant: "destructive",
      })
      return
    }
    setPickDialogAngleId(angleId)
  }

  const clearImageEditReference = () => {
    if (imageEditReferencePreview) URL.revokeObjectURL(imageEditReferencePreview)
    setImageEditReferenceFile(null)
    setImageEditReferencePreview(null)
  }

  const clearImageEditStyleLinks = () => {
    setImageEditStyleLinkAssetIds([])
  }

  const closeImageEditDialog = () => {
    setImageEditDialogOpen(false)
    setImageEditAngleId(null)
    setImageEditPrompt("")
    setSelectedEditPromptId("")
    clearImageEditReference()
    clearImageEditStyleLinks()
  }

  const openImageEditDialog = (angleId: string) => {
    setImageEditAngleId(angleId)
    setImageEditPrompt("")
    setSelectedEditPromptId("")
    clearImageEditReference()
    clearImageEditStyleLinks()
    setImageEditDialogOpen(true)
  }

  const toggleImageEditStyleLinkAsset = (assetId: string) => {
    setImageEditStyleLinkAssetIds((prev) => {
      if (prev.includes(assetId)) return prev.filter((id) => id !== assetId)
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

  const handleObjectAngleImageEdit = async () => {
    const angleId = imageEditAngleId
    const direction = imageEditPrompt.trim()
    const currentImage = imageEditCurrentImage
    const angle = imageEditAngle
    const referenceFile = imageEditReferenceFile
    const styleLinkAssetIds = [...imageEditStyleLinkAssetIds]

    if (!angleId || !userId) return
    if (!direction) {
      toast({
        title: "Describe your edit",
        description: 'e.g. "warmer lighting" or "more worn texture".',
        variant: "destructive",
      })
      return
    }
    if (!referenceFile && !currentImage?.imageUrl) {
      toast({
        title: "Reference required",
        description: "This view needs an image, or upload a reference to edit from.",
        variant: "destructive",
      })
      return
    }
    if (isAngleGenerating(angleId)) {
      toast({
        title: "Already in progress",
        description: "This angle is still generating. You can keep working on other shots.",
      })
      return
    }

    startAngleJob(angleId, "Editing image…")
    closeImageEditDialog()

    try {
      const config = await getLockedImageConfig()
      if (!config.supportsReference) {
        throw new Error(
          "Your locked image model does not support reference editing. Lock GPT Image 2 or Runway in AI Settings.",
        )
      }

      let prompt = `${direction}. Object view: ${angle?.label || "angle"}.`
      prompt +=
        " Edit the attached reference image only. Keep the same object design, materials, and style. Photoreal product photography, no text, no typography, no captions, no labels, no watermark."
      prompt += ` ${SINGLE_ANGLE_SHOT_INSTRUCTION}`
      prompt = prompt.slice(0, 990)

      const styleReferenceFiles: File[] = []
      for (const assetId of styleLinkAssetIds) {
        const styleAsset = allPickableAssets.find((asset) => asset.id === assetId)
        if (styleAsset?.content_url) {
          styleReferenceFiles.push(
            await referenceUrlToFile(styleAsset.content_url, `style-ref-${styleAsset.id}.png`),
          )
        }
      }

      const primaryReferenceFile =
        referenceFile ??
        (await referenceUrlToFile(currentImage!.imageUrl, `object-edit-${angleId}.png`))

      setAngleJobProgress(angleId, "Calling image model…")
      const formData = new FormData()
      formData.append("prompt", prompt)
      formData.append("model", config.apiModel)
      formData.append("service", config.service)
      formData.append("width", String(config.service === "runway" ? 1280 : DEFAULT_CINEMATIC_IMAGE_WIDTH))
      formData.append("height", String(config.service === "runway" ? 720 : DEFAULT_CINEMATIC_IMAGE_HEIGHT))
      formData.append("apiKey", "configured")
      formData.append("userId", userId)
      formData.append("autoSaveToBucket", "true")
      formData.append("file", primaryReferenceFile)
      for (const styleFile of styleReferenceFiles) {
        formData.append("styleFiles", styleFile)
      }
      if (config.service === "runway") {
        formData.append("seed", String(Math.floor(Math.random() * 2147483647)))
      }

      const response = await fetch("/api/ai/generate-image", { method: "POST", body: formData })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to edit image")
      }

      const result = await response.json()
      const imageUrl = result.bucketUrl || result.imageUrl
      if (!imageUrl) throw new Error("Failed to edit image")

      if (angle) {
        const persisted = await persistAngleImage(angle, {
          imageUrl,
          prompt,
          source: "from_reference",
        })
        addImageToAngle(angle.id, persisted, { selectNew: true })
      }

      toast({
        title: "Edit added",
        description: "Edited version added as a new variant for this angle.",
      })
    } catch (error) {
      toast({
        title: "Edit failed",
        description: error instanceof Error ? error.message : "Could not edit the image.",
        variant: "destructive",
      })
    } finally {
      finishAngleJob(angleId)
    }
  }

  const handleSetThumbnailForAngle = async (imageUrl: string) => {
    if (!onSetThumbnail) return
    try {
      setSettingThumbnailUrl(imageUrl)
      await onSetThumbnail(imageUrl)
      toast({ title: "Thumbnail updated", description: "Set as the main object image." })
    } catch (error) {
      toast({
        title: "Thumbnail failed",
        description: error instanceof Error ? error.message : "Could not set thumbnail.",
        variant: "destructive",
      })
    } finally {
      setSettingThumbnailUrl(null)
    }
  }

  const handleGenerateSingle = async (angle: ObjectAngle) => {
    if (isAngleGenerating(angle.id)) return

    startAngleJob(angle.id, "Generating…")
    try {
      const result = await generateAngle(angle, (msg) => setAngleJobProgress(angle.id, msg))
      const persisted = await persistAngleImage(angle, result)
      addImageToAngle(angle.id, persisted, { selectNew: true })
      toast({
        title: "Angle generated",
        description: `${angle.label} added to object views.`,
      })
    } catch (error) {
      toast({
        title: `${angle.label} failed`,
        description: error instanceof Error ? error.message : "Could not generate this angle.",
        variant: "destructive",
      })
    } finally {
      finishAngleJob(angle.id)
    }
  }

  const handleGenerateAll = async () => {
    if (!sourceReference) {
      toast({
        title: "Reference image needed",
        description: "Upload or select a reference image from this object's images.",
        variant: "destructive",
      })
      return
    }

    const anglesToGenerate = objectShots.filter((angle) => selectedAngles.includes(angle.id))
    if (anglesToGenerate.length === 0) {
      toast({
        title: "Select angles",
        description: "Choose at least one angle to generate.",
        variant: "destructive",
      })
      return
    }

    setIsBatchGenerating(true)
    let created = 0

    try {
      for (const angle of anglesToGenerate) {
        startAngleJob(angle.id, "Generating…")
        try {
          const result = await generateAngle(angle, (msg) => setAngleJobProgress(angle.id, msg))
          const persisted = await persistAngleImage(angle, result)
          addImageToAngle(angle.id, persisted, { selectNew: true })
          created++
        } catch (error) {
          toast({
            title: `${angle.label} failed`,
            description:
              error instanceof Error ? error.message : "Could not generate this angle.",
            variant: "destructive",
          })
        } finally {
          finishAngleJob(angle.id)
        }
      }

      if (created > 0) {
        toast({
          title: "Object views generated",
          description: `Added ${created} angle${created === 1 ? "" : "s"} from your reference image.`,
        })
      }
    } finally {
      setIsBatchGenerating(false)
    }
  }

  const toggleAngle = (angleId: string) => {
    setSelectedAngles((prev) =>
      prev.includes(angleId) ? prev.filter((id) => id !== angleId) : [...prev, angleId],
    )
  }

  const openAddShotDialog = () => {
    setEditingShotId(null)
    setShotFormLabel("")
    setShotFormPrompt("")
    setShotDialogOpen(true)
  }

  const openEditShotDialog = (shot: ObjectAngle) => {
    setEditingShotId(shot.id)
    setShotFormLabel(shot.label)
    setShotFormPrompt(shot.prompt)
    setShotDialogOpen(true)
  }

  const saveShot = () => {
    const label = shotFormLabel.trim()
    const prompt = shotFormPrompt.trim()
    if (!label || !prompt) {
      toast({
        title: "Shot details required",
        description: "Add a name and framing description for this shot.",
        variant: "destructive",
      })
      return
    }

    if (editingShotId) {
      setObjectShots((prev) =>
        prev.map((shot) =>
          shot.id === editingShotId
            ? {
                ...shot,
                label,
                prompt,
                shortLabel: label.split(/\s+/)[0]?.slice(0, 10) || shot.shortLabel,
              }
            : shot,
        ),
      )
      toast({ title: "Shot updated" })
    } else {
      const newShot = createCustomObjectAngle(label, prompt)
      setObjectShots((prev) => [...prev, newShot])
      setSelectedAngles((prev) => [...prev, newShot.id])
      toast({ title: "Shot added", description: newShot.label })
    }

    setShotDialogOpen(false)
    setEditingShotId(null)
    setShotFormLabel("")
    setShotFormPrompt("")
  }

  const deleteShot = (shotId: string) => {
    const shot = objectShots.find((s) => s.id === shotId)
    const imageCount = angleGalleries[shotId]?.images.length ?? 0
    if (
      imageCount > 0 &&
      !window.confirm(
        `Delete "${shot?.label || "this shot"}"? ${imageCount} saved image${imageCount === 1 ? "" : "s"} for this shot will be removed from the gallery.`,
      )
    ) {
      return
    }

    setObjectShots((prev) => prev.filter((s) => s.id !== shotId))
    setSelectedAngles((prev) => prev.filter((id) => id !== shotId))
    setAngleGalleries((prev) => {
      const next = { ...prev }
      delete next[shotId]
      return next
    })
    toast({ title: "Shot removed", description: shot?.label })
  }

  const handleSourceUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (sourceReference?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceReference.previewUrl)
    }
    const previewUrl = URL.createObjectURL(file)
    syncedPrimaryAssetIdRef.current = "__upload__"
    setSourceReference({
      imageUrl: previewUrl,
      previewUrl,
      file,
      title: file.name,
    })
    event.target.value = ""
  }

  const clearSourceReference = () => {
    if (sourceReference?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceReference.previewUrl)
    }
    setSourceReference(null)
    syncedPrimaryAssetIdRef.current = null
  }

  const selectReferenceAsset = (asset: Asset) => {
    if (!asset.content_url) return
    if (isAngleCollageReferenceAsset(asset)) {
      toast({
        title: "Use a single photo",
        description: "Pick a single object image as reference — not a collage sheet.",
        variant: "destructive",
      })
      return
    }
    if (sourceReference?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceReference.previewUrl)
    }
    syncedPrimaryAssetIdRef.current = asset.id
    setSourceReference({
      imageUrl: asset.content_url,
      previewUrl: asset.content_url,
      assetId: asset.id,
      title: asset.title,
    })
    setSourcePickDialogOpen(false)
  }

  const openSourcePickDialog = () => {
    const hasThisObject = referencePickerAssets.length > 0
    const hasProjectImages = allPickableAssets.length > 0
    if (!hasThisObject && !hasProjectImages) {
      toast({
        title: "No images available",
        description: "Upload an image or add images to this project first.",
        variant: "destructive",
      })
      return
    }
    setSourcePickDialogOpen(true)
  }

  const handleDownloadCollage = () => {
    const url = collageDisplayUrl
    if (!url) return
    const link = document.createElement("a")
    link.href = url
    link.download = `${object.name.replace(/\s+/g, "-").toLowerCase()}-object-collage.png`
    link.click()
  }

  const handleDeleteCollage = async () => {
    const hasSaved = savedCollageAsset != null
    const hasPreview = collagePreviewUrl != null
    if (!hasSaved && !hasPreview) return

    const message = hasSaved
      ? "Delete this saved reference collage?"
      : "Discard this unsaved collage preview?"
    if (!window.confirm(message)) return

    try {
      setIsDeletingCollage(true)
      if (collagePreviewUrl) {
        URL.revokeObjectURL(collagePreviewUrl)
        setCollagePreviewUrl(null)
        setCollagePreviewBlob(null)
      }
      if (savedCollageAsset) {
        await AssetService.deleteAsset(savedCollageAsset.id)
        onObjectAssetsChange(objectAssets.filter((asset) => asset.id !== savedCollageAsset.id))
      }
      toast({
        title: hasSaved ? "Collage deleted" : "Preview discarded",
        description: hasSaved
          ? "The reference collage was removed from this object."
          : "You can generate a new collage anytime.",
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete collage.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingCollage(false)
    }
  }

  const handleBuildCollage = async () => {
    if (collageSourceItems.length < 2) {
      toast({
        title: "Need more angles",
        description: "Generate at least 2 object views before building a reference collage.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsBuildingCollage(true)
      const title = `${object.name} — Object Reference Sheet`
      const blob = await buildAvatarCollageBlob(collageSourceItems, { title })
      const nextUrl = URL.createObjectURL(blob)
      if (collagePreviewUrl) URL.revokeObjectURL(collagePreviewUrl)
      setCollagePreviewUrl(nextUrl)
      setCollagePreviewBlob(blob)
      toast({
        title: "Collage ready",
        description: `Combined ${collageSourceItems.length} views into one reference sheet.`,
      })
    } catch (error) {
      toast({
        title: "Collage failed",
        description: error instanceof Error ? error.message : "Could not build collage.",
        variant: "destructive",
      })
    } finally {
      setIsBuildingCollage(false)
    }
  }

  const handleSaveCollage = async () => {
    if (!collagePreviewBlob) {
      toast({
        title: "Nothing to save",
        description: "Build the collage first.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSavingCollage(true)
      const fileName = `${object.name.replace(/\s+/g, "-").toLowerCase()}-object-collage.png`
      const file = new File([collagePreviewBlob], fileName, { type: "image/png" })
      const stored = await StorageService.uploadFile({
        file,
        projectId,
        fileType: "image",
        metadata: {
          type: "object_angle_collage",
          story_object_name: object.name,
        },
      })

      if (savedCollageAsset) {
        try {
          await AssetService.deleteAsset(savedCollageAsset.id)
        } catch {
          // continue even if old collage delete fails
        }
      }

      const savedAsset = await AssetService.createAsset({
        project_id: projectId,
        story_object_id: object.id,
        title: `${object.name} — Object Reference Collage`,
        content_type: "image",
        content_url: stored.url,
        prompt: "Multi-angle object reference collage",
        metadata: {
          type: "object_angle",
          object_angle: OBJECT_REFERENCE_COLLAGE_ANGLE_ID,
          object_angle_label: "Reference Collage",
          object_angle_source: "collage",
          story_object_name: object.name,
        },
      })

      onObjectAssetsChange([
        savedAsset,
        ...objectAssets.filter((a) => a.id !== savedCollageAsset?.id && a.id !== savedAsset.id),
      ])

      if (collagePreviewUrl) URL.revokeObjectURL(collagePreviewUrl)
      setCollagePreviewUrl(null)
      setCollagePreviewBlob(null)

      toast({
        title: "Collage saved",
        description: "Reference sheet added to this object's images.",
      })
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save collage.",
        variant: "destructive",
      })
    } finally {
      setIsSavingCollage(false)
    }
  }

  const handleDeleteAngleImage = async (angle: ObjectAngle, image: ObjectAngleImage) => {
    if (image.saved && image.assetId) {
      try {
        await AssetService.deleteAsset(image.assetId)
        onObjectAssetsChange(objectAssets.filter((asset) => asset.id !== image.assetId))
      } catch (error) {
        toast({
          title: "Delete failed",
          description: error instanceof Error ? error.message : "Could not delete image.",
          variant: "destructive",
        })
        return
      }
    }

    setAngleGalleries((prev) => {
      const gallery = prev[angle.id]
      if (!gallery) return prev
      const nextImages = gallery.images.filter((item) => item.id !== image.id)
      return {
        ...prev,
        [angle.id]: {
          images: nextImages,
          selectedIndex: Math.min(gallery.selectedIndex, Math.max(0, nextImages.length - 1)),
        },
      }
    })
  }

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Object Views
          {totalImageCount > 0 && <Badge variant="secondary">{totalImageCount}</Badge>}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate individual shots from one reference photo, then optionally combine saved views
          into a labeled collage sheet below.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reference & Angles</CardTitle>
            <CardDescription className="text-xs">
              Use a single object photo as reference — not a collage — then generate one image per
              shot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Source reference</Label>
              <p className="text-[11px] text-muted-foreground">
                Upload or pick an existing project image — AI will generate the other angles from it.
              </p>
              {sourceReference ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <div className="w-16 h-16 rounded-md overflow-hidden border border-border flex-shrink-0">
                    <img
                      src={sourceReference.previewUrl}
                      alt="Source reference"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {sourceReference.title || "Reference image"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Angles will be generated from this image
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={clearSourceReference}
                    disabled={isBatchGenerating}
                    title="Clear reference"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Upload or pick an existing image as your source
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  id="object-angle-ref-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSourceUpload}
                  disabled={isBatchGenerating}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  disabled={isBatchGenerating}
                  onClick={() => document.getElementById("object-angle-ref-upload")?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  disabled={isBatchGenerating}
                  onClick={openSourcePickDialog}
                >
                  <Images className="h-3.5 w-3.5" />
                  Pick Existing
                </Button>
              </div>
              {referencePickerAssets.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {referencePickerAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => selectReferenceAsset(asset)}
                      className={cn(
                        "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                        sourceReference?.assetId === asset.id
                          ? "border-violet-500 ring-2 ring-violet-500/40"
                          : "border-border hover:border-violet-500/50",
                      )}
                      title={asset.title}
                    >
                      <img src={asset.content_url!} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {objectShots.map((angle) => (
                <div
                  key={angle.id}
                  className="flex items-center gap-2 rounded-md border border-border p-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedAngles.includes(angle.id)}
                    onCheckedChange={() => toggleAngle(angle.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{angle.label}</p>
                    {angle.isCustom && (
                      <p className="text-[10px] text-muted-foreground truncate">{angle.prompt}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => openEditShotDialog(angle)}
                    title="Edit shot"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => deleteShot(angle.id)}
                    title="Delete shot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={openAddShotDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Shot
            </Button>

            <Button
              className="w-full"
              onClick={() => void handleGenerateAll()}
              disabled={isBatchGenerating || !sourceReference || selectedAngles.length === 0}
            >
              {isBatchGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate {selectedAngles.length} Angle{selectedAngles.length === 1 ? "" : "s"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              New generations are added as variants — existing images are kept. You can close edit
              dialogs while generation continues in the background.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!hasAnyImages ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground max-w-sm">
                  Pick a reference image and generate front, side, back, and top views — or
                  individual angles one at a time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {objectShots.filter(
                (angle) =>
                  selectedAngles.includes(angle.id) ||
                  (angleGalleries[angle.id]?.images.length ?? 0) > 0 ||
                  objectAssets.some(
                    (asset) =>
                      isObjectAngleAsset(asset, object.id) &&
                      asset.metadata?.object_angle === angle.id,
                  ),
              ).map((angle) => {
                const gallery = angleGalleries[angle.id]
                const image =
                  gallery?.images[gallery?.selectedIndex ?? 0] ??
                  (() => {
                    const asset = objectAssets
                      .filter(
                        (item) =>
                          isObjectAngleAsset(item, object.id) &&
                          item.metadata?.object_angle === angle.id &&
                          item.content_url,
                      )
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                      )[0]
                    if (!asset?.content_url) return undefined
                    return {
                      id: asset.id,
                      imageUrl: asset.content_url,
                      prompt: asset.prompt || "",
                      source: "existing" as const,
                      assetId: asset.id,
                      saved: true,
                    }
                  })()
                const isLoading = isAngleGenerating(angle.id)
                const loadProgress = angleGenerationProgress(angle.id)
                const isDefaultThumbnail = Boolean(
                  image?.imageUrl && thumbnailUrl && thumbnailUrl === image.imageUrl,
                )

                return (
                  <Card key={angle.id} className="overflow-hidden">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="text-sm">{angle.label}</CardTitle>
                          <div className="flex items-center gap-1 flex-wrap">
                            {gallery && gallery.images.length > 1 && (
                              <Badge variant="outline" className="text-[10px]">
                                {gallery.images.length} variants
                              </Badge>
                            )}
                            {image?.source === "existing" && (
                              <Badge variant="secondary" className="text-[10px]">
                                Existing
                              </Badge>
                            )}
                            {image?.saved && (
                              <Badge variant="outline" className="text-[10px]">
                                Saved
                              </Badge>
                            )}
                            {isDefaultThumbnail && (
                              <Badge className="text-[10px] bg-blue-500 hover:bg-blue-500">
                                <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                Thumbnail
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 text-xs"
                          onClick={() => void handleGenerateSingle(angle)}
                          disabled={isLoading || isBatchGenerating || !sourceReference}
                          title={
                            image
                              ? "Redo this shot with the same settings. The current image is kept as a variant."
                              : "Generate this shot"
                          }
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          {image ? "Regenerate" : "Generate"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="aspect-video bg-muted relative">
                        {isLoading && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 gap-2 p-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            {loadProgress ? (
                              <p className="text-xs text-muted-foreground text-center">
                                {loadProgress}
                              </p>
                            ) : null}
                          </div>
                        )}
                        {image ? (
                          <button
                            type="button"
                            className="w-full h-full block cursor-pointer group/view"
                            onClick={() =>
                              setViewImageDialog({ url: image.imageUrl, label: angle.label })
                            }
                            title="View full image"
                          >
                            <img
                              src={image.imageUrl}
                              alt={angle.label}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/view:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover/view:opacity-100">
                              <span className="rounded-full bg-black/60 text-white text-xs px-3 py-1.5 flex items-center gap-1.5">
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </span>
                            </div>
                          </button>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 gap-2">
                            <ImageIcon className="h-8 w-8 opacity-50" />
                            <p className="text-xs text-center">
                              Use Generate above to create this shot, or pick an existing image.
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => openPickDialog(angle.id)}
                              disabled={isLoading}
                            >
                              <Images className="h-3 w-3 mr-1" />
                              Pick Existing
                            </Button>
                          </div>
                        )}
                      </div>
                      {gallery && gallery.images.length > 0 && (
                        <div className="flex gap-1.5 p-2 overflow-x-auto border-t border-border bg-muted/40">
                          {gallery.images.map((img, idx) => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => selectAngleImage(angle.id, idx)}
                              className={cn(
                                "relative flex-shrink-0 w-11 h-11 rounded-md overflow-hidden border-2 transition-all",
                                idx === gallery.selectedIndex
                                  ? "border-primary ring-2 ring-primary/30"
                                  : "border-border/60 opacity-75 hover:opacity-100",
                              )}
                              title={`Variant ${idx + 1}`}
                            >
                              <img
                                src={img.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              {img.saved && (
                                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {image && (
                        <div className="flex flex-wrap gap-1 p-2 border-t border-border">
                          <Button variant="ghost" size="sm" className="flex-1 min-w-[4.5rem] h-8 text-xs" asChild>
                            <a href={image.imageUrl} download target="_blank" rel="noreferrer">
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 min-w-[4.5rem] h-8 text-xs"
                            onClick={() => openImageEditDialog(angle.id)}
                            disabled={isLoading}
                          >
                            <Wand2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 min-w-[4.5rem] h-8 text-xs"
                            onClick={() => openPickDialog(angle.id)}
                            disabled={isLoading}
                          >
                            <Images className="h-3 w-3 mr-1" />
                            Pick
                          </Button>
                          {onSetThumbnail ? (
                            <Button
                              variant={isDefaultThumbnail ? "secondary" : "ghost"}
                              size="sm"
                              className={cn(
                                "flex-1 min-w-[4.5rem] h-8 text-xs",
                                isDefaultThumbnail &&
                                  "bg-blue-500/15 text-blue-400 hover:bg-blue-500/20",
                              )}
                              onClick={() => void handleSetThumbnailForAngle(image.imageUrl)}
                              disabled={isLoading || settingThumbnailUrl === image.imageUrl}
                            >
                              {settingThumbnailUrl === image.imageUrl ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Star
                                  className={cn(
                                    "h-3 w-3 mr-1",
                                    isDefaultThumbnail && "fill-current text-blue-400",
                                  )}
                                />
                              )}
                              Thumbnail
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 min-w-[4.5rem] h-8 text-xs text-destructive hover:text-destructive"
                            onClick={() => void handleDeleteAngleImage(angle, image)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {showCollageSection ? (
            <Card className="border-violet-500/20 bg-violet-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-violet-400" />
                  Reference Collage Sheet
                </CardTitle>
                <CardDescription>
                  Combine your selected object views into one labeled image for storyboards and AI
                  generation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {collageSourceItems.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Shots included</Label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {collageSourceItems.map((item) => (
                        <div key={item.label} className="flex-shrink-0 w-[4.5rem]">
                          <button
                            type="button"
                            className="w-[4.5rem] h-[4.5rem] rounded-lg overflow-hidden border border-border hover:border-violet-500/50"
                            onClick={() =>
                              setViewImageDialog({
                                url: item.imageUrl,
                                label: item.label,
                              })
                            }
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.label}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <p className="text-[10px] text-muted-foreground truncate mt-1 text-center">
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {collageDisplayUrl ? (
                  <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                    <img
                      src={collageDisplayUrl}
                      alt="Object reference collage"
                      className="w-full h-auto object-contain cursor-pointer"
                      onClick={() =>
                        setViewImageDialog({
                          url: collageDisplayUrl,
                          label: `${object.name} — Reference Collage`,
                        })
                      }
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                    {collageSourceItems.length} angle{collageSourceItems.length === 1 ? "" : "s"}{" "}
                    ready
                    {collageSourceItems.length < 2
                      ? " — add at least one more view to build a collage."
                      : " — click Generate Collage to combine these shots into one sheet."}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleBuildCollage()}
                    disabled={isBuildingCollage || collageSourceItems.length < 2}
                    className="bg-gradient-to-r from-violet-500 to-purple-500 hover:opacity-90"
                  >
                    {isBuildingCollage ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <LayoutGrid className="h-4 w-4 mr-2" />
                    )}
                    Generate Collage
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleSaveCollage()}
                    disabled={!collagePreviewBlob || isSavingCollage}
                  >
                    {isSavingCollage ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save to Object
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadCollage}
                    disabled={!collageDisplayUrl || isDeletingCollage}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => void handleDeleteCollage()}
                    disabled={
                      !collageDisplayUrl ||
                      isDeletingCollage ||
                      isSavingCollage ||
                      isBuildingCollage
                    }
                  >
                    {isDeletingCollage ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Uses the currently selected variant for each angle ({collageSourceItems.length}{" "}
                  view{collageSourceItems.length === 1 ? "" : "s"}).
                  {savedCollageAsset && !collagePreviewUrl
                    ? " Showing the last saved collage for this object."
                    : null}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={!!viewImageDialog} onOpenChange={(open) => !open && setViewImageDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[95vh] p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{viewImageDialog?.label || "View image"}</DialogTitle>
          </DialogHeader>
          {viewImageDialog ? (
            <img
              src={viewImageDialog.url}
              alt={viewImageDialog.label}
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={sourcePickDialogOpen} onOpenChange={setSourcePickDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pick source image</DialogTitle>
            <DialogDescription>
              Choose one image to generate object angles from. Prefer a single photo — not a collage.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {referencePickerAssets.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  This object
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {referencePickerAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => selectReferenceAsset(asset)}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all group text-left",
                        sourceReference?.assetId === asset.id
                          ? "border-violet-500 ring-2 ring-violet-500/40"
                          : "border-border hover:border-primary hover:ring-2 hover:ring-primary/30",
                      )}
                      title={asset.title}
                    >
                      <img src={asset.content_url!} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white line-clamp-2">{asset.title}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {pickableImageGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {group.assets
                    .filter((asset) => !isAngleCollageReferenceAsset(asset))
                    .map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => selectReferenceAsset(asset)}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all group text-left",
                          sourceReference?.assetId === asset.id
                            ? "border-violet-500 ring-2 ring-violet-500/40"
                            : "border-border hover:border-primary hover:ring-2 hover:ring-primary/30",
                        )}
                        title={asset.title}
                      >
                        <img src={asset.content_url!} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white line-clamp-2">{asset.title}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
            {referencePickerAssets.length === 0 && pickableImageGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No project images yet. Upload one first.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pickDialogAngleId} onOpenChange={(open) => !open && setPickDialogAngleId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Pick image{pickDialogAngle ? ` — ${pickDialogAngle.label}` : ""}
            </DialogTitle>
            <DialogDescription>
              Choose an existing project image for this angle view.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {imageAssets.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  This object
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {imageAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-violet-500/50"
                      onClick={() =>
                        pickDialogAngle && handlePickExistingImage(pickDialogAngle, asset)
                      }
                    >
                      <img src={asset.content_url!} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pickableImageGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {group.assets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-violet-500/50"
                      onClick={() =>
                        pickDialogAngle && handlePickExistingImage(pickDialogAngle, asset)
                      }
                    >
                      <img src={asset.content_url!} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={imageEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeImageEditDialog()
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-violet-500" />
              Edit Image
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {imageEditAngle
                ? `Reference edit for ${imageEditAngle.label}. Saves a new variant — the original is kept.`
                : "Edit this object view using a reference image."}
            </DialogDescription>
          </DialogHeader>

          {imageEditAngle && imageEditCurrentImage && (
            <div className="space-y-3">
              <button
                type="button"
                className="w-full rounded-lg overflow-hidden border border-border bg-muted/30 max-h-40 cursor-pointer"
                title="Click to view full size"
                onClick={() =>
                  setViewImageDialog({
                    url: imageEditCurrentImage.imageUrl,
                    label: imageEditAngle.label,
                  })
                }
              >
                <StorageThumbImg
                  src={imageEditCurrentImage.imageUrl}
                  alt={imageEditAngle.label}
                  width={EDIT_PREVIEW_THUMB_WIDTH}
                  quality={EDIT_THUMB_QUALITY}
                  resize="contain"
                  className="w-full h-full max-h-40 object-contain"
                />
              </button>

              <p className="text-xs text-muted-foreground">
                Edit using your locked model ({lockedImageModelLabel}).
                {supportsReferenceEdit
                  ? " Describe changes below and optionally link another project image as a second reference."
                  : " Your locked model does not support reference editing — use GPT Image 2 or Runway ML."}
              </p>

              {imageEditAngleId &&
              isAngleGenerating(imageEditAngleId) &&
              angleGenerationProgress(imageEditAngleId) ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {angleGenerationProgress(imageEditAngleId)}
                  <span className="text-muted-foreground/80">
                    — you can close this window and keep working
                  </span>
                </p>
              ) : null}

              {hasSavedPromptOptions ? (
                <div className="space-y-2">
                  <Label htmlFor="object-angle-edit-prompt-selector">Saved prompt</Label>
                  <Select
                    value={selectedEditPromptId || "__none__"}
                    onValueChange={handleSavedPromptSelect}
                    disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
                  >
                    <SelectTrigger id="object-angle-edit-prompt-selector" className="bg-input border-border">
                      <SelectValue
                        placeholder={
                          isLoadingSavedPrompts
                            ? "Loading prompts…"
                            : "Apply a saved prompt to this edit…"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (custom edit)</SelectItem>
                      {object.visual_description?.trim() ? (
                        <SelectItem value="__object_visual__">Object visual description</SelectItem>
                      ) : null}
                      {savedPrompts.map((prompt) => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          {formatSavedPromptOptionLabel(prompt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Loads into the edit field below — then click Edit Image to apply.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="object-angle-edit-prompt" className="text-xs sm:text-sm">
                  Describe your edit
                </Label>
                <Textarea
                  id="object-angle-edit-prompt"
                  value={imageEditPrompt}
                  onChange={(e) => {
                    setImageEditPrompt(e.target.value)
                    if (selectedEditPromptId) setSelectedEditPromptId("")
                  }}
                  placeholder='e.g., warmer lighting, more scratches, darker metal'
                  className="min-h-[72px] text-xs sm:text-sm resize-none"
                  disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="object-angle-edit-ref" className="text-xs text-muted-foreground">
                  Primary reference (optional)
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="object-angle-edit-ref"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (imageEditReferencePreview) URL.revokeObjectURL(imageEditReferencePreview)
                      setImageEditReferenceFile(file)
                      setImageEditReferencePreview(URL.createObjectURL(file))
                      e.target.value = ""
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
                    onClick={() => document.getElementById("object-angle-edit-ref")?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Upload reference
                  </Button>
                  {imageEditReferencePreview ? (
                    <>
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-primary ring-2 ring-primary/40">
                        <img
                          src={imageEditReferencePreview}
                          alt="Uploaded reference"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
                        onClick={clearImageEditReference}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="relative w-14 h-14 rounded-lg overflow-hidden border border-border"
                      title="Click to view full size"
                      onClick={() =>
                        setViewImageDialog({
                          url: imageEditCurrentImage.imageUrl,
                          label: imageEditAngle.label,
                        })
                      }
                    >
                      <StorageThumbImg
                        src={imageEditCurrentImage.imageUrl}
                        alt={imageEditAngle.label}
                        width={EDIT_SMALL_THUMB_WIDTH}
                        quality={EDIT_THUMB_QUALITY}
                        resize="cover"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}
                </div>
              </div>

              {pickableImageGroups.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">
                      Link existing image (optional)
                    </Label>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto rounded-lg border border-border/60 p-2">
                    {pickableImageGroups.map((group) => (
                      <div key={group.label} className="space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          {group.label}
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {group.assets.map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
                              onClick={() => toggleImageEditStyleLinkAsset(asset.id)}
                              onDoubleClick={(e) => {
                                e.preventDefault()
                                if (!asset.content_url) return
                                setViewImageDialog({
                                  url: asset.content_url,
                                  label: asset.title || group.label,
                                })
                              }}
                              title="Click to link · double-click to view full size"
                              className={cn(
                                "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                                imageEditStyleLinkAssetIds.includes(asset.id)
                                  ? "border-violet-500 ring-2 ring-violet-500/40"
                                  : "border-border hover:border-violet-500/50",
                              )}
                            >
                              <StorageThumbImg
                                src={asset.content_url!}
                                alt=""
                                width={EDIT_SMALL_THUMB_WIDTH}
                                quality={EDIT_THUMB_QUALITY}
                                resize="cover"
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {imageEditStyleLinkAssetIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={clearImageEditStyleLinks}
                    >
                      Clear linked references
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <Button
                size="sm"
                onClick={() => void handleObjectAngleImageEdit()}
                disabled={
                  (imageEditAngleId != null && isAngleGenerating(imageEditAngleId)) ||
                  !imageEditPrompt.trim() ||
                  !supportsReferenceEdit ||
                  (!imageEditReferenceFile && !imageEditCurrentImage?.imageUrl)
                }
                className="gap-2 w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white"
              >
                {imageEditAngleId != null && isAngleGenerating(imageEditAngleId) ? (
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
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={shotDialogOpen} onOpenChange={setShotDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShotId ? "Edit Shot" : "Add Shot"}</DialogTitle>
            <DialogDescription>
              Name the shot and describe the framing for AI generation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="object-shot-label">Shot name</Label>
              <Input
                id="object-shot-label"
                value={shotFormLabel}
                onChange={(e) => setShotFormLabel(e.target.value)}
                placeholder="Three-Quarter View"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-shot-prompt">Framing description</Label>
              <Textarea
                id="object-shot-prompt"
                value={shotFormPrompt}
                onChange={(e) => setShotFormPrompt(e.target.value)}
                placeholder="three-quarter angle showing the object from slightly above"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShotDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={saveShot}>
                {editingShotId ? "Save Changes" : "Add Shot"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
