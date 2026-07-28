"use client"

import { useEffect, useState } from "react"
import { Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AssignmentBadgePicker } from "@/components/assignment-badge-picker"
import { StoryboardShotPositionEditor } from "@/components/storyboard-shot-position-editor"
import { useToast } from "@/hooks/use-toast"
import type { Character } from "@/lib/characters-service"
import type { Location } from "@/lib/locations-service"
import {
  buildStoryboardAssignmentPatch,
  getStoryboardCharacterIds,
  getStoryboardLocationIds,
} from "@/lib/storyboard-assignments"
import { displayShotNumber } from "@/lib/shot-list-order"
import { SHOT_TYPE_OPTIONS, formatStoryboardSaveError } from "@/lib/shot-options"
import { ShotCameraAngleSelect, ShotMovementSelect } from "@/components/shot-field-selects"
import {
  StoryboardsService,
  type CreateStoryboardData,
  type Storyboard,
} from "@/lib/storyboards-service"

type StoryboardShotEditDialogProps = {
  open: boolean
  storyboard: Storyboard | null
  storyboards: Storyboard[]
  sceneId: string
  projectId?: string
  characters?: Character[]
  locations?: Location[]
  onOpenChange: (open: boolean) => void
  onUpdated: (storyboard: Storyboard) => void
  onRefreshStoryboards?: () => void | Promise<void>
}

function storyboardToFormData(storyboard: Storyboard, sceneId: string): CreateStoryboardData {
  return {
    title: storyboard.title,
    description: storyboard.description,
    scene_number: storyboard.scene_number,
    shot_number: storyboard.shot_number || 1,
    shot_type: storyboard.shot_type,
    camera_angle: storyboard.camera_angle,
    movement: storyboard.movement,
    sequence_order: storyboard.sequence_order || storyboard.shot_number || 1,
    status: storyboard.status || "draft",
    character_id: storyboard.character_id || null,
    location_id: storyboard.location_id || null,
    dialogue: storyboard.dialogue || "",
    action: storyboard.action || "",
    visual_notes: storyboard.visual_notes || "",
    image_url: storyboard.image_url || "",
    project_id: storyboard.project_id || "",
    scene_id: sceneId,
  }
}

