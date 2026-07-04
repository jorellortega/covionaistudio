import type { ShotList, CreateShotListData } from './shot-list-service'
import type { Storyboard, CreateStoryboardData } from './storyboards-service'
import { ShotListService } from './shot-list-service'
import { StoryboardsService } from './storyboards-service'
import type { AISyncPlan } from './scene-sync-ai'
import {
  normalizeAIShotListFields,
  normalizeAIStoryboardFields,
} from './scene-sync-ai'

export type SyncDirection = 'storyboards-to-shotlist' | 'shotlist-to-storyboards'

export type SyncFieldChange = {
  field: string
  before: string
  after: string
}

export type SyncPreviewItem = {
  key: string
  kind: 'create' | 'update' | 'unchanged' | 'orphan'
  shotNumber: number
  label: string
  detail?: string
  target: 'shotlist' | 'storyboard'
  shotId?: string
  storyboardId?: string
  changes?: SyncFieldChange[]
  /** Fields populated on create */
  createFields?: SyncFieldChange[]
}

export type SyncPreview = {
  direction: SyncDirection
  shotListCount: number
  storyboardCount: number
  aiAssisted?: boolean
  aiSummary?: string
  creates: SyncPreviewItem[]
  updates: SyncPreviewItem[]
  unchanged: SyncPreviewItem[]
  orphans: SyncPreviewItem[]
}

export type SyncUndoEntry = {
  direction: SyncDirection
  createdShotIds: string[]
  createdStoryboardIds: string[]
  updatedShots: Array<{ id: string; before: ShotList }>
  updatedStoryboards: Array<{ id: string; before: Storyboard }>
}

type MatchedPair = {
  shot?: ShotList
  storyboard?: Storyboard
  matchType: 'link' | 'shot_number' | 'ai' | 'shot_only' | 'storyboard_only'
  aiReason?: string
  aiConfidence?: number
  shotUpdates?: Partial<CreateShotListData>
  storyboardUpdates?: Partial<CreateStoryboardData>
}

import {
  mapCameraAngleToStoryboard,
  mapMovementToStoryboard,
  mapShotTypeToStoryboard,
} from './scene-shot-field-map'

function matchPairs(shots: ShotList[], storyboards: Storyboard[]): MatchedPair[] {
  const storyboardById = new Map(storyboards.map((sb) => [sb.id, sb]))
  const storyboardByShotNumber = new Map<number, Storyboard>()
  for (const sb of storyboards) {
    if (!storyboardByShotNumber.has(sb.shot_number)) {
      storyboardByShotNumber.set(sb.shot_number, sb)
    }
  }

  const pairedStoryboardIds = new Set<string>()
  const pairs: MatchedPair[] = []

  for (const shot of shots) {
    let storyboard: Storyboard | undefined

    if (shot.storyboard_id && storyboardById.has(shot.storyboard_id)) {
      storyboard = storyboardById.get(shot.storyboard_id)
      pairs.push({ shot, storyboard, matchType: 'link' })
    } else if (storyboardByShotNumber.has(shot.shot_number)) {
      const candidate = storyboardByShotNumber.get(shot.shot_number)!
      if (!pairedStoryboardIds.has(candidate.id)) {
        storyboard = candidate
        pairs.push({ shot, storyboard, matchType: 'shot_number' })
      } else {
        pairs.push({ shot, matchType: 'shot_only' })
      }
    } else {
      pairs.push({ shot, matchType: 'shot_only' })
    }

    if (storyboard) pairedStoryboardIds.add(storyboard.id)
  }

  for (const storyboard of storyboards) {
    if (!pairedStoryboardIds.has(storyboard.id)) {
      pairs.push({ storyboard, matchType: 'storyboard_only' })
    }
  }

  return pairs
}

