"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Loader2, Film, Link2 } from "lucide-react"

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim()
}

interface LinkProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceTitle: string
  currentProjectId?: string | null
  onLinked: (result: { projectId: string; projectName: string }) => void
  onUnlinked?: () => void
}

export function LinkProjectDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceTitle,
  currentProjectId,
  onLinked,
  onUnlinked,
}: LinkProjectDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [projectId, setProjectId] = useState(currentProjectId || "")
  const [movieName, setMovieName] = useState(workspaceTitle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setMode("existing")
      setProjectId(currentProjectId || "")
      setMovieName(workspaceTitle !== "Untitled Project" ? workspaceTitle : "")
      setError("")
    }
  }, [open, currentProjectId, workspaceTitle])

  const handleLink = async () => {
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
      const res = await fetch(`/api/creative-workspace/${workspaceId}/link-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: mode === "existing" ? projectId : undefined,
          createMovie: mode === "new" ? { name: stripWrappingQuotes(movieName) } : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to link project")

      onLinked({ projectId: data.projectId, projectName: data.projectName })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link project")
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/link-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlink: true }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to unlink project")

      onUnlinked?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink project")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link to Movie
          </DialogTitle>
          <DialogDescription>
            Connect this workspace to a movie project so you know what you&apos;re working on.
          </DialogDescription>
        </DialogHeader>

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
                onProjectChange={setProjectId}
                placeholder="Select a movie..."
              />
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Movie Name</Label>
              <Input
                value={movieName}
                onChange={(e) => setMovieName(e.target.value)}
                placeholder="My Movie Title"
              />
            </div>
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentProjectId && (
            <Button
              type="button"
              variant="outline"
              className="sm:mr-auto text-muted-foreground"
              onClick={handleUnlink}
              disabled={saving}
            >
              Unlink
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Link Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
