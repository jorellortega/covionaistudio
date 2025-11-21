import { getSupabaseClient } from './supabase'

export interface Location {
  id: string
  user_id: string
  project_id: string
  name: string
  description?: string | null
  type?: 'interior' | 'exterior' | 'both' | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  time_of_day?: string[] | null
  atmosphere?: string | null
  mood?: string | null
  visual_description?: string | null
  lighting_notes?: string | null
  sound_notes?: string | null
  key_features?: string[] | null
  props?: string[] | null
  restrictions?: string | null
  access_notes?: string | null
  shooting_notes?: string | null
  image_url?: string | null
  reference_images?: string[] | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface CreateLocationData extends Partial<Omit<Location, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  project_id: string
  name: string
}

export interface UpdateLocationData extends Partial<CreateLocationData> {}

export class LocationsService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getLocations(projectId: string): Promise<Location[]> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('locations')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('Error fetching locations:', error)
      throw error
    }
    return (data || []) as Location[]
  }

  static async createLocation(input: CreateLocationData): Promise<Location> {
    const user = await this.ensureAuthenticated()
    const payload = {
      user_id: user.id,
      project_id: input.project_id,
      name: input.name,
      description: input.description ?? null,
      type: input.type ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      time_of_day: input.time_of_day ?? null,
      atmosphere: input.atmosphere ?? null,
      mood: input.mood ?? null,
      visual_description: input.visual_description ?? null,
      lighting_notes: input.lighting_notes ?? null,
      sound_notes: input.sound_notes ?? null,
      key_features: input.key_features ?? null,
      props: input.props ?? null,
      restrictions: input.restrictions ?? null,
      access_notes: input.access_notes ?? null,
      shooting_notes: input.shooting_notes ?? null,
      image_url: input.image_url ?? null,
      reference_images: input.reference_images ?? null,
      metadata: input.metadata ?? null,
    }
    const { data, error } = await getSupabaseClient()
      .from('locations')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.error('Error creating location:', error)
      throw error
    }
    return data as Location
  }

  static async updateLocation(id: string, updates: UpdateLocationData): Promise<Location> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error('Error updating location:', error)
      throw error
    }
    return data as Location
  }

  static async deleteLocation(id: string): Promise<void> {
    await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('locations')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting location:', error)
      throw error
    }
  }
}

