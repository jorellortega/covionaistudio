"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Edit,
  Trash2,
  Film,
  Camera,
  Move,
  Clock,
  Loader2,
  Save,
  X,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShotListService, type ShotList, type CreateShotListData } from "@/lib/shot-list-service"

interface ShotListProps {
  sceneId?: string
  screenplaySceneId?: string
  storyboardId?: string
  projectId?: string
  onShotsChange?: (shots: ShotList[]) => void
  onCreateStoryboard?: (shot: ShotList) => void | Promise<void>
  showCreateStoryboardButton?: boolean
}

export function ShotListComponent({
  sceneId,
  screenplaySceneId,
  storyboardId,
  projectId,
  onShotsChange,
  onCreateStoryboard,
  showCreateStoryboardButton = false,
}: ShotListProps) {
  const { toast } = useToast()
  const [shots, setShots] = useState<ShotList[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingShot, setEditingShot] = useState<ShotList | null>(null)
  const [deletingShot, setDeletingShot] = useState<ShotList | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<CreateShotListData>({
    shot_type: 'wide',
    camera_angle: 'eye-level',
    movement: 'static',
    status: 'planned',
  })

  // Load shot lists
  useEffect(() => {
    loadShotLists()
  }, [sceneId, screenplaySceneId, storyboardId])

  const loadShotLists = async () => {
    try {
      setLoading(true)
      let loadedShots: ShotList[] = []

      if (sceneId) {
        loadedShots = await ShotListService.getShotListsByScene(sceneId)
      } else if (screenplaySceneId) {
        loadedShots = await ShotListService.getShotListsByScreenplayScene(screenplaySceneId)
      } else if (storyboardId) {
        loadedShots = await ShotListService.getShotListsByStoryboard(storyboardId)
      }

      setShots(loadedShots)
      onShotsChange?.(loadedShots)
    } catch (error) {
      console.error('Error loading shot lists:', error)
      toast({
        title: "Error",
        description: "Failed to load shot list.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (shot?: ShotList) => {
    if (shot) {
      setEditingShot(shot)
      setFormData({
        shot_type: shot.shot_type,
        camera_angle: shot.camera_angle,
        movement: shot.movement,
        lens: shot.lens,
        framing: shot.framing,
        duration_seconds: shot.duration_seconds,
        description: shot.description,
        action: shot.action,
        dialogue: shot.dialogue,
        visual_notes: shot.visual_notes,
        audio_notes: shot.audio_notes,
        props: shot.props,
        characters: shot.characters,
        location: shot.location,
        time_of_day: shot.time_of_day,
        lighting_notes: shot.lighting_notes,
        camera_notes: shot.camera_notes,
        status: shot.status,
      })
    } else {
      setEditingShot(null)
      setFormData({
        shot_type: 'wide',
        camera_angle: 'eye-level',
        movement: 'static',
        status: 'planned',
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingShot(null)
    setFormData({
      shot_type: 'wide',
      camera_angle: 'eye-level',
      movement: 'static',
      status: 'planned',
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const shotData: CreateShotListData = {
        ...formData,
        scene_id: sceneId,
        screenplay_scene_id: screenplaySceneId,
        storyboard_id: storyboardId,
        project_id: projectId,
      }

      if (editingShot) {
        await ShotListService.updateShotList(editingShot.id, shotData)
        toast({
          title: "Success",
          description: "Shot updated successfully.",
        })
      } else {
        await ShotListService.createShotList(shotData)
        toast({
          title: "Success",
          description: "Shot added to shot list.",
        })
      }

      await loadShotLists()
      handleCloseDialog()
    } catch (error) {
      console.error('Error saving shot:', error)
      toast({
        title: "Error",
        description: "Failed to save shot.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingShot) return

    try {
      setSaving(true)
      await ShotListService.deleteShotList(deletingShot.id)
      toast({
        title: "Success",
        description: "Shot deleted successfully.",
      })
      await loadShotLists()
      setDeletingShot(null)
    } catch (error) {
      console.error('Error deleting shot:', error)
      toast({
        title: "Error",
        description: "Failed to delete shot.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'shot':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'scheduled':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'review':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Shot List</h3>
          <p className="text-sm text-muted-foreground">
            Break down this scene into individual shots
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Shot
        </Button>
      </div>

      {shots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Shots Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first shot to start building your shot list.
            </p>
            <Button onClick={() => handleOpenDialog()} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add First Shot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shots.map((shot) => (
            <Card key={shot.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        Shot {shot.shot_number}
                      </Badge>
                      <Badge className={getStatusColor(shot.status)}>
                        {shot.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Camera className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium">{shot.shot_type}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Camera className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Angle:</span>
                        <span className="font-medium">{shot.camera_angle}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Move className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Movement:</span>
                        <span className="font-medium">{shot.movement}</span>
                      </div>
                      {shot.duration_seconds && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="font-medium">{shot.duration_seconds}s</span>
                        </div>
                      )}
                    </div>

                    {shot.description && (
                      <p className="text-sm text-muted-foreground">{shot.description}</p>
                    )}

                    {shot.action && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Action:</p>
                        <p className="text-sm">{shot.action}</p>
                      </div>
                    )}

                    {shot.dialogue && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Dialogue:</p>
                        <p className="text-sm italic">{shot.dialogue}</p>
                      </div>
                    )}

                    {(shot.characters && shot.characters.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {shot.characters.map((char, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {char}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    {showCreateStoryboardButton && onCreateStoryboard && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                        onClick={async () => {
                          if (onCreateStoryboard) {
                            await onCreateStoryboard(shot)
                          }
                        }}
                      >
                        <Film className="h-4 w-4 mr-1" />
                        Create Storyboard
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(shot)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingShot(shot)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingShot ? "Edit Shot" : "Add Shot to List"}
            </DialogTitle>
            <DialogDescription>
              Define the technical and creative details for this shot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Shot Type</Label>
                <Select
                  value={formData.shot_type}
                  onValueChange={(value) => setFormData({ ...formData, shot_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wide">Wide</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="close">Close</SelectItem>
                    <SelectItem value="extreme-close">Extreme Close</SelectItem>
                    <SelectItem value="two-shot">Two Shot</SelectItem>
                    <SelectItem value="over-the-shoulder">Over the Shoulder</SelectItem>
                    <SelectItem value="point-of-view">Point of View</SelectItem>
                    <SelectItem value="establishing">Establishing</SelectItem>
                    <SelectItem value="insert">Insert</SelectItem>
                    <SelectItem value="cutaway">Cutaway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Camera Angle</Label>
                <Select
                  value={formData.camera_angle}
                  onValueChange={(value) => setFormData({ ...formData, camera_angle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eye-level">Eye Level</SelectItem>
                    <SelectItem value="high-angle">High Angle</SelectItem>
                    <SelectItem value="low-angle">Low Angle</SelectItem>
                    <SelectItem value="dutch-angle">Dutch Angle</SelectItem>
                    <SelectItem value="bird-eye">Bird's Eye</SelectItem>
                    <SelectItem value="worm-eye">Worm's Eye</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Movement</Label>
                <Select
                  value={formData.movement}
                  onValueChange={(value) => setFormData({ ...formData, movement: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static</SelectItem>
                    <SelectItem value="panning">Panning</SelectItem>
                    <SelectItem value="tilting">Tilting</SelectItem>
                    <SelectItem value="tracking">Tracking</SelectItem>
                    <SelectItem value="zooming">Zooming</SelectItem>
                    <SelectItem value="dolly">Dolly</SelectItem>
                    <SelectItem value="crane">Crane</SelectItem>
                    <SelectItem value="handheld">Handheld</SelectItem>
                    <SelectItem value="steadicam">Steadicam</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="shot">Shot</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  value={formData.duration_seconds || ''}
                  onChange={(e) => setFormData({ ...formData, duration_seconds: parseInt(e.target.value) || undefined })}
                />
              </div>

              <div>
                <Label>Lens</Label>
                <Input
                  value={formData.lens || ''}
                  onChange={(e) => setFormData({ ...formData, lens: e.target.value })}
                  placeholder="e.g., 24mm, 50mm"
                />
              </div>

              <div>
                <Label>Framing</Label>
                <Input
                  value={formData.framing || ''}
                  onChange={(e) => setFormData({ ...formData, framing: e.target.value })}
                  placeholder="e.g., Rule of thirds, centered"
                />
              </div>

              <div>
                <Label>Time of Day</Label>
                <Input
                  value={formData.time_of_day || ''}
                  onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                  placeholder="e.g., Day, Night, Dawn"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the shot"
                rows={2}
              />
            </div>

            <div>
              <Label>Action</Label>
              <Textarea
                value={formData.action || ''}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                placeholder="What happens in this shot?"
                rows={3}
              />
            </div>

            <div>
              <Label>Dialogue</Label>
              <Textarea
                value={formData.dialogue || ''}
                onChange={(e) => setFormData({ ...formData, dialogue: e.target.value })}
                placeholder="Key dialogue in this shot"
                rows={2}
              />
            </div>

            <div>
              <Label>Visual Notes</Label>
              <Textarea
                value={formData.visual_notes || ''}
                onChange={(e) => setFormData({ ...formData, visual_notes: e.target.value })}
                placeholder="Visual elements, composition, color, etc."
                rows={2}
              />
            </div>

            <div>
              <Label>Camera Notes</Label>
              <Textarea
                value={formData.camera_notes || ''}
                onChange={(e) => setFormData({ ...formData, camera_notes: e.target.value })}
                placeholder="Camera settings, equipment, etc."
                rows={2}
              />
            </div>

            <div>
              <Label>Lighting Notes</Label>
              <Textarea
                value={formData.lighting_notes || ''}
                onChange={(e) => setFormData({ ...formData, lighting_notes: e.target.value })}
                placeholder="Lighting setup and mood"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Shot
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingShot} onOpenChange={(open) => !open && setDeletingShot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shot?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete shot {deletingShot?.shot_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

