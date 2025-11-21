import { getSupabaseClient } from './supabase'

export interface LightingPlot {
  id: string
  user_id: string
  project_id: string
  location_id?: string | null
  scene_id?: string | null
  name: string
  description?: string | null
  lighting_type?: 'key' | 'fill' | 'back' | 'rim' | 'practical' | 'ambient' | 'special' | null
  fixture_type?: string | null
  position_x?: number | null
  position_y?: number | null
  position_z?: number | null
  angle_horizontal?: number | null
  angle_vertical?: number | null
  intensity?: number | null
  color_temperature?: number | null
  color_gel?: string | null
  diffusion?: string | null
  barn_doors?: boolean | null
  flags?: boolean | null
  scrims?: string | null
  notes?: string | null
  diagram_data?: Record<string, any> | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface CreateLightingPlotData extends Partial<Omit<LightingPlot, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  project_id: string
  name: string
}

export interface UpdateLightingPlotData extends Partial<CreateLightingPlotData> {}

export class LightingPlotService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getLightingPlots(projectId: string, locationId?: string, sceneId?: string): Promise<LightingPlot[]> {
    await this.ensureAuthenticated()
    let query = getSupabaseClient()
      .from('lighting_plots')
      .select('*')
      .eq('project_id', projectId)
    
    if (locationId) {
      query = query.eq('location_id', locationId)
    }
    
    if (sceneId) {
      query = query.eq('scene_id', sceneId)
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching lighting plots:', error)
      throw error
    }
    return (data || []) as LightingPlot[]
  }

  static async getLightingPlot(id: string): Promise<LightingPlot> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('lighting_plots')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching lighting plot:', error)
      throw error
    }
    return data as LightingPlot
  }

  static async createLightingPlot(input: CreateLightingPlotData): Promise<LightingPlot> {
    const user = await this.ensureAuthenticated()
    const payload = {
      user_id: user.id,
      project_id: input.project_id,
      location_id: input.location_id ?? null,
      scene_id: input.scene_id ?? null,
      name: input.name,
      description: input.description ?? null,
      lighting_type: input.lighting_type ?? null,
      fixture_type: input.fixture_type ?? null,
      position_x: input.position_x ?? null,
      position_y: input.position_y ?? null,
      position_z: input.position_z ?? null,
      angle_horizontal: input.angle_horizontal ?? null,
      angle_vertical: input.angle_vertical ?? null,
      intensity: input.intensity ?? null,
      color_temperature: input.color_temperature ?? null,
      color_gel: input.color_gel ?? null,
      diffusion: input.diffusion ?? null,
      barn_doors: input.barn_doors ?? null,
      flags: input.flags ?? null,
      scrims: input.scrims ?? null,
      notes: input.notes ?? null,
      diagram_data: input.diagram_data ?? null,
      metadata: input.metadata ?? null,
    }
    const { data, error } = await getSupabaseClient()
      .from('lighting_plots')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.error('Error creating lighting plot:', error)
      throw error
    }
    return data as LightingPlot
  }

  static async updateLightingPlot(id: string, updates: UpdateLightingPlotData): Promise<LightingPlot> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('lighting_plots')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error('Error updating lighting plot:', error)
      throw error
    }
    return data as LightingPlot
  }

  static async deleteLightingPlot(id: string): Promise<void> {
    await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('lighting_plots')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting lighting plot:', error)
      throw error
    }
  }
}

