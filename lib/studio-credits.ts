import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  calculateAudioCost,
  calculateImageCost,
  calculateTextCost,
  resolveCostSource,
  SOURCE_LABELS,
  type AudioCostKind,
  type CostSource,
} from '@/lib/api-cost-tracker'
import { DEFAULT_CINEMATIC_IMAGE_SIZE } from '@/lib/image-model-utils'

/** Production pack sells the most credits per dollar: 150,000 / $200. */
export const WORST_PACK_CREDITS_PER_USD = 750

/**
 * Markup over worst-pack break-even so generations stay profitable
 * even after Stripe. Applied to tracker USD (images, text, and audio).
 */
export const CREDIT_PROFIT_MARKUP = 1.42

export const STUDIO_CREDITS_CHANGED_EVENT = 'studio-credits-changed'

export class InsufficientCreditsError extends Error {
  readonly code = 'INSUFFICIENT_CREDITS' as const
  readonly required: number
  readonly balance: number

  constructor(required: number, balance: number) {
    super(
      `Not enough credits. This costs ${required.toLocaleString()} credits. You have ${balance.toLocaleString()}.`,
    )
    this.name = 'InsufficientCreditsError'
    this.required = required
    this.balance = balance
  }
}

export function creditsForApiCostUsd(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return 1
  return Math.max(1, Math.ceil(costUsd * WORST_PACK_CREDITS_PER_USD * CREDIT_PROFIT_MARKUP))
}

export function creditsForImageGeneration(
  model: string,
  size?: string | null,
  quantity = 1,
): number {
  return creditsForApiCostUsd(calculateImageCost(model, size, quantity))
}

export function workspaceImageCredits(
  model: string,
  size: string | null | undefined = DEFAULT_CINEMATIC_IMAGE_SIZE,
  quantity = 1,
): number {
  return creditsForImageGeneration(model || 'gpt-image-2', size, quantity)
}

export function creditsForTextGeneration(params: {
  model: string
  inputTokens?: number | null
  outputTokens?: number | null
  inputText?: string | null
  outputText?: string | null
}): number {
  return creditsForApiCostUsd(calculateTextCost(params))
}

export function creditsForAudio(kind: AudioCostKind, characterCount?: number | null): number {
  return creditsForApiCostUsd(calculateAudioCost(kind, characterCount))
}

export async function chargeCreateVoiceCredits(input: {
  userId: string
  kind: AudioCostKind
  characterCount?: number | null
  description: string
  metadata?: Record<string, unknown>
}): Promise<ChargeCreditsResult & { costUsd: number }> {
  const costUsd = calculateAudioCost(input.kind, input.characterCount)
  const amount = creditsForApiCostUsd(costUsd)
  const charged = await chargeStudioCredits({
    userId: input.userId,
    amount,
    description: input.description,
    usageType: 'audio_generation',
    service: 'elevenlabs',
    metadata: {
      source: 'create-voice',
      kind: input.kind,
      costUsd,
      characterCount: input.characterCount ?? null,
      ...input.metadata,
    },
  })
  return { ...charged, costUsd }
}

export function estimateWorkspaceTextCredits(
  model: string,
  inputText: string,
  maxOutputTokens: number,
): number {
  return creditsForTextGeneration({
    model: model || 'gpt-5.1',
    inputText,
    outputTokens: Math.max(1, maxOutputTokens),
  })
}

export function workspaceTextMaxOutputTokens(model: string): number {
  return model.startsWith('gpt-5') ? 6000 : 4000
}

export async function chargeWorkspaceTextCredits(input: {
  userId: string
  model: string
  provider?: string
  description: string
  source?: CostSource | string
  inputTokens?: number | null
  outputTokens?: number | null
  inputText?: string | null
  outputText?: string | null
  metadata?: Record<string, unknown>
}): Promise<ChargeCreditsResult> {
  const source = input.source || 'workspace'
  const amount = creditsForTextGeneration({
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    inputText: input.inputText,
    outputText: input.outputText,
  })
  return chargeStudioCredits({
    userId: input.userId,
    amount,
    description: input.description,
    usageType: 'text_generation',
    service: input.provider || 'openai',
    metadata: {
      source,
      model: input.model,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      ...input.metadata,
    },
  })
}

const PAID_IMAGE_SOURCES = new Set<CostSource>([
  'workspace',
  'shotlist',
  'storyboard',
  'timeline',
  'screenplay',
  'locations',
  'avatars',
  'characters',
  'objects',
  'prompt-create',
])
const PAID_TEXT_SOURCES = new Set<CostSource>([
  'workspace',
  'shotlist',
  'storyboard',
  'timeline',
  'screenplay',
  'locations',
  'avatars',
  'characters',
  'objects',
  'prompt-create',
])

