import { getSupabaseClient } from './supabase'
import { Database } from './supabase'

export type ProjectShare = Database['public']['Tables']['project_shares']['Row']

export type PagePermissions = {
  view: boolean
  edit: boolean
  delete: boolean
  add_scenes?: boolean
  edit_scenes?: boolean
  add?: boolean
  upload?: boolean
}

export type ProjectSharePermissions = {
  screenplay?: PagePermissions
  timeline?: PagePermissions
  characters?: PagePermissions
  assets?: PagePermissions
  storyboards?: PagePermissions
  treatments?: PagePermissions
  locations?: PagePermissions
  crew?: PagePermissions
  equipment?: PagePermissions
  props?: PagePermissions
  call_sheets?: PagePermissions
  lighting_plots?: PagePermissions
}

export type CreateProjectShareData = {
  project_id: string
  shared_with_user_id?: string
  shared_with_email?: string
  share_key?: string | null
  deadline?: string | null
  requires_approval?: boolean
  permissions?: ProjectSharePermissions
  metadata?: Record<string, any>
}

export type UpdateProjectShareData = Partial<CreateProjectShareData> & {
  is_revoked?: boolean
  revoked_at?: string | null
}

export class ProjectShareService {
  /**
   * Generate a unique share key
   */
  static async generateShareKey(supabaseClient?: ReturnType<typeof getSupabaseClient>): Promise<string> {
    const supabase = supabaseClient || getSupabaseClient()
    
    const { data, error } = await supabase.rpc('generate_share_key')
    
    if (error) {
      console.error('Error generating share key:', error)
      // Fallback: generate a simple key
      return Math.random().toString(36).substring(2, 14).toUpperCase()
    }
    
    return data
  }

  /**
   * Create a new project share
   */
  static async createShare(
    shareData: CreateProjectShareData,
    supabaseClient?: ReturnType<typeof getSupabaseClient>
  ): Promise<ProjectShare> {
    const supabase = supabaseClient || getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    // Generate share key if not provided
    let shareKey = shareData.share_key
    if (!shareKey) {
      shareKey = await this.generateShareKey(supabase)
    }

    // Default permissions if not provided
    const defaultPermissions: ProjectSharePermissions = {
      screenplay: { view: true, edit: false, delete: false, add_scenes: false, edit_scenes: false },
      timeline: { view: true, edit: false, delete: false, add_scenes: false, edit_scenes: false },
      characters: { view: true, edit: false, delete: false, add: false },
      assets: { view: true, edit: false, delete: false, upload: false },
      storyboards: { view: true, edit: false, delete: false, add: false },
      treatments: { view: true, edit: false, delete: false, add: false },
      locations: { view: true, edit: false, delete: false, add: false },
      crew: { view: true, edit: false, delete: false, add: false },
      equipment: { view: true, edit: false, delete: false, add: false },
      props: { view: true, edit: false, delete: false, add: false },
      call_sheets: { view: true, edit: false, delete: false, add: false },
      lighting_plots: { view: true, edit: false, delete: false, add: false },
    }

    const permissions = shareData.permissions 
      ? { ...defaultPermissions, ...shareData.permissions }
      : defaultPermissions

    const { data, error } = await supabase
      .from('project_shares')
      .insert({
        project_id: shareData.project_id,
        owner_id: user.id,
        shared_with_user_id: shareData.shared_with_user_id || null,
        shared_with_email: shareData.shared_with_email || null,
        share_key: shareKey,
        deadline: shareData.deadline || null,
        requires_approval: shareData.requires_approval || false,
        permissions: permissions as any,
        metadata: shareData.metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating project share:', error)
      throw error
    }

    return data
  }

  /**
   * Get all shares for a project (for owner)
   * @param projectId - Project ID
   * @param supabaseClient - Optional Supabase client (for server-side use). If not provided, uses browser client.
   */
  static async getSharesByProject(
    projectId: string,
    supabaseClient?: ReturnType<typeof getSupabaseClient>
  ): Promise<ProjectShare[]> {
    const supabase = supabaseClient || getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase
      .from('project_shares')
      .select('*')
      .eq('project_id', projectId)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching project shares:', error)
      throw error
    }

    return data || []
  }

