"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Send,
  Bot,
  User,
  Loader2,
  Save,
  ImageIcon,
  Sparkles,
  Pencil,
  Trash2,
  FileText,
  Film,
  ExternalLink,
  Link2,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { CreativeMessage, ArtifactType, CreativeArtifact } from "@/lib/creative-workspace-types"
import { detectTreatmentContent, parseTreatmentFields } from "@/lib/creative-chat-utils"
import { SaveTreatmentDialog } from "@/components/creative-workspace/save-treatment-dialog"
import { LinkProjectDialog } from "@/components/creative-workspace/link-project-dialog"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { AISettingsService } from "@/lib/ai-settings-service"
import { mapDisplayModelToService, normalizeDisplayModelToApiId, DEFAULT_CINEMATIC_IMAGE_WIDTH, DEFAULT_CINEMATIC_IMAGE_HEIGHT } from "@/lib/image-model-utils"

const QUICK_PROMPTS = [
  "Help me develop a character with a detailed visual description",
  "Write a story treatment for my film idea",
  "Describe a key location for my movie",
  "Create a movie poster concept",
  "Break down my story into key scenes",
]

const SAVE_TYPES: { value: ArtifactType; label: string }[] = [
  { value: "treatment", label: "Treatment" },
  { value: "character", label: "Character" },
  { value: "location", label: "Location" },
  { value: "scene", label: "Scene" },
  { value: "document", label: "Document" },
  { value: "cover", label: "Cover Concept" },
  { value: "other", label: "Other" },
]

interface ChatPanelProps {
  workspaceId: string | null
  workspaceTitle: string
  linkedProject: { id: string; name: string } | null
  messages: CreativeMessage[]
  artifacts: CreativeArtifact[]
  isLoadingMessages: boolean
  onMessagesChange: (messages: CreativeMessage[]) => void
  onWorkspaceTitleChange: (title: string) => void
  onArtifactCreated: (artifact?: CreativeArtifact) => void
  onMessageDeleted: (messageId: string) => void
  onProjectLinked: (projectId: string, projectName: string) => void
  onProjectUnlinked: () => void
  onDeleteWorkspace: () => void
}

function getMessageImages(messageId: string, artifacts: CreativeArtifact[]): string[] {
  return artifacts
    .filter(
      (a) =>
        a.message_id === messageId &&
        a.content &&
        (a.content.startsWith("http") || a.content.startsWith("data:image/")),
    )
    .map((a) => a.content!)
}

