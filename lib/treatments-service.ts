import { getSupabaseClient } from './supabase'

export interface Treatment {
  id: string
  user_id: string
  project_id?: string
  title: string
  genre: string
  status: 'draft' | 'in-progress' | 'completed' | 'archived'
  cover_image_url?: string
  synopsis?: string
  prompt?: string
  target_audience?: string
  estimated_budget?: string
  estimated_duration?: string
  logline?: string
  characters?: string
  themes?: string
  visual_references?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface CreateTreatmentData {
  project_id?: string
  title: string
  genre: string
  status?: 'draft' | 'in-progress' | 'completed' | 'archived'
  cover_image_url?: string
  synopsis?: string
  prompt?: string
  target_audience?: string
  estimated_budget?: string
  estimated_duration?: string
  logline?: string
  characters?: string
  themes?: string
  visual_references?: string
  notes?: string
}

export interface UpdateTreatmentData extends Partial<CreateTreatmentData> {
  status?: 'draft' | 'in-progress' | 'completed' | 'archived'
  project_id?: string
}

export class TreatmentsService {
  // Get all treatments for the current user
  static async getTreatments(): Promise<Treatment[]> {
    try {
      console.log('Fetching treatments...')
      
      const { data, error } = await getSupabaseClient()
        .from('treatments')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching treatments:', error)
        throw error
      }

      console.log('Treatments fetched successfully:', data)
      return data || []
    } catch (error) {
      console.error('Error in getTreatments:', error)
      throw error
    }
  }

  // Get a single treatment by ID
  static async getTreatment(id: string): Promise<Treatment | null> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('treatments')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching treatment:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getTreatment:', error)
      throw error
    }
  }

  // Create a new treatment
  static async createTreatment(treatmentData: CreateTreatmentData): Promise<Treatment> {
    try {
      // Get the current user
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Clean and map the data to match database schema exactly
      const treatmentWithUserId = {
        user_id: user.id,
        project_id: treatmentData.project_id || null,
        title: treatmentData.title,
        genre: treatmentData.genre,
        status: treatmentData.status || 'draft',
        synopsis: treatmentData.synopsis || null,
        prompt: treatmentData.prompt || null,
        cover_image_url: treatmentData.cover_image_url || null,
        target_audience: treatmentData.target_audience || null,
        estimated_budget: treatmentData.estimated_budget || null,
        estimated_duration: treatmentData.estimated_duration || null,
        logline: treatmentData.logline || null,
        characters: treatmentData.characters || null,
        themes: treatmentData.themes || null,
        visual_references: treatmentData.visual_references || null,
        notes: treatmentData.notes || null
      }

      console.log('Creating treatment with data:', treatmentWithUserId)

      const { data, error } = await getSupabaseClient()
        .from('treatments')
        .insert([treatmentWithUserId])
        .select()
        .single()

      if (error) {
        console.error('Error creating treatment:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createTreatment:', error)
      throw error
    }
  }

  // Update an existing treatment
  static async updateTreatment(id: string, treatmentData: UpdateTreatmentData): Promise<Treatment> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('treatments')
        .update(treatmentData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating treatment:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateTreatment:', error)
      throw error
    }
  }

  // Delete a treatment
  static async deleteTreatment(id: string): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('treatments')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting treatment:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteTreatment:', error)
      throw error
    }
  }

  // Search treatments by title, synopsis, or genre
  static async searchTreatments(searchTerm: string): Promise<Treatment[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('treatments')
        .select('*')
        .or(`title.ilike.%${searchTerm}%,synopsis.ilike.%${searchTerm}%,genre.ilike.%${searchTerm}%`)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error searching treatments:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in searchTreatments:', error)
      throw error
    }
  }

  // Get treatments by status
  static async getTreatmentsByStatus(status: string): Promise<Treatment[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('treatments')
        .select('*')
        .eq('status', status)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching treatments by status:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getTreatmentsByStatus:', error)
      throw error
    }
  }

  // Get treatments by genre
  static async getTreatmentsByGenre(genre: string): Promise<Treatment[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('treatments')
        .select('*')
        .eq('genre', genre)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching treatments by genre:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getTreatmentsByGenre:', error)
      throw error
    }
  }

  // Get treatment by project ID
  static async getTreatmentByProjectId(projectId: string): Promise<Treatment | null> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('treatments')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error fetching treatment by project ID:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getTreatmentByProjectId:', error)
      throw error
    }
  }
}
