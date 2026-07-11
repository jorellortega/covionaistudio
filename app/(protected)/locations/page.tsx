"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MapPin, Plus, Check, RefreshCw, ListFilter, Edit, Save, ChevronDown, ChevronUp, Upload, Image as ImageIcon, Video, File as FileIcon, X, ExternalLink, Trash2, Wand2, Sparkles, Star, Camera, Link2, Play, Download, ArrowRightLeft } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { TreatmentsService } from "@/lib/treatments-service"
import { TreatmentScenesService, type TreatmentScene } from "@/lib/treatment-scenes-service"
import { ScreenplayScenesService, type ScreenplayScene } from "@/lib/screenplay-scenes-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import {
  displayModelSupportsReferenceImage,
  mapDisplayModelToService,
  migrateGPTImageDisplayLabel,
  normalizeDisplayModelToApiId,
} from "@/lib/image-model-utils"
import { getSupabaseClient } from "@/lib/supabase"
import { AssetService, type Asset } from "@/lib/asset-service"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { useAuthReady } from "@/components/auth-hooks"
import { OpenAIService } from "@/lib/ai-services"
import { KlingService } from "@/lib/ai-services"
import { MovieService } from "@/lib/movie-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

const LOCATION_SHOT_PRESETS = [
  "Establishing Shot",
  "Wide Shot",
  "Extreme Wide Shot",
  "Medium Wide Shot",
  "Low Angle",
  "High Angle",
  "Bird's Eye View",
  "Dutch Angle",
  "Close-up architectural detail",
  "Over-the-shoulder street view",
  "Tracking shot perspective",
  "Point of View (POV)",
] as const

interface CustomShotAngle {
  id: string
  label: string
  directive: string
}

function getCustomShotAnglesFromLocation(loc: Location | undefined): CustomShotAngle[] {
  const raw = loc?.metadata?.custom_shot_angles
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is CustomShotAngle =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.directive === "string",
  )
}

function getShotDescription(
  shotPreset: string,
  extraDirection?: string,
  customAngles?: CustomShotAngle[],
): string {
  const custom = customAngles?.find((a) => a.label === shotPreset)
  const shot = custom?.directive ?? shotPreset
  if (extraDirection?.trim()) {
    return `${shot}. ${extraDirection.trim()}`
  }
  return shot
}

function buildReferenceShotPrompt(
  shotDescription: string,
  options?: {
    includeLocationDetails?: boolean
    locationName?: string
  },
): string {
  let prompt = `Give me a ${shotDescription.toLowerCase()} of this image. Keep the same scene, characters, lighting, and world — only change the camera angle and framing.`
  if (options?.includeLocationDetails && options.locationName) {
    prompt += ` Location: ${options.locationName}.`
  }
  return prompt.slice(0, 990)
}

async function referenceUrlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Could not load reference image")
  }
  const blob = await response.blob()
  const type = blob.type || "image/png"
  return new File([blob], filename, { type })
}

