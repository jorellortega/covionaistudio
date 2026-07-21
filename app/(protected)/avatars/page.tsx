"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { useAuthReady } from "@/components/auth-hooks"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { AISettingsService } from "@/lib/ai-settings-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import {
  buildLinkedAssetGroups,
  getProjectAssetSourceLabel,
  referenceUrlToFile,
} from "@/lib/project-image-linking"
import {
  AVATAR_ANGLES,
  AVATAR_TURNAROUND_ANGLE_IDS,
  buildAvatarPrompt,
  buildAvatarEditPrompt,
  createCustomAvatarAngle,
  type AvatarAngle,
} from "@/lib/avatar-angles"
import {
  mapDisplayModelToService,
  normalizeDisplayModelToApiId,
  displayModelSupportsReferenceImage,
  migrateGPTImageDisplayLabel,
  DEFAULT_CINEMATIC_IMAGE_WIDTH,
  DEFAULT_CINEMATIC_IMAGE_HEIGHT,
} from "@/lib/image-model-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  UserCircle,
  Sparkles,
  Loader2,
  ImageIcon,
  Download,
  Save,
  Wand2,
  FolderOpen,
  Images,
  Upload,
  X,
  Link2,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"

type GenerationMode = "description" | "from_reference"

interface SourceReference {
  imageUrl: string
  previewUrl: string
  assetId?: string
  file?: File
  title?: string
}

interface AvatarImage {
  id: string
  imageUrl: string
  prompt: string
  saved?: boolean
  source?: "generated" | "existing" | "from_reference"
  assetId?: string
}

interface AngleGallery {
  images: AvatarImage[]
  selectedIndex: number
}

type AngleGalleries = Record<string, AngleGallery>

const MAX_LINKED_REFERENCE_IMAGES = 5

function isAvatarAsset(asset: Asset): boolean {
  return (
    asset.content_type === "image" &&
    !!asset.content_url &&
    asset.metadata?.type === "avatar" &&
    typeof asset.metadata?.avatar_angle === "string"
  )
}

function buildGalleriesFromAvatarAssets(assets: Asset[]): AngleGalleries {
  const galleries: AngleGalleries = {}
  const avatarAssets = assets
    .filter(isAvatarAsset)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

  for (const asset of avatarAssets) {
    const angleId = asset.metadata!.avatar_angle as string
    const gallery = galleries[angleId] ?? { images: [], selectedIndex: 0 }
    gallery.images.push({
      id: asset.id,
      imageUrl: asset.content_url!,
      prompt: asset.prompt || asset.title,
      saved: true,
      assetId: asset.id,
      source:
        asset.metadata?.avatar_source === "from_reference"
          ? "from_reference"
          : asset.metadata?.avatar_source === "existing"
            ? "existing"
            : "generated",
    })
    galleries[angleId] = gallery
  }

  for (const angleId of Object.keys(galleries)) {
    const gallery = galleries[angleId]
    gallery.selectedIndex = Math.max(0, gallery.images.length - 1)
  }

  return galleries
}

function getAvatarGalleryStorageKey(projectId: string, userId: string) {
  return projectId
    ? `avatar-galleries-project-${projectId}`
    : `avatar-galleries-user-${userId}`
}

const createAvatarImage = (
  image: Omit<AvatarImage, "id">,
): AvatarImage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  ...image,
})

const STYLE_OPTIONS = [
  { value: "photorealistic cinematic", label: "Photorealistic" },
  { value: "stylized digital art", label: "Stylized" },
  { value: "animated feature film", label: "Animated" },
  { value: "graphic novel illustration", label: "Graphic Novel" },
  { value: "fantasy concept art", label: "Fantasy Concept" },
]

