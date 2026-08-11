/** Detect whether screenplay text includes character dialogue blocks, not just slugline + action. */
export function hasScreenplayDialogue(content: string): boolean {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]
    if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(line)) continue

    const isCharacterCue =
      line.length > 0 &&
      line.length < 40 &&
      !line.includes('.') &&
      /^[A-Z][A-Z0-9 '.\-()#]+$/.test(line) &&
      !/^(FADE|CUT|DISSOLVE|SMASH|MATCH)/i.test(line)

    if (!isCharacterCue) continue

    const next = lines[i + 1]
    if (!next || next.startsWith('(') || /^(INT\.|EXT\.|INT\/EXT\.)/i.test(next)) {
      continue
    }

    return true
  }

  return false
}

/**
 * True only when content looks like a complete screenplay scene (slugline + dialogue),
 * not prose or action-only slugline descriptions.
 */
export function isCompleteScreenplayFormat(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length < 80) return false
  if (!/\b(INT\.|EXT\.|INT\/EXT\.)\s+/i.test(trimmed)) return false
  return hasScreenplayDialogue(trimmed)
}
