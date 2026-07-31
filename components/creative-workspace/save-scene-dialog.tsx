"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ProjectSelector } from "@/components/project-selector"
import { ScreenplayScenesService, type ScreenplayScene } from "@/lib/screenplay-scenes-service"
import { MovieService } from "@/lib/movie-service"
import {
  extractMovieTitleFromContent,
  findMovieByTitle,
  type ParsedScene,
} from "@/lib/creative-chat-utils"
import { Loader2, Film, Clapperboard } from "lucide-react"

interface SaveSceneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceTitle: string
  messageId: string
  parsed: ParsedScene
  linkedProjectId?: string | null
  linkedProjectName?: string | null
  onSaved: (result: {
    projectId: string
    sceneId: string
    updated: boolean
    projectName: string
    sceneName: string
  }) => void
}

export function SaveSceneDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceTitle,
  messageId,
  parsed,
  linkedProjectId,
  linkedProjectName,
  onSaved,
}: SaveSceneDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [projectId, setProjectId] = useState("")
  const [resolvedProjectName, setResolvedProjectName] = useState("")
  const [hasAutoLinkedProject, setHasAutoLinkedProject] = useState(false)
  const [resolvingProject, setResolvingProject] = useState(false)
  const [movieName, setMovieName] = useState("")
  const [name, setName] = useState(parsed.name)
  const [sceneNumber, setSceneNumber] = useState(parsed.sceneNumber || "")
  const [location, setLocation] = useState(parsed.location || "")
  const [characters, setCharacters] = useState(parsed.characters.join(", "))
  const [content, setContent] = useState(parsed.content)
  const [sceneMode, setSceneMode] = useState<"new" | "update">("new")
  const [existingSceneId, setExistingSceneId] = useState("")
  const [existingScenes, setExistingScenes] = useState<ScreenplayScene[]>([])
  const [loadingScenes, setLoadingScenes] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return

    setName(parsed.name)
    setSceneNumber(parsed.sceneNumber || "")
    setLocation(parsed.location || "")
    setCharacters(parsed.characters.join(", "))
    setContent(parsed.content)
    setSceneMode("new")
    setExistingSceneId("")
    setError("")
    setMovieName("")
    setHasAutoLinkedProject(false)
    setResolvedProjectName("")

    let cancelled = false
    setResolvingProject(true)

    const resolveProject = async () => {
      try {
        if (linkedProjectId) {
          if (!cancelled) {
            setMode("existing")
            setProjectId(linkedProjectId)
            setResolvedProjectName(linkedProjectName || "Movie Project")
            setHasAutoLinkedProject(true)
          }
          return
        }

        const movies = await MovieService.getMovies()
        if (cancelled) return

        const fromContent = extractMovieTitleFromContent(parsed.prompt)
        const matched =
          findMovieByTitle(movies, workspaceTitle) ||
          findMovieByTitle(movies, fromContent)

        if (matched) {
          setMode("existing")
          setProjectId(matched.id)
          setResolvedProjectName(matched.name)
          setHasAutoLinkedProject(true)
        } else {
          setMode("existing")
          setProjectId("")
        }
      } finally {
        if (!cancelled) setResolvingProject(false)
      }
    }

    void resolveProject()
    return () => {
      cancelled = true
    }
  }, [open, parsed, linkedProjectId, linkedProjectName, workspaceTitle])

  useEffect(() => {
    if (!open || !projectId) {
      setExistingScenes([])
      return
    }

    let cancelled = false
    setLoadingScenes(true)
    ScreenplayScenesService.getScreenplayScenes(projectId)
      .then((scenes) => {
        if (!cancelled) setExistingScenes(scenes)
      })
      .catch(() => {
        if (!cancelled) setExistingScenes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingScenes(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, projectId])

  const handleSave = async () => {
    setError("")
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        sceneNumber: sceneNumber.trim() || null,
        location: location.trim() || null,
        characters: characters
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        content: content.trim(),
        prompt: content.trim(),
        messageId,
      }

      if (mode === "existing" && projectId) {
        payload.projectId = projectId
      } else if (mode === "new" && movieName.trim()) {
        payload.createMovie = { name: movieName.trim() }
      } else {
        setError("Select a movie or create a new one")
        setSaving(false)
        return
      }

      if (sceneMode === "update" && existingSceneId) {
        payload.sceneId = existingSceneId
      }

      const res = await fetch(`/api/creative-workspace/${workspaceId}/save-scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save scene")

      onSaved({
        projectId: data.projectId,
        sceneId: data.scene.id,
        updated: data.updated,
        projectName: data.projectName,
        sceneName: data.scene.name,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scene")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5" />
            Save to Movie Scene
          </DialogTitle>
          <DialogDescription>
            Save the full scene text to your movie&apos;s screenplay scenes.
          </DialogDescription>
        </DialogHeader>

        {resolvingProject ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Detecting linked movie...
          </div>
        ) : hasAutoLinkedProject ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm flex items-center gap-2">
            <Film className="h-4 w-4 text-primary flex-shrink-0" />
            <span>
              Saving to <span className="font-medium">{resolvedProjectName}</span>
            </span>
          </div>
        ) : (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="existing" className="text-xs">
                Existing Movie
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs">
                Create New Movie
              </TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Movie Project</Label>
                <ProjectSelector
                  selectedProject={projectId}
                  onProjectChange={setProjectId}
                  placeholder="Select a movie for this scene..."
                />
              </div>
            </TabsContent>
            <TabsContent value="new" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Movie Name</Label>
                <Input
                  value={movieName}
                  onChange={(e) => setMovieName(e.target.value)}
                  placeholder="Glacier Ghost"
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        {projectId && existingScenes.length > 0 && (
          <div className="space-y-2">
            <Label>Scene slot</Label>
            <Select
              value={sceneMode === "update" && existingSceneId ? existingSceneId : "new"}
              onValueChange={(v) => {
                if (v === "new") {
                  setSceneMode("new")
                  setExistingSceneId("")
                } else {
                  setSceneMode("update")
                  setExistingSceneId(v)
                  const existing = existingScenes.find((s) => s.id === v)
                  if (existing) {
                    setSceneNumber(existing.scene_number || sceneNumber)
                    setName(existing.name)
                  }
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingScenes ? "Loading scenes..." : "Create new scene"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create new scene</SelectItem>
                {existingScenes.map((scene) => (
                  <SelectItem key={scene.id} value={scene.id}>
                    {scene.scene_number ? `Scene ${scene.scene_number}` : "Scene"} — {scene.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Scene number</Label>
            <Input
              value={sceneNumber}
              onChange={(e) => setSceneNumber(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="space-y-2">
            <Label>Scene name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Location</Label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="INT. CAR - DAY"
          />
        </div>

        <div className="space-y-2">
          <Label>Characters (comma-separated)</Label>
          <Input
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            placeholder="FRED, TRAVIS, KIM"
          />
        </div>

        <div className="space-y-2">
          <Label>Scene content</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[180px] font-mono text-xs"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
