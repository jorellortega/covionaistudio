const IMAGE_REQUEST_PATTERNS = [
  /\b(give|show|create|make|generate|draw|produce|get)\s+(me\s+)?(an?\s+)?(the\s+)?(image|picture|photo|visual|illustration|render|artwork|poster|cover)\b/i,
  /\b(image|picture|visual|illustration|render)\s+of\b/i,
  /\bcan you\s+(make|create|generate|draw|show)\b.*\b(image|picture|visual|it)\b/i,
  /\bwhat\s+(does|do|would)\s+.+\s+look\s+like\b/i,
  /\bvisualize\b/i,
  /\bshow me how\b/i,
]

export function detectImageRequest(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return IMAGE_REQUEST_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function buildImagePromptInstruction(
  conversationHistory: { role: string; content: string }[],
  userMessage: string,
): string {
  const context = conversationHistory
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  return `You are building a cinematic image generation prompt from a filmmaking conversation.

Conversation so far:
${context}

The user just asked: "${userMessage}"

Write ONE detailed cinematic image prompt that captures what the user wants to see, using ALL relevant visual details from the conversation (character appearance, setting, mood, lighting, style).

Rules:
- Output ONLY the image prompt text, nothing else
- Start with "Cinematic film still,"
- Be vivid and specific
- Max 500 characters
- Do not say you cannot generate images`
}

const TREATMENT_SIGNAL_PATTERNS = [
  /\btreatment\b/i,
  /\blogline\s*:/i,
  /\bgenre\s*:/i,
  /\bact\s*[1-3]\b/i,
  /\bact\s+(one|two|three|i{1,3}|iv|v)\b/i,
  /\bsynopsis\b/i,
  /\bstory\s+treatment\b/i,
  /\bthree[\s-]?act\b/i,
]

export interface ParsedTreatment {
  title: string
  genre: string
  logline: string
  synopsis: string
  prompt: string
}

export function detectTreatmentContent(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length < 150) return false
  const matchCount = TREATMENT_SIGNAL_PATTERNS.filter((p) => p.test(trimmed)).length
  return matchCount >= 2
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim()
}

export function parseTreatmentFields(content: string, fallbackTitle: string): ParsedTreatment {
  const genreMatch = content.match(/Genre:\s*(.+?)(?:\n|$)/i)
  const loglineMatch = content.match(/Logline:\s*(.+?)(?:\n|$)/i)
  const titleLabelMatch = content.match(/(?:^|\n)Title:\s*(.+?)(?:\n|$)/i)

  let title = fallbackTitle !== "Untitled Project" ? fallbackTitle : "Untitled Treatment"
  if (titleLabelMatch?.[1]) {
    title = stripWrappingQuotes(titleLabelMatch[1])
  } else {
    const firstLine = content.split("\n").find((l) => {
      const t = l.trim()
      return t.length > 3 && t.length < 100 && !/^(genre|logline|treatment|act|synopsis)\b/i.test(t)
    })
    if (firstLine) {
      title = stripWrappingQuotes(firstLine.replace(/[*#_]/g, ""))
    }
  }

  title = stripWrappingQuotes(title)
  const genre = stripWrappingQuotes(genreMatch?.[1]?.trim() || "Unspecified")
  const logline = stripWrappingQuotes(loglineMatch?.[1]?.trim() || "")
  const synopsis = logline.length > 0 && logline.length <= 600 ? logline : ""

  return { title, genre, logline, synopsis, prompt: content }
}
