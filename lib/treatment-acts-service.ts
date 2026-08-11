import { getSupabaseClient } from './supabase'

export interface TreatmentAct {
  id: string
  treatment_id: string
  project_id: string | null
  user_id: string
  act_number: number
  title: string
  content: string
  metadata: Record<string, unknown>
  order_index: number
  created_at: string
  updated_at: string
}

export class TreatmentActsService {
  static async getActsForTreatment(treatmentId: string): Promise<TreatmentAct[]> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await getSupabaseClient()
      .from('treatment_acts')
      .select('*')
      .eq('treatment_id', treatmentId)
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getActsForProject(projectId: string): Promise<TreatmentAct[]> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await getSupabaseClient()
      .from('treatment_acts')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })

    if (error) throw error
    return data || []
  }
}
