"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context-fixed'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, FileText, Clock, User, Filter, Calendar, Edit, Trash2, Eye, Sparkles, ImageIcon, Save, Loader2 } from 'lucide-react'
import { TreatmentsService, Treatment, CreateTreatmentData } from '@/lib/treatments-service'
import Header from '@/components/header'
import Link from 'next/link'

export default function TreatmentsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [isLoadingTreatments, setIsLoadingTreatments] = useState(true)
  
  // Edit states
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const [newTreatment, setNewTreatment] = useState({
    title: '',
    genre: '',
    cover_image_url: '',
    synopsis: '',
    target_audience: '',
    estimated_budget: '',
    estimated_duration: ''
  })

  // AI Image Generation States
  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedAIService, setSelectedAIService] = useState('dalle')
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState('')

  // Load treatments on component mount
  useEffect(() => {
    loadTreatments()
  }, [])

  const loadTreatments = async () => {
    try {
      setIsLoadingTreatments(true)
      const data = await TreatmentsService.getTreatments()
      setTreatments(data)
    } catch (error) {
      console.error('Error loading treatments:', error)
      toast({
        title: "Error",
        description: "Failed to load treatments",
        variant: "destructive",
      })
    } finally {
      setIsLoadingTreatments(false)
    }
  }

  const generateAICover = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a prompt to generate a cover image.",
        variant: "destructive",
      })
      return
    }

    // Check if user is loaded
    if (!user) {
      toast({
        title: "User Not Loaded",
        description: "Please wait for user profile to load before generating images.",
        variant: "destructive",
      })
      return
    }

    // Check if user has the required API key
    let apiKey = ''
    switch (selectedAIService) {
      case 'dalle':
        if (!user.openaiApiKey) {
          toast({
            title: "Missing API Key",
            description: "Please configure your OpenAI API key in settings to use DALL-E.",
            variant: "destructive",
          })
          return
        }
        apiKey = user.openaiApiKey
        break
      case 'openart':
        if (!user.openartApiKey) {
          toast({
            title: "Missing API Key",
            description: "Please configure your OpenArt API key in settings to use OpenArt.",
            variant: "destructive",
          })
          return
        }
        apiKey = user.openartApiKey
        break
      case 'leonardo':
        if (!user.leonardoApiKey) {
          toast({
            title: "Missing API Key",
            description: "Please configure your Leonardo AI API key in settings to use Leonardo.",
            variant: "destructive",
          })
          return
        }
        apiKey = user.leonardoApiKey
        break
      default:
        throw new Error('Unsupported AI service')
    }

    try {
      setIsGeneratingCover(true)

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          service: selectedAIService,
          apiKey: apiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const result = await response.json()
      console.log('AI cover generated:', result)

      if (result.success && result.imageUrl) {
        setGeneratedCoverUrl(result.imageUrl)
        setNewTreatment(prev => ({ ...prev, cover_image_url: result.imageUrl }))
        toast({
          title: "Cover Generated",
          description: "AI has generated your treatment cover!",
        })
      } else {
        throw new Error('No image URL received from AI service')
      }
    } catch (error) {
      console.error('Failed to generate AI cover:', error)
      toast({
        title: "Generation Failed",
        description: `Failed to generate cover: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingCover(false)
    }
  }

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setGeneratedCoverUrl(result)
      setNewTreatment(prev => ({ ...prev, cover_image_url: result }))
      toast({
        title: "Image Uploaded",
        description: "Cover image has been uploaded successfully!",
      })
    }
    reader.readAsDataURL(file)
  }

  const resetTreatmentForm = () => {
    setNewTreatment({
      title: '',
      genre: '',
      cover_image_url: '',
      synopsis: '',
      target_audience: '',
      estimated_budget: '',
      estimated_duration: ''
    })
    setAiPrompt('')
    setSelectedAIService('dalle')
    setGeneratedCoverUrl('')
  }

  const handleEditTreatment = (treatment: Treatment) => {
    setEditingTreatment(treatment)
    setNewTreatment({
      title: treatment.title,
      genre: treatment.genre,
      cover_image_url: treatment.cover_image_url || '',
      synopsis: treatment.synopsis,
      target_audience: treatment.target_audience || '',
      estimated_budget: treatment.estimated_budget || '',
      estimated_duration: treatment.estimated_duration || ''
    })
    setGeneratedCoverUrl(treatment.cover_image_url || '')
    setIsEditDialogOpen(true)
  }

  const handleUpdateTreatment = async () => {
    if (!editingTreatment) return
    
    setIsUpdating(true)
    
    try {
      const treatmentData: CreateTreatmentData = {
        title: newTreatment.title,
        genre: newTreatment.genre,
        cover_image_url: newTreatment.cover_image_url || undefined,
        synopsis: newTreatment.synopsis,
        target_audience: newTreatment.target_audience || undefined,
        estimated_budget: newTreatment.estimated_budget || undefined,
        estimated_duration: newTreatment.estimated_duration || undefined,
      }
      
      const updatedTreatment = await TreatmentsService.updateTreatment(editingTreatment.id, treatmentData)
      
      setTreatments(prev => 
        prev.map(t => t.id === editingTreatment.id ? updatedTreatment : t)
      )
      
      setIsEditDialogOpen(false)
      setEditingTreatment(null)
      resetTreatmentForm()
      
      toast({
        title: "Success",
        description: "Treatment updated successfully!",
      })
    } catch (error) {
      console.error('Error updating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to update treatment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredTreatments = treatments.filter(treatment => {
    const matchesSearch = treatment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         treatment.synopsis.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         treatment.genre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || treatment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'in-progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleDeleteTreatment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this treatment?')) return
    
    try {
      await TreatmentsService.deleteTreatment(id)
      setTreatments(prev => prev.filter(t => t.id !== id))
      toast({
        title: "Success",
        description: "Treatment deleted successfully",
      })
    } catch (error) {
      console.error('Error deleting treatment:', error)
      toast({
        title: "Error",
        description: "Failed to delete treatment",
        variant: "destructive",
      })
    }
  }

  const handleCreateTreatment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const treatmentData: CreateTreatmentData = {
        title: newTreatment.title,
        genre: newTreatment.genre,
        cover_image_url: newTreatment.cover_image_url || undefined,
        synopsis: newTreatment.synopsis,
        target_audience: newTreatment.target_audience || undefined,
        estimated_budget: newTreatment.estimated_budget || undefined,
        estimated_duration: newTreatment.estimated_duration || undefined,
      }
      
      const createdTreatment = await TreatmentsService.createTreatment(treatmentData)
      
      setTreatments(prev => [createdTreatment, ...prev])
      resetTreatmentForm()
      setShowCreateForm(false)
      
      toast({
        title: "Success",
        description: "Treatment created successfully",
      })
    } catch (error) {
      console.error('Error creating treatment:', error)
      toast({
        title: "Error",
        description: "Failed to create treatment",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Please log in to access treatments</h1>
        </div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Cinema Treatments</h1>
            <p className="text-muted-foreground">Manage your film treatments and story concepts</p>
          </div>
          <Button onClick={() => {
            setShowCreateForm(true)
            resetTreatmentForm()
          }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Treatment
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search treatments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Create Treatment Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
            <CardTitle>Create New Treatment</CardTitle>
            <CardDescription>Add a new film treatment to your collection</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTreatment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newTreatment.title}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter treatment title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={newTreatment.genre} onValueChange={(value) => setNewTreatment(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                      <SelectItem value="Documentary">Documentary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Cover Image Section */}
              <div className="space-y-4">
                <Label>Cover Image</Label>
                
                {/* AI Image Generation */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">AI Cover Generation</h3>
                  </div>
                  
                  {!user ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Loading user profile...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
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
                            placeholder="Describe your treatment cover (e.g., 'Sci-fi movie poster with spaceship and alien planet')"
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
                            Generate
                          </Button>
                        </div>
                      </div>
                      
                      {/* Generated Image Preview */}
                      {generatedCoverUrl && (
                        <div className="space-y-3">
                          <Label>Generated Cover</Label>
                          <div className="relative">
                            <img
                              src={generatedCoverUrl}
                              alt="AI generated treatment cover"
                              className="w-full h-48 object-cover rounded-lg border border-border"
                            />
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-green-600/90 text-white">
                                Generated ✓
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This cover will be automatically saved when you create the treatment.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Upload */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Manual Upload</h3>
                  </div>
                  
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="cover-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                      </div>
                      <input
                        id="cover-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(file)
                          }
                        }}
                      />
                    </label>
                  </div>
                  
                  {/* Manual URL Input */}
                  <div className="mt-4">
                    <Label htmlFor="coverImageUrl">Or enter image URL</Label>
                    <Input
                      id="coverImageUrl"
                      value={newTreatment.cover_image_url}
                      onChange={(e) => setNewTreatment(prev => ({ ...prev, cover_image_url: e.target.value }))}
                      placeholder="Enter cover image URL"
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="synopsis">Synopsis</Label>
                <Textarea
                  id="synopsis"
                  value={newTreatment.synopsis}
                  onChange={(e) => setNewTreatment(prev => ({ ...prev, synopsis: e.target.value }))}
                  placeholder="Enter a brief synopsis of your story"
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="targetAudience">Target Audience</Label>
                  <Input
                    id="targetAudience"
                    value={newTreatment.targetAudience}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, targetAudience: e.target.value }))}
                    placeholder="e.g., 18-35, Action fans"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedBudget">Estimated Budget</Label>
                  <Input
                    id="estimatedBudget"
                    value={newTreatment.estimatedBudget}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimatedBudget: e.target.value }))}
                    placeholder="e.g., $10M"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedDuration">Estimated Duration</Label>
                  <Input
                    id="estimatedDuration"
                    value={newTreatment.estimatedDuration}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimatedDuration: e.target.value }))}
                    placeholder="e.g., 120 min"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Treatment'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowCreateForm(false)
                  resetTreatmentForm()
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Edit Treatment Dialog */}
      {isEditDialogOpen && editingTreatment && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit Treatment: {editingTreatment.title}</CardTitle>
            <CardDescription>Update your treatment details and cover image</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateTreatment(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={newTreatment.title}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter treatment title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-genre">Genre</Label>
                  <Select value={newTreatment.genre} onValueChange={(value) => setNewTreatment(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                      <SelectItem value="Documentary">Documentary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cover Image Section for Edit */}
              <div className="space-y-4">
                <Label>Cover Image</Label>
                
                {/* AI Image Generation */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">AI Cover Generation</h3>
                  </div>
                  
                  {!user ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-muted-foreground">Loading user profile...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
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
                            placeholder="Describe your treatment cover (e.g., 'Sci-fi movie poster with spaceship and alien planet')"
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
                            Generate
                          </Button>
                        </div>
                      </div>
                      
                      {/* Generated Image Preview */}
                      {generatedCoverUrl && (
                        <div className="space-y-3">
                          <Label>Generated Cover</Label>
                          <div className="relative">
                            <img
                              src={generatedCoverUrl}
                              alt="AI generated treatment cover"
                              className="w-full h-48 object-cover rounded-lg border border-border"
                            />
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-green-600/90 text-white">
                                Generated ✓
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This cover will be automatically saved when you update the treatment.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Upload for Edit */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Manual Upload</h3>
                  </div>
                  
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="edit-cover-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                      </div>
                      <input
                        id="edit-cover-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(file)
                          }
                        }}
                      />
                    </label>
                  </div>
                  
                  {/* Manual URL Input for Edit */}
                  <div className="mt-4">
                    <Label htmlFor="edit-coverImageUrl">Or enter image URL</Label>
                    <Input
                      id="edit-coverImageUrl"
                      value={newTreatment.cover_image_url}
                      onChange={(e) => setNewTreatment(prev => ({ ...prev, cover_image_url: e.target.value }))}
                      placeholder="Enter cover image URL"
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-synopsis">Synopsis</Label>
                <Textarea
                  id="edit-synopsis"
                  value={newTreatment.synopsis}
                  onChange={(e) => setNewTreatment(prev => ({ ...prev, synopsis: e.target.value }))}
                  placeholder="Enter a brief synopsis of your story"
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-targetAudience">Target Audience</Label>
                  <Input
                    id="edit-targetAudience"
                    value={newTreatment.target_audience}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, target_audience: e.target.value }))}
                    placeholder="e.g., 18-35, Action fans"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-estimatedBudget">Estimated Budget</Label>
                  <Input
                    id="edit-estimatedBudget"
                    value={newTreatment.estimated_budget}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimated_budget: e.target.value }))}
                    placeholder="e.g., $10M"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-estimatedDuration">Estimated Duration</Label>
                  <Input
                    id="edit-estimatedDuration"
                    value={newTreatment.estimated_duration}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, estimated_duration: e.target.value }))}
                    placeholder="e.g., 120 min"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update Treatment'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingTreatment(null)
                  resetTreatmentForm()
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

        {/* Treatments Grid */}
        {isLoadingTreatments ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading treatments...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTreatments.map((treatment) => (
              <Card key={treatment.id} className="hover:shadow-lg transition-shadow">
                {/* Cover Image */}
                {treatment.cover_image_url && (
                  <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden">
                    <img
                      src={treatment.cover_image_url}
                      alt={`${treatment.title} cover`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden absolute inset-0 flex items-center justify-center bg-muted">
                      <div className="text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-sm">Cover Image</p>
                      </div>
                    </div>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{treatment.title}</CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{treatment.genre}</Badge>
                        <Badge className={getStatusColor(treatment.status)}>
                          {treatment.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {treatment.synopsis}
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{treatment.estimated_duration || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{treatment.estimated_budget || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Updated {new Date(treatment.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/treatments/${treatment.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditTreatment(treatment)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleDeleteTreatment(treatment.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoadingTreatments && filteredTreatments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No treatments found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first treatment'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setShowCreateForm(true)}>
                Create Treatment
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
