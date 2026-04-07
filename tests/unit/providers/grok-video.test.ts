import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProviderConfigMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'grok',
  name: 'xAI Grok',
  apiKey: 'grok-key',
  baseUrl: 'https://api.x.ai/v1',
})))

const normalizeToBase64ForGenerationMock = vi.hoisted(() =>
  vi.fn(async () => 'data:image/png;base64,VIDEO_REF_BASE64'),
)

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
}))

vi.mock('@/lib/media/outbound-image', () => ({
  normalizeToBase64ForGeneration: normalizeToBase64ForGenerationMock,
}))

import { generateGrokVideo } from '@/lib/providers/grok/video'

describe('generateGrokVideo', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
  })

  it('submits video generation requests and returns async external id', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      request_id: 'req_123',
    }), { status: 200 }))

    const result = await generateGrokVideo({
      userId: 'user-1',
      imageUrl: 'https://example.com/source.png',
      prompt: 'animate it',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
        duration: 5,
        resolution: '1080P',
        aspectRatio: '9:16',
      },
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/videos/generations')
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({
      model: 'grok-imagine-video',
      prompt: 'animate it',
      duration: 5,
      resolution: '1080p',
      aspect_ratio: '9:16',
      image: {
        url: 'data:image/png;base64,VIDEO_REF_BASE64',
      },
    })
    expect(result).toEqual({
      success: true,
      async: true,
      requestId: 'req_123',
      externalId: 'GROK:VIDEO:req_123',
    })
  })
})
