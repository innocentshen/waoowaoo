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
      '16:9',
      '9:16',
      '4:3',
      '3:4',
      '3:2',
      '2:3',
    ])
    const grokDurations = grokVideoCaps?.video?.durationOptions || []
    expect(grokDurations[0]).toBe(1)
    expect(grokDurations[grokDurations.length - 1]).toBe(15)
  })

  it('exposes curated common xAI Grok image aspect ratios', () => {
    const grokImageCaps = findBuiltinCapabilities('image', 'grok', 'grok-imagine-image')
    const grokImageProCaps = findBuiltinCapabilities('image', 'grok', 'grok-imagine-image-pro')

    expect(grokImageCaps?.image?.aspectRatioOptions).toEqual([
      'auto',
      '1:1',
      '16:9',
      '9:16',
      '4:3',
      '3:4',
      '3:2',
      '2:3',
      '2:1',
      '1:2',
      '19.5:9',
      '9:19.5',
      '20:9',
      '9:20',
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

  it('exposes GPT-5.5 reasoning effort options for OpenAI compatible providers', () => {
    const customCapabilities = findBuiltinCapabilities(
      'llm',
      'openai-compatible:provider-1',
      'gpt-5.5',
    )
    const openRouterCapabilities = findBuiltinCapabilities(
      'llm',
      'openrouter',
      'openai/gpt-5.5',
    )

    expect(customCapabilities?.llm?.reasoningEffortOptions).toEqual(['low', 'medium', 'high', 'xhigh'])
    expect(openRouterCapabilities?.llm?.reasoningEffortOptions).toEqual(['low', 'medium', 'high', 'xhigh'])
  })

  it('exposes OpenAI compatible GPT image model sizing capabilities', () => {
    const capabilities = findBuiltinCapabilities(
      'image',
      'openai-compatible:provider-1',
      'gpt-image-2',
    )

    expect(capabilities?.image?.aspectRatioOptions).toEqual(['1:1', '3:2', '2:3', '16:9', '9:16'])
    expect(capabilities?.image?.resolutionOptions).toEqual([
      'auto',
      '1024x1024',
      '1536x1024',
      '1024x1536',
      '1792x1024',
      '1024x1792',
    ])
  })
})
