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
