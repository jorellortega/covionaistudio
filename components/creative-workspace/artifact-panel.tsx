"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Image as ImageIcon,
  Trash2,
  Tag,
  Link2,
  Loader2,
  Pencil,
  Sparkles,
  X,
  User,
  MapPin,
  FileText,
  ExternalLink,
  FolderOpen,
  Clapperboard,
  Layers,
  ScrollText,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { CreativeArtifact, ArtifactType } from "@/lib/creative-workspace-types"
import { ProjectSelector } from "@/components/project-selector"
import { CharactersService, type Character } from "@/lib/characters-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { AssetService, type Asset } from "@/lib/asset-service"
import { ScreenplayScenesService, type ScreenplayScene } from "@/lib/screenplay-scenes-service"
import { extractTreatmentActLabels } from "@/lib/creative-chat-utils"

const SCREENPLAY_PAGE_QUICK_OPTIONS = [3, 5, 7, 10, 15, 20] as const

export interface UpdateArtifactPayload {
  title?: string
  label?: string | null
  artifact_type?: ArtifactType
  project_id?: string | null
  character_id?: string | null
  location_id?: string | null
  create_character?: boolean
  create_location?: boolean
  set_as_primary_image?: boolean
  set_as_project_cover?: boolean
  sync_to_project?: boolean
}

interface ArtifactPanelProps {
  artifacts: CreativeArtifact[]
  workspaceId?: string | null
  linkedProjectId?: string | null
  linkedProjectName?: string | null
  onUpdate: (id: string, data: UpdateArtifactPayload) => Promise<{ syncMessage?: string | null } | void>
  onDelete: (id: string) => Promise<void>
  onArtifactRenamed?: (artifact: CreativeArtifact) => void
  onArtifactsRefresh?: () => void
}

const ARTIFACT_TYPES: { value: ArtifactType; label: string }[] = [
  { value: "character", label: "Character" },
  { value: "location", label: "Location" },
  { value: "cover", label: "Cover" },
  { value: "treatment", label: "Treatment" },
  { value: "scene", label: "Scene" },
  { value: "document", label: "Document" },
  { value: "image", label: "Image" },
  { value: "other", label: "Other" },
]

const TYPE_COLORS: Record<ArtifactType, string> = {
  character: "bg-purple-500/20 text-purple-300",
  location: "bg-green-500/20 text-green-300",
  cover: "bg-blue-500/20 text-blue-300",
  treatment: "bg-amber-500/20 text-amber-300",
  treatment_act: "bg-orange-500/20 text-orange-300",
  scene: "bg-cyan-500/20 text-cyan-300",
  document: "bg-slate-500/20 text-slate-300",
  image: "bg-pink-500/20 text-pink-300",
  other: "bg-muted text-muted-foreground",
}

function isCharacterArtifact(artifact: CreativeArtifact): boolean {
  return (
    artifact.artifact_type === "character" ||
    typeof artifact.metadata?.character_id === "string" ||
    !!artifact.metadata?.avatar_image_id
  )
}

function isTreatmentArtifact(artifact: CreativeArtifact): boolean {
  return (
    artifact.artifact_type === "treatment" ||
    (typeof artifact.metadata?.treatment_id === "string" &&
      artifact.artifact_type !== "treatment_act")
  )
}

function isTreatmentActArtifact(artifact: CreativeArtifact): boolean {
  return (
    artifact.artifact_type === "treatment_act" ||
    typeof artifact.metadata?.treatment_act_id === "string"
  )
}

function isLocationArtifact(artifact: CreativeArtifact): boolean {
  return (
    artifact.artifact_type === "location" ||
    typeof artifact.metadata?.location_id === "string"
  )
}

function isSceneArtifact(artifact: CreativeArtifact): boolean {
  return (
    artifact.artifact_type === "scene" ||
    typeof artifact.metadata?.screenplay_scene_id === "string"
  )
}

function dedupeCharacterArtifacts(artifacts: CreativeArtifact[]): CreativeArtifact[] {
  const seenCharacterIds = new Map<string, CreativeArtifact>()
  const result: CreativeArtifact[] = []

  for (const artifact of artifacts) {
    const characterId =
      typeof artifact.metadata?.character_id === "string"
        ? artifact.metadata.character_id
        : null

    if (!characterId) {
      result.push(artifact)
      continue
    }

    const existing = seenCharacterIds.get(characterId)
    if (!existing) {
      seenCharacterIds.set(characterId, artifact)
      result.push(artifact)
      continue
    }

    const existingIsImage = !!existing.content?.startsWith("http")
    const currentIsImage = !!artifact.content?.startsWith("http")
    if (!existingIsImage && currentIsImage) {
      const idx = result.indexOf(existing)
      if (idx >= 0) result[idx] = artifact
      seenCharacterIds.set(characterId, artifact)
    }
  }

  return result
}

function isScreenplayGeneratedScene(scene: ScreenplayScene): boolean {
  return (
    scene.status === "screenplay" ||
    scene.metadata?.screenplay_generated === true
  )
}