export function paidSourceLabel(source: CostSource | string): string {
  return SOURCE_LABELS[source] || 'Studio'
}

export function shouldChargeImageCredits(
  request?: Request | null,
  costSource?: string | null,
): boolean {
  return PAID_IMAGE_SOURCES.has(resolveCostSource(request, costSource, 'other'))
}

export function shouldChargeTextCredits(
  request?: Request | null,
  costSource?: string | null,
): boolean {
  return PAID_TEXT_SOURCES.has(resolveCostSource(request, costSource, 'other'))
}

export function shouldChargeAudioCredits(
  request?: Request | null,
  costSource?: string | null,
): boolean {
  return resolveCostSource(request, costSource, 'other') === 'create-voice'
}

export function shouldChargeWorkspaceCredits(
  request?: Request | null,
  costSource?: string | null,
): boolean {
  return shouldChargeImageCredits(request, costSource)
}

export function isWorkspaceCostSource(source: CostSource | string | null | undefined): boolean {
  return source === 'workspace'
}

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getStudioCreditBalance(userId: string): Promise<number> {
  const admin = getAdminClient()
  if (!admin) return 0
  const { data, error } = await admin.rpc('get_user_credits', { p_user_id: userId })
  if (error) {
    const { data: row } = await admin.from('users').select('credits').eq('id', userId).maybeSingle()
    return typeof row?.credits === 'number' ? row.credits : 0
  }
  return typeof data === 'number' ? data : 0
}

export async function hasStudioCredits(userId: string, required: number): Promise<{
  ok: boolean
  balance: number
  required: number
}> {
  const balance = await getStudioCreditBalance(userId)
  return { ok: balance >= required, balance, required }
}

export type ChargeCreditsResult = {
  balance: number
  amount: number
}

export async function chargeStudioCredits(input: {
  userId: string
  amount: number
  description: string
  metadata?: Record<string, unknown>
  usageType?: 'image_generation' | 'video_generation' | 'audio_generation' | 'text_generation' | 'other'
  service?: string | null
}): Promise<ChargeCreditsResult> {
  const amount = Math.max(1, Math.floor(input.amount))
  const admin = getAdminClient()
  if (!admin) {
    throw new Error('Credits are unavailable because billing is not configured')
  }

  const before = await getStudioCreditBalance(input.userId)
  if (before < amount) {
    throw new InsufficientCreditsError(amount, before)
  }

  const { data, error } = await admin.rpc('deduct_credits', {
    p_user_id: input.userId,
    p_amount: amount,
    p_description: input.description,
    p_metadata: input.metadata || null,
  })

  let balance: number | null = typeof data === 'number' ? data : null

  if (error) {
    const message = error.message || ''
    if (message.toLowerCase().includes('insufficient credits')) {
      throw new InsufficientCreditsError(amount, before)
    }

    const { data: updated, error: updateError } = await admin
      .from('users')
      .update({ credits: before - amount })
      .eq('id', input.userId)
      .gte('credits', amount)
      .select('credits')
      .maybeSingle()

    if (updateError || typeof updated?.credits !== 'number') {
      throw new Error(error.message || 'Failed to deduct credits')
    }

    balance = updated.credits
    await admin.from('credit_transactions').insert({
      user_id: input.userId,
      transaction_type: 'usage',
      amount: -amount,
      balance_after: balance,
      description: input.description,
      metadata: input.metadata || null,
    })
  }

  if (typeof balance !== 'number') {
    balance = Math.max(0, before - amount)
  }

  if (input.usageType) {
    await admin.from('credit_usage_log').insert({
      user_id: input.userId,
      usage_type: input.usageType,
      service: input.service || null,
      credits_used: amount,
      metadata: input.metadata || null,
    })
  }

  return { balance, amount }
}

export async function refundStudioCredits(input: {
  userId: string
  amount: number
  description: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const amount = Math.max(1, Math.floor(input.amount))
  const admin = getAdminClient()
  if (!admin) return

  const { error } = await admin.rpc('add_credits', {
    p_user_id: input.userId,
    p_amount: amount,
    p_description: input.description,
    p_stripe_payment_intent_id: null,
    p_metadata: input.metadata || null,
  })

  if (error) {
    console.error('[studio-credits] Failed to refund credits:', error.message)
  }
}

export function insufficientCreditsPayload(error: InsufficientCreditsError) {
  return {
    error: error.message,
    code: error.code,
    required: error.required,
    balance: error.balance,
    success: false,
  }
}

export function isInsufficientCreditsPayload(
  payload: unknown,
): payload is { code: 'INSUFFICIENT_CREDITS'; error?: string; required: number; balance: number } {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as { code?: string; required?: unknown; balance?: unknown }
  return (
    value.code === 'INSUFFICIENT_CREDITS' &&
    typeof value.required === 'number' &&
    typeof value.balance === 'number'
  )
}