export default function AvatarsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { userId, ready } = useAuthReady()
  const { toast } = useToast()

  const [projectId, setProjectId] = useState(searchParams.get("projectId") || "")
  const [characterName, setCharacterName] = useState("")
  const [description, setDescription] = useState("")
  const [style, setStyle] = useState(STYLE_OPTIONS[0].value)
  const [avatarShots, setAvatarShots] = useState<AvatarAngle[]>([...AVATAR_ANGLES])
  const [selectedAngles, setSelectedAngles] = useState<string[]>(
    [...AVATAR_TURNAROUND_ANGLE_IDS],
  )
  const [characters, setCharacters] = useState<Character[]>([])
  const [linkedCharacterId, setLinkedCharacterId] = useState<string>("")
  const [angleGalleries, setAngleGalleries] = useState<AngleGalleries>({})
  const [generatingAngleId, setGeneratingAngleId] = useState<string | null>(null)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [projectImageAssets, setProjectImageAssets] = useState<Asset[]>([])
  const [characterImageAssets, setCharacterImageAssets] = useState<Asset[]>([])
  const [projectLocations, setProjectLocations] = useState<Location[]>([])
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [pickDialogAngleId, setPickDialogAngleId] = useState<string | null>(null)
  const [generationMode, setGenerationMode] = useState<GenerationMode>("description")
  const [sourceReference, setSourceReference] = useState<SourceReference | null>(null)
  const [sourcePickDialogOpen, setSourcePickDialogOpen] = useState(false)
  const [imageAiSetting, setImageAiSetting] = useState<Awaited<
    ReturnType<typeof AISettingsService.getOrCreateDefaultTabSetting>
  > | null>(null)
  const [imageEditDialogOpen, setImageEditDialogOpen] = useState(false)
  const [imageEditAngleId, setImageEditAngleId] = useState<string | null>(null)
  const [imageEditPrompt, setImageEditPrompt] = useState("")
  const [imageEditUploading, setImageEditUploading] = useState(false)
  const [imageEditProgress, setImageEditProgress] = useState("")
  const [imageEditReferenceFile, setImageEditReferenceFile] = useState<File | null>(null)
  const [imageEditReferencePreview, setImageEditReferencePreview] = useState<string | null>(null)
  const [imageEditStyleLinkAssetIds, setImageEditStyleLinkAssetIds] = useState<string[]>([])
  const [shotDialogOpen, setShotDialogOpen] = useState(false)
  const [editingShotId, setEditingShotId] = useState<string | null>(null)
  const [shotFormLabel, setShotFormLabel] = useState("")
  const [shotFormPrompt, setShotFormPrompt] = useState("")
  const [galleriesHydrated, setGalleriesHydrated] = useState(false)

  useEffect(() => {
    if (!ready) return
    AISettingsService.getOrCreateDefaultTabSetting("images")
      .then(setImageAiSetting)
      .catch(() => setImageAiSetting(null))
  }, [ready])

  useEffect(() => {
    if (!ready || !projectId) {
      setCharacters([])
      setProjectImageAssets([])
      setProjectLocations([])
      setCharacterImageAssets([])
      return
    }
    CharactersService.getCharacters(projectId)
      .then(setCharacters)
      .catch(() => setCharacters([]))

    setIsLoadingImages(true)
    Promise.all([
      AssetService.getAssetsForProject(projectId),
      LocationsService.getLocations(projectId),
    ])
      .then(([assets, locations]) => {
        setProjectImageAssets(
          assets.filter((a) => a.content_type === "image" && a.content_url),
        )
        setProjectLocations(locations)
      })
      .catch(() => {
        setProjectImageAssets([])
        setProjectLocations([])
      })
      .finally(() => setIsLoadingImages(false))
  }, [ready, projectId])

  useEffect(() => {
    setGalleriesHydrated(false)
    setAngleGalleries({})
  }, [projectId, userId])

  useEffect(() => {
    if (!ready || !userId || galleriesHydrated || isLoadingImages) return

    const avatarAssets = projectImageAssets.filter(isAvatarAsset)
    if (avatarAssets.length > 0) {
      setAngleGalleries(buildGalleriesFromAvatarAssets(projectImageAssets))
      const nameFromMeta = avatarAssets.find(
        (a) => typeof a.metadata?.character_name === "string",
      )?.metadata?.character_name
      if (typeof nameFromMeta === "string" && nameFromMeta.trim()) {
        setCharacterName((prev) => prev || nameFromMeta)
      }
      setGalleriesHydrated(true)
      return
    }

    try {
      const storageKey = getAvatarGalleryStorageKey(projectId, userId)
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as AngleGalleries
        if (parsed && typeof parsed === "object") {
          setAngleGalleries(parsed)
        }
      }
    } catch {
      // ignore corrupt local cache
    }

    setGalleriesHydrated(true)
  }, [
    ready,
    userId,
    projectId,
    projectImageAssets,
    isLoadingImages,
    galleriesHydrated,
  ])

  useEffect(() => {
    if (!ready || !userId || !galleriesHydrated) return
    const hasImages = Object.values(angleGalleries).some((g) => g.images.length > 0)
    if (!hasImages) return

    try {
      const storageKey = getAvatarGalleryStorageKey(projectId, userId)
      localStorage.setItem(storageKey, JSON.stringify(angleGalleries))
    } catch {
      // ignore quota errors
    }
  }, [angleGalleries, ready, userId, projectId, galleriesHydrated])

  useEffect(() => {
    if (!ready || !linkedCharacterId) {
      setCharacterImageAssets([])
      return
    }
    AssetService.getAssetsForCharacter(linkedCharacterId)
      .then((assets) =>
        setCharacterImageAssets(
          assets.filter((a) => a.content_type === "image" && a.content_url),
        ),
      )
      .catch(() => setCharacterImageAssets([]))
  }, [ready, linkedCharacterId])

  const addImageToAngle = (
    angleId: string,
    image: Omit<AvatarImage, "id">,
    options?: { selectNew?: boolean },
  ) => {
    setAngleGalleries((prev) => {
      const gallery = prev[angleId] ?? { images: [], selectedIndex: 0 }
      const newImage = createAvatarImage(image)
      const nextImages = [...gallery.images, newImage]
      const selectNew = options?.selectNew ?? false
      return {
        ...prev,
        [angleId]: {
          images: nextImages,
          selectedIndex: selectNew
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
      return {
        ...prev,
        [angleId]: { ...gallery, selectedIndex: index },
      }
    })
  }

  const markAngleImagesSaved = (angleId: string, imageIds: string[]) => {
    const savedSet = new Set(imageIds)
    setAngleGalleries((prev) => {
      const gallery = prev[angleId]
      if (!gallery) return prev
      return {
        ...prev,
        [angleId]: {
          ...gallery,
          images: gallery.images.map((img) =>
            savedSet.has(img.id) ? { ...img, saved: true } : img,
          ),
        },
      }
    })
  }

  const persistAvatarImage = async (
    angle: AvatarAngle,
    image: Omit<AvatarImage, "id">,
  ): Promise<AvatarImage> => {
    const baseImage = createAvatarImage(image)

    if (!projectId) {
      return baseImage
    }

    try {
      const asset = await AssetService.createAsset({
        project_id: projectId,
        character_id: linkedCharacterId || null,
        title: `${characterName || "Character"} - ${angle.label}`,
        content_type: "image",
        content_url: image.imageUrl,
        prompt: image.prompt,
        metadata: {
          type: "avatar",
          avatar_angle: angle.id,
          avatar_source: image.source || "generated",
          character_name: characterName || null,
        },
      })
      setProjectImageAssets((prev) =>
        prev.some((a) => a.id === asset.id) ? prev : [asset, ...prev],
      )
      return {
        ...baseImage,
        id: asset.id,
        assetId: asset.id,
        saved: true,
      }
    } catch (error) {
      console.error("Failed to auto-save avatar to project:", error)
      return baseImage
    }
  }

  const addAvatarImage = async (
    angle: AvatarAngle,
    image: Omit<AvatarImage, "id">,
    options?: { selectNew?: boolean },
  ) => {
    const persisted = await persistAvatarImage(angle, image)
    addImageToAngle(angle.id, persisted, options)
  }

  const removeAvatarImageFromGallery = (angleId: string, imageId: string) => {
    setAngleGalleries((prev) => {
      const gallery = prev[angleId]
      if (!gallery) return prev

      const removeIndex = gallery.images.findIndex((img) => img.id === imageId)
      if (removeIndex === -1) return prev

      const nextImages = gallery.images.filter((img) => img.id !== imageId)
      if (nextImages.length === 0) {
        const next = { ...prev }
        delete next[angleId]
        return next
      }

      const nextSelectedIndex =
        removeIndex < gallery.selectedIndex
          ? gallery.selectedIndex - 1
          : removeIndex === gallery.selectedIndex
            ? Math.min(gallery.selectedIndex, nextImages.length - 1)
            : gallery.selectedIndex

      return {
        ...prev,
        [angleId]: {
          images: nextImages,
          selectedIndex: Math.max(0, nextSelectedIndex),
        },
      }
    })
  }

  const galleryHasMultiple = (angleId: string) =>
    (angleGalleries[angleId]?.images.length ?? 0) > 1

  const handleDeleteAvatarImage = async (angle: AvatarAngle, image: AvatarImage) => {
    if (
      !window.confirm(
        `Delete this ${angle.label} image${galleryHasMultiple(angle.id) ? " variant" : ""}?`,
      )
    ) {
      return
    }

    removeAvatarImageFromGallery(angle.id, image.id)

    const shouldDeleteAsset =
      !!image.assetId && image.saved && image.source !== "existing"

    if (shouldDeleteAsset) {
      try {
        await AssetService.deleteAsset(image.assetId!)
        setProjectImageAssets((prev) => prev.filter((a) => a.id !== image.assetId))
      } catch (error) {
        toast({
          title: "Removed from gallery",
          description:
            error instanceof Error
              ? error.message
              : "Could not delete the saved project asset.",
          variant: "destructive",
        })
        return
      }
    }

    toast({ title: "Image deleted", description: angle.label })
  }

  const toggleAngle = (id: string) => {
    setSelectedAngles((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    )
  }

  const openAddShotDialog = () => {
    setEditingShotId(null)
    setShotFormLabel("")
    setShotFormPrompt("")
    setShotDialogOpen(true)
  }

  const openEditShotDialog = (shot: AvatarAngle) => {
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
      setAvatarShots((prev) =>
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
      const newShot = createCustomAvatarAngle(label, prompt)
      setAvatarShots((prev) => [...prev, newShot])
      setSelectedAngles((prev) => [...prev, newShot.id])
      toast({ title: "Shot added", description: newShot.label })
    }

    setShotDialogOpen(false)
    setEditingShotId(null)
    setShotFormLabel("")
    setShotFormPrompt("")
  }

  const deleteShot = (shotId: string) => {
    const shot = avatarShots.find((s) => s.id === shotId)
    const imageCount = angleGalleries[shotId]?.images.length ?? 0
    if (
      imageCount > 0 &&
      !window.confirm(
        `Delete "${shot?.label || "this shot"}"? ${imageCount} saved image${imageCount === 1 ? "" : "s"} for this shot will be removed from the gallery.`,
      )
    ) {
      return
    }

    setAvatarShots((prev) => prev.filter((s) => s.id !== shotId))
    setSelectedAngles((prev) => prev.filter((id) => id !== shotId))
    setAngleGalleries((prev) => {
      const next = { ...prev }
      delete next[shotId]
      return next
    })
    toast({ title: "Shot removed", description: shot?.label })
  }

  const resetShotsToDefaults = () => {
    const hasCustomShots =
      avatarShots.some((s) => s.isCustom) ||
      avatarShots.length !== AVATAR_ANGLES.length
    if (hasCustomShots && !window.confirm("Reset shots to the default list? Custom shots will be removed.")) {
      return
    }
    setAvatarShots([...AVATAR_ANGLES])
    setSelectedAngles([...AVATAR_TURNAROUND_ANGLE_IDS])
    toast({ title: "Shots reset to defaults" })
  }

  const getLockedImageModelLabel = () => {
    if (imageAiSetting?.is_locked && imageAiSetting.locked_model) {
      return migrateGPTImageDisplayLabel(imageAiSetting.locked_model)
    }
    return null
  }

  const getLockedImageConfig = (options?: { withReferenceImage?: boolean }) => {
    if (!imageAiSetting?.is_locked || !imageAiSetting.locked_model) {
      return null
    }
    const lockedModel = imageAiSetting.locked_model
    const lower = lockedModel.toLowerCase()
    const apiModel =
      lower.includes("runway") && options?.withReferenceImage
        ? "gen4_image_turbo"
        : normalizeDisplayModelToApiId(lockedModel)
    return {
      lockedModel,
      service: mapDisplayModelToService(lockedModel),
      apiModel,
      supportsReference: displayModelSupportsReferenceImage(lockedModel),
    }
  }

  const requireLockedImageConfig = (options?: { withReferenceImage?: boolean }) => {
    const config = getLockedImageConfig(options)
    if (!config) {
      throw new Error("Please lock an image model in AI Settings first.")
    }
    return config
  }

  const getImageGenerationErrorMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof Error)) return fallback
    if (error.message.includes("API key")) {
      return `${error.message} Add the API key for your locked image model in Settings → AI Settings.`
    }
    return error.message
  }

  const clearImageEditReference = () => {
    if (imageEditReferencePreview) URL.revokeObjectURL(imageEditReferencePreview)
    setImageEditReferenceFile(null)
    setImageEditReferencePreview(null)
  }

  const clearImageEditStyleLinks = () => {
    setImageEditStyleLinkAssetIds([])
  }

  const toggleImageEditStyleLink = (assetId: string) => {
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

  const openImageEditDialog = (angleId: string) => {
    setImageEditAngleId(angleId)
    setImageEditPrompt("")
    clearImageEditReference()
    clearImageEditStyleLinks()
    setImageEditDialogOpen(true)
  }

  const getImageConfig = async (withReferenceImage = false) => {
    const imagesSetting = await AISettingsService.getOrCreateDefaultTabSetting("images")
    const displayModel =
      imagesSetting.is_locked && imagesSetting.locked_model
        ? imagesSetting.locked_model
        : imagesSetting.selected_model || imagesSetting.locked_model || "DALL-E 3"

    const lower = displayModel.toLowerCase()
    const apiModel =
      lower.includes("runway") && withReferenceImage
        ? "gen4_image_turbo"
        : normalizeDisplayModelToApiId(displayModel)

    return {
      displayModel,
      service: mapDisplayModelToService(displayModel),
      apiModel,
      supportsReference: displayModelSupportsReferenceImage(displayModel),
      isLocked: !!(imagesSetting.is_locked && imagesSetting.locked_model),
    }
  }

  const requestImageGeneration = async (
    prompt: string,
    config: Awaited<ReturnType<typeof getImageConfig>>,
    options?: {
      referenceFile?: File
      styleReferenceFiles?: File[]
    },
  ) => {
    const referenceFile = options?.referenceFile
    const width = config.service === "runway" ? 1280 : DEFAULT_CINEMATIC_IMAGE_WIDTH
    const height = config.service === "runway" ? 720 : DEFAULT_CINEMATIC_IMAGE_HEIGHT

    if (config.supportsReference && referenceFile) {
      const formData = new FormData()
      formData.append("prompt", prompt)
      formData.append("model", config.apiModel)
      formData.append("service", config.service)
      formData.append("width", String(width))
      formData.append("height", String(height))
      formData.append("apiKey", "configured")
      formData.append("userId", userId!)
      formData.append("autoSaveToBucket", "true")
      formData.append("file", referenceFile)
      for (const styleFile of options?.styleReferenceFiles ?? []) {
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

  const generateAngle = async (angle: AvatarAngle) => {
    if (!userId) return null

    const useReference = generationMode === "from_reference" && !!sourceReference
    const config = await getImageConfig(useReference)

    if (useReference) {
      if (!config.supportsReference) {
        throw new Error(
          "Your image model doesn't support reference editing. Lock GPT Image 2 or Runway in AI Settings.",
        )
      }

      const prompt = buildAvatarEditPrompt(characterName, description, angle, style)
      const referenceFile =
        sourceReference!.file ??
        (await referenceUrlToFile(
          sourceReference!.imageUrl,
          `avatar-source-${sourceReference!.assetId || "upload"}.png`,
        ))

      const res = await requestImageGeneration(prompt, config, { referenceFile })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `Failed to generate ${angle.label} from reference`)
      }

      const data = await res.json()
      const imageUrl = data.bucketUrl || data.imageUrl || data.url
      if (!imageUrl) throw new Error("No image returned")

      return {
        imageUrl,
        prompt,
        source: "from_reference" as const,
      }
    }

    const prompt = buildAvatarPrompt(characterName, description, angle, style)
    const res = await requestImageGeneration(prompt, config)

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || `Failed to generate ${angle.label}`)
    }

    const data = await res.json()
    const imageUrl = data.bucketUrl || data.imageUrl || data.url
    if (!imageUrl) throw new Error("No image returned")

    return { imageUrl, prompt, source: "generated" as const }
  }

  const linkedCharacter = useMemo(
    () => characters.find((c) => c.id === linkedCharacterId),
    [characters, linkedCharacterId],
  )

  const pickableImageGroups = useMemo(() => {
    const groups: { label: string; assets: Asset[] }[] = []
    const seen = new Set<string>()

    const addAsset = (asset: Asset) => {
      if (!asset.content_url || seen.has(asset.content_url)) return
      seen.add(asset.content_url)
      return asset
    }

    if (characterImageAssets.length > 0) {
      const assets = characterImageAssets.map(addAsset).filter(Boolean) as Asset[]
      if (assets.length > 0) groups.push({ label: "This character", assets })
    }

    if (linkedCharacter?.image_url && !seen.has(linkedCharacter.image_url)) {
      seen.add(linkedCharacter.image_url)
      groups.push({
        label: "Character portrait",
        assets: [{
          id: `char-portrait-${linkedCharacter.id}`,
          user_id: linkedCharacter.user_id,
          project_id: linkedCharacter.project_id,
          character_id: linkedCharacter.id,
          title: `${linkedCharacter.name} portrait`,
          content_type: "image",
          content_url: linkedCharacter.image_url,
          version: 1,
          is_latest_version: true,
          created_at: linkedCharacter.updated_at,
          updated_at: linkedCharacter.updated_at,
        }],
      })
    }

    for (const url of linkedCharacter?.reference_images || []) {
      if (!url || seen.has(url)) continue
      seen.add(url)
      const refGroup = groups.find((g) => g.label === "Character references")
      const refAsset: Asset = {
        id: `char-ref-${url}`,
        user_id: linkedCharacter!.user_id,
        project_id: linkedCharacter!.project_id,
        character_id: linkedCharacter!.id,
        title: `${linkedCharacter!.name} reference`,
        content_type: "image",
        content_url: url,
        version: 1,
        is_latest_version: true,
        created_at: linkedCharacter!.updated_at,
        updated_at: linkedCharacter!.updated_at,
      }
      if (refGroup) refGroup.assets.push(refAsset)
      else groups.push({ label: "Character references", assets: [refAsset] })
    }

    const otherProjectAssets = projectImageAssets.filter(
      (a) => !linkedCharacterId || a.character_id !== linkedCharacterId,
    )
    if (otherProjectAssets.length > 0) {
      groups.push(
        ...buildLinkedAssetGroups(otherProjectAssets, projectLocations, characters),
      )
    }

    return groups
  }, [
    characterImageAssets,
    linkedCharacter,
    linkedCharacterId,
    projectImageAssets,
    projectLocations,
    characters,
  ])

  const totalPickableImages = useMemo(
    () => pickableImageGroups.reduce((sum, g) => sum + g.assets.length, 0),
    [pickableImageGroups],
  )

  const allPickableAssets = useMemo(
    () => pickableImageGroups.flatMap((group) => group.assets),
    [pickableImageGroups],
  )

  const pickDialogAngle = useMemo(
    () => avatarShots.find((a) => a.id === pickDialogAngleId) ?? null,
    [avatarShots, pickDialogAngleId],
  )

  const imageEditAngle = useMemo(
    () => avatarShots.find((a) => a.id === imageEditAngleId) ?? null,
    [avatarShots, imageEditAngleId],
  )

  const imageEditCurrentImage = useMemo(() => {
    if (!imageEditAngleId) return null
    const gallery = angleGalleries[imageEditAngleId]
    if (!gallery) return null
    return gallery.images[gallery.selectedIndex] ?? null
  }, [imageEditAngleId, angleGalleries])

  const handlePickExistingImage = (angle: AvatarAngle, asset: Asset) => {
    if (!asset.content_url) return
    addImageToAngle(angle.id, {
      imageUrl: asset.content_url,
      prompt: asset.prompt || `Existing image: ${asset.title}`,
      source: "existing",
      assetId: asset.id.startsWith("char-") ? undefined : asset.id,
      saved: !!asset.id && !asset.id.startsWith("char-") && !!projectId,
    })
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
    if (totalPickableImages === 0) {
      toast({
        title: "No images found",
        description: "Add images in Assets, Characters, or Locations first.",
        variant: "destructive",
      })
      return
    }
    setPickDialogAngleId(angleId)
  }

  const handleSelectSourceReference = (asset: Asset) => {
    if (!asset.content_url) return
    if (sourceReference?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceReference.previewUrl)
    }
    setSourceReference({
      imageUrl: asset.content_url,
      previewUrl: asset.content_url,
      assetId: asset.id.startsWith("char-") ? undefined : asset.id,
      title: asset.title,
    })
    setSourcePickDialogOpen(false)
    setGenerationMode("from_reference")
    toast({ title: "Source image selected", description: "Ready to generate angles from this image." })
  }

  const handleSourceUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (sourceReference?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceReference.previewUrl)
    }
    const previewUrl = URL.createObjectURL(file)
    setSourceReference({
      imageUrl: previewUrl,
      previewUrl,
      file,
      title: file.name,
    })
    setGenerationMode("from_reference")
    event.target.value = ""
  }

  const clearSourceReference = () => {
    if (sourceReference?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceReference.previewUrl)
    }
    setSourceReference(null)
  }

  const canGenerate = () => {
    if (selectedAngles.length === 0) return false
    if (generationMode === "from_reference") return !!sourceReference
    return !!(description.trim() || characterName.trim())
  }

  const handleGenerateAll = async () => {
    if (generationMode === "from_reference" && !sourceReference) {
      toast({
        title: "Source image needed",
        description: "Pick or upload one reference image to generate angles from.",
        variant: "destructive",
      })
      return
    }
    if (generationMode === "description" && !description.trim() && !characterName.trim()) {
      toast({
        title: "Description needed",
        description: "Add a character name or visual description first.",
        variant: "destructive",
      })
      return
    }
    if (selectedAngles.length === 0) {
      toast({
        title: "Select angles",
        description: "Choose at least one angle to generate.",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingAll(true)
    const anglesToGenerate = avatarShots.filter((a) => selectedAngles.includes(a.id))
    let created = 0

    try {
      for (const angle of anglesToGenerate) {
        setGeneratingAngleId(angle.id)
        const result = await generateAngle(angle)
        if (result) {
          await addAvatarImage(angle, result)
          created++
        }
      }
      toast({
        title: "Avatars generated",
        description: generationMode === "from_reference"
          ? `Added ${created} angle${created === 1 ? "" : "s"} from your reference image.`
          : `Added ${created} angle${created === 1 ? "" : "s"}.`,
      })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate avatar",
        variant: "destructive",
      })
    } finally {
      setGeneratingAngleId(null)
      setIsGeneratingAll(false)
    }
  }

  const handleGenerateSingle = async (angle: AvatarAngle) => {
    if (generationMode === "from_reference" && !sourceReference) {
      toast({
        title: "Source image needed",
        description: "Pick or upload one reference image first.",
        variant: "destructive",
      })
      return
    }
    if (generationMode === "description" && !description.trim() && !characterName.trim()) {
      toast({
        title: "Description needed",
        description: "Add a character name or visual description first.",
        variant: "destructive",
      })
      return
    }

    setGeneratingAngleId(angle.id)
    try {
      const result = await generateAngle(angle)
      if (result) {
        await addAvatarImage(angle, result)
        const variantCount = (angleGalleries[angle.id]?.images.length ?? 0) + 1
        toast({
          title: "Generated",
          description:
            variantCount > 1
              ? `${angle.label} — variant ${variantCount} added`
              : angle.label,
        })
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate",
        variant: "destructive",
      })
    } finally {
      setGeneratingAngleId(null)
    }
  }

  const handleEnhanceDescription = async () => {
    if (!characterName.trim() && !description.trim()) {
      toast({
        title: "Add a name or description",
        description: "Enter at least a character name to enhance.",
        variant: "destructive",
      })
      return
    }

    setIsEnhancing(true)
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Write a detailed visual description for a character avatar (appearance only: face, hair, skin, eyes, clothing, distinguishing features). 3-5 sentences. No backstory. Character name: ${characterName || "unnamed"}. ${description ? `Existing notes: ${description}` : ""}`,
          conversationHistory: [],
        }),
      })
      if (!res.ok) throw new Error("Failed to enhance description")
      const data = await res.json()
      setDescription(data.message)
      toast({ title: "Description enhanced" })
    } catch {
      toast({
        title: "Enhancement failed",
        variant: "destructive",
      })
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleAvatarImageEdit = async () => {
    const angleId = imageEditAngleId
    const direction = imageEditPrompt.trim()
    const currentImage = imageEditCurrentImage
    const angle = imageEditAngle
    if (!angleId || !userId) return
    if (!direction) {
      toast({
        title: "Describe your edit",
        description: 'e.g. "warmer lighting" or "darker jacket".',
        variant: "destructive",
      })
      return
    }
    if (!imageEditReferenceFile && !currentImage?.imageUrl) {
      toast({
        title: "Reference required",
        description: "This view needs an image, or upload a reference to edit from.",
        variant: "destructive",
      })
      return
    }

    setImageEditUploading(true)
    setImageEditProgress("Editing image...")
    try {
      const config = requireLockedImageConfig({ withReferenceImage: true })
      let prompt = direction
      if (angle) prompt += ` Avatar view: ${angle.label}.`
      if (characterName.trim()) prompt += ` Character: ${characterName.trim()}.`
      prompt = prompt.slice(0, 990)

      const styleReferenceFiles: File[] = []
      for (const assetId of imageEditStyleLinkAssetIds) {
        const styleAsset = allPickableAssets.find((a) => a.id === assetId)
        if (styleAsset?.content_url) {
          styleReferenceFiles.push(
            await referenceUrlToFile(
              styleAsset.content_url,
              `style-ref-${styleAsset.id}.png`,
            ),
          )
        }
      }

      let referenceFile: File | undefined
      if (config.supportsReference) {
        referenceFile =
          imageEditReferenceFile ??
          (await referenceUrlToFile(
            currentImage!.imageUrl,
            `avatar-edit-${angleId}.png`,
          ))
      }

      const response = await requestImageGeneration(prompt, config, {
        referenceFile,
        styleReferenceFiles: config.supportsReference ? styleReferenceFiles : undefined,
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to edit image")
      }
      const result = await response.json()
      const imageUrl = result.bucketUrl || result.imageUrl || result.url
      if (!imageUrl) {
        throw new Error("Failed to edit image")
      }

      if (imageEditAngle) {
        await addAvatarImage(imageEditAngle, {
          imageUrl,
          prompt,
          source: "generated",
        })
      }

      setImageEditDialogOpen(false)
      clearImageEditReference()
      clearImageEditStyleLinks()
      setImageEditPrompt("")
      toast({
        title: "Edit added",
        description: "Edited version added as a new variant for this angle.",
      })
    } catch (error) {
      toast({
        title: "Edit failed",
        description: getImageGenerationErrorMessage(error, "Could not edit the image."),
        variant: "destructive",
      })
    } finally {
      setImageEditUploading(false)
      setImageEditProgress("")
    }
  }

  const handleSaveToProject = async () => {
    if (!projectId) {
      toast({
        title: "Select a project",
        description: "Link a movie project to save avatars as assets.",
        variant: "destructive",
      })
      return
    }
    if (totalImageCount === 0) return

    setIsSavingAll(true)
    try {
      let saved = 0
      for (const angle of avatarShots) {
        const gallery = angleGalleries[angle.id]
        if (!gallery) continue
        const savedIds: string[] = []
        for (const avatar of gallery.images) {
          if (avatar.saved) continue
          if (avatar.source === "existing" && avatar.assetId) continue
          await AssetService.createAsset({
            project_id: projectId,
            character_id: linkedCharacterId || null,
            title: `${characterName || "Character"} - ${angle.label}`,
            content_type: "image",
            content_url: avatar.imageUrl,
            prompt: avatar.prompt,
            metadata: { avatar_angle: angle.id, type: "avatar" },
          })
          savedIds.push(avatar.id)
          saved++
        }
        if (savedIds.length > 0) {
          markAngleImagesSaved(angle.id, savedIds)
        }
      }
      toast({
        title: "Saved to project",
        description: `${saved} avatar image${saved === 1 ? "" : "s"} saved to assets.`,
      })
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setIsSavingAll(false)
    }
  }

  const handleCharacterSelect = (id: string) => {
    setLinkedCharacterId(id)
    const char = characters.find((c) => c.id === id)
    if (!char) return
    if (!characterName.trim()) setCharacterName(char.name)
    const visual = [
      char.master_prompt,
      char.description,
      char.hair_color_current || char.hair_color_natural,
      char.eye_color,
      char.skin_tone,
      char.usual_clothing_style,
      char.distinguishing_marks,
    ]
      .filter(Boolean)
      .join(". ")
    if (visual.trim() && !description.trim()) setDescription(visual)
  }

  const totalImageCount = useMemo(
    () => Object.values(angleGalleries).reduce((sum, g) => sum + g.images.length, 0),
    [angleGalleries],
  )

  const hasAnyImages = totalImageCount > 0

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <UserCircle className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Avatar Studio</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Create character reference shots for scenes — front, side, back, wide body,
            close-ups, clothing, and detail views. Pick what you need for blocking and AI video.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Character</CardTitle>
                <CardDescription>
                  Describe your character or generate angles from one reference image
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Movie Project (optional)</Label>
                  <ProjectSelector
                    selectedProject={projectId}
                    onProjectChange={(id) => {
                      setProjectId(id)
                      router.replace(id ? `/avatars?projectId=${id}` : "/avatars", { scroll: false })
                    }}
                    placeholder="Link to save assets..."
                  />
                </div>

                {characters.length > 0 && (
                  <div className="space-y-2">
                    <Label>Link Character (optional)</Label>
                    <Select
                      value={linkedCharacterId || "none"}
                      onValueChange={(v) => {
                        if (v === "none") setLinkedCharacterId("")
                        else handleCharacterSelect(v)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick existing character..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {characters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Tabs
                  value={generationMode}
                  onValueChange={(v) => setGenerationMode(v as GenerationMode)}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="description">From Description</TabsTrigger>
                    <TabsTrigger value="from_reference">From Reference</TabsTrigger>
                  </TabsList>

                  <TabsContent value="description" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Character Name</Label>
                  <Input
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="Marcus Chen"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Visual Description</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleEnhanceDescription}
                      disabled={isEnhancing}
                    >
                      {isEnhancing ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3 mr-1" />
                      )}
                      AI Enhance
                    </Button>
                  </div>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tall man in his 40s, salt-and-pepper hair, sharp jawline, weathered skin, dark leather jacket..."
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Style</Label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                  </TabsContent>

                  <TabsContent value="from_reference" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Link2 className="h-3.5 w-3.5" />
                        Source Image
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Pick one image and AI will create the other angles while keeping the same character likeness.
                        Requires GPT Image 2 or Runway locked in AI Settings.
                      </p>
                      {sourceReference ? (
                        <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                          <div className="w-16 h-20 rounded-md overflow-hidden border border-border flex-shrink-0">
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
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={clearSourceReference}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-4 text-center">
                          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-xs text-muted-foreground mb-3">
                            Upload or pick an existing image as your source
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => document.getElementById("avatar-source-upload")?.click()}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          Upload
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            if (!projectId && totalPickableImages === 0) {
                              toast({
                                title: "No images available",
                                description: "Link a project or upload an image.",
                                variant: "destructive",
                              })
                              return
                            }
                            if (totalPickableImages === 0) {
                              toast({
                                title: "No project images",
                                description: "Upload an image or add images to your project first.",
                                variant: "destructive",
                              })
                              return
                            }
                            setSourcePickDialogOpen(true)
                          }}
                        >
                          <Images className="h-3.5 w-3.5 mr-1" />
                          Pick Existing
                        </Button>
                      </div>
                      <input
                        id="avatar-source-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleSourceUpload}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Character Name (optional)</Label>
                      <Input
                        value={characterName}
                        onChange={(e) => setCharacterName(e.target.value)}
                        placeholder="Monster"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Extra Notes (optional)</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Any details to preserve while changing angles..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Style</Label>
                      <Select value={style} onValueChange={setStyle}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STYLE_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                </Tabs>

                {generationMode === "description" && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <FolderOpen className="h-3.5 w-3.5" />
                        Existing Images
                      </Label>
                      {totalPickableImages > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {totalPickableImages}
                        </Badge>
                      )}
                    </div>
                    {isLoadingImages ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading project images…
                      </div>
                    ) : totalPickableImages === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No images in this project yet. Generate avatars or add images in Assets.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-border/60 p-2">
                        {pickableImageGroups.slice(0, 3).map((group) => (
                          <div key={group.label} className="space-y-1.5">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                              {group.label}
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {group.assets.slice(0, 8).map((asset) => (
                                <div
                                  key={asset.id}
                                  className="relative flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border border-border"
                                  title={`${getProjectAssetSourceLabel(asset, projectLocations, characters)} — ${asset.title}`}
                                >
                                  <img
                                    src={asset.content_url!}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p className="text-[11px] text-muted-foreground">
                          Use Pick on any angle card to assign an existing image.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">Shots</CardTitle>
                    <CardDescription>
                      {generationMode === "from_reference"
                        ? "Select shot types to generate from your source image"
                        : "Select which reference shots to generate"}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={resetShotsToDefaults}
                  >
                    Reset
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSelectedAngles(avatarShots.map((a) => a.id))}
                  >
                    All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() =>
                      setSelectedAngles(
                        avatarShots
                          .filter((a) =>
                            (AVATAR_TURNAROUND_ANGLE_IDS as readonly string[]).includes(a.id),
                          )
                          .map((a) => a.id),
                      )
                    }
                  >
                    Essentials
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() =>
                      setSelectedAngles(
                        avatarShots
                          .filter((a) =>
                            ["close_up", "wide_full_body", "clothing", "feet_shoes"].includes(a.id),
                          )
                          .map((a) => a.id),
                      )
                    }
                  >
                    Scene Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSelectedAngles([])}
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {avatarShots.map((angle) => (
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

                <p className="text-[11px] text-muted-foreground">
                  New generations are added as variants — existing images are kept.
                  {projectId
                    ? " Images auto-save to your project."
                    : " Link a project to persist images after refresh."}
                </p>

                <Button
                  className="w-full mt-2"
                  onClick={handleGenerateAll}
                  disabled={isGeneratingAll || !canGenerate()}
                >
                  {isGeneratingAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {generationMode === "from_reference"
                    ? `Generate ${selectedAngles.length} Shot${selectedAngles.length === 1 ? "" : "s"} from Reference`
                    : `Generate ${selectedAngles.length} Shot${selectedAngles.length === 1 ? "" : "s"}`}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Avatar Views
                {totalImageCount > 0 && (
                  <Badge variant="secondary">{totalImageCount}</Badge>
                )}
              </h2>
              {hasAnyImages && projectId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveToProject}
                  disabled={isSavingAll}
                >
                  {isSavingAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save to Project
                </Button>
              )}
            </div>

            {!hasAnyImages && !isGeneratingAll ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <UserCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Describe your character or pick a reference image, then generate
                    production shots — essentials are Front, Side, Back, and Wide full body.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {avatarShots.filter(
                  (a) => selectedAngles.includes(a.id) || (angleGalleries[a.id]?.images.length ?? 0) > 0,
                ).map((angle) => {
                  const gallery = angleGalleries[angle.id]
                  const avatar = gallery?.images[gallery.selectedIndex]
                  const isLoading = generatingAngleId === angle.id

                  return (
                    <Card key={angle.id} className="overflow-hidden">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{angle.label}</CardTitle>
                          <div className="flex items-center gap-1">
                            {gallery && gallery.images.length > 1 && (
                              <Badge variant="outline" className="text-[10px]">
                                {gallery.images.length} variants
                              </Badge>
                            )}
                            {avatar?.source === "existing" && (
                              <Badge variant="secondary" className="text-[10px]">Existing</Badge>
                            )}
                            {avatar?.source === "from_reference" && (
                              <Badge variant="secondary" className="text-[10px]">From Ref</Badge>
                            )}
                            {avatar?.saved && (
                              <Badge variant="outline" className="text-xs">Saved</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="aspect-[3/4] bg-muted relative">
                          {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                          {avatar ? (
                            <img
                              src={avatar.imageUrl}
                              alt={angle.label}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 gap-2">
                              <ImageIcon className="h-8 w-8 opacity-50" />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateSingle(angle)}
                                disabled={isGeneratingAll}
                              >
                                Generate
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => openPickDialog(angle.id)}
                                disabled={isGeneratingAll}
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
                                  "relative flex-shrink-0 w-11 h-14 rounded-md overflow-hidden border-2 transition-all",
                                  idx === gallery.selectedIndex
                                    ? "border-primary ring-2 ring-primary/30 scale-105"
                                    : "border-border/60 opacity-75 hover:opacity-100 hover:border-primary/40",
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
                        {avatar && (
                          <div className="flex flex-wrap gap-1 p-2 border-t border-border">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 min-w-[4.5rem] h-8 text-xs"
                              asChild
                            >
                              <a href={avatar.imageUrl} download target="_blank" rel="noreferrer">
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 min-w-[4.5rem] h-8 text-xs"
                              onClick={() => openImageEditDialog(angle.id)}
                              disabled={isLoading || isGeneratingAll || imageEditUploading}
                            >
                              <Wand2 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 min-w-[4.5rem] h-8 text-xs"
                              onClick={() => openPickDialog(angle.id)}
                              disabled={isLoading || isGeneratingAll}
                            >
                              <Images className="h-3 w-3 mr-1" />
                              Pick
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 min-w-[4.5rem] h-8 text-xs"
                              onClick={() => handleGenerateSingle(angle)}
                              disabled={isLoading || isGeneratingAll}
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 min-w-[4.5rem] h-8 text-xs text-destructive hover:text-destructive"
                              onClick={() => avatar && void handleDeleteAvatarImage(angle, avatar)}
                              disabled={isLoading || isGeneratingAll || imageEditUploading}
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
          </div>
        </div>

        <Dialog open={sourcePickDialogOpen} onOpenChange={setSourcePickDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Pick source image</DialogTitle>
              <DialogDescription>
                Choose one image to generate all avatar angles from.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                        onClick={() => handleSelectSourceReference(asset)}
                        className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary hover:ring-2 hover:ring-primary/30 transition-all group text-left"
                        title={asset.title}
                      >
                        <img
                          src={asset.content_url!}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white line-clamp-2">
                            {getProjectAssetSourceLabel(asset, projectLocations, characters)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
                Choose an existing image from your project to assign to this angle.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                        onClick={() =>
                          pickDialogAngle && handlePickExistingImage(pickDialogAngle, asset)
                        }
                        className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary hover:ring-2 hover:ring-primary/30 transition-all group text-left"
                        title={asset.title}
                      >
                        <img
                          src={asset.content_url!}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white line-clamp-2">
                            {getProjectAssetSourceLabel(asset, projectLocations, characters)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
                <Label htmlFor="shot-label">Shot name</Label>
                <Input
                  id="shot-label"
                  value={shotFormLabel}
                  onChange={(e) => setShotFormLabel(e.target.value)}
                  placeholder="Three-Quarter View"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shot-prompt">Framing description</Label>
                <Textarea
                  id="shot-prompt"
                  value={shotFormPrompt}
                  onChange={(e) => setShotFormPrompt(e.target.value)}
                  placeholder="three-quarter angle from slightly above, medium shot showing face and upper body"
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

        <Dialog
          open={imageEditDialogOpen}
          onOpenChange={(open) => {
            if (!open && !imageEditUploading) {
              setImageEditDialogOpen(false)
              setImageEditAngleId(null)
              clearImageEditReference()
              clearImageEditStyleLinks()
              setImageEditPrompt("")
            }
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
                  : "Edit this avatar view using a reference image."}
              </DialogDescription>
            </DialogHeader>

            {imageEditAngle && imageEditCurrentImage && (
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30 max-h-40">
                  <img
                    src={imageEditCurrentImage.imageUrl}
                    alt={imageEditAngle.label}
                    className="w-full h-full max-h-40 object-contain"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Edit using your locked model ({getLockedImageModelLabel() || "lock one in AI Settings"}).
                  {getLockedImageConfig({ withReferenceImage: true })?.supportsReference
                    ? " Describe changes below and optionally link another project image as a second reference."
                    : " Your locked model does not support reference editing — use GPT Image 2 or Runway ML."}
                </p>

                {imageEditUploading && imageEditProgress ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {imageEditProgress}
                  </p>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="avatar-image-edit-prompt" className="text-xs sm:text-sm">
                    Describe your edit
                  </Label>
                  <Textarea
                    id="avatar-image-edit-prompt"
                    value={imageEditPrompt}
                    onChange={(e) => setImageEditPrompt(e.target.value)}
                    placeholder='e.g., warmer lighting, darker jacket, softer background'
                    className="min-h-[72px] text-xs sm:text-sm resize-none"
                    disabled={imageEditUploading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar-image-edit-ref" className="text-xs text-muted-foreground">
                    Primary reference (optional)
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="avatar-image-edit-ref"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imageEditUploading}
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
                      disabled={imageEditUploading}
                      onClick={() => document.getElementById("avatar-image-edit-ref")?.click()}
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
                          disabled={imageEditUploading}
                          onClick={clearImageEditReference}
                          title="Remove uploaded reference"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border">
                        <img
                          src={imageEditCurrentImage.imageUrl}
                          alt={imageEditAngle.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {imageEditReferenceFile
                      ? "Using your uploaded image as the primary reference."
                      : "Uses the current avatar image if you don't upload one."}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">
                      Link existing image (optional)
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adds more images as references from characters, locations, or project assets.
                    Select up to {MAX_LINKED_REFERENCE_IMAGES}. Your description above is the only prompt.
                  </p>
                  {isLoadingImages ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading project assets…
                    </div>
                  ) : pickableImageGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      No other images in this project yet.
                    </p>
                  ) : (
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
                                disabled={imageEditUploading}
                                onClick={() => toggleImageEditStyleLink(asset.id)}
                                className={cn(
                                  "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                                  imageEditStyleLinkAssetIds.includes(asset.id)
                                    ? "border-violet-500 ring-2 ring-violet-500/40"
                                    : "border-border hover:border-violet-500/50",
                                )}
                                title={`${getProjectAssetSourceLabel(asset, projectLocations, characters)} — ${asset.title}`}
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
                  {imageEditStyleLinkAssetIds.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-violet-400">
                        {imageEditStyleLinkAssetIds.length} of {MAX_LINKED_REFERENCE_IMAGES} linked as
                        additional references
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={imageEditUploading}
                        onClick={clearImageEditStyleLinks}
                      >
                        Clear all
                      </Button>
                    </div>
                  ) : null}
                </div>

                <Button
                  size="sm"
                  onClick={() => void handleAvatarImageEdit()}
                  disabled={
                    imageEditUploading ||
                    !imageEditPrompt.trim() ||
                    !getLockedImageConfig({ withReferenceImage: true })?.supportsReference ||
                    (!imageEditReferenceFile && !imageEditCurrentImage?.imageUrl)
                  }
                  className="gap-2 w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {imageEditUploading && imageEditPrompt.trim() ? (
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
      </main>
    </div>
  )
}
