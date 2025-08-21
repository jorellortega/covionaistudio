"use client"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  Play,
  Clock,
  Edit3,
  ImageIcon,
  FileText,
  MessageSquare,
  Users,
  MapPin,
  Calendar,
  Save,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"




interface ScenePageProps {
  params: Promise<{ id: string }>
}

export default async function ScenePage({ params }: ScenePageProps) {
  const { id } = await params

  return <ScenePageClient id={id} />
}

function ScenePageClient({ id }: { id: string }) {
  const { toast } = useToast()

  // State variables
  const [activeTab, setActiveTab] = useState("overview")
  const [newNote, setNewNote] = useState("")
  const [newNoteType, setNewNoteType] = useState("General")
  const [isEditing, setIsEditing] = useState(false)
  const [showMediaUpload, setShowMediaUpload] = useState(false)
  const [loading, setLoading] = useState(false)

  // Mock scene data - replace with actual data fetching
  const [scene, setScene] = useState({
    id,
    scene_number: 1,
    title: "Opening Sequence",
    description: "The protagonist wakes up in a cyberpunk cityscape",
    duration: "2m 30s",
    status: "Script Complete",
    version: "v1.2",
    arc: "Act I - Setup",
    timestamp: "00:00:00",
    project_id: "project-1",
    location: "Neo Tokyo Streets",
    characters: ["Alex Chen", "AI Assistant"],
    shot_type: "Wide Shot",
    mood: "Mysterious",
    notes: [
      {
        id: "note-1",
        type: "Director",
        content: "Focus on the neon reflections in the rain",
        created_at: "2024-01-15T10:30:00Z",
        author: "Director",
      },
    ],
    media: [
      {
        id: "media-1",
        type: "image",
        url: "/cyberpunk-city-concept.png",
        name: "Concept Art - Street Scene",
        size: "2.4 MB",
        created_at: "2024-01-15T09:00:00Z",
      },
    ],
  })

  const [editForm, setEditForm] = useState({
    title: scene.title,
    description: scene.description,
    duration: scene.duration,
    status: scene.status,
    version: scene.version,
    arc: scene.arc,
    timestamp: scene.timestamp,
  })

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Script Complete":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "Draft":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "Outline":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "Concept":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30"
    }
  }

  const handleSaveNote = async () => {
    if (!newNote.trim()) return

    const note = {
      id: `note-${Date.now()}`,
      type: newNoteType,
      content: newNote,
      created_at: new Date().toISOString(),
      author: "Current User",
    }

    setScene((prev) => ({
      ...prev,
      notes: [...(prev.notes || []), note],
    }))

    setNewNote("")
    toast({
      title: "Note Added",
      description: "Your note has been saved successfully.",
    })
  }

  const handleSaveScene = async () => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setScene((prev) => ({ ...prev, ...editForm }))
      setIsEditing(false)
      setLoading(false)
      toast({
        title: "Scene Updated",
        description: "Scene details have been saved successfully.",
      })
    }, 1000)
  }

  const startEditing = () => {
    setEditForm({
      title: scene.title,
      description: scene.description,
      duration: scene.duration,
      status: scene.status,
      version: scene.version,
      arc: scene.arc,
      timestamp: scene.timestamp,
    })
    setIsEditing(true)
  }

  const startAddMedia = () => {
    setShowMediaUpload(true)
  }

  const handleMediaUploadComplete = (mediaData: any) => {
    setScene((prev) => ({
      ...prev,
      media: [...(prev.media || []), mediaData],
    }))
    setShowMediaUpload(false)
    toast({
      title: "Media Uploaded",
      description: "Your media has been added to the scene.",
    })
  }

  const handleMediaUploadError = (error: string) => {
    toast({
      title: "Upload Failed",
      description: error,
      variant: "destructive",
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/timeline">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Timeline
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-primary">
                Scene {scene.scene_number}: {scene.title}
              </h1>
              <p className="text-muted-foreground mt-1">{scene.description}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={startEditing}
              className="border-primary/30 text-primary hover:bg-primary/10 bg-transparent"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Scene
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-background border-destructive/20">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">Delete Scene</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This action cannot be undone. This will permanently delete the scene and all associated media.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-muted/30">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Scene Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Duration</span>
              </div>
              <p className="text-2xl font-bold text-primary">{scene.duration}</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Status</span>
              </div>
              <Badge className={`${getStatusColor(scene.status)} text-sm`}>{scene.status}</Badge>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Version</span>
              </div>
              <p className="text-2xl font-bold text-primary">{scene.version}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border-primary/20">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger value="media" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Media
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Notes
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              Versions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-primary/20">
                <CardHeader>
                  <CardTitle className="text-primary">Scene Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="text-foreground font-medium">{scene.title}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-foreground">{scene.description}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Story Arc</Label>
                    <p className="text-foreground">{scene.arc}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Timestamp</Label>
                    <p className="text-foreground font-mono">{scene.timestamp}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-primary/20">
                <CardHeader>
                  <CardTitle className="text-primary">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Media Files:</span>
                    <span className="text-foreground font-medium">{scene.media?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Notes:</span>
                    <span className="text-foreground font-medium">{scene.notes?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Characters:</span>
                    <span className="text-foreground font-medium">{scene.characters?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Location:</span>
                    <span className="text-foreground font-medium">{scene.location}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-primary">Scene Media</h3>
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                onClick={startAddMedia}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Media
              </Button>
            </div>

            {scene.media && scene.media.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scene.media.map((media) => (
                  <Card key={media.id} className="bg-card border-primary/20">
                    <CardContent className="p-4">
                      <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h4 className="font-medium text-foreground mb-1">{media.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{media.size}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-primary/30 text-primary bg-transparent">
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive bg-transparent"
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No media files added to this scene yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-6">
            <Card className="bg-card border-primary/20">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Note Type</Label>
                    <Select value={newNoteType} onValueChange={setNewNoteType}>
                      <SelectTrigger className="bg-card border-primary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-primary/30">
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Director">Director</SelectItem>
                        <SelectItem value="Script">Script</SelectItem>
                        <SelectItem value="Technical">Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Note Content</Label>
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add your note here..."
                      className="bg-card border-primary/30 text-foreground"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveNote}
                      className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Note
                    </Button>
                    <Button variant="outline" onClick={() => setNewNote("")} className="border-muted/30">
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {scene.notes && scene.notes.length > 0 ? (
              <div className="space-y-4">
                {scene.notes.map((note) => (
                  <Card key={note.id} className="bg-card border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge className="bg-primary/20 text-primary border-primary/30">{note.type}</Badge>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-foreground mb-2">{note.content}</p>
                      <p className="text-sm text-muted-foreground">
                        By {note.author} • {new Date(note.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No notes added to this scene yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions" className="space-y-6">
            <Card className="bg-card border-primary/20">
              <CardContent className="p-8 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Version history will be displayed here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Scene Dialog */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="bg-background border-primary/20 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-primary">Edit Scene</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="bg-card border-primary/30 text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="bg-card border-primary/30 text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <Input
                    value={editForm.duration}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, duration: e.target.value }))}
                    className="bg-card border-primary/30 text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="bg-card border-primary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-primary/30">
                      <SelectItem value="Concept">Concept</SelectItem>
                      <SelectItem value="Outline">Outline</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Script Complete">Script Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveScene}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="border-muted/30">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Media Upload Dialog */}
        {showMediaUpload && (
          <Dialog open={showMediaUpload} onOpenChange={setShowMediaUpload}>
            <DialogContent className="bg-background border-primary/20 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-primary">Upload Media</DialogTitle>
              </DialogHeader>
              <div className="p-4 text-center text-muted-foreground">
                Media upload component will be integrated here
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
