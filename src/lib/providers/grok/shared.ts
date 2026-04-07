import { getProviderConfig } from '@/lib/api-config'
import { normalizeToBase64ForGeneration } from '@/lib/media/outbound-image'

export const GROK_API_BASE_URL = 'https://api.x.ai/v1'
export const GROK_DEFAULT_IMAGE_MODEL_ID = 'grok-imagine-image'
export const GROK_DEFAULT_VIDEO_MODEL_ID = 'grok-imagine-video'

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

