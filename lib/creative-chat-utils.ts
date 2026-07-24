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
  const focus = detectImageRequestFocus(userMessage, conversationHistory)
  const context = conversationHistory
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  const locationSource = [...conversationHistory].reverse().find(
    (m) => m.role === 'assistant' && detectLocationContent(m.content),
  )?.content

  const characterSource = [...conversationHistory].reverse().find(
    (m) => m.role === 'assistant' && detectCharacterContent(m.content),
  )?.content

  if (focus === 'location') {
    return `You are building a cinematic LOCATION/ESTABLISHING SHOT image prompt.

The user asked: "${userMessage}"

Primary location description:
${locationSource || 'Derive the setting only from the conversation below.'}

Conversation (use ONLY environment, architecture, landscape, and atmosphere — ignore characters):
${context}

Rules:
- Output ONLY the image prompt text, nothing else
- Start with "Cinematic film still,"
- EMPTY establishing shot — NO people, NO characters, NO actors, NO vehicles with riders unless the user explicitly asked for people
- Focus on: place, landscape, architecture, weather, lighting, mood, textures, time of day
- Do NOT include character names (e.g. Santiago) or story plot
- Max 500 characters
- Do not say you cannot generate images`
  }

  if (focus === 'character') {
    return `You are building a cinematic CHARACTER portrait image prompt.

The user asked: "${userMessage}"

Primary character description:
${characterSource || 'Derive the character only from the conversation below.'}

Conversation:
${context}

Rules:
- Output ONLY the image prompt text, nothing else
- Start with "Cinematic film still,"
- Focus on the character's appearance, wardrobe, expression, and framing
- Use setting only as subtle background context
- Max 500 characters
- Do not say you cannot generate images`
  }

  return `You are building a cinematic image generation prompt from a filmmaking conversation.

Conversation so far:
${context}

The user just asked: "${userMessage}"

Write ONE detailed cinematic image prompt that captures what the user wants to see. Match the subject they asked for (location, character, or scene).

Rules:
- Output ONLY the image prompt text, nothing else
- Start with "Cinematic film still,"
- Be vivid and specific
- If they asked for a location, do NOT add characters unless they asked for people
- If they asked for a character, focus on the character
- Max 500 characters
- Do not say you cannot generate images`
}

export type ImageRequestFocus = 'location' | 'character' | 'general'

export function detectImageRequestFocus(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
): ImageRequestFocus {
  if (isLocationImageRequest(userMessage) || /\bthis location\b/i.test(userMessage)) {
    return 'location'
  }
  if (isCharacterImageRequest(userMessage) || /\bthis character\b/i.test(userMessage)) {
    return 'character'
  }

  if (
    /\b(image|picture|photo|show me|generate|visualize|draw)\b/i.test(userMessage) &&
    /\b(it|this|the scene|the setting|the place)\b/i.test(userMessage)
  ) {
    const lastAssistant = [...conversationHistory].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant && detectLocationContent(lastAssistant.content)) return 'location'
    if (lastAssistant && detectCharacterContent(lastAssistant.content)) return 'character'
  }

  const recentUserImage = [...conversationHistory].reverse().find(
    (m) => m.role === 'user' && detectImageRequest(m.content),
  )
  if (recentUserImage) {
    if (isLocationImageRequest(recentUserImage.content) || /\bthis location\b/i.test(recentUserImage.content)) {
      return 'location'
    }
    if (isCharacterImageRequest(recentUserImage.content)) return 'character'
  }

  return 'general'
}

