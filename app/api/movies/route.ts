import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Movie } from "@/lib/movie-service"

export const runtime = "nodejs"

type MoviesCacheEntry = { movies: Movie[]; expiresAt: number }
const moviesCache = new Map<string, MoviesCacheEntry>()
const CACHE_TTL_MS = 60_000

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET() {
  const t0 = Date.now()

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              )
            } catch {
              /* ignore */
            }
          },
        },
      },
    )

    const tAuth = Date.now()
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    const authMs = Date.now() - tAuth

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const userId = session.user.id

    const cached = moviesCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) {
      const totalMs = Date.now() - t0
      console.log(`[api/movies] cache hit ${cached.movies.length} movies in ${totalMs}ms`)
      return NextResponse.json({
        success: true,
        movies: cached.movies,
        meta: { totalMs, authMs, queryMs: 0, cached: true },
      })
    }

    const admin = getServiceClient()
    const tQuery = Date.now()

    let data: Record<string, unknown>[] | null = null
    let error: { message: string } | null = null

    if (admin) {
      // Service role bypasses RLS (avoids per-row has_shared_access_to_project checks)
      ;({ data, error } = await admin
        .from("projects")
        .select("*")
        .eq("project_type", "movie")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }))
    } else {
      ;({ data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("project_type", "movie")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }))
    }

    const queryMs = Date.now() - tQuery

    if (error) {
      console.error("[api/movies] Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const movies = (data || []).map((movie) => ({
      ...movie,
      writer: movie.writer || null,
      cowriters: movie.cowriters || [],
    })) as Movie[]

    moviesCache.set(userId, { movies, expiresAt: Date.now() + CACHE_TTL_MS })

    const totalMs = Date.now() - t0
    console.log(
      `[api/movies] ${movies.length} movies in ${totalMs}ms (auth ${authMs}ms, query ${queryMs}ms, service=${!!admin})`,
    )

    return NextResponse.json({
      success: true,
      movies,
      meta: { totalMs, authMs, queryMs, cached: false, serviceRole: !!admin },
    })
  } catch (error) {
    console.error("[api/movies] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load movies" },
      { status: 500 },
    )
  }
}
