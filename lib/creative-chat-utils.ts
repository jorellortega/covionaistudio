const IMAGE_REQUEST_PATTERNS = [
  /\b(give|show|create|make|generate|draw|produce|build|get)\s+(me\s+)?(an?\s+)?(the\s+)?(images?|pictures?|photos?|visuals?|illustrations?|renders?|artworks?|posters?|covers?)\b/i,
  /\b(give|show|create|make|generate|draw|produce|get)\s+(me\s+)?(an?\s+)?(the\s+)?(image|picture|photo|visual|illustration|render|artwork|poster|cover)\b/i,
  /\b(images?|pictures?|visuals?|illustrations?|renders?)\s+of\b/i,
  /\b(image|picture|visual|illustration|render)\s+of\b/i,
  /\bcan you\s+(make|create|generate|draw|show|build)\b.*\b(images?|pictures?|visuals?|it|collage)\b/i,
  /\bwhat\s+(does|do|would)\s+.+\s+look\s+like\b/i,
  /\bvisuali[sz]e\b/i,
  /\bshow me how\b/i,
  /\b(collage|storyboard|mood\s*board)\b/i,
  /\bgenerate\b[\s\S]{0,60}\b(images?|collage|storyboard)\b/i,
  /\b(more|additional|another|extra)\s+(images?|pictures?|photos?|locations?|shots?)\b/i,
]

const IMAGE_FOLLOW_UP_STYLE_PATTERNS = [
  /\b(3d|pixar|animated|animation|cartoon|stylized|realistic|photoreal|cgi|anime|illustration)\b/i,
  /\b(make|needs? to be|should be|try|redo|regenerate|instead|update|change)\b/i,
  /\b(new|another|different)\s+(version|look|style|image)\b/i,
]

type ConversationMessage = { role: string; content: string }

function hadPriorImageConversation(history: ConversationMessage[]): boolean {
  return history.some((message) => {
    if (message.role !== 'user') return false
    const content = message.content
    return (
      IMAGE_REQUEST_PATTERNS.some((pattern) => pattern.test(content)) ||
      /\b(generate|create|make)\b[\s\S]{0,50}\b(image|picture|photo|portrait)\b/i.test(content) ||
      /\b(image|picture|photo|portrait)\s+of\b/i.test(content) ||
      isLocationImageRequest(content) ||
      isCharacterImageRequest(content)
    )
  }) || history.some(
    (message) =>
      message.role === 'assistant' &&
      /\b(Images panel|generated (an? )?image|visuali[sz]e|3D image|Pixar-style|portrait of)\b/i.test(
        message.content,
      ),
  )
}

const CHARACTER_SUBJECT_PATTERN =
  /\b(dad|father|mom|mother|girl|boy|man|woman|kid|child|daughter|son|husband|wife|character|guy|person|him|her|them)\b/i

export function detectIsolateSubjectFromPreviousImage(
  message: string,
  conversationHistory: ConversationMessage[] = [],
): boolean {
  if (!hadPriorImageConversation(conversationHistory)) return false
  const trimmed = message.trim()
  if (
    /\b(just|only|solo|alone|by himself|by herself|close[-\s]?up of)\b/i.test(trimmed) &&
    CHARACTER_SUBJECT_PATTERN.test(trimmed)
  ) {
    return true
  }
  return /\bfrom (the|that|this) (previous |last |same )?(image|picture|photo|shot)\b/i.test(trimmed)
}

export function shouldReuseLastGeneratedImageAsReference(
  message: string,
  conversationHistory: ConversationMessage[] = [],
): boolean {
  if (!hadPriorImageConversation(conversationHistory)) return false
  if (detectIsolateSubjectFromPreviousImage(message, conversationHistory)) return true
  if (isCharacterImageRequest(message)) return true
  return detectImageFollowUpRequest(message, conversationHistory)
}

function detectImageFollowUpRequest(
  message: string,
  conversationHistory: ConversationMessage[] = [],
): boolean {
  if (!hadPriorImageConversation(conversationHistory)) return false

  return (
    IMAGE_FOLLOW_UP_STYLE_PATTERNS.some((pattern) => pattern.test(message)) ||
    /\b(her|him|he|she|them|it|this character|the character)\b/i.test(message) ||
    detectIsolateSubjectFromPreviousImage(message, conversationHistory)
  )
}

