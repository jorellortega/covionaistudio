"use client"

import { useCallback, useState } from "react"
import { Film, ImageIcon, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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

export type StoryboardShotReference = {
  storyboardId: string
  imageUrl: string
  label: string
}

type StoryboardShotReferencePickerProps = {
  projectId: string
  excludeStoryboardId?: string
  selectedRefs: StoryboardShotReference[]
  onSelectedRefsChange: (refs: StoryboardShotReference[]) => void
  maxTotalReferences: number
  otherLinkedCount: number
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

function shotReferenceLabel(storyboard: Storyboard): string {
  const shot = displayShotNumber(storyboard)
  return storyboard.title?.trim()
    ? `Shot ${shot} · ${storyboard.title}`
    : `Shot ${shot}`
}

export function StoryboardShotReferencePicker({
  projectId,
  excludeStoryboardId,
  selectedRefs,
  onSelectedRefsChange,
  maxTotalReferences,
  otherLinkedCount,
  disabled = false,
}: StoryboardShotReferencePickerProps) {
  const { toast } = useToast()
  const [scenes, setScenes] = useState<SceneWithMetadata[] | null>(null)
  const [loadingScenes, setLoadingScenes] = useState(false)
  const [selectedSceneId, setSelectedSceneId] = useState("")
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [loadingStoryboards, setLoadingStoryboards] = useState(false)
  const [pendingShotId, setPendingShotId] = useState("")

  const remainingSlots = Math.max(0, maxTotalReferences - otherLinkedCount - selectedRefs.length)

  const loadScenes = useCallback(async () => {
    if (!projectId || scenes !== null || loadingScenes) return
    setLoadingScenes(true)
    try {
      const loaded = await TimelineService.getMovieScenes(projectId, { skipThumbnails: true })
      setScenes(loaded)
    } catch (error) {
      console.error("Failed to load scenes for storyboard references:", error)
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
        const rows = await StoryboardsService.getStoryboardsByScene(sceneId)
        setStoryboards(
          rows.filter(
            (row) =>
              row.image_url &&
              row.id !== excludeStoryboardId &&
              !selectedRefs.some((ref) => ref.storyboardId === row.id),
          ),
        )
      } catch (error) {
        console.error("Failed to load storyboards for reference picker:", error)
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
    [excludeStoryboardId, selectedRefs, toast],
  )

  const handleSceneChange = (sceneId: string) => {
    setSelectedSceneId(sceneId)
    setPendingShotId("")
    void loadStoryboardsForScene(sceneId)
  }

  const addShotReference = (storyboardId: string) => {
    const storyboard = storyboards.find((row) => row.id === storyboardId)
    if (!storyboard?.image_url) return
    if (selectedRefs.some((ref) => ref.storyboardId === storyboardId)) return
    if (otherLinkedCount + selectedRefs.length >= maxTotalReferences) {
      toast({
        title: "Maximum references reached",
        description: `You can link up to ${maxTotalReferences} images total.`,
        variant: "destructive",
      })
      return
    }
    onSelectedRefsChange([
      ...selectedRefs,
      {
        storyboardId: storyboard.id,
        imageUrl: storyboard.image_url,
        label: shotReferenceLabel(storyboard),
      },
    ])
    setPendingShotId("")
    setStoryboards((prev) => prev.filter((row) => row.id !== storyboardId))
  }

  const removeShotReference = (storyboardId: string) => {
    onSelectedRefsChange(selectedRefs.filter((ref) => ref.storyboardId !== storyboardId))
    if (selectedSceneId) {
      void loadStoryboardsForScene(selectedSceneId)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Film className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs text-muted-foreground">Storyboard shot reference (optional)</Label>
      </div>
      <p className="text-xs text-muted-foreground break-words">
        Pick another scene, then choose a shot thumbnail as a style reference — nothing loads until you
        open the scene list.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Scene</Label>
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

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Shot</Label>
          <Select
            value={pendingShotId || undefined}
            onValueChange={(value) => {
              setPendingShotId(value)
              addShotReference(value)
            }}
            disabled={disabled || !selectedSceneId || loadingStoryboards || remainingSlots === 0}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue
                placeholder={
                  !selectedSceneId
                    ? "Choose a scene first"
                    : loadingStoryboards
                      ? "Loading shots…"
                      : remainingSlots === 0
                        ? "Reference limit reached"
                        : "Select shot…"
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {loadingStoryboards ? (
                <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading shots…
                </div>
              ) : storyboards.length > 0 ? (
                storyboards.map((storyboard) => (
                  <SelectItem key={storyboard.id} value={storyboard.id} className="py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-10 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted">
                        <img
                          src={storyboard.image_url!}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <span className="truncate text-xs">{shotReferenceLabel(storyboard)}</span>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  {selectedSceneId
                    ? "No other shots with images in this scene."
                    : "Choose a scene to browse shots."}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedRefs.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Selected storyboard references
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedRefs.map((ref) => (
              <div
                key={ref.storyboardId}
                className="relative flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/5 p-1.5 pr-2"
              >
                <div className="h-10 w-14 shrink-0 overflow-hidden rounded border border-border">
                  <img src={ref.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <span className="max-w-[140px] truncate text-[11px] text-violet-300">{ref.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  disabled={disabled}
                  onClick={() => removeShotReference(ref.storyboardId)}
                  title="Remove storyboard reference"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-violet-400">
            {selectedRefs.length + otherLinkedCount} of {maxTotalReferences} reference slots used
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          {remainingSlots} reference slot{remainingSlots === 1 ? "" : "s"} available
        </p>
      )}
    </div>
  )
}