export function buildImagePromptText(
  conversationHistory: { role: string; content: string }[],
  userMessage: string,
): string {
  const focus = detectImageRequestFocus(userMessage, conversationHistory)

  if (focus === 'location') {
    const locationSource = [...conversationHistory].reverse().find(
      (m) => m.role === 'assistant' && detectLocationContent(m.content),
    )?.content || userMessage
    const parsed = parseLocationFields(locationSource, 'Untitled')
    const envDetails = [
      parsed.visualDescription,
      parsed.atmosphere && `${parsed.atmosphere} atmosphere`,
      parsed.mood && `${parsed.mood} mood`,
      parsed.type && `${parsed.type} environment`,
    ].filter(Boolean).join(', ')
    return `Cinematic film still, empty establishing shot of ${parsed.name}, ${envDetails}, wide angle, no people, no characters, environmental landscape, cinematic lighting`.slice(0, 500)
  }

  if (focus === 'character') {
    const characterSource = [...conversationHistory].reverse().find(
      (m) => m.role === 'assistant' && detectCharacterContent(m.content),
    )?.content || userMessage
    const parsed = parseCharacterFields(characterSource, 'Untitled')
    return `Cinematic film still, portrait of ${parsed.name}, ${parsed.description}`.slice(0, 500)
  }

  return `Cinematic film still, ${userMessage}`.slice(0, 500)
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

const CHARACTER_SIGNAL_PATTERNS = [
  /\bcharacter\b/i,
  /\bprotagonist\b/i,
  /\bantagonist\b/i,
  /\bmain character\b/i,
  /\bsupporting character\b/i,
  /\bcharacter profile\b/i,
  /\bcharacter sheet\b/i,
  /\bvisual description\b/i,
  /\bappearance\b/i,
  /\bbackstory\b/i,
  /\bpersonality\b/i,
  /\barchetype\b/i,
  /\bphysical description\b/i,
  /\b\d+[\s-]?year[\s-]?old\b/i,
  /\b(he|she|they)\s+(is|was|has|wears|stands|looks)\b/i,
  /\b(role in (the )?story|story role)\b/i,
]

export interface ParsedCharacter {
  name: string
  age: number | null
  gender: string
  description: string
  archetype: string
  backstory: string
  roleInStory: string
  characterType: 'main' | 'supporting' | 'extra' | null
  prompt: string
}

export function detectCharacterContent(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length < 80) return false
  if (detectTreatmentContent(trimmed)) return false
  const matchCount = CHARACTER_SIGNAL_PATTERNS.filter((p) => p.test(trimmed)).length
  return matchCount >= 2
}

function extractCharacterName(content: string): string | null {
  const patterns = [
    /(?:main character|protagonist|character)\s+(?:in\s+[^,]+?\s+)?is\s+([A-Z][a-zA-Z''-]+)/i,
    /(?:named|called)\s+([A-Z][a-zA-Z''-]+)/i,
    /(?:^|\n)(?:Name|Character):\s*(.+?)(?:\n|$)/i,
    /(?:^|\n)#+\s*([A-Z][a-zA-Z''-]+(?:\s+[A-Z][a-zA-Z''-]+)?)\s*(?:\n|$)/,
    /\bis\s+([A-Z][a-zA-Z''-]+),\s+(?:the\s+)?\d+/i,
    /\bis\s+([A-Z][a-zA-Z''-]+),\s+(?:a|an|the)\s+/i,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match?.[1]) {
      const name = stripWrappingQuotes(match[1].split(/[,—–-]/)[0].trim())
      if (name.length >= 2 && name.length <= 60) return name
    }
  }

  return null
}

function extractAge(content: string): number | null {
  const match = content.match(/(\d{1,3})[\s-]?year[\s-]?old/i) || content.match(/Age:\s*(\d{1,3})/i)
  if (!match?.[1]) return null
  const age = parseInt(match[1], 10)
  return age > 0 && age < 150 ? age : null
}

function extractGender(content: string): string {
  const genderMatch = content.match(/Gender:\s*(.+?)(?:\n|$)/i)
  if (genderMatch?.[1]) return stripWrappingQuotes(genderMatch[1])

  if (/\b(she|her|hers)\b/i.test(content)) return 'Female'
  if (/\b(he|him|his)\b/i.test(content) && !/\b(the|they)\b/i.test(content.slice(0, 80))) return 'Male'
  if (/\b(they|them|their)\b/i.test(content)) return 'Non-binary'

  return ''
}

function extractCharacterType(content: string): ParsedCharacter['characterType'] {
  if (/\b(main character|protagonist|lead)\b/i.test(content)) return 'main'
  if (/\b(supporting character|side character|secondary)\b/i.test(content)) return 'supporting'
  if (/\b(extra|background character|cameo)\b/i.test(content)) return 'extra'
  return null
}

export function parseCharacterFields(content: string, fallbackTitle: string): ParsedCharacter {
  const nameLabelMatch = content.match(/(?:^|\n)Name:\s*(.+?)(?:\n|$)/i)
  const archetypeMatch = content.match(/(?:^|\n)Archetype:\s*(.+?)(?:\n|$)/i)
  const backstoryMatch = content.match(/(?:^|\n)Backstory:\s*(.+?)(?:\n\n|$)/is)
  const roleMatch = content.match(/(?:^|\n)(?:Role|Role in story):\s*(.+?)(?:\n|$)/i)

  const extractedName = extractCharacterName(content)
  let name = extractedName || fallbackTitle
  if (nameLabelMatch?.[1]) {
    name = stripWrappingQuotes(nameLabelMatch[1])
  }
  if (name === fallbackTitle || name === 'Untitled Project') {
    name = extractedName || 'Unnamed Character'
  }

  const age = extractAge(content)
  const gender = extractGender(content)
  const archetype = stripWrappingQuotes(archetypeMatch?.[1]?.trim() || '')
  const backstory = stripWrappingQuotes(backstoryMatch?.[1]?.trim() || '')
  const roleInStory = stripWrappingQuotes(
    roleMatch?.[1]?.trim() || '',
  )

  return {
    name: stripWrappingQuotes(name),
    age,
    gender,
    description: content.trim(),
    archetype,
    backstory,
    roleInStory,
    characterType: extractCharacterType(content),
    prompt: content.trim(),
  }
}