export function detectImageRequest(
  message: string,
  conversationHistory: ConversationMessage[] = [],
): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (IMAGE_REQUEST_PATTERNS.some((pattern) => pattern.test(trimmed))) return true
  if (/\bimages?\b/i.test(trimmed) && /\b(generate|create|make|build|need|want|collage|storyboard|more|additional|another|extra)\b/i.test(trimmed)) {
    return true
  }
  if (isLocationImageRequest(trimmed)) return true
  if (isCharacterImageRequest(trimmed)) return true
  if (detectImageFollowUpRequest(trimmed, conversationHistory)) return true
  return false
}

export function detectMultiImageRequest(
  message: string,
  conversationHistory: { role: string; content: string }[] = [],
): boolean {
  const trimmed = message.trim()
  if (!detectImageRequest(trimmed)) return false

  if (
    /\b(collage|storyboard|multiple|several|pick and choose|number them|variety|different locations?|location scenes|more images?|more locations?|more pictures?|additional images?)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }

  if (/\b(more|additional|another|extra)\s+(images?|pictures?|photos?|locations?|shots?)\b/i.test(trimmed)) {
    const hadPriorImageBatch = conversationHistory.some(
      (m) =>
        m.role === 'user' &&
        /\b(collage|storyboard|location scenes|multiple images?|several images?|images? for|locations? for|generate\b[\s\S]{0,40}\bimages?)\b/i.test(
          m.content,
        ),
    )
    if (hadPriorImageBatch) return true
  }

  return false
}

export function pickSluglinesForImageBatch(
  sluglines: string[],
  usedSluglines: string[],
  max: number,
  preferRemaining: boolean,
): string[] {
  const used = new Set(usedSluglines.map((slugline) => slugline.toLowerCase()))
  const remaining = sluglines.filter((slugline) => !used.has(slugline.toLowerCase()))

  if (preferRemaining && remaining.length > 0) {
    return remaining.slice(0, max)
  }

  return sluglines.slice(0, max)
}

export interface StoryImageContext {
  combinedText: string
  projectName: string
}

export function extractScreenplayLocationSluglines(text: string): string[] {
  const locations: string[] = []
  const seen = new Set<string>()

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!/^(INT\.|EXT\.|INT\/EXT\.)/i.test(trimmed)) continue
    const normalized = trimmed.replace(/\s+/g, ' ').slice(0, 140)
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    locations.push(normalized)
  }

  return locations
}

export function buildLocationImagePromptsFromSluglines(
  sluglines: string[],
  projectName?: string,
  max = 6,
): string[] {
  const film =
    projectName && projectName !== 'Untitled Project' ? ` for the film "${projectName}"` : ''

  return sluglines.slice(0, max).map((slugline, index) => {
    const setting = slugline
      .replace(/^(INT\.|EXT\.|INT\/EXT\.)\s*/i, '')
      .replace(/\s*-\s*/g, ', ')
      .trim()
    return (
      `Cinematic film still, empty establishing shot${film}, ${setting}, ` +
      `accurate to the screenplay location, dramatic natural lighting, ` +
      `no people, wide angle, photorealistic, storyboard frame ${index + 1}`
    ).slice(0, 500)
  })
}