  /**
   * Get shares for current user (shared with them)
   * Checks both user_id and email matches
   */
  static async getSharesForUser(
    supabaseClient?: ReturnType<typeof getSupabaseClient>
  ): Promise<ProjectShare[]> {
    const supabase = supabaseClient || getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    // Get user email from auth
    const userEmail = user.email

    // Get shares by user_id OR email
    const { data, error } = await supabase
      .from('project_shares')
      .select('*')
      .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${userEmail}`)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user shares:', error)
      throw error
    }

    // Filter out expired shares
    const now = new Date()
    return (data || []).filter(share => 
      !share.deadline || new Date(share.deadline) > now
    )
  }

  /**
   * Get share by ID
   * @param shareId - Share ID
   * @param supabaseClient - Optional Supabase client (for server-side use). If not provided, uses browser client.
   */
  static async getShareById(
    shareId: string,
    supabaseClient?: ReturnType<typeof getSupabaseClient>
  ): Promise<ProjectShare | null> {
    const supabase = supabaseClient || getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase
      .from('project_shares')
      .select('*')
      .eq('id', shareId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching share:', error)
      throw error
    }

    // Check if user is owner or shared user
    if (data.owner_id !== user.id && data.shared_with_user_id !== user.id) {
      return null
    }

    return data
  }

  /**
   * Get share by share key
   */
  static async getShareByKey(shareKey: string): Promise<ProjectShare | null> {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('project_shares')
      .select('*')
      .eq('share_key', shareKey)
      .eq('is_revoked', false)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching share by key:', error)
      throw error
    }

    // Check if expired
    if (data.deadline && new Date(data.deadline) < new Date()) {
      return null
    }

    return data
  }

  /**
   * Update project share
   * @param shareId - Share ID
   * @param updates - Update data
   * @param supabaseClient - Optional Supabase client (for server-side use). If not provided, uses browser client.
   */
  static async updateShare(
    shareId: string,
    updates: UpdateProjectShareData,
    supabaseClient?: ReturnType<typeof getSupabaseClient>
  ): Promise<ProjectShare> {
    const supabase = supabaseClient || getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase
      .from('project_shares')
      .update(updates)
      .eq('id', shareId)
      .eq('owner_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating project share:', error)
      throw error
    }

    return data
  }

  /**
   * Revoke a project share
   * @param shareId - Share ID
   * @param supabaseClient - Optional Supabase client (for server-side use). If not provided, uses browser client.
   */
  static async revokeShare(
    shareId: string,
    supabaseClient?: ReturnType<typeof getSupabaseClient>
  ): Promise<ProjectShare> {
    return this.updateShare(shareId, {
      is_revoked: true,
      revoked_at: new Date().toISOString(),
    }, supabaseClient)
  }

  /**
   * Delete a project share
   * @param shareId - Share ID
   * @param supabaseClient - Optional Supabase client (for server-side use). If not provided, uses browser client.
   */
  static async deleteShare(
    shareId: string,
    supabaseClient?: ReturnType<typeof getSupabaseClient>
  ): Promise<void> {
    const supabase = supabaseClient || getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const { error } = await supabase
      .from('project_shares')
      .delete()
      .eq('id', shareId)
      .eq('owner_id', user.id)

    if (error) {
      console.error('Error deleting project share:', error)
      throw error
    }
  }

  /**
   * Check if user has permission for a specific page/feature
   */
  static async checkPermission(
    projectId: string,
    page: keyof ProjectSharePermissions,
    action: keyof PagePermissions
  ): Promise<boolean> {
    const supabase = getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return false
    }

    // Check if user is project owner
    const { data: project } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single()

    if (project && project.user_id === user.id) {
      return true // Owner has all permissions
    }

    // Check if user has a share
    const { data: share } = await supabase
      .from('project_shares')
      .select('permissions')
      .eq('project_id', projectId)
      .eq('shared_with_user_id', user.id)
      .eq('is_revoked', false)
      .single()

    if (!share || !share.permissions) {
      return false
    }

    const pagePerms = (share.permissions as any)[page] as PagePermissions | undefined
    if (!pagePerms) {
      return false
    }

    return pagePerms[action] === true
  }
}

