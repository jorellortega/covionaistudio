'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthReady } from '@/components/auth-hooks'
import { getSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  BLOCKABLE_ROUTES,
  mergeBlockedRoutesFromEditor,
  splitBlockedRoutesForEditor,
  type BlockableRoute,
} from '@/lib/blockable-routes'
import { Shield, Users, Key, Plus, Trash2, Copy, Check, X, Link2, Ban } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import Header from '@/components/header'

interface InviteCode {
  id: string
  code: string
  role: 'user' | 'creator' | 'studio' | 'production'
  created_by: string | null
  max_uses: number | null
  used_count: number
  expires_at: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  account_access_expires_at?: string | null
  initial_blocked_routes?: string[] | null
  invite_link_token?: string | null
}

interface ManagedUser {
  id: string
  email: string
  name: string
  role: 'user' | 'creator' | 'studio' | 'production' | 'ceo'
  created_at: string
  login_disabled?: boolean
  access_expires_at?: string | null
  blocked_routes?: unknown
}

function parseBlockedRoutesInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function blockedRoutesList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim())
}

function blockedRoutesSummary(value: unknown): string {
  const list = blockedRoutesList(value)
  if (list.length === 0) return 'No blocks'
  if (list.length === 1) return list[0]
  return `${list.length} paths`
}

