/** Path prefixes used with `pathMatchesBlockedRoute` (leading slash, no trailing slash). */

/**
 * Every new `public.users` row gets these blocks (DB column default, migration 078).
 * Invite `initial_blocked_routes` are appended on top. Keep in sync with
 * `supabase/migrations/078_default_blocked_routes_new_users.sql`.
 */
export const DEFAULT_BLOCKED_ROUTES_FOR_NEW_USERS = [
  '/admin/users-invites',
  '/ai-settings-admin',
  '/share-control',
  '/settings-ai',
  '/setup-ai',
  '/ai-studio',
  '/ai-info',
  '/cinema-production',
] as const

export type BlockableRoute = {
  path: string
  label: string
  group: string
}

export const BLOCKABLE_ROUTES: BlockableRoute[] = [
  { group: 'Overview', path: '/dashboard', label: 'Dashboard' },

  { group: 'Admin', path: '/admin/users-invites', label: 'Users & invites' },
  { group: 'Admin', path: '/ai-settings-admin', label: 'AI settings (admin)' },
  { group: 'Admin', path: '/share-control', label: 'Share control' },

  { group: 'Account & billing', path: '/settings', label: 'Settings' },
  { group: 'Account & billing', path: '/preferences', label: 'Preferences' },
  { group: 'Account & billing', path: '/subscriptions', label: 'Subscriptions' },
  { group: 'Account & billing', path: '/settings/plans-credits', label: 'Plans & credits' },

  { group: 'AI & keys', path: '/settings-ai', label: 'AI API keys' },
  { group: 'AI & keys', path: '/setup-ai', label: 'Setup AI' },
  { group: 'AI & keys', path: '/ai-studio', label: 'AI studio' },
  { group: 'AI & keys', path: '/ai-info', label: 'AI info' },

  { group: 'Productions', path: '/movies', label: 'Movies' },
  { group: 'Productions', path: '/cinema-production', label: 'Cinema production' },
  { group: 'Productions', path: '/ideas', label: 'Ideas' },
  { group: 'Productions', path: '/treatments', label: 'Treatments' },
  { group: 'Productions', path: '/create-cover', label: 'Create cover' },
  { group: 'Productions', path: '/create-voice', label: 'Create voice' },
  { group: 'Productions', path: '/create-titles', label: 'Create titles' },
  { group: 'Productions', path: '/screenplay', label: 'Screenplays' },
  { group: 'Productions', path: '/timeline', label: 'Timeline' },
  { group: 'Productions', path: '/timeline-scene', label: 'Timeline scene' },
  { group: 'Productions', path: '/storyboards', label: 'Storyboards' },
  { group: 'Productions', path: '/characters', label: 'Characters' },
  { group: 'Productions', path: '/locations', label: 'Locations' },
  { group: 'Productions', path: '/assets', label: 'Assets' },
  { group: 'Productions', path: '/viewmovie', label: 'View movie' },
  { group: 'Productions', path: '/visdev', label: 'Vis dev' },
  { group: 'Productions', path: '/mood-boards', label: 'Mood boards' },
  { group: 'Productions', path: '/writers-page', label: 'Writers page' },

  { group: 'Pre-production', path: '/casting', label: 'Casting' },
  { group: 'Pre-production', path: '/crew-sheet', label: 'Crew sheet' },
  { group: 'Pre-production', path: '/call-sheet', label: 'Call sheet' },
  { group: 'Pre-production', path: '/props-list', label: 'Props list' },
  { group: 'Pre-production', path: '/equipment-list', label: 'Equipment list' },
  { group: 'Pre-production', path: '/lighting-plot', label: 'Lighting plot' },
  { group: 'Pre-production', path: '/prompts-list', label: 'Prompts list' },
  { group: 'Pre-production', path: '/manage-submissions', label: 'Manage submissions' },
]

const CATALOG_PATHS = new Set(BLOCKABLE_ROUTES.map((r) => r.path))

export function splitBlockedRoutesForEditor(stored: unknown): {
  catalogSelected: string[]
  extraLines: string
} {
  const list = Array.isArray(stored)
    ? stored.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
    : []
  const catalogSelected = list.filter((p) => CATALOG_PATHS.has(p))
  const extras = list.filter((p) => !CATALOG_PATHS.has(p))
  return { catalogSelected, extraLines: extras.join('\n') }
}

export function mergeBlockedRoutesFromEditor(catalogSelected: string[], extraRaw: string): string[] {
  const fromExtra = extraRaw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set([...catalogSelected, ...fromExtra])]
}
