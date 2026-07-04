import type { ShotList, CreateShotListData } from './shot-list-service'
import type { Storyboard, CreateStoryboardData } from './storyboards-service'
import type { SyncDirection } from './scene-shot-sync'
import {
  mapCameraAngleToStoryboard,
  mapMovementToStoryboard,
  mapShotTypeToStoryboard,
} from './scene-shot-field-map'

export type AISyncOperation =
  | {
      type: 'update'
      shotId: string
      storyboardId: string
      confidence: number
      reason: string
      fields: Record<string, unknown>
    }
  | {
      type: 'create_shot'
      storyboardId: string
      confidence: number
      reason: string
      fields: Record<string, unknown>
    }
  | {
      type: 'create_storyboard'
      shotId: string
      confidence: number
      reason: string
      fields: Record<string, unknown>
    }

export type AISyncPlan = {
  operations: AISyncOperation[]
  summary?: string
  model?: string
}

type CompactShot = {
  id: string
  shot_number: number
  description?: string
  dialogue?: string
  action?: string
  shot_type?: string
  camera_angle?: string
  movement?: string
  storyboard_id?: string
}

type CompactStoryboard = {
  id: string
  shot_number: number
  title?: string
  description?: string
  dialogue?: string
  action?: string
  shot_type?: string
  camera_angle?: string
  movement?: string
  has_image?: boolean
}