export function buildImagePromptInstruction(
  conversationHistory: { role: string; content: string }[],
  userMessage: string,
  storyContext?: StoryImageContext,
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

  const storyBlock = storyContext?.combinedText?.trim()
    ? `\n\nSCREENPLAY / STORY SOURCE (use ONLY these locations and settings — do NOT invent unrelated places):\n${storyContext.combinedText.slice(0, 12000)}`
    : ''

  const filmLine = storyContext?.projectName
    ? `\nFilm title: ${storyContext.projectName}`
    : ''

  if (focus === 'location') {
    return `You are building a cinematic LOCATION/ESTABLISHING SHOT image prompt.

The user asked: "${userMessage}"${filmLine}

Primary location description:
${locationSource || 'Derive locations ONLY from the screenplay/story source below — never invent random cities or countries.'}

Conversation (use ONLY environment, architecture, landscape, and atmosphere — ignore characters):
${context}${storyBlock}

Rules:
- Output ONLY the image prompt text, nothing else
- Start with "Cinematic film still,"
- EMPTY establishing shot — NO people, NO characters, NO actors
- Location MUST match the screenplay sluglines (INT./EXT.) and story setting
- Do NOT use generic stock locations (bazaars, mosques, etc.) unless explicitly in the script
- Focus on: place, landscape, architecture, weather, lighting, mood, textures, time of day
- Do NOT include character names or story plot
- Max 500 characters
- Do not say you cannot generate images`
  }

  const reusePreviousLook = shouldReuseLastGeneratedImageAsReference(userMessage, conversationHistory)

  if (focus === 'character') {
    if (reusePreviousLook) {
      return `You are writing an image EDIT prompt. The previous generated image will be attached as the visual reference.

The user asked: "${userMessage}"${filmLine}

Primary character description:
${characterSource || 'Use the person visible in the attached previous image.'}

Conversation:
${context}${storyBlock}

Rules:
- Output ONLY the image prompt text, nothing else
- Do NOT say "photoreal", "live-action", or "cinematic film still" unless the previous image was already photoreal
- Keep the previous image's exact medium and art style (if it was 3D, stylized, or animated, stay that way)
- Keep the same person: same face, hair, facial hair, wardrobe, body type, and coloring
- Isolate only the requested subject; no extra people
- Max 500 characters
- Do not say you cannot generate images`
    }

    return `You are building a cinematic CHARACTER portrait image prompt.

The user asked: "${userMessage}"${filmLine}

Primary character description:
${characterSource || 'Derive the character only from the conversation and story source below.'}

Conversation:
${context}${storyBlock}

Rules:
- Output ONLY the image prompt text, nothing else
- Start with "Cinematic film still,"
- Focus on the character's appearance, wardrobe, expression, and framing
- Use setting only as subtle background context
- Max 500 characters
- Do not say you cannot generate images`
  }

  if (reusePreviousLook) {
    return `You are writing an image EDIT prompt. The previous generated image will be attached as the visual reference.

The user asked: "${userMessage}"${filmLine}

Conversation:
${context}${storyBlock}

Rules:
- Output ONLY the image prompt text, nothing else
- Do NOT say "photoreal", "live-action", or "cinematic film still" unless the previous image was already photoreal
- Keep the previous image's exact medium and art style (if it was 3D, stylized, or animated, stay that way)
- Keep the same people and design; only change what the user asked for
- Max 500 characters
- Do not say you cannot generate images`
  }

  return `You are building a cinematic image generation prompt from a filmmaking conversation.

Conversation so far:
${context}

The user just asked: "${userMessage}"${filmLine}${storyBlock}

Write ONE detailed cinematic image prompt that captures what the user wants to see. Match the subject they asked for (location, character, or scene).

Rules:
- Output ONLY the image prompt text, nothing else
- Start with "Cinematic film still,"
- Use ONLY locations/settings from the screenplay source above if provided
- Do NOT invent unrelated places
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
  if (
    isCharacterImageRequest(userMessage) ||
    /\bthis character\b/i.test(userMessage) ||
    detectIsolateSubjectFromPreviousImage(userMessage, conversationHistory)
  ) {
    return 'character'
  }

  if (detectImageFollowUpRequest(userMessage, conversationHistory)) {
    const recentCharacterImage = [...conversationHistory].reverse().find(
      (m) =>
        m.role === 'user' &&
        (isCharacterImageRequest(m.content) ||
          /\b(generate|create|make)\b[\s\S]{0,40}\b(image|picture|photo|portrait)\b/i.test(m.content) ||
          /\b(image|picture|photo|portrait)\s+of\b/i.test(m.content) ||
          /\b(her|him|he|she|them|character)\b/i.test(m.content)),
    )
    if (recentCharacterImage) return 'character'
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
  storyContext?: StoryImageContext,
): string {
  const focus = detectImageRequestFocus(userMessage, conversationHistory)

  if (focus !== 'character' && storyContext?.combinedText?.trim()) {
    const sluglines = extractScreenplayLocationSluglines(storyContext.combinedText)
    if (sluglines.length > 0) {
      return buildLocationImagePromptsFromSluglines(sluglines, storyContext.projectName, 1)[0]
    }
  }

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
    const styleDirection = userMessage.trim()
    if (shouldReuseLastGeneratedImageAsReference(userMessage, conversationHistory)) {
      return (
        `Keep the exact same 3D/stylized animated look as the previous image, isolated portrait of ${parsed.name}, ` +
        `${parsed.description}, same face, hair, wardrobe, and coloring, no other characters, not photoreal, not live-action, ${styleDirection}`
      ).slice(0, 500)
    }
    const base = `Cinematic film still, portrait of ${parsed.name}, ${parsed.description}`
    if (styleDirection && styleDirection !== characterSource) {
      return `${base}, ${styleDirection}`.slice(0, 500)
    }
    return base.slice(0, 500)
  }

  return `Cinematic film still, ${userMessage}`.slice(0, 500)
}

const TREATMENT_SIGNAL_PATTERNS = [
  /\btreatment\b/i,
  /\blogline\s*:/i,
  /\bgenre\s*:/i,
  /\bact\s*[1-3]\b/i,
  /\bact\s+(one|two|three|i{1,3}|iv|v)\b/i,
  /\bact\s+[ivxlc]+\b/i,
  /\bsynopsis\b/i,
  /\bstory\s+treatment\b/i,
  /\bthree[\s-]?act\b/i,
  /\b(character|story)\s+arc/i,
  /\bsetup\b.*\bconfrontation\b|\bconfrontation\b.*\bresolution\b/i,
]

export interface ParsedTreatment {
  title: string
  genre: string
  logline: string
  synopsis: string
  prompt: string
}

export function isScreenplaySceneContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (isSceneImportConfirmation(trimmed)) return false

  const hasSlugline = /\b(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+/i.test(trimmed)
  const hasSceneHeader = /^Scene\s+\d+\s*:?/im.test(trimmed) || /\bscene\s+\d+\s*:/i.test(trimmed)
  const actCount = parseTreatmentActs(trimmed).length

  if (hasSlugline && actCount === 0) return true
  if (hasSceneHeader && hasSlugline) return true
  if (hasSceneHeader && actCount === 0 && trimmed.length < 8000) return true
  if (detectScreenplayContent(trimmed) && hasSceneHeader && actCount === 0) return true

  return false
}

export function detectTreatmentContent(content: string): boolean {
  const trimmed = content.trim()
  if (isScreenplaySceneContent(trimmed)) return false
  const acts = parseTreatmentActs(trimmed)
  if (acts.length >= 2) return true
  if (acts.length >= 1 && trimmed.length >= 80) return true
  if (/\b(three|3)\s+acts?\b/i.test(trimmed) && trimmed.length >= 80) return true
  if (trimmed.length < 150) return false
  const matchCount = TREATMENT_SIGNAL_PATTERNS.filter((p) => p.test(trimmed)).length
  return matchCount >= 2
}

export function isTreatmentActFollowUp(message: string): boolean {
  const trimmed = message.trim()
  return (
    /\b(show|list|break down|what are|give me|see|tell me)\b[\s\S]{0,50}\b(acts?|three[\s-]?act)\b/i.test(
      trimmed,
    ) ||
    /\bacts?\s+(of|for|in|from)\b/i.test(trimmed) ||
    /\b(the\s+)?three\s+acts\b/i.test(trimmed)
  )
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim()
}

export function extractTreatmentActLabels(content: string): string[] {
  return parseTreatmentActs(content).map((act) => act.title)
}

function romanOrWordToActNumber(value: string): number {
  const normalized = value.trim().toLowerCase()
  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  }
  if (wordMap[normalized]) return wordMap[normalized]

  const romanMap: Record<string, number> = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
  }
  if (romanMap[normalized]) return romanMap[normalized]

  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface ParsedTreatmentAct {
  actNumber: number
  title: string
  content: string
}

const ACT_HEADER_PATTERN =
  /^(?:#+\s*)?Act\s+([IVXLC\d]+|One|Two|Three|Four|Five)\s*:?\s*(?:[-–—]\s*)?(.*)$/i

const INLINE_ACT_SPLIT_PATTERN =
  /(?=(?:^|\n|\s)(?:#+\s*)?Act\s+(?:[IVXLC\d]+|One|Two|Three|Four|Five)\s*:)/gi

function buildParsedAct(actToken: string, subtitle: string, body: string, fallbackIndex: number): ParsedTreatmentAct {
  const actNumber = romanOrWordToActNumber(actToken) || fallbackIndex
  const trimmedSubtitle = subtitle.trim()
  const title = trimmedSubtitle
    ? `Act ${actToken} — ${trimmedSubtitle}`
    : `Act ${actToken}`
  return {
    actNumber,
    title,
    content: body.trim(),
  }
}

function parseTreatmentActsByLine(content: string): ParsedTreatmentAct[] {
  const acts: ParsedTreatmentAct[] = []
  let current: { actNumber: number; title: string; lines: string[]; actToken: string } | null = null

  const flushCurrent = () => {
    if (!current) return
    const body = current.lines.join('\n').trim()
    if (body.length > 0) {
      acts.push(buildParsedAct(current.actToken, '', body, acts.length + 1))
    }
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    const normalized = trimmed.replace(/^\*+/, '').replace(/\*+$/, '').trim()
    const headerMatch = normalized.match(ACT_HEADER_PATTERN)
    if (headerMatch) {
      flushCurrent()
      const actToken = headerMatch[1]
      const subtitle = headerMatch[2]?.trim() || ''
      const actNumber = romanOrWordToActNumber(actToken) || acts.length + 1
      current = {
        actNumber,
        title: subtitle ? `Act ${actToken} — ${subtitle}` : `Act ${actToken}`,
        lines: subtitle ? [subtitle] : [],
        actToken,
      }
      continue
    }

    if (current) {
      current.lines.push(line)
    }
  }

  flushCurrent()
  return acts
}

function parseTreatmentActsInline(content: string): ParsedTreatmentAct[] {
  const chunks = content.split(INLINE_ACT_SPLIT_PATTERN).map((chunk) => chunk.trim()).filter(Boolean)
  if (chunks.length < 2) return []

  const acts: ParsedTreatmentAct[] = []
  for (const chunk of chunks) {
    const headerMatch = chunk.match(
      /^(?:#+\s*)?Act\s+([IVXLC\d]+|One|Two|Three|Four|Five)\s*:?\s*(?:[-–—]\s*)?(.*)$/is,
    )
    if (!headerMatch) continue
    const body = (headerMatch[2] || '').trim()
    if (!body) continue
    acts.push(buildParsedAct(headerMatch[1], '', body, acts.length + 1))
  }
  return acts
}

export function parseTreatmentActs(content: string): ParsedTreatmentAct[] {
  const fromLines = parseTreatmentActsByLine(content)
  if (fromLines.length > 0) return fromLines
  return parseTreatmentActsInline(content)
}

export function getBestTreatmentActSource(...sources: Array<string | null | undefined>): string {
  let best = ''
  let bestCount = 0
  for (const source of sources) {
    if (!source?.trim()) continue
    const count = parseTreatmentActs(source).length
    if (count > bestCount || (count === bestCount && source.length > best.length)) {
      bestCount = count
      best = source
    }
  }
  return best
}

export function findSceneContentInThread(
  messages: { role: string; content: string }[],
  upToIndex: number,
): string | null {
  const slice = messages.slice(0, upToIndex + 1)

  for (let i = upToIndex; i >= 0; i--) {
    const msg = slice[i]
    if (detectSceneContent(msg.content)) {
      return msg.content
    }
  }

  return null
}

export function findTreatmentContentInThread(
  messages: { role: string; content: string }[],
  upToIndex: number,
): string | null {
  const slice = messages.slice(0, upToIndex + 1)
  let best: { content: string; score: number } | null = null

  for (let i = 0; i <= upToIndex; i++) {
    const msg = slice[i]
    if (msg.role !== 'assistant') continue
    if (isScreenplaySceneContent(msg.content)) continue

    const acts = parseTreatmentActs(msg.content)
    const hasTreatmentSignals = detectTreatmentContent(msg.content)
    if (acts.length === 0 && !hasTreatmentSignals) continue

    const score = acts.length * 1000 + msg.content.length + (hasTreatmentSignals ? 100 : 0)
    if (!best || score > best.score) {
      best = { content: msg.content, score }
    }
  }

  return best?.content || null
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
  if (parseTreatmentActs(trimmed).length >= 1) return false
  if (/\bact\s*[1-3]\s*:/i.test(trimmed)) return false
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
  if (
    /\b(image|picture|visual|photo|show me|generate|create|draw|portrait|avatar)\b/i.test(content) &&
    /\b(character|protagonist|avatar|portrait|her|him|them|dad|father|mom|mother|girl|boy|man|woman|kid|child|daughter|son)\b/i.test(
      content,
    )
  ) {
    return true
  }
  return /\b(generate|create|make)\b[\s\S]{0,40}\b(image|picture|photo|portrait)\b[\s\S]{0,20}\b(of\s+)?(her|him|them|the dad|the father|the mom)\b/i.test(
    content,
  )
}

export interface ResolvedMessageContext {
  isCharacter: boolean
  isLocation: boolean
  isTreatment: boolean
  contextContent: string
  treatmentContent: string | null
}

export function resolveCreativeMessageContext(
  message: { role: string; content: string },
  messageIndex: number,
  allMessages: { role: string; content: string }[],
  workspaceTitle: string,
): ResolvedMessageContext {
  if (message.role !== 'assistant') {
    return {
      isCharacter: false,
      isLocation: false,
      isTreatment: false,
      contextContent: message.content,
      treatmentContent: null,
    }
  }

  if (isScreenplaySceneContent(message.content) || detectSceneContent(message.content)) {
    return {
      isCharacter: false,
      isLocation: false,
      isTreatment: false,
      contextContent: message.content,
      treatmentContent: null,
    }
  }

  const treatmentContent = findTreatmentContentInThread(allMessages, messageIndex)
  const isTreatment = !!treatmentContent

  const directCharacter = !isTreatment && detectCharacterContent(message.content)
  const directLocation = !isTreatment && !directCharacter && detectLocationContent(message.content)
  if (directCharacter || directLocation) {
    return {
      isCharacter: directCharacter,
      isLocation: directLocation,
      isTreatment: false,
      contextContent: message.content,
      treatmentContent: null,
    }
  }

  if (isTreatment) {
    return {
      isCharacter: false,
      isLocation: false,
      isTreatment: true,
      contextContent: treatmentContent || message.content,
      treatmentContent,
    }
  }

  const recent = allMessages.slice(Math.max(0, messageIndex - 8), messageIndex + 1)
  const recentUserImageRequest = [...recent].reverse().find(
    (m) => m.role === 'user' && detectImageRequest(m.content),
  )

  if (recentUserImageRequest) {
    if (isLocationImageRequest(recentUserImageRequest.content)) {
      return {
        isCharacter: false,
        isLocation: false,
        isTreatment: false,
        contextContent: recentUserImageRequest.content,
        treatmentContent: null,
      }
    }
    if (isCharacterImageRequest(recentUserImageRequest.content)) {
      return {
        isCharacter: false,
        isLocation: false,
        isTreatment: false,
        contextContent: recentUserImageRequest.content,
        treatmentContent: null,
      }
    }
  }

  const combined = recent.map((m) => m.content).join('\n\n')
  const combinedTreatment = findTreatmentContentInThread(allMessages, messageIndex)
  if (combinedTreatment) {
    return {
      isCharacter: false,
      isLocation: false,
      isTreatment: true,
      contextContent: combinedTreatment,
      treatmentContent: combinedTreatment,
    }
  }
  if (detectCharacterContent(combined)) {
    return {
      isCharacter: true,
      isLocation: false,
      isTreatment: false,
      contextContent: combined,
      treatmentContent: null,
    }
  }
  if (detectLocationContent(combined)) {
    return {
      isCharacter: false,
      isLocation: true,
      isTreatment: false,
      contextContent: combined,
      treatmentContent: null,
    }
  }

  return {
    isCharacter: false,
    isLocation: false,
    isTreatment: false,
    contextContent: message.content,
    treatmentContent: null,
  }
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

const SCENE_IMPORT_PATTERNS = [
  /\bimport\s+(this\s+)?(scene|it)\b/i,
  /\bsave\s+(this\s+)?scene\b/i,
  /\badd\s+(this\s+)?scene\b/i,
  /\bthis\s+is\s+scene\s+\d+/i,
  /\bhere'?s?\s+scene\s+\d+/i,
  /\bscene\s+\d+\s*:/i,
]

export function detectScreenplayContent(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return (
    /\b(INT\.|EXT\.)\b/i.test(trimmed) ||
    /^[A-Z][A-Z0-9 .'()\-]{1,40}$/m.test(trimmed)
  )
}

const SCENE_IMPORT_LINE_REGEX =
  /^(?:this\s+is\s+scene\s+\d+(?:\s*import\s+it)?|import\s+(?:this\s+)?(?:scene|it)|save\s+(?:this\s+)?scene|add\s+(?:this\s+)?scene|here'?s?\s+scene\s+\d+|scene\s+\d+\s*:)\s*[:\-]?\s*(.*)$/i

function stripSceneImportPreamble(message: string): string {
  const lines = message.split('\n')
  const output: string[] = []
  let skippingPreamble = true

  for (const line of lines) {
    if (!skippingPreamble) {
      output.push(line)
      continue
    }

    const trimmed = line.trim()
    if (!trimmed) continue

    const importMatch = trimmed.match(SCENE_IMPORT_LINE_REGEX)
    if (importMatch) {
      const remainder = importMatch[1]?.trim()
      if (remainder) output.push(remainder)
      continue
    }

    skippingPreamble = false
    output.push(line)
  }

  return output.join('\n').trim()
}

export function isSceneImportConfirmation(text: string): boolean {
  return /^Imported your full scene verbatim/i.test(text.trim())
}

export function detectSceneImportRequest(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed || !detectScreenplayContent(trimmed)) return false
  return SCENE_IMPORT_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function extractImportedSceneContent(message: string): {
  title: string
  content: string
  sceneNumber: string | null
} {
  const content = stripSceneImportPreamble(message) || message.trim()
  const sceneNumMatch = message.match(/\bscene\s+(\d+)\b/i)
  const sceneNumber = sceneNumMatch?.[1] || null
  const firstHeading = content.match(/^(INT\.|EXT\.)\s*.+$/im)?.[0]?.trim()

  const title =
    sceneNumber && firstHeading
      ? `Scene ${sceneNumber} - ${firstHeading}`
      : sceneNumber
        ? `Scene ${sceneNumber}`
        : firstHeading || 'Imported Scene'

  return { title, content, sceneNumber }
}

function isScreenplayFragment(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/\b(INT\.|EXT\.)\b/i.test(trimmed)) return true
  if (/^(?:\d+\.|FADE|CUT TO|CONTINUED)/im.test(trimmed)) return true
  if (/^[A-Z][A-Z0-9 .'()\-]{1,40}$/m.test(trimmed)) return true
  if (/\n[A-Z][A-Z0-9 .'()\-]{1,40}\n/.test(`\n${trimmed}\n`)) return true
  if (/\([A-Za-z][^)]{0,60}\)/.test(trimmed)) return true
  return false
}

function findSuffixPrefixOverlap(left: string, right: string, minOverlap = 24): number {
  const max = Math.min(left.length, right.length, 800)
  for (let len = max; len >= minOverlap; len--) {
    if (left.endsWith(right.slice(0, len))) return len
  }
  return 0
}

export function mergeSceneContent(existing: string, incoming: string): string {
  const left = existing.trim()
  const right = incoming.trim()
  if (!left) return right
  if (!right) return left
  if (left === right) return left
  if (right.includes(left)) return right
  if (left.includes(right)) return left

  const overlap = findSuffixPrefixOverlap(left, right)
  if (overlap > 0) return `${left}${right.slice(overlap)}`

  return `${left}\n\n${right}`
}

function extractSceneNumberFromThread(
  priorMessages: { role: string; content: string }[],
  currentContent: string,
): string | null {
  const current = currentContent.match(/\bscene\s+(\d+)\b/i)?.[1]
  if (current) return current

  for (let i = priorMessages.length - 1; i >= 0; i--) {
    const msg = priorMessages[i]
    if (msg.role !== 'user') continue
    const match = msg.content.match(/\bscene\s+(\d+)\b/i)?.[1]
    if (match) return match
  }

  return null
}

function buildSceneTitle(sceneNumber: string | null, content: string): string {
  const firstHeading = content.match(/^(INT\.|EXT\.)\s*.+$/im)?.[0]?.trim()
  if (sceneNumber && firstHeading) return `Scene ${sceneNumber} - ${firstHeading}`
  if (sceneNumber) return `Scene ${sceneNumber}`
  return firstHeading || 'Imported Scene'
}

function debugTextPreview(text: string, max = 140): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return '(empty)'
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max)}…`
}

