"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { ProjectSelector } from "@/components/project-selector"
import { useAuth } from "@/lib/auth-context"
import { OpenAIService } from "@/lib/openai-service"
import { MovieService, Movie } from "@/lib/movie-service"
import { TimelineService } from "@/lib/timeline-service"
import { AssetService } from "@/lib/asset-service"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sparkles,
  FileText,
  ImageIcon,
  Video,
  Wand2,
  Download,
  Save,
  RefreshCw,
  Settings,
  History,
  Copy,
  Play,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  Loader2,
  Bot,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"

// Real data types
interface Scene {
  id: string
  name: string
  description?: string
  start_time_seconds: number
  duration_seconds: number
  scene_type: string
  timeline_id: string
  user_id: string
  created_at: string
  updated_at: string
}

interface GeneratedContent {
  id: string
  title: string
  content?: string
  prompt: string
  type: 'script' | 'image' | 'video' | 'audio'
  model: string
  created_at: string
  project_id?: string
  scene_id?: string
  url?: string
  duration?: string
  saved?: boolean
  asset_id?: string
}

const aiModels = {
  script: ["ChatGPT", "Claude", "GPT-4", "Gemini", "Custom"],
  image: ["OpenArt", "DALL-E 3", "Midjourney", "Stable Diffusion", "Custom"],
  video: ["Kling", "Runway ML", "Pika Labs", "Stable Video", "LumaAI"],
  audio: ["ElevenLabs", "Suno AI", "Udio", "MusicLM", "AudioCraft", "Custom"],
}

const scriptTemplates = [
  { name: "Scene Description", prompt: "Write a detailed scene description for:" },
  { name: "Character Dialogue", prompt: "Create dialogue between characters in this situation:" },
  { name: "Action Sequence", prompt: "Write an action sequence involving:" },
  { name: "Character Backstory", prompt: "Develop a character backstory for:" },
  { name: "Plot Treatment", prompt: "Create a plot treatment for:" },
]

const imageStyles = [
  "Cinematic",
  "Concept Art",
  "Storyboard",
  "Character Design",
  "Environment",
  "Props",
  "Mood Board",
  "Technical Drawing",
]

const handleCopy = (content: string) => {
  navigator.clipboard.writeText(content)
  // You could add a toast notification here
  console.log('Content copied to clipboard')
}

const handleLinkToScene = (item: any, type: string, sceneId: string) => {
  console.log(`Linking ${item.title} to scene ${sceneId}`)
}

