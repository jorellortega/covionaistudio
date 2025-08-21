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
  const [isCreating, setIsCreating] = useState(false)
  const [newMovie, setNewMovie] = useState<CreateMovieData>({
    name: "",
    description: "",
    genre: "",
    project_type: "movie",
    movie_status: "Pre-Production",
  })
  const { toast } = useToast()

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
      setNewMovie({ name: "", description: "", genre: "", project_type: "movie", movie_status: "Pre-Production" })
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
            <DialogContent className="cinema-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create New Movie Project</DialogTitle>
                <DialogDescription>Start a new film project with AI-powered production tools.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
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
                      <DropdownMenuItem>
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