function trim(value?: string | null, max = 400): string | undefined {
  if (!value?.trim()) return undefined
  const t = value.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export function compactShotsForAI(shots: ShotList[]): CompactShot[] {
  return shots.map((s) => ({
    id: s.id,
    shot_number: s.shot_number,
    description: trim(s.description),
    dialogue: trim(s.dialogue),
    action: trim(s.action),
    shot_type: s.shot_type,
    camera_angle: s.camera_angle,
    movement: s.movement,
    storyboard_id: s.storyboard_id ?? undefined,
  }))
}

export function compactStoryboardsForAI(storyboards: Storyboard[]): CompactStoryboard[] {
  return storyboards.map((sb) => ({
    id: sb.id,
    shot_number: sb.shot_number,
    title: trim(sb.title, 120),
    description: trim(sb.description),
    dialogue: trim(sb.dialogue),
    action: trim(sb.action),
    shot_type: sb.shot_type,
    camera_angle: sb.camera_angle,
    movement: sb.movement,
    has_image: Boolean(sb.image_url),
  }))
}

export function buildSceneSyncPrompt(
  direction: SyncDirection,
  shots: CompactShot[],
  storyboards: CompactStoryboard[]
): string {
  const target =
    direction === 'storyboards-to-shotlist'
      ? 'shot list (shot_lists table)'
      : 'storyboards table'

  const source =
    direction === 'storyboards-to-shotlist' ? 'storyboards' : 'shot list'

  const shotListFieldSchema =
    'description, dialogue, action, shot_type, camera_angle, movement, shot_number, sequence_order'
  const storyboardFieldSchema =
    'title, description, dialogue, action, shot_type, camera_angle, movement, shot_number, sequence_order'

  const fieldsSchema =
    direction === 'storyboards-to-shotlist' ? shotListFieldSchema : storyboardFieldSchema

  return `You are a film production assistant. Match and map ${source} items to ${target} for ONE scene.

Direction: ${direction}
- Match by narrative content (dialogue, action, description), NOT only shot_number.
- Prefer existing storyboard_id links when content still aligns.
- One shot list row pairs with at most one storyboard.
- Preserve dialogue in a dedicated "dialogue" field when present.
- Put stage direction / blocking in "action", summary in "description" (shot list) or "title"+"description" (storyboard).
- Do NOT delete anything. Unmatched source items become create operations.
- For storyboard targets: never include image_url; shot_type must be one of wide, medium, close, extreme-close; camera_angle one of eye-level, high-angle, low-angle, dutch-angle; movement one of static, panning, tilting, tracking, zooming.
- For shot list targets: shot_type may be wide, medium, close, extreme-close, two-shot, over-the-shoulder, point-of-view, establishing, insert, cutaway.

Return ONLY valid JSON:
{
  "summary": "one sentence",
  "operations": [
    {
      "type": "update",
      "shotId": "uuid",
      "storyboardId": "uuid",
      "confidence": 0.0-1.0,
      "reason": "short",
      "fields": { ${fieldsSchema} }
    },
    {
      "type": "create_shot",
      "storyboardId": "uuid",
      "confidence": 0.0-1.0,
      "reason": "short",
      "fields": { ${fieldsSchema} }
    },
    {
      "type": "create_storyboard",
      "shotId": "uuid",
      "confidence": 0.0-1.0,
      "reason": "short",
      "fields": { ${fieldsSchema} }
    }
  ]
}

Allowed operation types for this direction:
${direction === 'storyboards-to-shotlist' ? '- update, create_shot only (no create_storyboard)' : '- update, create_storyboard only (no create_shot)'}

SHOT LIST:
${JSON.stringify(shots, null, 2)}

STORYBOARDS:
${JSON.stringify(storyboards, null, 2)}`
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  return s || undefined
}

function asNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function normalizeAIShotListFields(fields: Record<string, unknown>): Partial<CreateShotListData> {
  return {
    description: asString(fields.description),
    dialogue: asString(fields.dialogue),
    action: asString(fields.action),
    shot_type: asString(fields.shot_type),
    camera_angle: asString(fields.camera_angle),
    movement: asString(fields.movement),
    shot_number: asNumber(fields.shot_number),
    sequence_order: asNumber(fields.sequence_order),
    visual_notes: asString(fields.visual_notes),
  }
}

export function normalizeAIStoryboardFields(fields: Record<string, unknown>): Partial<CreateStoryboardData> {
  const shotType = asString(fields.shot_type)
  const cameraAngle = asString(fields.camera_angle)
  const movement = asString(fields.movement)
  return {
    title: asString(fields.title),
    description: asString(fields.description) ?? '',
    dialogue: asString(fields.dialogue),
    action: asString(fields.action),
    visual_notes: asString(fields.visual_notes),
    shot_type: shotType ? mapShotTypeToStoryboard(shotType) : undefined,
    camera_angle: cameraAngle ? mapCameraAngleToStoryboard(cameraAngle) : undefined,
    movement: movement ? mapMovementToStoryboard(movement) : undefined,
    shot_number: asNumber(fields.shot_number),
    sequence_order: asNumber(fields.sequence_order),
  }
}

export function parseAISyncPlan(raw: string, direction: SyncDirection): AISyncPlan | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as { summary?: string; operations?: unknown[] }
  if (!Array.isArray(obj.operations)) return null

  const operations: AISyncOperation[] = []

  for (const op of obj.operations) {
    if (!op || typeof op !== 'object') continue
    const row = op as Record<string, unknown>
    const type = row.type
    const confidence = asNumber(row.confidence) ?? 0.5
    const reason = asString(row.reason) ?? 'AI match'
    const fields =
      row.fields && typeof row.fields === 'object'
        ? (row.fields as Record<string, unknown>)
        : {}

    if (type === 'update' && asString(row.shotId) && asString(row.storyboardId)) {
      operations.push({
        type: 'update',
        shotId: asString(row.shotId)!,
        storyboardId: asString(row.storyboardId)!,
        confidence,
        reason,
        fields,
      })
    } else if (
      type === 'create_shot' &&
      direction === 'storyboards-to-shotlist' &&
      asString(row.storyboardId)
    ) {
      operations.push({
        type: 'create_shot',
        storyboardId: asString(row.storyboardId)!,
        confidence,
        reason,
        fields,
      })
    } else if (
      type === 'create_storyboard' &&
      direction === 'shotlist-to-storyboards' &&
      asString(row.shotId)
    ) {
      operations.push({
        type: 'create_storyboard',
        shotId: asString(row.shotId)!,
        confidence,
        reason,
        fields,
      })
    }
  }

  return {
    summary: asString(obj.summary),
    operations,
  }
}