function resolveFromAIPlan(
  direction: SyncDirection,
  shots: ShotList[],
  storyboards: Storyboard[],
  plan: AISyncPlan
): MatchedPair[] {
  const shotById = new Map(shots.map((s) => [s.id, s]))
  const sbById = new Map(storyboards.map((sb) => [sb.id, sb]))
  const usedShots = new Set<string>()
  const usedSbs = new Set<string>()
  const pairs: MatchedPair[] = []

  // Always honor existing storyboard_id links first (strongest signal)
  for (const shot of shots) {
    if (!shot.storyboard_id || !sbById.has(shot.storyboard_id)) continue
    const storyboard = sbById.get(shot.storyboard_id)!
    if (usedShots.has(shot.id) || usedSbs.has(storyboard.id)) continue
    usedShots.add(shot.id)
    usedSbs.add(storyboard.id)
    pairs.push({
      shot,
      storyboard,
      matchType: 'link',
      aiReason:
        shot.shot_number !== storyboard.shot_number
          ? `Linked pair — renumber shot list ${shot.shot_number} → ${storyboard.shot_number}`
          : 'Existing storyboard link',
    })
  }

  for (const op of plan.operations) {
    if (op.type === 'update') {
      if (usedShots.has(op.shotId) || usedSbs.has(op.storyboardId)) continue
      const shot = shotById.get(op.shotId)
      const storyboard = sbById.get(op.storyboardId)
      if (!shot || !storyboard) continue
      usedShots.add(shot.id)
      usedSbs.add(storyboard.id)
      const renumberNote =
        direction === 'storyboards-to-shotlist' && shot.shot_number !== storyboard.shot_number
          ? ` — renumber ${shot.shot_number} → ${storyboard.shot_number}`
          : direction === 'shotlist-to-storyboards' && shot.shot_number !== storyboard.shot_number
          ? ` — renumber ${storyboard.shot_number} → ${shot.shot_number}`
          : ''
      pairs.push({
        shot,
        storyboard,
        matchType: 'ai',
        aiReason: `${op.reason}${renumberNote}`,
        aiConfidence: op.confidence,
        shotUpdates:
          direction === 'storyboards-to-shotlist'
            ? normalizeAIShotListFields(op.fields)
            : undefined,
        storyboardUpdates:
          direction === 'shotlist-to-storyboards'
            ? normalizeAIStoryboardFields(op.fields)
            : undefined,
      })
    } else if (op.type === 'create_shot') {
      if (usedSbs.has(op.storyboardId)) continue
      const storyboard = sbById.get(op.storyboardId)
      if (!storyboard) continue
      usedSbs.add(storyboard.id)
      pairs.push({
        storyboard,
        matchType: 'storyboard_only',
        aiReason: op.reason,
        aiConfidence: op.confidence,
        shotUpdates: normalizeAIShotListFields(op.fields),
      })
    } else if (op.type === 'create_storyboard') {
      if (usedShots.has(op.shotId)) continue
      const shot = shotById.get(op.shotId)
      if (!shot) continue
      usedShots.add(shot.id)
      pairs.push({
        shot,
        matchType: 'shot_only',
        aiReason: op.reason,
        aiConfidence: op.confidence,
        storyboardUpdates: normalizeAIStoryboardFields(op.fields),
      })
    }
  }

  // Same shot_number pairs AI missed (content may differ but numbers align)
  for (const shot of shots) {
    if (usedShots.has(shot.id)) continue
    const storyboard = storyboards.find(
      (sb) => !usedSbs.has(sb.id) && sb.shot_number === shot.shot_number
    )
    if (!storyboard) continue
    usedShots.add(shot.id)
    usedSbs.add(storyboard.id)
    pairs.push({
      shot,
      storyboard,
      matchType: 'shot_number',
      aiReason: 'Same shot number',
    })
  }

  for (const shot of shots) {
    if (!usedShots.has(shot.id)) {
      pairs.push({ shot, matchType: 'shot_only' })
    }
  }
  for (const storyboard of storyboards) {
    if (!usedSbs.has(storyboard.id)) {
      pairs.push({ storyboard, matchType: 'storyboard_only' })
    }
  }

  return pairs
}

function resolveSyncPairs(
  shots: ShotList[],
  storyboards: Storyboard[],
  direction: SyncDirection,
  aiPlan?: AISyncPlan | null
): MatchedPair[] {
  if (aiPlan?.operations?.length) {
    return resolveFromAIPlan(direction, shots, storyboards, aiPlan)
  }
  return matchPairs(shots, storyboards)
}

function matchDetail(pair: MatchedPair, fallback: string): string {
  if (pair.aiReason) {
    const pct = pair.aiConfidence != null ? ` (${Math.round(pair.aiConfidence * 100)}%)` : ''
    return `AI match${pct}: ${pair.aiReason}`
  }
  return fallback
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return '—'
  return String(value)
}

