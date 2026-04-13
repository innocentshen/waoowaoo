import { getProviderConfig } from '@/lib/api-config'
import { normalizeToBase64ForGeneration, normalizeToOriginalMediaUrl } from '@/lib/media/outbound-image'

export const GROK_API_BASE_URL = 'https://api.x.ai/v1'
export const GROK_DEFAULT_IMAGE_MODEL_ID = 'grok-imagine-image'
export const GROK_DEFAULT_VIDEO_MODEL_ID = 'grok-imagine-video'
export const GROK_SUPPORTED_IMAGE_RESOLUTIONS = ['1k', '2k'] as const
export const GROK_SUPPORTED_IMAGE_ASPECT_RATIOS = [
  'auto',
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '2:1',
  '1:2',
  '19.5:9',
  '9:19.5',
  '20:9',
  '9:20',
] as const
export const GROK_SUPPORTED_VIDEO_ASPECT_RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
] as const
export const GROK_SUPPORTED_VIDEO_RESOLUTIONS = ['480p', '720p'] as const
export const GROK_VIDEO_DURATION_MIN_SECONDS = 1
export const GROK_VIDEO_DURATION_MAX_SECONDS = 15
export const GROK_VIDEO_EDIT_MAX_SOURCE_DURATION_SECONDS = 8.7

export function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeGrokBaseUrl(baseUrl?: string): string {
  const resolved = readTrimmedString(baseUrl) || GROK_API_BASE_URL
  return resolved.replace(/\/+$/, '')
}

export async function resolveGrokProviderConfig(userId: string, providerId: string) {
  const config = await getProviderConfig(userId, providerId)
  return {
    ...config,
    baseUrl: normalizeGrokBaseUrl(config.baseUrl),
  }
}

export async function normalizeGrokImageInput(input: string): Promise<string> {
  const trimmed = readTrimmedString(input)
  if (!trimmed) {
    throw new Error('GROK_IMAGE_INPUT_REQUIRED')
  }
  if (trimmed.startsWith('data:')) return trimmed
  return await normalizeToBase64ForGeneration(trimmed)
}

export async function normalizeGrokEditImageInput(input: string): Promise<string> {
  const trimmed = readTrimmedString(input)
  if (!trimmed) {
    throw new Error('GROK_IMAGE_INPUT_REQUIRED')
  }
  if (trimmed.startsWith('data:')) return trimmed
  return await normalizeToOriginalMediaUrl(trimmed)
}

export function normalizeGrokImageResolution(
  value: unknown,
): typeof GROK_SUPPORTED_IMAGE_RESOLUTIONS[number] | undefined {
  const normalized = readTrimmedString(value).toLowerCase()
  if (!normalized) return undefined
  if ((GROK_SUPPORTED_IMAGE_RESOLUTIONS as readonly string[]).includes(normalized)) {
    return normalized as typeof GROK_SUPPORTED_IMAGE_RESOLUTIONS[number]
  }
  throw new Error(`GROK_IMAGE_RESOLUTION_UNSUPPORTED: ${normalized}`)
}

export function normalizeGrokImageAspectRatio(
  value: unknown,
): typeof GROK_SUPPORTED_IMAGE_ASPECT_RATIOS[number] | undefined {
  const normalized = readTrimmedString(value)
  if (!normalized) return undefined
  if ((GROK_SUPPORTED_IMAGE_ASPECT_RATIOS as readonly string[]).includes(normalized)) {
    return normalized as typeof GROK_SUPPORTED_IMAGE_ASPECT_RATIOS[number]
  }
  throw new Error(`GROK_IMAGE_ASPECT_RATIO_UNSUPPORTED: ${normalized}`)
}

export function normalizeGrokVideoAspectRatio(
  value: unknown,
): typeof GROK_SUPPORTED_VIDEO_ASPECT_RATIOS[number] | undefined {
  const normalized = readTrimmedString(value)
  if (!normalized) return undefined
  if ((GROK_SUPPORTED_VIDEO_ASPECT_RATIOS as readonly string[]).includes(normalized)) {
    return normalized as typeof GROK_SUPPORTED_VIDEO_ASPECT_RATIOS[number]
  }
  throw new Error(`GROK_VIDEO_ASPECT_RATIO_UNSUPPORTED: ${normalized}`)
}

export function normalizeGrokVideoResolution(
  value: unknown,
): typeof GROK_SUPPORTED_VIDEO_RESOLUTIONS[number] | undefined {
  const normalized = readTrimmedString(value).toLowerCase()
  if (!normalized) return undefined
  if ((GROK_SUPPORTED_VIDEO_RESOLUTIONS as readonly string[]).includes(normalized)) {
    return normalized as typeof GROK_SUPPORTED_VIDEO_RESOLUTIONS[number]
  }
  throw new Error(`GROK_VIDEO_RESOLUTION_UNSUPPORTED: ${normalized}`)
}

export function normalizeGrokVideoDuration(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`GROK_VIDEO_DURATION_INVALID: ${String(value)}`)
  }
  const normalized = Math.round(value)
  if (normalized < GROK_VIDEO_DURATION_MIN_SECONDS || normalized > GROK_VIDEO_DURATION_MAX_SECONDS) {
    throw new Error(`GROK_VIDEO_DURATION_UNSUPPORTED: ${normalized}`)
  }
  return normalized
}

export function normalizeGrokResponseFormat(value: unknown): 'url' | 'b64_json' {
  const normalized = readTrimmedString(value)
  if (!normalized) return 'b64_json'
  if (normalized === 'url' || normalized === 'b64_json') return normalized
  throw new Error(`GROK_IMAGE_RESPONSE_FORMAT_UNSUPPORTED: ${normalized}`)
}

export function readGrokErrorMessage(payload: Record<string, unknown> | null, fallbackRaw: string): string {
  const error = payload?.error
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  const message = payload?.message
  if (typeof message === 'string' && message.trim()) return message.trim()
  return fallbackRaw.trim() || 'unknown error'
}

function detectImageMimeFromBytes(buffer: Buffer): string | null {
  if (buffer.length >= 8) {
    const isPng =
      buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a
    if (isPng) return 'image/png'
  }

  if (buffer.length >= 3) {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    if (isJpeg) return 'image/jpeg'
  }

  if (buffer.length >= 12) {
    const isWebp =
      buffer[0] === 0x52
      && buffer[1] === 0x49
      && buffer[2] === 0x46
      && buffer[3] === 0x46
      && buffer[8] === 0x57
      && buffer[9] === 0x45
      && buffer[10] === 0x42
      && buffer[11] === 0x50
    if (isWebp) return 'image/webp'
  }

  return null
}

export function guessImageMimeTypeFromBase64(base64: string): string {
  try {
    const bytes = Buffer.from(base64, 'base64')
    return detectImageMimeFromBytes(bytes) || 'image/jpeg'
  } catch {
    return 'image/jpeg'
  }
}
