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
    
    const { data, error } = await getSupabaseClient()
      .from('treatment_scenes')
      .update(updates)
      .eq('id', sceneId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating treatment scene:', error)
      throw error
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

