import { getSupabaseClient } from './supabase'
import { Database } from './supabase'

export type CollaborationSession = Database['public']['Tables']['collaboration_sessions']['Row']

export type CreateCollaborationSessionData = {
  project_id: string
  title?: string
  description?: string
  expires_at?: string | null
  max_participants?: number | null
  allow_guests?: boolean
  allow_edit?: boolean
  allow_delete?: boolean
  allow_add_scenes?: boolean
  allow_edit_scenes?: boolean
  metadata?: Record<string, any>
}

export type UpdateCollaborationSessionData = Partial<CreateCollaborationSessionData> & {
  is_revoked?: boolean
  revoked_at?: string | null
}

export class CollaborationService {
  /**
   * Generate a unique access code
   * @param supabaseClient - Optional Supabase client (for server-side use). If not provided, uses browser client.
   */
  static async generateAccessCode(supabaseClient?: ReturnType<typeof getSupabaseClient>): Promise<string> {
    const supabase = supabaseClient || getSupabaseClient()
    
    // Call the database function to generate a unique code
    const { data, error } = await supabase.rpc('generate_access_code')
    
    if (error) {
      console.error('Error generating access code:', error)
      // Fallback: generate a simple code
      return Math.random().toString(36).substring(2, 10).toUpperCase()
    }
    
    return data
  }

  /**
   * Create a new collaboration session
   * @param sessionData - Session data
   * @param supabaseClient - Optional Supabase client (for server-side use). If not provided, uses browser client.
   */
  static async createSession(
    sessionData: CreateCollaborationSessionData,
    supabaseClient?: ReturnType<typeof getSupabaseClient>
  ): Promise<CollaborationSession> {
    const supabase = supabaseClient || getSupabaseClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    // Generate access code
    const accessCode = await this.generateAccessCode(supabase)

    const { data, error } = await supabase
      .from('collaboration_sessions')
      .insert({
        ...sessionData,
        user_id: user.id,
        access_code: accessCode,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating collaboration session:', error)
      throw error
    }

    return data
  }

  /**
   * Get collaboration session by access code (for guests)
   * This method works for both authenticated and anonymous users
   */
  static async getSessionByCode(accessCode: string): Promise<CollaborationSession | null> {
    const supabase = getSupabaseClient()
    
    // Get all active sessions (RLS allows this for guests)
    const { data, error } = await supabase
      .from('collaboration_sessions')
      .select('*')
      .eq('access_code', accessCode)
      .eq('is_revoked', false)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Error fetching collaboration session:', error)
      throw error
    }

    // Check if expired
    if (data && data.expires_at && new Date(data.expires_at) < new Date()) {
      return null // Expired
    }

    return data
  }

  /**
   * Get collaboration session by ID (for owners)
   */
  static async getSessionById(sessionId: string): Promise<CollaborationSession | null> {
    const supabase = getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase
      .from('collaboration_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching collaboration session:', error)
      throw error
    }

    return data
  }

  /**
   * Get all collaboration sessions for a project
   */
  static async getSessionsByProject(projectId: string): Promise<CollaborationSession[]> {
    const supabase = getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase
      .from('collaboration_sessions')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching collaboration sessions:', error)
      throw error
    }

    return data || []
  }

  /**
   * Update collaboration session
   */
  static async updateSession(
    sessionId: string,
    updates: UpdateCollaborationSessionData
  ): Promise<CollaborationSession> {
    const supabase = getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const { data, error } = await supabase
      .from('collaboration_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating collaboration session:', error)
      throw error
    }

    return data
  }

  /**
   * Revoke a collaboration session
   */
  static async revokeSession(sessionId: string): Promise<CollaborationSession> {
    return this.updateSession(sessionId, {
      is_revoked: true,
      revoked_at: new Date().toISOString(),
    })
  }

  /**
   * Renew a collaboration session (extend expiration)
   */
  static async renewSession(
    sessionId: string,
    newExpiresAt: string | null
  ): Promise<CollaborationSession> {
    return this.updateSession(sessionId, {
      expires_at: newExpiresAt,
      is_revoked: false,
      revoked_at: null,
    })
  }

  /**
   * Delete a collaboration session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    const supabase = getSupabaseClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required')
    }

    const { error } = await supabase
      .from('collaboration_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting collaboration session:', error)
      throw error
    }
  }

  /**
   * Validate access code and return session if valid
   */
  static async validateAccessCode(accessCode: string): Promise<{
    valid: boolean
    session: CollaborationSession | null
    reason?: string
  }> {
    try {
      const session = await this.getSessionByCode(accessCode)
      
      if (!session) {
        return {
          valid: false,
          session: null,
          reason: 'Invalid or expired access code',
        }
      }

      if (session.is_revoked) {
        return {
          valid: false,
          session: null,
          reason: 'This access code has been revoked',
        }
      }

      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        return {
          valid: false,
          session: null,
          reason: 'This access code has expired',
        }
      }

      return {
        valid: true,
        session,
      }
    } catch (error) {
      console.error('Error validating access code:', error)
      return {
        valid: false,
        session: null,
        reason: 'Error validating access code',
      }
    }
  }
}

