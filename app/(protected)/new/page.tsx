"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Header from "@/components/header"
import { WorkspaceSidebar } from "@/components/creative-workspace/workspace-sidebar"
import { ChatPanel } from "@/components/creative-workspace/chat-panel"
import { ArtifactPanel } from "@/components/creative-workspace/artifact-panel"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { MovieService, type Movie } from "@/lib/movie-service"
import type { CreativeWorkspace, CreativeMessage, CreativeArtifact } from "@/lib/creative-workspace-types"
import { Sparkles } from "lucide-react"

export default function NewCreativePage() {
  const { ready, userId } = useAuthReady()
  const { toast } = useToast()

  const [workspaces, setWorkspaces] = useState<CreativeWorkspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [workspaceTitle, setWorkspaceTitle] = useState("Untitled Project")
  const [messages, setMessages] = useState<CreativeMessage[]>([])
  const [artifacts, setArtifacts] = useState<CreativeArtifact[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [suggestingTitleId, setSuggestingTitleId] = useState<string | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])

  const linkedProject = useMemo(() => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId)
    if (!ws?.project_id) return null
    const movie = movies.find((m) => m.id === ws.project_id)
    return {
      id: ws.project_id,
      name: movie?.name || "Movie Project",
    }
  }, [workspaces, activeWorkspaceId, movies])

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/creative-workspace")
      if (!res.ok) return
      const data = await res.json()
      setWorkspaces(data.workspaces || [])
    } catch {
      // silent
    } finally {
      setLoadingWorkspaces(false)
    }
  }, [])

  const loadWorkspaceData = useCallback(async (workspaceId: string) => {
    setLoadingMessages(true)
    try {
      const [msgRes, artRes] = await Promise.all([
        fetch(`/api/creative-workspace/${workspaceId}/messages`),
        fetch(`/api/creative-workspace/${workspaceId}/artifacts`),
      ])

      if (msgRes.ok) {
        const msgData = await msgRes.json()
        setMessages(msgData.messages || [])
      }
      if (artRes.ok) {
        const artData = await artRes.json()
        setArtifacts(artData.artifacts || [])
      }
    } catch {
      toast({ title: "Error", description: "Failed to load workspace", variant: "destructive" })
    } finally {
      setLoadingMessages(false)
    }
  }, [toast])

  useEffect(() => {
    if (ready && userId) loadWorkspaces()
  }, [ready, userId, loadWorkspaces])

  useEffect(() => {
    if (!ready || !userId) return
    MovieService.getMovies()
      .then(setMovies)
      .catch(() => setMovies([]))
  }, [ready, userId])

  useEffect(() => {
    if (activeWorkspaceId) {
      const ws = workspaces.find((w) => w.id === activeWorkspaceId)
      if (ws) setWorkspaceTitle(ws.title)
      loadWorkspaceData(activeWorkspaceId)
    }
  }, [activeWorkspaceId, loadWorkspaceData])

  const handleCreateWorkspace = async () => {
    try {
      const res = await fetch("/api/creative-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Project" }),
      })
      if (!res.ok) throw new Error("Failed to create workspace")
      const data = await res.json()
      const ws = data.workspace as CreativeWorkspace
      setWorkspaces((prev) => [ws, ...prev])
      setActiveWorkspaceId(ws.id)
      setWorkspaceTitle(ws.title)
      setMessages([])
      setArtifacts([])
    } catch {
      toast({ title: "Error", description: "Failed to create workspace", variant: "destructive" })
    }
  }

  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspaceId(id)
  }

  const handleDeleteWorkspace = async (id: string) => {
    try {
      const res = await fetch(`/api/creative-workspace/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      const deleted = workspaces.find((w) => w.id === id)
      setWorkspaces((prev) => prev.filter((w) => w.id !== id))
      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(null)
        setMessages([])
        setArtifacts([])
        setWorkspaceTitle("Untitled Project")
      }
      toast({
        title: "Workspace deleted",
        description: deleted?.title ? `"${deleted.title}" was removed.` : undefined,
      })
    } catch {
      toast({ title: "Error", description: "Failed to delete workspace", variant: "destructive" })
    }
  }

  const handleWorkspaceTitleChange = async (title: string) => {
    setWorkspaceTitle(title)
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? { ...w, title } : w)),
    )
    if (activeWorkspaceId) {
      await fetch(`/api/creative-workspace/${activeWorkspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
    }
  }

  const handleSuggestTitle = async (workspaceId: string) => {
    setSuggestingTitleId(workspaceId)
    try {
      const res = await fetch(`/api/creative-workspace/${workspaceId}/suggest-title`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to suggest title")

      setWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? { ...w, title: data.title } : w)),
      )
      if (activeWorkspaceId === workspaceId) {
        setWorkspaceTitle(data.title)
      }
      toast({ title: "Title updated", description: data.title })
    } catch (error) {
      toast({
        title: "Could not suggest title",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setSuggestingTitleId(null)
    }
  }

  const handleMessageDeleted = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    setArtifacts((prev) =>
      prev.map((a) => (a.message_id === messageId ? { ...a, message_id: null } : a)),
    )
  }

  const handleProjectLinked = (projectId: string, projectName: string) => {
    if (!activeWorkspaceId) return
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === activeWorkspaceId ? { ...w, project_id: projectId } : w,
      ),
    )
    setMovies((prev) => {
      if (prev.some((m) => m.id === projectId)) return prev
      return [{ id: projectId, name: projectName } as Movie, ...prev]
    })
  }

  const handleProjectUnlinked = () => {
    if (!activeWorkspaceId) return
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === activeWorkspaceId ? { ...w, project_id: null } : w,
      ),
    )
  }

  const handleArtifactCreated = (newArtifact?: CreativeArtifact) => {
    if (newArtifact) {
      setArtifacts((prev) => [newArtifact, ...prev.filter((a) => a.id !== newArtifact.id)])
    } else if (activeWorkspaceId) {
      loadWorkspaceData(activeWorkspaceId)
    }
  }

  const handleUpdateArtifact = async (id: string, data: Record<string, unknown>) => {
    if (!activeWorkspaceId) return
    const res = await fetch(`/api/creative-workspace/${activeWorkspaceId}/artifacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const result = await res.json()
      setArtifacts((prev) => prev.map((a) => (a.id === id ? result.artifact : a)))
      return { syncMessage: result.syncMessage as string | null | undefined }
    }
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to update artifact")
  }

  const handleDeleteArtifact = async (id: string) => {
    if (!activeWorkspaceId) return
    const res = await fetch(`/api/creative-workspace/${activeWorkspaceId}/artifacts/${id}`, {
      method: "DELETE",
    })
    if (res.ok) {
      setArtifacts((prev) => prev.filter((a) => a.id !== id))
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <WorkspaceSidebar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          isLoading={loadingWorkspaces}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onSelect={handleSelectWorkspace}
          onCreate={handleCreateWorkspace}
          onDelete={handleDeleteWorkspace}
          onSuggestTitle={handleSuggestTitle}
          suggestingTitleId={suggestingTitleId}
        />

        <div className="flex flex-1 flex-col min-h-0">
          {!activeWorkspaceId && !loadingWorkspaces && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Create a workspace or select one to start developing your film with AI
              </p>
            </div>
          )}
          <ChatPanel
            workspaceId={activeWorkspaceId}
            workspaceTitle={workspaceTitle}
            linkedProject={linkedProject}
            messages={messages}
            artifacts={artifacts}
            isLoadingMessages={loadingMessages}
            onMessagesChange={setMessages}
            onWorkspaceTitleChange={handleWorkspaceTitleChange}
            onArtifactCreated={handleArtifactCreated}
            onMessageDeleted={handleMessageDeleted}
            onProjectLinked={handleProjectLinked}
            onProjectUnlinked={handleProjectUnlinked}
            onDeleteWorkspace={() => activeWorkspaceId && handleDeleteWorkspace(activeWorkspaceId)}
          />
        </div>

        {activeWorkspaceId && (
          <ArtifactPanel
            artifacts={artifacts}
            workspaceId={activeWorkspaceId}
            linkedProjectId={linkedProject?.id}
            linkedProjectName={linkedProject?.name}
            onUpdate={handleUpdateArtifact}
            onDelete={handleDeleteArtifact}
            onArtifactRenamed={(artifact) => {
              setArtifacts((prev) =>
                prev.map((a) => (a.id === artifact.id ? artifact : a)),
              )
            }}
          />
        )}
      </div>
    </div>
  )
}
