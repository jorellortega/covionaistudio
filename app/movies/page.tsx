"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Play,
  Edit,
  Trash2,
  Calendar,
  Film,
  Sparkles,
  FolderOpen,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { MovieService, type Movie, type CreateMovieData } from "@/lib/movie-service"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"

const statusColors = {
  "Pre-Production": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Production": "bg-blue-500/20 text-blue-500 border-blue-500/30",
  "Post-Production": "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
  "Distribution": "bg-green-500/20 text-green-400 border-green-500/30",
}

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [newMovie, setNewMovie] = useState<CreateMovieData>({
    name: "",
    description: "",
    genre: "",
    project_type: "movie",
    movie_status: "Pre-Production",
  })
  
  // AI cover generation state
  const [aiPrompt, setAiPrompt] = useState("")
  const [selectedAIService, setSelectedAIService] = useState("dalle")
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState("")
  
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    loadMovies()
  }, [])

  const loadMovies = async () => {
    try {
      setLoading(true)
      const moviesData = await MovieService.getMovies()
      setMovies(moviesData)
    } catch (error) {
      console.error('Error loading movies:', error)
      toast({
        title: "Error",
        description: "Failed to load movies. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredMovies = movies.filter((movie) => {
    const matchesSearch =
      movie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (movie.description && movie.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesStatus = selectedStatus === "All" || movie.movie_status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const handleCreateMovie = async () => {
    if (!newMovie.name.trim()) {
      toast({
        title: "Error",
        description: "Movie title is required.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsCreating(true)
      const createdMovie = await MovieService.createMovie(newMovie)
      setMovies([createdMovie, ...movies])
      setIsCreateDialogOpen(false)
      resetMovieForm()
      toast({
        title: "Success",
        description: "Movie created successfully!",
      })
    } catch (error) {
      console.error('Error creating movie:', error)
      toast({
        title: "Error",
        description: "Failed to create movie. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const resetMovieForm = () => {
    setNewMovie({ name: "", description: "", genre: "", project_type: "movie", movie_status: "Pre-Production" })
    setAiPrompt("")
    setSelectedAIService("dalle")
    setGeneratedCoverUrl("")
  }

  const handleEditMovie = (movie: Movie) => {
    setEditingMovie(movie)
    setNewMovie({
      name: movie.name,
      description: movie.description || "",
      genre: movie.genre || "",
      project_type: "movie",
      movie_status: movie.movie_status,
      thumbnail: movie.thumbnail || ""
    })
    setGeneratedCoverUrl(movie.thumbnail || "")
    setIsEditDialogOpen(true)
  }

  const handleUpdateMovie = async () => {
    if (!editingMovie || !newMovie.name.trim()) {
      toast({
        title: "Error",
        description: "Movie title is required.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUpdating(true)
      const updatedMovie = await MovieService.updateMovie(editingMovie.id, newMovie)
      
      setMovies(prev => prev.map(movie => 
        movie.id === editingMovie.id ? updatedMovie : movie
      ))
      
      setIsEditDialogOpen(false)
      setEditingMovie(null)
      resetMovieForm()
      
      toast({
        title: "Success",
        description: "Movie updated successfully!",
      })
    } catch (error) {
      console.error('Error updating movie:', error)
      toast({
        title: "Error",
        description: "Failed to update movie. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setGeneratedCoverUrl(result)
        setNewMovie(prev => ({ ...prev, thumbnail: result }))
        toast({
          title: "Cover Uploaded",
          description: "Cover image uploaded successfully"
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const generateAICover = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for cover generation",
        variant: "destructive"
      })
      return
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to use AI services",
        variant: "destructive"
      })
      return
    }

    // Check if user has the required API key for the selected service
    if (selectedAIService === "dalle" && !user.openaiApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your OpenAI API key in settings to use DALL-E",
        variant: "destructive"
      })
      return
    }

    if (selectedAIService === "openart" && !user.openartApiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your OpenArt API key in settings to use OpenArt",
        variant: "destructive"
      })
      return
    }

    setIsGeneratingCover(true)
    try {
      let imageUrl = ""
      
      // Use the selected AI service for cover generation
      switch (selectedAIService) {
        case "dalle":
          if (!user.openaiApiKey) {
            throw new Error("OpenAI API key not configured")
          }
          const dalleResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Movie poster cover: ${aiPrompt}. Cinematic, professional movie poster style, high quality, dramatic lighting.`,
              service: 'dalle',
              apiKey: user.openaiApiKey
            })
          })
          if (!dalleResponse.ok) {
            const errorData = await dalleResponse.json().catch(() => ({}))
            throw new Error(`DALL-E API failed: ${dalleResponse.status} - ${errorData.error || 'Unknown error'}`)
          }
          const dalleData = await dalleResponse.json()
          imageUrl = dalleData.imageUrl
          break
          
        case "openart":
          if (!user.openartApiKey) {
            throw new Error("OpenArt API key not configured")
          }
          const openartResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Movie poster cover: ${aiPrompt}. Cinematic, professional movie poster style, high quality, dramatic lighting.`,
              service: 'openart',
              apiKey: user.openartApiKey
            })
          })
          if (!openartResponse.ok) {
            const errorData = await openartResponse.json().catch(() => ({}))
            throw new Error(`OpenArt API failed: ${openartResponse.status} - ${errorData.error || 'Unknown error'}`)
          }
          const openartData = await openartResponse.json()
          imageUrl = openartData.imageUrl
          break
          
        case "leonardo":
          if (!user.openaiApiKey) {
            throw new Error("Leonardo AI requires API key")
          }
          const leonardoResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Movie poster cover: ${aiPrompt}. Cinematic, professional movie poster style, high quality, dramatic lighting.`,
              service: 'leonardo',
              apiKey: user.openaiApiKey
            })
          })
          if (!leonardoResponse.ok) throw new Error('Leonardo AI API request failed')
          const leonardoData = await leonardoResponse.json()
          imageUrl = leonardoData.imageUrl
          break
          
        default:
          // Fallback to DALL-E
          if (!user.openaiApiKey) {
            throw new Error("OpenAI API key not configured")
          }
          const fallbackResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Movie poster cover: ${aiPrompt}. Cinematic, professional movie poster style, high quality, dramatic lighting.`,
              service: 'dalle',
              apiKey: user.openaiApiKey
            })
          })
          if (!fallbackResponse.ok) throw new Error('DALL-E API request failed')
          const fallbackData = await fallbackResponse.json()
          imageUrl = fallbackData.imageUrl
      }
      
      setGeneratedCoverUrl(imageUrl)
      setNewMovie(prev => ({ ...prev, thumbnail: imageUrl }))
      
      toast({
        title: "AI Cover Generated",
        description: `Cover generated successfully using ${selectedAIService.toUpperCase()}`
      })
    } catch (error) {
      console.error("Error generating AI cover:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate AI cover",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingCover(false)
    }
  }

  const handleDeleteMovie = async (movieId: string) => {
    if (!confirm('Are you sure you want to delete this movie? This action cannot be undone.')) {
      return
    }

    try {
      await MovieService.deleteMovie(movieId)
      setMovies(movies.filter(movie => movie.id !== movieId))
      toast({
        title: "Success",
        description: "Movie deleted successfully!",
      })
    } catch (error) {
      console.error('Error deleting movie:', error)
      toast({
        title: "Error",
        description: "Failed to delete movie. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Loading movies...</span>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Movie Projects
            </h1>
            <p className="text-muted-foreground">Manage your film productions and track progress</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-button neon-glow text-white">
                <Plus className="mr-2 h-5 w-5" />
                Create New Movie
              </Button>
            </DialogTrigger>
            <DialogContent className="cinema-card border-border max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="text-foreground">Create New Movie Project</DialogTitle>
                <DialogDescription>Start a new film project with AI-powered production tools.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
                <div className="grid gap-2">
                  <Label htmlFor="name">Project Title</Label>
                  <Input
                    id="name"
                    value={newMovie.name}
                    onChange={(e) => setNewMovie({ ...newMovie, name: e.target.value })}
                    placeholder="Enter movie title..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="genre">Genre</Label>
                  <Input
                    id="genre"
                    value={newMovie.genre}
                    onChange={(e) => setNewMovie({ ...newMovie, genre: e.target.value })}
                    placeholder="e.g., Sci-Fi, Drama, Action..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="movie_status">Status</Label>
                  <Select value={newMovie.movie_status} onValueChange={(value) => setNewMovie({ ...newMovie, movie_status: value as any })}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="cinema-card border-border">
                      <SelectItem value="Pre-Production">Pre-Production</SelectItem>
                      <SelectItem value="Production">Production</SelectItem>
                      <SelectItem value="Post-Production">Post-Production</SelectItem>
                      <SelectItem value="Distribution">Distribution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newMovie.description}
                    onChange={(e) => setNewMovie({ ...newMovie, description: e.target.value })}
                    placeholder="Brief description of your movie..."
                    className="bg-input border-border"
                  />
                </div>

                {/* AI Cover Generation Section */}
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">Movie Cover</h3>
                  </div>
                  
                  <div className="space-y-3">
                    {/* AI Service Selection */}
                    <div>
                      <Label htmlFor="ai-service">AI Service</Label>
                      <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="cinema-card border-border">
                          <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                          <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                          <SelectItem value="leonardo">Leonardo AI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* AI Prompt */}
                    <div>
                      <Label htmlFor="ai-prompt">AI Prompt</Label>
                      <div className="flex gap-2">
                        <Input
                          id="ai-prompt"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Describe your movie cover (e.g., 'Sci-fi spaceship over alien planet')"
                          className="flex-1 bg-input border-border"
                        />
                        <Button
                          onClick={generateAICover}
                          disabled={isGeneratingCover || !aiPrompt.trim()}
                          variant="outline"
                          size="sm"
                          className="border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10"
                        >
                          {isGeneratingCover ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          {isGeneratingCover ? "Generating..." : "Generate Cover"}
                        </Button>
                      </div>
                    </div>

                    {/* Manual Upload */}
                    <div>
                      <Label htmlFor="cover-upload">Or Upload Manually</Label>
                      <Input
                        id="cover-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="bg-input border-border"
                      />
                    </div>

                    {/* Cover Preview */}
                    {(generatedCoverUrl || newMovie.thumbnail) && (
                      <div>
                        <Label>Cover Preview</Label>
                        <div className="mt-2">
                          <img
                            src={generatedCoverUrl || newMovie.thumbnail}
                            alt="Movie cover preview"
                            className="w-full max-w-md h-auto rounded-lg border border-border"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-shrink-0 bg-background border-t pt-4">
                <Button variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false)
                  resetMovieForm()
                }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateMovie} disabled={isCreating} className="gradient-button text-white">
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-5 w-5" />
                  )}
                  {isCreating ? 'Creating...' : 'Create Movie'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Movie Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="cinema-card border-border max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-foreground">Edit Movie Project</DialogTitle>
              <DialogDescription>Update your movie project details and cover.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Project Title</Label>
                <Input
                  id="edit-name"
                  value={newMovie.name}
                  onChange={(e) => setNewMovie({ ...newMovie, name: e.target.value })}
                  placeholder="Enter movie title..."
                  className="bg-input border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-genre">Genre</Label>
                <Input
                  id="edit-genre"
                  value={newMovie.genre}
                  onChange={(e) => setNewMovie({ ...newMovie, genre: e.target.value })}
                  placeholder="e.g., Sci-Fi, Drama, Action..."
                  className="bg-input border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-movie_status">Status</Label>
                <Select value={newMovie.movie_status} onValueChange={(value) => setNewMovie({ ...newMovie, movie_status: value as any })}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="cinema-card border-border">
                    <SelectItem value="Pre-Production">Pre-Production</SelectItem>
                    <SelectItem value="Production">Production</SelectItem>
                    <SelectItem value="Post-Production">Post-Production</SelectItem>
                    <SelectItem value="Distribution">Distribution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={newMovie.description}
                  onChange={(e) => setNewMovie({ ...newMovie, description: e.target.value })}
                  placeholder="Brief description of your movie..."
                  className="bg-input border-border"
                />
              </div>

              {/* AI Cover Generation Section for Edit */}
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold">Movie Cover</h3>
                </div>
                
                <div className="space-y-3">
                  {/* AI Service Selection */}
                  <div>
                    <Label htmlFor="edit-ai-service">AI Service</Label>
                    <Select value={selectedAIService} onValueChange={setSelectedAIService}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="dalle">DALL-E 3 (OpenAI)</SelectItem>
                        <SelectItem value="openart">OpenArt (SDXL)</SelectItem>
                        <SelectItem value="leonardo">Leonardo AI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* AI Prompt */}
                  <div>
                    <Label htmlFor="edit-ai-prompt">AI Prompt</Label>
                    <div className="flex gap-2">
                      <Input
                        id="edit-ai-prompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe your movie cover (e.g., 'Sci-fi spaceship over alien planet')"
                        className="flex-1 bg-input border-border"
                      />
                      <Button
                        onClick={generateAICover}
                        disabled={isGeneratingCover || !aiPrompt.trim()}
                        variant="outline"
                        size="sm"
                        className="border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10"
                      >
                        {isGeneratingCover ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        {isGeneratingCover ? "Generating..." : "Generate Cover"}
                      </Button>
                    </div>
                  </div>

                  {/* Manual Upload */}
                  <div>
                    <Label htmlFor="edit-cover-upload">Or Upload Manually</Label>
                    <Input
                      id="edit-cover-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="bg-input border-border"
                    />
                  </div>

                  {/* Cover Preview */}
                  {(generatedCoverUrl || newMovie.thumbnail) && (
                    <div>
                      <Label>Cover Preview</Label>
                      <div className="mt-2">
                        <img
                          src={generatedCoverUrl || newMovie.thumbnail}
                          alt="Movie cover preview"
                          className="w-full max-w-md h-auto rounded-lg border border-border"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 bg-background border-t pt-4">
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false)
                setEditingMovie(null)
                resetMovieForm()
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateMovie} disabled={isUpdating} className="gradient-button text-white">
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Edit className="mr-2 h-4 w-4" />
                )}
                {isUpdating ? 'Updating...' : 'Update Movie'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
                <Filter className="mr-2 h-4 w-4" />
                {selectedStatus}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="cinema-card border-border">
              <DropdownMenuItem onClick={() => setSelectedStatus("All")}>All Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("Pre-Production")}>Pre-Production</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("Production")}>Production</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("Post-Production")}>Post-Production</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("Distribution")}>Distribution</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Movies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMovies.map((movie) => (
            <Card key={movie.id} className="cinema-card hover:neon-glow transition-all duration-300 group">
              <CardHeader className="pb-3">
                <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-muted">
                  <img
                    src={movie.thumbnail || "/placeholder.svg"}
                    alt={movie.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1 group-hover:text-primary transition-colors">
                      {movie.name}
                    </CardTitle>
                    <Badge className={`text-xs ${statusColors[movie.movie_status as keyof typeof statusColors]}`}>
                      {movie.movie_status}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="hover:bg-muted">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="cinema-card border-border">
                      <DropdownMenuItem onClick={() => handleEditMovie(movie)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Play className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteMovie(movie.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4 line-clamp-2">{movie.description}</CardDescription>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    <span>{movie.scenes || 0} scenes</span>
                    {movie.duration && (
                      <>
                        <span>•</span>
                        <span>{movie.duration}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Created {new Date(movie.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Link href={`/timeline?movie=${movie.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10 bg-transparent"
                    >
                      <Play className="mr-2 h-3 w-3" />
                      Timeline
                    </Button>
                  </Link>
                  <Link href={`/ai-studio?project=${movie.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-cyan-500/20 hover:border-cyan-500 hover:bg-cyan-500/10 bg-transparent"
                    >
                      <Sparkles className="mr-2 h-3 w-3" />
                      AI Studio
                    </Button>
                  </Link>
                  <Link href={`/assets?project=${movie.name}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-cyan-600/20 hover:border-cyan-600 hover:bg-cyan-600/10 bg-transparent"
                    >
                      <FolderOpen className="mr-2 h-3 w-3" />
                      Assets
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredMovies.length === 0 && (
          <div className="text-center py-12">
            <Film className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No movies found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedStatus !== "All"
                ? "Try adjusting your search or filter criteria"
                : "Create your first movie project to get started"}
            </p>
            {!searchQuery && selectedStatus === "All" && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gradient-button text-white">
                <Plus className="mr-2 h-5 w-5" />
                Create Movie
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
