"use client"

import { useEffect, useMemo, useState } from "react"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Users, Plus, ArrowRight, Check, RefreshCw, ListFilter, Sparkles, Edit, Trash2, Save, X, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { TreatmentsService } from "@/lib/treatments-service"
import { TreatmentScenesService, type TreatmentScene } from "@/lib/treatment-scenes-service"
import { ScreenplayScenesService, type ScreenplayScene } from "@/lib/screenplay-scenes-service"
import { CastingService, type CastingSetting } from "@/lib/casting-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { OpenAIService } from "@/lib/ai-services"
import { AISettingsService } from "@/lib/ai-settings-service"
import { getSupabaseClient } from "@/lib/supabase"

export default function CharactersPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  const [treatmentId, setTreatmentId] = useState<string | null>(null)
  const [treatmentScenes, setTreatmentScenes] = useState<TreatmentScene[]>([])
  const [screenplayScenes, setScreenplayScenes] = useState<ScreenplayScene[]>([])
  const [castingSettings, setCastingSettings] = useState<CastingSetting | null>(null)
  const [filter, setFilter] = useState<string>("")
  const [newCharacter, setNewCharacter] = useState<string>("")
  const [syncing, setSyncing] = useState(false)
  // Characters data
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false)
  const [newCharName, setNewCharName] = useState("")
  const [newCharArchetype, setNewCharArchetype] = useState("")
  const [newCharDescription, setNewCharDescription] = useState("")
  const [newCharBackstory, setNewCharBackstory] = useState("")
  const [newCharGoals, setNewCharGoals] = useState("")
  const [newCharConflicts, setNewCharConflicts] = useState("")
  const [newCharPersonalityTraits, setNewCharPersonalityTraits] = useState("")
  const [isGeneratingFromTreatment, setIsGeneratingFromTreatment] = useState(false)
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editArchetype, setEditArchetype] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editBackstory, setEditBackstory] = useState("")
  const [editGoals, setEditGoals] = useState("")
  const [editConflicts, setEditConflicts] = useState("")
  const [editTraits, setEditTraits] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        // Find treatment for project (if any)
        const treatment = await TreatmentsService.getTreatmentByProjectId(projectId)
        setTreatmentId(treatment?.id || null)

        // Load scenes from treatment (if present) and screenplay scenes
        const [tScenes, sScenes] = await Promise.all([
          treatment?.id ? TreatmentScenesService.getTreatmentScenes(treatment.id) : Promise.resolve([]),
          ScreenplayScenesService.getScreenplayScenes(projectId),
        ])
        setTreatmentScenes(tScenes)
        setScreenplayScenes(sScenes)

        // Load casting settings for roles_available
        const settings = await CastingService.getCastingSettings(projectId)
        setCastingSettings(settings)

        // Load existing characters
        setIsLoadingCharacters(true)
        const chars = await CharactersService.getCharacters(projectId)
        setCharacters(chars)
      } catch (err) {
        console.error("Failed to load characters data:", err)
        toast({
          title: "Error",
          description: "Failed to load characters. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingCharacters(false)
        setLoading(false)
      }
    }
    load()
  }, [projectId, toast])

  // Aggregate distinct characters from all scenes
  const detectedCharacters = useMemo(() => {
    const set = new Set<string>()
    const counts = new Map<string, number>()

    const addNames = (names?: string[]) => {
      if (!names) return
      names.forEach((n) => {
        const name = (n || "").trim()
        if (!name) return
        set.add(name)
        counts.set(name, (counts.get(name) || 0) + 1)
      })
    }

    treatmentScenes.forEach((s) => addNames(s.characters))
    screenplayScenes.forEach((s) => addNames(s.characters))

    const list = Array.from(set.values()).map((name) => ({
      name,
      count: counts.get(name) || 0,
    }))

    // Optional filter
    return list
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .filter((c) => (filter ? c.name.toLowerCase().includes(filter.toLowerCase()) : true))
  }, [treatmentScenes, screenplayScenes, filter])

  const rolesAvailable = useMemo(() => {
    const roles = castingSettings?.roles_available || []
    return roles
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .filter((r) => (filter ? r.toLowerCase().includes(filter.toLowerCase()) : true))
  }, [castingSettings, filter])

  const missingInRoles = useMemo(() => {
    const roles = new Set((castingSettings?.roles_available || []).map((r) => r.toLowerCase()))
    return detectedCharacters
      .filter((c) => !roles.has(c.name.toLowerCase()))
      .map((c) => c.name)
  }, [detectedCharacters, castingSettings])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const beginEdit = (ch: Character) => {
    setEditingCharacterId(ch.id)
    setEditName(ch.name || "")
    setEditArchetype(ch.archetype || "")
    setEditDescription(ch.description || "")
    setEditBackstory(ch.backstory || "")
    setEditGoals(ch.goals || "")
    setEditConflicts(ch.conflicts || "")
    const traits = (ch.personality as any)?.traits as string[] | undefined
    setEditTraits(traits && Array.isArray(traits) ? traits.join(", ") : "")
  }

  const cancelEdit = () => {
    setEditingCharacterId(null)
    setIsSavingEdit(false)
  }

  const saveEdit = async (id: string) => {
    if (!projectId) return
    try {
      setIsSavingEdit(true)
      const traits = editTraits
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
      const updated = await CharactersService.updateCharacter(id, {
        name: editName.trim() || undefined,
        archetype: editArchetype || undefined,
        description: editDescription || undefined,
        backstory: editBackstory || undefined,
        goals: editGoals || undefined,
        conflicts: editConflicts || undefined,
        personality: traits.length ? { traits } : { traits: [] },
      })
      setCharacters(prev => prev.map(c => c.id === id ? updated : c))
      setEditingCharacterId(null)
      toast({ title: "Character updated", description: `"${updated.name}" saved.` })
    } catch (e) {
      console.error('Save character failed:', e)
      toast({ title: "Error", description: "Failed to save character.", variant: "destructive" })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const deleteCharacter = async (id: string) => {
    if (!confirm("Delete this character? This cannot be undone.")) return
    try {
      setIsDeletingId(id)
      await CharactersService.deleteCharacter(id)
      setCharacters(prev => prev.filter(c => c.id !== id))
      toast({ title: "Deleted", description: "Character removed." })
    } catch (e) {
      console.error('Delete character failed:', e)
      toast({ title: "Error", description: "Failed to delete character.", variant: "destructive" })
    } finally {
      setIsDeletingId(null)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const generateCharactersFromTreatment = async () => {
    if (!projectId) return
    try {
      setIsGeneratingFromTreatment(true)
      // Load treatment
      const treatment = await TreatmentsService.getTreatmentByProjectId(projectId)
      if (!treatment) {
        toast({ title: "No Treatment", description: "Create a treatment for this project first.", variant: "destructive" })
        return
      }

      // Get user and OpenAI key from users table
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      const userId = session?.user?.id
      if (!userId) {
        toast({ title: "Auth required", description: "Please sign in again.", variant: "destructive" })
        return
      }
      const { data: userRow, error: userErr } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key')
        .eq('id', userId)
        .single()
      if (userErr || !userRow?.openai_api_key) {
        toast({ title: "Missing API Key", description: "Set your OpenAI API key in settings.", variant: "destructive" })
        return
      }

      // Determine model from AI settings (scripts tab)
      let model = 'gpt-4o-mini'
      try {
        const scriptsSetting = await AISettingsService.getTabSetting(userId, 'scripts')
        if (scriptsSetting?.selected_model) {
          model = scriptsSetting.selected_model
        }
      } catch {}

      // Build prompt
      const treatmentContext = [
        treatment.title && `Title: ${treatment.title}`,
        treatment.logline && `Logline: ${treatment.logline}`,
        treatment.synopsis && `Synopsis: ${treatment.synopsis}`,
        treatment.themes && `Themes: ${treatment.themes}`,
        treatment.characters && `Existing Notes (characters text): ${treatment.characters}`,
      ].filter(Boolean).join('\n')

      const template = `
Return STRICT JSON (no prose) as:
{
  "characters": [
    {
      "name": "string",
      "archetype": "string",
      "description": "string",
      "backstory": "string",
      "goals": "string",
      "conflicts": "string",
      "personality": { "traits": ["string", "string"] }
    }
  ]
}
Keep names consistent and useful for casting. Limit to 5-8 strongest characters.`

      const prompt = `Based on the following treatment, propose a concise set of character profiles.\n\n${treatmentContext}`

      const resp = await OpenAIService.generateScript({
        prompt,
        template,
        model, // used by ai-services OpenAIService
        apiKey: userRow.openai_api_key,
      } as any)

      if (!resp.success) {
        throw new Error(resp.error || 'AI generation failed')
      }

      // Extract JSON text from Chat Completions
      let text = ''
      try {
        const choice = resp.data?.choices?.[0]
        text = choice?.message?.content || resp.data?.text || ''
      } catch {}

      // Find JSON in text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const jsonText = jsonMatch ? jsonMatch[0] : text
      const parsed = JSON.parse(jsonText)
      const list = Array.isArray(parsed?.characters) ? parsed.characters : []
      if (list.length === 0) {
        throw new Error('No characters returned from AI')
      }

      // Create characters
      const created: Character[] = []
      for (const item of list) {
        try {
          const createdChar = await CharactersService.createCharacter({
            project_id: projectId,
            name: String(item.name || '').trim() || 'Unnamed',
            archetype: item.archetype || undefined,
            description: item.description || undefined,
            backstory: item.backstory || undefined,
            goals: item.goals || undefined,
            conflicts: item.conflicts || undefined,
            personality: item.personality || undefined,
          })
          created.push(createdChar)
        } catch (e) {
          console.error('Failed to create one character:', e)
        }
      }

      if (created.length > 0) {
        setCharacters(prev => [...created, ...prev])
        toast({ title: "Characters generated", description: `Added ${created.length} character(s).` })
      } else {
        toast({ title: "No characters created", description: "AI returned no valid characters.", variant: "destructive" })
      }
    } catch (error) {
      console.error('AI generation error:', error)
      toast({ title: "AI Error", description: error instanceof Error ? error.message : 'Failed to generate characters', variant: "destructive" })
    } finally {
      setIsGeneratingFromTreatment(false)
    }
  }

  const addRole = async (name: string) => {
    if (!projectId || !name.trim()) return
    setSyncing(true)
    try {
      const current = castingSettings?.roles_available || []
      if (current.some((r) => r.toLowerCase() === name.trim().toLowerCase())) {
        toast({ title: "Already Added", description: `"${name}" is already in casting roles.` })
        return
      }
      const next = [...current, name.trim()]
      const updated = await CastingService.upsertCastingSettings(projectId, { roles_available: next })
      setCastingSettings(updated)
      toast({ title: "Role Added", description: `"${name}" added to casting roles.` })
    } catch (err) {
      console.error("Failed adding role:", err)
      toast({ title: "Error", description: "Failed to add role.", variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  const addNewCharacterAsRole = async () => {
    if (!newCharacter.trim()) return
    await addRole(newCharacter.trim())
    setNewCharacter("")
  }

  const syncAllMissingToRoles = async () => {
    if (!projectId || missingInRoles.length === 0) return
    setSyncing(true)
    try {
      const current = castingSettings?.roles_available || []
      const merged = Array.from(
        new Set([...current, ...missingInRoles].map((r) => r.trim())).values(),
      )
      const updated = await CastingService.upsertCastingSettings(projectId, { roles_available: merged })
      setCastingSettings(updated)
      toast({ title: "Synced", description: "All detected characters synced to casting roles." })
    } catch (err) {
      console.error("Failed syncing roles:", err)
      toast({ title: "Error", description: "Failed to sync roles.", variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  const createCharacter = async (namePrefill?: string) => {
    if (!projectId) return
    const name = (namePrefill ?? newCharName).trim()
    if (!name) {
      toast({ title: "Name required", description: "Please enter a character name.", variant: "destructive" })
      return
    }
    try {
      setIsCreatingCharacter(true)
      const traits = newCharPersonalityTraits
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
      const created = await CharactersService.createCharacter({
        project_id: projectId,
        name,
        archetype: newCharArchetype || undefined,
        description: newCharDescription || undefined,
        backstory: newCharBackstory || undefined,
        goals: newCharGoals || undefined,
        conflicts: newCharConflicts || undefined,
        personality: traits.length ? { traits } : undefined,
      })
      setCharacters([created, ...characters])
      if (!namePrefill) {
        setNewCharName("")
        setNewCharArchetype("")
        setNewCharDescription("")
        setNewCharBackstory("")
        setNewCharGoals("")
        setNewCharConflicts("")
        setNewCharPersonalityTraits("")
      }
      toast({ title: "Character created", description: `"${created.name}" added.` })
    } catch (err) {
      console.error('Create character failed:', err)
      toast({ title: "Error", description: "Failed to create character.", variant: "destructive" })
    } finally {
      setIsCreatingCharacter(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">
              Characters
            </h1>
            <p className="text-muted-foreground">
              Aggregate characters from scenes and manage casting roles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {projectId && (
              <Link href={`/casting/${projectId}`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  Open Casting
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage characters"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a movie to view and manage characters.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading characters...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Characters list and create */}
            <Card className="cinema-card">
              <CardHeader className="pb-4">
                <CardTitle>Characters</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create and manage full character profiles for this movie.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Button variant="outline" size="sm" onClick={generateCharactersFromTreatment} disabled={isGeneratingFromTreatment || !treatmentId} className="gap-2">
                    {isGeneratingFromTreatment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate from Treatment
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="char-name">Name</Label>
                    <Input id="char-name" value={newCharName} onChange={(e) => setNewCharName(e.target.value)} className="bg-input border-border" placeholder="e.g., Jane Carter" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="char-archetype">Archetype</Label>
                    <Input id="char-archetype" value={newCharArchetype} onChange={(e) => setNewCharArchetype(e.target.value)} className="bg-input border-border" placeholder="Protagonist, Mentor, Antagonist..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="char-description">Description</Label>
                    <Textarea id="char-description" value={newCharDescription} onChange={(e) => setNewCharDescription(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Brief overview of the character..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="char-backstory">Backstory</Label>
                    <Textarea id="char-backstory" value={newCharBackstory} onChange={(e) => setNewCharBackstory(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Key events that shaped them..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="char-goals">Goals/Motivations</Label>
                    <Textarea id="char-goals" value={newCharGoals} onChange={(e) => setNewCharGoals(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="What do they want? Why?" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="char-conflicts">Conflicts</Label>
                    <Textarea id="char-conflicts" value={newCharConflicts} onChange={(e) => setNewCharConflicts(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Internal or external obstacles..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="char-traits">Personality Traits (comma-separated)</Label>
                    <Input id="char-traits" value={newCharPersonalityTraits} onChange={(e) => setNewCharPersonalityTraits(e.target.value)} className="bg-input border-border" placeholder="loyal, impulsive, analytical" />
                  </div>
                </div>
                <div>
                  <Button onClick={() => createCharacter()} disabled={isCreatingCharacter || !newCharName.trim()} className="gap-2">
                    {isCreatingCharacter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create Character
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {isLoadingCharacters ? "Loading characters..." : `${characters.length} character${characters.length === 1 ? "" : "s"}`}
                  </div>
                  {isLoadingCharacters ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : characters.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No characters yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {characters.map((ch) => (
                        <div
                          key={ch.id}
                          className={`p-2 rounded-md text-sm border ${
                            editingCharacterId === ch.id
                              ? 'border-primary/60 ring-2 ring-primary/20 bg-primary/5'
                              : 'border-border'
                          }`}
                        >
                          {editingCharacterId === ch.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label>Name</Label>
                                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-input border-border" />
                                </div>
                                <div className="space-y-1">
                                  <Label>Archetype</Label>
                                  <Input value={editArchetype} onChange={(e) => setEditArchetype(e.target.value)} className="bg-input border-border" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label>Description</Label>
                                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-input border-border min-h-[60px]" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label>Backstory</Label>
                                  <Textarea value={editBackstory} onChange={(e) => setEditBackstory(e.target.value)} className="bg-input border-border min-h-[60px]" />
                                </div>
                                <div className="space-y-1">
                                  <Label>Goals</Label>
                                  <Textarea value={editGoals} onChange={(e) => setEditGoals(e.target.value)} className="bg-input border-border min-h-[60px]" />
                                </div>
                                <div className="space-y-1">
                                  <Label>Conflicts</Label>
                                  <Textarea value={editConflicts} onChange={(e) => setEditConflicts(e.target.value)} className="bg-input border-border min-h-[60px]" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label>Personality Traits (comma-separated)</Label>
                                  <Input value={editTraits} onChange={(e) => setEditTraits(e.target.value)} className="bg-input border-border" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => saveEdit(ch.id)} disabled={isSavingEdit}>
                                  {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                  Save
                                </Button>
                                <Button variant="outline" size="sm" onClick={cancelEdit}>
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium leading-tight line-clamp-1 flex items-center gap-2">
                                    <span>
                                      {ch.name}{' '}
                                      {ch.archetype ? <span className="text-xs text-muted-foreground">({ch.archetype})</span> : null}
                                    </span>
                                    {editingCharacterId === ch.id && (
                                      <Badge className="text-[10px] h-5 px-1.5 bg-primary/20 text-primary border-primary/30">
                                        Editing
                                      </Badge>
                                    )}
                                  </div>
                                  {ch.description && <div className="text-xs text-muted-foreground line-clamp-1">{ch.description}</div>}
                                  {ch.personality?.traits && (ch.personality as any).traits?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(ch.personality as any).traits.slice(0, 2).map((t: string, i: number) => (
                                        <Badge key={`${ch.id}-t-${i}`} variant="outline" className="text-[10px] px-1 py-0">{t}</Badge>
                                      ))}
                                      {(ch.personality as any).traits.length > 2 && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">+{(ch.personality as any).traits.length - 2}</Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <Button variant="ghost" size="icon" onClick={() => addRole(ch.name)} title="Add to Casting">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => beginEdit(ch)} title="Edit">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteCharacter(ch.id)} disabled={isDeletingId === ch.id} title="Delete" className="text-destructive">
                                    {isDeletingId === ch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => toggleExpanded(ch.id)} title="Expand">
                                    {expandedIds.has(ch.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                              {expandedIds.has(ch.id) && (
                                <div className="text-xs text-muted-foreground space-y-1">
                                  {ch.backstory && <div><span className="font-medium text-foreground">Backstory:</span> <span className="line-clamp-2">{ch.backstory}</span></div>}
                                  {ch.goals && <div><span className="font-medium text-foreground">Goals:</span> <span className="line-clamp-2">{ch.goals}</span></div>}
                                  {ch.conflicts && <div><span className="font-medium text-foreground">Conflicts:</span> <span className="line-clamp-2">{ch.conflicts}</span></div>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="cinema-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ListFilter className="h-4 w-4" />
                    Detected Characters
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Filter characters..."
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="h-8 bg-input border-border"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={missingInRoles.length === 0 || syncing}
                      onClick={syncAllMissingToRoles}
                      className="gap-2"
                    >
                      {syncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Sync All To Casting
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {detectedCharacters.length} unique character{detectedCharacters.length === 1 ? "" : "s"} detected
                  {treatmentId ? " (Treatment + Screenplay)" : " (Screenplay)"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {detectedCharacters.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No characters found in scenes.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detectedCharacters.map((c) => {
                      const alreadyRole = (castingSettings?.roles_available || []).some(
                        (r) => r.toLowerCase() === c.name.toLowerCase(),
                      )
                      return (
                        <div key={c.name} className="flex items-center justify-between p-2 border border-border rounded-md">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{c.count}</Badge>
                            <span className="truncate max-w-[8rem] sm:max-w-[10rem]">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {alreadyRole ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                In Casting
                              </Badge>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => addRole(c.name)} disabled={syncing} title="Add to Casting">
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => createCharacter(c.name)} disabled={isCreatingCharacter} title="Create Character">
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="cinema-card">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Casting Roles
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {rolesAvailable.length} role{rolesAvailable.length === 1 ? "" : "s"} configured
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="new-character">Add role</Label>
                    <Input
                      id="new-character"
                      placeholder="e.g., Protagonist, Detective Jane"
                      value={newCharacter}
                      onChange={(e) => setNewCharacter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addNewCharacterAsRole()
                        }
                      }}
                      className="bg-input border-border"
                    />
                  </div>
                  <Button onClick={addNewCharacterAsRole} className="gap-2" disabled={!newCharacter.trim() || syncing}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>

                <Separator />

                {rolesAvailable.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No casting roles yet.</div>
                ) : (
                  <div className="space-y-2">
                    {rolesAvailable.map((role) => (
                      <div key={role} className="flex items-center justify-between">
                        <span>{role}</span>
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                )}

                {projectId && (
                  <div className="pt-2">
                    <Link href={`/casting/${projectId}`}>
                      <Button variant="outline" className="w-full gap-2">
                        Go to Casting
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}


