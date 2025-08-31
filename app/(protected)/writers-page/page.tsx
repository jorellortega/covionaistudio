"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft,
  Edit3,
  FileText,
  MessageSquare,
  Save,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  GitCompare,
  Edit,
  Copy,
  Bot,
  Upload,
  Volume2,
  BookOpen,
  Music,
  PenTool,
  Sparkles,
  Settings,
  FolderOpen,
  Clock,
  Calendar,
  User,
  Star,
  Zap
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuthReady } from "@/components/auth-hooks"
import { useRouter } from "next/navigation"
import FileImport from "@/components/file-import"
import TextToSpeech from "@/components/text-to-speech"
import AITextEditor from "@/components/ai-text-editor"
import { Navigation } from "@/components/navigation"
import { AssetService, type Asset } from "@/lib/asset-service"
import { LyricsService, type Lyrics } from "@/lib/lyrics-service"
import { OpenAIService } from "@/lib/openai-service"
import { getSupabaseClient } from '@/lib/supabase'

export default function WritersPage() {
  return <WritersPageClient />
}

function WritersPageClient() {
  const { toast } = useToast()
  const { user, userId, ready } = useAuthReady()
  const router = useRouter()

  // State variables
  const [activeTab, setActiveTab] = useState("scripts")
  const [activeContentType, setActiveContentType] = useState<'script' | 'lyrics' | 'poetry' | 'prose'>('script')
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [showMediaUpload, setShowMediaUpload] = useState(false)
  const [loading, setLoading] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [showVersionCompare, setShowVersionCompare] = useState(false)
  const [compareVersions, setCompareVersions] = useState<Asset[]>([])
  const [showVersionEdit, setShowVersionEdit] = useState(false)
  const [editingVersion, setEditingVersion] = useState<Asset | null>(null)
  const [showAIImageDialog, setShowAIImageDialog] = useState(false)
  const [selectedScriptForAI, setSelectedScriptForAI] = useState<string>('')
  const [aiImageLoading, setAiImageLoading] = useState(false)
  
  // Enhanced text editing states
  const [inlineEditing, setInlineEditing] = useState<{
    assetId: string;
    field: 'title' | 'content' | 'version_name';
    value: string;
    selection?: string;
  } | null>(null)
  const [savingStatus, setSavingStatus] = useState<{
    assetId: string;
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string;
  } | null>(null)

  // AI text editing states
  const [showAITextEditor, setShowAITextEditor] = useState(false)
  const [aiEditData, setAiEditData] = useState<{
    selectedText: string;
    fullContent: string;
    assetId: string;
    field: 'content';
  } | null>(null)

  const [selectedVersions, setSelectedVersions] = useState<Record<string, Asset>>({})
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string>("")
  
  // API key management
  const [userApiKeys, setUserApiKeys] = useState<{
    openai_api_key?: string
    anthropic_api_key?: string
  }>({})

  // New content creation form
  const [newContentForm, setNewContentForm] = useState({
    title: '',
    content: '',
    contentType: 'script' as 'script' | 'lyrics' | 'poetry' | 'prose',
    versionName: 'Draft',
    tags: '',
    description: '',
    genre: '',
    mood: ''
  })

  // Effect to fetch user's writing content
  useEffect(() => {
    if (!ready || !userId) return
    
    let mounted = true
    
    const fetchWritingContent = async () => {
      try {
        setAssetsLoading(true)
        
        // Fetch lyrics from lyrics table
        const { data: userLyrics, error: lyricsError } = await getSupabaseClient()
          .from('lyrics')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        
        if (lyricsError) {
          console.error('Error fetching lyrics:', lyricsError)
        }
        
        // Fetch other writing content from assets table
        const { data: userAssets, error: assetsError } = await getSupabaseClient()
          .from('assets')
          .select('*')
          .eq('user_id', userId)
          .in('content_type', ['script', 'poetry', 'prose'])
          .order('created_at', { ascending: false })
        
        if (assetsError) {
          console.error('Error fetching writing assets:', assetsError)
        }
        
        // Combine lyrics and assets, converting lyrics to asset format for compatibility
        const lyricsAsAssets = (userLyrics || []).map(lyric => ({
          id: lyric.id,
          user_id: lyric.user_id,
          project_id: lyric.movie_id,
          scene_id: lyric.scene_id,
          title: lyric.title,
          content_type: 'lyrics' as const,
          content: lyric.content,
          content_url: null,
          version: lyric.version,
          version_name: lyric.version_name,
          is_latest_version: lyric.is_latest_version,
          parent_asset_id: lyric.parent_lyrics_id,
          prompt: lyric.description,
          model: 'manual',
          generation_settings: {},
          metadata: {
            genre: lyric.genre,
            mood: lyric.mood,
            language: lyric.genre,
            tags: lyric.tags,
            description: lyric.description,
            created_in_writers_page: true,
            content_category: 'lyrics'
          },
          created_at: lyric.created_at,
          updated_at: lyric.updated_at
        }))
        
        if (mounted) {
          setAssets([...lyricsAsAssets, ...(userAssets || [])])
        }
        
      } catch (error) {
        console.error('Error fetching writing content:', error)
      } finally {
        if (mounted) {
          setAssetsLoading(false)
        }
      }
    }

    fetchWritingContent()
    
    // Also fetch user API keys
    const fetchUserApiKeys = async () => {
      try {
        const { data, error } = await getSupabaseClient()
          .from('users')
          .select('openai_api_key, anthropic_api_key')
          .eq('id', userId)
          .single()

        if (error) throw error
        setUserApiKeys(data || {})
      } catch (error) {
        console.error('Error fetching user API keys:', error)
      }
    }

    fetchUserApiKeys()
    
    return () => {
      mounted = false
    }
  }, [ready, userId])

  // Effect to set initial active script
  useEffect(() => {
    const scriptAssets = assets.filter(a => a.content_type === activeContentType)
    if (scriptAssets.length > 0 && !activeScriptId) {
      // Set the latest version as the initial active script
      const latestScript = scriptAssets.find(a => a.is_latest_version) || scriptAssets[0]
      setActiveScriptId(latestScript.id)
    }
  }, [assets, activeContentType, activeScriptId])

  // Function to refresh assets
  const refreshAssets = async () => {
    try {
      setAssetsLoading(true)
      
      // Fetch lyrics from lyrics table
      const { data: userLyrics, error: lyricsError } = await getSupabaseClient()
        .from('lyrics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (lyricsError) {
        console.error('Error fetching lyrics:', lyricsError)
      }
      
      // Fetch other writing content from assets table
      const { data: userAssets, error: assetsError } = await getSupabaseClient()
        .from('assets')
        .select('*')
        .eq('user_id', userId)
        .in('content_type', ['script', 'poetry', 'prose'])
        .order('created_at', { ascending: false })
      
      if (assetsError) {
        console.error('Error refreshing assets:', assetsError)
      }
      
      // Combine lyrics and assets, converting lyrics to asset format for compatibility
      const lyricsAsAssets = (userLyrics || []).map(lyric => ({
        id: lyric.id,
        user_id: lyric.user_id,
        project_id: lyric.movie_id,
        scene_id: lyric.scene_id,
        title: lyric.title,
        content_type: 'lyrics' as const,
        content: lyric.content,
        content_url: null,
        version: lyric.version,
        version_name: lyric.version_name,
        is_latest_version: lyric.is_latest_version,
        parent_asset_id: lyric.parent_lyrics_id,
        prompt: lyric.description,
        model: 'manual',
        generation_settings: {},
        metadata: {
          genre: lyric.genre,
          mood: lyric.mood,
          language: lyric.language,
          tags: lyric.tags,
          description: lyric.description,
          created_in_writers_page: true,
          content_category: 'lyrics'
        },
        created_at: lyric.created_at,
        updated_at: lyric.updated_at
      }))
      
      setAssets([...lyricsAsAssets, ...(userAssets || [])])
    } catch (error) {
      console.error('Error refreshing assets:', error)
    } finally {
      setAssetsLoading(false)
    }
  }

  // Enhanced inline text editing functions
  const startInlineEditing = (assetId: string, field: 'title' | 'content' | 'version_name', currentValue: string) => {
    setInlineEditing({
      assetId,
      field,
      value: currentValue
    })
  }

  const cancelInlineEditing = () => {
    setInlineEditing(null)
    setSavingStatus(null)
  }

  const handleInlineEditChange = (value: string) => {
    if (!inlineEditing) return
    
    setInlineEditing(prev => prev ? { ...prev, value } : null)
  }

  // Enhanced text selection handler
  const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    e.preventDefault()
    
    const target = e.target as HTMLTextAreaElement
    let selection = ''
    
    // Get selected text
    selection = target.value.substring(target.selectionStart, target.selectionEnd)
    
    if (selection.length > 0) {
      // Store selection for context menu actions
      setInlineEditing(prev => prev ? { ...prev, selection } : null)
    } else {
      // Clear selection
      setInlineEditing(prev => prev ? { ...prev, selection: undefined } : null)
    }
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
    if (!aiEditData || !inlineEditing) return
    
    // Replace the selected text with the new AI-generated text
    const target = document.querySelector('textarea') as HTMLTextAreaElement
    if (target) {
      const start = target.selectionStart
      const end = target.selectionEnd
      const currentValue = target.value
      const newValue = currentValue.substring(0, start) + newText + currentValue.substring(end)
      
      // Update the inline editing value
      handleInlineEditChange(newValue)
      
      // Clear the AI edit data
      setAiEditData(null)
      setShowAITextEditor(false)
    }
  }

  // AI text generation function using OpenAIService directly
  const generateAIText = async (prompt: string, selectedText: string, service: 'openai' | 'anthropic') => {
    if (!userApiKeys[service === 'openai' ? 'openai_api_key' : 'anthropic_api_key']) {
      toast({
        title: "API Key Required",
        description: `Please configure your ${service === 'openai' ? 'OpenAI' : 'Anthropic'} API key in your profile.`,
        variant: "destructive",
      })
      return null
    }

    try {
      setAiTextLoading(true)
      
      if (service === 'openai') {
        const response = await OpenAIService.generateScript({
          prompt: `${prompt}\n\nSelected text: "${selectedText}"`,
          template: "You are a professional writer. Improve and enhance the selected text based on the user's request.",
          apiKey: userApiKeys.openai_api_key!
        })

        if (response.success && response.data?.choices?.[0]?.message?.content) {
          return response.data.choices[0].message.content
        } else {
          throw new Error(response.error || 'Failed to generate text')
        }
      } else {
        // For now, just return an error for Anthropic since we need to implement it
        throw new Error('Anthropic service not yet implemented')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate text'
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      })
      return null
    } finally {
      setAiTextLoading(false)
    }
  }

  // Save inline edit
  const saveInlineEdit = async () => {
    if (!inlineEditing) return
    
    const { assetId, field, value } = inlineEditing
    const asset = assets.find(a => a.id === assetId)
    
    if (!asset) return
    
    try {
      setSavingStatus({ assetId, status: 'saving' })
      
      // Create a new version with the edited content
      const newAssetData = {
        project_id: asset.project_id || null,
        scene_id: asset.scene_id || null,
        title: field === 'title' ? value : asset.title,
        content_type: asset.content_type,
        content: field === 'content' ? value : asset.content,
        content_url: asset.content_url,
        prompt: asset.prompt,
        model: asset.model,
        version_name: field === 'version_name' ? value : `${asset.version_name || `Version ${asset.version}`} (Edited)`,
        generation_settings: asset.generation_settings,
        metadata: {
          ...asset.metadata,
          edited_from_version: asset.version,
          edited_at: new Date().toISOString(),
          edited_field: field,
          original_value: field === 'title' ? asset.title : 
                         field === 'version_name' ? asset.version_name : 
                         asset.content
        }
      }
      
      // Save as new version
      await AssetService.createAsset(newAssetData)
      
      // Refresh assets
      refreshAssets()
      
      // Show success status
      setSavingStatus({ assetId, status: 'saved', message: 'Changes saved!' })
      
      // Clear inline editing
      setInlineEditing(null)
      
      // Clear success status after 3 seconds
      setTimeout(() => {
        setSavingStatus(null)
      }, 3000)
      
      toast({
        title: "Changes Saved!",
        description: `New version created with your edits.`,
      })
      
    } catch (error) {
      console.error('Error saving inline edit:', error)
      setSavingStatus({ 
        assetId, 
        status: 'error', 
        message: 'Failed to save changes' 
      })
      
      toast({
        title: "Save Failed",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      })
    }
  }

  const saveInlineEditImmediately = () => {
    saveInlineEdit()
  }

  // Create new content
  const createNewContent = async () => {
    if (!newContentForm.title.trim() || !newContentForm.content.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and content.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      
      if (newContentForm.contentType === 'lyrics') {
        // Use LyricsService for lyrics
        const lyricsData = {
          title: newContentForm.title,
          content: newContentForm.content,
          version_name: newContentForm.versionName,
          genre: newContentForm.genre || undefined,
          mood: newContentForm.mood || undefined,
          tags: newContentForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          description: newContentForm.description
        }
        
        await LyricsService.createLyrics(lyricsData)
      } else {
        // Use AssetService for other content types
        const newAssetData = {
          project_id: null, // Standalone content - no project association
          scene_id: null,   // No scene association for standalone writing
          title: newContentForm.title,
          content_type: newContentForm.contentType,
          content: newContentForm.content,
          content_url: null,
          prompt: newContentForm.description,
          model: 'manual',
          version_name: newContentForm.versionName,
          generation_settings: {},
          metadata: {
            tags: newContentForm.tags.split(',').map(t => t.trim()).filter(Boolean),
            description: newContentForm.description,
            created_in_writers_page: true,
            content_category: newContentForm.contentType
          }
        }
        
        await AssetService.createAsset(newAssetData)
      }
      
      // Reset form and refresh assets
      setNewContentForm({
        title: '',
        content: '',
        contentType: 'script',
        versionName: 'Draft',
        tags: '',
        description: '',
        genre: '',
        mood: ''
      })
      setIsCreatingNew(false)
      refreshAssets()
      
      toast({
        title: "Content Created!",
        description: `Your ${newContentForm.contentType} has been saved.`,
      })
      
    } catch (error) {
      console.error('Error creating content:', error)
      toast({
        title: "Creation Failed",
        description: "Failed to create your content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Helper function to get clean version name for display
  const getCleanVersionName = (script: any) => {
    if (script.version_name && script.version_name.trim()) {
      const isJustNumber = /^\d+$/.test(script.version_name.trim())
      if (!isJustNumber) {
        return script.version_name
      }
    }
    
    if (script.version !== undefined && script.version !== null) {
      return `Version ${script.version}`
    }
    
    return 'Version 1'
  }

  // Simple loading state
  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-lg">Loading writers workspace...</span>
          </div>
        </div>
      </div>
    )
  }

  // Group assets by content type
  const assetsByType = {
    script: assets.filter(a => a.content_type === 'script'),
    lyrics: assets.filter(a => a.content_type === 'lyrics'),
    poetry: assets.filter(a => a.content_type === 'poetry'),
    prose: assets.filter(a => a.content_type === 'prose'),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Bar */}
      <div className="border-b border-border/40 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <Navigation />
        </div>
      </div>
      
      <div className="p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-primary">
                  Writers Workspace
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
                  Create, edit, and manage your scripts, lyrics, poetry, and prose
                </p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingNew(true)}
                className="border-green-500/30 text-green-400 hover:bg-green-500/10 bg-transparent"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Content
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMediaUpload(true)}
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 bg-transparent"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Files
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90"
                onClick={() => router.push('/ai-studio')}
              >
                <Bot className="h-4 w-4 mr-2" />
                AI Studio
              </Button>
            </div>
          </div>

          {/* Content Type Selector */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {(['script', 'lyrics', 'poetry', 'prose'] as const).map((type) => (
                <Button
                  key={type}
                  variant={activeContentType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveContentType(type)}
                  className={activeContentType === type ? 
                    "bg-primary text-primary-foreground" : 
                    "border-primary/30 text-primary hover:bg-primary/10"
                  }
                >
                  {type === 'script' && <FileText className="h-4 w-4 mr-2" />}
                  {type === 'lyrics' && <Music className="h-4 w-4 mr-2" />}
                  {type === 'poetry' && <PenTool className="h-4 w-4 mr-2" />}
                  {type === 'prose' && <BookOpen className="h-4 w-4 mr-2" />}
                  {type.charAt(0).toUpperCase() + type.slice(1)}s ({assetsByType[type].length})
                </Button>
              ))}
            </div>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className="bg-card border-primary/20 flex-wrap">
              <TabsTrigger
                value="scripts"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              >
                <FileText className="h-4 w-4 mr-2" />
                Content ({assetsByType[activeContentType].length})
              </TabsTrigger>
              <TabsTrigger 
                value="import" 
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Files
              </TabsTrigger>
            </TabsList>

            {/* Content Tab */}
            <TabsContent value="scripts" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-primary">
                    {activeContentType.charAt(0).toUpperCase() + activeContentType.slice(1)}s
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Read content aloud • Toggle between versions • Generate new content with AI
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                    onClick={() => router.push('/ai-studio')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generate with AI
                  </Button>
                </div>
              </div>

              {assetsByType[activeContentType].length > 0 ? (
                <div className="space-y-4">
                  {/* Version Tabs */}
                  <div className="border-b border-green-400/30 mb-4">
                    <div className="flex flex-wrap gap-1">
                      {assetsByType[activeContentType].map((script) => (
                        <div key={script.id} className="relative group">
                          {inlineEditing?.assetId === script.id && inlineEditing.field === 'version_name' ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={inlineEditing.value}
                                onChange={(e) => handleInlineEditChange(e.target.value)}
                                className="px-3 py-2 text-sm font-medium bg-background border-green-400/30 focus:border-green-400 min-w-[120px]"
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={saveInlineEditImmediately}
                                  className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelInlineEditing}
                                  className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => setActiveScriptId(script.id)}
                              className={`px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 cursor-pointer ${
                                activeScriptId === script.id
                                  ? 'text-green-400 border-green-400 bg-green-500/10'
                                  : 'text-green-400/60 border-transparent hover:text-green-400 hover:border-green-400/40'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{getCleanVersionName(script)}</span>
                                {script.is_latest_version && (
                                  <span className="text-xs text-green-300">★</span>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startInlineEditing(script.id, 'version_name', getCleanVersionName(script))
                                  }}
                                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity p-0 hover:bg-green-500/10"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Content Display */}
                  <Card className="bg-card border-primary/20">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                            <h4 className="text-xl font-bold text-primary">{(() => {
                              const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                              
                              if (inlineEditing?.assetId === activeScript.id && inlineEditing.field === 'title') {
                                return (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={inlineEditing.value}
                                      onChange={(e) => handleInlineEditChange(e.target.value)}
                                      className="text-xl font-bold text-primary bg-background border-primary/30 focus:border-primary"
                                      autoFocus
                                    />
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={saveInlineEditImmediately}
                                        className="h-6 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                      >
                                        <Save className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={cancelInlineEditing}
                                        className="h-6 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  </div>
                                )
                              }
                              
                              return (
                                <div className="flex items-center gap-2 group">
                                  <span>{activeScript.title}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startInlineEditing(activeScript.id, 'title', activeScript.title)}
                                    className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                              )
                            })()}</h4>
                            <Badge 
                              variant="outline" 
                              className="text-lg px-3 py-1 border-green-500 text-green-400 bg-green-500/10 cursor-pointer hover:bg-green-500/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                                startInlineEditing(activeScript.id, 'version_name', activeScript.version_name || '')
                              }}
                            >
                              {(() => {
                                const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                                return getCleanVersionName(activeScript)
                              })()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Created {(() => {
                              const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                              return new Date(activeScript.created_at).toLocaleDateString()
                            })()}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {/* Quick Edit Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                            onClick={() => {
                              const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                              startInlineEditing(activeScript.id, 'content', activeScript.content || '')
                            }}
                            disabled={inlineEditing !== null}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Quick Edit
                          </Button>
                          
                          {/* Create New Version Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                            onClick={async () => {
                              const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                              
                              try {
                                setLoading(true)
                                
                                // Create a new version by duplicating the current script
                                const newAssetData = {
                                  project_id: activeScript.project_id,
                                  scene_id: activeScript.scene_id,
                                  title: `${activeScript.title} (Copy)`,
                                  content_type: activeScript.content_type,
                                  content: activeScript.content,
                                  content_url: activeScript.content_url,
                                  prompt: activeScript.prompt,
                                  model: activeScript.model,
                                  version_name: `Version ${(activeScript.version || 0) + 1}`,
                                  generation_settings: activeScript.generation_settings,
                                  metadata: {
                                    ...activeScript.metadata,
                                    duplicated_from_version: activeScript.version,
                                    duplicated_at: new Date().toISOString(),
                                    duplicated_from_asset_id: activeScript.id,
                                    is_duplicate: true
                                  }
                                }
                                
                                // Save as new version
                                await AssetService.createAsset(newAssetData)
                                
                                // Refresh assets
                                refreshAssets()
                                
                                toast({
                                  title: "New Version Created!",
                                  description: `A copy of "${activeScript.title}" has been created as a new version.`,
                                })
                                
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
                            }}
                            disabled={loading}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Create New Version
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/20 p-4 rounded-lg border border-border mb-4">
                        {(() => {
                          const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                          
                          if (inlineEditing?.assetId === activeScript.id && inlineEditing.field === 'content') {
                            return (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium text-muted-foreground">
                                    Editing Content
                                  </Label>
                                  <div className="text-xs text-blue-400">
                                    💡 Select text for copy/clear/paste actions • Click Save when ready
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={saveInlineEditImmediately}
                                      className="h-8 px-3 text-sm border-green-500/30 text-green-400 hover:bg-green-500/10"
                                    >
                                      <Save className="h-4 w-4 mr-1" />
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelInlineEditing}
                                      className="h-8 px-3 text-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                                <Textarea
                                  value={inlineEditing.value}
                                  onChange={(e) => handleInlineEditChange(e.target.value)}
                                  placeholder="Edit your content here..."
                                  className="w-full h-96 p-4 border border-primary/30 focus:border-primary bg-background text-foreground resize-none font-mono text-sm leading-relaxed"
                                  autoFocus
                                  onSelect={handleTextSelection}
                                />
                                
                                {/* Text Selection Actions */}
                                {inlineEditing?.selection && (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
                                      <span className="text-xs text-muted-foreground">
                                        Selected: {inlineEditing.selection.length} characters
                                      </span>
                                      <span className="text-xs text-blue-400">
                                        💡 Use Ctrl/Cmd + Shift + A for quick AI editing
                                      </span>
                                    </div>
                                    
                                    {/* Quick Action Buttons */}
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          navigator.clipboard.writeText(inlineEditing.selection || '')
                                          toast({
                                            title: "Copied!",
                                            description: "Selected text copied to clipboard",
                                          })
                                        }}
                                        className="h-6 px-2 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copy
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          if (inlineEditing?.selection && inlineEditing.assetId) {
                                            const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                                            handleAITextEdit(
                                              inlineEditing.selection,
                                              activeScript.content || '',
                                              inlineEditing.assetId
                                            )
                                          }
                                        }}
                                        className="h-7 px-3 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 bg-purple-500/5"
                                      >
                                        <Bot className="h-3 w-3 mr-1" />
                                        Edit with AI
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          }
                          
                          return (
                            <div className="group relative">
                              <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                                {(() => {
                                  const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                                  return activeScript.content || 'No content available'
                                })()}
                              </pre>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                                  startInlineEditing(activeScript.id, 'content', activeScript.content || '')
                                }}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </div>
                          )
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Text to Speech Card */}
                  <div className="w-full">
                    <TextToSpeech 
                      text={(() => {
                        const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                        return activeScript.content || ''
                      })()}
                      title={(() => {
                        const activeScript = assetsByType[activeContentType].find(s => s.id === activeScriptId) || assetsByType[activeContentType][0]
                        return activeScript.title || 'Content'
                      })()}
                      className="w-full"
                      projectId={projectId}
                      sceneId={null}
                    />
                  </div>
                </div>
              ) : (
                <Card className="bg-card border-orange-500/20">
                  <CardHeader>
                    <CardTitle className="text-orange-500">No Content Yet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      You haven't created any {activeContentType}s yet. Start writing or import existing files to get started.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setIsCreatingNew(true)}
                        className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First {activeContentType.charAt(0).toUpperCase() + activeContentType.slice(1)}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowMediaUpload(true)}
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import Files
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-6">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-primary mb-2">Import Files</h3>
                <p className="text-sm text-muted-foreground">
                  Upload documents, scripts, lyrics, or other text files to add them to your writers workspace.
                </p>
              </div>
              
              <FileImport 
                projectId={projectId || "writers-workspace"}
                sceneId="writers-workspace"
                onFileImported={refreshAssets}
                className="w-full"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* New Content Creation Dialog */}
      <Dialog open={isCreatingNew} onOpenChange={setIsCreatingNew}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create New Content
            </DialogTitle>
            <DialogDescription>
              Start writing your new {activeContentType}. You can always edit and create new versions later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Content Type Selection */}
            <div className="space-y-3">
              <Label>Content Type</Label>
              <div className="flex flex-wrap gap-2">
                {(['script', 'lyrics', 'poetry', 'prose'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={newContentForm.contentType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewContentForm(prev => ({ ...prev, contentType: type }))}
                    className={newContentForm.contentType === type ? 
                      "bg-primary text-primary-foreground" : 
                      "border-primary/30 text-primary hover:bg-primary/10"
                    }
                  >
                    {type === 'script' && <FileText className="h-4 w-4 mr-2" />}
                    {type === 'lyrics' && <Music className="h-4 w-4 mr-2" />}
                    {type === 'poetry' && <PenTool className="h-4 w-4 mr-2" />}
                    {type === 'prose' && <BookOpen className="h-4 w-4 mr-2" />}
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Title Input */}
            <div className="space-y-3">
              <Label>Title</Label>
              <Input
                value={newContentForm.title}
                onChange={(e) => setNewContentForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder={`Enter the title of your ${newContentForm.contentType}...`}
                className="w-full"
              />
            </div>

            {/* Content Input */}
            <div className="space-y-3">
              <Label>Content</Label>
              <Textarea
                value={newContentForm.content}
                onChange={(e) => setNewContentForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder={`Start writing your ${newContentForm.contentType} here...`}
                className="w-full h-64 resize-none font-mono text-sm leading-relaxed"
              />
            </div>

            {/* Version Name */}
            <div className="space-y-3">
              <Label>Version Name</Label>
              <Input
                value={newContentForm.versionName}
                onChange={(e) => setNewContentForm(prev => ({ ...prev, versionName: e.target.value }))}
                placeholder="e.g., Draft, First Version, Initial"
                className="w-full"
              />
            </div>

            {/* Genre and Mood (for lyrics) */}
            {newContentForm.contentType === 'lyrics' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label>Genre</Label>
                    <Input
                      value={newContentForm.genre}
                      onChange={(e) => setNewContentForm(prev => ({ ...prev, genre: e.target.value }))}
                      placeholder="e.g., pop, rock, jazz, hip-hop"
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Mood</Label>
                    <Input
                      value={newContentForm.mood}
                      onChange={(e) => setNewContentForm(prev => ({ ...prev, mood: e.target.value }))}
                      placeholder="e.g., happy, sad, energetic, calm"
                      className="w-full"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Tags */}
            <div className="space-y-3">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={newContentForm.tags}
                onChange={(e) => setNewContentForm(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="e.g., drama, comedy, sci-fi, personal"
                className="w-full"
              />
            </div>

            {/* Description */}
            <div className="space-y-3">
              <Label>Description (optional)</Label>
              <Textarea
                value={newContentForm.description}
                onChange={(e) => setNewContentForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description or notes about this content..."
                className="w-full h-20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCreatingNew(false)}>
              Cancel
            </Button>
            <Button
              onClick={createNewContent}
              disabled={loading || !newContentForm.title.trim() || !newContentForm.content.trim()}
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Content
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Text Editor */}
      <AITextEditor
        isOpen={showAITextEditor}
        onClose={() => setShowAITextEditor(false)}
        selectedText={aiEditData?.selectedText || ''}
        fullContent={aiEditData?.fullContent || ''}
        onTextReplace={handleAITextReplace}
        contentType={activeContentType}
        customGenerateFunction={generateAIText}
      />
    </div>
  )
}