export function extractMovieTitleFromContent(content: string): string | null {
  const patterns = [
    /\bin\s+['"']([^'"]{2,80})['"']/i,
    /\bfrom\s+['"']([^'"]{2,80})['"']/i,
    /\bfor\s+['"']([^'"]{2,80})['"']/i,
    /(?:^|\n)(?:Film|Movie|Title|Project):\s*(.+?)(?:\n|$)/i,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match?.[1]) {
      const title = stripWrappingQuotes(match[1].trim())
      if (title.length >= 2 && title.length <= 80) return title
    }
  }

  return null
}

export function findMovieByTitle(
  movies: { id: string; name: string }[],
  title: string | null | undefined,
): { id: string; name: string } | null {
  const normalized = title?.trim().toLowerCase()
  if (!normalized || normalized === "untitled project") return null
  const match = movies.find((m) => m.name.trim().toLowerCase() === normalized)
  return match ? { id: match.id, name: match.name } : null
}

const LOCATION_SIGNAL_PATTERNS = [
  /\blocation\b/i,
  /\bsetting\b/i,
  /\bscene (?:takes place|is set)\b/i,
  /\binterior\b/i,
  /\bexterior\b/i,
  /\batmosphere\b/i,
  /\bvisual description\b/i,
  /\blighting\b/i,
  /\btime of day\b/i,
  /\b(key )?filming location\b/i,
  /\bproduction design\b/i,
  /\b(set|shot|filmed) (at|in)\b/i,
  /\b(warehouse|street|alley|rooftop|basement|kitchen|bedroom|hallway|forest|beach|desert|mountain|downtown|suburb|highway|bridge|abandoned|ruins|mansion|apartment|office|bar|cafe|restaurant|hospital|school|church|temple|park|plaza|market|dock|harbor|airport|station|factory|mill|barn|ranch|courtyard|plaza)\b/i,
]

export interface ParsedLocation {
  name: string
  description: string
  type: 'interior' | 'exterior' | 'both' | null
  atmosphere: string
  mood: string
  visualDescription: string
  lightingNotes: string
  city: string
  prompt: string
}

export function detectLocationContent(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length < 80) return false
  if (detectTreatmentContent(trimmed)) return false
  if (detectCharacterContent(trimmed)) return false
  const matchCount = LOCATION_SIGNAL_PATTERNS.filter((p) => p.test(trimmed)).length
  return matchCount >= 2
}

function isLocationImageRequest(content: string): boolean {
  if (/\b(this location|the location|that location)\b/i.test(content)) {
    return true
  }
  return /\b(image|picture|visual|photo|show me|generate|create|draw)\b/i.test(content) &&
    /\b(location|setting|place|scene|racetrack|ranch|town|countryside|landscape|backdrop)\b/i.test(content)
}

function isCharacterImageRequest(content: string): boolean {
  return /\b(image|picture|visual|photo|show me|generate|create|draw|portrait|avatar)\b/i.test(content) &&
    /\b(character|protagonist|avatar|portrait)\b/i.test(content)
}

export interface ResolvedMessageContext {
  isCharacter: boolean
  isLocation: boolean
  contextContent: string
}

export function resolveCreativeMessageContext(
  message: { role: string; content: string },
  messageIndex: number,
  allMessages: { role: string; content: string }[],
  workspaceTitle: string,
): ResolvedMessageContext {
  if (message.role !== 'assistant') {
    return { isCharacter: false, isLocation: false, contextContent: message.content }
  }

  const directCharacter = detectCharacterContent(message.content)
  const directLocation = !directCharacter && detectLocationContent(message.content)
  if (directCharacter || directLocation) {
    return {
      isCharacter: directCharacter,
      isLocation: directLocation,
      contextContent: message.content,
    }
  }

  const recent = allMessages.slice(Math.max(0, messageIndex - 8), messageIndex + 1)
  const recentUserImageRequest = [...recent].reverse().find(
    (m) => m.role === 'user' && /\b(image|picture|visual|photo|show me|generate)\b/i.test(m.content),
  )

  if (recentUserImageRequest) {
    if (isLocationImageRequest(recentUserImageRequest.content)) {
      const locationSource = [...recent].reverse().find(
        (m) => m.role === 'assistant' && detectLocationContent(m.content),
      )
      const combined = recent.map((m) => m.content).join('\n\n')
      return {
        isCharacter: false,
        isLocation: true,
        contextContent: locationSource?.content || combined || message.content,
      }
    }
    if (isCharacterImageRequest(recentUserImageRequest.content)) {
      const characterSource = [...recent].reverse().find(
        (m) => m.role === 'assistant' && detectCharacterContent(m.content),
      )
      const combined = recent.map((m) => m.content).join('\n\n')
      return {
        isCharacter: true,
        isLocation: false,
        contextContent: characterSource?.content || combined || message.content,
      }
    }
  }

  const combined = recent.map((m) => m.content).join('\n\n')
  if (detectCharacterContent(combined)) {
    return { isCharacter: true, isLocation: false, contextContent: combined }
  }
  if (detectLocationContent(combined)) {
    return { isCharacter: false, isLocation: true, contextContent: combined }
  }

  return { isCharacter: false, isLocation: false, contextContent: message.content }
}

function extractLocationName(content: string, fallbackTitle: string): string {
  const patterns = [
    /(?:key )?location\s+(?:for|in)\s+[^.]+\s+is\s+(?:an?\s+)?([^.,\n]+)/i,
    /(?:^|\n)(?:Location|Name|Setting):\s*(.+?)(?:\n|$)/i,
    /(?:key )?location (?:is|called|named)\s+(?:the\s+)?['"]?([^'".,\n]+)/i,
    /(?:the )?setting (?:is|takes place (?:at|in))\s+(?:the\s+)?['"]?([^'".,\n]+)/i,
    /(?:^|\n)#+\s*(.+?)(?:\n|$)/,
    /(?:filmed|set|located) (?:at|in)\s+(?:the\s+)?['"]?([A-Z][^'".,\n]{2,60})/i,
    /(?:image of|generate (?:an? )?image of)\s+(?:the\s+)?([^.,\n]{3,80})/i,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match?.[1]) {
      const name = stripWrappingQuotes(match[1].trim().replace(/^(a|an|the)\s+/i, ""))
      if (name.length >= 2 && name.length <= 80) return name
    }
  }

  if (fallbackTitle && fallbackTitle !== "Untitled Project") {
    return fallbackTitle
  }

  return "Unnamed Location"
}

function extractLocationType(content: string): ParsedLocation['type'] {
  const typeMatch = content.match(/(?:^|\n)Type:\s*(interior|exterior|both)/i)
  if (typeMatch?.[1]) return typeMatch[1].toLowerCase() as ParsedLocation['type']
  if (/\binterior\b/i.test(content) && /\bexterior\b/i.test(content)) return 'both'
  if (/\binterior\b/i.test(content)) return 'interior'
  if (/\bexterior\b/i.test(content)) return 'exterior'
  return null
}

export function parseLocationFields(content: string, fallbackTitle: string): ParsedLocation {
  const atmosphereMatch = content.match(/(?:^|\n)Atmosphere:\s*(.+?)(?:\n|$)/i)
  const moodMatch = content.match(/(?:^|\n)Mood:\s*(.+?)(?:\n|$)/i)
  const moodInlineMatch = content.match(/\b(?:the )?mood is\s+([^.,\n—]+)/i)
  const visualMatch = content.match(/(?:^|\n)Visual(?: description)?:\s*(.+?)(?:\n|$)/i)
  const lightingMatch = content.match(/(?:^|\n)Lighting:\s*(.+?)(?:\n|$)/i)
  const atmosphereInlineMatch = content.match(/\batmosphere (?:is|with)\s+([^.,\n—]+)/i)
  const cityMatch = content.match(/(?:^|\n)(?:City|Address):\s*(.+?)(?:\n|$)/i)

  return {
    name: extractLocationName(content, fallbackTitle),
    description: content.trim(),
    type: extractLocationType(content),
    atmosphere: stripWrappingQuotes(atmosphereMatch?.[1]?.trim() || atmosphereInlineMatch?.[1]?.trim() || ''),
    mood: stripWrappingQuotes(moodMatch?.[1]?.trim() || moodInlineMatch?.[1]?.trim() || ''),
    visualDescription: stripWrappingQuotes(visualMatch?.[1]?.trim() || content.trim()),
    lightingNotes: stripWrappingQuotes(lightingMatch?.[1]?.trim() || ''),
    city: stripWrappingQuotes(cityMatch?.[1]?.trim() || ''),
    prompt: content.trim(),
  }
}