export interface SceneImportDebug {
  currentMessageChars: number
  currentExtractedChars: number
  priorMessagesInThread: number
  priorPartsCollected: number
  priorParts: Array<{
    messageIndex: number
    chars: number
    preview: string
    reason: 'screenplay_fragment' | 'prior_import'
  }>
  mergeSteps: Array<{
    partChars: number
    beforeChars: number
    afterChars: number
  }>
  finalChars: number
  lineCount: number
  sceneNumber: string | null
  slugline: string | null
  previewStart: string
  previewEnd: string
  contentEndExact: string
}

export function extractImportedSceneFromThread(
  priorMessages: { role: string; content: string }[],
  currentContent: string,
  options?: { collectDebug?: boolean },
): {
  title: string
  content: string
  sceneNumber: string | null
  debug?: SceneImportDebug
} {
  const collectDebug = options?.collectDebug ?? false
  const current = extractImportedSceneContent(currentContent)
  const sceneNumber = extractSceneNumberFromThread(priorMessages, currentContent) || current.sceneNumber
  const parts: string[] = []
  const priorPartsDebug: SceneImportDebug['priorParts'] = []
  const mergeSteps: SceneImportDebug['mergeSteps'] = []

  for (let i = priorMessages.length - 1; i >= 0; i--) {
    const msg = priorMessages[i]
    if (msg.role === 'assistant') break
    if (msg.role !== 'user') continue

    const priorSceneNum = msg.content.match(/\bscene\s+(\d+)\b/i)?.[1]
    if (priorSceneNum && sceneNumber && priorSceneNum !== sceneNumber) break

    if (detectSceneImportRequest(msg.content)) {
      const extracted = extractImportedSceneContent(msg.content)
      parts.unshift(extracted.content)
      if (collectDebug) {
        priorPartsDebug.unshift({
          messageIndex: i,
          chars: extracted.content.length,
          preview: debugTextPreview(extracted.content),
          reason: 'prior_import',
        })
      }
      break
    }

    const body = stripSceneImportPreamble(msg.content)
    if (!body.trim()) continue

    if (!isScreenplayFragment(body)) break

    parts.unshift(body)
    if (collectDebug) {
      priorPartsDebug.unshift({
        messageIndex: i,
        chars: body.length,
        preview: debugTextPreview(body),
        reason: 'screenplay_fragment',
      })
    }
  }

  let content = current.content
  for (const part of parts) {
    const beforeChars = content.length
    content = mergeSceneContent(part, content)
    if (collectDebug) {
      mergeSteps.push({
        partChars: part.length,
        beforeChars,
        afterChars: content.length,
      })
    }
  }

  const slugline = content.match(/^(INT\.|EXT\.)\s*.+$/im)?.[0]?.trim() || null
  const result = {
    title: buildSceneTitle(sceneNumber, content),
    content,
    sceneNumber,
  }

  if (!collectDebug) return result

  return {
    ...result,
    debug: {
      currentMessageChars: currentContent.length,
      currentExtractedChars: current.content.length,
      priorMessagesInThread: priorMessages.length,
      priorPartsCollected: parts.length,
      priorParts: priorPartsDebug,
      mergeSteps,
      finalChars: content.length,
      lineCount: content.split('\n').length,
      sceneNumber,
      slugline,
      previewStart: debugTextPreview(content.slice(0, 240)),
      previewEnd: debugTextPreview(content.slice(-240)),
      contentEndExact: content.slice(-120).trim(),
    },
  }
}

