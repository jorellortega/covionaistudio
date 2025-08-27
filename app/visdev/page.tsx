'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { OpenAIService, AnthropicService, OpenArtService } from '@/lib/ai-services'
import { AISettingsService } from '@/lib/ai-settings-service'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseClient } from '@/lib/supabase'
import { ProjectSelector } from '@/components/project-selector'
import { MovieService, Movie } from '@/lib/movie-service'
import { TimelineService, SceneWithMetadata } from '@/lib/timeline-service'
import { AssetService, CreateAssetData } from '@/lib/asset-service'
import Header from '@/components/header'

interface VisualDevelopmentItem {
  id: string
  type: 'character' | 'environment' | 'prop' | 'color' | 'lighting' | 'style'
  title: string
  description: string
  prompt: string
  generatedContent?: string
  generatedImage?: string
  tags: string[]
  projectId?: string | null
  sceneId?: string | null
  databaseId?: string | null
  createdAt: string
}

interface SavedPrompt {
  id: string
  type: 'character' | 'environment' | 'prop' | 'color' | 'lighting' | 'style'
  title: string
  prompt: string
  style: string
  model: string
  tags: string[]
  projectId?: string | null
  sceneId?: string | null
  createdAt: string
  useCount: number
}

export default function VisualDevelopmentPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<VisualDevelopmentItem[]>([])
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  const [activeTab, setActiveTab] = useState('characters')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiSettings, setAiSettings] = useState<any>(null)
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const [selectedProject, setSelectedProject] = useState<string>("all")
  const [selectedScene, setSelectedScene] = useState<string>("movie")
  const [movies, setMovies] = useState<Movie[]>([])
  const [scenes, setScenes] = useState<SceneWithMetadata[]>([])
  const [prompt, setPrompt] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('cinematic')
  const [selectedModel, setSelectedModel] = useState('openai')
  const [promptFilter, setPromptFilter] = useState('all')
  const [promptProjectFilter, setPromptProjectFilter] = useState('all')
  const [promptSceneFilter, setPromptSceneFilter] = useState('all')
  const [promptSearch, setPromptSearch] = useState('')
  const [customStyles, setCustomStyles] = useState<{[key: string]: string}>({})
  const [showCustomStyleInput, setShowCustomStyleInput] = useState(false)
  const [newCustomStyle, setNewCustomStyle] = useState({ name: '', description: '' })

  const styles = {
    cinematic: 'Cinematic movie poster style, dramatic lighting, professional photography',
    concept: 'Concept art style, detailed illustration, professional artwork',
    sketch: 'Rough sketch style, pencil drawing, concept development',
    realistic: 'Photorealistic style, high detail, professional photography',
    stylized: 'Stylized art style, unique visual approach, artistic interpretation',
    // Custom styles
    cyberpunk: 'Cyberpunk aesthetic, neon lighting, futuristic urban decay, high contrast',
    fantasy: 'Fantasy art style, magical atmosphere, ethereal lighting, mystical elements',
    noir: 'Film noir style, high contrast, dramatic shadows, moody atmosphere',
    watercolor: 'Watercolor painting style, soft edges, artistic texture, flowing colors',
    anime: 'Anime style, cel-shaded, vibrant colors, expressive characters',
    steampunk: 'Steampunk aesthetic, brass and copper tones, Victorian era technology',
    sciFi: 'Science fiction style, futuristic technology, clean lines, advanced aesthetics',
    horror: 'Horror atmosphere, dark mood, unsettling elements, dramatic shadows'
  }

  // Combine built-in and custom styles
  const allStyles = {
    ...styles,
    ...customStyles
  }

  const models = {
    openai: 'OpenAI DALL-E 3',
    anthropic: 'Anthropic Claude',
    openart: 'OpenArt SDXL'
  }

    useEffect(() => {
    if (user) {
      loadAISettings()
      loadUserApiKeys()
      loadMovies()
      loadExistingItems()
    }
  }, [user])

  // Load scenes when project changes
  useEffect(() => {
    if (selectedProject && selectedProject !== 'all' && selectedProject !== 'free') {
      loadScenes(selectedProject)
      setSelectedScene("movie") // Reset scene selection when project changes
    } else {
      setScenes([])
      setSelectedScene("movie")
    }
  }, [selectedProject])

  // Auto-select locked model when AI settings change
  useEffect(() => {
    if (aiSettings && aiSettings.is_locked && aiSettings.locked_model) {
      // Map the locked model to our model keys
      const modelMapping: { [key: string]: string } = {
        'DALL-E 3': 'openai',
        'Claude': 'anthropic',
        'SDXL': 'openart'
      }
      const mappedModel = modelMapping[aiSettings.locked_model]
      if (mappedModel) {
        setSelectedModel(mappedModel)
      }
    }
  }, [aiSettings])

  const loadAISettings = async () => {
    try {
      const settings = await AISettingsService.getUserSettings(user!.id)
      const imageSettings = settings.find(s => s.tab_type === 'images')
      setAiSettings(imageSettings)
    } catch (error) {
      console.error('Failed to load AI settings:', error)
    }
  }

  const loadUserApiKeys = async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      setUserApiKeys(data || {})
    } catch (error) {
      console.error('Error fetching user API keys:', error)
    }
  }

  const loadMovies = async () => {
    try {
      const userMovies = await MovieService.getMovies()
      setMovies(userMovies)
    } catch (error) {
      console.error('Error loading movies:', error)
      setMovies([])
    }
  }

  const loadScenes = async (movieId: string) => {
    try {
      if (movieId && movieId !== 'all' && movieId !== 'free') {
        const movieScenes = await TimelineService.getMovieScenes(movieId)
        setScenes(movieScenes)
        console.log('Loaded scenes for movie:', movieId, 'Count:', movieScenes.length)
      } else {
        setScenes([])
      }
    } catch (error) {
      console.error('Error loading scenes:', error)
      setScenes([])
    }
  }

  const loadExistingItems = async () => {
    // In a real app, this would load from your database
    // For now, we'll use localStorage
    const saved = localStorage.getItem('visdev-items')
    if (saved) {
      setItems(JSON.parse(saved))
    }
    
    const savedPromptsData = localStorage.getItem('visdev-saved-prompts')
    if (savedPromptsData) {
      setSavedPrompts(JSON.parse(savedPromptsData))
    }
    
    const savedCustomStyles = localStorage.getItem('visdev-custom-styles')
    if (savedCustomStyles) {
      setCustomStyles(JSON.parse(savedCustomStyles))
    }
  }

  const saveItems = (newItems: VisualDevelopmentItem[]) => {
    setItems(newItems)
    localStorage.setItem('visdev-items', JSON.stringify(newItems))
  }

  const savePrompt = (newPrompt: SavedPrompt) => {
    const updatedPrompts = [...savedPrompts, newPrompt]
    setSavedPrompts(updatedPrompts)
    localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))
  }

  const updatePromptUseCount = (promptId: string) => {
    const updatedPrompts = savedPrompts.map(p => 
      p.id === promptId ? { ...p, useCount: p.useCount + 1 } : p
    )
    setSavedPrompts(updatedPrompts)
    localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))
  }

  const deletePrompt = (promptId: string) => {
    const updatedPrompts = savedPrompts.filter(p => p.id !== promptId)
    setSavedPrompts(updatedPrompts)
    localStorage.setItem('visdev-saved-prompts', JSON.stringify(updatedPrompts))
  }

  const addCustomStyle = () => {
    if (newCustomStyle.name && newCustomStyle.description) {
      const styleKey = newCustomStyle.name.toLowerCase().replace(/\s+/g, '-')
      const updatedCustomStyles = {
        ...customStyles,
        [styleKey]: newCustomStyle.description
      }
      setCustomStyles(updatedCustomStyles)
      localStorage.setItem('visdev-custom-styles', JSON.stringify(updatedCustomStyles))
      setNewCustomStyle({ name: '', description: '' })
      setShowCustomStyleInput(false)
      toast({
        title: "Success",
        description: "Custom style added successfully!",
      })
    }
  }

  const deleteCustomStyle = (styleKey: string) => {
    const updatedCustomStyles = { ...customStyles }
    delete updatedCustomStyles[styleKey]
    setCustomStyles(updatedCustomStyles)
    localStorage.setItem('visdev-custom-styles', JSON.stringify(updatedCustomStyles))
    toast({
      title: "Style Deleted",
      description: "Custom style removed successfully!",
    })
  }

  const saveImageToBucket = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      const response = await fetch('/api/ai/download-and-store-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          fileName,
          userId: user!.id
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to save image: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        return result.supabaseUrl
      } else {
        throw new Error(result.error || 'Failed to save image')
      }
    } catch (error) {
      console.error('Error saving image to bucket:', error)
      throw error
    }
  }

  const saveToDatabase = async (item: VisualDevelopmentItem): Promise<void> => {
    try {
      if (!selectedProject || selectedProject === 'all' || selectedProject === 'free') {
        console.log('No project selected, skipping database save')
        return
      }

      // Prepare asset data
      const assetData: CreateAssetData = {
        project_id: selectedProject,
        scene_id: selectedScene === 'movie' ? null : selectedScene,
        title: item.title,
        content_type: 'image',
        content: item.generatedContent,
        content_url: item.generatedImage,
        prompt: item.prompt,
        model: selectedModel,
        generation_settings: {
          style: selectedStyle,
          type: item.type,
          tags: item.tags
        },
        metadata: {
          type: item.type,
          style: selectedStyle,
          tags: item.tags,
          projectId: item.projectId,
          sceneId: item.sceneId
        }
      }

      // Save to database
      const savedAsset = await AssetService.createAsset(assetData)
      console.log('Asset saved to database:', savedAsset)

      // Update local item with database ID
      const updatedItem = { ...item, databaseId: savedAsset.id }
      const updatedItems = items.map(i => i.id === item.id ? updatedItem : i)
      setItems(updatedItems)
      localStorage.setItem('visdev-items', JSON.stringify(updatedItems))

      toast({
        title: "Saved to Database",
        description: `Content saved to project: ${movies.find(m => m.id.toString() === selectedProject)?.name}`,
      })

    } catch (error) {
      console.error('Error saving to database:', error)
      toast({
        title: "Database Save Failed",
        description: "Content saved locally only. Check console for details.",
        variant: "destructive"
      })
    }
  }

  const deleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId)
    setItems(updatedItems)
    localStorage.setItem('visdev-items', JSON.stringify(updatedItems))
    toast({
      title: "Item Deleted",
      description: "Content removed successfully!",
    })
  }

  const editItem = (item: VisualDevelopmentItem) => {
    setPrompt(item.prompt)
    setSelectedStyle(item.tags.find(tag => Object.values(allStyles).includes(tag)) || 'cinematic')
    setActiveTab(item.type + 's')
    // Scroll to top to show the generation form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isModelAvailable = (modelKey: string) => {
    if (!aiSettings || !aiSettings.is_locked) return false
    
    const modelMapping: { [key: string]: string } = {
      'openai': 'DALL-E 3',
      'anthropic': 'Claude',
      'openart': 'SDXL'
    }
    
    return aiSettings.locked_model === modelMapping[modelKey]
  }

  const getModelStatus = (modelKey: string) => {
    if (!aiSettings) return 'Not Configured'
    if (!aiSettings.is_locked) return 'Not Locked'
    if (isModelAvailable(modelKey)) return 'Available'
    return 'Not Available'
  }

  const generateContent = async (type: string, prompt: string) => {
    if (!prompt.trim() || !aiSettings) {
      toast({
        title: "Error",
        description: "Please enter a prompt and ensure AI settings are configured",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      let response
      let apiKey = ''
      
      if (selectedModel === 'openai') {
        apiKey = userApiKeys.openai_api_key || ''
      } else if (selectedModel === 'anthropic') {
        apiKey = userApiKeys.anthropic_api_key || ''
      } else if (selectedModel === 'openart') {
        apiKey = userApiKeys.openart_api_key || ''
      }

      if (!apiKey) {
        toast({
          title: "API Key Missing",
          description: `Please add your ${models[selectedModel as keyof typeof models]} API key in Settings → Profile`,
          variant: "destructive"
        })
        return
      }

      if (selectedModel === 'openai') {
        response = await OpenAIService.generateImage({
          prompt: `${styles[selectedStyle as keyof typeof styles]} style: ${prompt}`,
          style: styles[selectedStyle as keyof typeof styles],
          model: 'dall-e-3',
          apiKey
        })
      } else if (selectedModel === 'anthropic') {
        response = await AnthropicService.generateScript({
          prompt: `Generate detailed visual development content for: ${prompt}`,
          template: `You are a professional visual development artist. Create detailed descriptions for ${type} including visual style, mood, and technical specifications.`,
          model: 'claude-3-sonnet-20240229',
          apiKey
        })
      } else if (selectedModel === 'openart') {
        response = await OpenArtService.generateImage({
          prompt: `${styles[selectedStyle as keyof typeof styles]} style: ${prompt}`,
          style: styles[selectedStyle as keyof typeof styles],
          model: 'sdxl',
          apiKey
        })
      }

      if (response?.success) {
        const newItem: VisualDevelopmentItem = {
          id: Date.now().toString(),
          type: type as any,
          title: prompt.substring(0, 50) + '...',
          description: prompt,
          prompt,
          generatedContent: response.data?.content || response.data?.choices?.[0]?.message?.content,
          generatedImage: response.data?.data?.[0]?.url,
          tags: [type, selectedStyle],
          projectId: selectedProject === 'all' ? null : selectedProject,
          sceneId: selectedScene === 'movie' ? null : selectedScene || null,
          createdAt: new Date().toISOString()
        }

        saveItems([...items, newItem])
        
        // Save the successful prompt
        const newSavedPrompt: SavedPrompt = {
          id: Date.now().toString() + '-prompt',
          type: type as any,
          title: `Generated ${type}`,
          prompt,
          style: selectedStyle,
          model: selectedModel,
          tags: [type, selectedStyle, selectedModel],
          projectId: selectedProject === 'all' ? null : selectedProject,
          sceneId: selectedScene === 'movie' ? null : selectedScene || null,
          createdAt: new Date().toISOString(),
          useCount: 1
        }
        savePrompt(newSavedPrompt)
        
        toast({
          title: "Success",
          description: `${type} generated successfully!`,
        })
      } else {
        throw new Error(response?.error || 'Generation failed')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to generate ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const getTabContent = (type: string) => {
    const typeItems = items.filter(item => item.type === type)
    .filter(item => selectedProject === 'all' || 
      (selectedProject === 'free' && !item.projectId) || 
      (selectedProject === item.projectId))
    
    return (
      <div className="space-y-8">
        <div className="max-w-5xl mx-auto">
          {/* AI Model Status Indicator */}
          {!aiSettings?.is_locked ? (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2">
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Setup Required:</strong> Lock an AI model in Settings → AI Settings to enable generation.
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-sm text-green-600 flex items-center gap-2">
                <span className="text-green-500">●</span>
                AI Online
              </p>
            </div>
          )}
          
          <div className="bg-card border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4 text-center sm:text-left">Generate New {type.charAt(0).toUpperCase() + type.slice(1)}</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder={`Describe your ${type}...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 min-w-0"
              />
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(allStyles).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center justify-between w-full">
                        <span>{key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ')}</span>
                        {customStyles[key] && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteCustomStyle(key)
                            }}
                            className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="add-custom" onSelect={() => setShowCustomStyleInput(true)}>
                    + Add Custom Style
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {/* Only show model selection when NOT locked */}
              {!aiSettings?.is_locked ? (
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(models).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                /* Show AI Online status when locked */
                <div className="w-48 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-md flex items-center justify-center">
                  <span className="text-sm text-green-600 font-medium">
                    AI Online
                  </span>
                </div>
              )}
              
              <Button 
                onClick={() => generateContent(type, prompt)}
                disabled={isGenerating || !prompt.trim() || !aiSettings?.is_locked}
                className="px-8"
              >
                {isGenerating ? 'Generating...' : 
                 !aiSettings?.is_locked ? 'Lock AI Model First' : 'Generate'}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Content Filter */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-center sm:justify-start">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="free">Free Play Only</SelectItem>
                {movies.map((movie) => (
                  <SelectItem key={movie.id} value={movie.id}>
                    {movie.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Save All Button and Status */}
          {selectedProject && selectedProject !== 'all' && selectedProject !== 'free' && (
            <div className="mb-4 flex flex-col sm:flex-row gap-4 justify-center sm:justify-start items-center">
              {/* Status Info */}
              <div className="text-sm text-muted-foreground">
                {typeItems.filter(item => item.databaseId).length} of {typeItems.length} items saved to database
              </div>
              
              {/* Save All Button */}
              {typeItems.some(item => !item.databaseId) && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const unsavedItems = typeItems.filter(item => !item.databaseId)
                    for (const item of unsavedItems) {
                      await saveToDatabase(item)
                    }
                  }}
                  className="px-6"
                >
                  💾 Save All to Database
                </Button>
              )}
            </div>
          )}
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {typeItems.map((item) => (
              <Card key={item.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {item.generatedImage && (
                  <div className="aspect-square overflow-hidden">
                    <img 
                      src={item.generatedImage} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {item.projectId ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        {movies.find(m => m.id.toString() === item.projectId)?.name || 'Project'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                        Free Play
                      </Badge>
                    )}
                    {item.sceneId && (
                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                        Scene {scenes.find(s => s.id === item.sceneId)?.metadata?.sceneNumber || 'N/A'}: {scenes.find(s => s.id === item.sceneId)?.name}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                {item.generatedContent && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {item.generatedContent}
                    </p>
                  </CardContent>
                )}
                
                {/* Action Buttons */}
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-2">
                    {/* Save to Database Button */}
                    {selectedProject && selectedProject !== 'all' && selectedProject !== 'free' && !item.databaseId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveToDatabase(item)}
                        className="text-xs"
                      >
                        💾 Save
                      </Button>
                    )}
                    
                    {/* Already Saved Indicator */}
                    {item.databaseId && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="text-xs bg-green-50 text-green-700 border-green-200"
                      >
                        ✅ Saved
                      </Button>
                    )}
                    
                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editItem(item)}
                      className="text-xs"
                    >
                      ✏️ Edit
                    </Button>
                    
                    {/* Delete Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteItem(item.id)}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      🗑️ Del
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {typeItems.length === 0 && (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="bg-muted/50 rounded-lg p-8 border-2 border-dashed border-muted-foreground/20">
              <p className="text-lg text-muted-foreground mb-2">No {type} created yet</p>
              <p className="text-sm text-muted-foreground/70">Start by describing what you want to generate above!</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Visual Development</h1>
          <p className="text-muted-foreground">Please log in to access visual development tools.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-center sm:text-left">Visual Development</h1>
          <p className="text-xl text-muted-foreground text-center sm:text-left max-w-3xl mx-auto sm:mx-0 mb-6">
            Create and manage visual elements for your project with AI assistance
          </p>
          
          {/* Project Selection */}
          <div className="max-w-md mx-auto sm:mx-0">
            <label className="text-sm font-medium mb-2 block">Link to Movie Project (Optional)</label>
            <ProjectSelector
              selectedProject={selectedProject}
              onProjectChange={setSelectedProject}
              placeholder="Free Play - No Project Linked"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {selectedProject === 'all' ? (
                <span className="text-blue-600">
                  🎨 Free Play Mode - Content saved locally for experimentation
                </span>
              ) : selectedProject === 'free' ? (
                <span className="text-blue-600">
                  🎨 Free Play Mode - Content saved locally for experimentation
                </span>
              ) : (
                <span className="text-green-600">
                  ✅ Will save to: <strong>{movies.find((m) => m.id.toString() === selectedProject)?.name}</strong>
                </span>
              )}
            </p>
          </div>

          {/* Scene Selection - Only show when a movie is selected */}
          {selectedProject && selectedProject !== 'all' && selectedProject !== 'free' && scenes.length > 0 && (
            <div className="max-w-md mx-auto sm:mx-0 mt-4">
              <label className="text-sm font-medium mb-2 block">Link to Specific Scene (Optional)</label>
              <Select value={selectedScene} onValueChange={setSelectedScene}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a scene (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">No Scene - Movie Level</SelectItem>
                  {scenes.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      <span className="text-sm font-medium">
                        Scene {scene.metadata?.sceneNumber || 'N/A'}: {scene.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                              {selectedScene && selectedScene !== 'movie' ? (
                <span className="text-green-600">
                  🎬 Linked to: <strong>Scene {scenes.find(s => s.id === selectedScene)?.metadata?.sceneNumber || 'N/A'}: {scenes.find(s => s.id === selectedScene)?.name}</strong>
                </span>
              ) : (
                <span className="text-blue-600">
                  🎬 Movie Level - Content linked to entire project
                </span>
              )}
              </p>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 max-w-6xl mx-auto">
            <TabsTrigger value="characters">Characters</TabsTrigger>
            <TabsTrigger value="environments">Environments</TabsTrigger>
            <TabsTrigger value="props">Props</TabsTrigger>
            <TabsTrigger value="colors">Color Scripts</TabsTrigger>
            <TabsTrigger value="lighting">Lighting</TabsTrigger>
            <TabsTrigger value="style">Style Guides</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
          </TabsList>

          <TabsContent value="characters" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Character Development</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Design how characters look, dress, move, and express emotions. Generate character concepts, 
                expressions, poses, and costume variations.
              </p>
            </div>
            {getTabContent('character')}
          </TabsContent>

          <TabsContent value="environments" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Environment & Location Design</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Create the style, scale, and mood of your world. From forests to futuristic cities, 
                design the spaces where your story unfolds.
              </p>
            </div>
            {getTabContent('environment')}
          </TabsContent>

          <TabsContent value="props" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Props & Objects</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Design objects, vehicles, weapons, furniture, and interactive elements. 
                Create props that enhance storytelling and character development.
              </p>
            </div>
            {getTabContent('prop')}
          </TabsContent>

          <TabsContent value="colors" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Color Scripts</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Plan how color shifts across your film/animation to guide mood and storytelling. 
                Create color palettes for different scenes and emotional beats.
              </p>
            </div>
            {getTabContent('color')}
          </TabsContent>

          <TabsContent value="lighting" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Lighting & Atmosphere</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Design how scenes feel through lighting - warm, cold, scary, magical, etc. 
                Create atmospheric lighting that enhances the emotional impact of your story.
              </p>
            </div>
            {getTabContent('lighting')}
          </TabsContent>

          <TabsContent value="style" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Style Guides & Bibles</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Create rulebooks for your project's visual identity. Ensure all artists stay consistent 
                with design principles, color schemes, and visual language.
              </p>
            </div>
            {getTabContent('style')}
          </TabsContent>

          <TabsContent value="prompts" className="space-y-6">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-3xl font-semibold mb-4">Saved Prompts</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto sm:mx-0">
                Manage and reuse your successful prompts. Organize prompts by type, style, and model for quick access.
              </p>
            </div>
            
            <div className="max-w-4xl mx-auto mb-8 p-6 border rounded-lg bg-card shadow-sm">
              <h3 className="text-lg font-medium mb-4 text-center">Save Current Prompt</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Prompt Title</label>
                  <Input
                    placeholder="Enter a title for this prompt..."
                    value={prompt ? `Prompt: ${prompt.substring(0, 30)}...` : ''}
                    disabled={!prompt}
                  />
                </div>
                <div className="w-40">
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <Select value={activeTab.replace('s', '')} onValueChange={(value) => setActiveTab(value + 's')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="character">Character</SelectItem>
                      <SelectItem value="environment">Environment</SelectItem>
                      <SelectItem value="prop">Prop</SelectItem>
                      <SelectItem value="color">Color</SelectItem>
                      <SelectItem value="lighting">Lighting</SelectItem>
                      <SelectItem value="style">Style</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => {
                    if (prompt) {
                      const newSavedPrompt: SavedPrompt = {
                        id: Date.now().toString() + '-manual',
                        type: activeTab.replace('s', '') as any,
                        title: `Manual: ${prompt.substring(0, 30)}...`,
                        prompt,
                        style: selectedStyle,
                        model: selectedModel,
                        tags: [activeTab.replace('s', ''), selectedStyle, selectedModel],
                        projectId: selectedProject === 'all' ? null : selectedProject,
                        sceneId: selectedScene === 'movie' ? null : selectedScene || null,
                        createdAt: new Date().toISOString(),
                        useCount: 0
                      }
                      savePrompt(newSavedPrompt)
                      toast({
                        title: "Success",
                        description: "Prompt saved successfully!",
                      })
                    }
                  }}
                  disabled={!prompt}
                  className="px-6"
                >
                  Save Prompt
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {savedPrompts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No saved prompts yet. Generate some content to see your prompts here!</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Select value={promptFilter} onValueChange={setPromptFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="character">Characters</SelectItem>
                        <SelectItem value="environment">Environments</SelectItem>
                        <SelectItem value="prop">Props</SelectItem>
                        <SelectItem value="color">Colors</SelectItem>
                        <SelectItem value="lighting">Lighting</SelectItem>
                        <SelectItem value="style">Style</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={promptProjectFilter} onValueChange={setPromptProjectFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        <SelectItem value="free">Free Play</SelectItem>
                        {movies.map((movie) => (
                          <SelectItem key={movie.id} value={movie.id}>
                            {movie.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {promptProjectFilter && promptProjectFilter !== 'all' && promptProjectFilter !== 'free' && scenes.length > 0 && (
                      <Select value={promptSceneFilter} onValueChange={setPromptSceneFilter}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filter by scene" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Scenes</SelectItem>
                          <SelectItem value="movie">Movie Level</SelectItem>
                          {scenes.map((scene) => (
                            <SelectItem key={scene.id} value={scene.id}>
                              Scene {scene.metadata?.sceneNumber || 'N/A'}: {scene.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder="Search prompts..."
                      value={promptSearch}
                      onChange={(e) => setPromptSearch(e.target.value)}
                      className="flex-1 max-w-md"
                    />
                  </div>
                  
                  <div className="max-w-6xl mx-auto">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {savedPrompts
                        .filter(p => promptFilter === 'all' || p.type === promptFilter)
                        .filter(p => promptProjectFilter === 'all' || 
                          (promptProjectFilter === 'free' && !p.projectId) || 
                          (promptProjectFilter === p.projectId))
                        .filter(p => promptSceneFilter === 'all' || 
                          (promptSceneFilter === 'movie' && !p.sceneId) || 
                          (promptSceneFilter === p.sceneId))
                        .filter(p => !promptSearch || p.prompt.toLowerCase().includes(promptSearch.toLowerCase()) || p.title.toLowerCase().includes(promptSearch.toLowerCase()))
                        .map((savedPrompt) => (
                          <Card key={savedPrompt.id} className="relative">
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-lg">{savedPrompt.title}</CardTitle>
                                  <CardDescription className="mt-2">{savedPrompt.prompt}</CardDescription>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deletePrompt(savedPrompt.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  ×
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-3">
                                <Badge variant="outline" className="text-xs">
                                  {savedPrompt.type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {savedPrompt.style}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {savedPrompt.model}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  Used {savedPrompt.useCount} times
                                </Badge>
                                {savedPrompt.projectId ? (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                    {movies.find(m => m.id.toString() === savedPrompt.projectId)?.name || 'Project'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                    Free Play
                                  </Badge>
                                )}
                                {savedPrompt.sceneId && (
                                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                                    Scene {scenes.find(s => s.id === savedPrompt.sceneId)?.metadata?.sceneNumber || 'N/A'}: {scenes.find(s => s.id === savedPrompt.sceneId)?.name}
                                  </Badge>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPrompt(savedPrompt.prompt)
                                    setSelectedStyle(savedPrompt.style)
                                    setSelectedModel(savedPrompt.model)
                                    setActiveTab(savedPrompt.type + 's')
                                  }}
                                  className="flex-1"
                                >
                                  Use Prompt
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPrompt(savedPrompt.prompt)
                                    setSelectedStyle(savedPrompt.style)
                                    setSelectedModel(savedPrompt.model)
                                    setActiveTab(savedPrompt.type + 's')
                                    generateContent(savedPrompt.type, savedPrompt.prompt)
                                    updatePromptUseCount(savedPrompt.id)
                                  }}
                                >
                                  Regenerate
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {(!aiSettings || Object.keys(userApiKeys).length === 0) && (
          <div className="max-w-4xl mx-auto mt-12">
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader className="text-center">
                <CardTitle className="text-yellow-800">Setup Required</CardTitle>
                <CardDescription className="text-yellow-700">
                  Please configure your AI settings in Settings → AI and add your API keys in Settings → Profile to use the visual development tools.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}
      </div>

      {/* Custom Style Input Modal */}
      {showCustomStyleInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Add Custom Style</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Style Name</label>
                <Input
                  placeholder="e.g., Cyberpunk, Fantasy, Noir"
                  value={newCustomStyle.name}
                  onChange={(e) => setNewCustomStyle(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Style Description</label>
                <Textarea
                  placeholder="Describe the visual style, lighting, mood, etc."
                  value={newCustomStyle.description}
                  onChange={(e) => setNewCustomStyle(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={addCustomStyle}
                  disabled={!newCustomStyle.name || !newCustomStyle.description}
                  className="flex-1"
                >
                  Add Style
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCustomStyleInput(false)
                    setNewCustomStyle({ name: '', description: '' })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}
