import { describe, expect, it } from 'vitest'
import {
  getGrokEditInputImageLimitExceededMessage,
  resolveGrokEditInputImageLimit,
} from '@/lib/providers/grok/edit-input-limit'

describe('grok edit input image limits', () => {
  it('allows multi-image edits for grok-imagine-image', () => {
    expect(resolveGrokEditInputImageLimit('grok::grok-imagine-image')).toBe(3)
    expect(getGrokEditInputImageLimitExceededMessage('grok::grok-imagine-image', 3)).toBeNull()
  })

  it('treats grok-imagine-image-pro as single-image edit only', () => {
    expect(resolveGrokEditInputImageLimit('grok::grok-imagine-image-pro')).toBe(1)
    expect(getGrokEditInputImageLimitExceededMessage('grok::grok-imagine-image-pro', 2))
      .toContain('supports at most 1 input image')
  })

  it('ignores non-grok models', () => {
    expect(resolveGrokEditInputImageLimit('google::imagen-4.0')).toBeNull()
    expect(getGrokEditInputImageLimitExceededMessage('google::imagen-4.0', 5)).toBeNull()
  })
})
