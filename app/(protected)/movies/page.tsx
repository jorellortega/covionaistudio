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
  Download,
  CheckCircle,
  User,
} from "lucide-react"
import Link from "next/link"
import { MovieService, type Movie, type CreateMovieData } from "@/lib/movie-service"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { AISettingsService, type AISetting } from "@/lib/ai-settings-service"
import { getSupabaseClient } from "@/lib/supabase"

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
    writer: "",
    cowriters: [],
  })
  
  // AI cover generation state
  const [aiPrompt, setAiPrompt] = useState("")
  const [selectedAIService, setSelectedAIService] = useState("dalle")
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState("")
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISetting[]>([])
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false)
  
  // Co-writers input state
  const [cowriterInput, setCowriterInput] = useState("")
  
  const { toast } = useToast()
  const { user, userId, ready } = useAuthReady()

  console.log('🎬 Movies Page - Render - User state:', user ? `Logged in as ${user.user_metadata?.name || user.email}` : 'No user')
  console.log('🎬 Movies Page - Render - Auth ready:', ready)
  console.log('🎬 Movies Page - Render - Loading movies:', loading)
  console.log('🎬 Movies Page - Render - Movies count:', movies.length)

  useEffect(() => {
    if (!ready) return
    
    console.log('🎬 Movies Page - useEffect triggered - Starting loadMovies...')
    
    // Test Supabase connection first
    const testConnection = async () => {
      try {
        console.log('🎬 Movies Page - Testing Supabase connection...')
        const { data, error } = await getSupabaseClient().from('projects').select('count').limit(1)
        if (error) {
          console.error('🎬 Movies Page - Supabase connection test failed:', error)
        } else {
          console.log('🎬 Movies Page - Supabase connection test successful')
        }
      } catch (err) {
        console.error('🎬 Movies Page - Supabase connection test exception:', err)
      }
    }
    
    testConnection()
    
    console.log('🎬 Movies Page - Calling loadMovies()...')
    loadMovies()

    return () => {
      console.log('🎬 Movies Page - useEffect cleanup')
    }
  }, [ready])

  // Load AI settings
  useEffect(() => {
    const loadAISettings = async () => {
      if (!ready) return
      
      try {
        const settings = await AISettingsService.getUserSettings(userId)
        
        // Ensure default settings exist for all tabs
        const defaultSettings = await Promise.all([
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'scripts'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'images'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'videos'),
          AISettingsService.getOrCreateDefaultTabSetting(userId, 'audio')
        ])
        
        // Merge existing settings with default ones, preferring existing
        const mergedSettings = defaultSettings.map(defaultSetting => {
          const existingSetting = settings.find(s => s.tab_type === defaultSetting.tab_type)
          return existingSetting || defaultSetting
        })
        
        setAiSettings(mergedSettings)
        setAiSettingsLoaded(true)
        
        // Auto-select locked model for images tab if available
        const imagesSetting = mergedSettings.find(setting => setting.tab_type === 'images')
        if (imagesSetting?.is_locked) {
          console.log('Setting locked model for images:', imagesSetting.locked_model)
          setSelectedAIService(imagesSetting.locked_model)
        }
      } catch (error) {
        console.error('Error loading AI settings:', error)
      }
    }

    loadAISettings()
  }, [ready, userId])

  // Get current images tab AI setting
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

  // Debug info for locked models - HIDDEN
  // Uncomment to see locked model details during development
  /*
  useEffect(() => {
    if (aiSettingsLoaded) {
      console.log('Movies Page - AI Settings:', aiSettings)
      console.log('Movies Page - Images Tab Locked:', isImagesTabLocked())
      console.log('Movies Page - Locked Model:', getImagesTabLockedModel())
    }
  }, [aiSettingsLoaded, aiSettings])
  */

  const loadMovies = async () => {
    console.log('🎬 Movies Page - loadMovies() - Starting...')
    
    try {
      console.log('🎬 Movies Page - Setting loading to true...')
      setLoading(true)
      
      console.log('🎬 Movies Page - Calling MovieService.getMovies()...')
      const startTime = Date.now()
      
      const moviesData = await MovieService.getMovies()
      
      const endTime = Date.now()
      console.log(`🎬 Movies Page - MovieService.getMovies() completed in ${endTime - startTime}ms`)
      console.log('🎬 Movies Page - Received movies data:', moviesData.length, 'movies')
      
      setMovies(moviesData)
      console.log('🎬 Movies Page - Movies state updated successfully')
      
      // Show success message
      if (moviesData.length > 0) {
        toast({
          title: "Movies Loaded Successfully",
          description: `Found ${moviesData.length} movie project(s)`,
        })
      }
      
    } catch (error) {
      console.error('🎬 Movies Page - Error loading movies:', error)
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to load movies'
      
      toast({
        title: "Error Loading Movies",
        description: `Unable to load movies: ${errorMessage}. Please try refreshing the page.`,
        variant: "destructive",
      })
      
      // Set empty array to prevent infinite loading
      setMovies([])
      console.log('🎬 Movies Page - Set empty movies array due to error')
    } finally {
      console.log('🎬 Movies Page - Setting loading to false...')
      setLoading(false)
      console.log('🎬 Movies Page - loadMovies() completed')
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
    setNewMovie({ name: "", description: "", genre: "", project_type: "movie", movie_status: "Pre-Production", writer: "", cowriters: [] })
    setAiPrompt("")
    setSelectedAIService("dalle")
    setGeneratedCoverUrl("")
    setCowriterInput("")
  }

  const handleEditMovie = (movie: Movie) => {
    setEditingMovie(movie)
    setNewMovie({
      name: movie.name,
      description: movie.description || "",
      genre: movie.genre || "",
      project_type: "movie",
      movie_status: movie.movie_status,
      thumbnail: movie.thumbnail || "",
      writer: movie.writer || "",
      cowriters: movie.cowriters || []
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

  // Upload generated image to Supabase storage
  const uploadGeneratedImageToStorage = async (imageUrl: string, fileName: string): Promise<string> => {
    try {
      console.log('Uploading generated movie cover to Supabase storage...')
      
      // Use our API route to download and upload (bypasses CORS)
      const response = await fetch('/api/ai/download-and-store-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          fileName: fileName,
          userId: user!.id
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API error: ${errorData.error || response.statusText}`)
      }
      
      const result = await response.json()
      console.log('Image upload API response:', result)
      
      if (result.success && result.supabaseUrl) {
        console.log('Movie cover uploaded successfully to Supabase:', result.supabaseUrl)
        return result.supabaseUrl
      } else {
        throw new Error('API did not return a valid Supabase URL')
      }
      
    } catch (error) {
      console.error('Error uploading movie cover to Supabase:', error)
      throw error
    }
  }

  // Download movie cover image
  const downloadMovieCover = async (movie: Movie) => {
    if (!movie.thumbnail) {
      toast({
        title: "No Cover Image",
        description: "This movie doesn't have a cover image to download.",
        variant: "destructive",
      })
      return
    }

    try {
      // Create a temporary link element to trigger download
      const link = document.createElement('a')
      link.href = movie.thumbnail
      link.download = `${movie.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_cover.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "🎬 Download Started!",
        description: `Cover for "${movie.name}" is downloading...`,
      })
    } catch (error) {
      console.error('Error downloading movie cover:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download the cover image. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Download generated cover image
  const downloadGeneratedCover = () => {
    if (!generatedCoverUrl) {
      toast({
        title: "No Generated Cover",
        description: "Generate a cover first before downloading.",
        variant: "destructive",
      })
      return
    }

    try {
      const link = document.createElement('a')
      link.href = generatedCoverUrl
      link.download = `generated_movie_cover_${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "🎨 Download Started!",
        description: "Generated cover image is downloading...",
      })
    } catch (error) {
      console.error('Error downloading generated cover:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download the generated cover. Please try again.",
        variant: "destructive",
      })
    }
  }

  const generateAICover = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Missing Prompt",
        description: "Please enter a description for your movie cover.",
        variant: "destructive"
      })
      return
    }

    // Sanitize the prompt to avoid content filter issues
    const sanitizedPrompt = aiPrompt
      .replace(/godzilla/gi, 'giant monster')
      .replace(/violence|blood|gore/gi, 'action')
      .trim()

    // Check prompt length for DALL-E 3 (1000 character limit)
    const fullPrompt = `Movie poster: ${sanitizedPrompt}. Cinematic style, dramatic lighting.`
    if (fullPrompt.length > 1000) {
      toast({
        title: "Prompt Too Long",
        description: "Please keep your description shorter. DALL-E 3 has a 1000 character limit.",
        variant: "destructive"
      })
      return
    }

    // Use locked model if available, otherwise use selected service
    const lockedModel = getImagesTabLockedModel()
    const serviceToUse = (isImagesTabLocked() && lockedModel) ? lockedModel : selectedAIService
    
    if (!serviceToUse) {
      toast({
        title: "Error",
        description: "No AI service selected. Please choose an AI service or configure your settings.",
        variant: "destructive",
      })
      return
    }

    // Normalize service name for locked models
    const normalizedService = serviceToUse.toLowerCase().includes('dall') ? 'dalle' : 
                             serviceToUse.toLowerCase().includes('openart') ? 'openart' : 
                             serviceToUse.toLowerCase().includes('leonardo') ? 'leonardo' : 
                             serviceToUse

    if (!ready) {
      toast({
        title: "Error",
        description: "You must be logged in to use AI services",
        variant: "destructive"
      })
      return
    }

    // API keys are configured elsewhere, proceed with generation

    setIsGeneratingCover(true)
    try {
      let imageUrl = ""
      
      console.log(`Generating movie cover using ${serviceToUse} (${isImagesTabLocked() ? 'locked model' : 'user selected'}) - normalized to: ${normalizedService}`)
      
      // Use the service to use for cover generation
      switch (normalizedService) {
        case "dalle":
          console.log('Making DALL-E request with prompt:', `Movie poster: ${sanitizedPrompt}. Cinematic style, dramatic lighting.`)
          
          const dalleResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Movie poster: ${sanitizedPrompt}. Cinematic style, dramatic lighting.`,
              service: 'dalle',
              apiKey: 'configured',
              userId: user?.id, // Add userId for bucket storage
              autoSaveToBucket: true, // Enable automatic bucket storage
            })
          })
          if (!dalleResponse.ok) {
            const errorData = await dalleResponse.json().catch(() => ({}))
            console.error('DALL-E API error details:', errorData)
            throw new Error(`DALL-E API failed: ${dalleResponse.status} - ${errorData.error || 'Unknown error'}`)
          }
          const dalleData = await dalleResponse.json()
          imageUrl = dalleData.imageUrl
          break
          
        case "openart":
          const openartResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Movie poster cover: ${aiPrompt}. Cinematic, professional movie poster style, high quality, dramatic lighting.`,
              service: 'openart',
              apiKey: 'configured',
              userId: user?.id, // Add userId for bucket storage
              autoSaveToBucket: true, // Enable automatic bucket storage
            })
          })
          if (!openartResponse.ok) {
            const errorData = await openartResponse.json().catch(() => ({}))
            console.error('OpenArt API error details:', errorData)
            throw new Error(`OpenArt API failed: ${openartResponse.status} - ${errorData.error || 'Unknown error'}`)
          }
          const openartData = await openartResponse.json()
          imageUrl = openartData.imageUrl
          break
          
        case "leonardo":
          const leonardoResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Movie poster cover: ${aiPrompt}. Cinematic, professional movie poster style, high quality, dramatic lighting.`,
              service: 'leonardo',
              apiKey: 'configured',
              userId: user?.id, // Add userId for bucket storage
              autoSaveToBucket: true, // Enable automatic bucket storage
            })
          })
          if (!leonardoResponse.ok) throw new Error('Leonardo AI API request failed')
          const leonardoData = await leonardoResponse.json()
          imageUrl = leonardoData.imageUrl
          break
          
        default:
          // Fallback to DALL-E
          const fallbackResponse = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Movie poster cover: ${aiPrompt}. Cinematic, professional movie poster style, high quality, dramatic lighting.`,
              service: 'dalle',
              apiKey: 'configured',
              userId: user?.id, // Add userId for bucket storage
              autoSaveToBucket: true, // Enable automatic bucket storage
            })
          })
          if (!fallbackResponse.ok) throw new Error('DALL-E API request failed')
          const fallbackData = await fallbackResponse.json()
          imageUrl = fallbackData.imageUrl
      }
      
      setGeneratedCoverUrl(imageUrl)
      setNewMovie(prev => ({ ...prev, thumbnail: imageUrl }))
      
      // Upload the generated image to Supabase storage
      try {
        console.log('Uploading generated movie cover to Supabase...')
        const fileName = `movie-cover-${Date.now()}`
        const supabaseUrl = await uploadGeneratedImageToStorage(imageUrl, fileName)
        
        // Update with the Supabase URL instead of the temporary AI service URL
        setGeneratedCoverUrl(supabaseUrl)
        setNewMovie(prev => ({ ...prev, thumbnail: supabaseUrl }))
        
        toast({
          title: "AI Cover Generated & Uploaded",
          description: `Cover generated and uploaded to storage using ${normalizedService.toUpperCase()}`,
        })
      } catch (uploadError) {
        console.error('Failed to upload movie cover to Supabase:', uploadError)
        toast({
          title: "Cover Generated (Upload Failed)",
          description: "Cover generated but failed to upload to storage. Using temporary URL.",
          variant: "destructive",
        })
        // Keep the temporary URL if upload fails
      }
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

  // If there's an error but we have some movies, show them anyway
  const shouldShowContent = !loading || movies.length > 0

  if (loading && movies.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-lg">Loading movies...</span>
            <div className="text-sm text-muted-foreground text-center">
              <p>Loading your movie projects...</p>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg text-xs">
              <p><strong>Debug Info:</strong></p>
              <p>User: {user ? user.user_metadata?.name || user.email : 'Not authenticated'}</p>
              <p>Auth Ready: {ready ? 'True' : 'False'}</p>
              <p>Loading Movies: {loading ? 'True' : 'False'}</p>
              <p>Movies Count: {movies.length}</p>
            </div>
            <Button 
              onClick={() => {
                console.log('🎬 Movies Page - Manual retry clicked')
                loadMovies()
              }}
              variant="outline"
              className="mt-4"
            >
              <Loader2 className="h-4 w-4 mr-2" />
              Retry Loading
            </Button>
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
                  <Label htmlFor="writer">Writer</Label>
                  <Input
                    id="writer"
                    value={newMovie.writer || ""}
                    onChange={(e) => setNewMovie({ ...newMovie, writer: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cowriters">Co-writers</Label>
                  <div className="space-y-2">
                    {/* Tags Display */}
                    {newMovie.cowriters && newMovie.cowriters.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {newMovie.cowriters.map((name, index) => (
                          <div key={index} className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md text-sm">
                            <span>{name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedCowriters = newMovie.cowriters?.filter((_, i) => i !== index) || []
                                setNewMovie({ ...newMovie, cowriters: updatedCowriters })
                              }}
                              className="text-blue-300 hover:text-blue-100 ml-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Input and Add Button */}
                    <div className="flex gap-2">
                      <Input
                        id="cowriters"
                        value={cowriterInput}
                        onChange={(e) => setCowriterInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && cowriterInput.trim()) {
                            e.preventDefault()
                            const newCowriters = [...(newMovie.cowriters || []), cowriterInput.trim()]
                            setNewMovie({ ...newMovie, cowriters: newCowriters })
                            setCowriterInput("")
                          }
                        }}
                        placeholder="Type name and press Enter"
                        className="flex-1 bg-input border-border"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          if (cowriterInput.trim()) {
                            const newCowriters = [...(newMovie.cowriters || []), cowriterInput.trim()]
                            setNewMovie({ ...newMovie, cowriters: newCowriters })
                            setCowriterInput("")
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="px-3"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Type a name and press Enter, or click the + button to add co-writers.</p>
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
                                      {/* AI Service Selection - Only show if not locked */}
                  {!isImagesTabLocked() && (
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
                  )}

                  {/* Show locked model info if images tab is locked */}
                  {isImagesTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                        <Link href="/settings-ai" className="ml-auto text-xs underline hover:text-green-500">
                          Change Settings
                        </Link>
                      </p>
                    </div>
                  )}
                    
                    {/* AI Prompt */}
                    <div>
                      <Label htmlFor="ai-prompt">AI Prompt</Label>
                      <Textarea
                        id="ai-prompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe your movie cover (e.g., 'Sci-fi spaceship over alien planet')"
                        className="bg-input border-border min-h-[80px]"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
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
                        
                        {/* Download Generated Cover Button */}
                        {generatedCoverUrl && (
                          <Button
                            type="button"
                            onClick={downloadGeneratedCover}
                            variant="outline"
                            size="sm"
                            className="border-green-500/20 hover:border-green-500 hover:bg-green-500/10"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Cover
                          </Button>
                        )}
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
                          <div className="mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={downloadGeneratedCover}
                              className="w-full"
                            >
                              <Download className="mr-2 h-3 w-3" />
                              Download Cover
                            </Button>
                          </div>
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
                <Label htmlFor="edit-writer">Writer</Label>
                <Input
                  id="edit-writer"
                  value={newMovie.writer || ""}
                  onChange={(e) => setNewMovie({ ...newMovie, writer: e.target.value })}
                  placeholder="e.g., John Smith"
                  className="bg-input border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-cowriters">Co-writers</Label>
                <div className="space-y-2">
                  {/* Tags Display */}
                  {newMovie.cowriters && newMovie.cowriters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newMovie.cowriters.map((name, index) => (
                        <div key={index} className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md text-sm">
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedCowriters = newMovie.cowriters?.filter((_, i) => i !== index) || []
                              setNewMovie({ ...newMovie, cowriters: updatedCowriters })
                            }}
                            className="text-blue-300 hover:text-blue-100 ml-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Input and Add Button */}
                  <div className="flex gap-2">
                    <Input
                      id="edit-cowriters"
                      value={cowriterInput}
                      onChange={(e) => setCowriterInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && cowriterInput.trim()) {
                          e.preventDefault()
                          const newCowriters = [...(newMovie.cowriters || []), cowriterInput.trim()]
                          setNewMovie({ ...newMovie, cowriters: newCowriters })
                          setCowriterInput("")
                        }
                      }}
                      placeholder="Type name and press Enter"
                      className="flex-1 bg-input border-border"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (cowriterInput.trim()) {
                          const newCowriters = [...(newMovie.cowriters || []), cowriterInput.trim()]
                          setNewMovie({ ...newMovie, cowriters: newCowriters })
                          setCowriterInput("")
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="px-3"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Type a name and press Enter, or click the + button to add co-writers.</p>
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
                  {/* AI Service Selection - Only show if not locked */}
                  {!isImagesTabLocked() && (
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
                  )}

                  {/* Show locked model info if images tab is locked */}
                  {isImagesTabLocked() && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        AI Online
                        <Link href="/settings-ai" className="ml-auto text-xs underline hover:text-green-500">
                          Change Settings
                        </Link>
                      </p>
                    </div>
                  )}
                  
                  {/* AI Prompt */}
                  <div>
                    <Label htmlFor="edit-ai-prompt">AI Prompt</Label>
                    <Textarea
                      id="edit-ai-prompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe your movie cover (e.g., 'Sci-fi spaceship over alien planet')"
                      className="bg-input border-border min-h-[80px]"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
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
                      
                      {/* Download Generated Cover Button */}
                      {generatedCoverUrl && (
                        <Button
                          type="button"
                          onClick={downloadGeneratedCover}
                          variant="outline"
                          size="sm"
                          className="border-green-500/20 hover:border-green-500 hover:bg-green-500/10"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Cover
                        </Button>
                      )}
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
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={downloadGeneratedCover}
                            className="w-full"
                          >
                            <Download className="mr-2 h-3 w-3" />
                            Download Cover
                          </Button>
                        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {filteredMovies.map((movie) => (
            <Card key={movie.id} className="cinema-card hover:neon-glow transition-all duration-300 group">
              <CardHeader className="pb-2">
                <Link href={`/timeline?movie=${movie.id}`} className="block">
                  <div className="aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-muted relative group cursor-pointer">
                    <img
                      src={movie.thumbnail || "/placeholder.svg?height=300&width=200"}
                      alt={movie.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </Link>
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
                        onClick={() => downloadMovieCover(movie)}
                        disabled={!movie.thumbnail}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Cover
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
                <CardDescription className="mb-2 line-clamp-2 text-sm">{movie.description}</CardDescription>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Film className="h-3 w-3" />
                    <span>{movie.scenes || 0} scenes</span>
                    {movie.duration && (
                      <>
                        <span>•</span>
                        <span>{movie.duration}</span>
                      </>
                    )}
                  </div>
                  {movie.writer && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>Writer: {movie.writer}</span>
                    </div>
                  )}
                  {movie.cowriters && movie.cowriters.length > 0 && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>Co-writers: {movie.cowriters.join(", ")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>Created {new Date(movie.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-2">
                  <Link href={`/timeline?movie=${movie.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10 bg-transparent text-xs h-6"
                    >
                      <Play className="mr-1 h-2.5 w-2.5" />
                      Timeline
                    </Button>
                  </Link>
                  <Link href={`/ai-studio?project=${movie.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-cyan-500/20 hover:border-cyan-500 hover:bg-cyan-500/10 bg-transparent text-xs h-6"
                    >
                      <Sparkles className="mr-1 h-2.5 w-2.5" />
                      AI Studio
                    </Button>
                  </Link>
                  <Link href={`/assets?project=${movie.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-cyan-600/20 hover:border-cyan-500 hover:bg-cyan-600/10 bg-transparent text-xs h-6"
                    >
                      <FolderOpen className="mr-1 h-2.5 w-2.5" />
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