export function ChatPanel({
  workspaceId,
  workspaceTitle,
  linkedProject,
  messages,
  artifacts,
  isLoadingMessages,
  onMessagesChange,
  onWorkspaceTitleChange,
  onArtifactCreated,
  onMessageDeleted,
  onProjectLinked,
  onProjectUnlinked,
  onDeleteWorkspace,
}: ChatPanelProps) {
  const { userId } = useAuthReady()
  const { toast } = useToast()
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState<string | null>(null)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [treatmentDialog, setTreatmentDialog] = useState<CreativeMessage | null>(null)
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false)
  const [showDeleteWorkspace, setShowDeleteWorkspace] = useState(false)
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false)
  const [showLinkProject, setShowLinkProject] = useState(false)
  const [saveDialog, setSaveDialog] = useState<{ message: CreativeMessage; content: string } | null>(null)
  const [saveTitle, setSaveTitle] = useState("")
  const [saveLabel, setSaveLabel] = useState("")
  const [saveType, setSaveType] = useState<ArtifactType>("document")
  const [isSaving, setIsSaving] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(workspaceTitle)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTitleInput(workspaceTitle)
  }, [workspaceTitle])

  useEffect(() => {
    if (!scrollAreaRef.current) return
    const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
      })
    }
  }, [messages, isSending, artifacts])

  const handleSend = async (text?: string) => {
    const messageText = (text || input).trim()
    if (!messageText || !workspaceId || isSending) return

    setInput("")
    setIsSending(true)
    const isLikelyImageRequest = /\b(image|picture|visual|poster|cover|draw|visualize)\b/i.test(messageText)
    if (isLikelyImageRequest) {
      setIsGeneratingImage("pending")
    }

    const optimisticUser: CreativeMessage = {
      id: `temp-${Date.now()}`,
      workspace_id: workspaceId,
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    }
    onMessagesChange([...messages, optimisticUser])

    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to send message")
      }

      const data = await res.json()
      onMessagesChange([
        ...messages.filter((m) => m.id !== optimisticUser.id),
        data.userMessage,
        data.assistantMessage,
      ])

      if (data.imageGenerated) {
        toast({
          title: "Image generated",
          description: "Your image is now in the chat and the Images panel.",
        })
        onArtifactCreated(data.artifact)
      }

      if (workspaceTitle === "Untitled Project" && messages.length === 0) {
        const autoTitle = messageText.slice(0, 50) + (messageText.length > 50 ? "..." : "")
        onWorkspaceTitleChange(autoTitle)
      }
    } catch (error) {
      onMessagesChange(messages.filter((m) => m.id !== optimisticUser.id))
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
      setIsGeneratingImage(null)
    }
  }

  const handleSaveTitle = async () => {
    if (!workspaceId || !titleInput.trim()) return
    setEditingTitle(false)
    onWorkspaceTitleChange(titleInput.trim())
    await fetch(`/api/creative-workspace/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleInput.trim() }),
    })
  }

  const handleSuggestTitle = async () => {
    if (!workspaceId || isSuggestingTitle) return
    setIsSuggestingTitle(true)
    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/suggest-title`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to suggest title")
      onWorkspaceTitleChange(data.title)
      setTitleInput(data.title)
      toast({ title: "Title updated", description: data.title })
    } catch (error) {
      toast({
        title: "Could not suggest title",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setIsSuggestingTitle(false)
    }
  }

  const openSaveDialog = (message: CreativeMessage) => {
    setSaveDialog({ message, content: message.content })
    setSaveTitle(workspaceTitle !== "Untitled Project" ? `${workspaceTitle} - Note` : "Saved Document")
    setSaveLabel("")
    setSaveType("document")
  }

  const handleSaveArtifact = async () => {
    if (!workspaceId || !saveDialog) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact_type: saveType,
          title: saveTitle,
          label: saveLabel || null,
          content: saveDialog.content,
          message_id: saveDialog.message.id.startsWith("temp-") ? null : saveDialog.message.id,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }
      toast({ title: "Saved", description: "Document saved to your assets panel." })
      setSaveDialog(null)
      onArtifactCreated()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateImage = async (message: CreativeMessage) => {
    if (!workspaceId || !userId) return
    setIsGeneratingImage(message.id)

    try {
      const imagesSetting = await AISettingsService.getOrCreateDefaultTabSetting('images')
      const displayModel =
        imagesSetting.is_locked && imagesSetting.locked_model
          ? imagesSetting.locked_model
          : imagesSetting.selected_model || imagesSetting.locked_model || 'DALL-E 3'

      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Cinematic film still, ${message.content.slice(0, 500)}`,
          service: mapDisplayModelToService(displayModel),
          apiKey: "configured",
          userId,
          model: normalizeDisplayModelToApiId(displayModel),
          width: DEFAULT_CINEMATIC_IMAGE_WIDTH,
          height: DEFAULT_CINEMATIC_IMAGE_HEIGHT,
          autoSaveToBucket: true,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Image generation failed")
      }

      const data = await res.json()
      const imageUrl = data.imageUrl || data.url || data.image

      if (!imageUrl) throw new Error("No image returned")

      const artifactRes = await fetch(`/api/creative-workspace/${workspaceId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact_type: "image",
          title: `Image - ${new Date().toLocaleDateString()}`,
          content: imageUrl,
          message_id: message.id.startsWith("temp-") ? null : message.id,
          metadata: { prompt: message.content.slice(0, 500) },
        }),
      })

      if (!artifactRes.ok) throw new Error("Failed to save image")

      const artifactData = await artifactRes.json()
      toast({ title: "Image generated", description: "Your image is now in the chat and the Images panel." })
      onArtifactCreated(artifactData.artifact)
    } catch (error) {
      toast({
        title: "Image generation failed",
        description: error instanceof Error ? error.message : "Failed to generate image",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(null)
    }
  }

  const handleDeleteMessage = async (message: CreativeMessage) => {
    if (!workspaceId || message.id.startsWith("temp-")) return
    if (!confirm("Delete this message?")) return

    setDeletingMessageId(message.id)
    try {
      const res = await fetch(
        `/api/creative-workspace/${workspaceId}/messages/${message.id}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to delete message")
      }
      onMessageDeleted(message.id)
      toast({ title: "Message deleted" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete message",
        variant: "destructive",
      })
    } finally {
      setDeletingMessageId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!workspaceId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
        <Sparkles className="h-12 w-12 text-primary/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Start Developing Your Film</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Create a new workspace to chat with AI about characters, treatments, locations, and covers.
          Everything you create stays here and can be linked to your movie project later.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {linkedProject && (
        <div className="flex items-center justify-between gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <Film className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-muted-foreground flex-shrink-0">Linked to</span>
            <span className="font-medium truncate">{linkedProject.name}</span>
          </div>
          <Link
            href={`/viewmovie/${linkedProject.id}`}
            className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
          >
            View Movie
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {editingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              autoFocus
            />
            <Button size="sm" onClick={handleSaveTitle}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <button
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors truncate"
              onClick={() => setEditingTitle(true)}
            >
              <span className="truncate">{workspaceTitle}</span>
              <Pencil className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              title={linkedProject ? "Change linked movie" : "Link to movie"}
              onClick={() => setShowLinkProject(true)}
            >
              <Link2 className={cn("h-3.5 w-3.5", linkedProject ? "text-primary" : "text-muted-foreground")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              title="AI suggest title"
              onClick={handleSuggestTitle}
              disabled={isSuggestingTitle || messages.length === 0}
            >
              {isSuggestingTitle ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
              title="Delete workspace"
              onClick={() => setShowDeleteWorkspace(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        <div className="p-4 space-y-4 max-w-3xl mx-auto">
          {isLoadingMessages ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 space-y-6">
              <div>
                <Bot className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="font-medium mb-1">What are you working on?</h3>
                <p className="text-sm text-muted-foreground">
                  Describe your film idea, characters, or ask for a treatment.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 px-3 whitespace-normal text-left"
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const messageImages = message.role === "assistant" ? getMessageImages(message.id, artifacts) : []
              const isTreatment = message.role === "assistant" && detectTreatmentContent(message.content)
              return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 group",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="max-w-[85%] space-y-1">
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                  {messageImages.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {messageImages.map((url, i) => (
                        <div
                          key={`${message.id}-img-${i}`}
                          className="rounded-lg overflow-hidden border border-border bg-background"
                        >
                          <img
                            src={url}
                            alt="Generated"
                            className="w-full max-w-md object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {isTreatment && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary flex items-center justify-between gap-2">
                      <span>Treatment detected — save to a movie project</span>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setTreatmentDialog(message)}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Save to Movie
                      </Button>
                    </div>
                  )}
                  {message.role === "assistant" && (
                    <div className="flex flex-wrap gap-1">
                      {isTreatment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          onClick={() => setTreatmentDialog(message)}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Save to Movie
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => openSaveDialog(message)}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleGenerateImage(message)}
                        disabled={isGeneratingImage === message.id}
                      >
                        {isGeneratingImage === message.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <ImageIcon className="h-3 w-3 mr-1" />
                        )}
                        Generate Image
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteMessage(message)}
                        disabled={deletingMessageId === message.id}
                      >
                        {deletingMessageId === message.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                  {message.role === "user" && (
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteMessage(message)}
                        disabled={deletingMessageId === message.id}
                      >
                        {deletingMessageId === message.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
              )
            })
          )}
          {isSending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                {isGeneratingImage === "pending" && (
                  <span className="text-sm text-muted-foreground">Generating image from conversation...</span>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your character, ask for a treatment, brainstorm scenes..."
            className="min-h-[56px] max-h-[200px] resize-none"
            disabled={isSending}
          />
          <Button
            onClick={() => handleSend()}
            disabled={isSending || !input.trim()}
            size="icon"
            className="self-end h-[56px] w-[56px] flex-shrink-0"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {workspaceId && (
        <LinkProjectDialog
          open={showLinkProject}
          onOpenChange={setShowLinkProject}
          workspaceId={workspaceId}
          workspaceTitle={workspaceTitle}
          currentProjectId={linkedProject?.id}
          onLinked={({ projectId, projectName }) => {
            onProjectLinked(projectId, projectName)
            toast({ title: "Linked to movie", description: projectName })
          }}
          onUnlinked={() => {
            onProjectUnlinked()
            toast({ title: "Unlinked from movie" })
          }}
        />
      )}

      {treatmentDialog && workspaceId && (
        <SaveTreatmentDialog
          open={!!treatmentDialog}
          onOpenChange={(open) => !open && setTreatmentDialog(null)}
          workspaceId={workspaceId}
          messageId={treatmentDialog.id}
          parsed={parseTreatmentFields(treatmentDialog.content, workspaceTitle)}
          onSaved={({ updated, projectId, projectName }) => {
            toast({
              title: updated ? "Treatment updated" : "Treatment saved",
              description: `Linked to ${projectName}. Open Treatments or View Movie to edit.`,
            })
            onProjectLinked(projectId, projectName)
            onArtifactCreated()
            setTreatmentDialog(null)
          }}
        />
      )}

      <Dialog open={!!saveDialog} onOpenChange={(open) => !open && setSaveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Assets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="Character name, scene title..."
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={saveType} onValueChange={(v) => setSaveType(v as ArtifactType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground max-h-32 overflow-y-auto">
              {saveDialog?.content.slice(0, 300)}{(saveDialog?.content.length ?? 0) > 300 ? "..." : ""}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveArtifact} disabled={isSaving || !saveTitle.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteWorkspace} onOpenChange={setShowDeleteWorkspace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{workspaceTitle}&quot; and all its messages and artifacts. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingWorkspace}
              onClick={async () => {
                setIsDeletingWorkspace(true)
                try {
                  onDeleteWorkspace()
                  setShowDeleteWorkspace(false)
                } finally {
                  setIsDeletingWorkspace(false)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingWorkspace ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
