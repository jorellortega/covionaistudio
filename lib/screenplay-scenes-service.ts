import { getSupabaseClient } from './supabase'

export interface ScreenplayScene {
  id: string
  project_id: string
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

export interface CreateScreenplaySceneData {
  project_id: string
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

export interface UpdateScreenplaySceneData {
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

export class ScreenplayScenesService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getScreenplayScenes(projectId: string): Promise<ScreenplayScene[]> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('screenplay_scenes')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching screenplay scenes:', error)
      throw error
    }

    return data || []
  }

  static async createScreenplayScene(sceneData: CreateScreenplaySceneData): Promise<ScreenplayScene> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('screenplay_scenes')
      .insert({
        ...sceneData,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating screenplay scene:', error)
      throw error
    }

    return data
  }

  static async updateScreenplayScene(sceneId: string, updates: UpdateScreenplaySceneData): Promise<ScreenplayScene> {
    const user = await this.ensureAuthenticated()
    
    const { data, error } = await getSupabaseClient()
      .from('screenplay_scenes')
      .update(updates)
      .eq('id', sceneId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating screenplay scene:', error)
      throw error
    }

    return data
  }

  static async deleteScreenplayScene(sceneId: string): Promise<void> {
    const user = await this.ensureAuthenticated()
    
    const { error } = await getSupabaseClient()
      .from('screenplay_scenes')
      .delete()
      .eq('id', sceneId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting screenplay scene:', error)
      throw error
    }
  }

  static async bulkCreateScreenplayScenes(scenes: CreateScreenplaySceneData[]): Promise<ScreenplayScene[]> {
    const user = await this.ensureAuthenticated()
    
    const scenesWithUserId = scenes.map(scene => ({
      ...scene,
      user_id: user.id,
    }))

    const { data, error } = await getSupabaseClient()
      .from('screenplay_scenes')
      .insert(scenesWithUserId)
      .select()

    if (error) {
      console.error('Error bulk creating screenplay scenes:', error)
      throw error
    }

    return data || []
  }
}

