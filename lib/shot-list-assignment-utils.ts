export interface NamedEntity {
  name: string
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreNameMatch(candidate: string, target: string): number {
  const c = normalizeName(candidate)
  const t = normalizeName(target)
  if (!c || !t) return 0
  if (c === t) return 100
  if (t.includes(c) || c.includes(t)) return 85
  const cFirst = c.split(" ")[0]
  const tFirst = t.split(" ")[0]
  if (cFirst.length > 1 && cFirst === tFirst) return 75
  return 0
}

export function resolveCharacterName(
  candidate: string,
  characters: NamedEntity[],
): string | null {
  const trimmed = candidate?.trim()
  if (!trimmed) return null

  let best: { name: string; score: number } | null = null
  for (const character of characters) {
    const score = scoreNameMatch(trimmed, character.name)
    if (score >= 75 && (!best || score > best.score)) {
      best = { name: character.name, score }
    }
  }
  return best?.name ?? null
}

export function resolveLocationName(
  candidate: string | undefined,
  locations: NamedEntity[],
): string | null {
  const trimmed = candidate?.trim()
  if (!trimmed) return null

  let best: { name: string; score: number } | null = null
  for (const location of locations) {
    const score = scoreNameMatch(trimmed, location.name)
    if (score >= 70 && (!best || score > best.score)) {
      best = { name: location.name, score }
    }
  }
  return best?.name ?? null
}

export function findCharactersInText(
  text: string,
  characters: NamedEntity[],
): string[] {
  if (!text.trim()) return []
  const found = new Set<string>()
  const normalizedText = normalizeName(text)

  for (const character of characters) {
    const full = normalizeName(character.name)
    const first = full.split(" ")[0]
    if (full.length > 1 && normalizedText.includes(full)) {
      found.add(character.name)
      continue
    }
    if (first.length > 2 && new RegExp(`\\b${first}\\b`, "i").test(text)) {
      found.add(character.name)
    }
  }

  return [...found]
}

export function findLocationInText(
  text: string,
  locations: NamedEntity[],
): string | null {
  if (!text.trim()) return null

  let best: { name: string; score: number } | null = null
  for (const location of locations) {
    const normalizedLocation = normalizeName(location.name)
    if (normalizedLocation.length < 3) continue
    if (normalizeName(text).includes(normalizedLocation)) {
      const score = normalizedLocation.length
      if (!best || score > best.score) {
        best = { name: location.name, score }
      }
    }
  }

  return best?.name ?? null
}

export function resolveCharacterNames(
  aiNames: string[] | undefined,
  characters: NamedEntity[],
  textFallback = "",
): string[] {
  const resolved = new Set<string>()

  for (const name of aiNames ?? []) {
    const match = resolveCharacterName(name, characters)
    if (match) resolved.add(match)
  }

  for (const name of findCharactersInText(textFallback, characters)) {
    resolved.add(name)
  }

  return [...resolved]
}

export function applyShotListAssignments<
  T extends {
    characters?: string[]
    location?: string
    description?: string
    action?: string
    dialogue?: string
    metadata?: Record<string, unknown>
  },
>(shot: T, characters: NamedEntity[], locations: NamedEntity[]): T {
  const textFallback = [shot.description, shot.action, shot.dialogue].filter(Boolean).join(" ")
  const resolvedCharacters = resolveCharacterNames(shot.characters, characters, textFallback)

  const resolvedLocation =
    resolveLocationName(shot.location, locations) ||
    findLocationInText(textFallback, locations) ||
    shot.location?.trim() ||
    undefined

  const locationNames = resolvedLocation ? [resolvedLocation] : []

  return {
    ...shot,
    characters: resolvedCharacters,
    location: resolvedLocation,
    metadata: {
      ...(shot.metadata || {}),
      ...(locationNames.length > 0 ? { locations: locationNames } : {}),
    },
  }
}

export function formatAssignmentPromptSection(
  characters: NamedEntity[],
  locations: NamedEntity[],
): string {
  const lines: string[] = []

  if (characters.length > 0) {
    lines.push(
      "AVAILABLE CHARACTERS (use these EXACT names in the characters array when they appear in a shot):",
      ...characters.map((c) => `- ${c.name}`),
    )
  }

  if (locations.length > 0) {
    lines.push(
      "AVAILABLE LOCATIONS (use these EXACT names in the location field when applicable):",
      ...locations.map((l) => `- ${l.name}`),
    )
  }

  if (lines.length === 0) return ""

  return `\n\n${lines.join("\n")}\nOnly assign characters and locations from the lists above. Use exact spelling.`
}