function diffFields(
  labels: Array<{ key: string; label: string; before: Record<string, unknown>; after: Record<string, unknown> }>
): SyncFieldChange[] {
  const changes: SyncFieldChange[] = []
  for (const { key, label, before, after } of labels) {
    const beforeVal = displayValue(before[key])
    const afterVal = displayValue(after[key])
    if (beforeVal !== afterVal) {
      changes.push({ field: label, before: beforeVal, after: afterVal })
    }
  }
  return changes
}

function shotPreviewFields(shot: Partial<CreateShotListData>): Record<string, unknown> {
  return {
    description: shot.description,
    shot_type: shot.shot_type,
    camera_angle: shot.camera_angle,
    movement: shot.movement,
    action: shot.action,
    dialogue: shot.dialogue,
    visual_notes: shot.visual_notes,
  }
}

function storyboardPreviewFields(sb: Partial<CreateStoryboardData>): Record<string, unknown> {
  return {
    title: sb.title,
    description: sb.description,
    shot_type: sb.shot_type,
    camera_angle: sb.camera_angle,
    movement: sb.movement,
    action: sb.action,
    dialogue: sb.dialogue,
    visual_notes: sb.visual_notes,
  }
}

const FIELD_LABELS = [
  { key: 'description', label: 'Description' },
  { key: 'title', label: 'Title' },
  { key: 'shot_type', label: 'Shot type' },
  { key: 'camera_angle', label: 'Camera angle' },
  { key: 'movement', label: 'Movement' },
  { key: 'action', label: 'Action' },
  { key: 'dialogue', label: 'Dialogue' },
  { key: 'visual_notes', label: 'Visual notes' },
]

function buildCreateFields(values: Record<string, unknown>): SyncFieldChange[] {
  return FIELD_LABELS.map(({ key, label }) => ({
    field: label,
    before: '—',
    after: displayValue(values[key]),
  })).filter((row) => row.after !== '—')
}

function storyboardLabel(sb: Storyboard): string {
  return sb.title || `Shot ${sb.shot_number}`
}

function shotLabel(shot: ShotList): string {
  return shot.description || `Shot ${shot.shot_number}`
}

function pairUpdateKey(shot: ShotList, storyboard: Storyboard): string {
  return `update:${shot.id}:${storyboard.id}`
}

function pairCreateFromStoryboardKey(storyboard: Storyboard): string {
  return `create-sb:${storyboard.id}`
}

function pairCreateFromShotKey(shot: ShotList): string {
  return `create-shot:${shot.id}`
}

function storyboardToShotUpdates(
  storyboard: Storyboard,
  overrides?: Partial<CreateShotListData>
): Partial<CreateShotListData> {
  const content: Partial<CreateShotListData> = {
    shot_type: storyboard.shot_type,
    camera_angle: storyboard.camera_angle,
    movement: storyboard.movement,
    description: storyboard.description || storyboard.title,
    action: storyboard.action ?? undefined,
    dialogue: storyboard.dialogue ?? undefined,
    visual_notes: storyboard.visual_notes ?? undefined,
    ...overrides,
  }
  return {
    ...content,
    shot_number: storyboard.shot_number,
    sequence_order: storyboard.sequence_order ?? storyboard.shot_number,
    storyboard_id: storyboard.id,
  }
}

function shotToStoryboardUpdates(
  shot: ShotList,
  overrides?: Partial<CreateStoryboardData>
): Partial<CreateStoryboardData> {
  const content: Partial<CreateStoryboardData> = {
    title: shot.description || `Shot ${shot.shot_number}`,
    description: shot.description || shot.action || '',
    shot_type: mapShotTypeToStoryboard(shot.shot_type),
    camera_angle: mapCameraAngleToStoryboard(shot.camera_angle),
    movement: mapMovementToStoryboard(shot.movement),
    dialogue: shot.dialogue ?? undefined,
    action: shot.action ?? undefined,
    visual_notes: shot.visual_notes ?? undefined,
    ...overrides,
  }
  return {
    ...content,
    shot_number: shot.shot_number,
    sequence_order: shot.sequence_order ?? shot.shot_number,
  }
}

