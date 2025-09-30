"use client"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
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
  Trash2,
  Upload,
  Bot,
  Save,
  Volume2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AssetService, type Asset } from "@/lib/asset-service"
import { MovieService, type Movie } from "@/lib/movie-service"
import { useAuthReady } from "@/components/auth-hooks"
import TextToSpeech from "@/components/text-to-speech"
import FileImport from "@/components/file-import"
import AITextEditor from "@/components/ai-text-editor"
import Link from "next/link"
import Header from "@/components/header"

export default function AssetsPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const searchQuery = searchParams.get('search') || ''

  console.log('📄 AssetsPage loaded with params:', {
    projectId,
    searchQuery,
    allParams: Object.fromEntries(searchParams.entries())
  })

  return <AssetsPageClient projectId={projectId} searchQuery={searchQuery} />
}

function AssetsPageClient({ projectId, searchQuery }: { projectId: string | null, searchQuery: string }) {
  const { toast } = useToast()
  const { user, userId, ready } = useAuthReady()

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showTTSDialog, setShowTTSDialog] = useState(false)
  const [ttsAsset, setTtsAsset] = useState<Asset | null>(null)
  
  // AI editing states
  const [showAITextEditor, setShowAITextEditor] = useState(false)
  const [aiEditData, setAiEditData] = useState<{
    selectedText: string;
    fullContent: string;
    assetId: string;
    field: 'content';
  } | null>(null)
  
  // Version editing states
  const [showVersionEdit, setShowVersionEdit] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [versionEditForm, setVersionEditForm] = useState({
    title: '',
    content: '',
    version_name: '',
    version: '1',
    selection: ''
  } as {
    title: string;
    content: string;
    version_name: string;
    version: string;
    selection?: string;
  })

  // Effect to fetch projects
  useEffect(() => {
    if (!ready) return
    
    const fetchProjects = async () => {
      try {
        const fetchedProjects = await MovieService.getMovies()
        setProjects(fetchedProjects)
        
        // Set selected project based on URL param
        console.log('🔍 Setting project from URL param:', {
          projectId,
          fetchedProjectsCount: fetchedProjects.length,
          projectNames: fetchedProjects.map(p => ({ id: p.id, name: p.name }))
        })
        
        if (projectId) {
          const project = fetchedProjects.find(p => p.id === projectId)
          console.log('🎯 Found project by ID:', project)
          if (project) {
            setSelectedProject(project.id)
            console.log('✅ Set selected project to:', project.id, project.name)
          } else {
            console.log('❌ No project found with ID:', projectId)
          }
        } else if (fetchedProjects.length > 0) {
          setSelectedProject(fetchedProjects[0].id)
          console.log('📝 Set selected project to first available:', fetchedProjects[0].id, fetchedProjects[0].name)
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
  }, [ready, projectId, toast])

  // Effect to fetch assets when project changes
  useEffect(() => {
    if (!ready || !selectedProject) return
    
    const fetchAssets = async () => {
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
  }, [ready, selectedProject, toast, searchTerm])

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

  const handleFileImported = (assetId: string) => {
    refreshAssets()
    setShowImportDialog(false)
    toast({
      title: "File Imported Successfully",
      description: "Your file has been imported and converted to a script asset.",
    })
  }

  // AI text editing handler
  const handleAITextEdit = (selectedText: string, fullContent: string, assetId: string) => {
    setAiEditData({
      selectedText,
      fullContent,
      assetId,
      field: 'content'
    })
    setShowAITextEditor(true)
  }

  // Handle AI text replacement
  const handleAITextReplace = (newText: string) => {
    if (!aiEditData) return
    
    // Update the version edit form with the new text
    setVersionEditForm(prev => ({
      ...prev,
      content: newText
    }))
    
    // Clear the AI edit data
    setAiEditData(null)
    setShowAITextEditor(false)
  }

  // Handle version editing
  const handleEditVersion = (asset: Asset) => {
    setEditingAsset(asset)
    setVersionEditForm({
      title: asset.title,
      content: asset.content || '',
      version_name: asset.version_name || `Version ${asset.version}`,
      version: asset.version.toString()
    })
    setShowVersionEdit(true)
  }

  // Save version edits
  const handleSaveVersionEdit = async () => {
    if (!editingAsset) return
    
    try {
      setLoading(true)
      
      // Create a new version with the edited content
      const newAssetData = {
        project_id: editingAsset.project_id,
        scene_id: editingAsset.scene_id,
        title: versionEditForm.title,
        content_type: editingAsset.content_type,
        content: versionEditForm.content,
        content_url: editingAsset.content_url,
        prompt: editingAsset.prompt,
        model: editingAsset.model,
        version_name: versionEditForm.version_name,
        generation_settings: editingAsset.generation_settings,
        metadata: {
          ...editingAsset.metadata,
          edited_from_version: editingAsset.version,
          edited_at: new Date().toISOString(),
          original_title: editingAsset.title,
          original_version_name: editingAsset.version_name
        }
      }
      
      await AssetService.createAsset(newAssetData)
      
      // Refresh assets
      refreshAssets()
      
      toast({
        title: "Version Updated",
        description: `New version "${versionEditForm.version_name}" has been created.`,
      })
      
      setShowVersionEdit(false)
      setEditingAsset(null)
      
    } catch (error) {
      console.error('Error saving version edit:', error)
      toast({
        title: "Error",
        description: "Failed to save version edit. Please try again.",
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

  const handleDeleteAsset = (asset: Asset) => {
    setAssetToDelete(asset)
    setShowDeleteDialog(true)
  }

  const handleOpenTTS = (asset: Asset) => {
    setTtsAsset(asset)
    setShowTTSDialog(true)
  }

  const confirmDeleteAsset = async () => {
    if (!assetToDelete) return
    
    try {
      setDeleting(true)
      await AssetService.deleteAsset(assetToDelete.id)
      
      // Remove the asset from the local state
      setAssets(prevAssets => prevAssets.filter(a => a.id !== assetToDelete.id))
      
      toast({
        title: "Asset Deleted",
        description: `${assetToDelete.title} has been successfully deleted.`,
      })
      
      setShowDeleteDialog(false)
      setAssetToDelete(null)
    } catch (error) {
      console.error('Error deleting asset:', error)
      toast({
        title: "Error Deleting Asset",
        description: "Failed to delete the asset. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
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

  if (!ready || !user) {
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
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 whitespace-nowrap">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-primary">Asset Library</h1>
              <p className="text-muted-foreground mt-1">Manage and organize your generated content</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAssets}
              disabled={loading}
              className="border-primary/30 text-primary bg-transparent whitespace-nowrap"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
              disabled={!selectedProject}
              className="border-green-500/30 text-green-500 bg-transparent whitespace-nowrap"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Scripts
            </Button>
            <Link href="/ai-studio">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90 whitespace-nowrap">
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
                    onDelete={handleDeleteAsset}
                    onEdit={handleEditVersion}
                    onOpenTTS={handleOpenTTS}
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
                      onDelete={handleDeleteAsset}
                      onEdit={handleEditVersion}
                      onOpenTTS={handleOpenTTS}
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
          <DialogContent className="bg-background border-primary/20 w-[95vw] max-w-[95vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-primary text-2xl">Asset Details</DialogTitle>
            </DialogHeader>
            {selectedAsset && (
              <div className="space-y-8 min-w-0 overflow-hidden">
                {/* Clean Header with Essential Info */}
                <div className="space-y-3 pb-4 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-bold text-foreground">{selectedAsset.title}</h2>
                      <Badge className={`${getContentTypeColor(selectedAsset.content_type)}`}>
                        {selectedAsset.content_type}
                      </Badge>
                      <span className="text-muted-foreground">v{selectedAsset.version}</span>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>Created: {new Date(selectedAsset.created_at).toLocaleDateString()}</div>
                      {selectedAsset.model && <div>Model: {selectedAsset.model}</div>}
                    </div>
                  </div>
                  
                  {/* Text to Speech - Compact Header Version */}
                  {selectedAsset.content_type === 'script' && selectedAsset.content && (
                    <div className="bg-muted/10 rounded-lg p-3">
                      <TextToSpeech 
                        text={selectedAsset.content}
                        title={selectedAsset.title}
                        projectId={selectedAsset.project_id || ''}
                        sceneId={selectedAsset.scene_id || undefined}
                      />
                    </div>
                  )}
                </div>
                
                {/* Prompt Section - Only if exists */}
                {selectedAsset.prompt && (
                  <div className="bg-muted/20 rounded-lg p-4">
                    <span className="text-sm font-medium text-muted-foreground">Prompt:</span>
                    <p className="text-foreground mt-1">{selectedAsset.prompt}</p>
                  </div>
                )}

                {selectedAsset.content_type === 'script' && selectedAsset.content && (
                  <div className="space-y-6">
                    {/* Script Content Section - Takes up most space */}
                    <div className="bg-muted/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold mb-4 text-foreground">Script Content</h3>
                      <div className="bg-background rounded-lg p-6 max-h-[60vh] overflow-y-auto border border-border/30">
                        <pre className="text-sm text-foreground font-mono whitespace-pre-wrap break-words leading-relaxed max-w-full">
                          {selectedAsset.content}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAsset.content_type === 'image' && selectedAsset.content_url && (
                  <div className="bg-muted/20 rounded-xl p-8">
                    <h3 className="text-xl font-semibold mb-6 text-foreground">Image Preview</h3>
                    <div className="flex justify-center p-4">
                      <img 
                        src={selectedAsset.content_url} 
                        alt={selectedAsset.title}
                        className="max-w-full max-h-96 object-contain rounded-xl border border-border/30 shadow-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 pt-8 border-t border-border/30">
                  {selectedAsset.content_type === 'script' && selectedAsset.content && (
                    <Button
                      variant="outline"
                      onClick={() => handleCopyScript(selectedAsset.content!)}
                      className="border-primary/30 text-primary bg-transparent hover:bg-primary/10 px-6 py-2"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Script
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAssetDetails(false)}
                    className="ml-auto border-border hover:bg-muted px-6 py-2"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="bg-background border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-primary text-xl">Delete Asset</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete "{assetToDelete?.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setAssetToDelete(null)
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteAsset}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Asset
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Scripts Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">Import Scripts & Documents</DialogTitle>
              <DialogDescription>
                Upload PDF, Word, or text files to convert them into script assets for your project.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {selectedProject ? (
                <FileImport
                  projectId={selectedProject}
                  sceneId={null}
                  onFileImported={handleFileImported}
                  className="w-full"
                />
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Please select a project first to import scripts.</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Version Editing Dialog */}
        <Dialog open={showVersionEdit} onOpenChange={setShowVersionEdit}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-green-400">Edit Version</DialogTitle>
              <DialogDescription>
                Edit the title, version name, and content of this version
              </DialogDescription>
            </DialogHeader>
            
            {editingAsset && (
              <div className="space-y-6">
                {/* Version Info Header */}
                <div className="space-y-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="outline" className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10">
                        {editingAsset.version_name || `Version ${editingAsset.version}`}
                      </Badge>
                      <Badge className="bg-green-500 text-white px-2 py-1 text-sm">
                        {editingAsset.content_type.toUpperCase()}
                      </Badge>
                      {editingAsset.is_latest_version && (
                        <Badge className="bg-blue-500 text-white px-2 py-1 text-sm">
                          LATEST VERSION
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(editingAsset.created_at).toLocaleDateString()} | 
                      Last Updated: {new Date(editingAsset.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {/* Text to Speech - Compact in Header */}
                  {editingAsset.content_type === 'script' && versionEditForm.content && (
                    <div className="bg-background/50 rounded-lg p-3">
                      <TextToSpeech 
                        text={versionEditForm.content}
                        title={editingAsset.title}
                        projectId={editingAsset.project_id || ''}
                        sceneId={editingAsset.scene_id || undefined}
                      />
                    </div>
                  )}
                </div>

                {/* Edit Form */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-title" className="text-sm font-medium">
                      Title
                    </Label>
                    <Input
                      id="edit-title"
                      value={versionEditForm.title}
                      onChange={(e) => setVersionEditForm(prev => ({
                        ...prev,
                        title: e.target.value
                      }))}
                      placeholder="Enter version title"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-version-name" className="text-sm font-medium">
                      Version Name/Label
                    </Label>
                    <Input
                      id="edit-version-name"
                      value={versionEditForm.version_name}
                      onChange={(e) => setVersionEditForm(prev => ({
                        ...prev,
                        version_name: e.target.value
                      }))}
                      placeholder="e.g., 'First Draft', 'Final Version', 'Director Notes'"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will be displayed prominently as the main version identifier
                    </p>
                  </div>

                  {editingAsset.content_type === 'script' && (
                    <>
                      <div>
                        <Label htmlFor="edit-content" className="text-sm font-medium">
                          Script Content
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          💡 <strong>Pro tip:</strong> Select text to use AI editing features
                        </p>
                        <textarea
                          id="edit-content"
                          value={versionEditForm.content}
                          onChange={(e) => setVersionEditForm(prev => ({
                            ...prev,
                            content: e.target.value
                          }))}
                          placeholder="Edit your script content here..."
                          className="mt-1 w-full h-64 p-3 border border-border rounded-md bg-background text-foreground resize-none font-mono text-sm"
                          onSelect={(e) => {
                            e.stopPropagation()
                            const selectedText = e.currentTarget.value.substring(
                              e.currentTarget.selectionStart,
                              e.currentTarget.selectionEnd
                            )
                            if (selectedText) {
                              setVersionEditForm(prev => ({
                                ...prev,
                                selection: selectedText
                              }))
                            }
                          }}
                        />
                        {versionEditForm.selection && (
                          <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                            <p className="text-xs text-blue-400 mb-2">
                              Selected: {versionEditForm.selection.length} characters
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-500/30 text-blue-500 bg-transparent mr-2"
                              onClick={() => {
                                navigator.clipboard.writeText(versionEditForm.selection || '')
                                toast({
                                  title: "Text Copied",
                                  description: "Selected text copied to clipboard",
                                })
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy Selected
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-purple-500/30 text-purple-500 bg-transparent"
                              onClick={() => {
                                handleAITextEdit(
                                  versionEditForm.selection || '',
                                  versionEditForm.content,
                                  editingAsset.id
                                )
                              }}
                            >
                              <Bot className="h-3 w-3 mr-1" />
                              AI Edit Selected
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowVersionEdit(false)
                  setEditingAsset(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveVersionEdit}
                disabled={!versionEditForm.title.trim() || !versionEditForm.version_name.trim()}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save New Version
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Text to Speech Dialog */}
        <Dialog open={showTTSDialog} onOpenChange={setShowTTSDialog}>
          <DialogContent className="bg-background border-primary/20 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-primary text-xl">Text to Speech</DialogTitle>
              <DialogDescription>
                {ttsAsset && `Generate speech for: ${ttsAsset.title}`}
              </DialogDescription>
            </DialogHeader>
            {ttsAsset && ttsAsset.content && (
              <div className="py-4">
                <TextToSpeech 
                  text={ttsAsset.content}
                  title={ttsAsset.title}
                  projectId={ttsAsset.project_id || ''}
                  sceneId={ttsAsset.scene_id || undefined}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTTSDialog(false)
                  setTtsAsset(null)
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Text Editor */}
        {showAITextEditor && aiEditData && (
          <AITextEditor
            isOpen={showAITextEditor}
            onClose={() => {
              setShowAITextEditor(false)
              setAiEditData(null)
            }}
            selectedText={aiEditData.selectedText}
            fullContent={aiEditData.fullContent}
            sceneContext={selectedProject ? `Project: ${projects.find(p => p.id === selectedProject)?.name || 'Unknown'}` : ''}
            onTextReplace={handleAITextReplace}
            contentType="script"
          />
        )}
      </div>
    </div>
  )
}

// Asset Card Component
function AssetCard({ 
  asset, 
  onView, 
  onCopy,
  onDelete,
  onEdit,
  onOpenTTS
}: { 
  asset: Asset, 
  onView: (asset: Asset) => void, 
  onCopy: (content: string) => void,
  onDelete: (asset: Asset) => void,
  onEdit: (asset: Asset) => void,
  onOpenTTS: (asset: Asset) => void
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
    <Card className="bg-card border-primary/20 hover:border-primary/40 transition-colors overflow-hidden">
      <CardHeader className="pb-3">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-primary text-lg line-clamp-2 break-words">{asset.title}</CardTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
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
            <div className="text-right text-xs text-muted-foreground flex-shrink-0 ml-2">
              {new Date(asset.created_at).toLocaleDateString()}
            </div>
          </div>
          
          {/* Text to Speech - Compact Header Version */}
          {asset.content_type === 'script' && asset.content && (
            <div className="bg-muted/10 rounded-lg p-2" data-tts-asset={asset.id}>
              <TextToSpeech 
                text={asset.content}
                title={asset.title}
                projectId={asset.project_id || ''}
                sceneId={asset.scene_id || undefined}
              />
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 overflow-hidden">
        {/* Content Preview */}
        {asset.content_type === 'script' && asset.content && (
          <div className="bg-muted/20 rounded-lg p-4 max-h-96 overflow-y-auto border border-border/30">
            <pre className="text-sm text-foreground font-mono whitespace-pre-wrap break-words leading-relaxed">
              {asset.content}
            </pre>
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
        <div className="space-y-2 text-sm overflow-hidden">
          {asset.prompt && (
            <div className="overflow-hidden">
              <span className="text-muted-foreground">Prompt:</span>
              <p className="text-foreground line-clamp-2 break-words overflow-hidden">{asset.prompt}</p>
            </div>
          )}
          {asset.model && (
            <div className="overflow-hidden">
              <span className="text-muted-foreground">Model:</span>
              <span className="text-foreground ml-1 break-words">{asset.model}</span>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            size="sm" 
            variant="outline" 
            className="border-primary/30 text-primary bg-transparent flex-1 min-w-[80px]"
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
                className="border-green-500/30 text-green-500 bg-transparent"
                onClick={() => onEdit(asset)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                className="border-purple-500/30 text-purple-400 bg-transparent"
                onClick={() => onOpenTTS(asset)}
              >
                <Volume2 className="h-4 w-4 mr-2" />
                TTS
              </Button>
            </>
          )}
          
          <Button 
            size="sm" 
            variant="outline" 
            className="border-red-500/30 text-red-500 bg-transparent hover:bg-red-500/10"
            onClick={() => onDelete(asset)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
