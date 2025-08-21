"use client"

import React from "react"
import Link from "next/link"

import { useState } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Search,
  Grid3X3,
  List,
  Upload,
  Download,
  Trash2,
  Edit,
  Eye,
  MoreVertical,
  FolderOpen,
  ImageIcon,
  Video,
  FileText,
  Music,
  File,
  Calendar,
  Sparkles,
  Copy,
  Share,
  Play,
} from "lucide-react"

// Mock asset data
const mockAssets = [
  {
    id: 1,
    name: "Cyberpunk City Concept",
    type: "image",
    url: "/cyberpunk-city-concept.png",
    size: "2.4 MB",
    dimensions: "1920x1080",
    format: "PNG",
    createdAt: "2024-01-20",
    updatedAt: "2024-01-20",
    project: "Neon Dreams",
    tags: ["concept art", "cyberpunk", "city", "neon"],
    aiModel: "DALL-E 3",
    prompt: "Futuristic cyberpunk city at night with neon lights and flying cars",
    versions: 3,
    description: "Main establishing shot concept for the opening scene",
  },
  {
    id: 2,
    name: "Main Character Design",
    type: "image",
    url: "/character-design.png",
    size: "1.8 MB",
    dimensions: "1024x1024",
    format: "PNG",
    createdAt: "2024-01-19",
    updatedAt: "2024-01-19",
    project: "Neon Dreams",
    tags: ["character", "design", "cybernetic", "protagonist"],
    aiModel: "Midjourney",
    prompt: "Cybernetic enhanced human character in dark clothing",
    versions: 5,
    description: "Final character design for Alex Chen",
  },
  {
    id: 3,
    name: "Opening Scene Script",
    type: "script",
    url: "/opening-scene.txt",
    size: "12 KB",
    format: "TXT",
    createdAt: "2024-01-20",
    updatedAt: "2024-01-20",
    project: "Neon Dreams",
    tags: ["script", "opening", "dialogue", "scene"],
    aiModel: "GPT-4",
    prompt: "Write opening scene dialogue for cyberpunk thriller",
    versions: 2,
    description: "Complete opening scene with dialogue and action",
  },
  {
    id: 4,
    name: "Chase Sequence Preview",
    type: "video",
    url: "/chase-sequence.mp4",
    size: "45 MB",
    dimensions: "1920x1080",
    format: "MP4",
    duration: "0:30",
    createdAt: "2024-01-18",
    updatedAt: "2024-01-18",
    project: "Neon Dreams",
    tags: ["video", "chase", "action", "preview"],
    aiModel: "Runway ML",
    prompt: "High-speed chase through neon-lit city streets",
    versions: 1,
    description: "Previsualization for the main chase sequence",
  },
  {
    id: 5,
    name: "Ambient City Sounds",
    type: "audio",
    url: "/ambient-city.mp3",
    size: "8.2 MB",
    format: "MP3",
    duration: "2:15",
    createdAt: "2024-01-17",
    updatedAt: "2024-01-17",
    project: "Neon Dreams",
    tags: ["audio", "ambient", "city", "background"],
    aiModel: "ElevenLabs",
    prompt: "Cyberpunk city ambient sounds with electronic hum",
    versions: 1,
    description: "Background audio for city scenes",
  },
  {
    id: 6,
    name: "Character Backstory",
    type: "document",
    url: "/character-backstory.pdf",
    size: "156 KB",
    format: "PDF",
    createdAt: "2024-01-16",
    updatedAt: "2024-01-19",
    project: "Neon Dreams",
    tags: ["document", "character", "backstory", "development"],
    aiModel: "Claude",
    prompt: "Develop detailed backstory for main character",
    versions: 4,
    description: "Complete character development document",
  },
]

const assetTypes = ["all", "image", "video", "script", "audio", "document"]
const projects = ["All Projects", "Neon Dreams", "The Last Symphony", "Quantum Heist", "Digital Ghosts"]

const typeIcons = {
  image: ImageIcon,
  video: Video,
  script: FileText,
  audio: Music,
  document: File,
}

const typeColors = {
  image: "bg-green-500/20 text-green-400 border-green-500/30",
  video: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  script: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  audio: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  document: "bg-orange-500/20 text-orange-400 border-orange-500/30",
}

const mockMovies = [
  { id: 1, title: "Neon Dreams" },
  { id: 2, title: "The Last Symphony" },
  { id: 3, title: "Quantum Heist" },
  { id: 4, title: "Digital Ghosts" },
]

