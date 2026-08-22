import "./nodejs-dns"

const FETCH_TIMEOUT_MS = 12_000
const MAX_ATTEMPTS = 3

function isRetryableFetchError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error && "cause" in error ? String((error as { cause?: unknown }).cause) : ""
  const text = `${name} ${message} ${cause}`.toLowerCase()
  return (
    name === "AbortError" ||
    text.includes("fetch failed") ||
    text.includes("aborted") ||
    text.includes("timeout") ||
    text.includes("econnreset") ||
    text.includes("und_err")
  )
}

/** Node fetch wrapper: IPv4-first DNS, abort hung sockets, retry transient Cloudflare/undici failures. */
export async function supabaseServerFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const onOuterAbort = () => controller.abort()
    init?.signal?.addEventListener("abort", onOuterAbort)

    try {
      return await fetch(input, {
        ...init,
        cache: "no-store",
        signal: controller.signal,
      })
    } catch (error) {
      lastError = error
      if (!isRetryableFetchError(error) || attempt >= MAX_ATTEMPTS) throw error
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
    } finally {
      clearTimeout(timeout)
      init?.signal?.removeEventListener("abort", onOuterAbort)
    }
  }

  throw lastError
}
