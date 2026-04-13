import { parseModelKeyStrict } from '@/lib/model-config-contract'

export const GROK_MULTI_IMAGE_EDIT_INPUT_LIMIT = 3
export const GROK_SINGLE_IMAGE_EDIT_INPUT_LIMIT = 1

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveGrokEditModelId(model: string): string | null {
  const trimmed = readTrimmedString(model)
  if (!trimmed) return null

  const parsed = parseModelKeyStrict(trimmed)
  if (!parsed) return trimmed
  if (parsed.provider !== 'grok') return null
  return parsed.modelId
}

export function resolveGrokEditInputImageLimit(model: string): number | null {
  const modelId = resolveGrokEditModelId(model)
  if (!modelId) return null

  if (modelId === 'grok-imagine-image-pro') {
    return GROK_SINGLE_IMAGE_EDIT_INPUT_LIMIT
  }

  if (modelId === 'grok-imagine-image' || /^grok-imagine-image-\d{4}-\d{2}-\d{2}$/.test(modelId)) {
    return GROK_MULTI_IMAGE_EDIT_INPUT_LIMIT
  }

  // Default to the safest limit for unknown Grok image-edit models.
  return GROK_SINGLE_IMAGE_EDIT_INPUT_LIMIT
}

export function getGrokEditInputImageLimitExceededMessage(model: string, inputImageCount: number): string | null {
  const modelId = resolveGrokEditModelId(model)
  const limit = resolveGrokEditInputImageLimit(model)
  if (!modelId || !limit) return null
  if (inputImageCount <= limit) return null

  const suggestion = modelId === 'grok-imagine-image-pro'
    ? ' Remove extra reference images/uploads, or switch the edit model to grok-imagine-image for multi-image edits.'
    : ''

  return `${modelId} supports at most ${limit} input image(s); received ${inputImageCount}.${suggestion}`
}
