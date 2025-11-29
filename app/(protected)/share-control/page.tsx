'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthReady } from '@/components/auth-hooks'
import Header from '@/components/header'
import { ProjectsService, Project } from '@/lib/projects-service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Share2,
  UserPlus,
  X,
  Copy,
  Calendar,
  Shield,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
  Mail,
  User,
  Settings,
  Eye,
  FileEdit,
  Trash,
  Plus,
} from 'lucide-react'
import type { ProjectShare, ProjectSharePermissions, PagePermissions } from '@/lib/project-share-service'

type ShareWithOption = 'email' | 'user_id' | 'key'

const PAGE_OPTIONS = [
  { id: 'screenplay', label: 'Screenplay', icon: FileEdit },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'characters', label: 'Characters', icon: User },
  { id: 'assets', label: 'Assets', icon: Share2 },
  { id: 'storyboards', label: 'Storyboards', icon: FileEdit },
  { id: 'treatments', label: 'Treatments', icon: FileEdit },
  { id: 'locations', label: 'Locations', icon: Share2 },
  { id: 'crew', label: 'Crew', icon: User },
  { id: 'equipment', label: 'Equipment', icon: Share2 },
  { id: 'props', label: 'Props', icon: Share2 },
  { id: 'call_sheets', label: 'Call Sheets', icon: FileEdit },
  { id: 'lighting_plots', label: 'Lighting Plots', icon: Share2 },
] as const