async function downloadMediaToDevice(url: string, fileName: string): Promise<void> {
  const safeName = fileName.replace(/[^\w.\-() ]/g, "_") || "download.mp4"
  const proxyUrl = `/api/ai/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || "Download failed")
  }
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = blobUrl
  link.download = safeName
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }, 100)
}

function getProjectAssetSourceLabel(
  asset: Asset,
  locations: Location[],
  characters: Character[],
): string {
  if (asset.character_id) {
    const character = characters.find((c) => c.id === asset.character_id)
    return character ? `Character · ${character.name}` : "Character"
  }
  if (asset.location_id) {
    const location = locations.find((l) => l.id === asset.location_id)
    return location ? `Location · ${location.name}` : "Location"
  }
  if (asset.is_default_cover) return "Project cover"
  const source = asset.metadata?.source ?? asset.metadata?.page
  if (typeof source === "string" && source.trim()) return source
  return "Project asset"
}

function buildLinkedAssetGroups(
  assets: Asset[],
  locations: Location[],
  characters: Character[],
): { label: string; assets: Asset[] }[] {
  const characterAssets = assets.filter((a) => a.character_id)
  const locationAssets = assets.filter((a) => a.location_id && !a.character_id)
  const projectAssets = assets.filter((a) => !a.character_id && !a.location_id)

  const groups: { label: string; assets: Asset[] }[] = []

  if (characterAssets.length > 0) {
    groups.push({
      label: "Characters",
      assets: [...characterAssets].sort((a, b) => {
        const nameA = characters.find((c) => c.id === a.character_id)?.name ?? a.title
        const nameB = characters.find((c) => c.id === b.character_id)?.name ?? b.title
        return nameA.localeCompare(nameB)
      }),
    })
  }

  if (locationAssets.length > 0) {
    groups.push({
      label: "Other locations",
      assets: [...locationAssets].sort((a, b) => {
        const nameA = locations.find((l) => l.id === a.location_id)?.name ?? a.title
        const nameB = locations.find((l) => l.id === b.location_id)?.name ?? b.title
        return nameA.localeCompare(nameB)
      }),
    })
  }

  if (projectAssets.length > 0) {
    groups.push({ label: "Project assets", assets: projectAssets })
  }

  return groups
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

function mapLockedModelToService(model: string): string {
  return mapDisplayModelToService(model)
}

function lockedModelSupportsReferenceImage(model: string): boolean {
  return displayModelSupportsReferenceImage(model)
}

function normalizeLockedVideoModel(displayName: string): string {
  const lower = displayName.toLowerCase()
  if (lower.includes("gen-4.5") || lower.includes("gen4.5")) return "gen4.5"
  if (lower.includes("veo 3.1 fast") || lower.includes("veo3.1_fast")) return "veo3.1_fast"
  if (lower.includes("veo")) return "veo3.1"
  if (lower.includes("seedance")) return "seedance2"
  if (lower.includes("runway")) return "gen4_turbo"
  return "gen4_turbo"
}

function lockedVideoModelRequiresRunway(displayName: string): boolean {
  return displayName.toLowerCase().includes("runway")
}

type LocationTransitionVideoModel =
  | "kling_i2v_extended"
  | "leonardo_kling_2_1"
  | "leonardo_veo_3_1"
  | "leonardo_veo_3_1_fast"

function getTransitionDurationOptions(model: LocationTransitionVideoModel): number[] {
  if (model === "kling_i2v_extended" || model === "leonardo_kling_2_1") return [5, 10]
  return [4, 6, 8]
}

function getDefaultTransitionDuration(model: LocationTransitionVideoModel): number {
  if (model === "kling_i2v_extended" || model === "leonardo_kling_2_1") return 5
  return 8
}

export default function LocationsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { user, userId, ready } = useAuthReady()

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  
  // AI Text Enhancer state
  const [textEnhancerSettings, setTextEnhancerSettings] = useState<{
    model: string
    prefix: string
  }>({ model: 'gpt-4o-mini', prefix: '' })
  const [isEnhancingText, setIsEnhancingText] = useState(false)
  const [userApiKeys, setUserApiKeys] = useState<{
    openai_api_key?: string
    anthropic_api_key?: string
  }>({})
  
  // AI Image Generation state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [generatingImageForLocation, setGeneratingImageForLocation] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingQuickImage, setIsGeneratingQuickImage] = useState(false)
  const [isGenerateImageDialogOpen, setIsGenerateImageDialogOpen] = useState(false)
  const [imagePrompt, setImagePrompt] = useState("")
  const [includeLocationDetails, setIncludeLocationDetails] = useState(true)
  const [viewImageDialogOpen, setViewImageDialogOpen] = useState(false)
  const [viewingImage, setViewingImage] = useState<Asset | null>(null)
  const [viewVideoDialogOpen, setViewVideoDialogOpen] = useState(false)
  const [viewingVideo, setViewingVideo] = useState<Asset | null>(null)
  const [isLinkProductionDialogOpen, setIsLinkProductionDialogOpen] = useState(false)
  const [linkProductionAsset, setLinkProductionAsset] = useState<Asset | null>(null)
  const [linkProductionMediaType, setLinkProductionMediaType] = useState<"image" | "video">("video")
  const [linkScenes, setLinkScenes] = useState<SceneWithMetadata[]>([])
  const [linkStoryboards, setLinkStoryboards] = useState<Storyboard[]>([])
  const [linkSceneId, setLinkSceneId] = useState<string>("")
  const [linkStoryboardId, setLinkStoryboardId] = useState<string>("")
  const [linkVideoAsDefault, setLinkVideoAsDefault] = useState(true)
  const [isLoadingLinkScenes, setIsLoadingLinkScenes] = useState(false)
  const [isLoadingLinkStoryboards, setIsLoadingLinkStoryboards] = useState(false)
  const [isLinkingToProduction, setIsLinkingToProduction] = useState(false)
  const [isTransitionVideoDialogOpen, setIsTransitionVideoDialogOpen] = useState(false)
  const [transitionVideoPrompt, setTransitionVideoPrompt] = useState("")
  const [transitionVideoModel, setTransitionVideoModel] =
    useState<LocationTransitionVideoModel>("kling_i2v_extended")
  const [transitionVideoDuration, setTransitionVideoDuration] = useState(5)
  const [transitionStartAssetId, setTransitionStartAssetId] = useState<string | null>(null)
  const [transitionEndAssetId, setTransitionEndAssetId] = useState<string | null>(null)
  const [isGeneratingTransitionVideo, setIsGeneratingTransitionVideo] = useState(false)
  const [transitionVideoProgress, setTransitionVideoProgress] = useState("")
  const [isGenerateShotsDialogOpen, setIsGenerateShotsDialogOpen] = useState(false)
  const [referenceAssetForShots, setReferenceAssetForShots] = useState<Asset | null>(null)
  const [selectedShotPreset, setSelectedShotPreset] = useState<string>("Establishing Shot")
  const [shotCustomPrompt, setShotCustomPrompt] = useState("")
  const [includeLocationDetailsInShot, setIncludeLocationDetailsInShot] = useState(false)
  const [isGeneratingShot, setIsGeneratingShot] = useState(false)
  const [shotGenerationProgress, setShotGenerationProgress] = useState("")
  const [inlineCustomShotPrompt, setInlineCustomShotPrompt] = useState("")
  const [inlineShotReferenceFile, setInlineShotReferenceFile] = useState<File | null>(null)
  const [inlineShotReferencePreview, setInlineShotReferencePreview] = useState<string | null>(null)
  const [inlineStyleLinkAssetIds, setInlineStyleLinkAssetIds] = useState<string[]>([])
  const [isGenerateVideoDialogOpen, setIsGenerateVideoDialogOpen] = useState(false)
  const [videoMotionPrompt, setVideoMotionPrompt] = useState("")
  const [videoDuration, setVideoDuration] = useState<5 | 10>(5)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoGenerationProgress, setVideoGenerationProgress] = useState("")
  const [isCreateAngleDialogOpen, setIsCreateAngleDialogOpen] = useState(false)
  const [newAngleLabel, setNewAngleLabel] = useState("")
  const [newAngleDirective, setNewAngleDirective] = useState("")
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [treatmentId, setTreatmentId] = useState<string | null>(null)
  const [treatmentScenes, setTreatmentScenes] = useState<TreatmentScene[]>([])
  const [screenplayScenes, setScreenplayScenes] = useState<ScreenplayScene[]>([])
  const [filter, setFilter] = useState<string>("")
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [isCreatingLocation, setIsCreatingLocation] = useState(false)
  const [isCreateLocationDialogOpen, setIsCreateLocationDialogOpen] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [locationAssets, setLocationAssets] = useState<Asset[]>([])
  const [projectImageAssets, setProjectImageAssets] = useState<Asset[]>([])
  const [projectCharacters, setProjectCharacters] = useState<Character[]>([])
  const [isLoadingProjectAssets, setIsLoadingProjectAssets] = useState(false)
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  
  // Location form fields
  const [editingLocationInFormId, setEditingLocationInFormId] = useState<string | null>(null)
  const [newLocName, setNewLocName] = useState("")
  const [newLocDescription, setNewLocDescription] = useState("")
  const [newLocType, setNewLocType] = useState<"interior" | "exterior" | "both" | "">("")
  const [newLocAddress, setNewLocAddress] = useState("")
  const [newLocCity, setNewLocCity] = useState("")
  const [newLocState, setNewLocState] = useState("")
  const [newLocCountry, setNewLocCountry] = useState("")
  const [newLocTimeOfDay, setNewLocTimeOfDay] = useState("")
  const [newLocAtmosphere, setNewLocAtmosphere] = useState("")
  const [newLocMood, setNewLocMood] = useState("")
  const [newLocVisualDescription, setNewLocVisualDescription] = useState("")
  const [newLocLightingNotes, setNewLocLightingNotes] = useState("")
  const [newLocSoundNotes, setNewLocSoundNotes] = useState("")
  const [newLocKeyFeatures, setNewLocKeyFeatures] = useState("")
  const [newLocProps, setNewLocProps] = useState("")
  const [newLocRestrictions, setNewLocRestrictions] = useState("")
  const [newLocAccessNotes, setNewLocAccessNotes] = useState("")
  const [newLocShootingNotes, setNewLocShootingNotes] = useState("")

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        // Check if user has access to this project (owner or shared)
        const movie = await MovieService.getMovieById(projectId)
        if (!movie) {
          toast({
            title: "Access Denied",
            description: "You don't have access to this project.",
            variant: "destructive",
          })
          router.push('/movies')
          return
        }

        // Find treatment for project (if any)
        const treatment = await TreatmentsService.getTreatmentByProjectId(projectId)
        setTreatmentId(treatment?.id || null)

        // Load scenes from treatment (if present) and screenplay scenes
        const [tScenes, sScenes] = await Promise.all([
          treatment?.id ? TreatmentScenesService.getTreatmentScenes(treatment.id) : Promise.resolve([]),
          ScreenplayScenesService.getScreenplayScenes(projectId),
        ])
        setTreatmentScenes(tScenes)
        setScreenplayScenes(sScenes)

        // Load existing locations
        setIsLoadingLocations(true)
        const locs = await LocationsService.getLocations(projectId)
        setLocations(locs)
      } catch (err) {
        console.error("Failed to load locations data:", err)
        toast({
          title: "Error",
          description: "Failed to load locations. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingLocations(false)
        setLoading(false)
      }
    }
    load()
  }, [projectId, toast])

  // Auto-select first location when locations are loaded
  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id)
    }
  }, [locations, selectedLocationId])

  // Load assets when a location is selected
  useEffect(() => {
    const loadAssets = async () => {
      if (!selectedLocationId) {
        setLocationAssets([])
        return
      }
      try {
        setIsLoadingAssets(true)
        const assets = await AssetService.getAssetsForLocation(selectedLocationId)
        setLocationAssets(assets)
      } catch (err) {
        console.error('Failed to load location assets:', err)
        setLocationAssets([])
        if (err instanceof Error && !err.message.includes('migration')) {
          toast({
            title: "Error",
            description: "Failed to load location assets.",
            variant: "destructive",
          })
        }
      } finally {
        setIsLoadingAssets(false)
      }
    }
    loadAssets()
  }, [selectedLocationId, toast])

  const prevLocationIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedLocationId) {
      setImagePrompt("")
      prevLocationIdRef.current = null
      return
    }
    if (prevLocationIdRef.current === selectedLocationId) return
    prevLocationIdRef.current = selectedLocationId
    const loc = locations.find((l) => l.id === selectedLocationId)
    if (!loc) return
    const suggested =
      loc.visual_description?.trim() ||
      loc.description?.trim() ||
      `Cinematic establishing shot of ${loc.name}, atmospheric lighting, professional location photography, high quality`
    setImagePrompt(suggested)
  }, [selectedLocationId, locations])

  // Load all project image assets (characters, other locations, etc.)
  useEffect(() => {
    const loadProjectAssets = async () => {
      if (!projectId) {
        setProjectImageAssets([])
        setProjectCharacters([])
        return
      }
      try {
        setIsLoadingProjectAssets(true)
        const [assets, characters] = await Promise.all([
          AssetService.getAssetsForProject(projectId),
          CharactersService.getCharacters(projectId),
        ])
        setProjectImageAssets(
          assets.filter((a) => a.content_type === "image" && a.content_url),
        )
        setProjectCharacters(characters)
      } catch (err) {
        console.error("Failed to load project assets:", err)
        setProjectImageAssets([])
        setProjectCharacters([])
      } finally {
        setIsLoadingProjectAssets(false)
      }
    }
    loadProjectAssets()
  }, [projectId])

  // Load text enhancer settings and user API keys
  useEffect(() => {
    if (!ready || !userId) return

    const fetchTextEnhancerSettings = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
          .from('system_ai_config')
          .select('setting_key, setting_value')
          .in('setting_key', ['text_enhancer_model', 'text_enhancer_prefix'])

        if (error) {
          console.error('Error fetching text enhancer settings:', error)
          return
        }

        const settings: { model: string; prefix: string } = {
          model: 'gpt-4o-mini',
          prefix: ''
        }

        data?.forEach((item) => {
          if (item.setting_key === 'text_enhancer_model') {
            settings.model = item.setting_value || 'gpt-4o-mini'
          } else if (item.setting_key === 'text_enhancer_prefix') {
            settings.prefix = item.setting_value || ''
          }
        })

        setTextEnhancerSettings(settings)
      } catch (error) {
        console.error('Error fetching text enhancer settings:', error)
      }
    }

    const fetchUserApiKeys = async () => {
      try {
        const { data, error } = await getSupabaseClient()
          .from('users')
          .select('openai_api_key, anthropic_api_key')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching user API keys:', error)
          return
        }

        setUserApiKeys({
          openai_api_key: data?.openai_api_key || undefined,
          anthropic_api_key: data?.anthropic_api_key || undefined,
        })
      } catch (error) {
        console.error('Error fetching user API keys:', error)
      }
    }

    const fetchAISettings = async () => {
      try {
        const settings = await AISettingsService.getUserSettings(userId)
        setAiSettings(settings)
        setAiSettingsLoaded(true)
      } catch (error) {
        console.error('Error fetching AI settings:', error)
        setAiSettingsLoaded(true)
      }
    }

    fetchTextEnhancerSettings()
    fetchUserApiKeys()
    fetchAISettings()
  }, [ready, userId])

  // Sync carousel with current index
  useEffect(() => {
    if (!carouselApi) return

    const updateIndex = () => {
      setCurrentImageIndex(carouselApi.selectedScrollSnap())
    }

    carouselApi.on('select', updateIndex)
    updateIndex()

    return () => {
      carouselApi.off('select', updateIndex)
    }
  }, [carouselApi])

  // Aggregate distinct locations from all scenes
  const detectedLocations = useMemo(() => {
    const set = new Set<string>()
    const counts = new Map<string, number>()

    const addLocation = (loc?: string) => {
      if (!loc) return
      const location = (loc || "").trim()
      if (!location) return
      set.add(location)
      counts.set(location, (counts.get(location) || 0) + 1)
    }

    treatmentScenes.forEach((s) => addLocation(s.location))
    screenplayScenes.forEach((s) => addLocation(s.location))

    const list = Array.from(set.values()).map((name) => ({
      name,
      count: counts.get(name) || 0,
    }))

    return list
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .filter((l) => (filter ? l.name.toLowerCase().includes(filter.toLowerCase()) : true))
  }, [treatmentScenes, screenplayScenes, filter])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setSelectedLocationId(null)
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const enhanceField = async (text: string, setter: (value: string) => void) => {
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to enhance",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key && !userApiKeys.anthropic_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI or Anthropic API key in Settings → Profile",
        variant: "destructive",
      })
      return
    }

    setIsEnhancingText(true)
    
    try {
      const model = textEnhancerSettings.model
      const prefix = textEnhancerSettings.prefix || 'You are a professional text enhancer. Fix grammar, spelling, and enhance the writing while keeping the same context and meaning. Return only the enhanced text without explanations.\n\nEnhance the following text:'
      const fullPrompt = `${prefix}\n\n${text}`

      // Determine which API to use based on model
      const isAnthropic = model.startsWith('claude-')
      const apiKey = isAnthropic ? userApiKeys.anthropic_api_key : userApiKeys.openai_api_key

      if (!apiKey) {
        throw new Error(`API key missing for ${isAnthropic ? 'Anthropic' : 'OpenAI'}`)
      }

      let response
      if (isAnthropic) {
        // Use Anthropic API
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 4000,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
          }),
        })

        if (!anthropicResponse.ok) {
          const errorText = await anthropicResponse.text()
          throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`)
        }

        const result = await anthropicResponse.json()
        response = result.content?.[0]?.text || ''
      } else {
        // Use OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: fullPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.7,
          }),
        })

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
        }

        const result = await openaiResponse.json()
        response = result.choices?.[0]?.message?.content || ''
      }

      if (response) {
        setter(response.trim())
        toast({
          title: "Success",
          description: "Text enhanced successfully",
        })
      } else {
        throw new Error('No response from AI')
      }
    } catch (error) {
      console.error('Error enhancing text:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enhance text",
        variant: "destructive",
      })
    } finally {
      setIsEnhancingText(false)
    }
  }

  const enhanceDescription = () => enhanceField(newLocDescription, setNewLocDescription)

  const handleQuickGenerateLocationImage = async () => {
    if (!selectedLocationId || !userId || !ready) {
      toast({
        title: "Error",
        description: "Please select a location and ensure you're logged in.",
        variant: "destructive",
      })
      return
    }

    const selectedLoc = locations.find(l => l.id === selectedLocationId)
    if (!selectedLoc) {
      toast({
        title: "Error",
        description: "Location not found.",
        variant: "destructive",
      })
      return
    }

    // Get the locked model from AI settings
    if (!aiSettingsLoaded || aiSettings.length === 0) {
      toast({
        title: "Error",
        description: "AI settings not loaded yet. Please wait a moment and try again.",
        variant: "destructive",
      })
      return
    }

    const imagesSetting = aiSettings.find(setting => setting.tab_type === 'images')
    if (!imagesSetting || !imagesSetting.is_locked) {
      toast({
        title: "AI Not Available",
        description: "Please lock an image model in AI Settings first",
        variant: "destructive",
      })
      return
    }

    if (!imagePrompt.trim()) {
      toast({
        title: "Enter a prompt",
        description: "Describe the location image you want to generate.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGeneratingQuickImage(true)

      const finalPrompt = `${imagePrompt.trim()}. Professional cinematic photography, high quality, detailed, atmospheric, dramatic lighting, no text, no typography, no captions, no labels, no watermark`

      // Use the locked model from settings
      const config = requireLockedImageConfig()

      const requestBody = {
        prompt: finalPrompt.length > 990 ? `${finalPrompt.slice(0, 987)}...` : finalPrompt,
        service: config.service,
        apiKey: 'configured',
        userId: userId,
        model: config.apiModel,
        width: 1024,
        height: 1024,
        autoSaveToBucket: true,
      }

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const result = await response.json()
      
      if (result.success && result.imageUrl) {
        const imageUrlToUse = result.bucketUrl || result.imageUrl
        
        // Save as location asset
        const timestamp = new Date().toISOString()
        const now = new Date()
        const dateStr = now.toLocaleDateString()
        const timeStr = now.toLocaleTimeString()
        const assetData = {
          project_id: projectId,
          location_id: selectedLocationId,
          title: `${selectedLoc.name} - AI Generated Image (${dateStr} ${timeStr})`,
          content_type: 'image' as const,
          content: '',
          content_url: imageUrlToUse,
          prompt: imagePrompt.trim(),
          model: config.lockedModel,
          generation_settings: {
            service: config.service,
            location_id: selectedLocationId,
            location_name: selectedLoc.name,
          },
          metadata: {
            location_name: selectedLoc.name,
            generated_at: timestamp,
            source: 'ai_generation',
            service: config.service,
          }
        }

        const savedAsset = await AssetService.createAsset(assetData)
        setLocationAssets(prev => [savedAsset, ...prev])
        
        // Scroll to the newly generated image
        setTimeout(() => {
          if (carouselApi) {
            carouselApi.scrollTo(0)
          }
        }, 100)
        
        toast({
          title: "Image Generated!",
          description: result.savedToBucket 
            ? "AI image has been generated and saved to your bucket!" 
            : "AI image has been generated and added to location assets.",
        })
      } else {
        throw new Error('Failed to generate image')
      }
    } catch (error) {
      console.error('Error generating location image:', error)
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate AI image",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingQuickImage(false)
    }
  }

  const handleGenerateLocationImage = async () => {
    if (!selectedLocationId || !userId || !ready) {
      toast({
        title: "Error",
        description: "Please select a location and ensure you're logged in.",
        variant: "destructive",
      })
      return
    }

    const selectedLoc = locations.find(l => l.id === selectedLocationId)
    if (!selectedLoc) {
      toast({
        title: "Error",
        description: "Location not found.",
        variant: "destructive",
      })
      return
    }

    if (!imagePrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for the image.",
        variant: "destructive",
      })
      return
    }

    if (!getLockedImageConfig()) {
      toast({
        title: "AI Not Available",
        description: "Please lock an image model in AI Settings first.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGeneratingImage(true)

      // Build location description for prompt enhancement (only if checkbox is checked)
      let enhancedPrompt = imagePrompt
      
      if (includeLocationDetails) {
        const details: string[] = []
        
        if (selectedLoc.name) details.push(`Name: ${selectedLoc.name}`)
        if (selectedLoc.type) details.push(`Type: ${selectedLoc.type}`)
        if (selectedLoc.description) details.push(`Description: ${selectedLoc.description}`)
        if (selectedLoc.visual_description) details.push(`Visual: ${selectedLoc.visual_description}`)
        if (selectedLoc.atmosphere) details.push(`Atmosphere: ${selectedLoc.atmosphere}`)
        if (selectedLoc.mood) details.push(`Mood: ${selectedLoc.mood}`)
        if (selectedLoc.time_of_day && selectedLoc.time_of_day.length > 0) {
          details.push(`Time of day: ${selectedLoc.time_of_day.join(', ')}`)
        }
        if (selectedLoc.city || selectedLoc.country) {
          details.push(`Location: ${[selectedLoc.city, selectedLoc.country].filter(Boolean).join(', ')}`)
        }

        const locationDetails = details.join(', ')

        if (locationDetails) {
          enhancedPrompt = `${imagePrompt}. Location details: ${locationDetails}. Cinematic location photography, professional, high quality, no text, no typography, no captions, no labels, no watermark.`
        } else {
          enhancedPrompt = `${imagePrompt}. Cinematic location photography, professional, high quality, no text, no typography, no captions, no labels, no watermark.`
        }
      } else {
        enhancedPrompt = `${imagePrompt}. Cinematic location photography, professional, high quality, no text, no typography, no captions, no labels, no watermark.`
      }

      // Use locked image model from AI Settings
      const config = requireLockedImageConfig()

      const response = await requestLockedImageGeneration(enhancedPrompt, config)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const result = await response.json()
      
      if (result.success && result.imageUrl) {
        const imageUrlToUse = result.bucketUrl || result.imageUrl
        
        // Save as location asset
        const assetData = {
          project_id: projectId,
          location_id: selectedLocationId,
          title: selectedLoc.name,
          content_type: 'image' as const,
          content: '',
          content_url: imageUrlToUse,
          prompt: imagePrompt,
          model: config.lockedModel,
          generation_settings: {
            service: config.service,
            location_id: selectedLocationId,
            location_name: selectedLoc.name,
          },
          metadata: {
            location_name: selectedLoc.name,
            generated_at: new Date().toISOString(),
            source: 'ai_generation',
            service: config.service,
          }
        }

        const savedAsset = await AssetService.createAsset(assetData)
        setLocationAssets(prev => [savedAsset, ...prev])
        
        // Scroll to the newly generated image
        setTimeout(() => {
          if (carouselApi) {
            carouselApi.scrollTo(0)
          }
        }, 100)
        
        toast({
          title: "Image Generated!",
          description: result.savedToBucket 
            ? "AI image has been generated and saved to your bucket!" 
            : "AI image has been generated and added to location assets.",
        })

        // Close dialog and reset prompt
        setIsGenerateImageDialogOpen(false)
        setImagePrompt("")
      } else {
        throw new Error('Failed to generate image')
      }
    } catch (error) {
      console.error('Error generating location image:', error)
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate AI image",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const imageAssetsForLocation = useMemo(
    () => locationAssets.filter((a) => a.content_type === "image" && a.content_url),
    [locationAssets],
  )

  const linkableProjectAssets = useMemo(
    () =>
      projectImageAssets.filter(
        (a) => !a.location_id || a.location_id !== selectedLocationId,
      ),
    [projectImageAssets, selectedLocationId],
  )

  const linkedAssetGroups = useMemo(
    () => buildLinkedAssetGroups(linkableProjectAssets, locations, projectCharacters),
    [linkableProjectAssets, locations, projectCharacters],
  )

  const framePickerAssets = useMemo(() => {
    const byId = new Map<string, Asset>()
    for (const asset of imageAssetsForLocation) {
      if (asset.content_url) byId.set(asset.id, asset)
    }
    for (const asset of projectImageAssets) {
      if (asset.content_url) byId.set(asset.id, asset)
    }
    return Array.from(byId.values())
  }, [imageAssetsForLocation, projectImageAssets])

  const thisLocationFrameAssets = imageAssetsForLocation

  const otherFramePickerGroups = useMemo(() => {
    const locationImageIds = new Set(imageAssetsForLocation.map((a) => a.id))
    const otherAssets = projectImageAssets.filter(
      (a) => a.content_url && !locationImageIds.has(a.id),
    )
    return buildLinkedAssetGroups(otherAssets, locations, projectCharacters)
  }, [imageAssetsForLocation, projectImageAssets, locations, projectCharacters])

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId),
    [locations, selectedLocationId],
  )

  const customShotAngles = useMemo(
    () => getCustomShotAnglesFromLocation(selectedLocation),
    [selectedLocation],
  )

  const getImagesTabSetting = () => aiSettings.find((s) => s.tab_type === "images")

  const getVideosTabSetting = () => aiSettings.find((s) => s.tab_type === "videos")

  const getLockedVideoModelLabel = () => {
    const setting = getVideosTabSetting()
    if (setting?.is_locked && setting.locked_model) {
      return setting.locked_model
    }
    return "Runway ML"
  }

  const getLockedVideoApiModel = () => {
    const setting = getVideosTabSetting()
    const label = setting?.is_locked && setting.locked_model ? setting.locked_model : "Runway ML"
    if (setting?.selected_model && lockedVideoModelRequiresRunway(label)) {
      return normalizeLockedVideoModel(setting.selected_model)
    }
    return normalizeLockedVideoModel(label)
  }

  const requireRunwayVideoConfig = () => {
    const setting = getVideosTabSetting()
    const label = setting?.is_locked && setting.locked_model ? setting.locked_model : "Runway ML"
    if (!lockedVideoModelRequiresRunway(label)) {
      throw new Error(
        "Animate location images requires Runway ML. Lock Runway ML under AI Settings → Videos.",
      )
    }
    return {
      displayModel: label,
      apiModel: getLockedVideoApiModel(),
    }
  }

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
      service: mapLockedModelToService(lockedModel),
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
    const width = options?.width ?? (config.service === "runway" ? 1280 : 1024)
    const height = options?.height ?? (config.service === "runway" ? 720 : 1024)

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
      headers: {
        "Content-Type": "application/json",
      },
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

  const buildLocationShotPrompt = (shotPreset: string, loc: Location, customPrompt?: string) =>
    buildReferenceShotPrompt(
      getShotDescription(shotPreset, customPrompt, customShotAngles),
      {
        includeLocationDetails: includeLocationDetailsInShot,
        locationName: loc.name,
      },
    )

  const buildCustomLocationShotPrompt = (userDirection: string, loc: Location) => {
    let prompt = userDirection.trim()
    if (includeLocationDetailsInShot && loc.name) {
      prompt += ` Location: ${loc.name}.`
    }
    return prompt.slice(0, 990)
  }

  const handleDownloadLocationVideo = async (asset: Asset) => {
    if (!asset.content_url) return
    const fileName = `${asset.title.replace(/ - Video \(.*\)$/, "")}.mp4`
    try {
      toast({
        title: "Preparing download…",
        description: "Fetching video file.",
      })
      await downloadMediaToDevice(asset.content_url, fileName)
      toast({
        title: "Download started",
        description: "Your video should appear in Downloads.",
      })
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Could not download video.",
        variant: "destructive",
      })
    }
  }

  const openLinkToProduction = async (asset: Asset, mediaType: "image" | "video") => {
    if (!projectId) {
      toast({
        title: "No project selected",
        description: "Select a project first to link this asset to a production shot.",
        variant: "destructive",
      })
      return
    }
    setLinkProductionAsset(asset)
    setLinkProductionMediaType(mediaType)
    setLinkSceneId("")
    setLinkStoryboardId("")
    setLinkStoryboards([])
    setLinkVideoAsDefault(true)
    setIsLinkProductionDialogOpen(true)

    setIsLoadingLinkScenes(true)
    try {
      const scenes = await TimelineService.getMovieScenes(projectId)
      setLinkScenes(scenes)
      if (scenes.length === 1) {
        setLinkSceneId(scenes[0].id)
      }
    } catch (error) {
      toast({
        title: "Could not load scenes",
        description: error instanceof Error ? error.message : "Failed to load production scenes.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingLinkScenes(false)
    }
  }

  useEffect(() => {
    const loadLinkStoryboards = async () => {
      if (!linkSceneId || !isLinkProductionDialogOpen) {
        setLinkStoryboards([])
        setLinkStoryboardId("")
        return
      }
      setIsLoadingLinkStoryboards(true)
      try {
        const boards = await StoryboardsService.getStoryboardsByScene(linkSceneId)
        const sorted = [...boards].sort((a, b) => a.shot_number - b.shot_number)
        setLinkStoryboards(sorted)
        if (sorted.length === 1) {
          setLinkStoryboardId(sorted[0].id)
        }
      } catch (error) {
        console.error("Failed to load storyboards for link:", error)
        setLinkStoryboards([])
        toast({
          title: "Could not load shots",
          description: "Failed to load storyboard shots for this scene.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingLinkStoryboards(false)
      }
    }
    loadLinkStoryboards()
  }, [linkSceneId, isLinkProductionDialogOpen, toast])

  const handleLinkToProductionShot = async () => {
    if (!linkProductionAsset?.content_url || !linkStoryboardId) return

    const storyboard = linkStoryboards.find((s) => s.id === linkStoryboardId)
    if (!storyboard) return

    setIsLinkingToProduction(true)
    try {
      if (linkProductionMediaType === "video") {
        const response = await fetch("/api/storyboard-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyboardId: linkStoryboardId,
            videoUrl: linkProductionAsset.content_url,
            videoName: linkProductionAsset.title.replace(/ - Video \(.*\)$/, ""),
            generationModel: linkProductionAsset.model,
            generationPrompt: linkProductionAsset.prompt,
            metadata: {
              source: "location_asset",
              asset_id: linkProductionAsset.id,
              location_id: linkProductionAsset.location_id,
              project_id: projectId,
            },
            isDefault: linkVideoAsDefault,
          }),
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to link video to shot")
        }
      } else {
        await StoryboardsService.updateStoryboardImage(
          linkStoryboardId,
          linkProductionAsset.content_url,
        )
      }

      setIsLinkProductionDialogOpen(false)
      toast({
        title: linkProductionMediaType === "video" ? "Video linked to shot" : "Image linked to shot",
        description: `${linkProductionMediaType === "video" ? "Video added" : "Storyboard image set"} for Scene ${storyboard.scene_number} · Shot ${storyboard.shot_number}${storyboard.title ? ` (${storyboard.title})` : ""}.`,
      })
    } catch (error) {
      toast({
        title: "Link failed",
        description: error instanceof Error ? error.message : "Could not link asset to shot.",
        variant: "destructive",
      })
    } finally {
      setIsLinkingToProduction(false)
    }
  }

  const saveGeneratedLocationShot = async (
    imageUrl: string,
    loc: Location,
    shotPreset: string,
    prompt: string,
    referenceAsset: Asset,
    model: string,
    service: string,
    styleAssetIds?: string[],
  ) => {
    const now = new Date()
    const dateStr = now.toLocaleDateString()
    const timeStr = now.toLocaleTimeString()
    const assetData = {
      project_id: projectId,
      location_id: selectedLocationId!,
      title: `${loc.name} - ${shotPreset} (${dateStr} ${timeStr})`,
      content_type: "image" as const,
      content: "",
      content_url: imageUrl,
      prompt,
      model,
      generation_settings: {
        service,
        location_id: selectedLocationId,
        location_name: loc.name,
        shot_preset: shotPreset,
        reference_asset_id: referenceAsset.id,
        style_asset_id: styleAssetIds?.[0],
        style_asset_ids: styleAssetIds,
      },
      metadata: {
        location_name: loc.name,
        generated_at: now.toISOString(),
        source: "location_shot_variation",
        service,
        shot_preset: shotPreset,
        reference_asset_id: referenceAsset.id,
        style_asset_id: styleAssetIds?.[0],
        style_asset_ids: styleAssetIds,
      },
    }
    const savedAsset = await AssetService.createAsset(assetData)
    setLocationAssets((prev) => [savedAsset, ...prev])
    setTimeout(() => carouselApi?.scrollTo(0), 100)
    return savedAsset
  }

  const saveGeneratedLocationVideo = async (
    videoUrl: string,
    loc: Location,
    prompt: string,
    referenceAsset: Asset,
    model: string,
    options?: {
      startAssetId?: string
      endAssetId?: string
      source?: string
      duration?: number
    },
  ) => {
    const now = new Date()
    const dateStr = now.toLocaleDateString()
    const timeStr = now.toLocaleTimeString()
    const isTransition = options?.source === "location_frame_to_frame"
    const assetData = {
      project_id: projectId,
      location_id: selectedLocationId!,
      title: `${loc.name} - ${isTransition ? "Transition Video" : "Video"} (${dateStr} ${timeStr})`,
      content_type: "video" as const,
      content: "",
      content_url: videoUrl,
      prompt,
      model,
      generation_settings: {
        service: isTransition ? options?.source : "runway",
        location_id: selectedLocationId,
        location_name: loc.name,
        reference_asset_id: referenceAsset.id,
        duration: options?.duration ?? videoDuration,
        start_asset_id: options?.startAssetId,
        end_asset_id: options?.endAssetId,
      },
      metadata: {
        location_name: loc.name,
        generated_at: now.toISOString(),
        source: options?.source || "location_image_to_video",
        service: isTransition ? model : "runway",
        reference_asset_id: referenceAsset.id,
        duration: options?.duration ?? videoDuration,
        start_asset_id: options?.startAssetId,
        end_asset_id: options?.endAssetId,
      },
    }
    const savedAsset = await AssetService.createAsset(assetData)
    setLocationAssets((prev) => [savedAsset, ...prev])
    return savedAsset
  }

  const pollLocationVideoJob = (jobId: string, loc: Location, prompt: string, referenceAsset: Asset, model: string) => {
    let attempts = 0
    const poll = async () => {
      attempts++
      try {
        const res = await fetch("/api/ai/check-video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        })
        if (!res.ok) {
          throw new Error("Failed to check video status")
        }

        const result = await res.json()
        const url = result.data?.url as string | undefined
        const status = result.data?.status as string | undefined

        if (url && (status === "completed" || status === "SUCCEEDED")) {
          setVideoGenerationProgress("Saving video to your location…")
          const stored = await fetch("/api/ai/download-and-store-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl: url,
              fileName: `location-${selectedLocationId}-${Date.now()}`,
              userId: userId!,
            }),
          })
          const storedData = await stored.json()
          if (!stored.ok || !storedData.supabaseUrl) {
            throw new Error(storedData.error || "Failed to save video")
          }
          await saveGeneratedLocationVideo(storedData.supabaseUrl, loc, prompt, referenceAsset, model)
          setIsGenerateVideoDialogOpen(false)
          setVideoMotionPrompt("")
          toast({
            title: "Video generated",
            description: `"${loc.name}" video was added to location assets.`,
          })
          setIsGeneratingVideo(false)
          setVideoGenerationProgress("")
          return
        }

        if (status === "failed" || status === "FAILED") {
          throw new Error("Runway video generation failed")
        }

        if (attempts < 90) {
          setVideoGenerationProgress(`Rendering video… (${attempts * 3}s)`)
          setTimeout(poll, 3000)
          return
        }

        throw new Error("Video generation timed out. Try again in a few minutes.")
      } catch (error) {
        toast({
          title: "Video generation failed",
          description: error instanceof Error ? error.message : "Could not generate video.",
          variant: "destructive",
        })
        setIsGeneratingVideo(false)
        setVideoGenerationProgress("")
      }
    }
    poll()
  }

  const openGenerateVideoDialog = () => {
    const referenceAsset =
      imageAssetsForLocation[currentImageIndex] || imageAssetsForLocation[0]
    if (!referenceAsset?.content_url) {
      toast({
        title: "No reference image",
        description: "Generate or upload a location image first, then animate it.",
        variant: "destructive",
      })
      return
    }
    const selectedLoc = locations.find((l) => l.id === selectedLocationId)
    const atmosphere = selectedLoc?.atmosphere || selectedLoc?.mood || selectedLoc?.visual_description
    setVideoMotionPrompt(
      atmosphere
        ? `Subtle cinematic motion. ${atmosphere.trim()}.`
        : "Subtle cinematic camera motion with atmospheric lighting and gentle movement.",
    )
    setIsGenerateVideoDialogOpen(true)
  }

  const handleGenerateLocationVideo = async () => {
    const prompt = videoMotionPrompt.trim()
    if (!prompt) {
      toast({
        title: "Describe the motion",
        description: "Enter how you want the image to move or animate.",
        variant: "destructive",
      })
      return
    }

    const referenceAsset =
      imageAssetsForLocation[currentImageIndex] || imageAssetsForLocation[0]
    if (!referenceAsset?.content_url || !selectedLocationId || !userId) return

    const selectedLoc = locations.find((l) => l.id === selectedLocationId)
    if (!selectedLoc) return

    setIsGeneratingVideo(true)
    setVideoGenerationProgress("Uploading reference image to Runway…")

    try {
      const videoConfig = requireRunwayVideoConfig()
      const imageFile = await referenceUrlToFile(
        referenceAsset.content_url,
        `location-video-ref-${referenceAsset.id}.png`,
      )

      const uploadForm = new FormData()
      uploadForm.append("file", imageFile)
      const uploadRes = await fetch("/api/ai/upload-to-runway", { method: "POST", body: uploadForm })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.runwayUri) {
        throw new Error(uploadData.error || "Failed to upload image to Runway")
      }

      setVideoGenerationProgress("Starting video generation…")
      const videoRes = await fetch("/api/ai/runway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "image_to_video",
          model: videoConfig.apiModel,
          promptText: prompt,
          ratio: "1280:720",
          duration: videoDuration,
          runwayUri: uploadData.runwayUri,
        }),
      })
      const videoData = await videoRes.json()
      if (!videoRes.ok || !videoData.taskId) {
        throw new Error(videoData.error || "Failed to start video generation")
      }

      setVideoGenerationProgress("Rendering video on Runway…")
      pollLocationVideoJob(videoData.taskId, selectedLoc, prompt, referenceAsset, videoConfig.apiModel)
    } catch (error) {
      toast({
        title: "Video generation failed",
        description: error instanceof Error ? error.message : "Could not generate video.",
        variant: "destructive",
      })
      setIsGeneratingVideo(false)
      setVideoGenerationProgress("")
    }
  }

  const storeRemoteVideoToLocation = async (
    remoteVideoUrl: string,
    loc: Location,
    prompt: string,
    referenceAsset: Asset,
    model: string,
    options?: {
      startAssetId?: string
      endAssetId?: string
      source?: string
      duration?: number
    },
  ) => {
    const stored = await fetch("/api/ai/download-and-store-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl: remoteVideoUrl,
        fileName: `location-${selectedLocationId}-${Date.now()}`,
        userId: userId!,
      }),
    })
    const storedData = await stored.json()
    if (!stored.ok || !storedData.supabaseUrl) {
      throw new Error(storedData.error || "Failed to save video")
    }
    await saveGeneratedLocationVideo(storedData.supabaseUrl, loc, prompt, referenceAsset, model, options)
  }

  const openTransitionVideoDialog = () => {
    const defaultStart =
      imageAssetsForLocation[currentImageIndex] || imageAssetsForLocation[0]
    if (!defaultStart?.content_url) {
      toast({
        title: "Need images first",
        description: "Generate or upload at least one location image to use as a start frame.",
        variant: "destructive",
      })
      return
    }
    setTransitionStartAssetId(defaultStart.id)
    const defaultEnd =
      imageAssetsForLocation.length >= 2
        ? imageAssetsForLocation.find((a) => a.id !== defaultStart.id) ??
          imageAssetsForLocation[(currentImageIndex + 1) % imageAssetsForLocation.length]
        : null
    setTransitionEndAssetId(defaultEnd?.id && defaultEnd.id !== defaultStart.id ? defaultEnd.id : null)
    setTransitionVideoModel("kling_i2v_extended")
    setTransitionVideoDuration(5)
    setTransitionVideoPrompt(
      "Smooth cinematic transition between the start and end frames. Maintain world consistency and lighting.",
    )
    setIsTransitionVideoDialogOpen(true)
  }

  const handleGenerateTransitionVideo = async () => {
    const prompt = transitionVideoPrompt.trim()
    if (!prompt) {
      toast({
        title: "Describe the transition",
        description: "Enter how the motion should flow between your two frames.",
        variant: "destructive",
      })
      return
    }

    const startAsset = framePickerAssets.find((a) => a.id === transitionStartAssetId)
    const endAsset = framePickerAssets.find((a) => a.id === transitionEndAssetId)
    if (!startAsset?.content_url) {
      toast({ title: "Pick a start frame", variant: "destructive" })
      return
    }
    if (!endAsset?.content_url) {
      toast({
        title: "Pick an end frame",
        description: "Frame-to-frame requires a second image (another angle, character, etc.).",
        variant: "destructive",
      })
      return
    }
    if (startAsset.id === endAsset.id) {
      toast({
        title: "Different frames required",
        description: "Choose two different images for start and end.",
        variant: "destructive",
      })
      return
    }

    const selectedLoc = locations.find((l) => l.id === selectedLocationId)
    if (!selectedLoc || !userId) return

    setIsGeneratingTransitionVideo(true)
    setTransitionVideoProgress("Preparing frames…")

    try {
      let remoteVideoUrl: string | null = null
      let modelLabel = transitionVideoModel

      if (transitionVideoModel === "kling_i2v_extended") {
        setTransitionVideoProgress("Generating with Kling (2 frames)…")
        const startFile = await referenceUrlToFile(startAsset.content_url, "start-frame.png")
        const endFile = await referenceUrlToFile(endAsset.content_url, "end-frame.png")
        const response = await KlingService.generateVideo({
          prompt,
          model: "Kling I2V Extended",
          duration: String(transitionVideoDuration),
          resolution: "1280:720",
          startFrame: startFile,
          endFrame: endFile,
        })
        if (!response.success || !response.data?.url) {
          throw new Error(response.error || "Kling frame-to-frame failed")
        }
        remoteVideoUrl = response.data.url
        modelLabel = "kling_i2v_extended"
      } else {
        const leonardoModel =
          transitionVideoModel === "leonardo_kling_2_1"
            ? "KLING2_1"
            : transitionVideoModel === "leonardo_veo_3_1_fast"
              ? "VEO3_1FAST"
              : "VEO3_1"

        setTransitionVideoProgress(`Generating with ${leonardoModel} via Leonardo…`)
        const response = await fetch("/api/ai/frame-to-frame-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            model: leonardoModel,
            duration: transitionVideoDuration,
            startFrameUrl: startAsset.content_url,
            endFrameUrl: endAsset.content_url,
          }),
        })
        const result = await response.json()
        if (!response.ok || !result.success || !result.data?.url) {
          throw new Error(result.error || "Frame-to-frame generation failed")
        }
        remoteVideoUrl = result.data.url
        modelLabel = transitionVideoModel
      }

      setTransitionVideoProgress("Saving to your location…")
      await storeRemoteVideoToLocation(
        remoteVideoUrl!,
        selectedLoc,
        prompt,
        startAsset,
        modelLabel,
        {
          source: "location_frame_to_frame",
          startAssetId: startAsset.id,
          endAssetId: endAsset.id,
          duration: transitionVideoDuration,
        },
      )

      setIsTransitionVideoDialogOpen(false)
      toast({
        title: "Transition video created",
        description: "Your two-frame video was saved under Videos.",
      })
    } catch (error) {
      toast({
        title: "Transition video failed",
        description: error instanceof Error ? error.message : "Could not generate transition video.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingTransitionVideo(false)
      setTransitionVideoProgress("")
    }
  }

  const renderTransitionFramePicker = (
    role: "start" | "end",
    selectedId: string | null,
    onSelect: (id: string) => void,
  ) => {
    const selectedBorder =
      role === "start"
        ? "border-emerald-500 ring-2 ring-emerald-500/40"
        : "border-sky-500 ring-2 ring-sky-500/40"
    const hoverBorder =
      role === "start" ? "hover:border-emerald-500/50" : "hover:border-sky-500/50"
    const hasAnyAssets = thisLocationFrameAssets.length > 0 || otherFramePickerGroups.length > 0

    if (!hasAnyAssets) {
      return <p className="text-xs text-muted-foreground">No images available in this project.</p>
    }

    return (
      <div className="space-y-2">
        {thisLocationFrameAssets.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              This location
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {thisLocationFrameAssets.map((asset) => (
                <button
                  key={`${role}-loc-${asset.id}`}
                  type="button"
                  disabled={isGeneratingTransitionVideo}
                  onClick={() => onSelect(asset.id)}
                  className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedId === asset.id ? selectedBorder : `border-border ${hoverBorder}`
                  }`}
                  title={asset.title}
                >
                  <img src={asset.content_url!} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {otherFramePickerGroups.length > 0 && (
          <div className="space-y-3 max-h-36 overflow-y-auto rounded-lg border border-border/60 p-2">
            {otherFramePickerGroups.map((group) => (
              <div key={`${role}-${group.label}`} className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {group.assets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      disabled={isGeneratingTransitionVideo}
                      onClick={() => onSelect(asset.id)}
                      className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedId === asset.id ? selectedBorder : `border-border ${hoverBorder}`
                      }`}
                      title={asset.title}
                    >
                      <img src={asset.content_url!} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const generateLocationShotFromReference = async (
    referenceAsset: Asset,
    shotPreset: string,
    options?: {
      customPrompt?: string
      promptOverride?: string
      referenceFile?: File
      styleReferenceFiles?: File[]
      styleAssetIds?: string[]
    },
  ) => {
    if (!selectedLocationId || !userId || !ready || !referenceAsset.content_url) {
      throw new Error("Select a location and reference image first.")
    }

    const selectedLoc = locations.find((l) => l.id === selectedLocationId)
    if (!selectedLoc) {
      throw new Error("Location not found.")
    }

    const config = requireLockedImageConfig({ withReferenceImage: true })

    const prompt =
      options?.promptOverride ??
      buildLocationShotPrompt(shotPreset, selectedLoc, options?.customPrompt)

    const response = await requestLockedImageGeneration(prompt, config, {
      referenceFile: config.supportsReference
        ? options?.referenceFile ??
          (await referenceUrlToFile(
            referenceAsset.content_url,
            `location-ref-${referenceAsset.id}.png`,
          ))
        : undefined,
      styleReferenceFiles: config.supportsReference ? options?.styleReferenceFiles : undefined,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to generate shot from reference")
    }

    const result = await response.json()
    if (!result.success || !result.imageUrl) {
      throw new Error("Failed to generate shot from reference")
    }

    const imageUrlToUse = result.bucketUrl || result.imageUrl
    await saveGeneratedLocationShot(
      imageUrlToUse,
      selectedLoc,
      shotPreset,
      prompt,
      referenceAsset,
      config.apiModel,
      config.service,
      options?.styleAssetIds,
    )
  }

  const openCreateAngleDialog = () => {
    const defaultAsset =
      imageAssetsForLocation[currentImageIndex] || imageAssetsForLocation[0]
    if (!defaultAsset?.content_url) {
      toast({
        title: "No reference image",
        description: "Upload or generate a location image first, then define custom angles from it.",
        variant: "destructive",
      })
      return
    }
    setNewAngleLabel("")
    setNewAngleDirective(inlineCustomShotPrompt.trim())
    setIsCreateAngleDialogOpen(true)
  }

  const saveCustomShotAngle = async (label: string, directive: string) => {
    if (!selectedLocationId || !selectedLocation) {
      throw new Error("Select a location first.")
    }
    const trimmedLabel = label.trim()
    const trimmedDirective = directive.trim()
    if (!trimmedLabel || !trimmedDirective) {
      throw new Error("Enter a name and direction for your angle.")
    }
    const allLabels = [
      ...LOCATION_SHOT_PRESETS,
      ...customShotAngles.map((a) => a.label),
    ]
    if (allLabels.includes(trimmedLabel)) {
      throw new Error("An angle with this name already exists. Choose a different name.")
    }
    const newAngle: CustomShotAngle = {
      id: crypto.randomUUID(),
      label: trimmedLabel,
      directive: trimmedDirective,
    }
    const updatedAngles = [...customShotAngles, newAngle]
    const updated = await LocationsService.updateLocation(selectedLocationId, {
      metadata: {
        ...(selectedLocation.metadata ?? {}),
        custom_shot_angles: updatedAngles,
      },
    })
    setLocations((prev) => prev.map((l) => (l.id === selectedLocationId ? updated : l)))
    setSelectedShotPreset(trimmedLabel)
    return newAngle
  }

  const handleGenerateCustomAngle = async () => {
    const trimmedLabel = newAngleLabel.trim()
    const trimmedDirective = newAngleDirective.trim()
    if (!trimmedLabel || !trimmedDirective) {
      toast({
        title: "Missing details",
        description: "Enter a shot name and describe what the AI should show.",
        variant: "destructive",
      })
      return
    }

    const referenceAsset =
      referenceAssetForShots ||
      imageAssetsForLocation[currentImageIndex] ||
      imageAssetsForLocation[0]
    if (!referenceAsset) {
      toast({
        title: "No reference image",
        description: "Upload or generate a location image first.",
        variant: "destructive",
      })
      return
    }

    const selectedLoc = locations.find((l) => l.id === selectedLocationId)
    if (!selectedLoc) return

    setIsGeneratingShot(true)
    setShotGenerationProgress(`Generating ${trimmedLabel}...`)
    try {
      const allLabels = [
        ...LOCATION_SHOT_PRESETS,
        ...customShotAngles.map((a) => a.label),
      ]
      const isNewAngle = !allLabels.includes(trimmedLabel)
      if (isNewAngle) {
        await saveCustomShotAngle(trimmedLabel, trimmedDirective)
      }

      await generateLocationShotFromReference(referenceAsset, trimmedLabel, {
        promptOverride: buildCustomLocationShotPrompt(trimmedDirective, selectedLoc),
      })

      setIsCreateAngleDialogOpen(false)
      setNewAngleLabel("")
      setNewAngleDirective("")
      toast({
        title: "Shot generated",
        description: `"${trimmedLabel}" was added to your location images${isNewAngle ? " and saved to Choose Shots" : ""}.`,
      })
    } catch (error) {
      toast({
        title: "Generation failed",
        description: getImageGenerationErrorMessage(
          error,
          "Could not generate your custom shot.",
        ),
        variant: "destructive",
      })
    } finally {
      setIsGeneratingShot(false)
      setShotGenerationProgress("")
    }
  }

  const openGenerateShotsDialog = (asset?: Asset) => {
    const defaultAsset = asset || imageAssetsForLocation[currentImageIndex] || imageAssetsForLocation[0]
    if (!defaultAsset?.content_url) {
      toast({
        title: "No reference image",
        description: "Upload or generate a location image first, then create new angles from it.",
        variant: "destructive",
      })
      return
    }
    setReferenceAssetForShots(defaultAsset)
    setSelectedShotPreset("Establishing Shot")
    setShotCustomPrompt("")
    setShotGenerationProgress("")
    setIsGenerateShotsDialogOpen(true)
  }

  const handleGenerateSingleShot = async () => {
    if (!referenceAssetForShots) return
    setIsGeneratingShot(true)
    setShotGenerationProgress(`Generating ${selectedShotPreset}...`)
    try {
      await generateLocationShotFromReference(
        referenceAssetForShots,
        selectedShotPreset,
        { customPrompt: shotCustomPrompt },
      )
      toast({
        title: "New angle generated",
        description: `${selectedShotPreset} added to location assets.`,
      })
    } catch (error) {
      toast({
        title: "Shot generation failed",
        description: getImageGenerationErrorMessage(
          error,
          "Could not generate a new angle from this image.",
        ),
        variant: "destructive",
      })
    } finally {
      setIsGeneratingShot(false)
      setShotGenerationProgress("")
    }
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
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file (PNG, JPG, WebP, etc.).",
        variant: "destructive",
      })
      return
    }
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

  const handleGenerateInlineCustomShot = async () => {
    const direction = inlineCustomShotPrompt.trim()
    if (!direction) {
      toast({
        title: "Describe your shot",
        description: 'Enter what you want, e.g. "close up of the drone on the right" or "zoom into the city".',
        variant: "destructive",
      })
      return
    }

    const referenceAsset =
      imageAssetsForLocation[currentImageIndex] || imageAssetsForLocation[0]
    if (!referenceAsset) return

    const selectedLoc = locations.find((l) => l.id === selectedLocationId)
    if (!selectedLoc) return

    const shotLabel =
      direction.length > 48 ? `${direction.slice(0, 45).trim()}...` : direction

    let styleReferenceFiles: File[] = []
    for (const assetId of inlineStyleLinkAssetIds) {
      const styleAsset = projectImageAssets.find((a) => a.id === assetId)
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
    setShotGenerationProgress("Generating custom shot...")
    try {
      await generateLocationShotFromReference(referenceAsset, shotLabel, {
        promptOverride: buildCustomLocationShotPrompt(direction, selectedLoc),
        referenceFile: inlineShotReferenceFile ?? undefined,
        styleReferenceFiles,
        styleAssetIds: inlineStyleLinkAssetIds,
      })
      setInlineCustomShotPrompt("")
      clearInlineShotReference()
      clearInlineStyleLink()
      toast({
        title: "Custom shot generated",
        description: "Your directed shot was added to location assets.",
      })
    } catch (error) {
      toast({
        title: "Custom shot failed",
        description: getImageGenerationErrorMessage(
          error,
          "Could not generate your custom shot.",
        ),
        variant: "destructive",
      })
    } finally {
      setIsGeneratingShot(false)
      setShotGenerationProgress("")
    }
  }

  const loadLocationIntoForm = (loc: Location) => {
    setSelectedLocationId(loc.id)
    setEditingLocationInFormId(loc.id)
    setNewLocName(loc.name || "")
    setNewLocDescription(loc.description || "")
    setNewLocType((loc.type as any) || "")
    setNewLocAddress(loc.address || "")
    setNewLocCity(loc.city || "")
    setNewLocState(loc.state || "")
    setNewLocCountry(loc.country || "")
    setNewLocTimeOfDay((loc.time_of_day || []).join(", ") || "")
    setNewLocAtmosphere(loc.atmosphere || "")
    setNewLocMood(loc.mood || "")
    setNewLocVisualDescription(loc.visual_description || "")
    setNewLocLightingNotes(loc.lighting_notes || "")
    setNewLocSoundNotes(loc.sound_notes || "")
    setNewLocKeyFeatures((loc.key_features || []).join(", ") || "")
    setNewLocProps((loc.props || []).join(", ") || "")
    setNewLocRestrictions(loc.restrictions || "")
    setNewLocAccessNotes(loc.access_notes || "")
    setNewLocShootingNotes(loc.shooting_notes || "")
    setIsCreateLocationDialogOpen(true)
  }

  const clearForm = () => {
    setEditingLocationInFormId(null)
    setNewLocName("")
    setNewLocDescription("")
    setNewLocType("")
    setNewLocAddress("")
    setNewLocCity("")
    setNewLocState("")
    setNewLocCountry("")
    setNewLocTimeOfDay("")
    setNewLocAtmosphere("")
    setNewLocMood("")
    setNewLocVisualDescription("")
    setNewLocLightingNotes("")
    setNewLocSoundNotes("")
    setNewLocKeyFeatures("")
    setNewLocProps("")
    setNewLocRestrictions("")
    setNewLocAccessNotes("")
    setNewLocShootingNotes("")
  }

  const openCreateLocationDialog = (namePrefill?: string) => {
    clearForm()
    if (namePrefill) {
      setNewLocName(namePrefill)
    }
    setIsCreateLocationDialogOpen(true)
  }

  const createLocation = async (namePrefill?: string) => {
    if (!projectId) return
    const name = (namePrefill ?? newLocName).trim()
    if (!name) {
      toast({ title: "Name required", description: "Please enter a location name.", variant: "destructive" })
      return
    }
    try {
      setIsCreatingLocation(true)
      
      const parseArray = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean)
      
      const locationData: any = {
        name: name || undefined,
        description: newLocDescription || undefined,
        type: newLocType || undefined,
        address: newLocAddress || undefined,
        city: newLocCity || undefined,
        state: newLocState || undefined,
        country: newLocCountry || undefined,
        time_of_day: parseArray(newLocTimeOfDay),
        atmosphere: newLocAtmosphere || undefined,
        mood: newLocMood || undefined,
        visual_description: newLocVisualDescription || undefined,
        lighting_notes: newLocLightingNotes || undefined,
        sound_notes: newLocSoundNotes || undefined,
        key_features: parseArray(newLocKeyFeatures),
        props: parseArray(newLocProps),
        restrictions: newLocRestrictions || undefined,
        access_notes: newLocAccessNotes || undefined,
        shooting_notes: newLocShootingNotes || undefined,
      }
      
      Object.keys(locationData).forEach(key => {
        if (locationData[key] === undefined || 
            (Array.isArray(locationData[key]) && locationData[key].length === 0)) {
          delete locationData[key]
        }
      })
      
      if (editingLocationInFormId) {
        const updated = await LocationsService.updateLocation(editingLocationInFormId, locationData)
        setLocations(prev => prev.map(l => l.id === editingLocationInFormId ? updated : l))
        clearForm()
        setIsCreateLocationDialogOpen(false)
        toast({ title: "Location updated", description: `"${updated.name}" saved.` })
      } else {
        locationData.project_id = projectId
        const created = await LocationsService.createLocation(locationData)
        setLocations([created, ...locations])
        setSelectedLocationId(created.id)
        if (!namePrefill) {
          clearForm()
          setIsCreateLocationDialogOpen(false)
        }
        toast({ title: "Location created", description: `"${created.name}" added.` })
      }
    } catch (err) {
      console.error('Create/update location failed:', err)
      toast({ title: "Error", description: editingLocationInFormId ? "Failed to update location." : "Failed to create location.", variant: "destructive" })
    } finally {
      setIsCreatingLocation(false)
    }
  }

  const deleteLocation = async (id: string) => {
    if (!confirm("Delete this location? This cannot be undone.")) return
    try {
      await LocationsService.deleteLocation(id)
      setLocations(prev => prev.filter(l => l.id !== id))
      if (selectedLocationId === id) {
        setSelectedLocationId(null)
      }
      toast({ title: "Deleted", description: "Location removed." })
    } catch (e) {
      console.error('Delete location failed:', e)
      toast({ title: "Error", description: "Failed to delete location.", variant: "destructive" })
    }
  }

  const getFileContentType = (file: File): 'image' | 'video' | 'audio' | 'script' | 'prose' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type === 'application/pdf' || file.type.startsWith('text/') || 
        file.name.endsWith('.txt') || file.name.endsWith('.md') ||
        file.name.endsWith('.doc') || file.name.endsWith('.docx')) return 'prose'
    return 'script'
  }

  const handleFileUpload = async (file: File) => {
    if (!selectedLocationId || !projectId) {
      toast({
        title: "Error",
        description: "Please select a location first.",
        variant: "destructive",
      })
      return
    }

    setIsUploadingAsset(true)
    try {
      const filePath = `${projectId}/locations/${selectedLocationId}/${Date.now()}_${file.name}`
      
      const { data, error } = await getSupabaseClient().storage
        .from('cinema_files')
        .upload(filePath, file)
      
      if (error) {
        throw new Error(`Upload failed: ${error.message}`)
      }
      
      const { data: { publicUrl } } = getSupabaseClient().storage
        .from('cinema_files')
        .getPublicUrl(filePath)
      
      const contentType = getFileContentType(file)
      const selectedLoc = locations.find(l => l.id === selectedLocationId)
      
      const assetData = {
        project_id: projectId,
        location_id: selectedLocationId,
        title: `${selectedLoc?.name || 'Location'} - ${file.name}`,
        content_type: contentType,
        content: '',
        content_url: publicUrl,
        prompt: '',
        model: 'manual_upload',
        generation_settings: {},
        metadata: {
          location_name: selectedLoc?.name,
          uploaded_at: new Date().toISOString(),
          source: 'location_upload',
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
        }
      }

      const savedAsset = await AssetService.createAsset(assetData)
      setLocationAssets(prev => [savedAsset, ...prev])
      
      toast({
        title: "Success",
        description: `${file.name} uploaded successfully!`,
      })
    } catch (err) {
      console.error('Upload error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: "Error",
        description: errorMessage.includes('migration') 
          ? 'Database migration required. Please run migration 048_add_location_id_to_assets.sql in Supabase.'
          : `Failed to upload ${file.name}: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setIsUploadingAsset(false)
      const input = document.getElementById('location-asset-upload') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      handleFileUpload(file)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Delete this asset? This cannot be undone.")) return
    
    try {
      await AssetService.deleteAsset(assetId)
      
      // Reload assets from server to ensure we have the complete, up-to-date list
      if (selectedLocationId) {
        try {
          const assets = await AssetService.getAssetsForLocation(selectedLocationId)
          setLocationAssets(assets)
        } catch (reloadErr) {
          console.error('Error reloading assets after delete:', reloadErr)
          // Fallback to client-side filtering if reload fails
          setLocationAssets(prev => prev.filter(a => a.id !== assetId))
        }
      } else {
        // Fallback if no location selected
        setLocationAssets(prev => prev.filter(a => a.id !== assetId))
      }
      
      toast({
        title: "Deleted",
        description: "Asset removed.",
      })
    } catch (err) {
      console.error('Delete asset failed:', err)
      toast({
        title: "Error",
        description: "Failed to delete asset.",
        variant: "destructive",
      })
    }
  }

  const handleSetThumbnail = async (asset: Asset) => {
    if (!selectedLocationId || !asset.content_url) return
    
    try {
      await LocationsService.updateLocation(selectedLocationId, {
        image_url: asset.content_url
      })
      
      // Update local location state
      setLocations(prev => prev.map(l => 
        l.id === selectedLocationId 
          ? { ...l, image_url: asset.content_url || null }
          : l
      ))
      
      toast({
        title: "Thumbnail Set",
        description: "This image is now the location's main thumbnail.",
      })
    } catch (error) {
      console.error('Error setting thumbnail:', error)
      toast({
        title: "Error",
        description: "Failed to set thumbnail.",
        variant: "destructive",
      })
    }
  }

  const getAssetIcon = (asset: Asset) => {
    switch (asset.content_type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />
      case 'video':
        return <Video className="h-4 w-4" />
      case 'audio':
        return <FileIcon className="h-4 w-4" />
      default:
        return <FileIcon className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent break-words">
              Locations
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-muted-foreground break-words">
              Aggregate locations from scenes and manage location profiles.
            </p>
          </div>
          {projectId && !loading && (
            <Button onClick={() => openCreateLocationDialog()} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Location</span>
              <span className="sm:hidden">Create</span>
            </Button>
          )}
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage locations"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-6 sm:py-8 text-center text-muted-foreground px-4">
              <p className="text-xs sm:text-sm break-words">Select a movie to view and manage locations.</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs sm:text-sm">Loading locations...</span>
          </div>
        ) : (
          <>
            {/* Location Viewer Card */}
            <Card className="cinema-card mb-4 sm:mb-6">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl break-words">
                    <MapPin className="h-5 w-5 flex-shrink-0" />
                    View Location
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="space-y-2">
                  <Label htmlFor="location-selector" className="text-xs sm:text-sm">Select Location</Label>
                  <Select
                    value={selectedLocationId || ""}
                    onValueChange={(value) => {
                      setSelectedLocationId(value || null)
                    }}
                    disabled={locations.length === 0}
                  >
                    <SelectTrigger id="location-selector" className="bg-input border-border text-xs sm:text-sm">
                      <SelectValue placeholder={locations.length === 0 ? "No locations available. Create one above." : "Select a location to view details..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No locations available</div>
                      ) : (
                        locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                            {loc.type && ` (${loc.type})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                  
                  {selectedLocationId && (() => {
                    const selectedLoc = locations.find(l => l.id === selectedLocationId)
                    if (!selectedLoc) return null
                    
                    return (
                      <div className="space-y-4 p-3 sm:p-4 bg-muted/20 rounded-lg border border-border overflow-x-hidden">
                        {/* Location Assets Section */}
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <Label className="text-xs sm:text-sm font-medium">Assets</Label>
                            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/locations/${selectedLoc.id}`)}
                                className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span className="hidden sm:inline">View Full Page</span>
                                <span className="sm:hidden">View</span>
                              </Button>
                              <input
                                id="location-asset-upload"
                                type="file"
                                multiple
                                accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx,.md"
                                onChange={handleFileSelect}
                                className="hidden"
                                disabled={isUploadingAsset}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById('location-asset-upload')?.click()}
                                disabled={isUploadingAsset}
                                className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                              >
                                {isUploadingAsset ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="hidden sm:inline">Uploading...</span>
                                    <span className="sm:hidden">Up...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4" />
                                    <span className="hidden sm:inline">Upload Assets</span>
                                    <span className="sm:hidden">Upload</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="inline-location-image-prompt" className="text-xs sm:text-sm font-medium">
                              Image Prompt
                            </Label>
                            <Textarea
                              id="inline-location-image-prompt"
                              value={imagePrompt}
                              onChange={(e) => setImagePrompt(e.target.value)}
                              placeholder="e.g., misty riverbank at dawn, wide establishing shot, cinematic atmosphere"
                              className="bg-input border-border min-h-[80px] text-xs sm:text-sm"
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={handleQuickGenerateLocationImage}
                                disabled={isGeneratingQuickImage || !selectedLocationId || !aiSettingsLoaded || !imagePrompt.trim()}
                                className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                                title="Generate using your prompt and the locked AI model"
                              >
                                {isGeneratingQuickImage ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="hidden sm:inline">Generating...</span>
                                    <span className="sm:hidden">Gen...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4" />
                                    <span className="hidden sm:inline">Quick Generate</span>
                                    <span className="sm:hidden">Quick</span>
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsGenerateImageDialogOpen(true)}
                                disabled={isGeneratingImage || isGeneratingQuickImage || !imagePrompt.trim()}
                                className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                              >
                                {isGeneratingImage ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="hidden sm:inline">Generating...</span>
                                    <span className="sm:hidden">Gen...</span>
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon className="h-4 w-4" />
                                    <span className="hidden sm:inline">Generate Image</span>
                                    <span className="sm:hidden">Generate</span>
                                  </>
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Enter your prompt, then click Quick Generate. Generate Image opens advanced options.
                            </p>
                          </div>
                          
                          {isLoadingAssets ? (
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground py-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading assets...
                            </div>
                          ) : locationAssets.length === 0 ? (
                            <div className="text-xs sm:text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg px-2 break-words">
                              No assets yet. Enter a prompt and click Quick Generate below.
                            </div>
                          ) : (() => {
                            const imageAssets = locationAssets.filter(a => a.content_type === 'image' && a.content_url)
                            const videoAssets = locationAssets.filter(a => a.content_type === 'video' && a.content_url)
                            const otherAssets = locationAssets.filter((a) => {
                              if (a.content_type === 'image' && a.content_url) return false
                              if (a.content_type === 'video' && a.content_url) return false
                              return true
                            })
                            
                            return (
                              <div className="space-y-4">
                                {/* Image Slideshow */}
                                {imageAssets.length > 0 && (
                                  <div className="space-y-3">
                                    <Label className="text-xs text-muted-foreground">Images ({imageAssets.length})</Label>
                                    <div className="relative">
                                      <Carousel className="w-full" setApi={setCarouselApi}>
                                        <CarouselContent>
                                          {imageAssets.map((asset, index) => (
                                            <CarouselItem key={asset.id}>
                                              <div 
                                                className="relative group aspect-video rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer"
                                                onClick={() => {
                                                  setViewingImage(asset)
                                                  setViewImageDialogOpen(true)
                                                }}
                                              >
                                                <img
                                                  src={asset.content_url}
                                                  alt={asset.title}
                                                  className="w-full h-full object-cover object-center pointer-events-none"
                                                />
                                                <div 
                                                  className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 pointer-events-none"
                                                >
                                                  <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      openGenerateShotsDialog(asset)
                                                    }}
                                                    className="h-8 pointer-events-auto"
                                                    title="Generate new angle from this image"
                                                  >
                                                    <Camera className="h-3 w-3 mr-1" />
                                                    New Angle
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setViewingImage(asset)
                                                      setViewImageDialogOpen(true)
                                                    }}
                                                    className="h-8 pointer-events-auto"
                                                  >
                                                    <ExternalLink className="h-3 w-3 mr-1" />
                                                    View
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
                                                    Set Thumbnail
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
                                                  {selectedLocationId && locations.find(l => l.id === selectedLocationId)?.image_url === asset.content_url && (
                                                    <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs backdrop-blur-sm flex items-center gap-1">
                                                      <Star className="h-3 w-3 fill-current" />
                                                      Thumbnail
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs backdrop-blur-sm max-w-[80%] truncate">
                                                  {asset.title.replace(/ - AI Generated Image.*$/, '')}
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
                                      
                                      {/* Thumbnail Navigation */}
                                      {imageAssets.length > 1 && (
                                        <div className="mt-3 flex items-center justify-center gap-2 overflow-x-auto pb-2">
                                          {imageAssets.map((asset, index) => (
                                            <button
                                              key={asset.id}
                                              onClick={() => {
                                                carouselApi?.scrollTo(index)
                                              }}
                                              className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                                index === currentImageIndex
                                                  ? 'border-primary ring-2 ring-primary/50'
                                                  : 'border-border hover:border-primary/50'
                                              }`}
                                              title="Click to navigate to this image"
                                            >
                                              <img
                                                src={asset.content_url}
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
                                    </div>

                                    <div className="flex flex-col gap-2 pt-1">
                                      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            openGenerateShotsDialog(
                                              imageAssets[currentImageIndex] || imageAssets[0],
                                            )
                                          }
                                          disabled={isGeneratingShot}
                                          className="gap-2 w-full sm:w-auto"
                                          title="Pick specific camera angles manually"
                                        >
                                          <Camera className="h-4 w-4" />
                                          Choose Shots
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={openCreateAngleDialog}
                                          disabled={isGeneratingShot || !selectedLocationId}
                                          className="gap-2 w-full sm:w-auto"
                                          title="Save a custom angle to the shot dropdown and generate it from this image"
                                        >
                                          <Plus className="h-4 w-4" />
                                          Custom Angle
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={openGenerateVideoDialog}
                                          disabled={
                                            isGeneratingVideo ||
                                            isGeneratingTransitionVideo ||
                                            isGeneratingShot ||
                                            imageAssetsForLocation.length === 0
                                          }
                                          className="gap-2 w-full sm:w-auto"
                                          title="Animate the selected image into a short video with Runway ML"
                                        >
                                          <Video className="h-4 w-4" />
                                          Generate Video
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={openTransitionVideoDialog}
                                          disabled={
                                            isGeneratingVideo ||
                                            isGeneratingTransitionVideo ||
                                            isGeneratingShot ||
                                            framePickerAssets.length < 2
                                          }
                                          className="gap-2 w-full sm:w-auto"
                                          title="Generate a transition between two frames (Kling or Leonardo)"
                                        >
                                          <ArrowRightLeft className="h-4 w-4" />
                                          Transition Video
                                        </Button>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Image shots use your locked model ({getLockedImageModelLabel()}).
                                        {getLockedImageConfig({ withReferenceImage: true })?.supportsReference
                                          ? " Angle shots include your reference image with the prompt."
                                          : " Angle shots use your locked model with a text prompt describing the new view."}
                                        {" "}Video uses Runway ML ({getLockedVideoModelLabel()}) from the selected carousel image.
                                        {" "}Transition video animates between two project images via Kling or Leonardo.
                                      </p>
                                      {(isGeneratingShot && shotGenerationProgress) ||
                                      (isGeneratingVideo && videoGenerationProgress) ||
                                      (isGeneratingTransitionVideo && transitionVideoProgress) ? (
                                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          {isGeneratingTransitionVideo
                                            ? transitionVideoProgress
                                            : isGeneratingVideo
                                              ? videoGenerationProgress
                                              : shotGenerationProgress}
                                        </p>
                                      ) : null}
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-border/60">
                                      <Label htmlFor="inline-custom-shot" className="text-xs sm:text-sm">
                                        Describe your shot
                                      </Label>
                                      <Textarea
                                        id="inline-custom-shot"
                                        value={inlineCustomShotPrompt}
                                        onChange={(e) => setInlineCustomShotPrompt(e.target.value)}
                                        placeholder='e.g., close up of the drone on the right, zoom into the city skyline, push in on the NEW YORK sign'
                                        className="bg-input border-border min-h-[72px] text-xs sm:text-sm resize-none"
                                        disabled={isGeneratingShot}
                                      />
                                      <div className="space-y-2">
                                        <Label htmlFor="inline-shot-ref-upload" className="text-xs text-muted-foreground">
                                          Primary reference (optional)
                                        </Label>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <input
                                            id="inline-shot-ref-upload"
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
                                            onClick={() =>
                                              document.getElementById("inline-shot-ref-upload")?.click()
                                            }
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
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {inlineShotReferenceFile
                                            ? "Using your uploaded image as the primary reference."
                                            : "Uses the selected carousel image if you don't upload one."}
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
                                            Adds more images from your project as references — characters, other locations, covers, etc. Select up to {MAX_LINKED_REFERENCE_IMAGES}. Your description above is the only prompt.
                                          </p>
                                          {isLoadingProjectAssets ? (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                              Loading project assets…
                                            </div>
                                          ) : (
                                            <div className="space-y-3">
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
                                                        title={`${getProjectAssetSourceLabel(asset, locations, projectCharacters)} — ${asset.title.replace(/ - AI Generated Image.*$/, "")}`}
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
                                          disabled={isGeneratingShot || !inlineCustomShotPrompt.trim()}
                                          className="gap-2 w-full sm:w-auto"
                                        >
                                          {isGeneratingShot && inlineCustomShotPrompt.trim() ? (
                                            <>
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                              Generating...
                                            </>
                                          ) : (
                                            <>
                                              <Wand2 className="h-4 w-4" />
                                              Generate Custom Shot
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Videos */}
                                {videoAssets.length > 0 && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      Videos ({videoAssets.length})
                                    </Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {videoAssets.map((asset) => {
                                        const refId =
                                          (asset.metadata?.reference_asset_id as string | undefined) ||
                                          (asset.generation_settings?.reference_asset_id as string | undefined)
                                        const posterUrl = refId
                                          ? imageAssets.find((img) => img.id === refId)?.content_url
                                          : undefined

                                        return (
                                          <div
                                            key={asset.id}
                                            className="relative group border border-border rounded-lg overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors"
                                          >
                                            <button
                                              type="button"
                                              className="relative aspect-video w-full block cursor-pointer"
                                              onClick={() => {
                                                setViewingVideo(asset)
                                                setViewVideoDialogOpen(true)
                                              }}
                                            >
                                              <video
                                                src={asset.content_url}
                                                poster={posterUrl}
                                                preload="metadata"
                                                muted
                                                playsInline
                                                className="w-full h-full object-cover pointer-events-none"
                                              />
                                              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                <div className="rounded-full bg-black/60 p-3 backdrop-blur-sm">
                                                  <Play className="h-6 w-6 text-white fill-white" />
                                                </div>
                                              </div>
                                              <div className="absolute bottom-2 left-2 right-2">
                                                <p className="text-xs text-white font-medium truncate drop-shadow-md">
                                                  {asset.title.replace(/ - Video \(.*\)$/, "")}
                                                </p>
                                              </div>
                                            </button>
                                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Button
                                                size="icon"
                                                variant="secondary"
                                                onClick={() => {
                                                  setViewingVideo(asset)
                                                  setViewVideoDialogOpen(true)
                                                }}
                                                className="h-7 w-7 bg-black/60 hover:bg-black/80 border-0"
                                                title="Play video"
                                              >
                                                <Play className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="icon"
                                                variant="secondary"
                                                onClick={() => window.open(asset.content_url!, "_blank")}
                                                className="h-7 w-7 bg-black/60 hover:bg-black/80 border-0"
                                                title="Open in new tab"
                                              >
                                                <ExternalLink className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="icon"
                                                variant="secondary"
                                                onClick={() => handleDeleteAsset(asset.id)}
                                                className="h-7 w-7 bg-black/60 hover:bg-destructive border-0"
                                                title="Delete video"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Other Files (audio, scripts, etc.) */}
                                {otherAssets.length > 0 && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Other Files ({otherAssets.length})</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {otherAssets.map((asset) => (
                                        <div
                                          key={asset.id}
                                          className="relative group border border-border rounded-lg overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors"
                                        >
                                          <div className="p-4">
                                            <div className="flex items-start gap-3">
                                              <div className="p-2 rounded-lg bg-primary/10">
                                                {getAssetIcon(asset)}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{asset.title.replace(/ - AI Generated Image.*$/, '')}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                  {asset.content_type}
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {asset.content_url && (
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => window.open(asset.content_url!, '_blank')}
                                                    className="h-7 w-7"
                                                  >
                                                    <ExternalLink className="h-3 w-3" />
                                                  </Button>
                                                )}
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  onClick={() => handleDeleteAsset(asset.id)}
                                                  className="h-7 w-7 text-destructive"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                        
                        <Separator />
                        
                        {/* Location Details Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Name</Label>
                            <p className="font-semibold text-base sm:text-lg break-words">{selectedLoc.name}</p>
                          </div>
                          {selectedLoc.type && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Type</Label>
                              <p className="font-medium text-sm sm:text-base break-words">{selectedLoc.type}</p>
                            </div>
                          )}
                        </div>
                        
                        {selectedLoc.description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <p className="text-xs sm:text-sm mt-1 whitespace-pre-wrap break-words">{selectedLoc.description}</p>
                          </div>
                        )}
                        
                        {(selectedLoc.address || selectedLoc.city || selectedLoc.state || selectedLoc.country) && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Address</Label>
                            <p className="text-xs sm:text-sm mt-1 break-words">
                              {[selectedLoc.address, selectedLoc.city, selectedLoc.state, selectedLoc.country].filter(Boolean).join(", ")}
                            </p>
                          </div>
                        )}
                        
                        {selectedLoc.visual_description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Visual Description</Label>
                            <p className="text-xs sm:text-sm mt-1 whitespace-pre-wrap break-words">{selectedLoc.visual_description}</p>
                          </div>
                        )}
                        
                        {(selectedLoc.atmosphere || selectedLoc.mood) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {selectedLoc.atmosphere && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Atmosphere</Label>
                                <p className="text-xs sm:text-sm mt-1 break-words">{selectedLoc.atmosphere}</p>
                              </div>
                            )}
                            {selectedLoc.mood && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Mood</Label>
                                <p className="text-xs sm:text-sm mt-1 break-words">{selectedLoc.mood}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {selectedLoc.time_of_day && selectedLoc.time_of_day.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Time of Day</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedLoc.time_of_day.map((tod, i) => (
                                <Badge key={`${selectedLoc.id}-tod-${i}`} variant="outline">
                                  {tod}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <Separator />
                        
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              loadLocationIntoForm(selectedLoc)
                            }}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit Location
                          </Button>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {!selectedLocationId && locations.length > 0 && (
                    <div className="text-xs sm:text-sm text-muted-foreground text-center py-4 px-2 break-words">
                      Select a location from the dropdown to view their full details
                    </div>
                  )}
                  
                  {locations.length === 0 && (
                    <div className="text-xs sm:text-sm text-muted-foreground text-center py-4 px-2 break-words">
                      No locations created yet. Click <strong>Create Location</strong> above to add your first one.
                    </div>
                  )}
                </CardContent>
              </Card>
            
            <div className="space-y-4 sm:space-y-6">
            {/* Locations list */}
            <Card id="locations-form-card" className="cinema-card">
              <CardHeader className="pb-4 p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Your Locations</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                  Select a location to view details, or use Create Location above to add a new one.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {isLoadingLocations ? "Loading locations..." : `${locations.length} location${locations.length === 1 ? "" : "s"}`}
                  </div>
                  {isLoadingLocations ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : locations.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No locations yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {locations.map((loc) => (
                        <div
                          key={loc.id}
                          className={`p-2 rounded-md text-sm border ${
                            selectedLocationId === loc.id
                              ? 'border-primary/60 ring-2 ring-primary/20 bg-primary/5'
                              : 'border-border cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors'
                          }`}
                          onClick={() => setSelectedLocationId(loc.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium leading-tight line-clamp-1 flex items-center gap-2">
                                <span>{loc.name}</span>
                                {loc.type && <Badge variant="outline" className="text-[10px] px-1 py-0">{loc.type}</Badge>}
                              </div>
                              {loc.description && <div className="text-xs text-muted-foreground line-clamp-1 mt-1">{loc.description}</div>}
                            </div>
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => loadLocationIntoForm(loc)} title="Edit">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteLocation(loc.id)} title="Delete" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Detected Locations */}
            <Card className="cinema-card">
              <CardHeader className="pb-4 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <ListFilter className="h-4 w-4 flex-shrink-0" />
                    Detected Locations
                  </CardTitle>
                  <Input
                    placeholder="Filter locations..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="h-8 bg-input border-border w-full sm:w-48 text-xs sm:text-sm"
                  />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                  {detectedLocations.length} unique location{detectedLocations.length === 1 ? "" : "s"} detected
                  {treatmentId ? " (Treatment + Screenplay)" : " (Screenplay)"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-6">
                {detectedLocations.length === 0 ? (
                  <div className="text-xs sm:text-sm text-muted-foreground">No locations found in scenes.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detectedLocations.map((l) => {
                      const alreadyExists = locations.some(
                        (loc) => loc.name.toLowerCase() === l.name.toLowerCase(),
                      )
                      return (
                        <div key={l.name} className="flex items-center justify-between p-2 border border-border rounded-md">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{l.count}</Badge>
                            <span className="truncate max-w-[8rem] sm:max-w-[10rem]">{l.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {alreadyExists ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                <Check className="h-3 w-3 mr-1" />
                                Added
                              </Badge>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => openCreateLocationDialog(l.name)} disabled={isCreatingLocation} title="Create Location">
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </>
        )}
      </main>

      {/* Create / Edit Location Dialog */}
      <Dialog
        open={isCreateLocationDialogOpen}
        onOpenChange={(open) => {
          setIsCreateLocationDialogOpen(open)
          if (!open) clearForm()
        }}
      >
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">
              {editingLocationInFormId ? "Edit Location" : "Create Location"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editingLocationInFormId
                ? "Update this location's profile for the project."
                : "Add a new location profile with optional production details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="loc-name">Name *</Label>
                <Input id="loc-name" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} className="bg-input border-border" placeholder="e.g., Main Street Coffee Shop" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-type">Type</Label>
                <Select value={newLocType} onValueChange={(value: any) => setNewLocType(value)}>
                  <SelectTrigger id="loc-type" className="bg-input border-border">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interior">Interior</SelectItem>
                    <SelectItem value="exterior">Exterior</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Label htmlFor="loc-description" className="text-xs sm:text-sm">Description</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => enhanceField(newLocDescription, setNewLocDescription)}
                    disabled={isEnhancingText || !newLocDescription.trim()}
                    className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
                  >
                    {isEnhancingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {isEnhancingText ? "Enhancing..." : "Enhance Text"}
                  </Button>
                </div>
                <Textarea id="loc-description" value={newLocDescription} onChange={(e) => setNewLocDescription(e.target.value)} className="bg-input border-border min-h-[70px] text-xs sm:text-sm" placeholder="Brief overview of the location..." />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs sm:text-sm font-medium">Address</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="loc-address">Street Address</Label>
                  <Input id="loc-address" value={newLocAddress} onChange={(e) => setNewLocAddress(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-city">City</Label>
                  <Input id="loc-city" value={newLocCity} onChange={(e) => setNewLocCity(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-state">State/Province</Label>
                  <Input id="loc-state" value={newLocState} onChange={(e) => setNewLocState(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-country">Country</Label>
                  <Input id="loc-country" value={newLocCountry} onChange={(e) => setNewLocCountry(e.target.value)} className="bg-input border-border" />
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="loc-time-of-day">Time of Day (comma-separated)</Label>
                <Input id="loc-time-of-day" value={newLocTimeOfDay} onChange={(e) => setNewLocTimeOfDay(e.target.value)} className="bg-input border-border" placeholder="day, night, dawn, dusk" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-atmosphere">Atmosphere</Label>
                <Input id="loc-atmosphere" value={newLocAtmosphere} onChange={(e) => setNewLocAtmosphere(e.target.value)} className="bg-input border-border" placeholder="cozy, industrial, mysterious" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-mood">Mood</Label>
                <Input id="loc-mood" value={newLocMood} onChange={(e) => setNewLocMood(e.target.value)} className="bg-input border-border" placeholder="tense, peaceful, chaotic" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="loc-visual">Visual Description</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => enhanceField(newLocVisualDescription, setNewLocVisualDescription)}
                  disabled={isEnhancingText || !newLocVisualDescription.trim()}
                  className="flex items-center gap-2"
                >
                  {isEnhancingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {isEnhancingText ? "Enhancing..." : "Enhance Text"}
                </Button>
              </div>
              <Textarea id="loc-visual" value={newLocVisualDescription} onChange={(e) => setNewLocVisualDescription(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Detailed visual description of the location..." />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="loc-lighting">Lighting Notes</Label>
                <Textarea id="loc-lighting" value={newLocLightingNotes} onChange={(e) => setNewLocLightingNotes(e.target.value)} className="bg-input border-border min-h-[60px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-sound">Sound Notes</Label>
                <Textarea id="loc-sound" value={newLocSoundNotes} onChange={(e) => setNewLocSoundNotes(e.target.value)} className="bg-input border-border min-h-[60px]" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="loc-features">Key Features (comma-separated)</Label>
                <Input id="loc-features" value={newLocKeyFeatures} onChange={(e) => setNewLocKeyFeatures(e.target.value)} className="bg-input border-border" placeholder="large windows, exposed brick, vintage furniture" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-props">Props (comma-separated)</Label>
                <Input id="loc-props" value={newLocProps} onChange={(e) => setNewLocProps(e.target.value)} className="bg-input border-border" placeholder="coffee cups, newspapers, plants" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="loc-restrictions">Restrictions</Label>
                <Textarea id="loc-restrictions" value={newLocRestrictions} onChange={(e) => setNewLocRestrictions(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Time restrictions, noise limits, etc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-access">Access Notes</Label>
                <Textarea id="loc-access" value={newLocAccessNotes} onChange={(e) => setNewLocAccessNotes(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Parking, entry points, permissions needed" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-shooting">Shooting Notes</Label>
              <Textarea id="loc-shooting" value={newLocShootingNotes} onChange={(e) => setNewLocShootingNotes(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Camera angles, challenges, opportunities" />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                clearForm()
                setIsCreateLocationDialogOpen(false)
              }}
              disabled={isCreatingLocation}
            >
              Cancel
            </Button>
            <Button onClick={() => createLocation()} disabled={isCreatingLocation || !newLocName.trim()} className="gap-2">
              {isCreatingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : editingLocationInFormId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingLocationInFormId ? "Update Location" : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Image Dialog */}
      <Dialog open={isGenerateImageDialogOpen} onOpenChange={setIsGenerateImageDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
          <DialogHeader className="pb-4 sm:pb-6">
            <DialogTitle className="text-lg sm:text-xl">Generate Location Image</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              Create an AI-generated image for {selectedLocationId ? locations.find(l => l.id === selectedLocationId)?.name || 'this location' : 'the selected location'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="image-prompt">Image Prompt</Label>
              <Textarea
                id="image-prompt"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="e.g., cinematic exterior of a coffee shop, warm lighting, urban setting"
                className="bg-input border-border min-h-[100px]"
              />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-details"
                  checked={includeLocationDetails}
                  onCheckedChange={(checked) => setIncludeLocationDetails(checked === true)}
                />
                <Label
                  htmlFor="include-details"
                  className="text-sm font-normal cursor-pointer"
                >
                  Include location details (type, atmosphere, mood, etc.)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {includeLocationDetails 
                  ? "Location details will be automatically added to your prompt."
                  : "Only your prompt will be used for image generation."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>AI Model</Label>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                {getLockedImageConfig()
                  ? getLockedImageModelLabel()
                  : "Lock an image model in AI Settings to generate images."}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsGenerateImageDialogOpen(false)
                setImagePrompt("")
                setIncludeLocationDetails(true) // Reset to default
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateLocationImage}
              disabled={isGeneratingImage || !imagePrompt.trim() || !selectedLocationId}
              className="gap-2"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Image
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Custom Angle Dialog */}
      <Dialog open={isCreateAngleDialogOpen} onOpenChange={setIsCreateAngleDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">Generate Custom Angle</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Describe a new camera angle from your reference image using {getLockedImageModelLabel()}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-angle-label">Shot name</Label>
              <Input
                id="new-angle-label"
                value={newAngleLabel}
                onChange={(e) => setNewAngleLabel(e.target.value)}
                placeholder="e.g., Close up, Drone right, Sign detail"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-angle-directive">Describe the shot</Label>
              <Textarea
                id="new-angle-directive"
                value={newAngleDirective}
                onChange={(e) => setNewAngleDirective(e.target.value)}
                placeholder="e.g., close up of the robot on the right, same lighting and world as the reference"
                className="bg-input border-border min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsCreateAngleDialogOpen(false)}
              disabled={isGeneratingShot}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateCustomAngle}
              disabled={isGeneratingShot || !newAngleLabel.trim() || !newAngleDirective.trim()}
              className="gap-2"
            >
              {isGeneratingShot ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Video Dialog */}
      <Dialog open={isGenerateVideoDialogOpen} onOpenChange={setIsGenerateVideoDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">Generate Video from Image</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Animates the selected carousel image into a short clip using Runway ML ({getLockedVideoApiModel()}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(imageAssetsForLocation[currentImageIndex] || imageAssetsForLocation[0])?.content_url && (
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Source image</Label>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={
                      (imageAssetsForLocation[currentImageIndex] || imageAssetsForLocation[0])
                        .content_url!
                    }
                    alt="Video source"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="video-motion-prompt">Describe the motion</Label>
              <Textarea
                id="video-motion-prompt"
                value={videoMotionPrompt}
                onChange={(e) => setVideoMotionPrompt(e.target.value)}
                placeholder="e.g., slow push-in on the street, rain falling, neon lights flickering, subtle camera drift"
                className="bg-input border-border min-h-[90px]"
                disabled={isGeneratingVideo}
              />
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={String(videoDuration)}
                onValueChange={(v) => setVideoDuration(parseInt(v, 10) as 5 | 10)}
                disabled={isGeneratingVideo}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isGeneratingVideo && videoGenerationProgress && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {videoGenerationProgress}
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsGenerateVideoDialogOpen(false)}
              disabled={isGeneratingVideo}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateLocationVideo}
              disabled={isGeneratingVideo || !videoMotionPrompt.trim()}
              className="gap-2"
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  Generate Video
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transition Video (2 frames) Dialog */}
      <Dialog open={isTransitionVideoDialogOpen} onOpenChange={setIsTransitionVideoDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">Transition Video (2 Frames)</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Pick a start and end image — from this location, other locations, or characters — and generate a motion clip between them using Kling or Leonardo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={transitionVideoModel}
                onValueChange={(v) => {
                  const model = v as LocationTransitionVideoModel
                  setTransitionVideoModel(model)
                  setTransitionVideoDuration(getDefaultTransitionDuration(model))
                }}
                disabled={isGeneratingTransitionVideo}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kling_i2v_extended">Kling I2V Extended</SelectItem>
                  <SelectItem value="leonardo_kling_2_1">Leonardo · Kling 2.1 Pro</SelectItem>
                  <SelectItem value="leonardo_veo_3_1">Leonardo · Veo 3.1</SelectItem>
                  <SelectItem value="leonardo_veo_3_1_fast">Leonardo · Veo 3.1 Fast</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={String(transitionVideoDuration)}
                onValueChange={(v) => setTransitionVideoDuration(parseInt(v, 10))}
                disabled={isGeneratingTransitionVideo}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTransitionDurationOptions(transitionVideoModel).map((seconds) => (
                    <SelectItem key={seconds} value={String(seconds)}>
                      {seconds} seconds
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start frame</Label>
              {renderTransitionFramePicker("start", transitionStartAssetId, setTransitionStartAssetId)}
            </div>

            <div className="space-y-2">
              <Label>End frame</Label>
              {thisLocationFrameAssets.length >= 2 ? (
                <p className="text-[11px] text-muted-foreground">
                  Pick another shot from this location above, or choose from characters and project assets below.
                </p>
              ) : thisLocationFrameAssets.length === 1 ? (
                <p className="text-[11px] text-muted-foreground">
                  Generate more angles for this location, or pick an end frame from project assets below.
                </p>
              ) : null}
              {renderTransitionFramePicker("end", transitionEndAssetId, setTransitionEndAssetId)}
            </div>

            {(transitionStartAssetId || transitionEndAssetId) && (
              <div className="grid grid-cols-2 gap-3">
                {transitionStartAssetId && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Start</p>
                    <div className="aspect-video rounded-lg overflow-hidden border border-emerald-500/40 bg-muted/30">
                      <img
                        src={framePickerAssets.find((a) => a.id === transitionStartAssetId)?.content_url || ""}
                        alt="Start frame"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                {transitionEndAssetId && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">End</p>
                    <div className="aspect-video rounded-lg overflow-hidden border border-sky-500/40 bg-muted/30">
                      <img
                        src={framePickerAssets.find((a) => a.id === transitionEndAssetId)?.content_url || ""}
                        alt="End frame"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="transition-motion-prompt">Describe the transition</Label>
              <Textarea
                id="transition-motion-prompt"
                value={transitionVideoPrompt}
                onChange={(e) => setTransitionVideoPrompt(e.target.value)}
                placeholder="e.g., smooth dolly from the wide street into a close-up of the character, maintain lighting and atmosphere"
                className="bg-input border-border min-h-[90px]"
                disabled={isGeneratingTransitionVideo}
              />
            </div>

            {isGeneratingTransitionVideo && transitionVideoProgress && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {transitionVideoProgress}
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsTransitionVideoDialogOpen(false)}
              disabled={isGeneratingTransitionVideo}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateTransitionVideo}
              disabled={
                isGeneratingTransitionVideo ||
                !transitionVideoPrompt.trim() ||
                !transitionStartAssetId ||
                !transitionEndAssetId
              }
              className="gap-2"
            >
              {isGeneratingTransitionVideo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4" />
                  Generate Transition
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Shots Dialog */}
      <Dialog open={isGenerateShotsDialogOpen} onOpenChange={setIsGenerateShotsDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">Generate Shots from Reference</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Picks a shot type and sends your reference image with a simple prompt like &quot;Give me a wide shot of this image&quot; using {getLockedImageModelLabel()}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {referenceAssetForShots?.content_url && (
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Reference Image</Label>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={referenceAssetForShots.content_url}
                    alt={referenceAssetForShots.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                {imageAssetsForLocation.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {imageAssetsForLocation.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setReferenceAssetForShots(asset)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          referenceAssetForShots.id === asset.id
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <img src={asset.content_url!} alt={asset.title} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="shot-preset">Camera Angle / Shot Type</Label>
              <Select value={selectedShotPreset} onValueChange={setSelectedShotPreset}>
                <SelectTrigger id="shot-preset" className="bg-input border-border">
                  <SelectValue placeholder="Choose a shot type" />
                </SelectTrigger>
                <SelectContent>
                  {customShotAngles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Your custom angles</SelectLabel>
                      {customShotAngles.map((angle) => (
                        <SelectItem key={angle.id} value={angle.label}>
                          {angle.label}
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>Standard angles</SelectLabel>
                    {LOCATION_SHOT_PRESETS.map((shot) => (
                      <SelectItem key={shot} value={shot}>
                        {shot}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shot-custom-prompt">Extra Direction (optional)</Label>
              <Textarea
                id="shot-custom-prompt"
                value={shotCustomPrompt}
                onChange={(e) => setShotCustomPrompt(e.target.value)}
                placeholder="e.g., push in toward the skyline, more drones in foreground, golden hour glow"
                className="bg-input border-border min-h-[70px]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-location-shot-details"
                checked={includeLocationDetailsInShot}
                onCheckedChange={(checked) => setIncludeLocationDetailsInShot(checked === true)}
              />
              <Label htmlFor="include-location-shot-details" className="text-sm font-normal cursor-pointer">
                Include location description in prompt
              </Label>
            </div>

            {shotGenerationProgress && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {shotGenerationProgress}
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsGenerateShotsDialogOpen(false)}
              disabled={isGeneratingShot}
            >
              Close
            </Button>
            <Button
              onClick={handleGenerateSingleShot}
              disabled={isGeneratingShot || !referenceAssetForShots}
              className="gap-2"
            >
              {isGeneratingShot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Shot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Full Image Dialog */}
      <Dialog open={viewImageDialogOpen} onOpenChange={setViewImageDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{(viewingImage?.title || 'Location Image').replace(/ - AI Generated Image.*$/, '')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {viewingImage?.content_url && (
              <div className="relative w-full rounded-lg overflow-hidden border border-border bg-muted/30">
                <img
                  src={viewingImage.content_url}
                  alt={viewingImage.title}
                  className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                />
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (viewingImage) {
                  void openLinkToProduction(viewingImage, "image")
                }
              }}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Link to Shot
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewingImage) {
                  openGenerateShotsDialog(viewingImage)
                }
              }}
            >
              <Camera className="h-4 w-4 mr-2" />
              Generate New Angle
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewingImage) {
                  handleSetThumbnail(viewingImage)
                }
              }}
            >
              <Star className="h-4 w-4 mr-2" />
              Set as Thumbnail
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewingImage?.content_url) {
                  window.open(viewingImage.content_url, '_blank')
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
            <Button
              variant="outline"
              onClick={() => setViewImageDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Video Dialog */}
      <Dialog open={viewVideoDialogOpen} onOpenChange={setViewVideoDialogOpen}>
        <DialogContent className="cinema-card border-border max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>
              {(viewingVideo?.title || "Location Video").replace(/ - Video \(.*\)$/, "")}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {viewingVideo?.content_url && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-black">
                <video
                  key={viewingVideo.content_url}
                  src={viewingVideo.content_url}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            {viewingVideo?.prompt && (
              <p className="text-xs text-muted-foreground mt-3 whitespace-pre-wrap">
                {viewingVideo.prompt}
              </p>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (viewingVideo) {
                  void openLinkToProduction(viewingVideo, "video")
                }
              }}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Link to Shot
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewingVideo) {
                  void handleDownloadLocationVideo(viewingVideo)
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewingVideo?.content_url) {
                  window.open(viewingVideo.content_url, "_blank")
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
            <Button variant="outline" onClick={() => setViewVideoDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Production Shot */}
      <Dialog
        open={isLinkProductionDialogOpen}
        onOpenChange={(open) => {
          setIsLinkProductionDialogOpen(open)
          if (!open) {
            setLinkProductionAsset(null)
            setLinkSceneId("")
            setLinkStoryboardId("")
            setLinkStoryboards([])
          }
        }}
      >
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">Link to Production Shot</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {linkProductionMediaType === "video"
                ? "Insert this video into a storyboard shot on Cinema Production. It will appear in that shot's video list."
                : "Set this image as the storyboard shot image on Cinema Production. It will be used for that shot's reference and generation."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {linkProductionAsset?.content_url && (
              <div className="flex gap-3 items-center rounded-lg border border-border bg-muted/20 p-2">
                <div className="relative w-20 aspect-video rounded overflow-hidden flex-shrink-0 bg-black">
                  {linkProductionMediaType === "video" ? (
                    <video
                      src={linkProductionAsset.content_url}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={linkProductionAsset.content_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <p className="text-sm font-medium truncate">
                  {linkProductionAsset.title.replace(/ - (Video|AI Generated Image).*(\(.*\))?$/, "")}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Scene</Label>
              {isLoadingLinkScenes ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading scenes…
                </div>
              ) : linkScenes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No timeline scenes found for this project. Add scenes on the Timeline first.
                </p>
              ) : (
                <Select value={linkSceneId || undefined} onValueChange={setLinkSceneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a scene" />
                  </SelectTrigger>
                  <SelectContent>
                    {linkScenes.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        {scene.name || `Scene ${scene.metadata?.sceneNumber || scene.order_index || "?"}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {linkSceneId && (
              <div className="space-y-2">
                <Label>Shot</Label>
                {isLoadingLinkStoryboards ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading shots…
                  </div>
                ) : linkStoryboards.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No storyboard shots in this scene yet.{" "}
                    <Link
                      href={`/storyboards/${linkSceneId}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Create shots in Storyboards
                    </Link>
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-2 rounded-lg border border-border p-2">
                    {linkStoryboards.map((board) => (
                      <button
                        key={board.id}
                        type="button"
                        onClick={() => setLinkStoryboardId(board.id)}
                        className={`w-full flex items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                          linkStoryboardId === board.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="w-14 aspect-video rounded overflow-hidden flex-shrink-0 bg-muted">
                          {board.image_url ? (
                            <img
                              src={board.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            Shot {board.shot_number}
                            {board.title ? ` · ${board.title}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[board.shot_type, board.camera_angle, board.movement]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {linkProductionMediaType === "video" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="link-video-default"
                  checked={linkVideoAsDefault}
                  onCheckedChange={(checked) => setLinkVideoAsDefault(checked === true)}
                />
                <Label htmlFor="link-video-default" className="text-sm font-normal cursor-pointer">
                  Set as the default video for this shot
                </Label>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
            <Button variant="ghost" asChild className="sm:mr-auto">
              <Link href={projectId ? `/cinema-production?project=${projectId}` : "/cinema-production"}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Production
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsLinkProductionDialogOpen(false)}
                disabled={isLinkingToProduction}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleLinkToProductionShot()}
                disabled={
                  isLinkingToProduction ||
                  !linkStoryboardId ||
                  !linkProductionAsset?.content_url
                }
                className="gap-2"
              >
                {isLinkingToProduction ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Linking…
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Link to Shot
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

