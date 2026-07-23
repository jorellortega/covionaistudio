const DEBUG_STORAGE_KEY = "cinema-debug-linked-audio"

export function isLinkedAudioDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function linkedAudioDebug(...args: unknown[]): void {
  if (!isLinkedAudioDebugEnabled()) return
  console.log("[LinkedAudio]", new Date().toISOString().slice(11, 23), ...args)
}

export function enableLinkedAudioDebug(): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DEBUG_STORAGE_KEY, "1")
  console.info(
    "[LinkedAudio] Debug ON — play a linked video to see logs. Disable: localStorage.removeItem('cinema-debug-linked-audio')",
  )
}

if (typeof window !== "undefined") {
  const globalWindow = window as Window & { enableLinkedAudioDebug?: () => void }
  globalWindow.enableLinkedAudioDebug = enableLinkedAudioDebug

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get("debugLinkedAudio") === "1" && !isLinkedAudioDebugEnabled()) {
      enableLinkedAudioDebug()
    }
  } catch {
    /* ignore */
  }
}
