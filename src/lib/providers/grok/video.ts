import type { GenerateResult } from '@/lib/generators/base'
import {
  GROK_DEFAULT_VIDEO_MODEL_ID,
  normalizeGrokEditImageInput,
  normalizeGrokVideoAspectRatio,
  normalizeGrokVideoDuration,
  normalizeGrokImageInput,
  normalizeGrokVideoResolution,
  readGrokErrorMessage,
  readTrimmedString,
  resolveGrokProviderConfig,
} from './shared'
import { setProxy } from '../../../../lib/prompts/proxy'

export interface GrokVideoGenerateParams {
  userId: string
  imageUrl?: string
  videoUrl?: string
  prompt?: string
  referenceImages?: string[]
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

const GROK_VIDEO_REFERENCE_MAX_IMAGES = 7
const GROK_VIDEO_REFERENCE_MAX_DURATION_SECONDS = 10

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
  const parsed = tryParseVideoResponse(raw)
  if (parsed) return parsed
  throw new Error('GROK_VIDEO_RESPONSE_INVALID_JSON')
}

function tryParseVideoResponse(raw: string): GrokVideoCreateResponse | null {
  if (!raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parsed as GrokVideoCreateResponse
  } catch {
    return null
  }
}

function normalizeDuration(value: unknown): number | undefined {
  return normalizeGrokVideoDuration(value)
}

function normalizeAspectRatio(value: unknown): string | undefined {
  return normalizeGrokVideoAspectRatio(value)
}

function normalizeResolution(value: unknown): string | undefined {
  return normalizeGrokVideoResolution(value)
}

function readVideoInput(input: unknown): string | undefined {
  const trimmed = readTrimmedString(input)
  return trimmed || undefined
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
  const videoUrl = readVideoInput(params.videoUrl)
  const rawReferenceImages = params.referenceImages || []
  if (rawReferenceImages.length > GROK_VIDEO_REFERENCE_MAX_IMAGES) {
    throw new Error(`GROK_VIDEO_REFERENCE_LIMIT_EXCEEDED: supports at most ${GROK_VIDEO_REFERENCE_MAX_IMAGES} reference images`)
  }
  const referenceImages = await Promise.all(
    rawReferenceImages.map((image) => normalizeGrokEditImageInput(image)),
  )
  const hasReferenceImages = referenceImages.length > 0

  if (imageUrl && videoUrl) {
    throw new Error('GROK_VIDEO_INPUT_CONFLICT: imageUrl+videoUrl')
  }
  if (imageUrl && hasReferenceImages) {
    throw new Error('GROK_VIDEO_INPUT_CONFLICT: imageUrl+referenceImages')
  }
  if (videoUrl && hasReferenceImages) {
    throw new Error('GROK_VIDEO_INPUT_CONFLICT: videoUrl+referenceImages')
  }

  const requestMode = hasReferenceImages
    ? 'reference'
    : videoUrl
      ? (typeof duration === 'number' ? 'extend' : 'edit')
      : 'normal'

  const body: Record<string, unknown> = {
    model: modelId,
    prompt,
  }

  let endpoint = '/videos/generations'
  if (requestMode === 'normal') {
    if (typeof duration === 'number') body.duration = duration
    if (resolution) body.resolution = resolution
    if (aspectRatio) body.aspect_ratio = aspectRatio
    if (imageUrl) {
      body.image = {
        url: await normalizeGrokImageInput(imageUrl),
      }
    }
  } else if (requestMode === 'reference') {
    if (typeof duration === 'number' && duration > GROK_VIDEO_REFERENCE_MAX_DURATION_SECONDS) {
      throw new Error(`GROK_VIDEO_REFERENCE_DURATION_UNSUPPORTED: ${duration}`)
    }
    if (typeof duration === 'number') body.duration = duration
    if (resolution) body.resolution = resolution
    if (aspectRatio) body.aspect_ratio = aspectRatio
    body.reference_images = referenceImages.map((url) => ({ url }))
  } else if (requestMode === 'edit') {
    if (!videoUrl) {
      throw new Error('GROK_VIDEO_INPUT_REQUIRED: videoUrl')
    }
    if (typeof duration === 'number') {
      throw new Error('GROK_VIDEO_OPTION_UNSUPPORTED: duration')
    }
    if (resolution) {
      throw new Error('GROK_VIDEO_OPTION_UNSUPPORTED: resolution')
    }
    if (aspectRatio) {
      throw new Error('GROK_VIDEO_OPTION_UNSUPPORTED: aspectRatio')
    }
    body.video_url = videoUrl
    endpoint = '/videos/edits'
  } else {
    if (!videoUrl) {
      throw new Error('GROK_VIDEO_INPUT_REQUIRED: videoUrl')
    }
    if (typeof duration !== 'number') {
      throw new Error('GROK_VIDEO_DURATION_REQUIRED')
    }
    if (resolution) {
      throw new Error('GROK_VIDEO_OPTION_UNSUPPORTED: resolution')
    }
    if (aspectRatio) {
      throw new Error('GROK_VIDEO_OPTION_UNSUPPORTED: aspectRatio')
    }
    body.video = { url: videoUrl }
    body.duration = duration
    endpoint = '/videos/extensions'
  }

  await setProxy()

  const requestUrl = `${providerConfig.baseUrl}${endpoint}`
  let response: Response
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`GROK_VIDEO_FETCH_EXCEPTION: POST ${requestUrl} failed: ${message}`)
  }

  const raw = await response.text()
  const payload = tryParseVideoResponse(raw)
  if (!response.ok) {
    throw new Error(`GROK_VIDEO_REQUEST_FAILED(${response.status}): ${readGrokErrorMessage((payload || {}) as Record<string, unknown>, raw)}`)
  }

  const parsedPayload = payload || parseVideoResponse(raw)

  const requestId = readTrimmedString(parsedPayload.request_id)
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

