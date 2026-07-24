export async function sanitizeImagePrompt(prompt: string): Promise<string> {
  const res = await fetch("/api/ai/sanitize-image-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || "Failed to make prompt AI-appropriate")
  }

  if (!data.prompt || typeof data.prompt !== "string") {
    throw new Error("No rewritten prompt returned")
  }

  return data.prompt
}
