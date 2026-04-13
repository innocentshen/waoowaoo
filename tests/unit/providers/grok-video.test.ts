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
const normalizeToOriginalMediaUrlMock = vi.hoisted(() =>
  vi.fn(async (input: string) => input),
)

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
}))

vi.mock('@/lib/media/outbound-image', () => ({
  normalizeToBase64ForGeneration: normalizeToBase64ForGenerationMock,
  normalizeToOriginalMediaUrl: normalizeToOriginalMediaUrlMock,
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
        resolution: '720P',
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
      resolution: '720p',
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

  it('uses reference_images when related visual references are provided', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      request_id: 'req_reference',
    }), { status: 200 }))

    await generateGrokVideo({
      userId: 'user-1',
      prompt: 'keep the same hero and location',
      referenceImages: [
        'https://example.com/panel.png',
        'data:image/png;base64,INLINE_REF',
      ],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
        duration: 8,
        resolution: '720P',
        aspectRatio: '16:9',
      },
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/videos/generations')
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.image).toBeUndefined()
    expect(body.reference_images).toEqual([
      { url: 'https://example.com/panel.png' },
      { url: 'data:image/png;base64,INLINE_REF' },
    ])
    expect(body.duration).toBe(8)
    expect(body.resolution).toBe('720p')
    expect(body.aspect_ratio).toBe('16:9')
    expect(normalizeToOriginalMediaUrlMock).toHaveBeenCalledWith('https://example.com/panel.png')
  })

  it('rejects unsupported video resolution before calling xai', async () => {
    await expect(generateGrokVideo({
      userId: 'user-1',
      imageUrl: 'https://example.com/source.png',
      prompt: 'animate it',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
        duration: 5,
        resolution: '1080P',
      },
    })).rejects.toThrow('GROK_VIDEO_RESOLUTION_UNSUPPORTED')

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects mixing source images with reference images before calling xai', async () => {
    await expect(generateGrokVideo({
      userId: 'user-1',
      imageUrl: 'https://example.com/source.png',
      prompt: 'animate it',
      referenceImages: ['https://example.com/ref.png'],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
      },
    })).rejects.toThrow('GROK_VIDEO_INPUT_CONFLICT: imageUrl+referenceImages')

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects more than seven reference images before calling xai', async () => {
    await expect(generateGrokVideo({
      userId: 'user-1',
      prompt: 'keep the same cast',
      referenceImages: [
        'https://example.com/ref-1.png',
        'https://example.com/ref-2.png',
        'https://example.com/ref-3.png',
        'https://example.com/ref-4.png',
        'https://example.com/ref-5.png',
        'https://example.com/ref-6.png',
        'https://example.com/ref-7.png',
        'https://example.com/ref-8.png',
      ],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
      },
    })).rejects.toThrow('GROK_VIDEO_REFERENCE_LIMIT_EXCEEDED')

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('uses the edits endpoint when given a source video', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      request_id: 'req_edit',
    }), { status: 200 }))

    await generateGrokVideo({
      userId: 'user-1',
      videoUrl: 'https://example.com/source.mp4',
      prompt: 'change the camera move',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
      },
    })

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/videos/edits')
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'grok-imagine-video',
      prompt: 'change the camera move',
      video_url: 'https://example.com/source.mp4',
    })
  })

  it('preserves non-json error bodies instead of masking them as invalid json', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('team credits exhausted', { status: 429 }))

    await expect(generateGrokVideo({
      userId: 'user-1',
      videoUrl: 'https://example.com/source.mp4',
      prompt: 'change the camera move',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
      },
    })).rejects.toThrow('GROK_VIDEO_REQUEST_FAILED(429): team credits exhausted')
  })

  it('still fails explicitly when a successful response is not valid json', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('ok', { status: 200 }))

    await expect(generateGrokVideo({
      userId: 'user-1',
      videoUrl: 'https://example.com/source.mp4',
      prompt: 'change the camera move',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
      },
    })).rejects.toThrow('GROK_VIDEO_RESPONSE_INVALID_JSON')
  })

  it('uses the extensions endpoint when given a source video and duration', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      request_id: 'req_extend',
    }), { status: 200 }))

    await generateGrokVideo({
      userId: 'user-1',
      videoUrl: 'https://example.com/source.mp4',
      prompt: 'continue forward',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-video',
        duration: 4,
      },
    })

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/videos/extensions')
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'grok-imagine-video',
      prompt: 'continue forward',
      duration: 4,
      video: {
        url: 'https://example.com/source.mp4',
      },
    })
  })
})
