"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  extractMovieTitleFromContent,
  findMovieByTitle,
  type ParsedCharacter,
} from "@/lib/creative-chat-utils"
import { Loader2, Film, User } from "lucide-react"

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'""'']+|["'""'']+$/g, "").trim()
}

interface SaveCharacterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceTitle: string
  messageId: string
  parsed: ParsedCharacter
  imageUrls: string[]
  linkedProjectId?: string | null
  linkedProjectName?: string | null
  onSaved: (result: {
    projectId: string
    characterId: string
    updated: boolean
    projectName: string
    characterName: string
  }) => void
}

export function SaveCharacterDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceTitle,
  messageId,
  parsed,
  imageUrls,
  linkedProjectId,
  linkedProjectName,
  onSaved,
}: SaveCharacterDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [projectId, setProjectId] = useState("")
  const [resolvedProjectName, setResolvedProjectName] = useState("")
  const [hasAutoLinkedProject, setHasAutoLinkedProject] = useState(false)
  const [resolvingProject, setResolvingProject] = useState(false)
  const [movieName, setMovieName] = useState("")
  const [name, setName] = useState(parsed.name)
  const [age, setAge] = useState(parsed.age?.toString() || "")
  const [gender, setGender] = useState(parsed.gender)
  const [description, setDescription] = useState(parsed.description)
  const [characterMode, setCharacterMode] = useState<"new" | "update">("new")
  const [existingCharacterId, setExistingCharacterId] = useState("")
  const [existingCharacters, setExistingCharacters] = useState<Character[]>([])
  const [loadingCharacters, setLoadingCharacters] = useState(false)
  const [saveAsAvatar, setSaveAsAvatar] = useState(imageUrls.length > 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return

    setName(parsed.name)
    setAge(parsed.age?.toString() || "")
    setGender(parsed.gender)
    setDescription(parsed.description)
    setCharacterMode("new")
    setExistingCharacterId("")
    setSaveAsAvatar(imageUrls.length > 0)
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
  }, [open, parsed, linkedProjectId, linkedProjectName, workspaceTitle, imageUrls.length])

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
          const match = chars.find((c) => c.name.toLowerCase() === parsed.name.toLowerCase())
          if (match) {
            setCharacterMode("update")
            setExistingCharacterId(match.id)
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
  }, [open, projectId, parsed.name])

  const handleSave = async () => {
    setError("")
    if (mode === "existing" && !projectId) {
      setError("Select a movie project first")
      return
    }
    if (mode === "new" && !movieName.trim()) {
      setError("Enter a name for the new movie")
      return
    }
    if (!stripWrappingQuotes(name)) {
      setError("Enter a character name")
      return
    }
    if (characterMode === "update" && !existingCharacterId) {
      setError("Select an existing character to update")
      return
    }

    setSaving(true)
    try {
      const parsedAge = age.trim() ? parseInt(age, 10) : null
      const res = await fetch(`/api/creative-workspace/${workspaceId}/save-character`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stripWrappingQuotes(name),
          description: description.trim(),
          age: parsedAge && parsedAge > 0 ? parsedAge : null,
          gender: gender.trim() || null,
          archetype: parsed.archetype || null,
          backstory: parsed.backstory || null,
          roleInStory: parsed.roleInStory || null,
          characterType: parsed.characterType,
          prompt: parsed.prompt,
          projectId: mode === "existing" ? projectId : undefined,
          createMovie: mode === "new" ? { name: stripWrappingQuotes(movieName) } : undefined,
          messageId,
          characterId: characterMode === "update" ? existingCharacterId : undefined,
          imageUrls,
          saveAsAvatar: saveAsAvatar && imageUrls.length > 0,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save character")

      onSaved({
        projectId: data.projectId,
        characterId: data.character.id,
        updated: data.updated,
        projectName: data.projectName || resolvedProjectName || movieName,
        characterName: data.character.name,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save character")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Save Character
          </DialogTitle>
          <DialogDescription>
            Save this character to your Characters page
            {imageUrls.length > 0 ? " with the generated image" : ""}.
          </DialogDescription>
        </DialogHeader>

        {imageUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imageUrls.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border border-border"
              >
                <img src={url} alt={`Character reference ${i + 1}`} className="w-full h-full object-cover" />
              </div>
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
              <TabsTrigger value="existing" className="text-xs">
                <Film className="h-3 w-3 mr-1" />
                Existing Movie
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs">
                <Film className="h-3 w-3 mr-1" />
                Create New Movie
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Movie Project</Label>
                <ProjectSelector
                  selectedProject={projectId}
                  onProjectChange={(id) => {
                    setProjectId(id)
                    setResolvedProjectName("")
                  }}
                  placeholder="Select a movie for this character..."
                />
              </div>
            </TabsContent>

            <TabsContent value="new" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Movie Name</Label>
                <Input
                  value={movieName}
                  onChange={(e) => setMovieName(e.target.value)}
                  placeholder="Polvo y Revólveres"
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        {projectId && (
          <div className="space-y-2">
            <Label>Character</Label>
            <Select
              value={characterMode === "update" && existingCharacterId ? existingCharacterId : "new"}
              onValueChange={(v) => {
                if (v === "new") {
                  setCharacterMode("new")
                  setExistingCharacterId("")
                } else {
                  setCharacterMode("update")
                  setExistingCharacterId(v)
                  const char = existingCharacters.find((c) => c.id === v)
                  if (char) setName(char.name)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingCharacters ? "Loading..." : "Create new character"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create new character</SelectItem>
                {existingCharacters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Update: {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Santiago" />
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="25"
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <Input value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          {imageUrls.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-as-avatar"
                checked={saveAsAvatar}
                onCheckedChange={(v) => setSaveAsAvatar(!!v)}
              />
              <Label htmlFor="save-as-avatar" className="text-sm font-normal cursor-pointer">
                Also save image to Avatars (front angle)
              </Label>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || resolvingProject}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Character
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
