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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Sparkles, Plus, Edit, Save, X, Trash2, Tag, Copy, Search, Upload, Image as ImageIcon } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { SavedPromptsService, type SavedPrompt } from "@/lib/saved-prompts-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { useAuthReady } from "@/components/auth-hooks"

export default function PromptsListPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { user, userId, ready } = useAuthReady()

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false)
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState("")
  const [prompt, setPrompt] = useState("")
  const [type, setType] = useState<string>("")
  const [style, setStyle] = useState("")
  const [model, setModel] = useState("")
  const [tags, setTags] = useState("")

  const promptTypes = [
    "character", "environment", "prop", "color", "lighting", "style", "prompt"
  ]

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!userId || !ready) return
      setLoading(true)
      try {
        setIsLoadingPrompts(true)
        setIsLoadingCharacters(true)
        
        // Load prompts - if projectId is set, show project-specific and universal prompts
        // If no projectId, show only universal prompts
        const loadedPrompts = await SavedPromptsService.getSavedPrompts(userId, projectId || null)
        setPrompts(loadedPrompts)
        
        // Load characters with master prompts if project is selected
        if (projectId) {
          const loadedCharacters = await CharactersService.getCharacters(projectId)
          setCharacters(loadedCharacters.filter(c => c.master_prompt && c.master_prompt.trim().length > 0))
        } else {
          setCharacters([])
        }
      } catch (err) {
        console.error("Failed to load prompts:", err)
        toast({
          title: "Error",
          description: "Failed to load prompts. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingPrompts(false)
        setIsLoadingCharacters(false)
        setLoading(false)
      }
    }
    if (ready && userId) {
      load()
    }
  }, [projectId, ready, userId, toast])

  // Convert characters with master prompts to SavedPrompt format
  const characterPrompts = useMemo(() => {
    return characters.map(char => ({
      id: `character-${char.id}`,
      user_id: char.user_id,
      project_id: char.project_id || null,
      scene_id: null,
      title: `${char.name} - Master Prompt`,
      prompt: char.master_prompt || '',
      type: 'character' as const,
      style: undefined,
      model: undefined,
      tags: [],
      use_count: 0,
      created_at: char.created_at,
      updated_at: char.updated_at,
      // Store character reference for editing (extended properties)
      characterId: char.id,
      characterName: char.name
    } as SavedPrompt & { characterId?: string; characterName?: string }))
  }, [characters])

  // Combine saved prompts and character prompts
  const allPrompts = useMemo(() => {
    return [...prompts, ...characterPrompts]
  }, [prompts, characterPrompts])

  // Filter prompts
  const filteredPrompts = useMemo(() => {
    let filtered = allPrompts

    // Filter by type
    if (filterType) {
      filtered = filtered.filter(p => p.type === filterType)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.prompt.toLowerCase().includes(query) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(query)))
      )
    }

    return filtered
  }, [allPrompts, filterType, searchQuery])

  // Group by type
  const promptsByType = useMemo(() => {
    const grouped: Record<string, SavedPrompt[]> = {}
    filteredPrompts.forEach(p => {
      const promptType = p.type || "prompt"
      if (!grouped[promptType]) {
        grouped[promptType] = []
      }
      grouped[promptType].push(p)
    })
    return grouped
  }, [filteredPrompts])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setEditingPromptId(null)
    clearForm()
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const clearForm = () => {
    setTitle("")
    setPrompt("")
    setType("")
    setStyle("")
    setModel("")
    setTags("")
    setEditingPromptId(null)
    setImagePreview(null)
  }

  const loadPromptIntoForm = (promptItem: any) => {
    setEditingPromptId(promptItem.id)
    setTitle(promptItem.title || "")
    setPrompt(promptItem.prompt || "")
    setType(promptItem.type || "")
    setStyle(promptItem.style || "")
    setModel(promptItem.model || "")
    setTags((promptItem.tags || []).join(", "))
    // Store character reference if it's a character prompt
    if (promptItem.characterId) {
      setEditingPromptId(`character-${promptItem.characterId}`)
    }
  }

  const createOrUpdatePrompt = async () => {
    if (!userId) return
    const titleValue = title.trim()
    if (!titleValue) {
      toast({ title: "Title required", description: "Please enter a prompt title.", variant: "destructive" })
      return
    }
    if (!prompt.trim()) {
      toast({ title: "Prompt required", description: "Please enter the prompt text.", variant: "destructive" })
      return
    }
    if (!type) {
      toast({ title: "Type required", description: "Please select a prompt type.", variant: "destructive" })
      return
    }

    try {
      setIsCreatingPrompt(true)

      // Check if this is a character prompt (editing existing character)
      const isCharacterPrompt = editingPromptId && editingPromptId.startsWith('character-')
      
      if (isCharacterPrompt && type === 'character') {
        // Update character's master_prompt
        const characterId = editingPromptId.replace('character-', '')
        await CharactersService.updateCharacter(characterId, {
          master_prompt: prompt.trim()
        })
        
        // Reload characters to update the list
        if (projectId) {
          const loadedCharacters = await CharactersService.getCharacters(projectId)
          setCharacters(loadedCharacters.filter(c => c.master_prompt && c.master_prompt.trim().length > 0))
        }
        
        toast({ title: "Character prompt updated", description: "Master prompt saved to character." })
      } else if (type === 'character' && projectId && !editingPromptId) {
        // Creating a new character prompt - this would create a character
        // For now, just create a regular saved prompt
        const parseTags = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean)

        const promptData: any = {
          project_id: projectId || null,
          title: titleValue,
          prompt: prompt.trim(),
          type: type as SavedPrompt['type'],
          style: style || undefined,
          model: model || undefined,
          tags: tags ? parseTags(tags) : [],
        }

        // Remove undefined values
        Object.keys(promptData).forEach(key => {
          if (promptData[key] === undefined) {
            delete promptData[key]
          }
        })

        const created = await SavedPromptsService.createSavedPrompt(userId, promptData)
        setPrompts([created, ...prompts])
        toast({ title: "Prompt created", description: `"${created.title}" added.` })
      } else {
        // Regular saved prompt create/update
        const parseTags = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean)

        const promptData: any = {
          project_id: projectId || null,
          title: titleValue,
          prompt: prompt.trim(),
          type: type as SavedPrompt['type'],
          style: style || undefined,
          model: model || undefined,
          tags: tags ? parseTags(tags) : [],
        }

        // Remove undefined values
        Object.keys(promptData).forEach(key => {
          if (promptData[key] === undefined) {
            delete promptData[key]
          }
        })

        if (editingPromptId && !isCharacterPrompt) {
          const updated = await SavedPromptsService.updateSavedPrompt(editingPromptId, promptData)
          setPrompts(prev => prev.map(p => p.id === editingPromptId ? updated : p))
          toast({ title: "Prompt updated", description: `"${updated.title}" saved.` })
        } else {
          const created = await SavedPromptsService.createSavedPrompt(userId, promptData)
          setPrompts([created, ...prompts])
          toast({ title: "Prompt created", description: `"${created.title}" added.` })
        }
      }

      clearForm()
    } catch (err) {
      console.error('Create/update prompt failed:', err)
      toast({
        title: "Error",
        description: editingPromptId ? "Failed to update prompt." : "Failed to create prompt.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingPrompt(false)
    }
  }

  const deletePrompt = async (id: string) => {
    if (!confirm("Delete this prompt? This cannot be undone.")) return
    try {
      // Check if this is a character prompt
      if (id.startsWith('character-')) {
        const characterId = id.replace('character-', '')
        // Clear the master_prompt instead of deleting the character
        await CharactersService.updateCharacter(characterId, {
          master_prompt: null
        })
        
        // Reload characters
        if (projectId) {
          const loadedCharacters = await CharactersService.getCharacters(projectId)
          setCharacters(loadedCharacters.filter(c => c.master_prompt && c.master_prompt.trim().length > 0))
        }
        
        if (editingPromptId === id) {
          clearForm()
        }
        toast({ title: "Deleted", description: "Character master prompt cleared." })
      } else {
        await SavedPromptsService.deleteSavedPrompt(id)
        setPrompts(prev => prev.filter(p => p.id !== id))
        if (editingPromptId === id) {
          clearForm()
        }
        toast({ title: "Deleted", description: "Prompt removed." })
      }
    } catch (e) {
      console.error('Delete prompt failed:', e)
      toast({ title: "Error", description: "Failed to delete prompt.", variant: "destructive" })
    }
  }

  const copyPrompt = (promptText: string) => {
    navigator.clipboard.writeText(promptText)
    toast({
      title: "Copied",
      description: "Prompt copied to clipboard",
    })
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB.",
        variant: "destructive",
      })
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setImagePreview(result)
    }
    reader.readAsDataURL(file)

    // Analyze image
    await analyzeImage(file)
  }

  const analyzeImage = async (file: File) => {
    setIsAnalyzingImage(true)
    try {
      // Convert file to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = (e) => {
          const result = e.target?.result as string
          resolve(result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const base64Image = await base64Promise

      // Call API to analyze image
      const response = await fetch('/api/ai/analyze-image-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: base64Image,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to analyze image')
      }

      const analysis = result.analysis

      // Populate form fields with extracted information
      if (analysis.title) setTitle(analysis.title)
      if (analysis.prompt) setPrompt(analysis.prompt)
      if (analysis.type) setType(analysis.type)
      if (analysis.style) setStyle(analysis.style)
      if (analysis.tags) setTags(analysis.tags)

      toast({
        title: "Image analyzed",
        description: "Prompt information extracted from image. Review and save.",
      })
    } catch (error: any) {
      console.error('Error analyzing image:', error)
      toast({
        title: "Analysis failed",
        description: error?.message || "Failed to analyze image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzingImage(false)
      // Clear file input
      const fileInput = document.getElementById('image-upload') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }
    }
  }

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'character': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'environment': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'prop': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'color': return 'bg-pink-500/20 text-pink-400 border-pink-500/30'
      case 'lighting': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'style': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'prompt': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">
              Prompts List
            </h1>
            <p className="text-muted-foreground">
              Manage your saved AI prompts for image generation and other AI features.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie (or leave blank for universal prompts)"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading prompts...
          </div>
        ) : (
          <>
            {/* Filters */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Filters & Search</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={filterType || "__all__"} onValueChange={(value) => setFilterType(value === "__all__" ? "" : value)}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All types</SelectItem>
                        {promptTypes.map(t => (
                          <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-input border-border pl-10"
                        placeholder="Search by title, prompt, or tags..."
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Create/Edit Form */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <CardTitle>
                  {editingPromptId ? "Edit Prompt" : "Create New Prompt"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {projectId ? "This prompt will be available for this project and as a universal prompt." : "This will be a universal prompt available for all projects."}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Image Import Section */}
                <div className="space-y-2">
                  <Label>Import from Image</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isAnalyzingImage}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('image-upload')?.click()}
                      disabled={isAnalyzingImage}
                      className="gap-2"
                    >
                      {isAnalyzingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Import & Analyze Image
                        </>
                      )}
                    </Button>
                    {imagePreview && (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-12 w-12 object-cover rounded border border-border"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => setImagePreview(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload an image to automatically extract prompt information using AI vision analysis.
                  </p>
                </div>

                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g., Cinematic Night Scene"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select value={type || "__none__"} onValueChange={(value) => setType(value === "__none__" ? "" : value)}>
                      <SelectTrigger id="type" className="bg-input border-border">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {promptTypes.map(t => (
                          <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt Text *</Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="bg-input border-border min-h-[120px] font-mono text-sm"
                    placeholder="Enter your AI prompt here..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="style">Style</Label>
                    <Input
                      id="style"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g., cinematic, photorealistic, stylized"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g., DALL-E 3, Midjourney, Stable Diffusion"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="bg-input border-border"
                    placeholder="e.g., night, urban, dramatic, moody"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={createOrUpdatePrompt}
                    disabled={isCreatingPrompt || !title.trim() || !prompt.trim() || !type}
                    className="gap-2"
                  >
                    {isCreatingPrompt ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingPromptId ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingPromptId ? "Update Prompt" : "Create Prompt"}
                  </Button>
                  {editingPromptId && (
                    <Button variant="outline" onClick={clearForm} disabled={isCreatingPrompt} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Prompts List */}
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Saved Prompts
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isLoadingPrompts
                    ? "Loading..."
                    : `${filteredPrompts.length} prompt${filteredPrompts.length === 1 ? "" : "s"}`}
                </p>
              </CardHeader>
              <CardContent>
                {isLoadingPrompts ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading prompts...
                  </div>
                ) : filteredPrompts.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    {searchQuery || filterType
                      ? "No prompts match your filters. Try adjusting your search."
                      : "No prompts yet. Create your first prompt above."}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(promptsByType).map(([promptType, typePrompts]) => (
                      <div key={promptType} className="space-y-3">
                        <h3 className="text-lg font-semibold border-b border-border pb-2 capitalize">
                          {promptType} ({typePrompts.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {typePrompts.map((promptItem) => (
                            <div
                              key={promptItem.id}
                              className="p-4 border border-border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-base">{promptItem.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className={getTypeColor(promptItem.type)}>
                                        {promptItem.type}
                                      </Badge>
                                      {promptItem.use_count > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                          Used {promptItem.use_count} time{promptItem.use_count === 1 ? "" : "s"}
                                        </Badge>
                                      )}
                                      {promptItem.characterId && (
                                        <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                                          Character: {promptItem.characterName}
                                        </Badge>
                                      )}
                                      {!promptItem.project_id && !promptItem.characterId && (
                                        <Badge variant="outline" className="text-xs">
                                          Universal
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => copyPrompt(promptItem.prompt)}
                                      title="Copy prompt"
                                      className="h-7 w-7"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => loadPromptIntoForm(promptItem)}
                                      title="Edit"
                                      className="h-7 w-7"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deletePrompt(promptItem.id)}
                                      title="Delete"
                                      className="h-7 w-7 text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="p-3 bg-background rounded border border-border">
                                    <p className="text-sm font-mono whitespace-pre-wrap break-words">
                                      {promptItem.prompt}
                                    </p>
                                  </div>

                                  {(promptItem.style || promptItem.model) && (
                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      {promptItem.style && (
                                        <span>Style: {promptItem.style}</span>
                                      )}
                                      {promptItem.model && (
                                        <span>Model: {promptItem.model}</span>
                                      )}
                                    </div>
                                  )}

                                  {promptItem.tags && promptItem.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {promptItem.tags.map((tag, index) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          <Tag className="h-2 w-2 mr-1" />
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

