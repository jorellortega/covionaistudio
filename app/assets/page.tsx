"use client"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ArrowLeft,
  Play,
  Edit3,
  ImageIcon,
  FileText,
  MessageSquare,
  Search,
  Filter,
  Plus,
  Copy,
  Eye,
  Calendar,
  Clock,
  User,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AssetService, type Asset } from "@/lib/asset-service"
import { MovieService, type Movie } from "@/lib/movie-service"
import { useAuth } from "@/lib/auth-context-fixed"
import TextToSpeech from "@/components/text-to-speech"
import Link from "next/link"

export default function AssetsPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const searchQuery = searchParams.get('search') || ''

  return <AssetsPageClient projectId={projectId} searchQuery={searchQuery} />
}

function AssetsPageClient({ projectId, searchQuery }: { projectId: string | null, searchQuery: string }) {
  const { toast } = useToast()
  const { user } = useAuth()

  // State variables
  const [activeTab, setActiveTab] = useState("all")
  const [assets, setAssets] = useState<Asset[]>([])
  const [projects, setProjects] = useState<Movie[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState(searchQuery)
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [showAssetDetails, setShowAssetDetails] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  // Effect to fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const fetchedProjects = await MovieService.getMovies()
        setProjects(fetchedProjects)
        
        // Set selected project based on URL param
        if (projectId) {
          const project = fetchedProjects.find(p => p.id === projectId)
          if (project) {
            setSelectedProject(project.id)
          }
        } else if (fetchedProjects.length > 0) {
          setSelectedProject(fetchedProjects[0].id)
        }
      } catch (error) {
        console.error('Error fetching projects:', error)
        toast({
          title: "Error fetching projects",
          description: "Failed to load projects.",
          variant: "destructive",
        })
      }
    }

    fetchProjects()
  }, [projectId, toast])

  // Effect to fetch assets when project changes
  useEffect(() => {
    const fetchAssets = async () => {
      if (!selectedProject) return
      
      try {
        setLoading(true)
        console.log('Fetching assets for project:', selectedProject)
        const fetchedAssets = await AssetService.getAssetsForProject(selectedProject)
        console.log('Fetched assets:', fetchedAssets)
        setAssets(fetchedAssets)
        
        // Check if search term is filtering out all assets
        if (searchTerm && fetchedAssets.length > 0) {
          const matchingAssets = fetchedAssets.filter(asset => 
            asset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.content?.toLowerCase().includes(searchTerm.toLowerCase())
          )
          
          // If search term filters out all assets, it might be a scene ID or invalid search
          if (matchingAssets.length === 0) {
            console.log('Search term filters out all assets. Search term:', searchTerm)
            console.log('This might be a scene ID or invalid search. Clearing search...')
            
            // Check if search term looks like a UUID (scene ID)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (uuidRegex.test(searchTerm)) {
              console.log('Search term is a UUID (likely scene ID). Clearing search.')
              setSearchTerm('')
              toast({
                title: "Search Cleared",
                description: "Search term appeared to be a scene ID and was cleared.",
                variant: "default",
              })
            }
          }
        }
      } catch (error) {
        console.error('Error fetching assets:', error)
        toast({
          title: "Error fetching assets",
          description: "Failed to load project assets.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAssets()
  }, [selectedProject, toast, searchTerm])

  // Effect to handle search term changes and show helpful messages
  useEffect(() => {
    if (searchTerm && assets.length > 0) {
      const matchingAssets = assets.filter(asset => 
        asset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.content?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      
      if (matchingAssets.length === 0) {
        // Don't show toast here to avoid spam, just log
        console.log('No assets match search term:', searchTerm)
      }
    }
  }, [searchTerm, assets])

  // Filter assets based on search and content type
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.content?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = contentTypeFilter === "all" || asset.content_type === contentTypeFilter
    
    return matchesSearch && matchesType
  })

  // Group assets by content type
  const assetsByType = {
    script: filteredAssets.filter(a => a.content_type === 'script') || [],
    image: filteredAssets.filter(a => a.content_type === 'image') || [],
    video: filteredAssets.filter(a => a.content_type === 'video') || [],
    audio: filteredAssets.filter(a => a.content_type === 'audio') || [],
  }

  const refreshAssets = async () => {
    if (!selectedProject) return
    
    try {
      setLoading(true)
      const fetchedAssets = await AssetService.getAssetsForProject(selectedProject)
      setAssets(fetchedAssets)
      toast({
        title: "Assets Refreshed",
        description: "Project assets have been updated.",
      })
    } catch (error) {
      console.error('Error refreshing assets:', error)
      toast({
        title: "Error refreshing assets",
        description: "Failed to refresh project assets.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyScript = (content: string) => {
    navigator.clipboard.writeText(content)
    toast({
      title: "Script Copied",
      description: "Script content copied to clipboard",
    })
  }

  const handleViewAsset = (asset: Asset) => {
    setSelectedAsset(asset)
    setShowAssetDetails(true)
  }

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'script': return <FileText className="h-4 w-4" />
      case 'image': return <ImageIcon className="h-4 w-4" />
      case 'video': return <Play className="h-4 w-4" />
      case 'audio': return <MessageSquare className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'script': return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
      case 'image': return 'bg-green-500/20 text-green-500 border-green-500/30'
      case 'video': return 'bg-purple-500/20 text-purple-500 border-purple-500/30'
      case 'audio': return 'bg-orange-500/20 text-orange-500 border-orange-500/30'
      default: return 'bg-muted/20 text-muted-foreground border-muted/30'
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-muted-foreground mb-4">Please log in to view your assets.</p>
          <Link href="/login">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-primary">Asset Library</h1>
              <p className="text-muted-foreground mt-1">Manage and organize your generated content</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAssets}
              disabled={loading}
              className="border-primary/30 text-primary bg-transparent"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/ai-studio">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Generate New
              </Button>
            </Link>
          </div>
        </div>



        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="text-sm font-medium mb-2 block">Project</label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent className="cinema-card border-border">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Content Type</label>
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="cinema-card border-border">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="script">Scripts</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Scripts</span>
              </div>
              <p className="text-2xl font-bold text-blue-500">{assetsByType.script?.length || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Images</span>
              </div>
              <p className="text-2xl font-bold text-green-500">{assetsByType.image?.length || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Videos</span>
              </div>
              <p className="text-2xl font-bold text-purple-500">{assetsByType.video?.length || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Audio</span>
              </div>
              <p className="text-2xl font-bold text-orange-500">{assetsByType.audio?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border-primary/20">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              All Assets ({filteredAssets.length})
            </TabsTrigger>
            <TabsTrigger value="scripts" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Scripts ({assetsByType.script.length})
            </TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Images ({assetsByType.image.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Videos ({assetsByType.video.length})
            </TabsTrigger>
            <TabsTrigger value="audio" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Audio ({assetsByType.audio.length})
            </TabsTrigger>
          </TabsList>

          {/* All Assets Tab */}
          <TabsContent value="all" className="space-y-6">
            {loading ? (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading assets...</p>
                </CardContent>
              </Card>
            ) : filteredAssets.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAssets.map((asset) => (
                  <AssetCard 
                    key={asset.id} 
                    asset={asset} 
                    onView={handleViewAsset}
                    onCopy={handleCopyScript}
                  />
                ))}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || contentTypeFilter !== "all" 
                      ? "No assets match your current filters" 
                      : "No assets found for this project"
                    }
                  </p>
                  <Link href="/ai-studio">
                    <Button className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90">
                      <Plus className="h-4 w-4 mr-2" />
                      Generate Your First Asset
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Individual Type Tabs */}
          {['scripts', 'images', 'videos', 'audio'].map((type) => (
            <TabsContent key={type} value={type} className="space-y-6">
              {loading ? (
                <Card className="bg-card border-primary/20">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading {type}...</p>
                  </CardContent>
                </Card>
              ) : (assetsByType[type.slice(0, -1) as keyof typeof assetsByType]?.length || 0) > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {assetsByType[type.slice(0, -1) as keyof typeof assetsByType]?.map((asset) => (
                    <AssetCard 
                      key={asset.id} 
                      asset={asset} 
                      onView={handleViewAsset}
                      onCopy={handleCopyScript}
                    />
                  ))}
                </div>
              ) : (
                <Card className="bg-card border-primary/20">
                  <CardContent className="p-8 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No {type} found for this project</p>
                    <Link href="/ai-studio">
                      <Button className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90">
                        <Plus className="h-4 w-4 mr-2" />
                        Generate {type.slice(0, -1)}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Asset Details Dialog */}
        <Dialog open={showAssetDetails} onOpenChange={setShowAssetDetails}>
          <DialogContent className="bg-background border-primary/20 max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-primary">Asset Details</DialogTitle>
            </DialogHeader>
            {selectedAsset && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Title:</span>
                    <p className="text-foreground font-medium">{selectedAsset.title}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <Badge className={`ml-2 ${getContentTypeColor(selectedAsset.content_type)}`}>
                      {selectedAsset.content_type}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <p className="text-foreground">v{selectedAsset.version}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="text-foreground">{new Date(selectedAsset.created_at).toLocaleDateString()}</p>
                  </div>
                  {selectedAsset.prompt && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Prompt:</span>
                      <p className="text-foreground">{selectedAsset.prompt}</p>
                    </div>
                  )}
                  {selectedAsset.model && (
                    <div>
                      <span className="text-muted-foreground">Model:</span>
                      <p className="text-foreground">{selectedAsset.model}</p>
                    </div>
                  )}
                </div>

                {selectedAsset.content_type === 'script' && selectedAsset.content && (
                  <div className="space-y-4">
                    <div>
                      <span className="text-muted-foreground">Content:</span>
                      <div className="bg-muted/20 rounded-lg p-4 mt-2 max-h-96 overflow-y-auto">
                        <pre className="text-sm text-foreground font-mono whitespace-pre-wrap">
                          {selectedAsset.content}
                        </pre>
                      </div>
                    </div>
                    
                    {/* Text to Speech Component */}
                    <div data-tts-asset={selectedAsset.id}>
                      <TextToSpeech 
                        text={selectedAsset.content}
                        title={selectedAsset.title}
                        projectId={selectedAsset.project_id}
                        sceneId={selectedAsset.scene_id}
                        className="mt-4"
                      />
                    </div>
                  </div>
                )}

                {selectedAsset.content_type === 'image' && selectedAsset.content_url && (
                  <div>
                    <span className="text-muted-foreground">Image:</span>
                    <div className="mt-2">
                      <img 
                        src={selectedAsset.content_url} 
                        alt={selectedAsset.title}
                        className="w-full max-h-96 object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  {selectedAsset.content_type === 'script' && selectedAsset.content && (
                    <Button
                      variant="outline"
                      onClick={() => handleCopyScript(selectedAsset.content!)}
                      className="border-primary/30 text-primary bg-transparent"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Script
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowAssetDetails(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Asset Card Component
function AssetCard({ 
  asset, 
  onView, 
  onCopy 
}: { 
  asset: Asset, 
  onView: (asset: Asset) => void, 
  onCopy: (content: string) => void 
}) {
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'script': return <FileText className="h-4 w-4" />
      case 'image': return <ImageIcon className="h-4 w-4" />
      case 'video': return <Play className="h-4 w-4" />
      case 'audio': return <MessageSquare className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'script': return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
      case 'image': return 'bg-green-500/20 text-green-500 border-green-500/30'
      case 'video': return 'bg-purple-500/20 text-purple-500 border-purple-500/30'
      case 'audio': return 'bg-orange-500/20 text-orange-500 border-orange-500/30'
      default: return 'bg-muted/20 text-muted-foreground border-muted/30'
    }
  }

  return (
    <Card className="bg-card border-primary/20 hover:border-primary/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-primary text-lg line-clamp-2">{asset.title}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                v{asset.version}
              </Badge>
              {asset.is_latest_version && (
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                  Latest
                </Badge>
              )}
              <Badge className={`text-xs ${getContentTypeColor(asset.content_type)}`}>
                {asset.content_type}
              </Badge>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {new Date(asset.created_at).toLocaleDateString()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Content Preview */}
        {asset.content_type === 'script' && asset.content && (
          <div className="space-y-3">
            <div className="bg-muted/20 rounded-lg p-3 max-h-24 overflow-y-auto">
              <p className="text-sm text-muted-foreground font-mono line-clamp-3">
                {asset.content}
              </p>
            </div>
            
            {/* Text to Speech Component */}
            <div data-tts-asset={asset.id}>
              <TextToSpeech 
                text={asset.content}
                title={asset.title}
                projectId={asset.project_id}
                sceneId={asset.scene_id}
                className="mt-2"
              />
              {/* Debug info for TTS */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-muted-foreground mt-1">
                  Debug: projectId={asset.project_id}, sceneId={asset.scene_id}
                </div>
              )}
            </div>
          </div>
        )}
        
        {asset.content_type === 'image' && asset.content_url && (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            <img 
              src={asset.content_url} 
              alt={asset.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Metadata */}
        <div className="space-y-2 text-sm">
          {asset.prompt && (
            <div>
              <span className="text-muted-foreground">Prompt:</span>
              <p className="text-foreground line-clamp-2">{asset.prompt}</p>
            </div>
          )}
          {asset.model && (
            <div>
              <span className="text-muted-foreground">Model:</span>
              <span className="text-foreground ml-1">{asset.model}</span>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="border-primary/30 text-primary bg-transparent flex-1"
            onClick={() => onView(asset)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          
          {asset.content_type === 'script' && asset.content && (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                className="border-blue-500/30 text-blue-500 bg-transparent"
                onClick={() => onCopy(asset.content!)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                className="border-green-500/30 text-green-400 bg-transparent"
                onClick={() => {
                  // Scroll to the text-to-speech component
                  const ttsElement = document.querySelector(`[data-tts-asset="${asset.id}"]`)
                  if (ttsElement) {
                    ttsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }}
              >
                <span className="mr-2">🎤</span>
                Listen
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
