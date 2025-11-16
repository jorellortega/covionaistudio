"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Header from "@/components/header"
import { MoodBoardsService, type MoodBoard, type MoodBoardScope } from "@/lib/mood-boards-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseClient } from "@/lib/supabase"
import { ProjectSelector } from "@/components/project-selector"

export default function MoodBoardsPage() {
  const searchParams = useSearchParams()
  const initialScope = (searchParams.get('scope') as MoodBoardScope) || 'movie'
  const initialTarget = searchParams.get('targetId') || ""

  const [scope, setScope] = useState<MoodBoardScope>(initialScope)
  const [targetId, setTargetId] = useState<string>(initialTarget)
  const [boards, setBoards] = useState<MoodBoard[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const { toast } = useToast()
  const [aiPrompts, setAiPrompts] = useState<Record<string, string>>({})
  const [aiService, setAiService] = useState<'dalle' | 'openart'>('dalle')
  const [generatingForBoard, setGeneratingForBoard] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)

  const canLoad = useMemo(() => targetId && targetId.length > 0, [targetId])

  async function loadBoards() {
    if (!canLoad) return
    setLoading(true)
    try {
      let data: MoodBoard[] = []
      if (scope === 'movie') {
        data = await MoodBoardsService.listByProject(targetId)
      } else if (scope === 'scene') {
        data = await MoodBoardsService.listByScene(targetId)
      } else {
        data = await MoodBoardsService.listByShot(targetId)
      }
      setBoards(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function generateImageForBoard(boardId: string) {
    const prompt = aiPrompts[boardId]?.trim()
    if (!prompt) {
      toast({ title: "Enter a prompt", description: "Please provide a prompt to generate an image.", variant: "destructive" })
      return
    }
    try {
      setGeneratingForBoard(boardId)
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      if (!user) {
        toast({ title: "Not signed in", description: "Please sign in to generate images.", variant: "destructive" })
        return
      }
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          service: aiService,
          apiKey: 'configured',
          userId: user.id,
          autoSaveToBucket: true,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success || !result.imageUrl) {
        throw new Error(result.error || 'Failed to generate image')
      }
      // Add as mood board item via external_url (bucket saved)
      await MoodBoardsService.addItem({
        mood_board_id: boardId,
        external_url: result.imageUrl,
        kind: 'image',
        title: prompt.substring(0, 80),
      })
      toast({ title: "Image added", description: "AI image added to mood board." })
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message || 'Unknown error', variant: "destructive" })
    } finally {
      setGeneratingForBoard(null)
    }
  }

  async function suggestPromptFromContext() {
    if (!canLoad) {
      toast({ title: "Missing context", description: "Select a scope and enter an ID (or choose a Project).", variant: "destructive" })
      return
    }
    try {
      setSuggesting(true)
      const res = await fetch('/api/ai/mood-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, id: targetId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success || !json.prompt) throw new Error(json.error || 'Failed to create mood prompt')
      // Apply to all visible boards' prompt inputs for convenience
      setAiPrompts((prev) => {
        const next = { ...prev }
        boards.forEach((b) => { next[b.id] = json.prompt })
        return next
      })
      toast({ title: "Prompt suggested", description: "We filled in the prompt fields based on your context." })
    } catch (e: any) {
      toast({ title: "Suggestion failed", description: e?.message || 'Unknown error', variant: "destructive" })
    } finally {
      setSuggesting(false)
    }
  }

  useEffect(() => {
    setBoards([])
    if (canLoad) {
      void loadBoards()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  async function handleCreate() {
    if (!newName || !canLoad) return
    setCreating(true)
    try {
      await MoodBoardsService.createBoard({
        scope,
        targetId,
        name: newName,
        description: newDescription,
      })
      setNewName("")
      setNewDescription("")
      await loadBoards()
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await MoodBoardsService.deleteBoard(id)
      await loadBoards()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="w-full md:w-80">
          <label className="text-sm font-medium">Project</label>
          <div className="mt-1">
            <ProjectSelector
              selectedProject={scope === 'movie' ? targetId : undefined}
              onProjectChange={(projectId) => {
                setScope('movie')
                setTargetId(projectId)
                setBoards([])
                void loadBoards()
              }}
              placeholder="Select a movie project"
            />
          </div>
        </div>
        <div className="w-full md:w-48">
          <label className="text-sm font-medium">Scope</label>
          <Select value={scope} onValueChange={(v) => setScope(v as MoodBoardScope)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="movie">Movie (Project)</SelectItem>
              <SelectItem value="scene">Scene</SelectItem>
              <SelectItem value="shot">Shot (Storyboard)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full">
          <label className="text-sm font-medium">
            {scope === 'movie' ? 'Project ID' : scope === 'scene' ? 'Scene ID' : 'Storyboard ID'}
          </label>
          <Input
            className="mt-1"
            placeholder={scope === 'movie' ? 'Enter project id' : scope === 'scene' ? 'Enter scene id' : 'Enter storyboard id'}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          />
        </div>
        <Button className="md:ml-2" disabled={!canLoad || loading} onClick={() => loadBoards()}>
          {loading ? 'Loading…' : 'Load'}
        </Button>
        <Button
          variant="secondary"
          className="md:ml-2"
          disabled={!canLoad || suggesting}
          onClick={suggestPromptFromContext}
          title="Let AI draft a mood/image prompt from the selected context"
        >
          {suggesting ? 'Suggesting…' : 'Suggest from context'}
        </Button>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Create Mood Board</CardTitle>
          <CardDescription>Attach to the current scope target.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-sm font-medium">Name</label>
            <Input className="mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Color Palette v1" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <Input className="mt-1" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="md:col-span-3">
            <Button onClick={handleCreate} disabled={!newName || !canLoad || creating}>
              <Plus className="h-4 w-4 mr-2" /> {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{b.name}</CardTitle>
                <CardDescription className="mt-1">{b.description}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Scope: {b.scope} · Created: {new Date(b.created_at).toLocaleString()}
              </div>
              <Separator className="my-3" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Generate AI Image</span>
                  <Select value={aiService} onValueChange={(v) => setAiService(v as any)}>
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue placeholder="Service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dalle">DALL·E</SelectItem>
                      <SelectItem value="openart">OpenArt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Describe the look, palette, style..."
                  value={aiPrompts[b.id] || ''}
                  onChange={(e) => setAiPrompts(prev => ({ ...prev, [b.id]: e.target.value }))}
                />
                <Button
                  onClick={() => generateImageForBoard(b.id)}
                  disabled={generatingForBoard === b.id}
                >
                  {generatingForBoard === b.id ? 'Generating…' : 'Generate & Add'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </>
  )
}


