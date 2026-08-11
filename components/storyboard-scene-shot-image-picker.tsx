"use client"

import { useCallback, useEffect, useState } from "react"
import { Film, ImageIcon, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { displayShotNumber } from "@/lib/shot-list-order"
import { StoryboardsService, type Storyboard } from "@/lib/storyboards-service"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"
import type { StoryboardImage } from "@/components/storyboard-shot-images"

export type SelectedSceneShotImage = {
  imageUrl: string
  label: string
  sourceStoryboardId: string
}

type StoryboardSceneShotImagePickerProps = {
  projectId: string
  scenes?: SceneWithMetadata[]
  currentSceneId?: string
  currentSceneStoryboards?: Storyboard[]
  excludeStoryboardId?: string
  selected: SelectedSceneShotImage | null
  onSelect: (selected: SelectedSceneShotImage | null) => void
  userId?: string | null
  disabled?: boolean
}

function sceneLabel(scene: SceneWithMetadata): string {
  const raw = scene.metadata?.sceneNumber
  const sceneNumber =
    raw == null
      ? scene.order_index ?? 1
      : typeof raw === "string"
        ? parseInt(raw, 10) || scene.order_index || 1
        : raw
  const name = scene.name?.trim() || scene.metadata?.title?.trim() || `Scene ${sceneNumber}`
  return `Scene ${sceneNumber} · ${name}`
}

function shotLabel(storyboard: Storyboard): string {
  const shot = displayShotNumber(storyboard)
  return storyboard.title?.trim()
    ? `Shot ${shot} · ${storyboard.title}`
    : `Shot ${shot}`
}

export function StoryboardSceneShotImagePicker({
  projectId,
  scenes: scenesProp,
  currentSceneId,
  currentSceneStoryboards,
  excludeStoryboardId,
  selected,
  onSelect,
  userId,
  disabled = false,
}: StoryboardSceneShotImagePickerProps) {
  const { toast } = useToast()
  const [scenes, setScenes] = useState<SceneWithMetadata[] | null>(scenesProp ?? null)
  const [loadingScenes, setLoadingScenes] = useState(false)
  const [selectedSceneId, setSelectedSceneId] = useState(currentSceneId || "")
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [loadingStoryboards, setLoadingStoryboards] = useState(false)
  const [activeShotId, setActiveShotId] = useState<string | null>(null)
  const [shotGallery, setShotGallery] = useState<StoryboardImage[]>([])
  const [loadingGallery, setLoadingGallery] = useState(false)

  useEffect(() => {
    if (scenesProp) setScenes(scenesProp)
  }, [scenesProp])

  const loadScenes = useCallback(async () => {
    if (!projectId || scenes !== null || loadingScenes) return
    setLoadingScenes(true)
    try {
      const loaded = await TimelineService.getMovieScenes(projectId, { skipThumbnails: true })
      setScenes(loaded)
    } catch (error) {
      console.error("Failed to load scenes for shot image picker:", error)
      toast({
        title: "Could not load scenes",
        description: "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setLoadingScenes(false)
    }
  }, [projectId, scenes, loadingScenes, toast])

  const loadStoryboardsForScene = useCallback(
    async (sceneId: string) => {
      if (!sceneId) {
        setStoryboards([])
        return
      }

        setLoadingStoryboards(true)
      try {
        let rows: Storyboard[]
        if (sceneId === currentSceneId && currentSceneStoryboards) {
          rows = currentSceneStoryboards
        } else {
          rows = await StoryboardsService.getStoryboardsByScene(sceneId)
        }
        setStoryboards(
          rows.filter((row) => row.image_url && row.id !== excludeStoryboardId),
        )
      } catch (error) {
        console.error("Failed to load storyboards for shot image picker:", error)
        toast({
          title: "Could not load shots",
          description: "Try another scene or try again.",
          variant: "destructive",
        })
        setStoryboards([])
      } finally {
        setLoadingStoryboards(false)
      }
    },
    [currentSceneId, currentSceneStoryboards, excludeStoryboardId, toast],
  )

  useEffect(() => {
    if (selectedSceneId) {
      void loadStoryboardsForScene(selectedSceneId)
    }
  }, [selectedSceneId, loadStoryboardsForScene])

  useEffect(() => {
    if (currentSceneId && !selectedSceneId) {
      setSelectedSceneId(currentSceneId)
    }
  }, [currentSceneId, selectedSceneId])

  const loadGalleryForShot = useCallback(
    async (storyboardId: string) => {
      setLoadingGallery(true)
      try {
        const query = new URLSearchParams({ storyboardId })
        if (userId) query.set("userId", userId)
        const response = await fetch(`/api/storyboard-images?${query.toString()}`)
        const result = await response.json()
        if (response.ok && result.success) {
          setShotGallery((result.data || []) as StoryboardImage[])
        } else {
          setShotGallery([])
        }
      } catch {
        setShotGallery([])
      } finally {
        setLoadingGallery(false)
      }
    },
    [userId],
  )

  const handleSceneChange = (sceneId: string) => {
    setSelectedSceneId(sceneId)
    setActiveShotId(null)
    setShotGallery([])
    onSelect(null)
  }

  const handleShotClick = (storyboard: Storyboard) => {
    if (!storyboard.image_url) return
    setActiveShotId(storyboard.id)
    onSelect({
      imageUrl: storyboard.image_url,
      label: shotLabel(storyboard),
      sourceStoryboardId: storyboard.id,
    })
    void loadGalleryForShot(storyboard.id)
  }

  const handleGalleryImageClick = (image: StoryboardImage, storyboard: Storyboard) => {
    onSelect({
      imageUrl: image.image_url,
      label: image.image_name?.trim() || shotLabel(storyboard),
      sourceStoryboardId: storyboard.id,
    })
  }

  const activeShot = storyboards.find((row) => row.id === activeShotId) || null

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Film className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">Scene</Label>
        </div>
        <Select
          value={selectedSceneId || undefined}
          onValueChange={handleSceneChange}
          disabled={disabled || !projectId}
          onOpenChange={(open) => {
            if (open) void loadScenes()
          }}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={loadingScenes ? "Loading scenes…" : "Select scene…"} />
          </SelectTrigger>
          <SelectContent>
            {loadingScenes ? (
              <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading scenes…
              </div>
            ) : scenes?.length ? (
              scenes.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  {sceneLabel(scene)}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-3 text-xs text-muted-foreground">No scenes in this project.</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {!selectedSceneId ? (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 py-4 justify-center">
          <ImageIcon className="h-4 w-4" />
          Choose a scene to browse shot images.
        </p>
      ) : loadingStoryboards ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading shots…
        </div>
      ) : storyboards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No shots with images in this scene.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Shots with images
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[36vh] overflow-y-auto pr-1">
            {storyboards.map((storyboard) => {
              const isActive = activeShotId === storyboard.id
              const isSelected =
                selected?.sourceStoryboardId === storyboard.id &&
                selected.imageUrl === storyboard.image_url
              return (
                <button
                  key={storyboard.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleShotClick(storyboard)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all text-left ${
                    isActive || isSelected
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/50"
                  }`}
                  title={shotLabel(storyboard)}
                >
                  <img
                    src={storyboard.image_url!}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1 py-0.5 text-[10px] text-white truncate">
                    {shotLabel(storyboard)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activeShot ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Images on {shotLabel(activeShot)}
          </p>
          {loadingGallery ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading gallery…
            </div>
          ) : shotGallery.length > 1 ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {shotGallery.map((image) => {
                const isSelected = selected?.imageUrl === image.image_url
                return (
                  <button
                    key={image.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleGalleryImageClick(image, activeShot)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50"
                    }`}
                    title={image.image_name || "Shot image"}
                  >
                    <img
                      src={image.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {image.is_default ? (
                      <span className="absolute top-1 left-1 rounded bg-primary/90 px-1 py-0.5 text-[9px] text-primary-foreground">
                        Default
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This shot has one image — it will be linked when you confirm.
            </p>
          )}
        </div>
      ) : null}

      {selected ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 flex gap-3 items-center">
          <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
            <img src={selected.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-3">{selected.label}</p>
        </div>
      ) : null}
    </div>
  )
}
