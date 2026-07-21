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
import { ProjectSelector } from "@/components/project-selector"
import { Loader2, Film, FileText } from "lucide-react"
import type { ParsedTreatment } from "@/lib/creative-chat-utils"

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim()
}

interface SaveTreatmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  messageId: string
  parsed: ParsedTreatment
  onSaved: (result: { projectId: string; treatmentId: string; updated: boolean; projectName: string }) => void
}

export function SaveTreatmentDialog({
  open,
  onOpenChange,
  workspaceId,
  messageId,
  parsed,
  onSaved,
}: SaveTreatmentDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("new")
  const [projectId, setProjectId] = useState("")
  const [movieName, setMovieName] = useState(parsed.title)
  const [title, setTitle] = useState(parsed.title)
  const [genre, setGenre] = useState(parsed.genre)
  const [logline, setLogline] = useState(parsed.logline)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setMode("new")
      setTitle(parsed.title)
      setGenre(parsed.genre)
      setLogline(parsed.logline)
      setMovieName(parsed.title)
      setError("")
    }
  }, [open, parsed])

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

    setSaving(true)
    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/save-treatment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: stripWrappingQuotes(title),
          genre: stripWrappingQuotes(genre),
          logline: stripWrappingQuotes(logline),
          synopsis: parsed.synopsis || stripWrappingQuotes(logline),
          prompt: parsed.prompt,
          projectId: mode === "existing" ? projectId : undefined,
          createMovie: mode === "new" ? { name: stripWrappingQuotes(movieName), genre: stripWrappingQuotes(genre) } : undefined,
          messageId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save treatment")

      onSaved({
        projectId: data.projectId,
        treatmentId: data.treatment.id,
        updated: data.updated,
        projectName: data.projectName || movieName || title,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save treatment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Save Treatment to Movie
          </DialogTitle>
          <DialogDescription>
            Link this treatment to a movie project. Create a new movie or attach to an existing one.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="new" className="text-xs">
              <Film className="h-3 w-3 mr-1" />
              Create New Movie
            </TabsTrigger>
            <TabsTrigger value="existing" className="text-xs">
              <Film className="h-3 w-3 mr-1" />
              Existing Movie
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Movie Name</Label>
              <Input
                value={movieName}
                onChange={(e) => setMovieName(e.target.value)}
                placeholder="Leviathor"
              />
            </div>
          </TabsContent>

          <TabsContent value="existing" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Movie Project</Label>
              <ProjectSelector
                selectedProject={projectId}
                onProjectChange={setProjectId}
                placeholder="Select a movie to attach this treatment..."
              />
              <p className="text-xs text-muted-foreground">
                If this movie already has a treatment, it will be updated with this content.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-3 pt-2">
          <div className="space-y-2">
            <Label>Treatment Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Genre</Label>
            <Input value={genre} onChange={(e) => setGenre(e.target.value)} />
          </div>
          {logline && (
            <div className="space-y-2">
              <Label>Logline</Label>
              <Textarea value={logline} onChange={(e) => setLogline(e.target.value)} rows={2} />
            </div>
          )}
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground max-h-32 overflow-y-auto">
            {parsed.prompt.slice(0, 400)}{parsed.prompt.length > 400 ? "..." : ""}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save to Movie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
