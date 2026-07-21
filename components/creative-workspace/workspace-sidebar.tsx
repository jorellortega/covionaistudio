"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  MessageSquare,
  Trash2,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Film,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CreativeWorkspace } from "@/lib/creative-workspace-types"

interface WorkspaceSidebarProps {
  workspaces: CreativeWorkspace[]
  activeWorkspaceId: string | null
  isLoading: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onSuggestTitle: (id: string) => Promise<void>
  suggestingTitleId: string | null
}

export function WorkspaceSidebar({
  workspaces,
  activeWorkspaceId,
  isLoading,
  collapsed,
  onToggleCollapse,
  onSelect,
  onCreate,
  onDelete,
  onSuggestTitle,
  suggestingTitleId,
}: WorkspaceSidebarProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const workspaceToDelete = workspaces.find((w) => w.id === confirmDeleteId)

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return
    setDeletingId(confirmDeleteId)
    try {
      await onDelete(confirmDeleteId)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center border-r border-border bg-muted/30 py-3 px-2 gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} title="Show workspaces">
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onCreate} title="New workspace">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-64 flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border p-3">
        <span className="text-sm font-medium">Workspaces</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCreate} title="New workspace">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse} title="Collapse">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : workspaces.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-2">
              No workspaces yet. Start a new one to begin developing your film idea.
            </p>
          ) : (
            workspaces.map((ws) => (
              <div
                key={ws.id}
                className={cn(
                  "w-full flex items-start gap-1 rounded-md px-1 py-1 text-sm transition-colors group",
                  activeWorkspaceId === ws.id
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(ws.id)}
                  className="flex flex-1 items-start gap-2 rounded-md px-1 py-1 text-left min-w-0"
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium flex items-center gap-1">
                      {ws.project_id && (
                        <Film className="h-3 w-3 text-primary flex-shrink-0" title="Linked to movie" />
                      )}
                      <span className="truncate">{ws.title}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {new Date(ws.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="AI title"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSuggestTitle(ws.id)
                  }}
                  disabled={suggestingTitleId === ws.id}
                >
                  {suggestingTitleId === ws.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 flex-shrink-0 hover:text-destructive",
                    activeWorkspaceId === ws.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                  title="Delete workspace"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDeleteId(ws.id)
                  }}
                  disabled={deletingId === ws.id}
                >
                  {deletingId === ws.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{workspaceToDelete?.title}&quot; and all its messages and artifacts. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
