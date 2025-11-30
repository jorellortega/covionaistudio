import { getSupabaseClient } from './supabase'
import { Database } from './supabase'

export type Movie = Database['public']['Tables']['projects']['Row'] & {
  project_type: 'movie'
  writer?: string | null
  cowriters?: string[] | null
  project_status?: string | null
}

export type CreateMovieData = Omit<Database['public']['Tables']['projects']['Insert'], 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  project_type: 'movie'
  writer?: string
  cowriters?: string[]
  project_status?: string
}

export class MovieService {
  static async getMovies(): Promise<Movie[]> {
    console.log('🎬 MovieService.getMovies() - Starting...')
    
    try {
      // Get the current user
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      console.log('🎬 MovieService.getMovies() - Making Supabase query...')
      
      // Make the Supabase query directly without race condition
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .select('*')
        .eq('project_type', 'movie')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      console.log('🎬 MovieService.getMovies() - Query completed, data:', data?.length || 0, 'rows')
      
      if (error) {
        console.error('🎬 MovieService.getMovies() - Supabase error:', error)
        throw error
      }

      // Transform the data to ensure writer and cowriters fields exist
      const movies = (data || []).map(movie => ({
        ...movie,
        writer: movie.writer || null,
        cowriters: movie.cowriters || []
      })) as Movie[]

      console.log('🎬 MovieService.getMovies() - Successfully processed', movies.length, 'movies')
      return movies
      
    } catch (error) {
      console.error('🎬 MovieService.getMovies() - Error in getMovies:', error)
      throw error
    }
  }

  static async createMovie(movieData: CreateMovieData): Promise<Movie> {
    try {
      const { data: { user } } = await getSupabaseClient().auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await getSupabaseClient()
        .from('projects')
        .insert({
          ...movieData,
          user_id: user.id,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating movie:', error)
        throw error
      }

      return data as Movie
    } catch (error) {
      console.error('Error in createMovie:', error)
      throw error
    }
  }

  static async updateMovie(id: string, updates: Partial<CreateMovieData>): Promise<Movie> {
    const { data, error } = await getSupabaseClient()
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('project_type', 'movie')
      .select()
      .single()

    if (error) {
      console.error('Error updating movie:', error)
      throw error
    }

    return data as Movie
  }

  static async deleteMovie(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('project_type', 'movie')

    if (error) {
      console.error('Error deleting movie:', error)
      throw error
    }
  }

  static async getMovieById(id: string): Promise<Movie | null> {
    const { data: { user } } = await getSupabaseClient().auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    console.log('🎬 MovieService.getMovieById - Checking access for project:', id, 'user:', user.id, 'email:', user.email)

    // First check if user owns the project
    const { data: ownedProject, error: ownedError } = await getSupabaseClient()
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('project_type', 'movie')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ownedError && ownedProject) {
      console.log('✅ MovieService.getMovieById - User owns the project')
      return ownedProject as Movie
    }

    console.log('🔍 MovieService.getMovieById - Not owner, checking for shared access...')

    // If not owned, check if user has shared access
    // Check both user_id and email matches
    const { data: shares, error: shareError } = await getSupabaseClient()
      .from('project_shares')
      .select('*')
      .eq('project_id', id)
      .eq('is_revoked', false)

    console.log('🔍 MovieService.getMovieById - Shares found:', shares?.length || 0, 'error:', shareError)

    if (!shareError && shares && shares.length > 0) {
      // Find a share that matches the user
      const matchingShare = shares.find(share => 
        (share.shared_with_user_id === user.id) || 
        (share.shared_with_email && share.shared_with_email.toLowerCase() === user.email?.toLowerCase())
      )

      if (matchingShare) {
        console.log('✅ MovieService.getMovieById - Found matching share:', matchingShare.id)
        
        // Check if expired
        if (matchingShare.deadline && new Date(matchingShare.deadline) < new Date()) {
          console.log('❌ MovieService.getMovieById - Share has expired')
          return null
        }

        // User has shared access, fetch the project
        const { data: sharedProject, error: projectError } = await getSupabaseClient()
          .from('projects')
          .select('*')
          .eq('id', id)
          .eq('project_type', 'movie')
          .maybeSingle()

        if (!projectError && sharedProject) {
          console.log('✅ MovieService.getMovieById - Project loaded via shared access')
          return sharedProject as Movie
        } else {
          console.error('❌ MovieService.getMovieById - Error loading shared project:', projectError)
        }
      } else {
        console.log('❌ MovieService.getMovieById - No matching share found for user')
      }
    }

    // No access found
    console.log('❌ MovieService.getMovieById - No access found for project')
    return null
  }
}
