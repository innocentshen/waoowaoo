import { describe, expect, it } from 'vitest'
import { normalizeAnyError } from '@/lib/errors/normalize'

describe('normalize image generation errors', () => {
  it('maps grok multi-reference image limit failures to GENERATION_FAILED', () => {
    const normalized = normalizeAnyError(
      new Error('GROK_IMAGE_REQUEST_FAILED(400): This model supports at most 1 input image(s), but 2 were provided.'),
      { context: 'worker' },
    )

    expect(normalized.code).toBe('GENERATION_FAILED')
  })

  it('maps reference normalization exhaustion to GENERATION_FAILED', () => {
    const normalized = normalizeAnyError(
      new Error('all reference images failed to normalize'),
      { context: 'worker' },
    )

    expect(normalized.code).toBe('GENERATION_FAILED')
  })
})
