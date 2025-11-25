import { getSupabaseClient } from './supabase'

export interface Prop {
  id: string
  user_id: string
  project_id: string
  location_id?: string | null
  scene_id?: string | null
  name: string
  category: 'Furniture' | 'Electronics' | 'Clothing' | 'Weapons' | 'Vehicles' | 'Food' | 'Documents' | 'Artwork' | 'Decorative' | 'Tools' | 'Other'
  description?: string | null
  quantity?: number | null
  available_quantity?: number | null
  ownership_type?: 'owned' | 'rented' | 'borrowed' | 'purchased' | 'custom_made' | null
  rental_rate_daily?: number | null
  rental_rate_weekly?: number | null
  rental_company?: string | null
  rental_contact?: string | null
  purchase_date?: string | null
  purchase_price?: number | null
  vendor?: string | null
  condition?: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'needs_repair' | null
  condition_notes?: string | null
  storage_location?: string | null
  current_location?: string | null
  used_in_scenes?: string[] | null
  used_by_characters?: string[] | null
  available_from_date?: string | null
  available_to_date?: string | null
  unavailable_dates?: string[] | null
  reference_images?: string[] | null
  image_url?: string | null
  notes?: string | null
  internal_notes?: string | null
  special_handling?: string | null
  safety_notes?: string | null
  status?: 'available' | 'in_use' | 'maintenance' | 'reserved' | 'damaged' | 'unavailable' | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface CreatePropData extends Partial<Omit<Prop, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  project_id: string
  name: string
  category: Prop['category']
}

export interface UpdatePropData extends Partial<CreatePropData> {}

export class PropsService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getProps(projectId: string, category?: string, status?: string): Promise<Prop[]> {
    await this.ensureAuthenticated()
    let query = getSupabaseClient()
      .from('props')
      .select('*')
      .eq('project_id', projectId)
    
    if (category) {
      query = query.eq('category', category)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query.order('category', { ascending: true }).order('name', { ascending: true })
    
    if (error) {
      console.error('Error fetching props:', error)
      throw error
    }
    return (data || []) as Prop[]
  }

  static async getProp(id: string): Promise<Prop> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('props')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching prop:', error)
      throw error
    }
    return data as Prop
  }

  static async createProp(input: CreatePropData): Promise<Prop> {
    const user = await this.ensureAuthenticated()
    const payload = {
      user_id: user.id,
      project_id: input.project_id,
      location_id: input.location_id ?? null,
      scene_id: input.scene_id ?? null,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      quantity: input.quantity ?? 1,
      available_quantity: input.available_quantity ?? input.quantity ?? 1,
      ownership_type: input.ownership_type ?? 'owned',
      rental_rate_daily: input.rental_rate_daily ?? null,
      rental_rate_weekly: input.rental_rate_weekly ?? null,
      rental_company: input.rental_company ?? null,
      rental_contact: input.rental_contact ?? null,
      purchase_date: input.purchase_date ?? null,
      purchase_price: input.purchase_price ?? null,
      vendor: input.vendor ?? null,
      condition: input.condition ?? 'excellent',
      condition_notes: input.condition_notes ?? null,
      storage_location: input.storage_location ?? null,
      current_location: input.current_location ?? null,
      used_in_scenes: input.used_in_scenes ?? null,
      used_by_characters: input.used_by_characters ?? null,
      available_from_date: input.available_from_date ?? null,
      available_to_date: input.available_to_date ?? null,
      unavailable_dates: input.unavailable_dates ?? null,
      reference_images: input.reference_images ?? null,
      image_url: input.image_url ?? null,
      notes: input.notes ?? null,
      internal_notes: input.internal_notes ?? null,
      special_handling: input.special_handling ?? null,
      safety_notes: input.safety_notes ?? null,
      status: input.status ?? 'available',
      metadata: input.metadata ?? null,
    }
    const { data, error } = await getSupabaseClient()
      .from('props')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.error('Error creating prop:', error)
      throw error
    }
    return data as Prop
  }

  static async updateProp(id: string, updates: UpdatePropData): Promise<Prop> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('props')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error('Error updating prop:', error)
      throw error
    }
    return data as Prop
  }

  static async deleteProp(id: string): Promise<void> {
    await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('props')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting prop:', error)
      throw error
    }
  }
}







