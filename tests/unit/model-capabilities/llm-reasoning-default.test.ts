import { describe, expect, it } from 'vitest'
import type { ModelCapabilities, UnifiedModelType } from '@/lib/model-config-contract'
import { resolveGenerationOptionsForModel } from '@/lib/model-capabilities/lookup'

describe('model-capabilities/lookup - llm reasoning defaulting', () => {
  const modelType: UnifiedModelType = 'llm'
  const modelKey = 'openai-compatible::gpt-5.4'

  const capabilities: ModelCapabilities = {
    llm: {
      reasoningEffortOptions: ['low', 'medium', 'high', 'xhigh'],
    },
  }

  it('auto-fills GPT-5.4 reasoning effort with medium when missing', () => {
    const result = resolveGenerationOptionsForModel({
      modelType,
      modelKey,
      capabilities,
      capabilityDefaults: {},
      requireAllFields: false,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({
      reasoningEffort: 'medium',
    })
  })

  it('reuses canonical Gemini capability overrides for gemini-compatible gcp model ids', () => {
    const result = resolveGenerationOptionsForModel({
      modelType,
      modelKey: 'gemini-compatible:provider-1::gemini-3.1-pro-preview-gcp',
      capabilities: {
        llm: {
          reasoningEffortOptions: ['low', 'medium', 'high'],
        },
      },
      capabilityOverrides: {
        'gemini-compatible:provider-1::gemini-3.1-pro-preview': {
          reasoningEffort: 'low',
        },
      },
      requireAllFields: false,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({
      reasoningEffort: 'low',
    })
  })
})
