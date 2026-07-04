import { getSupabaseClient } from './supabase'
import type { User } from '@supabase/supabase-js'

/** Prefer session over getUser() — getUser() hits /auth/v1/user and can 403 + sign you out on flaky networks. */
export async function getSessionUser(): Promise<User | null> {
  const { data: { session } } = await getSupabaseClient().auth.getSession()
  return session?.user ?? null
}

export async function requireSessionUser(): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new Error('User not authenticated')
  return user
}