function extractSceneCharacterNames(screenplay: string): string[] {
  const names = new Set<string>()
  for (const line of screenplay.split('\n')) {
    const trimmed = line.trim()
    if (
      trimmed.length >= 2 &&
      trimmed.length <= 40 &&
      /^[A-Z][A-Z0-9 .'()-]*$/.test(trimmed) &&
      !/^(INT\.|EXT\.|FADE|CUT|CONT'D|CONTINUED)$/i.test(trimmed) &&
      !trimmed.includes('.') &&
      !trimmed.includes(' - ')
    ) {
      names.add(trimmed)
    }
  }
  return [...names]
}

export interface ParsedScene {
  name: string
  sceneNumber: string | null
  location: string | null
  characters: string[]
  content: string
  prompt: string
}

export function detectSceneContent(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (isSceneImportConfirmation(trimmed)) return false
  if (isScreenplaySceneContent(trimmed)) return true
  if (detectScreenplayContent(trimmed) && parseTreatmentActs(trimmed).length === 0) return true
  if (/^Scene\s+\d+/im.test(trimmed)) return true
  if (/\bscene\s+\d+\b/i.test(trimmed) && /\b(INT\.|EXT\.|dialogue|action)\b/i.test(trimmed)) {
    return true
  }
  return false
}

export function parseSceneFields(content: string, fallbackTitle: string): ParsedScene {
  const sceneHeaderMatch = content.match(/(?:^|\n)Scene\s+(\d+)\s*:?\s*(?:\n|$)/i)
  const sceneNumberFromHeader = sceneHeaderMatch?.[1] || null

  if (/\b(INT\.|EXT\.)/i.test(content) || detectSceneImportRequest(content)) {
    const imported = extractImportedSceneContent(content)
    const headingMatch = imported.content.match(/^(INT\.|EXT\.)\s*(.+)$/im)
    const location = headingMatch?.[2]?.split('-')[0]?.trim() || null
    const characters = extractSceneCharacterNames(imported.content)
    return {
      name: imported.title,
      sceneNumber: imported.sceneNumber || sceneNumberFromHeader,
      location,
      characters,
      content: imported.content,
      prompt: imported.content,
    }
  }

  const sceneNumMatch = content.match(/\bscene\s+(\d+)\b/i)
  const sceneNumber = sceneNumberFromHeader || sceneNumMatch?.[1] || null
  const sluglineMatch = content.match(/^(INT\.|EXT\.)\s*(.+)$/im)
  const locationFromSlugline = sluglineMatch?.[2]?.split('-')[0]?.trim() || null
  const titleMatch = content.match(/(?:^|\n)Scene\s+\d+[:\s-]+(.+?)(?:\n|$)/im)
  const name =
    titleMatch?.[1]?.trim() ||
    locationFromSlugline ||
    (sceneNumber ? `Scene ${sceneNumber}` : fallbackTitle !== 'Untitled Project' ? `${fallbackTitle} - Scene` : 'Imported Scene')

  return {
    name,
    sceneNumber,
    location: locationFromSlugline,
    characters: extractSceneCharacterNames(content),
    content: content.trim(),
    prompt: content.trim(),
  }
}
