import { accountAccessExpired, pathMatchesBlockedRoute } from '@/lib/path-access'

export type AccountAccessRow = {
  login_disabled: boolean | null
  access_expires_at: string | null
  blocked_routes: unknown
}

type CacheEntry = { row: AccountAccessRow; expiresAt: number }

const cache = new Map<string, CacheEntry>()
const TTL_MS = 10 * 60 * 1000

export function getCachedAccountAccess(userId: string): AccountAccessRow | null {
  const entry = cache.get(userId)
  if (!entry || entry.expiresAt <= Date.now()) return null
  return entry.row
}

export function setCachedAccountAccess(userId: string, row: AccountAccessRow) {
  cache.set(userId, { row, expiresAt: Date.now() + TTL_MS })
}

export function clearAccountAccessCache(userId?: string) {
  if (userId) cache.delete(userId)
  else cache.clear()
}

export function shouldBlockRoute(pathname: string, row: AccountAccessRow): boolean {
  return pathMatchesBlockedRoute(pathname, row.blocked_routes)
}

export function shouldForceLogout(row: AccountAccessRow): 'disabled' | 'expired' | null {
  if (row.login_disabled) return 'disabled'
  if (accountAccessExpired(row.access_expires_at)) return 'expired'
  return null
}
