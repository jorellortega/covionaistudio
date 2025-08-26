"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Lightbulb, Sparkles, Plus, Edit, Trash2, Save, Search, Filter, Image as ImageIcon } from "lucide-react"
import { useAuthReady } from "@/components/auth-hooks"
import { MovieIdeasService, type MovieIdea } from "@/lib/movie-ideas-service"
import { AISettingsService } from "@/lib/ai-settings-service"
import { OpenAIService } from "@/lib/ai-services"
import { getSupabaseClient } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { IdeaImagesService } from "@/lib/idea-images-service"
import { Navigation } from "@/components/navigation"

export default function IdeasPage() {
  const { user, userId, ready } = useAuthReady()
  const [ideas, setIdeas] = useState<MovieIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterGenre, setFilterGenre] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingIdea, setEditingIdea] = useState<MovieIdea | null>(null)
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<any>({})
  const [userApiKeys, setUserApiKeys] = useState<any>({})
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [aiResponse, setAiResponse] = useState<string>("")
  const [generatedImage, setGeneratedImage] = useState<string>("")
  const [isSavingImage, setIsSavingImage] = useState(false)
  
  // Idea Library Image Generation state
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [selectedIdeaForImage, setSelectedIdeaForImage] = useState<MovieIdea | null>(null)
  const [imagePrompt, setImagePrompt] = useState("")
  const [ideaImages, setIdeaImages] = useState<{[key: string]: string[]}>({})
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [dialogGeneratedImage, setDialogGeneratedImage] = useState<string | null>(null)
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [genre, setGenre] = useState("")
  const [originalPrompt, setOriginalPrompt] = useState("")
  const [prompt, setPrompt] = useState("")
  const [status, setStatus] = useState<"concept" | "development" | "completed">("concept")

  const genres = [
    "Action", "Adventure", "Comedy", "Crime", "Drama", "Fantasy", 
    "Horror", "Mystery", "Romance", "Sci-Fi", "Thriller", "Western",
    "Animation", "Documentary", "Musical", "War", "Biography", "History"
  ]

  useEffect(() => {
    if (ready) {
      fetchIdeas()
      fetchAISettings()
      fetchUserApiKeys()
    }
  }, [ready])

  useEffect(() => {
    if (ideas.length > 0 && ready) {
      loadSavedImages()
    }
  }, [ideas, ready])

  const fetchIdeas = async () => {
    try {
      setLoading(true)
      const data = await MovieIdeasService.getUserIdeas(userId!)
      setIdeas(data)
    } catch (error) {
      console.error('Error fetching ideas:', error)
      toast({
        title: "Error",
        description: "Failed to fetch ideas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const saveIdea = async () => {
    if (!ready || !title.trim() || !description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const ideaData = {
        user_id: userId,
        title: title.trim(),
        description: description.trim(),
        genre: genre || "Unspecified",
        original_prompt: originalPrompt.trim(),
        prompt: prompt.trim(),
        status,
        updated_at: new Date().toISOString()
      }

      if (editingIdea) {
        // Update existing idea
        await MovieIdeasService.updateIdea(editingIdea.id, ideaData)
        toast({
          title: "Success",
          description: "Idea updated successfully",
        })
      } else {
        // Create new idea
        await MovieIdeasService.createIdea(userId, ideaData)
        toast({
          title: "Success",
          description: "Idea saved successfully",
        })
      }

      // Reset form and close dialog
      resetForm()
      setShowAddDialog(false)
      fetchIdeas()
    } catch (error) {
      console.error('Error saving idea:', error)
      toast({
        title: "Error",
        description: "Failed to save idea",
        variant: "destructive",
      })
    }
  }

  const deleteIdea = async (id: string) => {
    try {
      await MovieIdeasService.deleteIdea(id)
      toast({
        title: "Success",
        description: "Idea deleted successfully",
      })
      fetchIdeas()
    } catch (error) {
      console.error('Error deleting idea:', error)
      toast({
        title: "Error",
        description: "Failed to delete idea",
        variant: "destructive",
      })
    }
  }

  const editIdea = (idea: MovieIdea) => {
    setEditingIdea(idea)
    setTitle(idea.title)
    setDescription(idea.description)
    setGenre(idea.genre)
    setOriginalPrompt(idea.original_prompt || "")
    setPrompt(idea.prompt)
    setStatus(idea.status)
    setShowAddDialog(true)
  }

  const resetForm = () => {
    setEditingIdea(null)
    setTitle("")
    setDescription("")
    setGenre("")
    setOriginalPrompt("")
    setPrompt("")
    setStatus("concept")
  }

  const fetchAISettings = async () => {
    try {
      const settings = await AISettingsService.getUserSettings(userId!)
      const settingsMap = settings.reduce((acc, setting) => {
        acc[setting.tab_type] = setting
        return acc
      }, {} as any)
      setAiSettings(settingsMap)
    } catch (error) {
      console.error('Error fetching AI settings:', error)
    }
  }

  const fetchUserApiKeys = async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key, anthropic_api_key, openart_api_key, kling_api_key, runway_api_key, elevenlabs_api_key, suno_api_key')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserApiKeys(data || {})
    } catch (error) {
      console.error('Error fetching user API keys:', error)
    }
  }

  const loadSavedImages = async () => {
    try {
      const savedImages: {[key: string]: string[]} = {}
      
      for (const idea of ideas) {
        const images = await IdeaImagesService.getIdeaImages(idea.id)
        savedImages[idea.id] = images.map(img => img.image_url)
      }
      
      setIdeaImages(savedImages)
    } catch (error) {
      console.error('Error loading saved images:', error)
    }
  }

  const generateWithAI = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt first",
        variant: "destructive",
      })
      return
    }

    const scriptsSetting = aiSettings.scripts
    if (!scriptsSetting || !scriptsSetting.is_locked) {
      toast({
        title: "AI Not Available",
        description: "Please lock a script model in AI Settings first",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI API key in Settings → Profile",
        variant: "destructive",
      })
      return
    }

    setIsLoadingAI(true)
    setAiResponse("")
    
    try {
      const response = await OpenAIService.generateScript({
        prompt: prompt,
        template: "Generate a creative movie script outline or scene based on the user's idea. Focus on storytelling, character development, and cinematic elements.",
        model: scriptsSetting.locked_model,
        apiKey: userApiKeys.openai_api_key || ""
      })

      if (response.success && response.data) {
        const content = response.data.choices?.[0]?.message?.content || "No response generated"
        setAiResponse(content)
        toast({
          title: "Success",
          description: "AI script generated successfully",
        })
      } else {
        throw new Error(response.error || "Failed to generate script")
      }
    } catch (error) {
      console.error('Error generating script:', error)
      toast({
        title: "Error",
        description: "Failed to generate script with AI",
        variant: "destructive",
      })
    } finally {
      setIsLoadingAI(false)
    }
  }

  const generateImage = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt first",
        variant: "destructive",
      })
      return
    }

    const imagesSetting = aiSettings.images
    if (!imagesSetting || !imagesSetting.is_locked) {
      toast({
        title: "AI Not Available",
        description: "Please lock an image model in AI Settings first",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI API key in Settings → Profile",
        variant: "destructive",
      })
      return
    }

    setIsLoadingAI(true)
    setGeneratedImage("")
    
    try {
      const response = await OpenAIService.generateImage({
        prompt: prompt,
        style: "cinematic, movie poster",
        model: imagesSetting.locked_model,
        apiKey: userApiKeys.openai_api_key || ""
      })

      if (response.success && response.data) {
        const imageUrl = response.data.data?.[0]?.url || ""
        
        // Save the image to the bucket instead of storing temporary URL
        setIsSavingImage(true)
        const saveResponse = await fetch('/api/ai/download-and-store-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imageUrl,
            fileName: `ai_prompt_studio_${prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
            userId: userId
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save image to bucket')
        }

        const saveResult = await saveResponse.json()
        
        if (saveResult.success) {
          // Store the permanent bucket URL instead of temporary DALL-E URL
          const bucketUrl = saveResult.supabaseUrl
          setGeneratedImage(bucketUrl)
          toast({
            title: "Success",
            description: "AI image generated and saved to your bucket!",
          })
        } else {
          throw new Error(saveResult.error || 'Failed to save image')
        }
      } else {
        throw new Error(response.error || "Failed to generate image")
      }
    } catch (error) {
      console.error('Error generating image:', error)
      toast({
        title: "Error",
        description: "Failed to generate image with AI",
        variant: "destructive",
      })
    } finally {
      setIsLoadingAI(false)
      setIsSavingImage(false)
    }
  }

  const generateImageForIdea = async (idea: MovieIdea) => {
    if (!imagePrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter an image prompt first",
        variant: "destructive",
      })
      return
    }

    const imagesSetting = aiSettings.images
    if (!imagesSetting || !imagesSetting.is_locked) {
      toast({
        title: "AI Not Available",
        description: "Please lock an image model in AI Settings first",
        variant: "destructive",
      })
      return
    }

    if (!userApiKeys.openai_api_key) {
      toast({
        title: "API Key Missing",
        description: "Please add your OpenAI API key in Settings → Profile",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingImage(true)
    
    try {
      // Create a comprehensive prompt using the idea's content
      const enhancedPrompt = `${imagePrompt}. Movie concept: ${idea.title}. ${idea.description}. ${idea.original_prompt ? `Original idea: ${idea.original_prompt}.` : ''} ${idea.prompt ? `AI development: ${idea.prompt}.` : ''} Cinematic style, movie poster quality.`
      
      const response = await OpenAIService.generateImage({
        prompt: enhancedPrompt,
        style: "cinematic, movie poster, high quality",
        model: imagesSetting.locked_model,
        apiKey: userApiKeys.openai_api_key
      })

      if (response.success && response.data) {
        const imageUrl = response.data.data?.[0]?.url || ""
        
        // Save the image to the bucket instead of storing temporary URL
        const saveResponse = await fetch('/api/ai/download-and-store-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imageUrl,
            fileName: `${idea.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${imagePrompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
            userId: userId
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save image to bucket')
        }

        const saveResult = await saveResponse.json()
        
        if (saveResult.success) {
          // Store the permanent bucket URL instead of temporary DALL-E URL
          const bucketUrl = saveResult.supabaseUrl
          
          try {
            // Save the image record to the database
            await IdeaImagesService.saveIdeaImage(userId, {
              idea_id: idea.id,
              image_url: bucketUrl,
              prompt: imagePrompt,
              bucket_path: saveResult.filePath
            })
            
            // Add the new image to the idea's image collection
            setIdeaImages(prev => ({
              ...prev,
              [idea.id]: [...(prev[idea.id] || []), bucketUrl]
            }))
            
            // Set the dialog generated image for Save button
            setDialogGeneratedImage(bucketUrl)
            
            toast({
              title: "Success",
              description: "Image generated and saved to your bucket!",
            })
            
            // Clear the prompt for next use
            setImagePrompt("")
          } catch (dbError) {
            console.error('Error saving image record to database:', dbError)
            // Still show success since image is in bucket
            toast({
              title: "Partial Success",
              description: "Image saved to bucket but database record failed",
              variant: "destructive",
            })
          }
        } else {
          throw new Error(saveResult.error || 'Failed to save image')
        }
      } else {
        throw new Error(response.error || "Failed to generate image")
      }
    } catch (error) {
      console.error('Error generating image for idea:', error)
      toast({
        title: "Error",
        description: "Failed to generate image for this idea",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const openImageGeneration = (idea: MovieIdea) => {
    console.log('Opening image generation for idea:', idea.title)
    setSelectedIdeaForImage(idea)
    setImagePrompt("")
    setShowImageDialog(true)
    // Make sure we're not opening the edit dialog
    setShowAddDialog(false)
    setEditingIdea(null)
  }

  const closeImageGeneration = () => {
    setSelectedIdeaForImage(null)
    setImagePrompt("")
    setShowImageDialog(false)
    setDialogGeneratedImage(null)
  }

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         idea.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (idea.original_prompt && idea.original_prompt.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (idea.prompt && idea.prompt.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGenre = filterGenre === "all" || idea.genre === filterGenre
    const matchesStatus = filterStatus === "all" || idea.status === filterStatus
    
    return matchesSearch && matchesGenre && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concept": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "development": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  if (!ready) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to access your movie ideas</h1>
        </div>
      </div>
    )
  }

  return (
    <>
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            Movie Ideas
          </h1>
          <p className="text-muted-foreground mt-2">
            Capture your creative sparks and develop them into full concepts
          </p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add New Idea
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingIdea ? "Edit Movie Idea" : "Add New Movie Idea"}
              </DialogTitle>
              <DialogDescription>
                {editingIdea ? "Update your movie idea details" : "Capture your creative vision"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter movie title"
                  />
                </div>
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your movie idea"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="original-prompt">Original Prompt/Idea</Label>
                <Textarea
                  id="original-prompt"
                  value={originalPrompt}
                  onChange={(e) => setOriginalPrompt(e.target.value)}
                  placeholder="Your original movie idea or prompt..."
                  rows={3}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Your initial creative spark or prompt that started this idea
                </p>
              </div>
              
              <div>
                <Label htmlFor="prompt">AI Generated Content</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="AI-generated content, development notes, or additional prompts..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  AI-generated content, development notes, or additional prompts to develop this idea
                </p>
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concept">Concept</SelectItem>
                    <SelectItem value="development">In Development</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveIdea} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {editingIdea ? "Update" : "Save"} Idea
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="ai-prompt" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai-prompt" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Prompt Studio
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Idea Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-6">
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ideas by title, description, or prompt..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={filterGenre} onValueChange={setFilterGenre}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genres</SelectItem>
                    {genres.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="concept">Concept</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ideas Grid */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading your ideas...</p>
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No ideas yet</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || filterGenre !== "all" || filterStatus !== "all" 
                    ? "No ideas match your current filters" 
                    : "Start capturing your creative ideas"}
                </p>
                {!searchTerm && filterGenre === "all" && filterStatus === "all" && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Idea
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIdeas.map((idea) => (
                  <Card key={idea.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-2">{idea.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {idea.genre}
                            </Badge>
                            <Badge className={`text-xs ${getStatusColor(idea.status)}`}>
                              {idea.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log('Image button clicked for:', idea.title)
                              openImageGeneration(idea)
                            }}
                            className="h-8 px-2 text-xs"
                            title="Generate Images"
                          >
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Image
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editIdea(idea)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteIdea(idea.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="line-clamp-3 mb-3">
                        {idea.description}
                      </CardDescription>
                      {idea.original_prompt && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                          <p className="text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">Original Idea:</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 line-clamp-2">
                            {idea.original_prompt}
                          </p>
                        </div>
                      )}
                      {idea.prompt && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">AI Generated Content:</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {idea.prompt}
                          </p>
                        </div>
                      )}
                      
                      {/* Generated Images Slideshow */}
                      {ideaImages[idea.id] && ideaImages[idea.id].length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Generated Images:</p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {ideaImages[idea.id].map((imageUrl, index) => (
                              <div key={index} className="flex-shrink-0">
                                <img 
                                  src={imageUrl} 
                                  alt={`Generated image ${index + 1}`}
                                  className="h-20 w-20 object-cover rounded-md shadow-md hover:scale-105 transition-transform cursor-pointer"
                                  onClick={() => window.open(imageUrl, '_blank')}
                                  title="Click to view full size"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-3">
                        Created: {new Date(idea.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai-prompt" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Prompt Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  AI Prompt Studio
                </CardTitle>
                <CardDescription>
                  Generate creative content to develop your movie ideas further
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ai-prompt-input">Describe your idea or ask for help</Label>
                  <Textarea
                    id="ai-prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., 'I have an idea about a time-traveling detective in 1920s Paris. Help me develop the plot and characters.'"
                    rows={6}
                    className="font-mono"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={generateWithAI} 
                    disabled={isLoadingAI || !prompt.trim()}
                    className="flex items-center gap-2"
                  >
                    {isLoadingAI ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generate Script
                  </Button>
                  <Button 
                    onClick={generateImage} 
                    disabled={isLoadingAI || isSavingImage || !prompt.trim()}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isLoadingAI ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : isSavingImage ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isLoadingAI ? "Generating..." : isSavingImage ? "Saving..." : "Generate Image"}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      // Pre-fill the form with current prompt and generated content
                      if (aiResponse) {
                        setTitle("Generated Script Idea")
                        setDescription(aiResponse.substring(0, 200) + (aiResponse.length > 200 ? "..." : ""))
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt(aiResponse) // Save AI-generated content
                      } else if (generatedImage) {
                        setTitle("Generated Image Idea")
                        setDescription("AI-generated image concept: " + prompt)
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt("AI-generated image: " + prompt) // Save AI image reference
                      } else {
                        setTitle("")
                        setDescription("")
                        setOriginalPrompt(prompt) // Save your original prompt
                        setPrompt("") // No AI content yet
                      }
                      setGenre("")
                      setStatus("concept")
                      setShowAddDialog(true)
                    }} 
                    disabled={!prompt.trim() && !aiResponse && !generatedImage}
                    variant="outline"
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as New Idea
                  </Button>
                </div>
                
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    <strong>Tip:</strong> Be specific about what you want to develop - characters, plot points, 
                    world-building, or specific scenes. The more detailed your prompt, the better the AI can help!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* AI Response Display */}
            <div className="space-y-6">
              {/* Script Response */}
              {aiResponse && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-green-500" />
                      Generated Script
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm font-mono">{aiResponse}</pre>
                    </div>
                                          <div className="flex gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setPrompt(aiResponse)}
                        >
                          Use as Prompt
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => {
                            setTitle("Generated Script Idea")
                            setDescription(aiResponse.substring(0, 200) + (aiResponse.length > 200 ? "..." : ""))
                            setOriginalPrompt(prompt) // Save your original prompt
                            setPrompt(aiResponse) // Save AI-generated content
                            setGenre("")
                            setStatus("concept")
                            setShowAddDialog(true)
                          }}
                          className="flex items-center gap-2"
                        >
                          <Save className="h-4 w-4" />
                          Save as Idea
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAiResponse("")}
                        >
                          Clear
                        </Button>
                      </div>
                  </CardContent>
                </Card>
              )}

              {/* Image Response */}
              {generatedImage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-500" />
                      Generated Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <img 
                        src={generatedImage} 
                        alt="AI Generated" 
                        className="w-full rounded-md shadow-lg"
                      />
                      <div className="flex flex-col gap-3">
                        {/* Primary Save Button - Make it prominent */}
                        <Button 
                          variant="default" 
                          size="lg"
                          onClick={() => {
                            setTitle("Generated Image Idea")
                            setDescription("AI-generated image concept: " + prompt)
                            setOriginalPrompt(prompt) // Save your original prompt
                            setPrompt("AI-generated image: " + prompt) // Save AI image reference
                            setGenre("")
                            setStatus("concept")
                            setShowAddDialog(true)
                          }}
                          className="flex items-center gap-2 w-full bg-green-600 hover:bg-green-700"
                        >
                          <Save className="h-5 w-5" />
                          Save Generated Image as New Movie Idea
                        </Button>
                        
                        {/* Secondary Actions */}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(generatedImage, '_blank')}
                            className="flex-1"
                          >
                            View Full Size
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setGeneratedImage("")}
                            className="flex-1"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Status */}
              {!aiResponse && !generatedImage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      AI Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Script Generation:</span>
                        <Badge variant={aiSettings.scripts?.is_locked ? "default" : "secondary"}>
                          {aiSettings.scripts?.is_locked ? "Available" : "Not Available"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Image Generation:</span>
                        <Badge variant={aiSettings.images?.is_locked ? "default" : "secondary"}>
                          {aiSettings.images?.is_locked ? "Available" : "Not Available"}
                        </Badge>
                      </div>
                      {(!aiSettings.scripts?.is_locked || !aiSettings.images?.is_locked) && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Setup Required:</strong> Lock AI models in Settings → AI Settings to enable generation.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Image Generation Dialog */}
      <Dialog 
        open={showImageDialog} 
        onOpenChange={(open) => {
          console.log('Image dialog open change:', open)
          if (!open) closeImageGeneration()
        }}
        modal={true}
      >
        <DialogContent className="max-w-2xl" id="image-generation-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-500" />
              Generate Images for: {selectedIdeaForImage?.title}
            </DialogTitle>
            <DialogDescription>
              Create cinematic images for your movie idea using AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-prompt">Image Prompt</Label>
              <Textarea
                id="image-prompt"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want to generate (e.g., 'Esteban selling sweet canes in a colorful Mexican market, cinematic lighting')"
                rows={3}
                className="font-mono"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Be specific about the scene, characters, mood, and style you want
              </p>
            </div>

            {/* Simple Idea Context - Just the basics, no long scripts */}
            <div className="p-4 bg-muted rounded-md">
              <h4 className="font-medium mb-2">Quick Idea Reference:</h4>
              <div className="space-y-2 text-sm">
                <p><strong>Title:</strong> {selectedIdeaForImage?.title}</p>
                <p><strong>Genre:</strong> {selectedIdeaForImage?.genre}</p>
                <p><strong>Brief Description:</strong> {selectedIdeaForImage?.description.substring(0, 100)}...</p>
              </div>
            </div>

            {/* Existing Images */}
            {ideaImages[selectedIdeaForImage?.id || ''] && ideaImages[selectedIdeaForImage?.id || ''].length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Existing Images:</h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {ideaImages[selectedIdeaForImage?.id || ''].map((imageUrl, index) => (
                    <div key={index} className="flex-shrink-0">
                      <img 
                        src={imageUrl} 
                        alt={`Generated image ${index + 1}`}
                        className="h-24 w-24 object-cover rounded-md shadow-md hover:scale-105 transition-transform cursor-pointer"
                        onClick={() => window.open(imageUrl, '_blank')}
                        title="Click to view full size"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Newly Generated Image with Save Button */}
            {dialogGeneratedImage && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <h4 className="font-medium mb-3 text-green-800 dark:text-green-200">✨ Newly Generated Image:</h4>
                <div className="space-y-3">
                  <img 
                    src={dialogGeneratedImage} 
                    alt="Newly generated image"
                    className="w-full rounded-md shadow-lg"
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="default" 
                      size="lg"
                      onClick={() => {
                        setTitle("Generated Image Idea")
                        setDescription("AI-generated image concept: " + imagePrompt)
                        setOriginalPrompt(imagePrompt)
                        setPrompt("AI-generated image: " + imagePrompt)
                        setGenre("")
                        setStatus("concept")
                        setShowAddDialog(true)
                        setShowImageDialog(false)
                      }}
                      className="flex items-center gap-2 w-full bg-green-600 hover:bg-green-700"
                    >
                      <Save className="h-5 w-5" />
                      Save Generated Image as New Movie Idea
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeImageGeneration}>
                Close
              </Button>
              <Button 
                onClick={() => selectedIdeaForImage && generateImageForIdea(selectedIdeaForImage)}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="flex items-center gap-2"
              >
                {isGeneratingImage ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {isGeneratingImage ? "Generating..." : "Generate Image"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
