import { describe, expect, it } from 'vitest'
import { findBuiltinCapabilities } from '@/lib/model-capabilities/catalog'
import { resolveGenerationOptionsForModel } from '@/lib/model-capabilities/lookup'

describe('grok2api capability catalog', () => {
  it('exposes openai-compatible image capabilities via provider-key fallback', () => {
    const capabilities = findBuiltinCapabilities('image', 'openai-compatible:oa-1', 'grok-imagine-image-edit')
    const proCapabilities = findBuiltinCapabilities('image', 'openai-compatible:oa-1', 'grok-imagine-image-pro')

    expect(capabilities?.image?.aspectRatioOptions).toEqual([
      '1:1',
      '2:3',
      '3:2',
      '9:16',
      '16:9',
    ])
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

  it('accepts aspect ratio selections for openai-compatible grok image edit models', () => {
    const capabilities = findBuiltinCapabilities('image', 'openai-compatible:oa-1', 'grok-imagine-image-edit')

    const result = resolveGenerationOptionsForModel({
      modelType: 'image',
      modelKey: 'openai-compatible:oa-1::grok-imagine-image-edit',
      capabilities,
      runtimeSelections: {
        aspectRatio: '16:9',
        resolution: '1280x720',
      },
      preferredSelection: {
        aspectRatio: '16:9',
      },
      requireAllFields: true,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({
      aspectRatio: '16:9',
      resolution: '1280x720',
    })
  })

  it('exposes openai-compatible video capabilities via provider-key fallback', () => {
    const capabilities = findBuiltinCapabilities('video', 'openai-compatible:oa-1', 'grok-imagine-video')
    const durations = capabilities?.video?.durationOptions || []

    expect(capabilities?.video?.aspectRatioOptions).toEqual([
      '1:1',
      '2:3',
      '3:2',
      '9:16',
      '16:9',
    ])
    expect(capabilities?.video?.generationModeOptions).toEqual(['normal'])
    expect(capabilities?.video?.resolutionOptions).toEqual(['480p', '720p'])
    expect(durations).toEqual([6, 10, 12, 16, 20])
    expect(capabilities?.video?.firstlastframe).toBe(false)
    expect(capabilities?.video?.supportGenerateAudio).toBe(false)
  })

  it('accepts project video ratios for openai-compatible grok video models', () => {
    const capabilities = findBuiltinCapabilities('video', 'openai-compatible:oa-1', 'grok-imagine-video')

    const result = resolveGenerationOptionsForModel({
      modelType: 'video',
      modelKey: 'openai-compatible:oa-1::grok-imagine-video',
      capabilities,
      runtimeSelections: {
        aspectRatio: '9:16',
        duration: 10,
        generationMode: 'normal',
        resolution: '720p',
      },
      preferredSelection: {
        aspectRatio: '9:16',
      },
      requireAllFields: true,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({
      aspectRatio: '9:16',
      duration: 10,
      generationMode: 'normal',
      resolution: '720p',
    })
  })
})