export default function AssetsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedProject, setSelectedProject] = useState("All Projects")
  const [viewMode, setViewMode] = useState("grid")
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const filteredAssets = mockAssets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      asset.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedType === "all" || asset.type === selectedType
    const matchesProject = selectedProject === "All Projects" || asset.project === selectedProject
    return matchesSearch && matchesType && matchesProject
  })

  const handleViewDetails = (asset: any) => {
    setSelectedAsset(asset)
    setIsDetailsOpen(true)
  }

  const handleDownload = (asset: any) => {
    // In a real app, this would trigger a download
    console.log("Downloading asset:", asset.name)
  }

  const handleDelete = (assetId: number) => {
    // In a real app, this would delete the asset
    console.log("Deleting asset:", assetId)
  }

  const formatFileSize = (bytes: string) => {
    return bytes // Already formatted in mock data
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Asset Library
            </h1>
            <p className="text-muted-foreground">Manage and organize your AI-generated content</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/ai-studio">
              <Button variant="outline" className="border-border bg-transparent hover:bg-muted">
                <Sparkles className="mr-2 h-4 w-4" />
                AI Studio
              </Button>
            </Link>
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-button neon-glow text-white">
                  <Upload className="mr-2 h-5 w-5" />
                  Upload Assets
                </Button>
              </DialogTrigger>
              <DialogContent className="cinema-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Upload New Asset</DialogTitle>
                  <DialogDescription>Add files to your asset library</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">Drag and drop files here, or click to browse</p>
                    <Button variant="outline" className="bg-transparent">
                      Choose Files
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="gradient-button text-white">Upload</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="cinema-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-lg font-semibold">{mockAssets.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {assetTypes.slice(1).map((type) => {
            const count = mockAssets.filter((asset) => asset.type === type).length
            const Icon = typeIcons[type as keyof typeof typeIcons]
            return (
              <Card key={type} className="cinema-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground capitalize">{type}s</p>
                      <p className="text-lg font-semibold">{count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-40 bg-input border-border">
              <SelectValue placeholder="Asset type" />
            </SelectTrigger>
            <SelectContent className="cinema-card border-border">
              {assetTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type === "all" ? "All Types" : type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48 bg-input border-border">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent className="cinema-card border-border">
              {projects.map((project) => (
                <SelectItem key={project} value={project}>
                  {project}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-input">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "gradient-button text-white" : ""}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "gradient-button text-white" : ""}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Assets Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAssets.map((asset) => {
              const Icon = typeIcons[asset.type as keyof typeof typeIcons]
              return (
                <Card key={asset.id} className="cinema-card hover:neon-glow transition-all duration-300 group">
                  <CardHeader className="pb-3">
                    <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-muted relative">
                      {asset.type === "image" ? (
                        <img
                          src={asset.url || "/placeholder.svg"}
                          alt={asset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge className={`text-xs ${typeColors[asset.type as keyof typeof typeColors]}`}>
                          {asset.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-sm mb-1 group-hover:text-primary transition-colors line-clamp-1">
                          {asset.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{asset.size}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-muted">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="cinema-card border-border">
                          <DropdownMenuItem onClick={() => handleViewDetails(asset)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(asset)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Share className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(asset.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(asset.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        <span>{asset.aiModel}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {asset.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{asset.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssets.map((asset) => {
              const Icon = typeIcons[asset.type as keyof typeof typeIcons]
              return (
                <Card key={asset.id} className="cinema-card hover:neon-glow transition-all duration-300">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        {asset.type === "image" ? (
                          <img
                            src={asset.url || "/placeholder.svg"}
                            alt={asset.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{asset.name}</h3>
                          <Badge className={`text-xs ${typeColors[asset.type as keyof typeof typeColors]}`}>
                            {asset.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-1">{asset.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{asset.size}</span>
                          <span>•</span>
                          <span>{formatDate(asset.createdAt)}</span>
                          <span>•</span>
                          <span>{asset.project}</span>
                          <span>•</span>
                          <span>{asset.aiModel}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(asset)}
                          className="hover:bg-primary/10 hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(asset)}
                          className="hover:bg-secondary/10 hover:text-secondary"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="hover:bg-muted">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="cinema-card border-border">
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Share className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(asset.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Empty State */}
        {filteredAssets.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No assets found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedType !== "all" || selectedProject !== "All Projects"
                ? "Try adjusting your search or filter criteria"
                : "Upload your first asset to get started"}
            </p>
            {!searchQuery && selectedType === "all" && selectedProject === "All Projects" && (
              <Button onClick={() => setIsUploadOpen(true)} className="gradient-button text-white">
                <Upload className="mr-2 h-5 w-5" />
                Upload Assets
              </Button>
            )}
          </div>
        )}

        {/* Asset Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="cinema-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedAsset && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground">{selectedAsset.name}</DialogTitle>
                  <DialogDescription>Asset details and metadata</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  {/* Preview */}
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    {selectedAsset.type === "image" ? (
                      <img
                        src={selectedAsset.url || "/placeholder.svg"}
                        alt={selectedAsset.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {React.createElement(typeIcons[selectedAsset.type as keyof typeof typeIcons], {
                          className: "h-16 w-16 text-muted-foreground",
                        })}
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Type</Label>
                      <p className="text-sm text-muted-foreground capitalize">{selectedAsset.type}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Size</Label>
                      <p className="text-sm text-muted-foreground">{selectedAsset.size}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Format</Label>
                      <p className="text-sm text-muted-foreground">{selectedAsset.format}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Project</Label>
                      <p className="text-sm text-muted-foreground">{selectedAsset.project}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Created</Label>
                      <p className="text-sm text-muted-foreground">{formatDate(selectedAsset.createdAt)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">AI Model</Label>
                      <p className="text-sm text-muted-foreground">{selectedAsset.aiModel}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">{selectedAsset.description}</p>
                  </div>

                  {/* AI Prompt */}
                  {selectedAsset.prompt && (
                    <div>
                      <Label className="text-sm font-medium">AI Prompt</Label>
                      <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted/50 rounded-lg">
                        {selectedAsset.prompt}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  <div>
                    <Label className="text-sm font-medium">Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedAsset.tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Versions */}
                  <div>
                    <Label className="text-sm font-medium">Versions</Label>
                    <p className="text-sm text-muted-foreground">{selectedAsset.versions} versions available</p>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Link href={`/timeline?movie=${mockMovies.find((m) => m.title === selectedAsset.project)?.id}`}>
                      <Button variant="outline" size="sm" className="bg-transparent">
                        <Play className="mr-2 h-4 w-4" />
                        Open Timeline
                      </Button>
                    </Link>
                    <Link href="/ai-studio">
                      <Button variant="outline" size="sm" className="bg-transparent">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Similar
                      </Button>
                    </Link>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => handleDownload(selectedAsset)}
                    className="gradient-button text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
