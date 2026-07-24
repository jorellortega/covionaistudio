export const CONTENT_BLOCKED_MESSAGE =
  "Content blocked by AI safety filters. Try rephrasing your prompt — remove suggestive, violent, or explicit details while keeping the scene and mood."

export function isContentPolicyError(message: string): boolean {
  if (!message?.trim()) return false
  const lower = message.toLowerCase()
  if (lower === CONTENT_BLOCKED_MESSAGE.toLowerCase()) return true
  return (
    lower.includes("content blocked") ||
    lower.includes("safety filters") ||
    lower.includes("content policy") ||
    lower.includes("safety system") ||
    lower.includes("content_policy_violation") ||
    lower.includes("content_filter") ||
    lower.includes("violates our usage policy") ||
    lower.includes("rejected by the safety") ||
    lower.includes("explicit content") ||
    lower.includes("copyrighted material") ||
    lower.includes("sensitive content") ||
    lower.includes("not allowed by")
  )
}

export function isContentBlockedResponse(data: {
  error?: unknown
  contentBlocked?: unknown
}): boolean {
  if (data.contentBlocked === true) return true
  if (typeof data.error === "string") return isContentPolicyError(data.error)
  return false
}
