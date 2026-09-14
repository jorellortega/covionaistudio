export const STUDIO_CREDITS_CHANGED_EVENT = 'studio-credits-changed'

export function notifyStudioCreditsChanged(balance?: number | null) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(STUDIO_CREDITS_CHANGED_EVENT, {
      detail: { balance: typeof balance === 'number' ? balance : null },
    }),
  )
}

export function isInsufficientCreditsPayload(
  payload: unknown,
): payload is { code: 'INSUFFICIENT_CREDITS'; error?: string; required: number; balance: number } {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as { code?: string; required?: unknown; balance?: unknown }
  return (
    value.code === 'INSUFFICIENT_CREDITS' &&
    typeof value.required === 'number' &&
    typeof value.balance === 'number'
  )
}

export function insufficientCreditsDescription(payload: {
  error?: string
  required: number
  balance: number
}): string {
  if (payload.error) return payload.error
  return `Not enough credits. This costs ${payload.required.toLocaleString()} credits. You have ${payload.balance.toLocaleString()}.`
}

export function notifyCreditsFromResult(result: {
  creditsRemaining?: unknown
  creditsCharged?: unknown
}) {
  if (typeof result.creditsRemaining === 'number') {
    notifyStudioCreditsChanged(result.creditsRemaining)
  } else if (typeof result.creditsCharged === 'number' && result.creditsCharged > 0) {
    notifyStudioCreditsChanged()
  }
}

export function creditsUsedNote(result: { creditsCharged?: unknown }): string {
  if (typeof result.creditsCharged === 'number' && result.creditsCharged > 0) {
    return ` ${result.creditsCharged.toLocaleString()} credits used.`
  }
  return ''
}

export function throwIfInsufficientCredits(payload: unknown): void {
  if (!isInsufficientCreditsPayload(payload)) return
  notifyStudioCreditsChanged(payload.balance)
  throw new Error(`${insufficientCreditsDescription(payload)} Add credits in Plans & credits.`)
}

export function clientCostSourceFromPath(pathname?: string): string | undefined {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  if (path.startsWith('/timeline')) return 'timeline'
  if (path.startsWith('/screenplay')) return 'screenplay'
  if (path.startsWith('/storyboards')) return 'storyboard'
  if (path.startsWith('/shotlist')) return 'shotlist'
  if (path.startsWith('/locations')) return 'locations'
  if (path.startsWith('/avatars')) return 'avatars'
  if (path.startsWith('/characters')) return 'characters'
  if (path.startsWith('/objects')) return 'objects'
  if (path.startsWith('/prompt-create')) return 'prompt-create'
  if (path.startsWith('/create-voice')) return 'create-voice'
  if (path.startsWith('/new')) return 'workspace'
  return undefined
}

export function requirePaidGenerationSuccess(
  ok: boolean,
  payload: unknown,
  fallbackError: string,
): Record<string, unknown> {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  if (!ok) {
    throwIfInsufficientCredits(data)
    throw new Error(typeof data.error === 'string' ? data.error : fallbackError)
  }
  notifyCreditsFromResult(data)
  return data
}

export function paidGenerationImageUrl(result: Record<string, unknown>): string | null {
  for (const key of ["bucketUrl", "imageUrl", "url"] as const) {
    const value = result[key]
    if (typeof value === "string" && value) return value
  }
  return null
}
