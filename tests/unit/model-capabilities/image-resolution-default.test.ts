import { describe, expect, it } from 'vitest'
import {
  type CapabilitySelections,
  type ModelCapabilities,
  type UnifiedModelType,
} from '@/lib/model-config-contract'
import { resolveGenerationOptionsForModel } from '@/lib/model-capabilities/lookup'

describe('model-capabilities/lookup - image resolution defaulting', () => {
  const modelType: UnifiedModelType = 'image'
  const modelKey = 'google::test-image-model'

  const capabilities: ModelCapabilities = {
    image: {
      aspectRatioOptions: ['1:1', '16:9'],
      resolutionOptions: ['0.5K', '1K', '2K'],
    },
  }

  it('auto-fills resolution with first option when missing and required', () => {
    const capabilityDefaults: CapabilitySelections = {}

    const result = resolveGenerationOptionsForModel({
      modelType,
      modelKey,
      capabilities,
      capabilityDefaults,
      requireAllFields: true,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({
      aspectRatio: '1:1',
      resolution: '0.5K',
    })
  })

  it('does not override user-provided resolution', () => {
    const capabilityDefaults: CapabilitySelections = {
      [modelKey]: {
        aspectRatio: '16:9',
        resolution: '2K',
      },
    }

    const result = resolveGenerationOptionsForModel({
      modelType,
      modelKey,
      capabilities,
      capabilityDefaults,
      requireAllFields: true,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({
      aspectRatio: '16:9',
      resolution: '2K',
    })
  })
})

