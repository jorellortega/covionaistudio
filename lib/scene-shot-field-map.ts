import { STORYBOARD_SHOT_TYPE_VALUES, resolveCameraAngleValue, resolveMovementValue } from './shot-options'

const SHOT_TYPE_TO_STORYBOARD: Record<string, string> = {
  'two-shot': 'medium',
  'over-the-shoulder': 'medium',
  'point-of-view': 'wide',
  establishing: 'wide',
  insert: 'close',
  cutaway: 'close',
}

const STORYBOARD_SHOT_TYPES = STORYBOARD_SHOT_TYPE_VALUES

export function mapShotTypeToStoryboard(shotType: string): string {
  if (STORYBOARD_SHOT_TYPES.has(shotType)) return shotType
  return SHOT_TYPE_TO_STORYBOARD[shotType] ?? 'wide'
}

export function mapCameraAngleToStoryboard(angle: string): string {
  return resolveCameraAngleValue(angle)
}

export function mapMovementToStoryboard(movement: string): string {
  return resolveMovementValue(movement)
}
