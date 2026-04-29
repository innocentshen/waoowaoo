import type { GenerateResult } from '@/lib/generators/base'
import type { OpenAICompatImageRequest } from '../types'
import {
  buildRenderedTemplateRequest,
  buildTemplateVariables,
  extractTemplateError,
  normalizeResponseJson,
  readJsonPath,
} from '@/lib/openai-compat-template-runtime'
import { parseModelKeyStrict } from '@/lib/model-config-contract'
import { createScopedLogger } from '@/lib/logging/core'
import { resolveOpenAICompatClientConfig } from './common'

const OPENAI_COMPAT_PROVIDER_PREFIX = 'openai-compatible:'
const PROVIDER_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const logger = createScopedLogger({
  module: 'model-gateway.openai-compat.image',
  action: 'image.template.generate',
})

function encodeProviderToken(providerId: string): string {
  const value = providerId.trim()
  if (value.startsWith(OPENAI_COMPAT_PROVIDER_PREFIX)) {
    const uuid = value.slice(OPENAI_COMPAT_PROVIDER_PREFIX.length).trim()
    if (PROVIDER_UUID_PATTERN.test(uuid)) {
      return `u_${uuid.toLowerCase()}`
    }
  }
  return `b64_${Buffer.from(value, 'utf8').toString('base64url')}`
}

function encodeModelRef(modelRef: string): string {
  return Buffer.from(modelRef, 'utf8').toString('base64url')
}

function resolveModelRef(request: OpenAICompatImageRequest): string {
  const modelId = typeof request.modelId === 'string' ? request.modelId.trim() : ''
  if (modelId) return modelId
  const parsed = typeof request.modelKey === 'string' ? parseModelKeyStrict(request.modelKey) : null
  if (parsed?.modelId) return parsed.modelId
  throw new Error('OPENAI_COMPAT_IMAGE_MODEL_REF_REQUIRED')
}

function readTemplateOutputUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const urls: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      urls.push(item.trim())
      continue
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const url = (item as { url?: unknown }).url
    if (typeof url === 'string' && url.trim()) {
      urls.push(url.trim())
    }
  }
  return urls
}

function readTemplateOutputBase64List(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const b64 = (item as { b64_json?: unknown }).b64_json
    if (typeof b64 === 'string' && b64.trim()) {
      items.push(b64.trim())
    }
  }
  return items
}

function toMimeFromOutputFormat(outputFormat: unknown): string {
  if (outputFormat === 'jpeg' || outputFormat === 'jpg') return 'image/jpeg'
  if (outputFormat === 'webp') return 'image/webp'
  return 'image/png'
}

