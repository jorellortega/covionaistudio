"use client"

import { useState } from "react"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Image as ImageIcon,
  FileText,
  Trash2,
  Tag,
  Link2,
  Loader2,
  Pencil,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CreativeArtifact, ArtifactType } from "@/lib/creative-workspace-types"
import { ProjectSelector } from "@/components/project-selector"
import { CharactersService, type Character } from "@/lib/characters-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

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
  scene: "bg-cyan-500/20 text-cyan-300",
  document: "bg-slate-500/20 text-slate-300",
  image: "bg-pink-500/20 text-pink-300",
  other: "bg-muted text-muted-foreground",
}

export function ArtifactPanel({
  artifacts,
  workspaceId,
  linkedProjectId,
  linkedProjectName,
  onUpdate,
  onDelete,
  onArtifactRenamed,
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

  const imageArtifacts = artifacts.filter((a) => a.artifact_type === "image" || a.artifact_type === "cover" || (a.content?.startsWith("http") && a.artifact_type !== "document" && a.artifact_type !== "treatment"))
  const docArtifacts = artifacts.filter((a) => !imageArtifacts.includes(a))

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
            {artifact.artifact_type}
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
            className="h-full w-full object-cover hover:opacity-90 transition-opacity"
          />
        </button>
      )}

      {artifact.content && !artifact.content.startsWith("http") && (
        <p className="text-xs text-muted-foreground line-clamp-3">{artifact.content}</p>
      )}

      <div className="flex gap-2 border-t border-border/60 pt-2">
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
          {typeof artifact.metadata?.character_id === "string" && " · Character"}
          {typeof artifact.metadata?.location_id === "string" && " · Location"}
        </p>
      )}
    </div>
  )

  return (
    <>
      <div className="flex w-80 flex-col border-l border-border bg-muted/20">
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-medium">Created Assets</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Images, treatments, and documents from your chat
          </p>
        </div>

        <Tabs defaultValue="images" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-3 mt-2 grid grid-cols-2">
            <TabsTrigger value="images" className="text-xs">
              <ImageIcon className="h-3 w-3 mr-1" />
              Images ({imageArtifacts.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Docs ({docArtifacts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[calc(100vh-220px)]">
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

          <TabsContent value="documents" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-3 pb-6 space-y-3">
                {docArtifacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Save treatments, character notes, and story docs from chat messages.
                  </p>
                ) : (
                  docArtifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)
                )}
              </div>
            </ScrollArea>
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
