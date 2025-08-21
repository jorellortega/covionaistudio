"use client"

import { useState } from "react"
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
} from "lucide-react"

// Mock generated content
const mockGeneratedContent = {
  scripts: [
    {
      id: 1,
      title: "Opening Scene Dialogue",
      content: "FADE IN:\n\nEXT. NEO TOKYO STREETS - NIGHT\n\nNeon lights reflect off wet pavement...",
      type: "Scene",
      createdAt: "2024-01-20",
      model: "ChatGPT",
    },
    {
      id: 2,
      title: "Character Backstory",
      content: "Alex Chen, 28, former corporate security specialist turned underground hacker...",
      type: "Character",
      createdAt: "2024-01-19",
      model: "Claude",
    },
  ],
  images: [
    {
      id: 1,
      title: "Cyberpunk City Concept",
      url: "/cyberpunk-city-concept.png",
      prompt: "Futuristic cyberpunk city at night with neon lights and flying cars",
      style: "Cinematic",
      createdAt: "2024-01-20",
      model: "OpenArt",
    },
    {
      id: 2,
      title: "Main Character Design",
      url: "/character-design.png",
      prompt: "Cybernetic enhanced human character in dark clothing",
      style: "Character Art",
      createdAt: "2024-01-19",
      model: "ChatGPT",
    },
  ],
  videos: [
    {
      id: 1,
      title: "Opening Sequence Preview",
      url: "/opening-sequence.mp4",
      prompt: "Camera flying through neon-lit cyberpunk city streets",
      duration: "0:15",
      createdAt: "2024-01-20",
      model: "Kling",
    },
  ],
}

