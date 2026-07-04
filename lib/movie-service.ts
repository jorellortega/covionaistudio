import { getSupabaseClient } from './supabase'
import { Database } from './supabase'
import { getErrorMessage, withRetry } from './fetch-retry'
import { requireSessionUser } from './auth-session'

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

const moviesInflight = new Map<string, Promise<Movie[]>>()

export class MovieService {
  static async getMovies(userId?: string): Promise<Movie[]> {
    let resolvedUserId = userId
    if (!resolvedUserId) {
      const user = await requireSessionUser()
      resolvedUserId = user.id
    }

    const existing = moviesInflight.get(resolvedUserId)
    if (existing) {
      console.log('🎬 MovieService.getMovies() - Reusing in-flight request')
      return existing
    }

    const promise = MovieService.fetchMoviesForUser(resolvedUserId).finally(() => {
      moviesInflight.delete(resolvedUserId!)
    })

    moviesInflight.set(resolvedUserId, promise)
    return promise
  }

  private static async fetchMoviesForUser(resolvedUserId: string): Promise<Movie[]> {
    const t0 = Date.now()
    console.log('🎬 MovieService.getMovies() - Starting fetch...')

    // Browser → Supabase direct fetch fails intermittently (TypeError: Load failed).
    // Route through our API so the server talks to Supabase instead.
    if (typeof window !== 'undefined') {
      const movies = await withRetry(
        'MovieService.getMovies (API)',
        async () => {
          const tFetch = Date.now()
          const response = await fetch('/api/movies', { credentials: 'include' })
          const fetchMs = Date.now() - tFetch

          if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            throw new Error(body.error || `Movies API HTTP ${response.status}`)
          }

          const body = await response.json()
          const cacheTag = body.meta?.cached ? " (server cache)" : body.meta?.serviceRole ? " (service role)" : ""
          console.log(
            `🎬 MovieService.getMovies() - API ${fetchMs}ms, auth ${body.meta?.authMs ?? '?'}ms, query ${body.meta?.queryMs ?? '?'}ms${cacheTag}, rows:`,
            body.movies?.length ?? 0,
          )
          return (body.movies || []) as Movie[]
        },
        { retries: 3, baseDelayMs: 1000 },
      )

      console.log(`🎬 MovieService.getMovies() - Done in ${Date.now() - t0}ms (${movies.length} movies)`)
      return movies
    }

    const movies = await withRetry(
      'MovieService.getMovies (server)',
      async () => {
        const tQuery = Date.now()
        const { data, error } = await getSupabaseClient()
          .from('projects')
          .select('*')
          .eq('project_type', 'movie')
          .eq('user_id', resolvedUserId)
          .order('created_at', { ascending: false })

        const queryMs = Date.now() - tQuery
        console.log(`🎬 MovieService.getMovies() - Query ${queryMs}ms, rows:`, data?.length ?? 0)

        if (error) {
          console.error('🎬 MovieService.getMovies() - Supabase error:', error)
          throw error
        }

        return (data || []).map((movie) => ({
          ...movie,
          writer: movie.writer || null,
          cowriters: movie.cowriters || [],
        })) as Movie[]
      },
      { retries: 3, baseDelayMs: 1000 },
    )

    console.log(`🎬 MovieService.getMovies() - Done in ${Date.now() - t0}ms (${movies.length} movies)`)
    return movies
  }

  static async createMovie(movieData: CreateMovieData): Promise<Movie> {
    try {
      const user = await requireSessionUser()

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
    const user = await requireSessionUser()

    console.log('🎬 MovieService.getMovieById - Checking access for project:', id, 'user:', user.id, 'email:', user.email)

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

    const { data: shares, error: shareError } = await getSupabaseClient()
      .from('project_shares')
      .select('*')
      .eq('project_id', id)
      .eq('is_revoked', false)

    console.log('🔍 MovieService.getMovieById - Shares found:', shares?.length || 0, 'error:', shareError)

    if (!shareError && shares && shares.length > 0) {
      const matchingShare = shares.find(share => 
        (share.shared_with_user_id === user.id) || 
        (share.shared_with_email && share.shared_with_email.toLowerCase() === user.email?.toLowerCase())
      )

      if (matchingShare) {
        console.log('✅ MovieService.getMovieById - Found matching share:', matchingShare.id)
        
        if (matchingShare.deadline && new Date(matchingShare.deadline) < new Date()) {
          console.log('❌ MovieService.getMovieById - Share has expired')
          return null
        }

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

    console.log('❌ MovieService.getMovieById - No access found for project')
    return null
  }
}