function sortScreenplayScenes(scenes: ScreenplayScene[]): ScreenplayScene[] {
  return [...scenes].sort((a, b) => {
    const aOrder = a.order_index ?? 0
    const bOrder = b.order_index ?? 0
    if (aOrder !== bOrder) return aOrder - bOrder
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

function screenplaySceneFromArtifact(
  artifact: CreativeArtifact,
  projectId: string,
  screenplayScenes: ScreenplayScene[],
): ScreenplayScene | null {
  const screenplaySceneId =
    typeof artifact.metadata?.screenplay_scene_id === "string"
      ? artifact.metadata.screenplay_scene_id
      : null
  if (!screenplaySceneId) return null

  const existing = screenplayScenes.find((scene) => scene.id === screenplaySceneId)
  if (existing) return existing

  return {
    id: screenplaySceneId,
    project_id: projectId,
    user_id: "",
    name: artifact.title || "Scene",
    description: artifact.content || undefined,
    content: artifact.content || undefined,
    scene_number:
      typeof artifact.metadata?.scene_number === "string"
        ? artifact.metadata.scene_number
        : undefined,
    status: "draft",
    metadata: artifact.metadata ?? {},
    created_at: artifact.created_at,
    updated_at: artifact.updated_at,
  }
}

function partitionArtifacts(artifacts: CreativeArtifact[]) {
  const characterArtifacts = dedupeCharacterArtifacts(artifacts.filter(isCharacterArtifact))
  const locationArtifacts = artifacts.filter(isLocationArtifact)
  const sceneArtifacts = artifacts.filter(isSceneArtifact)
  const treatmentArtifacts = artifacts.filter(
    (a) => isTreatmentArtifact(a) && !isTreatmentActArtifact(a),
  )
  const treatmentActArtifacts = [...artifacts.filter(isTreatmentActArtifact)].sort((a, b) => {
    const actA = typeof a.metadata?.act_number === "number" ? a.metadata.act_number : 0
    const actB = typeof b.metadata?.act_number === "number" ? b.metadata.act_number : 0
    return actA - actB
  })
  const documentArtifacts = artifacts.filter(
    (a) =>
      a.artifact_type === "document" &&
      !isTreatmentArtifact(a) &&
      !isTreatmentActArtifact(a),
  )
  const screenplaySceneArtifacts = documentArtifacts.filter(
    (a) => a.metadata?.screenplay_generated === true,
  )
  const generalDocumentArtifacts = documentArtifacts.filter(
    (a) => a.metadata?.screenplay_generated !== true,
  )
  const textArtifacts = [...treatmentArtifacts, ...generalDocumentArtifacts]
  const imageArtifacts = artifacts.filter(
    (a) =>
      !isCharacterArtifact(a) &&
      !isLocationArtifact(a) &&
      !isSceneArtifact(a) &&
      !isTreatmentArtifact(a) &&
      !isTreatmentActArtifact(a) &&
      a.artifact_type !== "document" &&
      (a.artifact_type === "image" ||
        a.artifact_type === "cover" ||
        (a.content?.startsWith("http") &&
          a.artifact_type !== "treatment")),
  )
  return {
    characterArtifacts,
    locationArtifacts,
    sceneArtifacts,
    treatmentArtifacts,
    treatmentActArtifacts,
    documentArtifacts,
    screenplaySceneArtifacts,
    textArtifacts,
    imageArtifacts,
  }
}

export function ArtifactPanel({
  artifacts,
  workspaceId,
  linkedProjectId,
  linkedProjectName,
  onUpdate,
  onDelete,
  onArtifactRenamed,
  onArtifactsRefresh,
}: ArtifactPanelProps) {
  const { toast } = useToast()
  const [editingArtifact, setEditingArtifact] = useState<CreativeArtifact | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [editType, setEditType] = useState<ArtifactType>("document")
  const [editProjectId, setEditProjectId] = useState("")
  const [editCharacterId, setEditCharacterId] = useState("")
  const [editLocationId, setEditLocationId] = useState("")
  const [setAsPrimaryImage, setSetAsPrimaryImage] = useState(true)
  const [setAsProjectCover, setSetAsProjectCover] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [suggestingNameId, setSuggestingNameId] = useState<string | null>(null)
  const [projectAssets, setProjectAssets] = useState<Asset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [screenplayScenes, setScreenplayScenes] = useState<ScreenplayScene[]>([])
  const [loadingScenes, setLoadingScenes] = useState(false)
  const [viewTextDialog, setViewTextDialog] = useState<{ title: string; content: string } | null>(null)
  const [sceneToDelete, setSceneToDelete] = useState<ScreenplayScene | null>(null)
  const [deletingSceneId, setDeletingSceneId] = useState<string | null>(null)
  const [generatingScreenplaySceneId, setGeneratingScreenplaySceneId] = useState<string | null>(null)
  const [screenplayGenerateDialog, setScreenplayGenerateDialog] = useState<ScreenplayScene | null>(null)
  const [targetPageCount, setTargetPageCount] = useState("1")
  const [assetsTab, setAssetsTab] = useState("images")

  const {
    characterArtifacts,
    locationArtifacts,
    sceneArtifacts,
    treatmentArtifacts,
    treatmentActArtifacts,
    documentArtifacts,
    screenplaySceneArtifacts,
    textArtifacts,
    imageArtifacts,
  } = partitionArtifacts(artifacts)

  const orphanScreenplaySceneArtifacts = screenplaySceneArtifacts.filter(
    (artifact) =>
      !screenplayScenes.some(
        (scene) => scene.id === artifact.metadata?.screenplay_scene_id,
      ),
  )

  const draftScenes = screenplayScenes.filter((scene) => !isScreenplayGeneratedScene(scene))
  const generatedScreenplayScenes = screenplayScenes.filter((scene) =>
    isScreenplayGeneratedScene(scene),
  )
  const displayDraftScenes = useMemo(() => {
    if (!linkedProjectId) return sortScreenplayScenes(draftScenes)

    const merged = new Map<string, ScreenplayScene>()
    for (const scene of draftScenes) {
      merged.set(scene.id, scene)
    }

    for (const artifact of sceneArtifacts) {
      const scene = screenplaySceneFromArtifact(artifact, linkedProjectId, screenplayScenes)
      if (!scene || isScreenplayGeneratedScene(scene)) continue
      if (!merged.has(scene.id)) {
        merged.set(scene.id, scene)
      }
    }

    return sortScreenplayScenes([...merged.values()])
  }, [draftScenes, sceneArtifacts, screenplayScenes, linkedProjectId])
  const screenplayTabCount =
    generatedScreenplayScenes.length + orphanScreenplaySceneArtifacts.length

  const loadProjectAssets = useCallback(async () => {
    if (!linkedProjectId) {
      setProjectAssets([])
      return
    }
    setLoadingAssets(true)
    try {
      const assets = await AssetService.getAssetsForProject(linkedProjectId)
      setProjectAssets(assets)
    } catch {
      setProjectAssets([])
    } finally {
      setLoadingAssets(false)
    }
  }, [linkedProjectId])

  useEffect(() => {
    void loadProjectAssets()
  }, [loadProjectAssets, artifacts.length])

  const loadProjectScenes = useCallback(async () => {
    if (!linkedProjectId) {
      setScreenplayScenes([])
      return
    }
    setLoadingScenes(true)
    try {
      const scenes = await ScreenplayScenesService.getScreenplayScenes(linkedProjectId)
      setScreenplayScenes(scenes)
    } catch (error) {
      console.error("[artifact-panel] Failed to load screenplay scenes:", error)
      setScreenplayScenes([])
    } finally {
      setLoadingScenes(false)
    }
  }, [linkedProjectId])

  useEffect(() => {
    void loadProjectScenes()
  }, [loadProjectScenes, linkedProjectId, artifacts.length])

  const openScreenplayGenerateDialog = (scene: ScreenplayScene) => {
    const sourceContent = (scene.content || scene.description || "").trim()
    if (!sourceContent) {
      toast({
        title: "No scene content",
        description: "This scene has no text to convert into screenplay format.",
        variant: "destructive",
      })
      return
    }

    setTargetPageCount("1")
    setScreenplayGenerateDialog(scene)
  }

  const handleGenerateScreenplayScene = async (
    scene: ScreenplayScene,
    targetPages: number,
  ) => {
    if (!workspaceId) {
      toast({
        title: "Workspace required",
        description: "Open a workspace before generating screenplay scenes.",
        variant: "destructive",
      })
      return
    }

    setScreenplayGenerateDialog(null)
    setGeneratingScreenplaySceneId(scene.id)
    console.log("[generate-screenplay-scene:page-length] requesting", {
      screenplaySceneId: scene.id,
      sceneName: scene.name,
      targetPagesRequested: targetPages,
    })
    try {
      const res = await fetch(
        `/api/creative-workspace/${workspaceId}/generate-screenplay-scene`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screenplaySceneId: scene.id, targetPages }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate screenplay scene")
      }

      if (data.pageLengthDebug) {
        console.log("[generate-screenplay-scene:page-length] result", data.pageLengthDebug)
      }

      setAssetsTab("screenplay")
      await loadProjectScenes()
      onArtifactsRefresh?.()

      const warningText =
        Array.isArray(data.warnings) && data.warnings.length > 0
          ? ` ${data.warnings[0]}`
          : ""

      toast({
        title: "Screenplay scene generated",
        description: `${
          data.treatmentUsed
            ? `Used your treatment${data.actCount ? ` (${data.actCount} acts)` : ""}${data.priorSceneCount ? ` and ${data.priorSceneCount} prior scene(s)` : ""} for story continuity.`
            : data.usedAi
              ? "Formatted screenplay saved to your project."
              : "Screenplay synced to your project editor."
        }${data.timelineSceneId ? " Added to timeline." : ""} Target: ${data.targetPages ?? targetPages} page${(data.targetPages ?? targetPages) === 1 ? "" : "s"}.${warningText}`,
      })
    } catch (error) {
      await loadProjectScenes()
      onArtifactsRefresh?.()
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate screenplay scene",
        variant: "destructive",
      })
    } finally {
      setGeneratingScreenplaySceneId(null)
    }
  }

  const handleDeleteScene = async (scene: ScreenplayScene) => {
    setDeletingSceneId(scene.id)
    try {
      await ScreenplayScenesService.deleteScreenplayScene(scene.id)
      const linkedSceneArtifact = sceneArtifacts.find(
        (artifact) => artifact.metadata?.screenplay_scene_id === scene.id,
      )
      if (linkedSceneArtifact) {
        await onDelete(linkedSceneArtifact.id)
      }
      const linkedScreenplayArtifact = screenplaySceneArtifacts.find(
        (artifact) => artifact.metadata?.screenplay_scene_id === scene.id,
      )
      if (linkedScreenplayArtifact) {
        await onDelete(linkedScreenplayArtifact.id)
      }
      setScreenplayScenes((prev) => prev.filter((item) => item.id !== scene.id))
      setSceneToDelete(null)
      toast({ title: "Scene deleted" })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete scene",
        variant: "destructive",
      })
    } finally {
      setDeletingSceneId(null)
    }
  }

  const getSceneCardTitle = (scene: ScreenplayScene) => {
    if (scene.scene_number) return `Scene ${scene.scene_number} — ${scene.name}`
    return scene.name || "Scene"
  }

  const loadProjectLinks = async (projectId: string) => {
    setLoadingLinks(true)
    try {
      const [chars, locs] = await Promise.all([
        CharactersService.getCharacters(projectId),
        LocationsService.getLocations(projectId),
      ])
      setCharacters(chars)
      setLocations(locs)
    } catch {
      setCharacters([])
      setLocations([])
    } finally {
      setLoadingLinks(false)
    }
  }

  const openEdit = async (artifact: CreativeArtifact) => {
    const projectId = artifact.project_id || linkedProjectId || ""
    setEditingArtifact(artifact)
    setEditTitle(artifact.title)
    setEditLabel(artifact.label || "")
    setEditType(artifact.artifact_type)
    setEditProjectId(projectId)
    setEditCharacterId(
      typeof artifact.metadata?.character_id === "string"
        ? artifact.metadata.character_id
        : "",
    )
    setEditLocationId(
      typeof artifact.metadata?.location_id === "string"
        ? artifact.metadata.location_id
        : "",
    )
    setSetAsPrimaryImage(true)
    setSetAsProjectCover(artifact.artifact_type === "cover")
    if (projectId) {
      await loadProjectLinks(projectId)
    } else {
      setCharacters([])
      setLocations([])
    }
  }

  const startRename = (artifact: CreativeArtifact) => {
    setRenamingId(artifact.id)
    setRenameValue(artifact.title)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue("")
  }

  const saveRename = async (artifact: CreativeArtifact) => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      toast({
        title: "Name required",
        description: "Enter a name for this image.",
        variant: "destructive",
      })
      return
    }
    if (trimmed === artifact.title) {
      cancelRename()
      return
    }

    const duplicate = artifacts.some(
      (a) => a.id !== artifact.id && a.title.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) {
      toast({
        title: "Name already used",
        description: "Another image in this workspace already has that name.",
        variant: "destructive",
      })
      return
    }

    setRenaming(true)
    try {
      await onUpdate(artifact.id, { title: trimmed, sync_to_project: false })
      toast({ title: "Name updated" })
      cancelRename()
    } catch (error) {
      toast({
        title: "Rename failed",
        description: error instanceof Error ? error.message : "Could not update name",
        variant: "destructive",
      })
    } finally {
      setRenaming(false)
    }
  }

  const suggestArtifactName = async (artifact: CreativeArtifact) => {
    if (!workspaceId) {
      toast({
        title: "Workspace required",
        description: "Select a workspace before using AI naming.",
        variant: "destructive",
      })
      return
    }

    setSuggestingNameId(artifact.id)
    try {
      const res = await fetch(
        `/api/creative-workspace/${workspaceId}/artifacts/${artifact.id}/suggest-name`,
        { method: "POST" },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to suggest name")

      if (data.artifact) {
        onArtifactRenamed?.(data.artifact)
      }

      if (renamingId === artifact.id) {
        setRenameValue(data.title)
      }

      toast({
        title: "Name suggested",
        description: data.wasRenamedForUniqueness
          ? `${data.title} (adjusted to avoid a duplicate)`
          : data.title,
      })
    } catch (error) {
      toast({
        title: "AI naming failed",
        description: error instanceof Error ? error.message : "Could not suggest a name",
        variant: "destructive",
      })
    } finally {
      setSuggestingNameId(null)
    }
  }

  const handleProjectChange = async (projectId: string) => {
    setEditProjectId(projectId)
    setEditCharacterId("")
    setEditLocationId("")
    if (projectId) {
      await loadProjectLinks(projectId)
    } else {
      setCharacters([])
      setLocations([])
    }
  }

  const handleSave = async () => {
    if (!editingArtifact) return
    const isImageArtifact = !!editingArtifact.content?.startsWith("http")
    const needsProject =
      isImageArtifact &&
      ["character", "location", "cover", "scene", "image"].includes(editType)

    if (needsProject && !editProjectId) {
      toast({
        title: "Project required",
        description: "Link a movie project to save this image to characters, locations, or assets.",
        variant: "destructive",
      })
      return
    }
    if (editType === "character" && !editCharacterId && !editLabel.trim()) {
      toast({
        title: "Character needed",
        description: "Pick an existing character or enter a label to create one.",
        variant: "destructive",
      })
      return
    }
    if (editType === "location" && !editLocationId && !editLabel.trim()) {
      toast({
        title: "Location needed",
        description: "Pick an existing location or enter a label to create one.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const result = await onUpdate(editingArtifact.id, {
        title: editTitle,
        label: editLabel || null,
        artifact_type: editType,
        project_id: editProjectId || null,
        character_id:
          editType === "character" && editCharacterId && editCharacterId !== "__new__"
            ? editCharacterId
            : null,
        location_id:
          editType === "location" && editLocationId && editLocationId !== "__new__"
            ? editLocationId
            : null,
        create_character: editType === "character" && editCharacterId === "__new__",
        create_location: editType === "location" && editLocationId === "__new__",
        set_as_primary_image: setAsPrimaryImage,
        set_as_project_cover: setAsProjectCover || editType === "cover",
        sync_to_project: editingArtifact.content?.startsWith("http") ?? false,
      })
      setEditingArtifact(null)
      if (result?.syncMessage) {
        toast({ title: "Saved to project", description: result.syncMessage })
      } else {
        toast({ title: "Artifact updated" })
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save artifact",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const ArtifactCard = ({ artifact }: { artifact: CreativeArtifact }) => (
    <div className="group rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {renamingId === artifact.id ? (
            <div className="space-y-2">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Image name"
                className="h-8 text-sm"
                autoFocus
                disabled={renaming}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveRename(artifact)
                  if (e.key === "Escape") cancelRename()
                }}
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={renaming || suggestingNameId === artifact.id}
                  onClick={() => void suggestArtifactName(artifact)}
                  title="AI suggest name"
                >
                  {suggestingNameId === artifact.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  disabled={renaming}
                  onClick={() => void saveRename(artifact)}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={renaming}
                  onClick={cancelRename}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                className="text-sm font-medium truncate text-left hover:text-primary transition-colors flex-1 min-w-0"
                onClick={() => startRename(artifact)}
                title="Click to rename"
              >
                <span className="truncate">{artifact.title}</span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-primary"
                title="AI suggest name"
                disabled={suggestingNameId === artifact.id}
                onClick={() => void suggestArtifactName(artifact)}
              >
                {suggestingNameId === artifact.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                title="Rename"
                onClick={() => startRename(artifact)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {artifact.label && renamingId !== artifact.id && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Tag className="h-3 w-3" />
              {artifact.label}
            </p>
          )}
        </div>
        {renamingId !== artifact.id && (
          <Badge className={cn("text-xs flex-shrink-0", TYPE_COLORS[artifact.artifact_type])}>
            {artifact.artifact_type === "treatment_act" ? "act" : artifact.artifact_type}
          </Badge>
        )}
      </div>

      {artifact.content?.startsWith("http") && (
        <button
          type="button"
          className="relative block aspect-video w-full rounded overflow-hidden bg-muted cursor-zoom-in"
          onClick={() => setPreviewImage(artifact.content!)}
          title="View full image"
        >
          <img
            src={artifact.content}
            alt={artifact.title}
            className="h-full w-full object-contain hover:opacity-90 transition-opacity"
          />
        </button>
      )}

      {artifact.content && !artifact.content.startsWith("http") && (
        <div className="space-y-2">
          {isTreatmentActArtifact(artifact) && (
            <p className="text-[10px] uppercase tracking-wide text-orange-400/90">Act</p>
          )}
          {isTreatmentArtifact(artifact) && artifact.content && (
            <div className="flex flex-wrap gap-1">
              {extractTreatmentActLabels(artifact.content).map((act) => (
                <Badge key={act} variant="secondary" className="text-[10px] font-normal">
                  {act}
                </Badge>
              ))}
            </div>
          )}
          <p
            className={cn(
              "text-xs text-muted-foreground",
              isTreatmentArtifact(artifact) ? "line-clamp-6 whitespace-pre-wrap" : "line-clamp-3",
            )}
          >
            {artifact.content}
          </p>
          {isTreatmentArtifact(artifact) && artifact.content.length > 240 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                setViewTextDialog({
                  title: artifact.title,
                  content: artifact.content!,
                })
              }
            >
              View full treatment
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-2 border-t border-border/60 pt-2">
        {typeof artifact.metadata?.treatment_id === "string" && (
          <Button type="button" variant="outline" size="sm" className="h-8 flex-1 text-xs" asChild>
            <Link href={`/treatments/${artifact.metadata.treatment_id}`}>
              <FileText className="h-3.5 w-3.5 mr-1" />
              Open
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 text-xs"
          onClick={() => startRename(artifact)}
          disabled={renamingId === artifact.id}
        >
          <Pencil className="h-3.5 w-3.5 mr-1" />
          Name
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 text-xs"
          onClick={() => void openEdit(artifact)}
        >
          <Tag className="h-3.5 w-3.5 mr-1" />
          Label
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 text-xs text-destructive hover:text-destructive border-destructive/40 hover:border-destructive/60"
          onClick={() => onDelete(artifact.id)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      </div>

      {artifact.project_id && (
        <p className="text-xs text-primary flex items-center gap-1">
          <Link2 className="h-3 w-3" />
          Linked to project
          {typeof artifact.metadata?.treatment_id === "string" && " · Treatment"}
          {typeof artifact.metadata?.character_id === "string" && " · Character"}
          {typeof artifact.metadata?.location_id === "string" && " · Location"}
        </p>
      )}
    </div>
  )

  return (
    <>
      <div className="flex h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-muted/20">
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-medium">Created Assets</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Images, acts, treatments, scenes, and screenplay
          </p>
        </div>

        <Tabs value={assetsTab} onValueChange={setAssetsTab} className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
          <TabsList className="mx-3 mt-2 grid grid-cols-4 gap-1 h-auto w-[calc(100%-1.5rem)] p-1">
            <TabsTrigger
              value="images"
              title={`Images (${imageArtifacts.length})`}
              className="text-[10px] px-1 py-1.5 h-auto flex-col gap-0.5 min-w-0 flex-none"
            >
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-tight">Images</span>
              <span className="leading-tight text-[9px] text-muted-foreground">{imageArtifacts.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="assets"
              title={`Assets (${projectAssets.length})`}
              className="text-[10px] px-1 py-1.5 h-auto flex-col gap-0.5 min-w-0 flex-none"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-tight">Assets</span>
              <span className="leading-tight text-[9px] text-muted-foreground">{projectAssets.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="acts"
              title={`Acts (${treatmentActArtifacts.length})`}
              className="text-[10px] px-1 py-1.5 h-auto flex-col gap-0.5 min-w-0 flex-none"
            >
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-tight">Acts</span>
              <span className="leading-tight text-[9px] text-muted-foreground">
                {treatmentActArtifacts.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="treatments"
              title={`Treatments (${textArtifacts.length})`}
              className="text-[10px] px-1 py-1.5 h-auto flex-col gap-0.5 min-w-0 flex-none"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-tight">Treats</span>
              <span className="leading-tight text-[9px] text-muted-foreground">{textArtifacts.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="characters"
              title={`Characters (${characterArtifacts.length})`}
              className="text-[10px] px-1 py-1.5 h-auto flex-col gap-0.5 min-w-0 flex-none"
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-tight">Chars</span>
              <span className="leading-tight text-[9px] text-muted-foreground">{characterArtifacts.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="locations"
              title={`Locations (${locationArtifacts.length})`}
              className="text-[10px] px-1 py-1.5 h-auto flex-col gap-0.5 min-w-0 flex-none"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-tight">Locs</span>
              <span className="leading-tight text-[9px] text-muted-foreground">{locationArtifacts.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="scenes"
              title={`Scenes (${displayDraftScenes.length || sceneArtifacts.length})`}
              className="text-[10px] px-1 py-1.5 h-auto flex-col gap-0.5 min-w-0 flex-none"
            >
              <Clapperboard className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-tight">Scenes</span>
              <span className="leading-tight text-[9px] text-muted-foreground">
                {displayDraftScenes.length || sceneArtifacts.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="screenplay"
              title={`Screenplay (${screenplayTabCount})`}
              className="text-[10px] px-1 py-1.5 h-auto flex-col gap-0.5 min-w-0 flex-none"
            >
              <ScrollText className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-tight">Script</span>
              <span className="leading-tight text-[9px] text-muted-foreground">
                {screenplayTabCount}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full min-h-0">
              <div className="p-3 pb-6 space-y-3">
                {imageArtifacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Generated images will appear here. Use &quot;Generate Image&quot; on any message.
                  </p>
                ) : (
                  imageArtifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="assets" className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full min-h-0">
              <div className="p-3 pb-6 space-y-3">
                {!linkedProjectId ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Link a movie project to save imports to assets and view them here.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Link
                        href={`/assets?project=${linkedProjectId}`}
                        className="flex-1 flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                      >
                        Open Assets
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => void loadProjectAssets()}
                        disabled={loadingAssets}
                      >
                        {loadingAssets ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Refresh"
                        )}
                      </Button>
                    </div>
                    {loadingAssets ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : projectAssets.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No movie assets yet. Import photos or files in chat — they save here when a project is linked.
                      </p>
                    ) : (
                      projectAssets.map((asset) => {
                        const isImage = asset.content_type === "image"
                        const previewUrl = asset.content_url || (isImage ? asset.content : null)
                        return (
                          <div
                            key={asset.id}
                            className="rounded-lg border border-border bg-card p-3 space-y-2"
                          >
                            {previewUrl && isImage && (
                              <button
                                type="button"
                                className="block w-full overflow-hidden rounded-md border border-border bg-muted"
                                onClick={() => setPreviewImage(previewUrl)}
                              >
                                <img
                                  src={previewUrl}
                                  alt={asset.title}
                                  className="w-full h-28 object-contain"
                                />
                              </button>
                            )}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{asset.title}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {asset.content_type}
                                  {asset.metadata?.imported ? " · imported" : ""}
                                </p>
                              </div>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {asset.content_type}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              {(asset.content_url || (asset.content && asset.content.startsWith("http"))) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 flex-1 text-xs"
                                  asChild
                                >
                                  <a
                                    href={asset.content_url || asset.content}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                    Open
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="acts" className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full min-h-0">
              <div className="p-3 pb-6 space-y-3">
                {treatmentActArtifacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Story acts appear here when you click &quot;Save Acts&quot; on a treatment message in chat.
                  </p>
                ) : (
                  treatmentActArtifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="treatments" className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full min-h-0">
              <div className="p-3 pb-6 space-y-3">
                {linkedProjectId && treatmentArtifacts.length > 0 && (
                  <Link
                    href={`/treatments?project=${linkedProjectId}`}
                    className="flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    Open Treatments
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                {textArtifacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Full treatments and story notes appear here when you save from chat.
                  </p>
                ) : (
                  textArtifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="characters" className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full min-h-0">
              <div className="p-3 pb-6 space-y-3">
                {linkedProjectId && (
                  <div className="flex gap-2">
                    <Link
                      href={`/characters?movie=${linkedProjectId}`}
                      className="flex-1 flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                    >
                      Characters
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Link
                      href={`/avatars?projectId=${linkedProjectId}`}
                      className="flex-1 flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                    >
                      Avatars
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
                {characterArtifacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Character profiles and portraits appear here when you save from chat.
                  </p>
                ) : (
                  characterArtifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="locations" className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full min-h-0">
              <div className="p-3 pb-6 space-y-3">
                {linkedProjectId && (
                  <Link
                    href={`/locations?movie=${linkedProjectId}`}
                    className="flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    Open Locations
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                {locationArtifacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Location profiles and reference images appear here when you save from chat.
                  </p>
                ) : (
                  locationArtifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="scenes" className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-3 p-3 pb-32">
                {!linkedProjectId ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Link a movie project to save scenes from chat and view them here.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => void loadProjectScenes()}
                        disabled={loadingScenes}
                      >
                        {loadingScenes ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Refresh"
                        )}
                      </Button>
                    </div>
                    {loadingScenes ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : displayDraftScenes.length === 0 && sceneArtifacts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No scenes yet. Paste a scene in chat or use &quot;Save to Scene&quot; when one is detected. Generated screenplays appear in the Script tab.
                      </p>
                    ) : displayDraftScenes.length === 0 && generatedScreenplayScenes.length > 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        Your scene screenplay is ready. Open the <span className="font-medium text-foreground">Script</span> tab to view, regenerate, or edit it.
                      </p>
                    ) : (
                      <>
                        {displayDraftScenes.map((scene) => (
                          <div
                            key={scene.id}
                            className="rounded-lg border border-border bg-card p-3 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium break-words leading-snug">
                                  {getSceneCardTitle(scene)}
                                </p>
                                {scene.location && (
                                  <p className="text-xs text-muted-foreground break-words mt-0.5">
                                    {scene.location}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {scene.status || "draft"}
                              </Badge>
                            </div>
                            {(scene.content || scene.description) && (
                              <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                                <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words line-clamp-8">
                                  {scene.content || scene.description}
                                </p>
                              </div>
                            )}
                            {scene.characters && scene.characters.length > 0 && (
                              <p className="text-[10px] text-muted-foreground break-words">
                                Characters: {scene.characters.join(", ")}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 flex-1 min-w-[140px] text-xs text-primary border-primary/40 hover:border-primary/60"
                                disabled={generatingScreenplaySceneId === scene.id}
                                onClick={() => openScreenplayGenerateDialog(scene)}
                              >
                                {generatingScreenplaySceneId === scene.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                                )}
                                Generate screenplay
                              </Button>
                              {(scene.content || scene.description) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 flex-1 min-w-[120px] text-xs"
                                  onClick={() =>
                                    setViewTextDialog({
                                      title: getSceneCardTitle(scene),
                                      content: scene.content || scene.description || "",
                                    })
                                  }
                                >
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                  View full text
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 flex-1 text-xs text-destructive hover:text-destructive border-destructive/40 hover:border-destructive/60"
                                disabled={deletingSceneId === scene.id}
                                onClick={() => setSceneToDelete(scene)}
                              >
                                {deletingSceneId === scene.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                        {linkedProjectId
                          ? sceneArtifacts
                              .filter((artifact) => {
                                const scene = screenplaySceneFromArtifact(
                                  artifact,
                                  linkedProjectId,
                                  screenplayScenes,
                                )
                                return !scene
                              })
                              .map((artifact) => (
                                <ArtifactCard key={artifact.id} artifact={artifact} />
                              ))
                          : null}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="screenplay" className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-3 p-3 pb-32">
                {!linkedProjectId ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Link a movie project to generate and view screenplay scenes here.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Link
                        href={`/screenplay/${linkedProjectId}`}
                        className="flex-1 flex items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors"
                      >
                        Open Screenplay
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => void loadProjectScenes()}
                        disabled={loadingScenes}
                      >
                        {loadingScenes ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Refresh"
                        )}
                      </Button>
                    </div>
                    {loadingScenes ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : screenplayTabCount === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No screenplay scenes yet. Save a scene in the Scenes tab, then click &quot;Generate screenplay&quot; to create formatted screenplay here.
                      </p>
                    ) : (
                      <>
                        {generatedScreenplayScenes.map((scene) => (
                          <div
                            key={scene.id}
                            className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium break-words leading-snug">
                                  {getSceneCardTitle(scene)}
                                </p>
                                {scene.location && (
                                  <p className="text-xs text-muted-foreground break-words mt-0.5">
                                    {scene.location}
                                  </p>
                                )}
                              </div>
                              <Badge className="text-[10px] shrink-0 bg-primary/20 text-primary">
                                Screenplay
                              </Badge>
                            </div>
                            {scene.content && (
                              <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                                <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words line-clamp-8">
                                  {scene.content}
                                </p>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
                              {scene.content && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 flex-1 min-w-[120px] text-xs"
                                  onClick={() =>
                                    setViewTextDialog({
                                      title: getSceneCardTitle(scene),
                                      content: scene.content!,
                                    })
                                  }
                                >
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                  View full screenplay
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 flex-1 min-w-[120px] text-xs text-primary border-primary/40 hover:border-primary/60"
                                disabled={generatingScreenplaySceneId === scene.id}
                                onClick={() => openScreenplayGenerateDialog(scene)}
                              >
                                {generatingScreenplaySceneId === scene.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                                )}
                                Regenerate
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 flex-1 min-w-[100px] text-xs text-destructive hover:text-destructive border-destructive/40 hover:border-destructive/60"
                                disabled={deletingSceneId === scene.id}
                                onClick={() => setSceneToDelete(scene)}
                              >
                                {deletingSceneId === scene.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                        {orphanScreenplaySceneArtifacts.map((artifact) => (
                          <div
                            key={artifact.id}
                            className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium break-words leading-snug">
                                {artifact.title}
                              </p>
                              <Badge className="text-[10px] shrink-0 bg-primary/20 text-primary">
                                Screenplay
                              </Badge>
                            </div>
                            {artifact.content && (
                              <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                                <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words line-clamp-8">
                                  {artifact.content}
                                </p>
                              </div>
                            )}
                            {artifact.content && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-full text-xs"
                                onClick={() =>
                                  setViewTextDialog({
                                    title: artifact.title,
                                    content: artifact.content!,
                                  })
                                }
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                View full screenplay
                              </Button>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!editingArtifact} onOpenChange={(open) => !open && setEditingArtifact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Label & Link Artifact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Image name</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Label (e.g. character name, location)</Label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Marcus Chen, Abandoned Warehouse..."
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as ArtifactType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARTIFACT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link to Movie Project</Label>
              {linkedProjectId && linkedProjectName && editProjectId === linkedProjectId && (
                <p className="text-xs text-muted-foreground">
                  Auto-loaded from workspace: {linkedProjectName}
                </p>
              )}
              <ProjectSelector
                selectedProject={editProjectId}
                onProjectChange={handleProjectChange}
                placeholder="Link when ready..."
              />
            </div>

            {editProjectId && (editType === "character" || editType === "location" || editType === "cover") && (
              <div className="space-y-3 rounded-lg border border-border/60 p-3 bg-muted/20">
                {editType === "character" && (
                  <div className="space-y-2">
                    <Label>Character</Label>
                    <Select
                      value={editCharacterId || (editLabel.trim() ? "__new__" : "")}
                      onValueChange={setEditCharacterId}
                      disabled={loadingLinks}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingLinks ? "Loading..." : "Select or create..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">
                          Create new{editLabel.trim() ? `: ${editLabel.trim()}` : " from label"}
                        </SelectItem>
                        {characters.map((character) => (
                          <SelectItem key={character.id} value={character.id}>
                            {character.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editType === "location" && (
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select
                      value={editLocationId || (editLabel.trim() ? "__new__" : "")}
                      onValueChange={setEditLocationId}
                      disabled={loadingLinks}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingLinks ? "Loading..." : "Select or create..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">
                          Create new{editLabel.trim() ? `: ${editLabel.trim()}` : " from label"}
                        </SelectItem>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(editType === "character" || editType === "location") && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={setAsPrimaryImage}
                      onCheckedChange={(checked) => setSetAsPrimaryImage(checked === true)}
                    />
                    Set as primary image
                  </label>
                )}

                {editType === "cover" && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={setAsProjectCover || editType === "cover"}
                      onCheckedChange={(checked) => setSetAsProjectCover(checked === true)}
                    />
                    Set as project cover image
                  </label>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Saves this image into your movie project assets
                  {editType === "character" ? " and links it to the character." : ""}
                  {editType === "location" ? " and links it to the location." : ""}
                  {editType === "cover" ? " as the project cover." : ""}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingArtifact(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {screenplayGenerateDialog && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !generatingScreenplaySceneId) {
              setScreenplayGenerateDialog(null)
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Generate screenplay</DialogTitle>
              <DialogDescription>
                How many pages should this scene be? Standard screenplay pages are about 55 lines each.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="screenplay-page-count">Target pages</Label>
              <Input
                id="screenplay-page-count"
                type="number"
                min={1}
                max={20}
                step={1}
                value={targetPageCount}
                onChange={(event) => setTargetPageCount(event.target.value)}
                disabled={!!generatingScreenplaySceneId}
              />
              <div className="flex flex-wrap gap-1.5">
                {SCREENPLAY_PAGE_QUICK_OPTIONS.map((pages) => (
                  <Button
                    key={pages}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 min-w-[2.25rem] px-2 text-xs",
                      targetPageCount === String(pages) &&
                        "border-primary bg-primary/10 text-primary hover:bg-primary/15",
                    )}
                    disabled={!!generatingScreenplaySceneId}
                    onClick={() => setTargetPageCount(String(pages))}
                  >
                    {pages}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Scene: {getSceneCardTitle(screenplayGenerateDialog)}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScreenplayGenerateDialog(null)}
                disabled={!!generatingScreenplaySceneId}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const parsed = Number.parseInt(targetPageCount, 10)
                  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
                    toast({
                      title: "Invalid page count",
                      description: "Enter a whole number between 1 and 20.",
                      variant: "destructive",
                    })
                    return
                  }
                  void handleGenerateScreenplayScene(screenplayGenerateDialog, parsed)
                }}
                disabled={!!generatingScreenplaySceneId}
              >
                {generatingScreenplaySceneId === screenplayGenerateDialog.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {sceneToDelete && (
        <AlertDialog open onOpenChange={(open) => !open && setSceneToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete scene?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove{" "}
                <span className="font-medium text-foreground">
                  {getSceneCardTitle(sceneToDelete)}
                </span>{" "}
                from your screenplay. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingSceneId}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!!deletingSceneId}
                onClick={(event) => {
                  event.preventDefault()
                  void handleDeleteScene(sceneToDelete)
                }}
              >
                {deletingSceneId === sceneToDelete.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete scene"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {viewTextDialog && (
        <Dialog open onOpenChange={(open) => !open && setViewTextDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{viewTextDialog.title}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border border-border p-3">
              <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">
                {viewTextDialog.content}
              </pre>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewTextDialog(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white"
            onClick={() => setPreviewImage(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </>
  )
}
