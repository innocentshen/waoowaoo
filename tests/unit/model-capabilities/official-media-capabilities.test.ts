import { describe, expect, it } from 'vitest'
import { findBuiltinCapabilities } from '@/lib/model-capabilities/catalog'

describe('official media capability catalog', () => {
  it('exposes curated common Google image ratios plus Imagen image sizes', () => {
    const geminiCaps = findBuiltinCapabilities('image', 'google', 'gemini-3.1-flash-image-preview')
    const imagenCaps = findBuiltinCapabilities('image', 'google', 'imagen-4.0-generate-001')

    expect(geminiCaps?.image?.aspectRatioOptions).toEqual([
      '1:1',
      '2:3',
      '3:2',
      '9:16',
      '16:9',
    ])
    expect(imagenCaps?.image?.aspectRatioOptions).toEqual(['1:1', '9:16', '16:9'])
    expect(imagenCaps?.image?.resolutionOptions).toEqual(['1K', '2K'])
  })

  it('exposes curated common Google Veo and xAI Grok video ratios', () => {
    const veoCaps = findBuiltinCapabilities('video', 'google', 'veo-3.1-generate-preview')
    const grokVideoCaps = findBuiltinCapabilities('video', 'grok', 'grok-imagine-video')

    expect(veoCaps?.video?.aspectRatioOptions).toEqual(['16:9', '9:16'])
    expect(veoCaps?.video?.resolutionOptions).toEqual(['720p', '1080p', '4k'])
    expect(grokVideoCaps?.video?.aspectRatioOptions).toEqual([
      '1:1',
      '2:3',
      '3:2',
      '9:16',
      '16:9',
    ])
    const grokDurations = grokVideoCaps?.video?.durationOptions || []
    expect(grokDurations[0]).toBe(1)
    expect(grokDurations[grokDurations.length - 1]).toBe(15)
  })

  it('exposes curated common xAI Grok image aspect ratios', () => {
    const grokImageCaps = findBuiltinCapabilities('image', 'grok', 'grok-imagine-image')
    const grokImageProCaps = findBuiltinCapabilities('image', 'grok', 'grok-imagine-image-pro')

    expect(grokImageCaps?.image?.aspectRatioOptions).toEqual([
      '1:1',
      '2:3',
      '3:2',
      '9:16',
      '16:9',
    ])
    expect(grokImageCaps?.image?.resolutionOptions).toEqual(['1k', '2k'])
    expect(grokImageProCaps?.image?.aspectRatioOptions).toEqual([
      '1:1',
      '2:3',
      '3:2',
      '9:16',
      '16:9',
    ])
    expect(grokImageProCaps?.image?.resolutionOptions).toEqual(['1k', '2k'])
  })

  it('maps gemini-compatible gcp llm ids to the canonical Gemini capability catalog', () => {
    const capabilities = findBuiltinCapabilities(
      'llm',
      'gemini-compatible:provider-1',
      'gemini-3.1-pro-preview-gcp',
    )

    expect(capabilities?.llm?.reasoningEffortOptions).toEqual(['low', 'medium', 'high'])
  })
})
