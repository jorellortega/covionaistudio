import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export type CostSource =
  | 'storyboard'
  | 'shotlist'
  | 'screenplay'
  | 'workspace'
  | 'cinema-production'
  | 'other'

export type GenerationType = 'image' | 'video' | 'text' | 'chat' | 'shot_list' | 'screenplay'

export type ApiCostEvent = {
  id: string
  user_id: string
  source: CostSource | string
  generation_type: string
  provider: string
  model: string
  cost_usd: number
  input_tokens: number | null
  output_tokens: number | null
  duration_seconds: number | null
  quantity: number
  prompt_preview: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export const SOURCE_LABELS: Record<string, string> = {
  storyboard: 'Storyboard',
  shotlist: 'Shot list',
  screenplay: 'Screenplay',
  workspace: 'Workspace',
  'cinema-production': 'Cinema production',
  other: 'Other',
}

export const TRACKED_SOURCES: CostSource[] = [
  'storyboard',
  'shotlist',
  'screenplay',
  'workspace',
  'cinema-production',
  'other',
]

const KNOWN_SOURCES = new Set<string>(TRACKED_SOURCES)

const PATH_SOURCES: { match: string; source: CostSource }[] = [
  { match: '/storyboards', source: 'storyboard' },
  { match: '/shotlist', source: 'shotlist' },
  { match: '/screenplay', source: 'screenplay' },
  { match: '/cinema-production', source: 'cinema-production' },
  { match: '/new', source: 'workspace' },
]

type TextRates = { input: number; output: number }

/** USD per 1M tokens. Public list prices, approximate. */
const TEXT_RATES: Record<string, TextRates> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5': { input: 1.25, output: 10 },
  o3: { input: 2, output: 8 },
  'o4-mini': { input: 1.1, output: 4.4 },
  'claude-3-5-haiku': { input: 0.8, output: 4 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-7-sonnet': { input: 3, output: 15 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-opus-4': { input: 15, output: 75 },
  'claude-3-opus': { input: 15, output: 75 },
}

/** USD per image. */
const IMAGE_RATES: Record<string, number> = {
  'dall-e-3': 0.04,
  'dall-e-2': 0.02,
  'gpt-image-1': 0.042,
  'gpt-image-2': 0.05,
  'gen4_image': 0.08,
  'gen4_image_turbo': 0.05,
  leonardo: 0.04,
  openart: 0.02,
  sdxl: 0.02,
}

/** USD per second of video. */
const VIDEO_RATES: Record<string, number> = {
  gen4_turbo: 0.05,
  gen3a_turbo: 0.05,
  gen4_aleph: 0.15,
  upscale_v1: 0.02,
  act_two: 0.1,
  'kling-v3': 0.084,
  'kling-v3-omni': 0.112,
  'kling 3.0': 0.084,
  'kling 3.0 omni': 0.112,
  'kling 3.0 t2v': 0.084,
  'kling 3.0 i2v': 0.084,
  'kling-lip-sync': 0.05,
  'kling-motion-control': 0.07,
}

export type LogApiCostInput = {
  request?: NextRequest | Request
  userId?: string | null
  costSource?: string | null
  fallbackSource?: CostSource
  generationType: GenerationType
  provider: string
  model: string
  prompt?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  inputText?: string | null
  outputText?: string | null
  durationSeconds?: number | null
  quantity?: number
  hasAudio?: boolean
  size?: string | null
  metadata?: Record<string, unknown>
}

function roundUsd(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 1_000_000) / 1_000_000
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeCostSource(value?: string | null): CostSource {
  if (!value) return 'other'
  const key = normalizeKey(value).replace(/_/g, '-')
  if (key === 'storyboards' || key === 'storyboard') return 'storyboard'
  if (key === 'shot-list' || key === 'shotlist') return 'shotlist'
  if (key === 'screenplays' || key === 'screenplay') return 'screenplay'
  if (key === 'workspace' || key === 'creative-workspace' || key === 'new') return 'workspace'
  if (key === 'cinema-production' || key === 'cinema-production') return 'cinema-production'
  return KNOWN_SOURCES.has(key) ? (key as CostSource) : 'other'
}

export function resolveCostSource(
  request?: NextRequest | Request | null,
  explicit?: string | null,
  fallback?: CostSource,
): CostSource {
  const fromExplicit = explicit ? normalizeCostSource(explicit) : 'other'
  if (explicit && fromExplicit !== 'other') return fromExplicit

  const header = request?.headers.get('x-cost-source')
  if (header) {
    const fromHeader = normalizeCostSource(header)
    if (fromHeader !== 'other') return fromHeader
  }

  const referer = request?.headers.get('referer') || request?.headers.get('referrer') || ''
  if (referer) {
    try {
      const path = new URL(referer).pathname
      for (const { match, source } of PATH_SOURCES) {
        if (path === match || path.startsWith(`${match}/`)) return source
      }
    } catch {
      // ignore invalid referer
    }
  }

  return fallback || 'other'
}

function matchRate<T>(table: Record<string, T>, model: string, fallback: T): T {
  const key = normalizeKey(model)
  if (table[key]) return table[key]
  const entries = Object.entries(table).sort((a, b) => b[0].length - a[0].length)
  for (const [candidate, rate] of entries) {
    if (key.includes(candidate) || candidate.includes(key)) return rate
  }
  return fallback
}

function estimateTokensFromText(text?: string | null): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export function calculateTextCost(params: {
  model: string
  inputTokens?: number | null
  outputTokens?: number | null
  inputText?: string | null
  outputText?: string | null
}): number {
  const rates = matchRate(TEXT_RATES, params.model, { input: 0.5, output: 1.5 })
  const inputTokens = params.inputTokens || estimateTokensFromText(params.inputText)
  const outputTokens = params.outputTokens || estimateTokensFromText(params.outputText)
  return roundUsd((inputTokens * rates.input + outputTokens * rates.output) / 1_000_000)
}

export function calculateImageCost(model: string, size?: string | null, quantity = 1): number {
  let rate = matchRate(IMAGE_RATES, model, 0.04)
  const sizeKey = (size || '').toLowerCase()
  if (sizeKey.includes('hd') || sizeKey.includes('1792') || sizeKey.includes('1536')) {
    rate *= 1.5
  }
  return roundUsd(rate * Math.max(1, quantity))
}

export function calculateVideoCost(
  model: string,
  durationSeconds?: number | null,
  options?: { hasAudio?: boolean },
): number {
  const rate = matchRate(VIDEO_RATES, model, 0.05)
  const seconds = Math.max(1, Number(durationSeconds) || 5)
  const audioMultiplier = options?.hasAudio ? 1.2 : 1
  return roundUsd(rate * seconds * audioMultiplier)
}

export function calculateGenerationCost(input: LogApiCostInput): number {
  if (input.generationType === 'image') {
    return calculateImageCost(input.model, input.size, input.quantity)
  }
  if (input.generationType === 'video') {
    return calculateVideoCost(input.model, input.durationSeconds, { hasAudio: input.hasAudio })
  }
  return calculateTextCost({
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    inputText: input.inputText || input.prompt,
    outputText: input.outputText,
  })
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function inferProvider(provider: string, model: string): string {
  const value = `${provider} ${model}`.toLowerCase()
  if (value.includes('anthropic') || value.includes('claude')) return 'anthropic'
  if (value.includes('kling')) return 'kling'
  if (value.includes('runway') || value.includes('gen3') || value.includes('gen4')) return 'runway'
  if (value.includes('leonardo')) return 'leonardo'
  if (value.includes('openart') || value.includes('openart')) return 'openart'
  if (value.includes('eleven')) return 'elevenlabs'
  if (value.includes('openai') || value.includes('gpt') || value.includes('dall')) return 'openai'
  return (provider || 'unknown').toLowerCase()
}

export async function logApiCostFromRequest(input: LogApiCostInput): Promise<void> {
  try {
    const userId = input.userId?.trim()
    if (!userId) return

    const admin = getAdminClient()
    if (!admin) return

    const source = resolveCostSource(input.request, input.costSource, input.fallbackSource)
    const model = (input.model || 'unknown').trim() || 'unknown'
    const provider = inferProvider(input.provider || '', model)
    const costUsd = calculateGenerationCost(input)
    const promptPreview = (input.prompt || input.inputText || '').replace(/\s+/g, ' ').trim().slice(0, 400)

    const { error } = await admin.from('api_cost_events').insert({
      user_id: userId,
      source,
      generation_type: input.generationType,
      provider,
      model,
      cost_usd: costUsd,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      duration_seconds: input.durationSeconds ?? null,
      quantity: input.quantity ?? 1,
      prompt_preview: promptPreview || null,
      metadata: input.metadata || {},
    })

    if (error) {
      console.error('[api-cost-tracker] Failed to log cost:', error.message)
    }
  } catch (error) {
    console.error('[api-cost-tracker] Failed to log cost:', error)
  }
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00'
  if (amount > 0 && amount < 0.01) return `$${amount.toFixed(4)}`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function extractOpenAIUsage(data: unknown): { inputTokens?: number; outputTokens?: number } {
  const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number } } | undefined)?.usage
  if (!usage) return {}
  return {
    inputTokens: usage.prompt_tokens ?? usage.input_tokens,
    outputTokens: usage.completion_tokens ?? usage.output_tokens,
  }
}

export function extractAnthropicUsage(data: unknown): { inputTokens?: number; outputTokens?: number } {
  const usage = (data as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined)?.usage
  if (!usage) return {}
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  }
}