function readFirstStringByPaths(payload: unknown, paths: string[]): string {
  for (const path of paths) {
    const value = readJsonPath(payload, path)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function readTemplateTaskId(payload: unknown, configuredPath: string | undefined): string {
  const configuredValue = readJsonPath(payload, configuredPath)
  if (typeof configuredValue === 'string' && configuredValue.trim()) {
    return configuredValue.trim()
  }

  return readFirstStringByPaths(payload, [
    '$.id',
    '$.task_id',
    '$.taskId',
    '$.data[0].task_id',
    '$.data[0].taskId',
    '$.data[0].id',
    '$.data.task_id',
    '$.data.taskId',
    '$.data.id',
    '$.result.task_id',
    '$.result.taskId',
    '$.result.id',
    '$.task.id',
  ])
}

function readBusinessCode(payload: unknown): string {
  const code = readJsonPath(payload, '$.code')
  if (typeof code === 'number' && Number.isFinite(code)) return String(code)
  if (typeof code === 'string' && code.trim()) return code.trim()
  return ''
}

function looksLikeHttpUrl(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return false
  if (normalized.startsWith('data:image/')) return true
  return /^https?:\/\//i.test(normalized)
}

function looksLikeImageUrl(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return false
  if (normalized.startsWith('data:image/')) return true
  if (!/^https?:\/\//i.test(normalized)) return false
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(normalized)
}

function readFirstImageUrlDeep(payload: unknown): string {
  const URL_KEYS = ['url', 'image_url', 'imageUrl', 'output_url', 'outputUrl', 'origin_image_url'] as const
  const queue: unknown[] = [payload]
  const visited = new Set<object>()
  let scanned = 0
  let firstHttpCandidate = ''

  while (queue.length > 0 && scanned < 300) {
    const current = queue.shift()
    scanned += 1
    if (typeof current === 'string') {
      if (looksLikeImageUrl(current)) return current.trim()
      continue
    }
    if (!current || typeof current !== 'object') continue
    if (visited.has(current)) continue
    visited.add(current)
    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }
    const record = current as Record<string, unknown>
    for (const key of URL_KEYS) {
      const value = record[key]
      if (typeof value !== 'string') continue
      if (looksLikeImageUrl(value)) return value.trim()
      if (!firstHttpCandidate && looksLikeHttpUrl(value)) {
        firstHttpCandidate = value.trim()
      }
    }
    queue.push(...Object.values(record))
  }

  return firstHttpCandidate
}

function createTemplateOutputNotFoundError(): Error {
  return Object.assign(new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_OUTPUT_NOT_FOUND'), {
    code: 'EXTERNAL_ERROR',
  })
}

function summarizeResponseShape(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { type: typeof payload }
  }
  const root = payload as Record<string, unknown>
  const firstData = Array.isArray(root.data) ? root.data[0] : undefined
  const firstOutput = Array.isArray(root.output) ? root.output[0] : undefined
  return {
    topLevelKeys: Object.keys(root).slice(0, 20),
    dataLength: Array.isArray(root.data) ? root.data.length : null,
    dataItemKeys: firstData && typeof firstData === 'object' && !Array.isArray(firstData)
      ? Object.keys(firstData as Record<string, unknown>).slice(0, 20)
      : null,
    outputLength: Array.isArray(root.output) ? root.output.length : null,
    outputItemKeys: firstOutput && typeof firstOutput === 'object' && !Array.isArray(firstOutput)
      ? Object.keys(firstOutput as Record<string, unknown>).slice(0, 20)
      : null,
  }
}

