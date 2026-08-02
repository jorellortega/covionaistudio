"use client"

import { useCallback, useState } from "react"
import { Film, Grid3x3, Loader2, Upload, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import {
  getStoryboardLayoutReference,
  type StoryboardLayoutReference,
} from "@/lib/storyboard-layout-reference"
import { getSupabaseClient } from "@/lib/supabase"

type StoryboardLayoutReferenceControlProps = {
  storyboard: Storyboard
  projectId: string
  disabled?: boolean
  onLayoutChange: (storyboardId: string, layout: StoryboardLayoutReference | null) => void | Promise<void>
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

export function StoryboardLayoutReferenceControl({
  storyboard,
  projectId,
  disabled = false,
  onLayoutChange,
}: StoryboardLayoutReferenceControlProps) {
  const { toast } = useToast()
  const layout = getStoryboardLayoutReference(storyboard)
  const [isUploading, setIsUploading] = useState(false)
  const [scenes, setScenes] = useState<SceneWithMetadata[] | null>(null)
  const [loadingScenes, setLoadingScenes] = useState(false)
  const [selectedSceneId, setSelectedSceneId] = useState("")
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [loadingStoryboards, setLoadingStoryboards] = useState(false)

  const loadScenes = useCallback(async () => {
    if (!projectId || scenes !== null || loadingScenes) return
    setLoadingScenes(true)
    try {
      const loaded = await TimelineService.getMovieScenes(projectId, { skipThumbnails: true })
      setScenes(loaded)
    } catch {
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
          rows.filter((row) => row.image_url && row.id !== storyboard.id),
        )
      } catch {
        toast({
          title: "Could not load shots",
          variant: "destructive",
        })
        setStoryboards([])
      } finally {
        setLoadingStoryboards(false)
      }
    },
    [storyboard.id, toast],
  )

  const applyLayout = async (next: StoryboardLayoutReference | null) => {
    try {
      await onLayoutChange(storyboard.id, next)
    } catch (error) {
      toast({
        title: "Could not save layout reference",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !projectId) return

    setIsUploading(true)
    try {
      const filePath = `${projectId}/storyboard-layout/${storyboard.id}/${Date.now()}_${file.name}`
      const { error } = await getSupabaseClient().storage
        .from("cinema_files")
        .upload(filePath, file)
      if (error) throw new Error(error.message)

      const {
        data: { publicUrl },
      } = getSupabaseClient().storage.from("cinema_files").getPublicUrl(filePath)

      await applyLayout({
        url: publicUrl,
        label: "Uploaded blocking image",
        sourceStoryboardId: null,
      })
      toast({
        title: "Layout reference set",
        description: "Quick generate will use this for blocking and placement.",
      })
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

  const handleShotPick = async (shotId: string) => {
    const picked = storyboards.find((row) => row.id === shotId)
    if (!picked?.image_url) return
    await applyLayout({
      url: picked.image_url,
      label: shotReferenceLabel(picked),
      sourceStoryboardId: picked.id,
    })
    toast({
      title: "Layout reference set",
      description: `Using ${shotReferenceLabel(picked)} for blocking.`,
    })
  }

  const handleUseCurrentShot = async () => {
    if (!storyboard.image_url) return
    if (
      layout.url &&
      layout.url !== storyboard.image_url &&
      !layout.label?.toLowerCase().includes("this shot")
    ) {
      toast({
        title: "Replacing uploaded blocking",
        description:
          "This swaps your uploaded blocking image for this shot's current image (face-swap mode).",
      })
    }
    await applyLayout({
      url: storyboard.image_url,
      label: `This shot · ${shotReferenceLabel(storyboard)}`,
      sourceStoryboardId: storyboard.id,
    })
    toast({
      title: "Layout reference set",
      description: "Using this shot's image for blocking on regen (faces from character refs).",
    })
  }

  return (
    <Collapsible
      defaultOpen={false}
      className="rounded-md border border-cyan-500/25 bg-cyan-500/5"
    >
      <CollapsibleTrigger
        className="group flex w-full items-center gap-2 p-2.5 text-left hover:bg-cyan-500/10 transition-colors rounded-md data-[state=open]:rounded-b-none"
      >
        <Grid3x3 className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-cyan-800 dark:text-cyan-200">
            Layout / blocking reference
          </p>
          {layout.url ? (
            <p className="text-[10px] text-muted-foreground truncate">
              {layout.label ?? "Layout reference"} · active
            </p>
          ) : null}
        </div>
        {layout.url ? (
          <div className="h-8 w-10 shrink-0 overflow-hidden rounded border border-cyan-500/40 bg-muted">
            <img src={layout.url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="px-2.5 pb-2.5 space-y-2 border-t border-cyan-500/15">
        <p className="text-[11px] text-muted-foreground leading-snug pt-2">
          Pick <strong>one</strong> layout source below (uploaded sketch works best). Quick
          Generate uses it as <strong>image 1</strong> for blocking; character collages are
          images 2+ for faces. Do not upload blocking and then click &quot;Use this shot&quot; —
          that replaces your upload with the current shot image.
        </p>

      {layout.url ? (
        <div className="flex items-center gap-2">
          <div className="h-12 w-16 shrink-0 overflow-hidden rounded border border-cyan-500/40 bg-muted">
            <img src={layout.url} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{layout.label ?? "Layout reference"}</p>
            <p className="text-[10px] text-muted-foreground">Active for generation</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={disabled || isUploading}
            onClick={() => void applyLayout(null)}
            title="Remove layout reference"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          id={`layout-upload-${storyboard.id}`}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(e) => void handleUpload(e)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-cyan-500/30"
          disabled={disabled || isUploading}
          onClick={() => document.getElementById(`layout-upload-${storyboard.id}`)?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload blocking
        </Button>
        {storyboard.image_url ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={disabled || isUploading}
            onClick={() => void handleUseCurrentShot()}
          >
            Use this shot (face swap)
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Film className="h-3 w-3" />
            Scene
          </Label>
          <Select
            value={selectedSceneId || undefined}
            onValueChange={(sceneId) => {
              setSelectedSceneId(sceneId)
              void loadStoryboardsForScene(sceneId)
            }}
            disabled={disabled || isUploading}
            onOpenChange={(open) => {
              if (open) void loadScenes()
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={loadingScenes ? "Loading…" : "Pick scene…"} />
            </SelectTrigger>
            <SelectContent>
              {scenes?.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  {sceneLabel(scene)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Shot (blocking)</Label>
          <Select
            disabled={disabled || isUploading || !selectedSceneId || loadingStoryboards}
            onValueChange={(value) => void handleShotPick(value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue
                placeholder={
                  !selectedSceneId
                    ? "Choose scene first"
                    : loadingStoryboards
                      ? "Loading…"
                      : "Pick shot layout…"
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {storyboards.map((row) => (
                <SelectItem key={row.id} value={row.id} className="py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-11 shrink-0 overflow-hidden rounded border bg-muted">
                      <img
                        src={row.image_url!}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className="truncate text-xs">{shotReferenceLabel(row)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