export function StoryboardShotEditDialog({
  open,
  storyboard,
  storyboards,
  sceneId,
  projectId,
  characters = [],
  locations = [],
  onOpenChange,
  onUpdated,
  onRefreshStoryboards,
}: StoryboardShotEditDialogProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<CreateStoryboardData | null>(null)
  const [formCharacterIds, setFormCharacterIds] = useState<string[]>([])
  const [formLocationIds, setFormLocationIds] = useState<string[]>([])
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (!open || !storyboard) {
      if (!open) {
        setFormData(null)
      }
      return
    }
    setFormData(storyboardToFormData(storyboard, sceneId))
    setFormCharacterIds(getStoryboardCharacterIds(storyboard))
    setFormLocationIds(getStoryboardLocationIds(storyboard))
  }, [open, storyboard, sceneId])

  const handleUpdate = async () => {
    if (!storyboard || !formData?.title?.trim() || !formData.description?.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please fill in title and description.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUpdating(true)
      const { shot_number: _shotNumber, sequence_order: _sequenceOrder, ...formWithoutPosition } =
        formData
      const cleanFormData = {
        ...formWithoutPosition,
        dialogue: formData.dialogue?.trim() || undefined,
        action: formData.action?.trim() || undefined,
        visual_notes: formData.visual_notes?.trim() || undefined,
        image_url: formData.image_url?.trim() || undefined,
        project_id: formData.project_id?.trim() || projectId,
        scene_id: sceneId,
        ...buildStoryboardAssignmentPatch(
          formCharacterIds,
          formLocationIds,
          storyboard.metadata,
        ),
      }

      const updatedStoryboard = await StoryboardsService.updateStoryboard(
        storyboard.id,
        cleanFormData,
      )
      onUpdated(updatedStoryboard)
      onOpenChange(false)
      toast({
        title: "Shot updated",
        description: "Storyboard details saved successfully.",
      })
    } catch (error) {
      console.error("Error updating storyboard:", error)
      toast({
        title: "Error",
        description: formatStoryboardSaveError(error, formData.movement),
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  if (!storyboard) {
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isUpdating) onOpenChange(false)
      }}
    >
      <DialogContent className="cinema-card border-border w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        {!formData ? (
          <div className="py-8 flex justify-center">
            <span className="text-sm text-muted-foreground">Loading shot details…</span>
          </div>
        ) : (
          <>
        <DialogHeader className="pb-2 min-w-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 min-w-0 pr-8 break-words">
            <Edit className="h-5 w-5 flex-shrink-0" />
            Edit Shot {displayShotNumber(storyboard)}
            {storyboard.title ? ` · ${storyboard.title}` : ""}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm break-words">
            Update shot details, camera settings, and character/location assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 min-w-0 w-full overflow-hidden">
          <div>
            <Label htmlFor="edit-shot-title">Title *</Label>
            <Input
              id="edit-shot-title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
              placeholder="Shot title"
            />
          </div>

          <StoryboardShotPositionEditor
            storyboard={storyboard}
            storyboards={storyboards}
            sceneId={sceneId}
            disabled={isUpdating}
            onChanged={async (updated) => {
              await onRefreshStoryboards?.()
              if (updated) {
                setFormData((prev) =>
                  prev
                    ? {
                        ...prev,
                        shot_number: updated.shot_number,
                        sequence_order: updated.sequence_order ?? updated.shot_number,
                      }
                    : prev,
                )
                onUpdated(updated)
              }
            }}
          />

          <div>
            <Label htmlFor="edit-shot-description">Description *</Label>
            <Textarea
              id="edit-shot-description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => (prev ? { ...prev, description: e.target.value } : prev))
              }
              placeholder="Shot description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="edit-shot-type">Shot Type</Label>
              <Select
                value={formData.shot_type}
                onValueChange={(value) =>
                  setFormData((prev) => (prev ? { ...prev, shot_type: value } : prev))
                }
              >
                <SelectTrigger id="edit-shot-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHOT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-shot-camera">Camera Angle</Label>
              <ShotCameraAngleSelect
                id="edit-shot-camera"
                value={formData.camera_angle}
                onValueChange={(value) =>
                  setFormData((prev) => (prev ? { ...prev, camera_angle: value } : prev))
                }
                disabled={isUpdating}
              />
            </div>
            <div>
              <Label htmlFor="edit-shot-movement">Camera Movement</Label>
              <ShotMovementSelect
                id="edit-shot-movement"
                value={formData.movement}
                onValueChange={(value) =>
                  setFormData((prev) => (prev ? { ...prev, movement: value } : prev))
                }
                disabled={isUpdating}
              />
            </div>
          </div>

          {characters.length > 0 ? (
            <div className="space-y-2">
              <Label>Character / Avatar (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Assign characters for generation and dialogue voice linking.
              </p>
              <AssignmentBadgePicker
                kind="character"
                items={characters.map((character) => ({
                  id: character.id,
                  name: character.name,
                  subtitle: character.archetype ?? undefined,
                }))}
                selectedIds={formCharacterIds}
                onSelectedIdsChange={setFormCharacterIds}
                disabled={isUpdating}
              />
            </div>
          ) : null}

          {locations.length > 0 ? (
            <div className="space-y-2">
              <Label>Location (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Assign locations to include their details when generating images.
              </p>
              <AssignmentBadgePicker
                kind="location"
                items={locations.map((location) => ({
                  id: location.id,
                  name: location.name,
                  subtitle: location.type ?? undefined,
                }))}
                selectedIds={formLocationIds}
                onSelectedIdsChange={setFormLocationIds}
                disabled={isUpdating}
              />
            </div>
          ) : null}

          <div>
            <Label htmlFor="edit-shot-status">Status</Label>
            <Select
              value={formData.status || "draft"}
              onValueChange={(value) =>
                setFormData((prev) =>
                  prev ? { ...prev, status: value as CreateStoryboardData["status"] } : prev,
                )
              }
            >
              <SelectTrigger id="edit-shot-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-shot-dialogue">Dialogue</Label>
              <Textarea
                id="edit-shot-dialogue"
                value={formData.dialogue || ""}
                onChange={(e) =>
                  setFormData((prev) => (prev ? { ...prev, dialogue: e.target.value } : prev))
                }
                placeholder="Character dialogue or narration"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-shot-action">Action</Label>
              <Textarea
                id="edit-shot-action"
                value={formData.action || ""}
                onChange={(e) =>
                  setFormData((prev) => (prev ? { ...prev, action: e.target.value } : prev))
                }
                placeholder="What happens in this shot"
                rows={3}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-shot-visual-notes">Visual Notes</Label>
            <Textarea
              id="edit-shot-visual-notes"
              value={formData.visual_notes || ""}
              onChange={(e) =>
                setFormData((prev) => (prev ? { ...prev, visual_notes: e.target.value } : prev))
              }
              placeholder="Lighting, color, mood, special effects"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleUpdate()}
              disabled={isUpdating}
              className="gradient-button neon-glow text-white"
            >
              {isUpdating ? "Updating..." : "Update Shot"}
            </Button>
          </div>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