export default function AIStudioPage() {
  // State variables
  const [activeTab, setActiveTab] = useState("scripts")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [scriptPrompt, setScriptPrompt] = useState("")
  const [imagePrompt, setImagePrompt] = useState("")
  const [videoPrompt, setVideoPrompt] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [selectedStyle, setSelectedStyle] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [selectedProject, setSelectedProject] = useState("")
  const [selectedScene, setSelectedScene] = useState("none")
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveModalData, setSaveModalData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [continuingScript, setContinuingScript] = useState<{
    title: string
    version_name: string
    content: string
    prompt: string
  } | null>(null)

  const { toast } = useToast()

  // Real data state
  const [movies, setMovies] = useState<Movie[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  const { user } = useAuth()

  // Debug logging
  console.log("AI Studio - User:", user)
  console.log("AI Studio - OpenAI API Key:", user?.openaiApiKey ? "Available" : "Not available")

  // Reset model selection when switching tabs
  useEffect(() => {
    setSelectedModel("")
    setSelectedStyle("")
    setSelectedTemplate("")
  }, [activeTab])

  // Load real data from database
  useEffect(() => {
    const loadData = async () => {
      if (!user) return
      
      try {
        setIsLoadingData(true)
        
        // Load user's movies
        const userMovies = await MovieService.getMovies()
        setMovies(userMovies)
        
        // Load generated content (we'll implement this later)
        setGeneratedContent([
          {
            id: "1",
            title: "Sample Script - Opening Scene",
            content: "FADE IN:\n\nEXT. NEO TOKYO STREETS - NIGHT\n\nNeon lights reflect off wet pavement as a lone figure walks through the rain...",
            prompt: "Write an opening scene for a cyberpunk movie",
            type: 'script',
            model: 'ChatGPT',
            created_at: new Date().toISOString(),
          },
          {
            id: "2", 
            title: "Sample Image - Cyberpunk City",
            prompt: "Futuristic cyberpunk city at night with neon lights and flying cars",
            type: 'image',
            model: 'DALL-E 3',
            created_at: new Date().toISOString(),
            url: "/cyberpunk-city-concept.png"
          }
        ])
        
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [user])

  // Load scenes when project is selected
  useEffect(() => {
    const loadScenes = async () => {
      if (!selectedProject || !user) return
      
      try {
        console.log('Loading scenes for project:', selectedProject)
        
        // Fetch real scenes from the database
        const realScenes = await TimelineService.getMovieScenes(selectedProject)
        console.log('Real scenes loaded:', realScenes)
        
        if (realScenes && realScenes.length > 0) {
          // Convert SceneWithMetadata to Scene format for the UI
          const convertedScenes: Scene[] = realScenes.map(scene => ({
            id: scene.id,
            name: scene.name,
            description: scene.description,
            start_time_seconds: scene.start_time_seconds,
            duration_seconds: scene.duration_seconds,
            scene_type: scene.scene_type,
            timeline_id: scene.timeline_id,
            user_id: scene.user_id,
            created_at: scene.created_at,
            updated_at: scene.updated_at,
          }))
          
          console.log('Converted scenes for UI:', convertedScenes)
          setScenes(convertedScenes)
        } else {
          console.log('No real scenes found for this project')
          setScenes([])
        }
      } catch (error) {
        console.error('Error loading real scenes:', error)
        setScenes([])
      }
    }

    loadScenes()
  }, [selectedProject, user])

  // Effect to check for continued script data
  useEffect(() => {
    const continuedScriptData = sessionStorage.getItem('continueScriptData')
    if (continuedScriptData) {
      try {
        const scriptData = JSON.parse(continuedScriptData)
        console.log('Loading continued script data:', scriptData)
        
        // Set the continuing script state
        setContinuingScript({
          title: scriptData.title,
          version_name: scriptData.version_name || `v${scriptData.version}`,
          content: scriptData.content || '',
          prompt: scriptData.prompt || ''
        })
        
        // Pre-fill the form with the script data
        setSelectedProject(scriptData.project_id)
        setSelectedScene(scriptData.scene_id || "none")
        setSelectedTemplate(scriptData.generation_settings?.template || "cinematic")
        setSelectedStyle(scriptData.generation_settings?.style || "modern")
        
        // Pre-fill the prompt with the original prompt
        setScriptPrompt(scriptData.prompt || "")
        
        // Show a toast about the loaded script
        toast({
          title: "Script Loaded!",
          description: `"${scriptData.title}" (${scriptData.version_name || `v${scriptData.version}`}) is ready for editing.`,
          variant: "default",
        })
        
        // Clear the session storage
        sessionStorage.removeItem('continueScriptData')
        
        // Optionally, you could also pre-populate the generated content area
        // to show what the user is continuing from
        
      } catch (error) {
        console.error('Error parsing continued script data:', error)
        sessionStorage.removeItem('continueScriptData')
      }
    }
  }, [toast])

  const handleGenerate = async (type: string) => {
    if (!user?.openaiApiKey) {
      alert("Please set up your OpenAI API key first")
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      if (type === "script" && selectedModel === "ChatGPT") {
        console.log('Attempting to generate script with:', {
          prompt: scriptPrompt,
          template: selectedTemplate || "Write a creative script based on:",
          apiKeyLength: user.openaiApiKey?.length || 0,
          apiKeyPrefix: user.openaiApiKey?.substring(0, 7) || 'None'
        })
        
        // First validate the API key
        console.log('Validating API key...')
        const isValid = await OpenAIService.validateApiKey(user.openaiApiKey)
        console.log('API key validation result:', isValid)
        
        if (!isValid) {
          alert('Your OpenAI API key appears to be invalid. Please check your setup.')
          setIsGenerating(false)
          return
        }
        
        const response = await OpenAIService.generateScript({
          prompt: scriptPrompt,
          template: selectedTemplate || "Write a creative script based on:",
          apiKey: user.openaiApiKey,
        })

        if (response.success) {
          // Create new generated content
          const newContent: GeneratedContent = {
            id: Date.now().toString(),
            title: `Generated Script - ${new Date().toLocaleDateString()}`,
            content: response.data.choices?.[0]?.message?.content || "No content generated",
            prompt: scriptPrompt,
            type: 'script',
            model: selectedModel,
            created_at: new Date().toISOString(),
            project_id: selectedProject,
            scene_id: selectedScene !== "none" ? selectedScene : undefined,
          }
          
          setGeneratedContent(prev => [newContent, ...prev])
          setScriptPrompt("") // Clear the prompt after successful generation
        } else {
          alert(`Error generating script: ${response.error}`)
        }
      } else if (type === "image" && selectedModel === "DALL-E 3") {
        console.log('Attempting to generate image with:', {
          prompt: imagePrompt,
          style: selectedStyle || "Cinematic",
          apiKeyLength: user.openaiApiKey?.length || 0,
          apiKeyPrefix: user.openaiApiKey?.substring(0, 7) || 'None'
        })
        
        // First validate the API key
        console.log('Validating API key for image generation...')
        const isValid = await OpenAIService.validateApiKey(user.openaiApiKey)
        console.log('API key validation result:', isValid)
        
        if (!isValid) {
          alert('Your OpenAI API key appears to be invalid. Please check your setup.')
          setIsGenerating(false)
          return
        }
        
        const response = await OpenAIService.generateImage({
          prompt: imagePrompt,
          style: selectedStyle || "Cinematic",
          apiKey: user.openaiApiKey,
        })

        if (response.success) {
          // Create new generated content
          const newContent: GeneratedContent = {
            id: Date.now().toString(),
            title: `Generated Image - ${new Date().toLocaleDateString()}`,
            prompt: imagePrompt,
            type: 'image',
            model: selectedModel,
            created_at: new Date().toISOString(),
            project_id: selectedProject,
            scene_id: selectedScene !== "none" ? selectedScene : undefined,
            url: response.data.data?.[0]?.url,
          }
          
          setGeneratedContent(prev => [newContent, ...prev])
          setImagePrompt("") // Clear the prompt after successful generation
        } else {
          alert(`Error generating image: ${response.error}`)
        }
      } else {
        // For other models, show a message that they're not implemented yet
        alert(`${selectedModel} is not yet implemented. Please use ChatGPT for scripts or DALL-E 3 for images.`)
        setIsGenerating(false)
        return
      }

      setGenerationProgress(100)
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveToLibrary = (item: any, type: string) => {
    const assetData = {
      ...item,
      project: selectedProject,
      scene: selectedScene,
      type,
      createdAt: new Date().toISOString(),
    }

    setSaveModalData({
      item: assetData,
      type,
      projectName: movies.find((m) => m.id.toString() === selectedProject)?.name || "Unknown Project",
      sceneName: selectedScene
        ? scenes.find((s) => s.id === selectedScene)?.name
        : null,
    })
    setShowSaveModal(true)
  }

  const handleConfirmSave = async () => {
    if (!saveModalData || !user) return
    
    try {
      setLoading(true)
      
      // Save the asset to the database
      const assetData = {
        project_id: selectedProject,
        scene_id: selectedScene !== "none" ? selectedScene : null,
        title: saveModalData.item.title,
        content_type: saveModalData.type as 'script' | 'image' | 'video' | 'audio',
        content: saveModalData.item.content,
        content_url: saveModalData.item.url,
        prompt: saveModalData.item.prompt,
        model: saveModalData.item.model,
        version_name: saveModalData.versionLabel || undefined, // Pass version name
        generation_settings: {
          template: selectedTemplate,
          style: selectedStyle,
        },
        metadata: {
          project_name: saveModalData.projectName,
          scene_name: saveModalData.sceneName,
          generated_at: new Date().toISOString(),
          version_label: saveModalData.versionLabel || null, // Keep in metadata for backward compatibility
        }
      }
      
      console.log('Saving asset to database:', JSON.stringify(assetData, null, 2))
      console.log('Content type being sent:', assetData.content_type)
      console.log('Project ID being sent:', assetData.project_id)
      console.log('Scene ID being sent:', assetData.scene_id)
      
      const savedAsset = await AssetService.createAsset(assetData)
      console.log('Asset saved successfully:', savedAsset)
      
      // Update the generated content to show it's been saved
      setGeneratedContent(prev => 
        prev.map(item => 
          item.id === saveModalData.item.id 
            ? { ...item, saved: true, asset_id: savedAsset.id }
            : item
        )
      )
      
      // Show success message
      toast({
        title: "Asset Saved!",
        description: `${saveModalData.type} has been saved to your asset library.`,
        variant: "default",
      })
      
      // If a scene was selected, show a link to view it
      if (selectedScene && selectedScene !== "none") {
        toast({
          title: "View in Scene",
          description: (
            <div className="flex items-center gap-2">
              <span>Asset saved to scene. </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/timeline-scene/${selectedScene}`, '_blank')}
                className="h-6 px-2 text-xs"
              >
                View Scene
              </Button>
            </div>
          ),
          variant: "default",
        })
      }
      
      setShowSaveModal(false)
      setSaveModalData(null)
      
    } catch (error) {
      console.error('Error saving asset:', error)
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save asset to database.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              AI Studio
            </h1>
            <p className="text-muted-foreground">Generate scripts, images, and videos with advanced AI models</p>
            {user?.openaiApiKey ? (
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">OpenAI API Key Configured</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-orange-500">OpenAI API Key Not Configured</span>
                <Link href="/setup-ai">
                  <Button size="sm" variant="outline" className="ml-2">
                    Configure Now
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
            <Link href="/setup-ai">
              <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
                <Settings className="mr-2 h-4 w-4" />
                AI Setup
              </Button>
            </Link>
          </div>
        </div>

        {/* Continuing Script Banner */}
        {continuingScript && (
          <div className="bg-gradient-to-r from-blue-500/10 to-green-500/10 p-6 rounded-lg border-2 border-blue-500/20 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-blue-600 mb-3 flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Continuing Script Generation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Script:</span>
                    <p className="font-semibold text-blue-600">{continuingScript.title}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <p className="font-semibold text-blue-600">{continuingScript.version_name}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Original Prompt:</span>
                    <p className="font-medium text-blue-600 italic">"{continuingScript.prompt}"</p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContinuingScript(null)}
                className="border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Generate for Project</label>
            <ProjectSelector
              selectedProject={selectedProject}
              onProjectChange={(projectId) => {
                setSelectedProject(projectId)
                setSelectedScene("none") // Reset scene when project changes
              }}
              showCreateNew={true}
            />
          </div>

          {selectedProject && (
            <div>
              <label className="text-sm font-medium mb-2 block">Link to Scene (Optional)</label>
              <Select value={selectedScene} onValueChange={setSelectedScene}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select a scene" />
                </SelectTrigger>
                <SelectContent className="cinema-card border-border">
                  <SelectItem value="none">No specific scene</SelectItem>
                  {scenes.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      Scene {scene.start_time_seconds}s: {scene.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* AI Tools Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-muted/50">
            <TabsTrigger value="scripts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Scripts
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Images
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Audio
            </TabsTrigger>
          </TabsList>

          {/* Script Generation */}
          <TabsContent value="scripts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Generation Panel */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-primary" />
                    Script Generator
                  </CardTitle>
                  <CardDescription>Generate dialogue, scenes, and story elements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedProject && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm text-primary">
                        Generating for:{" "}
                        <span className="font-medium">
                          {movies.find((m) => m.id.toString() === selectedProject)?.name}
                        </span>
                        {selectedScene && (
                          <>
                            {" → "}
                            <span className="font-medium">
                              {
                                scenes.find(
                                  (s) => s.id === selectedScene,
                                )?.name
                              }
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Show current script content if continuing */}
                  {continuingScript && (
                    <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <h4 className="font-medium text-sm mb-2 text-blue-600 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Current Script Content:
                      </h4>
                      <div className="max-h-32 overflow-y-auto bg-background p-3 rounded border text-xs font-mono text-muted-foreground">
                        {continuingScript.content.substring(0, 300)}
                        {continuingScript.content.length > 300 && '...'}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        You can modify the prompt below to continue or edit this script
                      </p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label>Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {scriptTemplates.map((template) => (
                          <SelectItem key={template.name} value={template.name}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>AI Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {aiModels.script.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
                      value={scriptPrompt}
                      onChange={(e) => setScriptPrompt(e.target.value)}
                      placeholder="Describe what you want to generate..."
                      className="bg-input border-border min-h-32"
                    />
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating...</span>
                        <span>{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="w-full" />
                    </div>
                  )}

                  <Button
                    onClick={() => handleGenerate("script")}
                    disabled={isGenerating || !scriptPrompt || !selectedProject}
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Script
                  </Button>
                  
                  {/* Debug info */}
                  <div className="text-xs text-muted-foreground mt-2">
                    Selected model: {selectedModel || "None"} | 
                    Template: {selectedTemplate || "None"} | 
                    Project: {selectedProject || "None"} | 
                    Can generate: {!isGenerating && scriptPrompt && selectedProject && selectedModel ? "Yes" : "No"}
                  </div>
                </CardContent>
              </Card>

              {/* Generated Scripts */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Scripts</CardTitle>
                  <CardDescription>Your recent script generations</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingData ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  ) : generatedContent.filter(item => item.type === 'script').length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No scripts generated yet</p>
                      <p className="text-xs text-muted-foreground">Use the generator on the left to create your first script</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {generatedContent
                        .filter(item => item.type === 'script')
                        .map((script) => (
                          <Card key={script.id} className="bg-muted/50 border-border">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">{script.title}</CardTitle>
                                <Badge variant="outline" className="text-xs">
                                  {script.model}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{script.content}</p>

                              {selectedProject && scenes.length > 0 && (
                                <div className="mb-3 p-2 bg-background/50 rounded border">
                                  <label className="text-xs font-medium mb-1 block">Link to Scene:</label>
                                  <Select onValueChange={(sceneId) => handleLinkToScene(script, "script", sceneId)}>
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue placeholder="Choose scene" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none" className="text-xs">
                                        No specific scene
                                      </SelectItem>
                                      {scenes.map((scene) => (
                                        <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                          Scene {scene.start_time_seconds}s: {scene.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="text-xs bg-transparent" onClick={() => handleCopy(script.content || "")}>
                                  <Copy className="mr-1 h-3 w-3" />
                                  Copy
                                </Button>
                                {script.saved ? (
                                  <Button size="sm" variant="outline" className="text-xs bg-green-500/20 text-green-500 border-green-500/30" disabled>
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Saved
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveToLibrary(script, "script")}
                                    className="text-xs"
                                  >
                                    <Save className="mr-1 h-3 w-3" />
                                    Save
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Image Generation */}
          <TabsContent value="images" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Generation Panel */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-secondary" />
                    Image Generator
                  </CardTitle>
                  <CardDescription>Create concept art, storyboards, and visual assets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Style</Label>
                    <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Choose a style" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {imageStyles.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>AI Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {aiModels.image.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Describe the image you want to generate..."
                      className="bg-input border-border min-h-32"
                    />
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating...</span>
                        <span>{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="w-full" />
                    </div>
                  )}

                  <Button
                    onClick={() => handleGenerate("image")}
                    disabled={isGenerating || !imagePrompt || !selectedModel}
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Image
                  </Button>
                  
                  {/* Debug info */}
                  <div className="text-xs text-muted-foreground mt-2">
                    Selected model: {selectedModel || "None"} | 
                    Prompt length: {imagePrompt.length} | 
                    Can generate: {!isGenerating && imagePrompt && selectedModel ? "Yes" : "No"}
                  </div>
                </CardContent>
              </Card>

              {/* Generated Images */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Images</CardTitle>
                  <CardDescription>Your recent image generations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {generatedContent
                      .filter(item => item.type === 'image')
                      .map((image) => (
                      <Card key={image.id} className="bg-muted/50 border-border">
                        <CardContent className="p-3">
                          <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-muted">
                            <img
                              src={image.url || "/placeholder.svg?height=200&width=200"}
                              alt={image.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <h4 className="text-sm font-medium mb-1">{image.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{image.prompt}</p>

                          {selectedProject && scenes.length > 0 && (
                            <div className="mb-2">
                              <Select onValueChange={(sceneId) => handleLinkToScene(image, "image", sceneId)}>
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue placeholder="Link to scene" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs">
                                    No specific scene
                                  </SelectItem>
                                  {scenes.map((scene) => (
                                    <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                      Scene {scene.start_time_seconds}s: {scene.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="text-xs flex-1 bg-transparent">
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                            {image.saved ? (
                              <Button size="sm" variant="outline" className="text-xs flex-1 bg-green-500/20 text-green-500 border-green-500/30" disabled>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Saved
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveToLibrary(image, "image")}
                                className="text-xs flex-1"
                              >
                                <Save className="mr-1 h-3 w-3" />
                                Save
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Video Generation */}
          <TabsContent value="videos" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Generation Panel */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-chart-3" />
                    Video Generator
                  </CardTitle>
                  <CardDescription>Create previsualization and video clips</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Duration</Label>
                    <Select>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="5s">5 seconds</SelectItem>
                        <SelectItem value="10s">10 seconds</SelectItem>
                        <SelectItem value="15s">15 seconds</SelectItem>
                        <SelectItem value="30s">30 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>AI Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {aiModels.video.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder="Describe the video you want to generate..."
                      className="bg-input border-border min-h-32"
                    />
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating...</span>
                        <span>{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="w-full" />
                    </div>
                  )}

                  <Button
                    onClick={() => handleGenerate("video")}
                    disabled={isGenerating || !videoPrompt}
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Video
                  </Button>
                </CardContent>
              </Card>

              {/* Generated Videos */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Videos</CardTitle>
                  <CardDescription>Your recent video generations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedContent
                      .filter(item => item.type === 'video')
                      .map((video) => (
                      <Card key={video.id} className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                          <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-muted flex items-center justify-center">
                            <div className="text-center">
                              <Play className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Video Preview</p>
                            </div>
                          </div>
                          <h4 className="text-sm font-medium mb-1">{video.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2">{video.prompt}</p>
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className="text-xs">
                              {video.duration}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {video.model}
                            </Badge>
                          </div>

                          {selectedProject && scenes.length > 0 && (
                            <div className="mb-3">
                              <Select onValueChange={(sceneId) => handleLinkToScene(video, "video", sceneId)}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Link to scene" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs">
                                    No specific scene
                                  </SelectItem>
                                  {scenes.map((scene) => (
                                    <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                      Scene {scene.start_time_seconds}s: {scene.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="text-xs bg-transparent">
                              <Play className="mr-1 h-3 w-3" />
                              Play
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs bg-transparent">
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                            {video.saved ? (
                              <Button size="sm" variant="outline" className="text-xs bg-green-500/20 text-green-500 border-green-500/30" disabled>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Saved
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveToLibrary(video, "video")}
                                className="text-xs"
                              >
                                <Save className="mr-1 h-3 w-3" />
                                Save
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Audio Generation */}
          <TabsContent value="audio" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Generation Panel */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-cyan-500" />
                    Audio Generator
                  </CardTitle>
                  <CardDescription>Create music, sound effects, and audio tracks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Audio Type</Label>
                    <Select>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Choose audio type" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="music">Background Music</SelectItem>
                        <SelectItem value="sfx">Sound Effects</SelectItem>
                        <SelectItem value="ambient">Ambient Sounds</SelectItem>
                        <SelectItem value="dialogue">Voice Generation</SelectItem>
                        <SelectItem value="score">Film Score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>AI Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        {aiModels.audio.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Duration</Label>
                    <Select>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="15s">15 seconds</SelectItem>
                        <SelectItem value="30s">30 seconds</SelectItem>
                        <SelectItem value="1m">1 minute</SelectItem>
                        <SelectItem value="2m">2 minutes</SelectItem>
                        <SelectItem value="5m">5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Prompt</Label>
                    <Textarea
                      placeholder="Describe the audio you want to generate..."
                      className="bg-input border-border min-h-32"
                    />
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Generating...</span>
                        <span>{generationProgress}%</span>
                      </div>
                      <Progress value={generationProgress} className="w-full" />
                    </div>
                  )}

                  <Button
                    onClick={() => handleGenerate("audio")}
                    disabled={isGenerating}
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Audio
                  </Button>
                </CardContent>
              </Card>

              {/* Generated Audio */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Audio</CardTitle>
                  <CardDescription>Your recent audio generations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedContent
                      .filter(item => item.type === 'audio')
                      .map((audio) => (
                      <Card key={audio.id} className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium">
                              {audio.title}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {audio.model}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {audio.prompt}
                          </p>
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="outline" className="text-xs">
                              {audio.duration}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {audio.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="text-xs bg-transparent">
                              <Play className="mr-1 h-3 w-3" />
                              Play
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs bg-transparent">
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                            {audio.saved ? (
                              <Button size="sm" variant="outline" className="text-xs bg-green-500/20 text-green-500 border-green-500/30" disabled>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Saved
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveToLibrary(audio, "audio")}
                                className="text-xs"
                              >
                                <Save className="mr-1 h-3 w-3" />
                                Save
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Confirmation Modal */}
        <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
          <DialogContent className="cinema-card border-primary/20 max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/20 rounded-full">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                <DialogTitle className="text-lg">Save to Asset Library</DialogTitle>
              </div>
              <DialogDescription className="text-muted-foreground">
                This content will be saved to your asset library and linked to your project.
              </DialogDescription>
            </DialogHeader>

            {saveModalData && (
              <div className="space-y-4 py-4">
                {/* Content Preview */}
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    {saveModalData.type === "script" && <FileText className="h-4 w-4 text-primary" />}
                    {saveModalData.type === "image" && <ImageIcon className="h-4 w-4 text-secondary" />}
                    {saveModalData.type === "video" && <Video className="h-4 w-4 text-chart-3" />}
                    {saveModalData.type === "audio" && <Sparkles className="h-4 w-4 text-cyan-500" />}
                    <span className="font-medium text-sm">{saveModalData.item.title}</span>
                  </div>

                  {saveModalData.type === "script" && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{saveModalData.item.content}</p>
                  )}

                  {saveModalData.type === "image" && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{saveModalData.item.prompt}</p>
                  )}

                  {saveModalData.type === "video" && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {saveModalData.item.duration}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{saveModalData.item.prompt}</span>
                    </div>
                  )}

                  {saveModalData.type === "audio" && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {saveModalData.item.duration || "2:30"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{saveModalData.item.prompt || "AI-generated audio track"}</span>
                    </div>
                  )}
                </div>

                {/* Version Label Input */}
                <div className="space-y-2">
                  <Label htmlFor="versionLabel" className="text-sm font-medium">
                    Version Label (Optional)
                  </Label>
                  <Input
                    id="versionLabel"
                    value={saveModalData.versionLabel || ''}
                    onChange={(e) => setSaveModalData((prev: any) => ({
                      ...prev,
                      versionLabel: e.target.value
                    }))}
                    placeholder="e.g., 'First Draft', 'Final Version', 'Director Notes'"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Add a custom label to identify this version (e.g., "Rough Draft", "Final", "Director's Cut")
                  </p>
                </div>

                {/* Project & Scene Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Project:</span>
                    <span className="font-medium text-primary">{saveModalData.projectName}</span>
                  </div>

                  {saveModalData.sceneName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Scene:</span>
                      <span className="font-medium text-secondary">{saveModalData.sceneName}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {saveModalData.type}
                    </Badge>
                  </div>
                </div>

                {/* Success Message */}
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm text-primary">
                    ✓ This content will be available in your Asset Library and can be accessed from the timeline.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveModal(false)}
                className="bg-transparent border-border"
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmSave} disabled={loading} className="gradient-button text-white">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {loading ? "Saving..." : "Save to Project"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  handleConfirmSave()
                  // Navigate to assets page (you could use router.push('/assets') here)
                }}
                className="bg-transparent border-border"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View in Library
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
