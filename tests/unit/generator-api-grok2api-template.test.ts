import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveModelSelectionMock = vi.hoisted(() => vi.fn())
const getProviderConfigMock = vi.hoisted(() => vi.fn())
const resolveModelGatewayRouteMock = vi.hoisted(() => vi.fn(() => 'openai-compat'))
const generateImageViaOpenAICompatTemplateMock = vi.hoisted(() => vi.fn(async () => ({ success: true, imageUrl: 'image' })))
const generateVideoViaOpenAICompatTemplateMock = vi.hoisted(() => vi.fn(async () => ({ success: true, videoUrl: 'video' })))

vi.mock('@/lib/api-config', () => ({
  resolveModelSelection: resolveModelSelectionMock,
  getProviderConfig: getProviderConfigMock,
  getProviderKey: (providerId: string) => providerId.split(':')[0] || providerId,
}))

vi.mock('@/lib/model-gateway', () => ({
  resolveModelGatewayRoute: resolveModelGatewayRouteMock,
  generateImageViaOpenAICompat: vi.fn(),
  generateVideoViaOpenAICompat: vi.fn(),
  generateImageViaOpenAICompatTemplate: generateImageViaOpenAICompatTemplateMock,
  generateVideoViaOpenAICompatTemplate: generateVideoViaOpenAICompatTemplateMock,
}))

vi.mock('@/lib/generators/factory', () => ({
  createImageGenerator: vi.fn(() => ({ generate: vi.fn() })),
  createVideoGenerator: vi.fn(() => ({ generate: vi.fn() })),
  createAudioGenerator: vi.fn(() => ({ generate: vi.fn() })),
}))

vi.mock('@/lib/providers/bailian', () => ({
  generateBailianImage: vi.fn(),
  generateBailianVideo: vi.fn(),
  generateBailianAudio: vi.fn(),
}))

vi.mock('@/lib/providers/siliconflow', () => ({
  generateSiliconFlowImage: vi.fn(),
  generateSiliconFlowVideo: vi.fn(),
  generateSiliconFlowAudio: vi.fn(),
}))

import { generateImage, generateVideo } from '@/lib/generator-api'

const IMAGE_TEMPLATE = {
  version: 1 as const,
  mediaType: 'image' as const,
  mode: 'sync' as const,
  create: { method: 'POST' as const, path: '/images/generations' },
  response: { outputUrlPath: '$.data[0].url' },
}

const VIDEO_TEMPLATE = {
  version: 1 as const,
  mediaType: 'video' as const,
  mode: 'async' as const,
  create: { method: 'POST' as const, path: '/videos' },
  status: { method: 'GET' as const, path: '/videos/{{task_id}}' },
  response: { taskIdPath: '$.id', statusPath: '$.status' },
}

describe('generator-api grok2api compat template normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveModelGatewayRouteMock.mockReturnValue('openai-compat')
    getProviderConfigMock.mockResolvedValue({
      id: 'openai-compatible:oa-1',
      name: 'OpenAI Compat',
      apiKey: 'oa-key',
      gatewayRoute: 'openai-compat',
    })
  })

  it('maps grok2api image aspect ratio to supported size', async () => {
    resolveModelSelectionMock.mockResolvedValueOnce({
      provider: 'openai-compatible:oa-1',
      modelId: 'grok-imagine-image',
      modelKey: 'openai-compatible:oa-1::grok-imagine-image',
      mediaType: 'image',
      compatMediaTemplate: IMAGE_TEMPLATE,
    })

    await generateImage('user-1', 'openai-compatible:oa-1::grok-imagine-image', 'draw cat', {
      aspectRatio: '16:9',
    })

    expect(generateImageViaOpenAICompatTemplateMock).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        aspectRatio: '16:9',
        size: '1280x720',
      }),
    }))
  })

  it('uses explicit grok2api image size from resolution-like option and falls back to upstream default', async () => {
    resolveModelSelectionMock.mockResolvedValueOnce({
      provider: 'openai-compatible:oa-1',
      modelId: 'grok-imagine-image-edit',
      modelKey: 'openai-compatible:oa-1::grok-imagine-image-edit',
      mediaType: 'image',
      compatMediaTemplate: IMAGE_TEMPLATE,
    })

    await generateImage('user-1', 'openai-compatible:oa-1::grok-imagine-image-edit', 'edit cat', {
      resolution: '1024x1792',
      referenceImages: ['https://example.com/ref.png'],
    })

    expect(generateImageViaOpenAICompatTemplateMock).toHaveBeenLastCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        resolution: '1024x1792',
        size: '1024x1792',
      }),
    }))

    resolveModelSelectionMock.mockResolvedValueOnce({
      provider: 'openai-compatible:oa-1',
      modelId: 'grok-imagine-image-lite',
      modelKey: 'openai-compatible:oa-1::grok-imagine-image-lite',
      mediaType: 'image',
      compatMediaTemplate: IMAGE_TEMPLATE,
    })

    await generateImage('user-1', 'openai-compatible:oa-1::grok-imagine-image-lite', 'draw dog')

    expect(generateImageViaOpenAICompatTemplateMock).toHaveBeenLastCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        size: '1024x1024',
      }),
    }))
  })

  it('maps grok2api video aspect ratio and resolution to size and quality', async () => {
    resolveModelSelectionMock.mockResolvedValueOnce({
      provider: 'openai-compatible:oa-1',
      modelId: 'grok-imagine-video',
      modelKey: 'openai-compatible:oa-1::grok-imagine-video',
      mediaType: 'video',
      compatMediaTemplate: VIDEO_TEMPLATE,
    })

    await generateVideo('user-1', 'openai-compatible:oa-1::grok-imagine-video', 'https://example.com/source.png', {
      prompt: 'animate',
      aspectRatio: '9:16',
      resolution: '720p',
      duration: 6,
    })

    expect(generateVideoViaOpenAICompatTemplateMock).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        aspectRatio: '9:16',
        resolution: '720p',
        size: '720x1280',
        quality: 'high',
      }),
    }))
  })
})
