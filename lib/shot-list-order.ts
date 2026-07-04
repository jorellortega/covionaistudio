/** Shot list display + sync order — shot_number first so 11 comes after 10, not after 1 */
export function compareShotListOrder(
  a: { shot_number: number; sequence_order?: number },
  b: { shot_number: number; sequence_order?: number }
): number {
  const numA = Number(a.shot_number)
  const numB = Number(b.shot_number)
  if (numA !== numB) return numA - numB
  const orderA = Number(a.sequence_order ?? numA)
  const orderB = Number(b.sequence_order ?? numB)
  return orderA - orderB
}

export function sortShotListRows<T extends { shot_number: number; sequence_order?: number }>(
  rows: T[]
): T[] {
  return [...rows].sort(compareShotListOrder)
}

/** When syncing from storyboards, shot_number is the canonical sequence position */
export function sequenceOrderFromStoryboard(storyboard: {
  shot_number: number
  sequence_order?: number
}): number {
  const shotNum = Number(storyboard.shot_number)
  const seq = Number(storyboard.sequence_order ?? shotNum)
  // Keep decimal insert-between values (e.g. 2.5 between shots 2 and 3)
  if (!Number.isInteger(seq) && seq > 0) return seq
  return shotNum
}
