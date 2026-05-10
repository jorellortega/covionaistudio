/**
 * Returns true if pathname should be blocked given a JSON array of path prefixes.
 */
export function pathMatchesBlockedRoute(pathname: string, blockedRoutes: unknown): boolean {
  if (!pathname || !blockedRoutes) return false
  if (!Array.isArray(blockedRoutes)) return false
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  for (const entry of blockedRoutes) {
    if (typeof entry !== 'string' || !entry.trim()) continue
    const prefix = entry.startsWith('/') ? entry : `/${entry}`
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true
    }
  }
  return false
}

export function accountAccessExpired(accessExpiresAt: string | null | undefined): boolean {
  if (!accessExpiresAt) return false
  const t = new Date(accessExpiresAt).getTime()
  if (Number.isNaN(t)) return false
  return t <= Date.now()
}
