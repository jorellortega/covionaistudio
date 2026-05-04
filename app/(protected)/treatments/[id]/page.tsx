"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Header from "@/components/header"
import { useAuthReady } from "@/components/auth-hooks"
import { TreatmentsService, type Treatment } from "@/lib/treatments-service"
import { AISettingsService } from "@/lib/ai-settings-service"
import { MovieService } from "@/lib/movie-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Film, Loader2, Save, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import TextToSpeech from "@/components/text-to-speech"

export default function TreatmentDocumentPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { ready, user, userId } = useAuthReady()
  const id = params.id as string

  const [treatment, setTreatment] = useState<Treatment | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [isGeneratingTreatment, setIsGeneratingTreatment] = useState(false)
  const [aiSettings, setAiSettings] = useState<any[]>([])
  const [selectedScriptAIService, setSelectedScriptAIService] = useState("")
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!ready || !id || !userId) return
    setLoading(true)
    try {
      let data = await TreatmentsService.getTreatment(id)
      if (!data) {
        data = await TreatmentsService.getTreatmentByProjectId(id)
      }
      if (!data) {
        const movieData = await MovieService.getMovieById(id)
        if (movieData && movieData.user_id === userId) {
          try {
            data = await TreatmentsService.createTreatment({
              project_id: movieData.id,
              title: movieData.name || "Untitled",
              genre: movieData.genre?.trim() || "General",
            })
            toast({
              title: "Treatment hub created",
              description: "Linked a treatment to this project. You can edit the document below.",
            })
          } catch (createErr) {
            console.error(createErr)
          }
        }
      }
      if (!data) {
        setTreatment(null)
        return
      }
      setTreatment(data)
      setPrompt(data.prompt || "")
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: "Could not load treatment.",
        variant: "destructive",
      })
      setTreatment(null)
    } finally {
      setLoading(false)
    }
  }, [ready, id, toast, userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready) return
      try {
        const settings = await AISettingsService.getSystemSettings()
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting("scripts"),
        ])
        const mergedSettings = defaultSettings.map((defaultSetting) => {
          const existingSetting = settings.find((s) => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
        const scriptsSetting = mergedSettings.find((s) => s.tab_type === "scripts")
        if (scriptsSetting?.is_locked && scriptsSetting.locked_model) {
          setSelectedScriptAIService(scriptsSetting.locked_model)
        } else if (scriptsSetting?.selected_model) {
          setSelectedScriptAIService(scriptsSetting.selected_model)
        }
      } catch (e) {
        console.error("Error loading AI settings:", e)
      }
    }
    loadAISettings()
  }, [ready, userId])

  const isScriptsTabLocked = () => {
    const setting = aiSettings.find((s) => s.tab_type === "scripts")
    return setting?.is_locked || false
  }

  const getScriptsTabLockedModel = () => {
    const setting = aiSettings.find((s) => s.tab_type === "scripts")
    return setting?.locked_model || ""
  }

  const generateAITreatment = async () => {
    if (isGeneratingTreatment || !treatment) return

    const sourceContent =
      prompt.trim() ||
      treatment.prompt ||
      treatment.synopsis ||
      treatment.logline ||
      treatment.title
    if (!sourceContent?.trim()) {
      toast({
        title: "Missing content",
        description: "Add at least a title, logline, synopsis, or treatment text to regenerate.",
        variant: "destructive",
      })
      return
    }

    if (!user || !userId) {
      toast({
        title: "Sign in required",
        description: "Wait for your session to load, then try again.",
        variant: "destructive",
      })
      return
    }

    if (!aiSettingsLoaded) {
      toast({
        title: "AI settings loading",
        description: "Please wait a moment and try again.",
        variant: "destructive",
      })
      return
    }

    const lockedModel = getScriptsTabLockedModel()
    const serviceToUse =
      isScriptsTabLocked() && lockedModel ? lockedModel : selectedScriptAIService
    if (!serviceToUse) {
      toast({
        title: "AI not configured",
        description: "Configure OpenAI or Anthropic under Settings → AI Settings.",
        variant: "destructive",
      })
      return
    }

    const normalizedService =
      serviceToUse.toLowerCase().includes("gpt") || serviceToUse.toLowerCase().includes("openai")
        ? "openai"
        : serviceToUse.toLowerCase().includes("claude") ||
            serviceToUse.toLowerCase().includes("anthropic")
          ? "anthropic"
          : serviceToUse.toLowerCase().includes("gemini") ||
              serviceToUse.toLowerCase().includes("google")
            ? "google"
            : "openai"

    if (normalizedService === "google") {
      toast({
        title: "Service not available",
        description: "Use OpenAI or Anthropic for treatment generation.",
        variant: "destructive",
      })
      return
    }

    const scriptsSetting = aiSettings.find((s: any) => s.tab_type === "scripts")
    const modelToUse =
      scriptsSetting?.selected_model ||
      (normalizedService === "openai" ? "gpt-4o" : "claude-3-5-sonnet-20241022")

    try {
      setIsGeneratingTreatment(true)

      const cleaned = sourceContent
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/__/g, "")
        .replace(/`/g, "")
        .replace(/#{1,6}\s+/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

      const seed = cleaned.length > 4000 ? cleaned.substring(0, 4000) + "..." : cleaned

      const aiPrompt = `You are a professional screenwriter. Convert the following material into a comprehensive movie treatment document.

CRITICAL FORMATTING REQUIREMENTS:
- This is a TREATMENT, not a screenplay or story. Write in narrative prose form, NOT screenplay format.
- Use the following EXACT structure with these EXACT section headers:

TITLE
[Title of the film]

LOGLINE
[One-sentence summary of the story]

SYNOPSIS
[2-3 paragraph summary of the entire story]

CHARACTERS
[Brief descriptions of main characters - name, role, key traits]

ACT I
[Detailed scene-by-scene narrative description of Act I in prose form. Describe what happens visually and emotionally. Write in present tense, third person. This should be a flowing narrative, NOT screenplay format.]

ACT II
[Detailed scene-by-scene narrative description of Act II in prose form. Describe what happens visually and emotionally. Write in present tense, third person. This should be a flowing narrative, NOT screenplay format.]

ACT III
[Detailed scene-by-scene narrative description of Act III in prose form. Describe what happens visually and emotionally. Write in present tense, third person. This should be a flowing narrative, NOT screenplay format.]

THEMES
[Key themes and messages of the story]

VISUAL STYLE
[Description of visual approach, tone, and aesthetic]

ADDITIONAL REQUIREMENTS:
- Write in present tense, third person narrative prose
- DO NOT use screenplay format (no INT./EXT., no character names in caps, no dialogue formatting)
- DO NOT write as a story - write as a treatment document describing what happens
- Be detailed and cinematic in description
- Focus on story structure, character arcs, and narrative flow
- NO markdown formatting (no #, *, **, etc.)
- Write as a professional treatment document that could be used for pitching

Source material to convert:
${seed}

Treatment:`

      const response = await fetch("/api/ai/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          field: "treatment",
          service: normalizedService,
          model: modelToUse,
          apiKey: "configured",
          userId,
          maxTokens: 4000,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate treatment")
      }

      const result = await response.json()
      if (result.success && result.text) {
        const newTreatment = result.text.trim()
        const updated = await TreatmentsService.updateTreatment(treatment.id, { prompt: newTreatment })
        setTreatment(updated)
        setPrompt(updated.prompt || "")
        toast({
          title: "Treatment regenerated",
          description: "AI replaced the treatment document. You can edit or save again.",
        })
      } else {
        throw new Error("No treatment text received from AI")
      }
    } catch (error) {
      console.error("Failed to generate AI treatment:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      if (errorMessage.includes("API key")) {
        toast({
          title: "API key required",
          description: "Set up OpenAI or Anthropic in Settings → AI Settings.",
          variant: "destructive",
        })
        setTimeout(() => {
          if (confirm("Go to AI Settings to configure your API key?")) {
            router.push("/settings-ai")
          }
        }, 800)
      } else {
        toast({
          title: "Generation failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setIsGeneratingTreatment(false)
    }
  }

  const handleSave = async () => {
    if (!treatment) return
    setSaving(true)
    try {
      const updated = await TreatmentsService.updateTreatment(treatment.id, {
        prompt: prompt.trim() || undefined,
      })
      setTreatment(updated)
      toast({ title: "Saved", description: "Treatment document updated." })
    } catch (e) {
      console.error(e)
      toast({
        title: "Save failed",
        description: "Could not save. You may not have edit access.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!treatment) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-semibold">Treatment not available</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            This ID may be invalid, or your account may not have permission to read this treatment in the database.
          </p>
          <Button variant="outline" onClick={() => router.push("/treatments")}>
            Back to treatments
          </Button>
        </div>
      </div>
    )
  }

  const title = treatment.title?.trim() || "Treatment"

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 max-w-full flex-1 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 px-2"
              onClick={() => router.push("/treatments")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Treatments</span>
            </Button>
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {(treatment.synopsis ||
              treatment.logline ||
              treatment.title ||
              treatment.prompt ||
              prompt.trim()) && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateAITreatment}
                disabled={isGeneratingTreatment || !aiSettingsLoaded || saving}
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-1.5"
                title="Generate a new full treatment from title, logline, synopsis, or current text"
              >
                {isGeneratingTreatment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">AI Regenerate</span>
                <span className="sm:hidden">AI</span>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/viewmovie/${treatment.id}`} className="inline-flex items-center gap-1.5">
                <Film className="h-4 w-4" />
                <span className="hidden sm:inline">View movie</span>
                <span className="sm:hidden">Movie</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/treatments")}>
              Close
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || isGeneratingTreatment} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
          <Card className="cinema-card flex min-h-0 flex-1 flex-col border-2 shadow-lg">
            <CardHeader className="shrink-0 space-y-1 pb-3">
              <CardTitle className="text-lg">Treatment</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-0">
              <Label htmlFor="treatment-prompt" className="sr-only">
                Treatment document
              </Label>
              <Textarea
                id="treatment-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                spellCheck
                className="min-h-0 flex-1 resize-y font-mono text-sm leading-relaxed sm:text-[15px] md:text-base"
                placeholder="Write or paste your treatment here…"
              />
              <div className="shrink-0 space-y-2 border-t border-border pt-4" data-tts-treatment-doc>
                <Label className="text-sm font-medium text-muted-foreground">Voice / audio</Label>
                <TextToSpeech
                  text={prompt}
                  title={`${title} - Treatment`}
                  projectId={treatment.project_id ?? undefined}
                  treatmentId={treatment.id}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
