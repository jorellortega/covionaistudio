"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Play,
  Edit,
  Trash2,
  Clock,
  MapPin,
  Users,
  Camera,
  Save,
  ArrowLeft,
  Sparkles,
  FolderOpen,
} from "lucide-react"
import Link from "next/link"

// Mock data for movies (same as movies page)
const mockMovies = [
  { id: 1, title: "Neon Dreams" },
  { id: 2, title: "The Last Symphony" },
  { id: 3, title: "Quantum Heist" },
  { id: 4, title: "Digital Ghosts" },
]

// Mock scenes data
const mockScenes = [
  {
    id: 1,
    sceneNumber: "1A",
    title: "Opening Credits",
    description: "Establishing shots of the cyberpunk city",
    location: "Neo Tokyo Streets",
    duration: "2:30",
    characters: ["Narrator"],
    shotType: "Wide Shot",
    mood: "Mysterious",
    notes: "Use neon lighting effects",
    status: "Completed",
  },
  {
    id: 2,
    sceneNumber: "2A",
    title: "Hero Introduction",
    description: "First appearance of the main character",
    location: "Underground Club",
    duration: "4:15",
    characters: ["Alex", "Bartender"],
    shotType: "Medium Shot",
    mood: "Tense",
    notes: "Focus on character's cybernetic implants",
    status: "In Progress",
  },
  {
    id: 3,
    sceneNumber: "3A",
    title: "The Mission",
    description: "Client explains the dangerous assignment",
    location: "Corporate Office",
    duration: "6:45",
    characters: ["Alex", "Mr. Chen", "Security"],
    shotType: "Close-up",
    mood: "Suspenseful",
    notes: "Emphasize the holographic displays",
    status: "Planning",
  },
  {
    id: 4,
    sceneNumber: "4A",
    title: "Preparation Montage",
    description: "Hero gathers equipment and allies",
    location: "Various Locations",
    duration: "3:20",
    characters: ["Alex", "Tech Specialist", "Hacker"],
    shotType: "Montage",
    mood: "Energetic",
    notes: "Fast-paced editing with electronic music",
    status: "Planning",
  },
]

const statusColors = {
  Planning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "In Progress": "bg-blue-500/20 text-blue-500 border-blue-500/30",
  Completed: "bg-green-500/20 text-green-400 border-green-500/30",
  "On Hold": "bg-red-500/20 text-red-400 border-red-500/30",
}

const moodColors = {
  Mysterious: "bg-purple-500/20 text-purple-400",
  Tense: "bg-red-500/20 text-red-400",
  Suspenseful: "bg-orange-500/20 text-orange-400",
  Energetic: "bg-green-500/20 text-green-400",
  Dramatic: "bg-blue-500/20 text-blue-400",
  Romantic: "bg-pink-500/20 text-pink-400",
}

