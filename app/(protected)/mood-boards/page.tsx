"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Header from "@/components/header"
import { MoodBoardsService, type MoodBoard, type MoodBoardScope, type MoodBoardItem } from "@/lib/mood-boards-service"
import { AssetService, type Asset } from "@/lib/asset-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, ExternalLink, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseClient } from "@/lib/supabase"
import { ProjectSelector } from "@/components/project-selector"
import { useAuthReady } from "@/components/auth-hooks"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { TimelineService, type SceneWithMetadata } from "@/lib/timeline-service"

export default function MoodBoardsPage() {
  const searchParams = useSearchParams()
  const initialScope = (searchParams.get('scope') as MoodBoardScope) || 'movie'
  const initialTarget = searchParams.get('targetId') || ""
  const initialProjectId = searchParams.get('projectId') || ""

  const { userId, ready } = useAuthReady()
  const [scope, setScope] = useState<MoodBoardScope>(initialScope)
  const [targetId, setTargetId] = useState<string>(initialTarget)
  const [projectId, setProjectId] = useState<string>(initialProjectId)
  const [boards, setBoards] = useState<MoodBoard[]>([])
  const [boardItems, setBoardItems] = useState<Record<string, MoodBoardItem[]>>({})
  const [itemAssets, setItemAssets] = useState<Record<string, Asset>>({}) // For items with asset_id
  const [loading, setLoading] = useState(false)
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const { toast } = useToast()
  const [aiPrompts, setAiPrompts] = useState<Record<string, string>>({})
  const [aiService, setAiService] = useState<'dalle' | 'openart'>('dalle')
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  const [generatingForBoard, setGeneratingForBoard] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [loadingScenes, setLoadingScenes] = useState(false)

  const canLoad = useMemo(() => targetId && targetId.length > 0, [targetId])

  // Map model names to service identifiers
  const mapModelToService = (model: string): 'dalle' | 'openart' => {
    switch (model) {
      case "DALL-E 3": return "dalle"
      case "OpenArt": return "openart"
      default: return "dalle"
    }
  }

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready || !userId) return
      
      try {
        const settings = await AISettingsService.getSystemSettings()
        
        // Ensure default settings exist for images tab
        const imagesSetting = await AISettingsService.getOrCreateDefaultTabSetting('images')
        
        // Merge existing settings with default, preferring existing
        const existingImagesSetting = settings.find(s => s.tab_type === 'images')
        const finalSettings = existingImagesSetting ? settings : [...settings, imagesSetting]
        
        setAiSettings(finalSettings)
        setAiSettingsLoaded(true)
        
        // Auto-select locked model for images if available
        const imagesTabSetting = finalSettings.find(setting => setting.tab_type === 'images')
        if (imagesTabSetting?.is_locked && imagesTabSetting.locked_model) {
          const service = mapModelToService(imagesTabSetting.locked_model)
          setAiService(service)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  // Load scenes when project is selected and scope is "scene"
  useEffect(() => {
    const loadScenes = async () => {
      const currentProjectId = projectId || initialProjectId
      if (!currentProjectId || !ready || !userId || scope !== 'scene') {
        setScenes([])
        return
      }
      
      setLoadingScenes(true)
      try {
        console.log('📋 Loading scenes for project:', currentProjectId)
        const projectScenes = await TimelineService.getMovieScenes(currentProjectId)
        console.log('📋 Loaded scenes:', projectScenes.length)
        setScenes(projectScenes)
        
        // If targetId is set from URL params and matches a scene, keep it
        // Otherwise, if scenes are loaded and targetId doesn't match, clear it
        if (initialTarget && !projectScenes.find(s => s.id === initialTarget)) {
          // targetId from URL doesn't match any scene, but we'll keep it in case user wants to enter manually
        }
      } catch (error) {
        console.error('Error loading scenes:', error)
        setScenes([])
        toast({
          title: "Error",
          description: "Failed to load scenes for this project.",
          variant: "destructive"
        })
      } finally {
        setLoadingScenes(false)
      }
    }

    loadScenes()
  }, [projectId, initialProjectId, scope, ready, userId, initialTarget])

  // Get images tab AI setting
  const getImagesTabSetting = () => {
    return aiSettings.find(setting => setting.tab_type === 'images')
  }

  // Check if images tab has a locked model
  const isImagesTabLocked = () => {
    const setting = getImagesTabSetting()
    return setting?.is_locked || false
  }

  // Get the locked model for images tab
  const getImagesTabLockedModel = () => {
    const setting = getImagesTabSetting()
    return setting?.locked_model || ""
  }

  async function loadBoards() {
    console.log('📋 loadBoards() called - canLoad:', canLoad, 'targetId:', targetId, 'scope:', scope)
    if (!canLoad) {
      console.log('📋 Cannot load - missing targetId or scope')
      return
    }
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
      console.log('📋 Loaded boards:', data.length)
      // Load items for each board
      const itemsMap: Record<string, MoodBoardItem[]> = {}
      const assetsMap: Record<string, Asset> = {}
      for (const board of data) {
        // Initialize with empty array to ensure board has an entry
        itemsMap[board.id] = []
        try {
          console.log(`📋 Loading items for board ${board.id} (${board.name})...`)
          const items = await MoodBoardsService.listItems(board.id)
          console.log(`📋 Loaded ${items.length} items for board ${board.id}`)
          itemsMap[board.id] = items
          // Load assets for items that reference assets
          for (const item of items) {
            if (item.asset_id && !item.external_url) {
              try {
                const asset = await AssetService.getAssetById(item.asset_id)
                if (asset) {
                  assetsMap[item.id] = asset
                }
              } catch (e) {
                console.error(`Failed to load asset ${item.asset_id} for item ${item.id}:`, e)
              }
            }
          }
        } catch (e) {
          console.error(`Failed to load items for board ${board.id}:`, e)
          itemsMap[board.id] = []
        }
      }
      console.log('📋 Setting board items:', Object.keys(itemsMap).length, 'boards with items')
      setBoardItems(itemsMap)
      setItemAssets(assetsMap)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function loadBoardItems(boardId: string) {
    setLoadingItems(prev => ({ ...prev, [boardId]: true }))
    try {
      const items = await MoodBoardsService.listItems(boardId)
      setBoardItems(prev => ({ ...prev, [boardId]: items }))
      // Load assets for items that reference assets
      const assetsMap: Record<string, Asset> = {}
      for (const item of items) {
        if (item.asset_id && !item.external_url) {
          try {
            const asset = await AssetService.getAssetById(item.asset_id)
            if (asset) {
              assetsMap[item.id] = asset
            }
          } catch (e) {
            console.error(`Failed to load asset ${item.asset_id} for item ${item.id}:`, e)
          }
        }
      }
      setItemAssets(prev => ({ ...prev, ...assetsMap }))
    } catch (e) {
      console.error(`Failed to load items for board ${boardId}:`, e)
    } finally {
      setLoadingItems(prev => ({ ...prev, [boardId]: false }))
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

      // Get the AI settings for images tab
      const imagesSetting = getImagesTabSetting()
      
      // Determine which service to use - locked model takes precedence
      let serviceToUse = aiService
      if (imagesSetting?.is_locked && imagesSetting.locked_model) {
        serviceToUse = mapModelToService(imagesSetting.locked_model)
      }

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          service: serviceToUse,
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
      // Reload items for this board to show the new image
      await loadBoardItems(boardId)
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

  // Auto-load boards when scope and targetId are provided from URL params on initial mount
  useEffect(() => {
    console.log('📋 Initial mount effect - initialScope:', initialScope, 'initialTarget:', initialTarget, 'ready:', ready)
    if (ready && initialScope && initialTarget && initialTarget.length > 0) {
      console.log('📋 Auto-loading boards on mount with:', { initialScope, initialTarget })
      // Small delay to ensure state is set
      setTimeout(() => {
        void loadBoards()
      }, 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]) // Run when ready

  // Reload items when boards change (in case items weren't loaded initially)
  useEffect(() => {
    console.log('📋 Boards changed effect - boards.length:', boards.length, 'items keys:', Object.keys(boardItems).length)
    const reloadItemsIfNeeded = async () => {
      // Check if any board is missing items
      const boardsWithoutItems = boards.filter(board => !boardItems[board.id] || boardItems[board.id].length === 0)
      console.log('📋 Boards without items:', boardsWithoutItems.length)
      
      if (boards.length > 0 && boardsWithoutItems.length > 0) {
        console.log('📋 Reloading items for boards without items...')
        const itemsMap: Record<string, MoodBoardItem[]> = {}
        const assetsMap: Record<string, Asset> = {}
        
        // Use Promise.all to await all board item loads
        // Initialize all boards with empty arrays first
        boards.forEach(board => {
          itemsMap[board.id] = []
        })
        
        await Promise.all(
          boards.map(async (board) => {
            try {
              const items = await MoodBoardsService.listItems(board.id)
              console.log(`📋 Reloaded ${items.length} items for board ${board.id}`)
              itemsMap[board.id] = items
              for (const item of items) {
                if (item.asset_id && !item.external_url) {
                  try {
                    const asset = await AssetService.getAssetById(item.asset_id)
                    if (asset) {
                      assetsMap[item.id] = asset
                    }
                  } catch (e) {
                    console.error(`Failed to load asset ${item.asset_id} for item ${item.id}:`, e)
                  }
                }
              }
            } catch (e) {
              console.error(`Failed to load items for board ${board.id}:`, e)
              itemsMap[board.id] = []
            }
          })
        )
        
        if (Object.keys(itemsMap).length > 0) {
          console.log('📋 Reloaded items for boards:', Object.keys(itemsMap))
          setBoardItems(itemsMap)
          setItemAssets(assetsMap)
        }
      }
    }
    
    reloadItemsIfNeeded()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards.length])

  useEffect(() => {
    setBoards([])
    setBoardItems({}) // Clear items when scope changes
    if (canLoad) {
      console.log('📋 Scope changed, loading boards...')
      void loadBoards()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  // Auto-load when targetId changes and canLoad becomes true
  useEffect(() => {
    if (canLoad && ready && !loading) {
      console.log('📋 targetId changed and canLoad is true, loading boards...')
      void loadBoards()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, canLoad, ready])

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
      // Remove items from state
      setBoardItems(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await loadBoards()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleDeleteItem(itemId: string, boardId: string) {
    try {
      await MoodBoardsService.deleteItem(itemId)
      await loadBoardItems(boardId)
      toast({ title: "Item deleted", description: "Item removed from mood board." })
    } catch (e) {
      console.error(e)
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Failed to delete item", variant: "destructive" })
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
              selectedProject={scope === 'movie' ? targetId : (projectId || initialProjectId || undefined)}
              onProjectChange={(projectId) => {
                if (scope === 'movie') {
                  console.log('📋 Project selected, setting targetId and loading boards:', projectId)
                  setTargetId(projectId)
                  setBoards([])
                  setBoardItems({})
                  // loadBoards will be called by the useEffect when targetId changes
                } else {
                  console.log('📋 Project selected for scene scope, setting projectId:', projectId)
                  setProjectId(projectId)
                  // Clear targetId when project changes so user can select a new scene
                  if (scope === 'scene') {
                    setTargetId('')
                  }
                }
              }}
              placeholder="Select a movie project"
            />
          </div>
        </div>
        <div className="w-full md:w-48">
          <label className="text-sm font-medium">Scope</label>
          <Select value={scope} onValueChange={(v) => {
            setScope(v as MoodBoardScope)
            // Clear targetId when scope changes
            if (v === 'scene' && !projectId) {
              setTargetId('')
            } else if (v !== 'scene') {
              setTargetId('')
            }
          }}>
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
            {scope === 'movie' ? 'Project ID' : scope === 'scene' ? 'Scene' : 'Storyboard ID'}
          </label>
          {scope === 'scene' && (projectId || initialProjectId) ? (
            <Select
              value={targetId}
              onValueChange={(value) => setTargetId(value)}
              disabled={loadingScenes}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={loadingScenes ? 'Loading scenes...' : 'Select a scene'} />
              </SelectTrigger>
              <SelectContent>
                {scenes.length > 0 ? (
                  scenes.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      <div className="flex items-center gap-2">
                        <span>{scene.name}</span>
                        {scene.metadata?.sceneNumber && (
                          <span className="text-xs text-muted-foreground">
                            (Scene {scene.metadata.sceneNumber})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {loadingScenes ? 'Loading scenes...' : 'No scenes available'}
                  </div>
                )}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="mt-1"
              placeholder={scope === 'movie' ? 'Enter project id' : scope === 'scene' ? 'Select project first, then choose scene' : 'Enter storyboard id'}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={scope === 'scene' && !projectId}
            />
          )}
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

      {loading && <div className="text-center text-muted-foreground py-8">Loading boards...</div>}
      {!loading && boards.length === 0 && canLoad && (
        <div className="text-center text-muted-foreground py-8">No mood boards found. Create one above.</div>
      )}
      {!loading && !canLoad && (
        <div className="text-center text-muted-foreground py-8">Select a scope and enter an ID (or choose a Project) to load mood boards.</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((b) => {
          console.log(`📋 Rendering board ${b.id} (${b.name}), items:`, boardItems[b.id]?.length || 0)
          return (
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
              
              {/* Display items (images) for this board */}
              {(() => {
                const items = boardItems[b.id]
                const hasItems = items !== undefined && Array.isArray(items) && items.length > 0
                console.log(`📋 Board ${b.id} (${b.name}): hasItems=${hasItems}, items exists=${items !== undefined}, items.length=${items?.length || 0}, items type=${typeof items}, isArray=${Array.isArray(items)}`)
                
                // If items aren't loaded yet for this board, try loading them
                if (items === undefined && !loadingItems[b.id]) {
                  console.log(`📋 Items not loaded for board ${b.id}, loading now...`)
                  setTimeout(() => {
                    void loadBoardItems(b.id)
                  }, 100)
                }
                
                return hasItems ? (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Items ({items.length})</div>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((item) => {
                      // Get image URL from either external_url or asset
                      const imageUrl = item.external_url || (item.asset_id && itemAssets[item.id]?.content_url) || null
                      const imageTitle = item.title || itemAssets[item.id]?.title || 'Mood board image'
                      
                      return (
                        <div
                          key={item.id}
                          className="relative group border border-border rounded-lg overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          {item.kind === 'image' && imageUrl && (
                            <div className="aspect-video relative">
                              <img
                                src={imageUrl}
                                alt={imageTitle}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error('Failed to load image:', imageUrl)
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => window.open(imageUrl, '_blank')}
                                  className="h-8"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleDeleteItem(item.id, b.id)}
                                  className="h-8 text-white hover:text-white"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              {imageTitle && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                                  {imageTitle}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <Separator className="my-3" />
                </div>
                ) : null
              })()}
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Generate AI Image</span>
                  {!isImagesTabLocked() && (
                    <Select value={aiService} onValueChange={(v) => setAiService(v as any)}>
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue placeholder="Service" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dalle">DALL·E</SelectItem>
                        <SelectItem value="openart">OpenArt</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                {/* Show locked model info if images tab is locked */}
                {isImagesTabLocked() && (
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      AI Online
                    </p>
                  </div>
                )}
                <Input
                  placeholder="Describe the look, palette, style..."
                  value={aiPrompts[b.id] || ''}
                  onChange={(e) => setAiPrompts(prev => ({ ...prev, [b.id]: e.target.value }))}
                />
                <Button
                  onClick={() => generateImageForBoard(b.id)}
                  disabled={generatingForBoard === b.id || loadingItems[b.id]}
                >
                  {generatingForBoard === b.id ? 'Generating…' : 'Generate & Add'}
                </Button>
              </div>
            </CardContent>
          </Card>
          )
        })}
      </div>
      </div>
    </>
  )
}


