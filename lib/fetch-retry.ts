export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

export function isRetryableFetchError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return (
    msg.includes("load failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("fetch failed") ||
    msg.includes("aborted") ||
    msg.includes("access control checks")
  )
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 800
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.warn(`[retry] ${label} attempt ${attempt + 1}/${retries + 1}`)
      }
      return await fn()
    } catch (error) {
      lastError = error
      const retryable = isRetryableFetchError(error)
      if (!retryable || attempt >= retries) throw error
      const delay = baseDelayMs * (attempt + 1)
      console.warn(`[retry] ${label} failed (${getErrorMessage(error)}), waiting ${delay}ms…`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw lastError
}