export default function TimelinePage() {
  const searchParams = useSearchParams()
  const movieId = searchParams.get("movie")
  const [selectedMovie, setSelectedMovie] = useState(movieId || "1")
  const [scenes, setScenes] = useState(mockScenes)
  const [isAddSceneOpen, setIsAddSceneOpen] = useState(false)
  const [editingScene, setEditingScene] = useState<any>(null)
  const [viewMode, setViewMode] = useState<"cinema" | "video">("cinema")
  const [newScene, setNewScene] = useState({
    sceneNumber: "",
    title: "",
    description: "",
    location: "",
    duration: "",
    characters: "",
    shotType: "",
    mood: "",
    notes: "",
    status: "Planning",
  })

  const selectedMovieData = mockMovies.find((m) => m.id.toString() === selectedMovie)

  const handleAddScene = () => {
    const scene = {
      id: Date.now(),
      ...newScene,
      characters: newScene.characters.split(",").map((c) => c.trim()),
    }
    setScenes([...scenes, scene])
    setIsAddSceneOpen(false)
    setNewScene({
      sceneNumber: "",
      title: "",
      description: "",
      location: "",
      duration: "",
      characters: "",
      shotType: "",
      mood: "",
      notes: "",
      status: "Planning",
    })
  }

  const handleEditScene = (scene: any) => {
    setEditingScene(scene)
    setNewScene({
      ...scene,
      characters: scene.characters.join(", "),
    })
  }

  const handleUpdateScene = () => {
    const updatedScene = {
      ...editingScene,
      ...newScene,
      characters: newScene.characters.split(",").map((c) => c.trim()),
    }
    setScenes(scenes.map((s) => (s.id === editingScene.id ? updatedScene : s)))
    setEditingScene(null)
    setNewScene({
      sceneNumber: "",
      title: "",
      description: "",
      location: "",
      duration: "",
      characters: "",
      shotType: "",
      mood: "",
      notes: "",
      status: "Planning",
    })
  }

  const handleDeleteScene = (sceneId: number) => {
    setScenes(scenes.filter((s) => s.id !== sceneId))
  }

  const handleGenerateWithAI = (sceneId?: number) => {
    const scene = scenes.find((s) => s.id === sceneId)
    const aiPrompt = scene
      ? `Generate content for scene "${scene.title}": ${scene.description}`
      : "Generate new scene content"

    // Navigate to AI Studio with context
    window.open(`/ai-studio?project=${selectedMovie}&prompt=${encodeURIComponent(aiPrompt)}`, "_blank")
  }

  const handleViewAssets = (sceneId?: number) => {
    const scene = scenes.find((s) => s.id === sceneId)
    const searchQuery = scene ? scene.title : selectedMovieData?.title

    // Navigate to assets with context
    window.open(`/assets?project=${selectedMovieData?.title}&search=${encodeURIComponent(searchQuery || "")}`, "_blank")
  }

  const totalDuration = scenes.reduce((total, scene) => {
    const [minutes, seconds] = scene.duration.split(":").map(Number)
    return total + minutes * 60 + seconds
  }, 0)

  const formatTotalDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/movies">
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Project Timeline
              </h1>
              <p className="text-muted-foreground">Organize and manage your film scenes</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Select value={selectedMovie} onValueChange={setSelectedMovie}>
              <SelectTrigger className="w-48 bg-input border-border">
                <SelectValue placeholder="Select movie" />
              </SelectTrigger>
              <SelectContent className="cinema-card border-border">
                {mockMovies.map((movie) => (
                  <SelectItem key={movie.id} value={movie.id.toString()}>
                    {movie.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Link href={`/ai-studio?project=${selectedMovie}`}>
              <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
                <Sparkles className="mr-2 h-4 w-4" />
                AI Studio
              </Button>
            </Link>

            <Link href={`/assets?project=${selectedMovieData?.title}`}>
              <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
                <FolderOpen className="mr-2 h-4 w-4" />
                Assets
              </Button>
            </Link>

            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "cinema" | "video")} className="w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cinema" className="text-xs">Cinema</TabsTrigger>
                <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button className="gradient-button neon-glow text-white">
              <Save className="mr-2 h-4 w-4" />
              Save Timeline
            </Button>
          </div>
        </div>

        {/* Movie Info & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="cinema-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Movie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-blue-500">{selectedMovieData?.title}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Scenes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{scenes.length}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatTotalDuration(totalDuration)}</p>
            </CardContent>
          </Card>

          <Card className="cinema-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">
                {Math.round((scenes.filter((s) => s.status === "Completed").length / scenes.length) * 100)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add Scene Button */}
        <div className="flex justify-center mb-8">
          <Dialog open={isAddSceneOpen} onOpenChange={setIsAddSceneOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-button neon-glow text-white">
                <Plus className="mr-2 h-5 w-5" />
                Add Scene
              </Button>
            </DialogTrigger>
            <DialogContent className="cinema-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingScene ? "Edit Scene" : "Add New Scene"}</DialogTitle>
                <DialogDescription>
                  {editingScene ? "Update scene details" : "Create a new scene for your timeline"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sceneNumber">Scene Number</Label>
                    <Input
                      id="sceneNumber"
                      value={newScene.sceneNumber}
                      onChange={(e) => setNewScene({ ...newScene, sceneNumber: e.target.value })}
                      placeholder="e.g., 1A, 2B..."
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Input
                      id="duration"
                      value={newScene.duration}
                      onChange={(e) => setNewScene({ ...newScene, duration: e.target.value })}
                      placeholder="e.g., 2:30"
                      className="bg-input border-border"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">Scene Title</Label>
                  <Input
                    id="title"
                    value={newScene.title}
                    onChange={(e) => setNewScene({ ...newScene, title: e.target.value })}
                    placeholder="Enter scene title..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newScene.description}
                    onChange={(e) => setNewScene({ ...newScene, description: e.target.value })}
                    placeholder="Describe what happens in this scene..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={newScene.location}
                      onChange={(e) => setNewScene({ ...newScene, location: e.target.value })}
                      placeholder="Scene location..."
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shotType">Shot Type</Label>
                    <Select
                      value={newScene.shotType}
                      onValueChange={(value) => setNewScene({ ...newScene, shotType: value })}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select shot type" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="Wide Shot">Wide Shot</SelectItem>
                        <SelectItem value="Medium Shot">Medium Shot</SelectItem>
                        <SelectItem value="Close-up">Close-up</SelectItem>
                        <SelectItem value="Extreme Close-up">Extreme Close-up</SelectItem>
                        <SelectItem value="Montage">Montage</SelectItem>
                        <SelectItem value="Tracking Shot">Tracking Shot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="mood">Mood</Label>
                    <Select value={newScene.mood} onValueChange={(value) => setNewScene({ ...newScene, mood: value })}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select mood" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="Mysterious">Mysterious</SelectItem>
                        <SelectItem value="Tense">Tense</SelectItem>
                        <SelectItem value="Suspenseful">Suspenseful</SelectItem>
                        <SelectItem value="Energetic">Energetic</SelectItem>
                        <SelectItem value="Dramatic">Dramatic</SelectItem>
                        <SelectItem value="Romantic">Romantic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newScene.status}
                      onValueChange={(value) => setNewScene({ ...newScene, status: value })}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="cinema-card border-border">
                        <SelectItem value="Planning">Planning</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="characters">Characters</Label>
                  <Input
                    id="characters"
                    value={newScene.characters}
                    onChange={(e) => setNewScene({ ...newScene, characters: e.target.value })}
                    placeholder="Character names separated by commas..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Director Notes</Label>
                  <Textarea
                    id="notes"
                    value={newScene.notes}
                    onChange={(e) => setNewScene({ ...newScene, notes: e.target.value })}
                    placeholder="Additional notes and directions..."
                    className="bg-input border-border"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddSceneOpen(false)
                    setEditingScene(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingScene ? handleUpdateScene : handleAddScene}
                  className="gradient-button text-white"
                >
                  {editingScene ? "Update Scene" : "Add Scene"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Timeline */}
        <Tabs value={viewMode} className="w-full">
          <TabsContent value="cinema" className="mt-0">
            <div className="relative mt-8">
              <div className="relative w-full mx-auto">
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-cyan-500/30"></div>

                <div className="space-y-2">
                  {scenes.map((scene, index) => (
                <div key={scene.id} className="relative">
                  <div className="absolute left-1/2 -translate-x-1/2 top-4 h-4 w-4 rounded-full bg-cyan-500 glow z-10 flex items-center justify-center">
                    <span className="text-xs font-bold text-black">{scene.sceneNumber}</span>
                  </div>

                  <div
                    className={`absolute left-1/2 top-6 h-0.5 w-1/2 bg-cyan-500/30 ${
                      index % 2 === 0 ? "-translate-x-full" : ""
                    }`}
                  />

                  <div className={`relative w-full flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <div className={`${index % 2 === 0 ? "mr-8" : "ml-8"} w-[calc(40%-3rem)]`}>
                      <Link href={`/timeline-scene/${scene.id}`}>
                        <Card className="cinema-card hover:neon-glow transition-all duration-300 backdrop-blur-sm group hover:border-cyan-400 cursor-pointer overflow-hidden">
                          <CardHeader className="p-0">
                            <div className="flex h-full min-h-[256px]">
                              {/* Content Section - Left Side */}
                              <div className="flex-1 p-6 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <CardTitle className="text-lg">{scene.title}</CardTitle>
                                  <Badge
                                    className={`text-xs ${statusColors[scene.status as keyof typeof statusColors]}`}
                                  >
                                    {scene.status}
                                  </Badge>
                                  {scene.mood && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${moodColors[scene.mood as keyof typeof moodColors]}`}
                                    >
                                      {scene.mood}
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="text-sm mb-3">{scene.description}</CardDescription>

                                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{scene.location}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{scene.duration}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Camera className="h-3 w-3" />
                                    <span>{scene.shotType}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    <span>{scene.characters.length} chars</span>
                                  </div>
                                </div>

                                {scene.characters.length > 0 && (
                                  <div className="mb-2">
                                    <div className="flex flex-wrap gap-1">
                                      {scene.characters.slice(0, 3).map((character, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {character}
                                        </Badge>
                                      ))}
                                      {scene.characters.length > 3 && (
                                        <Badge variant="secondary" className="text-xs">
                                          +{scene.characters.length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {scene.notes && (
                                  <div className="mb-2 p-2 bg-muted/30 rounded text-xs">
                                    <p className="text-muted-foreground">Notes: {scene.notes}</p>
                                  </div>
                                )}

                                <div className="flex items-center gap-1 pt-2 border-t border-border/50">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleGenerateWithAI(scene.id)
                                    }}
                                    className="text-xs h-6 px-2 bg-transparent hover:bg-blue-500/10 hover:text-blue-500"
                                  >
                                    <Sparkles className="mr-1 h-2 w-2" />
                                    AI
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleViewAssets(scene.id)
                                    }}
                                    className="text-xs h-6 px-2 bg-transparent hover:bg-cyan-500/10 hover:text-cyan-500"
                                  >
                                    <FolderOpen className="mr-1 h-2 w-2" />
                                    Assets
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleEditScene(scene)
                                    }}
                                    className="h-6 w-6 hover:bg-blue-500/10 hover:text-blue-500 ml-auto"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleDeleteScene(scene.id)
                                    }}
                                    className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="w-40 h-64 relative bg-muted/20 border-l border-border/30 flex-shrink-0 overflow-hidden">
                                <img
                                  src={`/abstract-geometric-scene.png?key=jchhr&height=288&width=192&query=Scene ${scene.sceneNumber}: ${scene.title} - ${scene.description}`}
                                  alt={`Scene ${scene.sceneNumber} thumbnail`}
                                  className="w-full h-full object-contain rounded-r-lg"
                                />
                                {/* Scene number overlay */}
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                  {scene.sceneNumber}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      </Link>
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            <div className="relative mt-8">
              <div className="relative w-full mx-auto">
                <div className="space-y-4">
                  {scenes.map((scene, index) => (
                    <div key={scene.id} className="relative">
                      <Card className="cinema-card hover:neon-glow transition-all duration-300">
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-500/10">
                                <Play className="h-5 w-5 text-blue-500" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{scene.title}</CardTitle>
                                <CardDescription className="text-sm">{scene.description}</CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${statusColors[scene.status as keyof typeof statusColors]}`}>
                                {scene.status}
                              </Badge>
                              {scene.mood && (
                                <Badge variant="outline" className={`text-xs ${moodColors[scene.mood as keyof typeof moodColors]}`}>
                                  {scene.mood}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{scene.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{scene.duration}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Camera className="h-4 w-4" />
                              <span>{scene.shotType}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>{scene.characters.length} chars</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-4">
                            <Button size="sm" variant="outline" onClick={() => handleGenerateWithAI(scene.id)}>
                              <Sparkles className="mr-2 h-4 w-4" />
                              AI
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleViewAssets(scene.id)}>
                              <FolderOpen className="mr-2 h-4 w-4" />
                              Assets
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditScene(scene)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" variant="destructive" onClick={() => handleDeleteScene(scene.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Empty State */}
        {scenes.length === 0 && (
          <div className="text-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scenes yet</h3>
            <p className="text-muted-foreground mb-4">Start building your movie timeline by adding your first scene</p>
            <Button onClick={() => setIsAddSceneOpen(true)} className="gradient-button text-white">
              <Plus className="mr-2 h-5 w-5" />
              Add First Scene
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
