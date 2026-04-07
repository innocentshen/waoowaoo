import type { GenerateResult } from '@/lib/generators/base'
import {
  GROK_DEFAULT_IMAGE_MODEL_ID,
  guessImageMimeTypeFromBase64,
  normalizeGrokImageInput,
  normalizeGrokResponseFormat,
  readGrokErrorMessage,
  readTrimmedString,
  resolveGrokProviderConfig,
} from './shared'

export interface GrokImageGenerateParams {
  userId: string
  prompt: string
  referenceImages?: string[]
  options: Record<string, unknown> & {
    provider: string
    modelId: string
    modelKey?: string
  }
}

interface GrokImageItem {
  url?: string
  b64_json?: string
}

interface GrokImageResponse {
  data?: GrokImageItem[]
  error?: { message?: string } | string
  message?: string
}

const GROK_IMAGE_OPTION_KEYS = new Set([
  'provider',
  'modelId',
  'modelKey',
  'aspectRatio',
  'resolution',
  'responseFormat',
  'outputFormat',
  'keepOriginalAspectRatio',
])

function assertAllowedOptions(options: Record<string, unknown>) {
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue
    if (!GROK_IMAGE_OPTION_KEYS.has(key)) {
      throw new Error(`GROK_IMAGE_OPTION_UNSUPPORTED: ${key}`)
    }
  }
}

function parseImageResponse(raw: string): GrokImageResponse {
  if (!raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('GROK_IMAGE_RESPONSE_INVALID')
    }
    return parsed as GrokImageResponse
  } catch {
    throw new Error('GROK_IMAGE_RESPONSE_INVALID_JSON')
  }
}

function normalizeAspectRatio(value: unknown): string | undefined {
  const aspectRatio = readTrimmedString(value)
  return aspectRatio || undefined
}

function normalizeResolution(value: unknown): string | undefined {
  const resolution = readTrimmedString(value)
  return resolution ? resolution.toLowerCase() : undefined
}

function buildImageResult(payload: GrokImageResponse): GenerateResult {
  const items = Array.isArray(payload.data) ? payload.data : []
  const base64Images = items
    .map((item) => (typeof item?.b64_json === 'string' ? item.b64_json.trim() : ''))
    .filter(Boolean)
  if (base64Images.length > 0) {
    const imageUrls = base64Images.map((base64) => `data:${guessImageMimeTypeFromBase64(base64)};base64,${base64}`)
    return {
      success: true,
      imageBase64: base64Images[0],
      imageUrl: imageUrls[0],
      ...(imageUrls.length > 1 ? { imageUrls } : {}),
    }
  }

  const urls = items
    .map((item) => (typeof item?.url === 'string' ? item.url.trim() : ''))
    .filter(Boolean)
  if (urls.length > 0) {
    return {
      success: true,
      imageUrl: urls[0],
      ...(urls.length > 1 ? { imageUrls: urls } : {}),
    }
  }

  throw new Error('GROK_IMAGE_EMPTY_RESPONSE')
}

export async function generateGrokImage(params: GrokImageGenerateParams): Promise<GenerateResult> {
  assertAllowedOptions(params.options)

  const prompt = readTrimmedString(params.prompt)
  if (!prompt) {
    throw new Error('GROK_IMAGE_PROMPT_REQUIRED')
  }

  const providerConfig = await resolveGrokProviderConfig(params.userId, params.options.provider)
  const modelId = readTrimmedString(params.options.modelId) || GROK_DEFAULT_IMAGE_MODEL_ID
  const responseFormat = normalizeGrokResponseFormat(params.options.responseFormat)
  const aspectRatio = normalizeAspectRatio(params.options.aspectRatio)
  const resolution = normalizeResolution(params.options.resolution)
  const normalizedReferences = await Promise.all(
    (params.referenceImages || []).map((image) => normalizeGrokImageInput(image)),
  )

  const endpoint = normalizedReferences.length > 0 ? '/images/edits' : '/images/generations'
  const body: Record<string, unknown> = {
    model: modelId,
    prompt,
    response_format: responseFormat,
  }
  if (aspectRatio) body.aspect_ratio = aspectRatio
  if (resolution) body.resolution = resolution
  if (normalizedReferences.length === 1) {
    body.image = {
      type: 'image_url',
      url: normalizedReferences[0],
    }
  } else if (normalizedReferences.length > 1) {
    body.images = normalizedReferences.map((url) => ({
      type: 'image_url',
      url,
    }))
  }

  const response = await fetch(`${providerConfig.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const raw = await response.text()
  const payload = parseImageResponse(raw)
  if (!response.ok) {
    throw new Error(`GROK_IMAGE_REQUEST_FAILED(${response.status}): ${readGrokErrorMessage(payload as Record<string, unknown>, raw)}`)
  }

  return buildImageResult(payload)
}

