import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type ProbeKind =
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

type Probe = {
  source: 'server'
  kind: ProbeKind
  label: string
  detail: string
  urlHost: string | null
  anonPresent: boolean
  origin: null
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

function kindFromStatus(status: number | null, body: string | null): ProbeKind {
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

function labelFor(kind: ProbeKind, status: number | null): string {
  switch (kind) {
    case 'ok':
      return 'Auth/API is reachable from the server'
    case 'cloudflare_522_origin_timeout':
      return 'Cloudflare 522 — origin timed out'
    case 'cloudflare_521_origin_down':
      return 'Cloudflare 521 — origin is down'
    case 'cloudflare_523_origin_unreachable':
      return 'Cloudflare 523 — origin unreachable'
    case 'cloudflare_524_timeout':
      return 'Cloudflare 524 — origin took too long'
    case 'project_paused':
      return 'Supabase project is paused'
    case 'missing_or_invalid_api_key':
      return 'API key missing or rejected'
    case 'jwt_rejected':
      return 'JWT rejected by API Gateway'
    case 'timeout':
      return 'Server request timed out'
    case 'not_configured':
      return 'Supabase env vars are not set'
    default:
      return status ? `HTTP ${status}` : 'Request failed'
  }
}

function detailFor(kind: ProbeKind): string {
  switch (kind) {
    case 'ok':
      return 'Server can reach this project. A browser CORS error with 522 is a Cloudflare timeout page, not a localhost allowlist bug.'
    case 'cloudflare_522_origin_timeout':
      return 'Cloudflare reached the edge but this project’s origin never answered. Not CORS. Not the database query layer until Auth wakes up.'
    case 'project_paused':
      return 'Unpause/restore the project in the Supabase dashboard.'
    case 'timeout':
      return 'No HTTP status — same class of failure as a 522.'
    default:
      return 'See status and body snippet.'
  }
}

function pack(partial: Omit<Probe, 'label' | 'detail'>): Probe {
  return {
    ...partial,
    label: labelFor(partial.kind, partial.status),
    detail: detailFor(partial.kind),
  }
}

async function probe(path: string, url: string, anon: string, timeoutMs: number): Promise<Probe> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}${path}`, {
      method: 'GET',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    const elapsedMs = Date.now() - started
    const bodySnippet = snippet(await res.text().catch(() => ''))
    let kind = kindFromStatus(res.status, bodySnippet)
    // REST without a matching table often 401/404; 401 with anon key still means the API gateway answered.
    if (path.startsWith('/rest/') && res.status === 401) {
      kind = /jwt|invalid token|expired/i.test(bodySnippet || '') ? 'jwt_rejected' : 'ok'
    }
    if (path.startsWith('/auth/') && res.status === 401 && /no api key/i.test(bodySnippet || '')) {
      kind = 'missing_or_invalid_api_key'
    }
    return pack({
      source: 'server',
      kind,
      urlHost: hostFromEnv(url),
      anonPresent: true,
      origin: null,
      status: res.status,
      elapsedMs,
      corsHeader: res.headers.get('access-control-allow-origin'),
      cfRay: res.headers.get('cf-ray'),
      bodySnippet,
    })
  } catch (err) {
    const elapsedMs = Date.now() - started
    const timedOut =
      (err instanceof Error && (err.name === 'AbortError' || /timeout|timed out|aborted/i.test(err.message)))
    return pack({
      source: 'server',
      kind: timedOut ? 'timeout' : 'cors_or_network_blocked',
      urlHost: hostFromEnv(url),
      anonPresent: true,
      origin: null,
      status: null,
      elapsedMs,
      corsHeader: null,
      cfRay: null,
      bodySnippet: snippet(err instanceof Error ? err.message : String(err)),
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    const empty = pack({
      source: 'server',
      kind: 'not_configured',
      urlHost: hostFromEnv(url),
      anonPresent: !!anon,
      origin: null,
      status: null,
      elapsedMs: 0,
      corsHeader: null,
      cfRay: null,
      bodySnippet: null,
    })
    return NextResponse.json({ browserOriginNote: 'server probe', auth: empty, rest: empty })
  }

  const [auth, rest] = await Promise.all([
    probe('/auth/v1/health', url, anon, 12_000),
    probe('/rest/v1/', url, anon, 12_000),
  ])

  return NextResponse.json({
    browserOriginNote:
      'Server probe bypasses browser CORS. If the browser says CORS and this returns 522, the CORS message is a lie.',
    auth,
    rest,
  })
}
