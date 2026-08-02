/** Pull dialogue / action lines out of a screenplay-formatted script selection */
export function parseScriptSelection(text: string): { dialogue?: string; action?: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return {}

  const isSceneHeading = (line: string) => /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(line)
  const isCharacterCue = (line: string) => {
    if (isSceneHeading(line)) return false
    if (line.length > 40) return false
    // Standard screenplay cue (FRED)
    if (/^[A-Z][A-Z0-9 '.\-()]+$/.test(line)) return true
    // Title-case name cue (Fred, Liz) — not a full sentence
    if (
      /^[A-Z][a-zA-Z'.\-() ]{0,38}[a-zA-Z'.\-())]?$/.test(line) &&
      !line.endsWith(".") &&
      !line.includes("  ")
    ) {
      return true
    }
    return false
  }

  const dialogueLines: string[] = []
  const actionLines: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (isCharacterCue(line)) {
      i += 1
      while (i < lines.length && !isCharacterCue(lines[i]) && !isSceneHeading(lines[i])) {
        const content = lines[i]
        if (content.startsWith("(") && content.endsWith(")")) {
          actionLines.push(content.slice(1, -1).trim())
        } else {
          dialogueLines.push(content)
        }
        i += 1
      }
      continue
    }
    if (line.startsWith("(") && line.endsWith(")")) {
      actionLines.push(line.slice(1, -1).trim())
    } else {
      actionLines.push(line)
    }
    i += 1
  }

  return {
    dialogue: dialogueLines.length > 0 ? dialogueLines.join("\n") : undefined,
    action: actionLines.length > 0 ? actionLines.join("\n") : undefined,
  }
}

type StoryboardDialogueFields = {
  dialogue?: string | null
  description?: string | null
  action?: string | null
  script_text_snippet?: string | null
}

/** Dialogue from the dialogue field or screenplay-formatted description / script snippet */
export function getStoryboardDialogueText(
  storyboard: StoryboardDialogueFields,
  options?: { includeActionFallback?: boolean },
): string {
  const parseDialogue = (text: string) => parseScriptSelection(text).dialogue?.trim() || ""

  const fromDialogue =
    storyboard.dialogue?.trim() ||
    parseDialogue(storyboard.description || "") ||
    parseDialogue(storyboard.script_text_snippet || "") ||
    ""

  if (fromDialogue) return fromDialogue

  if (options?.includeActionFallback) {
    return (
      storyboard.action?.trim() ||
      storyboard.script_text_snippet?.trim() ||
      ""
    )
  }

  return ""
}
