import { getSupabaseClient } from './supabase'

// Types
export interface CastingSetting {
  id: string
  movie_id: string
  user_id: string
  show_script: boolean
  show_scenes: boolean
  show_timeline: boolean
  show_storyboard: boolean
  roles_available: string[]
  show_character_types: string[]
  submission_deadline: string | null
  casting_notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ActorSubmission {
  id: string
  movie_id: string
  actor_name: string
  actor_email: string
  actor_phone: string | null
  role_applying_for: string | null
  cover_letter: string | null
  experience: string | null
  headshot_url: string | null
  video_url: string | null
  resume_url: string | null
  additional_photos: string[] | null
  submission_date: string
  status: 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'accepted'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateCastingSettingData {
  movie_id: string
  show_script?: boolean
  show_scenes?: boolean
  show_timeline?: boolean
  show_storyboard?: boolean
  roles_available?: string[]
  show_character_types?: string[]
  submission_deadline?: string | null
  casting_notes?: string | null
  is_active?: boolean
}

export interface CreateActorSubmissionData {
  movie_id: string
  actor_name: string
  actor_email: string
  actor_phone?: string
  role_applying_for?: string
  cover_letter?: string
  experience?: string
  headshot_url?: string
  video_url?: string
  resume_url?: string
  additional_photos?: string[]
}

export interface UpdateActorSubmissionData {
  status?: 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'accepted'
  notes?: string
}

export class CastingService {
  // ========== Casting Settings ==========
  
  /**
   * Get casting settings for a specific movie
   */
  static async getCastingSettings(movieId: string): Promise<CastingSetting | null> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('casting_settings')
        .select('*')
        .eq('movie_id', movieId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching casting settings:', error)
        throw error
      }

      return data as CastingSetting | null
    } catch (error) {
      console.error('Error in getCastingSettings:', error)
      throw error
    }
  }

  /**
   * Create or update casting settings for a movie
   */
  static async upsertCastingSettings(
    movieId: string,
    settings: Partial<CreateCastingSettingData>
  ): Promise<CastingSetting> {
    try {
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await getSupabaseClient()
        .from('casting_settings')
        .upsert({
          movie_id: movieId,
          user_id: user.id,
          ...settings
        }, {
          onConflict: 'movie_id'
        })
        .select()
        .single()

      if (error) {
        console.error('Error upserting casting settings:', error)
        throw error
      }

      return data as CastingSetting
    } catch (error) {
      console.error('Error in upsertCastingSettings:', error)
      throw error
    }
  }

  /**
   * Delete casting settings
   */
  static async deleteCastingSettings(movieId: string): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('casting_settings')
        .delete()
        .eq('movie_id', movieId)

      if (error) {
        console.error('Error deleting casting settings:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteCastingSettings:', error)
      throw error
    }
  }

  // ========== Actor Submissions ==========

  /**
   * Get all submissions for a movie (for movie owner)
   */
  static async getSubmissionsForMovie(movieId: string): Promise<ActorSubmission[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('actor_submissions')
        .select('*')
        .eq('movie_id', movieId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching submissions:', error)
        throw error
      }

      return (data || []) as ActorSubmission[]
    } catch (error) {
      console.error('Error in getSubmissionsForMovie:', error)
      throw error
    }
  }

  /**
   * Submit an actor application
   */
  static async submitActorApplication(
    submissionData: CreateActorSubmissionData
  ): Promise<ActorSubmission> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('actor_submissions')
        .insert(submissionData)
        .select()
        .single()

      if (error) {
        console.error('Error submitting actor application:', error)
        throw error
      }

      return data as ActorSubmission
    } catch (error) {
      console.error('Error in submitActorApplication:', error)
      throw error
    }
  }

  /**
   * Update submission status (for movie owner)
   */
  static async updateSubmission(
    submissionId: string,
    updates: UpdateActorSubmissionData
  ): Promise<ActorSubmission> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('actor_submissions')
        .update(updates)
        .eq('id', submissionId)
        .select()
        .single()

      if (error) {
        console.error('Error updating submission:', error)
        throw error
      }

      return data as ActorSubmission
    } catch (error) {
      console.error('Error in updateSubmission:', error)
      throw error
    }
  }

  /**
   * Delete a submission
   */
  static async deleteSubmission(submissionId: string): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('actor_submissions')
        .delete()
        .eq('id', submissionId)

      if (error) {
        console.error('Error deleting submission:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteSubmission:', error)
      throw error
    }
  }

  /**
   * Upload file to Supabase storage
   */
  static async uploadFile(
    file: File,
    folder: 'headshots' | 'videos' | 'resumes' | 'photos',
    movieId: string
  ): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${movieId}/${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { data, error } = await getSupabaseClient()
        .storage
        .from('actor-submissions')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Error uploading file:', error)
        throw error
      }

      // Get public URL
      const { data: { publicUrl } } = getSupabaseClient()
        .storage
        .from('actor-submissions')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (error) {
      console.error('Error in uploadFile:', error)
      throw error
    }
  }

  /**
   * Get public casting page data (for actors to view)
   */
  static async getPublicCastingData(movieId: string): Promise<{
    movie: any
    settings: CastingSetting | null
    scenes?: any[]
    storyboards?: any[]
    timeline?: any
  }> {
    try {
      // Get movie details
      const { data: movie, error: movieError } = await getSupabaseClient()
        .from('projects')
        .select('*')
        .eq('id', movieId)
        .eq('project_type', 'movie')
        .single()

      if (movieError) {
        console.error('Error fetching movie:', movieError)
        throw movieError
      }

      // Get casting settings
      const settings = await this.getCastingSettings(movieId)

      const result: any = {
        movie,
        settings
      }

      // Conditionally fetch additional data based on settings
      if (settings) {
        if (settings.show_script) {
          // Get treatment for this project
          const { data: treatment, error: treatmentError } = await getSupabaseClient()
            .from('treatments')
            .select('*')
            .eq('project_id', movieId)
            .single()

          if (!treatmentError && treatment) {
            result.treatment = treatment
          }
        }

        if (settings.show_scenes) {
          // First get timeline for this project
          const { data: timeline, error: timelineError } = await getSupabaseClient()
            .from('timelines')
            .select('id')
            .eq('project_id', movieId)
            .single()

          if (!timelineError && timeline) {
            // Then get scenes for this timeline
            const { data: scenes, error: scenesError } = await getSupabaseClient()
              .from('scenes')
              .select('*')
              .eq('timeline_id', timeline.id)
              .order('start_time_seconds', { ascending: true })

            if (!scenesError) {
              result.scenes = scenes
            }
          }
        }

        if (settings.show_storyboard) {
          const { data: storyboards, error: storyboardsError } = await getSupabaseClient()
            .from('storyboards')
            .select('*')
            .eq('project_id', movieId)
            .order('scene_number', { ascending: true })

          if (!storyboardsError) {
            result.storyboards = storyboards
          }
        }

        if (settings.show_timeline) {
          const { data: timeline, error: timelineError } = await getSupabaseClient()
            .from('timelines')
            .select('*')
            .eq('project_id', movieId)
            .single()

          if (!timelineError) {
            result.timeline = timeline
          }
        }
      }

      return result
    } catch (error) {
      console.error('Error in getPublicCastingData:', error)
      throw error
    }
  }
}

