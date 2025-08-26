import { getSupabaseClient } from './supabase'
import { Database } from './supabase'

export type Movie = Database['public']['Tables']['projects']['Row'] & {
  project_type: 'movie'
  writer?: string | null
  cowriters?: string[] | null
}

export type CreateMovieData = Omit<Database['public']['Tables']['projects']['Insert'], 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  project_type: 'movie'
  writer?: string
  cowriters?: string[]
}

export class MovieService {
  static async getMovies(): Promise<Movie[]> {
    console.log('🎬 MovieService.getMovies() - Starting...')
    
    try {
      console.log('🎬 MovieService.getMovies() - Making Supabase query...')
      
      // Make the Supabase query directly without race condition
      const { data, error } = await getSupabaseClient()
        .from('projects')
        .select('*')
        .eq('project_type', 'movie')
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
    const { data, error } = await getSupabaseClient()
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('project_type', 'movie')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // No rows returned
      }
      console.error('Error fetching movie:', error)
      throw error
    }

    return data as Movie
  }
}
