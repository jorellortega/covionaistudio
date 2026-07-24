"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
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
import { CharactersService, type Character } from "@/lib/characters-service"
import { MovieService } from "@/lib/movie-service"
import { AVATAR_ANGLES } from "@/lib/avatar-angles"
import { extractMovieTitleFromContent, findMovieByTitle } from "@/lib/creative-chat-utils"
import { Loader2, Film, UserCircle } from "lucide-react"

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'""'']+|["'""'']+$/g, "").trim()
}

interface SaveAvatarImageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceTitle: string
  messageId: string
  imageUrls: string[]
  suggestedCharacterName: string
  prompt?: string
  linkedProjectId?: string | null
  linkedProjectName?: string | null
  onSaved: (result: {
    projectId: string
    characterId: string
    characterName: string
    projectName: string
    angleLabel: string
  }) => void
}

export function SaveAvatarImageDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceTitle,
  messageId,
  imageUrls,
  suggestedCharacterName,
  prompt,
  linkedProjectId,
  linkedProjectName,
  onSaved,
}: SaveAvatarImageDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [projectId, setProjectId] = useState("")
  const [resolvedProjectName, setResolvedProjectName] = useState("")
  const [hasAutoLinkedProject, setHasAutoLinkedProject] = useState(false)
  const [resolvingProject, setResolvingProject] = useState(false)
  const [movieName, setMovieName] = useState("")
  const [selectedImageUrl, setSelectedImageUrl] = useState(imageUrls[0] || "")
  const [characterName, setCharacterName] = useState(suggestedCharacterName)
  const [characterId, setCharacterId] = useState("")
  const [createCharacter, setCreateCharacter] = useState(false)
  const [existingCharacters, setExistingCharacters] = useState<Character[]>([])
  const [loadingCharacters, setLoadingCharacters] = useState(false)
  const [angleId, setAngleId] = useState("front")
  const [setAsPortrait, setSetAsPortrait] = useState(true)
  const [addToReferences, setAddToReferences] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return

    setSelectedImageUrl(imageUrls[0] || "")
    setCharacterName(suggestedCharacterName)
    setCharacterId("")
    setCreateCharacter(false)
    setAngleId("front")
    setSetAsPortrait(true)
    setAddToReferences(true)
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

        const fromContent = prompt ? extractMovieTitleFromContent(prompt) : null
        const matched =
          findMovieByTitle(movies, workspaceTitle) ||
          findMovieByTitle(movies, fromContent)

        if (matched) {
          setMode("existing")
          setProjectId(matched.id)
          setResolvedProjectName(matched.name)
          setHasAutoLinkedProject(true)
        } else {
          setMode("new")
          setProjectId("")
          setMovieName(fromContent || (workspaceTitle !== "Untitled Project" ? workspaceTitle : ""))
        }
      } catch {
        if (!cancelled) {
          setMode("new")
          setProjectId("")
        }
      } finally {
        if (!cancelled) setResolvingProject(false)
      }
    }

    resolveProject()

    return () => { cancelled = true }
  }, [open, imageUrls, suggestedCharacterName, prompt, linkedProjectId, linkedProjectName, workspaceTitle])

  useEffect(() => {
    if (!open || !projectId) {
      setExistingCharacters([])
      return
    }

    let cancelled = false
    setLoadingCharacters(true)
    CharactersService.getCharacters(projectId)
      .then((chars) => {
        if (!cancelled) {
          setExistingCharacters(chars)
          const match = chars.find(
            (c) => c.name.toLowerCase() === suggestedCharacterName.toLowerCase(),
          )
          if (match) {
            setCharacterId(match.id)
            setCharacterName(match.name)
            setCreateCharacter(false)
          } else if (suggestedCharacterName && suggestedCharacterName !== "Unnamed Character") {
            setCreateCharacter(true)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setExistingCharacters([])
      })
      .finally(() => {
        if (!cancelled) setLoadingCharacters(false)
      })

    return () => { cancelled = true }
  }, [open, projectId, suggestedCharacterName])

  const handleSave = async () => {
    setError("")
    if (!selectedImageUrl) {
      setError("No image selected")
      return
    }
    if (mode === "existing" && !projectId) {
      setError("Select a movie project first")
      return
    }
    if (mode === "new" && !movieName.trim()) {
      setError("Enter a name for the new movie")
      return
    }
    if (!stripWrappingQuotes(characterName)) {
      setError("Enter a character name")
      return
    }
    if (!createCharacter && !characterId) {
      setError("Select a character or choose to create a new one")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/save-avatar-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: selectedImageUrl,
          characterName: stripWrappingQuotes(characterName),
          characterId: createCharacter ? undefined : characterId,
          createCharacter,
          projectId: mode === "existing" ? projectId : undefined,
          createMovie: mode === "new" ? { name: stripWrappingQuotes(movieName) } : undefined,
          angleId,
          prompt,
          messageId,
          setAsCharacterPortrait: setAsPortrait,
          addToCharacterReferences: addToReferences,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save avatar image")

      onSaved({
        projectId: data.projectId,
        characterId: data.characterId,
        characterName: data.characterName,
        projectName: data.projectName || resolvedProjectName || movieName,
        angleLabel: data.angleLabel,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save avatar image")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Save as Avatar
          </DialogTitle>
          <DialogDescription>
            Add this image to Avatar Images for a character. You can also set it as their portrait.
          </DialogDescription>
        </DialogHeader>

        {imageUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imageUrls.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setSelectedImageUrl(url)}
                className={`flex-shrink-0 w-24 h-24 rounded-md overflow-hidden border-2 transition-colors ${
                  selectedImageUrl === url ? "border-primary" : "border-border"
                }`}
              >
                <img src={url} alt="Avatar reference" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

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
              <TabsTrigger value="existing" className="text-xs">Existing Movie</TabsTrigger>
              <TabsTrigger value="new" className="text-xs">Create New Movie</TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="mt-4">
              <ProjectSelector
                selectedProject={projectId}
                onProjectChange={setProjectId}
                placeholder="Select a movie..."
              />
            </TabsContent>
            <TabsContent value="new" className="mt-4">
              <Input
                value={movieName}
                onChange={(e) => setMovieName(e.target.value)}
                placeholder="Movie name"
              />
            </TabsContent>
          </Tabs>
        )}

        {projectId && (
          <div className="space-y-3">
            {characterId && !createCharacter && (
              <p className="text-xs text-primary">
                Updating existing character: {characterName}
              </p>
            )}
            <div className="space-y-2">
              <Label>Character</Label>
              <Select
                value={createCharacter ? "new" : characterId || "unset"}
                onValueChange={(v) => {
                  if (v === "new") {
                    setCreateCharacter(true)
                    setCharacterId("")
                  } else {
                    setCreateCharacter(false)
                    setCharacterId(v)
                    const char = existingCharacters.find((c) => c.id === v)
                    if (char) setCharacterName(char.name)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCharacters ? "Loading..." : "Select character"} />
                </SelectTrigger>
                <SelectContent>
                  {existingCharacters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="new">
                    Create new: {characterName || suggestedCharacterName}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Character Name</Label>
              <Input
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Santiago"
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar Angle</Label>
              <Select value={angleId} onValueChange={setAngleId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVATAR_ANGLES.map((angle) => (
                    <SelectItem key={angle.id} value={angle.id}>{angle.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-md border border-border/60 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={setAsPortrait} onCheckedChange={(v) => setSetAsPortrait(!!v)} />
                Set as character portrait
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={addToReferences} onCheckedChange={(v) => setAddToReferences(!!v)} />
                Add to character reference images
              </label>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || resolvingProject || !projectId}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save to Avatars
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
