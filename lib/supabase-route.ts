import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/** Supabase client for Next.js route handlers (reads session from cookies). */
export async function createRouteSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
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
            // setAll can fail in Server Components; safe to ignore for read-only auth.
          }
        },
      },
    },
  )
}

/** Resolve authenticated user in route handlers (cookies, bearer token, session fallback). */
export async function getRouteAuthUser(
  supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>,
  request?: NextRequest,
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) return user

  const authHeader = request?.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null
  if (bearerToken) {
    const {
      data: { user: tokenUser },
    } = await supabase.auth.getUser(bearerToken)
    if (tokenUser) return tokenUser
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.user ?? null
}
