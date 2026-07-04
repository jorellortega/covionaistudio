import type { ShotList, CreateShotListData } from './shot-list-service'
import type { Storyboard, CreateStoryboardData } from './storyboards-service'
import { ShotListService } from './shot-list-service'
import { StoryboardsService } from './storyboards-service'

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
  matchType: 'link' | 'shot_number' | 'shot_only' | 'storyboard_only'
}

const SHOT_TYPE_TO_STORYBOARD: Record<string, string> = {
  'two-shot': 'medium',
  'over-the-shoulder': 'medium',
  'point-of-view': 'wide',
  establishing: 'wide',
  insert: 'close',
  cutaway: 'close',
}

const STORYBOARD_SHOT_TYPES = new Set(['wide', 'medium', 'close', 'extreme-close'])
const STORYBOARD_ANGLES = new Set(['eye-level', 'high-angle', 'low-angle', 'dutch-angle'])
const STORYBOARD_MOVEMENTS = new Set(['static', 'panning', 'tilting', 'tracking', 'zooming'])

export function mapShotTypeToStoryboard(shotType: string): string {
  if (STORYBOARD_SHOT_TYPES.has(shotType)) return shotType
  return SHOT_TYPE_TO_STORYBOARD[shotType] ?? 'wide'
}

export function mapCameraAngleToStoryboard(angle: string): string {
  if (STORYBOARD_ANGLES.has(angle)) return angle
  if (angle === 'bird-eye') return 'high-angle'
  if (angle === 'worm-eye') return 'low-angle'
  return 'eye-level'
}

export function mapMovementToStoryboard(movement: string): string {
  if (STORYBOARD_MOVEMENTS.has(movement)) return movement
  if (movement === 'dolly') return 'tracking'
  return 'static'
}

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

export function previewSceneSync(
  direction: SyncDirection,
  shots: ShotList[],
  storyboards: Storyboard[]
): SyncPreview {
  const pairs = matchPairs(shots, storyboards)
  const preview: SyncPreview = {
    direction,
    shotListCount: shots.length,
    storyboardCount: storyboards.length,
    creates: [],
    updates: [],
    unchanged: [],
    orphans: [],
  }

  if (direction === 'storyboards-to-shotlist') {
    for (const pair of pairs) {
      if (pair.storyboard && pair.shot) {
        const next = storyboardToShotUpdates(pair.storyboard)
        preview.updates.push({
          key: pairUpdateKey(pair.shot, pair.storyboard),
          kind: 'update',
          shotNumber: pair.storyboard.shot_number,
          label: storyboardLabel(pair.storyboard),
          detail: 'Update matching shot list entry',
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
        const next = storyboardToShotUpdates(pair.storyboard)
        preview.creates.push({
          key: pairCreateFromStoryboardKey(pair.storyboard),
          kind: 'create',
          shotNumber: pair.storyboard.shot_number,
          label: storyboardLabel(pair.storyboard),
          detail: 'New shot list entry linked to this storyboard',
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
        const next = shotToStoryboardUpdates(pair.shot)
        const hasImage = Boolean(pair.storyboard.image_url)
        preview.updates.push({
          key: pairUpdateKey(pair.shot, pair.storyboard),
          kind: 'update',
          shotNumber: pair.shot.shot_number,
          label: shotLabel(pair.shot),
          detail: hasImage ? 'Image preserved on storyboard' : 'Update matching storyboard',
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
        const next = shotToStoryboardUpdates(pair.shot)
        preview.creates.push({
          key: pairCreateFromShotKey(pair.shot),
          kind: 'create',
          shotNumber: pair.shot.shot_number,
          label: shotLabel(pair.shot),
          detail: 'New draft storyboard (no image)',
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

function storyboardToShotUpdates(storyboard: Storyboard): Partial<CreateShotListData> {
  return {
    shot_number: storyboard.shot_number,
    shot_type: storyboard.shot_type,
    camera_angle: storyboard.camera_angle,
    movement: storyboard.movement,
    description: storyboard.description || storyboard.title,
    action: storyboard.action ?? undefined,
    dialogue: storyboard.dialogue ?? undefined,
    visual_notes: storyboard.visual_notes ?? undefined,
    sequence_order: storyboard.sequence_order ?? storyboard.shot_number,
    storyboard_id: storyboard.id,
  }
}

function shotToStoryboardUpdates(shot: ShotList): Partial<CreateStoryboardData> {
  return {
    title: shot.description || `Shot ${shot.shot_number}`,
    description: shot.description || shot.action || '',
    shot_number: shot.shot_number,
    shot_type: mapShotTypeToStoryboard(shot.shot_type),
    camera_angle: mapCameraAngleToStoryboard(shot.camera_angle),
    movement: mapMovementToStoryboard(shot.movement),
    dialogue: shot.dialogue ?? undefined,
    action: shot.action ?? undefined,
    visual_notes: shot.visual_notes ?? undefined,
    sequence_order: shot.sequence_order ?? shot.shot_number,
  }
}

export async function applySceneSync(options: {
  direction: SyncDirection
  sceneId: string
  projectId?: string
  sceneNumber?: number
  shots: ShotList[]
  storyboards: Storyboard[]
  includeKeys?: Set<string>
}): Promise<SyncUndoEntry> {
  const { direction, sceneId, projectId, sceneNumber = 1, shots, storyboards, includeKeys } = options
  const pairs = matchPairs(shots, storyboards)
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
        await ShotListService.updateShotList(pair.shot.id, storyboardToShotUpdates(pair.storyboard))
      } else if (pair.storyboard) {
        const key = pairCreateFromStoryboardKey(pair.storyboard)
        if (!shouldApply(key)) continue
        const created = await ShotListService.createShotList({
          scene_id: sceneId,
          project_id: projectId,
          ...storyboardToShotUpdates(pair.storyboard),
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
        await StoryboardsService.updateStoryboard(pair.storyboard.id, shotToStoryboardUpdates(pair.shot))
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
          ...shotToStoryboardUpdates(pair.shot),
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
