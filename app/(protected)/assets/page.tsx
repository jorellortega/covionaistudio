"use client"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  Save,
  Bot,
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

  // Script editing states
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null)
  const [editingScriptContent, setEditingScriptContent] = useState("")
  const [editingScriptTitle, setEditingScriptTitle] = useState("")
  const [showAITextEditor, setShowAITextEditor] = useState(false)
  const [aiEditData, setAiEditData] = useState<{
    selectedText: string;
    fullContent: string;
    assetId: string;
    field: 'content';
  } | null>(null)


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
          // First check if it's in owned projects
          let project = fetchedProjects.find(p => p.id === projectId)
          
          // If not found in owned projects, check if user has shared access
          if (!project) {
            console.log('🎯 Project not in owned list, checking for shared access...')
            const sharedProject = await MovieService.getMovieById(projectId)
            if (sharedProject) {
              project = sharedProject
              // Add shared project to the list so it shows in the selector
              setProjects(prev => {
                if (!prev.find(p => p.id === projectId)) {
                  return [...prev, sharedProject]
                }
                return prev
              })
              console.log('✅ Found shared project:', sharedProject.id, sharedProject.name)
            }
          }
          
          if (project) {
            setSelectedProject(project.id)
            console.log('✅ Set selected project to:', project.id, project.name)
          } else {
            console.log('❌ No project found with ID:', projectId)
            toast({
              title: "Access Denied",
              description: "You don't have access to this project.",
              variant: "destructive",
            })
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
    const type = asset.content_type?.toLowerCase?.() || ''
    const matchesSearch = asset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.content?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = contentTypeFilter === "all" || type === contentTypeFilter
    
    return matchesSearch && matchesType
  })

  // Group assets by content type
  const assetsByType = {
    script: filteredAssets.filter(a => a.content_type?.toLowerCase?.() === 'script') || [],
    image: filteredAssets.filter(a => a.content_type?.toLowerCase?.() === 'image') || [],
    video: filteredAssets.filter(a => a.content_type?.toLowerCase?.() === 'video') || [],
    audio: filteredAssets.filter(a => a.content_type?.toLowerCase?.() === 'audio') || [],
  }

  const refreshAssets = async (options?: { showToast?: boolean }) => {
    if (!selectedProject) return
    
    try {
      setLoading(true)
      const fetchedAssets = await AssetService.getAssetsForProject(selectedProject)
      setAssets(fetchedAssets)
      if (options?.showToast !== false) {
        toast({
          title: "Assets Refreshed",
          description: "Project assets have been updated.",
        })
      }
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

  // Script editing handlers
  const startEditingScript = (script: Asset) => {
    setEditingScriptId(script.id)
    setEditingScriptContent(script.content || "")
    setEditingScriptTitle(script.title)
  }

  const cancelEditingScript = () => {
    setEditingScriptId(null)
    setEditingScriptContent("")
    setEditingScriptTitle("")
  }

  const saveScriptChanges = async () => {
    if (!editingScriptId) return
    
    try {
      setLoading(true)
      const script = assets.find(a => a.id === editingScriptId)
      if (!script) return

      await AssetService.updateAsset(editingScriptId, {
        title: editingScriptTitle,
        content: editingScriptContent,
        metadata: {
          ...script.metadata,
          last_edited: new Date().toISOString()
        }
      })

      // Refresh assets
      await refreshAssets()

      toast({
        title: "Script Updated!",
        description: "Your script changes have been saved.",
      })

      cancelEditingScript()
    } catch (error) {
      console.error('Error saving script:', error)
      toast({
        title: "Error",
        description: "Failed to save script changes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const saveScriptAsNewVersion = async () => {
    if (!editingScriptId || !selectedProject) return
    
    try {
      setLoading(true)
      const script = assets.find(a => a.id === editingScriptId)
      if (!script) return

      // Create new version
      const newAsset = await AssetService.createAsset({
        project_id: selectedProject,
        scene_id: script.scene_id,
        title: editingScriptTitle,
        content_type: 'script',
        content: editingScriptContent,
        version_name: `Edited version of ${script.title}`,
        metadata: {
          ...script.metadata,
          parent_asset_id: editingScriptId,
          last_edited: new Date().toISOString()
        }
      })

      // Refresh assets
      await refreshAssets()

      toast({
        title: "New Version Created!",
        description: "A new version of your script has been created.",
      })

      cancelEditingScript()
    } catch (error) {
      console.error('Error creating new version:', error)
      toast({
        title: "Error",
        description: "Failed to create new version. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // AI text editing handlers
  const handleAITextEdit = (script: Asset, selectedText: string) => {
    setAiEditData({
      selectedText,
      fullContent: script.content || "",
      assetId: script.id,
      field: 'content'
    })
    setShowAITextEditor(true)
  }

  const handleAITextReplace = (newText: string) => {
    if (!aiEditData) return
    
    // Replace the selected text in the editing content
    const script = assets.find(a => a.id === aiEditData.assetId)
    if (!script) return

    const fullContent = script.content || ""
    const selectedText = aiEditData.selectedText
    const startIndex = fullContent.indexOf(selectedText)
    
    if (startIndex !== -1) {
      const newContent = fullContent.substring(0, startIndex) + newText + fullContent.substring(startIndex + selectedText.length)
      setEditingScriptContent(newContent)
      setEditingScriptId(aiEditData.assetId)
      setEditingScriptTitle(script.title)
    }

    setAiEditData(null)
    setShowAITextEditor(false)
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
    const normalizedType = type?.toLowerCase?.() || ''
    switch (normalizedType) {
      case 'script': return <FileText className="h-4 w-4" />
      case 'image': return <ImageIcon className="h-4 w-4" />
      case 'video': return <Play className="h-4 w-4" />
      case 'audio': return <MessageSquare className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getContentTypeColor = (type: string) => {
    const normalizedType = type?.toLowerCase?.() || ''
    switch (normalizedType) {
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Switch to import tab first
                setActiveTab("import")
                // Then trigger the FileImport component's file input
                setTimeout(() => {
                  // Find the FileImport component's file input and trigger it
                  const fileImportInput = document.querySelector('[data-file-import-input]') as HTMLInputElement
                  if (fileImportInput) {
                    fileImportInput.click()
                  }
                }, 200)
              }}
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 bg-transparent"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Files
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
            <TabsTrigger value="import" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Upload className="h-4 w-4 mr-2" />
              Import Files
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
                    onAudioSaved={() => refreshAssets({ showToast: false })}
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

          {/* Scripts Tab - With Editing Support */}
          <TabsContent value="scripts" className="space-y-6">
            {loading ? (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading scripts...</p>
                </CardContent>
              </Card>
            ) : assetsByType.script.length > 0 ? (
              <div className="space-y-6">
                {assetsByType.script.map((script) => (
                  <Card key={script.id} className="bg-card border-primary/20">
                    {editingScriptId === script.id ? (
                      <CardContent className="p-6 space-y-4">
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                          <p className="text-blue-400 font-medium flex items-center gap-2">
                            <Edit3 className="h-4 w-4" />
                            Editing Mode - Make your changes below
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Title</label>
                          <Input
                            value={editingScriptTitle}
                            onChange={(e) => setEditingScriptTitle(e.target.value)}
                            className="bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Content</label>
                          <Textarea
                            value={editingScriptContent}
                            onChange={(e) => setEditingScriptContent(e.target.value)}
                            className="bg-background font-mono min-h-[300px]"
                            placeholder="Edit your script content here..."
                          />
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-border">
                          <Button
                            onClick={saveScriptChanges}
                            disabled={loading}
                            className="bg-green-500 hover:bg-green-600"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button
                            onClick={saveScriptAsNewVersion}
                            disabled={loading}
                            variant="outline"
                            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Save as New Version
                          </Button>
                          <Button
                            onClick={cancelEditingScript}
                            variant="outline"
                            disabled={loading}
                          >
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    ) : (
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-bold text-primary">{script.title}</h3>
                              <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                                v{script.version}
                              </Badge>
                              {script.is_latest_version && (
                                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                  Latest
                                </Badge>
                              )}
                            </div>
                            <div className="bg-muted/20 rounded-lg p-4 max-h-96 overflow-y-auto mb-4">
                              <div className="text-sm text-foreground font-mono break-words select-text" style={{ lineHeight: '1.6' }}>
                                {script.content.split('\n').map((line, idx) => {
                                  // Highlight and style page markers
                                  const pageMatch = line.trim().match(/^---\s*PAGE\s+(\d+)\s*---$/i)
                                  if (pageMatch) {
                                    const pageNum = pageMatch[1]
                                    return (
                                      <div key={idx} className="my-6 py-3 border-t-2 border-b-2 border-primary/50 bg-primary/10 rounded-lg">
                                        <div className="text-center">
                                          <span className="font-bold text-primary text-base px-4 py-2 bg-primary/20 rounded">
                                            PAGE {pageNum}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  }
                                  // Regular text lines - preserve empty lines
                                  if (line.trim() === '') {
                                    return <div key={idx} className="h-3"></div>
                                  }
                                  return <div key={idx}>{line}</div>
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-4 border-t border-border">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditingScript(script)}
                            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Script
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (script.content) {
                                // Try to get selected text, otherwise use the whole content
                                const selection = window.getSelection()?.toString() || ""
                                const textToEdit = selection || script.content
                                handleAITextEdit(script, textToEdit)
                              }
                            }}
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                          >
                            <Bot className="h-4 w-4 mr-2" />
                            AI Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewAsset(script)}
                            className="border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyScript(script.content || "")}
                            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteAsset(script)}
                            className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No scripts found for this project</p>
                  <Link href="/ai-studio">
                    <Button className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90">
                      <Plus className="h-4 w-4 mr-2" />
                      Generate Script
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Other Type Tabs */}
          {['images', 'videos', 'audio'].map((type) => (
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
                      onAudioSaved={() => refreshAssets({ showToast: false })}
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

          {/* Import Files Tab */}
          <TabsContent value="import" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-primary">Import Documents</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Import PDF, Word, and text files into your project as assets
                </p>
              </div>
            </div>

            {selectedProject ? (
              <FileImport
                projectId={selectedProject}
                sceneId={null}
                onFileImported={(assetId) => {
                  // Refresh assets after import
                  refreshAssets()
                  toast({
                    title: "File Imported",
                    description: "Your file has been imported and saved as a project asset!",
                  })
                }}
              />
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Please select a project to import files</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
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
                <div className="flex items-center justify-between pb-4 border-b border-border/30">
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
                    
                    {/* Text to Speech Component */}
                    <div className="bg-muted/20 rounded-xl p-8" data-tts-asset={selectedAsset.id}>
                      <h3 className="text-xl font-semibold mb-6 text-foreground">Text to Speech</h3>
                      <TextToSpeech 
                        text={selectedAsset.content}
                        title={selectedAsset.title}
                        projectId={selectedAsset.project_id}
                        sceneId={selectedAsset.scene_id as string | undefined}
                        className="mt-6"
                        onAudioSaved={() => refreshAssets({ showToast: false })}
                      />
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

        {/* AI Text Editor Dialog */}
        {showAITextEditor && aiEditData && (
          <AITextEditor
            isOpen={showAITextEditor}
            onClose={() => {
              setShowAITextEditor(false)
              setAiEditData(null)
            }}
            selectedText={aiEditData.selectedText}
            fullContent={aiEditData.fullContent}
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
  onAudioSaved
}: { 
  asset: Asset, 
  onView: (asset: Asset) => void, 
  onCopy: (content: string) => void,
  onDelete: (asset: Asset) => void,
  onAudioSaved?: () => void
}) {
  const getContentTypeIcon = (type: string) => {
    const normalizedType = type?.toLowerCase?.() || ''
    switch (normalizedType) {
      case 'script': return <FileText className="h-4 w-4" />
      case 'image': return <ImageIcon className="h-4 w-4" />
      case 'video': return <Play className="h-4 w-4" />
      case 'audio': return <MessageSquare className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getContentTypeColor = (type: string) => {
    const normalizedType = type?.toLowerCase?.() || ''
    switch (normalizedType) {
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
                sceneId={asset.scene_id as string | undefined}
                className="mt-2"
                onAudioSaved={onAudioSaved}
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
