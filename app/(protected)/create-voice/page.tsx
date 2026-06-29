"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { CharactersService, type Character } from "@/lib/characters-service"
import { MovieService, type Movie } from "@/lib/movie-service"
import { TreatmentsService, type Treatment } from "@/lib/treatments-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import type { ProjectVoice } from "@/lib/project-voices-service"
import { getSupabaseClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import {
  Mic,
  Loader2,
  Play,
  Pause,
  Sparkles,
  UserCircle,
  ExternalLink,
  CheckCircle2,
  ImageIcon,
  Wand2,
  Star,
  Search,
  Copy,
  Link2,
  Trash2,
} from "lucide-react"


type VoiceDesignPreviewOption = {
  generated_voice_id: string
  audio_base64?: string
  duration_secs?: number
  language?: string | null
  label: string
}

type PendingVoiceDesign = {
  name: string
  description: string
  projectId: string
  characterId: string
}

type ProjectVoiceItem = {
  id?: string
  voice_id: string
  name: string
  added_at: string
  category?: string | null
}

type ElevenLabsVoice = {
  voice_id: string
  name: string
  category?: string
  description?: string
  labels?: Record<string, string>
  preview_url?: string
}

function buildVoiceProfile(character: Character, treatment?: Treatment | null): string {
  const parts: string[] = []
  if (character.gender) parts.push(character.gender)
  if (character.age) parts.push(`age ${character.age}`)
  if (character.voice_pitch) parts.push(`${character.voice_pitch} pitch`)
  if (character.voice_tone) parts.push(`${character.voice_tone} tone`)
  if (character.voice_accent) parts.push(`${character.voice_accent} accent`)
  if (character.voice_speed) parts.push(`${character.voice_speed} pace`)
  if (character.speaking_style) parts.push(character.speaking_style)
  if (character.baseline_personality) parts.push(character.baseline_personality)
  if (character.character_logline) parts.push(character.character_logline)
  if (treatment?.genre) parts.push(`${treatment.genre} story`)
  return parts.filter(Boolean).join(", ")
}

function buildPreviewLine(character: Character): string {
  if (character.common_phrases?.length) return character.common_phrases[0]
  if (character.character_logline) return character.character_logline
  if (character.speaking_style) return `This is how I speak — ${character.speaking_style}.`
  return `Hello. My name is ${character.name}.`
}

export default function CreateVoicePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const initialProjectId = searchParams.get("projectId") || ""
  const initialCharacterId = searchParams.get("characterId") || ""

  const [projectId, setProjectId] = useState(initialProjectId)
  const [characterId, setCharacterId] = useState(initialCharacterId)
  const [movie, setMovie] = useState<Movie | null>(null)
  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [character, setCharacter] = useState<Character | null>(null)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  const [voices, setVoices] = useState<ElevenLabsVoice[]>([])
  const [projectVoices, setProjectVoices] = useState<ProjectVoice[]>([])
  const [voiceSearch, setVoiceSearch] = useState("")
  const [selectedVoiceId, setSelectedVoiceId] = useState("")
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [loadingProjectVoices, setLoadingProjectVoices] = useState(false)
  const [voicesBrowseLoaded, setVoicesBrowseLoaded] = useState(false)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)

  const [importVoiceId, setImportVoiceId] = useState("")
  const [importVoiceName, setImportVoiceName] = useState("")
  const [isImportingVoice, setIsImportingVoice] = useState(false)

  const [previewLine, setPreviewLine] = useState("")
  const [voiceProfile, setVoiceProfile] = useState("")
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCreatingVoice, setIsCreatingVoice] = useState(false)

  const [cloneVoiceName, setCloneVoiceName] = useState("")
  const [cloneDescription, setCloneDescription] = useState("")
  const [cloneFiles, setCloneFiles] = useState<File[]>([])
  const [assignVoiceAfterCreate, setAssignVoiceAfterCreate] = useState(true)
  const [projectVoicesTableReady, setProjectVoicesTableReady] = useState(true)
  const [voicePreviewDialogOpen, setVoicePreviewDialogOpen] = useState(false)
  const [voiceDesignPreviews, setVoiceDesignPreviews] = useState<VoiceDesignPreviewOption[]>([])
  const [pendingVoiceDesign, setPendingVoiceDesign] = useState<PendingVoiceDesign | null>(null)
  const [confirmingPreviewId, setConfirmingPreviewId] = useState<string | null>(null)
  const [playingDesignPreviewId, setPlayingDesignPreviewId] = useState<string | null>(null)
  const designPreviewAudioRef = useRef<HTMLAudioElement | null>(null)

  const filteredVoices = useMemo(() => {
    const q = voiceSearch.trim().toLowerCase()
    if (!q) return voices
    return voices.filter((v) => {
      const labelText = Object.values(v.labels || {}).join(" ").toLowerCase()
      return (
        v.name.toLowerCase().includes(q) ||
        (v.description || "").toLowerCase().includes(q) ||
        (v.category || "").toLowerCase().includes(q) ||
        labelText.includes(q)
      )
    })
  }, [voices, voiceSearch])

  const workspaceVoices = useMemo(() => {
    const map = new Map<string, ProjectVoiceItem>()
    for (const v of projectVoices) {
      map.set(v.elevenlabs_voice_id, {
        id: v.id,
        voice_id: v.elevenlabs_voice_id,
        name: v.name,
        category: v.category,
        added_at: v.created_at,
      })
    }
    if (character?.elevenlabs_voice_id && character.elevenlabs_voice_name) {
      if (!map.has(character.elevenlabs_voice_id)) {
        map.set(character.elevenlabs_voice_id, {
          voice_id: character.elevenlabs_voice_id,
          name: character.elevenlabs_voice_name,
          added_at: character.updated_at,
        })
      }
    }
    return Array.from(map.values())
  }, [projectVoices, character])

  useEffect(() => {
    if (initialProjectId && initialProjectId !== projectId) setProjectId(initialProjectId)
  }, [initialProjectId, projectId])

  useEffect(() => {
    if (initialCharacterId && initialCharacterId !== characterId) setCharacterId(initialCharacterId)
  }, [initialCharacterId, characterId])

  const updateUrl = (nextProjectId: string, nextCharacterId: string) => {
    const params = new URLSearchParams()
    if (nextProjectId) params.set("projectId", nextProjectId)
    if (nextCharacterId) params.set("characterId", nextCharacterId)
    const qs = params.toString()
    router.replace(qs ? `/create-voice?${qs}` : "/create-voice", { scroll: false })
  }

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setCharacterId("")
    setCharacter(null)
    updateUrl(id, "")
  }

  const handleCharacterChange = (id: string) => {
    setCharacterId(id)
    updateUrl(projectId, id)
  }

  const loadProjectData = useCallback(async () => {
    if (!projectId || !ready) {
      setMovie(null)
      setTreatment(null)
      setCharacters([])
      setCharacter(null)
      setReferenceImages([])
      setCoverUrl(null)
      return
    }

    try {
      const movies = await MovieService.getMovies()
      setMovie(movies.find((m) => m.id === projectId) ?? null)

      const linkedTreatment = await TreatmentsService.getTreatmentByProjectId(projectId)
      setTreatment(linkedTreatment)

      const projectCharacters = await CharactersService.getCharacters(projectId)
      setCharacters(projectCharacters)

      const selected =
        projectCharacters.find((c) => c.id === characterId) ??
        projectCharacters[0] ??
        null

      if (selected && !characterId) {
        setCharacterId(selected.id)
      }

      setCharacter(selected)

      const refs: string[] = []
      if (linkedTreatment?.cover_image_url) {
        setCoverUrl(linkedTreatment.cover_image_url)
        refs.push(linkedTreatment.cover_image_url)
      } else {
        const coverAssets = await AssetService.getCoverImageAssets(projectId)
        const defaultCover = coverAssets.find((a) => a.is_default_cover) ?? coverAssets[0]
        if (defaultCover?.content_url) {
          setCoverUrl(defaultCover.content_url)
          refs.push(defaultCover.content_url)
        } else {
          setCoverUrl(null)
        }
      }

      const imageAssets = (await AssetService.getAssetsForProject(projectId)).filter(
        (a: Asset) => a.content_type === "image" && a.content_url,
      )
      for (const asset of imageAssets.slice(0, 12)) {
        if (asset.content_url && !refs.includes(asset.content_url)) refs.push(asset.content_url)
      }

      setReferenceImages(refs)
    } catch (error) {
      console.error("Error loading voice studio data:", error)
      toast({
        title: "Error",
        description: "Failed to load project data.",
        variant: "destructive",
      })
    }
  }, [projectId, characterId, ready, toast])

  useEffect(() => {
    loadProjectData()
  }, [loadProjectData])

  useEffect(() => {
    if (!character) {
      setPreviewLine("")
      setVoiceProfile("")
      setSelectedVoiceId("")
      return
    }
    setPreviewLine(buildPreviewLine(character))
    setVoiceProfile(buildVoiceProfile(character, treatment))
    setSelectedVoiceId(character.elevenlabs_voice_id || "")
    setCloneDescription(buildVoiceProfile(character, treatment))
    setCloneVoiceName(`${character.name} — ${movie?.name || "Character"}`)
  }, [character, treatment, movie?.name])

  const checkApiKey = useCallback(async () => {
    if (!userId) return
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.from("users").select("elevenlabs_api_key").eq("id", userId).maybeSingle()
      if (data?.elevenlabs_api_key?.trim()) {
        setHasApiKey(true)
        return
      }
      const sysRes = await fetch("/api/ai/get-system-api-key?type=elevenlabs_api_key")
      if (sysRes.ok) {
        const sys = await sysRes.json()
        setHasApiKey(!!sys.apiKey)
        return
      }
      setHasApiKey(false)
    } catch {
      setHasApiKey(false)
    }
  }, [userId])

  const resolveElevenLabsApiKey = useCallback(async (): Promise<string | null> => {
    if (!userId) return null
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.from("users").select("elevenlabs_api_key").eq("id", userId).maybeSingle()
      if (data?.elevenlabs_api_key?.trim()) return data.elevenlabs_api_key.trim()
      const sysRes = await fetch("/api/ai/get-system-api-key?type=elevenlabs_api_key")
      if (sysRes.ok) {
        const sys = await sysRes.json()
        return sys.apiKey?.trim() || null
      }
    } catch {
      return null
    }
    return null
  }, [userId])

  const getAuthFetchHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {}
    try {
      const supabase = getSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch {
      // ignore
    }
    return headers
  }, [])

  useEffect(() => {
    if (ready && userId) void checkApiKey()
  }, [ready, userId, checkApiKey])

  const loadProjectVoices = useCallback(async () => {
    if (!projectId || !ready || !userId) {
      setProjectVoices([])
      return
    }
    setLoadingProjectVoices(true)
    try {
      const response = await fetch(`/api/project-voices?projectId=${encodeURIComponent(projectId)}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load project voices")
      }
      const data = await response.json()
      setProjectVoices(Array.isArray(data.voices) ? data.voices : [])
      setProjectVoicesTableReady(!data.warning)
    } catch (error) {
      console.error("Error loading project voices:", error)
      setProjectVoices([])
      setProjectVoicesTableReady(false)
    } finally {
      setLoadingProjectVoices(false)
    }
  }, [projectId, ready, userId])

  useEffect(() => {
    void loadProjectVoices()
  }, [loadProjectVoices])

  const removeProjectVoice = async (record: ProjectVoiceItem) => {
    if (!record.id) {
      toast({
        title: "Cannot remove",
        description: "This voice is only assigned to the character, not saved in the project library.",
        variant: "destructive",
      })
      return
    }
    try {
      const response = await fetch(`/api/project-voices/${record.id}`, { method: "DELETE" })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to remove voice")
      }
      await loadProjectVoices()
      toast({ title: "Voice removed", description: "Removed from this project's voice library." })
    } catch (error) {
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Could not remove voice.",
        variant: "destructive",
      })
    }
  }

  const loadVoices = useCallback(async () => {
    setLoadingVoices(true)
    try {
      const response = await fetch("/api/ai/list-voices", { method: "POST" })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load voices")
      }
      const data = await response.json()
      setVoices(data.voices || [])
      setVoicesBrowseLoaded(true)
    } catch (error) {
      toast({
        title: "Could not load voices",
        description: error instanceof Error ? error.message : "Check your ElevenLabs API key.",
        variant: "destructive",
      })
    } finally {
      setLoadingVoices(false)
    }
  }, [toast])

  const handleImportVoiceId = async (assignToCharacter = false) => {
    const trimmedId = importVoiceId.trim()
    if (!trimmedId) {
      toast({ title: "Voice ID required", description: "Paste the ID from ElevenLabs → Copy voice ID.", variant: "destructive" })
      return
    }
    if (!projectId) {
      toast({ title: "Project required", description: "Select a project first.", variant: "destructive" })
      return
    }

    setIsImportingVoice(true)
    try {
      const response = await fetch("/api/ai/import-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: trimmedId,
          name: importVoiceName.trim() || undefined,
          projectId,
          characterId: character?.id || null,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Could not verify voice ID")
      }

      const data = await response.json()
      const saved: ProjectVoiceItem = {
        voice_id: data.voice_id,
        name: data.name || trimmedId,
        category: data.category,
        added_at: new Date().toISOString(),
      }

      await loadProjectVoices()
      setSelectedVoiceId(saved.voice_id)
      setImportVoiceId("")
      setImportVoiceName("")

      if (assignToCharacter && character) {
        await assignVoiceToCharacter(saved.voice_id, saved.name)
      } else {
        toast({
          title: "Voice imported",
          description: `"${saved.name}" is saved to this project's voice library.`,
        })
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Invalid voice ID for your API key.",
        variant: "destructive",
      })
    } finally {
      setIsImportingVoice(false)
    }
  }

  const copyVoiceId = async (voiceId: string) => {
    try {
      await navigator.clipboard.writeText(voiceId)
      toast({ title: "Copied", description: "Voice ID copied to clipboard." })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const renderVoiceRow = (voice: ProjectVoiceItem, showRemove = false) => {
    if (!character) return null
    const isAssigned = character.elevenlabs_voice_id === voice.voice_id
    const isSelected = selectedVoiceId === voice.voice_id
    return (
      <div
        key={voice.voice_id}
        className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
          isSelected ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{voice.name}</p>
            {voice.category && (
              <Badge variant="outline" className="text-xs">
                {voice.category}
              </Badge>
            )}
            {isAssigned && (
              <Badge className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Assigned
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{voice.voice_id}</p>
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
          <Button size="sm" variant="ghost" onClick={() => void copyVoiceId(voice.voice_id)} title="Copy voice ID">
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedVoiceId(voice.voice_id)
              void togglePreviewForVoice(voice.voice_id)
            }}
            title={
              previewingVoiceId === voice.voice_id && isPreviewPlaying
                ? "Pause preview"
                : "Play preview"
            }
          >
            {previewingVoiceId === voice.voice_id && isPreviewPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => void assignVoiceToCharacter(voice.voice_id, voice.name)}
            disabled={isAssigning}
          >
            {isAssigned ? "Main" : "Assign"}
          </Button>
          {showRemove && voice.id && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => void removeProjectVoice(voice)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  const characterReferenceImages = useMemo(() => {
    const seen = new Set<string>()
    const imgs: string[] = []
    const add = (url: string | null | undefined) => {
      if (!url || seen.has(url)) return
      seen.add(url)
      imgs.push(url)
    }
    add(character?.image_url)
    character?.reference_images?.forEach(add)
    add(coverUrl)
    referenceImages.forEach(add)
    return imgs.slice(0, 16)
  }, [character, coverUrl, referenceImages])

  const analyzeReferenceImage = async (imageUrl: string) => {
    if (!character) return
    setIsAnalyzing(true)
    try {
      const response = await fetch("/api/ai/analyze-character-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          characterId: character.id,
          characterName: character.name,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Analysis failed")
      }

      const data = await response.json()
      const extracted = data.extractedData || {}
      const updates: Partial<Character> = {}
      if (extracted.voice_pitch) updates.voice_pitch = extracted.voice_pitch
      if (extracted.voice_tone) updates.voice_tone = extracted.voice_tone
      if (extracted.gender) updates.gender = extracted.gender
      if (extracted.age) updates.age = extracted.age
      if (extracted.description) updates.description = extracted.description

      if (Object.keys(updates).length > 0) {
        const updated = await CharactersService.updateCharacter(character.id, updates)
        setCharacter(updated)
        setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        setVoiceProfile(buildVoiceProfile(updated, treatment))
        setCloneDescription(buildVoiceProfile(updated, treatment))
      }

      toast({
        title: "Image analyzed",
        description: "Voice traits updated from the reference image.",
      })
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Could not analyze image.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const togglePreviewForVoice = async (voiceId: string) => {
    if (previewingVoiceId === voiceId && previewAudioRef.current) {
      if (isPreviewPlaying) {
        previewAudioRef.current.pause()
        setIsPreviewPlaying(false)
        return
      }
      try {
        setIsPreviewPlaying(true)
        await previewAudioRef.current.play()
      } catch (error) {
        setIsPreviewPlaying(false)
        toast({
          title: "Preview failed",
          description: error instanceof Error ? error.message : "Could not resume preview.",
          variant: "destructive",
        })
      }
      return
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }

    setPreviewingVoiceId(voiceId)
    try {
      const response = await fetch("/api/ai/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Preview failed")
      }

      const contentType = response.headers.get("content-type") || ""
      let audioUrl: string

      if (contentType.includes("audio")) {
        const blob = await response.blob()
        audioUrl = URL.createObjectURL(blob)
      } else {
        const data = await response.json()
        audioUrl = data.audioUrl
      }

      const audio = new Audio(audioUrl)
      previewAudioRef.current = audio
      audio.onended = () => {
        setIsPreviewPlaying(false)
        setPreviewingVoiceId(null)
        previewAudioRef.current = null
      }
      setIsPreviewPlaying(true)
      await audio.play()
    } catch (error) {
      toast({
        title: "Preview failed",
        description: error instanceof Error ? error.message : "Could not play voice preview.",
        variant: "destructive",
      })
      setPreviewingVoiceId(null)
      setIsPreviewPlaying(false)
      previewAudioRef.current = null
    }
  }

  const generateLinePreview = async () => {
    if (!previewLine.trim() || !selectedVoiceId || !userId) return

    setIsGeneratingPreview(true)
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.from("users").select("elevenlabs_api_key").eq("id", userId).maybeSingle()
      const apiKey = data?.elevenlabs_api_key?.trim()
      if (!apiKey) {
        throw new Error("ElevenLabs API key not configured")
      }

      const response = await fetch("/api/ai/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: previewLine,
          voiceId: selectedVoiceId,
          apiKey,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Speech generation failed")
      }

      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)
      if (previewAudioRef.current) previewAudioRef.current.pause()
      const audio = new Audio(audioUrl)
      previewAudioRef.current = audio
      audio.onended = () => setIsPreviewPlaying(false)
      setIsPreviewPlaying(true)
      await audio.play()

      toast({ title: "Preview ready", description: "Playing your test line." })
    } catch (error) {
      toast({
        title: "Preview failed",
        description: error instanceof Error ? error.message : "Could not generate speech.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  const assignVoiceToCharacter = async (voiceId: string, voiceName: string) => {
    if (!character) return
    setIsAssigning(true)
    try {
      const updated = await CharactersService.updateCharacter(character.id, {
        elevenlabs_voice_id: voiceId,
        elevenlabs_voice_name: voiceName,
      })
      setCharacter(updated)
      setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedVoiceId(voiceId)
      toast({
        title: "Voice assigned",
        description: `"${voiceName}" is now ${character.name}'s voice.`,
      })
    } catch (error) {
      toast({
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Could not save voice.",
        variant: "destructive",
      })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleCreateVoice = async () => {
    if (!character || !projectId) return

    const voiceName = cloneVoiceName.trim() || `${character.name} — ${movie?.name || "Character"}`
    const description = (cloneDescription || voiceProfile).trim()
    const usingSamples = cloneFiles.length > 0

    if (!usingSamples && !description) {
      toast({
        title: "Add a description or audio samples",
        description:
          "Describe the voice you want (Voice Design), or upload speech samples to clone a voice.",
        variant: "destructive",
      })
      return
    }

    setIsCreatingVoice(true)
    try {
      const authHeaders = await getAuthFetchHeaders()
      const apiKey = await resolveElevenLabsApiKey()

      if (usingSamples) {
        const formData = new FormData()
        formData.append("name", voiceName)
        formData.append("description", description)
        formData.append("projectId", projectId)
        if (character.id) formData.append("characterId", character.id)
        if (apiKey) formData.append("apiKey", apiKey)
        for (const file of cloneFiles) {
          formData.append("files", file)
        }
        const response = await fetch("/api/ai/clone-voice", {
          method: "POST",
          credentials: "include",
          headers: authHeaders,
          body: formData,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error || "Voice creation failed")
        }

        const data = await response.json()
        if (data.voice_id) {
          await loadProjectVoices()
          setSelectedVoiceId(data.voice_id)
          if (assignVoiceAfterCreate) {
            await assignVoiceToCharacter(data.voice_id, data.name || voiceName)
          } else {
            toast({
              title: "Voice created",
              description: `"${data.name || voiceName}" was added${projectVoicesTableReady ? " to this project" : " in ElevenLabs"}.`,
            })
          }
        }
        setCloneFiles([])
        return
      }

      const response = await fetch("/api/ai/design-voice", {
        method: "POST",
        credentials: "include",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "preview",
          name: voiceName,
          description,
          projectId,
          characterId: character.id,
          previewText: previewLine.trim() || undefined,
          apiKey: apiKey || undefined,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Voice preview generation failed")
      }

      const data = await response.json()
      const previews = Array.isArray(data.previews) ? data.previews : []
      if (previews.length === 0) {
        throw new Error("ElevenLabs did not return any voice options")
      }

      setPendingVoiceDesign({
        name: voiceName,
        description,
        projectId,
        characterId: character.id,
      })
      setVoiceDesignPreviews(previews)
      setVoicePreviewDialogOpen(true)
      toast({
        title: "Voice options ready",
        description: "Listen to each preview and pick the one you want to save.",
      })
    } catch (error) {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Could not create voice.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingVoice(false)
    }
  }

  const playDesignPreview = async (preview: VoiceDesignPreviewOption) => {
    if (!preview.audio_base64) {
      toast({
        title: "No preview audio",
        description: "This option did not include audio. Try another option or regenerate.",
        variant: "destructive",
      })
      return
    }

    if (
      playingDesignPreviewId === preview.generated_voice_id &&
      designPreviewAudioRef.current
    ) {
      designPreviewAudioRef.current.pause()
      setPlayingDesignPreviewId(null)
      return
    }

    if (designPreviewAudioRef.current) {
      designPreviewAudioRef.current.pause()
      designPreviewAudioRef.current = null
    }

    setPlayingDesignPreviewId(preview.generated_voice_id)
    try {
      const audio = new Audio(`data:audio/mpeg;base64,${preview.audio_base64}`)
      designPreviewAudioRef.current = audio
      audio.onended = () => {
        setPlayingDesignPreviewId(null)
        designPreviewAudioRef.current = null
      }
      audio.onerror = () => {
        setPlayingDesignPreviewId(null)
        designPreviewAudioRef.current = null
      }
      await audio.play()
    } catch {
      setPlayingDesignPreviewId(null)
      designPreviewAudioRef.current = null
      toast({
        title: "Playback failed",
        description: "Could not play this voice preview.",
        variant: "destructive",
      })
    }
  }

  const handleConfirmVoicePreview = async (preview: VoiceDesignPreviewOption) => {
    if (!pendingVoiceDesign) return

    setConfirmingPreviewId(preview.generated_voice_id)
    try {
      const authHeaders = await getAuthFetchHeaders()
      const apiKey = await resolveElevenLabsApiKey()

      const response = await fetch("/api/ai/design-voice", {
        method: "POST",
        credentials: "include",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "confirm",
          generatedVoiceId: preview.generated_voice_id,
          name: pendingVoiceDesign.name,
          description: pendingVoiceDesign.description,
          projectId: pendingVoiceDesign.projectId,
          characterId: pendingVoiceDesign.characterId,
          apiKey: apiKey || undefined,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to save selected voice")
      }

      const data = await response.json()
      if (data.voice_id) {
        await loadProjectVoices()
        setSelectedVoiceId(data.voice_id)
        setVoicePreviewDialogOpen(false)
        setVoiceDesignPreviews([])
        setPendingVoiceDesign(null)

        if (assignVoiceAfterCreate && character) {
          await assignVoiceToCharacter(data.voice_id, data.name || pendingVoiceDesign.name)
        } else {
          toast({
            title: "Voice saved",
            description: `"${data.name || pendingVoiceDesign.name}" was added to your project library.`,
          })
        }
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save this voice.",
        variant: "destructive",
      })
    } finally {
      setConfirmingPreviewId(null)
    }
  }

  const closeVoicePreviewDialog = () => {
    if (designPreviewAudioRef.current) {
      designPreviewAudioRef.current.pause()
      designPreviewAudioRef.current = null
    }
    setPlayingDesignPreviewId(null)
    setVoicePreviewDialogOpen(false)
    setVoiceDesignPreviews([])
    setPendingVoiceDesign(null)
    setConfirmingPreviewId(null)
  }

  const isDesignMode =
    cloneFiles.length === 0 && !!(cloneDescription || voiceProfile).trim()

  const canCreateVoice =
    !!cloneVoiceName.trim() && (cloneFiles.length > 0 || !!(cloneDescription || voiceProfile).trim())

  const applyVoiceProfileSearch = () => {
    const terms = [character?.gender, character?.voice_pitch, character?.voice_tone, character?.voice_accent]
      .filter(Boolean)
      .join(" ")
    setVoiceSearch(terms || voiceProfile.split(",").slice(0, 3).join(" "))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Voice</h1>
          <p className="text-muted-foreground">
            Create character voices with ElevenLabs — scoped to your account and the selected project.
          </p>
        </div>

        {!projectVoicesTableReady && projectId && (
          <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
            <CardContent className="pt-6 text-sm text-amber-200/90">
              Project voice library is not set up yet. Voices will still be created in ElevenLabs, but
              run migration <code className="text-xs">080_create_project_voices_table.sql</code> in
              Supabase to save them per project.
            </CardContent>
          </Card>
        )}

        {hasApiKey === false && (
          <Card className="mb-6 border-yellow-500/40 bg-yellow-500/5">
            <CardContent className="pt-6 text-sm">
              ElevenLabs API key required.{" "}
              <Link href="/setup-ai" className="text-primary underline">
                Configure in Setup AI
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Project</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectSelector selectedProject={projectId} onProjectChange={handleProjectChange} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Character</CardTitle>
            </CardHeader>
            <CardContent>
              {!projectId ? (
                <p className="text-sm text-muted-foreground">Select a project first.</p>
              ) : characters.length === 0 ? (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>No characters yet.</p>
                  <Link href={`/characters?projectId=${projectId}`} className="text-primary underline inline-flex items-center gap-1">
                    Add characters <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <Select value={characterId} onValueChange={handleCharacterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select character" />
                  </SelectTrigger>
                  <SelectContent>
                    {characters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.elevenlabs_voice_name ? ` · ${c.elevenlabs_voice_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Assigned voice</CardTitle>
            </CardHeader>
            <CardContent>
              {character?.elevenlabs_voice_name ? (
                <div className="space-y-2">
                  <Badge className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    {character.elevenlabs_voice_name}
                  </Badge>
                  {character.elevenlabs_voice_id && (
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground truncate flex-1">
                        {character.elevenlabs_voice_id}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => void copyVoiceId(character.elevenlabs_voice_id!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {character && (
                    <Link
                      href={`/characters/${character.id}`}
                      className="text-xs text-primary underline inline-flex items-center gap-1"
                    >
                      Open character sheet <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No voice assigned yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {!projectId || !character ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Mic className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Select a project and character to start building a voice.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCircle className="h-5 w-5" />
                    {character.name}
                  </CardTitle>
                  <CardDescription>{character.character_type || "character"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3 items-start">
                    {character.image_url ? (
                      <img
                        src={character.image_url}
                        alt={character.name}
                        className="h-16 w-16 shrink-0 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="h-16 w-16 shrink-0 rounded-lg border bg-muted/30 flex items-center justify-center">
                        <UserCircle className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs min-w-0 flex-1">
                      {character.gender && (
                        <div>
                          <span className="text-muted-foreground">Gender</span>
                          <p className="truncate">{character.gender}</p>
                        </div>
                      )}
                      {character.age != null && (
                        <div>
                          <span className="text-muted-foreground">Age</span>
                          <p>{character.age}</p>
                        </div>
                      )}
                      {character.voice_pitch && (
                        <div>
                          <span className="text-muted-foreground">Pitch</span>
                          <p className="truncate">{character.voice_pitch}</p>
                        </div>
                      )}
                      {character.voice_tone && (
                        <div>
                          <span className="text-muted-foreground">Tone</span>
                          <p className="truncate">{character.voice_tone}</p>
                        </div>
                      )}
                      {character.voice_accent && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Accent</span>
                          <p className="truncate">{character.voice_accent}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {voiceProfile && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Voice profile</Label>
                      <p className="text-xs mt-0.5 line-clamp-3">{voiceProfile}</p>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Image references
                      </Label>
                      {characterReferenceImages.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          Tap to analyze
                        </span>
                      )}
                    </div>
                    {characterReferenceImages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Add character or project images to infer voice traits.
                      </p>
                    ) : (
                      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
                        {characterReferenceImages.map((url) => (
                          <button
                            key={url}
                            type="button"
                            disabled={isAnalyzing}
                            onClick={() => void analyzeReferenceImage(url)}
                            className="relative h-11 w-11 shrink-0 rounded-md overflow-hidden border hover:border-primary/60 group"
                            title="Analyze for voice traits"
                          >
                            <img src={url} alt="Reference" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              {isAnalyzing ? (
                                <Loader2 className="h-3 w-3 text-white animate-spin" />
                              ) : (
                                <Wand2 className="h-3 w-3 text-white" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {treatment && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        Story: {treatment.genre}
                        {treatment.logline ? ` · ${treatment.logline.slice(0, 60)}…` : ""}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Tabs defaultValue="create">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="create">Create Voice</TabsTrigger>
                  <TabsTrigger value="library">Project voices</TabsTrigger>
                  <TabsTrigger value="import">Import ID</TabsTrigger>
                  <TabsTrigger value="browse">Browse all</TabsTrigger>
                  <TabsTrigger value="test">Test</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mic className="h-4 w-4" />
                        Create voice with ElevenLabs
                      </CardTitle>
                      <CardDescription>
                        Create a voice two ways: describe it below (ElevenLabs Voice Design), or upload
                        speech samples to clone. Saved to <strong>{movie?.name || "this project"}</strong>{" "}
                        under your account only.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="create-voice-name">Voice name</Label>
                        <Input
                          id="create-voice-name"
                          value={cloneVoiceName}
                          onChange={(e) => setCloneVoiceName(e.target.value)}
                          className="mt-1"
                          placeholder="e.g. Marcus — Night Run"
                        />
                      </div>
                      <div>
                        <Label htmlFor="create-voice-desc">Description</Label>
                        <Textarea
                          id="create-voice-desc"
                          value={cloneDescription}
                          onChange={(e) => setCloneDescription(e.target.value)}
                          rows={3}
                          placeholder="Describe the voice — age, tone, accent..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="create-voice-samples">Audio samples</Label>
                        <Input
                          id="create-voice-samples"
                          type="file"
                          accept="audio/*"
                          multiple
                          className="mt-1"
                          onChange={(e) => setCloneFiles(Array.from(e.target.files || []))}
                        />
                        {cloneFiles.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {cloneFiles.length} file{cloneFiles.length !== 1 ? "s" : ""} selected
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {cloneFiles.length > 0
                            ? "Using audio clone — upload 5–10 second clear speech samples (MP3, WAV, M4A)."
                            : (cloneDescription || voiceProfile).trim()
                              ? "No samples — generates multiple voice options to preview and pick from."
                              : "Optional for cloning. Without samples, a description is required for Voice Design."}
                        </p>
                      </div>
                      {!canCreateVoice && (
                        <p className="text-xs text-amber-400/90">
                          Enter a voice name and either a description or at least one audio sample to
                          enable Create voice.
                        </p>
                      )}
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignVoiceAfterCreate}
                          onChange={(e) => setAssignVoiceAfterCreate(e.target.checked)}
                          className="rounded border-border"
                        />
                        {isDesignMode
                          ? `Assign to ${character.name} after I pick a voice`
                          : `Assign to ${character.name} after creating`}
                      </label>
                      <Button
                        className="w-full"
                        onClick={() => void handleCreateVoice()}
                        disabled={isCreatingVoice || !canCreateVoice}
                      >
                        {isCreatingVoice ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {isDesignMode ? "Generating options..." : "Creating voice..."}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {isDesignMode ? "Generate voice options" : "Create voice"}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="import" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Import by Voice ID
                      </CardTitle>
                      <CardDescription>
                        In ElevenLabs, open your voice → menu (⋯) → <strong>Copy voice ID</strong>, then paste it here.
                        Saved to <strong>{movie?.name || "this project"}</strong> under your account only.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="voice-id">ElevenLabs Voice ID</Label>
                        <Input
                          id="voice-id"
                          className="mt-1 font-mono text-sm"
                          placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                          value={importVoiceId}
                          onChange={(e) => setImportVoiceId(e.target.value)}
                          disabled={isImportingVoice}
                        />
                      </div>
                      <div>
                        <Label htmlFor="voice-label">Display name (optional)</Label>
                        <Input
                          id="voice-label"
                          className="mt-1"
                          placeholder="e.g. Marcus — deep narrator"
                          value={importVoiceName}
                          onChange={(e) => setImportVoiceName(e.target.value)}
                          disabled={isImportingVoice}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          If left blank, we fetch the name from ElevenLabs using your API key.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void handleImportVoiceId(false)}
                          disabled={isImportingVoice || !importVoiceId.trim()}
                        >
                          {isImportingVoice ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Link2 className="h-4 w-4 mr-2" />
                          )}
                          Verify & save
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => void handleImportVoiceId(true)}
                          disabled={isImportingVoice || !importVoiceId.trim() || !character}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Save & assign to {character.name}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground border-t pt-3">
                        The voice ID must exist in the ElevenLabs account tied to your API key (Setup AI).
                        Other users&apos; voice IDs will not work unless they share the same ElevenLabs account.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="library" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Project voice library</CardTitle>
                      <CardDescription>
                        Voices created or imported for {movie?.name || "this project"}. Only you can access them.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingProjectVoices ? (
                        <div className="py-6 text-center text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Loading project voices...
                        </div>
                      ) : workspaceVoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No voices for this project yet. Use <strong>Create Voice</strong> or{" "}
                          <strong>Import ID</strong> to add one.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                          {workspaceVoices.map((voice) => renderVoiceRow(voice, true))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="browse" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">Browse ElevenLabs account</CardTitle>
                          <CardDescription className="mt-1">
                            Optional — loads every voice on the API key. Skip this if you only use your own voice IDs.
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={applyVoiceProfileSearch}>
                            <Search className="h-3 w-3 mr-1" />
                            Match profile
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void loadVoices()} disabled={loadingVoices}>
                            {loadingVoices ? <Loader2 className="h-3 w-3 animate-spin" /> : voicesBrowseLoaded ? "Refresh" : "Load voices"}
                          </Button>
                        </div>
                      </div>
                      {voicesBrowseLoaded && (
                        <Input
                          placeholder="Search voices by name, tone, accent..."
                          value={voiceSearch}
                          onChange={(e) => setVoiceSearch(e.target.value)}
                          className="mt-2"
                        />
                      )}
                    </CardHeader>
                    <CardContent>
                      {!voicesBrowseLoaded ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                          Click <strong>Load voices</strong> to browse your ElevenLabs library.
                        </p>
                      ) : loadingVoices ? (
                        <div className="py-8 text-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading voices...
                        </div>
                      ) : filteredVoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No voices match your search.</p>
                      ) : (
                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                          {filteredVoices.map((voice) => renderVoiceRow(voice))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="test" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Test dialogue line</CardTitle>
                      <CardDescription>
                        Hear how the selected voice sounds with a line from your character.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Selected voice</Label>
                        <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Choose a voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {workspaceVoices.map((v) => (
                              <SelectItem key={v.voice_id} value={v.voice_id}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label>Test line</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs h-auto py-1"
                            onClick={() => character && setPreviewLine(buildPreviewLine(character))}
                          >
                            Reset from character
                          </Button>
                        </div>
                        <Textarea
                          value={previewLine}
                          onChange={(e) => setPreviewLine(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void generateLinePreview()}
                          disabled={isGeneratingPreview || !selectedVoiceId || !previewLine.trim()}
                        >
                          {isGeneratingPreview ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Play test line
                        </Button>
                        {selectedVoiceId && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              const voice = workspaceVoices.find((v) => v.voice_id === selectedVoiceId)
                              if (voice) void assignVoiceToCharacter(voice.voice_id, voice.name)
                            }}
                            disabled={isAssigning}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Set as main voice
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      <Dialog open={voicePreviewDialogOpen} onOpenChange={(open) => !open && closeVoicePreviewDialog()}>
        <DialogContent className="cinema-card border-border max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Pick a voice
            </DialogTitle>
            <DialogDescription>
              ElevenLabs generated {voiceDesignPreviews.length} option
              {voiceDesignPreviews.length !== 1 ? "s" : ""} for{" "}
              <strong>{pendingVoiceDesign?.name}</strong>. Play each one, then save your favorite.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {voiceDesignPreviews.map((preview) => {
              const isPlaying = playingDesignPreviewId === preview.generated_voice_id
              const isSaving = confirmingPreviewId === preview.generated_voice_id
              return (
                <div
                  key={preview.generated_voice_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{preview.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {preview.duration_secs
                        ? `${preview.duration_secs.toFixed(1)}s preview`
                        : "Preview sample"}
                      {preview.language ? ` · ${preview.language}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!preview.audio_base64 || isSaving}
                      onClick={() => void playDesignPreview(preview)}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSaving || !!confirmingPreviewId}
                      onClick={() => void handleConfirmVoicePreview(preview)}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Use this
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeVoicePreviewDialog}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
