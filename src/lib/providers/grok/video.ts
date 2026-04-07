import type { GenerateResult } from '@/lib/generators/base'
import {
  GROK_DEFAULT_VIDEO_MODEL_ID,
  normalizeGrokImageInput,
  readGrokErrorMessage,
  readTrimmedString,
  resolveGrokProviderConfig,
} from './shared'

export interface GrokVideoGenerateParams {
  userId: string
  imageUrl: string
  prompt?: string
  options: Record<string, unknown> & {
    provider: string
    modelId: string
    modelKey?: string
  }
}

interface GrokVideoCreateResponse {
  request_id?: string
  error?: { message?: string } | string
  message?: string
}

const GROK_VIDEO_OPTION_KEYS = new Set([
  'provider',
  'modelId',
  'modelKey',
  'prompt',
  'duration',
  'resolution',
  'aspectRatio',
  'generateAudio',
  'fps',
  'lastFrameImageUrl',
])

function assertAllowedOptions(options: Record<string, unknown>) {
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue
    if (!GROK_VIDEO_OPTION_KEYS.has(key)) {
      throw new Error(`GROK_VIDEO_OPTION_UNSUPPORTED: ${key}`)
    }
  }
}

function parseVideoResponse(raw: string): GrokVideoCreateResponse {
  if (!raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('GROK_VIDEO_RESPONSE_INVALID')
    }
    return parsed as GrokVideoCreateResponse
  } catch {
    throw new Error('GROK_VIDEO_RESPONSE_INVALID_JSON')
  }
}

function normalizeDuration(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`GROK_VIDEO_DURATION_INVALID: ${String(value)}`)
  }
  return Math.round(value)
}

function normalizeAspectRatio(value: unknown): string | undefined {
  const aspectRatio = readTrimmedString(value)
  return aspectRatio || undefined
}

function normalizeResolution(value: unknown): string | undefined {
  const resolution = readTrimmedString(value)
  return resolution ? resolution.toLowerCase() : undefined
}

export async function generateGrokVideo(params: GrokVideoGenerateParams): Promise<GenerateResult> {
  assertAllowedOptions(params.options)

  const prompt = readTrimmedString(params.prompt) || readTrimmedString(params.options.prompt)
  if (!prompt) {
    throw new Error('GROK_VIDEO_PROMPT_REQUIRED')
  }

  const lastFrameImageUrl = readTrimmedString(params.options.lastFrameImageUrl)
  if (lastFrameImageUrl) {
    throw new Error('GROK_VIDEO_OPTION_UNSUPPORTED: lastFrameImageUrl')
  }

  const providerConfig = await resolveGrokProviderConfig(params.userId, params.options.provider)
  const modelId = readTrimmedString(params.options.modelId) || GROK_DEFAULT_VIDEO_MODEL_ID
  const duration = normalizeDuration(params.options.duration)
  const resolution = normalizeResolution(params.options.resolution)
  const aspectRatio = normalizeAspectRatio(params.options.aspectRatio)
  const imageUrl = readTrimmedString(params.imageUrl)

  const body: Record<string, unknown> = {
    model: modelId,
    prompt,
  }
  if (typeof duration === 'number') body.duration = duration
  if (resolution) body.resolution = resolution
  if (aspectRatio) body.aspect_ratio = aspectRatio
  if (imageUrl) {
    body.image = {
      url: await normalizeGrokImageInput(imageUrl),
    }
  }

  const response = await fetch(`${providerConfig.baseUrl}/videos/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const raw = await response.text()
  const payload = parseVideoResponse(raw)
  if (!response.ok) {
    throw new Error(`GROK_VIDEO_REQUEST_FAILED(${response.status}): ${readGrokErrorMessage(payload as Record<string, unknown>, raw)}`)
  }

  const requestId = readTrimmedString(payload.request_id)
  if (!requestId) {
    throw new Error('GROK_VIDEO_REQUEST_ID_MISSING')
  }

  return {
    success: true,
    async: true,
    requestId,
    externalId: `GROK:VIDEO:${requestId}`,
  }
}

