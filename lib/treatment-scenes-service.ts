import { getSupabaseClient } from './supabase'

export interface TreatmentScene {
  id: string
  treatment_id: string
  user_id: string
  name: string
  description?: string
  scene_number?: string
  location?: string
  characters?: string[]
  shot_type?: string
  mood?: string
  notes?: string
  status?: string
  content?: string
  metadata?: Record<string, any>
  order_index?: number
  created_at: string
  updated_at: string
}

export interface CreateTreatmentSceneData {
  treatment_id: string
  name: string
  description?: string
  scene_number?: string
  location?: string
  characters?: string[]
  shot_type?: string
  mood?: string
  notes?: string
  status?: string
  content?: string
  metadata?: Record<string, any>
  order_index?: number
}

export interface UpdateTreatmentSceneData {
  name?: string
  description?: string
  scene_number?: string
  location?: string
  characters?: string[]
  shot_type?: string
  mood?: string
  notes?: string
  status?: string
  content?: string
  metadata?: Record<string, any>
  order_index?: number
}

export class TreatmentScenesService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getTreatmentScenes(treatmentId: string): Promise<TreatmentScene[]> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('treatment_scenes')
      .select('*')
      .eq('treatment_id', treatmentId)
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching treatment scenes:', error)
      throw error
    }

    return data || []
  }

  static async createTreatmentScene(sceneData: CreateTreatmentSceneData): Promise<TreatmentScene> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('treatment_scenes')
      .insert({
        ...sceneData,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating treatment scene:', error)
      throw error
    }

    return data
  }

  static async updateTreatmentScene(sceneId: string, updates: UpdateTreatmentSceneData): Promise<TreatmentScene> {
    const user = await this.ensureAuthenticated()
    
    // First, verify the scene exists and belongs to the user
    const { data: existingScene, error: fetchError } = await getSupabaseClient()
      .from('treatment_scenes')
      .select('id, user_id')
      .eq('id', sceneId)
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (fetchError) {
      console.error('Error fetching treatment scene before update:', fetchError)
      throw new Error(`Failed to verify treatment scene: ${fetchError.message}`)
    }
    
    if (!existingScene) {
      throw new Error(`Treatment scene ${sceneId} not found or you don't have permission to update it`)
    }
    
    // Ensure characters array is properly formatted for PostgreSQL TEXT[]
    const formattedUpdates: any = { ...updates }
    if (updates.characters !== undefined) {
      if (Array.isArray(updates.characters)) {
        // Filter out any null/undefined values and ensure all are strings
        formattedUpdates.characters = updates.characters
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
          .map(c => c.trim())
        // If empty after filtering, set to empty array (not null/undefined)
        if (formattedUpdates.characters.length === 0) {
          formattedUpdates.characters = []
        }
      } else if (updates.characters === null) {
        formattedUpdates.characters = null
      }
    }
    
    // Remove metadata if it's being updated separately to avoid conflicts
    // Only update metadata if explicitly provided and different
    if (formattedUpdates.metadata) {
      // Ensure metadata is a valid object
      if (typeof formattedUpdates.metadata !== 'object' || formattedUpdates.metadata === null) {
        delete formattedUpdates.metadata
      }
    }
    
    const { data, error } = await getSupabaseClient()
      .from('treatment_scenes')
      .update(formattedUpdates)
      .eq('id', sceneId)
      .eq('user_id', user.id)
      .select()
      .maybeSingle() // Use maybeSingle() instead of single() to handle 0 or 1 rows

    if (error) {
      console.error('Error updating treatment scene:', error)
      console.error('Update data:', JSON.stringify(formattedUpdates, null, 2))
      console.error('Scene ID:', sceneId)
      console.error('User ID:', user.id)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw error
    }

    if (!data) {
      throw new Error(`Treatment scene ${sceneId} not found or update returned no data`)
    }

    return data
  }

  static async deleteTreatmentScene(sceneId: string): Promise<void> {
    const user = await this.ensureAuthenticated()
    
    const { error } = await getSupabaseClient()
      .from('treatment_scenes')
      .delete()
      .eq('id', sceneId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting treatment scene:', error)
      throw error
    }
  }

  static async bulkCreateTreatmentScenes(scenes: CreateTreatmentSceneData[]): Promise<TreatmentScene[]> {
    const user = await this.ensureAuthenticated()
    
    const scenesWithUserId = scenes.map(scene => ({
      ...scene,
      user_id: user.id,
    }))

    const { data, error } = await getSupabaseClient()
      .from('treatment_scenes')
      .insert(scenesWithUserId)
      .select()

    if (error) {
      console.error('Error bulk creating treatment scenes:', error)
      throw error
    }

    return data || []
  }
}