export async function generateImageViaOpenAICompatTemplate(
  request: OpenAICompatImageRequest,
): Promise<GenerateResult> {
  if (!request.template) {
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_REQUIRED')
  }
  if (request.template.mediaType !== 'image') {
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_MEDIA_TYPE_INVALID')
  }

  const config = await resolveOpenAICompatClientConfig(request.userId, request.providerId)
  const firstReference = Array.isArray(request.referenceImages) && request.referenceImages.length > 0
    ? request.referenceImages[0]
    : ''
  const variables = buildTemplateVariables({
    model: request.modelId || 'gpt-image-1',
    prompt: request.prompt,
    image: firstReference,
    images: request.referenceImages || [],
    aspectRatio: typeof request.options?.aspectRatio === 'string' ? request.options.aspectRatio : undefined,
    resolution: typeof request.options?.resolution === 'string' ? request.options.resolution : undefined,
    size: typeof request.options?.size === 'string' ? request.options.size : undefined,
    extra: request.options,
  })

  const createRequest = await buildRenderedTemplateRequest({
    baseUrl: config.baseUrl,
    endpoint: request.template.create,
    variables,
    defaultAuthHeader: `Bearer ${config.apiKey}`,
  })
  if (['POST', 'PUT', 'PATCH'].includes(createRequest.method) && !createRequest.body) {
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_CREATE_BODY_REQUIRED')
  }
  const response = await fetch(createRequest.endpointUrl, {
    method: createRequest.method,
    headers: createRequest.headers,
    ...(createRequest.body ? { body: createRequest.body } : {}),
  })
  const rawText = await response.text().catch(() => '')
  const payload = normalizeResponseJson(rawText)
  if (!response.ok) {
    throw new Error(extractTemplateError(request.template, payload, response.status))
  }

  if (request.template.mode === 'sync') {
    const outputList = readJsonPath(payload, request.template.response.outputUrlsPath)
    const outputUrls = readTemplateOutputUrls(
      outputList,
    )
    if (outputUrls.length > 0) {
      const first = outputUrls[0]
      return {
        success: true,
        imageUrl: first,
        ...(outputUrls.length > 1 ? { imageUrls: outputUrls } : {}),
      }
    }

    const outputBase64List = readTemplateOutputBase64List(outputList)
    if (outputBase64List.length > 0) {
      const imageBase64 = outputBase64List[0]
      const mimeType = toMimeFromOutputFormat(request.options?.outputFormat)
      return {
        success: true,
        imageBase64,
        imageUrl: `data:${mimeType};base64,${imageBase64}`,
      }
    }

    const outputUrl = readJsonPath(payload, request.template.response.outputUrlPath)
    if (typeof outputUrl === 'string' && outputUrl.trim().length > 0) {
      return {
        success: true,
        imageUrl: outputUrl.trim(),
      }
    }

    const outputBase64 = readJsonPath(payload, '$.data[0].b64_json')
    if (typeof outputBase64 === 'string' && outputBase64.trim().length > 0) {
      const imageBase64 = outputBase64.trim()
      const mimeType = toMimeFromOutputFormat(request.options?.outputFormat)
      return {
        success: true,
        imageBase64,
        imageUrl: `data:${mimeType};base64,${imageBase64}`,
      }
    }

    const fallbackUrl = readFirstStringByPaths(payload, [
      '$.data[0].image_url',
      '$.data[0].url',
      '$.data.url',
      '$.data.image_url',
      '$.data.imageUrl',
      '$.output[0].url',
      '$.output[0].result',
      '$.output.url',
      '$.output.image_url',
      '$.result.url',
      '$.result.image_url',
      '$.result[0].url',
      '$.result[0].image_url',
      '$.images[0].url',
      '$.images[0].image_url',
      '$.image.url',
      '$.image.image_url',
      '$.output_url',
      '$.outputUrl',
      '$.url',
      '$.image_url',
      '$.imageUrl',
    ])
    if (fallbackUrl) {
      return {
        success: true,
        imageUrl: fallbackUrl,
      }
    }

    const deepFallbackUrl = readFirstImageUrlDeep(payload)
    if (deepFallbackUrl) {
      return {
        success: true,
        imageUrl: deepFallbackUrl,
      }
    }

    const fallbackBase64 = readFirstStringByPaths(payload, [
      '$.data[0].b64_json',
      '$.data.b64_json',
      '$.output[0].b64_json',
      '$.result.b64_json',
      '$.result[0].b64_json',
      '$.images[0].b64_json',
      '$.b64_json',
    ])
    if (fallbackBase64) {
      const mimeType = toMimeFromOutputFormat(request.options?.outputFormat)
      return {
        success: true,
        imageBase64: fallbackBase64,
        imageUrl: `data:${mimeType};base64,${fallbackBase64}`,
      }
    }

    logger.warn({
      message: 'openai compatible image template output not found',
      details: {
        providerId: request.providerId,
        modelId: request.modelId,
        modelKey: request.modelKey,
        outputUrlPath: request.template.response.outputUrlPath,
        outputUrlsPath: request.template.response.outputUrlsPath,
        responseShape: summarizeResponseShape(payload),
        rawSnippet: typeof payload === 'string'
          ? payload.slice(0, 500)
          : JSON.stringify(payload)?.slice(0, 500),
      },
    })
    throw createTemplateOutputNotFoundError()
  }

  const taskId = readTemplateTaskId(payload, request.template.response.taskIdPath)
  if (!taskId) {
    const businessCode = readBusinessCode(payload)
    if (businessCode && businessCode !== '0' && businessCode !== '200') {
      throw new Error(extractTemplateError(request.template, payload, response.status))
    }
    logger.warn({
      message: 'openai compatible image template task id not found',
      details: {
        providerId: request.providerId,
        modelId: request.modelId,
        modelKey: request.modelKey,
        taskIdPath: request.template.response.taskIdPath,
        responseShape: summarizeResponseShape(payload),
        rawSnippet: typeof payload === 'string'
          ? payload.slice(0, 500)
          : JSON.stringify(payload)?.slice(0, 500),
      },
    })
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_TASK_ID_NOT_FOUND')
  }
  const providerToken = encodeProviderToken(config.providerId)
  const modelRefToken = encodeModelRef(resolveModelRef(request))
  return {
    success: true,
    async: true,
    requestId: taskId,
    externalId: `OCOMPAT:IMAGE:${providerToken}:${modelRefToken}:${taskId}`,
  }
}
