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
  MapPin,
  UserCircle,
  Paperclip,
  X,
  Clapperboard,
  Layers,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { CreativeMessage, ArtifactType, CreativeArtifact } from "@/lib/creative-workspace-types"
import {
  detectTreatmentContent,
  detectCharacterContent,
  detectLocationContent,
  parseTreatmentFields,
  parseTreatmentActs,
  getBestTreatmentActSource,
  parseCharacterFields,
  parseLocationFields,
  parseSceneFields,
  findSceneContentInThread,
  detectSceneContent,
  isSceneImportConfirmation,
  extractImportedSceneFromThread,
  resolveCreativeMessageContext,
  buildImagePromptText,
  detectImageRequest,
} from "@/lib/creative-chat-utils"
import { SaveTreatmentDialog } from "@/components/creative-workspace/save-treatment-dialog"
import { SaveCharacterDialog } from "@/components/creative-workspace/save-character-dialog"
import { SaveLocationDialog } from "@/components/creative-workspace/save-location-dialog"
import { SaveSceneDialog } from "@/components/creative-workspace/save-scene-dialog"
import { SaveAvatarImageDialog } from "@/components/creative-workspace/save-avatar-image-dialog"
import { LinkProjectDialog } from "@/components/creative-workspace/link-project-dialog"
import { CharactersService, type Character } from "@/lib/characters-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { AISettingsService } from "@/lib/ai-settings-service"
import { mapDisplayModelToService, normalizeDisplayModelToApiId, DEFAULT_CINEMATIC_IMAGE_WIDTH, DEFAULT_CINEMATIC_IMAGE_HEIGHT } from "@/lib/image-model-utils"
import { ContentViolationDialog } from "@/components/content-violation-dialog"
import { isContentPolicyError, isContentBlockedResponse } from "@/lib/content-policy-utils"
import {
  CREATIVE_IMPORT_ACCEPT,
  CREATIVE_IMPORT_MAX_BYTES,
  CREATIVE_IMPORT_MAX_FILES,
  extractCreativeDocumentText,
  isCreativeImportSupported,
  requiresDocumentExtraction,
  truncateDocumentText,
} from "@/lib/creative-workspace-import"

function getImageGeneratedDescription(
  content: string,
  context?: { isCharacter: boolean; isLocation: boolean },
): string {
  const isCharacter = detectCharacterContent(content) || context?.isCharacter
  const isLocation = (!isCharacter && detectLocationContent(content)) || context?.isLocation
  if (isCharacter) {
    return "Image ready — use Save to Character or Save as Avatar."
  }
  if (isLocation) {
    return "Image ready — use Save to Location."
  }
  return "Your image is now in the chat and the Images panel."
}

interface DialogTarget {
  message: CreativeMessage
  contextContent: string
  imageUrls?: string[]
}

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
  onArtifactDeleted?: (artifactId: string) => void
  onMessageDeleted: (messageId: string) => void
  onProjectLinked: (projectId: string, projectName: string) => void
  onProjectUnlinked: () => void
  onDeleteWorkspace: () => void
}

interface PendingFile {
  id: string
  file: File
  preview?: string
  textContent?: string
}

function getMessageImageArtifacts(messageId: string, artifacts: CreativeArtifact[]): CreativeArtifact[] {
  return artifacts.filter(
    (artifact) =>
      artifact.message_id === messageId &&
      artifact.content &&
      (artifact.content.startsWith("http") || artifact.content.startsWith("data:image/")),
  )
}

function getMessageImages(messageId: string, artifacts: CreativeArtifact[]): string[] {
  const urls = getMessageImageArtifacts(messageId, artifacts).map((artifact) => artifact.content!)
  return [...new Set(urls)]
}

function getImageContextContent(
  artifact: CreativeArtifact,
  fallbackContent: string,
): string {
  const slugline = artifact.metadata?.slugline
  if (typeof slugline === "string" && slugline.trim()) {
    return slugline
  }
  const prompt = artifact.metadata?.prompt
  if (typeof prompt === "string" && prompt.trim()) {
    return prompt
  }
  return fallbackContent
}

function getMessageDocuments(messageId: string, artifacts: CreativeArtifact[]): CreativeArtifact[] {
  return artifacts.filter(
    (a) => a.message_id === messageId && a.artifact_type === "document",
  )
}

function messageHasSavedScene(messageId: string, artifacts: CreativeArtifact[]): boolean {
  return artifacts.some(
    (a) =>
      a.message_id === messageId &&
      (a.artifact_type === "scene" ||
        typeof a.metadata?.screenplay_scene_id === "string" ||
        a.metadata?.imported === true),
  )
}

function getSavedSceneArtifact(
  messageId: string,
  artifacts: CreativeArtifact[],
): CreativeArtifact | undefined {
  return artifacts.find(
    (a) => a.message_id === messageId && a.artifact_type === "scene" && a.content,
  )
}

function getSceneArtifactNearMessage(
  messageIndex: number,
  messages: { id: string }[],
  artifacts: CreativeArtifact[],
): CreativeArtifact | undefined {
  const direct = getSavedSceneArtifact(messages[messageIndex]?.id, artifacts)
  if (direct) return direct
  if (messageIndex > 0) {
    return getSavedSceneArtifact(messages[messageIndex - 1].id, artifacts)
  }
  return undefined
}

