import { createScopedLogger } from '@/lib/logging/core'

type GrokMediaType = 'image' | 'video'

const MEDIA_VALUE_KEYS = new Set(['url', 'video_url'])

const logger = createScopedLogger({
  module: 'provider.grok',
  provider: 'grok',
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function summarizeGrokMediaValue(value: unknown): unknown {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed) {
    return { type: 'empty' }
  }

  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',')
    const header = commaIndex >= 0 ? trimmed.slice(0, commaIndex) : trimmed.slice(0, 96)
    const mimeMatch = /^data:([^;,]+)/.exec(header)
    return {
      type: 'data-uri',
      mime: mimeMatch?.[1] || null,
      base64: /;base64(?:,|$)/i.test(header),
      length: trimmed.length,
      preview: `${trimmed.slice(0, Math.min(trimmed.length, 72))}${trimmed.length > 72 ? '...' : ''}`,
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed)
      return {
        type: 'url',
        origin: parsed.origin,
        pathname: parsed.pathname,
        hasQuery: parsed.search.length > 0,
        query: parsed.search.length > 0 ? '[REDACTED]' : '',
        length: trimmed.length,
      }
    } catch {
      return {
        type: 'url',
        value: `${trimmed.slice(0, Math.min(trimmed.length, 96))}${trimmed.length > 96 ? '...' : ''}`,
        length: trimmed.length,
      }
    }
  }

  return {
    type: 'storage-key',
    value: trimmed,
    length: trimmed.length,
  }
}

function sanitizeGrokRequestBodyForLog(value: unknown, key?: string): unknown {
  if (typeof value === 'string' && key && MEDIA_VALUE_KEYS.has(key)) {
    return summarizeGrokMediaValue(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGrokRequestBodyForLog(item))
  }

  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {}
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      output[nestedKey] = sanitizeGrokRequestBodyForLog(nestedValue, nestedKey)
    }
    return output
  }

  return value
}

export function logGrokProviderRequest(params: {
  mediaType: GrokMediaType
  requestUrl: string
  endpoint: string
  requestMode?: string
  body: Record<string, unknown>
  sourceInputs?: Record<string, unknown>
}) {
  logger.info({
    audit: true,
    action: `provider.grok.${params.mediaType}.request`,
    message: `grok ${params.mediaType} request body`,
    details: {
      endpoint: params.endpoint,
      requestUrl: params.requestUrl,
      requestMode: params.requestMode,
      sourceInputs: params.sourceInputs,
      body: sanitizeGrokRequestBodyForLog(params.body),
    },
  })
}
