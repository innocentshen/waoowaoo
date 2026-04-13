import { describe, expect, it } from 'vitest'
import { findBuiltinCapabilities } from '@/lib/model-capabilities/catalog'

describe('grok2api capability catalog', () => {
  it('exposes openai-compatible image capabilities via provider-key fallback', () => {
    const capabilities = findBuiltinCapabilities('image', 'openai-compatible:oa-1', 'grok-imagine-image-edit')
    const proCapabilities = findBuiltinCapabilities('image', 'openai-compatible:oa-1', 'grok-imagine-image-pro')

    expect(capabilities?.image?.resolutionOptions).toEqual([
      '1024x1024',
      '1280x720',
      '720x1280',
      '1792x1024',
      '1024x1792',
    ])
    expect(proCapabilities?.image?.aspectRatioOptions).toEqual([
      '1:1',
      '2:3',
      '3:2',
      '9:16',
      '16:9',
    ])
    expect(proCapabilities?.image?.resolutionOptions).toEqual([
      '1024x1024',
      '1280x720',
      '720x1280',
      '1792x1024',
      '1024x1792',
    ])
  })

  it('exposes openai-compatible video capabilities via provider-key fallback', () => {
    const capabilities = findBuiltinCapabilities('video', 'openai-compatible:oa-1', 'grok-imagine-video')
    const durations = capabilities?.video?.durationOptions || []

    expect(capabilities?.video?.generationModeOptions).toEqual(['normal'])
    expect(capabilities?.video?.resolutionOptions).toEqual(['480p', '720p'])
    expect(durations).toEqual([6, 10, 12, 16, 20])
    expect(capabilities?.video?.firstlastframe).toBe(false)
    expect(capabilities?.video?.supportGenerateAudio).toBe(false)
  })
})
