"use client"

import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { useAuthReady } from "@/components/auth-hooks"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { AISettingsService } from "@/lib/ai-settings-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { SavedPromptsService, formatSavedPromptOptionLabel, type SavedPrompt } from "@/lib/saved-prompts-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import {
  AvatarImagesService,
  type AvatarImageRecord,
} from "@/lib/avatar-images-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import {
  buildLinkedAssetGroups,
  getProjectAssetSourceLabel,
  referenceUrlToFile,
} from "@/lib/project-image-linking"
import {
  AVATAR_ANGLES,
  AVATAR_REFERENCE_COLLAGE_ANGLE_ID,
  AVATAR_TURNAROUND_ANGLE_IDS,
  avatarPromptMaxLength,
  buildAvatarPrompt,
  buildAvatarEditPrompt,
  createCustomAvatarAngle,
  type AvatarAngle,
} from "@/lib/avatar-angles"
import { buildAvatarCollageBlob } from "@/lib/avatar-collage"
import { StorageService } from "@/lib/storage-service"
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
  LayoutGrid,
  Star,
  RefreshCw,
  Eye,
} from "lucide-react"
import { StorageThumbImg } from "@/components/storage-thumb-img"

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
  avatarImageId?: string
}

interface AngleGallery {
  images: AvatarImage[]
  selectedIndex: number
}

type AngleGalleries = Record<string, AngleGallery>

const MAX_LINKED_REFERENCE_IMAGES = 5

/** Resized previews — full URL is used for popup viewing and AI reference. */
const EDIT_PREVIEW_THUMB_WIDTH = 480
const EDIT_SMALL_THUMB_WIDTH = 128
const CARD_THUMB_WIDTH = 720
const EDIT_THUMB_QUALITY = 65

function isAvatarAsset(asset: Asset): boolean {
  return (
    asset.content_type === "image" &&
    !!asset.content_url &&
    asset.metadata?.type === "avatar" &&
    typeof asset.metadata?.avatar_angle === "string"
  )
}

