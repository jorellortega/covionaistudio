import { getSupabaseClient } from './supabase'

export interface CastMember {
  name: string
  role?: string
  character?: string
  call_time?: string
  phone?: string
  notes?: string
}

export interface CrewMember {
  name: string
  role: string
  department?: string
  call_time?: string
  phone?: string
  notes?: string
}

export interface CallSheet {
  id: string
  user_id: string
  project_id: string
  location_id?: string | null
  title: string
  date: string
  day_number?: number | null
  production_day?: string | null
  location_name?: string | null
  location_address?: string | null
  weather_forecast?: string | null
  sunrise_time?: string | null
  sunset_time?: string | null
  crew_call_time?: string | null
  cast_call_time?: string | null
  first_shot_time?: string | null
  wrap_time?: string | null
  lunch_time?: string | null
  lunch_duration_minutes?: number | null
  scene_numbers?: string[] | null
  scene_descriptions?: string[] | null
  estimated_pages?: number | null
  cast_members?: CastMember[] | null
  crew_members?: CrewMember[] | null
  equipment_needed?: string[] | null
  vehicles_needed?: string[] | null
  special_equipment?: string | null
  production_notes?: string | null
  special_instructions?: string | null
  safety_notes?: string | null
  parking_instructions?: string | null
  catering_notes?: string | null
  production_office_phone?: string | null
  location_manager_phone?: string | null
  emergency_contact?: string | null
  status?: 'draft' | 'published' | 'archived' | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface CreateCallSheetData extends Partial<Omit<CallSheet, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  project_id: string
  title: string
  date: string
}

export interface UpdateCallSheetData extends Partial<CreateCallSheetData> {}

export class CallSheetService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getCallSheets(projectId: string, startDate?: string, endDate?: string): Promise<CallSheet[]> {
    await this.ensureAuthenticated()
    let query = getSupabaseClient()
      .from('call_sheets')
      .select('*')
      .eq('project_id', projectId)
    
    if (startDate) {
      query = query.gte('date', startDate)
    }
    
    if (endDate) {
      query = query.lte('date', endDate)
    }
    
    const { data, error } = await query.order('date', { ascending: true })
    
    if (error) {
      console.error('Error fetching call sheets:', error)
      throw error
    }
    return (data || []) as CallSheet[]
  }

  static async getCallSheet(id: string): Promise<CallSheet> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('call_sheets')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching call sheet:', error)
      throw error
    }
    return data as CallSheet
  }

  static async createCallSheet(input: CreateCallSheetData): Promise<CallSheet> {
    const user = await this.ensureAuthenticated()
    const payload = {
      user_id: user.id,
      project_id: input.project_id,
      location_id: input.location_id ?? null,
      title: input.title,
      date: input.date,
      day_number: input.day_number ?? null,
      production_day: input.production_day ?? null,
      location_name: input.location_name ?? null,
      location_address: input.location_address ?? null,
      weather_forecast: input.weather_forecast ?? null,
      sunrise_time: input.sunrise_time ?? null,
      sunset_time: input.sunset_time ?? null,
      crew_call_time: input.crew_call_time ?? null,
      cast_call_time: input.cast_call_time ?? null,
      first_shot_time: input.first_shot_time ?? null,
      wrap_time: input.wrap_time ?? null,
      lunch_time: input.lunch_time ?? null,
      lunch_duration_minutes: input.lunch_duration_minutes ?? null,
      scene_numbers: input.scene_numbers ?? null,
      scene_descriptions: input.scene_descriptions ?? null,
      estimated_pages: input.estimated_pages ?? null,
      cast_members: input.cast_members ?? null,
      crew_members: input.crew_members ?? null,
      equipment_needed: input.equipment_needed ?? null,
      vehicles_needed: input.vehicles_needed ?? null,
      special_equipment: input.special_equipment ?? null,
      production_notes: input.production_notes ?? null,
      special_instructions: input.special_instructions ?? null,
      safety_notes: input.safety_notes ?? null,
      parking_instructions: input.parking_instructions ?? null,
      catering_notes: input.catering_notes ?? null,
      production_office_phone: input.production_office_phone ?? null,
      location_manager_phone: input.location_manager_phone ?? null,
      emergency_contact: input.emergency_contact ?? null,
      status: input.status ?? 'draft',
      metadata: input.metadata ?? null,
    }
    const { data, error } = await getSupabaseClient()
      .from('call_sheets')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.error('Error creating call sheet:', error)
      throw error
    }
    return data as CallSheet
  }

  static async updateCallSheet(id: string, updates: UpdateCallSheetData): Promise<CallSheet> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('call_sheets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error('Error updating call sheet:', error)
      throw error
    }
    return data as CallSheet
  }

  static async deleteCallSheet(id: string): Promise<void> {
    await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('call_sheets')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting call sheet:', error)
      throw error
    }
  }
}