function getSceneImportDebugFromArtifacts(
  messageId: string,
  artifacts: CreativeArtifact[],
): unknown | null {
  const artifact = artifacts.find(
    (a) => a.message_id === messageId && a.artifact_type === "scene",
  )
  return artifact?.metadata?.import_debug ?? null
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
  onArtifactDeleted,
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
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [treatmentDialog, setTreatmentDialog] = useState<{
    message: CreativeMessage
    treatmentContent: string
  } | null>(null)
  const [characterDialog, setCharacterDialog] = useState<DialogTarget | null>(null)
  const [locationDialog, setLocationDialog] = useState<DialogTarget | null>(null)
  const [sceneDialog, setSceneDialog] = useState<DialogTarget | null>(null)
  const [avatarDialog, setAvatarDialog] = useState<DialogTarget | null>(null)
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false)
  const [showDeleteWorkspace, setShowDeleteWorkspace] = useState(false)
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false)
  const [showLinkProject, setShowLinkProject] = useState(false)
  const [saveDialog, setSaveDialog] = useState<{ message: CreativeMessage; content: string } | null>(null)
  const [saveTitle, setSaveTitle] = useState("")
  const [saveLabel, setSaveLabel] = useState("")
  const [saveType, setSaveType] = useState<ArtifactType>("document")
  const [saveCharacterId, setSaveCharacterId] = useState("")
  const [saveLocationId, setSaveLocationId] = useState("")
  const [saveCharacters, setSaveCharacters] = useState<Character[]>([])
  const [saveLocations, setSaveLocations] = useState<Location[]>([])
  const [loadingSaveLinks, setLoadingSaveLinks] = useState(false)
  const [saveAsPrimaryImage, setSaveAsPrimaryImage] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingActs, setIsSavingActs] = useState(false)
  const [sceneImportDebugByMessageId, setSceneImportDebugByMessageId] = useState<Record<string, unknown>>({})
  const [viewSceneDialog, setViewSceneDialog] = useState<{ title: string; content: string } | null>(null)
  const [expandedSceneMessages, setExpandedSceneMessages] = useState<Set<string>>(new Set())
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(workspaceTitle)
  const [contentBlockedDialog, setContentBlockedDialog] = useState<{
    message: CreativeMessage
    prompt: string
  } | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)
  const [isExtractingFiles, setIsExtractingFiles] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    return () => {
      pendingFiles.forEach((pending) => {
        if (pending.preview) URL.revokeObjectURL(pending.preview)
      })
    }
  }, [pendingFiles])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files
    if (!selected || selected.length === 0) return

    const remainingSlots = CREATIVE_IMPORT_MAX_FILES - pendingFiles.length
    if (remainingSlots <= 0) {
      toast({
        title: "Too many files",
        description: `You can attach up to ${CREATIVE_IMPORT_MAX_FILES} files at a time.`,
        variant: "destructive",
      })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const files = Array.from(selected).slice(0, remainingSlots)
    setIsExtractingFiles(true)

    try {
      const nextPending: PendingFile[] = []

      for (const file of files) {
        if (!isCreativeImportSupported(file)) {
          toast({
            title: "Unsupported file",
            description: `${file.name} is not a supported file type.`,
            variant: "destructive",
          })
          continue
        }

        if (file.size > CREATIVE_IMPORT_MAX_BYTES) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the 20MB limit.`,
            variant: "destructive",
          })
          continue
        }

        const pending: PendingFile = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
        }

        if (file.type.startsWith("image/")) {
          pending.preview = URL.createObjectURL(file)
        } else if (requiresDocumentExtraction(file)) {
          try {
            const extracted = await extractCreativeDocumentText(file)
            if (!extracted?.trim()) {
              toast({
                title: "No text found",
                description: `Could not extract readable text from ${file.name}.`,
                variant: "destructive",
              })
              continue
            }
            pending.textContent = truncateDocumentText(extracted)
          } catch {
            toast({
              title: "Could not read file",
              description: `Failed to extract text from ${file.name}.`,
              variant: "destructive",
            })
            continue
          }
        }

        nextPending.push(pending)
      }

      if (nextPending.length > 0) {
        setPendingFiles((prev) => [...prev, ...nextPending])
      }
    } finally {
      setIsExtractingFiles(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((file) => file.id === id)
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return prev.filter((file) => file.id !== id)
    })
  }

  const handleSend = async (text?: string) => {
    const messageText = (text || input).trim()
    if ((!messageText && pendingFiles.length === 0) || !workspaceId || isSending || isUploadingFiles) return

    const filesToUpload = [...pendingFiles]
    setInput("")
    setPendingFiles([])
    setIsSending(true)
    setIsUploadingFiles(filesToUpload.length > 0)

    const isLikelyImageRequest = /\b(image|picture|visual|poster|cover|draw|visualize)\b/i.test(messageText)
    if (isLikelyImageRequest) {
      setIsGeneratingImage("pending")
    }

    const optimisticUser: CreativeMessage = {
      id: `temp-${Date.now()}`,
      workspace_id: workspaceId,
      role: "user",
      content: messageText || "Review my attached files.",
      created_at: new Date().toISOString(),
    }
    onMessagesChange([...messages, optimisticUser])

    try {
      let uploadedArtifacts: CreativeArtifact[] = []
      if (filesToUpload.length > 0) {
        const formData = new FormData()
        const textContents: Record<string, string> = {}
        filesToUpload.forEach((pending, index) => {
          formData.append("files", pending.file)
          if (pending.textContent) textContents[String(index)] = pending.textContent
        })
        if (Object.keys(textContents).length > 0) {
          formData.append("textContents", JSON.stringify(textContents))
        }
        if (linkedProject?.id) {
          formData.append("projectId", linkedProject.id)
        }

        const uploadRes = await fetch(`/api/creative-workspace/${workspaceId}/import-files`, {
          method: "POST",
          body: formData,
        })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          throw new Error(err.error || "Failed to upload files")
        }
        const uploadData = await uploadRes.json()
        uploadedArtifacts = uploadData.artifacts || []
        uploadedArtifacts.forEach((artifact) => onArtifactCreated(artifact))
        if (uploadData.syncedAssetIds?.length > 0 && linkedProject?.name) {
          toast({
            title: "Saved to movie assets",
            description: `${uploadData.syncedAssetIds.length} file${uploadData.syncedAssetIds.length === 1 ? "" : "s"} added to ${linkedProject.name}.`,
          })
        } else if (filesToUpload.length > 0 && !linkedProject) {
          toast({
            title: "Files uploaded",
            description: "Link a movie project to save imports to movie assets.",
          })
        }
      }

      filesToUpload.forEach((pending) => {
        if (pending.preview) URL.revokeObjectURL(pending.preview)
      })

      const res = await fetch(`/api/creative-workspace/${workspaceId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          artifactIds: uploadedArtifacts.map((artifact) => artifact.id),
          projectId: linkedProject?.id,
        }),
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

      if (data.attachmentArtifacts?.length) {
        data.attachmentArtifacts.forEach((artifact: CreativeArtifact) => onArtifactCreated(artifact))
      }

      if (data.imageGenerated) {
        const assistantContent = data.assistantMessage?.content || ""
        const generatedCount = Array.isArray(data.imageArtifacts) ? data.imageArtifacts.length : 1
        toast({
          title: generatedCount > 1 ? `${generatedCount} images generated` : "Image generated",
          description: data.imageContextUsed === false
            ? "Images were generated without screenplay context — attach your PDF or link your project for better results."
            : getImageGeneratedDescription(assistantContent),
        })
        if (Array.isArray(data.imageArtifacts) && data.imageArtifacts.length > 0) {
          data.imageArtifacts.forEach((item: CreativeArtifact) => onArtifactCreated(item))
        } else if (data.artifact) {
          onArtifactCreated(data.artifact)
        }
      } else if (data.wantsImage) {
        toast({
          title: "Image generation failed",
          description:
            data.imageGenerationError ||
            "OpenAI image API did not return an image. Check AI settings and try again.",
          variant: "destructive",
        })
      }

      if (data.sceneImported && data.sceneImportArtifact) {
        onArtifactCreated(data.sceneImportArtifact)

        if (data.sceneImportDebug) {
          console.group("[scene-import] Debug")
          console.log("Full debug payload:", data.sceneImportDebug)
          console.log("Extracted chars:", data.sceneImportDebug?.extraction?.finalChars)
          console.log("Prior parts:", data.sceneImportDebug?.extraction?.priorParts)
          console.log("Screenplay sync:", data.sceneImportDebug?.screenplaySync)
          console.groupEnd()

          setSceneImportDebugByMessageId((prev) => ({
            ...prev,
            [data.userMessage.id]: data.sceneImportDebug,
            [data.assistantMessage.id]: data.sceneImportDebug,
          }))
        }

        const charCount =
          typeof data.sceneImportArtifact.metadata?.character_count === 'number'
            ? data.sceneImportArtifact.metadata.character_count
            : data.sceneImportArtifact.content?.length
        toast({
          title: "Scene imported in full",
          description: charCount
            ? `${data.sceneImportArtifact.title} saved (${charCount.toLocaleString()} characters) to movie scenes and assets.`
            : `${data.sceneImportArtifact.title} saved verbatim to movie scenes and assets.`,
        })
      }

      if (workspaceTitle === "Untitled Project" && messages.length === 0) {
        const autoTitleSource = messageText || filesToUpload[0]?.file.name || "Imported Project"
        const autoTitle = autoTitleSource.slice(0, 50) + (autoTitleSource.length > 50 ? "..." : "")
        onWorkspaceTitleChange(autoTitle)
      }
    } catch (error) {
      onMessagesChange(messages.filter((m) => m.id !== optimisticUser.id))
      setPendingFiles(filesToUpload)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
      setIsUploadingFiles(false)
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

  const openSaveDialog = async (message: CreativeMessage, contextContent?: string) => {
    const source = contextContent || message.content
    const isTreatment = detectTreatmentContent(source)
    const isCharacter = !isTreatment && detectCharacterContent(source)
    const isLocation = !isTreatment && !isCharacter && detectLocationContent(source)
    const parsedTreatment = isTreatment ? parseTreatmentFields(source, workspaceTitle) : null
    const parsedCharacter = isCharacter ? parseCharacterFields(source, workspaceTitle) : null
    const parsedLocation = isLocation ? parseLocationFields(source, workspaceTitle) : null
    const projectId = linkedProject?.id || ""
    setSaveDialog({ message, content: message.content })
    setSaveTitle(
      parsedTreatment?.title
        ? `${parsedTreatment.title} - Treatment`
        : parsedCharacter?.name
          ? `${parsedCharacter.name} - Character`
          : parsedLocation?.name
            ? `${parsedLocation.name} - Location`
            : workspaceTitle !== "Untitled Project"
              ? `${workspaceTitle} - Note`
              : "Saved Document",
    )
    setSaveLabel(
      parsedTreatment?.title || parsedCharacter?.name || parsedLocation?.name || "",
    )
    setSaveType(
      isTreatment ? "treatment" : isCharacter ? "character" : isLocation ? "location" : "document",
    )
    setSaveCharacterId("")
    setSaveLocationId("")
    setSaveAsPrimaryImage(true)
    if (projectId) {
      setLoadingSaveLinks(true)
      try {
        const [characters, locations] = await Promise.all([
          CharactersService.getCharacters(projectId),
          LocationsService.getLocations(projectId),
        ])
        setSaveCharacters(characters)
        setSaveLocations(locations)
        if (parsedCharacter?.name) {
          const match = characters.find(
            (character) => character.name.toLowerCase() === parsedCharacter.name.toLowerCase(),
          )
          if (match) setSaveCharacterId(match.id)
        }
        if (parsedLocation?.name) {
          const match = locations.find(
            (location) => location.name.toLowerCase() === parsedLocation.name.toLowerCase(),
          )
          if (match) setSaveLocationId(match.id)
        }
      } catch {
        setSaveCharacters([])
        setSaveLocations([])
      } finally {
        setLoadingSaveLinks(false)
      }
    } else {
      setSaveCharacters([])
      setSaveLocations([])
    }
  }

  const handleSaveActs = async (
    message: CreativeMessage,
    actSource: string,
    actCount: number,
  ) => {
    if (!workspaceId || actCount === 0) return

    setIsSavingActs(true)
    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/save-treatment-acts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: actSource,
          projectId: linkedProject?.id || null,
          messageId: message.id.startsWith("temp-") ? null : message.id,
          title: workspaceTitle !== "Untitled Project" ? workspaceTitle : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save acts")

      onArtifactCreated()
      toast({
        title: "Acts saved",
        description: `${data.count || actCount} act${actCount === 1 ? "" : "s"} saved to Created Assets → Acts.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save acts",
        variant: "destructive",
      })
    } finally {
      setIsSavingActs(false)
    }
  }

  const handleSaveArtifact = async () => {
    if (!workspaceId || !saveDialog) return

    const imageArtifacts = getMessageImageArtifacts(saveDialog.message.id, artifacts)
    const hasImages = imageArtifacts.length > 0
    const projectId = linkedProject?.id || null

    if (hasImages && (saveType === "character" || saveType === "location")) {
      if (!projectId) {
        toast({
          title: "Project required",
          description: "Link a movie project to save this image to a character or location.",
          variant: "destructive",
        })
        return
      }

      const creatingCharacter = saveType === "character" && saveCharacterId === "__new__"
      const creatingLocation = saveType === "location" && saveLocationId === "__new__"
      const selectedCharacter =
        saveType === "character" && saveCharacterId && saveCharacterId !== "__new__"
          ? saveCharacters.find((character) => character.id === saveCharacterId)
          : null
      const selectedLocation =
        saveType === "location" && saveLocationId && saveLocationId !== "__new__"
          ? saveLocations.find((location) => location.id === saveLocationId)
          : null

      if (saveType === "character" && !selectedCharacter && !creatingCharacter) {
        toast({
          title: "Character required",
          description: "Choose an existing character or create a new one.",
          variant: "destructive",
        })
        return
      }

      if (saveType === "location" && !selectedLocation && !creatingLocation) {
        toast({
          title: "Location required",
          description: "Choose an existing location or create a new one.",
          variant: "destructive",
        })
        return
      }

      if (creatingCharacter && !saveLabel.trim()) {
        toast({
          title: "Name required",
          description: "Enter a name for the new character.",
          variant: "destructive",
        })
        return
      }

      if (creatingLocation && !saveLabel.trim()) {
        toast({
          title: "Name required",
          description: "Enter a name for the new location.",
          variant: "destructive",
        })
        return
      }

      const label =
        saveType === "character"
          ? selectedCharacter?.name || saveLabel.trim()
          : selectedLocation?.name || saveLabel.trim()

      setIsSaving(true)
      try {
        let syncMessage: string | null = null
        for (const artifact of imageArtifacts) {
          const res = await fetch(
            `/api/creative-workspace/${workspaceId}/artifacts/${artifact.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: saveTitle.trim() || artifact.title,
                label,
                project_id: projectId,
                character_id:
                  saveType === "character" && selectedCharacter ? selectedCharacter.id : null,
                location_id:
                  saveType === "location" && selectedLocation ? selectedLocation.id : null,
                create_character: creatingCharacter,
                create_location: creatingLocation,
                set_as_primary_image: saveAsPrimaryImage,
                sync_to_project: true,
              }),
            },
          )
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || "Failed to save image")
          }
          const result = await res.json()
          if (result.artifact) onArtifactCreated(result.artifact)
          syncMessage = result.syncMessage || syncMessage
        }

        toast({
          title: "Saved to project",
          description:
            syncMessage ||
            `Image linked to ${label} in ${linkedProject?.name || "your project"}.`,
        })
        setSaveDialog(null)
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (saveType === "treatment") {
      setIsSaving(true)
      try {
        const parsed = parseTreatmentFields(saveDialog.content, workspaceTitle)
        if (projectId) {
          const res = await fetch(`/api/creative-workspace/${workspaceId}/save-treatment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: saveTitle.trim() || parsed.title,
              genre: parsed.genre,
              logline: parsed.logline,
              synopsis: parsed.synopsis,
              prompt: saveDialog.content,
              projectId,
              messageId: saveDialog.message.id.startsWith("temp-") ? null : saveDialog.message.id,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Failed to save treatment")
          onArtifactCreated()
          const actCount = Array.isArray(data.acts) ? data.acts.length : 0
          toast({
            title: data.updated ? "Treatment updated" : "Treatment saved",
            description:
              actCount > 0
                ? `Saved to ${linkedProject?.name || "your project"} with ${actCount} acts in Created Assets → Treatments.`
                : `Saved to ${linkedProject?.name || "your project"}. View it in Created Assets → Treatments.`,
          })
        } else {
          const res = await fetch(`/api/creative-workspace/${workspaceId}/artifacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              artifact_type: "treatment",
              title: saveTitle.trim() || parsed.title,
              label: saveLabel || "Treatment",
              content: saveDialog.content,
              message_id: saveDialog.message.id.startsWith("temp-") ? null : saveDialog.message.id,
            }),
          })
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || "Failed to save")
          }
          const data = await res.json()
          onArtifactCreated(data.artifact)
          toast({
            title: "Treatment saved",
            description: "Saved to Created Assets. Link a movie project to sync to Treatments.",
          })
        }
        setSaveDialog(null)
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save treatment",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
      return
    }

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

  const handleGenerateImage = async (
    message: CreativeMessage,
    promptOverride?: string,
  ) => {
    if (!workspaceId || !userId) return
    setIsGeneratingImage(message.id)

    try {
      const messageIndex = messages.findIndex((m) => m.id === message.id)
      const history = messages
        .slice(0, messageIndex + 1)
        .map((m) => ({ role: m.role, content: m.content }))
      const priorUserImage = [...history].reverse().find(
        (m) => m.role === "user" && detectImageRequest(m.content),
      )
      const userMessage = priorUserImage?.content || message.content
      const imagePrompt = promptOverride ?? buildImagePromptText(history, userMessage)

      const imagesSetting = await AISettingsService.getOrCreateDefaultTabSetting('images')
      const displayModel =
        imagesSetting.is_locked && imagesSetting.locked_model
          ? imagesSetting.locked_model
          : imagesSetting.selected_model || imagesSetting.locked_model || 'DALL-E 3'

      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          service: mapDisplayModelToService(displayModel),
          apiKey: "configured",
          userId,
          model: normalizeDisplayModelToApiId(displayModel),
          width: DEFAULT_CINEMATIC_IMAGE_WIDTH,
          height: DEFAULT_CINEMATIC_IMAGE_HEIGHT,
          autoSaveToBucket: true,
        }),
      })

      const err = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (isContentBlockedResponse(err)) {
          setContentBlockedDialog({ message, prompt: imagePrompt })
          return
        }
        throw new Error(err.error || "Image generation failed")
      }

      const data = err
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
          metadata: { prompt: imagePrompt.slice(0, 500) },
        }),
      })

      if (!artifactRes.ok) throw new Error("Failed to save image")

      const artifactData = await artifactRes.json()
      const ctx = messageIndex >= 0
        ? resolveCreativeMessageContext(message, messageIndex, messages, workspaceTitle)
        : undefined
      toast({
        title: "Image generated",
        description: getImageGeneratedDescription(message.content, ctx),
      })
      onArtifactCreated(artifactData.artifact)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate image"
      if (isContentPolicyError(errorMessage)) {
        const messageIndex = messages.findIndex((m) => m.id === message.id)
        const history = messages
          .slice(0, messageIndex + 1)
          .map((m) => ({ role: m.role, content: m.content }))
        const priorUserImage = [...history].reverse().find(
          (m) => m.role === "user" && detectImageRequest(m.content),
        )
        const userMessage = priorUserImage?.content || message.content
        setContentBlockedDialog({
          message,
          prompt: promptOverride ?? buildImagePromptText(history, userMessage),
        })
        return
      }
      toast({
        title: "Image generation failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(null)
    }
  }

  const handleDeleteImageArtifact = async (artifact: CreativeArtifact) => {
    if (!workspaceId) return
    if (!confirm("Delete this image?")) return

    setDeletingImageId(artifact.id)
    try {
      const res = await fetch(
        `/api/creative-workspace/${workspaceId}/artifacts/${artifact.id}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete image")
      }
      onArtifactDeleted?.(artifact.id)
      toast({ title: "Image deleted" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete image",
        variant: "destructive",
      })
    } finally {
      setDeletingImageId(null)
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
            messages.map((message, messageIndex) => {
              const messageImageArtifacts = getMessageImageArtifacts(message.id, artifacts)
              const messageImages = messageImageArtifacts.map((artifact) => artifact.content!)
              const messageDocuments = getMessageDocuments(message.id, artifacts)
              const messageContext = message.role === "assistant"
                ? resolveCreativeMessageContext(message, messageIndex, messages, workspaceTitle)
                : {
                    isCharacter: false,
                    isLocation: false,
                    isTreatment: false,
                    contextContent: message.content,
                    treatmentContent: null,
                  }
              const isCurrentMessageScene =
                message.role === "assistant" && detectSceneContent(message.content)
              const treatmentContent = isCurrentMessageScene
                ? null
                : messageContext.treatmentContent ||
                  (detectTreatmentContent(message.content) ? message.content : null)
              const actSource = isCurrentMessageScene
                ? ""
                : getBestTreatmentActSource(message.content, treatmentContent)
              const detectedActs = actSource ? parseTreatmentActs(actSource) : []
              const isTreatment =
                message.role === "assistant" &&
                !isCurrentMessageScene &&
                (!!treatmentContent || detectedActs.length > 0)
              const isCharacter =
                message.role === "assistant" && messageContext.isCharacter && !isTreatment && !isCurrentMessageScene
              const isLocation =
                message.role === "assistant" && messageContext.isLocation && !isTreatment && !isCurrentMessageScene
              const sceneSource = isCurrentMessageScene
                ? message.content
                : message.role === "user"
                  ? message.content
                  : findSceneContentInThread(
                      messages.map((m) => ({ role: m.role, content: m.content })),
                      messageIndex,
                    ) || messageContext.contextContent
              const parsedScenePreview = isCurrentMessageScene
                ? parseSceneFields(message.content, workspaceTitle)
                : null
              const sceneAlreadySaved = messageHasSavedScene(message.id, artifacts)
              const isSceneImportReply =
                message.role === "assistant" && isSceneImportConfirmation(message.content)
              const sceneImportDebug =
                sceneImportDebugByMessageId[message.id] ||
                getSceneImportDebugFromArtifacts(message.id, artifacts)
              const isScene =
                !sceneAlreadySaved &&
                !isSceneImportReply &&
                !isTreatment &&
                detectSceneContent(sceneSource)
              const openCharacterDialog = () =>
                setCharacterDialog({ message, contextContent: messageContext.contextContent })
              const openLocationDialog = () =>
                setLocationDialog({ message, contextContent: messageContext.contextContent })
              const openSceneDialog = () => {
                const contentToSave = isCurrentMessageScene
                  ? message.content
                  : sceneSource
                const priorMessages = messages
                  .slice(0, messageIndex)
                  .map((m) => ({ role: m.role, content: m.content }))
                const threadImport = extractImportedSceneFromThread(priorMessages, contentToSave, {
                  collectDebug: true,
                })
                console.group("[scene-import] Save dialog preview")
                console.log(threadImport.debug)
                console.groupEnd()
                setSceneDialog({
                  message,
                  contextContent: threadImport.content || contentToSave,
                })
              }
              const openAvatarDialog = () =>
                setAvatarDialog({ message, contextContent: messageContext.contextContent })
              const savedSceneArtifact = getSceneArtifactNearMessage(messageIndex, messages, artifacts)
              const savedSceneChars =
                savedSceneArtifact?.content?.length ||
                (sceneImportDebug as { extraction?: { finalChars?: number } } | null)?.extraction
                  ?.finalChars ||
                null
              const isLongUserScene =
                message.role === "user" &&
                sceneAlreadySaved &&
                message.content.length > 600
              const isSceneMessageExpanded = expandedSceneMessages.has(message.id)
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
                  {isLongUserScene && !isSceneMessageExpanded && (
                    <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-[10px] text-cyan-600 dark:text-cyan-400">
                      Long scene paste ({message.content.length.toLocaleString()} chars) — scroll inside the message or view the saved scene below.
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                      isLongUserScene && !isSceneMessageExpanded && "max-h-48 overflow-y-auto",
                    )}
                  >
                    {message.content}
                  </div>
                  {isLongUserScene && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-cyan-600 dark:text-cyan-400"
                      onClick={() =>
                        setExpandedSceneMessages((prev) => {
                          const next = new Set(prev)
                          if (next.has(message.id)) next.delete(message.id)
                          else next.add(message.id)
                          return next
                        })
                      }
                    >
                      {isSceneMessageExpanded ? "Collapse message" : "Expand full message"}
                    </Button>
                  )}
                  {messageDocuments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {messageDocuments.map((doc) => (
                        <a
                          key={doc.id}
                          href={typeof doc.metadata?.url === "string" ? doc.metadata.url : doc.content || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                            message.role === "user"
                              ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
                              : "border-border bg-background text-foreground",
                          )}
                        >
                          <FileText className="h-3 w-3" />
                          {typeof doc.metadata?.originalName === "string"
                            ? doc.metadata.originalName
                            : doc.title}
                        </a>
                      ))}
                    </div>
                  )}
                  {messageImageArtifacts.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {messageImageArtifacts.map((artifact, i) => (
                        <div
                          key={artifact.id}
                          className="rounded-lg overflow-hidden border border-border bg-background"
                        >
                          {artifact.label && (
                            <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/40">
                              {artifact.label}
                            </div>
                          )}
                          <img
                            src={artifact.content!}
                            alt={artifact.label || `Generated image ${i + 1}`}
                            className="w-full max-w-md object-cover"
                          />
                          <div className="flex flex-wrap gap-1 px-2 py-1.5 border-t border-border bg-muted/20">
                            {(isLocation || messageImageArtifacts.length > 1) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-amber-600 dark:text-amber-400"
                                onClick={() =>
                                  setLocationDialog({
                                    message,
                                    contextContent: getImageContextContent(
                                      artifact,
                                      messageContext.contextContent,
                                    ),
                                    imageUrls: [artifact.content!],
                                  })
                                }
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                Save to Location
                              </Button>
                            )}
                            {isCharacter && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-violet-600 dark:text-violet-400"
                                onClick={() =>
                                  setAvatarDialog({
                                    message,
                                    contextContent: getImageContextContent(
                                      artifact,
                                      messageContext.contextContent,
                                    ),
                                    imageUrls: [artifact.content!],
                                  })
                                }
                              >
                                <UserCircle className="h-3 w-3 mr-1" />
                                Save as Avatar
                              </Button>
                            )}
                            {!isLocation && !isCharacter && messageImageArtifacts.length === 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() =>
                                  openSaveDialog(
                                    message,
                                    getImageContextContent(artifact, messageContext.contextContent),
                                  )
                                }
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive ml-auto"
                              onClick={() => handleDeleteImageArtifact(artifact)}
                              disabled={deletingImageId === artifact.id}
                            >
                              {deletingImageId === artifact.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isTreatment && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Treatment detected
                        {detectedActs.length > 0
                          ? ` — ${detectedActs.length} act${detectedActs.length === 1 ? "" : "s"} found`
                          : " — save to a movie project"}
                      </span>
                      <div className="flex flex-wrap gap-1 shrink-0">
                        {detectedActs.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-primary/40"
                            disabled={isSavingActs}
                            onClick={() => void handleSaveActs(message, actSource, detectedActs.length)}
                          >
                            {isSavingActs ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Layers className="h-3 w-3 mr-1" />
                            )}
                            Save Acts
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            setTreatmentDialog({
                              message,
                              treatmentContent: actSource || treatmentContent || message.content,
                            })
                          }
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Save to Movie
                        </Button>
                      </div>
                    </div>
                  )}
                  {isCharacter && (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Character detected — save profile
                        {messageImages.length > 0 ? " or avatar image" : ""}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={openCharacterDialog}
                        >
                          <User className="h-3 w-3 mr-1" />
                          Save to Character
                        </Button>
                        {messageImages.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-500/40"
                            onClick={openAvatarDialog}
                          >
                            <UserCircle className="h-3 w-3 mr-1" />
                            Save as Avatar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {isLocation && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Location detected — save to Location
                        {messageImages.length > 0 ? " with image" : ""}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={openLocationDialog}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          Save to Location
                        </Button>
                      </div>
                    </div>
                  )}
                  {isScene && !isTreatment && (
                    <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-400 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Scene detected
                        {parsedScenePreview?.sceneNumber
                          ? ` — Scene ${parsedScenePreview.sceneNumber}`
                          : ""}
                        {parsedScenePreview?.location
                          ? ` · ${parsedScenePreview.location}`
                          : " — save to screenplay"}
                      </span>
                      <Button
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={openSceneDialog}
                      >
                        <Clapperboard className="h-3 w-3 mr-1" />
                        Save to Scene
                      </Button>
                    </div>
                  )}
                  {sceneAlreadySaved && (
                    <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-600 dark:text-cyan-400 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clapperboard className="h-3 w-3" />
                        Scene saved
                        {savedSceneChars
                          ? ` (${savedSceneChars.toLocaleString()} characters)`
                          : " to movie"}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {savedSceneArtifact?.content && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              setViewSceneDialog({
                                title: savedSceneArtifact.title || "Imported Scene",
                                content: savedSceneArtifact.content!,
                              })
                            }
                          >
                            View full scene
                          </Button>
                        )}
                        {linkedProject?.id && (
                          <Button size="sm" className="h-7 text-xs" asChild>
                            <Link href={`/screenplay/${linkedProject.id}`}>
                              Open Screenplay
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {isSceneImportReply && sceneImportDebug && (
                    <details className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                      <summary className="cursor-pointer font-medium">
                        Scene import debug
                      </summary>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed text-yellow-900/90 dark:text-yellow-100/90">
                        {JSON.stringify(sceneImportDebug, null, 2)}
                      </pre>
                    </details>
                  )}
                  {isSceneImportReply && savedSceneArtifact?.content && (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          setViewSceneDialog({
                            title: savedSceneArtifact.title || "Imported Scene",
                            content: savedSceneArtifact.content!,
                          })
                        }
                      >
                        View full scene ({savedSceneArtifact.content!.length.toLocaleString()} chars)
                      </Button>
                      {linkedProject?.id && (
                        <Button size="sm" className="h-7 text-xs" asChild>
                          <Link href={`/screenplay/${linkedProject.id}`}>
                            Open Screenplay
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                  {message.role === "assistant" && (
                    <div className="flex flex-wrap gap-1">
                      {isTreatment && detectedActs.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          disabled={isSavingActs}
                          onClick={() => void handleSaveActs(message, actSource, detectedActs.length)}
                        >
                          {isSavingActs ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Layers className="h-3 w-3 mr-1" />
                          )}
                          Save Acts
                        </Button>
                      )}
                      {isTreatment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          onClick={() =>
                            setTreatmentDialog({
                              message,
                              treatmentContent: actSource || treatmentContent || message.content,
                            })
                          }
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Save to Movie
                        </Button>
                      )}
                      {isCharacter && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-600 dark:text-emerald-400"
                          onClick={openCharacterDialog}
                        >
                          <User className="h-3 w-3 mr-1" />
                          Save to Character
                        </Button>
                      )}
                      {messageImages.length > 0 && isCharacter && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-violet-600 dark:text-violet-400"
                          onClick={openAvatarDialog}
                        >
                          <UserCircle className="h-3 w-3 mr-1" />
                          Save as Avatar
                        </Button>
                      )}
                      {isLocation && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-amber-600 dark:text-amber-400"
                          onClick={openLocationDialog}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          Save to Location
                        </Button>
                      )}
                      {isScene && !isTreatment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-cyan-600 dark:text-cyan-400"
                          onClick={openSceneDialog}
                        >
                          <Clapperboard className="h-3 w-3 mr-1" />
                          Save to Scene
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => openSaveDialog(message, messageContext.contextContent)}
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
        <div className="max-w-3xl mx-auto space-y-2">
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((pending) => (
                <div
                  key={pending.id}
                  className="relative flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-xs"
                >
                  {pending.preview ? (
                    <img
                      src={pending.preview}
                      alt={pending.file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-background">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="max-w-[140px] truncate">{pending.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removePendingFile(pending.id)}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${pending.file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={CREATIVE_IMPORT_ACCEPT}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="self-end h-[56px] w-[56px] flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isUploadingFiles || isExtractingFiles || pendingFiles.length >= CREATIVE_IMPORT_MAX_FILES}
              title="Import photos or files"
            >
              {isUploadingFiles || isExtractingFiles ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your character, ask for a treatment, or attach photos/files..."
              className="min-h-[56px] max-h-[200px] resize-none"
              disabled={isSending || isUploadingFiles || isExtractingFiles}
            />
            <Button
              onClick={() => handleSend()}
              disabled={isSending || isUploadingFiles || isExtractingFiles || (!input.trim() && pendingFiles.length === 0)}
              size="icon"
              className="self-end h-[56px] w-[56px] flex-shrink-0"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
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
          messageId={treatmentDialog.message.id}
          parsed={parseTreatmentFields(treatmentDialog.treatmentContent, workspaceTitle)}
          linkedProjectId={linkedProject?.id}
          linkedProjectName={linkedProject?.name}
          onSaved={({ updated, projectId, projectName }) => {
            onProjectLinked(projectId, projectName)
            onArtifactCreated()
            toast({
              title: updated ? "Treatment updated" : "Treatment saved",
              description: `Linked to ${projectName}. Acts and treatment appear in Created Assets → Treatments.`,
            })
            setTreatmentDialog(null)
          }}
        />
      )}

      {characterDialog && workspaceId && (
        <SaveCharacterDialog
          open={!!characterDialog}
          onOpenChange={(open) => !open && setCharacterDialog(null)}
          workspaceId={workspaceId}
          workspaceTitle={workspaceTitle}
          messageId={characterDialog.message.id}
          parsed={parseCharacterFields(characterDialog.contextContent, workspaceTitle)}
          imageUrls={characterDialog.imageUrls ?? getMessageImages(characterDialog.message.id, artifacts)}
          linkedProjectId={linkedProject?.id}
          linkedProjectName={linkedProject?.name}
          onSaved={({ updated, projectId, projectName, characterName }) => {
            toast({
              title: updated ? "Character updated" : "Character saved",
              description: `${characterName} saved to ${projectName}. Open Characters or Avatars to edit.`,
            })
            onProjectLinked(projectId, projectName)
            onArtifactCreated()
            setCharacterDialog(null)
          }}
        />
      )}

      {locationDialog && workspaceId && (
        <SaveLocationDialog
          open={!!locationDialog}
          onOpenChange={(open) => !open && setLocationDialog(null)}
          workspaceId={workspaceId}
          workspaceTitle={workspaceTitle}
          messageId={locationDialog.message.id}
          parsed={parseLocationFields(locationDialog.contextContent, workspaceTitle)}
          imageUrls={locationDialog.imageUrls ?? getMessageImages(locationDialog.message.id, artifacts)}
          linkedProjectId={linkedProject?.id}
          linkedProjectName={linkedProject?.name}
          onSaved={({ updated, projectId, projectName, locationName }) => {
            toast({
              title: updated ? "Location updated" : "Location saved",
              description: `${locationName} saved to ${projectName}. Open Locations to edit.`,
            })
            onProjectLinked(projectId, projectName)
            onArtifactCreated()
            setLocationDialog(null)
          }}
        />
      )}

      {sceneDialog && workspaceId && (
        <SaveSceneDialog
          open={!!sceneDialog}
          onOpenChange={(open) => !open && setSceneDialog(null)}
          workspaceId={workspaceId}
          workspaceTitle={workspaceTitle}
          messageId={sceneDialog.message.id}
          parsed={parseSceneFields(sceneDialog.contextContent, workspaceTitle)}
          linkedProjectId={linkedProject?.id}
          linkedProjectName={linkedProject?.name}
          onSaved={({ updated, projectId, projectName, sceneName }) => {
            toast({
              title: updated ? "Scene updated" : "Scene saved",
              description: `${sceneName} saved to ${projectName}. Open the Scenes tab or Screenplay to edit.`,
            })
            onProjectLinked(projectId, projectName)
            onArtifactCreated()
            setSceneDialog(null)
          }}
        />
      )}

      {avatarDialog && workspaceId && (
        <SaveAvatarImageDialog
          open={!!avatarDialog}
          onOpenChange={(open) => !open && setAvatarDialog(null)}
          workspaceId={workspaceId}
          workspaceTitle={workspaceTitle}
          messageId={avatarDialog.message.id}
          imageUrls={avatarDialog.imageUrls ?? getMessageImages(avatarDialog.message.id, artifacts)}
          suggestedCharacterName={parseCharacterFields(avatarDialog.contextContent, workspaceTitle).name}
          prompt={avatarDialog.contextContent}
          linkedProjectId={linkedProject?.id}
          linkedProjectName={linkedProject?.name}
          onSaved={({ projectId, projectName, characterName, angleLabel }) => {
            toast({
              title: "Avatar image saved",
              description: `${characterName} — ${angleLabel} saved to Avatars for ${projectName}.`,
            })
            onProjectLinked(projectId, projectName)
            onArtifactCreated()
            setAvatarDialog(null)
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
              <Label>Type</Label>
              <Select
                value={saveType}
                onValueChange={(v) => {
                  setSaveType(v as ArtifactType)
                  setSaveCharacterId("")
                  setSaveLocationId("")
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(saveType === "character" || saveType === "location") &&
            getMessageImageArtifacts(saveDialog?.message.id || "", artifacts).length > 0 ? (
              <div className="space-y-3 rounded-lg border border-border/60 p-3 bg-muted/20">
                {linkedProject ? (
                  <p className="text-sm text-muted-foreground">
                    Saving to <span className="font-medium text-foreground">{linkedProject.name}</span>
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Link this workspace to a movie project to save images to characters or locations.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowLinkProject(true)}>
                      Link project
                    </Button>
                  </div>
                )}

                {saveType === "character" && (
                  <div className="space-y-2">
                    <Label>Character</Label>
                    <Select
                      value={saveCharacterId || (saveLabel.trim() ? "__new__" : "")}
                      onValueChange={setSaveCharacterId}
                      disabled={!linkedProject?.id || loadingSaveLinks}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !linkedProject?.id
                              ? "Link a project first"
                              : loadingSaveLinks
                                ? "Loading characters..."
                                : "Choose a character"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">
                          Create new{saveLabel.trim() ? `: ${saveLabel.trim()}` : " character"}
                        </SelectItem>
                        {saveCharacters.map((character) => (
                          <SelectItem key={character.id} value={character.id}>
                            {character.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {saveCharacterId === "__new__" && (
                      <Input
                        value={saveLabel}
                        onChange={(e) => setSaveLabel(e.target.value)}
                        placeholder="New character name"
                      />
                    )}
                  </div>
                )}

                {saveType === "location" && (
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select
                      value={saveLocationId || (saveLabel.trim() ? "__new__" : "")}
                      onValueChange={setSaveLocationId}
                      disabled={!linkedProject?.id || loadingSaveLinks}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !linkedProject?.id
                              ? "Link a project first"
                              : loadingSaveLinks
                                ? "Loading locations..."
                                : "Choose a location"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">
                          Create new{saveLabel.trim() ? `: ${saveLabel.trim()}` : " location"}
                        </SelectItem>
                        {saveLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {saveLocationId === "__new__" && (
                      <Input
                        value={saveLabel}
                        onChange={(e) => setSaveLabel(e.target.value)}
                        placeholder="New location name"
                      />
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={saveAsPrimaryImage}
                    onCheckedChange={(checked) => setSaveAsPrimaryImage(checked === true)}
                  />
                  Set as primary image
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  placeholder="Character name, scene title..."
                />
              </div>
            )}

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

      <Dialog open={!!viewSceneDialog} onOpenChange={(open) => !open && setViewSceneDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewSceneDialog?.title || "Imported Scene"}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {viewSceneDialog?.content.length.toLocaleString()} characters — this is exactly what was saved to your movie.
          </p>
          <ScrollArea className="flex-1 min-h-0 max-h-[60vh] rounded-md border border-border bg-muted/30 p-3">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {viewSceneDialog?.content}
            </pre>
          </ScrollArea>
          <DialogFooter>
            {linkedProject?.id && (
              <Button variant="outline" asChild>
                <Link href={`/screenplay/${linkedProject.id}`}>Open in Screenplay</Link>
              </Button>
            )}
            <Button onClick={() => setViewSceneDialog(null)}>Close</Button>
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

      <ContentViolationDialog
        isOpen={Boolean(contentBlockedDialog)}
        onClose={() => setContentBlockedDialog(null)}
        contentType="image"
        originalPrompt={contentBlockedDialog?.prompt || ""}
        onRetryWithPrompt={async (rewritten) => {
          if (!contentBlockedDialog) return
          const { message: blockedMessage } = contentBlockedDialog
          setContentBlockedDialog(null)
          await handleGenerateImage(blockedMessage, rewritten)
        }}
      />
    </div>
  )
}