export function previewSceneSync(
  direction: SyncDirection,
  shots: ShotList[],
  storyboards: Storyboard[],
  aiPlan?: AISyncPlan | null
): SyncPreview {
  const pairs = resolveSyncPairs(shots, storyboards, direction, aiPlan)
  const preview: SyncPreview = {
    direction,
    shotListCount: shots.length,
    storyboardCount: storyboards.length,
    aiAssisted: Boolean(aiPlan?.operations?.length),
    aiSummary: aiPlan?.summary,
    creates: [],
    updates: [],
    unchanged: [],
    orphans: [],
  }

  if (direction === 'storyboards-to-shotlist') {
    for (const pair of pairs) {
      if (pair.storyboard && pair.shot) {
        const next = storyboardToShotUpdates(pair.storyboard, pair.shotUpdates)
        preview.updates.push({
          key: pairUpdateKey(pair.shot, pair.storyboard),
          kind: 'update',
          shotNumber: next.shot_number ?? pair.storyboard.shot_number,
          label: storyboardLabel(pair.storyboard),
          detail: matchDetail(pair, 'Update matching shot list entry'),
          target: 'shotlist',
          shotId: pair.shot.id,
          storyboardId: pair.storyboard.id,
          changes: diffFields(
            FIELD_LABELS.map(({ key, label }) => ({
              key,
              label,
              before: shotPreviewFields(pair.shot),
              after: shotPreviewFields(next),
            }))
          ),
        })
      } else if (pair.storyboard) {
        const next = storyboardToShotUpdates(pair.storyboard, pair.shotUpdates)
        preview.creates.push({
          key: pairCreateFromStoryboardKey(pair.storyboard),
          kind: 'create',
          shotNumber: next.shot_number ?? pair.storyboard.shot_number,
          label: storyboardLabel(pair.storyboard),
          detail: matchDetail(pair, 'New shot list entry linked to this storyboard'),
          target: 'shotlist',
          storyboardId: pair.storyboard.id,
          createFields: buildCreateFields(shotPreviewFields(next)),
        })
      } else if (pair.shot) {
        preview.orphans.push({
          key: `orphan-shot:${pair.shot.id}`,
          kind: 'orphan',
          shotNumber: pair.shot.shot_number,
          label: shotLabel(pair.shot),
          detail: 'No matching storyboard — will not change',
          target: 'shotlist',
          shotId: pair.shot.id,
        })
      }
    }
  } else {
    for (const pair of pairs) {
      if (pair.shot && pair.storyboard) {
        const next = shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates)
        const hasImage = Boolean(pair.storyboard.image_url)
        preview.updates.push({
          key: pairUpdateKey(pair.shot, pair.storyboard),
          kind: 'update',
          shotNumber: next.shot_number ?? pair.shot.shot_number,
          label: shotLabel(pair.shot),
          detail: matchDetail(
            pair,
            hasImage ? 'Image preserved on storyboard' : 'Update matching storyboard'
          ),
          target: 'storyboard',
          shotId: pair.shot.id,
          storyboardId: pair.storyboard.id,
          changes: diffFields(
            FIELD_LABELS.map(({ key, label }) => ({
              key,
              label,
              before: storyboardPreviewFields(pair.storyboard),
              after: storyboardPreviewFields(next),
            }))
          ),
        })
      } else if (pair.shot) {
        const next = shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates)
        preview.creates.push({
          key: pairCreateFromShotKey(pair.shot),
          kind: 'create',
          shotNumber: next.shot_number ?? pair.shot.shot_number,
          label: shotLabel(pair.shot),
          detail: matchDetail(pair, 'New draft storyboard (no image)'),
          target: 'storyboard',
          shotId: pair.shot.id,
          createFields: buildCreateFields(storyboardPreviewFields(next)),
        })
      } else if (pair.storyboard) {
        const hasImage = Boolean(pair.storyboard.image_url)
        preview.orphans.push({
          key: `orphan-sb:${pair.storyboard.id}`,
          kind: 'orphan',
          shotNumber: pair.storyboard.shot_number,
          label: storyboardLabel(pair.storyboard),
          detail: hasImage
            ? 'Keeps existing image — will not change'
            : 'No matching shot list entry — will not change',
          target: 'storyboard',
          storyboardId: pair.storyboard.id,
        })
      }
    }
  }

  return preview
}