function buildGalleriesFromAvatarImageRecords(images: AvatarImageRecord[]): AngleGalleries {
  const galleries: AngleGalleries = {}
  const sorted = [...images].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  for (const row of sorted) {
    const gallery = galleries[row.angle_id] ?? { images: [], selectedIndex: 0 }
    gallery.images.push({
      id: row.id,
      avatarImageId: row.id,
      imageUrl: row.image_url,
      prompt: row.prompt || row.angle_label,
      saved: true,
      assetId: row.asset_id || undefined,
      source: row.source,
    })
    galleries[row.angle_id] = gallery
  }

  for (const angleId of Object.keys(galleries)) {
    const gallery = galleries[angleId]
    gallery.selectedIndex = Math.max(0, gallery.images.length - 1)
  }

  return galleries
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

function mergeAngleGalleries(existing: AngleGalleries, incoming: AngleGalleries): AngleGalleries {
  const merged: AngleGalleries = { ...existing }

  for (const [angleId, incomingGallery] of Object.entries(incoming)) {
    const current = merged[angleId] ?? { images: [], selectedIndex: 0 }
    const seenUrls = new Set(current.images.map((img) => img.imageUrl))
    const nextImages = [...current.images]

    for (const image of incomingGallery.images) {
      if (seenUrls.has(image.imageUrl)) continue
      seenUrls.add(image.imageUrl)
      nextImages.push(image)
    }

    merged[angleId] = {
      images: nextImages,
      selectedIndex:
        nextImages.length > current.images.length
          ? nextImages.length - 1
          : nextImages.length > 0
            ? Math.min(current.selectedIndex, nextImages.length - 1)
            : 0,
    }
  }

  return merged
}

function getAvatarGalleryStorageKey(
  projectId: string,
  userId: string,
  characterId: string,
) {
  return projectId
    ? `avatar-galleries-project-${projectId}-char-${characterId}`
    : `avatar-galleries-user-${userId}-char-${characterId}`
}

function loadCachedAngleGalleries(
  projectId: string,
  userId: string,
  characterId: string,
): AngleGalleries {
  if (!userId || !characterId) return {}
  try {
    const raw = localStorage.getItem(getAvatarGalleryStorageKey(projectId, userId, characterId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as AngleGalleries
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveCachedAngleGalleries(
  projectId: string,
  userId: string,
  characterId: string,
  galleries: AngleGalleries,
) {
  if (!userId || !characterId) return
  const hasImages = Object.values(galleries).some((gallery) => gallery.images.length > 0)
  if (!hasImages) return
  try {
    localStorage.setItem(
      getAvatarGalleryStorageKey(projectId, userId, characterId),
      JSON.stringify(galleries),
    )
  } catch {
    // ignore quota errors
  }
}

function buildCharacterVisualDescription(char: Character): string {
  return [
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
}

function buildGalleriesForCharacter(
  avatarRecords: AvatarImageRecord[],
  projectAssets: Asset[],
  characterId: string,
): AngleGalleries {
  const records = avatarRecords.filter(
    (img) => img.angle_id !== AVATAR_REFERENCE_COLLAGE_ANGLE_ID,
  )
  const avatarAssets = projectAssets.filter(
    (asset) => isAvatarAsset(asset) && asset.character_id === characterId,
  )

  let galleries = buildGalleriesFromAvatarImageRecords(records)
  if (avatarAssets.length > 0) {
    galleries = mergeAngleGalleries(galleries, buildGalleriesFromAvatarAssets(avatarAssets))
  }
  return galleries
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
const EMPTY_STYLE_VALUE = "__none__"

type GenerateImageFailure = {
  status: number
  statusText: string
  contentBlocked: boolean
  error: string
  details?: string
  raw: string
}

async function readGenerateImageFailure(res: Response): Promise<GenerateImageFailure> {
  const raw = await res.text()
  let parsed: {
    error?: unknown
    details?: unknown
    contentBlocked?: unknown
  } | null = null
  try {
    parsed = raw ? (JSON.parse(raw) as typeof parsed) : null
  } catch {
    parsed = null
  }
  const error =
    (typeof parsed?.error === "string" && parsed.error) ||
    (typeof parsed?.details === "string" && parsed.details) ||
    raw.trim() ||
    res.statusText ||
    `HTTP ${res.status}`
  return {
    status: res.status,
    statusText: res.statusText,
    contentBlocked: parsed?.contentBlocked === true,
    error,
    details: typeof parsed?.details === "string" ? parsed.details : undefined,
    raw: raw.slice(0, 800),
  }
}

export default function AvatarsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { userId, ready } = useAuthReady()
  const { toast } = useToast()

  const [projectId, setProjectId] = useState(searchParams.get("projectId") || "")
  const [characterName, setCharacterName] = useState("")
  const [description, setDescription] = useState("")
  const [style, setStyle] = useState("")
  const [noBackground, setNoBackground] = useState(true)
  const [avatarShots, setAvatarShots] = useState<AvatarAngle[]>([...AVATAR_ANGLES])
  const [selectedAngles, setSelectedAngles] = useState<string[]>(
    [...AVATAR_TURNAROUND_ANGLE_IDS],
  )
  const [characters, setCharacters] = useState<Character[]>([])
  const [linkedCharacterId, setLinkedCharacterId] = useState(
    searchParams.get("characterId") || "",
  )
  const [angleGalleries, setAngleGalleries] = useState<AngleGalleries>({})
  const [generatingAngleIds, setGeneratingAngleIds] = useState<Set<string>>(() => new Set())
  const [generatingProgressByAngleId, setGeneratingProgressByAngleId] = useState<Map<string, string>>(
    () => new Map(),
  )
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [projectImageAssets, setProjectImageAssets] = useState<Asset[]>([])
  const [characterImageAssets, setCharacterImageAssets] = useState<Asset[]>([])
  const [projectLocations, setProjectLocations] = useState<Location[]>([])
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false)
  const [projectAvatarImages, setProjectAvatarImages] = useState<AvatarImageRecord[]>([])
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
  const [imageEditReferenceFile, setImageEditReferenceFile] = useState<File | null>(null)
  const [imageEditReferencePreview, setImageEditReferencePreview] = useState<string | null>(null)
  const [imageEditStyleLinkAssetIds, setImageEditStyleLinkAssetIds] = useState<string[]>([])
  const [viewImageDialog, setViewImageDialog] = useState<{
    url: string
    label: string
  } | null>(null)
  const [shotDialogOpen, setShotDialogOpen] = useState(false)
  const [editingShotId, setEditingShotId] = useState<string | null>(null)
  const [shotFormLabel, setShotFormLabel] = useState("")
  const [shotFormPrompt, setShotFormPrompt] = useState("")
  const [galleriesHydrated, setGalleriesHydrated] = useState(false)
  const [uploadingAngleId, setUploadingAngleId] = useState<string | null>(null)
  const [collagePreviewUrl, setCollagePreviewUrl] = useState<string | null>(null)
  const [collagePreviewBlob, setCollagePreviewBlob] = useState<Blob | null>(null)
  const [isBuildingCollage, setIsBuildingCollage] = useState(false)
  const [isSavingCollage, setIsSavingCollage] = useState(false)
  const [isDeletingCollage, setIsDeletingCollage] = useState(false)
  const [savedCollageUrl, setSavedCollageUrl] = useState<string | null>(null)
  const [settingPortraitUrl, setSettingPortraitUrl] = useState<string | null>(null)
  const [portraitPickDialogOpen, setPortraitPickDialogOpen] = useState(false)
  const [pendingPortraitImageUrl, setPendingPortraitImageUrl] = useState<string | null>(null)
  const [savedCharacterPrompts, setSavedCharacterPrompts] = useState<SavedPrompt[]>([])
  const [isLoadingSavedPrompts, setIsLoadingSavedPrompts] = useState(false)
  const [selectedDescriptionPromptId, setSelectedDescriptionPromptId] = useState("")
  const [selectedEditPromptId, setSelectedEditPromptId] = useState("")
  const hydrationKeyRef = useRef<string | null>(null)
  const shotUploadInputRef = useRef<HTMLInputElement>(null)
  const shotUploadAngleIdRef = useRef<string | null>(null)
  const collageUploadInputRef = useRef<HTMLInputElement>(null)

  const updateAvatarsUrl = useCallback(
    (nextProjectId: string, nextCharacterId?: string) => {
      if (!nextProjectId) {
        router.replace("/avatars", { scroll: false })
        return
      }
      const params = new URLSearchParams({ projectId: nextProjectId })
      if (nextCharacterId) params.set("characterId", nextCharacterId)
      router.replace(`/avatars?${params.toString()}`, { scroll: false })
    },
    [router],
  )

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
      .then(setImageAiSetting)
      .catch(() => setImageAiSetting(null))
  }, [ready])

  useEffect(() => {
    if (!ready || !userId) {
      setSavedCharacterPrompts([])
      return
    }
    setIsLoadingSavedPrompts(true)
    SavedPromptsService.getSavedPrompts(userId, projectId || null)
      .then((prompts) => {
        setSavedCharacterPrompts(prompts)
      })
      .catch(() => setSavedCharacterPrompts([]))
      .finally(() => setIsLoadingSavedPrompts(false))
  }, [ready, userId, projectId])

  const applySavedPromptText = (promptText: string, target: "description" | "edit") => {
    const text = promptText.trim()
    if (!text) return
    if (target === "description") {
      setDescription(text)
      toast({
        title: "Prompt applied",
        description: "Loaded into visual description for avatar generation.",
      })
    } else {
      setImageEditPrompt(text)
      toast({
        title: "Prompt applied",
        description: "Loaded into the edit prompt for this image.",
      })
    }
  }

  const handleSavedPromptSelect = (
    value: string,
    target: "description" | "edit",
  ) => {
    if (value === "__none__") {
      if (target === "description") setSelectedDescriptionPromptId("")
      else setSelectedEditPromptId("")
      return
    }

    if (value === "__character_master__") {
      const master = characters.find((c) => c.id === linkedCharacterId)?.master_prompt?.trim()
      if (!master) {
        toast({
          title: "No master prompt",
          description: "This character does not have a master prompt saved yet.",
          variant: "destructive",
        })
        return
      }
      if (target === "description") setSelectedDescriptionPromptId(value)
      else setSelectedEditPromptId(value)
      applySavedPromptText(master, target)
      return
    }

    const saved = savedCharacterPrompts.find((p) => p.id === value)
    if (!saved) return
    if (target === "description") setSelectedDescriptionPromptId(value)
    else setSelectedEditPromptId(value)
    applySavedPromptText(saved.prompt, target)
    if (saved.style && target === "description") {
      setStyle(saved.style)
    }
  }

  const hasSavedPromptOptions =
    savedCharacterPrompts.length > 0 ||
    Boolean(
      characters.find((c) => c.id === linkedCharacterId)?.master_prompt?.trim(),
    )

  useEffect(() => {
    if (!ready || !projectId) {
      setCharacters([])
      setProjectImageAssets([])
      setProjectLocations([])
      setCharacterImageAssets([])
      setLinkedCharacterId("")
      setAngleGalleries({})
      setProjectAvatarImages([])
      hydrationKeyRef.current = null
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
    const urlCharacterId = searchParams.get("characterId") || ""
    if (!projectId || !characters.length) return

    if (urlCharacterId && characters.some((c) => c.id === urlCharacterId)) {
      if (linkedCharacterId !== urlCharacterId) {
        hydrationKeyRef.current = null
        setLinkedCharacterId(urlCharacterId)
      }
      return
    }

    if (linkedCharacterId && !characters.some((c) => c.id === linkedCharacterId)) {
      hydrationKeyRef.current = null
      setLinkedCharacterId("")
      setAngleGalleries({})
      setProjectAvatarImages([])
      updateAvatarsUrl(projectId)
    }
  }, [characters, projectId, searchParams, linkedCharacterId, updateAvatarsUrl])

  useEffect(() => {
    if (!ready || !userId || !projectId || isLoadingImages) return

    if (!linkedCharacterId) {
      setAngleGalleries({})
      setProjectAvatarImages([])
      hydrationKeyRef.current = null
      setGalleriesHydrated(true)
      return
    }

    const hydrationKey = `${projectId}:${userId}:${linkedCharacterId}`
    if (hydrationKeyRef.current === hydrationKey) return

    setAngleGalleries(loadCachedAngleGalleries(projectId, userId, linkedCharacterId))
    let cancelled = false
    setIsLoadingAvatars(true)

    AvatarImagesService.listImagesForCharacter(projectId, linkedCharacterId)
      .then((images) => {
        if (cancelled) return

        setProjectAvatarImages(images)

        const galleries = buildGalleriesForCharacter(
          images,
          projectImageAssets,
          linkedCharacterId,
        )
        setAngleGalleries(galleries)
        saveCachedAngleGalleries(projectId, userId, linkedCharacterId, galleries)
        hydrationKeyRef.current = hydrationKey
        setGalleriesHydrated(true)

        const char = characters.find((c) => c.id === linkedCharacterId)
        if (char) {
          setCharacterName(char.name)
          const visual = buildCharacterVisualDescription(char)
          if (visual.trim()) setDescription(visual)
        } else {
          const nameFromRow = images.find((img) => img.metadata?.character_name)
          const metaName =
            typeof nameFromRow?.metadata?.character_name === "string"
              ? nameFromRow.metadata.character_name
              : null
          if (metaName?.trim()) setCharacterName(metaName)
        }
      })
      .catch(() => {
        if (!cancelled) {
          hydrationKeyRef.current = hydrationKey
          setGalleriesHydrated(true)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAvatars(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    ready,
    userId,
    projectId,
    linkedCharacterId,
    isLoadingImages,
    projectImageAssets,
    characters,
  ])

  useEffect(() => {
    if (!userId || !linkedCharacterId) return
    saveCachedAngleGalleries(projectId, userId, linkedCharacterId, angleGalleries)
  }, [angleGalleries, userId, projectId, linkedCharacterId])

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
      const selectNew = options?.selectNew ?? true
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
    if (!projectId) {
      return createAvatarImage(image)
    }

    try {
      let assetId: string | undefined
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
        assetId = asset.id
        setProjectImageAssets((prev) =>
          prev.some((a) => a.id === asset.id) ? prev : [asset, ...prev],
        )
      } catch (assetError) {
        console.error("Failed to mirror avatar to project assets:", assetError)
      }

      const record = await AvatarImagesService.createImage({
        project_id: projectId,
        character_id: linkedCharacterId || null,
        character_name: characterName || null,
        description: description || null,
        style,
        angle_id: angle.id,
        angle_label: angle.label,
        image_url: image.imageUrl,
        prompt: image.prompt,
        source: image.source || "generated",
        asset_id: assetId ?? null,
        metadata: {
          character_name: characterName || null,
        },
      })

      setProjectAvatarImages((prev) => [...prev, record])

      if (linkedCharacterId) {
        const character = characters.find((c) => c.id === linkedCharacterId)
        if (character) {
          const refs = Array.isArray(character.reference_images)
            ? character.reference_images.filter((url): url is string => !!url)
            : []
          if (!refs.includes(image.imageUrl)) {
            await CharactersService.updateCharacter(linkedCharacterId, {
              reference_images: [image.imageUrl, ...refs],
            })
          }
        }
      }

      return {
        id: record.id,
        avatarImageId: record.id,
        imageUrl: image.imageUrl,
        prompt: image.prompt,
        source: image.source,
        saved: true,
        assetId,
      }
    } catch (error) {
      console.error("Failed to save avatar image:", error)
      return createAvatarImage(image)
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

    if (image.avatarImageId) {
      try {
        const deleted = await AvatarImagesService.deleteImage(image.avatarImageId)
        if (deleted) {
          setProjectAvatarImages((prev) =>
            prev.filter((row) => row.id !== deleted.id),
          )
        }
      } catch (error) {
        toast({
          title: "Removed from gallery",
          description:
            error instanceof Error
              ? error.message
              : "Could not delete the avatar record.",
          variant: "destructive",
        })
      }
    } else {
      const rowId =
        projectAvatarImages.find(
          (row) => row.id === image.id || row.asset_id === image.assetId,
        )?.id ?? null
      if (rowId) {
        try {
          const deleted = await AvatarImagesService.deleteImage(rowId)
          if (deleted) {
            setProjectAvatarImages((prev) =>
              prev.filter((row) => row.id !== deleted.id),
            )
          }
        } catch {
          // avatar row may already be gone
        }
      }
    }

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

  const closeImageEditDialog = () => {
    setImageEditDialogOpen(false)
    setImageEditAngleId(null)
    setSelectedEditPromptId("")
    clearImageEditReference()
    clearImageEditStyleLinks()
    setImageEditPrompt("")
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
    setSelectedEditPromptId("")
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
      debugLabel?: string
      debugAngleId?: string
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
      formData.append("costSource", "avatars")
      formData.append("file", referenceFile)
      if (options?.debugLabel) formData.append("debugLabel", options.debugLabel)
      if (options?.debugAngleId) formData.append("debugAngleId", options.debugAngleId)
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
        costSource: "avatars",
        debugLabel: options?.debugLabel,
        debugAngleId: options?.debugAngleId,
      }),
    })
  }

  const generateAngle = async (angle: AvatarAngle) => {
    if (!userId) {
      console.error("[avatars] generate skipped", {
        angleId: angle.id,
        angleLabel: angle.label,
        reason: "No signed-in user",
      })
      return null
    }

    const useReference = generationMode === "from_reference" && !!sourceReference
    const config = await getImageConfig(useReference)
    const debugPayload = {
      angleId: angle.id,
      angleLabel: angle.label,
      mode: generationMode,
      model: config.apiModel,
      service: config.service,
      hasReference: useReference,
    }
    console.log("[avatars] generate start", debugPayload)

    const throwFromFailedResponse = async (res: Response): Promise<never> => {
      const failure = await readGenerateImageFailure(res)
      console.error("[avatars] generate failed", {
        ...debugPayload,
        status: failure.status,
        statusText: failure.statusText,
        contentBlocked: failure.contentBlocked,
        error: failure.error,
        details: failure.details,
        raw: failure.raw,
      })
      throw new Error(
        failure.contentBlocked
          ? `${angle.label} blocked by safety filters (${failure.status}): ${failure.error}`
          : `${angle.label} failed (${failure.status}): ${failure.error}`,
      )
    }

    const promptMaxLength = avatarPromptMaxLength(config.apiModel, config.service)

    if (useReference) {
      if (!config.supportsReference) {
        console.error("[avatars] generate failed", {
          ...debugPayload,
          reason: "Locked image model does not support reference editing",
        })
        throw new Error(
          "Your image model doesn't support reference editing. Lock GPT Image 2 or Runway in AI Settings.",
        )
      }

      const prompt = buildAvatarEditPrompt(characterName, description, angle, style, {
        maxLength: promptMaxLength,
        noBackground,
      })
      const referenceFile =
        sourceReference!.file ??
        (await referenceUrlToFile(
          sourceReference!.imageUrl,
          `avatar-source-${sourceReference!.assetId || "upload"}.png`,
        ))

      const res = await requestImageGeneration(prompt, config, {
        referenceFile,
        debugLabel: angle.label,
        debugAngleId: angle.id,
      })
      if (!res.ok) {
        await throwFromFailedResponse(res)
      }

      const data = await res.json()
      const imageUrl = data.bucketUrl || data.imageUrl || data.url
      if (!imageUrl) {
        console.error("[avatars] generate failed", {
          ...debugPayload,
          reason: "API returned 200 but no image URL",
          keys: Object.keys(data || {}),
        })
        throw new Error("No image returned")
      }

      console.log("[avatars] generate ok", {
        ...debugPayload,
        imageUrl: String(imageUrl).slice(0, 120),
      })
      return {
        imageUrl,
        prompt,
        source: "from_reference" as const,
      }
    }

    const prompt = buildAvatarPrompt(characterName, description, angle, style, {
      maxLength: promptMaxLength,
      noBackground,
    })
    const res = await requestImageGeneration(prompt, config, {
      debugLabel: angle.label,
      debugAngleId: angle.id,
    })

    if (!res.ok) {
      await throwFromFailedResponse(res)
    }

    const data = await res.json()
    const imageUrl = data.bucketUrl || data.imageUrl || data.url
    if (!imageUrl) {
      console.error("[avatars] generate failed", {
        ...debugPayload,
        reason: "API returned 200 but no image URL",
        keys: Object.keys(data || {}),
      })
      throw new Error("No image returned")
    }

    console.log("[avatars] generate ok", {
      ...debugPayload,
      imageUrl: String(imageUrl).slice(0, 120),
    })
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

    if (projectAvatarImages.length > 0) {
      const avatarStudioAssets = projectAvatarImages
        .map((row) =>
          addAsset({
            id: row.id,
            user_id: row.user_id,
            project_id: row.project_id,
            character_id: row.character_id ?? undefined,
            title: `${row.angle_label}${row.metadata?.character_name ? ` — ${row.metadata.character_name}` : ""}`,
            content_type: "image",
            content_url: row.image_url,
            prompt: row.prompt ?? undefined,
            version: 1,
            is_latest_version: true,
            metadata: {
              type: "avatar",
              avatar_angle: row.angle_id,
              avatar_source: row.source,
            },
            created_at: row.created_at,
            updated_at: row.updated_at,
          }),
        )
        .filter(Boolean) as Asset[]
      if (avatarStudioAssets.length > 0) {
        groups.push({ label: "Avatar Studio", assets: avatarStudioAssets })
      }
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
    projectAvatarImages,
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
    }, { selectNew: true })
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

  const openShotUpload = (angleId: string) => {
    if (!projectId) {
      toast({
        title: "Select a project",
        description: "Link a movie project to upload a shot.",
        variant: "destructive",
      })
      return
    }
    shotUploadAngleIdRef.current = angleId
    shotUploadInputRef.current?.click()
  }

  const handleShotUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    const angleId = shotUploadAngleIdRef.current
    shotUploadAngleIdRef.current = null
    if (!file || !angleId || !projectId) return

    const angle = avatarShots.find((shot) => shot.id === angleId)
    if (!angle) return

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Choose an image",
        description: "Shot uploads must be an image file.",
        variant: "destructive",
      })
      return
    }

    try {
      setUploadingAngleId(angleId)
      const stored = await StorageService.uploadFile({
        file,
        projectId,
        fileType: "image",
        metadata: {
          type: "avatar",
          avatar_angle: angle.id,
          avatar_source: "existing",
          character_name: characterName || null,
        },
      })
      await addAvatarImage(
        angle,
        {
          imageUrl: stored.url,
          prompt: `Uploaded image: ${file.name}`,
          source: "existing",
        },
        { selectNew: true },
      )
      toast({
        title: "Shot uploaded",
        description: `${angle.label} now uses your uploaded image.`,
      })
    } catch (error) {
      console.error("Failed to upload avatar shot:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload this shot.",
        variant: "destructive",
      })
    } finally {
      setUploadingAngleId(null)
    }
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
    if (!linkedCharacterId) return false
    if (selectedAngles.length === 0) return false
    if (generationMode === "from_reference") return !!sourceReference
    return !!(description.trim() || characterName.trim())
  }

  const handleGenerateAll = async () => {
    if (!linkedCharacterId) {
      toast({
        title: "Character required",
        description: "Select a character before generating avatar shots.",
        variant: "destructive",
      })
      return
    }
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

    setIsBatchGenerating(true)
    const anglesToGenerate = avatarShots.filter((a) => selectedAngles.includes(a.id))
    let created = 0
    const failed: { angleId: string; angleLabel: string; reason: string }[] = []
    console.log("[avatars] batch start", {
      characterId: linkedCharacterId,
      mode: generationMode,
      angles: anglesToGenerate.map((a) => ({ id: a.id, label: a.label })),
    })

    try {
      for (const angle of anglesToGenerate) {
        startAngleJob(angle.id, "Generating…")
        try {
          const result = await generateAngle(angle)
          if (result) {
            await addAvatarImage(angle, result, { selectNew: true })
            created++
          } else {
            failed.push({
              angleId: angle.id,
              angleLabel: angle.label,
              reason: "No image returned (check [avatars] generate skipped)",
            })
            console.error("[avatars] generate skipped in batch", {
              angleId: angle.id,
              angleLabel: angle.label,
            })
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Could not generate this angle."
          failed.push({ angleId: angle.id, angleLabel: angle.label, reason })
          console.error("[avatars] batch angle failed", {
            angleId: angle.id,
            angleLabel: angle.label,
            reason,
          })
          toast({
            title: `${angle.label} failed`,
            description: reason,
            variant: "destructive",
          })
        } finally {
          finishAngleJob(angle.id)
        }
      }
      console.log("[avatars] batch done", {
        attempted: anglesToGenerate.length,
        created,
        failed,
      })
      if (created > 0) {
        toast({
          title: "Avatars generated",
          description: generationMode === "from_reference"
            ? `Added ${created} angle${created === 1 ? "" : "s"} from your reference image.`
            : `Added ${created} angle${created === 1 ? "" : "s"}.`,
        })
      }
    } finally {
      setIsBatchGenerating(false)
    }
  }

  const handleGenerateSingle = async (angle: AvatarAngle) => {
    if (!linkedCharacterId) {
      toast({
        title: "Character required",
        description: "Select a character before generating avatar shots.",
        variant: "destructive",
      })
      return
    }
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

    if (isAngleGenerating(angle.id)) {
      toast({
        title: "Already in progress",
        description: "This angle is still generating.",
      })
      return
    }

    startAngleJob(angle.id, "Generating…")
    try {
      const result = await generateAngle(angle)
      if (result) {
        await addAvatarImage(angle, result, { selectNew: true })
        const variantCount = (angleGalleries[angle.id]?.images.length ?? 0) + 1
        toast({
          title: variantCount > 1 ? "Regenerated" : "Generated",
          description:
            variantCount > 1
              ? `${angle.label} — new shot added as variant ${variantCount}`
              : angle.label,
        })
      }
    } catch (error) {
      console.error("[avatars] single generate failed", {
        angleId: angle.id,
        angleLabel: angle.label,
        error: error instanceof Error ? error.message : error,
      })
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate",
        variant: "destructive",
      })
    } finally {
      finishAngleJob(angle.id)
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
    const referenceFile = imageEditReferenceFile
    const styleLinkAssetIds = [...imageEditStyleLinkAssetIds]
    if (!angleId || !userId) return
    if (!direction) {
      toast({
        title: "Describe your edit",
        description: 'e.g. "warmer lighting" or "darker jacket".',
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
      const config = requireLockedImageConfig({ withReferenceImage: true })
      let prompt = direction
      if (angle) prompt += ` Avatar view: ${angle.label}.`
      if (characterName.trim()) prompt += ` Character: ${characterName.trim()}.`
      prompt = prompt.slice(0, 990)

      const styleReferenceFiles: File[] = []
      for (const assetId of styleLinkAssetIds) {
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

      let primaryReferenceFile: File | undefined
      if (config.supportsReference) {
        primaryReferenceFile =
          referenceFile ??
          (await referenceUrlToFile(
            currentImage!.imageUrl,
            `avatar-edit-${angleId}.png`,
          ))
      }

      setAngleJobProgress(angleId, "Calling image model…")
      const response = await requestImageGeneration(prompt, config, {
        referenceFile: primaryReferenceFile,
        styleReferenceFiles: config.supportsReference ? styleReferenceFiles : undefined,
        debugLabel: `Edit ${angle?.label || angleId}`,
        debugAngleId: angleId,
      })
      if (!response.ok) {
        const failure = await readGenerateImageFailure(response)
        console.error("[avatars] edit failed", {
          angleId,
          angleLabel: angle?.label,
          status: failure.status,
          contentBlocked: failure.contentBlocked,
          error: failure.error,
          details: failure.details,
          raw: failure.raw,
        })
        throw new Error(failure.error || "Failed to edit image")
      }
      const result = await response.json()
      const imageUrl = result.bucketUrl || result.imageUrl || result.url
      if (!imageUrl) {
        throw new Error("Failed to edit image")
      }

      if (angle) {
        await addAvatarImage(angle, {
          imageUrl,
          prompt,
          source: "generated",
        }, { selectNew: true })
      }

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
      finishAngleJob(angleId)
    }
  }

  const handleSaveToProject = async () => {
    if (!projectId) {
      toast({
        title: "Select a project",
        description: "Link a movie project to save avatars.",
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
        for (const avatar of gallery.images) {
          if (avatar.saved) continue
          if (avatar.source === "existing" && avatar.assetId) continue
          const persisted = await persistAvatarImage(angle, {
            imageUrl: avatar.imageUrl,
            prompt: avatar.prompt,
            source: avatar.source,
          })
          if (persisted.id !== avatar.id) {
            setAngleGalleries((prev) => {
              const current = prev[angle.id]
              if (!current) return prev
              return {
                ...prev,
                [angle.id]: {
                  ...current,
                  images: current.images.map((img) =>
                    img.id === avatar.id ? persisted : img,
                  ),
                },
              }
            })
          } else {
            markAngleImagesSaved(angle.id, [avatar.id])
          }
          saved++
        }
      }
      toast({
        title: "Saved to project",
        description: `${saved} avatar image${saved === 1 ? "" : "s"} saved.`,
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
    hydrationKeyRef.current = null
    setLinkedCharacterId(id)
    setSourceReference(null)
    setCollagePreviewUrl(null)
    setCollagePreviewBlob(null)
    setSavedCollageUrl(null)
    setSelectedDescriptionPromptId("")

    const char = characters.find((c) => c.id === id)
    if (!char) return

    setCharacterName(char.name)
    const visual = buildCharacterVisualDescription(char)
    if (visual.trim()) setDescription(visual)

    if (projectId) {
      updateAvatarsUrl(projectId, id)
    }
  }

  const totalImageCount = useMemo(
    () => Object.values(angleGalleries).reduce((sum, g) => sum + g.images.length, 0),
    [angleGalleries],
  )

  const collageSourceItems = useMemo(
    () =>
      avatarShots
        .map((angle) => {
          const gallery = angleGalleries[angle.id]
          if (!gallery?.images.length) return null
          const image = gallery.images[gallery.selectedIndex] ?? gallery.images[0]
          return {
            label: angle.label,
            imageUrl: image.imageUrl,
          }
        })
        .filter((item): item is { label: string; imageUrl: string } => Boolean(item)),
    [avatarShots, angleGalleries],
  )

  const savedCollageRecord = useMemo(() => {
    const matches = projectAvatarImages.filter(
      (img) => img.angle_id === AVATAR_REFERENCE_COLLAGE_ANGLE_ID,
    )
    if (linkedCharacterId) {
      return matches.find((img) => img.character_id === linkedCharacterId) ?? null
    }
    return matches[0] ?? null
  }, [projectAvatarImages, linkedCharacterId])

  useEffect(() => {
    setSavedCollageUrl(savedCollageRecord?.image_url ?? null)
  }, [savedCollageRecord?.image_url])

  useEffect(() => {
    return () => {
      if (collagePreviewUrl) URL.revokeObjectURL(collagePreviewUrl)
    }
  }, [collagePreviewUrl])

  const handleBuildCollage = async () => {
    if (collageSourceItems.length < 2) {
      toast({
        title: "Need more angles",
        description: "Add at least 2 avatar views before building a reference collage.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsBuildingCollage(true)
      const title = characterName.trim()
        ? `${characterName.trim()} — Avatar Reference Sheet`
        : "Avatar Reference Sheet"
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
      console.error("Failed to build avatar collage:", error)
      toast({
        title: "Collage failed",
        description: error instanceof Error ? error.message : "Could not build collage.",
        variant: "destructive",
      })
    } finally {
      setIsBuildingCollage(false)
    }
  }

  const persistCollageFile = async (
    file: File,
    source: "generated" | "existing",
  ) => {
    if (!projectId) {
      toast({
        title: "Select a project",
        description: "Link a movie project to save a collage.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSavingCollage(true)
      const stored = await StorageService.uploadFile({
        file,
        projectId,
        fileType: "image",
        metadata: {
          type: "avatar_collage",
          character_name: characterName || null,
        },
      })

      let assetId: string | undefined
      try {
        const asset = await AssetService.createAsset({
          project_id: projectId,
          character_id: linkedCharacterId || null,
          title: `${characterName || "Character"} — Avatar Reference Collage`,
          content_type: "image",
          content_url: stored.url,
          prompt: "Multi-angle avatar reference collage",
          metadata: {
            type: "avatar",
            avatar_angle: AVATAR_REFERENCE_COLLAGE_ANGLE_ID,
            avatar_source: "collage",
            character_name: characterName || null,
          },
        })
        assetId = asset.id
        setProjectImageAssets((prev) =>
          prev.some((a) => a.id === asset.id) ? prev : [asset, ...prev],
        )
      } catch (assetError) {
        console.error("Failed to save collage asset:", assetError)
      }

      if (savedCollageRecord) {
        try {
          await AvatarImagesService.deleteImage(savedCollageRecord.id)
        } catch (deleteError) {
          console.error("Failed to replace previous collage record:", deleteError)
        }
      }

      const record = await AvatarImagesService.createImage({
        project_id: projectId,
        character_id: linkedCharacterId || null,
        character_name: characterName || null,
        description: description || null,
        style,
        angle_id: AVATAR_REFERENCE_COLLAGE_ANGLE_ID,
        angle_label: "Reference Collage",
        image_url: stored.url,
        prompt: "Multi-angle avatar reference collage",
        source,
        asset_id: assetId ?? null,
        metadata: {
          character_name: characterName || null,
          collage_angle_count: collageSourceItems.length,
        },
      })

      setProjectAvatarImages((prev) => [
        ...prev.filter((img) => img.id !== savedCollageRecord?.id),
        record,
      ])
      setSavedCollageUrl(stored.url)
      if (source === "existing") {
        if (collagePreviewUrl) URL.revokeObjectURL(collagePreviewUrl)
        setCollagePreviewUrl(null)
        setCollagePreviewBlob(null)
      }

      if (linkedCharacterId) {
        const character = characters.find((c) => c.id === linkedCharacterId)
        if (character) {
          const refs = Array.isArray(character.reference_images)
            ? character.reference_images.filter((url): url is string => !!url)
            : []
          const withoutOld = savedCollageRecord
            ? refs.filter((url) => url !== savedCollageRecord.image_url)
            : refs
          const nextRefs = [stored.url, ...withoutOld.filter((url) => url !== stored.url)]
          await CharactersService.updateCharacter(linkedCharacterId, {
            reference_images: nextRefs,
          })
          setCharacters((prev) =>
            prev.map((c) =>
              c.id === linkedCharacterId ? { ...c, reference_images: nextRefs } : c,
            ),
          )
        }
      }

      toast({
        title: "Collage saved",
        description: linkedCharacterId
          ? "Saved to project and linked character. Storyboard generation will use this as the single character reference."
          : "Saved to project. Link a character to use it as the single AI reference.",
      })
    } catch (error) {
      console.error("Failed to save avatar collage:", error)
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save collage.",
        variant: "destructive",
      })
    } finally {
      setIsSavingCollage(false)
    }
  }

  const handleSaveCollage = async () => {
    if (!collagePreviewBlob) {
      toast({
        title: "Nothing to save",
        description: "Generate or upload a collage first.",
        variant: "destructive",
      })
      return
    }
    const fileName = `${(characterName || "character").replace(/\s+/g, "-").toLowerCase()}-avatar-collage.png`
    const file = new File([collagePreviewBlob], fileName, { type: "image/png" })
    await persistCollageFile(file, "generated")
  }

  const handleCollageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Choose an image",
        description: "Collage uploads must be an image file.",
        variant: "destructive",
      })
      return
    }
    await persistCollageFile(file, "existing")
  }

  const handleDownloadCollage = () => {
    const url = collagePreviewUrl || savedCollageUrl
    if (!url) return
    const link = document.createElement("a")
    link.href = url
    link.download = `${(characterName || "character").replace(/\s+/g, "-").toLowerCase()}-avatar-collage.png`
    link.click()
  }

  const handleDeleteCollage = async () => {
    const hasSaved = savedCollageRecord != null
    const hasPreview = collagePreviewUrl != null

    if (!hasSaved && !hasPreview) return

    const message = hasSaved
      ? "Delete this saved reference collage? Storyboards will no longer use it as the character reference."
      : "Discard this unsaved collage preview?"

    if (!window.confirm(message)) return

    try {
      setIsDeletingCollage(true)

      if (collagePreviewUrl) {
        URL.revokeObjectURL(collagePreviewUrl)
        setCollagePreviewUrl(null)
        setCollagePreviewBlob(null)
      }

      if (savedCollageRecord) {
        const collageUrl = savedCollageRecord.image_url
        const assetId = savedCollageRecord.asset_id
        const recordId = savedCollageRecord.id

        await AvatarImagesService.deleteImage(recordId)
        setProjectAvatarImages((prev) => prev.filter((img) => img.id !== recordId))

        if (assetId) {
          try {
            await AssetService.deleteAsset(assetId)
            setProjectImageAssets((prev) => prev.filter((a) => a.id !== assetId))
          } catch (assetError) {
            console.error("Failed to delete collage asset:", assetError)
          }
        }

        if (linkedCharacterId && collageUrl) {
          const character = characters.find((c) => c.id === linkedCharacterId)
          if (character) {
            const refs = Array.isArray(character.reference_images)
              ? character.reference_images.filter(
                  (url): url is string => !!url && url !== collageUrl,
                )
              : []
            await CharactersService.updateCharacter(linkedCharacterId, {
              reference_images: refs,
            })
            setCharacters((prev) =>
              prev.map((c) =>
                c.id === linkedCharacterId ? { ...c, reference_images: refs } : c,
              ),
            )
          }
        }

        setSavedCollageUrl(null)
      }

      toast({
        title: hasSaved ? "Collage deleted" : "Preview discarded",
        description: hasSaved
          ? "The reference collage was removed from this character."
          : "You can generate a new collage anytime.",
      })
    } catch (error) {
      console.error("Failed to delete avatar collage:", error)
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete collage.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingCollage(false)
    }
  }

  const resolvePortraitCharacterId = (): string | null => {
    if (linkedCharacterId) return linkedCharacterId

    const trimmedName = characterName.trim().toLowerCase()
    if (trimmedName) {
      const byName = characters.find((c) => c.name.trim().toLowerCase() === trimmedName)
      if (byName) return byName.id
    }

    if (characters.length === 1) return characters[0].id

    return null
  }

  const handleSetPortrait = async (imageUrl: string, characterIdOverride?: string) => {
    const resolvedCharacterId =
      characterIdOverride ?? resolvePortraitCharacterId()

    if (!resolvedCharacterId) {
      if (!projectId) {
        toast({
          title: "Link a project",
          description: "Select a movie project first, then link or choose a character.",
          variant: "destructive",
        })
        return
      }

      if (characters.length === 0) {
        toast({
          title: "No characters found",
          description: "Create a character on the Characters page for this project first.",
          variant: "destructive",
        })
        return
      }

      setPendingPortraitImageUrl(imageUrl)
      setPortraitPickDialogOpen(true)
      return
    }

    const targetCharacter = characters.find((c) => c.id === resolvedCharacterId)

    try {
      setSettingPortraitUrl(imageUrl)
      await CharactersService.updateCharacter(resolvedCharacterId, {
        image_url: imageUrl,
      })
      if (targetCharacter?.name && !characterName.trim()) {
        setCharacterName(targetCharacter.name)
      }
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === resolvedCharacterId ? { ...c, image_url: imageUrl } : c,
        ),
      )
      toast({
        title: "Portrait set",
        description: `${targetCharacter?.name || characterName || "Character"} now uses this view as the default portrait.`,
      })
    } catch (error) {
      console.error("Failed to set character portrait:", error)
      toast({
        title: "Error",
        description: "Failed to set default portrait.",
        variant: "destructive",
      })
    } finally {
      setSettingPortraitUrl(null)
      setPortraitPickDialogOpen(false)
      setPendingPortraitImageUrl(null)
    }
  }

  const hasAnyImages = totalImageCount > 0
  const collageDisplayUrl = collagePreviewUrl || savedCollageUrl

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <input
          ref={shotUploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleShotUpload(event)}
        />
        <input
          ref={collageUploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleCollageUpload(event)}
        />
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
                      hydrationKeyRef.current = null
                      setProjectId(id)
                      setLinkedCharacterId("")
                      setAngleGalleries({})
                      setProjectAvatarImages([])
                      setCharacterName("")
                      setDescription("")
                      updateAvatarsUrl(id)
                    }}
                    placeholder="Link to save assets..."
                  />
                </div>

                {characters.length > 0 && (
                  <div className="space-y-2">
                    <Label>Character</Label>
                    <Select
                      value={linkedCharacterId || "none"}
                      onValueChange={(v) => {
                        if (v === "none") {
                          hydrationKeyRef.current = null
                          setLinkedCharacterId("")
                          setAngleGalleries({})
                          setProjectAvatarImages([])
                          setCharacterName("")
                          setDescription("")
                          if (projectId) updateAvatarsUrl(projectId)
                        } else {
                          handleCharacterSelect(v)
                        }
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

                {hasSavedPromptOptions ? (
                  <div className="space-y-2">
                    <Label htmlFor="avatar-desc-prompt-selector">Saved prompt</Label>
                    <Select
                      value={selectedDescriptionPromptId || "__none__"}
                      onValueChange={(v) => handleSavedPromptSelect(v, "description")}
                      disabled={isLoadingSavedPrompts}
                    >
                      <SelectTrigger id="avatar-desc-prompt-selector" className="bg-input border-border">
                        <SelectValue
                          placeholder={
                            isLoadingSavedPrompts
                              ? "Loading prompts…"
                              : "Apply a saved prompt…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (custom description)</SelectItem>
                        {characters.find((c) => c.id === linkedCharacterId)?.master_prompt?.trim() ? (
                          <SelectItem value="__character_master__">
                            Character master prompt
                          </SelectItem>
                        ) : null}
                        {savedCharacterPrompts.map((prompt) => (
                          <SelectItem key={prompt.id} value={prompt.id}>
                            {formatSavedPromptOptionLabel(prompt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Applies to generation and reference-based angles. Saved in VisDev or character prompts.
                    </p>
                  </div>
                ) : null}

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
                    onChange={(e) => {
                      setDescription(e.target.value)
                      if (selectedDescriptionPromptId) setSelectedDescriptionPromptId("")
                    }}
                    placeholder="Tall man in his 40s, salt-and-pepper hair, sharp jawline, weathered skin, dark leather jacket..."
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Style (optional)</Label>
                  <Select
                    value={style || EMPTY_STYLE_VALUE}
                    onValueChange={(v) => setStyle(v === EMPTY_STYLE_VALUE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_STYLE_VALUE}>None</SelectItem>
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
                      </p>
                          {sourceReference ? (
                        <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                          <button
                            type="button"
                            className="w-16 h-20 rounded-md overflow-hidden border border-border flex-shrink-0"
                            title="Click to view full size"
                            onClick={() =>
                              setViewImageDialog({
                                url: sourceReference.imageUrl,
                                label: sourceReference.title || "Source reference",
                              })
                            }
                          >
                            <StorageThumbImg
                              src={sourceReference.previewUrl}
                              alt="Source reference"
                              width={EDIT_SMALL_THUMB_WIDTH}
                              quality={EDIT_THUMB_QUALITY}
                              resize="cover"
                              className="w-full h-full object-cover"
                            />
                          </button>
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
                      <Label>Style (optional)</Label>
                      <Select
                        value={style || EMPTY_STYLE_VALUE}
                        onValueChange={(v) => setStyle(v === EMPTY_STYLE_VALUE ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_STYLE_VALUE}>None</SelectItem>
                          {STYLE_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="avatar-no-background"
                    checked={noBackground}
                    onCheckedChange={(v) => setNoBackground(v === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="avatar-no-background" className="cursor-pointer leading-none">
                      No background
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Isolate the character only — no environment or scenery.
                    </p>
                  </div>
                </div>

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
                    {isLoadingImages || isLoadingAvatars ? (
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
                                  <StorageThumbImg
                                    src={asset.content_url!}
                                    alt=""
                                    width={EDIT_SMALL_THUMB_WIDTH}
                                    quality={EDIT_THUMB_QUALITY}
                                    resize="cover"
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
                  disabled={isBatchGenerating || !canGenerate()}
                >
                  {isBatchGenerating ? (
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

            {!linkedCharacterId && characters.length > 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <UserCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Select a character above to view and generate avatar shots for that character only.
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
                  const isUploading = uploadingAngleId === angle.id
                  const isLoading = isAngleGenerating(angle.id) || isUploading
                  const loadProgress = isUploading
                    ? "Uploading…"
                    : angleGenerationProgress(angle.id)
                  const isDefaultPortrait = Boolean(
                    avatar?.imageUrl &&
                      characters.some((character) => character.image_url === avatar.imageUrl),
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
                              {avatar?.source === "existing" && (
                                <Badge variant="secondary" className="text-[10px]">Existing</Badge>
                              )}
                              {avatar?.source === "from_reference" && (
                                <Badge variant="secondary" className="text-[10px]">From Ref</Badge>
                              )}
                              {avatar?.saved && (
                                <Badge variant="outline" className="text-xs">Saved</Badge>
                              )}
                              {isDefaultPortrait && (
                                <Badge className="text-[10px] bg-blue-500 hover:bg-blue-500">
                                  <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                  Portrait
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 text-xs"
                            onClick={() => handleGenerateSingle(angle)}
                            disabled={isLoading || isBatchGenerating || uploadingAngleId === angle.id}
                            title={
                              avatar
                                ? "Redo this shot with the same settings. The current image is kept as a variant."
                                : "Generate this shot"
                            }
                          >
                            {isLoading ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            {avatar ? "Regenerate" : "Generate"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="aspect-[3/4] bg-muted relative">
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
                          {avatar ? (
                            <button
                              type="button"
                              className="w-full h-full block cursor-pointer group/view"
                              onClick={() =>
                                setViewImageDialog({
                                  url: avatar.imageUrl,
                                  label: angle.label,
                                })
                              }
                              title="View full image"
                            >
                              <StorageThumbImg
                                src={avatar.imageUrl}
                                alt={angle.label}
                                width={CARD_THUMB_WIDTH}
                                quality={EDIT_THUMB_QUALITY}
                                resize="cover"
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
                                Generate, upload, or pick an existing image for this shot.
                              </p>
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => openShotUpload(angle.id)}
                                  disabled={isLoading}
                                >
                                  <Upload className="h-3 w-3 mr-1" />
                                  Upload
                                </Button>
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
                                <StorageThumbImg
                                  src={img.imageUrl}
                                  alt=""
                                  width={EDIT_SMALL_THUMB_WIDTH}
                                  quality={EDIT_THUMB_QUALITY}
                                  resize="cover"
                                  className="w-full h-full object-cover pointer-events-none"
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
                              disabled={isLoading}
                            >
                              <Wand2 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 min-w-[4.5rem] h-8 text-xs"
                              onClick={() => openShotUpload(angle.id)}
                              disabled={isLoading}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Upload
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
                            <Button
                              variant={isDefaultPortrait ? "secondary" : "ghost"}
                              size="sm"
                              className={cn(
                                "flex-1 min-w-[4.5rem] h-8 text-xs",
                                isDefaultPortrait &&
                                  "bg-blue-500/15 text-blue-400 hover:bg-blue-500/20",
                              )}
                              onClick={() => void handleSetPortrait(avatar.imageUrl)}
                              disabled={
                                isLoading || settingPortraitUrl === avatar.imageUrl
                              }
                              title="Set as character default portrait"
                            >
                              {settingPortraitUrl === avatar.imageUrl ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Star
                                  className={cn(
                                    "h-3 w-3 mr-1",
                                    isDefaultPortrait && "fill-current text-blue-400",
                                  )}
                                />
                              )}
                              Portrait
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 min-w-[4.5rem] h-8 text-xs text-destructive hover:text-destructive"
                              onClick={() => avatar && void handleDeleteAvatarImage(angle, avatar)}
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

            {(!linkedCharacterId && characters.length > 0) ? null : (
              <Card className="border-violet-500/20 bg-violet-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-violet-400" />
                    Reference Collage Sheet
                  </CardTitle>
                  <CardDescription>
                    Combine selected avatar views into one labeled image, or upload a collage you
                    already have. Storyboards use this as the single character reference.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {collageDisplayUrl ? (
                    <button
                      type="button"
                      className="w-full rounded-lg overflow-hidden border border-border bg-muted/30"
                      title="Click to view full size"
                      onClick={() =>
                        setViewImageDialog({
                          url: collageDisplayUrl,
                          label: "Avatar reference collage",
                        })
                      }
                    >
                      <StorageThumbImg
                        src={collageDisplayUrl}
                        alt="Avatar reference collage"
                        width={CARD_THUMB_WIDTH}
                        quality={EDIT_THUMB_QUALITY}
                        resize="contain"
                        className="w-full h-auto object-contain"
                      />
                    </button>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                      Generate a collage from your shots, or upload one you already have.
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
                      variant="outline"
                      onClick={() => collageUploadInputRef.current?.click()}
                      disabled={!projectId || isSavingCollage || isBuildingCollage}
                    >
                      {isSavingCollage ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Collage
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleSaveCollage()}
                      disabled={!collagePreviewBlob || !projectId || isSavingCollage}
                    >
                      {isSavingCollage ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save to Project
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
                    {!projectId && " Link a project to save the collage."}
                    {projectId && !linkedCharacterId && " Link a character so storyboards use this as the one reference."}
                    {savedCollageUrl && !collagePreviewUrl && " Showing the last saved collage for this character."}
                    {" You can also upload a collage you already have instead of generating one."}
                  </p>
                </CardContent>
              </Card>
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
                        <StorageThumbImg
                          src={asset.content_url!}
                          alt=""
                          width={EDIT_PREVIEW_THUMB_WIDTH}
                          quality={EDIT_THUMB_QUALITY}
                          resize="cover"
                          className="w-full h-full object-cover pointer-events-none"
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
                        <StorageThumbImg
                          src={asset.content_url!}
                          alt=""
                          width={EDIT_PREVIEW_THUMB_WIDTH}
                          quality={EDIT_THUMB_QUALITY}
                          resize="cover"
                          className="w-full h-full object-cover pointer-events-none"
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
                  : "Edit this avatar view using a reference image."}
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
                  Edit using your locked model ({getLockedImageModelLabel() || "lock one in AI Settings"}).
                  {getLockedImageConfig({ withReferenceImage: true })?.supportsReference
                    ? " Describe changes below and optionally link another project image as a second reference."
                    : " Your locked model does not support reference editing — use GPT Image 2 or Runway ML."}
                </p>

                {imageEditAngleId && isAngleGenerating(imageEditAngleId) && angleGenerationProgress(imageEditAngleId) ? (
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
                    <Label htmlFor="avatar-edit-prompt-selector">Saved prompt</Label>
                    <Select
                      value={selectedEditPromptId || "__none__"}
                      onValueChange={(v) => handleSavedPromptSelect(v, "edit")}
                      disabled={
                        imageEditAngleId != null && isAngleGenerating(imageEditAngleId)
                      }
                    >
                      <SelectTrigger id="avatar-edit-prompt-selector" className="bg-input border-border">
                        <SelectValue placeholder="Apply a saved prompt to this edit…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (custom edit)</SelectItem>
                        {characters.find((c) => c.id === linkedCharacterId)?.master_prompt?.trim() ? (
                          <SelectItem value="__character_master__">
                            Character master prompt
                          </SelectItem>
                        ) : null}
                        {savedCharacterPrompts.map((prompt) => (
                          <SelectItem key={prompt.id} value={prompt.id}>
                            {formatSavedPromptOptionLabel(prompt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Loads into the edit field below — then click Edit Image to apply to this view.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="avatar-image-edit-prompt" className="text-xs sm:text-sm">
                    Describe your edit
                  </Label>
                  <Textarea
                    id="avatar-image-edit-prompt"
                    value={imageEditPrompt}
                    onChange={(e) => {
                      setImageEditPrompt(e.target.value)
                      if (selectedEditPromptId) setSelectedEditPromptId("")
                    }}
                    placeholder='e.g., warmer lighting, darker jacket, softer background'
                    className="min-h-[72px] text-xs sm:text-sm resize-none"
                    disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
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
                      onClick={() => document.getElementById("avatar-image-edit-ref")?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Upload reference
                    </Button>
                    {imageEditReferencePreview ? (
                      <>
                        <button
                          type="button"
                          className="relative w-14 h-14 rounded-lg overflow-hidden border border-primary ring-2 ring-primary/40"
                          title="Click to view full size"
                          onClick={() =>
                            setViewImageDialog({
                              url: imageEditReferencePreview,
                              label: "Uploaded reference",
                            })
                          }
                        >
                          <img
                            src={imageEditReferencePreview}
                            alt="Uploaded reference"
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
                          onClick={clearImageEditReference}
                          title="Remove uploaded reference"
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
                  {isLoadingImages || isLoadingAvatars ? (
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
                                disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
                                onClick={() => toggleImageEditStyleLink(asset.id)}
                                onDoubleClick={(e) => {
                                  e.preventDefault()
                                  if (!asset.content_url) return
                                  setViewImageDialog({
                                    url: asset.content_url,
                                    label: asset.title || group.label,
                                  })
                                }}
                                className={cn(
                                  "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                                  imageEditStyleLinkAssetIds.includes(asset.id)
                                    ? "border-violet-500 ring-2 ring-violet-500/40"
                                    : "border-border hover:border-violet-500/50",
                                )}
                                title={`${getProjectAssetSourceLabel(asset, projectLocations, characters)} — ${asset.title} · double-click to view full size`}
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
                        disabled={imageEditAngleId != null && isAngleGenerating(imageEditAngleId)}
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
                    (imageEditAngleId != null && isAngleGenerating(imageEditAngleId)) ||
                    !imageEditPrompt.trim() ||
                    !getLockedImageConfig({ withReferenceImage: true })?.supportsReference ||
                    (!imageEditReferenceFile && !imageEditCurrentImage?.imageUrl)
                  }
                  className="gap-2 w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {(imageEditAngleId != null && isAngleGenerating(imageEditAngleId)) ? (
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

        <Dialog open={portraitPickDialogOpen} onOpenChange={setPortraitPickDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Choose character for portrait</DialogTitle>
              <DialogDescription>
                Pick which character should use this angle as their default portrait.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              {characters.map((character) => (
                <Button
                  key={character.id}
                  type="button"
                  variant="outline"
                  className="justify-start h-auto py-3"
                  disabled={!pendingPortraitImageUrl || settingPortraitUrl !== null}
                  onClick={() => {
                    if (!pendingPortraitImageUrl) return
                    void handleSetPortrait(pendingPortraitImageUrl, character.id)
                  }}
                >
                  <Star className="h-4 w-4 mr-2 shrink-0" />
                  <span className="text-left">
                    <span className="block font-medium">{character.name}</span>
                    {character.archetype ? (
                      <span className="block text-xs text-muted-foreground">
                        {character.archetype}
                      </span>
                    ) : null}
                  </span>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
