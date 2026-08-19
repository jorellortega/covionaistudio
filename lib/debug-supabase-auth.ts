export type SupabaseProbeKind =
  | 'ok'
  | 'cloudflare_522_origin_timeout'
  | 'cloudflare_521_origin_down'
  | 'cloudflare_523_origin_unreachable'
  | 'cloudflare_524_timeout'
  | 'project_paused'
  | 'missing_or_invalid_api_key'
  | 'jwt_rejected'
  | 'cors_or_network_blocked'
  | 'timeout'
  | 'http_error'
  | 'not_configured'

export type SupabaseProbeResult = {
  source: 'browser' | 'server'
  kind: SupabaseProbeKind
  label: string
  detail: string
  urlHost: string | null
  anonPresent: boolean
  origin: string | null
  status: number | null
  elapsedMs: number
  corsHeader: string | null
  cfRay: string | null
  bodySnippet: string | null
}

function hostFromEnv(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function snippet(text: string | null, max = 220): string | null {
  if (!text) return null
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max)}…` : compact
}

function kindFromStatus(status: number | null, body: string | null): SupabaseProbeKind {
  if (status === 521) return 'cloudflare_521_origin_down'
  if (status === 522) return 'cloudflare_522_origin_timeout'
  if (status === 523) return 'cloudflare_523_origin_unreachable'
  if (status === 524) return 'cloudflare_524_timeout'
  const lower = (body || '').toLowerCase()
  if (status === 402 || /project (is )?paused|inactive project/.test(lower)) return 'project_paused'
  if (status === 401 && /jwt|invalid token|expired/.test(lower)) return 'jwt_rejected'
  if (status === 401) return 'missing_or_invalid_api_key'
  if (status && status >= 200 && status < 300) return 'ok'
  if (status) return 'http_error'
  return 'cors_or_network_blocked'
}

function labelFor(kind: SupabaseProbeKind, status: number | null): string {
  switch (kind) {
    case 'ok':
      return 'Auth is reachable'
    case 'cloudflare_522_origin_timeout':
      return 'Cloudflare 522 — Auth origin timed out'
    case 'cloudflare_521_origin_down':
      return 'Cloudflare 521 — Auth origin is down'
    case 'cloudflare_523_origin_unreachable':
      return 'Cloudflare 523 — Auth origin unreachable'
    case 'cloudflare_524_timeout':
      return 'Cloudflare 524 — Auth took too long'
    case 'project_paused':
      return 'Supabase project is paused'
    case 'missing_or_invalid_api_key':
      return 'API key missing or rejected'
    case 'jwt_rejected':
      return 'JWT rejected by API Gateway'
    case 'cors_or_network_blocked':
      return 'Browser blocked the response (often a hidden 522)'
    case 'timeout':
      return 'Request timed out before a response'
    case 'not_configured':
      return 'Supabase env vars are not set'
    default:
      return status ? `HTTP ${status} from Auth` : 'Auth request failed'
  }
}

function detailFor(
  kind: SupabaseProbeKind,
  opts: { status: number | null; corsHeader: string | null; source: 'browser' | 'server' }
): string {
  switch (kind) {
    case 'ok':
      return 'This is not a CORS or database outage. Login failures are credentials or account-state.'
    case 'cloudflare_522_origin_timeout':
      return 'Not CORS and not your password. Cloudflare waited for this project’s Auth service and got no answer. Check the dashboard (paused/unhealthy) or retry — it is often intermittent.'
    case 'cloudflare_521_origin_down':
    case 'cloudflare_523_origin_unreachable':
      return 'The hosted project origin is not answering. Check the Supabase dashboard for paused compute or an unhealthy Auth service.'
    case 'cloudflare_524_timeout':
      return 'Auth started but did not finish in time. Usually a hosted-project/gateway issue, not localhost config.'
    case 'project_paused':
      return 'Free-tier projects pause after inactivity. Open the Supabase dashboard and restore/unpause the project.'
    case 'cors_or_network_blocked':
      return opts.source === 'browser'
        ? 'Safari/Chrome hide Cloudflare 5xx as a CORS error because the error page has no Access-Control-Allow-Origin. Use the server probe status to see the real code.'
        : 'The server could not complete the request (network/DNS/timeout).'
    case 'jwt_rejected':
      return 'Matches the current Supabase API Gateway incident: some refreshed JWTs are rejected with 401.'
    case 'missing_or_invalid_api_key':
      return 'Health without a key returns 401 (normal). If this happens with the anon key present, the key may be wrong for this project.'
    case 'timeout':
      return 'No HTTP status came back. Same class of problem as a 522 — the hosted Auth service did not answer in time.'
    case 'not_configured':
      return 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in this environment.'
    default:
      return opts.corsHeader
        ? `CORS header was "${opts.corsHeader}", so this is not a localhost origin-allowlist problem.`
        : 'Unexpected Auth HTTP status.'
  }
}

export function diagnoseAuthError(err: unknown): { kind: SupabaseProbeKind; label: string; detail: string } {
  const anyErr = err as {
    name?: string
    message?: string
    status?: number
    code?: string
  } | null
  const message = anyErr?.message || (err instanceof Error ? err.message : String(err))
  const status = typeof anyErr?.status === 'number' ? anyErr.status : null
  const name = anyErr?.name || ''
  const fetchFailed =
    name === 'AuthRetryableFetchError' ||
    /failed to fetch|load failed|networkerror|network request failed/i.test(message)

  if (fetchFailed) {
    const kind: SupabaseProbeKind = 'cors_or_network_blocked'
    return {
      kind,
      label: 'Sign-in never reached Auth (fetch failed)',
      detail:
        'The SDK error is usually "Load failed" / CORS. That almost always means Cloudflare 522 (origin timeout) or the project is paused — not a wrong password.',
    }
  }

  const kind = kindFromStatus(status, message)
  return {
    kind,
    label: status ? `Sign-in HTTP ${status}: ${message}` : message,
    detail: detailFor(kind, { status, corsHeader: null, source: 'browser' }),
  }
}

function result(partial: Omit<SupabaseProbeResult, 'label' | 'detail'>): SupabaseProbeResult {
  return {
    ...partial,
    label: labelFor(partial.kind, partial.status),
    detail: detailFor(partial.kind, {
      status: partial.status,
      corsHeader: partial.corsHeader,
      source: partial.source,
    }),
  }
}

export async function probeSupabaseAuthFromBrowser(
  timeoutMs = 12_000
): Promise<SupabaseProbeResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const origin = typeof window !== 'undefined' ? window.location.origin : null
  const started = performance.now()

  if (!url || !anon) {
    return result({
      source: 'browser',
      kind: 'not_configured',
      urlHost: hostFromEnv(url),
      anonPresent: !!anon,
      origin,
      status: null,
      elapsedMs: 0,
      corsHeader: null,
      cfRay: null,
      bodySnippet: null,
    })
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const elapsedMs = Math.round(performance.now() - started)
    const bodySnippet = snippet(await res.text().catch(() => ''))
    const corsHeader = res.headers.get('access-control-allow-origin')
    return result({
      source: 'browser',
      kind: kindFromStatus(res.status, bodySnippet),
      urlHost: hostFromEnv(url),
      anonPresent: true,
      origin,
      status: res.status,
      elapsedMs,
      corsHeader,
      cfRay: res.headers.get('cf-ray'),
      bodySnippet,
    })
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - started)
    const timedOut =
      (err instanceof DOMException && err.name === 'TimeoutError') ||
      (err instanceof Error && /timeout|timed out|aborted/i.test(err.message))
    return result({
      source: 'browser',
      kind: timedOut ? 'timeout' : 'cors_or_network_blocked',
      urlHost: hostFromEnv(url),
      anonPresent: true,
      origin,
      status: null,
      elapsedMs,
      corsHeader: null,
      cfRay: null,
      bodySnippet: snippet(err instanceof Error ? err.message : String(err)),
    })
  }
}

export async function probeSupabaseAuthFromServer(): Promise<{
  browserOriginNote: string
  auth: SupabaseProbeResult
  rest: SupabaseProbeResult
} | null> {
  try {
    const res = await fetch('/api/debug/supabase', { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as {
      browserOriginNote: string
      auth: SupabaseProbeResult
      rest: SupabaseProbeResult
    }
  } catch {
    return null
  }
}

function isAuthOriginDown(kind: SupabaseProbeKind | undefined): boolean {
  return (
    kind === 'timeout' ||
    kind === 'cors_or_network_blocked' ||
    kind === 'cloudflare_521_origin_down' ||
    kind === 'cloudflare_522_origin_timeout' ||
    kind === 'cloudflare_523_origin_unreachable' ||
    kind === 'cloudflare_524_timeout'
  )
}

export function summarizeDiagnosis(opts: {
  browser: SupabaseProbeResult | null
  serverAuth: SupabaseProbeResult | null
  serverRest: SupabaseProbeResult | null
  signIn?: { kind: SupabaseProbeKind; label: string; detail: string } | null
}): string {
  const server = opts.serverAuth
  const browser = opts.browser
  const rest = opts.serverRest
  const restUp = rest?.kind === 'ok' || rest?.status === 401

  if (restUp && (isAuthOriginDown(server?.kind) || isAuthOriginDown(browser?.kind))) {
    return 'Auth service is down (522/timeout). Database API is up. Not CORS, not your password.'
  }

  if (server && server.kind.startsWith('cloudflare_')) {
    return server.label
  }
  if (server?.kind === 'project_paused' || browser?.kind === 'project_paused') {
    return 'Supabase project is paused'
  }
  if (opts.signIn && opts.signIn.kind !== 'cors_or_network_blocked' && opts.signIn.kind !== 'timeout') {
    return opts.signIn.label
  }
  if (browser?.kind === 'cors_or_network_blocked' && server?.kind === 'ok') {
    return 'Browser CORS/network block; server can reach Auth — retry, or check a local network/extension filter'
  }
  if (server?.kind === 'ok' && rest && rest.kind !== 'ok' && rest.status !== 401) {
    return `Auth is up, REST is not (${rest.label})`
  }
  if (server?.kind === 'ok' || browser?.kind === 'ok') {
    return opts.signIn?.label || 'Auth is reachable — this is not a hosted outage'
  }
  return browser?.label || server?.label || 'Could not diagnose Auth yet'
}
