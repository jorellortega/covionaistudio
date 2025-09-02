"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit, Trash2, ArrowLeft, Save, X, GripVertical } from "lucide-react"
import { useAuthReady } from "@/components/auth-hooks"
import { type MovieIdea } from "@/lib/movie-ideas-service"
import { getSupabaseClient } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { Navigation } from "@/components/navigation"

interface Scene {
  id: string
  title: string
  description: string
  scene_number: number
  duration_minutes: number
  location: string
  characters: string[]
  props: string[]
  notes: string
  order_index: number
  created_at: string
  updated_at: string
}

interface SceneList {
  id: string
  title: string
  description: string
  movie_idea_id: string
  created_at: string
  updated_at: string
}

export default function SceneListPage() {
  const router = useRouter()
  const params = useParams()
  const { user, userId, ready } = useAuthReady()
  const [idea, setIdea] = useState<MovieIdea | null>(null)
  const [sceneList, setSceneList] = useState<SceneList | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSceneDialog, setShowAddSceneDialog] = useState(false)
  const [editingScene, setEditingScene] = useState<Scene | null>(null)
  
  // Form state
  const [sceneTitle, setSceneTitle] = useState("")
  const [sceneDescription, setSceneDescription] = useState("")
  const [sceneNumber, setSceneNumber] = useState(1)
  const [durationMinutes, setDurationMinutes] = useState(1)
  const [location, setLocation] = useState("")
  const [characters, setCharacters] = useState<string[]>([])
  const [props, setProps] = useState<string[]>([])
  const [notes, setNotes] = useState("")

  const ideaId = params.id as string

  useEffect(() => {
    if (ready && userId && ideaId) {
      loadData()
    }
  }, [ready, userId, ideaId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load the movie idea directly from Supabase
      const supabase = getSupabaseClient()
      const { data: ideaData, error: ideaError } = await supabase
        .from('movie_ideas')
        .select('*')
        .eq('id', ideaId)
        .single()
      
      if (ideaError) {
        console.error('Error loading idea:', ideaError)
        toast({
          title: "Error",
          description: "Failed to load idea data",
          variant: "destructive"
        })
        return
      }
      
      if (ideaData) {
        setIdea(ideaData)
        
        // Check if scene list exists, if not create one
        const { data: existingSceneList } = await supabase
          .from('scene_lists')
          .select('*')
          .eq('movie_idea_id', ideaId)
          .single()
        
        if (existingSceneList) {
          setSceneList(existingSceneList)
          // Load scenes
          const { data: scenesData } = await supabase
            .from('scenes')
            .select('*')
            .eq('scene_list_id', existingSceneList.id)
            .order('order_index', { ascending: true })
          
          if (scenesData) {
            setScenes(scenesData)
          }
        } else {
          // Create a new scene list
          const { data: newSceneList, error } = await supabase
            .from('scene_lists')
            .insert({
              user_id: userId,
              title: `${ideaData.title} - Scene List`,
              description: `Scene breakdown for ${ideaData.title}`,
              movie_idea_id: ideaId
            })
            .select()
            .single()
          
          if (newSceneList && !error) {
            setSceneList(newSceneList)
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast({
        title: "Error",
        description: "Failed to load scene list data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddScene = async () => {
    if (!sceneList || !sceneTitle.trim()) return
    
    try {
      const supabase = getSupabaseClient()
      const newScene = {
        scene_list_id: sceneList.id,
        title: sceneTitle.trim(),
        description: sceneDescription.trim(),
        scene_number: sceneNumber,
        duration_minutes: durationMinutes,
        location: location.trim(),
        characters: characters.filter(c => c.trim()),
        props: props.filter(p => p.trim()),
        notes: notes.trim(),
        order_index: scenes.length
      }
      
      const { data: createdScene, error } = await supabase
        .from('scenes')
        .insert(newScene)
        .select()
        .single()
      
      if (createdScene && !error) {
        setScenes([...scenes, createdScene])
        setShowAddSceneDialog(false)
        resetForm()
        toast({
          title: "Success",
          description: "Scene added successfully"
        })
      } else {
        throw error
      }
    } catch (error) {
      console.error('Error adding scene:', error)
      toast({
        title: "Error",
        description: "Failed to add scene",
        variant: "destructive"
      })
    }
  }

  const handleUpdateScene = async () => {
    if (!editingScene || !sceneTitle.trim()) return
    
    try {
      const supabase = getSupabaseClient()
      const updatedScene = {
        title: sceneTitle.trim(),
        description: sceneDescription.trim(),
        scene_number: sceneNumber,
        duration_minutes: durationMinutes,
        location: location.trim(),
        characters: characters.filter(c => c.trim()),
        props: props.filter(p => p.trim()),
        notes: notes.trim()
      }
      
      const { error } = await supabase
        .from('scenes')
        .update(updatedScene)
        .eq('id', editingScene.id)
      
      if (!error) {
        setScenes(scenes.map(s => s.id === editingScene.id ? { ...s, ...updatedScene } : s))
        setEditingScene(null)
        resetForm()
        toast({
          title: "Success",
          description: "Scene updated successfully"
        })
      } else {
        throw error
      }
    } catch (error) {
      console.error('Error updating scene:', error)
      toast({
        title: "Error",
        description: "Failed to update scene",
        variant: "destructive"
      })
    }
  }

  const handleDeleteScene = async (sceneId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('scenes')
        .delete()
        .eq('id', sceneId)
      
      if (!error) {
        setScenes(scenes.filter(s => s.id !== sceneId))
        toast({
          title: "Success",
          description: "Scene deleted successfully"
        })
      } else {
        throw error
      }
    } catch (error) {
      console.error('Error deleting scene:', error)
      toast({
        title: "Error",
        description: "Failed to delete scene",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setSceneTitle("")
    setSceneDescription("")
    setSceneNumber(1)
    setDurationMinutes(1)
    setLocation("")
    setCharacters([])
    setProps([])
    setNotes("")
  }

  const openEditDialog = (scene: Scene) => {
    setEditingScene(scene)
    setSceneTitle(scene.title)
    setSceneDescription(scene.description)
    setSceneNumber(scene.scene_number)
    setDurationMinutes(scene.duration_minutes)
    setLocation(scene.location)
    setCharacters(scene.characters)
    setProps(scene.props)
    setNotes(scene.notes)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading scene list...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!idea) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Idea not found</h1>
            <Button onClick={() => router.push('/ideas')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ideas
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/ideas')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ideas
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{idea.title}</h1>
              <p className="text-muted-foreground">Scene List Management</p>
            </div>
          </div>
          <Button onClick={() => setShowAddSceneDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Scene
          </Button>
        </div>

        {/* Scene List */}
        <div className="grid gap-4">
          {scenes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-4">No scenes yet</p>
                <Button onClick={() => setShowAddSceneDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Scene
                </Button>
              </CardContent>
            </Card>
          ) : (
            scenes.map((scene, index) => (
              <Card key={scene.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="secondary" className="flex-shrink-0">
                          Scene {scene.scene_number}
                        </Badge>
                        <Badge variant="outline" className="flex-shrink-0">
                          {scene.duration_minutes} min
                        </Badge>
                        {scene.location && (
                          <Badge variant="outline" className="flex-shrink-0">
                            📍 {scene.location}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg mb-2">{scene.title}</CardTitle>
                      {scene.description && (
                        <p className="text-muted-foreground mb-3">{scene.description}</p>
                      )}
                      {scene.characters.length > 0 && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-muted-foreground">Characters: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {scene.characters.map((char, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {char}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {scene.props.length > 0 && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-muted-foreground">Props: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {scene.props.map((prop, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {prop}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {scene.notes && (
                        <div className="mt-3 p-3 bg-muted rounded-lg">
                          <span className="text-sm font-medium text-muted-foreground">Notes: </span>
                          <p className="text-sm mt-1">{scene.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(scene)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteScene(scene.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Add/Edit Scene Dialog */}
        {(showAddSceneDialog || editingScene) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {editingScene ? 'Edit Scene' : 'Add New Scene'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddSceneDialog(false)
                    setEditingScene(null)
                    resetForm()
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="scene-title">Scene Title *</Label>
                    <Input
                      id="scene-title"
                      value={sceneTitle}
                      onChange={(e) => setSceneTitle(e.target.value)}
                      placeholder="Enter scene title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="scene-number">Scene Number</Label>
                    <Input
                      id="scene-number"
                      type="number"
                      value={sceneNumber}
                      onChange={(e) => setSceneNumber(parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="scene-description">Description</Label>
                  <Textarea
                    id="scene-description"
                    value={sceneDescription}
                    onChange={(e) => setSceneDescription(e.target.value)}
                    placeholder="Describe what happens in this scene"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Where does this scene take place?"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="characters">Characters (comma-separated)</Label>
                  <Input
                    id="characters"
                    value={characters.join(', ')}
                    onChange={(e) => setCharacters(e.target.value.split(',').map(c => c.trim()).filter(c => c))}
                    placeholder="Character 1, Character 2, Character 3"
                  />
                </div>
                
                <div>
                  <Label htmlFor="props">Props (comma-separated)</Label>
                  <Input
                    id="props"
                    value={props.join(', ')}
                    onChange={(e) => setProps(e.target.value.split(',').map(p => p.trim()).filter(p => p))}
                    placeholder="Prop 1, Prop 2, Prop 3"
                  />
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes, ideas, or reminders for this scene"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddSceneDialog(false)
                    setEditingScene(null)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingScene ? handleUpdateScene : handleAddScene}
                  disabled={!sceneTitle.trim()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingScene ? 'Update Scene' : 'Add Scene'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