const aiModels = {
  script: ["ChatGPT", "Claude", "GPT-4", "Gemini", "Custom"],
  image: ["OpenArt", "ChatGPT", "DALL-E 3", "Midjourney", "Stable Diffusion"],
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

const mockMovies = [
  { id: "1", title: "Project Alpha" },
  { id: "2", title: "Project Beta" },
]

const mockScenes = {
  "1": [
    { id: "1-1", title: "Opening Scene", number: 1 },
    { id: "1-2", title: "Character Introduction", number: 2 },
    { id: "1-3", title: "First Conflict", number: 3 },
  ],
  "2": [
    { id: "2-1", title: "Establishing Shot", number: 1 },
    { id: "2-2", title: "Dialogue Scene", number: 2 },
  ],
}

const handleLinkToScene = (item: any, type: string, sceneId: string) => {
  console.log(`Linking ${item.title} to scene ${sceneId}`)
}

export default function AIStudioPage() {
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
  const [selectedScene, setSelectedScene] = useState("")
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveModalData, setSaveModalData] = useState<any>(null)

  const { user } = useAuth()

  const handleGenerate = async (type: string) => {
    if (!user?.openaiApiKey) {
      alert("Please set up your OpenAI API key first")
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      if (type === "script" && selectedModel === "ChatGPT") {
        const response = await OpenAIService.generateScript({
          prompt: scriptPrompt,
          template: selectedTemplate || "Write a creative script based on:",
          apiKey: user.openaiApiKey,
        })

        if (response.success) {
          // Handle successful script generation
          console.log("Generated script:", response.data)
          // You could add this to the generated scripts list
        } else {
          alert(`Error generating script: ${response.error}`)
        }
      } else if (type === "image" && selectedModel === "ChatGPT") {
        const response = await OpenAIService.generateImage({
          prompt: imagePrompt,
          style: selectedStyle || "Cinematic",
          apiKey: user.openaiApiKey,
        })

        if (response.success) {
          // Handle successful image generation
          console.log("Generated image:", response.data)
          // You could add this to the generated images list
        } else {
          alert(`Error generating image: ${response.error}`)
        }
      } else {
        // Simulate generation progress for other models
        const interval = setInterval(() => {
          setGenerationProgress((prev) => {
            if (prev >= 100) {
              clearInterval(interval)
              setIsGenerating(false)
              return 100
            }
            return prev + 10
          })
        }, 500)
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
      projectName: mockMovies.find((m) => m.id.toString() === selectedProject)?.title || "Unknown Project",
      sceneName: selectedScene
        ? mockScenes[selectedProject as keyof typeof mockScenes]?.find((s) => s.id === selectedScene)?.title
        : null,
    })
    setShowSaveModal(true)
  }

  const handleConfirmSave = () => {
    console.log("Saving to asset library:", saveModalData)
    setShowSaveModal(false)
    setSaveModalData(null)
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

        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Generate for Project</label>
            <ProjectSelector
              selectedProject={selectedProject}
              onProjectChange={(projectId) => {
                setSelectedProject(projectId)
                setSelectedScene("") // Reset scene when project changes
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
                  {mockScenes[selectedProject as keyof typeof mockScenes]?.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      Scene {scene.number}: {scene.title}
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
                          {mockMovies.find((m) => m.id.toString() === selectedProject)?.title}
                        </span>
                        {selectedScene && (
                          <>
                            {" → "}
                            <span className="font-medium">
                              {
                                mockScenes[selectedProject as keyof typeof mockScenes]?.find(
                                  (s) => s.id === selectedScene,
                                )?.title
                              }
                            </span>
                          </>
                        )}
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
                </CardContent>
              </Card>

              {/* Generated Scripts */}
              <Card className="cinema-card">
                <CardHeader>
                  <CardTitle>Generated Scripts</CardTitle>
                  <CardDescription>Your recent script generations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockGeneratedContent.scripts.map((script) => (
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

                          {selectedProject && mockScenes[selectedProject as keyof typeof mockScenes] && (
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
                                  {mockScenes[selectedProject as keyof typeof mockScenes]?.map((scene) => (
                                    <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                      Scene {scene.number}: {scene.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="text-xs bg-transparent">
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSaveToLibrary(script, "script")}
                              className="text-xs"
                            >
                              <Save className="mr-1 h-3 w-3" />
                              Save
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
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
                    disabled={isGenerating || !imagePrompt}
                    className="w-full gradient-button text-white"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Image
                  </Button>
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
                    {mockGeneratedContent.images.map((image) => (
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

                          {selectedProject && mockScenes[selectedProject as keyof typeof mockScenes] && (
                            <div className="mb-2">
                              <Select onValueChange={(sceneId) => handleLinkToScene(image, "image", sceneId)}>
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue placeholder="Link to scene" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs">
                                    No specific scene
                                  </SelectItem>
                                  {mockScenes[selectedProject as keyof typeof mockScenes]?.map((scene) => (
                                    <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                      Scene {scene.number}
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSaveToLibrary(image, "image")}
                              className="text-xs flex-1"
                            >
                              <Save className="mr-1 h-3 w-3" />
                              Save
                            </Button>
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
                    {mockGeneratedContent.videos.map((video) => (
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

                          {selectedProject && mockScenes[selectedProject as keyof typeof mockScenes] && (
                            <div className="mb-3">
                              <Select onValueChange={(sceneId) => handleLinkToScene(video, "video", sceneId)}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Link to scene" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs">
                                    No specific scene
                                  </SelectItem>
                                  {mockScenes[selectedProject as keyof typeof mockScenes]?.map((scene) => (
                                    <SelectItem key={scene.id} value={scene.id} className="text-xs">
                                      Scene {scene.number}: {scene.title}
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSaveToLibrary(video, "video")}
                              className="text-xs"
                            >
                              <Save className="mr-1 h-3 w-3" />
                              Save
                            </Button>
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
                    <Card className="bg-muted/50 border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium">Cyberpunk Ambience</h4>
                          <Badge variant="outline" className="text-xs">
                            Suno AI
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Dark electronic ambient track with neon city vibes
                        </p>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="text-xs">
                            2:30
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Ambient
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveToLibrary({ title: "Cyberpunk Ambience", type: "audio" }, "audio")}
                            className="text-xs"
                          >
                            <Save className="mr-1 h-3 w-3" />
                            Save
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted/50 border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium">Action Sequence SFX</h4>
                          <Badge variant="outline" className="text-xs">
                            Udio
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          High-energy sound effects for chase scenes
                        </p>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="text-xs">
                            0:45
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            SFX
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveToLibrary({ title: "Action Sequence SFX", type: "audio" }, "audio")}
                            className="text-xs"
                          >
                            <Save className="mr-1 h-3 w-3" />
                            Save
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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
              <Button onClick={handleConfirmSave} className="gradient-button text-white">
                <Save className="mr-2 h-4 w-4" />
                Save to Project
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
