export type ShotCountMode = "needed" | "range"

export interface ShotListGenerateOptions {
  shotCountMode?: ShotCountMode
  minShots?: number
  maxShots?: number
}

const MIN_ALLOWED = 1
const MAX_ALLOWED = 40

export function normalizeShotCountOptions(
  options: ShotListGenerateOptions | null | undefined,
): { mode: ShotCountMode; minShots: number; maxShots: number } {
  const mode = options?.shotCountMode === "range" ? "range" : "needed"
  let minShots = Number(options?.minShots)
  let maxShots = Number(options?.maxShots)

  if (!Number.isFinite(minShots)) minShots = 6
  if (!Number.isFinite(maxShots)) maxShots = 12

  minShots = Math.max(MIN_ALLOWED, Math.min(MAX_ALLOWED, Math.round(minShots)))
  maxShots = Math.max(MIN_ALLOWED, Math.min(MAX_ALLOWED, Math.round(maxShots)))

  if (minShots > maxShots) {
    const swap = minShots
    minShots = maxShots
    maxShots = swap
  }

  return { mode, minShots, maxShots }
}

export function buildShotCountPromptSection(
  options: ShotListGenerateOptions | null | undefined,
): string {
  const { mode, minShots, maxShots } = normalizeShotCountOptions(options)

  if (mode === "range") {
    if (minShots === maxShots) {
      return `SHOT COUNT RULE: Generate exactly ${minShots} shots. Cover the full screenplay excerpt in those ${minShots} setups. Combine beats if needed. Do not add extra coverage beyond ${minShots}.`
    }

    return `SHOT COUNT RULE: Generate between ${minShots} and ${maxShots} shots (inclusive).
- Cover the full screenplay excerpt inside that range
- Combine beats if needed to stay at or under ${maxShots}
- Do not pad with extra coverage, inserts, or alternate angles just to reach ${minShots}
- Stay as close as possible to what the scene actually requires, within the range`
  }

  return `SHOT COUNT RULE (ONLY SHOTS NEEDED):
Create ONLY the shots required to film this scene clearly.
- One shot per distinct story beat, camera setup, or spoken exchange
- Do NOT add extra coverage, safety shots, inserts, cutaways, or alternate angles unless the screenplay clearly requires them
- Prefer a lean shooting list over a complete coverage package
- Do not invent shots that are not implied by the screenplay
The result should be necessary shots only — not too many and not too few.`
}
