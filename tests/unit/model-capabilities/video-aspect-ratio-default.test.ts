import { describe, expect, it } from 'vitest'
import {
  type ModelCapabilities,
  type UnifiedModelType,
} from '@/lib/model-config-contract'
import { resolveGenerationOptionsForModel } from '@/lib/model-capabilities/lookup'

describe('model-capabilities/lookup - video aspect ratio defaulting', () => {
  const modelType: UnifiedModelType = 'video'
  const modelKey = 'ark::test-video-model'

  const capabilities: ModelCapabilities = {
    video: {
      aspectRatioOptions: ['1:1', '16:9', '9:16'],
      resolutionOptions: ['720p'],
    },
  }

  it('prefers the project video ratio over the first catalog option', () => {
    const result = resolveGenerationOptionsForModel({
      modelType,
      modelKey,
      capabilities,
      runtimeSelections: {
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
      resolution: '720p',
    })
  })
})
