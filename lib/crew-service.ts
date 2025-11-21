import { getSupabaseClient } from './supabase'

export interface CrewMember {
  id: string
  user_id: string
  project_id: string
  name: string
  role: string
  department?: string | null
  email?: string | null
  phone?: string | null
  alternate_phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  country?: string | null
  union_status?: 'union' | 'non-union' | 'fi-core' | 'pending' | null
  rate_daily?: number | null
  rate_hourly?: number | null
  start_date?: string | null
  end_date?: string | null
  skills?: string[] | null
  certifications?: string[] | null
  equipment_owned?: string[] | null
  availability_notes?: string | null
  preferred_days?: string[] | null
  unavailable_dates?: string[] | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relation?: string | null
  notes?: string | null
  internal_notes?: string | null
  status?: 'active' | 'inactive' | 'pending' | 'completed' | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface CreateCrewMemberData extends Partial<Omit<CrewMember, 'id' | 'user_id' | 'created_at' | 'updated_at'>> {
  project_id: string
  name: string
  role: string
}

export interface UpdateCrewMemberData extends Partial<CreateCrewMemberData> {}

export class CrewService {
  static async ensureAuthenticated() {
    const { data: { session }, error } = await getSupabaseClient().auth.getSession()
    if (error || !session) {
      throw new Error('Authentication required')
    }
    return session.user
  }

  static async getCrewMembers(projectId: string, department?: string, status?: string): Promise<CrewMember[]> {
    await this.ensureAuthenticated()
    let query = getSupabaseClient()
      .from('crew_members')
      .select('*')
      .eq('project_id', projectId)
    
    if (department) {
      query = query.eq('department', department)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query.order('department', { ascending: true }).order('name', { ascending: true })
    
    if (error) {
      console.error('Error fetching crew members:', error)
      throw error
    }
    return (data || []) as CrewMember[]
  }

  static async getCrewMember(id: string): Promise<CrewMember> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('crew_members')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Error fetching crew member:', error)
      throw error
    }
    return data as CrewMember
  }

  static async createCrewMember(input: CreateCrewMemberData): Promise<CrewMember> {
    const user = await this.ensureAuthenticated()
    const payload = {
      user_id: user.id,
      project_id: input.project_id,
      name: input.name,
      role: input.role,
      department: input.department ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      alternate_phone: input.alternate_phone ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip_code: input.zip_code ?? null,
      country: input.country ?? null,
      union_status: input.union_status ?? null,
      rate_daily: input.rate_daily ?? null,
      rate_hourly: input.rate_hourly ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      skills: input.skills ?? null,
      certifications: input.certifications ?? null,
      equipment_owned: input.equipment_owned ?? null,
      availability_notes: input.availability_notes ?? null,
      preferred_days: input.preferred_days ?? null,
      unavailable_dates: input.unavailable_dates ?? null,
      emergency_contact_name: input.emergency_contact_name ?? null,
      emergency_contact_phone: input.emergency_contact_phone ?? null,
      emergency_contact_relation: input.emergency_contact_relation ?? null,
      notes: input.notes ?? null,
      internal_notes: input.internal_notes ?? null,
      status: input.status ?? 'active',
      metadata: input.metadata ?? null,
    }
    const { data, error } = await getSupabaseClient()
      .from('crew_members')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.error('Error creating crew member:', error)
      throw error
    }
    return data as CrewMember
  }

  static async updateCrewMember(id: string, updates: UpdateCrewMemberData): Promise<CrewMember> {
    await this.ensureAuthenticated()
    const { data, error } = await getSupabaseClient()
      .from('crew_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error('Error updating crew member:', error)
      throw error
    }
    return data as CrewMember
  }

  static async deleteCrewMember(id: string): Promise<void> {
    await this.ensureAuthenticated()
    const { error } = await getSupabaseClient()
      .from('crew_members')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting crew member:', error)
      throw error
    }
  }
}

