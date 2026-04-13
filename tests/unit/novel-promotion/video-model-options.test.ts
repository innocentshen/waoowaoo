import { describe, expect, it } from 'vitest'
import {
  filterVideoModelOptionsByGenerationMode,
  filterNormalVideoModelOptions,
  isFirstLastFrameOnlyModel,
  supportsVideoGenerationMode,
  supportsFirstLastFrame,
} from '@/lib/model-capabilities/video-model-options'
import type { VideoModelOption } from '@/lib/novel-promotion/stages/video-stage-runtime/types'

describe('video model options partition', () => {
  const models: VideoModelOption[] = [
    {
      value: 'p::normal',
      label: 'normal',
      capabilities: {
        video: {
          generationModeOptions: ['normal'],
          firstlastframe: false,
        },
      },
    },
    {
      value: 'p::firstlast-only',
      label: 'firstlast-only',
      capabilities: {
        video: {
          generationModeOptions: ['firstlastframe'],
          firstlastframe: true,
        },
      },
    },
    {
      value: 'p::both',
      label: 'both',
      capabilities: {
        video: {
          generationModeOptions: ['normal', 'firstlastframe', 'edit'],
          firstlastframe: true,
        },
      },
    },
    {
      value: 'p::extend-only',
      label: 'extend-only',
      capabilities: {
        video: {
          generationModeOptions: ['extend'],
          firstlastframe: false,
        },
      },
    },
    {
      value: 'p::custom-no-capability',
      label: 'custom-no-capability',
    },
  ]

  it('detects firstlastframe support and firstlastframe-only capability', () => {
    expect(supportsFirstLastFrame(models[0])).toBe(false)
    expect(supportsFirstLastFrame(models[1])).toBe(true)
    expect(supportsFirstLastFrame(models[2])).toBe(true)
    expect(supportsFirstLastFrame(models[3])).toBe(false)

    expect(isFirstLastFrameOnlyModel(models[0])).toBe(false)
    expect(isFirstLastFrameOnlyModel(models[1])).toBe(true)
    expect(isFirstLastFrameOnlyModel(models[2])).toBe(false)
    expect(isFirstLastFrameOnlyModel(models[3])).toBe(false)
  })

  it('filters out firstlastframe-only models from normal video model list', () => {
    const normalModels = filterNormalVideoModelOptions(models)
    expect(normalModels.map((item) => item.value)).toEqual([
      'p::normal',
      'p::both',
      'p::custom-no-capability',
    ])
  })

  it('filters video models by explicit generation mode support', () => {
    expect(supportsVideoGenerationMode(models[2], 'edit')).toBe(true)
    expect(supportsVideoGenerationMode(models[3], 'extend')).toBe(true)
    expect(supportsVideoGenerationMode(models[3], 'normal')).toBe(false)

    expect(filterVideoModelOptionsByGenerationMode(models, 'edit').map((item) => item.value)).toEqual([
      'p::both',
    ])
    expect(filterVideoModelOptionsByGenerationMode(models, 'extend').map((item) => item.value)).toEqual([
      'p::extend-only',
    ])
  })
})
