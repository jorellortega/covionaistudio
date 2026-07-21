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
  Eye,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CreativeArtifact, ArtifactType } from "@/lib/creative-workspace-types"
import { ProjectSelector } from "@/components/project-selector"

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

interface ArtifactPanelProps {
  artifacts: CreativeArtifact[]
  onUpdate: (id: string, data: Partial<CreativeArtifact>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ArtifactPanel({ artifacts, onUpdate, onDelete }: ArtifactPanelProps) {
  const [editingArtifact, setEditingArtifact] = useState<CreativeArtifact | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [editType, setEditType] = useState<ArtifactType>("document")
  const [editProjectId, setEditProjectId] = useState("")

  const imageArtifacts = artifacts.filter((a) => a.artifact_type === "image" || a.artifact_type === "cover" || (a.content?.startsWith("http") && a.artifact_type !== "document" && a.artifact_type !== "treatment"))
  const docArtifacts = artifacts.filter((a) => !imageArtifacts.includes(a))

  const openEdit = (artifact: CreativeArtifact) => {
    setEditingArtifact(artifact)
    setEditTitle(artifact.title)
    setEditLabel(artifact.label || "")
    setEditType(artifact.artifact_type)
    setEditProjectId(artifact.project_id || "")
  }

  const handleSave = async () => {
    if (!editingArtifact) return
    setSaving(true)
    try {
      await onUpdate(editingArtifact.id, {
        title: editTitle,
        label: editLabel || null,
        artifact_type: editType,
        project_id: editProjectId || null,
      })
      setEditingArtifact(null)
    } finally {
      setSaving(false)
    }
  }

  const ArtifactCard = ({ artifact }: { artifact: CreativeArtifact }) => (
    <div className="group rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{artifact.title}</p>
          {artifact.label && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Tag className="h-3 w-3" />
              {artifact.label}
            </p>
          )}
        </div>
        <Badge className={cn("text-xs flex-shrink-0", TYPE_COLORS[artifact.artifact_type])}>
          {artifact.artifact_type}
        </Badge>
      </div>

      {artifact.content?.startsWith("http") && (
        <div className="relative aspect-video rounded overflow-hidden bg-muted">
          <img
            src={artifact.content}
            alt={artifact.title}
            className="w-full h-full object-cover"
          />
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={() => setPreviewImage(artifact.content!)}
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      )}

      {artifact.content && !artifact.content.startsWith("http") && (
        <p className="text-xs text-muted-foreground line-clamp-3">{artifact.content}</p>
      )}

      {artifact.project_id && (
        <p className="text-xs text-primary flex items-center gap-1">
          <Link2 className="h-3 w-3" />
          Linked to project
        </p>
      )}

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(artifact)}>
          <Tag className="h-3 w-3 mr-1" />
          Label
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive"
          onClick={() => onDelete(artifact.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
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
              <div className="p-3 space-y-3">
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
              <div className="p-3 space-y-3">
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
              <Label>Title</Label>
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
              <ProjectSelector
                selectedProject={editProjectId}
                onProjectChange={setEditProjectId}
                placeholder="Link when ready..."
              />
            </div>
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