export async function applySceneSync(options: {
  direction: SyncDirection
  sceneId: string
  projectId?: string
  sceneNumber?: number
  shots: ShotList[]
  storyboards: Storyboard[]
  includeKeys?: Set<string>
  aiPlan?: AISyncPlan | null
}): Promise<SyncUndoEntry> {
  const { direction, sceneId, projectId, sceneNumber = 1, shots, storyboards, includeKeys, aiPlan } =
    options
  const pairs = resolveSyncPairs(shots, storyboards, direction, aiPlan)
  const undo: SyncUndoEntry = {
    direction,
    createdShotIds: [],
    createdStoryboardIds: [],
    updatedShots: [],
    updatedStoryboards: [],
  }

  const shouldApply = (key: string) => !includeKeys || includeKeys.has(key)

  if (direction === 'storyboards-to-shotlist') {
    for (const pair of pairs) {
      if (pair.storyboard && pair.shot) {
        const key = pairUpdateKey(pair.shot, pair.storyboard)
        if (!shouldApply(key)) continue
        undo.updatedShots.push({ id: pair.shot.id, before: { ...pair.shot } })
        await ShotListService.updateShotList(
          pair.shot.id,
          storyboardToShotUpdates(pair.storyboard, pair.shotUpdates)
        )
      } else if (pair.storyboard) {
        const key = pairCreateFromStoryboardKey(pair.storyboard)
        if (!shouldApply(key)) continue
        const created = await ShotListService.createShotList({
          scene_id: sceneId,
          project_id: projectId,
          ...storyboardToShotUpdates(pair.storyboard, pair.shotUpdates),
          status: 'planned',
        })
        undo.createdShotIds.push(created.id)
      }
    }
  } else {
    for (const pair of pairs) {
      if (pair.shot && pair.storyboard) {
        const key = pairUpdateKey(pair.shot, pair.storyboard)
        if (!shouldApply(key)) continue
        undo.updatedStoryboards.push({ id: pair.storyboard.id, before: { ...pair.storyboard } })
        await StoryboardsService.updateStoryboard(
          pair.storyboard.id,
          shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates)
        )
        if (pair.shot.storyboard_id !== pair.storyboard.id) {
          undo.updatedShots.push({ id: pair.shot.id, before: { ...pair.shot } })
          await ShotListService.updateShotList(pair.shot.id, { storyboard_id: pair.storyboard.id })
        }
      } else if (pair.shot) {
        const key = pairCreateFromShotKey(pair.shot)
        if (!shouldApply(key)) continue
        const created = await StoryboardsService.createStoryboard({
          scene_id: sceneId,
          project_id: projectId,
          scene_number: sceneNumber,
          status: 'draft',
          ...shotToStoryboardUpdates(pair.shot, pair.storyboardUpdates),
        } as CreateStoryboardData)
        undo.createdStoryboardIds.push(created.id)
        undo.updatedShots.push({ id: pair.shot.id, before: { ...pair.shot } })
        await ShotListService.updateShotList(pair.shot.id, { storyboard_id: created.id })
      }
    }
  }

  return undo
}

export async function undoSceneSync(entry: SyncUndoEntry): Promise<void> {
  for (const shotId of entry.createdShotIds) {
    await ShotListService.deleteShotList(shotId)
  }
  for (const storyboardId of entry.createdStoryboardIds) {
    await StoryboardsService.deleteStoryboard(storyboardId)
  }
  for (const { id, before } of entry.updatedShots) {
    const {
      id: _id,
      user_id: _userId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...updates
    } = before
    await ShotListService.updateShotList(id, updates)
  }
  for (const { id, before } of entry.updatedStoryboards) {
    const {
      id: _id,
      user_id: _userId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ai_generated: _aiGenerated,
      ...updates
    } = before
    await StoryboardsService.updateStoryboard(id, updates)
  }
}

const UNDO_STACK_LIMIT = 2

function undoStorageKey(sceneId: string) {
  return `scene-sync-undo:${sceneId}`
}

export function loadUndoStack(sceneId: string): SyncUndoEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(undoStorageKey(sceneId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SyncUndoEntry[]
    return Array.isArray(parsed) ? parsed.slice(0, UNDO_STACK_LIMIT) : []
  } catch {
    return []
  }
}

export function pushUndoEntry(sceneId: string, entry: SyncUndoEntry): SyncUndoEntry[] {
  const stack = loadUndoStack(sceneId)
  const next = [entry, ...stack].slice(0, UNDO_STACK_LIMIT)
  sessionStorage.setItem(undoStorageKey(sceneId), JSON.stringify(next))
  return next
}

export function popUndoEntry(sceneId: string): SyncUndoEntry | null {
  const stack = loadUndoStack(sceneId)
  if (stack.length === 0) return null
  const [first, ...rest] = stack
  if (rest.length === 0) {
    sessionStorage.removeItem(undoStorageKey(sceneId))
  } else {
    sessionStorage.setItem(undoStorageKey(sceneId), JSON.stringify(rest))
  }
  return first
}