function localDatetimeFromIso(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function signupLinkForInvite(code: InviteCode): string {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  const base = `${origin}/login?mode=signup&code=${encodeURIComponent(code.code)}`
  if (code.invite_link_token) {
    return `${base}&st=${encodeURIComponent(code.invite_link_token)}`
  }
  return base
}

function UserAccessEditor({
  user,
  saving,
  onToggleDisabled,
  onSaveAccess,
  onSaveBlockedRoutes,
}: {
  user: ManagedUser
  saving: boolean
  onToggleDisabled: (id: string, v: boolean) => void
  onSaveAccess: (id: string, expiresLocal: string) => void
  onSaveBlockedRoutes: (id: string, paths: string[]) => Promise<boolean>
}) {
  const { toast } = useToast()
  const [permanentAccess, setPermanentAccess] = useState(() => !user.access_expires_at)
  const [expires, setExpires] = useState(() => localDatetimeFromIso(user.access_expires_at))
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false)
  const [selectedPages, setSelectedPages] = useState<string[]>(() => splitBlockedRoutesForEditor(user.blocked_routes).catalogSelected)
  const [extraPathsRaw, setExtraPathsRaw] = useState(() => splitBlockedRoutesForEditor(user.blocked_routes).extraLines)

  const routesByGroup = BLOCKABLE_ROUTES.reduce<Record<string, BlockableRoute[]>>((acc, r) => {
    if (!acc[r.group]) acc[r.group] = []
    acc[r.group].push(r)
    return acc
  }, {})

  useEffect(() => {
    setPermanentAccess(!user.access_expires_at)
    setExpires(localDatetimeFromIso(user.access_expires_at))
  }, [user])

  function openBlockedDialog() {
    const { catalogSelected, extraLines } = splitBlockedRoutesForEditor(user.blocked_routes)
    setSelectedPages(catalogSelected)
    setExtraPathsRaw(extraLines)
    setBlockedDialogOpen(true)
  }

  function togglePage(path: string) {
    setSelectedPages((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]))
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{user.email}</TableCell>
      <TableCell>{user.name}</TableCell>
      <TableCell>
        <span className="text-xs rounded bg-muted px-2 py-1">{user.role}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!user.login_disabled}
            onCheckedChange={(v) => onToggleDisabled(user.id, v)}
            disabled={saving}
          />
          <span className="text-xs text-muted-foreground">Login off</span>
        </div>
      </TableCell>
      <TableCell className="min-w-[220px] space-y-2">
        <div className="flex items-center gap-2">
          <Switch
            id={`perm-${user.id}`}
            checked={permanentAccess}
            onCheckedChange={(v) => {
              setPermanentAccess(v)
              if (v) {
                setExpires('')
              } else {
                setExpires(localDatetimeFromIso(user.access_expires_at))
              }
            }}
            disabled={saving}
          />
          <Label htmlFor={`perm-${user.id}`} className="text-xs font-normal cursor-pointer">
            Permanent access
          </Label>
        </div>
        {!permanentAccess ? (
          <>
            <Label className="text-xs text-muted-foreground">Expires on</Label>
            <Input
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              disabled={saving}
            />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No end date. Turn off &apos;Permanent access&apos; to add an expiry, or change it anytime with Save.
          </p>
        )}
      </TableCell>
      <TableCell className="max-w-[200px]">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground truncate" title={blockedRoutesList(user.blocked_routes).join(', ')}>
            {blockedRoutesSummary(user.blocked_routes)}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 w-full sm:w-auto"
            disabled={saving}
            onClick={openBlockedDialog}
          >
            <Ban className="h-3 w-3" />
            Blocked routes
          </Button>
          <Dialog open={blockedDialogOpen} onOpenChange={setBlockedDialogOpen}>
            <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>Blocked pages</DialogTitle>
                <DialogDescription>
                  {user.email} — choose app areas this user cannot open. Matching uses path prefixes (sub-routes are
                  included).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedPages([])} disabled={saving}>
                    Clear pages
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedPages(BLOCKABLE_ROUTES.map((r) => r.path))}
                    disabled={saving}
                  >
                    Select all pages
                  </Button>
                </div>
                <ScrollArea className="h-[min(50vh,360px)] pr-3">
                  <div className="space-y-5">
                    {Object.entries(routesByGroup).map(([group, routes]) => (
                      <div key={group} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {routes.map((r) => {
                            const id = `block-${user.id}-${r.path.replace(/\//g, '-')}`
                            const checked = selectedPages.includes(r.path)
                            return (
                              <div key={r.path} className="flex items-start gap-2 rounded-md border border-border/60 p-2">
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  onCheckedChange={() => togglePage(r.path)}
                                  disabled={saving}
                                />
                                <label htmlFor={id} className="text-sm leading-tight cursor-pointer select-none">
                                  <span className="font-medium">{r.label}</span>
                                  <span className="block text-[11px] text-muted-foreground font-mono">{r.path}</span>
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="space-y-2">
                  <Label htmlFor={`routes-extra-${user.id}`} className="text-sm">
                    Additional paths (optional)
                  </Label>
                  <Textarea
                    id={`routes-extra-${user.id}`}
                    rows={2}
                    className="font-mono text-xs"
                    placeholder="One path per line, e.g. /temp-kling"
                    value={extraPathsRaw}
                    onChange={(e) => setExtraPathsRaw(e.target.value)}
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only needed for URLs not in the list. Save applies immediately.
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setBlockedDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    const merged = mergeBlockedRoutesFromEditor(selectedPages, extraPathsRaw)
                    const ok = await onSaveBlockedRoutes(user.id, merged)
                    if (ok) setBlockedDialogOpen(false)
                  }}
                >
                  Save routes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="secondary"
          disabled={saving}
          onClick={() => {
            if (!permanentAccess && !expires.trim()) {
              toast({
                title: 'Expiry required',
                description: 'Choose an end date, or turn Permanent access back on.',
                variant: 'destructive',
              })
              return
            }
            onSaveAccess(user.id, permanentAccess ? '' : expires)
          }}
        >
          Save access
        </Button>
      </TableCell>
    </TableRow>
  )
}

export default function UsersInvitesAdminPage() {
  const { user, userId, ready } = useAuthReady()
  const router = useRouter()
  const { toast } = useToast()
  
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoadingRole, setIsLoadingRole] = useState(true)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  
  // Create invite code form
  const [newCodeRole, setNewCodeRole] = useState<'user' | 'creator' | 'studio' | 'production'>('user')
  const [newCodeMaxUses, setNewCodeMaxUses] = useState<string>('')
  const [newCodeExpiresAt, setNewCodeExpiresAt] = useState<string>('')
  const [newCodeNotes, setNewCodeNotes] = useState<string>('')
  const [newCodeAccountAccessExpires, setNewCodeAccountAccessExpires] = useState<string>('')
  const [newCodeInviteProgramExpiry, setNewCodeInviteProgramExpiry] = useState(false)
  const [newCodeBlockedRoutes, setNewCodeBlockedRoutes] = useState<string>('')
  const [newCodeSecretLink, setNewCodeSecretLink] = useState(false)
  const [creatingCode, setCreatingCode] = useState(false)

  useEffect(() => {
    if (!ready) return

    async function checkAccess() {
      if (!userId || !user?.id) {
        router.push('/login')
        return
      }

      try {
        // Fetch user role directly from database
        const supabase = getSupabaseClient()
        const userIdToUse = userId || user.id
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', userIdToUse)
          .single()

        let role = 'user'
        
        if (userError) {
          console.error('Error fetching user role:', userError)
          // Try by email as fallback
          if (user.email) {
            const { data: emailData } = await supabase
              .from('users')
              .select('role')
              .eq('email', user.email)
              .single()
            
            if (emailData) {
              role = emailData.role || 'user'
            }
          }
        } else {
          role = userData?.role || 'user'
        }

        setUserRole(role)
        setIsLoadingRole(false)

        if (role !== 'ceo') {
          toast({
            title: "Access Denied",
            description: "You need CEO role to access this page.",
            variant: "destructive",
          })
          router.push('/dashboard')
          return
        }

        // Load data
        await loadInviteCodes()
        await loadUsers()
        setLoading(false)
      } catch (error) {
        console.error('Error checking access:', error)
        setIsLoadingRole(false)
        setLoading(false) // Make sure loading is set to false even on error
      }
    }

    checkAccess()
  }, [user, userId, ready, router, toast])

  async function loadInviteCodes() {
    try {
      const response = await fetch('/api/invite-codes')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to load invite codes')
      }
      const data = await response.json()
      setInviteCodes(data.inviteCodes || [])
    } catch (error: any) {
      console.error('Error loading invite codes:', error)
      // Don't show toast if it's just that the table doesn't exist yet (migration not run)
      if (!error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        toast({
          title: "Error",
          description: error.message || "Failed to load invite codes. Make sure migrations 060 and 061 are run.",
          variant: "destructive",
        })
      }
      // Set empty array so page can still render
      setInviteCodes([])
    }
  }

  async function loadUsers() {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select(
          'id, email, name, role, login_disabled, access_expires_at, blocked_routes, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(400)

      if (error) throw error
      setUsers((data as ManagedUser[]) || [])
    } catch (error) {
      console.error('Error loading users:', error)
      setUsers([])
    }
  }

  async function saveUserAccess(
    userId: string,
    fields: {
      login_disabled?: boolean
      access_expires_at?: string | null
      blocked_route_list?: string[]
    }
  ): Promise<boolean> {
    setSavingUserId(userId)
    try {
      const supabase = getSupabaseClient()
      const update: Record<string, unknown> = {}
      if (fields.login_disabled !== undefined) update.login_disabled = fields.login_disabled
      if (fields.access_expires_at !== undefined) {
        update.access_expires_at = fields.access_expires_at || null
      }
      if (fields.blocked_route_list !== undefined) {
        update.blocked_routes = fields.blocked_route_list
      }

      const { error } = await supabase.from('users').update(update).eq('id', userId)
      if (error) throw error

      toast({ title: 'Saved', description: 'User access settings updated.' })
      await loadUsers()
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
      return false
    } finally {
      setSavingUserId(null)
    }
  }

  function handleSaveUserAccessFields(userId: string, expiresLocal: string) {
    const iso = expiresLocal.trim() ? new Date(expiresLocal).toISOString() : null
    void saveUserAccess(userId, {
      access_expires_at: iso,
    })
  }

  async function handleSaveBlockedRoutes(userId: string, paths: string[]) {
    return saveUserAccess(userId, {
      blocked_route_list: paths,
    })
  }

  async function createInviteCode() {
    if (!newCodeRole) {
      toast({
        title: "Error",
        description: "Please select a role",
        variant: "destructive",
      })
      return
    }

    setCreatingCode(true)
    try {
      const response = await fetch('/api/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newCodeRole,
          maxUses: newCodeMaxUses ? parseInt(newCodeMaxUses) : null,
          expiresAt: newCodeExpiresAt || null,
          notes: newCodeNotes || null,
          accountAccessExpiresAt:
            newCodeInviteProgramExpiry && newCodeAccountAccessExpires
              ? new Date(newCodeAccountAccessExpires).toISOString()
              : null,
          initialBlockedRoutes: parseBlockedRoutesInput(newCodeBlockedRoutes),
          requireSecretLink: newCodeSecretLink,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create invite code')
      }

      const data = await response.json()
      toast({
        title: "Success",
        description: data.signupUrl
          ? `Invite created. Copy the signup link from the table (secret links are only shown once in the link).`
          : `Invite code created: ${data.inviteCode.code}`,
        variant: "default",
      })

      // Reset form
      setNewCodeRole('user')
      setNewCodeMaxUses('')
      setNewCodeExpiresAt('')
      setNewCodeNotes('')
      setNewCodeAccountAccessExpires('')
      setNewCodeInviteProgramExpiry(false)
      setNewCodeBlockedRoutes('')
      setNewCodeSecretLink(false)
      setShowCreateDialog(false)

      // Reload codes
      await loadInviteCodes()
    } catch (error: any) {
      console.error('Error creating invite code:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create invite code",
        variant: "destructive",
      })
    } finally {
      setCreatingCode(false)
    }
  }

  async function deleteInviteCode(id: string) {
    if (!confirm('Are you sure you want to delete this invite code?')) return

    try {
      const response = await fetch(`/api/invite-codes/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete invite code')

      toast({
        title: "Success",
        description: "Invite code deleted",
        variant: "default",
      })

      await loadInviteCodes()
    } catch (error: any) {
      console.error('Error deleting invite code:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete invite code",
        variant: "destructive",
      })
    }
  }

  async function toggleInviteCode(id: string, isActive: boolean) {
    try {
      const response = await fetch(`/api/invite-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (!response.ok) throw new Error('Failed to update invite code')

      await loadInviteCodes()
    } catch (error: any) {
      console.error('Error toggling invite code:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update invite code",
        variant: "destructive",
      })
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
      variant: "default",
    })
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString()
  }

  function isExpired(expiresAt: string | null) {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  function isMaxedOut(code: InviteCode) {
    if (!code.max_uses) return false
    return code.used_count >= code.max_uses
  }

  if (!ready || isLoadingRole) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (userRole !== 'ceo') {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-amber-500" />
              <div>
                <h1 className="text-3xl font-bold">User & Invite Management</h1>
                <p className="text-muted-foreground">Manage users and create invite codes for free signups</p>
              </div>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Invite Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Invite Code</DialogTitle>
                  <DialogDescription>
                    Generate an invite code that allows free signups with a specific role
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Role</Label>
                    <Select value={newCodeRole} onValueChange={(v: any) => setNewCodeRole(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="creator">Creator</SelectItem>
                        <SelectItem value="studio">Studio</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Max Uses (leave empty for unlimited)</Label>
                    <Input
                      type="number"
                      value={newCodeMaxUses}
                      onChange={(e) => setNewCodeMaxUses(e.target.value)}
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div>
                    <Label>Expires At (leave empty for never)</Label>
                    <Input
                      type="datetime-local"
                      value={newCodeExpiresAt}
                      onChange={(e) => setNewCodeExpiresAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Notes (optional)</Label>
                    <Input
                      value={newCodeNotes}
                      onChange={(e) => setNewCodeNotes(e.target.value)}
                      placeholder="e.g., For friend John"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="invite-program-expiry"
                        checked={newCodeInviteProgramExpiry}
                        onCheckedChange={(v) => {
                          setNewCodeInviteProgramExpiry(v)
                          if (!v) setNewCodeAccountAccessExpires('')
                        }}
                      />
                      <Label htmlFor="invite-program-expiry" className="text-sm font-normal cursor-pointer">
                        Limit account lifetime for signups from this invite
                      </Label>
                    </div>
                    {newCodeInviteProgramExpiry ? (
                      <>
                        <Label>Accounts expire on</Label>
                        <Input
                          type="datetime-local"
                          value={newCodeAccountAccessExpires}
                          onChange={(e) => setNewCodeAccountAccessExpires(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Each new account gets this date as their access end. You can still edit individuals later.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Off = permanent access for everyone who signs up with this invite (until you add an end date on the user row).
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Blocked routes for new accounts (optional)</Label>
                    <Input
                      value={newCodeBlockedRoutes}
                      onChange={(e) => setNewCodeBlockedRoutes(e.target.value)}
                      placeholder="/admin/users-invites, /settings-ai"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Comma-separated path prefixes. Use role &apos;user&apos; for interns/students.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="secret-link"
                      checked={newCodeSecretLink}
                      onCheckedChange={setNewCodeSecretLink}
                    />
                    <Label htmlFor="secret-link" className="text-sm font-normal cursor-pointer">
                      Secret signup link (code alone will not work on the public signup page)
                    </Label>
                  </div>
                  <Button onClick={createInviteCode} disabled={creatingCode} className="w-full">
                    {creatingCode ? 'Creating...' : 'Create Invite Code'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Invite Codes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Invite Codes
              </CardTitle>
              <CardDescription>
                Manage invite codes for free signups. Users can enter these codes during signup to skip payment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading invite codes...</p>
              ) : inviteCodes.length === 0 ? (
                <p className="text-muted-foreground">No invite codes yet. Create one to get started.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Signup link</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Max Uses</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Default expiry (invite)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inviteCodes.map((code) => {
                        const expired = isExpired(code.expires_at)
                        const maxed = isMaxedOut(code)
                        const canUse = code.is_active && !expired && !maxed

                        return (
                          <TableRow key={code.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                                  {code.code}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(code.code)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => copyToClipboard(signupLinkForInvite(code))}
                              >
                                <Link2 className="h-3 w-3" />
                                Copy
                              </Button>
                              {code.invite_link_token ? (
                                <p className="text-[10px] text-muted-foreground mt-1">Secret link</p>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                                {code.role}
                              </span>
                            </TableCell>
                            <TableCell>{code.used_count}</TableCell>
                            <TableCell>{code.max_uses || '∞'}</TableCell>
                            <TableCell>
                              {code.expires_at ? (
                                <span className={expired ? 'text-red-500' : ''}>
                                  {formatDate(code.expires_at)}
                                </span>
                              ) : (
                                'Never'
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {code.account_access_expires_at
                                ? formatDate(code.account_access_expires_at)
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {canUse ? (
                                  <span className="flex items-center gap-1 text-green-500">
                                    <Check className="h-3 w-3" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-red-500">
                                    <X className="h-3 w-3" />
                                    {expired ? 'Expired' : maxed ? 'Maxed' : 'Inactive'}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {code.notes || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(code.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleInviteCode(code.id, code.is_active)}
                                >
                                  {code.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteInviteCode(code.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Users Section - Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users
              </CardTitle>
              <CardDescription>
                View and manage user accounts and roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-muted-foreground">No users loaded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Login</TableHead>
                        <TableHead>Account access</TableHead>
                        <TableHead>Blocked routes</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <UserAccessEditor
                          key={u.id}
                          user={u}
                          saving={savingUserId === u.id}
                          onToggleDisabled={(id, v) => void saveUserAccess(id, { login_disabled: v })}
                          onSaveAccess={handleSaveUserAccessFields}
                          onSaveBlockedRoutes={handleSaveBlockedRoutes}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

