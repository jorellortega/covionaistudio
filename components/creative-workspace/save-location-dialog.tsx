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
import { LocationsService, type Location } from "@/lib/locations-service"
import { MovieService } from "@/lib/movie-service"
import {
  extractMovieTitleFromContent,
  findMovieByTitle,
  type ParsedLocation,
} from "@/lib/creative-chat-utils"
import { Loader2, Film, MapPin } from "lucide-react"

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'""'']+|["'""'']+$/g, "").trim()
}

interface SaveLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceTitle: string
  messageId: string
  parsed: ParsedLocation
  imageUrls: string[]
  linkedProjectId?: string | null
  linkedProjectName?: string | null
  onSaved: (result: {
    projectId: string
    locationId: string
    updated: boolean
    projectName: string
    locationName: string
  }) => void
}

export function SaveLocationDialog({
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
}: SaveLocationDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [projectId, setProjectId] = useState("")
  const [resolvedProjectName, setResolvedProjectName] = useState("")
  const [hasAutoLinkedProject, setHasAutoLinkedProject] = useState(false)
  const [resolvingProject, setResolvingProject] = useState(false)
  const [movieName, setMovieName] = useState("")
  const [name, setName] = useState(parsed.name)
  const [type, setType] = useState<string>(parsed.type || "")
  const [atmosphere, setAtmosphere] = useState(parsed.atmosphere)
  const [mood, setMood] = useState(parsed.mood)
  const [city, setCity] = useState(parsed.city)
  const [description, setDescription] = useState(parsed.description)
  const [locationMode, setLocationMode] = useState<"new" | "update">("new")
  const [existingLocationId, setExistingLocationId] = useState("")
  const [existingLocations, setExistingLocations] = useState<Location[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return

    setName(parsed.name)
    setType(parsed.type || "")
    setAtmosphere(parsed.atmosphere)
    setMood(parsed.mood)
    setCity(parsed.city)
    setDescription(parsed.description)
    setLocationMode("new")
    setExistingLocationId("")
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
      setExistingLocations([])
      return
    }

    let cancelled = false
    setLoadingLocations(true)
    LocationsService.getLocations(projectId)
      .then((locs) => {
        if (!cancelled) {
          setExistingLocations(locs)
          const match = locs.find((l) => l.name.toLowerCase() === parsed.name.toLowerCase())
          if (match) {
            setLocationMode("update")
            setExistingLocationId(match.id)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setExistingLocations([])
      })
      .finally(() => {
        if (!cancelled) setLoadingLocations(false)
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
      setError("Enter a location name")
      return
    }
    if (locationMode === "update" && !existingLocationId) {
      setError("Select an existing location to update")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/save-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stripWrappingQuotes(name),
          description: description.trim(),
          type: type || null,
          atmosphere: atmosphere.trim() || null,
          mood: mood.trim() || null,
          visualDescription: parsed.visualDescription || description.trim(),
          lightingNotes: parsed.lightingNotes || null,
          city: city.trim() || null,
          prompt: parsed.prompt,
          projectId: mode === "existing" ? projectId : undefined,
          createMovie: mode === "new" ? { name: stripWrappingQuotes(movieName) } : undefined,
          messageId,
          locationId: locationMode === "update" ? existingLocationId : undefined,
          imageUrls,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save location")

      onSaved({
        projectId: data.projectId,
        locationId: data.location.id,
        updated: data.updated,
        projectName: data.projectName || resolvedProjectName || movieName,
        locationName: data.location.name,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save location")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Save Location
          </DialogTitle>
          <DialogDescription>
            Save this location to your Locations page
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
                <img src={url} alt={`Location reference ${i + 1}`} className="w-full h-full object-cover" />
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
                  placeholder="Select a movie for this location..."
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
            <Label>Location</Label>
            <Select
              value={locationMode === "update" && existingLocationId ? existingLocationId : "new"}
              onValueChange={(v) => {
                if (v === "new") {
                  setLocationMode("new")
                  setExistingLocationId("")
                } else {
                  setLocationMode("update")
                  setExistingLocationId(v)
                  const loc = existingLocations.find((l) => l.id === v)
                  if (loc) setName(loc.name)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingLocations ? "Loading..." : "Create new location"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create new location</SelectItem>
                {existingLocations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    Update: {l.name}
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Abandoned Warehouse" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type || "unset"} onValueChange={(v) => setType(v === "unset" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not specified</SelectItem>
                  <SelectItem value="interior">Interior</SelectItem>
                  <SelectItem value="exterior">Exterior</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Atmosphere</Label>
              <Input value={atmosphere} onChange={(e) => setAtmosphere(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Mood</Label>
              <Input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || resolvingProject}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
