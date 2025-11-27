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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Shield, Users, Key, Plus, Trash2, Copy, Check, X, Calendar, Hash } from 'lucide-react'
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
}

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'creator' | 'studio' | 'production' | 'ceo'
  created_at: string
}

export default function UsersInvitesAdminPage() {
  const { user, userId, ready } = useAuthReady()
  const router = useRouter()
  const { toast } = useToast()
  
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoadingRole, setIsLoadingRole] = useState(true)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)
  
  // Create invite code form
  const [newCodeRole, setNewCodeRole] = useState<'user' | 'creator' | 'studio' | 'production'>('user')
  const [newCodeMaxUses, setNewCodeMaxUses] = useState<string>('')
  const [newCodeExpiresAt, setNewCodeExpiresAt] = useState<string>('')
  const [newCodeNotes, setNewCodeNotes] = useState<string>('')
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
      // User management will be added later
      // For now, this is a placeholder
    } catch (error) {
      console.error('Error loading users:', error)
    }
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
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create invite code')
      }

      const data = await response.json()
      toast({
        title: "Success",
        description: `Invite code created: ${data.inviteCode.code}`,
        variant: "default",
      })

      // Reset form
      setNewCodeRole('user')
      setNewCodeMaxUses('')
      setNewCodeExpiresAt('')
      setNewCodeNotes('')
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
                        <TableHead>Role</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Max Uses</TableHead>
                        <TableHead>Expires</TableHead>
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
              <p className="text-muted-foreground">
                User management interface coming soon. For now, you can manage user roles directly in the database.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