export default function ShareControlPage() {
  const { user, ready } = useAuthReady()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projects, setProjects] = useState<Project[]>([])
  const [shares, setShares] = useState<ProjectShare[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedShare, setSelectedShare] = useState<ProjectShare | null>(null)
  const [shareWithOption, setShareWithOption] = useState<ShareWithOption>('email')
  const [shareEmail, setShareEmail] = useState('')
  const [shareUserId, setShareUserId] = useState('')
  const [shareKey, setShareKey] = useState('')
  const [deadline, setDeadline] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [permissions, setPermissions] = useState<ProjectSharePermissions>({})

  useEffect(() => {
    loadProjects()
    
    // Check for project_id in query params and preload it
    const projectIdFromQuery = searchParams.get('project_id')
    if (projectIdFromQuery) {
      setSelectedProjectId(projectIdFromQuery)
    }
  }, [searchParams])

  useEffect(() => {
    if (selectedProjectId) {
      loadShares()
    } else {
      setShares([])
    }
  }, [selectedProjectId])

  const loadProjects = async () => {
    try {
      setLoadingProjects(true)
      const userProjects = await ProjectsService.getProjects()
      setProjects(userProjects)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load projects',
        variant: 'destructive',
      })
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadShares = async () => {
    if (!selectedProjectId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/project-shares?project_id=${selectedProjectId}`)
      const data = await response.json()

      if (data.success) {
        setShares(data.shares || [])
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to load shares',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load shares',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateShare = async () => {
    if (!selectedProjectId) {
      toast({
        title: 'Error',
        description: 'Please select a project first',
        variant: 'destructive',
      })
      return
    }

    if (shareWithOption === 'email' && !shareEmail) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      })
      return
    }

    if (shareWithOption === 'user_id' && !shareUserId) {
      toast({
        title: 'Error',
        description: 'Please enter a user ID',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/project-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          shared_with_email: shareWithOption === 'email' ? shareEmail : undefined,
          shared_with_user_id: shareWithOption === 'user_id' ? shareUserId : undefined,
          share_key: shareWithOption === 'key' ? shareKey : undefined,
          deadline: deadline || null,
          requires_approval: requiresApproval,
          permissions: permissions,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Project share created successfully',
        })
        setIsCreateDialogOpen(false)
        resetCreateForm()
        loadShares()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create share',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create share',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateShare = async () => {
    if (!selectedShare) return

    try {
      setLoading(true)
      const response = await fetch(`/api/project-shares/${selectedShare.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deadline: deadline || null,
          requires_approval: requiresApproval,
          permissions: permissions,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Share updated successfully',
        })
        setIsEditDialogOpen(false)
        setSelectedShare(null)
        resetEditForm()
        loadShares()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update share',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update share',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeShare = async () => {
    if (!selectedShare) return

    try {
      setLoading(true)
      const response = await fetch(`/api/project-shares/${selectedShare.id}?revoke=true`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Share revoked successfully',
        })
        setIsDeleteDialogOpen(false)
        setSelectedShare(null)
        loadShares()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to revoke share',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke share',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteShare = async () => {
    if (!selectedShare) return

    try {
      setLoading(true)
      const response = await fetch(`/api/project-shares/${selectedShare.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Share deleted successfully',
        })
        setIsDeleteDialogOpen(false)
        setSelectedShare(null)
        loadShares()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete share',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete share',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const resetCreateForm = () => {
    setShareEmail('')
    setShareUserId('')
    setShareKey('')
    setDeadline('')
    setRequiresApproval(false)
    setPermissions({})
    setShareWithOption('email')
  }

  const resetEditForm = () => {
    setDeadline('')
    setRequiresApproval(false)
    setPermissions({})
  }

  const openEditDialog = (share: ProjectShare) => {
    setSelectedShare(share)
    setDeadline(share.deadline ? new Date(share.deadline).toISOString().slice(0, 16) : '')
    setRequiresApproval(share.requires_approval)
    setPermissions((share.permissions as any) || {})
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (share: ProjectShare) => {
    setSelectedShare(share)
    setIsDeleteDialogOpen(true)
  }

  const copyShareKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast({
      title: 'Copied',
      description: 'Share key copied to clipboard',
    })
  }

  const updatePagePermission = (
    page: string,
    action: keyof PagePermissions,
    value: boolean
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [page]: {
        ...(prev[page as keyof ProjectSharePermissions] as PagePermissions || {}),
        [action]: value,
      },
    }))
  }

  const toggleAllPagePermissions = (page: string, enable: boolean) => {
    const pageId = page as keyof ProjectSharePermissions
    const currentPerms = permissions[pageId] as PagePermissions | undefined
    
    // Determine which actions are available for this page
    const actions: (keyof PagePermissions)[] = ['view', 'edit', 'delete']
    
    if (page === 'screenplay' || page === 'timeline') {
      actions.push('add_scenes', 'edit_scenes')
    }
    
    if (page === 'characters' ||
        page === 'assets' ||
        page === 'storyboards' ||
        page === 'treatments' ||
        page === 'locations' ||
        page === 'crew' ||
        page === 'equipment' ||
        page === 'props' ||
        page === 'call_sheets' ||
        page === 'lighting_plots') {
      actions.push('add')
    }
    
    if (page === 'assets') {
      actions.push('upload')
    }
    
    // Create new permissions object with all actions set to the same value
    const newPerms: PagePermissions = {} as PagePermissions
    actions.forEach(action => {
      newPerms[action] = enable
    })
    
    setPermissions((prev) => ({
      ...prev,
      [pageId]: newPerms,
    }))
  }

  const areAllPagePermissionsEnabled = (page: string): boolean => {
    const pageId = page as keyof ProjectSharePermissions
    const pagePerms = permissions[pageId] as PagePermissions | undefined
    
    if (!pagePerms) return false
    
    const actions: (keyof PagePermissions)[] = ['view', 'edit', 'delete']
    
    if (page === 'screenplay' || page === 'timeline') {
      actions.push('add_scenes', 'edit_scenes')
    }
    
    if (page === 'characters' ||
        page === 'assets' ||
        page === 'storyboards' ||
        page === 'treatments' ||
        page === 'locations' ||
        page === 'crew' ||
        page === 'equipment' ||
        page === 'props' ||
        page === 'call_sheets' ||
        page === 'lighting_plots') {
      actions.push('add')
    }
    
    if (page === 'assets') {
      actions.push('upload')
    }
    
    return actions.every(action => pagePerms[action] === true)
  }

  const toggleAllPagesPermissions = (enable: boolean) => {
    const newPermissions: ProjectSharePermissions = {}
    
    PAGE_OPTIONS.forEach((page) => {
      const actions: (keyof PagePermissions)[] = ['view', 'edit', 'delete']
      
      if (page.id === 'screenplay' || page.id === 'timeline') {
        actions.push('add_scenes', 'edit_scenes')
      }
      
      if (page.id === 'characters' ||
          page.id === 'assets' ||
          page.id === 'storyboards' ||
          page.id === 'treatments' ||
          page.id === 'locations' ||
          page.id === 'crew' ||
          page.id === 'equipment' ||
          page.id === 'props' ||
          page.id === 'call_sheets' ||
          page.id === 'lighting_plots') {
        actions.push('add')
      }
      
      if (page.id === 'assets') {
        actions.push('upload')
      }
      
      const pagePerms: PagePermissions = {} as PagePermissions
      actions.forEach(action => {
        pagePerms[action] = enable
      })
      
      newPermissions[page.id as keyof ProjectSharePermissions] = pagePerms
    })
    
    setPermissions(newPermissions)
  }

  const areAllPagesPermissionsEnabled = (): boolean => {
    return PAGE_OPTIONS.every(page => areAllPagePermissionsEnabled(page.id))
  }

  const getPagePermission = (page: string, action: keyof PagePermissions): boolean => {
    const pagePerms = permissions[page as keyof ProjectSharePermissions] as PagePermissions | undefined
    return pagePerms?.[action] || false
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No deadline'
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const isExpired = (share: ProjectShare) => {
    if (!share.deadline) return false
    return new Date(share.deadline) < new Date()
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Share2 className="h-8 w-8" />
            Project Share Control
          </h1>
          <p className="text-muted-foreground">
            Manage who can access your projects and what they can do
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Project</CardTitle>
            <CardDescription>Choose a project to manage sharing settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={loadingProjects}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingProjects ? "Loading projects..." : "Select a project to share"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                    {project.project_type && (
                      <Badge variant="outline" className="ml-2">
                        {project.project_type}
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedProjectId && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Active Shares</h2>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Share
              </Button>
            </div>

            {loading && shares.length === 0 ? (
              <div className="text-center py-8">Loading shares...</div>
            ) : shares.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No shares created yet. Click "Create Share" to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {shares.map((share) => (
                  <Card key={share.id} className={share.is_revoked ? 'opacity-50' : ''}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {share.shared_with_email && (
                              <>
                                <Mail className="h-4 w-4" />
                                {share.shared_with_email}
                              </>
                            )}
                            {share.shared_with_user_id && (
                              <>
                                <User className="h-4 w-4" />
                                User ID: {share.shared_with_user_id.slice(0, 8)}...
                              </>
                            )}
                            {share.share_key && (
                              <>
                                <Key className="h-4 w-4" />
                                Key: {share.share_key}
                              </>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            Created: {new Date(share.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {share.is_revoked ? (
                            <Badge variant="destructive">Revoked</Badge>
                          ) : isExpired(share) ? (
                            <Badge variant="secondary">Expired</Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                          {share.requires_approval && (
                            <Badge variant="outline">
                              <Shield className="h-3 w-3 mr-1" />
                              Approval Required
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {share.deadline && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4" />
                            <span>Deadline: {formatDate(share.deadline)}</span>
                            {isExpired(share) && (
                              <Badge variant="destructive" className="ml-2">Expired</Badge>
                            )}
                          </div>
                        )}
                        {share.share_key && (
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {share.share_key}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyShareKey(share.share_key!)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(share)}
                            disabled={share.is_revoked}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(share)}
                          >
                            {share.is_revoked ? (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-2" />
                                Revoke
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Share Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Project Share</DialogTitle>
              <DialogDescription>
                Share this project with other users by email, user ID, or access key
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Share With</Label>
                <Tabs value={shareWithOption} onValueChange={(v) => setShareWithOption(v as ShareWithOption)}>
                  <TabsList>
                    <TabsTrigger value="email">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </TabsTrigger>
                    <TabsTrigger value="user_id">
                      <User className="h-4 w-4 mr-2" />
                      User ID
                    </TabsTrigger>
                    <TabsTrigger value="key">
                      <Key className="h-4 w-4 mr-2" />
                      Access Key
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="email" className="mt-4">
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                    />
                  </TabsContent>
                  <TabsContent value="user_id" className="mt-4">
                    <Input
                      placeholder="User ID"
                      value={shareUserId}
                      onChange={(e) => setShareUserId(e.target.value)}
                    />
                  </TabsContent>
                  <TabsContent value="key" className="mt-4">
                    <Input
                      placeholder="Leave empty to auto-generate"
                      value={shareKey}
                      onChange={(e) => setShareKey(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      If left empty, a unique key will be generated automatically
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label>Deadline (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="requires-approval"
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                />
                <Label htmlFor="requires-approval">
                  Require approval for major changes
                </Label>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Page Permissions</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllPagesPermissions(!areAllPagesPermissionsEnabled())}
                  >
                    {areAllPagesPermissionsEnabled() ? 'Disable All Pages' : 'Enable All Pages'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PAGE_OPTIONS.map((page) => {
                    const Icon = page.icon
                    return (
                      <Card key={page.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {page.label}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => toggleAllPagePermissions(page.id, !areAllPagePermissionsEnabled(page.id))}
                            >
                              {areAllPagePermissionsEnabled(page.id) ? 'Disable All' : 'Enable All'}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">View</Label>
                            <Switch
                              checked={getPagePermission(page.id, 'view')}
                              onCheckedChange={(checked) =>
                                updatePagePermission(page.id, 'view', checked)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Edit</Label>
                            <Switch
                              checked={getPagePermission(page.id, 'edit')}
                              onCheckedChange={(checked) =>
                                updatePagePermission(page.id, 'edit', checked)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Delete</Label>
                            <Switch
                              checked={getPagePermission(page.id, 'delete')}
                              onCheckedChange={(checked) =>
                                updatePagePermission(page.id, 'delete', checked)
                              }
                            />
                          </div>
                          {(page.id === 'screenplay' || page.id === 'timeline') && (
                            <>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Add Scenes</Label>
                                <Switch
                                  checked={getPagePermission(page.id, 'add_scenes') || false}
                                  onCheckedChange={(checked) =>
                                    updatePagePermission(page.id, 'add_scenes', checked)
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Edit Scenes</Label>
                                <Switch
                                  checked={getPagePermission(page.id, 'edit_scenes') || false}
                                  onCheckedChange={(checked) =>
                                    updatePagePermission(page.id, 'edit_scenes', checked)
                                  }
                                />
                              </div>
                            </>
                          )}
                          {(page.id === 'characters' ||
                            page.id === 'assets' ||
                            page.id === 'storyboards' ||
                            page.id === 'treatments' ||
                            page.id === 'locations' ||
                            page.id === 'crew' ||
                            page.id === 'equipment' ||
                            page.id === 'props' ||
                            page.id === 'call_sheets' ||
                            page.id === 'lighting_plots') && (
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Add</Label>
                              <Switch
                                checked={getPagePermission(page.id, 'add') || false}
                                onCheckedChange={(checked) =>
                                  updatePagePermission(page.id, 'add', checked)
                                }
                              />
                            </div>
                          )}
                          {page.id === 'assets' && (
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Upload</Label>
                              <Switch
                                checked={getPagePermission(page.id, 'upload') || false}
                                onCheckedChange={(checked) =>
                                  updatePagePermission(page.id, 'upload', checked)
                                }
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateShare} disabled={loading}>
                Create Share
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Share Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Project Share</DialogTitle>
              <DialogDescription>
                Update permissions and settings for this share
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Deadline (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-requires-approval"
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                />
                <Label htmlFor="edit-requires-approval">
                  Require approval for major changes
                </Label>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Page Permissions</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllPagesPermissions(!areAllPagesPermissionsEnabled())}
                  >
                    {areAllPagesPermissionsEnabled() ? 'Disable All Pages' : 'Enable All Pages'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PAGE_OPTIONS.map((page) => {
                    const Icon = page.icon
                    return (
                      <Card key={page.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {page.label}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => toggleAllPagePermissions(page.id, !areAllPagePermissionsEnabled(page.id))}
                            >
                              {areAllPagePermissionsEnabled(page.id) ? 'Disable All' : 'Enable All'}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">View</Label>
                            <Switch
                              checked={getPagePermission(page.id, 'view')}
                              onCheckedChange={(checked) =>
                                updatePagePermission(page.id, 'view', checked)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Edit</Label>
                            <Switch
                              checked={getPagePermission(page.id, 'edit')}
                              onCheckedChange={(checked) =>
                                updatePagePermission(page.id, 'edit', checked)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Delete</Label>
                            <Switch
                              checked={getPagePermission(page.id, 'delete')}
                              onCheckedChange={(checked) =>
                                updatePagePermission(page.id, 'delete', checked)
                              }
                            />
                          </div>
                          {(page.id === 'screenplay' || page.id === 'timeline') && (
                            <>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Add Scenes</Label>
                                <Switch
                                  checked={getPagePermission(page.id, 'add_scenes') || false}
                                  onCheckedChange={(checked) =>
                                    updatePagePermission(page.id, 'add_scenes', checked)
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Edit Scenes</Label>
                                <Switch
                                  checked={getPagePermission(page.id, 'edit_scenes') || false}
                                  onCheckedChange={(checked) =>
                                    updatePagePermission(page.id, 'edit_scenes', checked)
                                  }
                                />
                              </div>
                            </>
                          )}
                          {(page.id === 'characters' ||
                            page.id === 'assets' ||
                            page.id === 'storyboards' ||
                            page.id === 'treatments' ||
                            page.id === 'locations' ||
                            page.id === 'crew' ||
                            page.id === 'equipment' ||
                            page.id === 'props' ||
                            page.id === 'call_sheets' ||
                            page.id === 'lighting_plots') && (
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Add</Label>
                              <Switch
                                checked={getPagePermission(page.id, 'add') || false}
                                onCheckedChange={(checked) =>
                                  updatePagePermission(page.id, 'add', checked)
                                }
                              />
                            </div>
                          )}
                          {page.id === 'assets' && (
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Upload</Label>
                              <Switch
                                checked={getPagePermission(page.id, 'upload') || false}
                                onCheckedChange={(checked) =>
                                  updatePagePermission(page.id, 'upload', checked)
                                }
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateShare} disabled={loading}>
                Update Share
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete/Revoke Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {selectedShare?.is_revoked ? 'Delete Share' : 'Revoke Share'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedShare?.is_revoked
                  ? 'Are you sure you want to permanently delete this share? This action cannot be undone.'
                  : 'Are you sure you want to revoke this share? The user will no longer have access to the project.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={selectedShare?.is_revoked ? handleDeleteShare : handleRevokeShare}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {selectedShare?.is_revoked ? 'Delete' : 'Revoke'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

