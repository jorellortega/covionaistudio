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

/** Storyboards use sequence_order for insert-between positioning (e.g. 8.5 between 8 and 9) */
export function compareStoryboardOrder(
  a: { shot_number: number; sequence_order?: number },
  b: { shot_number: number; sequence_order?: number }
): number {
  const orderA = Number(a.sequence_order ?? a.shot_number)
  const orderB = Number(b.sequence_order ?? b.shot_number)
  if (orderA !== orderB) return orderA - orderB
  return Number(a.shot_number) - Number(b.shot_number)
}

export function sortStoryboardRows<T extends { shot_number: number; sequence_order?: number }>(
  rows: T[]
): T[] {
  return [...rows].sort(compareStoryboardOrder)
}

export function shotOrderValue(sb: { shot_number: number; sequence_order?: number }): number {
  return Number(sb.sequence_order ?? sb.shot_number)
}

/** Pick a unique decimal position between two order values (e.g. 8 and 9 → 8.5). */
export function computeInsertPlacementBetween(
  beforeOrder: number,
  afterOrder: number,
  takenValues: number[]
): number | null {
  let low = beforeOrder
  let high = afterOrder
  if (high <= low) high = low + 1

  const taken = new Set(takenValues.map((value) => Number(value)))
  let placement = Math.round((low + (high - low) / 2) * 100) / 100

  let attempts = 0
  while (taken.has(placement) && attempts < 24) {
    placement = Math.round(((placement + high) / 2) * 100) / 100
    attempts++
  }

  return taken.has(placement) ? null : placement
}

/** DB shot_number is integer — use next free integer when inserting at a decimal position. */
export function nextUniqueIntegerShotNumber(
  storyboards: { shot_number: number }[]
): number {
  const used = new Set(
    storyboards
      .map((sb) => Number(sb.shot_number))
      .filter((n) => Number.isInteger(n) && n > 0)
  )
  let candidate = 1
  while (used.has(candidate)) candidate++
  return candidate
}

/** Label shots by sequence position (e.g. 8.5 between 8 and 9). */
export function displayShotNumber(sb: { shot_number: number; sequence_order?: number }): string {
  return String(shotOrderValue(sb))
}

export function storyboardPlacementForInsert(
  storyboards: { shot_number: number; sequence_order?: number }[],
  sequence_order: number
): { shot_number: number; sequence_order: number } {
  if (
    Number.isInteger(sequence_order) &&
    !storyboards.some((sb) => Number(sb.shot_number) === sequence_order)
  ) {
    return { shot_number: sequence_order, sequence_order }
  }

  return {
    shot_number: nextUniqueIntegerShotNumber(storyboards),
    sequence_order,
  }
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
