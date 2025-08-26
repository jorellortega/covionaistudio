"use client"

import { useState } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ProjectSelector } from "@/components/project-selector"
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
  Upload,
  Download,
  Share,
  Eye,
  Clock,
  Users,
} from "lucide-react"
import Link from "next/link"

// Mock data for videos
const mockVideos = [
  {
    id: 1,
    title: "Cyberpunk Opening Sequence",
    description: "Futuristic city flythrough with neon lights and flying cars",
    status: "In Progress",
    duration: "2:45",
    format: "4K",
    fps: "60fps",
    project: "Neon Dreams",
    createdAt: "2024-01-20",
    updatedAt: "2024-01-20",
    thumbnail: "/cyberpunk-movie-poster.png",
    views: 1247,
    likes: 89,
    type: "Scene",
    aiGenerated: true,
    aiModel: "Runway ML",
  },
  {
    id: 2,
    title: "Character Introduction Reel",
    description: "Main protagonist reveal with dramatic lighting and music",
    status: "Completed",
    duration: "1:30",
    format: "1080p",
    fps: "30fps",
    project: "Neon Dreams",
    createdAt: "2024-01-18",
    updatedAt: "2024-01-19",
            thumbnail: "/placeholder.jpg",
    views: 892,
    likes: 156,
    type: "Character",
    aiGenerated: false,
    aiModel: null,
  },
  {
    id: 3,
    title: "Action Chase Sequence",
    description: "High-speed pursuit through urban environment",
    status: "Post-Production",
    duration: "3:15",
    format: "4K",
    fps: "120fps",
    project: "Quantum Heist",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-20",
    thumbnail: "/quantum-heist-movie-poster.png",
    views: 567,
    likes: 43,
    type: "Action",
    aiGenerated: true,
    aiModel: "Pika Labs",
  },
  {
    id: 4,
    title: "Behind the Scenes Reel",
    description: "Production process and team collaboration highlights",
    status: "Completed",
    duration: "5:20",
    format: "1080p",
    fps: "30fps",
    project: "Digital Horror",
    createdAt: "2024-01-10",
    updatedAt: "2024-01-15",
    thumbnail: "/digital-horror-poster.png",
    views: 2341,
    likes: 234,
    type: "BTS",
    aiGenerated: false,
    aiModel: null,
  },
]

const statusColors = {
  "Pre-Production": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "In Progress": "bg-blue-500/20 text-blue-500 border-blue-500/30",
  "Post-Production": "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
  Completed: "bg-green-500/20 text-green-400 border-green-500/30",
}

const videoTypes = [
  "Scene",
  "Character",
  "Action",
  "BTS",
  "Trailer",
  "Teaser",
  "Reel",
  "VFX",
  "Animation",
]

export default function VideosPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [selectedType, setSelectedType] = useState("All")
  const [selectedProject, setSelectedProject] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newVideo, setNewVideo] = useState({
    title: "",
    description: "",
    type: "",
    project: "",
  })

  const filteredVideos = mockVideos.filter((video) => {
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === "All" || video.status === selectedStatus
    const matchesType = selectedType === "All" || video.type === selectedType
    return matchesSearch && matchesStatus && matchesType
  })

  const handleCreateVideo = () => {
    // In a real app, this would create the video in the database
    console.log("Creating video:", newVideo)
    setIsCreateDialogOpen(false)
    setNewVideo({ title: "", description: "", type: "", project: "" })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Video Content
            </h1>
            <p className="text-muted-foreground">Manage your video projects, reels, and content library</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-button neon-glow text-white">
                <Plus className="mr-2 h-5 w-5" />
                Upload Video
              </Button>
            </DialogTrigger>
            <DialogContent className="cinema-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Upload New Video</DialogTitle>
                <DialogDescription>Add a new video to your content library.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Video Title</Label>
                  <Input
                    id="title"
                    value={newVideo.title}
                    onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                    placeholder="Enter video title..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Video Type</Label>
                  <Input
                    id="type"
                    value={newVideo.type}
                    onChange={(e) => setNewVideo({ ...newVideo, type: e.target.value })}
                    placeholder="e.g., Scene, Character, BTS..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project">Project</Label>
                  <Input
                    id="project"
                    value={newVideo.project}
                    onChange={(e) => setNewVideo({ ...newVideo, project: e.target.value })}
                    placeholder="Project name..."
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newVideo.description}
                    onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                    placeholder="Brief description of your video..."
                    className="bg-input border-border"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateVideo} className="gradient-button text-white">
                  <Upload className="mr-2 h-5 w-5" />
                  Upload Video
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Project Selector */}
        <div className="mb-8">
          <label className="text-sm font-medium mb-2 block">Filter by Project</label>
          <ProjectSelector
            selectedProject={selectedProject}
            onProjectChange={setSelectedProject}
            placeholder="Select a movie or video project"
          />
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
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
              <DropdownMenuItem onClick={() => setSelectedStatus("In Progress")}>In Progress</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("Post-Production")}>Post-Production</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedStatus("Completed")}>Completed</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
                <Film className="mr-2 h-4 w-4" />
                {selectedType}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="cinema-card border-border">
              <DropdownMenuItem onClick={() => setSelectedType("All")}>All Types</DropdownMenuItem>
              {videoTypes.map((type) => (
                <DropdownMenuItem key={type} onClick={() => setSelectedType(type)}>
                  {type}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Videos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="cinema-card hover:neon-glow transition-all duration-300 group">
              <CardHeader className="pb-3">
                <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-muted">
                  <img
                    src={video.thumbnail || "/placeholder.svg"}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-12 w-12 text-white" />
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1 group-hover:text-primary transition-colors">
                      {video.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`text-xs ${statusColors[video.status as keyof typeof statusColors]}`}>
                        {video.status}
                      </Badge>
                      {video.aiGenerated && (
                        <Badge variant="outline" className="text-xs text-cyan-500 border-cyan-500/30">
                          AI Generated
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="hover:bg-muted">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="cinema-card border-border">
                      <DropdownMenuItem>
                        <Play className="mr-2 h-4 w-4" />
                        Play
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Share className="mr-2 h-4 w-4" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4 line-clamp-2">{video.description}</CardDescription>

                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{video.duration}</span>
                    <span>•</span>
                    <span>{video.format}</span>
                    <span>•</span>
                    <span>{video.fps}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    <span>{video.type}</span>
                    <span>•</span>
                    <span>{video.project}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span>{video.views} views</span>
                    <span>•</span>
                    <span>{video.likes} likes</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10 bg-transparent"
                  >
                    <Play className="mr-2 h-3 w-3" />
                    Play
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-cyan-500/20 hover:border-cyan-500 hover:bg-cyan-500/10 bg-transparent"
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredVideos.length === 0 && (
          <div className="text-center py-12">
            <Film className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No videos found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedStatus !== "All" || selectedType !== "All"
                ? "Try adjusting your search or filter criteria"
                : "Upload your first video to get started"}
            </p>
            {!searchQuery && selectedStatus === "All" && selectedType === "All" && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gradient-button text-white">
                <Upload className="mr-2 h-5 w-5" />
                Upload Video
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
