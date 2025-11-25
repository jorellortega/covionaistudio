import { getSupabaseClient } from './supabase'

export interface Equipment {
  id: string
  user_id: string
  project_id: string
  crew_member_id?: string | null
  location_id?: string | null
  name: string
  category: 'Camera' | 'Lighting' | 'Sound' | 'Grip' | 'Electric' | 'Lenses' | 'Support' | 'Accessories' | 'Vehicles' | 'Other'
  type?: string | null
  manufacturer?: string | null
  model?: string | null
  serial_number?: string | null
  quantity?: number | null
  available_quantity?: number | null
  ownership_type?: 'owned' | 'rented' | 'borrowed' | 'leased' | null
  rental_rate_daily?: number | null
  rental_rate_weekly?: number | null
  rental_rate_monthly?: number | null
  rental_company?: string | null
  rental_contact?: string | null
  purchase_date?: string | null
  purchase_price?: number | null
  condition?: 'excellent' | 'good' | 'fair' | 'poor' | 'needs_repair' | null
  last_maintenance_date?: string | null
  next_maintenance_date?: string | null
  maintenance_notes?: string | null
  storage_location?: string | null
  current_location?: string | null
  available_from_date?: string | null
  available_to_date?: string | null
  unavailable_dates?: string[] | null
  specifications?: Record<string, any> | null
  description?: string | null
  notes?: string | null
  internal_notes?: string | null
  status?: 'available' | 'in_use' | 'maintenance' | 'reserved' | 'unavailable' | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface CreateEquipmentData extends Partial<Omit<Equipment, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  project_id: string
  name: string
  category: Equipment['category']
}

export interface UpdateEquipmentData extends Partial<CreateEquipmentData> {}

export class EquipmentService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getEquipment(projectId: string, category?: string, status?: string): Promise<Equipment[]> {
    await this.ensureAuthenticated()
    let query = getSupabaseClient()
      .from('equipment')
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
      console.error('Error fetching equipment:', error)
      throw error
    }
    return (data || []) as Equipment[]
  }

  static async getEquipmentItem(id: string): Promise<Equipment> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('equipment')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching equipment item:', error)
      throw error
    }
    return data as Equipment
  }

  static async createEquipment(input: CreateEquipmentData): Promise<Equipment> {
    const user = await this.ensureAuthenticated()
    const payload = {
      user_id: user.id,
      project_id: input.project_id,
      crew_member_id: input.crew_member_id ?? null,
      location_id: input.location_id ?? null,
      name: input.name,
      category: input.category,
      type: input.type ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      serial_number: input.serial_number ?? null,
      quantity: input.quantity ?? 1,
      available_quantity: input.available_quantity ?? input.quantity ?? 1,
      ownership_type: input.ownership_type ?? 'owned',
      rental_rate_daily: input.rental_rate_daily ?? null,
      rental_rate_weekly: input.rental_rate_weekly ?? null,
      rental_rate_monthly: input.rental_rate_monthly ?? null,
      rental_company: input.rental_company ?? null,
      rental_contact: input.rental_contact ?? null,
      purchase_date: input.purchase_date ?? null,
      purchase_price: input.purchase_price ?? null,
      condition: input.condition ?? 'excellent',
      last_maintenance_date: input.last_maintenance_date ?? null,
      next_maintenance_date: input.next_maintenance_date ?? null,
      maintenance_notes: input.maintenance_notes ?? null,
      storage_location: input.storage_location ?? null,
      current_location: input.current_location ?? null,
      available_from_date: input.available_from_date ?? null,
      available_to_date: input.available_to_date ?? null,
      unavailable_dates: input.unavailable_dates ?? null,
      specifications: input.specifications ?? null,
      description: input.description ?? null,
      notes: input.notes ?? null,
      internal_notes: input.internal_notes ?? null,
      status: input.status ?? 'available',
      metadata: input.metadata ?? null,
    }
    const { data, error } = await getSupabaseClient()
      .from('equipment')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.error('Error creating equipment:', error)
      throw error
    }
    return data as Equipment
  }

  static async updateEquipment(id: string, updates: UpdateEquipmentData): Promise<Equipment> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('equipment')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error('Error updating equipment:', error)
      throw error
    }
    return data as Equipment
  }

  static async deleteEquipment(id: string): Promise<void> {
    await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('equipment')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting equipment:', error)
      throw error
    }
  }
}







